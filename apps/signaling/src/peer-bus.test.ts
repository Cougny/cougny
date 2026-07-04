import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RedisPeerBus, type PeerEvent } from './peer-bus.js';
import { createRedisClient, type RedisClient } from './redis.js';

const redisUrl = process.env.REDIS_URL;

// Integration tests — run only against a live server (CI provides one):
//   REDIS_URL=redis://localhost:6379 pnpm --filter @cougny/signaling test
describe.runIf(redisUrl)('RedisPeerBus', () => {
  let publisher: RedisClient;
  let subscriber: RedisClient;

  beforeAll(async () => {
    publisher = createRedisClient(redisUrl!);
    subscriber = publisher.duplicate();
    await Promise.all([publisher.connect(), subscriber.connect()]);
  });

  afterAll(async () => {
    await Promise.all([publisher.close(), subscriber.close()]);
  });

  const makeBus = (): RedisPeerBus =>
    new RedisPeerBus(publisher, subscriber, `cougny:test:${randomUUID()}`);

  const matchedEvent: PeerEvent = {
    kind: 'matched',
    roomId: 'room-1',
    peerConnectionId: 'conn-2',
    peerSessionId: 'sess-2',
    polite: true,
  };

  it('delivers events to a subscribed peer and reports one receiver', async () => {
    const bus = makeBus();
    const received = vi.fn();
    bus.onEvent(received);
    await bus.subscribe('peer-a');

    const receivers = await bus.publish('peer-a', matchedEvent);
    expect(receivers).toBe(1);
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith('peer-a', matchedEvent));
  });

  it('reports zero receivers for a peer nobody owns', async () => {
    const bus = makeBus();
    expect(await bus.publish('nobody', matchedEvent)).toBe(0);
  });

  it('stops delivering after unsubscribe', async () => {
    const bus = makeBus();
    const received = vi.fn();
    bus.onEvent(received);
    await bus.subscribe('peer-b');
    await bus.unsubscribe('peer-b');

    expect(await bus.publish('peer-b', matchedEvent)).toBe(0);
    expect(received).not.toHaveBeenCalled();
  });

  it('drops malformed payloads without invoking the handler', async () => {
    const prefix = `cougny:test:${randomUUID()}`;
    const bus = new RedisPeerBus(publisher, subscriber, prefix);
    const received = vi.fn();
    bus.onEvent(received);
    await bus.subscribe('peer-c');

    await publisher.publish(`${prefix}:peer-c`, 'not json');
    await publisher.publish(`${prefix}:peer-c`, JSON.stringify({ kind: 'bogus' }));
    // A valid event afterwards proves the channel survived the garbage.
    await bus.publish('peer-c', matchedEvent);

    await vi.waitFor(() => expect(received).toHaveBeenCalledTimes(1));
    expect(received).toHaveBeenCalledWith('peer-c', matchedEvent);
  });
});
