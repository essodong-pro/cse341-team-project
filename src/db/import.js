import { closeDb, connectToDb } from './connect.js';
import { initializeDatabase } from './initialize.js';

try {
  const db = await connectToDb();
  await initializeDatabase(db);
  console.log('MongoDB import complete.');
} finally {
  await closeDb();
}
