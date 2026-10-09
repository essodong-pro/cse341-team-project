import Booking from "./schemas/bookings.js";
import { generateConfirmationCode } from "../includes/helpers.js";

export async function createBooking(bookingData) {
    const booking = await Booking.create({
        id: generateConfirmationCode(),
        userId: bookingData.userId ?? null,
        scheduleId: bookingData.scheduleId,
        tripId: bookingData.tripId,
        ticketClass: bookingData.ticketClass,
        selectedDay: bookingData.selectedDay,
        passengers: bookingData.passengers,
        pricePerTicket: bookingData.pricePerTicket,
        totalPrice: bookingData.totalPrice,
    });

    return booking.toObject();
}

export async function getAllBookings({
    page = 1,
    limit = 10,
    sort = "createdAt",
    order = "desc",
} = {}) {
    const skip = (page - 1) * limit;
    const sortDirection = order === "asc" ? 1 : -1;

    const [bookings, totalItems] = await Promise.all([
        Booking.find({})
            .sort({ [sort]: sortDirection })
            .skip(skip)
            .limit(limit)
            .lean(),
        Booking.countDocuments({}),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
        data: bookings,
        pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
}

export async function getBookingById(id) {
    return Booking.findOne({ id }).lean();
}

export async function updateBooking(id, updates) {
    const allowedFields = [
        "scheduleId",
        "tripId",
        "ticketClass",
        "selectedDay",
        "passengers",
    ];

    const safeUpdates = {};

    for (const field of allowedFields) {
        if (Object.hasOwn(updates, field)) {
            safeUpdates[field] = updates[field];
        }
    }

    if (Object.keys(safeUpdates).length === 0) {
        return null;
    }

    const booking = await Booking.findOne({ id });

    if (!booking) {
        return null;
    }

    Object.assign(booking, safeUpdates);

    await booking.save();

    return booking.toObject();
}

export async function deleteBooking(id) {
    const result = await Booking.findOneAndDelete({ id });

    return result ? result.toObject() : null;
}