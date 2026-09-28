import { API_BASE_URL } from '../constants/api';
import type { Entitlements } from '../types/subscription';

/**
 * Small typed client for the Eazee backend. Every server call goes through `request`.
 */

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiUser {
  id: string;
  email: string;
}

export interface Session {
  token: string;
  user: ApiUser;
}

const TIMEOUT_MS = 15_000;

async function request<T>(
  path: string,
  {
    method = 'GET',
    body,
    token,
  }: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // status 0 = never reached the server (offline, wrong URL, server not running)
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<Session>('/auth/register', {
      method: 'POST',
      body: { email, password },
    }),

  login: (email: string, password: string) =>
    request<Session>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: (token: string) => request<{ user: ApiUser }>('/auth/me', { token }),

  entitlements: (token: string) =>
    request<Entitlements>('/me/entitlements', { token }),

  /** Sends StoreKit's signed transaction (JWS) to the server for verification. */
  verifyPurchase: (token: string, signedTransaction: string) =>
    request<Entitlements>('/iap/verify', {
      method: 'POST',
      body: { signedTransaction },
      token,
    }),

  proContent: (token: string) =>
    request<{ message: string; features: string[] }>('/pro/content', { token }),
};
