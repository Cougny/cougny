import type { MatchPreferences } from '@cougny/protocol';

export interface WaitingPeer {
  id: string;
  /** Session behind the connection — used to avoid pairing someone with themselves. */
  sessionId: string;
  preferences: MatchPreferences;
  enqueuedAt: number;
}

/**
 * Outcome of an {@link Matchmaker.enqueue} call:
 * - `matched`  — paired with a waiting peer; neither remains queued. The
 *   partner's session id rides along because the caller's instance may not
 *   own the partner's connection (Redis-shared pool) yet still needs it for
 *   call records and the `matched` payload.
 * - `waiting`  — added to (or already in) the pool, awaiting a partner.
 * - `rejected` — the pool is at capacity; the peer was not queued.
 */
export type EnqueueResult =
  | { status: 'matched'; partner: { id: string; sessionId: string } }
  | { status: 'waiting'; position: number }
  | { status: 'rejected'; reason: 'full' };

/** Default cap on simultaneously-waiting peers; overridable per instance. */
export const DEFAULT_MAX_WAITING = 10_000;

/**
 * Matchmaking pool for 1:1 random pairing.
 *
 * The interface is async and free of any transport concern so implementations
 * can be swapped without the hub changing: {@link InMemoryMatchmaker} for a
 * single instance, {@link RedisMatchmaker} for a pool shared across signaling
 * instances. Both must satisfy `matchmaker-contract.ts`.
 */
export interface Matchmaker {
  /**
   * Add a peer to the pool. If a compatible partner is already waiting,
   * resolves `matched` immediately (and neither remains queued). If the peer
   * is already waiting, or is newly added, resolves `waiting` with its queue
   * position. If no partner is available and the pool is at capacity,
   * resolves `rejected` without queuing the peer.
   */
  enqueue(id: string, sessionId: string, preferences?: MatchPreferences): Promise<EnqueueResult>;
  /** Remove a peer from the waiting pool (on leave/disconnect). */
  remove(id: string): Promise<void>;
  /** Number of peers currently waiting. */
  size(): Promise<number>;
}

/**
 * Compatibility rule shared by both implementations (the Redis Lua script in
 * `redis-matchmaker.ts` mirrors it — keep the two in sync): different
 * sessions (two tabs of one browser must never match each other), and — if
 * both sides declared interests — at least one shared interest.
 */
function isCompatible(a: MatchPreferences, b: MatchPreferences): boolean {
  const aInterests = a.interests ?? [];
  const bInterests = b.interests ?? [];
  if (aInterests.length === 0 || bInterests.length === 0) return true;
  return aInterests.some((interest) => bInterests.includes(interest));
}

/**
 * FIFO matchmaker holding the waiting pool in process memory. Correct and
 * sufficient for a single signaling instance; use {@link RedisMatchmaker}
 * when running more than one.
 *
 * The waiting pool is bounded by `maxWaiting`: once it is full, new peers
 * that cannot be paired immediately are rejected rather than accumulating
 * without limit, so a flood of unmatchable peers cannot exhaust memory.
 */
export class InMemoryMatchmaker implements Matchmaker {
  private readonly waiting: WaitingPeer[] = [];

  constructor(private readonly maxWaiting: number = DEFAULT_MAX_WAITING) {}

  async enqueue(
    id: string,
    sessionId: string,
    preferences: MatchPreferences = {},
  ): Promise<EnqueueResult> {
    // Re-enqueuing an already-waiting peer is idempotent, not a new admission,
    // so it never counts against capacity.
    const existingIndex = this.waiting.findIndex((p) => p.id === id);
    if (existingIndex !== -1) return { status: 'waiting', position: existingIndex };

    const partnerIndex = this.findPartnerIndex(sessionId, preferences);
    if (partnerIndex !== -1) {
      const [partner] = this.waiting.splice(partnerIndex, 1);
      return { status: 'matched', partner: { id: partner!.id, sessionId: partner!.sessionId } };
    }

    if (this.waiting.length >= this.maxWaiting) return { status: 'rejected', reason: 'full' };

    this.waiting.push({ id, sessionId, preferences, enqueuedAt: Date.now() });
    return { status: 'waiting', position: this.waiting.length - 1 };
  }

  async remove(id: string): Promise<void> {
    const index = this.waiting.findIndex((p) => p.id === id);
    if (index !== -1) this.waiting.splice(index, 1);
  }

  async size(): Promise<number> {
    return this.waiting.length;
  }

  /** Pick the longest-waiting compatible peer. */
  private findPartnerIndex(sessionId: string, preferences: MatchPreferences): number {
    for (let i = 0; i < this.waiting.length; i += 1) {
      const candidate = this.waiting[i]!;
      if (candidate.sessionId === sessionId) continue;
      if (isCompatible(preferences, candidate.preferences)) return i;
    }
    return -1;
  }
}
