/**
 * Leaderboard data for the dashboard.
 *
 * There is no leaderboard endpoint on the API yet, so `fetchLeaderboard` serves
 * a fixed sample. The shape is the one the real endpoint should return, and the
 * dashboard reads it through this function only — wiring it up later is a
 * change to this file and nothing else.
 */

export type LeaderboardPeriod = 'week' | 'allTime';

export interface LeaderboardEntry {
  /** 1-based position, already ranked by the source. */
  rank: number;
  /** Public handle. Never an email or any other account detail. */
  username: string;
  /** Completed calls in the period. */
  calls: number;
  /** Total time connected, in minutes. */
  minutes: number;
}

/**
 * Stand-in rows, clearly fictional, so the dashboard has something to lay out
 * before the API exists. Replace with a real fetch — do not ship these as if
 * they were live standings.
 */
const PLACEHOLDER: Record<LeaderboardPeriod, readonly LeaderboardEntry[]> = {
  week: [
    { rank: 1, username: 'nova', calls: 184, minutes: 962 },
    { rank: 2, username: 'kaya_r', calls: 171, minutes: 903 },
    { rank: 3, username: 'mirembe', calls: 158, minutes: 874 },
    { rank: 4, username: 'tobi', calls: 142, minutes: 731 },
    { rank: 5, username: 'lune', calls: 137, minutes: 690 },
    { rank: 6, username: 'ari_88', calls: 129, minutes: 645 },
    { rank: 7, username: 'sable', calls: 118, minutes: 612 },
    { rank: 8, username: 'devi', calls: 104, minutes: 559 },
    { rank: 9, username: 'juno', calls: 97, minutes: 511 },
    { rank: 10, username: 'wren', calls: 91, minutes: 486 },
  ],
  allTime: [
    { rank: 1, username: 'mirembe', calls: 4820, minutes: 26140 },
    { rank: 2, username: 'nova', calls: 4517, minutes: 24880 },
    { rank: 3, username: 'sable', calls: 3990, minutes: 21305 },
    { rank: 4, username: 'juno', calls: 3612, minutes: 19470 },
    { rank: 5, username: 'kaya_r', calls: 3288, minutes: 18022 },
    { rank: 6, username: 'lune', calls: 2974, minutes: 16110 },
    { rank: 7, username: 'tobi', calls: 2740, minutes: 15003 },
    { rank: 8, username: 'wren', calls: 2515, minutes: 13744 },
    { rank: 9, username: 'ari_88', calls: 2301, minutes: 12588 },
    { rank: 10, username: 'devi', calls: 2107, minutes: 11430 },
  ],
};

/** Top players for a period. Async now so callers do not change when it goes live. */
export async function fetchLeaderboard(
  period: LeaderboardPeriod,
): Promise<readonly LeaderboardEntry[]> {
  return Promise.resolve(PLACEHOLDER[period]);
}
