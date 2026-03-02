const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");

// Dashboard Statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
    const totalJobs = await Job.countDocuments();
    const totalApplications = await Application.countDocuments();
    const pendingJobs = await Job.countDocuments({ status: "pending" });
    const totalSeekers = await User.countDocuments({ role: "seeker" });
    const totalEmployers = await User.countDocuments({ role: "employer" });

    res.status(200).json({
      totalUsers,
      totalJobs,
      totalApplications,
      pendingJobs,
      totalSeekers,
      totalEmployers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ban / Unban User
const toggleBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.status(200).json({
      message: user.isBanned
        ? "User banned successfully"
        : "User unbanned successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Jobs
const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("employer", "name email companyName")
      .sort({ createdAt: -1 });

    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve / Reject Job
const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ message: `Job ${status} successfully`, job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Job
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  toggleBanUser,
  getAllJobs,
  updateJobStatus,
  deleteJob,
};
