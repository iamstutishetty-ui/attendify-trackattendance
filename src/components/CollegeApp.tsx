import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Settings, LogOut, Sun, Moon, ChevronLeft, ChevronRight,
  CalendarClock, Megaphone, ClipboardCheck, Wallet, GraduationCap,
  BookOpen, FolderKanban, Construction,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AdminApp } from "@/components/admin/AdminApp";
import { TeacherApp } from "@/components/teacher/TeacherApp";
import { StudentApp } from "@/components/student/StudentApp";

type View =
  | "home"
  | "timetable"
  | "notices"
  | "attendance"
  | "fees"
  | "results"
  | "material"
  | "assignments";

interface Feature {
  id: Exclude<View, "home">;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
}

const features: Feature[] = [
  { id: "timetable",   title: "Time Table",             subtitle: "Class & exam schedule",         icon: CalendarClock, gradient: "from-[oklch(0.60_0.20_255)] to-[oklch(0.68_0.16_235)]" },
  { id: "notices",     title: "Notices",                subtitle: "Announcements & updates",       icon: Megaphone,     gradient: "from-[oklch(0.62_0.20_245)] to-[oklch(0.70_0.16_225)]" },
  { id: "attendance",  title: "College Attendance",     subtitle: "Mark & track attendance",       icon: ClipboardCheck,gradient: "from-[oklch(0.55_0.22_255)] to-[oklch(0.65_0.18_230)]" },
  { id: "fees",        title: "Fees",                   subtitle: "Dues & payment status",         icon: Wallet,        gradient: "from-[oklch(0.58_0.20_250)] to-[oklch(0.68_0.16_235)]" },
  { id: "results",     title: "Results",                subtitle: "Marks & report card",           icon: GraduationCap, gradient: "from-[oklch(0.56_0.22_255)] to-[oklch(0.66_0.18_235)]" },
  { id: "material",    title: "Study Material",         subtitle: "Notes, PDFs & references",      icon: BookOpen,      gradient: "from-[oklch(0.60_0.20_250)] to-[oklch(0.70_0.16_230)]" },
  { id: "assignments", title: "Assignments & Projects", subtitle: "Submit & track your work",      icon: FolderKanban,  gradient: "from-[oklch(0.58_0.22_255)] to-[oklch(0.68_0.18_235)]" },
];

export function CollegeApp() {
  const [view, setView] = React.useState<View>("home");
  const { role } = useAuth();

  if (view === "attendance") {
    return (
      <div className="min-h-screen bg-background">
        <SubHeader title="College Attendance" onBack={() => setView("home")} />
        {role === "admin" && <AdminApp embedded />}
        {role === "teacher" && <TeacherApp embedded />}
        {role === "student" && <StudentApp embedded />}
      </div>
    );
  }

  if (view !== "home") {
    const feat = features.find((f) => f.id === view)!;
    return (
      <div className="min-h-screen bg-background">
        <SubHeader title={feat.title} onBack={() => setView("home")} />
        <ComingSoon feature={feat} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeHeader />
      <main className="mx-auto max-w-md px-4 pb-10 pt-4">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome</p>
          <h1 className="brand-font text-3xl leading-tight">Your college, in one app</h1>
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
    <Card
      onClick={onOpen}
      className="card-soft group cursor-pointer overflow-hidden rounded-2xl border-border/60 p-0 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
    >
      <div className="flex items-center gap-4 p-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-md`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{feature.title}</p>
          <p className="truncate text-xs text-muted-foreground">{feature.subtitle}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Card>
  );
}

function HomeHeader() {
  const { profile, role, signOut } = useAuth();
  const [dark, setDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", dark ? "dark" : "light");
    }
  }, [dark]);

  const initials = (profile?.full_name || profile?.user_id_text || "U")
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
      <Sheet>
        <SheetTrigger asChild>
          <button aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent">
            <Settings className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px]">
          <SheetHeader><SheetTitle className="brand-font text-2xl">Settings</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            {profile && (
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="font-semibold">{profile.full_name || profile.user_id_text}</p>
                <p className="text-xs text-muted-foreground">@{profile.user_id_text} · {role}</p>
              </div>
            )}
            <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => setDark((d) => !d)}>
              {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {dark ? "Light theme" : "Dark theme"}
            </Button>
            <Button variant="destructive" className="w-full justify-start rounded-xl" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <h1 className="brand-font text-2xl">Attendify</h1>

      <Sheet>
        <SheetTrigger asChild>
          <button aria-label="Account" className="rounded-full ring-2 ring-primary/20 transition hover:ring-primary/40">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-[oklch(0.65_0.18_235)] text-sm font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px]">
          <SheetHeader><SheetTitle>Account</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-secondary p-5 text-center">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-to-br from-primary to-[oklch(0.65_0.18_235)] text-lg font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold">{profile?.full_name || profile?.user_id_text}</p>
                <p className="text-xs text-muted-foreground">@{profile?.user_id_text}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-primary">{role}</p>
              </div>
            </div>
            <Button variant="destructive" className="w-full justify-start rounded-xl" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
      <button
        aria-label="Back"
        onClick={onBack}
        className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="brand-font text-xl">{title}</h1>
    </header>
  );
}

function ComingSoon({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4">
      <Card className="card-soft w-full rounded-3xl p-8 text-center">
        <div className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-md`}>
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold">{feature.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{feature.subtitle}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground">
          <Construction className="h-4 w-4" />
          Coming soon
        </div>
        <p className="mx-auto mt-4 max-w-xs text-xs text-muted-foreground">
          This section is being built. It will be available in an upcoming update.
        </p>
      </Card>
    </div>
  );
}
