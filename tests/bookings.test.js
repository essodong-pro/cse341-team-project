import { describe, expect, test, vi } from 'vitest';

import request from 'supertest';

import {
  createBooking,
  getAllBookings,
  getBookingById
} from '../src/models/bookings.js';

import * as bookingsModel from '../src/models/bookings.js';

import { getDb } from '../src/db/connect.js';

import app from '../app.js';

const samplePassengers = [
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+1 555-0100'
  }
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
    await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const result = await getAllBookings();

    expect(result.data).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
    expect(result.pagination.totalPages).toBe(1);
  });

  test('getAllBookings filters by ticket class', async () => {
    await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const result = await getAllBookings({
      ticketClass: 'premium'
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].ticketClass).toBe('premium');
    expect(result.pagination.totalItems).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  test('getAllBookings filters by start date', async () => {
    const firstBooking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const secondBooking = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: firstBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-01T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: secondBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    const result = await getAllBookings({
      startDate: '2026-09-10'
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(secondBooking.id);
    expect(result.pagination.totalItems).toBe(1);
  });

  test('getAllBookings filters by end date inclusively', async () => {
    const firstBooking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const secondBooking = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: firstBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-10T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: secondBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-20T12:00:00.000Z')
        }
      }
    );

    const result = await getAllBookings({
      endDate: '2026-09-10'
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(firstBooking.id);
    expect(result.pagination.totalItems).toBe(1);
  });

  test('getAllBookings combines ticket class and date filters', async () => {
    const standardOld = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const standardRecent = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const premiumRecent = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: standardOld.id },
      {
        $set: {
          createdAt: new Date('2026-09-01T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: standardRecent.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: premiumRecent.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    const result = await getAllBookings({
      ticketClass: 'standard',
      startDate: '2026-09-10',
      endDate: '2026-09-20'
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(standardRecent.id);
    expect(result.data[0].ticketClass).toBe('standard');
    expect(result.pagination.totalItems).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  test('getAllBookings returns filtered pagination metadata', async () => {
    const db = getDb();

    for (let index = 0; index < 3; index += 1) {
      const booking = await createBooking({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: samplePassengers,
        pricePerTicket: 14400,
        totalPrice: 14400
      });

      await db.collection('bookings').updateOne(
        { id: booking.id },
        {
          $set: {
            createdAt: new Date(
              `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`
            )
          }
        }
      );
    }

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const result = await getAllBookings({
      ticketClass: 'standard',
      page: 2,
      limit: 2
    });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.totalItems).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.hasPreviousPage).toBe(true);
    expect(result.pagination.hasNextPage).toBe(false);
  });

  test('getBookingById returns the matching booking', async () => {
    const created = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const found = await getBookingById(created.id);

    expect(found.tripId).toBe('alpine-panorama');
  });

  test('getBookingById returns null for an unknown id', async () => {
    const found = await getBookingById('does-not-exist');

    expect(found).toBeNull();
  });
});

describe('GET /api/bookings', () => {
  test('returns 200 with an empty data array when there are no bookings', async () => {
    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });

  test('returns 200 with all created bookings', async () => {
    await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.query).toEqual({
      sort: 'createdAt',
      order: 'desc'
    });
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('filters bookings by ticket class', async () => {
    await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const response = await request(app)
      .get('/api/bookings')
      .query({ ticketClass: 'premium' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].ticketClass).toBe('premium');
    expect(response.body.query.ticketClass).toBe('premium');
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('filters bookings by start date', async () => {
    const firstBooking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const secondBooking = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: firstBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-01T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: secondBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    const response = await request(app)
      .get('/api/bookings')
      .query({ startDate: '2026-09-10' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(secondBooking.id);
    expect(response.body.query.startDate).toBe('2026-09-10');
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('filters bookings by end date inclusively', async () => {
    const firstBooking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const secondBooking = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: firstBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-10T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: secondBooking.id },
      {
        $set: {
          createdAt: new Date('2026-09-20T12:00:00.000Z')
        }
      }
    );

    const response = await request(app)
      .get('/api/bookings')
      .query({ endDate: '2026-09-10' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(firstBooking.id);
    expect(response.body.query.endDate).toBe('2026-09-10');
  });

  test('combines ticket class and date filters', async () => {
    const standardOld = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const standardRecent = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const premiumRecent = await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const db = getDb();

    await db.collection('bookings').updateOne(
      { id: standardOld.id },
      {
        $set: {
          createdAt: new Date('2026-09-01T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: standardRecent.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    await db.collection('bookings').updateOne(
      { id: premiumRecent.id },
      {
        $set: {
          createdAt: new Date('2026-09-15T12:00:00.000Z')
        }
      }
    );

    const response = await request(app)
      .get('/api/bookings')
      .query({
        ticketClass: 'standard',
        startDate: '2026-09-10',
        endDate: '2026-09-20'
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(standardRecent.id);
    expect(response.body.data[0].ticketClass).toBe('standard');
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('returns filtered pagination metadata', async () => {
    const db = getDb();

    for (let index = 0; index < 3; index += 1) {
      const booking = await createBooking({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: samplePassengers,
        pricePerTicket: 14400,
        totalPrice: 14400
      });

      await db.collection('bookings').updateOne(
        { id: booking.id },
        {
          $set: {
            createdAt: new Date(
              `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`
            )
          }
        }
      );
    }

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const response = await request(app)
      .get('/api/bookings')
      .query({
        ticketClass: 'standard',
        page: 2,
        limit: 2
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  test('returns all bookings when filters are cleared', async () => {
    await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    await createBooking({
      scheduleId: '3',
      tripId: 'coastal-breeze',
      ticketClass: 'premium',
      selectedDay: 'sunday',
      passengers: samplePassengers,
      pricePerTicket: 22050,
      totalPrice: 22050
    });

    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.query).toEqual({
      sort: 'createdAt',
      order: 'desc'
    });
    expect(response.body.pagination.totalItems).toBe(2);
  });

  test('returns 400 for an invalid ticket class', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ ticketClass: 'platinum' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'ticketClass',
          message: 'ticketClass must be a valid ticket class.'
        }
      ])
    );
  });

  test('returns 400 for an invalid start date', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ startDate: '2026-99-99' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'startDate',
          message:
            'startDate must be a valid date in YYYY-MM-DD format.'
        }
      ])
    );
  });

  test('returns 400 for an invalid end date', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ endDate: 'not-a-date' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'endDate',
          message:
            'endDate must be a valid date in YYYY-MM-DD format.'
        }
      ])
    );
  });

  test('returns 400 when start date is after end date', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({
        startDate: '2026-09-20',
        endDate: '2026-09-10'
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'dateRange',
          message:
            'startDate must be before or equal to endDate.'
        }
      ])
    );
  });

  test('returns 400 for an invalid page', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ page: 0 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'page',
          message: 'page must be a positive integer.'
        }
      ])
    );
  });

  test('returns 400 for an invalid limit', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ limit: 100 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'limit',
          message: 'limit must be a number between 1 and 50.'
        }
      ])
    );
  });

  test('returns 400 for an invalid sort value', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ sort: 'tripId' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'sort',
          message: 'sort must be createdAt.'
        }
      ])
    );
  });

  test('returns 400 for an invalid order value', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ order: 'random' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: 'order',
          message: 'order must be asc or desc.'
        }
      ])
    );
  });

  test('returns 500 with a JSON error when the model throws', async () => {
    const spy = vi
      .spyOn(bookingsModel, 'getAllBookings')
      .mockRejectedValueOnce(new Error('boom'));

    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal Server Error'
    });

    spy.mockRestore();
  });
});

