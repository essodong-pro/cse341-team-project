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

    const SELF_DELETE_REDIRECT_MS = 2500;

    const state = {
        currentUserId: root.dataset.currentUserId,
        currentUserRole: root.dataset.currentUserRole,
        usersById: new Map()
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
            return body.error || body.message || fallback;
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

    const loadUsers = async () => {
        const response = await fetch('/api/users');

        if (redirectIfUnauthorized(response)) {
            return;
        }

        if (!response.ok) {
            throw new Error(await readError(response, 'Unable to load users right now.'));
        }

        const users = await response.json();
        state.usersById = new Map(users.map((user) => [user._id, user]));
        renderUsers();
    };

    const saveUser = async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const formError = form.querySelector('[data-field="formError"]');
        const submitButton = form.querySelector('button[type="submit"]');
        const userId = form.dataset.userId;
        const previousRole = state.usersById.get(userId)?.role;
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
        if (updated._id === state.currentUserId && updated.role !== previousRole) {
            state.currentUserRole = updated.role;
            state.usersById.set(updated._id, updated);
            renderUsers();

            try {
                await loadUsers();
            } catch (error) {
                showMessage(error.message, 'error');
                return;
            }
        } else {
            state.usersById.set(updated._id, updated);
            renderUsers();
        }

        showMessage(`${updated.displayName} was updated.`);
        focusEditButton(updated._id);
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
                showMessage('Your account was deleted. You are being logged out and redirected to the home page...', 'warning');
                setTimeout(() => {
                    window.location.assign('/');
                }, SELF_DELETE_REDIRECT_MS);
                return;
            }

            state.usersById.delete(user._id);
            renderUsers();
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
