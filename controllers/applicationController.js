const Application = require("../models/Application");
const Job = require("../models/Job");

// Apply for a Job
const applyJob = async (req, res) => {
  try {
    const { coverLetter, resume } = req.body;
    const jobId = req.params.jobId;


    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "approved") {
      return res.status(400).json({ message: "Job is not available" });
    }

    if (new Date(job.deadline) < new Date()) {
      return res.status(400).json({ message: "Job deadline has passed" });
    }

    const existingApplication = await Application.findOne({
      job: jobId,
      applicant: req.user.id,
    });
    if (existingApplication) {
      return res
        .status(400)
        .json({ message: "You have already applied for this job" });
    }
    const application = await Application.create({
      job: jobId,
      applicant: req.user.id,
      coverLetter,
      resume,
    });

    // Job এর applicantsCount বাড়ানো
    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

    res
      .status(201)
      .json({ message: "Application submitted successfully", application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get My Applications (Seeker)
const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user.id })
      .populate(
        "job",
        "title location jobType salaryMin salaryMax deadline status",
      )
      .sort({ createdAt: -1 });

    res.status(200).json({ applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Applicants for a Job (Employer)
const getJobApplicants = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // শুধু নিজের job এর applicants দেখতে পারবে
    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .populate(
        "applicant",
        "name email skills experience education resume profilePhoto",
      )
      .sort({ createdAt: -1 });

    res.status(200).json({ applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Application Status (Employer)
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const application = await Application.findById(req.params.id).populate(
      "job",
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // job employer status change
    if (application.job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    application.status = status;
    await application.save();

    res
      .status(200)
      .json({ message: "Application status updated", application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Application (Seeker)
const deleteApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.applicant.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await Application.findByIdAndDelete(req.params.id);

    // Job এর applicantsCount কমানো
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicantsCount: -1 },
    });

    res.status(200).json({ message: "Application deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  applyJob,
  getMyApplications,
  getJobApplicants,
  updateApplicationStatus,
  deleteApplication,
};
