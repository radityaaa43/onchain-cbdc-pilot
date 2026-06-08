import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["__tests__/setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
