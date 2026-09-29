(() => {
    const root = document.getElementById('users-admin');

    if (!root) {
        return;
    }

    const listEl = document.getElementById('users-list');
    const loadingEl = document.getElementById('users-loading');
    const errorEl = document.getElementById('users-error');
    const messageEl = document.getElementById('users-message');
    const cardTemplate = document.getElementById('user-card-template');
    const editTemplate = document.getElementById('user-edit-template');
    const deleteDialog = document.getElementById('delete-dialog');
    const paginationEl = document.getElementById('users-pagination');
    const pageStatusEl = document.getElementById('users-page-status');
    const previousButton = paginationEl.querySelector('[data-page-action="previous"]');
    const nextButton = paginationEl.querySelector('[data-page-action="next"]');

    const SELF_DELETE_REDIRECT_MS = 2500;
    const PAGE_SIZE = 10;

    const state = {
        currentUserId: root.dataset.currentUserId,
        currentUserRole: root.dataset.currentUserRole,
        usersById: new Map(),
        page: 1,
        pagination: null
    };

    const showMessage = (text, tone = 'success') => {
        messageEl.textContent = text;
        messageEl.dataset.tone = tone;
        messageEl.hidden = false;
    };

    const hideMessage = () => {
        messageEl.hidden = true;
    };

    const findCard = (userId) => {
        return listEl.querySelector(`[data-user-id="${CSS.escape(userId)}"]`);
    };

    const focusEditButton = (userId) => {
        findCard(userId)?.querySelector('[data-action="edit"]')?.focus();
    };

    const redirectIfUnauthorized = (response) => {
        if (response.status === 401) {
            window.location.assign('/login');
            return true;
        }

        return false;
    };

    const readError = async (response, fallback) => {
        try {
            const body = await response.json();
            const validationMessage = body.errors?.map((error) => error.message).join(' ');

            return validationMessage || body.error || body.message || fallback;
        } catch {
            return fallback;
        }
    };

    const formatRole = (role) => {
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';
    };

    const formatDate = (value) => {
        const date = value ? new Date(value) : null;

        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const renderUsers = () => {
        const fragment = document.createDocumentFragment();

        for (const user of state.usersById.values()) {
            const card = cardTemplate.content.cloneNode(true);

            card.querySelector('[data-user-id]').dataset.userId = user._id;
            card.querySelector('[data-field="displayName"]').textContent = user.displayName;
            card.querySelector('[data-field="role"]').textContent = formatRole(user.role);
            card.querySelector('[data-field="username"]').textContent = user.username;
            card.querySelector('[data-field="email"]').textContent = user.email;
            card.querySelector('[data-field="createdAt"]').textContent = formatDate(user.createdAt);

            fragment.appendChild(card);
        }

        listEl.replaceChildren(fragment);
    };

    const renderPagination = () => {
        const { page, totalPages, totalItems, hasNextPage, hasPreviousPage } = state.pagination;

        paginationEl.hidden = totalItems === 0;
        pageStatusEl.textContent = `Page ${page} of ${totalPages} · ${totalItems} ${totalItems === 1 ? 'user' : 'users'}`;
        previousButton.disabled = !hasPreviousPage;
        nextButton.disabled = !hasNextPage;
    };

    const buildQuery = (page) => {
        return new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    };

    const loadUsers = async (page = state.page) => {
        const response = await fetch(`/api/users?${buildQuery(page)}`);

        if (redirectIfUnauthorized(response)) {
            return;
        }

        if (!response.ok) {
            throw new Error(await readError(response, 'Unable to load users right now.'));
        }

        const { data, pagination } = await response.json();

        // Deleting the last user on the final page leaves it empty; jump to the new last page.
        if (data.length === 0 && pagination.page > 1) {
            await loadUsers(Math.max(1, pagination.totalPages));
            return;
        }

        state.page = pagination.page;
        state.pagination = pagination;
        state.usersById = new Map(data.map((user) => [user._id, user]));
        renderUsers();
        renderPagination();
    };

    const saveUser = async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const formError = form.querySelector('[data-field="formError"]');
        const submitButton = form.querySelector('button[type="submit"]');
        const userId = form.dataset.userId;
        const body = Object.fromEntries(new FormData(form));

        submitButton.disabled = true;
        formError.hidden = true;
        hideMessage();

        let updated;

        try {
            const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (redirectIfUnauthorized(response)) {
                return;
            }

            if (!response.ok) {
                formError.textContent = await readError(response, 'The user could not be updated.');
                formError.hidden = false;
                return;
            }

            updated = await response.json();
        } catch {
            formError.textContent = 'Network error. Please try again.';
            formError.hidden = false;
            return;
        } finally {
            submitButton.disabled = false;
        }

        // From here on the form is replaced, so report problems in the banner.
        if (updated._id === state.currentUserId) {
            state.currentUserRole = updated.role;
        }

        // Reload the page: a renamed user can move in the username sort, and a
        // self-demoted admin now only sees their own record.
        try {
            await loadUsers();
        } catch (error) {
            state.usersById.set(updated._id, updated);
            renderUsers();
            showMessage(`${updated.displayName} was updated, but the list could not be refreshed.`, 'error');
            return;
        }

        showMessage(`${updated.displayName} was updated.`);

        if (findCard(updated._id)) {
            focusEditButton(updated._id);
        } else {
            messageEl.focus();
        }
    };

    const showEditor = (user) => {
        hideMessage();
        renderUsers();

        const card = findCard(user._id);
        const editor = editTemplate.content.cloneNode(true);
        const form = editor.querySelector('form');

        form.dataset.userId = user._id;
        form.elements.displayName.value = user.displayName;
        form.elements.username.value = user.username;
        form.elements.email.value = user.email;

        if (state.currentUserRole === 'admin') {
            form.elements.role.value = user.role;
        } else {
            form.querySelector('[data-admin-only]').remove();
        }

        form.addEventListener('submit', saveUser);
        card.replaceWith(editor);
        form.elements.displayName.focus();
    };

    const confirmDelete = (user) => {
        const isSelf = user._id === state.currentUserId;

        deleteDialog.querySelector('[data-field="dialogBody"]').textContent = isSelf
            ? `You are about to delete your own account (${user.email}).`
            : `Delete ${user.displayName} (${user.email})? This cannot be undone.`;
        deleteDialog.querySelector('[data-field="selfWarning"]').hidden = !isSelf;
        deleteDialog.returnValue = '';
        deleteDialog.showModal();

        return new Promise((resolve) => {
            deleteDialog.addEventListener('close', () => {
                resolve(deleteDialog.returnValue === 'confirm');
            }, { once: true });
        });
    };

    const setCardBusy = (card, busy) => {
        card.dataset.busy = String(busy);

        for (const button of card.querySelectorAll('button')) {
            button.disabled = busy;
        }
    };

    const deleteUser = async (user, card) => {
        if (card.dataset.busy === 'true') {
            return;
        }

        hideMessage();

        const confirmed = await confirmDelete(user);

        if (!confirmed) {
            return;
        }

        // Block a second Delete while this request is in flight.
        setCardBusy(card, true);

        try {
            const response = await fetch(`/api/users/${encodeURIComponent(user._id)}`, { method: 'DELETE' });

            if (redirectIfUnauthorized(response)) {
                return;
            }

            if (!response.ok) {
                showMessage(await readError(response, 'The user could not be deleted.'), 'error');
                return;
            }

            const result = await response.json();

            if (result.loggedOut) {
                listEl.replaceChildren();
                paginationEl.hidden = true;
                showMessage('Your account was deleted. You are being logged out and redirected to the home page...', 'warning');
                setTimeout(() => {
                    window.location.assign('/');
                }, SELF_DELETE_REDIRECT_MS);
                return;
            }

            // Reload so the next user moves up to fill this page.
            try {
                await loadUsers();
            } catch (error) {
                showMessage(`${user.displayName} was deleted, but the list could not be refreshed.`, 'error');
                return;
            }

            showMessage(`${user.displayName} was deleted.`);
            messageEl.focus();
        } catch {
            showMessage('Network error. Please try again.', 'error');
        } finally {
            if (card.isConnected) {
                setCardBusy(card, false);
            }
        }
    };

    listEl.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        const card = button.closest('[data-user-id]');
        const user = state.usersById.get(card.dataset.userId);

        if (button.dataset.action === 'edit') {
            showEditor(user);
        }

        if (button.dataset.action === 'cancel') {
            renderUsers();
            focusEditButton(user._id);
        }

        if (button.dataset.action === 'delete') {
            await deleteUser(user, card);
        }
    });

    let pageLoading = false;

    paginationEl.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-page-action]');

        if (!button || button.disabled || pageLoading) {
            return;
        }

        const action = button.dataset.pageAction;

        pageLoading = true;
        hideMessage();

        try {
            await loadUsers(action === 'next' ? state.page + 1 : state.page - 1);
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            pageLoading = false;
            renderPagination();

            const sameDirectionButton = action === 'next' ? nextButton : previousButton;
            const otherButton = action === 'next' ? previousButton : nextButton;

            (sameDirectionButton.disabled ? otherButton : sameDirectionButton).focus();
        }
    });

    const init = async () => {
        try {
            await loadUsers();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
        } finally {
            loadingEl.hidden = true;
        }
    };

    init();
})();
