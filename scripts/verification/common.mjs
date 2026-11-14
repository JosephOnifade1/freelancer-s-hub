export class VerificationFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function insist(condition, code) { if (!condition) throw new VerificationFailure(code); }
/** Always pin output to our own codes, never provider message/stack/URL/SQL/params. */
export async function runSafely(operation, output = console.log) {
  try { await operation(); return 0; }
  catch (error) {
    const code = error instanceof VerificationFailure && /^[A-Z_]+$/.test(error.code) ? error.code : "OPERATION_FAILED";
    output(`FAIL ${code}. See the verification guide; provider details are intentionally suppressed.`);
    return 1;
  }
}
export function parseArguments(args) {
  const [command, ...rest] = args;
  const options = {};
  const switches = new Set(["apply", "allow-write"]), values = new Set(["env-file", "bucket", "prefix"]);
  for (let i = 0; i < rest.length; i++) {
    insist(rest[i].startsWith("--"), "INVALID_ARGUMENTS");
    const name = rest[i].slice(2);
    insist(!Object.hasOwn(options, name), "INVALID_ARGUMENTS");
    if (switches.has(name)) options[name] = true;
    else {
      insist(values.has(name) && rest[i + 1] && !rest[i + 1].startsWith("--"), "INVALID_ARGUMENTS");
      options[name] = rest[++i];
    }
  }
  const allowed = { env: [], bundle: [], neon: [], migrations: [], migrate: ["apply"], transaction: ["allow-write"], auth: [], storage: ["allow-write", "bucket", "prefix"] };
  insist(Object.hasOwn(allowed, command), "INVALID_COMMAND");
  insist(Object.keys(options).every(k => k === "env-file" || allowed[command].includes(k)), "INVALID_ARGUMENTS");
  return { command, options };
}
