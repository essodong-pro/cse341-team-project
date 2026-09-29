import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  countUsersWithRole,
  deleteUser,
  getPaginatedUsers,
  getUserById,
  updateUser
} from '../src/models/users.js';
import { getRoleByName } from '../src/models/roles.js';
import { createTestUser, ensureUserIndexes, loginAs } from './helpers/auth.js';
import { requireApiSelfOrAdmin } from '../src/middleware/ownership.js';
import request from 'supertest';
import app from '../app.js';
import User from '../src/models/schemas/user.js';

const ada = { displayName: 'Ada Lovelace', username: 'ada', email: 'ada@example.com' };
const grace = { displayName: 'Grace Hopper', username: 'grace', email: 'grace@example.com' };
const alan = { displayName: 'Alan Turing', username: 'aturing', email: 'alan@bletchley.org' };

// Inserts `count` users directly (no bcrypt) named user01, user02, ...
async function insertUsers(count, { role = 'customer', prefix = 'user' } = {}) {
  const roleDoc = await getRoleByName(role);
  const docs = Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');

    return {
      displayName: `User ${n}`,
      username: `${prefix}${n}`,
      email: `${prefix}${n}@example.com`,
      passwordHash: 'not-a-real-hash',
      role: roleDoc._id
    };
  });

  await User.insertMany(docs);
}

const usernames = (response) => response.body.data.map((user) => user.username);

// initializeDatabase seeds demo admin/customer accounts; start each test with
// only the users it creates so counts and last-admin rules are predictable.
beforeEach(async () => {
  await User.deleteMany({});
});

describe('user model functions', () => {
  test('getPaginatedUsers returns one sorted page of public users plus the total count', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    await createTestUser(alan);
    // Capitalised username proves collation is applied: without it Mongo's
    // default byte-order sort would put 'Zed' before the lowercase names.
    await createTestUser({ displayName: 'Zed Zimmer', username: 'Zed', email: 'zed@example.com' });

    const { users, totalItems } = await getPaginatedUsers({
      filter: {},
      page: 1,
      limit: 4,
      sort: 'username',
      order: 'asc'
    });

    expect(totalItems).toBe(4);
    expect(users.map((user) => user.username)).toEqual(['ada', 'aturing', 'grace', 'Zed']);
    expect(users[0].role).toBe('customer');
    expect(typeof users[0]._id).toBe('string');
    expect(users[0]).not.toHaveProperty('passwordHash');
  });

  test('getPaginatedUsers applies the filter to both the page and the count', async () => {
    await createTestUser(ada);
    const graceId = await createTestUser({ ...grace, role: 'admin' });

    const { users, totalItems } = await getPaginatedUsers({
      filter: { _id: graceId },
      page: 1,
      limit: 10,
      sort: 'username',
      order: 'desc'
    });

    expect(totalItems).toBe(1);
    expect(users.map((user) => user.username)).toEqual(['grace']);
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

  test('returns every user to an admin with pagination metadata', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(grace.email);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(['ada', 'grace']);
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(response.body.query).toEqual({ sort: 'username', order: 'asc' });
  });

  test('returns only the signed-in user to a customer', async () => {
    const adaId = await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(ada.email);

    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]._id).toBe(adaId);
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('a customer asking for page 2 still only ever sees their own record', async () => {
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    const agent = await loginAs(ada.email);

    const response = await agent.get('/api/users?page=2');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalItems).toBe(1);
  });
});

describe('GET /api/users pagination', () => {
  let agent;

  // grace (admin) + user01..user12 = 13 users. By username: grace, user01, ..., user12.
  beforeEach(async () => {
    await createTestUser({ ...grace, role: 'admin' });
    await insertUsers(12);
    agent = await loginAs(grace.email);
  });

  test('returns 10 users by default, sorted by username', async () => {
    const response = await agent.get('/api/users');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual([
      'grace', 'user01', 'user02', 'user03', 'user04',
      'user05', 'user06', 'user07', 'user08', 'user09'
    ]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 13,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
  });

  test('page 2 returns the remaining users and none from page 1', async () => {
    const first = await agent.get('/api/users?page=1');
    const second = await agent.get('/api/users?page=2');

    expect(usernames(second)).toEqual(['user10', 'user11', 'user12']);
    expect(usernames(second).some((name) => usernames(first).includes(name))).toBe(false);
    expect(second.body.pagination).toMatchObject({ page: 2, hasNextPage: false, hasPreviousPage: true });
  });

  test('respects limit and reports the matching page count', async () => {
    const response = await agent.get('/api/users?limit=5');

    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({ limit: 5, totalPages: 3 });
  });

  test('accepts the maximum limit of 50', async () => {
    const response = await agent.get('/api/users?limit=50');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(13);
  });

  test('sort and order change the order of results', async () => {
    const response = await agent.get('/api/users?sort=username&order=desc&limit=3');

    expect(usernames(response)).toEqual(['user12', 'user11', 'user10']);
    expect(response.body.query).toEqual({ sort: 'username', order: 'desc' });
  });

  test('a page past the end returns 200 with an empty list', async () => {
    const response = await agent.get('/api/users?page=9');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toMatchObject({ page: 9, totalItems: 13, hasNextPage: false });
  });

  test.each([
    ['page=abc', 'page'],
    ['page=0', 'page'],
    ['page=1.5', 'page'],
    ['page=1&page=2', 'page'],
    ['page=1e20', 'page'],
    ['limit=-5', 'limit'],
    ['limit=0', 'limit'],
    ['limit=51', 'limit'],
    ['limit=100000', 'limit'],
    ['sort=passwordHash', 'sort'],
    ['sort=', 'sort'],
    ['order=sideways', 'order'],
    ['order=', 'order']
  ])('returns 400 for %s', async (queryString, field) => {
    const response = await agent.get(`/api/users?${queryString}`);

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error) => error.field)).toEqual([field]);
    expect(typeof response.body.errors[0].message).toBe('string');
  });

  test('reports every invalid parameter at once', async () => {
    const response = await agent.get('/api/users?page=0&limit=100');

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error) => error.field)).toEqual(['page', 'limit']);
  });
});

