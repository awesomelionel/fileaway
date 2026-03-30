# fileaway.app — Architecture

> Current as of Phase 3 (Convex migration). Source: [CAL-22](/CAL/issues/CAL-22), README.

## Overview

- **Next.js 14** (App Router) calls **Convex** queries and mutations from the browser for data and writes.
- **Convex** holds the document database (`savedItems` + auth tables), runs **Convex Auth** (password sign-in), and runs **internal actions** for scraping and AI (scheduled right after each save — no separate job queue).
- **Apify** and **Gemini** run inside Convex `"use node"` actions; their API keys are configured as Convex environment variables.

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Frontend   | Next.js 14 (App Router) + TypeScript    |
| Backend    | Convex (database, server functions, scheduler) |
| Auth       | @convex-dev/auth (Password provider)   |
| Styling    | Tailwind CSS + shadcn/ui                |
| Scraping   | Apify (TikTok actor: `apidojo/tiktok-scraper`, Instagram: `apify/instagram-scraper`) |
| AI         | Google Gemini 1.5 Flash / Pro           |
| Hosting    | Vercel (frontend) + Convex Cloud (backend) |

## System Flow

```
[User pastes URL in Next.js UI]
         ↓
[useMutation → api.items.save (Convex mutation)]
         ↓
[Convex creates savedItem (status: pending)]
         ↓
[ctx.scheduler.runAfter(0, internal.processUrl.processItem)]
         ↓
[Convex Action (Node): Apify scrape]
         ↓
[Convex Action (Node): Gemini categorize + extract]
         ↓
[internal.items.updateResult → status: done]
         ↓
[useQuery → api.items.list (reactive) updates UI]
```

## Project Structure

```
fileaway/
├── convex/
│   ├── schema.ts          # savedItems + auth tables
│   ├── auth.ts            # Convex Auth config
│   ├── http.ts            # Auth HTTP routes
│   ├── items.ts           # list, save, updateCategory + internal status updates
│   └── processUrl.ts      # Node action: Apify + Gemini pipeline
├── src/
│   ├── app/               # pages (home, login, signup), layout
│   ├── components/
│   │   ├── ConvexClientProvider.tsx
│   │   ├── feed/          # Feed UI, cards
│   │   └── ui/
│   ├── lib/               # shared types, legacy helpers as needed
│   └── middleware.ts      # Convex Auth (Next.js)
└── docs/                  # Project documentation (this folder)
```

## Data Model (Convex `savedItems`)

| Field           | Type / Notes                                                    |
| --------------- | --------------------------------------------------------------- |
| `_id`           | Convex document ID                                              |
| `userId`        | `Id<"users">` (auth)                                            |
| `sourceUrl`     | Original link                                                   |
| `platform`      | `tiktok` \| `instagram` \| `youtube` \| `twitter` \| `other`   |
| `category`      | `food` \| `fitness` \| `recipe` \| `how-to` \| `video-analysis` \| `other` |
| `rawContent`    | Optional — Apify scrape payload (JSON)                          |
| `extractedData` | Optional — structured JSON from Gemini                          |
| `actionTaken`   | Optional — suggested action label                               |
| `userCorrection`| Optional — user override                                        |
| `status`        | `pending` \| `processing` \| `done` \| `failed`                 |

Indexes: `by_userId`, `by_status`.

## Convex API Surface

| Surface                  | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `api.items.list`         | Query — saved items for signed-in user (reactive)                 |
| `api.items.save`         | Mutation — insert item, schedule `processUrl.processItem`          |
| `api.items.updateCategory` | Mutation — user category override                               |
| `internal.processUrl.processItem` | Action — Apify scrape → Gemini categorize/extract → updateResult |

## Extracted Data Schemas (by category)

| Category        | `extractedData` shape                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `food`          | `{ name, address, cuisine_type, why_visit }`                               |
| `recipe`        | `{ ingredients: [...], steps_summary }`                                    |
| `fitness`       | `{ exercises: [...], sets_reps, muscle_groups: [...] }`                    |
| `how-to`        | `{ steps: [...] }`                                                         |
| `video-analysis` | `{ summary }`                                                             |
| `other`         | `{ summary }`                                                              |

## Migration History

| Phase | Backend      | Notes                                                    |
| ----- | ------------ | -------------------------------------------------------- |
| 1–2   | Supabase + pgboss | Original stack; job queue with pgboss              |
| 3+    | Convex       | Full migration: DB, auth, background jobs ([CAL-22](/CAL/issues/CAL-22)) |

## Environment Variables

| Variable                 | Where Set          | Purpose                         |
| ------------------------ | ------------------ | ------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` / Vercel | Convex deployment URL        |
| `CONVEX_DEPLOYMENT`      | `.env.local` / Vercel | Convex deployment reference  |
| `APIFY_API_TOKEN`        | Convex dashboard   | Apify scraping access           |
| `GEMINI_API_KEY`         | Convex dashboard   | Google Gemini AI access         |
