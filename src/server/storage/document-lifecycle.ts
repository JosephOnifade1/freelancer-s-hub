import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {documentKey,requireDocumentKey,DOCUMENT_MIMES} from "./document-key";
import {createAttachment,type AttachmentInput,type ContentTransactionDatabase} from "../features/content/content-queries";
import type {ContentViewer} from "../features/content/authorization";
export type DocumentDatabase=ContentTransactionDatabase;
function rows<T>(r:unknown):T[]{return (r as {rows:T[]}).rows;}
interface Intent {path:string;actor:string;post_id:string;bucket:string;size:number;mime:string;state:string;expires_at:Date;attachment_id:string|null}
async function locked(db:{execute:DocumentDatabase["execute"]},path:string){return rows<Intent>(await db.execute(sql`select * from public.document_uploads where path=${path} for update`))[0];}
/** Persist intent before the external operation; serialize the upload with cleanup.
 * A crash leaves an expiring intent, not an untracked key. Upload never uses upsert. */
export async function uploadPrivateDocument(db:DocumentDatabase,actor:string,post:string,extension:keyof typeof DOCUMENT_MIMES,size:number,upload:(path:string)=>Promise<void>){
 const path=`${actor}/${post}/${randomUUID()}.${extension}`;requireDocumentKey(path,actor,post);
 await db.transaction(async tx=>{
  const owned=rows(await tx.execute(sql`select id from public.posts where id=${post} and "authorUid"=${actor} and "isDeleted"=false for update`));
  if(!owned.length)throw Error("document_post_not_owned");
  await tx.execute(sql`insert into public.document_uploads(path,actor,post_id,size,mime,expires_at) values(${path},${actor},${post},${size},${DOCUMENT_MIMES[extension]},now()+interval '15 minutes')`);
 });
 const success=await db.transaction(async tx=>{
  const intent=await locked(tx,path);
  if(!intent||intent.state!=="uploading"||new Date(intent.expires_at).getTime()<=Date.now())return false;
  try{await upload(path);}catch{await tx.execute(sql`update public.document_uploads set state='delete_pending' where path=${path}`);return false;}
  await tx.execute(sql`update public.document_uploads set state='ready' where path=${path}`);return true;
 });
 if(!success)throw Error("document_upload_unconfirmed");return path;
}
export async function registerPrivateDocument(db:DocumentDatabase,viewer:ContentViewer,post:string,input:AttachmentInput,verify:(path:string,size:number,mime:string,actor:string,post:string)=>Promise<boolean>){
 if(!viewer.uid||!documentKey(input.storagePath,viewer.uid,post))return {status:"invalid" as const};
 return db.transaction(async tx=>{
  const intent=await locked(tx,input.storagePath);
  if(!intent||intent.actor!==viewer.uid||intent.post_id!==post||intent.bucket!=="post-documents"||intent.state!=="ready"||new Date(intent.expires_at).getTime()<=Date.now()||intent.size!==input.fileSize||intent.mime!==input.mimeType)return {status:"invalid" as const};
  if(!await verify(intent.path,intent.size,intent.mime,intent.actor,intent.post_id))return {status:"invalid" as const};
  // Reuse existing post ownership/visibility/count transaction in this SAME transaction.
  const result=await createAttachment({execute:tx.execute.bind(tx),transaction:run=>run(tx)},viewer,post,input);
  if(result.status==="created")await tx.execute(sql`update public.document_uploads set state='registered',attachment_id=${result.attachment.id} where path=${intent.path}`);
  return result;
 });
}
/** Metadata removal and durable delete authorization commit together. Old canonical
 * attachments may be retired, but never adopted as fresh upload intents. */
export async function requestAttachmentDeletion(db:DocumentDatabase,actor:string,id:string){
 return db.transaction(async tx=>{
  const row=rows<{storagePath:string;postId:string;uploaderUid:string;fileSize:number;mimeType:string}>(await tx.execute(sql`select * from public.post_attachments where id=${id} and "uploaderUid"=${actor}`))[0];
  if(!row){const retry=rows<Intent>(await tx.execute(sql`select * from public.document_uploads where attachment_id=${id} and actor=${actor} and state in ('delete_pending','deleted')`))[0];return retry?{status:"removed" as const,path:retry.path}:{status:"not_found" as const};}
  requireDocumentKey(row.storagePath,actor,row.postId);
  await tx.execute(sql`insert into public.document_uploads(path,actor,post_id,size,mime,state,expires_at,attachment_id) values(${row.storagePath},${actor},${row.postId},${row.fileSize},${row.mimeType},'registered',now(),${id}) on conflict(path) do nothing`);
  const intent=await locked(tx,row.storagePath);
  if(!intent||intent.actor!==actor||intent.post_id!==row.postId||intent.state!=="registered")return {status:"not_found" as const};
  await tx.execute(sql`delete from public.post_attachments where id=${id} and "uploaderUid"=${actor}`);
  await tx.execute(sql`update public.document_uploads set state='delete_pending',attachment_id=${id} where path=${row.storagePath}`);
  return {status:"removed" as const,path:row.storagePath};
 });
}
/** Row lock spans reference check AND provider delete. Registration takes the same
 * lock and only accepts ready; pending/deleted are irreversible tombstones. */
export async function cleanupPrivateDocument(db:DocumentDatabase,actor:string,path:string,remove:(path:string,actor:string,post:string)=>Promise<void>){
 const key=documentKey(path,actor);if(!key)return {status:"forbidden" as const};
 // Persist permission before external I/O so a crash/provider failure is retryable.
 const permitted=await db.transaction(async tx=>{
  const intent=await locked(tx,path);
  if(!intent||intent.actor!==actor||intent.post_id!==key.post||intent.bucket!=="post-documents")return false;
  if(rows(await tx.execute(sql`select id from public.post_attachments where "storagePath"=${path} limit 1`)).length)return false;
  if(intent.state==="registered"||(intent.state==="uploading"&&new Date(intent.expires_at).getTime()>Date.now()))return false;
  if(intent.state!=="deleted")await tx.execute(sql`update public.document_uploads set state='delete_pending' where path=${path}`);return true;
 });
 if(!permitted)return {status:"conflict" as const};
 try{return await db.transaction(async tx=>{
  const intent=await locked(tx,path);if(!intent||!["delete_pending","deleted"].includes(intent.state))return {status:"conflict" as const};
  if(rows(await tx.execute(sql`select id from public.post_attachments where "storagePath"=${path} limit 1`)).length)return {status:"conflict" as const};
  if(intent.state==="deleted")return {status:"removed" as const};
  requireDocumentKey(path,actor,intent.post_id);await remove(path,actor,intent.post_id);
  await tx.execute(sql`update public.document_uploads set state='deleted' where path=${path}`);return {status:"removed" as const};
 });}catch{return {status:"pending" as const};}
}
