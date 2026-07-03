import type { MatchPreferences } from '@cougny/protocol';

export interface WaitingPeer {
  id: string;
  /** Session behind the connection — used to avoid pairing someone with themselves. */
  sessionId: string;
  preferences: MatchPreferences;
  enqueuedAt: number;
}

export interface Match {
  a: string;
  b: string;
}

/**
 * FIFO matchmaker for 1:1 random pairing.
 *
 * The interface (enqueue → optional Match, remove, size) is deliberately narrow
 * and free of any transport concern, so it is trivially unit-testable and can be
 * swapped for a Redis/ZSET-backed implementation when scaling to multiple
 * signaling instances — the hub does not need to change.
 */
export class Matchmaker {
  private readonly waiting: WaitingPeer[] = [];

  /**
   * Add a peer to the pool. If a compatible partner is already waiting, returns
   * the pair immediately (and neither remains queued); otherwise returns null.
   */
  enqueue(id: string, sessionId: string, preferences: MatchPreferences = {}): Match | null {
    if (this.waiting.some((p) => p.id === id)) return null;

    const partnerIndex = this.findPartnerIndex(sessionId, preferences);
    if (partnerIndex !== -1) {
      const [partner] = this.waiting.splice(partnerIndex, 1);
      return { a: partner!.id, b: id };
    }

    this.waiting.push({ id, sessionId, preferences, enqueuedAt: Date.now() });
    return null;
  }

  /** Remove a peer from the waiting pool (on leave/disconnect). */
  remove(id: string): void {
    const index = this.waiting.findIndex((p) => p.id === id);
    if (index !== -1) this.waiting.splice(index, 1);
  }

  /** Zero-based position in the queue, or -1 if not waiting. */
  positionOf(id: string): number {
    return this.waiting.findIndex((p) => p.id === id);
  }

  get size(): number {
    return this.waiting.length;
  }

  /**
   * Pick the longest-waiting compatible peer. Compatibility today is: not the
   * same session (two tabs of one browser must never match each other), and —
   * if both sides declared interests — at least one shared interest.
   * Locale/interest weighting can grow here without touching callers.
   */
  private findPartnerIndex(sessionId: string, preferences: MatchPreferences): number {
    for (let i = 0; i < this.waiting.length; i += 1) {
      const candidate = this.waiting[i]!;
      if (candidate.sessionId === sessionId) continue;
      if (this.isCompatible(preferences, candidate.preferences)) return i;
    }
    return -1;
  }

  private isCompatible(a: MatchPreferences, b: MatchPreferences): boolean {
    const aInterests = a.interests ?? [];
    const bInterests = b.interests ?? [];
    if (aInterests.length === 0 || bInterests.length === 0) return true;
    return aInterests.some((interest) => bInterests.includes(interest));
  }
}