describe('GET /api/users search and filters', () => {
  let agent;

  // Each test starts from a dropped database, so rebuild the text index.
  beforeEach(async () => {
    await ensureUserIndexes();
    await createTestUser(ada);
    await createTestUser({ ...grace, role: 'admin' });
    await createTestUser(alan);
    agent = await loginAs(grace.email);
  });

  test('q matches a word in the display name', async () => {
    const response = await agent.get('/api/users?q=lovelace');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(['ada']);
  });

  test('q matches a username', async () => {
    const response = await agent.get('/api/users?q=aturing');

    expect(usernames(response)).toEqual(['aturing']);
  });

  test('q matches a full email address and not others on the same domain', async () => {
    const response = await agent.get(`/api/users?q=${encodeURIComponent('grace@example.com')}`);

    expect(usernames(response)).toEqual(['grace']);
  });

  test('q is case-insensitive', async () => {
    const response = await agent.get('/api/users?q=HOPPER');

    expect(usernames(response)).toEqual(['grace']);
  });

  test('role filters by role name', async () => {
    const admins = await agent.get('/api/users?role=admin');
    const customers = await agent.get('/api/users?role=customer');

    expect(usernames(admins)).toEqual(['grace']);
    expect(usernames(customers)).toEqual(['ada', 'aturing']);
  });

  test('q and role work together', async () => {
    const response = await agent.get('/api/users?q=example&role=customer');

    expect(usernames(response)).toEqual(['ada']);
  });

  test('echoes the applied query, with q trimmed', async () => {
    const response = await agent.get(`/api/users?q=${encodeURIComponent('  Lovelace ')}&role=customer`);

    expect(response.body.query).toEqual({ sort: 'username', order: 'asc', q: 'Lovelace', role: 'customer' });
  });

  test('no matches returns 200 with an empty list', async () => {
    const response = await agent.get('/api/users?q=nobody');

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

  test('pagination counts only the filtered results', async () => {
    await insertUsers(12);

    const response = await agent.get('/api/users?role=customer');

    // ada + aturing + user01..user12
    expect(response.body.data).toHaveLength(10);
    expect(response.body.pagination).toMatchObject({ totalItems: 14, totalPages: 2, hasNextPage: true });
  });

  test('search text with no real words returns 200 with an empty list, not an error', async () => {
    const symbols = await agent.get(`/api/users?q=${encodeURIComponent('@@@')}`);
    const dots = await agent.get('/api/users?q=...');

    expect(symbols.status).toBe(200);
    expect(symbols.body.data).toEqual([]);
    expect(dots.status).toBe(200);
    expect(dots.body.data).toEqual([]);
  });

  test('a trailing backslash is stripped before the search runs', async () => {
    const response = await agent.get(`/api/users?q=${encodeURIComponent('ada\\')}`);

    expect(usernames(response)).toEqual(['ada']);
    expect(response.body.query.q).toBe('ada');
  });

  test('a hyphen in the search text is not treated as a NOT operator', async () => {
    const response = await agent.get(`/api/users?q=${encodeURIComponent('ada -lovelace')}`);

    expect(usernames(response)).toEqual([]);
  });

  test('accepts q at the maximum length of 100 characters', async () => {
    const response = await agent.get(`/api/users?q=${'a'.repeat(100)}`);

    expect(response.status).toBe(200);
  });

  test.each([
    ['role=superuser', 'role'],
    ['role=admin&role=customer', 'role'],
    ['q=', 'q'],
    ['q=%20%20', 'q'],
    ['q=%22%22', 'q'],
    [`q=${'a'.repeat(101)}`, 'q'],
    ['q=a&q=b', 'q'],
    ['q=%5C%5C', 'q']
  ])('returns 400 for %s', async (queryString, field) => {
    const response = await agent.get(`/api/users?${queryString}`);

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error) => error.field)).toEqual([field]);
  });

  test('a customer cannot use filters to find other users', async () => {
    const customerAgent = await loginAs(ada.email);

    const ownByQ = await customerAgent.get('/api/users?q=lovelace');
    const ownByRole = await customerAgent.get('/api/users?role=customer');
    const byRole = await customerAgent.get('/api/users?role=admin');
    const byName = await customerAgent.get('/api/users?q=grace');

    expect(usernames(ownByQ)).toEqual(['ada']);
    expect(usernames(ownByRole)).toEqual(['ada']);
    expect(byRole.body.data).toEqual([]);
    expect(byName.body.data).toEqual([]);
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

  test('refreshes the session when a user updates their own name and email', async () => {
    const adaId = await createTestUser(ada);
    const agent = await loginAs(ada.email);

    const response = await agent
      .put(`/api/users/${adaId}`)
      .send({ displayName: 'Countess Ada', email: 'countess@example.com' });
    expect(response.status).toBe(200);

    const dashboard = await agent.get('/dashboard');
    expect(dashboard.text).toContain('Welcome, Countess Ada!');
    expect(dashboard.text).toContain('data-user-email="countess@example.com"');
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
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]._id).toBe(graceId);
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
