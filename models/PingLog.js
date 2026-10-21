
const mongoose = require("mongoose");

const pingLogSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["success", "failure"],
    required: true,
  },
  responseTimeMs: {
    type: Number,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  checkedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.PingLog ||
  mongoose.model("PingLog", pingLogSchema);
