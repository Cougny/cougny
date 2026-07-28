'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, UserProfile } from '@cougny/protocol';
import * as authApi from '@/lib/auth';
import { clearCachedSession } from '@/lib/api';

/**
 * Holds the signed-in account for the whole app.
 *
 * The access token lives in React state and nowhere else — not `localStorage`,
 * not a readable cookie. It is short-lived and replaced from the httpOnly
 * refresh cookie, so a page reload re-authenticates silently while an injected
 * script has no durable credential to steal.
 */

export type AuthStatus =
  /** The initial refresh has not finished; the UI should not decide yet. */
  'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  /** Present only while authenticated. Pass to `lib/auth` calls that need it. */
  token: string | null;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signUp: (input: authApi.RegisterInput) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  /** Adopts the result of a sign-in performed elsewhere (social, passkey). */
  adopt: (response: AuthResponse) => void;
  /** Re-reads the profile after a change made outside this provider. */
  reload: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Refresh this many seconds before the access token actually lapses, so a
 * request never leaves with a token that expires in flight.
 */
const REFRESH_MARGIN_SECONDS = 60;

/** Floor on the refresh delay, so a stale token can never cause a busy loop. */
const MIN_REFRESH_DELAY_MS = 5_000;

/** The signed-in state, kept in one object so it can only change coherently. */
interface Session {
  token: string;
  user: UserProfile;
  /** Unix seconds. Drives when the next refresh is scheduled. */
  expiresAt: number;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const adopt = useCallback((response: AuthResponse) => {
    setSession({
      token: response.accessToken,
      user: response.user,
      expiresAt: response.expiresAt,
    });
    setStatus('authenticated');

    /*
     * Drop the cached anonymous call session. The next one is minted while this
     * access token is in hand, so the server attaches it to the account and a
     * signed-in user's calls can be traced back for moderation.
     */
    clearCachedSession();
  }, []);

  const forget = useCallback(() => {
    setSession(null);
    setStatus('anonymous');
  }, []);

  // One refresh attempt on mount decides whether this browser is already signed
  // in. A 401 here is the normal path for a visitor without an account.
  useEffect(() => {
    let cancelled = false;

    void authApi
      .refresh()
      .then((response) => {
        if (!cancelled) adopt(response);
      })
      .catch(() => {
        if (!cancelled) forget();
      });

    return () => {
      cancelled = true;
    };
  }, [adopt, forget]);

  /*
   * Keeps the access token fresh. Declarative rather than a chain of nested
   * timeouts: each successful refresh replaces `expiresAt`, which re-runs this
   * effect and schedules the next one.
   */
  useEffect(() => {
    if (!session) return;

    const delayMs = Math.max(
      (session.expiresAt - Math.floor(Date.now() / 1000) - REFRESH_MARGIN_SECONDS) * 1000,
      MIN_REFRESH_DELAY_MS,
    );

    const timer = setTimeout(() => {
      void authApi
        .refresh()
        .then(adopt)
        // The refresh cookie is gone or was revoked. Falling back to signed out
        // beats leaving a dead token in place.
        .catch(forget);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [session, adopt, forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      adopt(response);
      return response.user;
    },
    [adopt],
  );

  const signUp = useCallback(
    async (input: authApi.RegisterInput) => {
      const response = await authApi.register({
        ...input,
        acceptedTerms: true,
        acceptedConduct: true,
      });
      adopt(response);
      return response.user;
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Local state is cleared even if the call fails: the user asked to be
      // signed out, and this device should stop acting signed in either way.
      forget();
      clearCachedSession();
    }
  }, [forget]);

  const reload = useCallback(async () => {
    if (!session) return;
    const user = await authApi.fetchProfile(session.token);
    setSession((current) => (current ? { ...current, user } : current));
  }, [session]);

  const setUser = useCallback((user: UserProfile) => {
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      signIn,
      signUp,
      signOut,
      adopt,
      reload,
      setUser,
    }),
    [status, session, signIn, signUp, signOut, adopt, reload, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
