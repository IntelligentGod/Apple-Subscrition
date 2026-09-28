import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiError, type Session } from '../services/api';

const SESSION_KEY = 'eazee.session';

/**
 * Signed-in user + token. The session is kept in AsyncStorage so the user
 * stays signed in across launches. (For a production app, prefer the Keychain,
 * e.g. react-native-keychain.)
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(async (next: Session | null) => {
    setSession(next);
    try {
      if (next) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } else {
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Storage failure only means the user signs in again next launch.
    }
  }, []);

  // Restore the saved session on launch and check the token is still valid.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(SESSION_KEY);
        if (!saved) {
          return;
        }
        const parsed: Session = JSON.parse(saved);
        setSession(parsed);
        try {
          const { user } = await api.me(parsed.token);
          setSession({ ...parsed, user });
        } catch (e) {
          // Offline (status 0) keeps the saved session; a rejected token signs out.
          if (e instanceof ApiError && e.status === 401) {
            await persist(null);
          }
        }
      } catch {
        // Corrupt storage: start signed out.
      } finally {
        setRestoring(false);
      }
    })();
  }, [persist]);

  const submit = useCallback(
    async (mode: 'login' | 'register', email: string, password: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const next =
          mode === 'login'
            ? await api.login(email, password)
            : await api.register(email, password);
        await persist(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
    },
    [persist],
  );

  const signOut = useCallback(() => persist(null), [persist]);

  return { session, restoring, submitting, error, submit, signOut };
}

export type AuthController = ReturnType<typeof useAuth>;
