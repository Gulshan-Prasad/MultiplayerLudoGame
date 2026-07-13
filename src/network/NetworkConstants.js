export const APP_NAME = 'ludo-multiplayer';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  POOR_CONNECTION: 'poor_connection',
};

export const NETWORK_ROLE = {
  NONE: 'none',
  HOST: 'host',
  CLIENT: 'client',
};

export const RECONNECT_TIMEOUT_MS = 120000;
export const HEARTBEAT_INTERVAL_MS = 3000;
export const HEARTBEAT_TIMEOUT_MS = 10000;

export const SYNC_STRATEGY = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
};
