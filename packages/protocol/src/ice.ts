import { z } from 'zod';

/**
 * ICE server configuration handed to the browser's RTCPeerConnection.
 * TURN entries carry short-lived credentials minted by the API from coturn's
 * shared secret — the raw secret never leaves the server.
 */
export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof IceServerSchema>;

export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema),
  /** Unix seconds after which the TURN credentials expire and must be refetched. */
  expiresAt: z.number().int(),
});
export type IceServersResponse = z.infer<typeof IceServersResponseSchema>;
