import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {readFileSync,readdirSync} from "node:fs";
export async function securityFixture(){
 const engine=new PGlite();const db=drizzle(engine);
 for(const name of readdirSync("src/server/db/migrations").filter(n=>/^\d+.*\.sql$/.test(n)).sort())await engine.exec(readFileSync("src/server/db/migrations/"+name,"utf8"));
 return {engine,db};
}
