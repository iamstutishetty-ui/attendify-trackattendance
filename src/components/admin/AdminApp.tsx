import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users, BookOpen, BarChart3 } from "lucide-react";

interface ClassStat {
  id: string; name: string; semester: string; teacher_name: string;
  total_students: number; present: number; absent: number; pct: number;
}

export function AdminApp() {
  const [classes, setClasses] = React.useState<ClassStat[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [query, setQuery] = React.useState("");
  const [semFilter, setSemFilter] = React.useState("");
  const [teacherFilter, setTeacherFilter] = React.useState("");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase.from("classes").select("*").eq("archived", false);
      const list = (cls as any[]) ?? [];
      if (list.length === 0) { setClasses([]); setLoading(false); return; }
      const ids = list.map((c) => c.id);
      const teacherIds = [...new Set(list.map((c) => c.teacher_id))];
      const [{ data: enrolls }, { data: att }, { data: teachers }] = await Promise.all([
        supabase.from("class_enrollments").select("class_id").in("class_id", ids),
        supabase.from("attendance_records").select("class_id, status").in("class_id", ids).eq("date", date),
        supabase.from("profiles").select("id, full_name, user_id_text").in("id", teacherIds),
      ]);
      const enrollCount: Record<string, number> = {};
      (enrolls as any[] ?? []).forEach((e) => enrollCount[e.class_id] = (enrollCount[e.class_id] ?? 0) + 1);
      const attBy: Record<string, { p: number; a: number }> = {};
      (att as any[] ?? []).forEach((a) => {
        attBy[a.class_id] = attBy[a.class_id] ?? { p: 0, a: 0 };
        if (a.status === "present") attBy[a.class_id].p += 1; else attBy[a.class_id].a += 1;
      });
      const tMap = new Map((teachers as any[] ?? []).map((t) => [t.id, t.full_name || t.user_id_text]));
      const result: ClassStat[] = list.map((c) => {
        const tot = enrollCount[c.id] ?? 0;
        const at = attBy[c.id] ?? { p: 0, a: 0 };
        const marked = at.p + at.a;
        return {
          id: c.id, name: c.name, semester: c.semester,
          teacher_name: tMap.get(c.teacher_id) ?? "—",
          total_students: tot, present: at.p, absent: at.a,
          pct: marked === 0 ? 0 : Math.round((at.p / marked) * 100),
        };
      });
      setClasses(result); setLoading(false);
    })();
  }, [date]);

  const semesters = [...new Set(classes.map((c) => c.semester))].sort();
  const teachers = [...new Set(classes.map((c) => c.teacher_name))].sort();

  const filtered = classes.filter((c) =>
    (!query || c.name.toLowerCase().includes(query.toLowerCase())) &&
    (!semFilter || c.semester === semFilter) &&
    (!teacherFilter || c.teacher_name === teacherFilter));

  const totals = {
    classes: classes.length,
    students: classes.reduce((s, c) => s + c.total_students, 0),
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <AppHeader />
      <main className="px-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={BookOpen} label="Classes" value={totals.classes} />
          <StatCard icon={Users} label="Students" value={totals.students} />
        </div>

        <Card className="rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Filters</p></div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <select value={semFilter} onChange={(e) => setSemFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-2 text-sm">
              <option value="">All semesters</option>
              {semesters.map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-2 text-sm">
              <option value="">All teachers</option>
              {teachers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search class" className="h-11 rounded-xl pl-9" />
          </div>
        </Card>

        {loading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-muted-foreground" /> :
         filtered.length === 0 ? <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No classes found.</Card> :
         <div className="space-y-3">{filtered.map((c) => <AdminClassCard key={c.id} c={c} />)}</div>}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card className="card-soft rounded-2xl p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function AdminClassCard({ c }: { c: ClassStat }) {
  const color = c.pct >= 85 ? "oklch(0.55 0.18 145)" : c.pct >= 75 ? "oklch(0.70 0.16 85)" : "oklch(0.55 0.22 25)";
  const bg = c.pct >= 85 ? "oklch(0.95 0.08 145)" : c.pct >= 75 ? "oklch(0.96 0.10 85)" : "oklch(0.96 0.06 25)";
  return (
    <Card className="card-soft rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.teacher_name} · Sem {c.semester}</p>
        </div>
        <div className="rounded-xl px-3 py-1 text-lg font-bold" style={{ background: bg, color }}>{c.pct}%</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-secondary p-2"><p className="font-bold">{c.total_students}</p><p className="text-muted-foreground">Enrolled</p></div>
        <div className="rounded-xl p-2" style={{ background: "oklch(0.96 0.08 145)" }}><p className="font-bold" style={{ color: "oklch(0.45 0.15 145)" }}>{c.present}</p><p className="text-muted-foreground">Present</p></div>
        <div className="rounded-xl p-2" style={{ background: "oklch(0.96 0.06 25)" }}><p className="font-bold" style={{ color: "oklch(0.50 0.20 25)" }}>{c.absent}</p><p className="text-muted-foreground">Absent</p></div>
      </div>
    </Card>
  );
}
