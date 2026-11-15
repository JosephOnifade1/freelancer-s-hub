import "server-only";
import { storageBucket } from "./bridge";
const documents = () => storageBucket("post-documents");
export async function verifyUploadedDocument(
  path: string,
  size: number,
  mime: string,
): Promise<boolean> {
  const { data, error } = await documents().info(path);
  if (error) {
    if (String((error as { statusCode?: string }).statusCode) === "404")
      return false;
    throw new Error("storage_unavailable");
  }
  return !!data && data.size === size && data.contentType === mime;
}
export async function signDocument(
  path: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await documents().createSignedUrl(path, 60, {
    download: fileName,
  });
  if (error || !data?.signedUrl) throw new Error("storage_unavailable");
  return data.signedUrl;
}
