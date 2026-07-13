export const MESSAGE_TYPES = {
  // Room lifecycle
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ROOM_INFO: 'room_info',

  // Lobby
  READY_CHANGED: 'ready_changed',
  START_GAME_REQUEST: 'start_game_request',
  GAME_STARTED: 'game_started',

  // Game actions (client → host)
  ROLL_REQUEST: 'roll_request',
  MOVE_REQUEST: 'move_request',
  END_TURN_REQUEST: 'end_turn_request',

  // Game results (host → all)
  ROLL_RESULT: 'roll_result',
  MOVE_RESULT: 'move_result',
  TURN_CHANGED: 'turn_changed',
  GAME_STATE_SYNC: 'game_state_sync',
  FULL_STATE_SYNC: 'full_state_sync',

  // Connection
  PING: 'ping',
  PONG: 'pong',
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat_ack',

  // Recovery
  RECONNECT: 'reconnect',
  RECONNECT_ACCEPTED: 'reconnect_accepted',
  HOST_ELECTION: 'host_election',
  HOST_TRANSFER: 'host_transfer',

  // Chat
  CHAT_MESSAGE: 'chat_message',

  // Errors
  ERROR: 'error',
  REJECTED: 'rejected',
};

export const ERROR_CODES = {
  ROOM_FULL: 'room_full',
  GAME_IN_PROGRESS: 'game_in_progress',
  INVALID_MOVE: 'invalid_move',
  NOT_YOUR_TURN: 'not_your_turn',
  ROOM_NOT_FOUND: 'room_not_found',
  VERSION_MISMATCH: 'version_mismatch',
  DUPLICATE_NAME: 'duplicate_name',
  UNKNOWN: 'unknown',
};
