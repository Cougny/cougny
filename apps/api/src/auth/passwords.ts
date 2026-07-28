import { randomBytes } from 'node:crypto';
import { hash, hashSync, verify } from '@node-rs/argon2';

/**
 * Argon2id, the hybrid variant recommended for password storage. Written as its
 * numeric identifier because the library declares `Algorithm` as an ambient
 * const enum, which cannot be referenced under `isolatedModules`.
 */
const ARGON2ID = 2;

/**
 * Parameters following the OWASP Password Storage Cheat Sheet's recommended
 * configuration (19 MiB memory, 2 iterations, 1 degree of parallelism). The
 * cost is encoded in the digest itself, so raising these numbers later still
 * verifies every hash written under the old ones.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A digest of a value nobody knows, verified against whenever an account has no
 * password — either because the email is unregistered or because the account
 * only ever signed in socially. Doing the work anyway keeps the response time
 * of "no such user" indistinguishable from "wrong password", so login cannot be
 * used to enumerate registered addresses.
 *
 * Computed once at startup rather than hardcoded so it is always a valid digest
 * under the current parameters, and therefore always costs a real verification.
 */
const DUMMY_HASH = hashSync(randomBytes(32).toString('hex'), ARGON2_OPTIONS);

/** Hashes a plaintext password for storage. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Checks a password against a stored digest. Pass `null` for accounts without
 * one — the comparison still runs, against {@link DUMMY_HASH}, and returns
 * false.
 */
export async function verifyPassword(digest: string | null, password: string): Promise<boolean> {
  try {
    return await verify(digest ?? DUMMY_HASH, password, ARGON2_OPTIONS);
  } catch {
    // A malformed or unparseable digest is a failed verification, never a 500.
    return false;
  }
}
