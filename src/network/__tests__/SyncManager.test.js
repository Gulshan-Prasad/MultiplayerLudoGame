import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MESSAGE_TYPES } from '../NetworkMessages.js';
import { GAME_PHASES, GAME_STATUS } from '../../data/constants.js';
import { PER_PLAYER_PATHS, SAFE_SPOT_COORDS } from '../../data/boardData.js';

// The host is authoritative for the dice: force rollDice to a known value so
// we can prove the client-sent value is ignored.
vi.mock('../../logic/gameUtils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rollDice: vi.fn(() => 4),
  };
});

const { SyncManager } = await import('../SyncManager.js');

function createMockConn() {
  const handlers = {};
  const messages = [];
  return {
    messages,
    handlers,
    myPeerId: 'host-peer',
    isHost: () => true,
    onMessageType(type, handler) {
      handlers[type] = handler;
    },
    sendToAll(type, data) {
      messages.push({ type, data, to: 'all' });
    },
    sendToPeer(type, data, peerId) {
      messages.push({ type, data, to: peerId });
    },
  };
}

function startTwoPlayer(conn) {
  const sync = new SyncManager(conn);
  sync.onStateUpdate = vi.fn();
  sync.startGame([
    { name: 'Red', color: 'red' },
    { name: 'Blue', color: 'blue' },
  ]);
  sync.setupListeners();
  return sync;
}

describe('SyncManager.startGame', () => {
  it('builds players keyed by config.color', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.startGame([
      { name: 'Blue', color: 'blue' },
      { name: 'Red', color: 'red' },
    ]);
    const state = sync.getState();
    expect(Object.keys(state.players)).toEqual(['blue', 'red']);
    expect(state.currentTurn).toBe('blue');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
  });

  it('broadcasts the initial game state', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.startGame([{ name: 'A', color: 'red' }, { name: 'B', color: 'blue' }]);
    const broadcast = conn.messages.find(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    expect(broadcast).toBeTruthy();
    expect(broadcast.data.state.players.red).toBeTruthy();
  });

  it('never leaks profilePic data URLs into the game-state broadcast', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    const bigPic = 'data:image/jpeg;base64,' + 'A'.repeat(40000);
    sync.startGame([
      { name: 'Red', color: 'red', profilePic: bigPic },
      { name: 'Blue', color: 'blue', profilePic: bigPic },
    ]);

    // The wire message must stay small so a large uploaded image can never
    // blow past the broker message-size limit and stall the game load.
    const broadcast = conn.messages.find(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    expect(broadcast).toBeTruthy();
    const serialized = JSON.stringify(broadcast.data);
    expect(serialized).not.toContain('profilePic');
    expect(serialized).not.toContain('A'.repeat(40000));
    expect(serialized.length).toBeLessThan(2000);
  });

  it('keeps profilePic only in the local authoritative state, not on the wire', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.startGame([
      { name: 'Red', color: 'red', profilePic: 'data:image/jpeg;base64,abc123' },
      { name: 'Blue', color: 'blue' },
    ]);

    // Locally the host may know about profilePics...
    const state = sync.getState();
    expect(state.players.red.profilePic).toBe('data:image/jpeg;base64,abc123');

    // ...but every broadcast serializes through serializeGameState, which
    // strips profilePic so clients hydrate a small, clean state.
    const broadcast = conn.messages.find(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    expect(JSON.stringify(broadcast.data)).not.toContain('profilePic');
  });
});

describe('SyncManager._handleRollRequest', () => {
  it('rolls its own dice and ignores the client-sent value', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const handler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];
    expect(handler).toBeTruthy();

    handler({ playerId: 'red', diceValue: 6 }, 'client-peer');

    const state = sync.getState();
    // rollDice is mocked to return 4 -> the sent 6 must be ignored.
    expect(state.diceValue).toBe(4);
  });

  it('rejects rolls when it is not the caller\'s turn', () => {
    const conn = createMockConn();
    startTwoPlayer(conn);
    const handler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];
    handler({ playerId: 'blue', diceValue: 6 }, 'client-peer');
    const rejected = conn.messages.find(m => m.type === MESSAGE_TYPES.REJECTED);
    expect(rejected).toBeTruthy();
    expect(rejected.to).toBe('client-peer');
  });
});

