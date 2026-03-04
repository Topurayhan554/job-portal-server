const admin = require("../config/firebaseAdmin");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, please login" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);

    let user = await User.findOne({ email: decoded.email });

    if (!user) {
      user = await User.create({
        name: decoded.name || "User",
        email: decoded.email,
        firebaseUid: decoded.uid,
        photoURL: decoded.picture || "",
        profilePhoto: decoded.picture || "",
      });
    }

    req.user = { id: user._id, role: user.role, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token, please login again" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to access this route" });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
