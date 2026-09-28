import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { Store, User } from '../store';

const TOKEN_TTL = '30d';

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

export const checkPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export function signToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: TOKEN_TTL });
}

/** Safe to send to the app — never includes the password hash. */
export function publicUser(user: User) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Requires `Authorization: Bearer <token>` and loads `req.user`. */
export function requireAuth(store: Store, secret: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    let userId: string | undefined;
    try {
      userId = jwt.verify(token, secret).sub as string | undefined;
    } catch {
      // expired or tampered token
    }
    const user = userId ? await store.findUserById(userId) : null;
    if (!user) {
      res.status(401).json({ error: 'Session expired, please sign in again' });
      return;
    }
    req.user = user;
    next();
  };
}
