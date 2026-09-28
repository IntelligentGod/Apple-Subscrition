/**
 * Pure subscription rules — no database, no network — so they are easy to test.
 */

export type SubscriptionStatus =
  | 'active'
  | 'grace_period' // renewal failed, Apple still gives access while it retries billing
  | 'billing_retry' // renewal failed, no access
  | 'expired'
  | 'revoked'; // refunded or revoked by Apple

/** The fields we need from a verified App Store transaction. */
export interface VerifiedTransaction {
  environment: string; // "Production" | "Sandbox" | "Xcode" | "LocalTesting"
  bundleId: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  appAccountToken: string | null;
  purchaseDate: Date | null;
  expiresDate: Date | null;
  revocationDate: Date | null;
}

export interface NotificationContext {
  notificationType: string;
  subtype: string | null;
  gracePeriodExpiresDate: Date | null;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** When access ends. For a grace period this is the end of the grace period. */
  expiresAt: Date | null;
}

/**
 * Works out the subscription state from the latest transaction, optionally
 * refined by an App Store Server Notification (type/subtype).
 * See https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
 */
export function subscriptionState(
  tx: VerifiedTransaction,
  now: Date,
  notification?: NotificationContext,
): SubscriptionState {
  if (tx.revocationDate) {
    return { status: 'revoked', expiresAt: tx.revocationDate };
  }

  switch (notification?.notificationType) {
    case 'REFUND':
    case 'REVOKE':
      return { status: 'revoked', expiresAt: tx.expiresDate };
    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED':
      return { status: 'expired', expiresAt: tx.expiresDate };
    case 'DID_FAIL_TO_RENEW':
      if (notification.subtype === 'GRACE_PERIOD') {
        return {
          status: 'grace_period',
          expiresAt: notification.gracePeriodExpiresDate ?? tx.expiresDate,
        };
      }
      return { status: 'billing_retry', expiresAt: tx.expiresDate };
  }

  const active = tx.expiresDate !== null && tx.expiresDate > now;
  return { status: active ? 'active' : 'expired', expiresAt: tx.expiresDate };
}

/** True if the user should get Pro right now. Also guards against a missed EXPIRED notification. */
export function isEntitled(
  sub: { status: SubscriptionStatus | string; expiresAt: Date | null },
  now: Date,
): boolean {
  const statusGivesAccess =
    sub.status === 'active' || sub.status === 'grace_period';
  return statusGivesAccess && sub.expiresAt !== null && sub.expiresAt > now;
}
