const Notification = require("../models/Notification");
const User = require("../models/User");

const notify = async ({
  recipient,
  type,
  title,
  message,
  link = "",
  refUser,
  refJob,
  refApp,
}) => {
  try {
    await Notification.create({
      recipient,
      type,
      title,
      message,
      link,
      refUser,
      refJob,
      refApp,
    });
  } catch (err) {
    console.error("Notification error:", err.message);
  }
};

const notifyAllAdmins = async ({
  type,
  title,
  message,
  link = "",
  refUser,
  refJob,
  refApp,
}) => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id");
    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      type,
      title,
      message,
      link,
      ...(refUser && { refUser }),
      ...(refJob && { refJob }),
      ...(refApp && { refApp }),
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error("Notify admins error:", err.message);
  }
};

const notifyAllSeekers = async ({
  type,
  title,
  message,
  link = "",
  refJob,
}) => {
  try {
    const seekers = await User.find({ role: "seeker" }).select("_id");
    const notifications = seekers.map((s) => ({
      recipient: s._id,
      type,
      title,
      message,
      link,
      ...(refJob && { refJob }),
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error("Notify seekers error:", err.message);
  }
};

module.exports = { notify, notifyAllAdmins, notifyAllSeekers };
