import { Settings, LogOut, Sun, Moon } from "lucide-react";
import * as React from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function AppHeader() {
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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
      <Sheet>
        <SheetTrigger asChild>
          <button aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent">
            <Settings className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px]">
          <SheetHeader><SheetTitle className="brand-font text-2xl">Attendify</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            {profile && (
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="font-semibold">{profile.full_name || profile.user_id_text}</p>
                <p className="text-xs text-muted-foreground">@{profile.user_id_text} · {role}</p>
              </div>
            )}
            <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => setDark(d => !d)}>
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
    </header>
  );
}
