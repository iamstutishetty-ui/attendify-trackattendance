import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Layers, ClipboardCheck, CalendarDays, AlertTriangle, User as UserIcon, Plus,
  Copy, Archive, ArchiveRestore, Search, Loader2, Check, X, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "classes" | "attendance" | "calendar" | "defaulters" | "profile";

interface ClassRow {
  id: string; name: string; semester: string; academic_year: string;
  class_code: string; teacher_id: string; archived: boolean;
}

interface CalendarEventRow { id: string; date: string; type: string; title: string; }

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "classes", label: "Classes", icon: Layers },
  { id: "attendance", label: "Mark", icon: ClipboardCheck },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "defaulters", label: "Defaulters", icon: AlertTriangle },
  { id: "profile", label: "Profile", icon: UserIcon },
];

export function TeacherApp() {
  const [tab, setTab] = React.useState<Tab>("classes");
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main className="px-4 pt-4">
        {tab === "classes" && <ClassesTab onGoToAttendance={() => setTab("attendance")} />}
        {tab === "attendance" && <AttendanceTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "defaulters" && <DefaultersTab />}
        {tab === "profile" && <ProfileTab />}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-5">
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

/* -------------------- CLASSES TAB -------------------- */
function ClassesTab({ onGoToAttendance }: { onGoToAttendance: () => void }) {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("classes").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    setClasses((data as ClassRow[]) ?? []);
    setLoading(false);
  }, [user]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = classes.filter((c) => c.archived === showArchived);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My classes</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} {showArchived ? "archived" : "active"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />New</Button>
          </DialogTrigger>
          <CreateClassDialog onCreated={(created) => { setOpen(false); setShowArchived(false); setClasses((prev) => [created, ...prev.filter((c) => c.id !== created.id)]); load(); }} />
        </Dialog>
      </div>

      <div className="flex gap-2 rounded-full bg-secondary p-1">
        {[
          { v: false, l: "Active" }, { v: true, l: "Archived" },
        ].map(({ v, l }) => (
          <button key={l} onClick={() => setShowArchived(v)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${showArchived === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" /> :
       filtered.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No {showArchived ? "archived" : "active"} classes</p>
          <p className="text-xs text-muted-foreground">Tap "New" to create one</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ClassCard key={c.id} c={c} onChange={load} onMark={onGoToAttendance} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClassCard({ c, onChange, onMark }: { c: ClassRow; onChange: () => void; onMark: () => void }) {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    supabase.from("class_enrollments").select("id", { count: "exact", head: true }).eq("class_id", c.id)
      .then(({ count }) => setCount(count ?? 0));
  }, [c.id]);

  async function toggleArchive() {
    const { error } = await supabase.from("classes").update({ archived: !c.archived }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success(c.archived ? "Restored" : "Archived"); onChange(); }
  }

  async function promote() {
    // Increment academic year
    const year = c.academic_year;
    const m = year.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
    let next = year;
    if (m) {
      const a = parseInt(m[1]) + 1;
      const b = parseInt(m[2].length === 2 ? "20" + m[2] : m[2]) + 1;
      next = `${a}-${String(b).slice(-2)}`;
    }
    const { error } = await supabase.from("classes").update({ academic_year: next, archived: false }).eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Promoted to " + next); onChange(); }
  }

  return (
    <Card className="card-soft rounded-2xl border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold">{c.name}</p>
          <p className="text-xs text-muted-foreground">Sem {c.semester} · {c.academic_year}</p>
        </div>
        <Badge variant="secondary" className="rounded-full">{count ?? "—"} students</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
        <span className="text-xs text-muted-foreground">Code</span>
        <span className="ml-auto font-mono text-sm font-semibold tracking-wider">{c.class_code}</span>
        <button onClick={() => { navigator.clipboard.writeText(c.class_code); toast.success("Copied"); }}>
          <Copy className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="default" className="flex-1 rounded-full" onClick={() => { sessionStorage.setItem("activeClass", c.id); onMark(); }}>
          <ClipboardCheck className="mr-1 h-4 w-4" />Mark
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={promote}><ArrowUpRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={toggleArchive}>
          {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function CreateClassDialog({ onCreated }: { onCreated: (created: ClassRow) => void }) {
  const { user } = useAuth();
  const [name, setName] = React.useState("");
  const [sem, setSem] = React.useState("");
  const [year, setYear] = React.useState("2025-26");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !sem || !year) return toast.error("Fill all fields");
    setBusy(true);
    const classCode = genCode();
    const { data, error } = await supabase.from("classes").insert({
      name, semester: sem, academic_year: year, class_code: classCode, teacher_id: user!.id,
    }).select("*").single();
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`Class created · Code ${classCode}`); onCreated(data as ClassRow); }
  }

  return (
    <DialogContent className="rounded-3xl">
      <DialogHeader>
        <DialogTitle>New class</DialogTitle>
        <DialogDescription>Create a class and share its code with students.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Class name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SY CSE A" className="rounded-xl h-11" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Semester</Label><Input value={sem} onChange={(e) => setSem(e.target.value)} placeholder="3" className="rounded-xl h-11" /></div>
          <div><Label>Year</Label><Input value={year} onChange={(e) => setYear(e.target.value)} className="rounded-xl h-11" /></div>
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create class
        </Button>
      </form>
    </DialogContent>
  );
}

/* -------------------- ATTENDANCE TAB -------------------- */
function AttendanceTab() {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [activeClass, setActiveClass] = React.useState<string>("");
  const [date, setDate] = React.useState(new Date());
  const [students, setStudents] = React.useState<{ id: string; name: string; roll: string }[]>([]);
  const [statuses, setStatuses] = React.useState<Record<string, "present" | "absent">>({});
  const [calendarEvents, setCalendarEvents] = React.useState<Record<string, string>>({});
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    supabase.from("classes").select("*").eq("teacher_id", user!.id).eq("archived", false).then(({ data }) => {
      const list = (data as ClassRow[]) ?? [];
      setClasses(list);
      const stored = sessionStorage.getItem("activeClass");
      setActiveClass(stored && list.find((c) => c.id === stored) ? stored : (list[0]?.id ?? ""));
    });
  }, [user]);

  const loadData = React.useCallback(async () => {
    if (!activeClass) return;
    const [{ data: enrolls }, { data: att }, { data: events }] = await Promise.all([
      supabase.from("class_enrollments").select("student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)").eq("class_id", activeClass),
      supabase.from("attendance_records").select("student_id, status").eq("class_id", activeClass).eq("date", toISODate(date)),
      supabase.from("calendar_events").select("date, type").eq("class_id", activeClass),
    ]);
    const list = (enrolls as any[] ?? []).map((e) => ({
      id: e.student_id, name: e.profiles?.full_name || e.profiles?.user_id_text || "Student",
      roll: e.roll_number || e.profiles?.user_id_text || "",
    })).sort((a, b) => a.roll.localeCompare(b.roll));
    setStudents(list);
    const map: Record<string, "present" | "absent"> = {};
    list.forEach((s) => { map[s.id] = "present"; }); // default present
    (att as any[] ?? []).forEach((a) => { map[a.student_id] = a.status; });
    setStatuses(map);
    setCalendarEvents(Object.fromEntries((events as any[] ?? []).map((e) => [e.date, e.type])));
  }, [activeClass, date]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) || s.roll.toLowerCase().includes(query.toLowerCase()));

  const presentCount = students.filter((s) => statuses[s.id] === "present").length;
  const absentCount = students.length - presentCount;

  function toggle(id: string) {
    setStatuses((p) => ({ ...p, [id]: p[id] === "present" ? "absent" : "present" }));
  }

  async function save() {
    if (!activeClass || students.length === 0) return;
    setSaving(true);
    const iso = toISODate(date);
    const rows = students.map((s) => ({
      class_id: activeClass, student_id: s.id, date: iso, status: statuses[s.id] ?? "present", marked_by: user!.id,
    }));
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "class_id,student_id,date" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Attendance saved");
  }

  const days = React.useMemo(() => monthCells(month), [month]);

  if (classes.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="No active classes" text="Create a class first to mark attendance." />;
  }

  return (
    <section className="space-y-4">
      <select value={activeClass} onChange={(e) => setActiveClass(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — Sem {c.semester}</option>)}
      </select>

      <Card className="rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-3 py-1 text-sm">‹</button>
          <div className="text-center">
            <p className="font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
            <p className="text-xs text-muted-foreground">Selected: {date.toDateString()}</p>
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-3 py-1 text-sm">›</button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const sel = cell.iso === toISODate(date);
            const type = calendarEvents[cell.iso];
            const cls = type === "working" ? "bg-success/20 text-success" : type === "non_working" ? "bg-destructive/15 text-destructive" : sel ? "blue-gradient text-white" : "bg-secondary text-foreground/70";
            return <button key={cell.iso} onClick={() => setDate(new Date(cell.iso))} className={`aspect-square rounded-xl text-xs font-bold transition ${cls} ${sel ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>{cell.d}</button>;
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Card className="rounded-2xl p-3" style={{ background: "oklch(0.95 0.08 145)" }}>
          <p className="text-xs">Present</p><p className="text-2xl font-bold" style={{ color: "oklch(0.45 0.15 145)" }}>{presentCount}</p>
        </Card>
        <Card className="rounded-2xl p-3" style={{ background: "oklch(0.95 0.05 25)" }}>
          <p className="text-xs">Absent</p><p className="text-2xl font-bold" style={{ color: "oklch(0.50 0.20 25)" }}>{absentCount}</p>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or roll" className="h-11 rounded-xl pl-9" />
      </div>

      {students.length === 0 ? (
        <Card className="rounded-2xl p-6 text-center text-sm text-muted-foreground">No students enrolled yet. Share the class code.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const present = statuses[s.id] === "present";
            return (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  present ? "border-[oklch(0.65_0.18_145)]/40 bg-[oklch(0.97_0.06_145)]" : "border-destructive/40 bg-destructive/5"
                }`}>
                <span className="font-mono text-xs font-semibold text-muted-foreground w-16 shrink-0">{s.roll}</span>
                <span className="flex-1 text-sm font-semibold">{s.name}</span>
                <span className={`grid h-9 w-9 place-items-center rounded-full ${present ? "bg-[oklch(0.65_0.18_145)] text-white" : "bg-destructive text-destructive-foreground"}`}>
                  {present ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {students.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-20 px-4">
          <Button onClick={save} disabled={saving} className="h-12 w-full rounded-2xl text-base font-semibold shadow-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save attendance
          </Button>
        </div>
      )}
    </section>
  );
}

