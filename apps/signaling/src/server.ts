import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { env } from './env.js';
import { logger } from './logger.js';
import { Hub } from './hub.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Boots the signaling HTTP+WebSocket server. The HTTP layer answers a bare
 * `/healthz` for load-balancer probes; everything else is upgraded to a socket.
 */
export function createSignalingServer(): { start: () => void; stop: () => Promise<void> } {
  const hub = new Hub();

  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', connections: hub.connectionCount }));
      return;
    }
    res.writeHead(426).end('Upgrade Required');
  });

  const wss = new WebSocketServer({ server: httpServer, verifyClient: verifyOrigin });

  // Track liveness per connection so a stalled socket can be reaped.
  const alive = new WeakSet<WebSocket>();

  wss.on('connection', (socket: WebSocket) => {
    const connection = hub.register(socket);
    alive.add(socket);

    socket.on('message', (data) => hub.handleRaw(connection, data.toString()));
    socket.on('pong', () => alive.add(socket));
    socket.on('close', () => hub.handleClose(connection));
    socket.on('error', (err) => logger.warn({ err, id: connection.id }, 'socket error'));
  });

  // Terminate sockets that stopped answering pings (dead connections leak rooms).
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  return {
    start() {
      httpServer.listen(env.SIGNALING_PORT, env.SIGNALING_HOST, () => {
        logger.info(
          { host: env.SIGNALING_HOST, port: env.SIGNALING_PORT },
          'signaling server listening',
        );
      });
    },
    stop() {
      clearInterval(heartbeat);
      return new Promise<void>((resolve) => {
        wss.close(() => httpServer.close(() => resolve()));
      });
    },
  };
}

/** Reject cross-origin socket attempts from origins not on the allowlist. */
function verifyOrigin(info: { origin: string; req: IncomingMessage }): boolean {
  const { origin } = info;
  // Native/non-browser clients send no Origin header; allow them (no CSRF risk).
  if (!origin) return true;
  const allowed = env.allowedOrigins.includes(origin);
  if (!allowed) logger.warn({ origin }, 'rejected socket from disallowed origin');
  return allowed;
}
