import { randomUUID } from 'node:crypto';
import {
  parseClientMessage,
  type ClientMessage,
  type MatchPreferences,
  type PeerLeftReason,
  type SignalPayload,
} from '@cougny/protocol';
import { Connection } from './connection.js';
import type { Matchmaker } from './matchmaker.js';
import type { PeerBus, PeerEvent } from './peer-bus.js';
import { recordCallEnd, recordCallStart } from './calls.js';
import { matchesTotal, messagesTotal, queueRejectedTotal, rateLimitedTotal } from './metrics.js';
import { logger } from './logger.js';

export interface HubOptions {
  matchmaker: Matchmaker;
  /** Cross-instance fan-out; omit for single-instance (in-process) deployments. */
  bus?: PeerBus | null;
}

/**
 * Central router for all signaling traffic. Owns the set of live connections
 * and the active rooms; the matchmaking pool lives behind the injected
 * `Matchmaker` (in-process or Redis-shared). Media never flows through here —
 * only the SDP/ICE signaling needed for two browsers to establish a P2P
 * connection.
 *
 * When a `PeerBus` is present the pool may pair a local peer with one owned
 * by another instance: the `matched` handoff and all subsequent relays for
 * that room travel over the bus. A publish that reaches zero receivers means
 * the remote peer is gone (closed socket or its instance died), and the hub
 * recovers by requeueing or tearing down the room.
 */
export class Hub {
  private readonly connections = new Map<string, Connection>();
  private readonly matchmaker: Matchmaker;
  private readonly bus: PeerBus | null;
  /**
   * Per-connection promise chains. Handlers await matchmaker/bus calls, so
   * without this a peer's own messages (and bus events aimed at it) could
   * interleave mid-handler; chaining keeps each peer's state transitions
   * strictly ordered.
   */
  private readonly mailboxes = new WeakMap<Connection, Promise<void>>();

  constructor(options: HubOptions) {
    this.matchmaker = options.matchmaker;
    this.bus = options.bus ?? null;
    this.bus?.onEvent((peerId, event) => this.onBusEvent(peerId, event));
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
    this.enqueueTask(connection, () => this.dispatch(connection, parsed.message));
  }

  handleClose(connection: Connection): void {
    this.enqueueTask(connection, async () => {
      await this.matchmaker.remove(connection.id);
      await this.leaveRoom(connection, 'disconnected');
      await this.bus?.unsubscribe(connection.id);
      this.connections.delete(connection.id);
      logger.debug({ id: connection.id, total: this.connections.size }, 'connection closed');
    });
  }

  private enqueueTask(connection: Connection, task: () => Promise<void>): void {
    const previous = this.mailboxes.get(connection) ?? Promise.resolve();
    const next = previous.then(task).catch((err: unknown) => {
      logger.error({ err, id: connection.id }, 'signaling task failed');
      connection.send({
        t: 'error',
        payload: { code: 'server_error', message: 'Internal signaling error.' },
      });
    });
    this.mailboxes.set(connection, next);
  }

  private async dispatch(connection: Connection, message: ClientMessage): Promise<void> {
    switch (message.t) {
      case 'queue.join':
        await this.onQueueJoin(connection, message.payload);
        break;
      case 'queue.leave':
        await this.onQueueLeave(connection);
        break;
      case 'signal':
        await this.onSignal(connection, message.payload);
        break;
      case 'peer.leave':
        await this.leaveRoom(connection, 'skipped');
        break;
      case 'heartbeat':
        connection.send({ t: 'pong' });
        break;
    }
  }

  private async onQueueJoin(connection: Connection, preferences: MatchPreferences): Promise<void> {
    if (!connection.joinBucket.tryConsume()) {
      rateLimitedTotal.inc();
      connection.send({
        t: 'error',
        payload: { code: 'rate_limited', message: 'Rejoining too quickly; slow down.' },
      });
      return;
    }

    connection.preferences = preferences;
    await this.enqueue(connection);
  }

  /** Queue a connection with its stored preferences, pairing immediately if possible. */
  private async enqueue(connection: Connection): Promise<void> {
    if (connection.state === 'matched') await this.leaveRoom(connection, 'skipped');
    connection.state = 'queued';

    // Become reachable by other instances before entering the shared pool.
    await this.bus?.subscribe(connection.id);

    const result = await this.matchmaker.enqueue(
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
      connection.send({ t: 'queued', payload: { position: result.position } });
      return;
    }

    const partner = this.connections.get(result.partner.id);
    if (partner) {
      if (partner.state !== 'queued') {
        // The partner bailed between enqueue and pairing; requeue the joiner.
        await this.enqueue(connection);
        return;
      }
      this.pair(partner, connection);
      return;
    }

    await this.pairRemote(connection, result.partner);
  }

  /** Create a room for two locally connected peers. */
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

