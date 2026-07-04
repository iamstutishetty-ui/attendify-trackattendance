import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { idToEmail, useAuth, type AppRole } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, BookOpen, Loader2, ArrowLeft, Eye, EyeOff, X, User as UserIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetPasswordWithRecovery } from "@/lib/accounts.functions";

const roles: { value: AppRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "admin", label: "Admin", icon: ShieldCheck, desc: "Manage college" },
  { value: "teacher", label: "Teacher", icon: BookOpen, desc: "Mark attendance" },
  { value: "student", label: "Student", icon: GraduationCap, desc: "View attendance" },
];

/* ---------- Remembered accounts on this device ---------- */
const REMEMBER_KEY = "attendify:remembered_accounts";
const PW_KEY = "attendify:remembered_pw";
const DEVICE_KEY = "attendify:device_key";
type RememberedAccount = { userIdText: string; fullName?: string; lastUsedAt: number };

function getDeviceKey(): string {
  if (typeof window === "undefined") return "x";
  let k = localStorage.getItem(DEVICE_KEY);
  if (!k) {
    k = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(DEVICE_KEY, k);
  }
  return k;
}
function obfuscate(text: string): string {
  const key = getDeviceKey();
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key.charCodeAt(i % key.length);
  let bin = ""; for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return btoa(bin);
}
function deobfuscate(b64: string): string {
  try {
    const key = getDeviceKey();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    return new TextDecoder().decode(bytes);
  } catch { return ""; }
}
function loadPwMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PW_KEY) || "{}") || {}; } catch { return {}; }
}
function savePassword(userIdText: string, password: string) {
  if (typeof window === "undefined") return;
  const map = loadPwMap();
  map[userIdText] = obfuscate(password);
  localStorage.setItem(PW_KEY, JSON.stringify(map));
}
function readPassword(userIdText: string): string {
  const map = loadPwMap();
  return map[userIdText] ? deobfuscate(map[userIdText]) : "";
}
function forgetPassword(userIdText: string) {
  if (typeof window === "undefined") return;
  const map = loadPwMap();
  delete map[userIdText];
  localStorage.setItem(PW_KEY, JSON.stringify(map));
}

function loadRemembered(): RememberedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.userIdText === "string")
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  } catch { return []; }
}
function rememberAccount(a: Omit<RememberedAccount, "lastUsedAt">) {
  if (typeof window === "undefined") return;
  const list = loadRemembered().filter((x) => x.userIdText !== a.userIdText);
  list.unshift({ ...a, lastUsedAt: Date.now() });
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(list.slice(0, 6)));
}
function forgetAccount(userIdText: string) {
  if (typeof window === "undefined") return;
  const list = loadRemembered().filter((x) => x.userIdText !== userIdText);
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(list));
  forgetPassword(userIdText);
}
function hasSavedPassword(userIdText: string): boolean {
  return !!loadPwMap()[userIdText];
}

