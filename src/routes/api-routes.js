import express from "express";

import {
    getAllTrains,
    getTrainById
} from "../controllers/trains.js";

import {
    getAllTrips,
    getTripById
} from "../controllers/trips.js";

import {
    getAllTicketClasses,
    getTicketClassesForDay
} from "../controllers/ticket-classes.js";

import {
    getSchedulesForTrip,
    getSchedulesForTripAndMonth
} from "../controllers/schedules.js";

import {
    getAllBookings,
    getBookingById,
    createBookingApi,
    updateBookingApi,
    deleteBookingApi
} from "../controllers/bookings.js";

import {
    getUsers,
    updateUserById,
    deleteUserById
} from "../controllers/users.js";

import { requireApiLogin } from "../middleware/auth.js";
import { requireApiSelfOrAdmin } from "../middleware/ownership.js";

const router = express.Router();

/**
 * @swagger
 * /api/trains:
 *   get:
 *     summary: Returns all trains
 *     responses:
 *       200:
 *         description: A list of trains
 */
router.get("/trains", getAllTrains);

/**
 * @swagger
 * /api/trains/{id}:
 *   get:
 *     summary: Returns a train by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single train object
 */
router.get("/trains/:id", getTrainById);

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Returns all trips
 *     responses:
 *       200:
 *         description: A list of trips
 */
router.get("/trips", getAllTrips);

/**
 * @swagger
 * /api/trips/{id}:
 *   get:
 *     summary: Returns a trip by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single trip object
 */
router.get("/trips/:id", getTripById);

/**
 * @swagger
 * /api/ticket-classes:
 *   get:
 *     summary: Returns ticket classes
 *     parameters:
 *       - in: query
 *         name: day
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - monday
 *             - tuesday
 *             - wednesday
 *             - thursday
 *             - friday
 *             - saturday
 *             - sunday
 *         description: Return only ticket classes available on the selected day.
 *     responses:
 *       200:
 *         description: A list of ticket classes
 *       400:
 *         description: Invalid day
 */
router.get("/ticket-classes", (req, res, next) => {
    if (req.query.day) {
        return getTicketClassesForDay(req, res, next);
    }

    return getAllTicketClasses(req, res, next);
});

/**
 * @swagger
 * /api/trips/{id}/schedules:
 *   get:
 *     summary: Returns schedules for a trip
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of schedules
 */
router.get("/trips/:id/schedules", getSchedulesForTrip);

/**
 * @swagger
 * /api/trips/{id}/schedules/month:
 *   get:
 *     summary: Returns schedules for a trip and month
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: List of schedules
 */
router.get("/trips/:id/schedules/month", getSchedulesForTripAndMonth);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Returns a paginated list of bookings
 *     description: Requires authentication. Administrators can view all bookings; customers can view their own bookings.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: ticketClass
 *         schema:
 *           type: string
 *       - in: query
 *         name: bookingDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bookings created on this date, in YYYY-MM-DD format.
 *     responses:
 *       200:
 *         description: A page of bookings with pagination metadata.
 *       400:
 *         description: Invalid pagination, sorting, or filter parameters.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Internal server error.
 */
router.get("/bookings", requireApiLogin, getAllBookings);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Returns a booking by ID
 *     description: Administrators can view any booking; customers can view their own.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single booking object.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Booking not found.
 *       500:
 *         description: Internal server error.
 */
router.get("/bookings/:id", requireApiLogin, getBookingById);

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Creates a booking for the authenticated user
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduleId
 *               - tripId
 *               - ticketClass
 *               - selectedDay
 *               - passengers
 *             properties:
 *               scheduleId:
 *                 type: string
 *               tripId:
 *                 type: string
 *               ticketClass:
 *                 type: string
 *               selectedDay:
 *                 type: string
 *               passengers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - firstName
 *                     - lastName
 *                     - email
 *                     - phone
 *     responses:
 *       201:
 *         description: Booking created.
 *       400:
 *         description: Invalid booking data.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Internal server error.
 */
router.post("/bookings", requireApiLogin, createBookingApi);

/**
 * @swagger
 * /api/bookings/{id}:
 *   put:
 *     summary: Updates a booking
 *     description: Customers can update their own bookings; administrators can update any booking.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking updated.
 *       400:
 *         description: Invalid booking data.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Booking not found.
 *       500:
 *         description: Internal server error.
 */
router.put("/bookings/:id", requireApiLogin, updateBookingApi);

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: Deletes a booking
 *     description: Customers can delete their own bookings; administrators can delete any booking.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking deleted.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Booking not found.
 *       500:
 *         description: Internal server error.
 */
router.delete("/bookings/:id", requireApiLogin, deleteBookingApi);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Returns a page of users, optionally searched and filtered by role
 *     description: Admins can page through every user. Other users only ever receive their own record. Results are sorted by username by default.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [username, displayName, email, createdAt]
 *           default: username
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, customer]
 *     responses:
 *       200:
 *         description: A page of users with pagination metadata.
 *       400:
 *         description: Invalid query parameters.
 *       401:
 *         description: Not logged in.
 *       500:
 *         description: Internal server error.
 */
router.get("/users", requireApiLogin, getUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Updates a user
 *     description: Any user can update their own record. Admins can update any user and change roles. The last admin cannot be demoted.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, customer]
 *                 description: Admins only. Ignored for other users.
 *     responses:
 *       200:
 *         description: The updated user.
 *       400:
 *         description: Invalid id or input.
 *       401:
 *         description: Not logged in.
 *       403:
 *         description: Not allowed to update this user.
 *       404:
 *         description: User not found.
 *       409:
 *         description: Email or username already in use, or this would remove the last admin.
 *       500:
 *         description: Internal server error.
 */
router.put(
    "/users/:id",
    requireApiLogin,
    requireApiSelfOrAdmin,
    updateUserById
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deletes a user
 *     description: Any user can delete their own account (their session is ended). Admins can delete any user. The last admin cannot be deleted.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted.
 *       400:
 *         description: Invalid user ID.
 *       401:
 *         description: Not logged in.
 *       403:
 *         description: Not allowed to delete this user.
 *       404:
 *         description: User not found.
 *       409:
 *         description: This would remove the last admin.
 *       500:
 *         description: Internal server error.
 */
router.delete(
    "/users/:id",
    requireApiLogin,
    requireApiSelfOrAdmin,
    deleteUserById
);

export default router;