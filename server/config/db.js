const mongoose = require('mongoose');

/**
 * Connect to MongoDB using MONGO_URI from env.
 * The app exits on connection failure so that orchestrators (PM2 / Docker)
 * restart the process instead of running in a half-broken state.
 */
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not set in environment');
    }
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    // eslint-disable-next-line no-console
    console.log(`📦 MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`❌ MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
