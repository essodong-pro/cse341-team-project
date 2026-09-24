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

export async function getAllBookings() {
    return Booking.find({}).lean();
}

export async function getBookingById(id) {
    return Booking.findOne({ id }).lean();
}
