import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from './generated/prisma/client';
import type { SubscriptionStatus } from './lib/entitlement';
import {
  EmailTakenError,
  type Store,
  type Subscription,
  type SubscriptionInput,
} from './store';

/** PostgreSQL implementation of Store, using Prisma. */
export class PrismaStore implements Store {
  readonly db: PrismaClient;

  constructor(databaseUrl: string) {
    this.db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  async createUser(email: string, passwordHash: string) {
    try {
      return await this.db.user.create({ data: { email, passwordHash } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' // unique constraint
      ) {
        throw new EmailTakenError();
      }
      throw error;
    }
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    // Postgres rejects non-UUID strings for a uuid column; treat them as "not found".
    if (!UUID.test(id)) {
      return null;
    }
    return this.db.user.findUnique({ where: { id } });
  }

  async findSubscription(originalTransactionId: string) {
    const row = await this.db.subscription.findUnique({
      where: { originalTransactionId },
    });
    return row && toSubscription(row);
  }

  async listSubscriptions(userId: string) {
    const rows = await this.db.subscription.findMany({ where: { userId } });
    return rows.map(toSubscription);
  }

  async saveSubscription(input: SubscriptionInput) {
    const row = await this.db.subscription.upsert({
      where: { originalTransactionId: input.originalTransactionId },
      create: input,
      update: input,
    });
    return toSubscription(row);
  }

  async hasNotification(notificationUUID: string) {
    const row = await this.db.appleNotification.findUnique({
      where: { notificationUUID },
    });
    return row !== null;
  }

  async recordNotification(record: {
    notificationUUID: string;
    notificationType: string;
    subtype: string | null;
    originalTransactionId: string | null;
  }) {
    await this.db.appleNotification.upsert({
      where: { notificationUUID: record.notificationUUID },
      create: record,
      update: {},
    });
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toSubscription = (row: Omit<Subscription, 'status'> & { status: string }) =>
  ({ ...row, status: row.status as SubscriptionStatus }) satisfies Subscription;
