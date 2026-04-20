# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run both in parallel)
npx convex dev       # Convex backend watcher (terminal 1)
npm run dev          # Next.js frontend at localhost:3000 (terminal 2)

# Build & deploy
npm run build        # Runs: npx convex deploy --cmd 'next build'

# Tests
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage

# Lint
npm run lint
```

## Architecture

**fileaway** saves social media links and uses AI to extract structured, actionable data from them.

### Stack

- **Frontend**: Next.js 14 App Router + React 18 + TypeScript, styled with Tailwind CSS + shadcn/ui
- **Backend**: Convex (real-time DB + serverless functions + auth)
- **Scraping**: Apify (TikTok/Instagram actors)
- **AI**: Google Gemini (1.5 Flash for categorization, 1.5 Pro for rich extraction)

### Backend (`convex/`)

All backend logic lives in Convex — no separate API server.

- `schema.ts` — `savedItems` table with fields: `userId`, `sourceUrl`, `platform`, `category`, `rawContent`, `extractedData`, `actionTaken`, `status` (`pending | processing | done | failed`)
- `auth.ts` + `http.ts` — `@convex-dev/auth` with Password provider
- `items.ts` — Public queries/mutations (`list`, `save`, `updateCategory`) + internal mutations called by the processing action
- `processUrl.ts` — Node action: Apify scrape → Gemini categorize → Gemini extract → update item. This is the core pipeline. Runs as `internal.processUrl.processItem`, scheduled by `api.items.save`.

**Processing pipeline** in `processUrl.ts`:
1. Scrape via Apify (TikTok/Instagram only; YouTube/X/other skipped)
2. Categorize via Gemini 1.5 Flash → one of: `food | recipe | fitness | how-to | video-analysis | other`
3. Extract structured JSON via Gemini (1.5 Pro for food/recipe/fitness/how-to, 1.5 Flash for others)
4. Persist via `internal.items.updateResult`

### Frontend (`src/`)

- `middleware.ts` — Protects all routes except `/login` and `/signup` via `isAuthenticatedNextjs()`
- `app/layout.tsx` — Wraps app in `ConvexAuthNextjsServerProvider` + `ConvexClientProvider`
- `components/ConvexClientProvider.tsx` — Client-side Convex + auth context
- `components/feed/FeedApp.tsx` — Main feed: URL input, category tabs (with counts), search (350ms debounce), reactive `useQuery(api.items.list)`
- `components/feed/ItemCard.tsx` — Category-specific card renderers + action buttons:
  - **food** → Google Maps link
  - **recipe** → Copy ingredients to clipboard
  - **fitness** → Save to `localStorage` key `fileaway-routine`
  - **how-to** → Full-screen step guide modal
  - **video/other** → Copy summary to clipboard

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Testing

Tests live in `tests/`. Jest is configured with `ts-jest` in Node environment. Coverage excludes `app/` and `components/` directories.

### Environment Variables

Required in `.env.local`:
```
CONVEX_DEPLOYMENT=dev:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
APIFY_API_TOKEN=...
X_CONSUMER_KEY=...
X_CONSUMER_SECRET=...
X_BEARER_TOKEN=...
GEMINI_API_KEY=...
```

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
