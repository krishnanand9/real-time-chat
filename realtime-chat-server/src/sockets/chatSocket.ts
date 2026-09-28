import type { Server } from "socket.io";
import { getStorage } from "../services/storage.js";

type SendMessagePayload = {
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
};

type UserPayload = {
  userId: string;
  username: string;
};

export function registerChatSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join Room
    socket.on("join_room", async ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (!roomId || !userId) return;

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;

      const storage = getStorage();
      await storage.updateUserStatus(userId, true);

      // Broadcast to others in the room that this user is online
      socket.to(roomId).emit("user_online", { userId });
      console.log(`👤 User ${userId} joined room ${roomId}`);
    });

    // Send Message
    socket.on(
      "send_message",
      async (payload: SendMessagePayload, callback?: (response: unknown) => void) => {
        try {
          const text = String(payload?.text || "").trim();

          if (!payload?.roomId || !payload?.senderId || !payload?.senderName || !text) {
            callback?.({ ok: false, message: "Invalid message payload." });
            return;
          }

          const storage = getStorage();
          const message = await storage.createMessage({
            roomId: payload.roomId,
            senderId: payload.senderId,
            senderName: payload.senderName,
            text,
          });

          // Broadcast to everyone in the room (including sender)
          io.to(payload.roomId).emit("receive_message", message);

          callback?.({
            ok: true,
            messageId: message._id,
          });
        } catch (error) {
          console.error("Socket send_message error:", error);
          callback?.({ ok: false, message: "Message could not be sent." });
        }
      }
    );

    // Typing Indicators
    socket.on("typing", ({ roomId, userId, username }: UserPayload & { roomId: string }) => {
      if (roomId && userId) {
        socket.to(roomId).emit("user_typing", { userId, username });
      }
    });

    socket.on("stop_typing", ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (roomId && userId) {
        socket.to(roomId).emit("user_stopped_typing", { userId });
      }
    });

    // Delivered & Read Receipts
    socket.on(
      "message_delivered",
      async ({
        messageId,
        userId,
        roomId,
      }: {
        messageId: string;
        userId: string;
        roomId: string;
      }) => {
        try {
          const storage = getStorage();
          await storage.markDelivered(messageId, userId);
          io.to(roomId).emit("message_status_updated", {
            messageId,
            status: "delivered",
            userId,
          });
        } catch (error) {
          console.error("Delivery update error:", error);
        }
      }
    );

    socket.on(
      "message_read",
      async ({
        messageId,
        userId,
        roomId,
      }: {
        messageId: string;
        userId: string;
        roomId: string;
      }) => {
        try {
          const storage = getStorage();
          await storage.markRead(messageId, userId);
          io.to(roomId).emit("message_status_updated", {
            messageId,
            status: "read",
            userId,
          });
        } catch (error) {
          console.error("Read update error:", error);
        }
      }
    );

    // Disconnect Handler
    socket.on("disconnect", async () => {
      const { userId, roomId } = socket.data;

      if (userId) {
        const storage = getStorage();
        await storage.updateUserStatus(userId, false);

        if (roomId) {
          socket.to(roomId).emit("user_offline", {
            userId,
            lastSeen: new Date().toISOString(),
          });
        }
      }

      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
}
