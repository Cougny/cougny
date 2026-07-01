import { parseServerMessage, type ClientMessage, type ServerMessage } from '@cougny/protocol';
import { clientEnv } from './env';

type MessageHandler = (message: ServerMessage) => void;

/**
 * Thin, typed wrapper around the signaling WebSocket. It knows nothing about
 * WebRTC — it only carries validated protocol frames between the browser and
 * the signaling server.
 */
export class SignalingClient {
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<MessageHandler>();

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${clientEnv.signalingUrl}/?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('Signaling connection failed')), {
        once: true,
      });
      socket.addEventListener('message', (event) => this.onRaw(event.data));
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.handlers.clear();
  }

  private onRaw(data: unknown): void {
    if (typeof data !== 'string') return;
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const parsed = parseServerMessage(json);
    if (!parsed.ok) return;
    for (const handler of this.handlers) handler(parsed.message);
  }
}
