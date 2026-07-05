// Offline attendance queue: persists teacher marks locally when the network
// is unavailable and flushes them to Supabase once the device is back online.
import { supabase } from "@/integrations/supabase/client";

export type OfflineAttendanceOp =
  | {
      kind: "upsert";
      class_id: string;
      student_id: string;
      date: string;
      status: "present" | "absent";
      marked_by: string;
      ts: number;
    }
  | {
      kind: "delete";
      class_id: string;
      student_id: string;
      date: string;
      ts: number;
    };

const KEY = "attendify:offline_attendance_v1";

function read(): OfflineAttendanceOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(ops: OfflineAttendanceOp[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ops));
}

export function queuedCount(): number {
  return read().length;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function enqueue(op: OfflineAttendanceOp) {
  const ops = read();
  // Collapse duplicate keys (same class/student/date) — last write wins.
  const filtered = ops.filter(
    (o) =>
      !(o.class_id === op.class_id && o.student_id === op.student_id && o.date === op.date),
  );
  filtered.push(op);
  write(filtered);
}

let flushing = false;
export async function flush(onProgress?: () => void): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0, failed = 0;
  try {
    const ops = read();
    const remaining: OfflineAttendanceOp[] = [];
    for (const op of ops) {
      try {
        if (op.kind === "upsert") {
          const { error } = await supabase.from("attendance_records").upsert(
            {
              class_id: op.class_id,
              student_id: op.student_id,
              date: op.date,
              status: op.status,
              marked_by: op.marked_by,
            },
            { onConflict: "class_id,student_id,date" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("attendance_records")
            .delete()
            .eq("class_id", op.class_id)
            .eq("student_id", op.student_id)
            .eq("date", op.date);
          if (error) throw error;
        }
        ok++;
      } catch {
        failed++;
        remaining.push(op);
      }
    }
    write(remaining);
    onProgress?.();
  } finally {
    flushing = false;
  }
  return { ok, failed };
}

export function onQueueChanged(cb: () => void): () => void {
  const handler = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
