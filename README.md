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
App.tsx                          screen switching (login / home / paywall / pro)
src/services/subscriptionService.ts   all react-native-iap calls
src/services/api.ts              all backend calls
src/hooks/useAuth.ts             sign in / sign up / saved session
src/hooks/useSubscription.ts     StoreKit purchases + plan from the server
src/screens/                     LoginScreen, HomeScreen, PaywallScreen, ProScreen
src/components/                  PrimaryButton, PlanCard
src/constants/                   product ID, API URL, colors
server/                          backend (Express + PostgreSQL) — see server/README.md
```

Flow: sign in → `fetchProducts` → `requestPurchase({ request: { apple: { sku, appAccountToken: userId } } })`
→ `purchaseUpdatedListener` → send the signed transaction to `POST /iap/verify` → the server verifies
Apple's signature and saves it → plan comes back from the server → `finishTransaction`.
The plan is always read from the server (`GET /me/entitlements`), which Apple keeps up to date
via App Store Server Notifications (renewals, expiry, refunds).

## Run the backend first

The app needs the server running. On your Mac (Docker Desktop required for PostgreSQL):

```sh
cd server
npm install
cp .env.example .env     # set JWT_SECRET (openssl rand -hex 32)
docker compose up -d
npm run db:migrate
npm run dev              # http://localhost:3000
```

The Simulator reaches it at `localhost`. On a physical iPhone, put your Mac's LAN IP in
`src/constants/api.ts`. Full details: [server/README.md](server/README.md).

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
cd server && npm test && npm run typecheck
```
