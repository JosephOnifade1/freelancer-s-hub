import { Link } from "react-router-dom";
import { useRouter } from "next/navigation";
import { useCurrentPathname } from "@/hooks/useCurrentPathname";
import { useEffect } from "react";
import { ArrowLeft, Home, Search } from "lucide-react";

const NotFound = () => {
  const pathname = useCurrentPathname();
  const router = useRouter();

  useEffect(() => {
    console.error("404 Error: Non-existent route accessed:", pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center px-4">
      <div className="relative z-10 text-center max-w-lg">
        <p className="mb-6 select-none font-heading text-[8rem] font-black leading-none text-muted-foreground/20">404</p>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Page not found
        </h1>
        <p className="font-body text-muted-foreground mb-2 text-sm leading-relaxed">
          The page <code className="bg-muted px-1.5 py-0.5 rounded text-xs tabular-nums ">{pathname}</code> doesn't exist.
        </p>
        <p className="font-body text-sm text-muted-foreground/70 mb-8">
          It may have been moved, deleted, or you may have typed the URL incorrectly.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
