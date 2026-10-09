import Booking from "./schemas/bookings.js";
import { generateConfirmationCode } from "../includes/helpers.js";

export async function createBooking(bookingData) {
    const booking = await Booking.create({
        id: generateConfirmationCode(),
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
    ticketClass,
    bookingDate,
} = {}) {
    const skip = (page - 1) * limit;
    const sortDirection = order === "asc" ? 1 : -1;

    const filter = {};

    if (ticketClass) {
        filter.ticketClass = ticketClass;
    }

    if (bookingDate) {
        const start = new Date(`${ bookingDate }T00:00:00.000Z`);
        const end = new Date(`${ bookingDate }T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);

        filter.createdAt = {
            $gte: start,
            $lt: end,
        };
    }

    const [bookings, totalItems] = await Promise.all([
        Booking.find(filter)
            .sort({ [sort]: sortDirection })
            .skip(skip)
            .limit(limit)
            .lean(),
        Booking.countDocuments(filter),
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