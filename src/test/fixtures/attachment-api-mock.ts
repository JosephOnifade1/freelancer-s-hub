/** Historical RLS fixture for attachment UX tests only, never runtime. */
import {supabase} from "../../lib/supabase";
import type {ContentAttachment,ContentClientResult} from "../../lib/content-client";
const fail=<T,>(error:{code?:string}|null):ContentClientResult<T>=>({ok:false,error:error?.code==="23505"?"conflict":"error"});
const currentUid=async()=> (await supabase.auth.getSession()).data?.session?.user?.id;
export async function demoFetchAttachments(
  postId: string,
): Promise<ContentClientResult<ContentAttachment[]>> {
  const { data, error } = await supabase
    .from("post_attachments")
    .select("*")
    .eq("postId", postId)
    .order("createdAt", { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as ContentAttachment[] };
}

export async function demoRegisterAttachment(input: {
  postId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ContentClientResult<ContentAttachment>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("post_attachments")
    .insert({ ...input, uploaderUid: uid })
    .select("*")
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as ContentAttachment };
}

export async function demoRemoveAttachment(
  attachmentId: string,
): Promise<ContentClientResult<null>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("post_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("uploaderUid", uid)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}

