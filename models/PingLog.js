const mongoose = require("mongoose");

const pingLogSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["success", "failure"],
    required: true,
  },
  responseTimeMs: Number,
  message: String,
  checkedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PingLog", pingLogSchema);