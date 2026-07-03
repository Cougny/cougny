import { prisma, CallEndReason } from '@cougny/db';
import type { PeerLeftReason } from '@cougny/protocol';
import { logger } from './logger.js';

const END_REASON_MAP: Record<PeerLeftReason, CallEndReason> = {
  skipped: CallEndReason.SKIPPED,
  disconnected: CallEndReason.DISCONNECTED,
  reported: CallEndReason.REPORTED,
};

/**
 * Persistence for call metadata. Media never touches the server; these rows
 * exist so moderation reports can be validated against who actually shared a
 * room. Writes are fire-and-forget: a database hiccup must never block or
 * fail live signaling.
 */
export function recordCallStart(roomId: string, peerAId: string, peerBId: string): void {
  prisma.call
    .create({ data: { roomId, peerAId, peerBId }, select: { id: true } })
    .catch((err: unknown) => logger.error({ err, roomId }, 'failed to record call start'));
}

export function recordCallEnd(roomId: string, reason: PeerLeftReason): void {
  prisma.call
    .updateMany({
      // Only the first end event wins; a disconnect after a skip is a no-op.
      where: { roomId, endedAt: null },
      data: { endedAt: new Date(), endReason: END_REASON_MAP[reason] },
    })
    .catch((err: unknown) => logger.error({ err, roomId }, 'failed to record call end'));
}
