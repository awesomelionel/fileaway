import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="sticky top-0 z-30 border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-fa-input border border-fa-line group-hover:border-fa-ring transition-colors">
              <div className="bg-[#f97316] rounded-[1px]" />
              <div className="bg-[#22c55e] rounded-[1px]" />
              <div className="bg-[#3b82f6] rounded-[1px]" />
              <div className="bg-[#a855f7] rounded-[1px]" />
            </div>
            <span className="font-bold text-sm tracking-tight text-fa-primary">
              file<span className="text-fa-subtle">away</span>
            </span>
          </a>
          <span className="text-fa-divider text-sm">/</span>
          <span className="text-sm text-fa-muted">Stats</span>
        </div>
      </header>
      <DashboardView />
    </div>
  );
}
