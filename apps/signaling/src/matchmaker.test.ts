import { describe, expect, it } from 'vitest';
import { Matchmaker } from './matchmaker.js';

describe('Matchmaker', () => {
  it('queues the first peer and pairs the second', () => {
    const mm = new Matchmaker();
    expect(mm.enqueue('a', 'session-a')).toEqual({ status: 'waiting' });
    expect(mm.size).toBe(1);

    expect(mm.enqueue('b', 'session-b')).toEqual({
      status: 'matched',
      match: { a: 'a', b: 'b' },
    });
    expect(mm.size).toBe(0);
  });

  it('never pairs a peer with itself', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a');
    expect(mm.enqueue('a', 'session-a')).toEqual({ status: 'waiting' });
    expect(mm.size).toBe(1);
  });

  it('never pairs two connections of the same session', () => {
    const mm = new Matchmaker();
    mm.enqueue('tab-1', 'session-a');
    expect(mm.enqueue('tab-2', 'session-a')).toEqual({ status: 'waiting' });
    expect(mm.size).toBe(2);

    // A different session still matches the longest-waiting tab.
    expect(mm.enqueue('b', 'session-b')).toEqual({
      status: 'matched',
      match: { a: 'tab-1', b: 'b' },
    });
  });

  it('removes a waiting peer', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a');
    mm.remove('a');
    expect(mm.size).toBe(0);
    expect(mm.enqueue('b', 'session-b')).toEqual({ status: 'waiting' });
  });

  it('pairs peers that share at least one interest', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['music'] });
    expect(mm.enqueue('b', 'session-b', { interests: ['sports'] })).toEqual({ status: 'waiting' });
    expect(mm.enqueue('c', 'session-c', { interests: ['music', 'sports'] })).toEqual({
      status: 'matched',
      match: { a: 'a', b: 'c' },
    });
  });

  it('treats a peer with no interests as compatible with anyone', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['music'] });
    expect(mm.enqueue('b', 'session-b', {})).toEqual({
      status: 'matched',
      match: { a: 'a', b: 'b' },
    });
  });

  it('reports queue position', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['x'] });
    mm.enqueue('b', 'session-b', { interests: ['x'] });
    // 'a' and 'b' share an interest, so they pair; queue is empty afterwards.
    expect(mm.positionOf('a')).toBe(-1);
  });

  it('rejects new peers once the waiting pool is full', () => {
    const mm = new Matchmaker(2);
    // Same session so nobody pairs; the pool fills to capacity.
    expect(mm.enqueue('a', 'session-x')).toEqual({ status: 'waiting' });
    expect(mm.enqueue('b', 'session-x')).toEqual({ status: 'waiting' });
    expect(mm.enqueue('c', 'session-x')).toEqual({ status: 'rejected', reason: 'full' });
    expect(mm.size).toBe(2);
  });

  it('still pairs an incoming peer when the pool is full', () => {
    const mm = new Matchmaker(2);
    // Two peers of the same session can never pair each other, so the pool
    // fills to capacity.
    mm.enqueue('a', 'session-x');
    mm.enqueue('b', 'session-x');
    // Pool is full, but a compatible partner (different session) exists, so the
    // arrival matches the longest waiter (shrinking the pool) instead of being
    // rejected.
    expect(mm.enqueue('c', 'session-c')).toEqual({
      status: 'matched',
      match: { a: 'a', b: 'c' },
    });
    expect(mm.size).toBe(1);
  });

  it('treats re-enqueue of a waiting peer as idempotent, not a new admission', () => {
    const mm = new Matchmaker(1);
    expect(mm.enqueue('a', 'session-a')).toEqual({ status: 'waiting' });
    // Already waiting: allowed through even though the pool is at capacity.
    expect(mm.enqueue('a', 'session-a')).toEqual({ status: 'waiting' });
    expect(mm.size).toBe(1);
  });
});
