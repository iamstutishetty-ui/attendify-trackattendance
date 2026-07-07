import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { CollegeCodeGate, isCollegeCodeVerified } from "@/components/CollegeCodeGate";
import { RolePicker, type PickerRole } from "@/components/RolePicker";
import { SimpleLoginScreen } from "@/components/SimpleLoginScreen";
import { Loader2 } from "lucide-react";

const CollegeApp = React.lazy(() =>
  import("@/components/CollegeApp").then((m) => ({ default: m.CollegeApp })),
);

export const Route = createFileRoute("/")({ component: Index });

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}

const PICKED_KEY = "mhatre:picked_role";
function loadPicked(): PickerRole | null {
  try { return (sessionStorage.getItem(PICKED_KEY) as PickerRole) || null; } catch { return null; }
}
function savePicked(r: PickerRole | null) {
  try { if (r) sessionStorage.setItem(PICKED_KEY, r); else sessionStorage.removeItem(PICKED_KEY); } catch { /* ignore */ }
}

function Index() {
  const { loading, user, role } = useAuth();
  const [splashDone, setSplashDone] = React.useState(false);
  const [codeVerified, setCodeVerified] = React.useState(() => isCollegeCodeVerified());
  const [picked, setPicked] = React.useState<PickerRole | null>(() => loadPicked());

  React.useEffect(() => { if (user) savePicked(null); }, [user]);

  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;
  if (!codeVerified) return <CollegeCodeGate onVerified={() => setCodeVerified(true)} />;
  if (loading) return <Spinner />;

  if (!user) {
    if (!picked) return <RolePicker onPick={(r) => { savePicked(r); setPicked(r); }} />;
    if (picked === "admin" || picked === "parent") {
      return <SimpleLoginScreen role={picked} onBack={() => { savePicked(null); setPicked(null); }} />;
    }
    // teacher or student → existing full auth screen (login + create account)
    return <AuthScreen forcedRole={picked} onBack={() => { savePicked(null); setPicked(null); }} />;
  }

  return (
    <React.Suspense fallback={<Spinner />}>
      {role ? <CollegeApp /> : <Spinner />}
    </React.Suspense>
  );
}
