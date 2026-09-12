import { bookingPage, processBookingRequest } from './book.js';
import confirmationPage from './confirm.js';
import listTripsPage from './list.js';
import tripDetailsPage from './details.js';
import { Router } from 'express';

const router = Router();

// List all trips
router.get('/', listTripsPage);

// Trip details page
router.get('/:tripId', tripDetailsPage);

// Book ticket
router.get('/booking/:scheduleId', bookingPage);
router.post('/book', processBookingRequest);

// Booking confirmation page
router.get('/confirmation/:confirmationId', confirmationPage);

export default router;
