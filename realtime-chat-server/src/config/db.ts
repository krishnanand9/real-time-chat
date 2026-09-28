import mongoose from "mongoose";
import dns from "dns";
import { env } from "./env.js";

// Use public DNS servers for MongoDB Atlas SRV resolution
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const connectDatabase = async (): Promise<void> => {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from .env");
  }

  try {
    console.log("Attempting to connect to MongoDB...");

    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    throw error;
  }
};