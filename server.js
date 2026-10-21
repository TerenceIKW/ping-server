
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const PingLog = require("./models/PingLog.js");

const app = express();

app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse the connection during warm Vercel invocations.
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

// Basic API check; this does not ping MongoDB.
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ResQMe API is running",
  });
});

// POST /health: ping MongoDB and record the result.
app.post("/health", async (req, res) => {
  const start = Date.now();

  try {
    await connectDB();

    // Send a real ping command to MongoDB.
    await mongoose.connection.db.admin().ping();

    const responseTimeMs = Date.now() - start;

    // Store the successful health check.
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

    // A failure record can only be saved if MongoDB is still usable.
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
      console.error(
        "Could not save ping log:",
        loggingError.message
      );
    }

    // Return diagnostic details without exposing credentials.
    const isConfigurationError =
      error.message === "MONGODB_URI is not configured";

    return res.status(503).json({
      status: "error",
      message: "MongoDB ping failed",
      reason: isConfigurationError
        ? error.message
        : "Check Vercel function logs for the underlying error",
      responseTimeMs,
    });
  }
});

// Vercel invokes the exported Express application.
module.exports = app;
