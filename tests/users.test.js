import { describe, expect, test, vi } from 'vitest';
import {
  countUsersWithRole,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser
} from '../src/models/users.js';
import { createTestUser, ensureUserIndexes, loginAs } from './helpers/auth.js';
import { requireApiSelfOrAdmin } from '../src/middleware/ownership.js';
import request from 'supertest';
import app from '../app.js';

const ada = { displayName: 'Ada Lovelace', username: 'ada', email: 'ada@example.com' };
const grace = { displayName: 'Grace Hopper', username: 'grace', email: 'grace@example.com' };

describe('user model functions', () => {
  test('getAllUsers returns public users with the role name and no password hash', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });

    const users = await getAllUsers();

    expect(users).toHaveLength(2);
    const graceRecord = users.find((user) => user.username === 'grace');
    expect(graceRecord.role).toBe('admin');
    expect(typeof graceRecord._id).toBe('string');
    expect(graceRecord).not.toHaveProperty('passwordHash');
  });

  test('getUserById returns the matching public user', async () => {
    const id = await createTestUser(ada);

    const user = await getUserById(id);

    expect(user._id).toBe(id);
    expect(user.role).toBe('customer');
    expect(user).not.toHaveProperty('passwordHash');
  });

  test('getUserById returns null for an unknown id', async () => {
    const user = await getUserById('64f1a2b3c4d5e6f7a8b9c0d1');

    expect(user).toBeNull();
  });

  test('updateUser applies the changes and returns the updated public user', async () => {
    const id = await createTestUser(ada);

    const updated = await updateUser(id, { displayName: 'Countess Ada' });

    expect(updated.displayName).toBe('Countess Ada');
    expect(updated).not.toHaveProperty('passwordHash');
  });

  test('updateUser returns null for an unknown id', async () => {
    const updated = await updateUser('64f1a2b3c4d5e6f7a8b9c0d1', { displayName: 'Nobody' });

    expect(updated).toBeNull();
  });

  test('deleteUser removes the user and reports whether anything was deleted', async () => {
    const id = await createTestUser(ada);

    expect(await deleteUser(id)).toBe(true);
    expect(await getUserById(id)).toBeNull();
    expect(await deleteUser(id)).toBe(false);
  });

  test('countUsersWithRole counts users per role name', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });

    expect(await countUsersWithRole('admin')).toBe(1);
    expect(await countUsersWithRole('customer')).toBe(1);
    expect(await countUsersWithRole('nonexistent')).toBe(0);
  });
});

