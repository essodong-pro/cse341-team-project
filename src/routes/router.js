import { Router } from 'express';
import { homePage, aboutPage, testErrorPage } from './index.js';
import { trainsApi, trainsPage } from './trains.js';
import { renderTripsList, renderTripDetails, getAllTrips, getTripById } from '../controllers/trips.js';
import {
    renderBookingForm,
    processBookingRequest,
    renderBookingConfirmation,
    renderBookingsAdmin
} from '../controllers/bookings.js';
import apiRoutes from './api-routes.js';

const router = Router();

// Home page
router.get('/', homePage);

// About page
router.get('/about', aboutPage);

// Trains page
router.get('/trains', trainsPage);

// Trains API
router.get('/api/trains', trainsApi);

// Trips pages (EJS)
router.get('/trips', renderTripsList);
router.get('/trips/:id', renderTripDetails);

// Trips API (JSON)
router.get('/api/trips', getAllTrips);
router.get('/api/trips/:id', getTripById);

// Booking pages (EJS)
router.get('/bookings/new/:scheduleId', renderBookingForm);
router.post('/bookings', processBookingRequest);
router.get('/bookings/:bookingId', renderBookingConfirmation);
router.get('/bookings-admin', renderBookingsAdmin);

// Additional Swagger-documented API routes (e.g. bookings)
router.use('/api', apiRoutes);

// Test 500 error page
router.get('/500', testErrorPage);

export default router;
