const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Job = require("../models/Job");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// POST /api/applications — Apply for a job (seeker)
router.post("/", protect, authorizeRoles("seeker"), async (req, res) => {
  try {
    const { jobId, coverLetter, cvUrl } = req.body;

    const job = await Job.findById(jobId);
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    // Already applied check
    const existing = await Application.findOne({
      job: jobId,
      applicant: req.user.id,
    });
    if (existing)
      return res
        .status(409)
        .json({ success: false, message: "Already applied to this job" });

    const application = await Application.create({
      job: jobId,
      applicant: req.user.id,
      employer: job.postedBy,
      coverLetter: coverLetter || "",
      cvUrl: cvUrl || "",
    });

    // Increment applicantsCount
    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/my — Seeker's own applications
router.get("/my", protect, authorizeRoles("seeker"), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
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

// GET /api/applications/employer — Employer sees their job applications
router.get(
  "/employer",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const { jobId, status, page = 1, limit = 50 } = req.query;
      const query = { employer: req.user.id };

      if (jobId) query.job = jobId;
      if (status && status !== "All") query.status = status;

      const total = await Application.countDocuments(query);
      const applications = await Application.find(query)
        .populate("job", "title company type location")
        .populate(
          "applicant",
          "name email profilePhoto photoURL phone skills cvUrl location bio",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      res.json({ success: true, applications, total });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// GET /api/applications — Admin sees all applications
router.get("/", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== "All") query.status = status;

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate("job", "title company location")
      .populate("applicant", "name email profilePhoto photoURL")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, applications, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/:id — Single application
router.get("/:id", protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate(
        "job",
        "title company location type salaryMin salaryMax description",
      )
      .populate("applicant", "name email profilePhoto phone skills cvUrl bio");

    if (!application)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/applications/:id/status — Employer update status
router.put(
  "/:id/status",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const validStatuses = [
        "Applied",
        "Under Review",
        "Shortlisted",
        "Interview",
        "Hired",
        "Rejected",
      ];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }

      const application = await Application.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true },
      )
        .populate("job", "title company")
        .populate("applicant", "name email profilePhoto");

      if (!application)
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });

      res.json({ success: true, application });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// DELETE /api/applications/:id — Seeker/Admin can delete
router.delete("/:id", protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application)
      return res.status(404).json({ success: false, message: "Not found" });

    // Seeker can delete
    if (
      req.user.role === "seeker" &&
      application.applicant.toString() !== req.user.id.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await Application.findByIdAndDelete(req.params.id);

    // applicantsCount
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicantsCount: -1 },
    });

    res.json({ success: true, message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
