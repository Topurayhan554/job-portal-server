const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coverLetter: { type: String, default: "" },
    cvUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "Applied",
        "Under Review",
        "Shortlisted",
        "Interview",
        "Rejected",
        "Hired",
      ],
      default: "Applied",
    },
    matchScore: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Application", applicationSchema);
