# Eazee server

Backend for the Eazee AI app: user accounts, App Store purchase verification,
and the single answer to "is this user Pro?".

Node.js + Express + PostgreSQL (Prisma) + Apple's official
[`@apple/app-store-server-library`](https://github.com/apple/app-store-server-library-node).

## How it works

```
App ── POST /auth/login ─────────────▶ Server ── token
App ── StoreKit purchase (appAccountToken = user id)
App ── POST /iap/verify {signedTransaction} ─▶ Server ── verifies Apple's signature
                                                        saves subscription → { plan: "pro" }
Apple ── POST /iap/apple-notifications ─▶ Server ── renewals / expiry / refunds
App ── GET /me/entitlements, GET /pro/content ─▶ Server decides from the database
```

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | – | `{email, password}` → `{token, user}` |
| POST | `/auth/login` | – | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | Bearer | Current user |
| GET | `/me/entitlements` | Bearer | `{plan, status, productId, expiresAt, environment}` |
| POST | `/iap/verify` | Bearer | `{signedTransaction}` (StoreKit JWS) → entitlements |
| POST | `/iap/apple-notifications` | Apple signature | App Store Server Notifications V2 |
| GET | `/pro/content` | Bearer + Pro | Example Pro-only endpoint (403 for free users) |
| GET | `/health` | – | `{ok: true}` |

Code map:

```
src/index.ts              starts the server
src/app.ts                routes + error handling
src/routes/               auth, iap (verify + Apple webhook), me/pro
src/apple.ts              Apple signature verification
src/lib/entitlement.ts    subscription rules (active / grace / expired / revoked)
src/store.ts              database interface (+ in-memory version for tests)
src/prismaStore.ts        PostgreSQL implementation
prisma/schema.prisma      tables: User, Subscription, AppleNotification
```

## Run it locally (on your Mac)

You need Node.js 22+ and Docker Desktop (for PostgreSQL).

```sh
cd server
npm install
cp .env.example .env          # then set JWT_SECRET: openssl rand -hex 32
docker compose up -d          # starts PostgreSQL
npm run db:migrate            # creates the tables
npm run dev                   # http://localhost:3000
```

Check it: `curl http://localhost:3000/health` → `{"ok":true}`.

Then run the iOS app as usual (`npm start` + ▶ in Xcode) — the app talks to
`http://localhost:3000` (see `src/constants/api.ts` in the app).

### Which purchases are accepted

| Where you test | Environment | Server setting |
|---|---|---|
| Simulator + `Products.storekit` | `Xcode` | `ALLOW_XCODE_TRANSACTIONS=true` (dev only — these aren't signed by Apple) |
| Sandbox account | `Sandbox` | Apple root certs in `certs/` (included) |
| App Store | `Production` | also set `APPLE_APP_APPLE_ID` |

## Tests

```sh
npm test         # API tests with an in-memory database and a fake Apple verifier
npm run typecheck
```

## Going live

1. Host the server with HTTPS (Render, Railway, Fly.io, a VPS…) and a managed PostgreSQL.
   Set the env vars from `.env.example`; set `ALLOW_XCODE_TRANSACTIONS=false`.
   Run `npm run build && npm run db:deploy && npm start`.
2. In the app, set the release URL in `src/constants/api.ts`.
3. App Store Connect → your app → **App Information → App Store Server Notifications**:
   set both Production and Sandbox URLs to `https://<your-server>/iap/apple-notifications`, Version 2.
