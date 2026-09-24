import { describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import { createBooking, getAllBookings, getBookingById } from '../src/models/bookings.js';
import * as bookingsModel from '../src/models/bookings.js';
import { getDb } from '../src/db/connect.js';
import app from '../app.js';

const samplePassengers = [
  { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555-0100' }
];

describe('booking model functions', () => {
  test('createBooking persists a booking with a generated id', async () => {
    const booking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    expect(booking.id).toMatch(/^JR/);
    expect(booking.tripId).toBe('alpine-panorama');
    expect(booking.passengers).toHaveLength(1);
    expect(booking.totalPrice).toBe(14400);
  });

  test('getAllBookings returns every created booking', async () => {
    await createBooking({ scheduleId: '1', tripId: 'alpine-panorama', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });
    await createBooking({ scheduleId: '3', tripId: 'coastal-breeze', ticketClass: 'premium', selectedDay: 'sunday', passengers: samplePassengers, pricePerTicket: 22050, totalPrice: 22050 });

    const bookings = await getAllBookings();

    expect(bookings).toHaveLength(2);
  });

  test('getBookingById returns the matching booking', async () => {
    const created = await createBooking({ scheduleId: '1', tripId: 'alpine-panorama', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });

    const found = await getBookingById(created.id);

    expect(found.tripId).toBe('alpine-panorama');
  });

  test('getBookingById returns null for an unknown id', async () => {
    const found = await getBookingById('does-not-exist');

    expect(found).toBeNull();
  });
});

describe('GET /api/bookings', () => {
  test('returns 200 with an empty array when there are no bookings', async () => {
    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('returns 200 with all created bookings', async () => {
    await createBooking({ scheduleId: '1', tripId: 'alpine-panorama', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });

    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test('returns 500 with a JSON error when the model throws', async () => {
    const spy = vi.spyOn(bookingsModel, 'getAllBookings').mockRejectedValueOnce(new Error('boom'));

    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });

    spy.mockRestore();
  });
});

describe('GET /api/bookings/:id', () => {
  test('returns 200 with the matching booking', async () => {
    const created = await createBooking({ scheduleId: '1', tripId: 'alpine-panorama', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });

    const response = await request(app).get(`/api/bookings/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.id);
    expect(response.body.tripId).toBe('alpine-panorama');
  });

  test('returns 404 for an unknown id', async () => {
    const response = await request(app).get('/api/bookings/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Booking not found' });
  });
});

describe('booking EJS pages', () => {
  test('GET /bookings/new/:scheduleId renders the booking form', async () => {
    const response = await request(app).get('/bookings/new/1');

    expect(response.status).toBe(200);
    expect(response.text).toContain('booking-form');
    expect(response.text).toContain('Alpine Panorama Express');
  });

  test('GET /bookings/new/:scheduleId returns 404 for an unknown schedule id', async () => {
    const response = await request(app).get('/bookings/new/999');

    expect(response.status).toBe(404);
    expect(response.text).toContain('Not Found');
  });

  test('GET /bookings/new/:scheduleId returns 404 for a non-numeric schedule id', async () => {
    const response = await request(app).get('/bookings/new/abc');

    expect(response.status).toBe(404);
  });

  test('GET /bookings/new/:scheduleId returns 404 when the schedule references a missing trip', async () => {
    const db = getDb();
    await db.collection('schedules').updateOne({ id: 1 }, { $set: { tripId: 'does-not-exist' } });

    const response = await request(app).get('/bookings/new/1');

    expect(response.status).toBe(404);
    expect(response.text).toContain('Not Found');
  });

  test('POST /bookings returns 400 when passengers is missing', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday'
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('At least one passenger is required');
  });

  test('POST /bookings returns 400 for an unknown ticket class', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'platinum',
        selectedDay: 'monday',
        passengers: samplePassengers
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('ticket class could not be found');
  });

  test('POST /bookings returns 400 for an unknown trip id', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'does-not-exist',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: samplePassengers
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('trip could not be found');
  });

  test('POST /bookings returns 400 when a passenger is missing required fields', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: [{ firstName: 'Ada' }]
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('Each passenger must include');
  });

  test('POST /bookings creates a booking and redirects to its confirmation page', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: samplePassengers
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/bookings\/JR/);

    const bookingId = response.headers.location.split('/').pop();
    const booking = await getBookingById(bookingId);

    expect(booking.pricePerTicket).toBe(14400);
    expect(booking.totalPrice).toBe(14400);
  });

  test('POST /bookings computes the price server-side, ignoring any client-submitted price', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: samplePassengers,
        totalPrice: 1
      });

    const bookingId = response.headers.location.split('/').pop();
    const booking = await getBookingById(bookingId);

    expect(booking.totalPrice).toBe(14400);
  });

  test('GET /bookings/:bookingId renders the confirmation page', async () => {
    const booking = await createBooking({ scheduleId: '1', tripId: 'alpine-panorama', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });

    const response = await request(app).get(`/bookings/${booking.id}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(booking.id);
    expect(response.text).toContain('Alpine Panorama Express');
    expect(response.text).toContain('14,400');
  });

  test('GET /bookings/:bookingId returns 404 when the booking references a missing trip', async () => {
    const booking = await createBooking({ scheduleId: '1', tripId: 'does-not-exist', ticketClass: 'standard', selectedDay: 'monday', passengers: samplePassengers, pricePerTicket: 14400, totalPrice: 14400 });

    const response = await request(app).get(`/bookings/${booking.id}`);

    expect(response.status).toBe(404);
    expect(response.text).toContain('Not Found');
  });

  test('GET /bookings/:bookingId returns 404 for an unknown booking', async () => {
    const response = await request(app).get('/bookings/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.text).toContain('Page Not Found');
  });

  test('GET /bookings-admin renders the admin page', async () => {
    const response = await request(app).get('/bookings-admin');

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="bookings-list"');
    expect(response.text).toContain('booking-view-link');
  });
});
