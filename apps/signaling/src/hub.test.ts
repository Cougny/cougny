import { describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@cougny/protocol';
import type { Connection } from './connection.js';
import { Hub } from './hub.js';
import { InMemoryMatchmaker } from './matchmaker.js';
import type { PeerBus, PeerEvent, PeerEventHandler } from './peer-bus.js';

// Call persistence is fire-and-forget Prisma; keep the database out of tests.
vi.mock('./calls.js', () => ({
  recordCallStart: vi.fn(),
  recordCallEnd: vi.fn(),
}));

class FakeSocket {
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: ServerMessage[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }

  ofType<T extends ServerMessage['t']>(t: T): Array<Extract<ServerMessage, { t: T }>> {
    return this.sent.filter(
      (message): message is Extract<ServerMessage, { t: T }> => message.t === t,
    );
  }
}

/**
 * In-memory stand-in for `RedisPeerBus`: a shared registry maps each peer id
 * to the bus (instance) that owns it, and `publish` reports zero receivers
 * for unowned peers — the same liveness signal the Redis implementation
 * gives. Pairing it with one `InMemoryMatchmaker` shared by two hubs
 * reproduces the Redis topology (shared pool, per-instance connections)
 * without a server.
 */
class FakeBus implements PeerBus {
  private handler: PeerEventHandler | null = null;

  constructor(private readonly registry: Map<string, FakeBus>) {}

  async subscribe(peerId: string): Promise<void> {
    this.registry.set(peerId, this);
  }

  async unsubscribe(peerId: string): Promise<void> {
    if (this.registry.get(peerId) === this) this.registry.delete(peerId);
  }

  async publish(peerId: string, event: PeerEvent): Promise<number> {
    const owner = this.registry.get(peerId);
    if (!owner?.handler) return 0;
    owner.handler(peerId, structuredClone(event));
    return 1;
  }

  onEvent(handler: PeerEventHandler): void {
    this.handler = handler;
  }
}

interface Client {
  socket: FakeSocket;
  connection: Connection;
}

let nextSession = 0;

function connect(hub: Hub, sessionId = `session-${(nextSession += 1)}`): Client {
  const socket = new FakeSocket();
  const connection = hub.register(sessionId, socket as unknown as Parameters<Hub['register']>[1]);
  return { socket, connection };
}

function send(hub: Hub, client: Client, message: unknown): void {
  hub.handleRaw(client.connection, JSON.stringify(message));
}

function join(hub: Hub, client: Client, payload: unknown = {}): void {
  send(hub, client, { t: 'queue.join', payload });
}

/** Let the per-connection mailbox chains drain. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const sdpOffer = { kind: 'sdp', description: { type: 'offer', sdp: 'v=0' } };

describe('Hub (single instance)', () => {
  const makeHub = (maxQueue?: number): Hub =>
    new Hub({ matchmaker: new InMemoryMatchmaker(maxQueue) });

  it('queues the first peer and pairs the second, exchanging session ids', async () => {
    const hub = makeHub();
    const first = connect(hub, 'session-a');
    const second = connect(hub, 'session-b');

    join(hub, first);
    await settle();
    expect(first.socket.ofType('queued')).toEqual([{ t: 'queued', payload: { position: 0 } }]);

    join(hub, second);
    await settle();

    const [toFirst] = first.socket.ofType('matched');
    const [toSecond] = second.socket.ofType('matched');
    expect(toFirst!.payload.peerId).toBe('session-b');
    expect(toSecond!.payload.peerId).toBe('session-a');
    expect(toFirst!.payload.roomId).toBe(toSecond!.payload.roomId);
    // Perfect negotiation: exactly one polite peer.
    expect([toFirst!.payload.polite, toSecond!.payload.polite].sort()).toEqual([false, true]);
  });

  it('never pairs two tabs of the same session', async () => {
    const hub = makeHub();
    const tab1 = connect(hub, 'same-session');
    const tab2 = connect(hub, 'same-session');

    join(hub, tab1);
    join(hub, tab2);
    await settle();

    expect(tab1.socket.ofType('matched')).toHaveLength(0);
    expect(tab2.socket.ofType('matched')).toHaveLength(0);
    expect(tab2.socket.ofType('queued')).toEqual([{ t: 'queued', payload: { position: 1 } }]);
  });

  it('relays signals between matched peers', async () => {
    const hub = makeHub();
    const first = connect(hub);
    const second = connect(hub);
    join(hub, first);
    join(hub, second);
    await settle();

    send(hub, first, { t: 'signal', payload: sdpOffer });
    await settle();

    expect(second.socket.ofType('signal')).toEqual([{ t: 'signal', payload: sdpOffer }]);
  });

  it('rejects signals from peers not in a room', async () => {
    const hub = makeHub();
    const loner = connect(hub);

    send(hub, loner, { t: 'signal', payload: sdpOffer });
    await settle();

    expect(loner.socket.ofType('error')[0]!.payload.code).toBe('not_in_room');
  });

  it('notifies the other side when a peer leaves, and both can requeue', async () => {
    const hub = makeHub();
    const first = connect(hub);
    const second = connect(hub);
    join(hub, first);
    join(hub, second);
    await settle();

    send(hub, first, { t: 'peer.leave', payload: {} });
    await settle();

    expect(second.socket.ofType('peer.left')).toEqual([
      { t: 'peer.left', payload: { reason: 'skipped' } },
    ]);

    // Both are idle again; a fresh join pairs them anew.
    join(hub, first);
    join(hub, second);
    await settle();
    expect(first.socket.ofType('matched')).toHaveLength(2);
  });

  it('treats a disconnect like a departure', async () => {
    const hub = makeHub();
    const first = connect(hub);
    const second = connect(hub);
    join(hub, first);
    join(hub, second);
    await settle();

    hub.handleClose(first.connection);
    await settle();

    expect(second.socket.ofType('peer.left')).toEqual([
      { t: 'peer.left', payload: { reason: 'disconnected' } },
    ]);
    expect(hub.connectionCount).toBe(1);
  });

  it('sheds joins once the queue is full', async () => {
    const hub = makeHub(1);
    const a = connect(hub);
    const b = connect(hub);
    join(hub, a, { interests: ['x'] });
    join(hub, b, { interests: ['y'] });
    await settle();

    expect(b.socket.ofType('error')[0]!.payload.code).toBe('queue_full');
  });

  it('answers heartbeats and rejects malformed frames', async () => {
    const hub = makeHub();
    const client = connect(hub);

    send(hub, client, { t: 'heartbeat' });
    hub.handleRaw(client.connection, 'not json');
    send(hub, client, { t: 'nonsense' });
    await settle();

    expect(client.socket.ofType('pong')).toHaveLength(1);
    expect(client.socket.ofType('error').map((e) => e.payload.code)).toEqual([
      'bad_message',
      'bad_message',
    ]);
  });
});

describe('Hub (two instances sharing a pool and a bus)', () => {
  function makePair(): { hubA: Hub; hubB: Hub; registry: Map<string, FakeBus> } {
    // One matchmaker instance shared by both hubs stands in for Redis.
    const pool = new InMemoryMatchmaker();
    const registry = new Map<string, FakeBus>();
    const hubA = new Hub({ matchmaker: pool, bus: new FakeBus(registry) });
    const hubB = new Hub({ matchmaker: pool, bus: new FakeBus(registry) });
    return { hubA, hubB, registry };
  }

  it('pairs peers living on different instances', async () => {
    const { hubA, hubB } = makePair();
    const onA = connect(hubA, 'session-a');
    const onB = connect(hubB, 'session-b');

    join(hubA, onA);
    await settle();
    join(hubB, onB);
    await settle();

    const [toA] = onA.socket.ofType('matched');
    const [toB] = onB.socket.ofType('matched');
    expect(toA!.payload.peerId).toBe('session-b');
    expect(toB!.payload.peerId).toBe('session-a');
    expect(toA!.payload.roomId).toBe(toB!.payload.roomId);
    expect([toA!.payload.polite, toB!.payload.polite].sort()).toEqual([false, true]);
  });

  it('relays signals and departures across instances', async () => {
    const { hubA, hubB } = makePair();
    const onA = connect(hubA);
    const onB = connect(hubB);
    join(hubA, onA);
    await settle();
    join(hubB, onB);
    await settle();

    send(hubB, onB, { t: 'signal', payload: sdpOffer });
    await settle();
    expect(onA.socket.ofType('signal')).toEqual([{ t: 'signal', payload: sdpOffer }]);

    send(hubA, onA, { t: 'peer.leave', payload: {} });
    await settle();
    expect(onB.socket.ofType('peer.left')).toEqual([
      { t: 'peer.left', payload: { reason: 'skipped' } },
    ]);
  });

  it('requeues the joiner when the claimed partner has vanished entirely', async () => {
    const { hubA, hubB, registry } = makePair();
    const ghost = connect(hubA, 'session-ghost');
    join(hubA, ghost);
    await settle();

    // The ghost's instance dies: its bus registrations disappear, but its
    // pool entry survives (exactly what a crashed instance leaves behind).
    registry.clear();

    const joiner = connect(hubB, 'session-live');
    join(hubB, joiner);
    await settle();

    expect(joiner.socket.ofType('matched')).toHaveLength(0);
    expect(joiner.socket.ofType('queued')).toHaveLength(1);
  });

  it('releases the claimer when the partner is no longer queued', async () => {
    const { hubA, hubB } = makePair();
    const flaky = connect(hubA, 'session-flaky');
    join(hubA, flaky);
    await settle();

    // Still subscribed on the bus, but no longer waiting (left the queue
    // without the shared pool hearing about it yet).
    flaky.connection.state = 'idle';

    const joiner = connect(hubB, 'session-joiner');
    join(hubB, joiner);
    await settle();

    // The claim is rolled back: the joiner is told its peer left...
    expect(joiner.socket.ofType('peer.left')).toEqual([
      { t: 'peer.left', payload: { reason: 'disconnected' } },
    ]);
    // ...and the flaky peer was never matched.
    expect(flaky.socket.ofType('matched')).toHaveLength(0);
  });
});
