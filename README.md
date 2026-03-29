# fileaway.app

A web app that lets users save social media links and have AI automatically extract actionable information from them — turning passive saves into useful, organized content.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: Supabase Postgres + Auth + Storage
- **Styling**: Tailwind CSS + shadcn/ui
- **Job Queue**: pg-boss (Postgres-backed background jobs)
- **Video Scraping**: Apify (TikTok/Instagram actors)
- **AI Processing**: Google Gemini 1.5 Flash/Pro
- **Hosting**: Vercel

## Local Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional for full functionality) [Apify](https://apify.com) and [Google AI Studio](https://aistudio.google.com) API keys

### 1. Clone and install

```bash
git clone <repo-url>
cd fileaway
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and fill in your Supabase URL, anon key, service role key, and DATABASE_URL
```

### 3. Run database migrations

Using the Supabase CLI:

```bash
npx supabase db push
# or apply manually via the Supabase SQL editor
```

Migrations are in `supabase/migrations/`:
- `20260329000001_initial_schema.sql` — SavedItem table, RLS policies, enums
- `20260329000002_pgboss_setup.sql` — pgboss schema and permissions

### 4. Start the dev server

```bash
npm run dev
```

App is available at [http://localhost:3000](http://localhost:3000).

## API

### `POST /api/save`

Accepts a URL, creates a `SavedItem` record, and queues a background processing job.

**Request body:**
```json
{ "url": "https://www.tiktok.com/@example/video/123" }
```

**Response (202):**
```json
{
  "jobId": "uuid",
  "savedItemId": "uuid",
  "status": "pending"
}
```

## Project Structure

```
fileaway/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── save/route.ts       # POST /api/save endpoint
│   │   ├── page.tsx                # Home page (Phase 2: full UI)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   ├── server.ts           # Server + service role clients
│   │   │   └── types.ts            # SavedItem types
│   │   ├── queue/
│   │   │   └── boss.ts             # pg-boss singleton + job name constants
│   │   └── integrations/
│   │       ├── apify.ts            # Apify scraping stub + platform detection
│   │       └── gemini.ts           # Gemini categorization + extraction stubs
│   └── components/
│       └── ui/                     # shadcn/ui components
└── supabase/
    └── migrations/                 # SQL migration files
```

## Data Model

```
SavedItem {
  id             uuid (PK)
  user_id        uuid (FK -> auth.users)
  source_url     text
  platform       tiktok | instagram | youtube | twitter | other
  category       food | fitness | recipe | how-to | video-analysis | other
  raw_content    jsonb  (scraped metadata + transcript from Apify)
  extracted_data jsonb  (structured JSON from Gemini)
  action_taken   text   (AI recommendation)
  user_correction text  (user override)
  status         pending | processing | done | failed
  created_at     timestamptz
  updated_at     timestamptz
}
```

## Phase Roadmap

| Phase | Scope | Owner |
|-------|-------|-------|
| Phase 1 (current) | Scaffold, DB schema, URL submission API, Apify + Gemini stubs | Engineer |
| Phase 2 | Card feed UI, action buttons, category display | Frontend Engineer |
| Phase 3 | User corrections, correction storage, dashboard | Engineer |
| Phase 4 | Auth, mobile-responsive, bookmarklet, error handling | Both |
