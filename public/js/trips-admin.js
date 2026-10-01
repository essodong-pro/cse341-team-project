const tripList = document.querySelector("#trips-admin-list");
const loadingMessage = document.querySelector("#trip-loading");
const errorMessage = document.querySelector("#trip-error");
const successMessage = document.querySelector("#trip-message");

async function loadTrips() {
    try {
        const response = await fetch("/api/trips");

        if (!response.ok) {
            throw new Error("Failed to load trips.");
        }

        const trips = await response.json();

        loadingMessage.textContent = "";
        errorMessage.textContent = "";
        tripList.innerHTML = "";

        trips.forEach((trip) => {
            const card = document.createElement("article");

            card.innerHTML = `
                <h2>${trip.name}</h2>
                <p><strong>Region:</strong> ${trip.region}</p>
                <p><strong>Route:</strong> ${trip.startStation} to ${trip.endStation}</p>
                <p><strong>Duration:</strong> ${trip.duration}</p>
                <p><strong>Distance:</strong> ${trip.distance}</p>

                <button type="button" data-action="edit" data-id="${trip.id}">
                    Edit
                </button>

                <button type="button" data-action="delete" data-id="${trip.id}">
                    Delete
                </button>
            `;

            tripList.appendChild(card);
        });
    } catch (error) {
        loadingMessage.textContent = "";
        errorMessage.textContent = error.message;
    }
}

tripList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    const tripId = button.dataset.id;
    const action = button.dataset.action;

    if (action === "edit") {
        await editTrip(tripId);
    }

    if (action === "delete") {
        await deleteTrip(tripId);
    }
});

async function editTrip(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}`);

        if (!response.ok) {
            throw new Error("Failed to load trip.");
        }

        const trip = await response.json();

        const name = window.prompt("Trip name:", trip.name);
        if (name === null) return;

        const description = window.prompt(
            "Description:",
            trip.description
        );
        if (description === null) return;

        const region = window.prompt("Region:", trip.region);
        if (region === null) return;

        const startStation = window.prompt(
            "Start station:",
            trip.startStation
        );
        if (startStation === null) return;

        const endStation = window.prompt(
            "End station:",
            trip.endStation
        );
        if (endStation === null) return;

        const duration = window.prompt(
            "Duration:",
            trip.duration
        );
        if (duration === null) return;

        const distance = window.prompt(
            "Distance:",
            trip.distance
        );
        if (distance === null) return;

        const responseUpdate = await fetch(`/api/trips/${tripId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                description,
                region,
                startStation,
                endStation,
                duration,
                distance: Number(distance)
            })
        });

        const result = await responseUpdate.json();

        if (!responseUpdate.ok) {
            throw new Error(
                result.error || "Failed to update trip."
            );
        }

        successMessage.textContent = "Trip updated successfully.";
        await loadTrips();
    } catch (error) {
        errorMessage.textContent = error.message;
    }
}

async function deleteTrip(tripId) {
    const confirmed = window.confirm(
        "Are you sure you want to delete this trip?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/trips/${tripId}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Failed to delete trip.");
        }

        successMessage.textContent = "Trip deleted successfully.";
        await loadTrips();
    } catch (error) {
        errorMessage.textContent = error.message;
    }
}

loadTrips();