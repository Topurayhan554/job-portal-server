const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// POST /api/users — Register/Sync user
router.post("/", async (req, res) => {
  try {
    const { name, email, photoURL, uid, phone, role } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.json({ success: true, user });
    }

    user = await User.create({
      firebaseUid: uid,
      name,
      email,
      profilePhoto: photoURL || "",
      phone: phone || "",
      role: role || "seeker",
      password: "firebase-auth",
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
        profilePhoto: photoURL || "",
        password: "firebase-auth",
      });
    } else {
      if (name) user.name = name;
      if (photoURL) user.profilePhoto = photoURL;
      await user.save();
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
      "skills",
      "experience",
      "education",
      "cvUrl",
      "companyName",
      "companyWebsite",
      "companySize",
      "companyBio",
      "benefits",
      "profilePhoto",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

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
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:id — Admin only
router.delete("/:id", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
