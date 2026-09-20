import { MongoClient } from "mongodb";
import mongoose from "mongoose";

let database;
let client;

const connectToDb = async (options = {}) => {
  if (database) {
    return database;
  }

  const connectionString =
    options.connectionString || process.env.MONGODB_URI;

  const databaseName =
    options.databaseName ||
    process.env.MONGODB_DB_NAME ||
    "practice";

  if (!connectionString) {
    throw new Error("MONGODB_URI is required.");
  }

  // Native MongoDB connection
  client = new MongoClient(connectionString);
  await client.connect();

  database = client.db(databaseName);

  // Mongoose connection
  await mongoose.connect(connectionString, {
    dbName: databaseName,
  });

  return database;
};

const getDb = () => {
  if (!database) {
    throw new Error(
      "Database not initialized. Call connectToDb first."
    );
  }

  return database;
};

const closeDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
  }
};

export { closeDb, connectToDb, getDb };