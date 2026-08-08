import { gameReducer, initialState } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/logic/gameReducer.js';
import { SyncManager } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/network/SyncManager.js';
import { serializeGameState, deserializeGameState } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/network/GameSerializer.js';
import { computeAnimationFrames } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/logic/gameUtils.js';

// Simulate a host SyncManager with a mock connection
class MockConn {
  constructor() { this.handlers = {}; this.sent = []; }
  onMessageType(type, fn) { this.handlers[type] = fn; }
  sendToPeer(type, data, peerId) { this.sent.push({ type, data, peerId }); }
  sendToAll(type, data) { this.sent.push({ type, data, to: 'all' }); }
  get myPeerId() { return 'host'; }
  isHost() { return true; }
}

const CONFIG = [{ name: 'Red' }, { name: 'Green' }, { name: 'Yellow' }, { name: 'Blue' }];

const host = new SyncManager(new MockConn());
host.startGame(CONFIG);
host.conn.sent.length = 0; // clear game_started broadcast
let st = host.getState();
// red has piece 0 OUT at position 2
st.players.red.pieces[0].position = 2;
st.players.red.pieces[0].isHome = false;
st.players.red.pieces[0].isActive = true;
host.setState(st);

console.log('--- 1. HOST handles ROLL (diceValue=6) ---');
host._handleRollRequest({ playerId: 'red', diceValue: 6 }, 'client-red');
let hostState = host.getState();
console.log('host phase:', hostState.gamePhase);
console.log('host moves:', JSON.stringify(hostState.availableMoves.map(m => ({ id: m.pieceId, from: m.fromPosition, to: m.toPosition }))));
console.log('host moveHistory len:', hostState.moveHistory.length, 'lastMove:', JSON.stringify(hostState.lastMove));

// --- Acting client (non-host) simulation ---
let cs = gameReducer(initialState, { type: 'START_GAME', payload: CONFIG });
cs.players.red.pieces[0].position = 2;
cs.players.red.pieces[0].isHome = false;
cs.players.red.pieces[0].isActive = true;

let lastMoveCountRef = 0; // GameBoard's ref, initialized to moveHistory.length on mount

function checkAnim() {
  const lm = cs.lastMove;
  if (!lm) { console.log('  [anim] no lastMove -> skip'); return; }
  if (cs.moveHistory.length <= lastMoveCountRef) { console.log('  [anim] moveHistory did NOT grow (', cs.moveHistory.length, '<=', lastMoveCountRef, ') -> NO ANIMATION'); return; }
  lastMoveCountRef = cs.moveHistory.length;
  const pc = cs.players[lm.player]?.color;
  if (!pc || lm.from === -1) { console.log('  [anim] from===-1 or no color -> no step anim'); return; }
  const frames = computeAnimationFrames(lm.from, lm.to, pc);
  console.log(`  [anim] from=${lm.from} to=${lm.to} frames=${frames.length} ->`, frames.length > 1 ? 'ANIMATION TRIGGERED' : 'NO ANIMATION (frames<=1)');
}

console.log('\n--- 2. CLIENT optimistic ROLL_DICE ---');
cs = gameReducer(cs, { type: 'ROLL_DICE', payload: { value: 6 } });
console.log('client phase:', cs.gamePhase, 'diceValue:', cs.diceValue, 'diceRolling:', cs.diceRolling, 'moveHistory len:', cs.moveHistory.length);

console.log('\n--- 3. CLIENT hydrates host SELECTING_PIECE state ---');
const bc1 = host.conn.sent.find(s => s.type === 'game_state_sync');
const deser1 = deserializeGameState(bc1.data.state);
cs = gameReducer(cs, { type: 'HYDRATE_STATE', payload: { ...deser1, sequence: 1 } });
console.log('client phase:', cs.gamePhase, 'moveHistory len:', cs.moveHistory.length);

console.log('\n--- 4. CLIENT optimistic SELECT_PIECE (outside piece id 0) ---');
console.log('availableMoves:', JSON.stringify(cs.availableMoves.map(m => ({ id: m.pieceId, from: m.fromPosition, to: m.toPosition }))));
cs = gameReducer(cs, { type: 'SELECT_PIECE', payload: 0 });
console.log('client phase:', cs.gamePhase, 'moveHistory len:', cs.moveHistory.length);
console.log('client lastMove:', JSON.stringify(cs.lastMove));
checkAnim();

console.log('\n--- 5. HOST handles MOVE_REQUEST, broadcasts ---');
host.conn.sent.length = 0;
host._handleMoveRequest({ playerId: 'red', pieceId: 0 }, 'client-red');
const bc2 = host.conn.sent.find(s => s.type === 'game_state_sync');
const deser2 = deserializeGameState(bc2.data.state);
console.log('host phase:', deser2.gamePhase, 'host moveHistory len:', deser2.moveHistory.length, 'host lastMove:', JSON.stringify(deser2.lastMove));

console.log('\n--- 6. CLIENT hydrates host authoritative state (comes ~150ms later) ---');
cs = gameReducer(cs, { type: 'HYDRATE_STATE', payload: { ...deser2, sequence: 2 } });
console.log('client phase:', cs.gamePhase, 'moveHistory len:', cs.moveHistory.length);
checkAnim();

console.log('\n--- Also check: host client (spectator) path ---');
console.log('Spectator starts fresh, moveHistory len:', deser2.moveHistory.length, '-> grows from 0, so animation triggers.');

process.exit(0);
