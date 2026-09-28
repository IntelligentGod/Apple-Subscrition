import { Router, type NextFunction, type Request, type Response } from 'express';

import { requireAuth } from '../lib/auth';
import { getEntitlements } from '../lib/userEntitlements';
import type { Store } from '../store';

export function meRoutes(store: Store, jwtSecret: string) {
  const router = Router();
  router.use(requireAuth(store, jwtSecret));

  router.get('/entitlements', async (req, res) => {
    res.json(await getEntitlements(store, req.user!.id));
  });

  return router;
}

/** Put in front of any Pro-only endpoint. Must run after requireAuth. */
export function requirePro(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { plan } = await getEntitlements(store, req.user!.id);
    if (plan !== 'pro') {
      res.status(403).json({ error: 'Pro subscription required' });
      return;
    }
    next();
  };
}

/** Example of a feature only Pro users can call. Replace with your real Pro features. */
export function proRoutes(store: Store, jwtSecret: string) {
  const router = Router();
  router.use(requireAuth(store, jwtSecret), requirePro(store));

  router.get('/content', (req, res) => {
    res.json({
      message: `Welcome to Pro, ${req.user!.email}!`,
      features: ['Unlimited access', 'Premium features', 'Priority support'],
    });
  });

  return router;
}
