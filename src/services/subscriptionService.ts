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
 */
export async function purchaseProMonthly(): Promise<void> {
  await requestPurchase({
    request: { apple: { sku: PRO_MONTHLY_PRODUCT_ID } },
    type: 'subs',
  });
}

/** Subscriptions are never consumable. Unfinished iOS transactions replay on every launch. */
export async function finishPurchase(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/** Returns true if StoreKit reports an active Pro Monthly entitlement. */
export async function hasActivePro(): Promise<boolean> {
  const purchases = await getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
  });
  return purchases.some(p => p.productId === PRO_MONTHLY_PRODUCT_ID);
}

/** Syncs with the App Store (may prompt for Apple ID sign-in), then re-checks entitlements. */
export async function restoreProMonthly(): Promise<boolean> {
  await restorePurchases();
  return hasActivePro();
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
