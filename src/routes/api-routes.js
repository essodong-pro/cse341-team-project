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
import { requireBookingOwnerOrAdmin } from "../middleware/booking-ownership.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Trains
 *     description: Train information
 *   - name: Trips
 *     description: Train trips
 *   - name: Ticket Classes
 *     description: Ticket class information
 *   - name: Schedules
 *     description: Trip schedules
 *   - name: Bookings
 *     description: Booking management
 *   - name: Users
 *     description: User management
 */

/**
 * @swagger
 * /trains:
 *   get:
 *     summary: Get all trains
 *     tags: [Trains]
 *     responses:
 *       200:
 *         description: List of trains
 */
router.get("/trains", getAllTrains);

/**
 * @swagger
 * /trains/{id}:
 *   get:
 *     summary: Get a train by ID
 *     tags: [Trains]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Train found
 *       404:
 *         description: Train not found
 */
router.get("/trains/:id", getTrainById);

/**
 * @swagger
 * /trips:
 *   get:
 *     summary: Get all trips
 *     tags: [Trips]
 *     responses:
 *       200:
 *         description: List of trips
 */
router.get("/trips", getAllTrips);

/**
 * @swagger
 * /trips/{id}:
 *   get:
 *     summary: Get a trip by ID
 *     tags: [Trips]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip found
 *       404:
 *         description: Trip not found
 */
router.get("/trips/:id", getTripById);

/**
 * @swagger
 * /ticket-classes:
 *   get:
 *     summary: Get ticket classes
 *     tags: [Ticket Classes]
 *     parameters:
 *       - in: query
 *         name: day
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional day used to filter ticket classes
 *     responses:
 *       200:
 *         description: List of ticket classes
 */
router.get("/ticket-classes", (req, res, next) => {
    if (req.query.day) {
        return getTicketClassesForDay(req, res, next);
    }

    return getAllTicketClasses(req, res, next);
});

/**
 * @swagger
 * /trips/{id}/schedules:
 *   get:
 *     summary: Get schedules for a trip
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of schedules for the trip
 */
router.get("/trips/:id/schedules", getSchedulesForTrip);

/**
 * @swagger
 * /trips/{id}/schedules/month:
 *   get:
 *     summary: Get schedules for a trip in a month
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *         description: Month to search
 *     responses:
 *       200:
 *         description: List of schedules for the requested month
 */
router.get("/trips/:id/schedules/month", getSchedulesForTripAndMonth);

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get("/bookings", getAllBookings);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get a booking by ID
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking found
 *       404:
 *         description: Booking not found
 */
router.get("/bookings/:id", getBookingById);

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
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
 *                 type: integer
 *               tripId:
 *                 type: string
 *               ticketClass:
 *                 type: string
 *               selectedDay:
 *                 type: string
 *               passengers:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         description: Invalid booking data
 *       401:
 *         description: Authentication required
 */
router.post("/bookings", requireApiLogin, createBookingApi);

/**
 * @swagger
 * /bookings/{id}:
 *   put:
 *     summary: Update a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
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
 *               scheduleId:
 *                 type: integer
 *               tripId:
 *                 type: string
 *               ticketClass:
 *                 type: string
 *               selectedDay:
 *                 type: string
 *               passengers:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Booking updated
 *       400:
 *         description: Invalid booking data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to update this booking
 *       404:
 *         description: Booking not found
 */
router.put(
    "/bookings/:id",
    requireApiLogin,
    requireBookingOwnerOrAdmin,
    updateBookingApi
);

/**
 * @swagger
 * /bookings/{id}:
 *   delete:
 *     summary: Delete a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Booking deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this booking
 *       404:
 *         description: Booking not found
 */
router.delete(
    "/bookings/:id",
    requireApiLogin,
    requireBookingOwnerOrAdmin,
    deleteBookingApi
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Authentication required
 */
router.get("/users", requireApiLogin, getUsers);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.put(
    "/users/:id",
    requireApiLogin,
    requireApiSelfOrAdmin,
    updateUserById
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.delete(
    "/users/:id",
    requireApiLogin,
    requireApiSelfOrAdmin,
    deleteUserById
);

export default router;