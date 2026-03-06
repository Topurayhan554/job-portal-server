const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// GET /api/messages/conversations
router.get("/conversations", protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
    })
      .populate(
        "participants",
        "name profilePhoto photoURL role companyName online",
      )
      .sort({ lastMessageAt: -1 });

    const result = conversations.map((conv) => {
      const other = conv.participants.find(
        (p) => p._id.toString() !== req.user.id.toString(),
      );
      const unread = conv.unreadCount?.get(req.user.id.toString()) || 0;
      return {
        _id: conv._id,
        other,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unread,
      };
    });

    res.json({ success: true, conversations: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/conversations
router.post("/conversations", protect, async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId)
      return res
        .status(400)
        .json({ success: false, message: "recipientId required" });

    const recipient = await User.findById(recipientId).select(
      "name profilePhoto photoURL role",
    );
    if (!recipient)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    let conv = await Conversation.findOne({
      participants: { $all: [req.user.id, recipientId], $size: 2 },
    }).populate("participants", "name profilePhoto photoURL role companyName");

    if (!conv) {
      conv = await Conversation.create({
        participants: [req.user.id, recipientId],
        lastMessage: "",
        lastMessageAt: new Date(),
        unreadCount: {},
      });
      conv = await Conversation.findById(conv._id).populate(
        "participants",
        "name profilePhoto photoURL role companyName",
      );
    }

    const other = conv.participants.find(
      (p) => p._id.toString() !== req.user.id.toString(),
    );

    res.json({ success: true, conversation: { _id: conv._id, other } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/messages/:conversationId — messages load
router.get("/:conversationId", protect, async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.id,
    });
    if (!conv)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    const messages = await Message.find({
      conversation: req.params.conversationId,
    })
      .populate("sender", "name profilePhoto photoURL")
      .sort({ createdAt: 1 });

    // Read
    await Message.updateMany(
      {
        conversation: req.params.conversationId,
        sender: { $ne: req.user.id },
        read: false,
      },
      { read: true },
    );

    // unreadCount reset
    conv.unreadCount.set(req.user.id.toString(), 0);
    await conv.save();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/:conversationId — message
router.post("/:conversationId", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Message text required" });

    const conv = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.id,
    });
    if (!conv)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    const message = await Message.create({
      conversation: req.params.conversationId,
      sender: req.user.id,
      text: text.trim(),
    });

    // conversation lastMessage update
    const otherId = conv.participants
      .find((p) => p.toString() !== req.user.id.toString())
      ?.toString();

    const otherUnread = (conv.unreadCount?.get(otherId) || 0) + 1;
    conv.unreadCount.set(otherId, otherUnread);
    conv.lastMessage = text.trim();
    conv.lastMessageAt = new Date();
    await conv.save();

    const populated = await Message.findById(message._id).populate(
      "sender",
      "name profilePhoto photoURL",
    );

    res.status(201).json({ success: true, message: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/messages/users/search
router.get("/users/search", protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, users: [] });

    const query = {
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    };

    const users = await User.find(query)
      .select("name profilePhoto photoURL role companyName email")
      .limit(8);

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
