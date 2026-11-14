import {it,expect} from "vitest";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {verifyBrowserBundles} from "../../scripts/verification/bundles.mjs";
it("bundle scan fails on server markers and actual allowlisted secret values without printing them",()=>{const root=mkdtempSync(join(tmpdir(),"borynx-bundle-test-"));try{writeFileSync(join(root,"fixture.js"),"public code");expect(()=>verifyBrowserBundles({},()=>{},[root])).not.toThrow();writeFileSync(join(root,"fixture.js"),"SUPABASE_SERVICE_ROLE_KEY");expect(()=>verifyBrowserBundles({},()=>{},[root])).toThrow("SERVER_CREDENTIAL_MARKER");writeFileSync(join(root,"fixture.js"),"TEST_ONLY_SENTINEL_SECRET");expect(()=>verifyBrowserBundles({SUPABASE_SERVICE_ROLE_KEY:"TEST_ONLY_SENTINEL_SECRET"},()=>{},[root])).toThrow("SECRET_VALUE_IN_BROWSER_BUILD");}finally{rmSync(root,{recursive:true,force:true});}});
it("missing browser build fails closed",()=>expect(()=>verifyBrowserBundles({},()=>{},["/nonexistent/borynx-build-fixture"])).toThrow("BROWSER_BUILD_MISSING"));
