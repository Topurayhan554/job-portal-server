const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Job = require("../models/Job");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// POST /api/applications — Apply
router.post("/", protect, authorizeRoles("seeker"), async (req, res) => {
  try {
    const { jobId, coverLetter, cvUrl } = req.body;

    const job = await Job.findById(jobId);
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    const existing = await Application.findOne({
      job: jobId,
      applicant: req.user.id,
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Already applied" });
    }

    const application = await Application.create({
      job: jobId,
      applicant: req.user.id,
      employer: job.postedBy,
      coverLetter,
      cvUrl,
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/my — Seeker
router.get("/my", protect, authorizeRoles("seeker"), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { applicant: req.user.id };
    if (status && status !== "All") query.status = status;

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate("job", "title company location type salaryMin salaryMax")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, applications, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/employer — Employer
router.get(
  "/employer",
  protect,
  authorizeRoles("employer"),
  async (req, res) => {
    try {
      const { jobId, status, page = 1, limit = 10 } = req.query;
      const query = { employer: req.user.id };
      if (jobId) query.job = jobId;
      if (status && status !== "All") query.status = status;

      const total = await Application.countDocuments(query);
      const applications = await Application.find(query)
        .populate("job", "title company")
        .populate("applicant", "name email profilePhoto phone skills cvUrl")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      res.json({ success: true, applications, total });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// PUT /api/applications/:id/status — Employer update
router.put(
  "/:id/status",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const application = await Application.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true },
      ).populate("job applicant");

      res.json({ success: true, application });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// GET /api/applications — Admin
router.get("/", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== "All") query.status = status;

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate("job", "title company location")
      .populate("applicant", "name email profilePhoto")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, applications, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/applications/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
