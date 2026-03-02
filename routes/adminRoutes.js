const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  toggleBanUser,
  getAllJobs,
  updateJobStatus,
  deleteJob,
} = require("../controllers/adminController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// route admin protection
router.use(protect, authorizeRoles("admin"));

router.get("/stats", getDashboardStats);
router.get("/users", getAllUsers);
router.put("/users/:id/ban", toggleBanUser);
router.get("/jobs", getAllJobs);
router.put("/jobs/:id/status", updateJobStatus);
router.delete("/jobs/:id", deleteJob);

module.exports = router;
