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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

/* Saved classes are persisted in the database (admin_saved_classes table)
   so they never disappear when the browser is cleared. */
function useSavedClasses() {
  const [list, setList] = React.useState<SavedClass[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const reload = React.useCallback(async () => {
    const { data: rows } = await (supabase as any)
      .from("admin_saved_classes")
      .select("class_id")
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r: any) => r.class_id);
    if (ids.length === 0) { setList([]); setLoaded(true); return; }
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, semester, academic_year, class_code, teacher_id")
      .in("id", ids);
    const teacherIds = Array.from(new Set((classes ?? []).map((c: any) => c.teacher_id)));
    const { data: profs } = await supabase
      .from("profiles").select("id, full_name, user_id_text").in("id", teacherIds);
    const { data: enrollCounts } = await supabase
      .from("class_enrollments").select("class_id").in("class_id", ids);
    const counts: Record<string, number> = {};
    (enrollCounts ?? []).forEach((e: any) => { counts[e.class_id] = (counts[e.class_id] ?? 0) + 1; });
    const byId: Record<string, any> = {};
    (classes ?? []).forEach((c: any) => {
      const p = (profs ?? []).find((x: any) => x.id === c.teacher_id);
      byId[c.id] = {
        id: c.id, name: c.name, semester: c.semester, academic_year: c.academic_year,
        class_code: c.class_code,
        teacher_name: p?.full_name || p?.user_id_text || "—",
        total_students: counts[c.id] ?? 0,
      };
    });
    setList(ids.map((id: string) => byId[id]).filter(Boolean));
    setLoaded(true);
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  React.useEffect(() => {
    const ch = supabase.channel("admin-saved-classes")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_saved_classes" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  const addClass = async (cls: SavedClass) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("admin_saved_classes")
      .insert({ admin_id: user.id, class_id: cls.id });
    await reload();
  };
  const removeClass = async (classId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("admin_saved_classes")
      .delete().eq("admin_id", user.id).eq("class_id", classId);
    await reload();
  };

  return { list, loaded, addClass, removeClass } as const;
}

export function AdminApp() {
  const [tab, setTab] = React.useState<Tab>("dashboard");
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main className="px-4 pt-4">
        <div key={tab} className="animate-fade-in">
          {tab === "dashboard" && <DashboardTab />}
          {tab === "calendar" && <CalendarTab />}
          {tab === "defaulters" && <DefaultersTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
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
  const { list: saved, addClass, removeClass } = useSavedClasses();
  const [code, setCode] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = React.useState(false);
  const [stats, setStats] = React.useState<Record<string, { present: number; absent: number; pct: number }>>({});
  const [openClass, setOpenClass] = React.useState<SavedClass | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<SavedClass | null>(null);

  async function addCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return toast.error("Enter a class code");
    if (saved.some((s: SavedClass) => s.class_code.toUpperCase() === code.trim().toUpperCase())) {
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
    await addClass(next);
    setCode("");
    toast.success("Class added");
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
                    <div className="rounded-xl px-3 py-1 text-lg font-bold text-white" style={{ background: "#1DB954" }}>{s.pct}%</div>
                    <button onClick={() => setConfirmRemove(c)} className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20" aria-label="Remove">
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

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this class?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this class? All attendance data for this class will be permanently lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmRemove) {
                  await removeClass(confirmRemove.id);
                  toast.success("Class removed");
                }
                setConfirmRemove(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* -------------------- CLASS DETAIL DIALOG -------------------- */
interface StudentRow { student_id: string; name: string; roll: string; status: "present" | "absent" | "unmarked"; }

function ClassDetailDialog({ cls, initialDate, onClose }: { cls: SavedClass | null; initialDate: string; onClose: () => void }) {
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const date = initialDate;

  const loadDetail = React.useCallback(async () => {
    if (!cls) return;
    setLoading(true);
    const [{ data: enrolls }, { data: att }] = await Promise.all([
      supabase.from("class_enrollments")
        .select("student_id, roll_number")
        .eq("class_id", cls.id),
      supabase.from("attendance_records").select("student_id, status").eq("class_id", cls.id).eq("date", date),
    ]);
    const enrollList = (enrolls as any[]) ?? [];
    const studentIds = enrollList.map((e) => e.student_id);
    const profMap: Record<string, { full_name: string; user_id_text: string }> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, user_id_text").in("id", studentIds);
      (profs as any[] ?? []).forEach((p) => { profMap[p.id] = { full_name: p.full_name, user_id_text: p.user_id_text }; });
    }
    const statusBy: Record<string, "present" | "absent"> = {};
    (att as any[] ?? []).forEach((a) => { statusBy[a.student_id] = a.status as any; });
    const list: StudentRow[] = enrollList.map((e) => {
      const p = profMap[e.student_id];
      return {
        student_id: e.student_id,
        name: p?.full_name || p?.user_id_text || "Student",
        roll: e.roll_number || p?.user_id_text || "",
        status: statusBy[e.student_id] ?? "unmarked",
      };
    }).sort((a, b) => (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true }));
    setRows(list);
    setLoading(false);
  }, [cls, date]);

  React.useEffect(() => { loadDetail(); }, [loadDetail]);

  React.useEffect(() => {
    if (!cls) return;
    const ch = supabase.channel(`admin-detail:${cls.id}:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records", filter: `class_id=eq.${cls.id}` }, () => loadDetail())
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments", filter: `class_id=eq.${cls.id}` }, () => loadDetail())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cls, date, loadDetail]);

  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const unmarked = rows.filter((r) => r.status === "unmarked").length;

  return (
    <Dialog open={!!cls} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{cls?.name}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{cls?.teacher_name} · {cls?.class_code} · {date}</p>
        </DialogHeader>

        <div className="space-y-3">
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
  if (status === "present") return <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: "#1DB954" }}><Check className="h-3 w-3" />Present</span>;
  if (status === "absent") return <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: "#E74C3C" }}><XCircle className="h-3 w-3" />Absent</span>;
  return <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground"><MinusCircle className="h-3 w-3" />—</span>;
}

/* -------------------- CALENDAR -------------------- */
function CalendarTab() {
  const [allClassIds, setAllClassIds] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState<Record<string, string>>({}); // date -> type
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [busy, setBusy] = React.useState(false);

  const loadAll = React.useCallback(async () => {
    const { data: cls } = await supabase.from("classes").select("id");
    const ids = (cls as any[] ?? []).map((c) => c.id);
    setAllClassIds(ids);
    if (ids.length === 0) { setEvents({}); return; }
    const { data } = await supabase.from("calendar_events").select("date, type, class_id").in("class_id", ids);
    // Aggregate per date — priority: college_event > non_working > working
    const priority: Record<string, number> = { working: 1, non_working: 2, college_event: 3 };
    const out: Record<string, string> = {};
    (data as any[] ?? []).forEach((e) => {
      const cur = out[e.date];
      if (!cur || (priority[e.type] ?? 0) > (priority[cur] ?? 0)) out[e.date] = e.type;
    });
    setEvents(out);
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: re-aggregate when anything changes (teacher attendance writes working days too)
  React.useEffect(() => {
    const ch = supabase.channel("admin-cal-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  async function cycleDate(iso: string) {
    if (allClassIds.length === 0) { toast.error("No classes yet"); return; }
    const cur = events[iso];
    // none → working → non_working → college_event → none
    const next: "working" | "non_working" | "college_event" | null =
      !cur ? "working" :
      cur === "working" ? "non_working" :
      cur === "non_working" ? "college_event" :
      null;
    setBusy(true);
    if (next === null) {
      await supabase.from("calendar_events").delete().in("class_id", allClassIds).eq("date", iso);
    } else {
      const title = next === "working" ? "Working day" : next === "non_working" ? "Non-working" : "College event";
      const rows = allClassIds.map((cid) => ({ class_id: cid, date: iso, type: next, title }));
      await supabase.from("calendar_events").upsert(rows, { onConflict: "class_id,date" });
    }
    setBusy(false);
    loadAll();
  }

  const days = monthCells(month);
  const colorOf = (t: string | undefined) =>
    t === "working" ? "bg-success/20 text-success" :
    t === "non_working" ? "bg-destructive/15 text-destructive" :
    t === "college_event" ? "bg-[oklch(0.80_0.15_250)] text-[oklch(0.30_0.18_250)]" :
    "bg-secondary text-foreground/70";

  return (
    <section className="space-y-4">
      <p className="text-center text-xs text-muted-foreground">Applies to <span className="font-bold">all classes</span></p>
      <Card className="mx-auto w-full max-w-sm rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">‹</button>
          <p className="text-sm font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">›</button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Tap to cycle: Working → Non-working → College event → Clear</p>
        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {days.map((cell, i) => {
            if (!cell) return <div key={i} />;
            return (
              <button key={cell.iso} disabled={busy} onClick={() => cycleDate(cell.iso)}
                className={`grid aspect-square place-items-center rounded-lg text-[11px] font-semibold transition ${colorOf(events[cell.iso])}`}>
                {cell.d}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px]">
          <Legend color="#1DB954" label="Working" />
          <Legend color="#E74C3C" label="Non-working" />
          <Legend color="oklch(0.70 0.18 250)" label="College event" />
        </div>
      </Card>
    </section>
  );
}

/* -------------------- DEFAULTERS -------------------- */
function DefaultersTab() {
  const [view, setView] = React.useState<"below" | "above">("below");
  const [rows, setRows] = React.useState<{ id: string; name: string; roll: string; class_name: string; present: number; total: number; pct: number }[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    // Pull every class admin can see
    const { data: classes } = await supabase.from("classes").select("id, name");
    const classList = (classes as any[]) ?? [];
    if (classList.length === 0) { setRows([]); setLoading(false); return; }

    const classIds = classList.map((c) => c.id);
    const [{ data: enrolls }, { data: att }, { data: ev }] = await Promise.all([
      supabase.from("class_enrollments").select("class_id, student_id, roll_number").in("class_id", classIds),
      supabase.from("attendance_records").select("class_id, student_id, status, date").in("class_id", classIds),
      supabase.from("calendar_events").select("class_id, date, type").in("class_id", classIds),
    ]);

    const enrollList = (enrolls as any[]) ?? [];
    const attList = (att as any[]) ?? [];
    const evList = (ev as any[]) ?? [];

    // Profiles
    const studentIds = Array.from(new Set(enrollList.map((e) => e.student_id)));
    const profMap: Record<string, { full_name: string; user_id_text: string }> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, user_id_text").in("id", studentIds);
      (profs as any[] ?? []).forEach((p) => { profMap[p.id] = { full_name: p.full_name, user_id_text: p.user_id_text }; });
    }

    // Per-class non-working day set
    const nonWorkingByClass: Record<string, Set<string>> = {};
    evList.forEach((e) => {
      if (e.type === "non_working" || e.type === "holiday" || e.type === "college_event") {
        (nonWorkingByClass[e.class_id] ||= new Set()).add(e.date);
      }
    });
    // Per-class working day set (dates where attendance recorded, excluding non-working)
    const workingByClass: Record<string, Set<string>> = {};
    attList.forEach((a) => {
      const nw = nonWorkingByClass[a.class_id];
      if (!nw || !nw.has(a.date)) (workingByClass[a.class_id] ||= new Set()).add(a.date);
    });
    // Per-(class,student) present count
    const presentBy: Record<string, number> = {};
    attList.forEach((a) => {
      const nw = nonWorkingByClass[a.class_id];
      if (a.status === "present" && (!nw || !nw.has(a.date))) {
        const k = `${a.class_id}:${a.student_id}`;
        presentBy[k] = (presentBy[k] || 0) + 1;
      }
    });

    const classNameById: Record<string, string> = {};
    classList.forEach((c) => { classNameById[c.id] = c.name; });

    const out = enrollList.map((e) => {
      const total = workingByClass[e.class_id]?.size ?? 0;
      const present = presentBy[`${e.class_id}:${e.student_id}`] ?? 0;
      const p = profMap[e.student_id];
      return {
        id: `${e.class_id}:${e.student_id}`,
        name: p?.full_name || p?.user_id_text || "Student",
        roll: e.roll_number || p?.user_id_text || "",
        class_name: classNameById[e.class_id] || "—",
        present, total,
        pct: total === 0 ? 0 : Math.round((present / total) * 100),
      };
    }).sort((a, b) => a.pct - b.pct);

    setRows(out);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const ch = supabase.channel("admin-defaulters-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

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
      ) : rows.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">No students enrolled in any class yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">None in this category.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const color = r.pct >= 85 ? "#1DB954" : r.pct >= 75 ? "oklch(0.70 0.16 85)" : "#E74C3C";
            return (
              <Card key={r.id} className="rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.roll ? `${r.roll} · ` : ""}{r.class_name} · {r.present}/{r.total} classes</p>
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
  const bg = tone === "success" ? "#1DB954" : tone === "danger" ? "#E74C3C" : undefined;
  const color = tone ? "white" : undefined;
  return (
    <div className="rounded-xl bg-secondary p-2" style={bg ? { background: bg } : undefined}>
      <p className="font-bold" style={color ? { color } : undefined}>{value}</p>
      <p style={color ? { color } : undefined} className={tone ? "opacity-90" : "text-muted-foreground"}>{label}</p>
    </div>
  );
}