describe('requireApiSelfOrAdmin', () => {
  const buildRes = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };

  test('calls next for an admin acting on another user', () => {
    const req = { user: { id: 'a', role: 'admin' }, params: { id: 'b' } };
    const next = vi.fn();

    requireApiSelfOrAdmin(req, buildRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  test('calls next for a customer acting on themselves', () => {
    const req = { user: { id: 'a', role: 'customer' }, params: { id: 'a' } };
    const next = vi.fn();

    requireApiSelfOrAdmin(req, buildRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  test('returns 403 JSON for a customer acting on someone else', () => {
    const req = { user: { id: 'a', role: 'customer' }, params: { id: 'b' } };
    const res = buildRes();
    const next = vi.fn();

    requireApiSelfOrAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
  });
});

describe('GET /api/users', () => {
  test('returns 401 when not logged in', async () => {
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
  });

  test('returns every user to an admin', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).not.toHaveProperty('passwordHash');
  });

  test('returns only the signed-in user to a customer', async () => {
    const adaId = await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(ada.email);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]._id).toBe(adaId);
  });
});

describe('PUT /api/users/:id', () => {
  test('returns 401 when not logged in', async () => {
    const adaId = await createTestUser(ada);

    const response = await request(app).put(`/api/users/${adaId}`).send({ displayName: 'X' });

    expect(response.status).toBe(401);
  });

  test('lets a customer update their own information', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ displayName: '  Countess Ada  ' });

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe('Countess Ada');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  test('returns 403 when a customer updates someone else', async () => {
    await createTestUser(ada);
    const graceId = await createTestUser(grace);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${graceId}`).send({ displayName: 'Hacked' });

    expect(response.status).toBe(403);
  });

  test('ignores a role change requested by a customer', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ displayName: 'Ada', role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('customer');
  });

  test('lets an admin update another user and promote them to admin', async () => {
    const adaId = await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ displayName: 'Admin Ada', role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe('Admin Ada');
    expect(response.body.role).toBe('admin');
  });

  test('returns 409 when the last admin tries to demote themselves', async () => {
    const graceId = await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.put(`/api/users/${graceId}`).send({ role: 'customer' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/last administrator/);
  });

  test('lets an admin demote themselves when another admin exists and updates their session', async () => {
    const graceId = await createTestUser({ ...grace, role: 'admin' });
    await createTestUser({ ...ada, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.put(`/api/users/${graceId}`).send({ role: 'customer' });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe('customer');

    const listResponse = await agent.get('/api/users');
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]._id).toBe(graceId);
  });

  test('returns 409 for a duplicate email', async () => {
    await ensureUserIndexes();
    const adaId = await createTestUser(ada);
    await createTestUser(grace);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ email: grace.email });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already in use/);
  });

  test('returns 400 for an empty display name', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ displayName: '   ' });

    expect(response.status).toBe(400);
  });

  test('returns 400 for an invalid email', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
  });

  test('returns 400 quickly for an oversized email', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);
    const hostileEmail = 'a@' + '.'.repeat(50000) + '@';

    const startedAt = Date.now();
    const response = await agent.put(`/api/users/${adaId}`).send({ email: hostileEmail });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('email is too long.');
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  test('returns 400 for a display name that is too long', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ displayName: 'a'.repeat(101) });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('displayName is too long.');
  });

  test('lets a customer update their own record using an uppercase id', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId.toUpperCase()}`).send({ displayName: 'Upper Ada' });

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe('Upper Ada');
  });

  test('returns 400 when a field is not a string', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ username: { $ne: null } });

    expect(response.status).toBe(400);
  });

  test('returns 400 for an unknown or non-string role from an admin', async () => {
    const adaId = await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const unknownRole = await agent.put(`/api/users/${adaId}`).send({ role: 'superuser' });
    const objectRole = await agent.put(`/api/users/${adaId}`).send({ role: { $ne: null } });

    expect(unknownRole.status).toBe(400);
    expect(objectRole.status).toBe(400);
  });

  test('returns 400 when there is nothing to update', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`).send({ passwordHash: 'x' });

    expect(response.status).toBe(400);
  });

  test('returns 400 when the request has no body', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.put(`/api/users/${adaId}`);

    expect(response.status).toBe(400);
  });

  test('returns 400 for a malformed id and 404 for an unknown id (admin)', async () => {
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const malformed = await agent.put('/api/users/not-an-id').send({ displayName: 'X' });
    const unknown = await agent.put('/api/users/64f1a2b3c4d5e6f7a8b9c0d1').send({ displayName: 'X' });

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});

describe('DELETE /api/users/:id', () => {
  test('returns 401 when not logged in', async () => {
    const adaId = await createTestUser(ada);

    const response = await request(app).delete(`/api/users/${adaId}`);

    expect(response.status).toBe(401);
  });

  test('returns 403 when a customer deletes someone else', async () => {
    await createTestUser(ada);
    const graceId = await createTestUser(grace);
    const agent = await loginAs(ada.email);

    const response = await agent.delete(`/api/users/${graceId}`);

    expect(response.status).toBe(403);
    expect(await getUserById(graceId)).not.toBeNull();
  });

  test('lets a customer delete themselves and logs them out', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.delete(`/api/users/${adaId}`);

    expect(response.status).toBe(200);
    expect(response.body.loggedOut).toBe(true);
    expect(await getUserById(adaId)).toBeNull();

    const afterResponse = await agent.get('/api/users');
    expect(afterResponse.status).toBe(401);
  });

  test('lets an admin delete another user without logging the admin out', async () => {
    const adaId = await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.delete(`/api/users/${adaId}`);

    expect(response.status).toBe(200);
    expect(response.body.loggedOut).toBe(false);
    expect(await getUserById(adaId)).toBeNull();
  });

  test('returns 409 when the last admin tries to delete themselves', async () => {
    const graceId = await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.delete(`/api/users/${graceId}`);

    expect(response.status).toBe(409);
    expect(await getUserById(graceId)).not.toBeNull();
  });

  test('lets an admin delete another admin when more than one exists', async () => {
    const adaId = await createTestUser({ ...ada, role: 'admin' });
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.delete(`/api/users/${adaId}`);

    expect(response.status).toBe(200);
  });

  test('lets an admin delete themselves when another admin exists and logs them out', async () => {
    const graceId = await createTestUser({ ...grace, role: 'admin' });
    await createTestUser({ ...ada, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.delete(`/api/users/${graceId}`);

    expect(response.status).toBe(200);
    expect(response.body.loggedOut).toBe(true);
    expect(await getUserById(graceId)).toBeNull();

    const afterResponse = await agent.get('/api/users');
    expect(afterResponse.status).toBe(401);
  });

  test('logs an admin out when they delete themselves using an uppercase id', async () => {
    const graceId = await createTestUser({ ...grace, role: 'admin' });
    await createTestUser({ ...ada, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.delete(`/api/users/${graceId.toUpperCase()}`);

    expect(response.status).toBe(200);
    expect(response.body.loggedOut).toBe(true);
    expect(await getUserById(graceId)).toBeNull();

    const afterResponse = await agent.get('/api/users');
    expect(afterResponse.status).toBe(401);
  });

  test('returns 400 for a malformed id and 404 for an unknown id (admin)', async () => {
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const malformed = await agent.delete('/api/users/not-an-id');
    const unknown = await agent.delete('/api/users/64f1a2b3c4d5e6f7a8b9c0d1');

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});

describe('GET /users-admin', () => {
  test('redirects to /login when not logged in', async () => {
    const response = await request(app).get('/users-admin');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('renders the page shell with the current user data attributes', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent.get('/users-admin');

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="users-list"');
    expect(response.text).toContain(`data-current-user-id="${adaId}"`);
    expect(response.text).toContain('data-current-user-role="customer"');
    expect(response.text).toContain('id="delete-dialog"');
    expect(response.text).toContain('/js/users-admin.js');
  });
});

describe('admin dashboard', () => {
  test('links to the user admin page', async () => {
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.get('/admin');

    expect(response.status).toBe(200);
    expect(response.text).toContain('href="/users-admin"');
  });
});
