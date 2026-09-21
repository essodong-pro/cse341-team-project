import { getSchedulesByTripId } from "../models/schedules.js";

// ==========================
// API CONTROLLERS
// ==========================

export async function getSchedulesForTrip(
    req,
    res
) {
    try {
        const { id } = req.params;

        const schedules =
            await getSchedulesByTripId(id);

        if (!schedules.length) {
            return res.status(404).json({
                error: "Schedules not found"
            });
        }

        return res.status(200).json(
            schedules
        );
    } catch (error) {
        console.error(
            "Error fetching schedules:",
            error
        );

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

export async function getSchedulesForTripAndMonth(
    req,
    res
) {
    try {
        const { id } = req.params;
        const { month } = req.query;

        if (
            month &&
            (Number(month) < 1 ||
                Number(month) > 12)
        ) {
            return res.status(400).json({
                error: "Invalid month"
            });
        }

        const schedules =
            await getSchedulesByTripId(id);

        if (!schedules.length) {
            return res.status(404).json({
                error: "Schedules not found"
            });
        }

        return res.status(200).json(
            schedules
        );
    } catch (error) {
        console.error(
            "Error fetching schedules:",
            error
        );

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}