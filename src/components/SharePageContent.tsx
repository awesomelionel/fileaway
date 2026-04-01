"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SharePageContent() {
  const [bookmarkletHref, setBookmarkletHref] = useState("#");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    const code = `javascript:(function(){window.open('${origin}/add?url='+encodeURIComponent(location.href),'_blank')})()`;
    setBookmarkletHref(code);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="sticky top-0 z-30 border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-fa-input border border-fa-line group-hover:border-fa-ring transition-colors">
              <div className="bg-[#f97316] rounded-[1px]" />
              <div className="bg-[#22c55e] rounded-[1px]" />
              <div className="bg-[#3b82f6] rounded-[1px]" />
              <div className="bg-[#a855f7] rounded-[1px]" />
            </div>
            <span className="font-bold text-sm tracking-tight text-fa-primary">
              file<span className="text-fa-subtle">away</span>
            </span>
          </Link>
          <span className="text-fa-divider text-sm">/</span>
          <span className="text-sm text-fa-muted">Share extension</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">
        {/* Bookmarklet */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-fa-primary">
            Browser bookmarklet
          </h2>
          <p className="text-sm text-fa-icon-muted">
            Drag the button below to your bookmarks bar. Click it on any page
            to save the current URL to fileaway.
          </p>

          <div className="flex items-center gap-4">
            <a
              href={bookmarkletHref}
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-fa-input border border-fa-line text-sm font-medium text-fa-primary cursor-grab hover:border-fa-ring transition-colors select-none"
            >
              <span>📎</span>
              Save to fileaway
            </a>
            <span className="text-xs text-fa-faint">← drag this to your bookmarks bar</span>
          </div>

          <div className="bg-fa-surface border border-fa-border-soft rounded-lg p-4 space-y-2">
            <p className="text-[11px] text-fa-subtle font-medium uppercase tracking-wider">
              Or copy the bookmarklet code manually
            </p>
            <code className="block text-[11px] text-fa-icon-muted font-mono break-all">
              {bookmarkletHref}
            </code>
            <button
              onClick={handleCopy}
              className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy code"}
            </button>
          </div>
        </section>

        {/* Mobile instructions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-fa-primary">
            Mobile sharing
          </h2>
          <p className="text-sm text-fa-icon-muted">
            On iPhone or Android, you can share any link directly to fileaway:
          </p>
          <ol className="space-y-2 text-sm text-fa-secondary-alt">
            <li className="flex gap-3">
              <span className="text-fa-subtle flex-shrink-0">1.</span>
              Open the link you want to save in Safari or Chrome.
            </li>
            <li className="flex gap-3">
              <span className="text-fa-subtle flex-shrink-0">2.</span>
              Tap the Share button (iOS) or menu (Android).
            </li>
            <li className="flex gap-3">
              <span className="text-fa-subtle flex-shrink-0">3.</span>
              Select <strong className="text-fa-soft">Copy Link</strong>, then
              open fileaway and paste it in the URL bar.
            </li>
          </ol>
        </section>

        <div>
          <Link href="/" className="text-xs text-fa-subtle hover:text-fa-muted transition-colors">
            ← Back to feed
          </Link>
        </div>
      </main>
    </div>
  );
}
