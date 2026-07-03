import { randomUUID } from 'node:crypto';
import {
  parseClientMessage,
  type ClientMessage,
  type MatchPreferences,
  type PeerLeftReason,
  type SignalPayload,
} from '@cougny/protocol';
import { Connection } from './connection.js';
import { Matchmaker, DEFAULT_MAX_WAITING } from './matchmaker.js';
import { recordCallEnd, recordCallStart } from './calls.js';
import { matchesTotal, messagesTotal, queueRejectedTotal, rateLimitedTotal } from './metrics.js';
import { logger } from './logger.js';

/**
 * Central router for all signaling traffic. Owns the set of live connections,
 * the matchmaker, and the active rooms. Media never flows through here — only
 * the SDP/ICE signaling needed for two browsers to establish a P2P connection.
 */
export class Hub {
  private readonly connections = new Map<string, Connection>();
  private readonly matchmaker: Matchmaker;

  constructor(maxQueue: number = DEFAULT_MAX_WAITING) {
    this.matchmaker = new Matchmaker(maxQueue);
  }

  register(sessionId: string, socket: ConstructorParameters<typeof Connection>[2]): Connection {
    const id = randomUUID();
    const connection = new Connection(id, sessionId, socket);
    this.connections.set(id, connection);
    logger.debug({ id, sessionId, total: this.connections.size }, 'connection registered');
    return connection;
  }

  handleRaw(connection: Connection, data: string): void {
    if (!connection.messageBucket.tryConsume()) {
      rateLimitedTotal.inc();
      connection.send({
        t: 'error',
        payload: { code: 'rate_limited', message: 'Too many messages; slow down.' },
      });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      connection.send({ t: 'error', payload: { code: 'bad_message', message: 'Malformed JSON.' } });
      return;
    }

    const parsed = parseClientMessage(json);
    if (!parsed.ok) {
      connection.send({
        t: 'error',
        payload: { code: 'bad_message', message: 'Message failed schema validation.' },
      });
      return;
    }

    messagesTotal.inc({ type: parsed.message.t });
    this.dispatch(connection, parsed.message);
  }

  private dispatch(connection: Connection, message: ClientMessage): void {
    switch (message.t) {
      case 'queue.join':
        this.onQueueJoin(connection, message.payload);
        break;
      case 'queue.leave':
        this.onQueueLeave(connection);
        break;
      case 'signal':
        this.onSignal(connection, message.payload);
        break;
      case 'peer.leave':
        this.onPeerLeave(connection);
        break;
      case 'heartbeat':
        connection.send({ t: 'pong' });
        break;
    }
  }

  private onQueueJoin(connection: Connection, preferences: MatchPreferences): void {
    if (!connection.joinBucket.tryConsume()) {
      rateLimitedTotal.inc();
      connection.send({
        t: 'error',
        payload: { code: 'rate_limited', message: 'Rejoining too quickly; slow down.' },
      });
      return;
    }

    connection.preferences = preferences;
    this.enqueue(connection);
  }

  /** Queue a connection with its stored preferences, pairing immediately if possible. */
  private enqueue(connection: Connection): void {
    if (connection.state === 'matched') this.leaveRoom(connection, 'skipped');
    connection.state = 'queued';

    const result = this.matchmaker.enqueue(
      connection.id,
      connection.sessionId,
      connection.preferences,
    );

    if (result.status === 'rejected') {
      // Pool is at capacity; shed load rather than growing memory unbounded.
      queueRejectedTotal.inc();
      connection.state = 'idle';
      connection.send({
        t: 'error',
        payload: { code: 'queue_full', message: 'queue_full' },
      });
      return;
    }

    if (result.status === 'waiting') {
      connection.send({
        t: 'queued',
        payload: { position: this.matchmaker.positionOf(connection.id) },
      });
      return;
    }

    const a = this.connections.get(result.match.a);
    const b = this.connections.get(result.match.b);
    if (!a || !b) {
      // A peer vanished between enqueue and pairing; requeue the survivor with
      // the preferences it originally asked for.
      const survivor = a ?? b;
      if (survivor) this.enqueue(survivor);
      return;
    }

    this.pair(a, b);
  }

  private pair(a: Connection, b: Connection): void {
    const roomId = randomUUID();
    for (const conn of [a, b]) {
      conn.state = 'matched';
      conn.roomId = roomId;
    }
    a.peerId = b.id;
    b.peerId = a.id;

    // The room is persisted so moderation reports can later be validated
    // against who actually shared it.
    recordCallStart(roomId, a.sessionId, b.sessionId);
    matchesTotal.inc();

    // Peers learn each other's anonymous session id (needed to file a report)
    // and their perfect-negotiation role: exactly one peer is "polite".
    a.send({ t: 'matched', payload: { roomId, peerId: b.sessionId, polite: true } });
    b.send({ t: 'matched', payload: { roomId, peerId: a.sessionId, polite: false } });
    logger.debug({ roomId, a: a.id, b: b.id }, 'peers matched');
  }

  private onSignal(connection: Connection, payload: SignalPayload): void {
    const peer = this.peerOf(connection);
    if (!peer) {
      connection.send({ t: 'error', payload: { code: 'not_in_room', message: 'No active peer.' } });
      return;
    }
    peer.send({ t: 'signal', payload });
  }

  private onQueueLeave(connection: Connection): void {
    this.matchmaker.remove(connection.id);
    if (connection.state === 'queued') connection.state = 'idle';
  }

  private onPeerLeave(connection: Connection): void {
    this.leaveRoom(connection, 'skipped');
  }

  handleClose(connection: Connection): void {
    this.matchmaker.remove(connection.id);
    this.leaveRoom(connection, 'disconnected');
    this.connections.delete(connection.id);
    logger.debug({ id: connection.id, total: this.connections.size }, 'connection closed');
  }

  /** Tear down the caller's room and notify the peer, if any. */
  private leaveRoom(connection: Connection, reason: PeerLeftReason): void {
    if (connection.roomId) recordCallEnd(connection.roomId, reason);

    const peer = this.peerOf(connection);
    if (peer) {
      peer.send({ t: 'peer.left', payload: { reason } });
      peer.state = 'idle';
      peer.roomId = null;
      peer.peerId = null;
    }
    connection.roomId = null;
    connection.peerId = null;
    if (connection.state === 'matched') connection.state = 'idle';
  }

  private peerOf(connection: Connection): Connection | null {
    if (!connection.peerId) return null;
    const peer = this.connections.get(connection.peerId);
    return peer && peer.roomId === connection.roomId ? peer : null;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  get queueSize(): number {
    return this.matchmaker.size;
  }
}
