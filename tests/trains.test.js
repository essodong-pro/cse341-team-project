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
});
