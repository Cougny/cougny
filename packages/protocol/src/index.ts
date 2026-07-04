/** Public surface of the shared Cougny protocol package. */
export const PROTOCOL_VERSION = '1' as const;

/**
 * Versioned path for the signaling WebSocket endpoint. Both the client and
 * the signaling server derive it from PROTOCOL_VERSION, so a breaking wire
 * change bumps the version in one place and old clients are rejected at the
 * handshake instead of failing mid-call.
 */
export const SIGNALING_PATH = `/v${PROTOCOL_VERSION}` as const;

export * from './signaling.js';
export * from './ice.js';
export * from './rest.js';
