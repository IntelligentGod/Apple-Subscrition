export type Plan = 'free' | 'pro';

/** What the server says about the signed-in user's subscription (GET /me/entitlements). */
export interface Entitlements {
  plan: Plan;
  status: string | null;
  productId: string | null;
  expiresAt: string | null;
  environment: string | null;
}

export type ProductLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** What the paywall needs to render — derived from the StoreKit product. */
export interface ProMonthlyProduct {
  id: string;
  title: string;
  /** Localized price string returned by StoreKit, e.g. "$4.99" or "4,99 €". */
  displayPrice: string;
  /** Human readable billing period, e.g. "month". Null if StoreKit did not report one. */
  periodLabel: string | null;
}
