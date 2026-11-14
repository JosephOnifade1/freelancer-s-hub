#!/usr/bin/env node
// Node >=22.6 with --experimental-strip-types; no shell tracing or env auto-loading.
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { VARIABLES, inspectEnvironment, environmentOkay } from "./environment.mjs";
import { insist, parseArguments, runSafely } from "./common.mjs";
import { withPool, verifyConnection, inspectMigrations, applyMigrations, verifyTransaction } from "./neon.mjs";
import { verifyBrowserBundles } from "./bundles.mjs";
import { verifyAuth, verifyStorage } from "./providers.mjs";

const exitCode = await runSafely(async () => {
  const { command, options } = parseArguments(process.argv.slice(2));
  let file = {};
  if (options["env-file"]) file = parse(readFileSync(options["env-file"]));
  // Explicit file overrides shell for allowlisted variables only, matching the
  // operator's chosen target. No complete env serialization or automatic .env reads.
  const env = Object.fromEntries(VARIABLES.map(([name]) => [name, Object.hasOwn(file,name) ? file[name] : process.env[name]]));
  const rows = inspectEnvironment(env);
  if (command === "env") {
    for (const r of rows) console.log(`${r.name}: ${r.state} [${r.required ? "required" : "optional"}] - ${r.purpose}`);
    insist(environmentOkay(rows), "ENVIRONMENT_PREFLIGHT_FAILED");
    console.log("PASS ENVIRONMENT_FORMATS (offline only; no provider contacted)");
    return;
  }
  if(command === "bundle")return verifyBrowserBundles(env,console.log);
  const needed = ["neon","migrations","migrate","transaction"].includes(command) ? ["DATABASE_URL"] : ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY", ...(command === "storage" ? ["SUPABASE_SERVICE_ROLE_KEY"] : [])];
  insist(rows.filter(r => needed.includes(r.name) || needed.includes("DATABASE_URL") && ["DATABASE_POOL_MAX","DATABASE_SSL_CA"].includes(r.name)).every(r => r.state === "PRESENT" || !r.required && r.state === "MISSING"), "COMMAND_CONFIGURATION_INVALID");
  // Refuse missing mutation consent BEFORE constructing any provider client.
  if (command === "migrate") insist(options.apply === true, "EXPLICIT_APPLY_REQUIRED");
  if (["transaction","storage"].includes(command)) insist(options["allow-write"] === true, "EXPLICIT_WRITE_REQUIRED");
  if (command === "auth") return verifyAuth(env, console.log);
  if (command === "storage") return verifyStorage(env, options, console.log);
  await withPool(env, async (pool, settings) => {
    await verifyConnection(pool, settings, console.log);
    if (command === "migrations") await inspectMigrations(pool, console.log);
    if (command === "migrate") await applyMigrations(pool, options.apply, console.log);
    if (command === "transaction") await verifyTransaction(drizzle(pool), options["allow-write"], console.log);
  });
});
process.exitCode = exitCode;
