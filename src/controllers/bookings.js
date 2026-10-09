import { getDb } from "../db/connect.js";
import {
    createBooking as createBookingRecord,
    getAllBookings as fetchAllBookings,
    getBookingById as fetchBookingById,
    updateBooking as updateBookingRecord,
    deleteBooking as deleteBookingRecord,
} from "../models/bookings.js";
import { getTripById as fetchTripById } from "../models/trips.js";
import { getAllTicketClasses } from "../models/ticket-classes.js";

// ==========================
// API HELPERS
// ==========================

function validatePassengers(passengers) {
    if (!Array.isArray(passengers) || passengers.length === 0) {
        return "At least one passenger is required.";
    }

    const hasIncompletePassenger = passengers.some((passenger) => (
        !passenger ||
        typeof passenger.firstName !== "string" ||
        !passenger.firstName.trim() ||
        typeof passenger.lastName !== "string" ||
        !passenger.lastName.trim() ||
        typeof passenger.email !== "string" ||
        !passenger.email.trim() ||
        typeof passenger.phone !== "string" ||
        !passenger.phone.trim()
    ));

    if (hasIncompletePassenger) {
        return "Each passenger must include a first name, last name, email, and phone number.";
    }

    return null;
}

async function getBookingDetails({
    scheduleId,
    tripId,
    ticketClass: ticketClassSlug,
    selectedDay,
    passengers,
}) {
    const db = getDb();

    if (
        scheduleId === undefined ||
        scheduleId === null ||
        String(scheduleId).trim() === "" ||
        tripId === undefined ||
        tripId === null ||
        String(tripId).trim() === "" ||
        typeof ticketClassSlug !== "string" ||
        !ticketClassSlug.trim() ||
        typeof selectedDay !== "string" ||
        !selectedDay.trim()
    ) {
        return {
            error: "scheduleId, tripId, ticketClass, and selectedDay are required.",
        };
    }

    const passengerError = validatePassengers(passengers);

    if (passengerError) {
        return { error: passengerError };
    }

    const numericScheduleId = Number(scheduleId);

    if (!Number.isFinite(numericScheduleId)) {
        return { error: "Invalid scheduleId." };
    }

    const schedule = await db.collection("schedules").findOne({
        id: numericScheduleId,
    });

    if (!schedule) {
        return { error: "Schedule not found." };
    }

    if (String(schedule.tripId) !== String(tripId)) {
        return { error: "The selected schedule does not belong to this trip." };
    }

    const trip = await fetchTripById(tripId);

    if (!trip) {
        return { error: "Trip not found." };
    }

    const ticketClasses = await getAllTicketClasses();

    const ticketClass = ticketClasses.find(
        (item) => item.class === ticketClassSlug
    );

    if (!ticketClass) {
        return { error: "Ticket class not found." };
    }

    const pricePerTicket = Number(trip.distance) * Number(ticketClass.pricePerKm);

    if (!Number.isFinite(pricePerTicket) || pricePerTicket < 0) {
        return { error: "Unable to calculate the ticket price." };
    }

    return {
        data: {
            scheduleId: String(scheduleId),
            tripId: String(tripId),
            ticketClass: ticketClassSlug,
            selectedDay: selectedDay.trim(),
            passengers: passengers.map((passenger) => ({
                firstName: passenger.firstName.trim(),
                lastName: passenger.lastName.trim(),
                email: passenger.email.trim(),
                phone: passenger.phone.trim(),
            })),
            pricePerTicket,
            totalPrice: pricePerTicket * passengers.length,
        },
    };
}

// ==========================
// API CONTROLLERS
// ==========================

