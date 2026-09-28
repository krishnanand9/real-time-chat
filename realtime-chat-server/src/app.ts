import express from "express";
import cors from "cors";

import userRoutes from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { getStorage } from "./services/storage.js";

export const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/api/health", (_req, res) => {
  const storage = getStorage();
  res.json({
    ok: true,
    service: "realtime-chat-server",
    storageType: storage.type,
    timestamp: new Date().toISOString(),
  });
});