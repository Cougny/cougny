import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { env } from './env.js';
import { logger } from './logger.js';
import { verifySessionToken } from './auth.js';
import { observeHub, registry, rejectedHandshakesTotal } from './metrics.js';
import { Hub } from './hub.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Boots the signaling HTTP+WebSocket server. The HTTP layer answers `/healthz`
 * for load-balancer probes and `/metrics` for Prometheus scrapes; everything
 * else is upgraded to a socket — but only for allowed origins presenting a
 * valid session token (`?token=`, minted by the API).
 */
export function createSignalingServer(): { start: () => void; stop: () => Promise<void> } {
  const hub = new Hub(env.SIGNALING_MAX_QUEUE);
  observeHub(hub);

  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', connections: hub.connectionCount }));
      return;
    }
    if (req.url === '/metrics') {
      void serveMetrics(res);
      return;
    }
    res.writeHead(426).end('Upgrade Required');
  });

  // Session id per upgrade request, resolved during the handshake so the
  // connection handler never sees an unauthenticated socket.
  const handshakeSessions = new WeakMap<IncomingMessage, string>();

  const wss = new WebSocketServer({
    server: httpServer,
    verifyClient: (info: { origin: string; req: IncomingMessage }) =>
      verifyHandshake(info, handshakeSessions),
  });

  // Track liveness per connection so a stalled socket can be reaped.
  const alive = new WeakSet<WebSocket>();

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    const sessionId = handshakeSessions.get(req);
    if (!sessionId) {
      // Unreachable if verifyClient ran, but never accept an unattributed socket.
      socket.close(4401, 'unauthorized');
      return;
    }

    const connection = hub.register(sessionId, socket);
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

async function serveMetrics(res: ServerResponse): Promise<void> {
  try {
    const body = await registry.metrics();
    res.writeHead(200, { 'content-type': registry.contentType });
    res.end(body);
  } catch (err) {
    logger.error({ err }, 'failed to collect metrics');
    res.writeHead(500).end();
  }
}

/**
 * Handshake gate: the Origin must be allowlisted (browsers enforce nothing on
 * WebSockets, so this is the CSRF line) and the `?token=` must be a session
 * token signed by the API. On success the resolved session id is stashed for
 * the connection handler.
 */
function verifyHandshake(
  info: { origin: string; req: IncomingMessage },
  handshakeSessions: WeakMap<IncomingMessage, string>,
): boolean {
  const { origin, req } = info;

  // Native/non-browser clients send no Origin header; allow them (no CSRF
  // risk) — they still need a valid token below.
  if (origin && !env.allowedOrigins.includes(origin)) {
    rejectedHandshakesTotal.inc({ reason: 'origin' });
    logger.warn({ origin }, 'rejected socket from disallowed origin');
    return false;
  }

  const token = new URL(req.url ?? '/', 'http://placeholder').searchParams.get('token');
  const sessionId = verifySessionToken(token);
  if (!sessionId) {
    rejectedHandshakesTotal.inc({ reason: 'token' });
    logger.warn({ origin }, 'rejected socket with missing or invalid session token');
    return false;
  }

  handshakeSessions.set(req, sessionId);
  return true;
}
