import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { idToEmail, useAuth, type AppRole } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, BookOpen, Loader2 } from "lucide-react";

const roles: { value: AppRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "admin", label: "Admin", icon: ShieldCheck, desc: "Manage college" },
  { value: "teacher", label: "Teacher", icon: BookOpen, desc: "Mark attendance" },
  { value: "student", label: "Student", icon: GraduationCap, desc: "View attendance" },
];

export function AuthScreen() {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [role, setRole] = React.useState<AppRole>("student");
  const [userId, setUserId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { refresh } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !password) { toast.error("Enter ID and password"); return; }
    if (mode === "signup" && !fullName.trim()) { toast.error("Enter full name"); return; }
    setBusy(true);
    try {
      const email = idToEmail(userId);
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
      const email = idToEmail(userId);
      if (mode === "signup") {
        // Pre-check username uniqueness
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id_text", userId.trim().toLowerCase())
          .maybeSingle();
        if (existing) { toast.error("Username already taken"); setBusy(false); return; }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { user_id_text: userId.trim().toLowerCase(), full_name: fullName.trim() } },
        });
        if (error) {
          if (error.message.toLowerCase().includes("registered")) throw new Error("Username already taken");
          throw error;
        }

          const { error: pErr } = await supabase.from("profiles").insert({
            id: uid, user_id_text: userId.trim().toLowerCase(), full_name: fullName.trim(),
          });
          if (pErr && !pErr.message.includes("duplicate")) throw pErr;
          const { error: rErr } = await supabase.from("user_roles").insert({ user_id: uid, role });
          if (rErr && !rErr.message.includes("duplicate")) throw rErr;
        }
        await refresh();
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("invalid")) throw new Error("Wrong ID or password");
          throw error;
        }
        toast.success("Welcome back");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="blue-gradient h-44 rounded-b-[2.5rem] px-6 pt-12 text-white">
        <h1 className="brand-font text-4xl !text-white" style={{ background: "none", WebkitTextFillColor: "white" }}>Attendify</h1>
        <p className="mt-1 text-sm text-white/85">Smart attendance for colleges</p>
      </div>

      <div className="-mt-20 px-5 pb-8">
        <div className="card-soft rounded-3xl border bg-card p-5">
          <div className="flex gap-2 rounded-full bg-secondary p-1">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Stuti Patel" className="rounded-xl h-11" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="uid">ID</Label>
              <Input id="uid" autoCapitalize="none" autoCorrect="off" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. 22cs001" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="rounded-xl h-11" />
            </div>

            {mode === "signup" && (
              <div>
                <Label className="mb-2 block">I am a</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(({ value, label, icon: Icon, desc }) => (
                    <button type="button" key={value} onClick={() => setRole(value)}
                      className={`rounded-2xl border p-3 text-left transition ${role === value ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                      <Icon className={`h-5 w-5 ${role === value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="mt-2 text-sm font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base font-semibold">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">No email or phone needed — just an ID and password.</p>
      </div>
    </div>
  );
}
