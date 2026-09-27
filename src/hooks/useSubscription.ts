import { useCallback, useEffect, useState } from 'react';
import { ErrorCode, type Purchase, type PurchaseError } from 'react-native-iap';

import { PRO_MONTHLY_PRODUCT_ID } from '../constants/subscriptions';
import * as subscriptionService from '../services/subscriptionService';
import type {
  Plan,
  ProMonthlyProduct,
  ProductLoadState,
} from '../types/subscription';

/**
 * App-level StoreKit state. Mounted once in App.tsx so the purchase listener is
 * active for the whole session — including transactions StoreKit replays on launch.
 */
export function useSubscription() {
  const [plan, setPlan] = useState<Plan>('free');
  const [product, setProduct] = useState<ProMonthlyProduct | null>(null);
  const [productState, setProductState] = useState<ProductLoadState>('idle');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const onPurchase = async (purchase: Purchase) => {
      if (purchase.productId !== PRO_MONTHLY_PRODUCT_ID) {
        return;
      }
      if (purchase.purchaseState === 'pending') {
        // e.g. Ask to Buy — StoreKit will deliver the final transaction later.
        setPurchasing(false);
        setMessage('Purchase is pending approval.');
        return;
      }
      // Demo scope: no server-side validation. Grant access, then finish the
      // transaction so StoreKit stops re-delivering it.
      setPlan('pro');
      setPurchasing(false);
      setMessage(null);
      try {
        await subscriptionService.finishPurchase(purchase);
      } catch (error) {
        subscriptionService.logIapError('finishTransaction failed', error);
      }
    };

    const onError = (error: PurchaseError) => {
      setPurchasing(false);
      if (error.code === ErrorCode.UserCancelled) {
        return;
      }
      subscriptionService.logIapError('Purchase failed', error);
      setMessage(error.message || 'Purchase failed. Please try again.');
    };

    const subscriptions = subscriptionService.listenForPurchases(
      onPurchase,
      onError,
    );

    // Connect and check for an existing entitlement (e.g. after relaunch or reinstall).
    (async () => {
      try {
        if (
          (await subscriptionService.connect()) &&
          (await subscriptionService.hasActivePro()) &&
          !cancelled
        ) {
          setPlan('pro');
        }
      } catch (error) {
        subscriptionService.logIapError('initConnection failed', error);
      }
    })();

    return () => {
      cancelled = true;
      subscriptions.forEach(s => s.remove());
      subscriptionService.disconnect().catch(() => {});
    };
  }, []);

  const loadProduct = useCallback(async () => {
    setProductState('loading');
    setMessage(null);
    try {
      setProduct(await subscriptionService.fetchProMonthly());
      setProductState('loaded');
    } catch (error) {
      subscriptionService.logIapError('fetchProducts failed', error);
      setProduct(null);
      setProductState('error');
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!product) {
      return;
    }
    setMessage(null);
    setPurchasing(true);
    try {
      await subscriptionService.purchaseProMonthly();
      // The result arrives in onPurchase / onError above.
    } catch (error) {
      subscriptionService.logIapError('requestPurchase failed', error);
      setPurchasing(false);
      setMessage('Could not start the purchase. Please try again.');
    }
  }, [product]);

  const restore = useCallback(async () => {
    setMessage(null);
    setRestoring(true);
    try {
      const active = await subscriptionService.restoreProMonthly();
      if (active) {
        setPlan('pro');
      } else {
        setMessage('No active Pro subscription found for this Apple ID.');
      }
    } catch (error) {
      subscriptionService.logIapError('restorePurchases failed', error);
      setMessage('Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, []);

  return {
    plan,
    product,
    productState,
    purchasing,
    restoring,
    message,
    loadProduct,
    subscribe,
    restore,
  };
}

export type SubscriptionController = ReturnType<typeof useSubscription>;
