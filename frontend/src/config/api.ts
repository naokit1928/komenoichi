// src/config/api.ts

const apiBase = import.meta.env.VITE_API_BASE;

if (!apiBase) {
  throw new Error(
    "VITE_API_BASE is not defined. " +
    "Check .env (local) or Vercel Environment Variables."
  );
}

export const API_BASE: string = apiBase;