  /**
   * Create a room with a partner owned by another instance (claimed from the
   * shared pool). Zero receivers on the `matched` publish means the partner's
   * entry outlived its socket — its instance crashed or the socket closed —
   * so the joiner goes back into the pool.
   */
  private async pairRemote(
    connection: Connection,
    partner: { id: string; sessionId: string },
  ): Promise<void> {
    if (!this.bus) {
      // No bus, and the partner is not a local connection: its entry is stale
      // (in-process pools only contain local peers). Requeue the joiner.
      await this.enqueue(connection);
      return;
    }

    const roomId = randomUUID();
    const received = await this.bus.publish(partner.id, {
      kind: 'matched',
      roomId,
      peerConnectionId: connection.id,
      peerSessionId: connection.sessionId,
      polite: true,
    });
    if (received === 0) {
      await this.enqueue(connection);
      return;
    }

    connection.state = 'matched';
    connection.roomId = roomId;
    connection.peerId = partner.id;

    // The claiming instance records the call — exactly once per match.
    recordCallStart(roomId, partner.sessionId, connection.sessionId);
    matchesTotal.inc();

    connection.send({
      t: 'matched',
      payload: { roomId, peerId: partner.sessionId, polite: false },
    });
    logger.debug({ roomId, a: partner.id, b: connection.id }, 'peers matched across instances');
  }

  private async onSignal(connection: Connection, payload: SignalPayload): Promise<void> {
    const { roomId, peerId } = connection;
    if (!roomId || !peerId) {
      connection.send({ t: 'error', payload: { code: 'not_in_room', message: 'No active peer.' } });
      return;
    }

    const peer = this.peerOf(connection);
    if (peer) {
      peer.send({ t: 'signal', payload });
      return;
    }
    if (!this.bus || this.connections.has(peerId)) {
      // Local peer in a different room (stale) — same answer as no peer at all.
      connection.send({ t: 'error', payload: { code: 'not_in_room', message: 'No active peer.' } });
      return;
    }

    const received = await this.bus.publish(peerId, { kind: 'signal', roomId, payload });
    if (received === 0) {
      // The peer's instance is gone; surface it as a departure. The call row
      // is closed here because the dead instance never got the chance to.
      recordCallEnd(roomId, 'disconnected');
      connection.send({ t: 'peer.left', payload: { reason: 'disconnected' } });
      this.resetToIdle(connection);
    }
  }

  private async onQueueLeave(connection: Connection): Promise<void> {
    await this.matchmaker.remove(connection.id);
    if (connection.state === 'queued') connection.state = 'idle';
  }

  /** Tear down the caller's room and notify the peer, wherever it lives. */
  private async leaveRoom(connection: Connection, reason: PeerLeftReason): Promise<void> {
    const { roomId, peerId } = connection;
    connection.roomId = null;
    connection.peerId = null;
    if (connection.state === 'matched') connection.state = 'idle';
    if (!roomId || !peerId) return;

    // First end event wins in the database, so recording here is safe even if
    // the other side races us to it.
    recordCallEnd(roomId, reason);

    const peer = this.connections.get(peerId);
    if (peer) {
      if (peer.roomId !== roomId) return;
      peer.send({ t: 'peer.left', payload: { reason } });
      this.resetToIdle(peer);
      return;
    }
    await this.bus?.publish(peerId, { kind: 'peer.left', roomId, reason });
  }

  private onBusEvent(peerId: string, event: PeerEvent): void {
    const connection = this.connections.get(peerId);
    if (!connection) {
      // A `matched` claim on a peer that just vanished here — free the partner.
      if (event.kind === 'matched') void this.releasePartnerOf(event);
      return;
    }
    this.enqueueTask(connection, () => this.applyBusEvent(connection, event));
  }

  private async applyBusEvent(connection: Connection, event: PeerEvent): Promise<void> {
    switch (event.kind) {
      case 'matched': {
        if (connection.state !== 'queued') {
          // Claimed from the pool but no longer waiting (left or re-matched).
          await this.releasePartnerOf(event);
          return;
        }
        connection.state = 'matched';
        connection.roomId = event.roomId;
        connection.peerId = event.peerConnectionId;
        connection.send({
          t: 'matched',
          payload: { roomId: event.roomId, peerId: event.peerSessionId, polite: event.polite },
        });
        return;
      }
      case 'signal': {
        if (connection.roomId === event.roomId) {
          connection.send({ t: 'signal', payload: event.payload });
        }
        return;
      }
      case 'peer.left': {
        if (connection.roomId !== event.roomId) return;
        connection.send({ t: 'peer.left', payload: { reason: event.reason } });
        this.resetToIdle(connection);
        return;
      }
    }
  }

  /** Tell the other side of a failed remote match that its peer is gone. */
  private async releasePartnerOf(event: Extract<PeerEvent, { kind: 'matched' }>): Promise<void> {
    recordCallEnd(event.roomId, 'disconnected');
    await this.bus?.publish(event.peerConnectionId, {
      kind: 'peer.left',
      roomId: event.roomId,
      reason: 'disconnected',
    });
  }

  private resetToIdle(connection: Connection): void {
    connection.state = 'idle';
    connection.roomId = null;
    connection.peerId = null;
  }

  private peerOf(connection: Connection): Connection | null {
    if (!connection.peerId) return null;
    const peer = this.connections.get(connection.peerId);
    return peer && peer.roomId === connection.roomId ? peer : null;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  queueSize(): Promise<number> {
    return this.matchmaker.size();
  }
}
