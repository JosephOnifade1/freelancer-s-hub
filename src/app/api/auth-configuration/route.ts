import {publicAuthConfiguration,localDevelopmentRequest} from "@/server/auth/public-configuration";
export const dynamic="force-dynamic";
export function GET(request:Request){
 const config=publicAuthConfiguration();
 // Only a local developer needs file-outbox implementation details.
 return Response.json({...config,emailDelivery:config.emailDelivery==="file"&&!localDevelopmentRequest(request)?"unavailable":config.emailDelivery},{headers:{"cache-control":"no-store"}});
}
