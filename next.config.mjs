import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The React Router compatibility adapter. The Vite build imports
// `react-router-dom` directly; the Next build resolves that specifier to this
// file so every existing component keeps working unchanged.
const routerAdapter = path.resolve(__dirname, "src/lib/navigation.tsx");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["lucide-react"],
  // Next.js 16 removed `eslint.ignoreDuringBuilds` (and `next lint`). Linting is
  // run separately via `npm run lint`. Type-checking still runs in `next build`.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pczwlhnkxajrykibavbi.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
  // Next.js 16 uses Turbopack by default. Preview/dev hosts and LAN hosts must
  // be allowed explicitly for `next dev` to serve requests from them.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.arena.ai",
    "localhost",
    "127.0.0.1",
  ],
  // Turbopack equivalent of the webpack alias below.
  turbopack: {
    resolveAlias: {
      "react-router-dom": "./src/lib/navigation.tsx",
    },
  },
  // Kept so `next dev --webpack` / `next build --webpack` remain a rollback
  // path. Turbopack builds ignore this function entirely.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-router-dom": routerAdapter,
    };
    return config;
  },
};

export default nextConfig;
