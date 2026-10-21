require("dotenv").config();

const mongoose = require("mongoose");
const express = require("express");
const PingLog = require("./models/PingLog.js");

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

app.get("/health", async (req, res) => {
  const start = Date.now();

  try {
    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured");
      }

      await mongoose.connect(MONGODB_URI);
    }

    // Ping MongoDB
    await mongoose.connection.db.admin().ping();

    const responseTimeMs = Date.now() - start;

    // Store successful ping
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

    // Record failure only if MongoDB is still connected
    try {
      if (mongoose.connection.readyState === 1) {
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

async function startServer() {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from your .env file");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;