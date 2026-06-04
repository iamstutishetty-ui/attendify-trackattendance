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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LayoutDashboard, CalendarDays, User as UserIcon, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";


type Tab = "dashboard" | "calendar" | "profile";
const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: UserIcon },
];

export function StudentApp() {
  const [tab, setTab] = React.useState<Tab>("dashboard");
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main className="px-4 pt-4">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "profile" && <ProfileTab />}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${tab === id ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`grid h-9 w-9 place-items-center rounded-xl ${tab === id ? "bg-primary/15" : ""}`}>
                <Icon className="h-5 w-5" />
              </div>{label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

interface ClassInfo { id: string; name: string; teacher_name: string; present: number; absent: number; total: number; pct: number; }

function useStudentClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = React.useState<ClassInfo[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data: enrolls } = await supabase.from("class_enrollments")
      .select("class_id, classes(id, name, teacher_id)")
      .eq("student_id", user!.id);
    const classIds = (enrolls as any[] ?? []).map((e) => e.class_id);
    if (classIds.length === 0) { setClasses([]); setLoading(false); return; }
    const [{ data: att }, { data: events }, { data: teacherProfiles }] = await Promise.all([
      supabase.from("attendance_records").select("class_id, status, date").eq("student_id", user!.id).in("class_id", classIds),
      supabase.from("calendar_events").select("class_id, date, type").in("class_id", classIds),
      supabase.from("profiles").select("id, full_name, user_id_text").in("id", (enrolls as any[]).map((e) => e.classes?.teacher_id).filter(Boolean)),
    ]);
    const teacherMap = new Map((teacherProfiles as any[] ?? []).map((p) => [p.id, p.full_name || p.user_id_text]));
    // Working days = dates teacher marked attendance, MINUS non_working / college_event
    const nonWorkingByClass: Record<string, Set<string>> = {};
    (events as any[] ?? []).forEach((e) => {
      if (e.type === "non_working" || e.type === "holiday" || e.type === "college_event") {
        (nonWorkingByClass[e.class_id] ||= new Set()).add(e.date);
      }
    });
    const workingByClass: Record<string, Set<string>> = {};
    (att as any[] ?? []).forEach((a) => {
      if (nonWorkingByClass[a.class_id]?.has(a.date)) return;
      (workingByClass[a.class_id] ||= new Set()).add(a.date);
    });
    const result: ClassInfo[] = (enrolls as any[]).map((e) => {
      const cAtt = (att as any[] ?? []).filter((a) => a.class_id === e.class_id);
      const present = cAtt.filter((a) => a.status === "present" && !nonWorkingByClass[e.class_id]?.has(a.date)).length;
      const total = workingByClass[e.class_id]?.size ?? 0;
      return {
        id: e.class_id, name: e.classes?.name ?? "Class",
        teacher_name: teacherMap.get(e.classes?.teacher_id) ?? "—",
        present, absent: Math.max(0, total - present), total,
        pct: total === 0 ? 0 : Math.round((present / total) * 100),
      };
    });
    setClasses(result);
    setLoading(false);
  }, [user]);

  React.useEffect(() => { load(); }, [load]);

  // Realtime: sync when teacher marks attendance or admin/teacher updates calendar events
  React.useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`student-data:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  return { classes, loading, reload: load };
}

function DashboardTab() {
  const { classes, loading, reload } = useStudentClasses();
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [roll, setRoll] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_class_by_code", { _code: code.trim(), _roll: roll.trim() });
    setBusy(false);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("Invalid class code")) toast.error("Invalid class code");
      else if (msg.includes("Already joined")) toast.error("Already joined");
      else if (msg.includes("Only students")) toast.error("Only student accounts can join classes");
      else toast.error(msg);
      return;
    }
    toast.success("Joined class"); setOpen(false); setCode(""); setRoll(""); reload();
  }


  const overall = classes.reduce((acc, c) => ({ p: acc.p + c.present, t: acc.t + c.total }), { p: 0, t: 0 });
  const overallPct = overall.t === 0 ? 100 : Math.round((overall.p / overall.t) * 100);

  return (
    <section className="space-y-4">
      <Card className="card-soft rounded-3xl blue-gradient p-5 text-white">
        <p className="text-xs uppercase opacity-80">Overall attendance</p>
        <p className="mt-2 text-5xl font-bold">{overallPct}%</p>
        <div className="mt-4 flex gap-4 text-sm">
          <span>✓ {overall.p} present</span>
          <span>✗ {overall.t - overall.p} absent</span>
        </div>
        <p className={`mt-2 text-xs font-semibold ${overallPct >= 75 ? "text-[oklch(0.95_0.1_145)]" : "text-[oklch(0.95_0.1_60)]"}`}>
          {overallPct >= 75 ? "On track ✓" : "Below 75% — needs attention"}
        </p>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My classes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="rounded-full"><Plus className="mr-1 h-4 w-4" />Join</Button></DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader><DialogTitle>Join a class</DialogTitle></DialogHeader>
            <form onSubmit={join} className="space-y-3">
              <div><Label>Class code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. AB12CD" className="h-11 rounded-xl uppercase" /></div>
              <div><Label>Your roll number</Label><Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="22CS001" className="h-11 rounded-xl" /></div>
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Join class</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-muted-foreground" /> :
       classes.length === 0 ? <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No classes yet. Tap Join.</Card> :
       <div className="space-y-3">{classes.map((c) => <ClassRow key={c.id} c={c} />)}</div>}
    </section>
  );
}

function ClassRow({ c }: { c: ClassInfo }) {
  const color = c.pct >= 85 ? "oklch(0.55 0.18 145)" : c.pct >= 75 ? "oklch(0.70 0.16 85)" : "oklch(0.55 0.22 25)";
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.teacher_name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color }}>{c.pct}%</p>
          <p className="text-[11px] text-muted-foreground">{c.present}/{c.total}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: color }} />
      </div>
    </Card>
  );
}

function CalendarTab() {
  const { user } = useAuth();
  const [classIds, setClassIds] = React.useState<string[]>([]);
  const [activeClass, setActiveClass] = React.useState<string>("");
  const [classes, setClasses] = React.useState<{ id: string; name: string }[]>([]);
  const [attMap, setAttMap] = React.useState<Map<string, "present" | "absent">>(new Map());
  const [holidays, setHolidays] = React.useState<Set<string>>(new Set());
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });

  React.useEffect(() => {
    supabase.from("class_enrollments").select("class_id, classes(id, name)").eq("student_id", user!.id).then(({ data }) => {
      const list = (data as any[] ?? []).map((e) => ({ id: e.class_id, name: e.classes?.name ?? "Class" }));
      setClasses(list); setClassIds(list.map((c) => c.id)); setActiveClass(list[0]?.id ?? "");
    });
  }, [user]);

  const [eventMap, setEventMap] = React.useState<Map<string, string>>(new Map());

  const loadCalendar = React.useCallback(() => {
    if (!activeClass) return;
    Promise.all([
      supabase.from("attendance_records").select("date, status").eq("student_id", user!.id).eq("class_id", activeClass),
      supabase.from("calendar_events").select("date, type").eq("class_id", activeClass),
    ]).then(([{ data: att }, { data: ev }]) => {
      const m = new Map<string, "present" | "absent">();
      (att as any[] ?? []).forEach((a) => m.set(a.date, a.status));
      setAttMap(m);
      const em = new Map<string, string>();
      (ev as any[] ?? []).forEach((e) => em.set(e.date, e.type));
      setEventMap(em);
      const h = new Set<string>();
      (ev as any[] ?? []).forEach((e) => { if (e.type === "holiday" || e.type === "non_working") h.add(e.date); });
      setHolidays(h);
    });
  }, [activeClass, user]);

  React.useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // Realtime sync
  React.useEffect(() => {
    if (!activeClass) return;
    const ch = supabase.channel(`student-cal:${activeClass}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `class_id=eq.${activeClass}` }, () => loadCalendar())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records", filter: `class_id=eq.${activeClass}` }, () => loadCalendar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeClass, loadCalendar]);

  const days = React.useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const cells: ({ d: number; iso: string } | null)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push({ d, iso: toISODate(new Date(y, m, d)) });
    return cells;
  }, [month]);

  if (classes.length === 0) return <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground mt-4">Join a class to see your calendar.</Card>;

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
            const status = attMap.get(cell.iso);
            const ev = eventMap.get(cell.iso);
            const cls = ev === "college_event" ? "bg-[oklch(0.65_0.20_250)] text-white"
              : ev === "non_working" || ev === "holiday" ? "bg-[oklch(0.78_0.18_85)] text-[oklch(0.30_0.15_85)]"
              : status === "present" ? "bg-[oklch(0.60_0.20_145)] text-white"
              : status === "absent" ? "bg-[oklch(0.55_0.22_25)] text-white"
              : "bg-secondary text-foreground/70";
            return <div key={i} className={`aspect-square grid place-items-center rounded-lg text-xs font-semibold ${cls}`}>{cell.d}</div>;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <Legend color="oklch(0.60 0.20 145)" label="Present" />
          <Legend color="oklch(0.55 0.22 25)" label="Absent" />
          <Legend color="oklch(0.78 0.18 85)" label="Non-working" />
          <Legend color="oklch(0.65 0.20 250)" label="College event" />
        </div>
      </Card>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color }} />{label}</span>;
}

function ProfileTab() {

  const { profile, role, signOut } = useAuth();
  const { classes } = useStudentClasses();
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
      <Card className="rounded-2xl p-4">
        <p className="text-sm font-bold">Joined classes ({classes.length})</p>
        <div className="mt-2 space-y-1">
          {classes.map((c) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span>{c.name}</span><span className="text-muted-foreground">{c.pct}%</span>
            </div>
          ))}
          {classes.length === 0 && <p className="text-xs text-muted-foreground">None yet</p>}
        </div>
      </Card>
      <Button variant="outline" onClick={signOut} className="h-11 w-full rounded-xl">Log out</Button>
      <Button variant="destructive" disabled={busy} onClick={handleDelete} className="h-11 w-full rounded-xl">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete my account
      </Button>
    </section>
  );
}



function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
