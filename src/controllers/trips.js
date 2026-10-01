import {
    getAllTrips as fetchAllTrips,
    getTripById as fetchTripById,
    getPaginatedTrips
} from "../models/trips.js";

// ==========================
// API CONTROLLERS
// ==========================

export async function getAllTrips(req, res) {
    try {
        const page =
            req.query.page === undefined
                ? 1
                : Number(req.query.page);

        const limit =
            req.query.limit === undefined
                ? 10
                : Number(req.query.limit);

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50
        ) {
            return res.status(400).json({
                errors: [
                    {
                        field: "pagination",
                        message:
                            "page and limit must be valid positive numbers. Maximum limit is 50."
                    }
                ]
            });
        }

        const region = req.query.region;
        const season = req.query.season;
        const q = req.query.q;

        const { trips, totalItems } =
            await getPaginatedTrips({
                page,
                limit,
                region,
                season,
                q
            });

        const totalPages = Math.ceil(totalItems / limit);

        return res.status(200).json({
            data: trips,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        });
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