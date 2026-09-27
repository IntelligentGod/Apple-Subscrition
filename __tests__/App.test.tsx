/**
 * Flow test with react-native-iap mocked at the module boundary.
 * The real purchase is only exercised on device against the StoreKit Sandbox.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import * as IAP from 'react-native-iap';

import App from '../App';
import { PRO_MONTHLY_PRODUCT_ID } from '../src/constants/subscriptions';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
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

const press = async (r: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const button = r.root.find(
    n => n.props.accessibilityRole === 'button' && allChildren(n).includes(label),
  );
  await act(async () => button.props.onPress());
};

const allChildren = (n: ReactTestRenderer.ReactTestInstance): string =>
  n.children
    .map(c => (typeof c === 'string' ? c : allChildren(c)))
    .join('');

test('purchase flow: FREE → paywall with StoreKit price → PRO', async () => {
  mocked.fetchProducts.mockResolvedValue([storeKitProduct] as never);

  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  expect(allText(r)).toContain('FREE');

  await press(r, 'Upgrade to Pro');
  expect(allText(r)).toContain('4,99 €');
  expect(allText(r)).not.toContain('$5');
  expect(mocked.fetchProducts).toHaveBeenCalledWith({
    skus: [PRO_MONTHLY_PRODUCT_ID],
    type: 'subs',
  });

  await press(r, 'Subscribe');
  expect(mocked.requestPurchase).toHaveBeenCalledWith({
    request: { apple: { sku: PRO_MONTHLY_PRODUCT_ID } },
    type: 'subs',
  });

  const purchase = {
    productId: PRO_MONTHLY_PRODUCT_ID,
    purchaseState: 'purchased',
  };
  await act(async () => mocked.__listeners.purchase(purchase));

  expect(mocked.finishTransaction).toHaveBeenCalledWith({
    purchase,
    isConsumable: false,
  });
  expect(allText(r)).toContain('PRO ✓');
});

test('shows an error when StoreKit does not return the product', async () => {
  mocked.fetchProducts.mockResolvedValue([] as never);
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  await press(r, 'Upgrade to Pro');

  expect(allText(r)).toContain('Subscription product could not be loaded.');
});
