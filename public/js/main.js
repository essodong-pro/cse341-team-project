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

const hookBookingsCatalog = async () => {
    const listEl = document.getElementById("bookings-list");
    const templateEl = document.getElementById("booking-card-template");
    const loadingEl = document.getElementById("bookings-loading");
    const errorEl = document.getElementById("bookings-error");
    const paginationEl = document.getElementById("bookings-pagination");
    const previousButton = document.getElementById("bookings-previous");
    const nextButton = document.getElementById("bookings-next");
    const pageStatusEl = document.getElementById("bookings-page-status");

    if (!listEl || !templateEl) {
        return;
    }

    const PAGE_SIZE = 10;
    let currentPage = 1;
    let totalPages = 1;

    const loadBookings = async (page) => {
        try {
            if (loadingEl) {
                loadingEl.hidden = false;
                loadingEl.textContent = "Loading bookings...";
            }

            if (errorEl) {
                errorEl.hidden = true;
            }

            const [bookingsResponse, tripsResponse] = await Promise.all([
                fetch(
                    `/api/bookings?page=${page}&limit=${PAGE_SIZE}&sort=createdAt&order=desc`
                ),
                fetch("/api/trips")
            ]);

            if (!bookingsResponse.ok) {
                throw new Error(
                    `Failed to load bookings (${bookingsResponse.status})`
                );
            }

            if (!tripsResponse.ok) {
                throw new Error(
                    `Failed to load trips (${tripsResponse.status})`
                );
            }

            const bookingsPayload = await bookingsResponse.json();
            const trips = await tripsResponse.json();

            const bookings = bookingsPayload.data || [];
            const pagination = bookingsPayload.pagination || {};

            currentPage = pagination.page || page;
            totalPages = pagination.totalPages || 1;

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

                card.querySelector(
                    '[data-field="ticketClass"]'
                ).textContent = booking.ticketClass;

                card.querySelector('[data-field="totalPrice"]').textContent =
                    `¥${Number(booking.totalPrice).toLocaleString()}`;

                card.querySelector('[data-field="tripName"]').textContent =
                    tripNamesById.get(String(booking.tripId)) ||
                    booking.tripId;

                card.querySelector('[data-field="selectedDay"]').textContent =
                    dayLabel;

                card.querySelector(
                    '[data-field="passengerCount"]'
                ).textContent = (booking.passengers || []).length;

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

            if (loadingEl) {
                loadingEl.hidden = true;
            }

            if (paginationEl) {
                paginationEl.hidden = false;
            }

            if (pageStatusEl) {
                pageStatusEl.textContent =
                    `Page ${currentPage} of ${totalPages}`;
            }

            if (previousButton) {
                previousButton.disabled = !pagination.hasPreviousPage;
            }

            if (nextButton) {
                nextButton.disabled = !pagination.hasNextPage;
            }
        } catch (error) {
            console.error("Error loading bookings:", error);

            if (loadingEl) {
                loadingEl.hidden = true;
            }

            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent =
                    "Unable to load bookings right now. Please try again in a moment.";
            }

            if (paginationEl) {
                paginationEl.hidden = true;
            }
        }
    };

    if (previousButton) {
        previousButton.addEventListener("click", () => {
            if (currentPage > 1) {
                loadBookings(currentPage - 1);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages) {
                loadBookings(currentPage + 1);
            }
        });
    }

    await loadBookings(currentPage);
};

const fetchAllBookings = async () => {
    const PAGE_SIZE = 50;
    let page = 1;
    let allBookings = [];
    let hasNextPage = true;

    while (hasNextPage) {
        const response = await fetch(
            `/api/bookings?page=${page}&limit=${PAGE_SIZE}&sort=createdAt&order=desc`
        );

        if (!response.ok) {
            throw new Error(
                `Failed to load bookings (${response.status})`
            );
        }

        const payload = await response.json();

        allBookings = allBookings.concat(payload.data || []);

        hasNextPage = Boolean(payload.pagination?.hasNextPage);
        page += 1;
    }

    return allBookings;
};

const hookUserDashboard = async () => {
    const dashboardEl = document.getElementById("user-dashboard");
    const listEl = document.getElementById("user-bookings-list");
    const loadingEl = document.getElementById("user-bookings-loading");
    const errorEl = document.getElementById("user-bookings-error");
    const emptyEl = document.getElementById("user-bookings-empty");
    const templateEl = document.getElementById("user-booking-card-template");

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