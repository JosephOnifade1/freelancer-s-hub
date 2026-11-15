// @vitest-environment node
/** Supersedes Supabase PKCE exchange tests: old codes must fail closed. */
import {describe,it,expect} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "../app/auth/callback/route";
import {sanitizeReturnPath} from "../lib/return-path";
describe("legacy callback retirement",()=>{
 it.each(["", "?code=old", "?code=old&next=https://evil.invalid", "?next=//evil.invalid"])("never exchanges old code or redirects externally %s",query=>{
 const response=GET(new NextRequest("http://localhost/auth/callback"+query));expect(response.headers.get("location")).toBe("http://localhost/login?auth_error=legacy_callback_expired");});
 it.each(["https://evil.invalid","//evil.invalid","/%2f%2fevil.invalid","/login","/\\evil.invalid"])("retains return-path attack rejection %s",path=>expect(sanitizeReturnPath(path)).toBe("/"));
 it("preserves valid nested destination",()=>expect(sanitizeReturnPath("/b/design/p/42?tab=comments")).toBe("/b/design/p/42?tab=comments"));
});
