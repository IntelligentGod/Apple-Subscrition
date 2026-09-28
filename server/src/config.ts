import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', ''])
  .default('false')
  .transform(v => v === 'true');

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  APPLE_BUNDLE_ID: z.string().min(1),
  PRO_PRODUCT_IDS: z
    .string()
    .min(1)
    .transform(v => v.split(',').map(s => s.trim()).filter(Boolean)),
  APPLE_APP_APPLE_ID: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : undefined)),
  APPLE_ROOT_CERTS_DIR: z.string().default('./certs'),
  ALLOW_XCODE_TRANSACTIONS: bool,
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment (see .env.example):\n${problems}`);
  }
  return parsed.data;
}
