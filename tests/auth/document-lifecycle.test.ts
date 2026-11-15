import {beforeAll,afterAll,it,describe,expect,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
import {documentCapability} from "../../src/server/storage/document-capability";
import {sql} from "drizzle-orm";
import {securityFixture} from "./security-fixture";
import {provisionProfile} from "../../src/server/features/identity/provision-profile";
import {registerPrivateDocument,uploadPrivateDocument,cleanupPrivateDocument,requestAttachmentDeletion} from "../../src/server/storage/document-lifecycle";
import {anonymousViewer} from "../../src/server/features/content/authorization";
let fixture:Awaited<ReturnType<typeof securityFixture>>;
let actor:string,victim:string,post:string,victimPost:string;
const verifier=vi.fn(async()=>true),remove=vi.fn(async()=>{});
beforeAll(async()=>{
 fixture=await securityFixture();
 const users=[] as string[];
 for(const name of ["actor","victim"]){const uid=crypto.randomUUID();await fixture.db.execute(sql`insert into auth_users(id,name,email,email_verified) values(${uid},${name},${name+"@fixture.test"},true)`);await provisionProfile(fixture.db,{uid,displayName:name});users.push(uid);}
 [actor,victim]=users;post=crypto.randomUUID();victimPost=crypto.randomUUID();
 for(const [id,uid] of [[post,actor],[victimPost,victim]])await fixture.db.execute(sql`insert into posts(id,title,body,type,"authorUid") values(${id},'fixture','body','resource',${uid})`);
});
afterAll(async()=>fixture.engine.close());
const viewer=(uid=actor)=>({...anonymousViewer(),uid});
const input=(path:string)=>({storagePath:path,fileName:"file.pdf",fileSize:4,mimeType:"application/pdf"});
const upload=()=>uploadPrivateDocument(fixture.db,actor,post,"pdf",4,async()=>{});
const register=(path:string)=>registerPrivateDocument(fixture.db,viewer(),post,input(path),verifier);
describe("persisted upload intent and private registration (embedded PostgreSQL)",()=>{
 it("server issues exact actor/post/key/size/mime/expiry and consumes once",async()=>{
  const path=await upload();const row=(await fixture.engine.query<{expires_at:string}>("select * from document_uploads where path=$1",[path])).rows[0];
  expect(row).toMatchObject({actor,post_id:post,bucket:"post-documents",size:4,mime:"application/pdf",state:"ready"});expect(new Date(String(row.expires_at)).getTime()).toBeGreaterThan(Date.now());
  expect((await register(path)).status).toBe("created");expect((await register(path)).status).toBe("invalid");
 });
 it("victim path, traversal alias and valid-looking unissued object cannot be registered",async()=>{
  const path=await uploadPrivateDocument(fixture.db,victim,victimPost,"pdf",4,async()=>{});verifier.mockClear();
  for(const forged of [path,`${actor}/${post}/../../${path}`,`${actor}/${post}/${path.split('/')[2]}`])expect((await register(forged)).status).toBe("invalid");expect(verifier).not.toHaveBeenCalled();
 });
 it("expired intent, wrong size, wrong mime and failed object verification refuse",async()=>{
  const path=await upload();expect((await registerPrivateDocument(fixture.db,viewer(),post,{...input(path),fileSize:5},verifier)).status).toBe("invalid");
  expect((await registerPrivateDocument(fixture.db,viewer(),post,{...input(path),mimeType:"text/plain"},verifier)).status).toBe("invalid");
  expect((await registerPrivateDocument(fixture.db,viewer(),post,input(path),async()=>false)).status).toBe("invalid");
  await fixture.db.execute(sql`update document_uploads set expires_at=now()-interval '1 second' where path=${path}`);expect((await register(path)).status).toBe("invalid");
 });
 it("registered cleanup refuses; intentional attachment deletion authorizes durable cleanup",async()=>{
  const path=await upload(),result=await register(path);expect(result.status).toBe("created");if(result.status!=="created")throw Error("fixture");
  remove.mockClear();expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("conflict");expect(remove).not.toHaveBeenCalled();
  expect((await requestAttachmentDeletion(fixture.db,victim,result.attachment.id)).status).toBe("not_found");
  expect((await requestAttachmentDeletion(fixture.db,actor,result.attachment.id)).status).toBe("removed");
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");expect((await register(path)).status).toBe("invalid");
  expect((await requestAttachmentDeletion(fixture.db,actor,result.attachment.id)).status).toBe("removed");
 });
 it("orphan cleanup requires an issued intent, rejects cross-user requests and is idempotent",async()=>{
  const path=await upload();remove.mockClear();expect((await cleanupPrivateDocument(fixture.db,victim,path,remove)).status).toBe("forbidden");
  expect((await cleanupPrivateDocument(fixture.db,actor,`${actor}/${post}/${crypto.randomUUID()}.pdf`,remove)).status).toBe("conflict");expect(remove).not.toHaveBeenCalled();
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");expect(remove).toHaveBeenCalledOnce();
 });
 it("provider failure keeps pending state and retry completes after metadata removal",async()=>{
  const path=await upload();const result=await register(path);if(result.status!=="created")throw Error("fixture");await requestAttachmentDeletion(fixture.db,actor,result.attachment.id);
  expect((await cleanupPrivateDocument(fixture.db,actor,path,async()=>{throw Error("mock provider unavailable");})).status).toBe("pending");
  expect((await fixture.engine.query<{state:string}>("select state from document_uploads where path=$1",[path])).rows[0].state).toBe("delete_pending");
  expect((await register(path)).status).toBe("invalid");expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");
 });
 it("cleanup winning a registration race prevents pointer creation",async()=>{
  const path=await upload();const [cleanup,registration]=await Promise.all([cleanupPrivateDocument(fixture.db,actor,path,remove),register(path)]);expect(cleanup.status).toBe("removed");expect(registration.status).toBe("invalid");
 });
 it("registration winning a cleanup race keeps bytes while referenced",async()=>{
  const path=await upload();const [registration,cleanup]=await Promise.all([register(path),cleanupPrivateDocument(fixture.db,actor,path,remove)]);expect(registration.status).toBe("created");expect(cleanup.status).toBe("conflict");
 });
 it("cannot issue intent for another actor's post",async()=>{
  const send=vi.fn(async()=>{});await expect(uploadPrivateDocument(fixture.db,actor,victimPost,"pdf",4,send)).rejects.toThrow("document_post_not_owned");expect(send).not.toHaveBeenCalled();
 });
 it("ambiguous upload failure leaves an authorized retryable cleanup record",async()=>{
  let path="";await expect(uploadPrivateDocument(fixture.db,actor,post,"pdf",4,async key=>{path=key;throw Error("mock upload response lost");})).rejects.toThrow("document_upload_unconfirmed");
  expect((await register(path)).status).toBe("invalid");expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");
 });
 it("in-flight nonexpired uploading intent cannot be cleaned",async()=>{
  const path=`${actor}/${post}/${crypto.randomUUID()}.pdf`;
  await fixture.db.execute(sql`insert into document_uploads(path,actor,post_id,size,mime,expires_at) values(${path},${actor},${post},4,'application/pdf',now()+interval '15 minutes')`);
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("conflict");
  await fixture.db.execute(sql`update document_uploads set expires_at=now()-interval '1 second' where path=${path}`);
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");
 });

 it("unissued victim-object UUID alias and traversal are refused before real SDK fetch",async()=>{
  const path=await uploadPrivateDocument(fixture.db,victim,victimPost,"pdf",4,async()=>{});
  const fetch=vi.fn(async()=>{throw Error("SDK fetch MUST NOT run");});
  const sdk=createClient("https://storage.invalid","test-placeholder",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch}});
  const capability=documentCapability(()=>sdk.storage.from("post-documents"));
  for(const forged of [path,`${actor}/${post}/../../${path}`,`${actor}/${post}/${path.split('/')[2]}`]){
   expect((await registerPrivateDocument(fixture.db,viewer(),post,input(forged),capability.verify)).status).toBe("invalid");
  }
  expect(fetch).not.toHaveBeenCalled();
 });
 it("successful byte deletion followed by DB-finalization failure remains retryable",async()=>{
  const path=await upload();
  await fixture.engine.exec("create function fail_finalize() returns trigger language plpgsql as $$ begin if new.state='deleted' then raise exception 'injected finalize failure'; end if; return new; end $$;create trigger fail_finalize before update on document_uploads for each row execute function fail_finalize()");
  const idempotentRemove=vi.fn(async()=>{});
  try{expect((await cleanupPrivateDocument(fixture.db,actor,path,idempotentRemove)).status).toBe("pending");
   expect((await fixture.engine.query<{state:string}>("select state from document_uploads where path=$1",[path])).rows[0].state).toBe("delete_pending");
   expect((await register(path)).status).toBe("invalid");
  }finally{await fixture.engine.exec("drop trigger fail_finalize on document_uploads");}
  expect((await cleanupPrivateDocument(fixture.db,actor,path,idempotentRemove)).status).toBe("removed");expect(idempotentRemove).toHaveBeenCalledTimes(2);
 });

 it("legacy canonical attachment can be retired by ID but never adopted for registration",async()=>{
  const path=`${actor}/${post}/${crypto.randomUUID()}.pdf`,id=crypto.randomUUID();
  await fixture.db.execute(sql`insert into post_attachments(id,"postId","uploaderUid","storagePath","fileName","mimeType","fileSize") values(${id},${post},${actor},${path},'legacy.pdf','application/pdf',4)`);
  expect((await register(path)).status).toBe("invalid");
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("conflict");
  expect((await requestAttachmentDeletion(fixture.db,actor,id)).status).toBe("removed");
  expect((await cleanupPrivateDocument(fixture.db,actor,path,remove)).status).toBe("removed");
 });

});
