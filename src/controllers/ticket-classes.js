import {
    getAllTicketClasses as fetchAllTicketClasses,
    getTicketClassesForDay as fetchTicketClassesForDay
} from "../models/ticket-classes.js";


// API CONTROLLERS


export async function getAllTicketClasses(req, res) {
    try {
        const ticketClasses = await fetchAllTicketClasses();

        return res.status(200).json(ticketClasses);
    } catch (error) {
        console.error("Error fetching ticket classes:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

export async function getTicketClassesForDay(req, res) {
    try {
        const { day } = req.query;

        if (!day) {
            return res.status(400).json({
                error: "Day is required"
            });
        }

        const validDays = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday"
        ];

        const normalizedDay = day.toLowerCase();

        if (!validDays.includes(normalizedDay)) {
            return res.status(400).json({
                error: "Invalid day"
            });
        }

        const ticketClasses = await fetchTicketClassesForDay(normalizedDay);

        return res.status(200).json(ticketClasses);
    } catch (error) {
        console.error("Error fetching ticket classes for day:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}
