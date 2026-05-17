"use client";

import Link from "next/link";
import "./LandingPage.css";

function FooterLogo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded grid grid-cols-2 border border-[#cfc8ba] w-5 h-5 p-1 gap-[2px]"
        style={{ background: "#fffcf7" }}
      >
        <div className="bg-[#f97316] rounded-[1px]" />
        <div className="bg-[#22c55e] rounded-[1px]" />
        <div className="bg-[#3b82f6] rounded-[1px]" />
        <div className="bg-[#a855f7] rounded-[1px]" />
      </div>
      <span
        className="font-bold tracking-tight text-xs"
        style={{ fontFamily: "var(--font-syne)", color: "#14110c" }}
      >
        file<span style={{ color: "#7a7468" }}>away</span>
      </span>
    </div>
  );
}

export function SiteFooter({ showAuthLinks = true }: { showAuthLinks?: boolean } = {}) {
  return (
    <footer className="landing-footer">
      <FooterLogo />
      <span className="footer-copy">© 2025 fileaway · save what matters</span>
      <div className="footer-links">
        {showAuthLinks && (
          <>
            <Link href="/login" className="footer-link">Sign in</Link>
            <Link href="/signup" className="footer-link">Sign up</Link>
          </>
        )}
        <Link href="/terms" className="footer-link">Terms</Link>
        <Link href="/privacy" className="footer-link">Privacy</Link>
      </div>
    </footer>
  );
}
