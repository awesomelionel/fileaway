"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import "./LandingPage.css";

export function SiteFooter({ showAuthLinks = true }: { showAuthLinks?: boolean } = {}) {
  const year = new Date().getFullYear();
  return (
    <footer className="landing-footer">
      <Logo size="sm" href={null} />
      <span className="footer-copy">© {year} fileaway · save what matters</span>
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
