import { createApp } from './app';
import { createAppleVerifier } from './apple';
import { loadConfig } from './config';
import { PrismaStore } from './prismaStore';

const config = loadConfig();

const store = new PrismaStore(config.DATABASE_URL);
const apple = createAppleVerifier({
  bundleId: config.APPLE_BUNDLE_ID,
  appAppleId: config.APPLE_APP_APPLE_ID,
  rootCertsDir: config.APPLE_ROOT_CERTS_DIR,
  allowXcode: config.ALLOW_XCODE_TRANSACTIONS,
});

const app = createApp({
  store,
  apple,
  jwtSecret: config.JWT_SECRET,
  proProductIds: config.PRO_PRODUCT_IDS,
});

app.listen(config.PORT, () => {
  console.log(`Eazee server listening on http://localhost:${config.PORT}`);
  if (config.ALLOW_XCODE_TRANSACTIONS) {
    console.warn(
      'ALLOW_XCODE_TRANSACTIONS=true: unsigned Xcode test purchases are accepted. Turn off in production.',
    );
  }
});
