export function localDevelopmentRequest(request:Request,env:NodeJS.ProcessEnv=process.env){
 try{
  const hostname=new URL(request.url).hostname;
  const host=request.headers?.get("x-forwarded-host")?.split(":")[0]||request.headers?.get("host")?.split(":")[0]||hostname;
  return env.NODE_ENV==="development"&&(["localhost","127.0.0.1","[::1]","0.0.0.0"].includes(hostname)||["localhost","127.0.0.1","[::1]"].includes(host));
 }catch{return false;}
}
/** Configuration only: never sends mail, creates users, or exposes credentials. */
export function publicAuthConfiguration(env:NodeJS.ProcessEnv=process.env){
 let local=false;try{local=env.NODE_ENV==="development"&&env.BORYNX_ENVIRONMENT==="development"&&["localhost","127.0.0.1","[::1]"].includes(new URL(env.BETTER_AUTH_URL??"").hostname);}catch{/* invalid config */}
 const file=env.EMAIL_DELIVERY_MODE==="file"&&local;
 let gateway=false;try{const url=new URL(env.EMAIL_GATEWAY_URL??"");gateway=env.EMAIL_DELIVERY_MODE==="gateway"&&!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM&&url.protocol==="https:"&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{/* disabled */}
 return {emailDelivery:file?"file" as const:gateway?"email" as const:"unavailable" as const};
}
