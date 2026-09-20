import {
    getAllTrips as fetchAllTrips,
    getTripById as fetchTripById
} from "../models/trips.js";

// ==========================
// API CONTROLLERS
// ==========================

export async function getAllTrips(req, res) {
    try {
        const trips = await fetchAllTrips();

        return res.status(200).json(trips);
    } catch (error) {
        console.error("Error fetching trips:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

export async function getTripById(req, res) {
    try {
        const { id } = req.params;

        const trip = await fetchTripById(id);

        if (!trip) {
            return res.status(404).json({
                error: "Trip not found"
            });
        }

        return res.status(200).json(trip);
    } catch (error) {
        console.error("Error fetching trip by ID:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

// ==========================
// EJS PAGE CONTROLLERS
// ==========================

export async function renderTripsList(req, res) {
    try {
        const allTrips = await fetchAllTrips();

        const regions = [
            ...new Set(
                allTrips
                    .map((trip) => trip.region)
                    .filter(Boolean)
            )
        ];

        const seasons = [
            ...new Set(
                allTrips
                    .map((trip) => trip.bestSeason)
                    .filter(Boolean)
            )
        ];

        return res.render("trips/list", {
            title: "Scenic Railway Trips",
            regions,
            seasons,
            query: req.query || {},
        });
    } catch (error) {
        console.error(
            "Error rendering trips list page:",
            error
        );

        return res.status(500).render("errors/500", {
            title: "Server Error",
            error: error.message,
            stack: error.stack
        });
    }
}

export async function renderTripDetails(req, res) {
    try {
        const { id } = req.params;

        const trip = await fetchTripById(id);

        if (!trip) {
            return res.status(404).render("errors/404", {
                title: "Not Found",
                error: "Trip not found"
            });
        }

        return res.render("trips/details", {
            title: "Trip Details",
            details: trip
        });
    } catch (error) {
        console.error(
            "Error rendering trip details page:",
            error
        );

        return res.status(500).render("errors/500", {
            title: "Server Error",
            error: error.message,
            stack: error.stack
        });
    }
}