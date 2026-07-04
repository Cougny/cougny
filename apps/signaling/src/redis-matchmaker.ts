import type { MatchPreferences } from '@cougny/protocol';
import { DEFAULT_MAX_WAITING, type EnqueueResult, type Matchmaker } from './matchmaker.js';
import type { RedisClient } from './redis.js';

/**
 * Match-or-enqueue in a single atomic step. Redis executes scripts serially,
 * so two instances can never claim the same waiting peer, and two peers that
 * enqueue simultaneously can never miss each other.
 *
 * KEYS[1]  queue ZSET   (member: peer id, score: enqueue time ms)
 * KEYS[2]  peers HASH   (field: peer id, value: {"s":sessionId,"p":prefs} JSON)
 * ARGV[1]  peer id
 * ARGV[2]  peer entry JSON ({"s":...,"p":...})
 * ARGV[3]  enqueue time (ms)
 * ARGV[4]  max candidates to scan
 * ARGV[5]  max waiting peers (capacity)
 *
 * Returns:
 *   {'matched', partnerId, partnerSessionId}
 *   {'waiting', position}
 *   {'full'}
 *
 * The compatibility rule mirrors `isCompatible` in `matchmaker.ts` — keep the
 * two in sync: different sessions, and — if both sides declared interests —
 * at least one shared interest.
 */
const MATCH_OR_ENQUEUE = `
local queue, peers = KEYS[1], KEYS[2]
local id = ARGV[1]

-- Re-enqueuing an already-waiting peer is idempotent, not a new admission.
if redis.call('ZSCORE', queue, id) then
  return {'waiting', redis.call('ZRANK', queue, id)}
end

local function interests(entry)
  return (entry.p and entry.p.interests) or {}
end

local function compatible(a, b)
  if #a == 0 or #b == 0 then
    return true
  end
  for _, x in ipairs(a) do
    for _, y in ipairs(b) do
      if x == y then
        return true
      end
    end
  end
  return false
end

local mine = cjson.decode(ARGV[2])
local myInterests = interests(mine)

local candidates = redis.call('ZRANGE', queue, 0, tonumber(ARGV[4]) - 1)
for _, candidate in ipairs(candidates) do
  if candidate ~= id then
    local raw = redis.call('HGET', peers, candidate)
    if not raw then
      -- Queue entry without a peer record: half-written or half-removed; prune.
      redis.call('ZREM', queue, candidate)
    else
      local entry = cjson.decode(raw)
      if entry.s ~= mine.s and compatible(myInterests, interests(entry)) then
        redis.call('ZREM', queue, candidate)
        redis.call('HDEL', peers, candidate)
        return {'matched', candidate, entry.s}
      end
    end
  end
end

if redis.call('ZCARD', queue) >= tonumber(ARGV[5]) then
  return {'full'}
end

redis.call('ZADD', queue, tonumber(ARGV[3]), id)
redis.call('HSET', peers, id, ARGV[2])
return {'waiting', redis.call('ZRANK', queue, id)}
`;

export interface RedisMatchmakerOptions {
  /** Namespace for all keys, so environments can share one Redis. */
  keyPrefix?: string;
  /** How many of the longest-waiting peers to consider per enqueue. */
  scanLimit?: number;
  /** Cap on simultaneously-waiting peers across all instances. */
  maxWaiting?: number;
}

/**
 * Matchmaking pool shared by every signaling instance pointed at the same
 * Redis. Peers left behind by a crashed instance are not swept eagerly: when
 * one is eventually claimed, the hub's zero-receiver publish detects the dead
 * owner and requeues the survivor (see `hub.ts`).
 */
export class RedisMatchmaker implements Matchmaker {
  private readonly queueKey: string;
  private readonly peersKey: string;
  private readonly scanLimit: number;
  private readonly maxWaiting: number;

  constructor(
    private readonly redis: RedisClient,
    options: RedisMatchmakerOptions = {},
  ) {
    const prefix = options.keyPrefix ?? 'cougny:matchmaking';
    this.queueKey = `${prefix}:queue`;
    this.peersKey = `${prefix}:peers`;
    this.scanLimit = options.scanLimit ?? 64;
    this.maxWaiting = options.maxWaiting ?? DEFAULT_MAX_WAITING;
  }

  async enqueue(
    id: string,
    sessionId: string,
    preferences: MatchPreferences = {},
  ): Promise<EnqueueResult> {
    // Plain EVAL keeps this dependency-light; switch to EVALSHA if it ever
    // shows up in profiles (the script is a few hundred bytes on a low-QPS path).
    const reply = (await this.redis.eval(MATCH_OR_ENQUEUE, {
      keys: [this.queueKey, this.peersKey],
      arguments: [
        id,
        JSON.stringify({ s: sessionId, p: preferences }),
        String(Date.now()),
        String(this.scanLimit),
        String(this.maxWaiting),
      ],
    })) as [string, ...unknown[]];

    switch (reply[0]) {
      case 'matched':
        return {
          status: 'matched',
          partner: { id: String(reply[1]), sessionId: String(reply[2]) },
        };
      case 'full':
        return { status: 'rejected', reason: 'full' };
      default:
        return { status: 'waiting', position: Number(reply[1] ?? 0) };
    }
  }

  async remove(id: string): Promise<void> {
    await this.redis.multi().zRem(this.queueKey, id).hDel(this.peersKey, id).exec();
  }

  async size(): Promise<number> {
    return this.redis.zCard(this.queueKey);
  }
}
