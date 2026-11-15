"use client";
import Link from "next/link";
/** Never render raw server errors, connection strings or provider responses. */
export default function PageError({reset}:{error:Error & {digest?:string};reset:()=>void}){
 return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
  <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
  <p>Try again. If the problem continues, return home and check your connection.</p>
  <button type="button" onClick={reset} className="rounded border px-4 py-2">Try again</button>
  <Link href="/" className="underline">Back to home</Link>
 </main>;
}
