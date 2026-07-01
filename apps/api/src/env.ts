import { config } from 'dotenv';
import { z } from 'zod';

config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  AUTH_JWT_SECRET: z.string().min(16, 'AUTH_JWT_SECRET must be at least 16 characters'),

  // WebRTC ICE.
  STUN_URL: z.string().default('stun:localhost:3478'),
  TURN_URL: z.string().default('turn:localhost:3478'),
  TURN_STATIC_AUTH_SECRET: z.string().min(8),
  TURN_CREDENTIAL_TTL: z.coerce.number().int().positive().default(86_400),

  // Browser origins allowed to call the API.
  SIGNALING_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.SIGNALING_ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
