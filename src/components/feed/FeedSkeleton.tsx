// Server-rendered skeleton shown while FeedApp hydrates.
// Mirrors the FeedApp shell so there's no layout shift.
import { Logo } from "@/components/Logo";

export function FeedSkeleton() {
  return (
    <div className="min-h-dvh bg-fa-canvas text-fa-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size="md" href={null} />
            {/* URL input placeholder */}
            <div className="hidden sm:block flex-1">
              <div className="w-full h-9 bg-fa-input border border-fa-line rounded-lg animate-pulse" />
            </div>
            {/* Nav placeholders */}
            <div className="ml-auto flex items-center gap-1">
              <div className="w-10 h-7 bg-fa-muted-bg rounded-lg animate-pulse" />
              <div className="w-12 h-7 bg-fa-muted-bg rounded-lg animate-pulse" />
              <div className="w-14 h-7 bg-fa-muted-bg rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Filters row */}
      <div className="sm:sticky sm:top-[57px] z-20 bg-fa-canvas/95 backdrop-blur-sm border-b border-fa-border">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <div className="w-36 h-7 bg-fa-surface border border-fa-line rounded-lg animate-pulse" />
          <div className="flex gap-1 flex-1">
            {["All", "", "", ""].map((_, i) => (
              <div key={i} className="h-7 w-16 bg-fa-surface border border-fa-line rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Feed grid */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-fa-surface border border-fa-border-soft border-l-4 border-l-fa-line rounded-lg p-4 space-y-3 animate-pulse"
            >
              <div className="flex gap-2">
                <div className="h-4 w-12 bg-fa-chip rounded" />
                <div className="h-4 w-16 bg-fa-chip rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-3/4 bg-fa-chip rounded" />
                <div className="h-3 w-1/2 bg-fa-muted-bg rounded" />
                <div className="h-3 w-5/6 bg-fa-muted-bg rounded" />
              </div>
              <div className="h-7 w-28 bg-fa-muted-bg rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
