import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import app from '../app.js';
import User from '../src/models/schemas/user.js';
import { createTestUser, loginAs } from './helpers/auth.js';

// Accounts seeded by initializeDatabase before every test.
const ADMIN_EMAIL = 'admin@kizunarail.com';
const CUSTOMER_EMAIL = 'customer@kizunarail.com';

const ada = { displayName: 'Ada Lovelace', username: 'ada', email: 'ada@example.com' };

async function findUserId(email) {
  const user = await User.findOne({ email });

  return user._id.toString();
}

describe('GET /api/users', () => {
  test('returns 401 when not logged in', async () => {
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
  });

  test('returns every user to an admin', async () => {
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body.data.map((user) => user.email)).toEqual([
      ADMIN_EMAIL,
      CUSTOMER_EMAIL
    ]);
    expect(response.body.pagination.totalItems).toBe(2);
  });

  test('returns only their own record to a standard user', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]._id).toBe(customerId);
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('never includes password hashes in the list', async () => {
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);

    for (const user of response.body.data) {
      expect(user).not.toHaveProperty('passwordHash');
    }

    expect(response.text).not.toContain('$2b$');
  });
});

describe('GET /api/users/:id', () => {
  test('returns 401 when not logged in', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);

    const response = await request(app).get(`/api/users/${customerId}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
  });

  test('lets an admin read another user', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get(`/api/users/${customerId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: customerId,
      displayName: 'Test Customer',
      username: 'customer',
      email: CUSTOMER_EMAIL,
      role: 'customer'
    });
  });

  test('lets a standard user read their own record', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent.get(`/api/users/${customerId}`);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(customerId);
    expect(response.body.email).toBe(CUSTOMER_EMAIL);
  });

  test('returns 403 when a standard user reads someone else', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent.get(`/api/users/${adaId}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden' });
  });

  test('never includes the password hash', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get(`/api/users/${customerId}`);

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.text).not.toContain('$2b$');
  });

  test('returns 400 for a malformed id', async () => {
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get('/api/users/not-a-valid-id');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid user id.');
  });

  test('returns 404 when the user does not exist', async () => {
    const missingId = new mongoose.Types.ObjectId();
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.get(`/api/users/${missingId}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found.');
  });
});
