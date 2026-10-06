import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { getDb } from '../src/db/connect.js';

describe('GET /api/trains', () => {
  test('returns paginated JSON response with metadata', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        totalItems: 4,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      })
    );
  });

  test('returns the trains from the starter data', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.data).toEqual(
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
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-express',
          name: 'Test Express'
        })
      ])
    );
  });

  test('returns the requested page and limit', async () => {
    const response = await request(app).get('/api/trains?page=1&limit=2');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 2,
        totalItems: 4,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false
      })
    );
  });

  test('returns 400 for invalid pagination values', async () => {
    const response = await request(app).get('/api/trains?page=0&limit=51');

    expect(response.status).toBe(400);
  });
});
