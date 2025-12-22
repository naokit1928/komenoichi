// frontend/src/config/api.ts

const rawApiBase = import.meta.env.VITE_API_BASE;

if (!rawApiBase) {
  throw new Error("VITE_API_BASE is not defined");
}

export const API_BASE = rawApiBase;

// DEV_MODE は boolean に正規化
export const DEV_MODE =
  import.meta.env.VITE_DEV_MODE === "1" ||
  import.meta.env.VITE_DEV_MODE === "true";
