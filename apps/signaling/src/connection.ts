import type { WebSocket } from 'ws';
import type { MatchPreferences, ServerMessage } from '@cougny/protocol';
import { TokenBucket } from './rate-limit.js';

export type ConnectionState = 'idle' | 'queued' | 'matched';

// Generous enough for ICE candidate bursts during connection setup, tight
// enough that a client flooding frames gets throttled within seconds.
const MESSAGE_BUCKET_CAPACITY = 100;
const MESSAGE_REFILL_PER_SECOND = 25;

// Skipping is human-paced: allow a burst of quick "next" presses, then hold
// re-queues to one every couple of seconds.
const JOIN_BUCKET_CAPACITY = 10;
const JOIN_REFILL_PER_SECOND = 0.5;

/**
 * Server-side view of one connected client. Wraps the raw socket with
 * identity, lifecycle state, per-connection rate limits, and a typed `send`
 * so the rest of the server never touches the wire format directly.
 */
export class Connection {
  /** Ephemeral id for this socket — unique even across tabs of one session. */
  readonly id: string;
  /** The authenticated anonymous session behind this socket. */
  readonly sessionId: string;
  readonly socket: WebSocket;
  state: ConnectionState = 'idle';
  roomId: string | null = null;
  peerId: string | null = null;
  /** Last preferences supplied on queue.join, reused when requeuing. */
  preferences: MatchPreferences = {};
  /** Liveness flag toggled by the ping/pong heartbeat. */
  isAlive = true;

  readonly messageBucket = new TokenBucket(MESSAGE_BUCKET_CAPACITY, MESSAGE_REFILL_PER_SECOND);
  readonly joinBucket = new TokenBucket(JOIN_BUCKET_CAPACITY, JOIN_REFILL_PER_SECOND);

  constructor(id: string, sessionId: string, socket: WebSocket) {
    this.id = id;
    this.sessionId = sessionId;
    this.socket = socket;
  }

  send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
