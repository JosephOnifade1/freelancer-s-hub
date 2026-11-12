import { RedirectTo } from "@/lib/redirect-to";

// Mirrors the React Router redirect in src/App.tsx so both builds agree.
export default function Redirect() {
  return <RedirectTo href="/" />;
}
