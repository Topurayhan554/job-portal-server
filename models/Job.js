const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String, default: "" },
    benefits: { type: String, default: "" },
    company: { type: String, required: true },
    location: { type: String, required: true },
    type: {
      type: String,
      enum: ["Full-time", "Part-time", "Remote", "Freelance", "Internship"],
      required: true,
    },
    category: { type: String, required: true },
    experience: { type: String, default: "" },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    skills: [{ type: String }],
    deadline: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Paused", "Closed", "Pending"],
      default: "Active",
    },
    featured: { type: Boolean, default: false },
    reported: { type: Boolean, default: false },
    // applicantsCount track
    applicantsCount: { type: Number, default: 0 },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Job", jobSchema);
