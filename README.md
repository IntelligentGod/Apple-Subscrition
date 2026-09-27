# Eazee AI — StoreKit Sandbox subscription demo

React Native 0.87 + TypeScript demo of a real auto-renewable subscription purchase
through Apple StoreKit (Sandbox), using `react-native-iap` 16 (Nitro / OpenIAP API).

| | |
|---|---|
| Bundle ID | `com.eazee.ai` |
| Product ID | `com.eazee.subscription.pro.monthly` (see `src/constants/subscriptions.ts`) |
| Price | Always taken from StoreKit's `displayPrice`, never hardcoded |

## Structure

```
App.tsx                          screen switching (home / paywall / pro)
src/services/subscriptionService.ts   all react-native-iap calls
src/hooks/useSubscription.ts     app-level StoreKit state + purchase listeners
src/screens/                     HomeScreen, PaywallScreen, ProScreen
src/components/                  PrimaryButton, PlanCard
src/constants/                   product ID, colors
src/types/subscription.ts
```

Flow: `initConnection` → `fetchProducts({ skus, type: 'subs' })` → verify the returned ID →
`requestPurchase({ request: { apple: { sku } }, type: 'subs' })` → `purchaseUpdatedListener`
→ grant Pro → `finishTransaction({ isConsumable: false })`.
On launch and on **Restore Purchases**, entitlement is read from `getAvailablePurchases`.

Out of scope by design: no server-side receipt validation; entitlement is trusted on device.

## Run on a physical iPhone (macOS required)

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..
open ios/EazeeAI.xcworkspace
```

In Xcode, target **EazeeAI → Signing & Capabilities**:
1. Select your Team (the bundle ID is already `com.eazee.ai`).
2. **+ Capability → In-App Purchase**.
3. In **Product → Scheme → Edit Scheme → Run → Options**, make sure *StoreKit Configuration* is **None**
   (a local `.storekit` file would bypass the Sandbox).

Then run on the device (`npm start` + ▶ in Xcode, or `npx react-native run-ios --device`).

## Run on the Simulator (local StoreKit testing)

The Simulator can't reliably load Sandbox products, so `fetchProducts` returns an empty list there.
Use the bundled local configuration instead:

1. In Xcode, **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration** → `Products.storekit`
   (if it isn't listed, drag `ios/EazeeAI/Products.storekit` into the project navigator first — no target membership needed).
2. Run from Xcode (▶). Purchases are simulated locally; manage them in **Debug → StoreKit → Manage Transactions**.

Set it back to **None** before testing against the real Sandbox on a device.

## Sandbox account

On the iPhone: **Settings → App Store → Sandbox Account** (iOS 18+; on older iOS:
**Settings → Developer → Sandbox Apple Account**) and sign in with the sandbox tester.
Enter the password only there, or in the StoreKit sheet if it prompts; never put it in the project.
If you're not signed in, iOS asks for sandbox credentials when you tap Subscribe.

## App Store Connect checklist if the product doesn't load

- Paid Applications agreement is active (Agreements, Tax, and Banking).
- The subscription has a name, price, duration, and localization, and its status is *Ready to Submit* or later.
- The subscription is in a subscription group, and the group has a localization.
- The app record uses bundle ID `com.eazee.ai`.
- Newly created products can take a while to propagate to the Sandbox.

In dev builds, the console logs the expected and returned product IDs when loading fails.

Sandbox monthly subscriptions renew about every 5 minutes. Manage or cancel them in
**Settings → App Store → Sandbox Account → Manage**.

## Checks

```sh
npx tsc --noEmit && npx eslint . && npx jest
```
