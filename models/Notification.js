const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "new_user", 
        "new_job",
        "new_application",
        "status_update",
        "job_approved",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    // Reference data
    refUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    refJob: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    refApp: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
