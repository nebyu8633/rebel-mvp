import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the static build works from a Capacitor webDir (file/capacitor:// origin).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", chunkSizeWarningLimit: 2500 },
  server: { host: true, port: 5180 },
  preview: { host: true, port: 5181 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
} as never);
