# MVP Project Plan: fileaway.app

> Source: [CAL-7](/CAL/issues/CAL-7#document-plan) — Created 2026-03-27

## Overview

A web app that lets users save social media links and have AI automatically extract actionable information from them — turning passive saves into useful, organized content.

**App Name:** fileaway.app (domain TBD)
**AI/Scraping Budget:** $500/month (Apify + Gemini combined)

---

## Team Structure

| Role     | Agent                       | Responsibility                                  |
| -------- | --------------------------- | ----------------------------------------------- |
| Backend  | Engineer (existing)         | API, database, queue, Apify/Gemini integration  |
| Frontend | Frontend Engineer (to hire) | Next.js UI, card components, action buttons     |
| QA       | QA                          | Test plans, integration tests, regression suite |
| Product  | PM                          | PRD, acceptance criteria, success metrics       |
| Strategy | CEO                         | Prioritization, hiring, unblocking              |

---

## Product Architecture

### Core Entities

```
User
  └─ SavedItem
       ├─ source_url
       ├─ platform (tiktok | instagram | youtube | twitter)
       ├─ category (food | fitness | recipe | how-to | video-analysis | other)
       ├─ raw_content (scraped metadata + transcript)
       ├─ extracted_data (structured JSON — location, ingredients, steps, etc.)
       ├─ action_taken (what AI recommended)
       ├─ user_correction (what user overrode to)
       └─ status (pending | processing | done | failed)
```

### System Flow

```
[User pastes URL]
      ↓
[API validates URL + detects platform]
      ↓
[Job queued → Apify scrapes video/post]
      ↓
[Media sent to Google Gemini for analysis]
      ↓
[AI extracts structured data by category]
      ↓
[Action recommendation generated]
      ↓
[User sees card with result + action buttons]
      ↓
[User accepts or corrects action]
```

---

## MVP Feature Scope

### Phase 1 — Save & Process (Weeks 1–3) — Engineer

- [ ] Link submission UI (paste URL → save)
- [ ] Platform detection (TikTok, Instagram to start)
- [ ] Apify integration to scrape video + metadata
- [ ] Background job queue (Supabase Edge Functions or simple worker)
- [ ] Google Gemini API integration for video understanding
- [ ] Auto-categorization (food, fitness, recipe, how-to, other)
- [ ] Structured extraction:
  - **Food/Places:** Name, address, cuisine type, "why visit"
  - **Recipes:** Ingredient list, steps summary
  - **Workouts:** Exercise list, sets/reps if mentioned, muscle groups
  - **How-Tos:** Step-by-step summary
- [ ] Status tracking (pending → processing → done)

### Phase 2 — Display & Actions (Weeks 3–4) — Frontend Engineer + Engineer

- [ ] Card-based content feed (sorted by category)
- [ ] Action buttons per category:
  - Places → "Save to Google Maps" (opens Maps with address pre-filled)
  - Recipes → "Export ingredient list" (copy to clipboard or share)
  - Workouts → "Add to my routine" (saved list of exercises)
  - How-Tos → "Save as guide" (clean readable format)
- [ ] Manual category override
- [ ] Search and filter by category

### Phase 3 — User Corrections & Learning (Week 5) — Engineer

- [ ] "That's wrong" correction flow — user provides correct action
- [ ] Corrections stored for future prompts (few-shot examples)
- [ ] Simple dashboard: counts by category, recent saves

### Phase 4 — Polish & Auth (Week 5–6) — Frontend Engineer + Engineer

- [ ] Auth (Supabase Auth — email magic link or Google OAuth)
- [ ] Mobile-responsive design
- [ ] Share extension / bookmarklet (paste URL from mobile)
- [ ] Basic error handling and retry for failed jobs


---

## Tech Stack

| Layer           | Choice                           | Rationale                                    |
| --------------- | -------------------------------- | -------------------------------------------- |
| Frontend        | Next.js 14 (App Router)          | Full-stack, fast to ship, great DX           |
| Database        | Supabase Postgres                | Managed, includes auth + storage             |
| Auth            | Supabase Auth                    | Built-in, easy social login                  |
| Background Jobs | Supabase Edge Functions + pgboss | Queue processing without separate infra      |
| Video Scraping  | Apify (TikTok/IG actors)         | Handles anti-bot, provides structured output |
| AI Processing   | Google Gemini 2.5 Flash/Pro      | Multimodal, can analyze video natively       |
| File Storage    | Supabase Storage                 | For any downloaded thumbnails/screenshots    |
| Hosting         | Vercel                           | Zero-config Next.js deployment               |
| Styling         | Tailwind + shadcn/ui             | Fast, consistent UI components               |

> **Note:** Phase 3 migrated the backend from Supabase to **Convex** (see [architecture.md](./architecture.md)).

---

## Budget Guardrails

- **Apify + Gemini combined:** $500/month cap
- Use Gemini Flash for categorization; Pro only for complex deep extraction
- Cache scraped content to avoid re-processing duplicates
- Queue processing keeps costs predictable (no burst on every save)

---

## Out of Scope for MVP

- Shot-by-shot video breakdown (v2)
- Audio identification / music extraction
- Screenshot per shot
- YouTube / Twitter/X support
- Multi-user accounts / sharing
- Mobile app (native iOS/Android)
- Native Google Maps API write access (deep link for MVP)

---

## Risks & Mitigations

| Risk                         | Mitigation                                                    |
| ---------------------------- | ------------------------------------------------------------- |
| Apify rate limits / cost     | Cache scraped content; process in queue not on demand         |
| Gemini API cost per video    | Use Flash for categorization, Pro only for complex extraction |
| Platform blocks scraping     | Apify actors are maintained for this; fallback to yt-dlp      |
| Incorrect AI categorization  | User correction flow built in Phase 3                         |
| Google Maps API restrictions | MVP uses deep link, not write API                             |

---

## Milestones

| Week     | Milestone                                                   | Owner             |
| -------- | ----------------------------------------------------------- | ----------------- |
| Week 1   | Repo setup, Supabase project, DB schema, URL submission API | Engineer          |
| Week 2   | Apify scraping working for TikTok + Instagram               | Engineer          |
| Week 3   | Gemini integration, extraction pipeline end-to-end          | Engineer          |
| Week 3–4 | Feed UI, category cards, action buttons                     | Frontend Engineer |
| Week 5   | Corrections flow, auth, search/filter                       | Both              |
| Week 6   | QA, polish, mobile responsive, production deploy            | All               |
