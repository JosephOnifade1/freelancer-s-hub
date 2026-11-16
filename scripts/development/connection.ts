import type {PoolClient} from "pg";
import {verifyDevelopmentConnection,type developmentTarget} from "../../src/server/auth/development-target";
/** pg Pool.verify is CALLBACK-based, not promise-based. Never hand out an
 * unchecked connection. Errors remain opaque and cause pg to discard the client. */
export function developmentConnectionVerifier(target:ReturnType<typeof developmentTarget>) {
  return (client:PoolClient,done:(error?:Error)=>void) => {
    void (async()=>{
      const result=await client.query("select current_database() as database,current_user as role,host(inet_server_addr()) as host");
      const stream=(client as unknown as {connection:{stream:{encrypted?:boolean;authorized?:boolean}}}).connection?.stream;
      verifyDevelopmentConnection(target,{...result.rows[0],tls:stream?.encrypted===true&&stream?.authorized===true});
    })().then(()=>done(),()=>done(Error("development_connection_refused")));
  };
}
