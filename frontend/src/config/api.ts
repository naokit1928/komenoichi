// frontend/src/config/api.ts

export const API_BASE = (() => {
  const v = import.meta.env.VITE_API_BASE;
  if (!v) {
    throw new Error("VITE_API_BASE is not defined");
  }
  return v;
})();

export const DEV_MODE = import.meta.env.VITE_DEV_MODE === "1";
