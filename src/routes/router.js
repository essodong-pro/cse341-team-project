import { Router } from 'express';
import { homePage, aboutPage, testErrorPage } from './index.js';
import { trainsApi, trainsPage } from './trains.js';
import { renderTripsList, renderTripDetails, getAllTrips, getTripById } from '../controllers/trips.js';
import {getSchedulesForTrip, getSchedulesForTripAndMonth} from "../controllers/schedules.js";
import {
    renderBookingForm,
    processBookingRequest,
    renderBookingConfirmation,
    renderBookingsAdmin
} from '../controllers/bookings.js';
import {register,login,logout} from "../controllers/auth.js";
import {requirePageLogin, requirePageRole} from "../middleware/auth.js";
import { renderUsersAdmin } from '../controllers/users.js';
import apiRoutes from './api-routes.js';

const router = Router();

router.get('/', homePage);
router.get('/about', aboutPage);
router.get('/trains', trainsPage);
router.get('/api/trains', trainsApi);

router.get('/trips', renderTripsList);
router.get('/trips/:id', renderTripDetails);

router.get('/api/trips', getAllTrips);
router.get('/api/trips/:id', getTripById);

router.get('/api/trips/:id/schedules', getSchedulesForTrip);
router.get('/api/trips/:id/schedules/month', getSchedulesForTripAndMonth);

router.get('/bookings/new/:scheduleId', renderBookingForm);
router.post('/bookings', processBookingRequest);
router.get('/bookings/:bookingId', renderBookingConfirmation);
router.get('/bookings-admin', renderBookingsAdmin);
router.get('/users-admin', requirePageLogin, renderUsersAdmin);

router.get('/register', (req, res) => {return res.render('register', {title: 'Register'});});
router.post('/register', register);
router.get('/login', (req, res) => {return res.render('login', {title: 'Login'});});
router.post('/login', login);
router.post('/logout', logout);
router.get('/admin',requirePageRole('admin'),(req, res) => {return res.render('admin', {title: 'Admin Dashboard'});});


router.use('/api', apiRoutes);

router.get('/500', testErrorPage);

export default router;
