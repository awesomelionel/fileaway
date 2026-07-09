# App Store submission runbook

Status: **draft / not yet submitted**. Everything below assumes an enrolled Apple Developer
Program membership and an EAS/Expo account with build credentials. Nothing here has been
executed against App Store Connect — this is the checklist to work through once enrollment
completes.

Bundle identifier: `com.fileaway.app` (set in `mobile/app.json` → `expo.ios.bundleIdentifier`).

---

## 1. Apple Developer Program enrollment

1. Enroll at https://developer.apple.com/programs/enroll/ as an organization or individual
   account (whichever entity owns the `com.fileaway.app` trademark/support surfaces).
2. Wait for approval (can take 24–48h, longer if the org enrollment needs a D-U-N-S lookup).
3. Once active, sign in to https://developer.apple.com/account and confirm the team has an
   active "Apple Developer Program" membership (not just a free personal-team account) —
   Sign in with Apple and TestFlight both require the paid tier.

## 2. App ID configuration

1. Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
2. Bundle ID: **Explicit** → `com.fileaway.app` (must match `mobile/app.json` exactly).
3. Capabilities: enable **Sign in with Apple**. This is required because
   `mobile/app.json` already sets `expo.ios.usesAppleSignIn: true` and the app ships a native
   Apple button (`convex/appleNative.ts`, `mobile/src/screens/SignInScreen.tsx`) — the build
   will be rejected at review if the App ID capability isn't turned on first.
4. Save. No other capabilities are needed for this app (no push, no associated domains beyond
   what `expo-share-intent`/universal links already require, no HealthKit, etc.).

## 3. App Store Connect app record

1. https://appstoreconnect.apple.com → Apps → **+** → New App.
2. Platform: iOS. Name: `fileaway` (or a distinguishable variant if the exact name is taken —
   check availability before enrollment finishes, names are first-come).
3. Primary language, bundle ID `com.fileaway.app` (select the App ID created above), SKU: any
   unique string (e.g. `fileaway-ios-001`).
4. Fill in the app record's own metadata separately from this doc: subtitle, description,
   keywords, category (Productivity or Lifestyle), age rating questionnaire, pricing (free).

## 4. App Privacy (App Store Connect → App Privacy)

The iOS app collects exactly two categories of data, both **linked to the user**, **none used
for tracking**, and there is **no analytics or advertising SDK in the iOS app**:

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| **Email address** (Contact Info → Email Address) | Yes | Yes | No | Account creation / sign-in (`authAccounts`/`users` in Convex) |
| **Other User Content** (User Content → Other User Content) | Yes | Yes | No | The links/URLs the user saves and the AI-extracted data derived from them (`savedItems` table) |

Do not check any of: Usage Data, Diagnostics, Identifiers, Location, Contacts, Browsing
History, Search History, Purchases, Financial Info, Health & Fitness. The app makes no
third-party analytics calls from the mobile client — Convex client + Apify/Gemini calls happen
server-side and are not "collected from the device" in Apple's sense.

Data collection practices to declare:
- Data **is** used to provide app functionality.
- Data **is not** used for third-party advertising, app functionality across other companies'
  apps, or "tracking" as Apple defines it (no IDFA, no cross-app/cross-site tracking).

## 5. Encryption compliance

`mobile/app.json` already sets `expo.ios.config.usesNonExemptEncryption: false`. This maps to
`ITSAppUsesNonExemptEncryption = false` in the generated `Info.plist`, which answers "No" to
the App Store Connect export-compliance question automatically and skips the annual
self-classification report. The app only uses standard HTTPS/TLS (Convex, Apify, Gemini,
Apple/Google/GitHub OAuth) — no custom or proprietary cryptography — so this is correct as-is
and should not be changed.

## 6. Review Notes (App Store Connect → Version → App Review Information → Notes)

Paste substantially this text:

> fileaway is a private, per-account tool for saving links from social media (currently
> TikTok and Instagram) and getting AI-extracted, actionable data back — e.g. a recipe's
> ingredient list, a restaurant's address, a workout routine. Each user only ever sees their
> own saved items; there is no public feed or sharing surface.
>
> Flow to test: sign in (see demo account below) → open the Share Sheet from Safari/TikTok/
> Instagram on a saved post's URL → choose "fileaway" → the item appears in the app as
> "pending" → within a few seconds it becomes "done" with an AI-generated summary card →
> tapping the card's action button performs the category-specific action (open in Maps, copy
> ingredients to clipboard, save to a local routine list, or open a step-by-step guide).
>
> Important: fileaway never downloads, re-hosts, or plays back the original platform's video
> or image content. It only stores the URL the user chose to save and the text Google Gemini
> extracts from a one-time scrape of that URL. No TikTok/Instagram media is displayed,
> proxied, or redistributed inside the app.
>
> Demo account: `<TO FILL AT SUBMISSION TIME — see "Demo account" section below>`.
> Sign-in screen: use the password field (mobile sign-up is OAuth-only; the demo account
> itself is pre-created, not created by the reviewer).