export function AuthScreen() {
  const [mode, setMode] = React.useState<"login" | "signup" | "forgot">("login");
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [userId, setUserId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [remembered, setRemembered] = React.useState<RememberedAccount[]>(() => loadRemembered());
  const passwordRef = React.useRef<HTMLInputElement | null>(null);
  const { refresh } = useAuth();
  const resetPw = useServerFn(resetPasswordWithRecovery);

  function pickAccount(a: RememberedAccount) {
    setMode("login");
    setUserId(a.userIdText);
    setPassword("");
    setShowPassword(false);
    setTimeout(() => passwordRef.current?.focus(), 30);
  }
  function removeAccount(e: React.MouseEvent, uid: string) {
    e.stopPropagation();
    forgetAccount(uid);
    setRemembered(loadRemembered());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "forgot") {
      if (!userId.trim() || !email.trim() || !password) {
        toast.error("Fill all fields");
        return;
      }
      setBusy(true);
      try {
        await resetPw({ data: { userIdText: userId.trim().toLowerCase(), recoveryEmail: email.trim(), newPassword: password } });
        toast.success("Password reset. You can now log in.");
        setMode("login");
        setPassword("");
        setEmail("");
      } catch (err: any) {
        toast.error(err.message || "Could not reset password");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!userId.trim() || !password) { toast.error("Enter ID and password"); return; }
    if (mode === "signup" && !fullName.trim()) { toast.error("Enter full name"); return; }
    if (mode === "signup" && !email.trim()) { toast.error("Enter recovery email"); return; }
    if (mode === "signup" && !role) { toast.error("Select a role"); return; }
    setBusy(true);
    try {
      const authEmail = idToEmail(userId);
      if (mode === "signup") {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id_text", userId.trim().toLowerCase())
          .maybeSingle();
        if (existing) { toast.error("Username already taken"); setBusy(false); return; }

        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { user_id_text: userId.trim().toLowerCase(), full_name: fullName.trim() } },
        });
        if (error) {
          if (error.message.toLowerCase().includes("registered")) throw new Error("Username already taken");
          throw error;
        }
        const uid = data.user?.id;
        if (uid) {
          if (!data.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password });
            if (signInError) throw signInError;
          }
          const { error: pErr } = await supabase.from("profiles").insert({
            id: uid, user_id_text: userId.trim().toLowerCase(), full_name: fullName.trim(), recovery_email: email.trim().toLowerCase(),
          });
          if (pErr && !pErr.message.includes("duplicate")) throw pErr;
          const { error: rErr } = await supabase.from("user_roles").insert({ user_id: uid, role: role! });
          if (rErr && !rErr.message.includes("duplicate")) throw rErr;
        }
        rememberAccount({ userIdText: userId.trim().toLowerCase(), fullName: fullName.trim() });
        await refresh();
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) {
          if (error.message.toLowerCase().includes("invalid")) throw new Error("Wrong ID or password");
          throw error;
        }
        rememberAccount({ userIdText: userId.trim().toLowerCase() });
        toast.success("Welcome back");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const showRemembered = mode === "login" && remembered.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="blue-gradient h-44 rounded-b-[2.5rem] px-6 pt-12 text-white">
        <h1 className="brand-font text-4xl !text-white" style={{ background: "none", WebkitTextFillColor: "white" }}>Attendify</h1>
      </div>

      <div className="-mt-20 px-5 pb-8 space-y-4">
        {showRemembered && (
          <div className="card-soft rounded-3xl border bg-card p-4">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Log in as</p>
            <div className="space-y-2">
              {remembered.map((a) => (
                <button
                  type="button"
                  key={a.userIdText}
                  onClick={() => pickAccount(a)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full blue-gradient text-base font-bold text-white">
                    {(a.fullName || a.userIdText)[0]?.toUpperCase() || <UserIcon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {a.fullName && <p className="truncate text-sm font-semibold">{a.fullName}</p>}
                    <p className="truncate text-xs text-muted-foreground">@{a.userIdText}</p>
                    <p className="mt-0.5 select-none font-mono text-xs tracking-widest text-muted-foreground/70">••••••••</p>
                  </div>
                  <span
                    onClick={(e) => removeAccount(e, a.userIdText)}
                    role="button"
                    aria-label={`Remove ${a.userIdText}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card-soft rounded-3xl border bg-card p-5">
          {mode !== "forgot" ? (
            <div className="flex gap-2 rounded-full bg-secondary p-1">
              {(["login", "signup"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
                  {m === "login" ? "Log in" : "Create account"}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => { setMode("login"); setPassword(""); }} className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <ArrowLeft className="h-4 w-4" /> Back to log in
            </button>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "forgot" && (
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Reset password</h2>
                <p className="text-xs text-muted-foreground">Enter your ID and the recovery email you registered with.</p>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Stuti Shetty" className="rounded-xl h-11" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="uid">ID</Label>
              <Input id="uid" autoCapitalize="none" autoCorrect="off" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. stuti001" className="rounded-xl h-11" />
            </div>
            {(mode === "signup" || mode === "forgot") && (
              <div className="space-y-1.5">
                <Label htmlFor="email">{mode === "signup" ? "Recovery email" : "Registered email"}</Label>
                <Input id="email" type="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enter your email id" className="rounded-xl h-11" />
                {mode === "signup" && (
                  <p className="text-[11px] text-muted-foreground">Used only to recover your account if you forget your password.</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pw">{mode === "forgot" ? "New password" : "Password"}</Label>
              <div className="relative">
                <Input
                  id="pw"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "forgot" ? "Choose a new password" : "Enter password"}
                  className="rounded-xl h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "login" && (
                <div className="pt-1 text-right">
                  <button type="button" onClick={() => { setMode("forgot"); setPassword(""); setEmail(""); }} className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}
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
              {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