/* -------------------- CALENDAR TAB -------------------- */
function CalendarTab() {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [activeClass, setActiveClass] = React.useState<string>("");
  const [events, setEvents] = React.useState<CalendarEventRow[]>([]);
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    supabase.from("classes").select("*").eq("teacher_id", user!.id).eq("archived", false).then(({ data }) => {
      const list = (data as ClassRow[]) ?? [];
      setClasses(list); setActiveClass(list[0]?.id ?? "");
    });
  }, [user]);

  const load = React.useCallback(async () => {
    if (!activeClass) return;
    const { data } = await supabase.from("calendar_events").select("*").eq("class_id", activeClass).order("date");
    setEvents((data as any[]) ?? []);
  }, [activeClass]);
  React.useEffect(() => { load(); }, [load]);

  async function markDate(date: string, type: "working" | "non_working") {
    if (!activeClass) return;
    const { error } = await supabase.from("calendar_events").upsert(
      { class_id: activeClass, date, type, title: type === "working" ? "Working day" : "Non-working day" },
      { onConflict: "class_id,date" },
    );
    if (error) toast.error(error.message); else { toast.success(type === "working" ? "Marked working day" : "Marked non-working day"); load(); }
  }
  function handleDateClick(date: string) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => markDate(date, "working"), 220);
  }
  function handleDateDoubleClick(date: string) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    markDate(date, "non_working");
  }
  async function remove(id: string) {
    await supabase.from("calendar_events").delete().eq("id", id); load();
  }

  if (classes.length === 0) return <EmptyState icon={CalendarDays} title="No active classes" text="Create a class first." />;

  const eventMap = Object.fromEntries(events.map((e) => [e.date, e]));
  const days = monthCells(month);
  const colorOf = (t: string) => t === "working" ? "bg-success/20 text-success" : t === "non_working" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <section className="space-y-4">
      <select value={activeClass} onChange={(e) => setActiveClass(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <Card className="rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-3 py-1 text-sm">‹</button>
          <p className="font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-3 py-1 text-sm">›</button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const event = eventMap[cell.iso];
            return <button key={cell.iso} onClick={() => handleDateClick(cell.iso)} onDoubleClick={() => handleDateDoubleClick(cell.iso)} className={`aspect-square rounded-xl text-xs font-bold transition ${event ? colorOf(event.type) : "bg-secondary text-foreground/70"}`}>{cell.d}</button>;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <Legend color="var(--success)" label="Working day" />
          <Legend color="var(--destructive)" label="Non-working day" />
        </div>
      </Card>

      <div className="space-y-2">
        {events.length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">No events yet</p> :
          events.map((e) => (
            <Card key={e.id} className="flex items-center gap-3 rounded-2xl p-3">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${colorOf(e.type)}`}>{e.type}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{e.title || e.type}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.date).toDateString()}</p>
              </div>
              <button onClick={() => remove(e.id)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </Card>
          ))}
      </div>
    </section>
  );
}

/* -------------------- DEFAULTERS TAB -------------------- */
function DefaultersTab() {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [activeClass, setActiveClass] = React.useState<string>("");
  const [rows, setRows] = React.useState<{ id: string; name: string; roll: string; present: number; total: number; pct: number }[]>([]);

  React.useEffect(() => {
    supabase.from("classes").select("*").eq("teacher_id", user!.id).eq("archived", false).then(({ data }) => {
      const list = (data as ClassRow[]) ?? [];
      setClasses(list); setActiveClass(list[0]?.id ?? "");
    });
  }, [user]);

  React.useEffect(() => {
    if (!activeClass) return;
    (async () => {
      const [{ data: enrolls }, { data: att }] = await Promise.all([
        supabase.from("class_enrollments").select("student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)").eq("class_id", activeClass),
        supabase.from("attendance_records").select("student_id, status").eq("class_id", activeClass),
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
    })();
  }, [activeClass]);

  const below = rows.filter((r) => r.pct < 75);
  const above = rows.filter((r) => r.pct >= 75);

  if (classes.length === 0) return <EmptyState icon={AlertTriangle} title="No active classes" text="Create a class first." />;

  return (
    <section className="space-y-4">
      <select value={activeClass} onChange={(e) => setActiveClass(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Section title={`Below 75% (${below.length})`} rows={below} danger />
      <Section title={`Above 75% (${above.length})`} rows={above} />
    </section>
  );
}

function Section({ title, rows, danger }: { title: string; rows: any[]; danger?: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-bold ${danger ? "text-destructive" : ""}`}>{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">None</p> :
        rows.map((r) => {
          const need = r.pct < 75 ? Math.ceil((0.75 * r.total - r.present) / 0.25) : 0;
          const color = r.pct >= 85 ? "oklch(0.55 0.18 145)" : r.pct >= 75 ? "oklch(0.70 0.16 85)" : "oklch(0.55 0.22 25)";
          return (
            <Card key={r.id} className="rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.roll} · {r.present}/{r.total} classes</p>
                </div>
                <span className="text-lg font-bold" style={{ color }}>{r.pct}%</span>
              </div>
              {need > 0 && <p className="mt-1 text-[11px] text-destructive">Need {need} more present to reach 75%</p>}
            </Card>
          );
        })}
    </div>
  );
}

/* -------------------- PROFILE TAB -------------------- */
function ProfileTab() {
  const { profile, role, signOut, refresh } = useAuth();
  const [name, setName] = React.useState(profile?.full_name ?? "");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setName(profile?.full_name ?? ""), [profile]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", profile!.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); refresh(); }
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
      <Card className="rounded-2xl p-4 space-y-3">
        <Label>Full name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        <Button onClick={save} disabled={busy} className="h-11 w-full rounded-xl">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
      </Card>
      <Button variant="destructive" onClick={signOut} className="h-11 w-full rounded-xl">Log out</Button>
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

function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <Card className="rounded-2xl p-8 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </Card>
  );
}
