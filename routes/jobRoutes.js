const express = require("express");
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
} = require("../controllers/jobController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Public
router.get("/", getAllJobs);
router.get("/:id", getJobById);

// Employer only
router.post("/", protect, authorizeRoles("employer"), createJob);
router.put("/:id", protect, authorizeRoles("employer"), updateJob);
router.delete("/:id", protect, authorizeRoles("employer"), deleteJob);
router.get("/employer/my-jobs", protect, authorizeRoles("employer"), getMyJobs);

module.exports = router;
