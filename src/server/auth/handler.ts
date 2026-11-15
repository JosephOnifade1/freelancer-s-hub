import {trustedMutation} from "./config";
/** Explicit app-origin enforcement also covers anonymous sign-up. OAuth GET
 * callbacks continue to use Better Auth's state/nonce validation. */
export function guardedAuthHandler(handler:(request:Request)=>Promise<Response>,env:NodeJS.ProcessEnv=process.env){
 return async(request:Request)=>{
  if(!["GET","HEAD"].includes(request.method)&&!trustedMutation(request,env))return Response.json({error:"untrusted_origin"},{status:403});
  return handler(request);
 };
}
