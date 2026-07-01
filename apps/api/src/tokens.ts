import jwt from 'jsonwebtoken';
import { env } from './env.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionClaims {
  sub: string; // sessionId
}

export function signSessionToken(sessionId: string): { token: string; expiresAt: number } {
  const token = jwt.sign({ sub: sessionId }, env.AUTH_JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
  });
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return { token, expiresAt };
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, env.AUTH_JWT_SECRET);
    if (typeof decoded === 'object' && decoded && typeof decoded.sub === 'string') {
      return { sub: decoded.sub };
    }
    return null;
  } catch {
    return null;
  }
}
