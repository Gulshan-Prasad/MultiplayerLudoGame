import { memo, useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import Piece from './Piece';
import {
  BOARD_SIZE, HOME_BASE_POSITIONS, GAME_PHASES,
} from '../data/constants';
import { getPieceCoordinates, computeAnimationFrames, computeReturnAnimationFrames, isSafeSpot } from '../logic/gameUtils';
import { playSound } from '../utils/sound';

function useFitSquare(ref) {
  const [size, setSize] = useState(0);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const side = Math.floor(Math.min(rect.width, rect.height));
    if (side > 0) setSize(side);
  }, [ref]);

  useLayoutEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, ref]);

  return size;
}

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
      if (homePos) cells.add(`${Math.round(homePos.row)}-${Math.round(homePos.col)}`);
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
            if (hp) pieceKey = `${Math.round(hp.row)}-${Math.round(hp.col)}`;
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
        />
      );
    }
  }
  return cells;
}

function GameBoard({ onSelectPiece }) {
  const gameCtx = useGame();
  const { state, selectPiece: contextSelectPiece } = gameCtx;
  const { players, currentTurn, gamePhase, availableMoves, lastMove, moveHistory } = state;
  // Wrap the piece-picking action so clicking a selectable piece (or its
  // target cell) plays the pick-up blip.
  const handleSelectPiece = useCallback((pieceId) => {
    playSound('piece_select');
    (onSelectPiece || contextSelectPiece)(pieceId);
  }, [onSelectPiece, contextSelectPiece]);
  const lastMoveCountRef = useRef(moveHistory?.length || 0);
  const justMovedKeyRef = useRef(null);

  const [animState, setAnimState] = useState(null);
  // Moves that arrive while an animation is still playing are queued here so
  // in-flight pieces never jump straight to their destination (no teleports).
  const animQueueRef = useRef([]);
  // Bumped whenever a move is pushed onto the queue so the board re-renders
  // with the queued pieces held at their starting cells (before the browser
  // paints) instead of showing them at their destination.
  const [queueTick, setQueueTick] = useState(0);

  // Animate the mover forward AND every captured piece backwards to its home
  // base (instead of teleporting). Multiple pieces may animate at once.
  useLayoutEffect(() => {
    if (!lastMove) return;
    const historyLen = moveHistory?.length || 0;
    // History shrank (undo/load): resync so the *next* move still animates,
    // but never replay a move that was already shown.
    if (historyLen < lastMoveCountRef.current) {
      lastMoveCountRef.current = historyLen;
      return;
    }
    if (historyLen <= lastMoveCountRef.current) return;
    lastMoveCountRef.current = historyLen;

    justMovedKeyRef.current = `${lastMove.player}-${lastMove.piece}`;
    setTimeout(() => { justMovedKeyRef.current = null; }, 600);

    const playerColor = players[lastMove.player]?.color;
    const forward = [];
    const retreats = [];

    if (playerColor && lastMove.from !== -1) {
      const frames = computeAnimationFrames(lastMove.from, lastMove.to, playerColor);
      if (frames.length > 1) {
        forward.push({ pieceId: lastMove.piece, playerId: lastMove.player, frames });
      }
    }

    // The one-shot sound that marks the mover arriving at its destination
    // (finish / capture / safe spot). For animated moves it plays in the frame
    // loop exactly when the forward walk completes; for moves with no forward
    // walk (e.g. releasing from home) it plays immediately.
    const isAnimated = forward.length > 0;
    let landingSound = null;
    if (playerColor && (lastMove.finish || lastMove.killed || isSafeSpot(playerColor, lastMove.to))) {
      landingSound = lastMove.finish ? 'finish' : lastMove.killed ? 'capture' : 'safe_spot';
    }
    if (playerColor && !isAnimated) {
      // A piece leaving home base plays its own release blip (no forward walk);
      // other instant moves fall back to the step sound.
      playSound(lastMove.from === -1 ? 'release' : (landingSound || 'piece_move'));
    }

    for (const killed of lastMove.killedPieces || []) {
      const victimColor = players[killed.playerId]?.color;
      if (!victimColor) continue;
      const frames = computeReturnAnimationFrames(victimColor, killed.pieceId, killed.fromPosition);
      if (frames.length > 1) {
        retreats.push({ pieceId: killed.pieceId, playerId: killed.playerId, frames });
      }
    }

    // Sequence the animation: the mover walks to the captured piece first,
    // then each cut piece retreats back to its house.
    const groups = [];
    if (forward.length > 0) groups.push(forward);
    if (retreats.length > 0) groups.push(retreats);

    if (groups.length > 0) {
      const nextAnim = {
        groups,
        currentGroup: 0,
        currentFrame: 0,
        landingSound: isAnimated ? landingSound : null,
      };
      if (animState) {
        // A move arrived while the previous animation is still running: queue
        // it and render its pieces "held" at their starting cells until the
        // current animation finishes, so nothing ever teleports.
        animQueueRef.current.push(nextAnim);
        setQueueTick(t => t + 1);
      } else {
        setAnimState(nextAnim);
      }
    }
  }, [lastMove, moveHistory?.length, players]);

  useEffect(() => {
    if (!animState) return;
    const group = animState.groups[animState.currentGroup] || [];
    if (group.length === 0) {
      const next = animQueueRef.current.shift();
      setAnimState(next || null);
      return;
    }
    const maxFrame = Math.max(...group.map(a => a.frames.length)) - 1;
    // Retreat (cut-return) frames play faster than the forward walk.
    const frameDelay = animState.currentGroup > 0 ? 70 : 120;

    if (animState.currentFrame >= maxFrame) {
      // The forward walk has finished — the mover has arrived, so play its
      // landing sound (finish / capture / safe spot) exactly on arrival.
      if (animState.currentGroup === 0 && animState.landingSound) {
        playSound(animState.landingSound);
      }
      // Move on to the next group (retreat phase) or finish the animation.
      if (animState.currentGroup < animState.groups.length - 1) {
        const t = setTimeout(() => {
          setAnimState(prev => prev ? { ...prev, currentGroup: prev.currentGroup + 1, currentFrame: 0 } : null);
        }, frameDelay);
        return () => clearTimeout(t);
      }
      // The last group just finished — if a piece was captured, its retreat
      // back home is complete too.
      if (animState.groups.length > 1) {
        playSound('sent_home');
      }
      const t = setTimeout(() => {
        const next = animQueueRef.current.shift();
        setAnimState(next || null);
      }, 150);
      return () => clearTimeout(t);
    }
    // Play a step sound on each cell the mover traverses (once per frame).
    if (lastMove && !lastMove.finish && !lastMove.killed && !isSafeSpot(players[lastMove.player]?.color, lastMove.to)) {
      playSound('piece_move');
    }
    const t = setTimeout(() => {
      setAnimState(prev => prev ? { ...prev, currentFrame: prev.currentFrame + 1 } : null);
    }, frameDelay);
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
    const animationLookup = {};
    if (animState) {
      // Only the current group's pieces animate with the frame counter.
      const group = animState.groups[animState.currentGroup] || [];
      for (const anim of group) {
        animationLookup[`${anim.playerId}-${anim.pieceId}`] = anim;
      }
      // Pieces in later groups are "held" at their starting position so a cut
      // piece stays on the board at its capture cell until the mover arrives.
      for (let g = animState.currentGroup + 1; g < animState.groups.length; g++) {
        for (const anim of animState.groups[g]) {
          animationLookup[`${anim.playerId}-${anim.pieceId}`] = { ...anim, held: true };
        }
      }
    }
    // Moves queued behind the current animation: hold each piece at the first
    // frame of its animation until its turn to play arrives.
    for (const q of animQueueRef.current) {
      for (const g of q.groups) {
        for (const anim of g) {
          const key = `${anim.playerId}-${anim.pieceId}`;
          if (!animationLookup[key]) {
            animationLookup[key] = { ...anim, held: true };
          }
        }
      }
    }

    for (const [pid, player] of Object.entries(players)) {
      for (const piece of player.pieces) {
        if (piece.isFinished) continue;

        const animation = animationLookup[`${pid}-${piece.id}`];
        const isAnimating = !!animation;

        let displayRow, displayCol, isHome;

        if (isAnimating) {
          // Held pieces stay at their first (starting) frame until their group
          // becomes active.
          const frameIndex = animation.held
            ? 0
            : Math.min(animState.currentFrame, animation.frames.length - 1);
          const coord = animation.frames[frameIndex];
          if (!coord) continue;
          displayRow = coord.row;
          displayCol = coord.col;
          isHome = frameIndex >= animation.frames.length - 1;
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
  }, [players, currentTurn, selectablePieceIds, animState, queueTick]);

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

  const fitRef = useRef(null);
  const fitSize = useFitSquare(fitRef);

  return (
    <div ref={fitRef} className="w-full h-full select-none">
      {fitSize > 0 && (
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="relative overflow-hidden"
            style={{
              width: fitSize,
              height: fitSize,
              borderRadius: '12px',
              border: '4px solid #0D3B0F',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              backgroundColor: '#1B5E20',
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
      )}
    </div>
  );
}

export default memo(GameBoard);
