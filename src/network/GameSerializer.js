export function serializeGameState(state) {
  if (!state) return null;
  return {
    players: serializePlayers(state.players),
    currentTurn: state.currentTurn,
    diceValue: state.diceValue,
    gamePhase: state.gamePhase,
    gameStatus: state.gameStatus,
    winner: state.winner,
    moveHistory: state.moveHistory.slice(0, 50),
    consecutiveSixes: state.consecutiveSixes,
    lastMove: state.lastMove,
    turnNumber: state.turnNumber,
    rankings: state.rankings,
    playerOrder: state.playerOrder,
    availableMoves: state.availableMoves || [],
    selectedPiece: state.selectedPiece || null,
    turnTimer: state.turnTimer || 0,
  };
}

function serializePlayers(players) {
  const result = {};
  for (const [id, player] of Object.entries(players)) {
    result[id] = {
      color: player.color,
      name: player.name,
      pieces: player.pieces.map(p => ({
        id: p.id,
        position: p.position,
        isHome: p.isHome,
        isFinished: p.isFinished,
        isActive: p.isActive,
      })),
      finishedPieces: player.finishedPieces,
      isWinner: player.isWinner,
      rank: player.rank,
      isDisconnected: !!player.isDisconnected,
    };
  }
  return result;
}

export function deserializeGameState(data) {
  if (!data) return null;
  return {
    players: deserializePlayers(data.players),
    currentTurn: data.currentTurn,
    diceValue: data.diceValue,
    gamePhase: data.gamePhase,
    gameStatus: data.gameStatus,
    winner: data.winner,
    moveHistory: data.moveHistory || [],
    consecutiveSixes: data.consecutiveSixes || 0,
    lastMove: data.lastMove || null,
    turnNumber: data.turnNumber || 0,
    rankings: data.rankings || [],
    playerOrder: data.playerOrder || [],
    availableMoves: data.availableMoves || [],
    selectedPiece: data.selectedPiece || null,
    turnTimer: data.turnTimer || 0,
  };
}

function deserializePlayers(data) {
  if (!data) return {};
  const result = {};
  for (const [id, player] of Object.entries(data)) {
    result[id] = {
      color: player.color,
      name: player.name,
      pieces: player.pieces.map(p => ({
        id: p.id,
        position: p.position,
        isHome: p.isHome,
        isFinished: p.isFinished,
        isActive: p.isActive,
      })),
      finishedPieces: player.finishedPieces,
      hasRolledSix: false,
      canRoll: true,
      isWinner: player.isWinner,
      rank: player.rank || null,
      isDisconnected: !!player.isDisconnected,
    };
  }
  return result;
}

export function serializeLobbyState(lobby) {
  return {
    roomCode: lobby.roomCode,
    players: lobby.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isReady: p.isReady,
      isHost: p.isHost,
      isConnected: p.isConnected,
    })),
    playerCount: lobby.playerCount,
    maxPlayers: lobby.maxPlayers,
    hostId: lobby.hostId,
  };
}

export function serializeMove(move) {
  return {
    pieceId: move.pieceId,
    fromPosition: move.fromPosition,
    toPosition: move.toPosition,
    destinationAbs: move.destinationAbs,
    killsPlayerIds: move.killsPlayerIds || [],
    entersHomeStretch: move.entersHomeStretch,
    finishes: move.finishes,
    types: move.types,
  };
}