describe('SyncManager.applyChatCheat', () => {
  it('forces the next roll of a player who sent the cheat word', () => {
    vi.useFakeTimers();
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const handler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];

    // rollDice is mocked to 4, but the cheat must override it to a 6.
    expect(sync.applyChatCheat('red', 'hansikaaaaaa')).toBe(true);
    handler({ playerId: 'red' }, 'client-peer');

    const state = sync.getState();
    expect(state.diceValue).toBe(6);
    // The forced six is consumed by the roll, so it is not permanent.
    expect(sync._forceSixPlayers.has('red')).toBe(false);
    vi.useRealTimers();
  });

  it('ignores anything except the exact cheat word', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    expect(sync.applyChatCheat('red', 'hello')).toBe(false);
    expect(sync.applyChatCheat('red', 'hansika')).toBe(false);
    expect(sync.applyChatCheat('red', 'hansikaaaaaaa')).toBe(false);
    expect(sync.applyChatCheat('red', '')).toBe(false);
    expect(sync._forceSixPlayers.size).toBe(0);
  });
});

describe('chat cheat end-to-end (host flow)', () => {
  // Replicates exactly what the host does in NetworkProvider when a CHAT_MESSAGE
  // arrives: resolve the sender's color from the lobby by peer id, then hand
  // the cheat to SyncManager. Proves the peer-id -> color glue that was missing.
  function hostOnChatMessage(sync, lobby, msg) {
    const sender = lobby.players.find(p => p.id === msg.senderId);
    if (sender?.color) {
      sync.applyChatCheat(sender.color, msg.text);
    }
  }

  function twoPlayerLobby() {
    return {
      players: [
        { id: 'host-peer', name: 'Host', color: 'red', isHost: true },
        { id: 'client-peer', name: 'hansikaaaaaa', color: 'green', isHost: false },
      ],
    };
  }

  it('a client sending the cheat word makes their next roll a 6', () => {
    vi.useFakeTimers();
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Host', color: 'red' },
      { name: 'hansikaaaaaa', color: 'green' },
    ]);
    sync.setupListeners();

    const lobby = twoPlayerLobby();
    hostOnChatMessage(sync, lobby, {
      senderId: 'client-peer',
      text: 'hansikaaaaaa',
    });

    // It is hansikaaaaaa's (green's) turn to roll.
    sync.authoritativeState.currentTurn = 'green';
    const rollHandler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];
    rollHandler({ playerId: 'green' }, 'client-peer');

    const state = sync.getState();
    expect(state.diceValue).toBe(6);
    vi.useRealTimers();
  });

  it('does not apply the cheat for any other message', () => {
    vi.useFakeTimers();
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Host', color: 'red' },
      { name: 'hansikaaaaaa', color: 'green' },
    ]);
    sync.setupListeners();

    // A client sends a normal message that is not the cheat word.
    const lobby = twoPlayerLobby();
    hostOnChatMessage(sync, lobby, {
      senderId: 'client-peer',
      text: 'hello there',
    });
    expect(sync._forceSixPlayers.size).toBe(0);

    // It is the sender's (green's) turn to roll.
    sync.authoritativeState.currentTurn = 'green';
    const rollHandler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];
    rollHandler({ playerId: 'green' }, 'client-peer');
    // rollDice is mocked to 4, so a non-cheated roll stays 4.
    expect(sync.getState().diceValue).toBe(4);
    vi.useRealTimers();
  });
});

