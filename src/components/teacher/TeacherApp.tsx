import * as React from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/accounts.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Layers, ClipboardCheck, CalendarDays, AlertTriangle, User as UserIcon, Plus,
  Copy, Search, Loader2, Check, X, ArrowUpRight, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "classes" | "attendance" | "calendar" | "defaulters" | "profile";
type AttendanceMode = "whole_year" | "two_semester";

interface ClassRow {
  id: string; name: string; semester: string; academic_year: string;
  class_code: string; teacher_id: string; archived: boolean;
  attendance_mode: AttendanceMode;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function academicYearOptions() {
  const out: string[] = [];
  for (let y = 2015; y <= 2035; y++) out.push(`${y}-${String(y + 1).slice(-2)}`);
  return out;
}
const YEARS = academicYearOptions();

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
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("classes").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    setClasses((data as ClassRow[]) ?? []);
    setLoading(false);
  }, [user]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My classes</h2>
          <p className="text-xs text-muted-foreground">{classes.length} total</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />New</Button>
          </DialogTrigger>
          <CreateClassDialog onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      {loading ? <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" /> :
       classes.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No classes yet</p>
          <p className="text-xs text-muted-foreground">Tap "New" to create one</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} onChange={load} onMark={onGoToAttendance} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClassCard({ c, onChange, onMark }: { c: ClassRow; onChange: () => void; onMark: () => void }) {
  const [count, setCount] = React.useState<number | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [promoteOpen, setPromoteOpen] = React.useState(false);

  React.useEffect(() => {
    supabase.from("class_enrollments").select("id", { count: "exact", head: true }).eq("class_id", c.id)
      .then(({ count }) => setCount(count ?? 0));
  }, [c.id]);

  async function deleteClass() {
    if (!window.confirm(`Delete class "${c.name}"? This removes enrollments and attendance.`)) return;
    await supabase.from("attendance_records").delete().eq("class_id", c.id);
    await supabase.from("class_enrollments").delete().eq("class_id", c.id);
    await supabase.from("calendar_events").delete().eq("class_id", c.id);
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Class deleted"); onChange(); }
  }

  return (
    <Card className="card-soft rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            Sem {c.semester} · {c.academic_year} ·{" "}
            {c.attendance_mode === "whole_year" ? "Whole-year" : "2-semester"}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full shrink-0">{count ?? "—"} students</Badge>
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
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPromoteOpen(true)} title="Promote"><ArrowUpRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)} title="Edit"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="destructive" className="rounded-full" onClick={deleteClass} title="Delete"><Trash2 className="h-4 w-4" /></Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditClassDialog c={c} onSaved={() => { setEditOpen(false); onChange(); }} />
      </Dialog>
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <PromoteDialog c={c} onDone={() => { setPromoteOpen(false); onChange(); }} />
      </Dialog>
    </Card>
  );
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* -------------------- CREATE CLASS DIALOG -------------------- */
function CreateClassDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = React.useState("");
  const [year, setYear] = React.useState("2025-26");
  const [mode, setMode] = React.useState<AttendanceMode>("two_semester");
  const [sem1, setSem1] = React.useState("1");
  const [sem1Months, setSem1Months] = React.useState<string[]>([]);
  const [sem2, setSem2] = React.useState("2");
  const [sem2Months, setSem2Months] = React.useState<string[]>([]);
  const [yearSem, setYearSem] = React.useState("1"); // semester label when whole-year
  const [yearMonths, setYearMonths] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  function semLabel(n: string, months: string[]) {
    return months.length ? `${n} (${months.map((m) => m.slice(0, 3)).join(", ")})` : n;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !year) return toast.error("Fill all fields");
    setBusy(true);
    const rows: any[] =
      mode === "whole_year"
        ? [{ name, semester: semLabel(yearSem, yearMonths), academic_year: year, class_code: genCode(), teacher_id: user!.id, attendance_mode: "whole_year" }]
        : [
            { name, semester: semLabel(sem1, sem1Months), academic_year: year, class_code: genCode(), teacher_id: user!.id, attendance_mode: "two_semester" },
            { name, semester: semLabel(sem2, sem2Months), academic_year: year, class_code: genCode(), teacher_id: user!.id, attendance_mode: "two_semester" },
          ];
    const { error } = await supabase.from("classes").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "whole_year" ? "Class created" : "2 classes created");
    onCreated();
  }

  return (
    <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New class</DialogTitle>
        <DialogDescription>Create a class and share its code with students.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Class name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SY CSE A" className="rounded-xl h-11" />
        </div>
        <div>
          <Label>Academic year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label>Attendance structure</Label>
          <div className="mt-1 grid grid-cols-1 gap-2">
            {[
              { v: "whole_year" as const, l: "Mark attendance for whole year" },
              { v: "two_semester" as const, l: "Mark attendance by 2 semesters" },
            ].map((o) => (
              <label key={o.v}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer ${mode === o.v ? "border-primary bg-primary/5" : ""}`}>
                <input type="radio" name="mode" checked={mode === o.v} onChange={() => setMode(o.v)} />
                {o.l}
              </label>
            ))}
          </div>
        </div>

        {mode === "whole_year" ? (
          <div className="rounded-xl border p-3 space-y-2">
            <p className="text-xs font-semibold">Year details</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Semester label</Label>
                <Input value={yearSem} onChange={(e) => setYearSem(e.target.value)} placeholder="1" className="rounded-xl h-10" />
              </div>
              <div>
                <Label className="text-xs">Months</Label>
                <MonthsPicker value={yearMonths} onChange={setYearMonths} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border p-3 space-y-2">
              <p className="text-xs font-semibold">Semester 1</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Number</Label><Input value={sem1} onChange={(e) => setSem1(e.target.value)} className="rounded-xl h-10" /></div>
                <div><Label className="text-xs">Months</Label><MonthsPicker value={sem1Months} onChange={setSem1Months} /></div>
              </div>
            </div>
            <div className="rounded-xl border p-3 space-y-2">
              <p className="text-xs font-semibold">Semester 2</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Number</Label><Input value={sem2} onChange={(e) => setSem2(e.target.value)} className="rounded-xl h-10" /></div>
                <div><Label className="text-xs">Months</Label><MonthsPicker value={sem2Months} onChange={setSem2Months} /></div>
              </div>
            </div>
          </>
        )}

        <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
        </Button>
      </form>
    </DialogContent>
  );
}

function MonthsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  function toggle(m: string) {
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 text-sm">
        <span className="truncate">{value.length ? value.map((m) => m.slice(0, 3)).join(", ") : "Select"}</span>
        <span className="ml-2 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-xl border bg-popover p-1 shadow-md">
          {MONTHS.map((m) => (
            <button key={m} type="button" onClick={() => toggle(m)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${value.includes(m) ? "font-semibold" : ""}`}>
              <span className={`grid h-4 w-4 place-items-center rounded border ${value.includes(m) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                {value.includes(m) && <Check className="h-3 w-3" />}
              </span>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- EDIT CLASS DIALOG -------------------- */
function EditClassDialog({ c, onSaved }: { c: ClassRow; onSaved: () => void }) {
  const [name, setName] = React.useState(c.name);
  const [year, setYear] = React.useState(c.academic_year);
  const [busy, setBusy] = React.useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    const { error } = await supabase.from("classes").update({ name: name.trim(), academic_year: year }).eq("id", c.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Class updated"); onSaved(); }
  }
  return (
    <DialogContent className="rounded-3xl">
      <DialogHeader>
        <DialogTitle>Edit class</DialogTitle>
        <DialogDescription>Update class name or academic year.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label>Class name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" />
        </div>
        <div>
          <Label>Academic year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
        </Button>
      </form>
    </DialogContent>
  );
}

/* -------------------- PROMOTE DIALOG -------------------- */
function PromoteDialog({ c, onDone }: { c: ClassRow; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  // year mode → pick year; semester mode → pick semester number
  const defaultYear = (() => {
    const i = YEARS.indexOf(c.academic_year);
    return i >= 0 && i + 1 < YEARS.length ? YEARS[i + 1] : c.academic_year;
  })();
  const [year, setYear] = React.useState(defaultYear);
  const semNum = String(parseInt((c.semester.match(/\d+/) || ["1"])[0]) + 1);
  const [sem, setSem] = React.useState(semNum);

  async function promote() {
    setBusy(true);
    const patch =
      c.attendance_mode === "whole_year"
        ? { academic_year: year, archived: false }
        : { semester: sem, archived: false };
    const { error } = await supabase.from("classes").update(patch).eq("id", c.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Promoted"); onDone(); }
  }

  return (
    <DialogContent className="rounded-3xl">
      <DialogHeader>
        <DialogTitle>Promote class</DialogTitle>
        <DialogDescription>
          {c.attendance_mode === "whole_year" ? "Select the new academic year." : "Select the new semester."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {c.attendance_mode === "whole_year" ? (
          <div>
            <Label>Academic year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label>Semester</Label>
            <Select value={sem} onValueChange={setSem}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{["1","2","3","4","5","6","7","8"].map((s) => <SelectItem key={s} value={s}>Semester {s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={promote} disabled={busy} className="h-11 w-full rounded-xl">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Promote
        </Button>
      </div>
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
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    supabase.from("classes").select("*").eq("teacher_id", user!.id).then(({ data }) => {
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
    setStatuses((prev) => {
      const map: Record<string, "present" | "absent"> = {};
      list.forEach((s) => { map[s.id] = prev[s.id] ?? "present"; });
      (att as any[] ?? []).forEach((a) => { map[a.student_id] = a.status; });
      return map;
    });
    setCalendarEvents(Object.fromEntries((events as any[] ?? []).map((e) => [e.date, e.type])));
  }, [activeClass, date]);

  React.useEffect(() => { loadData(); }, [loadData]);

  // Realtime: auto-add students when they join
  React.useEffect(() => {
    if (!activeClass) return;
    const ch = supabase
      .channel(`enrollments:${activeClass}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments", filter: `class_id=eq.${activeClass}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeClass, loadData]);

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
    const hasPresent = rows.some((r) => r.status === "present");
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "class_id,student_id,date" });
    if (!error && hasPresent) {
      await supabase.from("calendar_events").upsert(
        { class_id: activeClass, date: iso, type: "working", title: "Working day" },
        { onConflict: "class_id,date" },
      );
      setCalendarEvents((p) => ({ ...p, [iso]: "working" }));
    }
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Attendance saved");
  }

  if (classes.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="No classes" text="Create a class first to mark attendance." />;
  }

  return (
    <section className="space-y-4">
      <select value={activeClass} onChange={(e) => setActiveClass(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold">
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — Sem {c.semester}</option>)}
      </select>

      <WeeklyStrip date={date} onChange={setDate} events={calendarEvents} />

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
  const [classIds, setClassIds] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState<{ date: string; type: string }[]>([]);
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    const { data: cls } = await supabase.from("classes").select("id").eq("teacher_id", user!.id);
    const ids = (cls as any[] ?? []).map((c) => c.id);
    setClassIds(ids);
    if (ids.length === 0) { setEvents([]); return; }
    const { data } = await supabase.from("calendar_events").select("date, type").in("class_id", ids).order("date");
    const seen = new Map<string, { date: string; type: string }>();
    (data as any[] ?? []).forEach((e) => { if (!seen.has(e.date)) seen.set(e.date, e); });
    setEvents([...seen.values()]);
  }, [user]);
  React.useEffect(() => { load(); }, [load]);

  async function markDate(date: string, type: "working" | "non_working") {
    if (classIds.length === 0) { toast.error("Create a class first"); return; }
    const rows = classIds.map((cid) => ({
      class_id: cid, date, type,
      title: type === "working" ? "Working day" : "Non-working day",
    }));
    const { error } = await supabase.from("calendar_events").upsert(rows, { onConflict: "class_id,date" });
    if (error) toast.error(error.message);
    else { toast.success(type === "working" ? "Marked working" : "Marked non-working"); load(); }
  }
  function handleDateClick(date: string) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => markDate(date, "working"), 220);
  }
  function handleDateDoubleClick(date: string) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    markDate(date, "non_working");
  }

  if (classIds.length === 0) return <EmptyState icon={CalendarDays} title="No classes" text="Create a class first." />;

  const eventMap = Object.fromEntries(events.map((e) => [e.date, e]));
  const days = monthCells(month);
  const colorOf = (t: string) => t === "working" ? "bg-success/20 text-success" : t === "non_working" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <section className="space-y-4">
      <p className="text-xs text-muted-foreground text-center">Marks apply to <span className="font-bold">all your classes</span></p>
      <Card className="mx-auto w-full max-w-sm rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">‹</button>
          <p className="text-sm font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">›</button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Tap = working · Double-tap = non-working</p>
        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {days.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const event = eventMap[cell.iso];
            return <button key={cell.iso} onClick={() => handleDateClick(cell.iso)} onDoubleClick={() => handleDateDoubleClick(cell.iso)} className={`aspect-square rounded-lg text-[11px] font-semibold transition ${event ? colorOf(event.type) : "bg-secondary text-foreground/70"}`}>{cell.d}</button>;
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px]">
          <Legend color="var(--success)" label="Working" />
          <Legend color="var(--destructive)" label="Non-working" />
        </div>
      </Card>
    </section>
  );
}

