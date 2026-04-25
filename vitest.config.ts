import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only-shim.ts"),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "./tests/mocks/server-only-shim.ts"),
          },
        },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          environment: "happy-dom",
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "./tests/mocks/server-only-shim.ts"),
          },
        },
        test: {
          name: "integration",
          include: ["src/**/*.test.tsx", "tests/integration/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          setupFiles: ["./tests/setup.ts", "./tests/mocks/setup.ts"],
        },
      },
    ],
  },
});
