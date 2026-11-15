import {describe,it,expect,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
import {documentCapability} from "../../src/server/storage/document-capability";
import {documentKey} from "../../src/server/storage/document-key";
const actor="11111111-1111-4111-8111-111111111111",post="22222222-2222-4222-8222-222222222222",object="33333333-3333-4333-8333-333333333333";
const valid=`${actor}/${post}/${object}.pdf`;
function fixture(){
 const calls:{url:string;method:string;body:unknown}[]=[];
 const fetch=vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{
  const url=String(input);calls.push({url,method:options?.method??"GET",body:options?.body});
  const result=url.includes("/info/")?{size:4,content_type:"application/pdf"}:url.includes("/sign/")?{signedURL:`/object/sign/post-documents/${valid}?token=mock-token`}:[];
  return new Response(JSON.stringify(result),{headers:{"content-type":"application/json"}});
 });
 const client=createClient("https://storage.invalid","test-placeholder",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch}});
 return {calls,fetch,capability:documentCapability(()=>client.storage.from("post-documents"))};
}
const malicious=[
 `${actor}/${post}/../${object}.pdf`,`${actor}/${post}/../../${object}.pdf`,
 `${actor}/${post}/%2e%2e/${object}.pdf`,`${actor}/${post}/%2E%2E/${object}.pdf`,
 `${actor}/${post}/${object}%2fpdf`,`${actor}\\${post}\\${object}.pdf`,`${actor}/${post}/extra/${object}.pdf`,
 `https://evil.invalid/${valid}`,valid+"?x=y",valid+"#fragment",`/${valid}`,valid+"/",valid+"\n",valid+" ",
 valid.replace(actor,object),valid.replace(post,object),valid.toUpperCase(),`${actor}/${post}/./${object}.pdf`,
 `${actor}/${post}/%252e%252e/${object}.pdf`,`${actor}/${post}\\..\\${object}.pdf`,
];
describe("canonical private key at REAL SDK fetch boundary (all fetch mocked)",()=>{
 it("valid info/sign/delete requests reach only the exact intended SDK URL and bucket",async()=>{
  const {capability,calls}=fixture();expect(documentKey(valid,actor,post)).not.toBeNull();
  expect(await capability.verify(valid,4,"application/pdf",actor,post)).toBe(true);
  await capability.sign(valid,"file.pdf",actor,post);await capability.remove(valid,actor,post);
  expect(calls.map(c=>new URL(c.url).pathname)).toEqual([`/storage/v1/object/info/post-documents/${valid}`,`/storage/v1/object/sign/post-documents/${valid}`,"/storage/v1/object/post-documents"]);
  expect(JSON.parse(calls[2].body as string)).toMatchObject({prefixes:[valid]});
 });
 it.each(malicious)("rejects before ANY SDK fetch: %s",async path=>{
  const {capability,fetch}=fixture();expect(documentKey(path,actor,post)).toBeNull();
  await expect(capability.verify(path,4,"application/pdf",actor,post)).rejects.toThrow("invalid_document_key");
  await expect(capability.sign(path,"file.pdf",actor,post)).rejects.toThrow("invalid_document_key");
  await expect(capability.remove(path,actor,post)).rejects.toThrow("invalid_document_key");expect(fetch).not.toHaveBeenCalled();
 });
 it("stored pointers are independently checked even without explicit expected ownership",async()=>{
  const {capability,fetch}=fixture();await expect(capability.sign(malicious[0],"file.pdf",actor,post)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
});
