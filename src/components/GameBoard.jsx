import { memo, useMemo, useRef, useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import Piece from './Piece';
import {
  BOARD_SIZE, HOME_BASE_POSITIONS, GAME_PHASES,
} from '../data/constants';
import { getPieceCoordinates, computeAnimationFrames } from '../logic/gameUtils';

function getSelectableCells(availableMoves, players, currentTurn) {
  const cells = new Set();
  if (!availableMoves) return cells;
  for (const move of availableMoves) {
    const player = players[currentTurn];
    if (!player) continue;
    const piece = player.pieces.find(p => p.id === move.pieceId);
    if (!piece) continue;
    if (piece.isHome) {
      const homePos = HOME_BASE_POSITIONS[player.color]?.[piece.id];
      if (homePos) cells.add(`${homePos.row}-${homePos.col}`);
    } else {
      const coord = getPieceCoordinates(player.color, piece.position);
      if (coord) cells.add(`${coord.row}-${coord.col}`);
    }
  }
  return cells;
}

function GridOverlay({ selectableCells, handleSelectPiece, availableMoves, players, currentTurn }) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const key = `${row}-${col}`;
      const isSelectable = selectableCells.has(key);
      const onClick = isSelectable ? () => {
        if (!availableMoves) return;
        const player = players[currentTurn];
        if (!player) return;
        for (const move of availableMoves) {
          const piece = player.pieces.find(p => p.id === move.pieceId);
          if (!piece) continue;
          let pieceKey = null;
          if (piece.isHome) {
            const hp = HOME_BASE_POSITIONS[player.color]?.[piece.id];
            if (hp) pieceKey = `${hp.row}-${hp.col}`;
          } else {
            const coord = getPieceCoordinates(player.color, piece.position);
            if (coord) pieceKey = `${coord.row}-${coord.col}`;
          }
          if (pieceKey === key) {
            handleSelectPiece(piece.id);
            break;
          }
        }
      } : undefined;
      cells.push(
        <div
          key={key}
          className={`${isSelectable ? 'cursor-pointer' : ''}`}
          onClick={onClick}
          role={isSelectable ? 'button' : undefined}
          tabIndex={isSelectable ? 0 : -1}
          onKeyDown={isSelectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
          style={{ position: 'relative', minWidth: 0, minHeight: 0 }}
        >
          {isSelectable && (
            <img
              src="/textures/Highlight.png"
              alt=""
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ opacity: 0.5 }}
            />
          )}
        </div>
      );
    }
  }
  return cells;
}

