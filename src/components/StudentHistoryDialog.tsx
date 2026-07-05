import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  classId: string | null;
  studentName?: string;
  studentRoll?: string;
}

function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StudentHistoryDialog({ open, onClose, studentId, classId, studentName, studentRoll }: Props) {
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [attMap, setAttMap] = React.useState<Map<string, "present" | "absent">>(new Map());
  const [eventMap, setEventMap] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !studentId || !classId) return;
    setLoading(true);
    Promise.all([
      supabase.from("attendance_records").select("date, status").eq("student_id", studentId).eq("class_id", classId),
      supabase.from("calendar_events").select("date, type").eq("class_id", classId),
    ]).then(([{ data: att }, { data: ev }]) => {
      const m = new Map<string, "present" | "absent">();
      (att as any[] ?? []).forEach((a) => m.set(a.date, a.status));
      setAttMap(m);
      const em = new Map<string, string>();
      (ev as any[] ?? []).forEach((e) => em.set(e.date, e.type));
      setEventMap(em);
      setLoading(false);
    });
  }, [open, studentId, classId]);

  const days = React.useMemo(() => {
    const y = month.getFullYear(), mo = month.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const dim = new Date(y, mo + 1, 0).getDate();
    const cells: ({ d: number; iso: string } | null)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push({ d, iso: toISODate(new Date(y, mo, d)) });
    return cells;
  }, [month]);

  // Totals across all history
  const nonWorking = new Set<string>();
  eventMap.forEach((t, d) => { if (t === "non_working" || t === "holiday" || t === "student_holiday" || t === "college_event") nonWorking.add(d); });
  const workingDates = new Set<string>();
  attMap.forEach((_v, d) => { if (!nonWorking.has(d)) workingDates.add(d); });
  let present = 0;
  attMap.forEach((v, d) => { if (v === "present" && !nonWorking.has(d)) present++; });
  const total = workingDates.size;
  const pct = total === 0 ? 0 : Math.round((present / total) * 100);
  const color = pct >= 85 ? "#1DB954" : pct >= 75 ? "oklch(0.70 0.16 85)" : "#E74C3C";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{studentName || "Student"}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">Roll {studentRoll || "—"} · Full attendance history</p>
        </DialogHeader>

        <div className="rounded-2xl p-3 text-white text-center" style={{ background: color }}>
          <p className="text-xs opacity-90">Overall</p>
          <p className="text-3xl font-bold">{pct}%</p>
          <p className="text-[11px] opacity-90">{present} / {total} working days</p>
        </div>

        <div className="rounded-2xl border p-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">‹</button>
            <p className="text-sm font-bold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">›</button>
          </div>
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
                {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {days.map((cell, i) => {
                  if (!cell) return <div key={i} />;
                  const status = attMap.get(cell.iso);
                  const ev = eventMap.get(cell.iso);
                  const style: React.CSSProperties =
                    ev === "college_event" ? { background: "#6baed6" } :
                    ev === "non_working" || ev === "holiday" || ev === "student_holiday" ? { background: "#f4c430" } :
                    status === "present" ? { background: "#80b946" } :
                    status === "absent" ? { background: "#e05c5c" } : {};
                  const white = ev || status;
                  return (
                    <div key={i} className={`aspect-square grid place-items-center rounded-lg text-[11px] font-semibold ${white ? "text-white" : "bg-secondary text-foreground/70"}`} style={style}>
                      {cell.d}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-3 text-[10px]">
                <Legend color="#80b946" label="Present" />
                <Legend color="#e05c5c" label="Absent" />
                <Legend color="#f4c430" label="Holiday" />
                <Legend color="#6baed6" label="Event" />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color }} />{label}</span>;
}
