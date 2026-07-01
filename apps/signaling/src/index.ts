import { createSignalingServer } from './server.js';
import { logger } from './logger.js';

const server = createSignalingServer();
server.start();

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
