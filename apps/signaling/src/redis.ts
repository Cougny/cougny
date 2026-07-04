import { createClient } from 'redis';
import { logger } from './logger.js';

function buildClient(url: string) {
  return createClient({ url });
}

/**
 * The concrete client type a plain `createClient({ url })` call returns.
 * node-redis's generic `RedisClientType` defaults do not unify with it, so
 * downstream code types against this alias instead.
 */
export type RedisClient = ReturnType<typeof buildClient>;

/**
 * Build an unconnected client with error logging attached — an unhandled
 * `error` event on a node-redis client crashes the process. The client
 * reconnects on its own; callers only `connect()` and `close()` it.
 */
export function createRedisClient(url: string): RedisClient {
  const client = buildClient(url);
  client.on('error', (err) => logger.error({ err }, 'redis client error'));
  return client;
}