## 7. Demo account

Mobile sign-up only supports Google/GitHub/Apple OAuth (no password sign-up — Cloudflare
Turnstile, used to gate password sign-up on the web, cannot run inside a native WebView, so
the mobile app deliberately only offers **sign-in**, not sign-up, for the password provider).
That means:

1. Before submitting, create a dedicated demo/reviewer account using the **web** sign-up flow
   at `https://fileaway.app/signup` (password provider — Turnstile works fine in a real
   browser), or via a one-off internal Convex mutation run against production.
2. Seed it with 2–3 already-`done` saved items across different categories (food, recipe,
   fitness) so the reviewer sees populated cards immediately rather than an empty state.
3. Enter those exact credentials in App Store Connect's **App Review Information → Sign-In
   Required → Username/Password** fields.
4. **Do not commit real demo credentials to this repo or any doc.** The placeholder above
   (`<TO FILL AT SUBMISSION TIME>`) must be replaced only inside App Store Connect at
   submission time, never in source control.

## 8. Screenshots

Apple requires screenshots for at least one 6.9" (iPhone 16 Pro Max / current largest) and one
6.5" (iPhone 11 Pro Max / 8 Plus-class, still required by some older size buckets) display
size, 3–10 images each, matching the device's exact pixel dimensions (no manual resizing —
capture at native resolution in Simulator or on device).

Recommended shot list (same sequence for both sizes):
1. Feed/dashboard with populated category tabs and counts.
2. A "food" category card with the Google Maps action visible.
3. A "recipe" category card mid-copy-to-clipboard action.
4. The full-screen step guide modal for a "how-to" item.
5. The share-sheet moment (device screenshot showing the OS share sheet with "fileaway" as a
   target) — strongest App Store marketing shot, shows the core value prop in one frame.
6. Settings screen (sign-out / delete-account entry point) — optional, lower priority.

Capture via Simulator: `xcrun simctl io booted screenshot <path>.png` on an iPhone 16 Pro Max
simulator (6.9") and an iPhone 11 Pro Max or 8 Plus simulator (6.5") if still installed;
otherwise generate 6.5" shots by cropping/relayout per Apple's published pixel dimensions.

## 9. Post-enrollment verification checklist

Work through this **in order** once the paid Apple Developer account and App ID (with Sign in
with Apple enabled) exist:

- [ ] Build a development or ad-hoc build via EAS (`eas build --profile development` or
      `--profile preview`) and install it on a physical device.
- [ ] Verify native "Sign in with Apple" end-to-end on-device: tap the Apple button on
      `SignInScreen`, complete the system sheet, confirm the app lands signed-in and a
      corresponding `authAccounts` row with `provider: "apple-native"` exists in the Convex
      dashboard.
- [ ] Verify Google and GitHub OAuth sign-in still work on-device (they open a system browser
      tab via `useOAuthSignIn`).
- [ ] Verify password sign-in works on-device for an account created via the web.
- [ ] Verify Settings → Sign Out and Settings → Delete Account both work on-device.
- [ ] **Deferred until the above pass**: implement Apple refresh-token revocation on account
      deletion (see next section) — this cannot be verified until real Sign in with Apple
      credentials exist, so it is intentionally sequenced after the manual device checks above.

## 10. Apple token revocation on account deletion (deferred, needs Services key)

Today, `convex/users.ts#deleteAccount` deletes the user's Convex rows (sessions, refresh
tokens, `authAccounts`, `savedItems`, the user record) but does **not** call Apple to revoke
the underlying Apple-issued token. For users who signed in via `apple-native`
(`convex/appleNative.ts`), Apple's own account-deletion guidelines (and the App Review
"Sign in with Apple" checklist) expect the relying party to revoke the token server-side too,
not just delete local state.

This requires a **Sign in with Apple REST API Services key** (`.p8`), which can only be
generated after the paid Developer Program account and App ID exist:

1. Certificates, Identifiers & Profiles → Keys → **+** → enable "Sign in with Apple", generate
   and download the `.p8` key (Apple only lets you download it once).
