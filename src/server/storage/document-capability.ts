import {requireDocumentKey} from "./document-key";
export interface DocumentBucket {
  info(path:string):PromiseLike<{data:{size?:number;contentType?:string}|null;error:unknown}>;
  createSignedUrl(path:string,seconds:number,options:{download:string}):PromiseLike<{data:{signedUrl:string}|null;error:unknown}>;
  remove(paths:string[]):PromiseLike<{error:unknown}>;
}
export function documentCapability(bucket:()=>DocumentBucket) {
 return {
  async verify(path:string,size:number,mime:string,actor:string,post:string) {
   const key=requireDocumentKey(path,actor,post);if(key.mime!==mime)return false;
   const {data,error}=await bucket().info(path);
   if(error){if(String((error as {statusCode?:string}).statusCode)==="404")return false;throw Error("storage_unavailable");}
   return !!data && data.size===size && data.contentType===mime;
  },
  async sign(path:string,fileName:string,actor:string,post:string) {
   requireDocumentKey(path,actor,post);
   const {data,error}=await bucket().createSignedUrl(path,60,{download:fileName});
   if(error||!data?.signedUrl)throw Error("storage_unavailable");return data.signedUrl;
  },
  async remove(path:string,actor:string,post:string) {
   requireDocumentKey(path,actor,post);const {error}=await bucket().remove([path]);
   if(error)throw Error("storage_unavailable");
  }
 };
}
