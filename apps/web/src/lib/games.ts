/**
 * The games catalogue shown on the dashboard.
 *
 * Games are played inside a call, so each entry is a mode the caller picks
 * rather than a separate screen. None are built yet; `available` gates whether
 * a card is a link or a "coming soon" tile, so shipping one is a flag flip plus
 * a route.
 */

export interface GameSummary {
  /** Stable key — also the message key under the `games` namespace. */
  id: string;
  /** Route to launch it, once it exists. */
  href: string;
  available: boolean;
}

export const GAMES: readonly GameSummary[] = [
  { id: 'wouldYouRather', href: '/dashboard/call?game=would-you-rather', available: false },
  { id: 'twoTruths', href: '/dashboard/call?game=two-truths', available: false },
  { id: 'trivia', href: '/dashboard/call?game=trivia', available: false },
  { id: 'drawTogether', href: '/dashboard/call?game=draw-together', available: false },
];
