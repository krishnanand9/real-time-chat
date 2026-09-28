import { Router } from "express";
import { getStorage } from "../services/storage.js";
import type { Server } from "socket.io";

const router = Router();

// Fetch chat history: GET /api/messages or GET /api/messages/:roomId
router.get(["/", "/:roomId"], async (req, res) => {
  try {
    const roomId = String(req.params.roomId || req.query.roomId || "general");
    const limit = Number(req.query.limit) || 200;

    const storage = getStorage();
    const messages = await storage.getMessages(roomId, limit);

    return res.json({ messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return res.status(500).json({ message: "Unable to fetch chat history." });
  }
});

// Send message via REST: POST /api/messages
router.post("/", async (req, res) => {
  try {
    const { roomId = "general", senderId, senderName, text } = req.body || {};

    if (!senderId || !senderName || !String(text || "").trim()) {
      return res.status(400).json({
        message: "senderId, senderName, and non-empty text are required.",
      });
    }

    const storage = getStorage();
    const message = await storage.createMessage({
      roomId: String(roomId),
      senderId: String(senderId),
      senderName: String(senderName),
      text: String(text).trim(),
    });

    // Real-time broadcast to socket room if socket server is attached to express app
    const io: Server | undefined = req.app.get("io");
    if (io) {
      io.to(String(roomId)).emit("receive_message", message);
    }

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Create message error:", error);
    return res.status(500).json({ message: "Unable to send message." });
  }
});

// Update delivery status: PATCH /api/messages/:messageId/delivered
router.patch("/:messageId/delivered", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId) return res.status(400).json({ message: "userId is required." });

    const storage = getStorage();
    const message = await storage.markDelivered(req.params.messageId, userId);

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const io: Server | undefined = req.app.get("io");
    if (io) {
      io.to(message.roomId).emit("message_status_updated", {
        messageId: message._id,
        status: "delivered",
        userId,
      });
    }

    return res.json({ message });
  } catch (error) {
    console.error("Delivery status error:", error);
    return res.status(500).json({ message: "Unable to update delivery status." });
  }
});

// Update read status: PATCH /api/messages/:messageId/read
router.patch("/:messageId/read", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId) return res.status(400).json({ message: "userId is required." });

    const storage = getStorage();
    const message = await storage.markRead(req.params.messageId, userId);

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const io: Server | undefined = req.app.get("io");
    if (io) {
      io.to(message.roomId).emit("message_status_updated", {
        messageId: message._id,
        status: "read",
        userId,
      });
    }

    return res.json({ message });
  } catch (error) {
    console.error("Read status error:", error);
    return res.status(500).json({ message: "Unable to update read status." });
  }
});

export default router;
