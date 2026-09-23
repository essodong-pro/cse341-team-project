import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('GET /api/ticket-classes', () => {
  test('returns all ticket classes', async () => {
    const response = await request(app).get('/api/ticket-classes');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(3);
  });


  describe('GET /api/ticket-classes?day=', () => {
  test('returns ticket classes available on Monday', async () => {
    const response = await request(app).get('/api/ticket-classes?day=monday');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((ticketClass) => ticketClass.class)).toEqual(
      expect.arrayContaining(['standard', 'premium'])
    );
  });

  test('returns 400 for an invalid day', async () => {
    const response = await request(app).get('/api/ticket-classes?day=funday');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid day'
    });
  });
});
});