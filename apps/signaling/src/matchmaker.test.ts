import { describe, expect, it } from 'vitest';
import { Matchmaker } from './matchmaker.js';

describe('Matchmaker', () => {
  it('queues the first peer and pairs the second', () => {
    const mm = new Matchmaker();
    expect(mm.enqueue('a', 'session-a')).toBeNull();
    expect(mm.size).toBe(1);

    const match = mm.enqueue('b', 'session-b');
    expect(match).toEqual({ a: 'a', b: 'b' });
    expect(mm.size).toBe(0);
  });

  it('never pairs a peer with itself', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a');
    expect(mm.enqueue('a', 'session-a')).toBeNull();
    expect(mm.size).toBe(1);
  });

  it('never pairs two connections of the same session', () => {
    const mm = new Matchmaker();
    mm.enqueue('tab-1', 'session-a');
    expect(mm.enqueue('tab-2', 'session-a')).toBeNull();
    expect(mm.size).toBe(2);

    // A different session still matches the longest-waiting tab.
    expect(mm.enqueue('b', 'session-b')).toEqual({ a: 'tab-1', b: 'b' });
  });

  it('removes a waiting peer', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a');
    mm.remove('a');
    expect(mm.size).toBe(0);
    expect(mm.enqueue('b', 'session-b')).toBeNull();
  });

  it('pairs peers that share at least one interest', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['music'] });
    expect(mm.enqueue('b', 'session-b', { interests: ['sports'] })).toBeNull();
    expect(mm.enqueue('c', 'session-c', { interests: ['music', 'sports'] })).toEqual({
      a: 'a',
      b: 'c',
    });
  });

  it('treats a peer with no interests as compatible with anyone', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['music'] });
    expect(mm.enqueue('b', 'session-b', {})).toEqual({ a: 'a', b: 'b' });
  });

  it('reports queue position', () => {
    const mm = new Matchmaker();
    mm.enqueue('a', 'session-a', { interests: ['x'] });
    mm.enqueue('b', 'session-b', { interests: ['x'] });
    // 'a' and 'b' share an interest, so they pair; queue is empty afterwards.
    expect(mm.positionOf('a')).toBe(-1);
  });
});
