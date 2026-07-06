import { createSignalingServer } from './server.js';
import { logger } from './logger.js';

const server = createSignalingServer();
server.start().catch((err: unknown) => {
  logger.error({ err }, 'failed to start signaling server');
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down signaling server');
    server
      .stop()
      .then(() => process.exit(0))
      .catch((err) => {
        logger.error({ err }, 'error during shutdown');
        process.exit(1);
      });
  });
}
