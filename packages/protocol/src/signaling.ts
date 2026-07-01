import { z } from 'zod';

/**
 * Wire protocol for the signaling WebSocket, shared by the web client and the
 * signaling server. Every message is a discriminated union keyed on `t`, so
 * both ends parse and narrow with the same Zod schemas — there is a single
 * source of truth for the contract.
 */

/** SDP offer/answer exchanged during WebRTC negotiation. */
export const SdpSignalSchema = z.object({
  kind: z.literal('sdp'),
  description: z.object({
    type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
    sdp: z.string(),
  }),
});

/** A single ICE candidate (or `null` end-of-candidates marker). */
export const IceSignalSchema = z.object({
  kind: z.literal('ice'),
  candidate: z
    .object({
      candidate: z.string(),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().int().nullable().optional(),
      usernameFragment: z.string().nullable().optional(),
    })
    .nullable(),
});

export const SignalPayloadSchema = z.discriminatedUnion('kind', [SdpSignalSchema, IceSignalSchema]);
export type SignalPayload = z.infer<typeof SignalPayloadSchema>;

/** Optional matchmaking preferences supplied by the client. */
export const MatchPreferencesSchema = z.object({
  locale: z.string().min(2).max(10).optional(),
  interests: z.array(z.string().min(1).max(32)).max(10).optional(),
});
export type MatchPreferences = z.infer<typeof MatchPreferencesSchema>;

// --- Client -> Server ---------------------------------------------------------

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('queue.join'), payload: MatchPreferencesSchema.default({}) }),
  z.object({ t: z.literal('queue.leave') }),
  z.object({ t: z.literal('signal'), payload: SignalPayloadSchema }),
  z.object({ t: z.literal('peer.leave') }),
  z.object({ t: z.literal('heartbeat') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// --- Server -> Client ---------------------------------------------------------

export const PeerLeftReasonSchema = z.enum(['skipped', 'disconnected', 'reported']);
export type PeerLeftReason = z.infer<typeof PeerLeftReasonSchema>;

export const SignalErrorCodeSchema = z.enum([
  'bad_message',
  'not_in_room',
  'rate_limited',
  'unauthorized',
  'server_error',
]);
export type SignalErrorCode = z.infer<typeof SignalErrorCodeSchema>;

export const ServerMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('queued'),
    payload: z.object({ position: z.number().int().optional() }),
  }),
  z.object({
    t: z.literal('matched'),
    payload: z.object({
      roomId: z.string(),
      peerId: z.string(),
      /** Perfect-negotiation role: the polite peer yields on offer collisions. */
      polite: z.boolean(),
    }),
  }),
  z.object({ t: z.literal('signal'), payload: SignalPayloadSchema }),
  z.object({ t: z.literal('peer.left'), payload: z.object({ reason: PeerLeftReasonSchema }) }),
  z.object({
    t: z.literal('error'),
    payload: z.object({ code: SignalErrorCodeSchema, message: z.string() }),
  }),
  z.object({ t: z.literal('pong') }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Parse an untrusted inbound client frame. Returns a typed result. */
export function parseClientMessage(
  raw: unknown,
): { ok: true; message: ClientMessage } | { ok: false; error: z.ZodError } {
  const result = ClientMessageSchema.safeParse(raw);
  return result.success ? { ok: true, message: result.data } : { ok: false, error: result.error };
}

/** Parse an untrusted inbound server frame (client-side use). */
export function parseServerMessage(
  raw: unknown,
): { ok: true; message: ServerMessage } | { ok: false; error: z.ZodError } {
  const result = ServerMessageSchema.safeParse(raw);
  return result.success ? { ok: true, message: result.data } : { ok: false, error: result.error };
}