describe('GET /api/bookings/:id', () => {
  test('returns 200 with the matching booking', async () => {
    const created = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const response = await request(app).get(
      `/api/bookings/${created.id}`
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.id);
    expect(response.body.tripId).toBe('alpine-panorama');
  });

  test('returns 404 for an unknown id', async () => {
    const response = await request(app).get(
      '/api/bookings/does-not-exist'
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Booking not found'
    });
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

    await db.collection('schedules').updateOne(
      { id: 1 },
      {
        $set: {
          tripId: 'does-not-exist'
        }
      }
    );

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
    expect(response.text).toContain(
      'At least one passenger is required'
    );
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
    expect(response.text).toContain(
      'ticket class could not be found'
    );
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
    expect(response.text).toContain(
      'trip could not be found'
    );
  });

  test('POST /bookings returns 400 when a passenger is missing required fields', async () => {
    const response = await request(app)
      .post('/bookings')
      .send({
        scheduleId: '1',
        tripId: 'alpine-panorama',
        ticketClass: 'standard',
        selectedDay: 'monday',
        passengers: [
          {
            firstName: 'Ada'
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      'Each passenger must include'
    );
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
    expect(response.headers.location).toMatch(
      /^\/bookings\/JR/
    );

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
    const booking = await createBooking({
      scheduleId: '1',
      tripId: 'alpine-panorama',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const response = await request(app).get(
      `/bookings/${booking.id}`
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain(booking.id);
    expect(response.text).toContain(
      'Alpine Panorama Express'
    );
    expect(response.text).toContain('14,400');
  });

  test('GET /bookings/:bookingId returns 404 when the booking references a missing trip', async () => {
    const booking = await createBooking({
      scheduleId: '1',
      tripId: 'does-not-exist',
      ticketClass: 'standard',
      selectedDay: 'monday',
      passengers: samplePassengers,
      pricePerTicket: 14400,
      totalPrice: 14400
    });

    const response = await request(app).get(
      `/bookings/${booking.id}`
    );

    expect(response.status).toBe(404);
    expect(response.text).toContain('Not Found');
  });

  test('GET /bookings/:bookingId returns 404 for an unknown booking', async () => {
    const response = await request(app).get(
      '/bookings/does-not-exist'
    );

    expect(response.status).toBe(404);
    expect(response.text).toContain('Page Not Found');
  });

  test('GET /bookings-admin renders the admin page', async () => {
    const response = await request(app).get('/bookings-admin');

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="bookings-list"');
    expect(response.text).toContain('booking-view-link');
    expect(response.text).toContain('id="bookings-filters"');
    expect(response.text).toContain(
      'id="booking-ticket-class"'
    );
    expect(response.text).toContain(
      'id="booking-start-date"'
    );
    expect(response.text).toContain(
      'id="booking-end-date"'
    );
    expect(response.text).toContain(
      'id="bookings-clear-filters"'
    );
    expect(response.text).toContain(
      'id="bookings-pagination"'
    );
  });
});