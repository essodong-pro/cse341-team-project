import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { getDb } from '../src/db/connect.js';

describe('GET /api/trains', () => {
  test('returns a successful JSON response', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toHaveProperty('trains');
    expect(response.body.trains).toBeInstanceOf(Array);
  });

  test('returns the trains from the starter data', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.trains).toHaveLength(4);
    expect(response.body.trains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'series-e353',
          name: 'Series E353 Limited Express',
          powerSource: 'Electric'
        })
      ])
    );
  });

  test('returns a train added to the test database', async () => {
    await getDb().collection('trains').insertOne({
      id: 'test-express',
      name: 'Test Express',
      operator: 'Test Railway'
    });

    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.trains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-express',
          name: 'Test Express'
        })
      ])
    );
  });

  test('returns pagination metadata with the default page', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 4,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });

  test('returns separate pages when a smaller limit is requested', async () => {
    const firstPage = await request(app).get('/api/trains?page=1&limit=2');
    const secondPage = await request(app).get('/api/trains?page=2&limit=2');

    expect(firstPage.status).toBe(200);
    expect(secondPage.status).toBe(200);
    expect(firstPage.body.trains).toHaveLength(2);
    expect(secondPage.body.trains).toHaveLength(2);
    expect(firstPage.body.trains.map((train) => train.id)).not.toEqual(
      secondPage.body.trains.map((train) => train.id)
    );
    expect(secondPage.body.pagination).toMatchObject({
      page: 2,
      limit: 2,
      totalItems: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  test('rejects invalid pagination values', async () => {
    const response = await request(app).get('/api/trains?page=0&limit=51');

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error) => error.field)).toEqual([
      'page',
      'limit'
    ]);
  });

  test('searches train names and operators case-insensitively', async () => {
    const nameResponse = await request(app).get('/api/trains?q=steam');
    const operatorResponse = await request(app).get('/api/trains?q=jr');

    expect(nameResponse.status).toBe(200);
    expect(nameResponse.body.trains.map((train) => train.id)).toEqual(['steam-c11']);
    expect(operatorResponse.body.trains.map((train) => train.id)).toEqual(
      expect.arrayContaining(['series-e353', 'series-287', 'kiha-261'])
    );
    expect(operatorResponse.body.trains).toHaveLength(3);
  });

  test('combines keyword search with pagination metadata', async () => {
    const response = await request(app).get('/api/trains?q=jr&limit=2&page=2');

    expect(response.status).toBe(200);
    expect(response.body.trains).toHaveLength(1);
    expect(response.body.query).toEqual({ q: 'jr' });
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  test('returns an empty paginated result when no train matches', async () => {
    const response = await request(app).get('/api/trains?q=maglev');

    expect(response.status).toBe(200);
    expect(response.body.trains).toEqual([]);
    expect(response.body.pagination.totalItems).toBe(0);
    expect(response.body.pagination.totalPages).toBe(0);
  });

  test('rejects empty, repeated, and oversized search values', async () => {
    const emptyResponse = await request(app).get('/api/trains?q=');
    const repeatedResponse = await request(app).get('/api/trains?q=jr&q=steam');
    const oversizedResponse = await request(app).get(`/api/trains?q=${'a'.repeat(101)}`);

    expect(emptyResponse.status).toBe(400);
    expect(repeatedResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(400);
    expect(emptyResponse.body.errors[0].field).toBe('q');
    expect(repeatedResponse.body.errors[0].field).toBe('q');
    expect(oversizedResponse.body.errors[0].field).toBe('q');
  });
});
