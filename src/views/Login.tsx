import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { postAuthRedirect, resendConfirmationEmail, authErrorMessage } from "../lib/auth";
import { readReturnPath } from "../lib/return-path";
import { oauthCallbackUrl } from "../lib/oauth";
import { useAuth } from "../hooks/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  // Phase 1: the return destination travels in the URL (?from=…) and is
  // validated — it is user-editable, so it can never be trusted directly.
  const redirectTo = postAuthRedirect(readReturnPath(searchParams?.get("from")));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setUnconfirmedEmail(email);
          throw new Error("Your email address has not been confirmed yet. Please check your inbox for the confirmation link.");
        } else if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password. Please check your details or create a new account.");
        }
        throw error;
      }

      // Phase 2C: no provisioning call here. `AuthProvider.acceptSession` starts one
      // the moment the SIGNED_IN event fires, and it de-duplicates and retries. Calling
      // it here too issued a second request for the same user on every password login,
      // which the provider had no way to coalesce with its own.
      toast.success("Logged in successfully!");
      router.replace(redirectTo);
    } catch (error) {
      const message = authErrorMessage(error, "Failed to log in.");
      if (message.includes("Failed to fetch")) {
        toast.error("Unable to connect to Supabase backend. Please check your connection or project status.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };



  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      await resendConfirmationEmail(unconfirmedEmail);
      toast.success("Confirmation email sent. Check your inbox, then log in.");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not resend the confirmation email."));
    } finally {
      setResending(false);
    }
  };

  // Already signed in? Don't show a login form — go where they were headed.
  // Phase 1: the navigation runs in an effect, not during render. Calling
  // `router.replace` while rendering mutates the router mid-render (the old
  // `<Navigate>` did that on purpose); an effect is the React-safe equivalent
  // and keeps the "no form flash" behaviour via the `null` below.
  const alreadySignedIn = !authLoading && !!user;
  useEffect(() => {
    if (alreadySignedIn) router.replace(redirectTo);
  }, [alreadySignedIn, redirectTo, router]);
  if (alreadySignedIn) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Phase 1.1: land on the server-side callback, which exchanges the code
        // and writes the cookie session, then forwards to the validated
        // destination. Sending the provider straight to the destination would
        // leave the code to the client (the Phase 1 behaviour).
        options: { redirectTo: oauthCallbackUrl(window.location.origin, redirectTo) },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(authErrorMessage(error, "Failed to log in with Google."));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
          </div>
          <CardDescription>
            Enter your email and password to log in to your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {unconfirmedEmail && (
              <div className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="text-foreground">This email hasn't been confirmed yet.</p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="mt-1 font-medium text-brand hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending..." : "Resend confirmation email"}
                </button>
              </div>
            )}
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log in"}
            </Button>
            <div className="w-full text-right">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-brand hover:underline">
                Forgot your password?
              </Link>
            </div>

            <div className="relative w-full my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs ">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>

            <div className="text-sm text-center text-muted-foreground pt-2">
              Don't have an account?{" "}
              <Link href="/signup" className="text-brand hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
