import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { Logo } from "@/components/Logo";

export default async function DashboardPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <div className="min-h-dvh bg-fa-canvas text-fa-primary">
      <header className="sticky top-0 z-30 border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo size="md" className="flex-shrink-0" />
          <span className="text-fa-divider text-sm">/</span>
          <span className="text-sm text-fa-muted">Stats</span>
        </div>
      </header>
      <DashboardView />
    </div>
  );
}
