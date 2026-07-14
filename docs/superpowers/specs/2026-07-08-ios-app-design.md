# fileaway iOS App — Design

**Date:** 2026-07-08
**Status:** Approved
**Approach:** Expo (React Native) development-build app in the existing monorepo, sharing the Convex backend and auth with the web app.

## Goal

Ship an iOS version of fileaway that:

1. Is locally testable in the iOS Simulator for free (no paid Apple Developer account) before any store work.
2. Supports share-to-save from TikTok/Instagram plus the full feed experience (categories, search, item cards, actions).
3. Is built to pass App Store review on the first serious attempt — the known rejection traps are in scope, not an afterthought.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Tech stack | Expo (React Native) with `expo-dev-client` | `convex/react` and `@convex-dev/auth` officially support RN; reuses TypeScript and generated Convex types. Native SwiftUI rejected because Convex Auth has no Swift support (hand-rolled token flows = highest-risk item). Capacitor rejected for Guideline 4.2 rejection risk. |
| Repo layout | `mobile/` directory inside this repo | Shares `convex/_generated/api` types with the web app. |
| Core focus | Share-to-save + full feed | Share Extension is the mobile killer feature; feed keeps parity with web. |
| Share mechanism (v1) | `expo-share-intent` — app opens with shared URL and auto-saves | True in-place popup (`expo-share-extension`) deferred to v2: it requires App Groups + Keychain sharing for auth tokens, which adds risk without changing the core UX much. |
| Auth | `@convex-dev/auth/react` + `expo-secure-store` (iOS Keychain) | Same accounts as web: email/password **plus Google and GitHub OAuth** (already configured in `convex/auth.ts`). Because third-party login is offered, **Sign in with Apple is REQUIRED** (Guideline 4.8) and is added as a provider for both mobile and backend. |
| Analytics | No PostHog in mobile v1 | Fewer App Privacy declarations, zero ATT questions. Can add later. |
| Apple Developer account | Enroll later | Simulator testing is free; enrollment starts when TestFlight is needed. |
| Styling | NativeWind (Tailwind for RN) | Keeps styling idioms close to the web app. |

## Architecture

- **One monorepo, two frontends, one backend.** The Expo app lives in `mobile/`. No structural changes to the Next.js app or Convex backend.
- **Development builds, not Expo Go** — the share intent and secure-store modules require native code. JS changes hot-reload; the native shell rebuilds only when native config changes.
- **Environment:** `EXPO_PUBLIC_CONVEX_URL` points at the dev Convex deployment during local testing, prod deployment for release builds.
- **Backend additions (two):**
  1. A `deleteAccount` mutation in `convex/` that deletes the user's auth record and all their `savedItems`. Required by App Store Guideline 5.1.1(v) — apps with account creation must offer in-app account deletion. Exposed in mobile Settings; optionally reused on web later.
  2. An **Apple provider** in `convex/auth.ts` (`@auth/core/providers/apple`) so Sign in with Apple accounts live alongside Password/GitHub/Google. Requires Apple Developer setup (App ID with Sign in with Apple capability, Services ID, private key) — done during the enrollment phase.
- **Sign in with Apple on device:** native flow via `expo-apple-authentication` (Apple requires the native button UX, not a web redirect, when running on iOS). Google/GitHub use the standard Convex Auth OAuth redirect flow through `expo-web-browser`.

## Screens

1. **Auth** — login with email + password, **Sign in with Apple** (native button, required placement per Guideline 4.8), and Google/GitHub OAuth buttons. **Amendment (implementation):** password *sign-up* is web-only — the backend's Password provider gates sign-up behind a Cloudflare Turnstile captcha, which has no native iOS equivalent. New accounts on mobile are created via Apple/Google/GitHub (App Store 5.1.1 requires in-app account creation, which OAuth satisfies).
2. **Feed** — reactive `useQuery(api.items.list)`, category tabs with counts, debounced search, pull-to-refresh, per-item status (`pending / processing / done / failed`).
3. **Item cards** — ported category renderers:
   - food → open Google Maps link
   - recipe → copy ingredients to clipboard
   - fitness → save routine to AsyncStorage (replaces `localStorage` key `fileaway-routine`)
   - how-to → full-screen step guide modal
   - video/other → copy summary to clipboard
