import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  MONGO_URI: process.env.MONGO_URI ?? "",
  CLIENT_URL: process.env.CLIENT_URL ?? "*",
  DB_TYPE: (process.env.DB_TYPE ?? "auto").toLowerCase(),
  SQLITE_PATH: process.env.SQLITE_PATH ?? "./data/chat.db",
  JWT_SECRET: process.env.JWT_SECRET ?? "development-secret",
};