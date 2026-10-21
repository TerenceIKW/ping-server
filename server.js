
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const PingLog = require("./models/PingLog.js");

const app = express();

app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse the MongoDB connection across warm Vercel invocations.
let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      })
      .then(() => mongoose.connection)
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;

  if (!mongoose.connection.db) {
    connectionPromise = null;
    throw new Error("MongoDB connected without an available database");
  }

  return mongoose.connection;
}

// GET / - basic API status.
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ResQMe API is running",
    endpoints: {
      default: "POST /",
      health: "POST /health",
    },
  });
});

// Shared handler for POST / and POST /health.
async function healthCheck(req, res) {
  const start = Date.now();

  try {
    await connectDB();

    // Verify that MongoDB responds to a real ping.
    await mongoose.connection.db.admin().ping();

    const responseTimeMs = Date.now() - start;

    const pingLog = await PingLog.create({
      status: "success",
      responseTimeMs,
      message: "MongoDB is reachable",
    });

    return res.status(200).json({
      status: "ok",
      message: "MongoDB ping successful",
      database: mongoose.connection.name,
      responseTimeMs,
      logId: pingLog._id.toString(),
    });
  } catch (error) {
    const responseTimeMs = Date.now() - start;

    console.error("MongoDB health check failed:", {
      name: error.name,
      message: error.message,
      code: error.code,
      readyState: mongoose.connection.readyState,
    });

    // Record failures only when MongoDB is usable.
    try {
      if (
        mongoose.connection.readyState === 1 &&
        mongoose.connection.db
      ) {
        await PingLog.create({
          status: "failure",
          responseTimeMs,
          message: "MongoDB health check failed",
        });
      }
    } catch (loggingError) {
      console.error("Could not save ping log:", loggingError.message);
    }

    const isConfigurationError =
      error.message === "MONGODB_URI is not configured";

    return res.status(503).json({
      status: "error",
      message: "MongoDB ping failed",
      reason: isConfigurationError
        ? error.message
        : "Check server logs for the underlying error",
      responseTimeMs,
    });
  }
}

// POST to the default application URL.
app.post("/", healthCheck);

// POST to the dedicated health endpoint.
app.post("/health", healthCheck);

// Export the Express app for Vercel.
module.exports = app;
