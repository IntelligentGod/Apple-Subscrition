/**
 * Flow test with react-native-iap and the backend (fetch) mocked at the module boundary.
 * The real purchase is only exercised on device against StoreKit; the real
 * server has its own tests in server/test.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactTestRenderer, { act } from 'react-test-renderer';
import * as IAP from 'react-native-iap';

import App from '../App';
import { PRO_MONTHLY_PRODUCT_ID } from '../src/constants/subscriptions';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('react-native-iap', () => {
  const listeners: { purchase?: (p: unknown) => void } = {};
  return {
    __listeners: listeners,
    ErrorCode: { UserCancelled: 'user-cancelled' },
    initConnection: jest.fn(async () => true),
    endConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(),
    getAvailablePurchases: jest.fn(async () => []),
    restorePurchases: jest.fn(async () => {}),
    requestPurchase: jest.fn(async () => null),
    finishTransaction: jest.fn(async () => {}),
    purchaseUpdatedListener: jest.fn(cb => {
      listeners.purchase = cb;
      return { remove: jest.fn() };
    }),
    purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  };
});

const mocked = IAP as unknown as jest.Mocked<typeof IAP> & {
  __listeners: { purchase: (p: unknown) => void };
};

const USER = {
  id: '6f1c0a52-3b7e-4c1e-9a55-2d0f5f3b8e11',
  email: 'ana@example.com',
};
const FREE = {
  plan: 'free',
  status: null,
  productId: null,
  expiresAt: null,
  environment: null,
};
const PRO = {
  plan: 'pro',
  status: 'active',
  productId: PRO_MONTHLY_PRODUCT_ID,
  expiresAt: '2026-10-28T00:00:00.000Z',
  environment: 'Sandbox',
};

/** Minimal fake backend: route → [status, body]. */
let routes: Record<string, [number, unknown]>;
const fetchMock = jest.fn(async (url: string, init?: { method?: string }) => {
  const key = `${init?.method ?? 'GET'} ${url.replace(
    /^https?:\/\/[^/]+/,
    '',
  )}`;
  const [status, body] = routes[key] ?? [404, { error: `No mock for ${key}` }];
  return { ok: status < 400, status, json: async () => body } as Response;
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  routes = {
    'POST /auth/login': [200, { token: 'jwt-token', user: USER }],
    'GET /me/entitlements': [200, FREE],
    'POST /iap/verify': [200, PRO],
  };
});

const storeKitProduct = {
  id: PRO_MONTHLY_PRODUCT_ID,
  type: 'subs',
  platform: 'ios',
  title: 'Pro Monthly',
  displayName: 'Pro Monthly',
  displayPrice: '4,99 €',
  subscriptionPeriodUnitIOS: 'month',
};

const allText = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .flatMap(n => n.children)
    .join(' ');

const allChildren = (n: ReactTestRenderer.ReactTestInstance): string =>
  n.children.map(c => (typeof c === 'string' ? c : allChildren(c))).join('');

const press = async (r: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const button = r.root.find(
    n => n.props.accessibilityRole === 'button' && allChildren(n) === label,
  );
  await act(async () => button.props.onPress());
};

const type = async (
  r: ReactTestRenderer.ReactTestRenderer,
  label: string,
  text: string,
) => {
  const input = r.root.find(
    n => n.props.accessibilityLabel === label && n.props.onChangeText,
  );
  await act(async () => input.props.onChangeText(text));
};

async function renderSignedIn() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  expect(allText(r)).toContain('Sign in to your account');
  await type(r, 'Email', USER.email);
  await type(r, 'Password', 'password123');
  await press(r, 'Sign In');
  return r;
}

test('sign in → FREE → paywall → purchase verified by server → PRO', async () => {
  mocked.fetchProducts.mockResolvedValue([storeKitProduct] as never);

  const r = await renderSignedIn();
  expect(allText(r)).toContain('FREE');
  expect(allText(r)).toContain(USER.email);

  await press(r, 'Upgrade to Pro');
  expect(allText(r)).toContain('4,99 €');

  await press(r, 'Subscribe');
  expect(mocked.requestPurchase).toHaveBeenCalledWith({
    request: {
      apple: { sku: PRO_MONTHLY_PRODUCT_ID, appAccountToken: USER.id },
    },
    type: 'subs',
  });

  const purchase = {
    productId: PRO_MONTHLY_PRODUCT_ID,
    purchaseState: 'purchased',
    purchaseToken: 'signed-jws',
  };
  await act(async () => mocked.__listeners.purchase(purchase));

  const verifyCall = fetchMock.mock.calls.find(([url]) =>
    url.endsWith('/iap/verify'),
  );
  expect(JSON.parse((verifyCall![1] as { body: string }).body)).toEqual({
    signedTransaction: 'signed-jws',
  });
  expect(mocked.finishTransaction).toHaveBeenCalledWith({
    purchase,
    isConsumable: false,
  });
  expect(allText(r)).toContain('PRO ✓');
});

test('does not grant Pro or finish the transaction when the server is unreachable', async () => {
  mocked.fetchProducts.mockResolvedValue([storeKitProduct] as never);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const r = await renderSignedIn();
  await press(r, 'Upgrade to Pro');

  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await act(async () =>
    mocked.__listeners.purchase({
      productId: PRO_MONTHLY_PRODUCT_ID,
      purchaseState: 'purchased',
      purchaseToken: 'signed-jws',
    }),
  );

  expect(mocked.finishTransaction).not.toHaveBeenCalled();
  expect(allText(r)).toContain('Cannot reach the server');
  expect(allText(r)).not.toContain('PRO ✓');
});

test('shows an error when StoreKit does not return the product', async () => {
  mocked.fetchProducts.mockResolvedValue([] as never);
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  const r = await renderSignedIn();
  await press(r, 'Upgrade to Pro');

  expect(allText(r)).toContain('Subscription product could not be loaded.');
});

test('shows the server error when sign-in fails', async () => {
  routes['POST /auth/login'] = [401, { error: 'Wrong email or password' }];
  const r = await renderSignedIn();
  expect(allText(r)).toContain('Wrong email or password');
});
