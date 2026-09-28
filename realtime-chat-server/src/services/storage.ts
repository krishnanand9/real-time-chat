import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";

export interface ChatUser {
  id: string;
  _id: string;
  username: string;
  online: boolean;
  lastSeen: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ChatMessage {
  _id: string;
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  deliveredTo: string[];
  readBy: string[];
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface IStorage {
  readonly type: "mongodb" | "sqlite";
  findOrCreateUser(username: string): Promise<ChatUser>;
  updateUserStatus(userId: string, online: boolean): Promise<void>;
  getMessages(roomId: string, limit?: number): Promise<ChatMessage[]>;
  createMessage(payload: {
    roomId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<ChatMessage>;
  markDelivered(messageId: string, userId: string): Promise<ChatMessage | null>;
  markRead(messageId: string, userId: string): Promise<ChatMessage | null>;
}

export class SqliteStorage implements IStorage {
  public readonly type = "sqlite" as const;
  private db: DatabaseSync;

  constructor(dbPath: string) {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        online INTEGER DEFAULT 0,
        lastSeen TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        text TEXT NOT NULL,
        deliveredTo TEXT DEFAULT '[]',
        readBy TEXT DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(roomId, createdAt);
    `);
  }

  async findOrCreateUser(username: string): Promise<ChatUser> {
    const trimmed = username.trim();
    const selectStmt = this.db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE");
    const existing = selectStmt.get(trimmed) as any;

    if (existing) {
      return {
        id: existing.id,
        _id: existing.id,
        username: existing.username,
        online: Boolean(existing.online),
        lastSeen: existing.lastSeen,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const insertStmt = this.db.prepare(
      "INSERT INTO users (id, username, online, lastSeen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertStmt.run(id, trimmed, 0, now, now, now);

    return {
      id,
      _id: id,
      username: trimmed,
      online: false,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateUserStatus(userId: string, online: boolean): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      "UPDATE users SET online = ?, lastSeen = ?, updatedAt = ? WHERE id = ?"
    );
    stmt.run(online ? 1 : 0, now, now, userId);
  }

  async getMessages(roomId: string, limit = 200): Promise<ChatMessage[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM messages WHERE roomId = ? ORDER BY createdAt ASC LIMIT ?"
    );
    const rows = stmt.all(roomId, limit) as any[];

    return rows.map((row) => ({
      _id: row.id,
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      senderName: row.senderName,
      text: row.text,
      deliveredTo: JSON.parse(row.deliveredTo || "[]"),
      readBy: JSON.parse(row.readBy || "[]"),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createMessage(payload: {
    roomId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const deliveredTo = JSON.stringify([]);
    const readBy = JSON.stringify([]);

    const stmt = this.db.prepare(
      "INSERT INTO messages (id, roomId, senderId, senderName, text, deliveredTo, readBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      id,
      payload.roomId,
      payload.senderId,
      payload.senderName,
      payload.text,
      deliveredTo,
      readBy,
      now,
      now
    );

    return {
      _id: id,
      id,
      roomId: payload.roomId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      text: payload.text,
      deliveredTo: [],
      readBy: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async markDelivered(messageId: string, userId: string): Promise<ChatMessage | null> {
    const select = this.db.prepare("SELECT * FROM messages WHERE id = ?");
    const row = select.get(messageId) as any;
    if (!row) return null;

    const delivered: string[] = JSON.parse(row.deliveredTo || "[]");
    if (!delivered.includes(userId)) {
      delivered.push(userId);
      const update = this.db.prepare(
        "UPDATE messages SET deliveredTo = ?, updatedAt = ? WHERE id = ?"
      );
      update.run(JSON.stringify(delivered), new Date().toISOString(), messageId);
    }

    return {
      _id: row.id,
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      senderName: row.senderName,
      text: row.text,
      deliveredTo: delivered,
      readBy: JSON.parse(row.readBy || "[]"),
      createdAt: row.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  async markRead(messageId: string, userId: string): Promise<ChatMessage | null> {
    const select = this.db.prepare("SELECT * FROM messages WHERE id = ?");
    const row = select.get(messageId) as any;
    if (!row) return null;

    const read: string[] = JSON.parse(row.readBy || "[]");
    if (!read.includes(userId)) {
      read.push(userId);
      const update = this.db.prepare(
        "UPDATE messages SET readBy = ?, updatedAt = ? WHERE id = ?"
      );
      update.run(JSON.stringify(read), new Date().toISOString(), messageId);
    }

    return {
      _id: row.id,
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      senderName: row.senderName,
      text: row.text,
      deliveredTo: JSON.parse(row.deliveredTo || "[]"),
      readBy: read,
      createdAt: row.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
}

export class MongoStorage implements IStorage {
  public readonly type = "mongodb" as const;

  async findOrCreateUser(username: string): Promise<ChatUser> {
    const clean = username.trim();
    let user = await User.findOne({ username: clean });

    if (!user) {
      user = await User.create({
        username: clean,
        online: false,
        lastSeen: new Date(),
      });
    }

    return {
      id: user._id.toString(),
      _id: user._id.toString(),
      username: user.username,
      online: user.online,
      lastSeen: user.lastSeen,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }

  async updateUserStatus(userId: string, online: boolean): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        online,
        lastSeen: new Date(),
      });
    } catch (err) {
      console.error("Mongo updateUserStatus error:", err);
    }
  }

  async getMessages(roomId: string, limit = 200): Promise<ChatMessage[]> {
    const docs = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return docs.map((doc: any) => ({
      _id: doc._id.toString(),
      id: doc._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      text: doc.text,
      deliveredTo: doc.deliveredTo || [],
      readBy: doc.readBy || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async createMessage(payload: {
    roomId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<ChatMessage> {
    const doc = await Message.create({
      roomId: payload.roomId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      text: payload.text,
    });

    return {
      _id: doc._id.toString(),
      id: doc._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      text: doc.text,
      deliveredTo: doc.deliveredTo || [],
      readBy: doc.readBy || [],
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }

  async markDelivered(messageId: string, userId: string): Promise<ChatMessage | null> {
    const doc = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { deliveredTo: userId } },
      { new: true }
    ).lean();

    if (!doc) return null;

    return {
      _id: (doc as any)._id.toString(),
      id: (doc as any)._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      text: doc.text,
      deliveredTo: doc.deliveredTo || [],
      readBy: doc.readBy || [],
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }

  async markRead(messageId: string, userId: string): Promise<ChatMessage | null> {
    const doc = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId } },
      { new: true }
    ).lean();

    if (!doc) return null;

    return {
      _id: (doc as any)._id.toString(),
      id: (doc as any)._id.toString(),
      roomId: doc.roomId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      text: doc.text,
      deliveredTo: doc.deliveredTo || [],
      readBy: doc.readBy || [],
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }
}

// Global storage singleton, initialized on startup in db.ts
let activeStorage: IStorage = new SqliteStorage("./data/chat.db");

export function setStorage(storage: IStorage) {
  activeStorage = storage;
}

export function getStorage(): IStorage {
  return activeStorage;
}
