import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/accounts.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, BarChart3, CalendarDays, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

type Tab = "dashboard" | "calendar" | "defaulters" | "settings";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "defaulters", label: "Defaulters", icon: AlertTriangle },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

interface ClassLookup {
  id: string; name: string; semester: string; academic_year: string;
  class_code: string; teacher_name: string; total_students: number;
  present: number; absent: number; pct: number;
}

export function AdminApp() {
  const [tab, setTab] = React.useState<Tab>("dashboard");
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main className="px-4 pt-4">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "defaulters" && <DefaultersTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${tab === id ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`grid h-9 w-9 place-items-center rounded-xl ${tab === id ? "bg-primary/15" : ""}`}>
                <Icon className="h-5 w-5" />
              </div>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* -------------------- DASHBOARD -------------------- */
function DashboardTab() {
  const [code, setCode] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [lookup, setLookup] = React.useState<ClassLookup | null>(null);
  const [looking, setLooking] = React.useState(false);

  async function doLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    setLooking(true);
    setLookup(null);
    const { data, error } = await supabase.rpc("admin_get_class_by_code", { _code: code.trim() });
    if (error) { setLooking(false); return toast.error(error.message); }
    const row = (data as any[])?.[0];
    if (!row) { setLooking(false); return toast.error("No class with that code"); }
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

  return (
    <section className="space-y-4">
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
    </section>
  );
}

/* -------------------- CALENDAR -------------------- */
function CalendarTab() {
  const [code, setCode] = React.useState("");
  const [classInfo, setClassInfo] = React.useState<{ id: string; name: string } | null>(null);
  const [events, setEvents] = React.useState<{ date: string; type: string; title: string }[]>([]);
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [loading, setLoading] = React.useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_class_by_code", { _code: code.trim() });
    const row = (data as any[])?.[0];
    if (error || !row) { setLoading(false); return toast.error(error?.message || "No class"); }
    setClassInfo({ id: row.id, name: row.name });
    const { data: evs } = await supabase.from("calendar_events").select("date, type, title").eq("class_id", row.id);
    setEvents((evs as any[]) ?? []);
    setLoading(false);
  }

  const eventMap = Object.fromEntries(events.map((e) => [e.date, e]));
  const days = monthCells(month);
  const colorOf = (t: string) =>
    t === "working" ? "bg-success/20 text-success" :
    t === "non_working" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <section className="space-y-4">
      <Card className="rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><p className="text-sm font-bold">View calendar by class code</p></div>
        <form onSubmit={lookup} className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Class code" className="h-11 rounded-xl uppercase tracking-wider" />
          <Button type="submit" disabled={loading} className="h-11 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
          </Button>
        </form>
      </Card>

      {classInfo && (
        <>
          <p className="text-center text-xs text-muted-foreground">Calendar for <span className="font-bold">{classInfo.name}</span> (read-only, synced with teacher)</p>
          <Card className="mx-auto w-full max-w-sm rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">‹</button>
              <p className="text-sm font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">›</button>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground">
              {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {days.map((cell, i) => {
                if (!cell) return <div key={i} />;
                const event = eventMap[cell.iso];
                return <div key={cell.iso} className={`grid aspect-square place-items-center rounded-lg text-[11px] font-semibold ${event ? colorOf(event.type) : "bg-secondary text-foreground/70"}`}>{cell.d}</div>;
              })}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px]">
              <Legend color="oklch(0.65 0.18 145)" label="Working" />
              <Legend color="oklch(0.55 0.22 25)" label="Non-working" />
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

/* -------------------- DEFAULTERS -------------------- */
function DefaultersTab() {
  const [code, setCode] = React.useState("");
  const [classInfo, setClassInfo] = React.useState<{ id: string; name: string } | null>(null);
  const [view, setView] = React.useState<"below" | "above">("below");
  const [rows, setRows] = React.useState<{ id: string; name: string; roll: string; present: number; total: number; pct: number }[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_class_by_code", { _code: code.trim() });
    const row = (data as any[])?.[0];
    if (error || !row) { setLoading(false); return toast.error(error?.message || "No class"); }
    setClassInfo({ id: row.id, name: row.name });

    const [{ data: enrolls }, { data: att }] = await Promise.all([
      supabase.from("class_enrollments").select("student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)").eq("class_id", row.id),
      supabase.from("attendance_records").select("student_id, status").eq("class_id", row.id),
    ]);
    const byStudent: Record<string, { p: number; t: number }> = {};
    (att as any[] ?? []).forEach((a) => {
      byStudent[a.student_id] = byStudent[a.student_id] || { p: 0, t: 0 };
      byStudent[a.student_id].t += 1;
      if (a.status === "present") byStudent[a.student_id].p += 1;
    });
    const list = (enrolls as any[] ?? []).map((e) => {
      const st = byStudent[e.student_id] ?? { p: 0, t: 0 };
      return {
        id: e.student_id,
        name: e.profiles?.full_name || "Student",
        roll: e.roll_number || e.profiles?.user_id_text || "",
        present: st.p, total: st.t,
        pct: st.t === 0 ? 100 : Math.round((st.p / st.t) * 100),
      };
    }).sort((a, b) => a.pct - b.pct);
    setRows(list);
    setLoading(false);
  }

  const filtered = classInfo ? (view === "below" ? rows.filter((r) => r.pct < 75) : rows.filter((r) => r.pct >= 75)) : [];

  return (
    <section className="space-y-4">
      <Card className="rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Defaulters by class code</p></div>
        <form onSubmit={lookup} className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Class code" className="h-11 rounded-xl uppercase tracking-wider" />
          <Button type="submit" disabled={loading} className="h-11 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
          </Button>
        </form>
      </Card>

      {classInfo && (
        <>
          <div className="flex gap-2 rounded-full bg-secondary p-1">
            {[{ v: "below" as const, l: "Below 75%" }, { v: "above" as const, l: "Above 75%" }].map(({ v, l }) => (
              <button key={v} onClick={() => setView(v)} className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">Class: <span className="font-bold">{classInfo.name}</span></p>
          <div className="space-y-2">
            {filtered.length === 0 ? <p className="text-center text-xs text-muted-foreground py-6">None</p> :
              filtered.map((r) => {
                const color = r.pct >= 85 ? "oklch(0.55 0.18 145)" : r.pct >= 75 ? "oklch(0.70 0.16 85)" : "oklch(0.55 0.22 25)";
                return (
                  <Card key={r.id} className="rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.roll} · {classInfo.name} · {r.present}/{r.total} classes</p>
                      </div>
                      <span className="text-lg font-bold" style={{ color }}>{r.pct}%</span>
                    </div>
                  </Card>
                );
              })}
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------- SETTINGS -------------------- */
function SettingsTab() {
  const { profile, role, signOut } = useAuth();
  const deleteMe = useServerFn(deleteMyAccount);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDeleteMine() {
    if (!window.confirm("Delete your admin account? This cannot be undone.")) return;
    setDeleting(true);
    try { await deleteMe(); await signOut(); toast.success("Account deleted"); }
    catch (err: any) { toast.error(err.message || "Could not delete account"); }
    finally { setDeleting(false); }
  }

  return (
    <section className="space-y-4">
      <Card className="card-soft rounded-3xl p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full blue-gradient text-3xl font-bold text-white">
          {(profile?.full_name || profile?.user_id_text || "?")[0].toUpperCase()}
        </div>
        <p className="mt-3 text-lg font-bold">{profile?.full_name}</p>
        <p className="text-xs text-muted-foreground">@{profile?.user_id_text} · {role}</p>
      </Card>
      <Button variant="outline" onClick={signOut} className="h-11 w-full rounded-xl">Log out</Button>
      <Button variant="destructive" disabled={deleting} onClick={handleDeleteMine} className="h-11 w-full rounded-xl">
        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete my account
      </Button>
    </section>
  );
}

/* helpers */
type MonthCell = { d: number; iso: string } | null;

function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthCells(month: Date): MonthCell[] {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push({ d, iso: toISODate(new Date(y, m, d)) });
  return cells;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color }} />{label}</span>;
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