function GameBoard({ onSelectPiece }) {
  const gameCtx = useGame();
  const { state } = gameCtx;
  const { players, currentTurn, gamePhase, availableMoves, lastMove, moveHistory } = state;
  const handleSelectPiece = onSelectPiece || gameCtx.selectPiece;
  const lastMoveCountRef = useRef(moveHistory?.length || 0);
  const justMovedKeyRef = useRef(null);

  const [animState, setAnimState] = useState(null);

  useEffect(() => {
    if (!lastMove) return;
    if ((moveHistory?.length || 0) <= lastMoveCountRef.current) return;
    lastMoveCountRef.current = moveHistory.length;

    justMovedKeyRef.current = `${lastMove.player}-${lastMove.piece}`;
    setTimeout(() => { justMovedKeyRef.current = null; }, 600);

    const playerColor = players[lastMove.player]?.color;
    if (!playerColor || lastMove.from === -1) return;

    const frames = computeAnimationFrames(lastMove.from, lastMove.to, playerColor);
    if (frames.length > 1) {
      setAnimState({
        pieceId: lastMove.piece,
        playerId: lastMove.player,
        frames,
        currentFrame: 0,
      });
    }
  }, [lastMove, moveHistory?.length, players]);

  useEffect(() => {
    if (!animState) return;
    if (animState.currentFrame >= animState.frames.length - 1) {
      const t = setTimeout(() => setAnimState(null), 150);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setAnimState(prev => prev ? { ...prev, currentFrame: prev.currentFrame + 1 } : null);
    }, 120);
    return () => clearTimeout(t);
  }, [animState]);

  const selectablePieceIds = useMemo(() => {
    if (gamePhase !== GAME_PHASES.SELECTING_PIECE) return new Set();
    return new Set((availableMoves || []).map(m => m.pieceId));
  }, [gamePhase, availableMoves]);

  const selectableCells = useMemo(() => {
    if (gamePhase !== GAME_PHASES.SELECTING_PIECE) return new Set();
    return getSelectableCells(availableMoves, players, currentTurn);
  }, [gamePhase, availableMoves, players, currentTurn]);

  const pieceElements = useMemo(() => {
    const pieces = [];
    const recentKey = justMovedKeyRef.current;

    for (const [pid, player] of Object.entries(players)) {
      for (const piece of player.pieces) {
        if (piece.isFinished) continue;

        const isAnimating = animState && animState.playerId === pid && animState.pieceId === piece.id;

        let displayRow, displayCol, isHome;

        if (isAnimating) {
          const frameIndex = animState.currentFrame;
          const coord = animState.frames[frameIndex];
          if (!coord) continue;
          displayRow = coord.row;
          displayCol = coord.col;
          isHome = false;
        } else if (piece.isHome) {
          const homePos = HOME_BASE_POSITIONS[player.color]?.[piece.id];
          if (!homePos) continue;
          displayRow = homePos.row;
          displayCol = homePos.col;
          isHome = true;
        } else {
          const coord = getPieceCoordinates(player.color, piece.position);
          if (!coord) continue;
          displayRow = coord.row;
          displayCol = coord.col;
          isHome = false;
        }

        const isSelectable = pid === currentTurn && selectablePieceIds.has(piece.id);
        const justMoved = `${pid}-${piece.id}` === recentKey;

        pieces.push({
          piece,
          playerColor: player.color,
          playerId: pid,
          displayRow,
          displayCol,
          isHome,
          isSelectable,
          justMoved,
        });
      }
    }

    return pieces;
  }, [players, currentTurn, selectablePieceIds, animState]);

  const piecesByCell = useMemo(() => {
    const map = {};
    for (const p of pieceElements) {
      const key = `${p.displayRow}-${p.displayCol}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [pieceElements]);

  const stackedPieces = useMemo(() => {
    const elements = [];
    for (const [, list] of Object.entries(piecesByCell)) {
      const count = list.length;
      list.forEach((p, idx) => {
        let leftOffset = 0, topOffset = 0;
        if (count > 1) {
          const perCol = Math.ceil(Math.sqrt(count));
          const row = Math.floor(idx / perCol);
          const col = idx % perCol;
          const fraction = 0.35;
          const spacing = fraction / perCol;
          leftOffset = -fraction / 2 + col * spacing + spacing / 2;
          topOffset = -fraction / 2 + row * spacing + spacing / 2;
        }
        elements.push(
          <Piece
            key={`${p.playerId}-${p.piece.id}`}
            playerColor={p.playerColor}
            piece={p.piece}
            isSelectable={p.isSelectable}
            isSelected={false}
            justMoved={p.justMoved}
            onClick={p.isSelectable ? () => handleSelectPiece(p.piece.id) : undefined}
            cellRow={p.displayRow}
            cellCol={p.displayCol}
            offsetX={leftOffset}
            offsetY={topOffset}
          />
        );
      });
    }
    return elements;
  }, [piecesByCell, handleSelectPiece]);

  return (
    <div className="w-full max-w-lg mx-auto select-none">
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: '12px',
          border: '4px solid #0D3B0F',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          backgroundColor: '#1B5E20',
        }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
          <img
            src="/textures/Board.png"
            alt="Ludo Board"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain', pointerEvents: 'none' }}
            draggable={false}
          />

          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
            }}
          >
            <GridOverlay
              selectableCells={selectableCells}
              availableMoves={availableMoves}
              players={players}
              currentTurn={currentTurn}
              handleSelectPiece={handleSelectPiece}
            />
          </div>

          {stackedPieces}
        </div>
      </div>
    </div>
  );
}

export default memo(GameBoard);
