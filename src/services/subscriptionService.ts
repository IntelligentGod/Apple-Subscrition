import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type EventSubscription,
  type ProductOrSubscription,
  type Purchase,
  type PurchaseError,
  type SubscriptionPeriodIOS,
} from 'react-native-iap';

import {
  PRO_MONTHLY_PRODUCT_ID,
  SUBSCRIPTION_SKUS,
} from '../constants/subscriptions';
import type { ProMonthlyProduct } from '../types/subscription';

/**
 * Thin wrapper around react-native-iap v16 (Nitro / OpenIAP API).
 * Everything StoreKit-related goes through this file so the screens stay declarative.
 */

export class ProductNotFoundError extends Error {
  constructor(readonly returnedIds: string[]) {
    super('Subscription product could not be loaded.');
    this.name = 'ProductNotFoundError';
  }
}

let connection: Promise<boolean> | null = null;

/** Idempotent: every caller shares one StoreKit connection. A failed attempt can be retried. */
export function connect(): Promise<boolean> {
  if (!connection) {
    connection = initConnection().then(ok => {
      if (!ok) {
        connection = null;
      }
      return ok;
    });
    connection.catch(() => {
      connection = null;
    });
  }
  return connection;
}

export async function disconnect(): Promise<void> {
  connection = null;
  await endConnection();
}

/** Registers the purchase listeners. The caller must `.remove()` both on cleanup. */
export function listenForPurchases(
  onPurchase: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void,
): EventSubscription[] {
  return [purchaseUpdatedListener(onPurchase), purchaseErrorListener(onError)];
}

/**
 * Requests the Pro Monthly subscription from StoreKit and verifies that Apple
 * actually returned the expected product ID.
 */
export async function fetchProMonthly(): Promise<ProMonthlyProduct> {
  if (!(await connect())) {
    throw new Error('StoreKit connection unavailable');
  }
  const results: ProductOrSubscription[] =
    (await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' })) ?? [];

  const product = results.find(
    p => p.id === PRO_MONTHLY_PRODUCT_ID && p.type === 'subs',
  );

  if (!product) {
    const returnedIds = results.map(p => p.id);
    if (__DEV__) {
      console.warn('[IAP] Expected Product ID:', PRO_MONTHLY_PRODUCT_ID);
      console.warn('[IAP] Returned Product IDs:', returnedIds);
    }
    throw new ProductNotFoundError(returnedIds);
  }

  const periodUnit =
    product.platform === 'ios' && product.type === 'subs'
      ? product.subscriptionPeriodUnitIOS
      : null;

  return {
    id: product.id,
    title: product.displayName || product.title,
    displayPrice: product.displayPrice,
    periodLabel: formatPeriod(periodUnit),
  };
}

/**
 * Opens Apple's purchase sheet. The outcome is delivered asynchronously to
 * `purchaseUpdatedListener` / `purchaseErrorListener`, not via this promise.
 *
 * `appAccountToken` is the signed-in user's id (a UUID). Apple stores it on the
 * transaction, so the server can tell which account a purchase belongs to.
 */
export async function purchaseProMonthly(
  appAccountToken: string,
): Promise<void> {
  await requestPurchase({
    request: { apple: { sku: PRO_MONTHLY_PRODUCT_ID, appAccountToken } },
    type: 'subs',
  });
}

/**
 * Tells StoreKit the purchase was delivered. Only call this after the server
 * has recorded it — unfinished iOS transactions are re-delivered on every launch.
 */
export async function finishPurchase(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/** StoreKit's signed transaction (JWS) for a purchase — what the server verifies. */
export function signedTransactionOf(purchase: Purchase): string | null {
  return purchase.purchaseToken ?? null;
}

/**
 * Syncs with the App Store (may prompt for Apple ID sign-in) and returns the
 * active Pro purchases on this Apple ID, for the server to verify.
 */
export async function restoreProPurchases(): Promise<Purchase[]> {
  await restorePurchases();
  const purchases = await getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
  });
  return purchases.filter(p => p.productId === PRO_MONTHLY_PRODUCT_ID);
}

/** Logs a StoreKit error without dumping the full object (which may include tokens). */
export function logIapError(context: string, error: unknown): void {
  if (!__DEV__) {
    return;
  }
  const { code, message } = (error ?? {}) as Partial<PurchaseError>;
  console.warn(`[IAP] ${context}`, { code, message });
}

function formatPeriod(unit: SubscriptionPeriodIOS | null | undefined) {
  return unit && unit !== 'empty' ? unit : null;
}
