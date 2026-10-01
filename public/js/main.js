const hookRegionSorter = () => {
    const regionSelect = document.getElementById("region-filter");

    if (regionSelect) {
        regionSelect.addEventListener("change", () => {
            const selectedRegion = regionSelect.value;
            const url = new URL(window.location.href);

            if (selectedRegion && selectedRegion !== "all") {
                url.searchParams.set("region", selectedRegion);
            } else {
                url.searchParams.delete("region");
            }

            window.location.href = url.toString();
        });
    }
};

const hookSeasonSorter = () => {
    const seasonSelect = document.getElementById("season-filter");

    if (seasonSelect) {
        seasonSelect.addEventListener("change", () => {
            const selectedSeason = seasonSelect.value;
            const url = new URL(window.location.href);

            if (selectedSeason && selectedSeason !== "all") {
                url.searchParams.set("season", selectedSeason);
            } else {
                url.searchParams.delete("season");
            }

            window.location.href = url.toString();
        });
    }
};

const hookTrainsCatalog = async () => {
    const listEl = document.getElementById("trains-list");
    const templateEl = document.getElementById("train-card-template");
    const loadingEl = document.getElementById("trains-loading");
    const errorEl = document.getElementById("trains-error");

    if (!listEl || !templateEl) {
        return;
    }

    try {
        const response = await fetch("/api/trains");

        if (!response.ok) {
            throw new Error(`Failed to load trains (${response.status})`);
        }

        const payload = await response.json();
        const trains = payload.trains || [];
        const fragment = document.createDocumentFragment();

        trains.forEach((train) => {
            const card = templateEl.content.cloneNode(true);
            const imageEl = card.querySelector('[data-field="image"]');

            imageEl.src = train.imageUrl;
            imageEl.alt = train.imageAlt || `${train.name} train`;

            card.querySelector('[data-field="name"]').textContent = train.name;
            card.querySelector('[data-field="operator"]').textContent =
                train.operator;
            card.querySelector('[data-field="type"]').textContent = train.type;
            card.querySelector('[data-field="speed"]').textContent =
                `${train.maxSpeedKmh} km/h`;
            card.querySelector('[data-field="seats"]').textContent =
                `${train.capacity} seats`;
            card.querySelector('[data-field="power"]').textContent =
                train.powerSource;
            card.querySelector('[data-field="description"]').textContent =
                train.description;
            card.querySelector('[data-field="best-for"]').textContent =
                train.bestFor;

            fragment.appendChild(card);
        });

        listEl.replaceChildren(fragment);

        if (loadingEl) {
            loadingEl.hidden = true;
        }
    } catch (error) {
        console.error("Error loading trains:", error);

        if (loadingEl) {
            loadingEl.hidden = true;
        }

        if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent =
                "Unable to load trains right now. Please try again in a moment.";
        }
    }
};

