const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Job = require("../models/Job");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { notify, notifyAllAdmins } = require("../utils/createNotification");

// POST /api/applications — Apply
router.post("/", protect, authorizeRoles("seeker"), async (req, res) => {
  try {
    const { jobId, coverLetter, cvUrl } = req.body;

    const job = await Job.findById(jobId).populate("postedBy", "name _id");
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

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
      employer: job.postedBy._id,
      coverLetter: coverLetter || "",
      cvUrl: cvUrl || "",
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

    // ✅ Employer কে notify
    await notify({
      recipient: job.postedBy._id,
      type: "new_application",
      title: "New Application Received 📬",
      message: `Someone applied for your job "${job.title}".`,
      link: "/employer/applicants",
      refJob: job._id,
      refApp: application._id,
    });

    // ✅ Admin কে notify
    await notifyAllAdmins({
      type: "new_application",
      title: "New Application Submitted",
      message: `New application for "${job.title}" at ${job.company}.`,
      link: "/admin/applications",
      refJob: job._id,
      refApp: application._id,
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/applications/my — Seeker (BEFORE /:id)
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

// GET /api/applications/employer — Employer (BEFORE /:id)
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

// GET /api/applications — Admin (BEFORE /:id)
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

// GET /api/applications/:id — Single
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

// PUT /api/applications/:id/status — Employer update
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
        .populate("applicant", "name email _id");

      if (!application)
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });

      // ✅ Seeker কে status notification
      const statusMessages = {
        "Under Review": "Your application is now under review. 👀",
        Shortlisted: "🎉 Great news! You've been shortlisted.",
        Interview: "🎯 You've been invited for an interview!",
        Hired: "🎊 Congratulations! You've been hired!",
        Rejected: "Your application was not selected this time. Keep trying!",
      };

      if (statusMessages[status]) {
        await notify({
          recipient: application.applicant._id,
          type: "status_update",
          title: `Application ${status}`,
          message: `${statusMessages[status]} — ${application.job.title} at ${application.job.company}`,
          link: "/seeker/applications",
          refJob: application.job._id,
          refApp: application._id,
        });
      }

      res.json({ success: true, application });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// DELETE /api/applications/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application)
      return res.status(404).json({ success: false, message: "Not found" });

    if (
      req.user.role === "seeker" &&
      application.applicant.toString() !== req.user.id.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await Application.findByIdAndDelete(req.params.id);
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicantsCount: -1 },
    });

    res.json({ success: true, message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
