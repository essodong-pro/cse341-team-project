import express from "express";
import {
    getAllTrains,
    getTrainById
} from "../controllers/trains.js";

import {
    getAllTrips,
    getTripById
} from "../controllers/trips.js";

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

export default router;