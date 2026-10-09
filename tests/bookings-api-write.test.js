import { beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';

import app from '../app.js';
import { createBooking, getBookingById } from '../src/models/bookings.js';
import { createUser } from '../src/models/users.js';

const customerCredentials = {
    email: 'customer@kizunarail.com',
    password: 'Password123!'
};

const otherCustomerCredentials = {
    email: 'other-customer@example.com',
    password: 'Password123!'
};

const adminCredentials = {
    email: 'admin@kizunarail.com',
    password: 'Password123!'
};

const samplePassengers = [
    {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '+1 555-0100'
    }
];

const validBookingData = {
    scheduleId: '1',
    tripId: 'alpine-panorama',
    ticketClass: 'standard',
    selectedDay: 'monday',
    passengers: samplePassengers
};

async function loginAs(agent, credentials) {
    const response = await agent
        .post('/login')
        .type('form')
        .send(credentials);

    expect(response.status).toBe(302);
    return agent;
}

async function createOwnedBooking(userId) {
    return createBooking({
        ...validBookingData,
        userId,
        pricePerTicket: 14400,
        totalPrice: 14400
    });
}

describe('Booking API write endpoints', () => {
    let customerAgent;
    let otherCustomerAgent;
    let adminAgent;

    beforeEach(async () => {
    customerAgent = request.agent(app);
    otherCustomerAgent = request.agent(app);
    adminAgent = request.agent(app);

    await createUser(
        'Other Customer',
        'othercustomer',
        otherCustomerCredentials.email,
        otherCustomerCredentials.password
    );

    await loginAs(customerAgent, customerCredentials);
    await loginAs(otherCustomerAgent, otherCustomerCredentials);
    await loginAs(adminAgent, adminCredentials);
});


    test('POST /api/bookings requires authentication', async () => {
        const response = await request(app)
            .post('/api/bookings')
            .send(validBookingData);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Authentication required');
    });

    test('POST /api/bookings creates a booking for the logged-in user', async () => {
        const response = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(response.status).toBe(201);
        expect(response.body.id).toMatch(/^JR/);
        expect(response.body.userId).toBeDefined();
        expect(response.body.tripId).toBe('alpine-panorama');
        expect(response.body.totalPrice).toBe(14400);

        const savedBooking = await getBookingById(response.body.id);
        expect(savedBooking).not.toBeNull();
        expect(String(savedBooking.userId)).toBe(String(response.body.userId));
    });

    test('POST /api/bookings calculates the price on the server', async () => {
        const response = await customerAgent
            .post('/api/bookings')
            .send({
                ...validBookingData,
                totalPrice: 1,
                pricePerTicket: 1
            });

        expect(response.status).toBe(201);
        expect(response.body.pricePerTicket).toBe(14400);
        expect(response.body.totalPrice).toBe(14400);
    });

    test('POST /api/bookings rejects incomplete passenger details', async () => {
        const response = await customerAgent
            .post('/api/bookings')
            .send({
                ...validBookingData,
                passengers: [{ firstName: 'Ada' }]
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Each passenger must include');
    });

    test('PUT /api/bookings/:id requires authentication', async () => {
        const booking = await createOwnedBooking('some-user-id');

        const response = await request(app)
            .put(`/api/bookings/${booking.id}`)
            .send({ selectedDay: 'tuesday' });

        expect(response.status).toBe(401);
    });

    test('PUT /api/bookings/:id allows the booking owner to update it', async () => {
        const loginResponse = await customerAgent.get('/dashboard');
        expect(loginResponse.status).toBe(200);

        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await customerAgent
            .put(`/api/bookings/${createResponse.body.id}`)
            .send({ selectedDay: 'tuesday' });

        expect(response.status).toBe(200);
        expect(response.body.selectedDay).toBe('tuesday');

        const savedBooking = await getBookingById(createResponse.body.id);
        expect(savedBooking.selectedDay).toBe('tuesday');
    });

    test('PUT /api/bookings/:id rejects a different user', async () => {
        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await otherCustomerAgent
            .put(`/api/bookings/${createResponse.body.id}`)
            .send({ selectedDay: 'tuesday' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });

    test('PUT /api/bookings/:id allows an admin to update another user booking', async () => {
        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await adminAgent
            .put(`/api/bookings/${createResponse.body.id}`)
            .send({ selectedDay: 'tuesday' });

        expect(response.status).toBe(200);
        expect(response.body.selectedDay).toBe('tuesday');
    });

    test('PUT /api/bookings/:id returns 404 for a missing booking', async () => {
        const response = await customerAgent
            .put('/api/bookings/does-not-exist')
            .send({ selectedDay: 'tuesday' });

        expect(response.status).toBe(404);
    });

    test('DELETE /api/bookings/:id requires authentication', async () => {
        const booking = await createOwnedBooking('some-user-id');

        const response = await request(app)
            .delete(`/api/bookings/${booking.id}`);

        expect(response.status).toBe(401);
    });

    test('DELETE /api/bookings/:id allows the owner to delete it', async () => {
        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await customerAgent
            .delete(`/api/bookings/${createResponse.body.id}`);

        expect(response.status).toBe(204);

        const deletedBooking = await getBookingById(createResponse.body.id);
        expect(deletedBooking).toBeNull();
    });

    test('DELETE /api/bookings/:id rejects a different user', async () => {
        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await otherCustomerAgent
            .delete(`/api/bookings/${createResponse.body.id}`);

        expect(response.status).toBe(403);

        const booking = await getBookingById(createResponse.body.id);
        expect(booking).not.toBeNull();
    });

    test('DELETE /api/bookings/:id allows an admin to delete another user booking', async () => {
        const createResponse = await customerAgent
            .post('/api/bookings')
            .send(validBookingData);

        expect(createResponse.status).toBe(201);

        const response = await adminAgent
            .delete(`/api/bookings/${createResponse.body.id}`);

        expect(response.status).toBe(204);

        const deletedBooking = await getBookingById(createResponse.body.id);
        expect(deletedBooking).toBeNull();
    });

    test('DELETE /api/bookings/:id returns 404 for a missing booking', async () => {
        const response = await customerAgent
            .delete('/api/bookings/does-not-exist');

        expect(response.status).toBe(404);
    });
});