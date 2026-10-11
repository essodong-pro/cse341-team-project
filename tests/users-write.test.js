import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import app from '../app.js';
import User from '../src/models/schemas/user.js';
import { createTestUser, ensureUserIndexes, loginAs } from './helpers/auth.js';

// Accounts seeded by initializeDatabase before every test.
const ADMIN_EMAIL = 'admin@kizunarail.com';
const CUSTOMER_EMAIL = 'customer@kizunarail.com';

const ada = { displayName: 'Ada Lovelace', username: 'ada', email: 'ada@example.com' };

const validRegistration = {
  displayName: 'Grace Hopper',
  username: 'grace',
  email: 'grace@example.com',
  password: 'CorrectHorse42!'
};

function register(form) {
  return request(app).post('/register').type('form').send(form);
}

async function findUser(email) {
  return User.findOne({ email }).populate('role').lean();
}

async function findUserId(email) {
  const user = await findUser(email);

  return user._id.toString();
}

describe('POST /register', () => {
  test('creates a customer and redirects to the login page', async () => {
    const response = await register(validRegistration);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');

    const saved = await findUser('grace@example.com');
    expect(saved).not.toBeNull();
    expect(saved.displayName).toBe('Grace Hopper');
    expect(saved.username).toBe('grace');
    expect(saved.role.name).toBe('customer');
  });

  test('stores a bcrypt hash instead of the plain password', async () => {
    await register(validRegistration);

    const saved = await findUser('grace@example.com');
    expect(saved.passwordHash).not.toBe(validRegistration.password);
    expect(saved.passwordHash.startsWith('$2b$')).toBe(true);
    expect(await bcrypt.compare(validRegistration.password, saved.passwordHash)).toBe(true);
  });

  test('saves the email in lowercase and trims the other fields', async () => {
    await register({
      ...validRegistration,
      displayName: '  Grace Hopper  ',
      username: '  grace  ',
      email: '  Grace@Example.COM  '
    });

    const saved = await findUser('grace@example.com');
    expect(saved).not.toBeNull();
    expect(saved.displayName).toBe('Grace Hopper');
    expect(saved.username).toBe('grace');
  });

  test('returns 409 for an email that is already registered, in any letter case', async () => {
    await ensureUserIndexes();

    const response = await register({ ...validRegistration, email: 'Customer@KizunaRail.com' });

    expect(response.status).toBe(409);
    expect(response.text).toContain('A user with that email or username already exists.');
    expect(await User.countDocuments({ email: CUSTOMER_EMAIL })).toBe(1);
  });

  test('returns 409 for a username that is already taken', async () => {
    await ensureUserIndexes();

    const response = await register({ ...validRegistration, username: 'customer' });

    expect(response.status).toBe(409);
    expect(await findUser('grace@example.com')).toBeNull();
  });

  test.each(['displayName', 'username', 'email', 'password'])(
    'returns 400 and creates no user when %s is missing',
    async (field) => {
      const form = { ...validRegistration };
      delete form[field];

      const response = await register(form);

      expect(response.status).toBe(400);
      expect(response.text).toContain(`Please provide a valid ${field}.`);
      expect(await User.countDocuments()).toBe(2);
    }
  );

  test('returns 400 and creates no user when a field is only spaces', async () => {
    const response = await register({ ...validRegistration, displayName: '   ' });

    expect(response.status).toBe(400);
    expect(await findUser('grace@example.com')).toBeNull();
  });

  test('returns 400 and creates no user for an invalid email', async () => {
    const response = await register({ ...validRegistration, email: 'grace-at-example.com' });

    expect(response.status).toBe(400);
    expect(response.text).toContain('Please provide a valid email.');
    expect(await User.countDocuments()).toBe(2);
  });

  test('returns 400 and creates no user for a display name over 100 characters', async () => {
    const response = await register({ ...validRegistration, displayName: 'a'.repeat(101) });

    expect(response.status).toBe(400);
    expect(response.text).toContain('displayName is too long.');
    expect(await findUser('grace@example.com')).toBeNull();
  });
});

