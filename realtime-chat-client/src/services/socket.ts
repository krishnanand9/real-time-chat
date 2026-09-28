import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const socketURL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(socketURL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    return connectSocket();
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}