import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` (run on npm install) doesn't need a database; migrations do.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
