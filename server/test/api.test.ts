import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppleVerifier, VerifiedNotification } from '../src/apple';
import { createApp } from '../src/app';
import type { VerifiedTransaction } from '../src/lib/entitlement';
import { MemoryStore } from '../src/store';

const PRODUCT = 'com.eazee.subscription.pro.monthly';
const DAY = 24 * 60 * 60 * 1000;

/** "Signed" payloads in tests are just `ok:` + JSON; anything else fails verification. */
const fakeApple: AppleVerifier = {
  async verifyTransaction(jws) {
    if (!jws.startsWith('ok:')) {
      throw new Error('bad signature');
    }
    return JSON.parse(jws.slice(3), reviveDates) as VerifiedTransaction;
  },
  async verifyNotification(jws) {
    if (!jws.startsWith('ok:')) {
      throw new Error('bad signature');
    }
    return JSON.parse(jws.slice(3), reviveDates) as VerifiedNotification;
  },
};

function reviveDates(key: string, value: unknown) {
  return typeof value === 'string' && key.endsWith('Date') ? new Date(value) : value;
}

const sign = (payload: object) => `ok:${JSON.stringify(payload)}`;

const transaction = (
  overrides: Partial<VerifiedTransaction> = {},
): VerifiedTransaction => ({
  environment: 'Sandbox',
  bundleId: 'com.eazee.ai',
  productId: PRODUCT,
  transactionId: 't1',
  originalTransactionId: 'orig-1',
  appAccountToken: null,
  purchaseDate: new Date(),
  expiresDate: new Date(Date.now() + 30 * DAY),
  revocationDate: null,
  ...overrides,
});

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = new MemoryStore();
  app = createApp({
    store,
    apple: fakeApple,
    jwtSecret: 'test-secret-at-least-16',
    proProductIds: [PRODUCT],
  });
});

async function signUp(email = 'ana@example.com') {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body as { token: string; user: { id: string } };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('auth', () => {
  it('registers, logs in, and returns the current user', async () => {
    const { user } = await signUp('Ana@Example.com');
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/auth/me').set(auth(login.body.token));
    expect(me.body.user).toMatchObject({ id: user.id, email: 'ana@example.com' });
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate emails, wrong passwords and missing tokens', async () => {
    await signUp();
    expect(
      (await request(app).post('/auth/register').send({ email: 'ana@example.com', password: 'password123' })).status,
    ).toBe(409);
    expect(
      (await request(app).post('/auth/login').send({ email: 'ana@example.com', password: 'wrong-pass' })).status,
    ).toBe(401);
    expect((await request(app).get('/me/entitlements')).status).toBe(401);
  });
});

describe('purchase verification', () => {
  it('free user → verify purchase → pro, and Pro-only API unlocks', async () => {
    const { token, user } = await signUp();

    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('free');
    expect((await request(app).get('/pro/content').set(auth(token))).status).toBe(403);

    const verify = await request(app)
      .post('/iap/verify')
      .set(auth(token))
      .send({ signedTransaction: sign(transaction({ appAccountToken: user.id })) });
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ plan: 'pro', status: 'active', environment: 'Sandbox' });

    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('pro');
    expect((await request(app).get('/pro/content').set(auth(token))).status).toBe(200);
  });

  it('rejects forged transactions and unknown products', async () => {
    const { token } = await signUp();
    const forged = await request(app)
      .post('/iap/verify')
      .set(auth(token))
      .send({ signedTransaction: 'eyJhbGciOi.forged.jws' });
    expect(forged.status).toBe(400);

    const other = await request(app)
      .post('/iap/verify')
      .set(auth(token))
      .send({ signedTransaction: sign(transaction({ productId: 'com.other.product' })) });
    expect(other.status).toBe(400);
  });

  it('does not let one account claim another account\'s purchase', async () => {
    const ana = await signUp('ana@example.com');
    const bob = await signUp('bob@example.com');

    const wrongToken = await request(app)
      .post('/iap/verify')
      .set(auth(bob.token))
      .send({ signedTransaction: sign(transaction({ appAccountToken: ana.user.id })) });
    expect(wrongToken.status).toBe(403);

    await request(app)
      .post('/iap/verify')
      .set(auth(ana.token))
      .send({ signedTransaction: sign(transaction()) });
    const claimed = await request(app)
      .post('/iap/verify')
      .set(auth(bob.token))
      .send({ signedTransaction: sign(transaction()) });
    expect(claimed.status).toBe(409);
  });

  it('an expired transaction gives no access', async () => {
    const { token } = await signUp();
    const res = await request(app)
      .post('/iap/verify')
      .set(auth(token))
      .send({ signedTransaction: sign(transaction({ expiresDate: new Date(Date.now() - DAY) })) });
    expect(res.body).toMatchObject({ plan: 'free', status: 'expired' });
  });
});

describe('Apple server notifications', () => {
  async function proUser() {
    const { token, user } = await signUp();
    await request(app)
      .post('/iap/verify')
      .set(auth(token))
      .send({ signedTransaction: sign(transaction({ appAccountToken: user.id })) });
    return { token, user };
  }

  const notify = (n: Partial<VerifiedNotification>) =>
    request(app)
      .post('/iap/apple-notifications')
      .send({
        signedPayload: sign({
          notificationUUID: crypto.randomUUID(),
          notificationType: 'DID_RENEW',
          subtype: null,
          gracePeriodExpiresDate: null,
          transaction: transaction(),
          ...n,
        }),
      });

  it('REFUND removes Pro', async () => {
    const { token } = await proUser();
    expect((await notify({ notificationType: 'REFUND' })).status).toBe(200);
    const ent = await request(app).get('/me/entitlements').set(auth(token));
    expect(ent.body).toMatchObject({ plan: 'free', status: 'revoked' });
  });

  it('EXPIRED removes Pro; a later DID_RENEW restores it', async () => {
    const { token } = await proUser();
    await notify({ notificationType: 'EXPIRED', transaction: transaction({ expiresDate: new Date(Date.now() - 1000) }) });
    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('free');

    await notify({ notificationType: 'DID_RENEW', transaction: transaction({ transactionId: 't2' }) });
    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('pro');
  });

  it('billing grace period keeps Pro until the grace period ends', async () => {
    const { token } = await proUser();
    await notify({
      notificationType: 'DID_FAIL_TO_RENEW',
      subtype: 'GRACE_PERIOD',
      gracePeriodExpiresDate: new Date(Date.now() + 3 * DAY),
      transaction: transaction({ expiresDate: new Date(Date.now() - 1000) }),
    });
    expect((await request(app).get('/me/entitlements').set(auth(token))).body).toMatchObject({
      plan: 'pro',
      status: 'grace_period',
    });
  });

  it('links a subscription the app never reported, via appAccountToken', async () => {
    const { token, user } = await signUp();
    await notify({
      notificationType: 'SUBSCRIBED',
      transaction: transaction({ originalTransactionId: 'orig-9', appAccountToken: user.id.toUpperCase() }),
    });
    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('pro');
  });

  it('ignores duplicates and rejects forged payloads', async () => {
    const { token } = await proUser();
    const uuid = crypto.randomUUID();
    await notify({ notificationUUID: uuid, notificationType: 'DID_RENEW' });
    // Same UUID delivered again with different content must be ignored.
    expect((await notify({ notificationUUID: uuid, notificationType: 'REFUND' })).status).toBe(200);
    expect((await request(app).get('/me/entitlements').set(auth(token))).body.plan).toBe('pro');

    const forged = await request(app)
      .post('/iap/apple-notifications')
      .send({ signedPayload: 'forged' });
    expect(forged.status).toBe(400);
  });
});
