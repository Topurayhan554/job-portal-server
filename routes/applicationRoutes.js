const express = require("express");
const router = express.Router();
const {
  applyJob,
  getMyApplications,
  getJobApplicants,
  updateApplicationStatus,
  deleteApplication,
} = require("../controllers/applicationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Seeker
router.post("/:jobId/apply", protect, authorizeRoles("seeker"), applyJob);
router.get(
  "/my-applications",
  protect,
  authorizeRoles("seeker"),
  getMyApplications,
);
router.delete("/:id", protect, authorizeRoles("seeker"), deleteApplication);

// Employer
router.get(
  "/:jobId/applicants",
  protect,
  authorizeRoles("employer"),
  getJobApplicants,
);
router.put(
  "/:id/status",
  protect,
  authorizeRoles("employer"),
  updateApplicationStatus,
);

module.exports = router;
