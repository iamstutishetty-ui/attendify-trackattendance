import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/accounts.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Search, BarChart3, CalendarDays, AlertTriangle,
  Settings as SettingsIcon, X, Plus, Check, XCircle, MinusCircle,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "dashboard" | "calendar" | "defaulters" | "settings";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "defaulters", label: "Defaulters", icon: AlertTriangle },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

interface SavedClass {
  id: string;
  name: string;
  semester: string;
  academic_year: string;
  class_code: string;
  teacher_name: string;
  total_students: number;
}

const STORAGE_KEY = "admin.savedClasses.v1";

function loadSaved(): SavedClass[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveSaved(list: SavedClass[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* shared hook so all tabs see the same list */
function useSavedClasses() {
  const [list, setList] = React.useState<SavedClass[]>(() => loadSaved());
  React.useEffect(() => {
    const onStorage = () => setList(loadSaved());
    window.addEventListener("storage", onStorage);
    window.addEventListener("admin:saved-classes", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("admin:saved-classes", onStorage);
    };
  }, []);
  const update = (next: SavedClass[]) => {
    saveSaved(next);
    setList(next);
    window.dispatchEvent(new Event("admin:saved-classes"));
  };
  return [list, update] as const;
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
  const [saved, setSaved] = useSavedClasses();
  const [code, setCode] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = React.useState(false);
  const [stats, setStats] = React.useState<Record<string, { present: number; absent: number; pct: number }>>({});
  const [openClass, setOpenClass] = React.useState<SavedClass | null>(null);

  async function addCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    if (saved.some((s) => s.class_code.toUpperCase() === code.trim().toUpperCase())) {
      setCode("");
      return toast.error("Class already added");
    }
    setAdding(true);
    const { data, error } = await supabase.rpc("admin_get_class_by_code", { _code: code.trim() });
    setAdding(false);
    const row = (data as any[])?.[0];
    if (error || !row) return toast.error(error?.message || "No class with that code");
    const next: SavedClass = {
      id: row.id, name: row.name, semester: row.semester, academic_year: row.academic_year,
      class_code: row.class_code, teacher_name: row.teacher_name,
      total_students: Number(row.total_students),
    };
    setSaved([next, ...saved]);
    setCode("");
    toast.success("Class added");
  }

  function removeCode(id: string) {
    setSaved(saved.filter((s) => s.id !== id));
  }

  const reloadStats = React.useCallback(async () => {
    const out: typeof stats = {};
    for (const c of saved) {
      const { data: att } = await supabase
        .from("attendance_records").select("status").eq("class_id", c.id).eq("date", date);
      const list = (att as any[]) ?? [];
      const present = list.filter((a) => a.status === "present").length;
      const absent = list.length - present;
      const marked = list.length;
      out[c.id] = { present, absent, pct: marked === 0 ? 0 : Math.round((present / marked) * 100) };
    }
    setStats(out);
  }, [saved, date]);

  React.useEffect(() => { reloadStats(); }, [reloadStats]);

  // Realtime sync of attendance for saved classes
  React.useEffect(() => {
    if (saved.length === 0) return;
    const ch = supabase.channel(`admin-att:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => reloadStats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [saved, date, reloadStats]);

  return (
    <section className="space-y-4">
      <Card className="rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Add class by code</p></div>
        <form onSubmit={addCode} className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. AB12CD" className="h-11 rounded-xl uppercase tracking-wider" />
          <Button type="submit" disabled={adding} className="h-11 rounded-xl">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
          </Button>
        </form>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
      </Card>

      {saved.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">No classes added yet</p>
      ) : (
        <div className="space-y-2">
          {saved.map((c) => {
            const s = stats[c.id] ?? { present: 0, absent: 0, pct: 0 };
            return (
              <Card key={c.id} className="card-soft rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setOpenClass(c)} className="min-w-0 text-left flex-1">
                    <p className="text-base font-bold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.teacher_name} · Sem {c.semester} · {c.academic_year}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Code <span className="font-mono font-bold">{c.class_code}</span> · Tap to view students</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl px-3 py-1 text-lg font-bold" style={{ background: "oklch(0.95 0.08 145)", color: "oklch(0.45 0.15 145)" }}>{s.pct}%</div>
                    <button onClick={() => removeCode(c.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20" aria-label="Remove">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button onClick={() => setOpenClass(c)} className="grid grid-cols-3 gap-2 text-center text-xs w-full">
                  <Stat label="Enrolled" value={c.total_students} />
                  <Stat label="Present" value={s.present} tone="success" />
                  <Stat label="Absent" value={s.absent} tone="danger" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <ClassDetailDialog cls={openClass} initialDate={date} onClose={() => setOpenClass(null)} />
    </section>
  );
}

/* -------------------- CLASS DETAIL DIALOG -------------------- */
interface StudentRow { student_id: string; name: string; roll: string; status: "present" | "absent" | "unmarked"; }

function ClassDetailDialog({ cls, initialDate, onClose }: { cls: SavedClass | null; initialDate: string; onClose: () => void }) {
  const [date, setDate] = React.useState(initialDate);
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { setDate(initialDate); }, [initialDate, cls?.id]);

  React.useEffect(() => {
    if (!cls) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: enrolls }, { data: att }] = await Promise.all([
        supabase.from("class_enrollments")
          .select("student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)")
          .eq("class_id", cls.id),
        supabase.from("attendance_records").select("student_id, status").eq("class_id", cls.id).eq("date", date),
      ]);
      const statusBy: Record<string, "present" | "absent"> = {};
      (att as any[] ?? []).forEach((a) => { statusBy[a.student_id] = a.status as any; });
      const list: StudentRow[] = (enrolls as any[] ?? []).map((e) => ({
        student_id: e.student_id,
        name: e.profiles?.full_name || e.profiles?.user_id_text || "Student",
        roll: e.roll_number || e.profiles?.user_id_text || "",
        status: statusBy[e.student_id] ?? "unmarked",
      })).sort((a, b) => (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true }));
      if (!cancelled) { setRows(list); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [cls, date]);

  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const unmarked = rows.filter((r) => r.status === "unmarked").length;

  return (
    <Dialog open={!!cls} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{cls?.name}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{cls?.teacher_name} · {cls?.class_code}</p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Select date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl mt-1" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Present" value={present} tone="success" />
            <Stat label="Absent" value={absent} tone="danger" />
            <Stat label="Unmarked" value={unmarked} />
          </div>

          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-6"><Loader2 className="inline h-4 w-4 animate-spin" /></p>
          ) : rows.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No students enrolled.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.student_id} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">Roll {r.roll || "—"}</p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: "present" | "absent" | "unmarked" }) {
  if (status === "present") return <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "oklch(0.95 0.08 145)", color: "oklch(0.45 0.15 145)" }}><Check className="h-3 w-3" />Present</span>;
  if (status === "absent") return <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "oklch(0.95 0.06 25)", color: "oklch(0.50 0.20 25)" }}><XCircle className="h-3 w-3" />Absent</span>;
  return <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground"><MinusCircle className="h-3 w-3" />—</span>;
}

/* -------------------- CALENDAR -------------------- */
function CalendarTab() {
  const [saved] = useSavedClasses();
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [events, setEvents] = React.useState<{ date: string; type: string }[]>([]);
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selectedId && saved.length > 0) setSelectedId(saved[0].id);
    if (selectedId && !saved.some((s) => s.id === selectedId)) setSelectedId(saved[0]?.id ?? "");
  }, [saved, selectedId]);

  React.useEffect(() => {
    if (!selectedId) { setEvents([]); return; }
    setLoading(true);
    supabase.from("calendar_events").select("date, type").eq("class_id", selectedId)
      .then(({ data }) => { setEvents((data as any[]) ?? []); setLoading(false); });
  }, [selectedId]);

  if (saved.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Add a class in the Dashboard first.</p>;
  }

  const eventMap = Object.fromEntries(events.map((e) => [e.date, e]));
  const days = monthCells(month);
  const colorOf = (t: string) =>
    t === "working" ? "bg-success/20 text-success" :
    t === "non_working" ? "bg-destructive/15 text-destructive" : "";

  const selected = saved.find((s) => s.id === selectedId);

  return (
    <section className="space-y-4">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select class" /></SelectTrigger>
        <SelectContent>
          {saved.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name} · {c.class_code}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <p className="text-center text-xs text-muted-foreground">
          Synced with <span className="font-bold">{selected.name}</span>
        </p>
      )}

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
            return (
              <div key={cell.iso} className={`grid aspect-square place-items-center rounded-lg text-[11px] font-semibold ${event ? colorOf(event.type) : "bg-secondary/50 text-muted-foreground"}`}>
                {cell.d}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px]">
          <Legend color="oklch(0.65 0.18 145)" label="Working" />
          <Legend color="oklch(0.55 0.22 25)" label="Non-working" />
        </div>
        {loading && <p className="text-center text-[10px] text-muted-foreground mt-2">Loading…</p>}
      </Card>
    </section>
  );
}

/* -------------------- DEFAULTERS -------------------- */
function DefaultersTab() {
  const [saved] = useSavedClasses();
  const [view, setView] = React.useState<"below" | "above">("below");
  const [rows, setRows] = React.useState<{ id: string; name: string; roll: string; class_name: string; present: number; total: number; pct: number }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (saved.length === 0) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all: typeof rows = [];
      for (const c of saved) {
        const [{ data: enrolls }, { data: att }] = await Promise.all([
          supabase.from("class_enrollments").select("student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)").eq("class_id", c.id),
          supabase.from("attendance_records").select("student_id, status").eq("class_id", c.id),
        ]);
        const byStudent: Record<string, { p: number; t: number }> = {};
        (att as any[] ?? []).forEach((a) => {
          byStudent[a.student_id] = byStudent[a.student_id] || { p: 0, t: 0 };
          byStudent[a.student_id].t += 1;
          if (a.status === "present") byStudent[a.student_id].p += 1;
        });
        (enrolls as any[] ?? []).forEach((e) => {
          const st = byStudent[e.student_id] ?? { p: 0, t: 0 };
          all.push({
            id: `${c.id}:${e.student_id}`,
            name: e.profiles?.full_name || "Student",
            roll: e.roll_number || e.profiles?.user_id_text || "",
            class_name: c.name,
            present: st.p, total: st.t,
            pct: st.t === 0 ? 100 : Math.round((st.p / st.t) * 100),
          });
        });
      }
      if (!cancelled) { setRows(all.sort((a, b) => a.pct - b.pct)); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [saved]);

  if (saved.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Add a class in the Dashboard first.</p>;
  }

  const filtered = view === "below" ? rows.filter((r) => r.pct < 75) : rows.filter((r) => r.pct >= 75);

  return (
    <section className="space-y-4">
      <div className="flex gap-2 rounded-full bg-secondary p-1">
        {[{ v: "below" as const, l: "Below 75%" }, { v: "above" as const, l: "Above 75%" }].map(({ v, l }) => (
          <button key={v} onClick={() => setView(v)} className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-6"><Loader2 className="inline h-4 w-4 animate-spin" /></p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">None</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const color = r.pct >= 85 ? "oklch(0.55 0.18 145)" : r.pct >= 75 ? "oklch(0.70 0.16 85)" : "oklch(0.55 0.22 25)";
            return (
              <Card key={r.id} className="rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.roll} · {r.class_name} · {r.present}/{r.total} classes</p>
                  </div>
                  <span className="text-lg font-bold shrink-0" style={{ color }}>{r.pct}%</span>
                </div>
              </Card>
            );
          })}
        </div>
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
