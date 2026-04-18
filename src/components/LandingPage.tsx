"use client";

import Link from "next/link";
import "./LandingPage.css";

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const grid =
    size === "lg" ? "w-9 h-9 p-2 gap-0.5" :
    size === "sm" ? "w-5 h-5 p-1 gap-[2px]" :
    "w-7 h-7 p-1.5 gap-0.5";
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className="flex items-center gap-2">
      <div className={`rounded grid grid-cols-2 border border-[#cfc8ba] ${grid}`} style={{ background: "#fffcf7" }}>
        <div className="bg-[#f97316] rounded-[1px]" />
        <div className="bg-[#22c55e] rounded-[1px]" />
        <div className="bg-[#3b82f6] rounded-[1px]" />
        <div className="bg-[#a855f7] rounded-[1px]" />
      </div>
      <span className={`font-bold tracking-tight ${text}`} style={{ fontFamily: "var(--font-syne)", color: "#14110c" }}>
        file<span style={{ color: "#7a7468" }}>away</span>
      </span>
    </div>
  );
}

// ─── Real data cards (sourced from actual DB items) ────────────────────────────

function FoodCard() {
  // Real item: Next Door Spanish Cafe · tiktok.com/ZSH26xWpW
  const dishes = ["Burnt cheesecake", "Paella", "Fideuà"];
  return (
    <div className="landing-card" style={{ borderTopColor: "#ffc5b2", borderTopWidth: "3px", background: "#fffbf9" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="category-pill" style={{ background: "#fff0ec", color: "#f4623a", borderColor: "#ffc5b2" }}>food</span>
        <span className="text-[11px] font-mono" style={{ color: "#a8a29e" }}>tiktok.com/ZSH26xWpW</span>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ fontFamily: "var(--font-syne)", color: "#1c1917" }}>
        Next Door Spanish Cafe
      </div>
      <div className="text-xs mb-3" style={{ color: "#78716c" }}>East Singapore · Spanish · $$</div>
      <div className="text-xs mb-1" style={{ color: "#a8a29e" }}>Why visit</div>
      <div className="text-xs mb-3 leading-relaxed" style={{ color: "#78716c" }}>
        Full Spanish lunch spread for $29++ — and you have to try the burnt cheesecake.
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {dishes.map((d) => (
          <span key={d} className="text-[10px] px-2.5 py-0.5 rounded-full border" style={{ background: "#fff0ec", color: "#c4502a", borderColor: "#ffd4c4" }}>{d}</span>
        ))}
      </div>
      <button className="cta-pill" style={{ background: "#fff0ec", color: "#f4623a", borderColor: "#ffc5b2" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        Open in Maps
      </button>
    </div>
  );
}

function RecipeCard() {
  // Real item: High Protein Chicken Pasta Meal Prep · tiktok.com/@cookingforgains
  const ingredients = [
    "4 lbs chicken breast",
    "Prego Italian + Alfredo sauce",
    "2 boxes protein Barilla pasta",
    "1 bag frozen broccoli",
    "+ 5 more ingredients",
  ];
  return (
    <div className="landing-card" style={{ borderTopColor: "#c9b8f0", borderTopWidth: "3px", background: "#faf8ff" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="category-pill" style={{ background: "#f0ebff", color: "#7c5cbf", borderColor: "#c9b8f0" }}>recipe</span>
        <span className="text-[11px] font-mono" style={{ color: "#a8a29e" }}>tiktok.com/@cookingforgains</span>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ fontFamily: "var(--font-syne)", color: "#1c1917" }}>
        High Protein Chicken Pasta Meal Prep · 4h · Serves 14
      </div>
      <ul className="space-y-1 mb-4">
        {ingredients.map((i) => (
          <li key={i} className="text-xs flex items-center gap-1.5" style={{ color: "#78716c" }}>
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#7c5cbf" }} />
            {i}
          </li>
        ))}
      </ul>
      <button className="cta-pill" style={{ background: "#f0ebff", color: "#7c5cbf", borderColor: "#c9b8f0" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy ingredients
      </button>
    </div>
  );
}

function FitnessCard() {
  // Real item: Medicine Ball Ab Workout · instagram.com/reel/DU9Oz3qER4K
  const exercises = [
    "Medicine Ball Russian Twists — 15 × 3",
    "Medicine Ball Crunches — 15 × 3",
    "Medicine Ball Slams — 12 × 3",
    "Medicine Ball V-Ups — 12 × 3",
  ];
  return (
    <div className="landing-card" style={{ borderTopColor: "#9ee0c2", borderTopWidth: "3px", background: "#f7fef9" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="category-pill" style={{ background: "#eafaf3", color: "#28a46a", borderColor: "#9ee0c2" }}>fitness</span>
        <span className="text-[11px] font-mono" style={{ color: "#a8a29e" }}>instagram.com/reel/DU9Oz3qER4K</span>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ fontFamily: "var(--font-syne)", color: "#1c1917" }}>
        Medicine Ball Ab Workout · 15 min · Intermediate
      </div>
      <ul className="space-y-1 mb-4">
        {exercises.map((e) => (
          <li key={e} className="text-xs flex items-center gap-1.5" style={{ color: "#78716c" }}>
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#28a46a" }} />
            {e}
          </li>
        ))}
      </ul>
      <button className="cta-pill" style={{ background: "#eafaf3", color: "#28a46a", borderColor: "#9ee0c2" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save to routine
      </button>
    </div>
  );
}

function TravelCard() {
  // Real item: Solo Trip to SAVAYA Club · instagram.com/reel/DUUPHw5jU83
  const topics = ["Solo Travel", "Bali Nightlife", "Uluwatu", "Travel Inspiration"];
  return (
    <div className="landing-card" style={{ borderTopColor: "#a8d4f8", borderTopWidth: "3px", background: "#f7fbff" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="category-pill" style={{ background: "#eaf4ff", color: "#2e7fd4", borderColor: "#a8d4f8" }}>travel</span>
        <span className="text-[11px] font-mono" style={{ color: "#a8a29e" }}>instagram.com/reel/DUUPHw5jU83</span>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ fontFamily: "var(--font-syne)", color: "#1c1917" }}>
        Solo Trip to SAVAYA — #1 Club in Asia
      </div>
      <div className="text-xs mb-3 leading-relaxed" style={{ color: "#78716c" }}>
        Solo travel adventure to SAVAYA in Uluwatu, Bali — a highly-rated nightlife destination. Inspiration for exploring popular spots independently.
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {topics.map((t) => (
          <span key={t} className="text-[10px] px-2.5 py-0.5 rounded-full border" style={{ background: "#eaf4ff", color: "#2563a8", borderColor: "#bcd9f5" }}>{t}</span>
        ))}
      </div>
      <button className="cta-pill" style={{ background: "#eaf4ff", color: "#2e7fd4", borderColor: "#a8d4f8" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        Copy summary
      </button>
    </div>
  );
}

// ─── Platform icons ────────────────────────────────────────────────────────────

function TikTokIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#faf9f6"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="landing-root">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link href="/signup" className="btn-ghost" style={{ padding: "0.5rem 1.1rem", fontSize: "0.8rem" }}>
            Sign up
          </Link>
          <Link href="/login" className="btn-primary" style={{ padding: "0.5rem 1.1rem", fontSize: "0.8rem" }}>
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-eyebrow">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
          AI-powered link intelligence
        </div>

        <h1 className="hero-headline">
          Save links.<br/>
          Extract <span className="accent">what matters.</span>
        </h1>

        <p className="hero-subtext">
          Paste any TikTok, Instagram, YouTube or X link. fileaway&apos;s AI reads it and turns it into structured, actionable data — restaurant directions, ingredient lists, workout routines, step-by-step guides.
        </p>

        <div className="hero-ctas">
          <Link href="/signup" className="btn-primary">
            Get started free
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
        </div>

        <div className="hero-demo">
          <div className="demo-platforms" style={{ color: "#d4cfc9" }}>
            <TikTokIcon />
            <InstagramIcon />
            <YouTubeIcon />
            <XIcon />
          </div>
          <div className="demo-input">
            https://www.tiktok.com/@gordon.ramsay/video/73824…<span className="cursor-blink" />
          </div>
          <div className="demo-btn">Save</div>
        </div>
      </section>

      <div className="section-divider"><span>how it works</span></div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="how-section">
        <p className="section-label">The process</p>
        <h2 className="section-title">Three steps from link<br/>to useful intelligence</h2>

        <div className="steps-grid">
          {/* Step 1 */}
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div className="step-title">Paste any link</div>
            <p className="step-desc">Drop a URL from any major platform into your feed. No browser extension needed — just paste and go.</p>
            <div className="platform-tags">
              <span className="platform-tag"><TikTokIcon />TikTok</span>
              <span className="platform-tag"><InstagramIcon />Instagram</span>
              <span className="platform-tag"><YouTubeIcon />YouTube</span>
              <span className="platform-tag"><XIcon />X / Twitter</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="step-title">AI reads & categorizes</div>
            <p className="step-desc">Gemini scrapes the content and categorizes it — food spots, recipes, workouts, tutorials, travel, and more. Automatically.</p>
            <div className="platform-tags">
              <span className="platform-tag" style={{ color: "#f4623a", borderColor: "#ffc5b2", background: "#fff0ec" }}>food</span>
              <span className="platform-tag" style={{ color: "#7c5cbf", borderColor: "#c9b8f0", background: "#f0ebff" }}>recipe</span>
              <span className="platform-tag" style={{ color: "#28a46a", borderColor: "#9ee0c2", background: "#eafaf3" }}>fitness</span>
              <span className="platform-tag" style={{ color: "#2e7fd4", borderColor: "#a8d4f8", background: "#eaf4ff" }}>travel</span>
              <span className="platform-tag">how-to</span>
              <span className="platform-tag">video</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="step-title">Take action instantly</div>
            <p className="step-desc">Each card gives you the right action for its category — open in Maps, copy a shopping list, save a workout, follow step-by-step.</p>
            <div className="platform-tags">
              <span className="platform-tag" style={{ color: "#f4623a", borderColor: "#ffc5b2", background: "#fff0ec" }}>→ Maps</span>
              <span className="platform-tag" style={{ color: "#7c5cbf", borderColor: "#c9b8f0", background: "#f0ebff" }}>→ Clipboard</span>
              <span className="platform-tag" style={{ color: "#28a46a", borderColor: "#9ee0c2", background: "#eafaf3" }}>→ Routine</span>
              <span className="platform-tag" style={{ color: "#2e7fd4", borderColor: "#a8d4f8", background: "#eaf4ff" }}>→ Guide</span>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"><span>category intelligence</span></div>

      {/* ── Cards showcase ───────────────────────────────────────────────── */}
      <section className="cards-section">
        <div className="cards-header">
          <p className="section-label">Extracted output</p>
          <h2 className="section-title">Every link becomes<br/>something you can use</h2>
        </div>
        <div className="cards-grid">
          <FoodCard />
          <RecipeCard />
          <FitnessCard />
          <TravelCard />
        </div>
      </section>

      <div className="section-divider"><span>get started</span></div>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div style={{ position: "relative" }}>
          <div className="hero-eyebrow" style={{ marginBottom: "1.5rem" }}>
            Free to use · No credit card required
          </div>
          <h2 className="cta-title">
            Stop bookmarking.<br/>
            Start <span style={{ color: "#f4623a" }}>filing away.</span>
          </h2>
          <p className="cta-sub">Your personal AI feed for the links that actually matter.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/signup" className="btn-primary" style={{ fontSize: "0.95rem", padding: "0.85rem 2.25rem" }}>
              Create your feed
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <Logo size="sm" />
        <span className="footer-copy">© 2025 fileaway · save what matters</span>
        <div className="footer-links">
          <Link href="/login" className="footer-link">Sign in</Link>
          <Link href="/signup" className="footer-link">Sign up</Link>
        </div>
      </footer>

    </div>
  );
}
