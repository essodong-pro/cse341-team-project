import { getBookingById } from "../models/bookings.js";

/**
 * Allows booking changes only by the booking owner or an admin.
 * Must run after requireApiLogin.
 */
export async function requireBookingOwnerOrAdmin(req, res, next) {
    try {
        const booking = await getBookingById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                error: "Booking not found",
            });
        }

        const isAdmin = req.user?.role === "admin";
        const userId = req.user?.id;

        const isOwner = (
            userId !== undefined &&
            userId !== null &&
            booking.userId !== undefined &&
            booking.userId !== null &&
            String(booking.userId) === String(userId)
        );

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                error: "Forbidden",
            });
        }

        req.booking = booking;

        return next();
    } catch (error) {
        console.error("Error checking booking ownership:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}