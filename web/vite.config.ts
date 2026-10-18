/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento e no preview, /api é encaminhado para a API Java.
// Em produção com outro domínio, defina VITE_API_URL e libere a origem
// em AQUAML_CORS_ORIGINS no Java.
const api = process.env.AQUAML_API ?? "http://localhost:7070";
const proxy = { "/api": { target: api, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: { motion: ["motion/react"], d3: ["d3-scale", "d3-shape", "d3-array"] },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
