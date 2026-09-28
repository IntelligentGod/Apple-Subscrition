import { Router } from 'express';
import { z } from 'zod';

import type { AppleVerifier } from '../apple';
import { requireAuth } from '../lib/auth';
import { subscriptionState } from '../lib/entitlement';
import { getEntitlements } from '../lib/userEntitlements';
import type { Store } from '../store';

interface Options {
  store: Store;
  apple: AppleVerifier;
  jwtSecret: string;
  proProductIds: string[];
  now?: () => Date;
}

export function iapRoutes({
  store,
  apple,
  jwtSecret,
  proProductIds,
  now = () => new Date(),
}: Options) {
  const router = Router();

  /**
   * Called by the app after a purchase or restore, with StoreKit's signed
   * transaction (JWS). Verifies it with Apple's certificates and links it to the user.
   */
  router.post('/verify', requireAuth(store, jwtSecret), async (req, res) => {
    const body = z
      .object({ signedTransaction: z.string().min(1) })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'signedTransaction is required' });
      return;
    }

    let tx;
    try {
      tx = await apple.verifyTransaction(body.data.signedTransaction);
    } catch (error) {
      console.warn('[iap] rejected transaction:', describe(error));
      res.status(400).json({ error: 'Transaction could not be verified' });
      return;
    }

    const user = req.user!;
    if (!proProductIds.includes(tx.productId)) {
      res.status(400).json({ error: `Unknown product ${tx.productId}` });
      return;
    }
    // The app passes the user's id as appAccountToken when purchasing.
    if (tx.appAccountToken && tx.appAccountToken.toLowerCase() !== user.id) {
      res
        .status(403)
        .json({ error: 'This purchase belongs to a different account' });
      return;
    }
    const existing = await store.findSubscription(tx.originalTransactionId);
    if (existing && existing.userId !== user.id) {
      res
        .status(409)
        .json({ error: 'This Apple ID subscription is linked to another account' });
      return;
    }

    const state = subscriptionState(tx, now());
    // An older transaction (e.g. from a restore) must not shorten a newer renewal.
    const isOlder =
      existing?.expiresAt &&
      state.expiresAt &&
      state.status !== 'revoked' &&
      state.expiresAt < existing.expiresAt;
    if (!isOlder) {
      await store.saveSubscription({
        originalTransactionId: tx.originalTransactionId,
        userId: user.id,
        productId: tx.productId,
        environment: tx.environment,
        status: state.status,
        expiresAt: state.expiresAt,
        lastTransactionId: tx.transactionId,
      });
    }

    res.json(await getEntitlements(store, user.id, now()));
  });

  /**
   * App Store Server Notifications V2 webhook. Set this URL in App Store Connect
   * (App → App Information → App Store Server Notifications). No login: the
   * signature on the payload proves it came from Apple.
   */
  router.post('/apple-notifications', async (req, res) => {
    const signedPayload = req.body?.signedPayload;
    if (typeof signedPayload !== 'string') {
      res.status(400).json({ error: 'signedPayload is required' });
      return;
    }

    let notification;
    try {
      notification = await apple.verifyNotification(signedPayload);
    } catch (error) {
      console.warn('[iap] rejected notification:', describe(error));
      res.status(400).json({ error: 'Notification could not be verified' });
      return;
    }

    if (await store.hasNotification(notification.notificationUUID)) {
      res.sendStatus(200); // already processed — Apple retries until it gets a 2xx
      return;
    }

    const tx = notification.transaction;
    if (tx && proProductIds.includes(tx.productId)) {
      const existing = await store.findSubscription(tx.originalTransactionId);
      // First time we hear about it (e.g. app never called /verify): link via appAccountToken.
      const userId =
        existing?.userId ??
        (tx.appAccountToken
          ? (await store.findUserById(tx.appAccountToken.toLowerCase()))?.id
          : undefined);

      if (userId) {
        const state = subscriptionState(tx, now(), notification);
        await store.saveSubscription({
          originalTransactionId: tx.originalTransactionId,
          userId,
          productId: tx.productId,
          environment: tx.environment,
          status: state.status,
          expiresAt: state.expiresAt,
          lastTransactionId: tx.transactionId,
        });
      } else {
        console.warn(
          `[iap] ${notification.notificationType} for unknown subscription ${tx.originalTransactionId}`,
        );
      }
    }

    await store.recordNotification({
      notificationUUID: notification.notificationUUID,
      notificationType: notification.notificationType,
      subtype: notification.subtype,
      originalTransactionId: tx?.originalTransactionId ?? null,
    });
    res.sendStatus(200);
  });

  return router;
}

/** Apple's VerificationException has an empty message but a numeric status. */
function describe(error: unknown) {
  const { message, status } = error as { message?: string; status?: number };
  return (
    message ||
    (status !== undefined ? `VerificationStatus ${status}` : String(error))
  );
}
