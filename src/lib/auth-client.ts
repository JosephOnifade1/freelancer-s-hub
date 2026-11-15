import { createAuthClient } from "better-auth/react";
/** Same-origin API for both Next and the Vite /api proxy; no browser secret. */
const client = createAuthClient();
// Explicit session projection at the legacy non-strict UI boundary. The auth
// configuration/schema/client are independently checked with strictNullChecks.
export interface ClientSession { user: { id:string;email:string;emailVerified:boolean;name:string;image?:string|null }; session: { id:string;expiresAt:Date } }
export const authClient = client as Omit<typeof client, "useSession"> & { useSession: () => { data: ClientSession|null; isPending:boolean; error:unknown; refetch:()=>Promise<unknown> } };
export async function startGoogleSignIn(callbackURL: string) {
  return authClient.signIn.social({ provider: "google", callbackURL });
}