export async function getAllBookings(req, res) {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const sortParam = req.query.sort;
        const orderParam = req.query.order;

        const page = pageParam === undefined ? 1 : Number(pageParam);
        const limit = limitParam === undefined ? 10 : Number(limitParam);
        const sort = sortParam === undefined ? "createdAt" : sortParam;
        const order = orderParam === undefined ? "desc" : orderParam;

        const errors = [];

        if (!Number.isInteger(page) || page < 1) {
            errors.push({
                field: "page",
                message: "page must be a positive integer.",
            });
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            errors.push({
                field: "limit",
                message: "limit must be a number between 1 and 50.",
            });
        }

        if (!["createdAt"].includes(sort)) {
            errors.push({
                field: "sort",
                message: "sort must be createdAt.",
            });
        }

        if (!["asc", "desc"].includes(order)) {
            errors.push({
                field: "order",
                message: "order must be asc or desc.",
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const result = await fetchAllBookings({
            page,
            limit,
            sort,
            order,
        });

        return res.status(200).json({
            data: result.data,
            query: { sort, order },
            pagination: result.pagination,
        });
    } catch (error) {
        console.error("Error fetching bookings:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}

export async function getBookingById(req, res) {
    try {
        const booking = await fetchBookingById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                error: "Booking not found",
            });
        }

        return res.status(200).json(booking);
    } catch (error) {
        console.error("Error fetching booking by ID:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}

export async function createBookingApi(req, res) {
    try {
        const details = await getBookingDetails(req.body);

        if (details.error) {
            return res.status(400).json({
                error: details.error,
            });
        }

        const booking = await createBookingRecord({
            ...details.data,
            userId: String(req.user.id),
        });

        return res.status(201).json(booking);
    } catch (error) {
        console.error("Error creating booking through API:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}

export async function updateBookingApi(req, res) {
    try {
        const currentBooking = req.booking
            ?? await fetchBookingById(req.params.id);

        if (!currentBooking) {
            return res.status(404).json({
                error: "Booking not found",
            });
        }

        const allowedFields = [
            "scheduleId",
            "tripId",
            "ticketClass",
            "selectedDay",
            "passengers",
        ];

        const submittedFields = Object.keys(req.body ?? {});

        if (submittedFields.length === 0) {
            return res.status(400).json({
                error: "Provide at least one booking field to update.",
            });
        }

        const unexpectedFields = submittedFields.filter(
            (field) => !allowedFields.includes(field)
        );

        if (unexpectedFields.length > 0) {
            return res.status(400).json({
                error: "Only scheduleId, tripId, ticketClass, selectedDay, and passengers can be updated.",
            });
        }

        const proposedBooking = {
            scheduleId: req.body.scheduleId ?? currentBooking.scheduleId,
            tripId: req.body.tripId ?? currentBooking.tripId,
            ticketClass: req.body.ticketClass ?? currentBooking.ticketClass,
            selectedDay: req.body.selectedDay ?? currentBooking.selectedDay,
            passengers: req.body.passengers ?? currentBooking.passengers,
        };

        const details = await getBookingDetails(proposedBooking);

        if (details.error) {
            return res.status(400).json({
                error: details.error,
            });
        }

        const updatedBooking = await updateBookingRecord(
            req.params.id,
            details.data
        );

        if (!updatedBooking) {
            return res.status(404).json({
                error: "Booking not found",
            });
        }

        return res.status(200).json(updatedBooking);
    } catch (error) {
        console.error("Error updating booking:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}

export async function deleteBookingApi(req, res) {
    try {
        const deletedBooking = await deleteBookingRecord(req.params.id);

        if (!deletedBooking) {
            return res.status(404).json({
                error: "Booking not found",
            });
        }

        return res.status(204).send();
    } catch (error) {
        console.error("Error deleting booking:", error);

        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
}

// ==========================
// EJS PAGE CONTROLLERS
// ==========================

function renderBadRequest(res, message) {
    return res.status(400).render("errors/400", {
        title: "Bad Request",
        error: message,
    });
}

export async function renderBookingForm(req, res) {
    const { scheduleId } = req.params;

    const db = getDb();
    const schedule = await db.collection("schedules").findOne({
        id: Number(scheduleId),
    });

    if (!schedule) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Schedule not found",
        });
    }

    const trip = await fetchTripById(schedule.tripId);

    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Trip not found",
        });
    }

    const ticketClasses = await getAllTicketClasses();

    const ticketOptions = ticketClasses.map((ticketClass) => ({
        class: ticketClass.class,
        name: ticketClass.name,
        price: trip.distance * ticketClass.pricePerKm,
        amenities: ticketClass.amenities,
        description: ticketClass.description,
    }));

    return res.render("trips/book", {
        title: "Book Trip",
        schedule,
        trip,
        ticketOptions,
    });
}

export async function processBookingRequest(req, res) {
    try {
        const {
            scheduleId,
            tripId,
            ticketClass: ticketClassSlug,
            selectedDay,
            passengers,
        } = req.body;

        if (!Array.isArray(passengers) || passengers.length === 0) {
            return renderBadRequest(
                res,
                "At least one passenger is required to complete a booking."
            );
        }

        const hasIncompletePassenger = passengers.some((passenger) => (
            !passenger ||
            !passenger.firstName ||
            !passenger.lastName ||
            !passenger.email ||
            !passenger.phone
        ));

        if (hasIncompletePassenger) {
            return renderBadRequest(
                res,
                "Each passenger must include a first name, last name, email, and phone number."
            );
        }

        const db = getDb();

        const numericScheduleId = Number(scheduleId);

        if (!Number.isFinite(numericScheduleId)) {
            return renderBadRequest(res, "The selected schedule is invalid.");
        }

        const schedule = await db.collection("schedules").findOne({
            id: numericScheduleId,
        });

        if (!schedule) {
            return renderBadRequest(
                res,
                "The selected schedule could not be found."
            );
        }

        const trip = await fetchTripById(tripId);

        if (!trip) {
            return renderBadRequest(
                res,
                "The selected trip could not be found."
            );
        }

        if (String(schedule.tripId) !== String(tripId)) {
            return renderBadRequest(
                res,
                "The selected schedule does not belong to this trip."
            );
        }

        const ticketClasses = await getAllTicketClasses();

        const ticketClass = ticketClasses.find(
            (item) => item.class === ticketClassSlug
        );

        if (!ticketClass) {
            return renderBadRequest(
                res,
                "The selected ticket class could not be found."
            );
        }

        const pricePerTicket = Number(trip.distance) * Number(ticketClass.pricePerKm);
        const totalPrice = pricePerTicket * passengers.length;

        if (!Number.isFinite(totalPrice) || totalPrice < 0) {
            return renderBadRequest(
                res,
                "Unable to calculate the booking price."
            );
        }

        const booking = await createBookingRecord({
            scheduleId: String(schedule.id),
            tripId: String(tripId),
            ticketClass: ticketClassSlug,
            selectedDay: selectedDay ?? schedule.date,
            passengers: passengers.map((passenger) => ({
                firstName: String(passenger.firstName).trim(),
                lastName: String(passenger.lastName).trim(),
                email: String(passenger.email).trim(),
                phone: String(passenger.phone).trim(),
            })),
            pricePerTicket,
            totalPrice,
        });

        return res.redirect(`/bookings/${booking.id}`);
    } catch (error) {
        console.error("Error processing booking request:", error);

        return res.status(500).render("errors/500", {
            title: "Internal Server Error",
            error: "Unable to process the booking.",
        });
    }
}

export async function renderBookingConfirmation(req, res) {
    const { bookingId } = req.params;

    const booking = await fetchBookingById(bookingId);

    if (!booking) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Booking not found",
        });
    }

    const trip = await fetchTripById(booking.tripId);

    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Not Found",
            error: "Trip not found",
        });
    }

    return res.render("trips/confirm", {
        title: "Trip Confirmation",
        confirmation: {
            ...booking,
            tripName: trip.name,
        },
    });
}

export function renderBookingsAdmin(req, res) {
    return res.render("bookings", {
        title: "Bookings Admin",
    });
}