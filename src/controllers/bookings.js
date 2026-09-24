import { getDb } from "../db/connect.js";
import {
    createBooking as createBookingRecord,
    getAllBookings as fetchAllBookings,
    getBookingById as fetchBookingById
} from "../models/bookings.js";
import { getTripById as fetchTripById } from "../models/trips.js";
import { getAllTicketClasses } from "../models/ticket-classes.js";
// ==========================
// API CONTROLLERS
// ==========================

export async function getAllBookings(req, res) {
    try {
        const bookings = await fetchAllBookings();

        return res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

export async function getBookingById(req, res) {
    try {
        const { id } = req.params;

        const booking = await fetchBookingById(id);

        if (!booking) {
            return res.status(404).json({
                error: "Booking not found"
            });
        }

        return res.status(200).json(booking);
    } catch (error) {
        console.error("Error fetching booking by ID:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

// ==========================
// EJS PAGE CONTROLLERS
// ==========================

function renderBadRequest(res, message) {
    return res.status(400).render("errors/400", {
        title: "Bad Request",
        error: message
    });
}

export async function renderBookingForm(req, res) {
    const { scheduleId } = req.params;

    const db = getDb();
    const schedule = await db.collection('schedules').findOne({ id: Number(scheduleId) });

    if (!schedule) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Schedule not found"
        });
    }

    const trip = await fetchTripById(schedule.tripId);

    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Trip not found"
        });
    }

    const ticketClasses = await getAllTicketClasses();
    const ticketOptions = ticketClasses.map((ticketClass) => ({
        class: ticketClass.class,
        name: ticketClass.name,
        price: trip.distance * ticketClass.pricePerKm,
        amenities: ticketClass.amenities,
        description: ticketClass.description
    }));

    return res.render('trips/book', {
        title: 'Book Trip',
        schedule,
        trip,
        ticketOptions
    });
}

export async function processBookingRequest(req, res) {
    const { tripId, ticketClass: ticketClassSlug, passengers } = req.body;

    if (!Array.isArray(passengers) || passengers.length === 0) {
        return renderBadRequest(res, "At least one passenger is required to complete a booking.");
    }

    const hasIncompletePassenger = passengers.some((passenger) => (
        !passenger.firstName || !passenger.lastName || !passenger.email || !passenger.phone
    ));

    if (hasIncompletePassenger) {
        return renderBadRequest(res, "Each passenger must include a first name, last name, email, and phone number.");
    }

    const trip = await fetchTripById(tripId);

    if (!trip) {
        return renderBadRequest(res, "The selected trip could not be found.");
    }

    const db = getDb();

    const ticketClass = await db.collection('ticketClasses').findOne({ class: ticketClassSlug });

    if (!ticketClass) {
        return renderBadRequest(res, "The selected ticket class could not be found.");
    }

    const pricePerTicket = trip.distance * ticketClass.pricePerKm;
    const totalPrice = pricePerTicket * passengers.length;

    const booking = await createBookingRecord({
        ...req.body,
        pricePerTicket,
        totalPrice
    });

    return res.redirect(`/bookings/${booking.id}`);
}

export async function renderBookingConfirmation(req, res) {
    const { bookingId } = req.params;

    const booking = await fetchBookingById(bookingId);

    if (!booking) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Booking not found"
        });
    }

    const trip = await fetchTripById(booking.tripId);

    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Trip not found"
        });
    }

    return res.render('trips/confirm', {
        title: 'Trip Confirmation',
        confirmation: {
            ...booking,
            tripName: trip.name
        }
    });
}

export function renderBookingsAdmin(req, res) {
    return res.render('bookings', {
        title: 'Bookings Admin'
    });
}
