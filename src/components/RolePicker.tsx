import * as React from "react";
import { Card } from "@/components/ui/card";
import { ShieldCheck, BookOpen, Users, GraduationCap } from "lucide-react";
import type { AppRole } from "@/lib/auth-context";

export type PickerRole = AppRole | "parent";

const ROLES: { id: PickerRole; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "admin",   label: "Admin",   icon: ShieldCheck,   desc: "Manage colleges & classes" },
  { id: "teacher", label: "Teacher", icon: BookOpen,      desc: "Mark student attendance" },
  { id: "parent",  label: "Parent",  icon: Users,         desc: "View your child's info" },
  { id: "student", label: "Student", icon: GraduationCap, desc: "View your attendance" },
];

export function RolePicker({ onPick }: { onPick: (r: PickerRole) => void }) {
  return (
    <div className="min-h-screen bg-background px-5 pb-10 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="brand-font text-3xl">Mhatre College</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your account type to continue</p>
        </div>
        <div className="space-y-3">
          {ROLES.map(({ id, label, icon: Icon, desc }) => (
            <Card key={id}
              onClick={() => onPick(id)}
              className="card-soft cursor-pointer rounded-2xl border-border/60 p-0 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
              <div className="flex items-center gap-4 p-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
