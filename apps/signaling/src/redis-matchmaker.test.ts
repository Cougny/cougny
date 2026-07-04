import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeMatchmakerContract } from './matchmaker-contract.js';
import { RedisMatchmaker } from './redis-matchmaker.js';
import { createRedisClient, type RedisClient } from './redis.js';

const redisUrl = process.env.REDIS_URL;

// Integration tests — run only against a live server (CI provides one):
//   REDIS_URL=redis://localhost:6379 pnpm --filter @cougny/signaling test
describe.runIf(redisUrl)('RedisMatchmaker', () => {
  let client: RedisClient;
  const prefixes: string[] = [];

  const create = (maxWaiting?: number): RedisMatchmaker => {
    const keyPrefix = `cougny:test:${randomUUID()}`;
    prefixes.push(keyPrefix);
    return new RedisMatchmaker(client, { keyPrefix, maxWaiting });
  };

  beforeAll(async () => {
    client = createRedisClient(redisUrl!);
    await client.connect();
  });

  afterAll(async () => {
    const keys = prefixes.flatMap((prefix) => [`${prefix}:queue`, `${prefix}:peers`]);
    if (keys.length > 0) await client.del(keys);
    await client.close();
  });

  describeMatchmakerContract((maxWaiting) => create(maxWaiting));

  it('cleans up the peer record when a peer is matched', async () => {
    const mm = create();
    await mm.enqueue('a', 's1');
    await mm.enqueue('b', 's2');
    const prefix = prefixes[prefixes.length - 1]!;
    expect(await client.hLen(`${prefix}:peers`)).toBe(0);
    expect(await client.zCard(`${prefix}:queue`)).toBe(0);
  });

  it('prunes queue entries whose peer record is missing', async () => {
    const mm = create();
    await mm.enqueue('ghost', 's1');
    const prefix = prefixes[prefixes.length - 1]!;
    // Simulate a half-removed peer: queue entry without a record.
    await client.hDel(`${prefix}:peers`, 'ghost');

    // The ghost cannot be matched; it is pruned and the joiner waits.
    expect((await mm.enqueue('b', 's2')).status).toBe('waiting');
    expect(await client.zScore(`${prefix}:queue`, 'ghost')).toBeNull();
  });

  it('shares one pool between two matchmaker instances', async () => {
    const keyPrefix = `cougny:test:${randomUUID()}`;
    prefixes.push(keyPrefix);
    const mmA = new RedisMatchmaker(client, { keyPrefix });
    const mmB = new RedisMatchmaker(client, { keyPrefix });

    await mmA.enqueue('a', 's1');
    expect(await mmB.enqueue('b', 's2')).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
  });
});
