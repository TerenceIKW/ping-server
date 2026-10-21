
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const PingLog = require("./models/PingLog.js");

const app = express();

app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse the connection across Vercel invocations.
let connectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured in Vercel");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGODB_URI).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
}

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ResQMe API is running",
  });
});

app.get("/health", async (req, res) => {
  const start = Date.now();

  try {
    await connectDB();

    // Verify that MongoDB responds to a ping.
    await mongoose.connection.db.admin().ping();

    const responseTimeMs = Date.now() - start;

    await PingLog.create({
      status: "success",
      responseTimeMs,
      message: "MongoDB is reachable",
    });

    return res.status(200).json({
      status: "ok",
      message: "MongoDB ping successful",
      database: mongoose.connection.name,
      responseTimeMs,
    });
  } catch (error) {
    console.error("MongoDB ping failed:", error.message);

    // Save a failure record only if MongoDB is available.
    try {
      if (
        mongoose.connection.readyState === 1 &&
        mongoose.connection.db
      ) {
        await PingLog.create({
          status: "failure",
          responseTimeMs: Date.now() - start,
          message: "MongoDB ping failed",
        });
      }
    } catch (loggingError) {
      console.error("Could not save ping log:", loggingError.message);
    }

    return res.status(503).json({
      status: "error",
      message: "MongoDB ping failed",
    });
  }
});

// Vercel handles the HTTP server.
module.exports = app;