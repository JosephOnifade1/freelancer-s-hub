import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Runtime proof for the Neon + Drizzle driver stack (Phase 2B.1).
 *
 * Deliberately separate from `vitest.config.ts`:
 *
 *  - **Node environment.** `src/server/db/index.ts` imports `next/headers`, the
 *    server-only guard. jsdom cannot resolve it; Node can.
 *  - **No jsdom setup file.** The browser test setup does not apply here.
 *  - **Not part of `npm test`.** The default suite must stay hermetic and
 *    credential-free; this one needs a real `DATABASE_URL`.
 *
 * Run with `npm run test:db`. If `DATABASE_URL` is unset the connection tests
 * skip themselves and only the environment-handling assertions run.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // The pool is process-wide; parallel files would race on the advisory lock.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` is a React Server Components marker. Under Next it
      // resolves to a no-op for server compilations and to a throwing module for
      // client ones; outside Next (Vitest/Vite) it would resolve to the throwing
      // module and break any import of `src/server/db`. Its own `empty.js` entry
      // is the sanctioned no-op, so alias to that. The build-time boundary is
      // still enforced by `next/headers` and by Next's own aliasing.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
