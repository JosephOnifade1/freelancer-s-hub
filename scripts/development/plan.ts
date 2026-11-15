import {requireDevelopmentTarget} from "../../src/server/auth/development";
// Explicit allowlist, child-to-parent. Never enumerate/drop schemas, migrations,
// provider buckets or arbitrary catalog tables. Catalog checks refuse unexpected FKs.
export const RESET_TABLES=["development_seed_identities","document_uploads","auth_sessions","auth_accounts","auth_verifications","auth_rate_limits","user_badges","reports","notifications","lead_pipeline","lead_applications","leads","saved_posts","post_attachments","poll_votes","poll_options","polls","votes","comments","posts","community_members","follows","communities","usernames","profiles","badges","auth_users"] as const;
export function approveReset(env:NodeJS.ProcessEnv,args:string[]){
 const target=requireDevelopmentTarget(env);
 if(env.BORYNX_ALLOW_DEV_RESET!=="true" || !args.includes("--apply") || !args.includes(`--confirm=${target.database}:DELETE-ALL-DEVELOPMENT-DATA`))throw Error("explicit_reset_approval_required");
 return target;
}
