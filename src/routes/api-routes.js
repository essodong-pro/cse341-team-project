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
    getSchedulesForTrip,
    getSchedulesForTripAndMonth
} from "../controllers/schedules.js";
    getAllBookings,
    getBookingById
} from "../controllers/bookings.js";

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
 * /api/trips/{id}/schedules?month={month}:
 *   get:
 *     summary: Returns schedules for a trip and month
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
 *     responses:
 *       200:
 *         description: A single booking object
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.get("/bookings/:id", getBookingById);

export default router;