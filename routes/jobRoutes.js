const express = require("express");
const router = express.Router();
const Job = require("../models/Job");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const {
  notify,
  notifyAllAdmins,
  notifyAllSeekers,
} = require("../utils/createNotification");

// GET /api/jobs — Public
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      type,
      experience,
      location,
      salaryMin,
      featured,
      page = 1,
      limit = 12,
      sort = "newest",
    } = req.query;

    const query = { status: "Active" };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { skills: { $regex: search, $options: "i" } },
      ];
    }
    if (category && category !== "All") query.category = category;
    if (type) query.type = type;
    if (experience) query.experience = experience;
    if (location && location !== "All Locations") query.location = location;
    if (salaryMin) query.salaryMin = { $gte: Number(salaryMin) };
    if (featured === "true") query.featured = true;

    const sortOption =
      sort === "salary"
        ? { salaryMin: -1 }
        : sort === "featured"
          ? { featured: -1, createdAt: -1 }
          : { createdAt: -1 };

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate("postedBy", "name profilePhoto companyName")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, jobs, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/jobs/admin/all — Admin only (BEFORE /:id)
router.get("/admin/all", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 12 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }
    if (status && status !== "All") query.status = status;

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate("postedBy", "name email profilePhoto")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, jobs, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/jobs/employer/my-jobs — Employer only (BEFORE /:id)
router.get(
  "/employer/my-jobs",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const query = { postedBy: req.user.id };
      if (status && status !== "All") query.status = status;

      const total = await Job.countDocuments(query);
      const jobs = await Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      res.json({ success: true, jobs, total });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// POST /api/jobs — Employer posts job
router.post(
  "/",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const job = await Job.create({ ...req.body, postedBy: req.user.id });

      // ✅ Admin কে notify
      await notifyAllAdmins({
        type: "new_job",
        title: "New Job Posted",
        message: `"${job.title}" at ${job.company} posted. Needs review.`,
        link: "/admin/jobs",
        refJob: job._id,
      });

      // ✅ Active job হলে সব seeker কে notify
      if (job.status === "Active") {
        await notifyAllSeekers({
          type: "new_job",
          title: "New Job Available 🚀",
          message: `${job.title} at ${job.company} — ${job.location} (${job.type})`,
          link: `/jobs/${job._id}`,
          refJob: job._id,
        });
      }

      res.status(201).json({ success: true, job });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// GET /api/jobs/:id — Public (AFTER specific routes)
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "postedBy",
      "name profilePhoto companyName companyWebsite companyBio companySize",
    );
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/jobs/:id
router.put(
  "/:id",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);
      if (!job)
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });

      if (
        job.postedBy.toString() !== req.user.id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Not authorized" });
      }

      const wasNotActive = job.status !== "Active";
      const updated = await Job.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      // ✅ Admin job approve করলে
      if (
        req.user.role === "admin" &&
        wasNotActive &&
        updated.status === "Active"
      ) {
        // Employer কে notify
        await notify({
          recipient: job.postedBy,
          type: "job_approved",
          title: "Job Approved! 🎉",
          message: `Your job "${job.title}" is now live and visible to seekers.`,
          link: "/employer/jobs",
          refJob: job._id,
        });

        // Seekers কে notify
        await notifyAllSeekers({
          type: "new_job",
          title: "New Job Available 🚀",
          message: `${job.title} at ${job.company} — ${job.location} (${job.type})`,
          link: `/jobs/${job._id}`,
          refJob: job._id,
        });
      }

      res.json({ success: true, job: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// DELETE /api/jobs/:id
router.delete(
  "/:id",
  protect,
  authorizeRoles("employer", "admin"),
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);
      if (!job)
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });

      if (
        job.postedBy.toString() !== req.user.id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Not authorized" });
      }

      await Job.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Job deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// PUT /api/jobs/:id/report
router.put("/:id/report", protect, async (req, res) => {
  try {
    await Job.findByIdAndUpdate(req.params.id, { reported: true });

    // ✅ Admin কে notify
    const job = await Job.findById(req.params.id);
    if (job) {
      await notifyAllAdmins({
        type: "new_job",
        title: "Job Reported ⚠️",
        message: `"${job.title}" at ${job.company} has been reported by a user.`,
        link: "/admin/jobs",
        refJob: job._id,
      });
    }

    res.json({ success: true, message: "Job reported" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
