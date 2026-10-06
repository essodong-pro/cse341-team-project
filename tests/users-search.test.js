import { beforeEach, describe, expect, test } from 'vitest';
import { getRoleByName } from '../src/models/roles.js';
import User from '../src/models/schemas/user.js';
import { ensureUserIndexes, loginAs } from './helpers/auth.js';

// Accounts seeded by initializeDatabase before every test.
const ADMIN_EMAIL = 'admin@kizunarail.com';
const CUSTOMER_EMAIL = 'customer@kizunarail.com';

const passengerUsernames = Array.from(
  { length: 12 },
  (_, index) => `passenger${String(index + 1).padStart(2, '0')}`
);

// Seeded admin + customer, plus these 14 users = 16 users in total.
// Sorted by username: admin, customer, hsato, ksato, passenger01 ... passenger12.
async function insertKnownUsers() {
  const adminRole = await getRoleByName('admin');
  const customerRole = await getRoleByName('customer');

  const passengers = passengerUsernames.map((username, index) => ({
    displayName: `Passenger ${String(index + 1).padStart(2, '0')}`,
    username,
    email: `${username}@travel.example`,
    passwordHash: 'not-a-real-hash',
    role: customerRole._id
  }));

  await User.insertMany([
    ...passengers,
    {
      displayName: 'Hana Sato',
      username: 'hsato',
      email: 'hana@sakura.jp',
      passwordHash: 'not-a-real-hash',
      role: customerRole._id
    },
    {
      displayName: 'Kenji Sato',
      username: 'ksato',
      email: 'kenji@sakura.jp',
      passwordHash: 'not-a-real-hash',
      role: adminRole._id
    }
  ]);
}

const usernames = (response) => response.body.data.map((user) => user.username);

let adminAgent;

beforeEach(async () => {
  // tests/setup.js drops the database, which also removes the text index q needs.
  await ensureUserIndexes();
  await insertKnownUsers();
  adminAgent = await loginAs(ADMIN_EMAIL);
});

describe('GET /api/users pagination', () => {
  test('returns the first 10 users sorted by username with pagination metadata', async () => {
    const response = await adminAgent.get('/api/users');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual([
      'admin', 'customer', 'hsato', 'ksato',
      ...passengerUsernames.slice(0, 6)
    ]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 16,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
  });

  test('returns a partial last page with no next page', async () => {
    const response = await adminAgent.get('/api/users?page=2');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(passengerUsernames.slice(6));
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 10,
      totalItems: 16,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  test('walking every page returns each user exactly once', async () => {
    const seen = [];

    for (let page = 1; page <= 4; page += 1) {
      const response = await adminAgent.get(`/api/users?limit=5&page=${page}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.totalPages).toBe(4);
      seen.push(...usernames(response));
    }

    expect(seen).toHaveLength(16);
    expect(new Set(seen).size).toBe(16);
    expect(seen).toEqual([
      'admin', 'customer', 'hsato', 'ksato', ...passengerUsernames
    ]);
  });

  test('sorts by display name in either direction', async () => {
    const ascending = await adminAgent.get('/api/users?sort=displayName&limit=3');
    const descending = await adminAgent.get('/api/users?sort=displayName&order=desc&limit=2');

    expect(ascending.body.data.map((user) => user.displayName)).toEqual([
      'Admin User', 'Hana Sato', 'Kenji Sato'
    ]);
    expect(descending.body.data.map((user) => user.displayName)).toEqual([
      'Test Customer', 'Passenger 12'
    ]);
    expect(descending.body.query).toEqual({ sort: 'displayName', order: 'desc' });
  });
});

describe('GET /api/users role filter', () => {
  test('role=admin returns only administrators', async () => {
    const response = await adminAgent.get('/api/users?role=admin');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(['admin', 'ksato']);
    expect(response.body.data.every((user) => user.role === 'admin')).toBe(true);
    expect(response.body.pagination).toMatchObject({ totalItems: 2, totalPages: 1 });
  });

  test('pages through customers only and returns a partial last page', async () => {
    // 14 customers at 5 per page = pages of 5, 5 and 4.
    const response = await adminAgent.get('/api/users?role=customer&limit=5&page=3');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(passengerUsernames.slice(8));
    expect(response.body.data.every((user) => user.role === 'customer')).toBe(true);
    expect(response.body.pagination).toEqual({
      page: 3,
      limit: 5,
      totalItems: 14,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });
});

describe('GET /api/users keyword search', () => {
  test('q matches a word in the display name', async () => {
    const response = await adminAgent.get('/api/users?q=sato');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(['hsato', 'ksato']);
  });

  test('q matches a username', async () => {
    const response = await adminAgent.get('/api/users?q=hsato');

    expect(usernames(response)).toEqual(['hsato']);
  });

  test('q matches a full email address and not others on the same domain', async () => {
    const response = await adminAgent.get(`/api/users?q=${encodeURIComponent('hana@sakura.jp')}`);

    expect(usernames(response)).toEqual(['hsato']);
  });

  test('search results are paginated and the query is echoed back', async () => {
    // 12 passengers at 5 per page = pages of 5, 5 and 2.
    const response = await adminAgent.get('/api/users?q=passenger&limit=5&page=3');

    expect(response.status).toBe(200);
    expect(usernames(response)).toEqual(['passenger11', 'passenger12']);
    expect(response.body.query).toEqual({ sort: 'username', order: 'asc', q: 'passenger' });
    expect(response.body.pagination).toEqual({
      page: 3,
      limit: 5,
      totalItems: 12,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  test('q and role filter together', async () => {
    const response = await adminAgent.get('/api/users?q=sato&role=admin');

    expect(usernames(response)).toEqual(['ksato']);
    expect(response.body.pagination.totalItems).toBe(1);
  });

  test('returns 200 with an empty list when nothing matches the search', async () => {
    const response = await adminAgent.get('/api/users?q=tanaka');

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

  test('returns an empty list when the search and role match different users', async () => {
    const response = await adminAgent.get('/api/users?q=passenger&role=admin');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalItems).toBe(0);
  });

  test('returns 400 listing every invalid search parameter', async () => {
    const response = await adminAgent.get(`/api/users?page=0&q=${'a'.repeat(101)}&role=guest`);

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error) => error.field)).toEqual(['page', 'q', 'role']);
  });

  test('a standard user cannot use search or filters to find other users', async () => {
    const customerAgent = await loginAs(CUSTOMER_EMAIL);

    const bySearch = await customerAgent.get('/api/users?q=sato');
    const byRole = await customerAgent.get('/api/users?role=customer');

    expect(bySearch.status).toBe(200);
    expect(bySearch.body.data).toEqual([]);
    expect(usernames(byRole)).toEqual(['customer']);
    expect(byRole.body.pagination.totalItems).toBe(1);
  });
});
