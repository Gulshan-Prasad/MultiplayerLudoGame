import { serializeGameState } from '../src/network/GameSerializer.js';

// Simulate the host acting mover's hydration-triggered animation gate.
// GameBoard effect: if (moveHistory.length <= lastMoveCountRef) skip animation.
// lastMoveCountRef starts at moveHistory.length at mount and is set to
// moveHistory.length every time the gate passes.

function reducerCap(len) {
  return Math.min(len, 50);
}

const log = [];
let ref = 0; // lastMoveCountRef at mount (fresh game, moveHistory empty)
let animationCount = 0;
let jumpCount = 0;

function makeState(moveCount) {
  return {
    players: {},
    currentTurn: 'red',
    diceValue: 0,
    gamePhase: 'ROLLING',
    gameStatus: 'inProgress',
    winner: null,
    moveHistory: Array.from({ length: moveCount }, (_, i) => ({ i })),
    consecutiveSixes: 0,
    lastMove: { player: 'red', piece: 0, from: moveCount - 1, to: moveCount },
    turnNumber: 0,
    rankings: [],
    playerOrder: ['red', 'green'],
    availableMoves: [],
    selectedPiece: null,
  };
}

for (let n = 1; n <= 60; n++) {
  // Host authoritative moveHistory length after move n
  const hostLen = reducerCap(n);
  // Serializer truncation (now fixed to 50)
  const serialized = serializeGameState(makeState(hostLen));
  const hydratedLen = serialized.moveHistory.length;

  // Effect gate on hydration:
  if (hydratedLen > ref) {
    ref = hydratedLen;
    animationCount++;
    log.push(`move #${n}: hydratedLen=${hydratedLen} ref->${ref} ANIMATE`);
  } else {
    jumpCount++;
    log.push(`move #${n}: hydratedLen=${hydratedLen} ref=${ref} JUMP (blocked)`);
  }
}

console.log(log.slice(0, 25).join('\n'));
console.log('...');
console.log(log.slice(-6).join('\n'));
console.log(`\nTotal animated: ${animationCount}, total jumped: ${jumpCount}`);
