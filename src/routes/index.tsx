import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load the role-specific apps so users only download the code
// they actually need. This dramatically reduces initial JS over 4G.
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

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24">
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function Index() {
  const { loading, user, role } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <h1 className="brand-font text-4xl">Attendify</h1>
          <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;

  return (
    <React.Suspense fallback={<AppSkeleton />}>
      {role === "admin" && <AdminApp />}
      {role === "teacher" && <TeacherApp />}
      {role === "student" && <StudentApp />}
      {!role && (
        <div className="grid min-h-screen place-items-center px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your account has no role yet. Please contact support.
          </p>
        </div>
      )}
    </React.Suspense>
  );
}
