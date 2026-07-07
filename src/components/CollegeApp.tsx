import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings, LogOut, Sun, Moon, ChevronLeft, ChevronRight,
  CalendarClock, Megaphone, ClipboardCheck, Wallet, GraduationCap,
  BookOpen, FolderKanban, Construction, Building2, Trash2, Copy, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/accounts.functions";
import { getMyParentCredentials } from "@/lib/parent.functions";
import { AdminApp } from "@/components/admin/AdminApp";
import { TeacherApp } from "@/components/teacher/TeacherApp";
import { StudentApp } from "@/components/student/StudentApp";
import { ParentApp } from "@/components/parent/ParentApp";
import { CollegeManagement } from "@/components/admin/CollegeManagement";

type View = "home" | "college_mgmt" | "attendance" | "notices" | "timetable" | "assignments" | "results" | "material" | "fees";

interface Feature {
  id: Exclude<View, "home">;
  title: string;
  icon: React.ElementType;
  functional?: boolean;
}

const NOTICE: Feature   = { id: "notices",     title: "Notice",             icon: Megaphone };
const ATT: Feature      = { id: "attendance",  title: "Student Attendance", icon: ClipboardCheck, functional: true };
const TT: Feature       = { id: "timetable",   title: "Timetable",          icon: CalendarClock };
const ASSIGN: Feature   = { id: "assignments", title: "Assignments",        icon: FolderKanban };
const RES: Feature      = { id: "results",     title: "Results",            icon: GraduationCap };
const MAT: Feature      = { id: "material",    title: "Study Material",     icon: BookOpen };
const FEES: Feature     = { id: "fees",        title: "Fees",               icon: Wallet };
const COLLEGE: Feature  = { id: "college_mgmt",title: "College Management", icon: Building2, functional: true };

const FEATURES_BY_ROLE: Record<string, Feature[]> = {
  admin:   [COLLEGE, NOTICE, ATT, TT, ASSIGN, RES, MAT, FEES],
  teacher: [NOTICE, ATT, TT, ASSIGN, RES, MAT],
  student: [NOTICE, ATT, TT, ASSIGN, RES, MAT, FEES],
  parent:  [NOTICE, ATT, TT, ASSIGN, RES, MAT, FEES],
};

export function CollegeApp() {
  const [view, setView] = React.useState<View>("home");
  const { role } = useAuth();
  const features = FEATURES_BY_ROLE[role ?? "student"] ?? FEATURES_BY_ROLE.student;

  if (view === "college_mgmt" && role === "admin") {
    return (
      <div className="min-h-screen bg-background">
        <SubHeader title="College Management" onBack={() => setView("home")} />
        <CollegeManagement />
      </div>
    );
  }

  if (view === "attendance") {
    return (
      <div className="min-h-screen bg-background">
        <SubHeader title="Student Attendance" onBack={() => setView("home")} />
        {role === "admin"   && <AdminApp embedded />}
        {role === "teacher" && <TeacherApp embedded />}
        {role === "student" && <StudentApp embedded />}
        {(role as string) === "parent"  && <ParentApp embedded />}
      </div>
    );
  }

  if (view !== "home") {
    const feat = features.find((f) => f.id === view);
    return (
      <div className="min-h-screen bg-background">
        <SubHeader title={feat?.title ?? "Coming Soon"} onBack={() => setView("home")} />
        <ComingSoon title={feat?.title ?? ""} Icon={feat?.icon ?? Construction} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeHeader />
      <main className="mx-auto max-w-md px-4 pb-10 pt-4">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome</p>
          <h1 className="brand-font text-3xl leading-tight">Mhatre College App</h1>
        </div>
        <div className="space-y-3">
          {features.map((f) => (
            <FeatureCard key={f.id} feature={f} onOpen={() => setView(f.id)} />
          ))}
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ feature, onOpen }: { feature: Feature; onOpen: () => void }) {
  const Icon = feature.icon;
  return (
    <Card onClick={onOpen}
      className="card-soft group cursor-pointer overflow-hidden rounded-2xl border-border/60 p-0 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
      <div className="flex items-center gap-4 p-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{feature.title}</p>
          {!feature.functional && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coming soon</p>}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Card>
  );
}

function HomeHeader() {
  const [dark, setDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (typeof window !== "undefined") localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
      <button aria-label="Toggle theme" onClick={() => setDark((d) => !d)}
        className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent">
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <h1 className="brand-font text-xl">Mhatre College</h1>
      <SettingsSheet />
    </header>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
      <button aria-label="Back" onClick={onBack}
        className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="brand-font text-xl flex-1 truncate">{title}</h1>
    </header>
  );
}

function SettingsSheet() {
  const { profile, role, signOut } = useAuth();
  const deleteAcc = useServerFn(deleteMyAccount);
  const initials = (profile?.full_name || profile?.user_id_text || "U")
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  async function doDelete() {
    try {
      await deleteAcc();
      toast.success("Account deleted");
      await signOut();
    } catch (e: any) { toast.error(e.message || "Could not delete account"); }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent">
          <Settings className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px]">
        <SheetHeader><SheetTitle className="brand-font text-2xl">Settings</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-5 text-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <p className="font-bold">{profile?.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">@{profile?.user_id_text}</p>
            <p className="text-[11px] uppercase tracking-wider text-primary">{role}</p>
          </div>

          {role === "student" && <ParentCredentialsBlock />}

          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />Log out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start rounded-xl">
                <Trash2 className="mr-2 h-4 w-4" />Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes your account and cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={doDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ParentCredentialsBlock() {
  const load = useServerFn(getMyParentCredentials);
  const [creds, setCreds] = React.useState<{ parentId: string; parentPassword: string } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { load().then((c) => setCreds(c as any)).catch((e) => setErr(e.message)); }, [load]);
  const copy = (t: string) => { navigator.clipboard.writeText(t).then(() => toast.success("Copied")); };
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">Parent Account</p>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">Share these with your parent so they can log in.</p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {!creds && !err && <p className="text-xs text-muted-foreground">Loading…</p>}
      {creds && (
        <div className="space-y-2">
          <CredRow label="Parent ID" value={creds.parentId} onCopy={copy} />
          <CredRow label="Parent Password" value={creds.parentPassword} onCopy={copy} />
        </div>
      )}
    </div>
  );
}
function CredRow({ label, value, onCopy }: { label: string; value: string; onCopy: (t: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-semibold">{value}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={() => onCopy(value)} className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
    </div>
  );
}

function ComingSoon({ title, Icon }: { title: string; Icon: React.ElementType }) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4">
      <Card className="card-soft w-full rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground">
          <Construction className="h-4 w-4" />Coming soon
        </div>
      </Card>
    </div>
  );
}
