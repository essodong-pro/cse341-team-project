import express from "express";
import { renderTripsList, renderTripDetails } from "../controllers/trips.js";

const router = express.Router();

router.get("/trips", renderTripsList);

router.get("/trips/:id", renderTripDetails);

export default router;