const loadBookingTicketClasses = async () => {
    const ticketClassSelect = document.getElementById(
        "booking-ticket-class"
    );

    if (!ticketClassSelect) {
        return;
    }

    try {
        const response = await fetch("/api/ticket-classes");

        if (!response.ok) {
            throw new Error(
                `Failed to load ticket classes (${response.status})`
            );
        }

        const ticketClasses = await response.json();

        ticketClasses.forEach((ticketClass) => {
            const option = document.createElement("option");

            option.value = ticketClass.class;
            option.textContent = ticketClass.name || ticketClass.class;

            ticketClassSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading ticket classes:", error);
    }
};

const renderBookingCards = (bookings, trips, templateEl, listEl) => {
    const tripNamesById = new Map(
        trips.map((trip) => [String(trip.id), trip.name])
    );

    const fragment = document.createDocumentFragment();

    bookings.forEach((booking) => {
        const card = templateEl.content.cloneNode(true);

        const dayLabel = booking.selectedDay
            ? booking.selectedDay.charAt(0).toUpperCase() +
            booking.selectedDay.slice(1)
            : "";

        card.querySelector('[data-field="id"]').textContent =
            booking.id;

        card.querySelector('[data-field="ticketClass"]').textContent =
            booking.ticketClass;

        card.querySelector('[data-field="totalPrice"]').textContent =
            `¥${Number(booking.totalPrice).toLocaleString()}`;

        card.querySelector('[data-field="tripName"]').textContent =
            tripNamesById.get(String(booking.tripId)) ||
            booking.tripId;

        card.querySelector('[data-field="selectedDay"]').textContent =
            dayLabel;

        card.querySelector('[data-field="passengerCount"]').textContent =
            (booking.passengers || []).length;

        card.querySelector('[data-field="createdAt"]').textContent =
            new Date(booking.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });

        card.querySelector('[data-field="viewLink"]').href =
            `/bookings/${booking.id}`;

        fragment.appendChild(card);
    });

    listEl.replaceChildren(fragment);
};

const hookBookingsCatalog = async () => {
    const listEl = document.getElementById("bookings-list");
    const templateEl = document.getElementById("booking-card-template");
    const loadingEl = document.getElementById("bookings-loading");
    const errorEl = document.getElementById("bookings-error");
    const filterErrorEl = document.getElementById(
        "bookings-filter-error"
    );

    const filterForm = document.getElementById("bookings-filters");
    const clearFiltersButton = document.getElementById(
        "bookings-clear-filters"
    );

    const ticketClassSelect = document.getElementById(
        "booking-ticket-class"
    );

    const startDateInput = document.getElementById(
        "booking-start-date"
    );

    const endDateInput = document.getElementById(
        "booking-end-date"
    );

    const paginationEl = document.getElementById(
        "bookings-pagination"
    );

    const previousButton = document.getElementById(
        "bookings-previous"
    );

    const nextButton = document.getElementById("bookings-next");

    const pageStatusEl = document.getElementById(
        "bookings-page-status"
    );

    if (!listEl || !templateEl) {
        return;
    }

    await loadBookingTicketClasses();

    let currentPage = 1;
    const pageSize = 10;

    const loadBookings = async () => {
        if (loadingEl) {
            loadingEl.hidden = false;
        }

        if (errorEl) {
            errorEl.hidden = true;
        }

        if (filterErrorEl) {
            filterErrorEl.hidden = true;
        }

        const params = new URLSearchParams();

        params.set("page", String(currentPage));
        params.set("limit", String(pageSize));
        params.set("sort", "createdAt");
        params.set("order", "desc");

        if (ticketClassSelect?.value) {
            params.set("ticketClass", ticketClassSelect.value);
        }

        if (startDateInput?.value) {
            params.set("startDate", startDateInput.value);
        }

        if (endDateInput?.value) {
            params.set("endDate", endDateInput.value);
        }

        try {
            const [bookingsResponse, tripsResponse] = await Promise.all([
                fetch(`/api/bookings?${params.toString()}`),
                fetch("/api/trips")
            ]);

            const bookingsPayload = await bookingsResponse.json();

            if (!bookingsResponse.ok) {
                const message =
                    bookingsPayload.errors
                        ?.map((item) => item.message)
                        .join(" ") ||
                    "Unable to load bookings right now.";

                if (filterErrorEl) {
                    filterErrorEl.hidden = false;
                    filterErrorEl.textContent = message;
                }

                throw new Error(
                    `Failed to load bookings (${bookingsResponse.status})`
                );
            }

            if (!tripsResponse.ok) {
                throw new Error(
                    `Failed to load trips (${tripsResponse.status})`
                );
            }

            const trips = await tripsResponse.json();

            renderBookingCards(
                bookingsPayload.data || [],
                trips,
                templateEl,
                listEl
            );

            const pagination = bookingsPayload.pagination;

            if (paginationEl && pagination) {
                paginationEl.hidden = pagination.totalPages <= 1;

                if (pageStatusEl) {
                    pageStatusEl.textContent =
                        `Page ${pagination.page} of ${pagination.totalPages}`;
                }

                if (previousButton) {
                    previousButton.disabled =
                        !pagination.hasPreviousPage;
                }

                if (nextButton) {
                    nextButton.disabled =
                        !pagination.hasNextPage;
                }
            }

            if (loadingEl) {
                loadingEl.hidden = true;
            }
        } catch (error) {
            console.error("Error loading bookings:", error);

            if (loadingEl) {
                loadingEl.hidden = true;
            }

            if (errorEl && (!filterErrorEl || filterErrorEl.hidden)) {
                errorEl.hidden = false;
                errorEl.textContent =
                    "Unable to load bookings right now. Please try again in a moment.";
            }
        }
    };

    if (filterForm) {
        filterForm.addEventListener("submit", (event) => {
            event.preventDefault();

            currentPage = 1;
            loadBookings();
        });
    }

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", () => {
            if (ticketClassSelect) {
                ticketClassSelect.value = "";
            }

            if (startDateInput) {
                startDateInput.value = "";
            }

            if (endDateInput) {
                endDateInput.value = "";
            }

            if (filterErrorEl) {
                filterErrorEl.hidden = true;
            }

            currentPage = 1;
            loadBookings();
        });
    }

    if (previousButton) {
        previousButton.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage -= 1;
                loadBookings();
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            currentPage += 1;
            loadBookings();
        });
    }

    loadBookings();
};

