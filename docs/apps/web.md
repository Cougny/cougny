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
    page.tsx          Landing page ("Start a call")
    call/page.tsx     The call screen (stage + PiP self-view + controls)
    globals.css       Tailwind entry
  components/
    VideoView.tsx     Binds a MediaStream to a <video> element
  hooks/
    useRandomCall.ts  Core: media + signaling + RTCPeerConnection state machine
  lib/
    api.ts            Session bootstrap + ICE fetch (with localStorage cache)
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
  status, // idle | requesting-media | searching | connecting | connected | peer-left | error
  error, // an i18n key, or null
  localStream,
  remoteStream,
  cameraEnabled,
  micEnabled,
  start,
  next,
  stop,
  toggleCamera,
  toggleMic,
} = useRandomCall();
```

Responsibilities:

1. `getUserMedia` for camera/mic (started by an explicit user gesture).
2. Bootstrap an anonymous session and fetch ICE servers.
3. Open the signaling socket and join the queue.
4. On `matched`, create the `RTCPeerConnection` and run **perfect negotiation**
   (see [webrtc.md](../webrtc.md#perfect-negotiation)).
5. Render `remoteStream`; support **Next** (skip), **Stop**, and mute toggles.
6. Clean up media/sockets on unmount.

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
