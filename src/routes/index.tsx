import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { Loader2 } from "lucide-react";

const AdminApp = React.lazy(() =>
  import("@/components/admin/AdminApp").then((m) => ({ default: m.AdminApp })),
);
const TeacherApp = React.lazy(() =>
  import("@/components/teacher/TeacherApp").then((m) => ({ default: m.TeacherApp })),
);
const StudentApp = React.lazy(() =>
  import("@/components/student/StudentApp").then((m) => ({ default: m.StudentApp })),
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

  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;
  if (loading) return <Spinner />;
  if (!user) return <AuthScreen />;

  return (
    <React.Suspense fallback={<Spinner />}>
      {role === "admin" && <AdminApp />}
      {role === "teacher" && <TeacherApp />}
      {role === "student" && <StudentApp />}
      {!role && (
        <div className="grid min-h-screen place-items-center px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    </React.Suspense>
  );
}
