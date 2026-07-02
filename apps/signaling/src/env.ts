import { config } from 'dotenv';
import { z } from 'zod';

// Load this service's local .env when running locally. In production, real env vars win.
config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SIGNALING_HOST: z.string().default('0.0.0.0'),
  SIGNALING_PORT: z.coerce.number().int().positive().default(4001),
  /** Comma-separated allowlist of browser origins permitted to connect. */
  SIGNALING_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid signaling environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.SIGNALING_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