2. Note the **Key ID** and the **Team ID** (top-right of the developer portal).
3. Store as Convex/EAS secrets (never in source):
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY` (the `.p8` contents, PEM string)

Implementation approach (not yet built):

1. **At sign-in time**, `convex/appleNative.ts` currently only verifies the `identityToken`
   JWT. It needs to also accept the `authorizationCode` the client already receives from
   `AppleAuthentication.signInAsync()` (`mobile/src/screens/SignInScreen.tsx`'s `cred` object
   has it) and exchange it at `POST https://appleid.apple.com/auth/token` (grant_type
   `authorization_code`) using a client secret JWT signed with `APPLE_PRIVATE_KEY`
   (`kid: APPLE_KEY_ID`, `iss: APPLE_TEAM_ID`, `aud: https://appleid.apple.com`,
   `sub: com.fileaway.app`). That exchange returns a `refresh_token` — store it on the
   corresponding `authAccounts` row (new field, e.g. `appleRefreshToken`) so it's available
   later at deletion time.
2. **At deletion time**, in `convex/users.ts#deleteAccount`, before deleting each `authAccounts`
   row: if `account.provider === "apple-native"` and an `appleRefreshToken` is stored, call
   `POST https://appleid.apple.com/auth/revoke` (grant_type `refresh_token`, `token` = the
   stored refresh token, plus the same signed client secret) as an **internal action** (the
   revoke call is an external HTTP request, so it needs `"use node"` / an `internalAction`,
   invoked from the `deleteAccount` mutation via `ctx.scheduler.runAfter` or restructured so
   the mutation calls an action that does both the Convex deletes and the Apple call).
3. Treat revoke failures as non-fatal to account deletion (log and continue) — Apple's own
   guidance is that the user's data should still be deleted locally even if the revoke call
   fails transiently.

Until this lands, mobile users who delete their fileaway account via `apple-native` will have
their Convex data removed but Apple will still consider the token relationship active on its
side. This is acceptable for TestFlight/internal builds but should be fixed before a public
App Store release that markets in-app account deletion as complete, per Guideline 5.1.1(v).

---

## Pre-merge cleanup (do before this branch merges to `main`)

These are house-keeping items unrelated to Apple's process, called out here so they aren't
lost before merge:

1. **Delete `convex/testSeed.ts`.** It is a temporary dev-only helper (`seedTestUser`,
   `setDevPassword`, `markTestUserVerified`) that creates/resets a password account with a
   hardcoded credential (`"ios-test@fileaway.dev"` / `"fileaway-test-1234!"`) for Simulator
   testing during development. It must not ship in the deployed `convex/` functions directory
   — remove the file and its entry will drop out of `convex/_generated/api.d.ts` on the next
   `npx convex dev`/`deploy`.
2. **Replace the placeholder app icon.** This task generated a flat placeholder at
   `mobile/assets/icon.png` (dark background, white "f." wordmark) purely so the app has *a*
   valid, alpha-free 1024×1024 icon to build with. It is not a real brand asset. Before public
   submission, replace `mobile/assets/icon.png` with real brand artwork (and update
   `mobile/app.json`'s `expo.icon` / `expo.ios.icon` if the final asset should use Apple's
   newer layered Icon Composer `.icon` bundle format instead of a flat PNG — see "Icon format
   note" below).
3. **Replace the `hello@fileaway.app` placeholder on `/terms`.** `src/app/terms/page.tsx`
   (section 17, "Contact") currently links `mailto:hello@fileaway.app`, a mailbox that may not
   exist. `src/app/privacy/page.tsx` already uses a real, working address
   (`lionel.ttl+claude2@gmail.com`) in its equivalent "Contact" section — either stand up
   `hello@fileaway.app` as a real forwarding address, or point `/terms` at the same address
   `/privacy` already uses, so the two legal pages don't disagree about how to reach support.

### Icon format note

The Expo template originally pointed `expo.ios.icon` at `./assets/expo.icon` — a directory
using Apple's newer Xcode 26 "Icon Composer" layered-icon bundle format (fill gradient +
image layers + shadow/translucency, for the Liquid Glass rendering style), with a demo Expo
logo as its only layer. That format can't be hand-edited into a real brand icon without the
Icon Composer app, so both `expo.icon` and `expo.ios.icon` in `mobile/app.json` were changed to
point at a plain `./assets/icon.png` instead for this task. This is a valid, simpler, and
still fully supported configuration (a single flat 1024×1024 PNG). No native rebuild
(`expo prebuild`) was run as part of this task — the native `mobile/ios/` project still embeds
the old `expo.icon` bundle in its `Images.xcassets`/`expo.icon` folder. The new `icon.png`
reference in `app.json` will only actually reach the compiled app the next time `expo
prebuild` (or an EAS build, which prebuilds internally) regenerates the native project. If a
real Liquid Glass icon is desired later, design it in Icon Composer and point `ios.icon` back
at a `.icon` bundle instead.