/* -------------------- DEFAULTERS TAB -------------------- */
function DefaultersTab() {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [rows, setRows] = React.useState<{ id: string; name: string; roll: string; cls: string; present: number; total: number; pct: number }[]>([]);
  const [view, setView] = React.useState<"below" | "above">("below");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase.from("classes").select("*").eq("teacher_id", user!.id);
      const list = (cls as ClassRow[]) ?? [];
      setClasses(list);
      if (list.length === 0) { setRows([]); setLoading(false); return; }
      const ids = list.map((c) => c.id);
      const clsMap = new Map(list.map((c) => [c.id, c]));
      const [{ data: enrolls }, { data: att }] = await Promise.all([
        supabase.from("class_enrollments").select("class_id, student_id, roll_number, profiles!class_enrollments_student_id_fkey(full_name, user_id_text)").in("class_id", ids),
        supabase.from("attendance_records").select("class_id, student_id, status").in("class_id", ids),
      ]);
      // For whole_year mode: aggregate across all classes that share the same name + year + whole_year
      const byKey: Record<string, { p: number; t: number }> = {};
      (att as any[] ?? []).forEach((a) => {
        const k = `${a.class_id}:${a.student_id}`;
        byKey[k] = byKey[k] || { p: 0, t: 0 };
        byKey[k].t += 1;
        if (a.status === "present") byKey[k].p += 1;
      });
      const all = (enrolls as any[] ?? []).map((e) => {
        const c = clsMap.get(e.class_id);
        const st = byKey[`${e.class_id}:${e.student_id}`] ?? { p: 0, t: 0 };
        return {
          id: `${e.class_id}:${e.student_id}`,
          name: e.profiles?.full_name || "Student",
          roll: e.roll_number || e.profiles?.user_id_text || "",
          cls: c ? `${c.name} · Sem ${c.semester}` : "",
          present: st.p, total: st.t,
          pct: st.t === 0 ? 100 : Math.round((st.p / st.t) * 100),
        };
      }).sort((a, b) => a.pct - b.pct);
      if (!cancelled) { setRows(all); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!loading && classes.length === 0) return <EmptyState icon={AlertTriangle} title="No classes" text="Create a class first." />;
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
                    <p className="text-[11px] text-muted-foreground truncate">{r.roll}{r.cls ? ` · ${r.cls}` : ""} · {r.present}/{r.total} classes</p>
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

/* -------------------- PROFILE TAB -------------------- */
function ProfileTab() {
  const { profile, role, signOut } = useAuth();
  const deleteMe = useServerFn(deleteMyAccount);
  const [busy, setBusy] = React.useState(false);
  async function handleDelete() {
    if (!window.confirm("Delete your account? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteMe(); await signOut(); toast.success("Account deleted"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
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
      <Button variant="destructive" disabled={busy} onClick={handleDelete} className="h-11 w-full rounded-xl">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete my account
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

function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <Card className="rounded-2xl p-8 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </Card>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

function WeeklyStrip({ date, onChange, events }: { date: Date; onChange: (d: Date) => void; events: Record<string, string> }) {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(date));
  const [dir, setDir] = React.useState(0);
  React.useEffect(() => { setWeekStart(startOfWeek(date)); }, [date]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayIso = toISODate(new Date());

  function shiftWeek(delta: number) {
    setDir(delta);
    setWeekStart((w) => addDays(w, delta * 7));
  }

  return (
    <Card className="overflow-hidden rounded-3xl p-4" style={{ background: "oklch(0.98 0.015 250)" }}>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-muted-foreground shadow-sm transition hover:bg-white">‹</button>
        <motion.p
          key={toISODate(date)}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm font-semibold"
        >
          {date.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </motion.p>
        <button onClick={() => shiftWeek(1)} className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-muted-foreground shadow-sm transition hover:bg-white">›</button>
      </div>
      <div className="relative touch-pan-y">
        <motion.div
          key={weekStart.toISOString()}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          initial={{ x: dir * 60, opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) shiftWeek(1);
            else if (info.offset.x > 50) shiftWeek(-1);
          }}
          className="flex items-end justify-between gap-1.5"
        >
          {days.map((d) => {
            const iso = toISODate(d);
            const selected = iso === toISODate(date);
            const type = events[iso];
            const isOff = type === "non_working";
            const isWork = type === "working";
            const isToday = iso === todayIso;
            return (
              <button
                key={iso}
                onClick={() => onChange(d)}
                className={`flex w-10 flex-col items-center gap-1 rounded-2xl py-2 transition ${
                  selected ? "bg-primary text-primary-foreground shadow-md" :
                  isOff ? "bg-destructive/10 text-destructive" :
                  isWork ? "bg-success/15 text-success" :
                  "bg-white/70 text-foreground/70 hover:bg-white"
                }`}
              >
                <span className="text-[10px] uppercase opacity-75">{d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3)}</span>
                <span className={`text-sm font-bold ${isToday && !selected ? "underline" : ""}`}>{d.getDate()}</span>
              </button>
            );
          })}
        </motion.div>
      </div>
    </Card>
  );
}
