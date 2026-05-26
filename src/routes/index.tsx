import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { AdminApp } from "@/components/admin/AdminApp";
import { TeacherApp } from "@/components/teacher/TeacherApp";
import { StudentApp } from "@/components/student/StudentApp";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

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
  if (role === "admin") return <AdminApp />;
  if (role === "teacher") return <TeacherApp />;
  if (role === "student") return <StudentApp />;

  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-sm text-muted-foreground">Your account has no role yet. Please contact support.</p>
      </div>
    </div>
  );
}
