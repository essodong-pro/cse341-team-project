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
    getBookingById
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
 *     summary: Returns paginated trains
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of trains per page.
 *     responses:
 *       200:
 *         description: A paginated list of trains
 *       400:
 *         description: Invalid pagination parameters
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
router.get(
    "/trips/:id/schedules",
    getSchedulesForTrip
);

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
 *           type: string
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: List of schedules
 */
router.get(
    "/trips/:id/schedules/month",
    getSchedulesForTripAndMonth
);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Returns all bookings
 *     responses:
 *       200:
 *         description: A list of bookings
 *       500:
 *         description: Internal server error
 */
router.get("/bookings", getAllBookings);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Returns a booking by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single booking object
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.get("/bookings/:id", getBookingById);

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
 *         description: Which page of results to return.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: How many users to return per page.
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
 *         description: Searches display name, username, and email as a whole-word phrase, case-insensitive (e.g. "lovelace" or "ada@example.com"). Common words like "the" are ignored.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, customer]
 *         description: Only return users with this role.
 *     responses:
 *       200:
 *         description: A page of users (password hashes are never included) with the query that ran and pagination metadata
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 - _id: 66f1a2b3c4d5e6f7a8b9c0d1
 *                   displayName: Ada Lovelace
 *                   username: ada
 *                   email: ada@example.com
 *                   role: customer
 *               query:
 *                 sort: username
 *                 order: asc
 *                 q: lovelace
 *                 role: customer
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 totalItems: 13
 *                 totalPages: 2
 *                 hasNextPage: true
 *                 hasPreviousPage: false
 *       400:
 *         description: Invalid page, limit, sort, order, q, or role
 *         content:
 *           application/json:
 *             example:
 *               errors:
 *                 - field: limit
 *                   message: limit must be a number between 1 and 50.
 *       401:
 *         description: Not logged in
 *       500:
 *         description: Internal server error
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
 *         description: The updated user
 *       400:
 *         description: Invalid id or invalid input
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not allowed to update this user
 *       404:
 *         description: User not found
 *       409:
 *         description: Email or username already in use, or this would remove the last admin
 *       500:
 *         description: Internal server error
 */
router.put("/users/:id", requireApiLogin, requireApiSelfOrAdmin, updateUserById);

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
 *         description: User deleted. loggedOut is true when the user deleted their own account.
 *       400:
 *         description: Invalid user id
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not allowed to delete this user
 *       404:
 *         description: User not found
 *       409:
 *         description: This would remove the last admin
 *       500:
 *         description: Internal server error
 */
router.delete("/users/:id", requireApiLogin, requireApiSelfOrAdmin, deleteUserById);

export default router;
