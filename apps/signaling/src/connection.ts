import type { WebSocket } from 'ws';
import type { ServerMessage } from '@cougny/protocol';

export type ConnectionState = 'idle' | 'queued' | 'matched';

/**
 * Server-side view of one connected client. Wraps the raw socket with identity,
 * lifecycle state, and a typed `send` so the rest of the server never touches
 * the wire format directly.
 */
export class Connection {
  readonly id: string;
  readonly socket: WebSocket;
  state: ConnectionState = 'idle';
  roomId: string | null = null;
  peerId: string | null = null;
  /** Liveness flag toggled by the ping/pong heartbeat. */
  isAlive = true;

  constructor(id: string, socket: WebSocket) {
    this.id = id;
    this.socket = socket;
  }

  send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
