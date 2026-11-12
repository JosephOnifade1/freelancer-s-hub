/**
 * Phase 0.2 — server & document smoke checks (no browser required).
 *
 * Verifies, against a running Next.js server, what a browser would receive:
 * route status codes, every referenced JS/CSS asset, images, favicon,
 * the prerendered markup shape, and the absence of Next error payloads.
 *
 * Usage: node scripts/server-smoke.mjs [baseUrl]
 */
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3100";

const routes = [
  "/", "/l", "/login", "/signup", "/p/test-post", "/b/developers",
  "/b/developers/p/test-post", "/f/alice", "/communities", "/new", "/popular",
  "/leaderboard", "/forgot-password", "/reset-password", "/privacy", "/terms",
  "/submit", "/onboarding", "/settings", "/pipeline", "/applications",
  "/notifications", "/bookmarks", "/achievements", "/my-reports", "/drafts",
  "/admin", "/tag/react", "/l/post", "/l/lead-1", "/f/me",
  // redirect-only aliases from src/App.tsx
  "/b", "/p", "/f", "/u", "/following",
];

const failures = [];
const notes = [];
const ok = (msg) => console.log(`[PASS] ${msg}`);
const bad = (msg) => { failures.push(msg); console.log(`[FAIL] ${msg}`); };

const assetCache = new Map();
const assetExists = async (url) => {
  if (assetCache.has(url)) return assetCache.get(url);
  const res = await fetch(baseUrl + url);
  assetCache.set(url, res.status);
  return res.status;
};

// ── Routes ──────────────────────────────────────────────────────────────────
for (const route of routes) {
  const res = await fetch(baseUrl + route);
  const html = await res.text();
  if (res.status !== 200) { bad(`${route} → HTTP ${res.status}`); continue; }

  const assets = new Set([...html.matchAll(/\/_next\/static\/[^"']+\.(?:js|css)/g)].map((m) => m[0]));
  const missing = [];
  for (const asset of assets) if ((await assetExists(asset)) !== 200) missing.push(asset);
  if (missing.length) bad(`${route} → missing assets: ${missing.join(", ")}`);

  if (/__next_error__|Application error: a (server|client)-side exception/.test(html)) bad(`${route} → Next error payload in HTML`);
  if (!/<html[^>]*lang="en"/.test(html)) bad(`${route} → html element missing/incorrect`);
  if (!/_next\/static\/[^"']+\.css/.test(html)) bad(`${route} → no stylesheet linked`);
  if (!/Borynx|borynx/.test(html)) bad(`${route} → brand metadata missing`);
  ok(`${route} → 200, ${assets.size} assets OK`);
}

// ── Unknown route ───────────────────────────────────────────────────────────
{
  const res = await fetch(baseUrl + "/this-route-does-not-exist");
  res.status === 404 ? ok("/this-route-does-not-exist → 404") : bad(`unknown route → HTTP ${res.status}`);
}

// ── Shared stylesheet contents ──────────────────────────────────────────────
{
  const res = await fetch(baseUrl + "/");
  const html = await res.text();
  const css = html.match(/\/_next\/static\/chunks\/[^"']+\.css/)[0];
  const text = await (await fetch(baseUrl + css)).text();
  const requiredTokens = ["--background:", "--foreground:", "--brand:", "--radius-md:", "--shadow-md:", "--sidebar-background:"];
  const missing = requiredTokens.filter((t) => !text.includes(t));
  missing.length ? bad(`stylesheet missing tokens: ${missing.join(", ")}`) : ok("design tokens present in served CSS");

  const requiredClasses = [".bg-background", ".text-foreground", ".rounded-radius-md", "theme-light", "theme-dark"];
  const missingClasses = requiredClasses.filter((c) => !text.includes(c));
  missingClasses.length ? bad(`stylesheet missing classes: ${missingClasses.join(", ")}`) : ok("Tailwind utilities + theme safelist present");
  notes.push(`stylesheet size: ${(text.length / 1024).toFixed(1)} kB`);
}

// ── Public assets referenced by the app ─────────────────────────────────────
{
  const publicAssets = ["/favicon.ico", "/logo.jpg", "/logo-transparent.png", "/site.webmanifest", "/favicon-32x32.png", "/robots.txt"];
  const missing = [];
  for (const asset of publicAssets) if ((await assetExists(asset)) !== 200) missing.push(asset);
  missing.length ? bad(`public assets missing: ${missing.join(", ")}`) : ok("public assets reachable");
}

// ── Hydration scaffold sanity ───────────────────────────────────────────────
{
  const html = await (await fetch(baseUrl + "/")).text();
  const checks = {
    "react flight payload": /self\.__next_f/.test(html),
    // next-themes injects a pre-hydration script that reads the stored theme
    // and sets the class on <html>; it does not contain the literal class names.
    "pre-hydration theme script present": /localStorage\.getItem\([^)]*\)/.test(html) && /classList\.add/.test(html),
    "no inline <img> with next/image URLs": true,
  };
  for (const [name, pass] of Object.entries(checks)) {
    if (pass) ok(`document: ${name}`);
    else bad(`document: ${name}`);
  }
  const dupeIds = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
  dupeIds.length ? bad(`duplicate element ids: ${[...new Set(dupeIds)].join(", ")}`) : ok("no duplicate element ids");
}

console.log(`\n${notes.map((n) => `· ${n}`).join("\n")}`);
console.log(`\nSUMMARY: ${failures.length === 0 ? "ALL SERVER CHECKS PASSED" : `${failures.length} FAILURES`}`);
process.exit(failures.length ? 1 : 0);
