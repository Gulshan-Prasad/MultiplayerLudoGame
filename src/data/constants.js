export const BOARD_SIZE = 15;
export const CENTER = { row: 7, col: 7 };
export const GLOBE_POSITION = { row: 7, col: 7 };

export const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
export const PLAYER_DISPLAY_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];

export const COLOR_MAP = {
  red: { primary: '#E53935', light: '#FF6F60', dark: '#AB000D', bg: '#FFEBEE' },
  green: { primary: '#43A047', light: '#76D275', dark: '#00701A', bg: '#E8F5E9' },
  yellow: { primary: '#FDD835', light: '#FFFF6B', dark: '#C6A700', bg: '#FFFDE7' },
  blue: { primary: '#1E88E5', light: '#6AB7FF', dark: '#005CB2', bg: '#E3F2FD' },
};

export const PIECES_PER_PLAYER = 4;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export const HOME_BASE_CELLS = {
  green: { startRow: 0, endRow: 5, startCol: 0, endCol: 5 },
  yellow: { startRow: 0, endRow: 5, startCol: 9, endCol: 14 },
  blue: { startRow: 9, endRow: 14, startCol: 9, endCol: 14 },
  red: { startRow: 9, endRow: 14, startCol: 0, endCol: 5 },
};

export const HOME_BASE_POSITIONS = {
  green: [
    { row: 0.9, col: 1.6 }, { row: 0.9, col: 3.4 },
    { row: 2.9, col: 1.6 }, { row: 2.9, col: 3.4 },
  ],
  yellow: [
    { row: 0.9, col: 10.6 }, { row: 0.9, col: 12.4 },
    { row: 2.9, col: 10.6 }, { row: 2.9, col: 12.4 },
  ],
  blue: [
    { row: 9.9, col: 10.6 }, { row: 9.9, col: 12.4 },
    { row: 11.9, col: 10.6 }, { row: 11.9, col: 12.4 },
  ],
  red: [
    { row: 9.9, col: 1.6 }, { row: 9.9, col: 3.4 },
    { row: 11.9, col: 1.6 }, { row: 11.9, col: 3.4 },
  ],
};

export const PATH_SECTIONS = {
  horizontal: {
    top: { row: 6, cols: [0, 1, 2, 3, 4, 5] },
    middle: { row: 7, cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    bottom: { row: 8, cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  },
  vertical: {
    left: { col: 6, rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    center: { col: 7, rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    right: { col: 8, rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  },
};

export const TURN_TIMER_SECONDS = 30;
// After a move completes (no End Turn button anymore), the turn auto-advances
// once the piece animation has had time to play out.
export const TURN_COMPLETE_AUTO_ADVANCE_MS = 700;
// Time between the dice being rolled and the piece actually moving. The die
// shakes (500ms) then settles (~950ms); the piece moves as soon as the die
// has finished rolling and shown its value.
export const DICE_ROLL_RESOLVE_MS = 950;
export const STORAGE_KEY = 'ludo_game_state';
export const PLAYER_NAME_STORAGE_KEY = 'ludo_player_name';
export const PLAYER_PROFILE_PIC_STORAGE_KEY = 'ludo_player_profile_pic';
export const PLAYER_NAMES_STORAGE_KEY = 'ludo_setup_player_names';
export const PLAYER_PICS_STORAGE_KEY = 'ludo_setup_player_pics';
export const MAX_CONSECUTIVE_SIXES = 3;

export const GAME_PHASES = {
  WAITING: 'WAITING',
  ROLLING: 'ROLLING',
  SELECTING_PIECE: 'SELECTING_PIECE',
  MOVING: 'MOVING',
  TURN_COMPLETE: 'TURN_COMPLETE',
  GAME_OVER: 'GAME_OVER',
};

export const GAME_STATUS = {
  NOT_STARTED: 'notStarted',
  IN_PROGRESS: 'inProgress',
  FINISHED: 'finished',
};
