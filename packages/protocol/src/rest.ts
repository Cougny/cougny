import { z } from 'zod';

/** Shared REST contracts for the HTTP API (apps/api). */

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * A call session: the pseudonymous identity a call runs on, and the token that
 * authorizes the signaling socket and API calls.
 *
 * Minting one requires a signed-in account, so every participant carries an 18+
 * attestation. The session id is all a peer ever learns — the account behind it
 * is never exposed on the wire.
 */
export const CreateSessionResponseSchema = z.object({
  sessionId: z.string(),
  token: z.string(),
  expiresAt: z.number().int(),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

/** Report a peer for moderation. */
export const CreateReportRequestSchema = z.object({
  roomId: z.string().min(1),
  reportedPeerId: z.string().min(1),
  reason: z.enum(['nudity', 'harassment', 'minor', 'spam', 'other']),
  details: z.string().max(1000).optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

export const CreateReportResponseSchema = z.object({
  reportId: z.string(),
});
export type CreateReportResponse = z.infer<typeof CreateReportResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
