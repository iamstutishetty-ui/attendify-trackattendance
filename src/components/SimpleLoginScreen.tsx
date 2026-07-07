import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { idToEmail, useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetPasswordWithRecovery } from "@/lib/accounts.functions";

export function SimpleLoginScreen({
  role,
  onBack,
}: {
  role: "admin" | "parent";
  onBack: () => void;
}) {
  const [mode, setMode] = React.useState<"login" | "forgot">("login");
  const [userId, setUserId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const { refresh } = useAuth();
  const resetPw = useServerFn(resetPasswordWithRecovery);

  const Icon = role === "admin" ? ShieldCheck : Users;
  const title = role === "admin" ? "Admin Login" : "Parent Login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !password) { toast.error("Enter ID and password"); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        if (!email.trim()) { toast.error("Enter recovery email"); setBusy(false); return; }
        await resetPw({ data: { userIdText: userId.trim().toLowerCase(), recoveryEmail: email.trim(), newPassword: password } });
        toast.success("Password reset. You can now log in.");
        setMode("login"); setPassword(""); setEmail("");
      } else {
        const authEmail = idToEmail(userId);
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw new Error(error.message.toLowerCase().includes("invalid") ? "Wrong ID or password" : error.message);
        await refresh();
        toast.success("Welcome back");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-10 pt-8">
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="card-soft rounded-3xl border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "forgot" ? "Reset your password" : "Enter your credentials"}
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="uid">ID</Label>
              <Input id="uid" autoCapitalize="none" value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Your ID" className="rounded-xl h-11" />
            </div>
            {mode === "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Registered email</Label>
                <Input id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="rounded-xl h-11" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pw">{mode === "forgot" ? "New password" : "Password"}</Label>
              <div className="relative">
                <Input id="pw" type={show ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "forgot" ? "Choose a new password" : "Enter password"}
                  className="rounded-xl h-11 pr-11" />
                <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "login" && (
                <button type="button" onClick={() => { setMode("forgot"); setPassword(""); }}
                  className="pt-1 text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </button>
              )}
              {mode === "forgot" && (
                <button type="button" onClick={() => { setMode("login"); setPassword(""); setEmail(""); }}
                  className="pt-1 text-xs font-medium text-primary hover:underline">
                  Back to log in
                </button>
              )}
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base font-semibold">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
