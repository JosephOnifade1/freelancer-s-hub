import {randomUUID} from "node:crypto";
import {sql} from "drizzle-orm";
/** No application table names, TRUNCATE, persistent CREATE, or DROP statements.
 * Transaction-local TEMP state works with transaction pooling, unlike session
 * temp tables accessed through separate Pool.execute calls. Commit acknowledgement
 * is tested; this is not a persistent application-data durability/load test. */
export async function proveIsolatedTransaction(db){
 const table=sql.identifier(`borynx_phase2i_${randomUUID().replaceAll("-","")}`),marker=randomUUID();
 const rows=r=>Array.isArray(r)?r:r.rows;
 const requireProof=(condition)=>{if(!condition)throw new Error("isolated_transaction_proof_failed");};
 await db.transaction(async tx=>{
  await tx.execute(sql`create temporary table ${table} (id uuid primary key,value integer not null) on commit drop`);
  await tx.execute(sql`insert into ${table} (id,value) values (${marker},1)`);
  requireProof(Number(rows(await tx.execute(sql`select value from ${table} where id=${marker}`))[0]?.value)===1);
  await tx.execute(sql`update ${table} set value=2 where id=${marker}`);
  requireProof(Number(rows(await tx.execute(sql`select value from ${table} where id=${marker}`))[0]?.value)===2);
 });
 const rollback=new Error("controlled rollback");let rolledBack=false,transactionId=null;
 try{
  await db.transaction(async tx=>{
   await tx.execute(sql`create temporary table ${table} (id uuid primary key) on commit drop`);
   await tx.execute(sql`insert into ${table} (id) values (${marker})`);
   const result=rows(await tx.execute(sql`select pg_current_xact_id_if_assigned()::text as tid`));
   transactionId=result[0]?.tid??null;requireProof(!!transactionId);
   throw rollback;
  });
 }catch(error){if(error!==rollback)throw error;rolledBack=true;}
 requireProof(rolledBack);
 return {committed:true,rolledBack,transactionId};
}
