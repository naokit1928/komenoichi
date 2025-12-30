import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // ★ これが無いと "@/xxx" が全部壊れる
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ★ FastAPI(:10000) に向ける proxy
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:10000",
        changeOrigin: true,
      },
    },
  },
});
