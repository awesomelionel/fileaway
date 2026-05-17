import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-fa-canvas">
      <header className="border-b border-fa-line">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Logo size="md" className="w-fit" />
          <nav className="flex items-center gap-5 text-xs text-fa-subtle">
            <Link href="/terms" className="hover:text-fa-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-fa-primary transition-colors">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-fa-primary mb-1">{title}</h1>
        <p className="text-xs text-fa-icon-muted mb-10">Last updated: {lastUpdated}</p>
        <div className="space-y-8 text-sm leading-relaxed text-fa-secondary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fa-primary [&_h2]:mb-2 [&_h2]:mt-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-3 [&_a]:text-fa-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-fa-muted [&_strong]:text-fa-primary [&_strong]:font-medium">
          {children}
        </div>
      </main>

      <footer className="border-t border-fa-line mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-fa-icon-muted flex items-center justify-between">
          <span>© {new Date().getFullYear()} fileaway</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-fa-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-fa-primary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
