import {developmentTarget} from "./development-target";
/** Compatibility projection used by local-browser demo gates and owner tools. */
export function requireDevelopmentTarget(env: NodeJS.ProcessEnv = process.env) {
  return {database:developmentTarget(env).database};
}
export function demoEnabled(env: NodeJS.ProcessEnv = process.env) {
  try { requireDevelopmentTarget(env);const url=new URL(env.BETTER_AUTH_URL??"");return env.BORYNX_ENABLE_DEMO_LOGIN==="true" && !!env.BORYNX_DEMO_PASSWORD && env.BORYNX_DEMO_PASSWORD.length>=20 && ["localhost","127.0.0.1","[::1]"].includes(url.hostname); }catch{return false;}
}
export function localDemoRequest(request:Request,env:NodeJS.ProcessEnv=process.env){
  try{return demoEnabled(env) && ["localhost","127.0.0.1","[::1]"].includes(new URL(request.url).hostname) && new URL(request.url).origin===new URL(env.BETTER_AUTH_URL!).origin;}catch{return false;}
}
export const DEMO_ACCOUNTS = [
  {key:"freelancer",name:"Demo Freelancer",email:"freelancer@borynx.test",username:"demo_freelancer",role:"member"},
  {key:"client",name:"Demo Client",email:"client@borynx.test",username:"demo_client",role:"member"},
  {key:"moderator",name:"Demo Moderator",email:"moderator@borynx.test",username:"demo_moderator",role:"moderator"},
  {key:"admin",name:"Demo Admin",email:"admin@borynx.test",username:"demo_admin",role:"admin"},
] as const;