4. **Save** — URL input on the feed (paste-to-save), mirroring web.
5. **Settings** — sign out, **delete account**, privacy policy link, support link.

## Share-to-Save Flow (v1)

1. User taps Share in TikTok/Instagram/Safari → selects fileaway.
2. App opens via `expo-share-intent` with the shared URL.
3. URL is validated, then saved immediately via `api.items.save`; toast shows "Saved — processing…"; user lands on the feed with the new item at top in `pending` state.
4. If not signed in, the URL is held in memory and saved immediately after login.

Known trade-off: the app opens (~1s) rather than an in-place popup. Accepted for v1.

## Error Handling

- Distinct empty vs. error vs. offline states on every query (Convex client handles reconnection).
- Save failures surface a visible error with retry.
- Share-intent URLs validated before save; invalid input gets a clear message, never a silent drop.

## Testing

- **Unit (Jest, existing `tests/` setup):** URL validation, share-intent parsing, category helpers — the pure logic ported or added for mobile.
- **Manual (Simulator):** screen flows, share-from-Safari, auth persistence across relaunch.
- **Device (optional, free):** sideload with a free Apple ID (7-day provisioning) for real TikTok/IG share testing. Sign in with Apple is the one flow that can't run on a free team — it's verified immediately after Developer Program enrollment.

## Local Development Workflow

```bash
# terminal 1 — backend (unchanged)
npx convex dev

# terminal 2 — iOS app
cd mobile && npx expo run:ios   # builds dev client, launches Simulator
```

No paid Apple account needed for any of this.

## App Store Submission Checklist

Path to store: enroll in Apple Developer Program ($99/yr, can take days — start early) → TestFlight build (EAS Build or Xcode Archive) → App Store submission.

Requirements handled by design:

- [ ] **Sign in with Apple** (4.8) — required because the app offers Google/GitHub login. Native button via `expo-apple-authentication`, Apple provider in `convex/auth.ts`, capability enabled on the App ID. Note: the Sign in with Apple entitlement needs a **paid** developer team — email/password and Google/GitHub are fully testable in the Simulator before enrollment; the Apple flow is verified right after enrollment, before TestFlight.
- [ ] **In-app account deletion** (5.1.1(v)) — `deleteAccount` mutation + Settings UI. Most common hard-rejection miss. Must also revoke Sign in with Apple tokens on deletion (Apple checks this).
- [ ] **Privacy policy URL** + **support URL** — simple pages on the existing web app.
- [ ] **App Privacy labels** — declare: email (account), user content (saved links). No analytics/tracking in v1 → no ATT prompt needed.
- [ ] **Encryption export compliance** — `ITSAppUsesNonExemptEncryption = NO` (HTTPS only).
- [ ] **Guideline 4.2 minimum functionality** — native UI + share intent; not a webview wrapper.
- [ ] **UGC rules (1.2)** — content is private per-user, never shared between users; state this in Review Notes.
- [ ] **Third-party content (5.2.3)** — app saves user-chosen links and displays AI-extracted text/metadata; it never downloads, rehosts, or plays platform videos. State in Review Notes.
- [ ] **Assets** — 1024px app icon (no alpha), screenshots for 6.9" and 6.5" devices, name/subtitle/description/keywords.
- [ ] **Reviewer demo account** — pre-seeded account with several processed items so review sees real functionality.

## Out of Scope (v1)

- True in-place share extension popup (`expo-share-extension` + App Groups) — v2.
- PostHog/analytics on mobile.
- Push notifications ("your item finished processing") — natural v2 feature.
- Android.
- Offline caching beyond what the Convex client provides.
