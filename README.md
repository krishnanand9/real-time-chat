# Real-Time Chat Application

A production-ready full-stack real-time chat application built with **React Native (Web & Mobile)** on the frontend and **Node.js + Express + Socket.io** on the backend.

Includes instant bi-directional messaging, database persistence (with **built-in zero-config SQLite** and optional **MongoDB Atlas**), REST APIs, presence tracking, typing indicators, and message status receipts.

---

## 🌟 Key Features

### 1. Mandatory Requirements
- **Instant Real-Time Messaging**: Built exclusively using **Socket.io** (no polling or Firebase). Messages are delivered instantaneously to all room participants without page refresh.
- **Persistent Chat History**: Messages are stored durably. When refreshing or reopening the application, previous chat history is retrieved seamlessly via REST API.
- **Accurate Timestamps**: Every message displays cleanly formatted time indicators.
- **REST APIs**: Full Express REST endpoints for sending messages (`POST /api/messages`) and retrieving chat history (`GET /api/messages`).
- **Connection Lifecycle Management**: Graceful handling of socket connect, disconnect, and automatic reconnection with exponential backoff.

### 2. Bonus & Advanced Enhancements
- **Username-Based Authentication (Dummy Auth)**: Fast onboarding with username selection, session persistence using `AsyncStorage`.
- **Typing Indicator**: Real-time broadcast displaying when a participant is actively typing.
- **Online/Offline User Status**: Dynamic room presence indicator showing active participants.
- **Delivered & Read Receipts**: Dual-checkmark status badges (`✓` sent, `✓✓` delivered/read).
- **Dual Database Storage (SQLite + MongoDB)**:
  - **Zero-Config Persistent SQLite**: Runs instantly out of the box using Node's native SQLite engine (`./data/chat.db`) without requiring any external database installations!
  - **MongoDB Atlas Support**: Simply provide a `MONGO_URI` in `.env` to switch to MongoDB. If MongoDB is unavailable or times out, the server automatically and gracefully falls back to SQLite without crashing.
- **Cross-Platform Responsive UI**: Runs seamlessly on **Web browsers**, **Android**, and **iOS** via Expo and React Native Web.

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│              Client (React Native / Expo)              │
│       (Web Browser / iOS Simulator / Android / Phone)  │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
     REST API   │                        │  Socket.io (WebSockets)
  (History/Auth)│                        │  (Instant Real-Time Events)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│            Backend Server (Node.js + Express)          │
│                Socket.io Event Gateway                 │
└──────────────────────────┬─────────────────────────────┘
                           │
             Storage Abstraction Layer
          (Automatic Fallback & Detection)
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌──────────────────────┐   ┌───────────────────┐
   │ SQLite (Native Zero- │   │   MongoDB Atlas   │
   │  Config Persistence) │   │    (Optional)     │
   └──────────────────────┘   └───────────────────┘
```

---

## 📁 Project Structure

```text
REAL TIME CHAT/
├── package.json                   # Root workspace scripts
├── README.md                      # Comprehensive documentation
│
├── realtime-chat-server/          # Backend Server
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts              # Database connection & fallback logic
│   │   │   └── env.ts             # Typed environment configuration
│   │   ├── models/
│   │   │   ├── Message.ts         # Mongoose message schema
│   │   │   └── User.ts            # Mongoose user schema
│   │   ├── routes/
│   │   │   ├── messageRoutes.ts   # REST endpoints for messages & history
│   │   │   └── userRoutes.ts      # REST endpoint for dummy login
│   │   ├── services/
│   │   │   └── storage.ts         # Unified storage engine (SQLite + MongoDB)
│   │   ├── sockets/
│   │   │   └── chatSocket.ts      # Socket.io real-time event handlers
│   │   ├── app.ts                 # Express application & middleware setup
│   │   └── server.ts              # HTTP & Socket.io server bootstrap
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                       # Server environment variables
│   └── .env.example
│
└── realtime-chat-client/          # Frontend Client (React Native + Expo)
    ├── src/
    │   ├── services/
    │   │   ├── api.ts             # Axios HTTP client configuration
    │   │   └── socket.ts          # Socket.io client singleton
    │   └── types/
    │       └── index.ts           # Shared TypeScript interfaces
    ├── App.tsx                    # Main chat UI & real-time hooks
    ├── app.json                   # Expo application manifest
    ├── package.json
    ├── tsconfig.json
    ├── .env                       # Client environment variables
    └── .env.example
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v20+ or v24+ recommended)
- **npm** (v9+)

