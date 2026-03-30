# fileaway.app

A web app that lets users save social media links and have AI automatically extract actionable information from them — turning passive saves into useful, organized content.

## Architecture

- **Next.js 14** (App Router) calls **Convex** queries and mutations from the browser for data and writes.
- **Convex** holds the document database (`savedItems` + auth tables), runs **Convex Auth** (password sign-in), and runs **internal actions** for scraping and AI (scheduled right after each save — no separate job queue).
- **Apify** and **Gemini** run inside Convex `"use node"` actions; their API keys are configured as [Convex environment variables](https://docs.convex.dev/production/environment-variables) for deployments and local dev.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: [Convex](https://www.convex.dev/) (database, server functions, scheduler)
- **Auth**: [@convex-dev/auth](https://labs.convex.dev/auth) (Password provider)
- **Styling**: Tailwind CSS + shadcn/ui
- **Video scraping**: Apify (TikTok / Instagram actors)
- **AI**: Google Gemini 1.5 Flash / Pro
- **Hosting**: Vercel (frontend) + Convex Cloud (backend)

## Local Setup

### Prerequisites

- Node.js 18+
- A [Convex](https://dashboard.convex.dev) project (created when you run `npx convex dev` the first time)
- Convex dashboard: set `APIFY_API_TOKEN` and `GEMINI_API_KEY` (or add them to `.env.local` for dev — see below)
- (Optional) [Apify](https://apify.com) and [Google AI Studio](https://aistudio.google.com) accounts if you need to rotate keys

### 1. Clone and install

```bash
git clone <repo-url>
cd fileaway
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` from the Convex dashboard. For local development, `npx convex dev` syncs your functions and can push env vars from `.env.local` when configured.

Set **`APIFY_API_TOKEN`** and **`GEMINI_API_KEY`** in the Convex dashboard (recommended for production) or ensure they are available to `convex dev` per Convex docs so URL processing works.

### 3. Run Convex and Next.js

In one terminal (pushes schema and functions, watches for changes):

```bash
npx convex dev
```

In another:

```bash
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

### Production build

`npm run build` runs `convex deploy` then `next build`. Ensure Convex env vars are set in the target deployment.

## Data access (Convex)

Clients use the generated API (see `convex/_generated/api`):

| Surface | Purpose |
|--------|---------|
| `api.items.list` | Query — saved items for the signed-in user (reactive) |
| `api.items.save` | Mutation — insert item, schedule `processUrl.processItem` |
| `api.items.updateCategory` | Mutation — user category override |

Saving a URL does **not** go through a Next.js `POST /api/*` route; the UI calls `api.items.save` via `useMutation`.

Background processing is **`internal.processUrl.processItem`**: Apify scrape → Gemini categorize → Gemini extract → `internal.items.updateResult` / `markFailed`.

## Project structure

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
│   └── middleware.ts     # Convex Auth (Next.js)
└── package.json
```

## Data model (Convex `savedItems`)

| Field | Notes |
|-------|--------|
| `_id` | Convex document ID |
| `userId` | `Id<"users">` (auth) |
| `sourceUrl` | Original link |
| `platform` | `tiktok` \| `instagram` \| `youtube` \| `twitter` \| `other` |
| `category` | `food` \| `fitness` \| `recipe` \| `how-to` \| `video-analysis` \| `other` |
| `rawContent` | Optional — scrape payload |
| `extractedData` | Optional — structured JSON from Gemini |
| `actionTaken` | Optional — suggested action label |
| `userCorrection` | Optional — user override |
| `status` | `pending` \| `processing` \| `done` \| `failed` |

Indexes: `by_userId`, `by_status`.

## Phase roadmap

| Phase | Scope | Owner |
|-------|-------|-------|
| Phase 1 (current) | Convex backend, auth, feed + save flow, Apify + Gemini in actions | Engineer |
| Phase 2 | Deeper UX polish, action buttons, empty/error states | Frontend Engineer |
| Phase 3 | User corrections persistence, dashboard | Engineer |
| Phase 4 | Mobile-responsive polish, bookmarklet, hardening | Both |
