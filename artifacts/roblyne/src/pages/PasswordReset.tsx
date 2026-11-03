import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";

export default function PasswordReset() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(apiUrl("/api/auth/password-reset/request"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to request a reset code");
      setRequested(true);
      toast({ title: "Check your email", description: body.message });
    } catch (error) {
      toast({ title: "Unable to send reset code", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(apiUrl("/api/auth/password-reset/confirm"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to reset password");
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      setLocation("/login");
    } catch (error) {
      toast({ title: "Password reset failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Layout>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8">
            <h1 className="mb-2 text-3xl font-serif font-bold">Reset your password</h1>
            <p className="mb-6 text-sm text-muted-foreground">{requested ? "Enter the six-digit code from your email and choose a new password." : "We will send a one-time reset code if an account exists for this email."}</p>
            {!requested ? (
              <form className="space-y-4" onSubmit={requestCode}>
                <Label htmlFor="reset-email">Email address</Label>
                <Input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <Button className="w-full" disabled={pending}>{pending ? "Sending..." : "Send reset code"}</Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={confirmReset}>
                <div><Label htmlFor="reset-code">Reset code</Label><Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></div>
                <div><Label htmlFor="reset-password">New password</Label><Input id="reset-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
                <Button className="w-full" disabled={pending}>{pending ? "Updating..." : "Update password"}</Button>
              </form>
            )}
          </CardContent>
          <CardFooter><Link href="/login" className="text-sm text-primary hover:underline">Back to sign in</Link></CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
