import type { Store, Subscription } from '../store';
import { isEntitled } from './entitlement';

export interface Entitlements {
  plan: 'free' | 'pro';
  status: Subscription['status'] | null;
  productId: string | null;
  expiresAt: string | null;
  environment: string | null;
}

/** The single answer to "is this user Pro right now?" — used by the app and by Pro-only APIs. */
export async function getEntitlements(
  store: Store,
  userId: string,
  now = new Date(),
): Promise<Entitlements> {
  const subs = await store.listSubscriptions(userId);
  const byLatestExpiry = (a: Subscription, b: Subscription) =>
    (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0);

  const active = subs.filter(s => isEntitled(s, now)).sort(byLatestExpiry)[0];
  const shown = active ?? subs.sort(byLatestExpiry)[0];

  return {
    plan: active ? 'pro' : 'free',
    status: shown?.status ?? null,
    productId: shown?.productId ?? null,
    expiresAt: shown?.expiresAt?.toISOString() ?? null,
    environment: shown?.environment ?? null,
  };
}
