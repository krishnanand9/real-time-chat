import http from "http";
import { Server } from "socket.io";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { registerChatSocket } from "./sockets/chatSocket.js";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

// Provide io instance to Express app for REST route broadcasts
app.set("io", io);

registerChatSocket(io);

async function bootstrap() {
  try {
    await connectDatabase();

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log(`🔌 Socket.io ready on ws://localhost:${env.PORT}`);
      console.log(`📡 Healthcheck available at http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

bootstrap();