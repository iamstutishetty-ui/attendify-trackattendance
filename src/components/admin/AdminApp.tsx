import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/accounts.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Users, BookOpen, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface ClassLookup {
  id: string; name: string; semester: string; academic_year: string;
  class_code: string; teacher_name: string; total_students: number;
  present: number; absent: number; pct: number;
}

interface AccountRow { id: string; user_id_text: string; full_name: string; role: string; }

export function AdminApp() {
  const { user, profile, role, signOut } = useAuth();
  const deleteMe = useServerFn(deleteMyAccount);
  const [code, setCode] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [lookup, setLookup] = React.useState<ClassLookup | null>(null);
  const [looking, setLooking] = React.useState(false);
  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [accountQuery, setAccountQuery] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const loadAccounts = React.useCallback(async () => {
    setAccountsLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, user_id_text, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map((roles as any[] ?? []).map((r) => [r.user_id, r.role]));
    setAccounts((profiles as any[] ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" })));
    setAccountsLoading(false);
  }, []);

  React.useEffect(() => { loadAccounts(); }, [loadAccounts]);

  async function doLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    setLooking(true);
    setLookup(null);
    const { data, error } = await supabase.rpc("admin_get_class_by_code", { _code: code.trim() });
    if (error) { setLooking(false); return toast.error(error.message); }
    const row = (data as any[])?.[0];
    if (!row) { setLooking(false); return toast.error("No class with that code"); }
    // Today's attendance summary for this class
    const { data: att } = await supabase
      .from("attendance_records").select("status").eq("class_id", row.id).eq("date", date);
    const list = (att as any[]) ?? [];
    const present = list.filter((a) => a.status === "present").length;
    const absent = list.length - present;
    const marked = list.length;
    setLookup({
      id: row.id, name: row.name, semester: row.semester, academic_year: row.academic_year,
      class_code: row.class_code, teacher_name: row.teacher_name,
      total_students: Number(row.total_students), present, absent,
      pct: marked === 0 ? 0 : Math.round((present / marked) * 100),
    });
    setLooking(false);
  }

  React.useEffect(() => { if (lookup) doLookup(); /* refresh on date */ }, [date]); // eslint-disable-line

  async function handleDeleteMine() {
    if (!window.confirm("Delete your admin account? This cannot be undone.")) return;
    setDeleting(true);
    try { await deleteMe(); await signOut(); toast.success("Account deleted"); }
    catch (err: any) { toast.error(err.message || "Could not delete account"); }
    finally { setDeleting(false); }
  }

  const filteredAccounts = accounts.filter((a) =>
    !accountQuery ||
    a.full_name.toLowerCase().includes(accountQuery.toLowerCase()) ||
    a.user_id_text.toLowerCase().includes(accountQuery.toLowerCase()) ||
    a.role.toLowerCase().includes(accountQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background pb-6">
      <AppHeader />
      <main className="px-4 pt-4 space-y-4">
        <Card className="rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Look up class by code</p></div>
          <form onSubmit={doLookup} className="space-y-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. AB12CD" className="h-11 rounded-xl uppercase tracking-wider" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
              <Button type="submit" disabled={looking} className="h-11 rounded-xl">
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : "View class"}
              </Button>
            </div>
          </form>
        </Card>

        {lookup && (
          <Card className="card-soft rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold">{lookup.name}</p>
                <p className="text-xs text-muted-foreground">{lookup.teacher_name} · Sem {lookup.semester} · {lookup.academic_year}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Code <span className="font-mono font-bold">{lookup.class_code}</span></p>
              </div>
              <div className="rounded-xl px-3 py-1 text-lg font-bold" style={{ background: "oklch(0.95 0.08 145)", color: "oklch(0.45 0.15 145)" }}>{lookup.pct}%</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Stat label="Enrolled" value={lookup.total_students} />
              <Stat label="Present" value={lookup.present} tone="success" />
              <Stat label="Absent" value={lookup.absent} tone="danger" />
            </div>
          </Card>
        )}

        <Card className="rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Accounts</p></div>
            <span className="text-xs text-muted-foreground">{filteredAccounts.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} placeholder="Search by name, ID, or role" className="h-11 rounded-xl pl-9" />
          </div>
          {accountsLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> :
           filteredAccounts.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No accounts found.</p> :
           <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(account.full_name || account.user_id_text || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{account.full_name || account.user_id_text}</p>
                  <p className="text-xs text-muted-foreground">@{account.user_id_text} · {account.role}</p>
                </div>
                {account.id === user?.id && <span className="text-[10px] font-bold text-primary">YOU</span>}
              </div>
            ))}
           </div>}
        </Card>

        <Card className="rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold">My account</p>
          <p className="text-xs text-muted-foreground">{profile?.full_name} · @{profile?.user_id_text} · {role}</p>
          <Button variant="outline" onClick={signOut} className="h-11 w-full rounded-xl">Log out</Button>
          <Button variant="destructive" disabled={deleting} onClick={handleDeleteMine} className="h-11 w-full rounded-xl">
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete my account
          </Button>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const bg = tone === "success" ? "oklch(0.96 0.08 145)" : tone === "danger" ? "oklch(0.96 0.06 25)" : undefined;
  const color = tone === "success" ? "oklch(0.45 0.15 145)" : tone === "danger" ? "oklch(0.50 0.20 25)" : undefined;
  return (
    <div className="rounded-xl bg-secondary p-2" style={bg ? { background: bg } : undefined}>
      <p className="font-bold" style={color ? { color } : undefined}>{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
