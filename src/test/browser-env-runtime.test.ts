import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the real module without Node's process global: jsdom alone would hide
// this crash because the test runner supplies process. Replace only import.meta,
// supplying the same env shape Vite exposes; do not polyfill process.
const source=readFileSync("src/lib/supabase-env.ts","utf8").replace(/import\.meta/g,"__viteImportMeta");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function load(vite:Record<string,string>={},next?:Record<string,string>){
 const exports:Record<string,unknown>={};
 runInNewContext(compiled,{exports,__viteImportMeta:{env:vite},console:{warn:()=>{}},...(next?{process:{env:next}}:{})});
 return exports as {isSupabaseConfigured:boolean;getSupabaseCredentials:()=>{url:string;anonKey:string}|null};
}
describe("browser configuration startup",()=>{
 it("reproduces the prior unguarded process failure in a browser-like context",()=>{expect(()=>runInNewContext("process.env.NEXT_PUBLIC_SUPABASE_URL",{})).toThrow(/process is not defined/);});
 it("loads Vite credentials without a process global",()=>{const result=load({VITE_SUPABASE_URL:"https://test-project.supabase.co",VITE_SUPABASE_ANON_KEY:"public-test-key"});expect(result.isSupabaseConfigured).toBe(true);expect(result.getSupabaseCredentials()).toEqual({url:"https://test-project.supabase.co",anonKey:"public-test-key"});});
 it("renders unconfigured mode without throwing when neither env is provided",()=>{const result=load();expect(result.isSupabaseConfigured).toBe(false);expect(result.getSupabaseCredentials()).toBeNull();});
 it("preserves Next credential precedence and literal-read behavior",()=>{expect(load({VITE_SUPABASE_URL:"https://vite.supabase.co",VITE_SUPABASE_ANON_KEY:"vite-public"},{NEXT_PUBLIC_SUPABASE_URL:"https://next.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"next-public"}).getSupabaseCredentials()).toEqual({url:"https://next.supabase.co",anonKey:"next-public"});});
});