describe('SyncManager._handleMoveRequest', () => {
  it('executes a valid piece move and broadcasts', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const rollHandler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];
    const moveHandler = conn.handlers[MESSAGE_TYPES.MOVE_REQUEST];

    // rollDice is mocked to 4; with everything at home a 4 yields no moves, so
    // a move request outside SELECTING_PIECE must be rejected.
    rollHandler({ playerId: 'red' }, 'client-peer');
    expect(sync.getState().gamePhase).toBe(GAME_PHASES.TURN_COMPLETE);
    moveHandler({ playerId: 'red', pieceId: 0 }, 'client-peer');
    const rejected = conn.messages.filter(m => m.type === MESSAGE_TYPES.REJECTED);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it('grants an extra roll when the move cuts an opponent piece', () => {
    vi.useFakeTimers();
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const rollHandler = conn.handlers[MESSAGE_TYPES.ROLL_REQUEST];

    // rollDice is mocked to 4, so set up a red move of 4 that lands on a blue
    // piece on the same unsafe cell.
    const MAIN_PATH_LENGTH = 51;
    const redPath = PER_PLAYER_PATHS.red;
    const bluePath = PER_PLAYER_PATHS.blue;
    let redFrom = null;
    let blueAt = null;
    for (let a = 0; a + 4 < MAIN_PATH_LENGTH; a++) {
      const dest = redPath[a + 4];
      if (!dest || SAFE_SPOT_COORDS.has(`${dest.row},${dest.col}`)) continue;
      for (let b = 0; b < MAIN_PATH_LENGTH; b++) {
        const bc = bluePath[b];
        if (bc && bc.row === dest.row && bc.col === dest.col) {
          redFrom = a;
          blueAt = b;
          break;
        }
      }
      if (redFrom !== null) break;
    }
    expect(redFrom).not.toBeNull();

    const state = sync.getState();
    state.players.red.pieces[0].position = redFrom;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.players.blue.pieces[0].position = blueAt;
    state.players.blue.pieces[0].isHome = false;
    state.players.blue.pieces[0].isActive = true;
    sync.setState(state);

    // Only one piece can move, so the host auto-executes the move after the
    // dice animation (the exact cut-on-a-single-move path).
    rollHandler({ playerId: 'red' }, 'client-peer');
    expect(sync.getState().gamePhase).toBe(GAME_PHASES.ROLLING);
    vi.advanceTimersByTime(1000);
    const after = sync.getState();
    expect(after.players.blue.pieces[0].position).toBe(-1);
    // Cutting grants an extra roll even though the die was not a 6.
    expect(after.currentTurn).toBe('red');
    expect(after.gamePhase).toBe(GAME_PHASES.ROLLING);
    vi.useRealTimers();
  });

  it('rejects moves when it is not the caller\'s turn', () => {
    const conn = createMockConn();
    startTwoPlayer(conn);
    const moveHandler = conn.handlers[MESSAGE_TYPES.MOVE_REQUEST];
    moveHandler({ playerId: 'blue', pieceId: 0 }, 'client-peer');
    const rejected = conn.messages.filter(m => m.type === MESSAGE_TYPES.REJECTED);
    expect(rejected.length).toBeGreaterThan(0);
  });
});

describe('SyncManager.restartGame', () => {
  it('starts a fresh game with the same connected players', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Red', color: 'red' },
      { name: 'Blue', color: 'blue' },
      { name: 'Green', color: 'green' },
    ]);
    sync.setupListeners();
    const before = sync.getState();

    // Mark blue disconnected so it should be dropped from the rematch.
    before.players.blue.isDisconnected = true;
    sync.setState(before);

    const restarted = sync.restartGame();
    expect(restarted).toBeTruthy();
    expect(restarted.players.red).toBeTruthy();
    expect(restarted.players.green).toBeTruthy();
    expect(restarted.players.blue).toBeUndefined();
    expect(restarted.currentTurn).toBe('red');
    expect(restarted.gameStatus).toBe(GAME_STATUS.IN_PROGRESS);
    expect(restarted.moveHistory).toHaveLength(0);
  });

  it('refuses to restart when fewer than two players remain connected', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const before = sync.getState();

    before.players.blue.isDisconnected = true;
    sync.setState(before);

    expect(sync.restartGame()).toBeNull();
  });

  it('is a no-op when no game has been started', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    expect(sync.restartGame()).toBeNull();
  });

  it('carries profilePic into the rematch without putting it on the wire', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Red', color: 'red', profilePic: 'data:image/png;base64,AAAA' },
      { name: 'Blue', color: 'blue', profilePic: 'data:image/png;base64,BBBB' },
    ]);
    sync.setupListeners();

    const restarted = sync.restartGame();
    expect(restarted.players.red.profilePic).toBe('data:image/png;base64,AAAA');
    expect(restarted.players.blue.profilePic).toBe('data:image/png;base64,BBBB');

    // The rematch broadcast (the last GAME_STATE_SYNC) must stay clean.
    const broadcasts = conn.messages.filter(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    const last = broadcasts[broadcasts.length - 1];
    expect(JSON.stringify(last.data)).not.toContain('profilePic');
  });
});

describe('SyncManager.destroy', () => {
  it('clears state and callbacks', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    sync.destroy();
    expect(sync.getState()).toBeNull();
    expect(sync.onStateUpdate).toBeNull();
  });
});

describe('SyncManager._advanceToNextTurn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('auto-advances after the short TURN_COMPLETE delay', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    // roll mocked to 4 with nothing on the board -> TURN_COMPLETE.
    conn.handlers[MESSAGE_TYPES.ROLL_REQUEST]({ playerId: 'red' }, 'client-peer');
    expect(sync.getState().gamePhase).toBe(GAME_PHASES.TURN_COMPLETE);

    vi.advanceTimersByTime(1600);
    const state = sync.getState();
    expect(state.currentTurn).toBe('blue');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
    vi.useRealTimers();
  });
});

