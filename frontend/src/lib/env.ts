// src/lib/env.ts
export const API_BASE = (() => {
  const url = (import.meta as any).env?.VITE_API_BASE_URL;

  if (!url) {
    throw new Error(
      "VITE_API_BASE_URL is not defined. Set it in Vercel Environment Variables."
    );
  }

  return url;
})();

