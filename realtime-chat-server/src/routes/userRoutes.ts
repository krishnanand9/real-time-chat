import { Router } from "express";
import { getStorage } from "../services/storage.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();

    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({
        message: "Username must contain 2-30 characters.",
      });
    }

    const storage = getStorage();
    const user = await storage.findOrCreateUser(username);

    return res.json({
      user: {
        id: user.id || user._id,
        username: user.username,
        online: user.online,
        lastSeen: user.lastSeen,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to login." });
  }
});

export default router;
