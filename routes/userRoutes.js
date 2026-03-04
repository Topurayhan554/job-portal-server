const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { notify, notifyAllAdmins } = require("../utils/createNotification");

// POST /api/users — Register/Sync user
router.post("/", async (req, res) => {
  try {
    const { name, email, photoURL, uid, phone, role } = req.body;

    let user = await User.findOne({ email });
    if (user) return res.json({ success: true, user });

    user = await User.create({
      firebaseUid: uid,
      name,
      email,
      photoURL: photoURL || "",
      profilePhoto: photoURL || "",
      phone: phone || "",
      role: role || "seeker",
    });

    await notifyAllAdmins({
      type: "new_user",
      title: "New User Registered",
      message: `${name} joined as a ${role || "seeker"}.`,
      link: "/admin/users",
      refUser: user._id,
    });

    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users/login — Firebase sync on login
router.post("/login", async (req, res) => {
  try {
    const { email, name, photoURL, uid } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        name: name || "User",
        email,
        photoURL: photoURL || "",
        profilePhoto: photoURL || "",
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/me
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/me
router.put("/me", protect, async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "phone",
      "bio",
      "location",
      "photoURL",
      "profilePhoto",
      "coverPhoto",
      "skills",
      "experience",
      "education",
      "cvUrl",
      "savedJobs",
      "companyName",
      "companyWebsite",
      "companySize",
      "companyBio",
      "benefits",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: false },
    ).select("-password");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Profile update notification
    const skipFields = ["savedJobs", "photoURL", "coverPhoto"];
    const fieldLabels = {
      name: "Name",
      phone: "Phone number",
      bio: "Bio",
      location: "Location",
      profilePhoto: "Profile photo",
      skills: "Skills",
      experience: "Work experience",
      education: "Education",
      cvUrl: "CV / Resume",
      companyName: "Company name",
      companyWebsite: "Company website",
      companySize: "Company size",
      companyBio: "Company bio",
      benefits: "Company benefits",
    };

    const changed = Object.keys(updates)
      .filter((f) => !skipFields.includes(f) && fieldLabels[f])
      .map((f) => fieldLabels[f]);

    if (changed.length > 0) {
      await notify({
        recipient: req.user.id,
        type: "profile_update",
        title: "Profile Updated ✅",
        message: `${changed.join(", ")} updated successfully.`,
        link: `/${user.role}/profile`,
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users — Admin only
router.get("/", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role && role !== "all") query.role = role;
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/:id/ban — Admin only
router.put("/:id/ban", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.isBanned = !user.isBanned;
    user.status = user.isBanned ? "banned" : "active";
    await user.save();

    await notify({
      recipient: user._id,
      type: "profile_update",
      title: user.isBanned ? "Account Suspended" : "Account Restored",
      message: user.isBanned
        ? "Your account has been suspended by an admin."
        : "Your account has been restored. Welcome back!",
      link: "/",
    });

    res.json({
      success: true,
      user,
      message: user.isBanned ? "User banned" : "User unbanned",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/:id/role — Admin only
router.put("/:id/role", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true },
    ).select("-password");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await notify({
      recipient: user._id,
      type: "profile_update",
      title: "Role Updated",
      message: `Your account role has been changed to ${req.body.role}.`,
      link: `/${req.body.role}/dashboard`,
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:id — Admin only
router.delete("/:id", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
