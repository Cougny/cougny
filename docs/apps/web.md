# apps/web — `@cougny/web`

The user-facing client: a Next.js (App Router) app that captures media and drives
the WebRTC peer connection.

## Stack

- **Next.js 15** (App Router, React 19)
- **Tailwind CSS** for styling
- **next-intl** for internationalized copy
- **@cougny/protocol** for typed signaling/REST contracts

## Structure

```
src/
  app/
    layout.tsx        Root layout; wraps app in NextIntlClientProvider
    page.tsx          The call screen (video stage + controls + chat)
    terms/page.tsx    Terms & conditions
    globals.css       Tailwind entry
  components/
    VideoView.tsx     Binds a MediaStream to a <video> element
    MatchControls.tsx Start/skip/stop + gender preference
    ChatPanel.tsx     Data-channel chat with typing indicator
    ReportDialog.tsx  In-call moderation report (reason + details → API)
    icons.tsx         Inline SVG icon set
  hooks/
    useRandomCall.ts  Core: media + signaling + RTCPeerConnection state machine
  lib/
    api.ts            Session bootstrap, ICE fetch, report submission
    signaling.ts      Typed WebSocket client
    env.ts            NEXT_PUBLIC_* config
  i18n/
    request.ts        next-intl request config
messages/
  en.json             All user-facing copy
```

## The core hook: `useRandomCall`

[`useRandomCall.ts`](../../apps/web/src/hooks/useRandomCall.ts) owns the entire
call lifecycle and exposes a small surface to the UI:

```ts
const {
  status, // idle | requesting-media | searching | connecting | connected | reconnecting | peer-left | error
  error, // an i18n key, or null
  localStream,
  remoteStream,
  roomId,
  peerId, // the peer's call-session id (used for reports)
  chatMessages,
  start,
  next,
  stop,
  // … media toggles, chat send/typing, preference updates
} = useRandomCall();
```

Responsibilities:

1. `getUserMedia` for camera/mic (started by an explicit user gesture).
2. Bootstrap a call session with the signed-in account's access token, and
   fetch ICE servers.
3. Open the signaling socket (authenticated with the session token) and join
   the queue with the stored match preferences.
4. On `matched`, create the `RTCPeerConnection` and run **perfect negotiation**
   (see [webrtc.md](../webrtc.md#perfect-negotiation)), plus a negotiated data
   channel for chat.
5. Render `remoteStream`; support **Next** (skip), **Stop**, and mute toggles.
6. Ride out transient ICE drops: a `reconnecting` grace period and one ICE
   restart before declaring `peer-left`.
7. Clean up media/sockets on unmount.

## Accounts

[`AuthProvider`](../../apps/web/src/components/auth/AuthProvider.tsx) wraps the
app and is the only place the account lives. Two rules shape it:

- **The access token is held in React state and nowhere else** — not
  `localStorage`, not a readable cookie. It is short-lived and replaced from the
  httpOnly refresh cookie, so a reload re-authenticates silently while an
  injected script has no durable credential to steal.
- **One refresh on mount decides everything.** A `401` there is simply a
  signed-out visitor. Until it resolves the UI shows nothing account-shaped,
  because flashing "Sign in" at someone already signed in reads as a bug.

Routes: `/login`, `/signup`, `/signup/complete` (what a social provider could
not supply), `/account`, `/forgot-password`, `/reset-password`, `/verify-email`,
and `/auth/callback` (where a social sign-in lands — it trades the refresh
cookie for a token rather than accepting one from the URL, keeping the
credential out of browser history and `Referer`).

The home page is gated: without a complete account it shows
[`SignInGate`](../../apps/web/src/components/auth/SignInGate.tsx) instead of the
call stage. That is presentation only — `POST /v1/sessions` enforces the same
rule server-side.

### Country and date of birth

[`CountrySelect`](../../apps/web/src/components/auth/CountrySelect.tsx) renders
all 195 UN-recognized countries from `UN_COUNTRY_CODES`. It stores **codes
only**: names come from `Intl.DisplayNames` in the active locale and are sorted
with `Intl.Collator`, so the list is translated by the platform rather than by
195 entries per language in a message file.

[`DateOfBirthField`](../../apps/web/src/components/auth/DateOfBirthField.tsx)
sets `max` to the latest date that clears 18, so the browser will not offer a
failing one — a kinder way to state the rule than rejecting a submission. The
enforcement is still the server's.

## <a id="i18n"></a>Internationalization

**No user-facing English is hardcoded.** Every string lives in
[`messages/en.json`](../../apps/web/messages/en.json) and is rendered via
`useTranslations`. Error states are stored as message _keys_ (e.g.
`permissionDenied`) and translated at the edge. Adding a language = adding a
`messages/<locale>.json` and a locale negotiation step in
[`i18n/request.ts`](../../apps/web/src/i18n/request.ts).

## Config

- [`next.config.mjs`](../../apps/web/next.config.mjs) — wraps the config with the
  next-intl plugin and `transpilePackages: ['@cougny/protocol']`.
- [`eslint.config.mjs`](../../apps/web/eslint.config.mjs) — flat ESLint config
  built from `@cougny/config-eslint/next` (shared base + `@next/eslint-plugin-next`
  core-web-vitals + React Hooks rules). Next 16 removed `next lint`, so the app
  runs ESLint directly like every other package.
- Styling is **Tailwind CSS v4** — no JS config file; theme tokens live in
  [`globals.css`](../../apps/web/src/app/globals.css) via `@theme`, and PostCSS
  uses `@tailwindcss/postcss`.

## Scripts

```bash
pnpm --filter @cougny/web dev        # next dev :3000
pnpm --filter @cougny/web build
pnpm --filter @cougny/web typecheck
```
