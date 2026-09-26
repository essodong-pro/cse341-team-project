import request from 'supertest';
import app from '../../app.js';
import { createUser } from '../../src/models/users.js';
import { getRoleByName } from '../../src/models/roles.js';
import User from '../../src/models/schemas/user.js';

export const DEFAULT_PASSWORD = 'Password123!';

/**
 * Creates a user through the real registration model function, then
 * optionally promotes them. Returns the new user's id as a string.
 */
export async function createTestUser({ displayName, username, email, role = 'customer' }) {
  const user = await createUser(displayName, username, email, DEFAULT_PASSWORD);

  if (role !== 'customer') {
    const roleDoc = await getRoleByName(role);
    await User.updateOne({ _id: user._id }, { role: roleDoc._id });
  }

  return user._id.toString();
}

/**
 * Logs in through POST /login and returns a supertest agent that keeps
 * the session cookie for later requests.
 */
export async function loginAs(email, password = DEFAULT_PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post('/login').type('form').send({ email, password });

  if (response.status !== 302) {
    throw new Error(`Login failed for ${email} (status ${response.status})`);
  }

  return agent;
}

/**
 * tests/setup.js drops the database before every test, which also drops
 * Mongoose's unique indexes. Rebuild them for tests that rely on
 * duplicate-key errors.
 */
export async function ensureUserIndexes() {
  await User.createIndexes();
}
