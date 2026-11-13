import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { requestPasswordReset, authErrorMessage } from "../lib/auth";
import { useAuth } from "../hooks/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { user, loading } = useAuth();

  // Signed-in users change their password from Settings instead.
  if (!loading && user) {
    return <Navigate to="/settings" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter the email address for your account.");
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      // Always show the same confirmation, whether or not the email has
      // an account — the response must not leak which emails are registered.
      setSent(true);
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not send the reset email. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-brand" />
            <CardTitle className="text-2xl font-bold tracking-tight">Reset your password</CardTitle>
          </div>
          <CardDescription>
            Enter your account email and we'll send you a link to choose a new password.
          </CardDescription>
        </CardHeader>

        {sent ? (
          <>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium text-foreground">{email}</span>, a password reset
                  link is on its way. The link expires after a short time — if it does, request a
                  new one here.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Use a different email
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-brand hover:underline">
                Back to log in
              </Link>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
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
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send reset link"}
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
