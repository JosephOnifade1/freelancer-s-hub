import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mirrors vite.config.ts: tests render the React Router runtime, so app
      // code that imports `next/navigation` gets the legacy shim.
      "next/navigation": path.resolve(__dirname, "./src/legacy-next/next-navigation.ts"),
      "next/link": path.resolve(__dirname, "./src/legacy-next/next-link.tsx"),
    },
  },
});
