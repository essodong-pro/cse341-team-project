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

export default router;