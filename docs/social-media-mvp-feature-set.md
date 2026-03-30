# MVP Feature Set for Social Media Product

> Source: [CAL-2](/CAL/issues/CAL-2#document-plan) — Written by PM
> This covers the broader social media product goal, separate from fileaway.app.

## Pain Point Analysis

### Top 3 Pain Points for Everyday People

---

#### 1. Algorithmic Overload & Loss of Control

Everyday users feel overwhelmed by infinite scroll and opaque algorithms that prioritize engagement over authentic connection. They miss posts from real friends while being flooded with content they never asked for. Studies show the average person spends 2h+ per day on social media but reports feeling less connected, not more.

**Root cause:** Engagement-maximizing algorithms are deliberately designed to be addictive, not useful.

---

#### 2. Content Creation Is Too Hard

Posting quality content requires skill in photo/video editing, caption writing, hashtag research, timing strategy, and understanding platform-specific formats. For everyday people — not influencers or marketers — this is a full-time job. Most give up or post rarely.

**Root cause:** Platforms are built by and for power users. The creation tools assume technical fluency.

---

#### 3. Privacy Is Confusing and Scary

Users do not understand what data is collected, how it is used, or how to protect themselves. Privacy settings are buried under layers of menus, written in legalese, and reset themselves. Many people feel surveilled but powerless to act.

**Root cause:** Data collection is the business model. Platforms intentionally obscure controls.

---

## MVP Feature Set

### Feature 1: Transparent, Controllable Feed

**What:** A feed where users explicitly control what they see — choose between people-first (chronological posts from connections), interest-based (topics the user selects), or discovery mode. Each post shows a plain-English reason why it appeared.

**Acceptance Criteria:**
- User can switch feed mode in 2 taps or fewer
- Every post shows a one-line "Why am I seeing this?" label
- Chronological mode shows zero algorithmic reordering
- Settings persist across sessions and are never reset without explicit user action
- Feed loads in under 2 seconds on median mobile hardware

---

### Feature 2: One-Tap Content Creation with AI Assist

**What:** A simplified create flow — tap, capture (photo/video/text), and post. AI generates caption suggestions and hashtags based on the media. Auto-formats content for the selected platform. No editing expertise required.

**Acceptance Criteria:**
- Photo/video capture to published post in 5 taps or fewer
- AI suggests 3 caption options within 3 seconds of media upload
- Suggested captions match the user's writing style after 5+ posts
- Auto-crop and format media to platform specs without user intervention
- User can override any AI suggestion at any step

---

### Feature 3: Plain-Language Privacy Dashboard

**What:** A single-screen privacy center that shows in plain English what data is collected, why, and how to limit it. One-tap presets: Open, Balanced, Private. No legalese.

**Acceptance Criteria:**
- All privacy controls reachable from one screen
- Each data collection item has a 20-word or fewer plain English description
- Three one-tap preset modes (Open / Balanced / Private) with instant effect
- Dashboard shows a real-time summary: who can see your profile, what data is stored
- Privacy settings never reset without explicit user consent

---

## Recommended Tech Stack

| Layer            | Technology                                           | Rationale                                              |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Mobile (primary) | React Native                                         | Cross-platform, large talent pool, fast iteration      |
| Web              | Next.js (React)                                      | SSR for performance, same component model as mobile    |
| Backend API      | Node.js + TypeScript                                 | Consistency with frontend team, strong ecosystem       |
| Database         | PostgreSQL                                           | Relational data model for social graphs; battle-tested |
| Media storage    | S3-compatible object store (AWS S3 or Cloudflare R2) | Cheap, scalable, CDN-native                            |
| Real-time        | WebSockets via Socket.io                             | Notifications, live feed updates                       |
| AI features      | Anthropic Claude API                                 | Caption generation, privacy plain-language rewriting   |
| Auth             | Clerk or Auth.js                                     | Handles social login, sessions, security               |
| CI/CD            | GitHub Actions                                       | Standard, free for small teams                         |
| Infra            | Fly.io or Railway                                    | Simple deployment, scales with demand                  |

---

## Summary

The MVP focuses on three problems no major platform solves well for everyday users: feed control, effortless creation, and understandable privacy. These features are achievable with a small team in a 3-6 month build window and directly serve the company goal of making social media easier for everyday people.