describe('SyncManager.handlePlayerDisconnect', () => {
  it('ignores a second report of the same disconnect (no duplicate broadcast)', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const state = sync.getState();
    sync.setState(state);

    sync.handlePlayerDisconnect('blue');
    const countAfterFirst = conn.messages.filter(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC).length;
    sync.handlePlayerDisconnect('blue');
    const countAfterSecond = conn.messages.filter(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC).length;

    // First call ends the game with red as the sole survivor.
    expect(sync.getState().winner).toBe('red');
    expect(sync.getState().gameStatus).toBe(GAME_STATUS.FINISHED);
    // The same departure can be reported twice (onPeersChange + PLAYER_LEFT/
    // LEAVE_ROOM) — the second report must not re-broadcast a duplicate state.
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

describe('SyncManager.takeoverAsHost', () => {
  it('ends the game with the sole survivor winning when a 2-player host leaves', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const state = sync.getState();
    state.sequence = 12;
    sync.setState(state);

    const result = sync.takeoverAsHost(state, ['red']);

    expect(result).toBeTruthy();
    expect(result.gameStatus).toBe(GAME_STATUS.FINISHED);
    expect(result.gamePhase).toBe(GAME_PHASES.GAME_OVER);
    expect(result.winner).toBe('blue');
    expect(result.players.blue.isWinner).toBe(true);
    // The departed host's pieces are removed from the board.
    expect(result.players.red.isDisconnected).toBe(true);
    expect(result.players.red.pieces.every(p => p.isFinished)).toBe(true);
    expect(result.players.red.finishedPieces).toBe(4);

    // Sequence continues past the snapshot so no client rejects it as stale.
    const broadcasts = conn.messages.filter(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    expect(broadcasts.length).toBeGreaterThan(0);
    const last = broadcasts[broadcasts.length - 1];
    expect(last.data.sequence).toBeGreaterThan(12);
  });

  it('keeps the game going and removes the departed host in a 3-player game', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Red', color: 'red' },
      { name: 'Green', color: 'green' },
      { name: 'Blue', color: 'blue' },
    ]);
    sync.setupListeners();
    const state = sync.getState();
    state.sequence = 7;
    state.players.green.pieces[0].position = 5;
    state.players.green.pieces[0].isHome = false;
    state.players.green.pieces[0].isActive = true;
    sync.setState(state);

    // Red is the current turn and is the departed host -> turn advances.
    const result = sync.takeoverAsHost(state, ['red']);

    expect(result.gameStatus).toBe(GAME_STATUS.IN_PROGRESS);
    expect(result.players.red.isDisconnected).toBe(true);
    expect(result.players.red.pieces.every(p => p.isFinished)).toBe(true);
    expect(result.currentTurn).toBe('green');
    expect(result.gamePhase).toBe(GAME_PHASES.ROLLING);

    const broadcasts = conn.messages.filter(m => m.type === MESSAGE_TYPES.GAME_STATE_SYNC);
    const last = broadcasts[broadcasts.length - 1];
    expect(last.data.reason).toBe('host_migrated');
    expect(last.data.sequence).toBeGreaterThan(7);
  });

  it('keeps the current turn when the departed host was not the active player', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    sync.onStateUpdate = vi.fn();
    sync.startGame([
      { name: 'Red', color: 'red' },
      { name: 'Green', color: 'green' },
      { name: 'Blue', color: 'blue' },
    ]);
    sync.setupListeners();
    const state = sync.getState();
    state.sequence = 5;
    state.currentTurn = 'blue';
    sync.setState(state);

    // Red leaves but it is blue's turn -> the game continues with blue.
    const result = sync.takeoverAsHost(state, ['red']);

    expect(result.gameStatus).toBe(GAME_STATUS.IN_PROGRESS);
    expect(result.currentTurn).toBe('blue');
    expect(result.players.red.isDisconnected).toBe(true);
  });

  it('resets an in-flight dice roll on takeover', () => {
    const conn = createMockConn();
    const sync = startTwoPlayer(conn);
    const state = sync.getState();
    state.sequence = 9;
    state.diceRolling = true;
    state.diceValue = 4;
    state.gamePhase = GAME_PHASES.ROLLING;
    sync.setState(state);

    const result = sync.takeoverAsHost(state, ['red']);
    expect(result.diceRolling).toBe(false);
    expect(result.gameStatus).toBe(GAME_STATUS.FINISHED);
  });

  it('is a no-op without a valid in-progress snapshot', () => {
    const conn = createMockConn();
    const sync = new SyncManager(conn);
    expect(sync.takeoverAsHost(null, [])).toBeNull();
    expect(sync.takeoverAsHost({ gameStatus: GAME_STATUS.FINISHED, players: {} }, [])).toBeNull();
  });
});