---

### Step 1: Run the Backend Server

Navigate to the server directory, install dependencies, and start the development server:

```bash
cd realtime-chat-server
npm install
npm run dev
```

The server will automatically start:
```text
⚡ Gracefully falling back to persistent SQLite database...
✅ SQLite database initialized successfully at: ./data/chat.db (Storage: SQLite)
🚀 Server running on http://localhost:5000
🔌 Socket.io ready on ws://localhost:5000
📡 Healthcheck available at http://localhost:5000/api/health
```

*(Optional: To build for production, run `npm run build && npm start`)*

---

### Step 2: Run the Frontend Client

In a new terminal window:

```bash
cd realtime-chat-client
npm install
```

#### Run in Web Browser (Recommended for quick testing):
```bash
npm run web
```
The application will launch automatically at **`http://localhost:8081`**. Open two browser tabs or private windows to test real-time chat between different users!

#### Run on Mobile (Android / iOS):
```bash
npm start
```
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Scan the QR code using the **Expo Go** app on your physical mobile phone (ensure your phone and computer are on the same Wi-Fi network and see [Mobile Configuration](#mobile-configuration)).

---

### Convenient Root Workspace Commands

From the root project directory, you can also run:
```bash
npm run server       # Starts the backend server
npm run client:web   # Launches the frontend on the web
npm run client       # Launches the Expo development menu
```

---

## ⚙️ Environment Variables

### Backend (`realtime-chat-server/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for Express & Socket.io server |
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |
| `DB_TYPE` | `auto` | Storage strategy: `auto` (tries Mongo, falls back to SQLite), `sqlite`, or `mongodb` |
| `SQLITE_PATH` | `./data/chat.db` | File path for persistent local SQLite database |
| `MONGO_URI` | `""` | Optional MongoDB Atlas connection string |
| `CLIENT_URL` | `*` | CORS allowed origin (`*` allows web and mobile) |
| `JWT_SECRET` | `development-secret` | Authentication secret key |

### Frontend (`realtime-chat-client/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:5000` | Base URL pointing to the running backend |

<a id="mobile-configuration"></a>
> [!TIP]
> **Testing on Physical Mobile Devices with Expo Go**:
> When using a physical phone, `localhost` refers to the mobile device itself. Change `EXPO_PUBLIC_API_URL` in `realtime-chat-client/.env` to your computer's local network IP:
> ```env
> EXPO_PUBLIC_API_URL=http://192.168.1.50:5000
> ```

---

## 📡 REST API Documentation

Base URL: `http://localhost:5000`

### 1. Healthcheck
- **`GET /api/health`**
- **Response `(200 OK)`**:
  ```json
  {
    "ok": true,
    "service": "realtime-chat-server",
    "storageType": "sqlite",
    "timestamp": "2026-09-28T09:00:00.000Z"
  }
  ```

### 2. User Login (Dummy Authentication)
- **`POST /api/users/login`**
- **Body**:
  ```json
  {
    "username": "Sarah"
  }
  ```
- **Response `(200 OK)`**:
  ```json
  {
    "user": {
      "id": "c15a8a89-7a67-4363-8601-ac22f1096f68",
      "username": "Sarah",
      "online": false,
      "lastSeen": "2026-09-28T09:00:00.000Z"
    }
  }
  ```

### 3. Fetch Chat History
- **`GET /api/messages/:roomId`** or **`GET /api/messages`**
- **Response `(200 OK)`**:
  ```json
  {
    "messages": [
      {
        "_id": "35ab220b-06bf-4c92-9734-e8d1c440f9d5",
        "roomId": "general",
        "senderId": "c15a8a89-7a67-4363-8601-ac22f1096f68",
        "senderName": "Sarah",
        "text": "Hello everyone!",
        "deliveredTo": ["alice-id"],
        "readBy": ["alice-id"],
        "createdAt": "2026-09-28T09:00:00.000Z",
        "updatedAt": "2026-09-28T09:00:00.000Z"
      }
    ]
  }
  ```

### 4. Send Message via REST
- **`POST /api/messages`**
- **Body**:
  ```json
  {
    "roomId": "general",
    "senderId": "c15a8a89-7a67-4363-8601-ac22f1096f68",
    "senderName": "Sarah",
    "text": "Sent via REST API"
  }
  ```
- *Note: Sending via REST automatically broadcasts `receive_message` to all connected Socket.io clients.*

### 5. Mark Delivered / Read
- **`PATCH /api/messages/:messageId/delivered`** (`{ "userId": "..." }`)
- **`PATCH /api/messages/:messageId/read`** (`{ "userId": "..." }`)

---

## 🔌 Socket.io Events Reference

### Client -> Server Events

| Event | Payload | Description |
| :--- | :--- | :--- |
| `join_room` | `{ roomId, userId }` | Joins a chat room and sets user online |
| `send_message` | `{ roomId, senderId, senderName, text }` | Sends message to room with acknowledgement callback |
| `typing` | `{ roomId, userId, username }` | Emits typing notification to room members |
| `stop_typing` | `{ roomId, userId }` | Emits stop-typing notification |
| `message_delivered` | `{ messageId, userId, roomId }` | Updates delivery receipt |
| `message_read` | `{ messageId, userId, roomId }` | Updates read receipt |

### Server -> Client Events

| Event | Payload | Description |
| :--- | :--- | :--- |
| `receive_message` | `ChatMessage` object | Broadcasts newly created message to room |
| `user_typing` | `{ userId, username }` | Informs room that a user is typing |
| `user_stopped_typing`| `{ userId }` | Informs room that user stopped typing |
| `user_online` | `{ userId }` | Informs room that user connected |
| `user_offline` | `{ userId, lastSeen }` | Informs room that user disconnected |
| `message_status_updated` | `{ messageId, status, userId }` | Broadcasts read/delivered update |

---

## 💡 Design Decisions & Assumptions

### 1. Dual Storage Engine (SQLite & MongoDB)
- **Zero-Friction Local Development**: A persistent SQLite store is embedded directly using Node's native SQLite capability (`node:sqlite`). This guarantees that anyone running `npm run dev` gets full message persistence across app restarts **without configuring a MongoDB cluster or Docker**.
- **MongoDB Compatibility**: When `MONGO_URI` is provided, the application connects to MongoDB. If connection times out or fails (e.g., DNS error, invalid credentials), it gracefully falls back to SQLite rather than crashing the process.

### 2. Real-Time vs REST Separation
- **Socket.io for Instant Messaging**: Real-time communication is handled entirely through Socket.io rooms for sub-millisecond broadcast.
- **REST for Initial State & Durability**: Initial history loading on client mount and app refreshes uses standard HTTP GET for reliability and cacheability.
- **Unified Event Dispatch**: Posting a message via the REST endpoint also broadcasts to the Socket.io room, keeping external integrations synchronized with real-time clients.

### 3. Frontend Architecture
- **React Native with Web Compatibility**: Uses Expo and React Native Web so the exact same codebase runs natively on Android/iOS and as a responsive web app in any browser.
- **Web Enhancements**: Added Enter-to-send support (Shift+Enter for newline) and a centered container layout on desktop web.
- **Optimistic Auto-Scroll**: New incoming messages automatically scroll the view to the latest bubble.

---

## ☁️ Deployment Guide

### Deploying the Backend on Render
1. Create a **Web Service** on [Render](https://render.com).
2. Connect your Git repository.
3. Configure settings:
   - **Root Directory**: `realtime-chat-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `*` (or your frontend domain)
   - `MONGO_URI`: Your MongoDB Atlas URI (or leave blank to use disk SQLite)
5. Copy the live API URL (e.g. `https://your-service.onrender.com`).

### Deploying on Railway
1. Create a new project on [Railway](https://railway.app).
2. Deploy from GitHub repository selecting the `realtime-chat-server` directory.
3. Railway automatically detects `npm run build` and `npm start`.
4. Update `EXPO_PUBLIC_API_URL` on the frontend with the deployed backend URL.
#   r e a l - t i m e - c h a t 
 
 