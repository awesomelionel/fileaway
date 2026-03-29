export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">fileaway.app</h1>
          <p className="text-muted-foreground text-lg">
            Save social media links. AI extracts the useful parts.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Paste a link to save it</h2>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.tiktok.com/@..."
              className="flex-1 rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              disabled
            />
            <button
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
              disabled
            >
              Save
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            UI coming soon — Phase 2 (Frontend Engineer)
          </p>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            API ready at{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">POST /api/save</code>
          </p>
        </div>
      </div>
    </main>
  );
}
