import { z } from 'zod';
import { PeerLeftReasonSchema, SignalPayloadSchema } from '@cougny/protocol';
import { logger } from './logger.js';
import type { RedisClient } from './redis.js';

/**
 * Events one signaling instance delivers to a peer owned by another instance.
 * Every event carries the `roomId` it belongs to so handlers can drop stale
 * deliveries (the target may have moved on to another room).
 *
 * `matched` carries both halves of the partner's identity: the connection id
 * (used to route subsequent relays back over the bus) and the session id
 * (what clients see, and what moderation reports are validated against).
 */
const PeerEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('matched'),
    roomId: z.string(),
    peerConnectionId: z.string(),
    peerSessionId: z.string(),
    polite: z.boolean(),
  }),
  z.object({ kind: z.literal('signal'), roomId: z.string(), payload: SignalPayloadSchema }),
  z.object({ kind: z.literal('peer.left'), roomId: z.string(), reason: PeerLeftReasonSchema }),
]);
export type PeerEvent = z.infer<typeof PeerEventSchema>;

export type PeerEventHandler = (peerId: string, event: PeerEvent) => void;

/**
 * Cross-instance fan-out for peer-targeted events. Each instance subscribes to
 * one channel per locally connected peer, so events route only to the instance
 * that owns the target. `publish` resolves with the receiver count, which
 * doubles as liveness detection: zero receivers means no instance owns that
 * peer anymore (closed socket or crashed instance) — no registry needed.
 */
export interface PeerBus {
  /** Start receiving events addressed to `peerId`. Idempotent. */
  subscribe(peerId: string): Promise<void>;
  unsubscribe(peerId: string): Promise<void>;
  /** Deliver an event to `peerId`'s owning instance. Resolves with the receiver count. */
  publish(peerId: string, event: PeerEvent): Promise<number>;
  onEvent(handler: PeerEventHandler): void;
}

export class RedisPeerBus implements PeerBus {
  private handler: PeerEventHandler | null = null;
  private readonly subscriptions = new Map<string, Promise<void>>();

  constructor(
    private readonly publisher: RedisClient,
    private readonly subscriber: RedisClient,
    private readonly channelPrefix = 'cougny:signaling:peer',
  ) {}

  subscribe(peerId: string): Promise<void> {
    let pending = this.subscriptions.get(peerId);
    if (!pending) {
      pending = this.subscriber
        .subscribe(this.channelFor(peerId), (message: string) => this.dispatch(peerId, message))
        .catch((err: unknown) => {
          // Drop the cached promise so a later attempt can retry.
          this.subscriptions.delete(peerId);
          throw err;
        });
      this.subscriptions.set(peerId, pending);
    }
    return pending;
  }

  async unsubscribe(peerId: string): Promise<void> {
    if (!this.subscriptions.delete(peerId)) return;
    await this.subscriber.unsubscribe(this.channelFor(peerId));
  }

  publish(peerId: string, event: PeerEvent): Promise<number> {
    return this.publisher.publish(this.channelFor(peerId), JSON.stringify(event));
  }

  onEvent(handler: PeerEventHandler): void {
    this.handler = handler;
  }

  private channelFor(peerId: string): string {
    return `${this.channelPrefix}:${peerId}`;
  }

  private dispatch(peerId: string, message: string): void {
    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      logger.warn({ peerId }, 'dropped non-JSON peer event');
      return;
    }
    const parsed = PeerEventSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ peerId }, 'dropped peer event that failed schema validation');
      return;
    }
    this.handler?.(peerId, parsed.data);
  }
}
