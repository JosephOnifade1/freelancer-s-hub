import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isDemoMode } from "../lib/supabase";
import { ensureUserProfile, checkUsernameAvailability } from "../lib/users";
import { postAuthRedirect, resendConfirmationEmail, authErrorMessage, normalizeUsername, isValidUsername } from "../lib/auth";
import { readReturnPath } from "../lib/return-path";
import { oauthCallbackUrl } from "../lib/oauth";
import { useAuth } from "../hooks/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "unavailable">("idle");
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  // Validated URL parameter — see lib/return-path.ts.
  const redirectTo = postAuthRedirect(readReturnPath(searchParams?.get("from")));

  // Live username availability check (debounced), same rules as Settings.
  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    if (!isValidUsername(username)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(username);
        if (active) setUsernameStatus(available ? "available" : "taken");
      } catch {
        if (active) setUsernameStatus("unavailable");
      }
    }, 500);
    return () => { active = false; clearTimeout(timeoutId); };
  }, [username]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (!isValidUsername(username)) {
      toast.error("Username must be 3-15 lowercase letters, numbers, or underscores.");
      return;
    }
    if (usernameStatus !== "available") {
      toast.error(usernameStatus === "taken" ? "That username is already taken." : "Check that your username is available before signing up.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name, username },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;

      if (data?.user) {
        await ensureUserProfile({
          ...data.user,
          user_metadata: { ...(data.user.user_metadata || {}), display_name: name, username },
        });
      }

      if (data?.user && !data?.session) {
        // Email confirmation is enabled: the account exists but cannot be
        // used until the inbox link is clicked. Say exactly that.
        setConfirmationSentTo(email);
      } else {
        toast.success("Account created. Let's set up your profile!");
        router.replace("/onboarding");
      }
    } catch (error) {
      const message = authErrorMessage(error, "Failed to create account.");
      if (message.includes("Failed to fetch")) {
        toast.error("Unable to connect to Supabase backend. Please check your connection or project status.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    // Demo account exists only in demo mode (local mock DB). Against a real
    // backend this would create a shared, publicly-known account.
    if (!isDemoMode) {
      toast.error("Demo sign-in is only available in demo mode.");
      return;
    }
    setIsLoading(true);
    const demoEmail = "demo@borynx.com";
    const demoPassword = "DemoPassword123!";

    try {
      const signInRes = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });
      let data = signInRes.data;

      if (signInRes.error) {
        const signUpRes = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: { display_name: "Demo Freelancer" },
          },
        });

        if (signUpRes.error) {
          throw signUpRes.error;
        }

        if (signUpRes.data?.user && !signUpRes.data?.session) {
          toast.info("Demo user created. If email confirmation is required in your Supabase project, please confirm or check settings.");
          return;
        }

        data = signUpRes.data;
      }

      if (data?.user) {
        await ensureUserProfile({
          ...data.user,
          user_metadata: { display_name: "Demo Freelancer" },
        });
      }

      toast.success("Logged in as Demo Freelancer!");
      router.replace(redirectTo);
    } catch (error) {
      toast.error(authErrorMessage(error, "Demo login failed."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!confirmationSentTo) return;
    setResending(true);
    try {
      await resendConfirmationEmail(confirmationSentTo);
      toast.success("Confirmation email sent again. Check your inbox.");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not resend the confirmation email."));
    } finally {
      setResending(false);
    }
  };

  // Already signed in? Skip the form. Phase 1: redirect in an effect rather
  // than during render (see the same note in views/Login.tsx).
  const alreadySignedIn = !authLoading && !!user;
  useEffect(() => {
    if (alreadySignedIn) router.replace(redirectTo);
  }, [alreadySignedIn, redirectTo, router]);
  if (alreadySignedIn) return null;

  if (confirmationSentTo) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-brand" />
            <CardTitle className="text-2xl font-bold tracking-tight">Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{confirmationSentTo}</span>. Click it to
              verify your account, then log in. The link expires after a while — if it does, come
              back and we'll send a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" onClick={handleResendConfirmation} disabled={resending}>
              {resending ? "Sending..." : "Resend confirmation email"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
              Go to log in
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
      toast.error(authErrorMessage(error, "Failed to sign up with Google."));
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
            <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
          </div>
          <CardDescription>
            Enter your details below to create your account and get started.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">@</span>
                <Input
                  id="username"
                  placeholder="your_handle"
                  className="pl-7"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {usernameStatus === "available" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {(usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "unavailable") && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {usernameStatus === "available" && <p className="text-xs text-emerald-600">Username is available!</p>}
              {usernameStatus === "taken" && <p className="text-xs text-destructive">That username is already taken.</p>}
              {usernameStatus === "invalid" && <p className="text-xs text-destructive">Must be 3-15 lowercase letters, numbers, or underscores.</p>}
              {usernameStatus === "unavailable" && <p role="alert" className="text-xs text-destructive">Couldn't check the username. Please try again when connected.</p>}
              {usernameStatus === "idle" && <p className="text-xs text-muted-foreground">This is your public @handle. You can change it later in Settings.</p>}
            </div>
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
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={isLoading || usernameStatus !== "available"}>
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our{" "}
              <Link href="/terms" className="text-brand hover:underline">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>.
            </p>

            {isDemoMode && (
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                <UserCheck className="h-4 w-4" />
                Quick Demo Sign In
              </Button>
            )}

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
              Already have an account?{" "}
              <Link href="/login" className="text-brand hover:underline font-medium">
                Log in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
