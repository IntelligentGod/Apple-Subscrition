import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCode, type Purchase, type PurchaseError } from 'react-native-iap';

import { PRO_MONTHLY_PRODUCT_ID } from '../constants/subscriptions';
import { api, ApiError, type Session } from '../services/api';
import * as subscriptionService from '../services/subscriptionService';
import type {
  Entitlements,
  ProMonthlyProduct,
  ProductLoadState,
} from '../types/subscription';

const FREE: Entitlements = {
  plan: 'free',
  status: null,
  productId: null,
  expiresAt: null,
  environment: null,
};

/**
 * App-level subscription state. Mounted once in App.tsx so the purchase listener is
 * active for the whole session — including transactions StoreKit replays on launch.
 *
 * The server is the source of truth for the plan: every StoreKit purchase is sent
 * to POST /iap/verify, and the plan comes from the server's answer.
 */
export function useSubscription(session: Session | null) {
  const [entitlements, setEntitlements] = useState<Entitlements>(FREE);
  const [product, setProduct] = useState<ProMonthlyProduct | null>(null);
  const [productState, setProductState] = useState<ProductLoadState>('idle');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The purchase listener is registered once; it reads the latest session from here.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  /** Sends a purchase to the server; finishes it with StoreKit once the server has it. */
  const verifyWithServer = useCallback(async (purchase: Purchase) => {
    const current = sessionRef.current;
    const signed = subscriptionService.signedTransactionOf(purchase);
    if (!current || !signed) {
      // Leave it unfinished: StoreKit re-delivers it, or Restore picks it up after sign-in.
      return null;
    }
    try {
      const result = await api.verifyPurchase(current.token, signed);
      await finishSafely(purchase);
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 401
      ) {
        // The server definitively rejected it (e.g. another account's purchase). Retrying won't help.
        await finishSafely(purchase);
      }
      // Network/server errors: don't finish, so StoreKit delivers it again next launch.
      throw error;
    }
  }, []);

  useEffect(() => {
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
      try {
        const result = await verifyWithServer(purchase);
        if (result) {
          setEntitlements(result);
          setMessage(null);
        }
      } catch (error) {
        subscriptionService.logIapError('Server verification failed', error);
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'Could not confirm the purchase. Please try Restore Purchases.',
        );
      } finally {
        setPurchasing(false);
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
    subscriptionService
      .connect()
      .catch(error =>
        subscriptionService.logIapError('initConnection failed', error),
      );

    return () => {
      subscriptions.forEach(s => s.remove());
      subscriptionService.disconnect().catch(() => {});
    };
  }, [verifyWithServer]);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) {
      setEntitlements(FREE);
      return;
    }
    try {
      setEntitlements(await api.entitlements(current.token));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not load your plan.',
      );
    }
  }, []);

  // Ask the server for the plan whenever the signed-in user changes.
  const userId = session?.user.id;
  useEffect(() => {
    setMessage(null);
    refresh();
  }, [userId, refresh]);

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
    const current = sessionRef.current;
    if (!product || !current) {
      return;
    }
    setMessage(null);
    setPurchasing(true);
    try {
      await subscriptionService.purchaseProMonthly(current.user.id);
      // The result arrives in onPurchase / onError above.
    } catch (error) {
      subscriptionService.logIapError('requestPurchase failed', error);
      setPurchasing(false);
      setMessage('Could not start the purchase. Please try again.');
    }
  }, [product]);

  /** Re-sends this Apple ID's active purchases to the server (new phone, reinstall, new account). */
  const restore = useCallback(async () => {
    setMessage(null);
    setRestoring(true);
    try {
      const purchases = await subscriptionService.restoreProPurchases();
      let latest: Entitlements | null = null;
      let lastError: unknown = null;
      for (const purchase of purchases) {
        try {
          latest = (await verifyWithServer(purchase)) ?? latest;
        } catch (error) {
          lastError = error;
        }
      }
      if (latest?.plan === 'pro') {
        setEntitlements(latest);
      } else if (lastError instanceof ApiError) {
        setMessage(lastError.message);
      } else {
        await refresh();
        setMessage('No active Pro subscription found for this Apple ID.');
      }
    } catch (error) {
      subscriptionService.logIapError('restorePurchases failed', error);
      setMessage('Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [refresh, verifyWithServer]);

  return {
    plan: entitlements.plan,
    entitlements,
    product,
    productState,
    purchasing,
    restoring,
    message,
    loadProduct,
    subscribe,
    restore,
    refresh,
  };
}

async function finishSafely(purchase: Purchase) {
  try {
    await subscriptionService.finishPurchase(purchase);
  } catch (error) {
    subscriptionService.logIapError('finishTransaction failed', error);
  }
}

export type SubscriptionController = ReturnType<typeof useSubscription>;
