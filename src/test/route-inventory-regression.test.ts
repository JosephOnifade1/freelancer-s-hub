// @vitest-environment node
import {readdirSync} from "node:fs";
import {join} from "node:path";
import {expect,it} from "vitest";
import {isProtectedPath,isPublicPath} from "@/lib/route-access";
function pages(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?pages(join(dir,entry.name)):entry.name==="page.tsx"?[join(dir,entry.name)]:[]);}
it("classifies every App Router page as intentionally public or protected",()=>{
 const inventory=pages("src/app");expect(inventory.length).toBeGreaterThanOrEqual(40);
 for(const file of inventory){
  const route="/"+file.replace(/^src\/app\//,"").replace(/\/?page.tsx$/,"").split("/").filter(segment=>segment&&!segment.startsWith("(")).map(segment=>segment.startsWith("[")?"example":segment).join("/");
  expect(isProtectedPath(route)||isPublicPath(route),`${file}: ${route} has no access classification`).toBe(true);
 }
});
