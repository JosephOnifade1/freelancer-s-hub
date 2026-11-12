import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "react-router-dom";
import { supabase, isDemoMode } from "../lib/supabase";
import { updatePassword, authErrorMessage } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

type Phase = "checking" | "ready" | "invalid" | "saving" | "done";

const hasMockRecovery = (): boolean => {
  try {
    return !!localStorage.getItem("mock_supabase_password_recovery");
  } catch {
    return false;
  }
};

export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();

  useEffect(() => {
    let settled = false;

    // Supabase turns the emailed link into a recovery session and fires
    // PASSWORD_RECOVERY. Any live session on this page is also accepted:
    // arriving here with a session can only come from that link (or from
    // demo mode's simulated link, i.e. the stored recovery record).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
          if (data.session || (isDemoMode && hasMockRecovery())) {
            settled = true;
            setPhase((p) => (p === "checking" ? "ready" : p));
          }
        });
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
          if (data.session || (isDemoMode && hasMockRecovery())) {
            setPhase((p) => (p === "checking" ? "ready" : p));
          } else {
            setPhase((p) => (p === "checking" ? "invalid" : p));
          }
        });
      }
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setPhase("saving");
    try {
      await updatePassword(password);
      setPhase("done");
      toast.success("Password updated. You're signed in with your new password.");
      setTimeout(() => router.replace("/"), 1200);
    } catch (error) {
      setPhase("ready");
      toast.error(authErrorMessage(error, "Could not update your password. The reset link may have expired — request a new one."));
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-brand" />
            <CardTitle className="text-2xl font-bold tracking-tight">Choose a new password</CardTitle>
          </div>
          <CardDescription>
            This page only works from a password reset link, so your account stays protected.
          </CardDescription>
        </CardHeader>

        {phase === "checking" && (
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
          </CardContent>
        )}

        {phase === "invalid" && (
          <>
            <CardContent>
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This reset link is invalid or has expired. Reset links can only be used once and
                  don't stay valid for long — request a fresh one and use it straight away.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" onClick={() => router.push("/forgot-password")}>
                Request a new reset link
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-brand hover:underline">
                Back to log in
              </Link>
            </CardFooter>
          </>
        )}

        {(phase === "ready" || phase === "saving" || phase === "done") && (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {isDemoMode && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  Demo mode: no email was sent — this simulates opening the reset link from your
                  inbox.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" type="submit" disabled={phase === "saving" || phase === "done"}>
                {phase === "saving" ? "Updating..." : phase === "done" ? "Password updated" : "Update password"}
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-brand hover:underline">
                Back to log in
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
