import "server-only";
import { storageBucket } from "./bridge";
import { documentCapability } from "./document-capability";
const capability=documentCapability(()=>storageBucket("post-documents"));
export const verifyUploadedDocument=capability.verify;
export const signDocument=capability.sign;
/** Call only from the locked deletion lifecycle, never directly from a path API. */
export const deleteDocumentBytes=capability.remove;
