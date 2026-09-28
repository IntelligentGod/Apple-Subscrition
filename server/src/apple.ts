import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';

import type {
  NotificationContext,
  VerifiedTransaction,
} from './lib/entitlement';

export interface VerifiedNotification extends NotificationContext {
  notificationUUID: string;
  transaction: VerifiedTransaction | null;
}

/** Checks Apple's signatures. Faked in tests. */
export interface AppleVerifier {
  verifyTransaction(signedTransaction: string): Promise<VerifiedTransaction>;
  verifyNotification(signedPayload: string): Promise<VerifiedNotification>;
}

interface Options {
  bundleId: string;
  appAppleId?: number;
  rootCertsDir: string;
  allowXcode: boolean;
}

/**
 * Real verifier built on Apple's official library. It checks the certificate
 * chain up to Apple's root CA, the bundle ID, and the environment.
 *
 * Transactions from Xcode's local .storekit testing are signed by Xcode, not
 * Apple, so they can only be accepted without verification — `allowXcode`
 * must stay false in production.
 */
export function createAppleVerifier({
  bundleId,
  appAppleId,
  rootCertsDir,
  allowXcode,
}: Options): AppleVerifier {
  const rootCerts = loadRootCertificates(rootCertsDir);
  const verifiers = new Map<string, SignedDataVerifier>();

  const verifierFor = (environment: string | undefined) => {
    const env = Object.values(Environment).find(e => e === environment);
    if (!env) {
      throw new Error(`Unknown environment "${environment}"`);
    }
    if (env === Environment.XCODE || env === Environment.LOCAL_TESTING) {
      if (!allowXcode) {
        throw new Error(
          'Xcode StoreKit test transactions are disabled (ALLOW_XCODE_TRANSACTIONS)',
        );
      }
    } else if (rootCerts.length === 0) {
      throw new Error(`No Apple root certificates found in ${rootCertsDir}`);
    }
    if (env === Environment.PRODUCTION && appAppleId === undefined) {
      throw new Error('APPLE_APP_APPLE_ID is required for Production');
    }
    let verifier = verifiers.get(env);
    if (!verifier) {
      // enableOnlineChecks: also check certificate revocation with Apple.
      verifier = new SignedDataVerifier(rootCerts, true, env, bundleId, appAppleId);
      verifiers.set(env, verifier);
    }
    return verifier;
  };

  return {
    async verifyTransaction(signedTransaction) {
      // Read the (not yet trusted) environment to pick the right verifier;
      // the verifier then checks the signature and that the environment matches.
      const claimed = peekPayload(signedTransaction).environment;
      const decoded =
        await verifierFor(claimed).verifyAndDecodeTransaction(signedTransaction);
      return toVerifiedTransaction(decoded);
    },

    async verifyNotification(signedPayload) {
      const peek = peekPayload(signedPayload);
      const claimed = peek.data?.environment ?? peek.summary?.environment;
      const verifier = verifierFor(claimed);
      const decoded = await verifier.verifyAndDecodeNotification(signedPayload);
      if (!decoded.notificationUUID || !decoded.notificationType) {
        throw new Error('Notification is missing notificationUUID/notificationType');
      }

      const signedTx = decoded.data?.signedTransactionInfo;
      const signedRenewal = decoded.data?.signedRenewalInfo;
      const transaction = signedTx
        ? toVerifiedTransaction(await verifier.verifyAndDecodeTransaction(signedTx))
        : null;
      const renewal = signedRenewal
        ? await verifier.verifyAndDecodeRenewalInfo(signedRenewal)
        : null;

      return {
        notificationUUID: decoded.notificationUUID,
        notificationType: decoded.notificationType,
        subtype: decoded.subtype ?? null,
        gracePeriodExpiresDate: toDate(renewal?.gracePeriodExpiresDate),
        transaction,
      };
    },
  };
}

function toVerifiedTransaction(decoded: {
  environment?: string;
  bundleId?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  appAccountToken?: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
}): VerifiedTransaction {
  const { environment, bundleId, productId, transactionId, originalTransactionId } =
    decoded;
  if (!environment || !bundleId || !productId || !transactionId || !originalTransactionId) {
    throw new Error('Transaction is missing required fields');
  }
  return {
    environment,
    bundleId,
    productId,
    transactionId,
    originalTransactionId,
    appAccountToken: decoded.appAccountToken ?? null,
    purchaseDate: toDate(decoded.purchaseDate),
    expiresDate: toDate(decoded.expiresDate),
    revocationDate: toDate(decoded.revocationDate),
  };
}

const toDate = (ms: number | undefined) => (ms ? new Date(ms) : null);

interface PeekedPayload {
  environment?: string;
  data?: { environment?: string };
  summary?: { environment?: string };
}

/** Decodes a JWS payload WITHOUT verifying it. Only used to choose a verifier. */
function peekPayload(jws: string): PeekedPayload {
  const payload = jws.split('.')[1];
  if (!payload) {
    throw new Error('Not a JWS');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function loadRootCertificates(dir: string): Buffer[] {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.cer'))
      .map(f => readFileSync(path.join(dir, f)));
  } catch {
    return [];
  }
}
