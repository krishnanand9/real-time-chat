import axios from "axios";
import type { User } from "../types";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function setApiUser(_user: User) {
  // Reserved for future JWT authentication.
}