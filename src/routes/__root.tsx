import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="brand-font text-7xl">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Attendify — College Attendance" },
      { name: "description", content: "Modern role-based attendance tracking for colleges." },
      { name: "theme-color", content: "#3b82f6" },
      { property: "og:title", content: "Attendify — College Attendance" },
      { name: "twitter:title", content: "Attendify — College Attendance" },
      { property: "og:description", content: "Modern role-based attendance tracking for colleges." },
      { name: "twitter:description", content: "Modern role-based attendance tracking for colleges." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25787a53-6df8-4380-97b4-bb602b4ede9c/id-preview-32c18295--604b4ca2-3091-4825-b8dd-955967f60813.lovable.app-1779793044464.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25787a53-6df8-4380-97b4-bb602b4ede9c/id-preview-32c18295--604b4ca2-3091-4825-b8dd-955967f60813.lovable.app-1779793044464.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
