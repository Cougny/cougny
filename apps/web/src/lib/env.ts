/**
 * Client-visible configuration. Only `NEXT_PUBLIC_*` vars are exposed to the
 * browser; these are read at build time and inlined by Next.js.
 */
export const clientEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  signalingUrl: process.env.NEXT_PUBLIC_SIGNALING_URL ?? 'ws://localhost:4001',
} as const;
