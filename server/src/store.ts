import { randomUUID } from 'node:crypto';

import type { SubscriptionStatus } from './lib/entitlement';

/**
 * Everything the API needs from the database. The real implementation is
 * PrismaStore (prismaStore.ts); tests use MemoryStore below.
 */

export interface User {
  /** UUID — also sent to StoreKit as `appAccountToken` to link purchases to this user. */
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface Subscription {
  originalTransactionId: string;
  userId: string;
  productId: string;
  environment: string;
  status: SubscriptionStatus;
  expiresAt: Date | null;
  lastTransactionId: string;
  updatedAt: Date;
}

export type SubscriptionInput = Omit<Subscription, 'updatedAt'>;

export interface Store {
  createUser(email: string, passwordHash: string): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;

  findSubscription(originalTransactionId: string): Promise<Subscription | null>;
  listSubscriptions(userId: string): Promise<Subscription[]>;
  saveSubscription(input: SubscriptionInput): Promise<Subscription>;

  /** App Store Server Notifications can be delivered more than once. */
  hasNotification(notificationUUID: string): Promise<boolean>;
  recordNotification(record: {
    notificationUUID: string;
    notificationType: string;
    subtype: string | null;
    originalTransactionId: string | null;
  }): Promise<void>;
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email is already registered');
  }
}

export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private subscriptions = new Map<string, Subscription>();
  private notifications = new Set<string>();

  async createUser(email: string, passwordHash: string) {
    if (await this.findUserByEmail(email)) {
      throw new EmailTakenError();
    }
    const user = { id: randomUUID(), email, passwordHash, createdAt: new Date() };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email) ?? null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async findSubscription(originalTransactionId: string) {
    return this.subscriptions.get(originalTransactionId) ?? null;
  }

  async listSubscriptions(userId: string) {
    return [...this.subscriptions.values()].filter(s => s.userId === userId);
  }

  async saveSubscription(input: SubscriptionInput) {
    const sub = { ...input, updatedAt: new Date() };
    this.subscriptions.set(sub.originalTransactionId, sub);
    return sub;
  }

  async hasNotification(notificationUUID: string) {
    return this.notifications.has(notificationUUID);
  }

  async recordNotification(record: { notificationUUID: string }) {
    this.notifications.add(record.notificationUUID);
  }
}
