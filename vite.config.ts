import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".e2b.app"],
    proxy: { "/api": { target: process.env.BORYNX_API_PROXY_TARGET || "http://127.0.0.1:3000", changeOrigin: false } },
    hmr: {
      overlay: false,
    },
  },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app"], proxy: { "/api": { target: process.env.BORYNX_API_PROXY_TARGET || "http://127.0.0.1:3000", changeOrigin: false } } },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Split the always-loaded vendor stack out of the entry chunk so no
        // single bundle exceeds ~500 kB and vendor code stays cached across
        // app deploys. Routes are already code-split via React.lazy.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase-vendor": ["@supabase/supabase-js"],
          "query-vendor": ["@tanstack/react-query"],
          "motion-vendor": ["framer-motion"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Phase 0.5: the frozen rollback snapshot has no App Router, so the
      // legacy build supplies the `next/*` surface it needs. The Next.js build
      // never resolves these — see src/legacy-next/next-navigation.ts.
      "next/navigation": path.resolve(__dirname, "./src/legacy-next/next-navigation.ts"),
      "next/link": path.resolve(__dirname, "./src/legacy-next/next-link.tsx"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
