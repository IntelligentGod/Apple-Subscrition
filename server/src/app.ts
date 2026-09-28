import express, { type NextFunction, type Request, type Response } from 'express';

import type { AppleVerifier } from './apple';
import { authRoutes } from './routes/auth';
import { iapRoutes } from './routes/iap';
import { meRoutes, proRoutes } from './routes/me';
import type { Store } from './store';

export interface AppDeps {
  store: Store;
  apple: AppleVerifier;
  jwtSecret: string;
  proProductIds: string[];
}

export function createApp({ store, apple, jwtSecret, proProductIds }: AppDeps) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/auth', authRoutes(store, jwtSecret));
  app.use('/me', meRoutes(store, jwtSecret));
  app.use('/iap', iapRoutes({ store, apple, jwtSecret, proProductIds }));
  app.use('/pro', proRoutes(store, jwtSecret));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  // Express 5 forwards rejected async handlers here.
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
