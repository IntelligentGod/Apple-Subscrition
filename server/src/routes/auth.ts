import { Router } from 'express';
import { z } from 'zod';

import {
  checkPassword,
  hashPassword,
  publicUser,
  requireAuth,
  signToken,
} from '../lib/auth';
import { EmailTakenError, type Store } from '../store';

const credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Enter a valid email' })),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function authRoutes(store: Store, jwtSecret: string) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const body = credentials.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.issues[0].message });
      return;
    }
    try {
      const user = await store.createUser(
        body.data.email,
        await hashPassword(body.data.password),
      );
      res
        .status(201)
        .json({ token: signToken(user.id, jwtSecret), user: publicUser(user) });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  router.post('/login', async (req, res) => {
    const body = credentials.safeParse(req.body);
    const user = body.success
      ? await store.findUserByEmail(body.data.email)
      : null;
    if (
      !body.success ||
      !user ||
      !(await checkPassword(body.data.password, user.passwordHash))
    ) {
      res.status(401).json({ error: 'Wrong email or password' });
      return;
    }
    res.json({ token: signToken(user.id, jwtSecret), user: publicUser(user) });
  });

  router.get('/me', requireAuth(store, jwtSecret), (req, res) => {
    res.json({ user: publicUser(req.user!) });
  });

  return router;
}
