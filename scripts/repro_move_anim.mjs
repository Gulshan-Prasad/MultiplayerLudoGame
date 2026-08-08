import { SyncManager } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/network/SyncManager.js';
import { gameReducer } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/logic/gameReducer.js';
import { computeAnimationFrames, getPieceCoordinates } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/logic/gameUtils.js';
import { GAME_PHASES } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/data/constants.js';

const configs = ['red', 'green', 'yellow', 'blue'].map((c, i) => ({ id: `peer${i + 1}`, name: `P${i + 1}` }));
let latest = null;
const mockConn = {
  sendToAll: (t, d) => { if (t === 'game_state_sync') latest = d; },
  sendToPeer: () => {},
  myPeerId: 'host',
};
const sync = new SyncManager(mockConn);
sync.startGame(configs);
let client = JSON.parse(JSON.stringify(sync.getState()));

// Roll a 6 for red to release a piece from home
sync._handleRollRequest({ playerId: 'red', diceValue: 6 }, 'red');
client = JSON.parse(JSON.stringify(latest.state));
console.log('After roll 6:', 'phase=', sync.getState().gamePhase, 'dice=', sync.getState().diceValue);

// Red selects piece 0 (released from home -> position 0)
if (sync.getState().gamePhase === GAME_PHASES.SELECTING_PIECE) {
  sync._handleMoveRequest({ playerId: 'red', pieceId: 0, diceValue: 6 }, 'red');
}
client = JSON.parse(JSON.stringify(latest.state));
console.log('After release move: piece0 position =', sync.getState().players.red.pieces[0].position);

// Now red rolls 6 again, and moves the OUTSIDE piece (position 0 -> 6)
sync._handleRollRequest({ playerId: 'red', diceValue: 6 }, 'red');
console.log('\nRoll 6 with outside piece present:');
console.log('  availableMoves =', JSON.stringify(sync.getState().availableMoves.map(m => ({ pid: m.pieceId, from: m.fromPosition, to: m.toPosition, types: m.types })), null, 2));

if (sync.getState().gamePhase === GAME_PHASES.SELECTING_PIECE) {
  sync._handleMoveRequest({ playerId: 'red', pieceId: 0, diceValue: 6 }, 'red');
}

const st = sync.getState();
const lastMove = st.lastMove;
console.log('\nlastMove =', JSON.stringify(lastMove));
const frames = computeAnimationFrames(lastMove.from, lastMove.to, 'red');
console.log('frames computed from', lastMove.from, 'to', lastMove.to, '=', frames.length);
console.log('frames coords:', JSON.stringify(frames));
console.log('destination coord:', JSON.stringify(getPieceCoordinates('red', lastMove.to)));
