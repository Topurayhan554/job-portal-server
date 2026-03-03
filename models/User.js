const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },

    // ✅ photo fields — photoURL এর পাশে profilePhoto ও coverPhoto add
    photoURL: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    coverPhoto: { type: String, default: "" },

    phone: { type: String, default: "" },

    // ✅ location add
    location: { type: String, default: "" },

    role: {
      type: String,
      enum: ["seeker", "employer", "admin"],
      default: "seeker",
    },
    status: { type: String, enum: ["active", "banned"], default: "active" },
    isBanned: { type: Boolean, default: false },

    // Seeker specific
    bio: { type: String, default: "" },
    skills: [{ type: String }],
    experience: [
      {
        role: String,
        company: String,
        duration: String,
        desc: String,
      },
    ],
    education: [
      {
        degree: String,
        school: String,
        duration: String,
        grade: String,
      },
    ],
    cvUrl: { type: String, default: "" },
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],

    // Employer specific
    companyName: { type: String, default: "" },
    companyWebsite: { type: String, default: "" },
    companySize: { type: String, default: "" },
    companyBio: { type: String, default: "" },
    benefits: [{ type: String }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
