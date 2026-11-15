import { randomUUID } from "node:crypto";
import { getServerSession } from "@/lib/server-session";
import { storageBucket } from "@/server/storage/bridge";
import { getPost } from "@/server/features/content";
import { trustedMutation } from "@/server/auth/config";
import { isValidUid } from "@/server/features/identity/provision-profile";
export const runtime = "nodejs";
const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const documents: Record<string,string> = { pdf:"application/pdf",txt:"text/plain",csv:"text/csv",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const fail = (status:number) => Response.json({ error: "storage_request_failed" }, { status });
/** Bounded streaming read before FormData parsing (never buffer unbounded input). */
async function boundedForm(request:Request) {
  const reader=request.body?.getReader();if(!reader)throw Error("body_missing");
  const chunks:Uint8Array[]=[];let length=0;
  try { while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>11*1024*1024)throw Error("body_too_large");chunks.push(r.value);} }
  finally { await reader.cancel(); }
  const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  return new Response(body,{headers:{"content-type":request.headers.get("content-type")??""}}).formData();
}
export async function POST(request:Request) {
  if(!trustedMutation(request))return fail(403);
  try {
    const session=await getServerSession();if(!session)return fail(401);
    const form=await boundedForm(request),bucket=form.get("bucket"),file=form.get("file"),postId=form.get("postId");
    if(!["avatars","post-images","post-documents"].includes(String(bucket)) || !(file instanceof File))return fail(400);
    const target=bucket as "avatars"|"post-images"|"post-documents";
    const ext=file.name.split(".").pop()?.toLowerCase()??"";
    const mime=target==="post-documents"?documents[ext]:file.type;
    const max=target==="avatars"?2:target==="post-images"?5:10;
    if(!file.size || file.size>max*1024*1024 || !mime || (target!=="post-documents"&&!allowed.includes(mime)) || file.name.length>255)return fail(400);
    if(target==="post-documents"){
      if(!isValidUid(postId))return fail(400);
      const post=await getPost(postId);if(!post.ok || post.data?.authorUid!==session.uid)return fail(404);
    }
    const path=target==="post-documents"?`${session.uid}/${postId}/${randomUUID()}.${ext}`:`${session.uid}/${randomUUID()}.${mime.split("/")[1]}`;
    const storage=storageBucket(target),result=await storage.upload(path,await file.arrayBuffer(),{contentType:mime,upsert:false});
    if(result.error)return fail(503);
    return Response.json({path,...(target!=="post-documents"?{url:storage.getPublicUrl(path).data.publicUrl}:{})},{headers:{"cache-control":"no-store"}});
  }catch{return fail(503);}
}
export async function DELETE(request:Request){
  if(!trustedMutation(request))return fail(403);
  try{
    const session=await getServerSession();if(!session)return fail(401);
    const body=await request.json();
    // Own orphan cleanup only. No bucket supplied by browser and no prefix deletion.
    if(typeof body.path!=="string" || !new RegExp(`^${session.uid}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(pdf|txt|csv|doc|docx|xlsx)$`).test(body.path))return fail(400);
    const result=await storageBucket("post-documents").remove([body.path]);return result.error?fail(503):Response.json({ok:true});
  }catch{return fail(503);}
}
