import { expect, it } from 'vitest';
import type { Matchmaker } from './matchmaker.js';

/**
 * Behavioral contract every `Matchmaker` implementation must satisfy. Invoked
 * by both the in-process unit tests and the Redis integration tests so the
 * two implementations stay in lockstep.
 *
 * `create(maxWaiting?)` must return a fresh, empty pool.
 */
export function describeMatchmakerContract(
  create: (maxWaiting?: number) => Matchmaker | Promise<Matchmaker>,
): void {
  it('queues the first peer and pairs the second', async () => {
    const mm = await create();
    expect(await mm.enqueue('a', 's1')).toEqual({ status: 'waiting', position: 0 });
    expect(await mm.size()).toBe(1);

    expect(await mm.enqueue('b', 's2')).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
    expect(await mm.size()).toBe(0);
  });

  it('is idempotent for an already-waiting peer', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1');
    expect(await mm.enqueue('a', 's1')).toEqual({ status: 'waiting', position: 0 });
    expect(await mm.size()).toBe(1);
  });

  it('never pairs two connections of the same session', async () => {
    const mm = await create();
    await mm.enqueue('tab1', 's1');
    expect(await mm.enqueue('tab2', 's1')).toEqual({ status: 'waiting', position: 1 });
    expect(await mm.size()).toBe(2);

    // A different session still matches the longest-waiting tab.
    expect(await mm.enqueue('c', 's2')).toEqual({
      status: 'matched',
      partner: { id: 'tab1', sessionId: 's1' },
    });
  });

  it('removes a waiting peer', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1');
    await mm.remove('a');
    expect(await mm.size()).toBe(0);
    expect((await mm.enqueue('b', 's2')).status).toBe('waiting');
  });

  it('tolerates removing a peer that is not waiting', async () => {
    const mm = await create();
    await expect(mm.remove('ghost')).resolves.toBeUndefined();
  });

  it('pairs peers that share at least one interest', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1', { interests: ['music'] });
    expect((await mm.enqueue('b', 's2', { interests: ['sports'] })).status).toBe('waiting');
    expect(await mm.enqueue('c', 's3', { interests: ['music', 'sports'] })).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
  });

  it('treats a peer with no interests as compatible with anyone', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1', { interests: ['music'] });
    expect(await mm.enqueue('b', 's2')).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
  });

  it('pairs with the longest-waiting compatible peer first', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1', { interests: ['music'] });
    await mm.enqueue('b', 's2', { interests: ['travel'] });
    expect(await mm.enqueue('c', 's3', { interests: ['travel', 'music'] })).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
    expect(await mm.size()).toBe(1);
  });

  it('reports queue position for waiting peers', async () => {
    const mm = await create();
    await mm.enqueue('a', 's1', { interests: ['x'] });
    expect(await mm.enqueue('b', 's2', { interests: ['y'] })).toEqual({
      status: 'waiting',
      position: 1,
    });
  });

  it('rejects new peers once the pool is at capacity', async () => {
    const mm = await create(2);
    await mm.enqueue('a', 's1', { interests: ['x'] });
    await mm.enqueue('b', 's2', { interests: ['y'] });
    expect(await mm.enqueue('c', 's3', { interests: ['z'] })).toEqual({
      status: 'rejected',
      reason: 'full',
    });
    expect(await mm.size()).toBe(2);
  });

  it('matches at capacity instead of rejecting when a partner is compatible', async () => {
    const mm = await create(2);
    await mm.enqueue('a', 's1', { interests: ['x'] });
    await mm.enqueue('b', 's2', { interests: ['y'] });
    expect(await mm.enqueue('c', 's3', { interests: ['x'] })).toEqual({
      status: 'matched',
      partner: { id: 'a', sessionId: 's1' },
    });
  });

  it('a full pool stays idempotent for peers already waiting', async () => {
    const mm = await create(1);
    await mm.enqueue('a', 's1', { interests: ['x'] });
    expect(await mm.enqueue('a', 's1', { interests: ['x'] })).toEqual({
      status: 'waiting',
      position: 0,
    });
  });
}
