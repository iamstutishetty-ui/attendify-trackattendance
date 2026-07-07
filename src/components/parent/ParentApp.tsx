import * as React from "react";
import { StudentApp } from "@/components/student/StudentApp";

// Parent view: read-only. For now, we render the StudentApp so parents can see
// the same information (attendance, calendar). Interactive controls belong to the
// student's own account; RLS lets the parent SELECT their linked student's data.
export function ParentApp({ embedded }: { embedded?: boolean }) {
  return (
    <div className="parent-readonly">
      <style>{`.parent-readonly button[data-attendance-action], .parent-readonly [data-attendance-action]{pointer-events:none;opacity:.6;}`}</style>
      <StudentApp embedded={embedded} />
    </div>
  );
}
