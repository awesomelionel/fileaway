import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8]">
        <header className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0f]/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
                <div className="bg-[#f97316] rounded-[1px]" />
                <div className="bg-[#22c55e] rounded-[1px]" />
                <div className="bg-[#3b82f6] rounded-[1px]" />
                <div className="bg-[#a855f7] rounded-[1px]" />
              </div>
              <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
                file<span className="text-[#555]">away</span>
              </span>
            </a>
            <span className="text-[#333] text-sm">/</span>
            <span className="text-sm text-[#888]">Stats</span>
          </div>
        </header>
        <DashboardView />
      </div>
    </ConvexClientProvider>
  );
}
