import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { CollegeCodeGate, isCollegeCodeVerified } from "@/components/CollegeCodeGate";
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

function Index() {
  const { loading, user, role } = useAuth();
  const [splashDone, setSplashDone] = React.useState(false);
  const [codeVerified, setCodeVerified] = React.useState(() => isCollegeCodeVerified());

  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;
  if (!codeVerified) return <CollegeCodeGate onVerified={() => setCodeVerified(true)} />;
  if (loading) return <Spinner />;
  if (!user) return <AuthScreen />;

  return (
    <React.Suspense fallback={<Spinner />}>
      {role ? <CollegeApp /> : (
        <div className="grid min-h-screen place-items-center px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    </React.Suspense>
  );
}