const fetchAllBookings = async () => {
    const allBookings = [];
    let page = 1;
    const limit = 50;

    while (true) {
        const response = await fetch(
            `/api/bookings?page=${page}&limit=${limit}&sort=createdAt&order=desc`
        );

        if (!response.ok) {
            throw new Error(
                `Failed to load bookings (${response.status})`
            );
        }

        const payload = await response.json();

        allBookings.push(...(payload.data || []));

        if (
            !payload.pagination ||
            !payload.pagination.hasNextPage
        ) {
            break;
        }

        page += 1;
    }

    return allBookings;
};

const hookUserDashboard = async () => {
    const dashboardEl = document.getElementById("user-dashboard");
    const listEl = document.getElementById("user-bookings-list");
    const loadingEl = document.getElementById(
        "user-bookings-loading"
    );
    const errorEl = document.getElementById("user-bookings-error");
    const emptyEl = document.getElementById("user-bookings-empty");
    const templateEl = document.getElementById(
        "user-booking-card-template"
    );

    if (!dashboardEl || !listEl || !templateEl) {
        return;
    }

    const userEmail = dashboardEl.dataset.userEmail;

    if (!userEmail) {
        return;
    }

    try {
        const [bookings, tripsResponse] = await Promise.all([
            fetchAllBookings(),
            fetch("/api/trips")
        ]);

        if (!tripsResponse.ok) {
            throw new Error(
                `Failed to load trips (${tripsResponse.status})`
            );
        }

        const trips = await tripsResponse.json();

        const tripNamesById = new Map(
            trips.map((trip) => [String(trip.id), trip.name])
        );

        const userBookings = bookings.filter((booking) => {
            return (booking.passengers || []).some((passenger) => {
                return (
                    passenger.email &&
                    passenger.email.toLowerCase() ===
                    userEmail.toLowerCase()
                );
            });
        });

        if (loadingEl) {
            loadingEl.hidden = true;
        }

        if (userBookings.length === 0) {
            if (emptyEl) {
                emptyEl.hidden = false;
            }

            return;
        }

        const fragment = document.createDocumentFragment();

        userBookings.forEach((booking) => {
            const card = templateEl.content.cloneNode(true);

            const dayLabel = booking.selectedDay
                ? booking.selectedDay.charAt(0).toUpperCase() +
                booking.selectedDay.slice(1)
                : "";

            card.querySelector('[data-field="id"]').textContent =
                booking.id;

            card.querySelector('[data-field="tripName"]').textContent =
                tripNamesById.get(String(booking.tripId)) ||
                booking.tripId;

            card.querySelector('[data-field="ticketClass"]').textContent =
                booking.ticketClass;

            card.querySelector('[data-field="selectedDay"]').textContent =
                dayLabel;

            card.querySelector('[data-field="passengerCount"]').textContent =
                (booking.passengers || []).length;

            card.querySelector('[data-field="totalPrice"]').textContent =
                `¥${Number(booking.totalPrice).toLocaleString()}`;

            card.querySelector('[data-field="viewLink"]').href =
                `/bookings/${booking.id}`;

            fragment.appendChild(card);
        });

        listEl.replaceChildren(fragment);
    } catch (error) {
        console.error("Error loading user dashboard:", error);

        if (loadingEl) {
            loadingEl.hidden = true;
        }

        if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent =
                "Unable to load your bookings right now. Please try again in a moment.";
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    hookRegionSorter();
    hookSeasonSorter();
    hookTrainsCatalog();
    hookBookingsCatalog();
    hookUserDashboard();
});