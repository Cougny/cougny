import {
  CreateReportResponseSchema,
  CreateSessionResponseSchema,
  IceServersResponseSchema,
  type CreateReportRequest,
  type CreateReportResponse,
  type CreateSessionResponse,
  type IceServersResponse,
} from '@cougny/protocol';
import { clientEnv } from './env';

const SESSION_STORAGE_KEY = 'cougny.session';

interface StoredSession {
  sessionId: string;
  token: string;
  expiresAt: number;
}

/**
 * Create or reuse a call session, cached in localStorage.
 *
 * Requires a signed-in account: the server refuses to mint a call session
 * without one, so the token is not optional here.
 */
export async function ensureSession(accessToken: string): Promise<StoredSession> {
  const cached = readCachedSession();
  if (cached) return cached;

  const res = await fetch(`${clientEnv.apiUrl}/v1/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to create session (${res.status})`);

  const data: CreateSessionResponse = CreateSessionResponseSchema.parse(await res.json());
  const session: StoredSession = {
    sessionId: data.sessionId,
    token: data.token,
    expiresAt: data.expiresAt,
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

/** Fetch STUN/TURN servers (with fresh TURN credentials) for this session. */
export async function fetchIceServers(token: string): Promise<IceServersResponse> {
  const res = await fetch(`${clientEnv.apiUrl}/v1/ice-servers`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch ICE servers (${res.status})`);
  return IceServersResponseSchema.parse(await res.json());
}

/** File a moderation report against the current call's peer. */
export async function createReport(
  token: string,
  body: CreateReportRequest,
): Promise<CreateReportResponse> {
  const res = await fetch(`${clientEnv.apiUrl}/v1/reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to submit report (${res.status})`);
  return CreateReportResponseSchema.parse(await res.json());
}

/**
 * Forget the cached session so the next call mints a fresh one. Used when
 * signing in or out, so a session is never carried across that boundary — it
 * would otherwise stay attached to the account someone just left.
 */
export function clearCachedSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode); nothing was cached to clear.
  }
}

function readCachedSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    // Refresh a minute before expiry to avoid mid-call token death.
    if (parsed.expiresAt * 1000 - Date.now() < 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}
