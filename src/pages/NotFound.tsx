import { useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: Non-existent route accessed:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-4">
      {/* Glow backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* Big 404 number */}
        <div className="relative mb-6 select-none">
          <span className="font-heading text-[9rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-primary/30 to-transparent">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-heading text-[9rem] font-black leading-none text-primary/10 blur-sm">404</span>
          </div>
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Page not found
        </h1>
        <p className="font-body text-muted-foreground mb-2 text-sm leading-relaxed">
          The page <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> doesn't exist.
        </p>
        <p className="font-body text-sm text-muted-foreground/70 mb-8">
          It may have been moved, deleted, or you may have typed the URL incorrectly.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
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