describe('PUT /api/users/:id', () => {
  test('returns 401 and changes nothing when not logged in', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);

    const response = await request(app)
      .put(`/api/users/${customerId}`)
      .send({ displayName: 'Changed' });

    expect(response.status).toBe(401);
    expect((await findUser(CUSTOMER_EMAIL)).displayName).toBe('Test Customer');
  });

  test('lets a standard user update their own record', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ displayName: 'Updated Customer', username: 'updated' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayName: 'Updated Customer', username: 'updated' });

    const saved = await findUser(CUSTOMER_EMAIL);
    expect(saved.displayName).toBe('Updated Customer');
    expect(saved.username).toBe('updated');
  });

  test('returns 403 and changes nothing when a standard user updates someone else', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${adaId}`)
      .send({ displayName: 'Hacked' });

    expect(response.status).toBe(403);
    expect((await findUser(ada.email)).displayName).toBe('Ada Lovelace');
  });

  test('ignores a role change requested by a standard user', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ displayName: 'Still Customer', role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('customer');
    expect((await findUser(CUSTOMER_EMAIL)).role.name).toBe('customer');
  });

  test('lets an admin promote another user to admin', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
    expect((await findUser(CUSTOMER_EMAIL)).role.name).toBe('admin');
  });

  test('returns 400 and changes nothing for an invalid email', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Please provide a valid email.');
    expect(await findUser(CUSTOMER_EMAIL)).not.toBeNull();
  });

  test('returns 400 and changes nothing for an empty display name', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ displayName: '' });

    expect(response.status).toBe(400);
    expect((await findUser(CUSTOMER_EMAIL)).displayName).toBe('Test Customer');
  });

  test('returns 409 and changes nothing for an email that is already in use', async () => {
    await ensureUserIndexes();
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent
      .put(`/api/users/${customerId}`)
      .send({ email: ADMIN_EMAIL });

    expect(response.status).toBe(409);
    expect(await User.countDocuments({ email: ADMIN_EMAIL })).toBe(1);
    expect(await findUser(CUSTOMER_EMAIL)).not.toBeNull();
  });
});

describe('DELETE /api/users/:id', () => {
  test('returns 401 and deletes nothing when not logged in', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);

    const response = await request(app).delete(`/api/users/${customerId}`);

    expect(response.status).toBe(401);
    expect(await findUser(CUSTOMER_EMAIL)).not.toBeNull();
  });

  test('returns 403 and deletes nothing when a standard user deletes someone else', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent.delete(`/api/users/${adaId}`);

    expect(response.status).toBe(403);
    expect(await findUser(ada.email)).not.toBeNull();
  });

  test('lets an admin delete another user', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.delete(`/api/users/${customerId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'User deleted.', loggedOut: false });
    expect(await findUser(CUSTOMER_EMAIL)).toBeNull();
  });

  test('lets a standard user delete their own account and logs them out', async () => {
    const customerId = await findUserId(CUSTOMER_EMAIL);
    const agent = await loginAs(CUSTOMER_EMAIL);

    const response = await agent.delete(`/api/users/${customerId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Your account was deleted.', loggedOut: true });
    expect(await findUser(CUSTOMER_EMAIL)).toBeNull();

    const afterDelete = await agent.get('/api/users');
    expect(afterDelete.status).toBe(401);
  });

  test('returns 409 and deletes nothing when the last admin deletes themselves', async () => {
    const adminId = await findUserId(ADMIN_EMAIL);
    const agent = await loginAs(ADMIN_EMAIL);

    const response = await agent.delete(`/api/users/${adminId}`);

    expect(response.status).toBe(409);
    expect(await findUser(ADMIN_EMAIL)).not.toBeNull();
  });
});
