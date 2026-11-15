import "server-only";
import { getDatabase } from "@/server/db";
import { createBorynxAuth } from "./factory";
import { deliverAuthEmail } from "@/server/email";
let instance: ReturnType<typeof createBorynxAuth> | undefined;
/** Lazy initialization keeps unconfigured builds offline without a mock identity. */
export function getAuth() { return instance ??= createBorynxAuth(getDatabase(), deliverAuthEmail); }
