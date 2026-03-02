const Job = require("../models/Job");

const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      jobType,
      location,
      salaryMin,
      salaryMax,
      skills,
      deadline,
    } = req.body;

    const job = await Job.create({
      title,
      description,
      requirements,
      jobType,
      location,
      salaryMin,
      salaryMax,
      skills,
      deadline,
      employer: req.user.id,
    });

    res.status(201).json({ message: "Job created successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const { search, location, jobType, skills } = req.query;

    let filter = { status: "approved" };

    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }
    if (jobType) {
      filter.jobType = jobType;
    }
    if (skills) {
      filter.skills = { $in: skills.split(",") };
    }

    const jobs = await Job.find(filter)
      .populate("employer", "name companyName companyLogo")
      .sort({ createdAt: -1 });

    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "employer",
      "name companyName companyLogo companyWebsite companyDescription",
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res
      .status(200)
      .json({ message: "Job updated successfully", job: updatedJob });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Job (Employer)
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Employer's Own Jobs
const getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ employer: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
};
