import { memo } from 'react';
import { BOARD_SIZE } from '../data/constants';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

const PIECE_IMAGES_HIGHLIGHTED = {
  red: '/textures/pieces/RedPlayerHighlighted.png',
  green: '/textures/pieces/GreenPlayerHighlighted.png',
  yellow: '/textures/pieces/YellowPlayerHighlighted.png',
  blue: '/textures/pieces/BluePlayerHighlighted.png',
};

const CELL_FRACTION = 1 / BOARD_SIZE;
const PIECE_SIZE_FRACTION = 0.85;
// Small nudge upward (as a fraction of a cell) so pieces sit slightly above
// the cell center.
const PIECE_TOP_OFFSET = 0.07;
const PIECE_SIZE = `${(PIECE_SIZE_FRACTION * CELL_FRACTION * 100).toFixed(3)}%`;

function Piece({ playerColor, piece, isSelectable, isSelected, justMoved, onClick, cellRow, cellCol, offsetX = 0, offsetY = 0 }) {
  const isFinished = piece.isFinished;
  const isHighlighted = isSelectable || isSelected;

  const left = `calc(${cellCol} * ${CELL_FRACTION * 100}% + 50% * ${CELL_FRACTION} + ${offsetX * CELL_FRACTION * 100}% - ${PIECE_SIZE} / 2)`;
  const top = `calc(${cellRow} * ${CELL_FRACTION * 100}% + 50% * ${CELL_FRACTION} + ${offsetY * CELL_FRACTION * 100}% - ${PIECE_SIZE} / 2 - ${PIECE_TOP_OFFSET * CELL_FRACTION * 100}%)`;

  const glowClass = isSelected
    ? 'piece-highlighted cursor-pointer'
    : isSelectable
    ? 'piece-highlighted cursor-pointer hover:scale-110'
    : justMoved
    ? 'drop-shadow-[0_0_6px_rgba(255,215,0,0.8)] scale-105'
    : '';

  const animClass = justMoved && !isSelectable ? 'animate-bounceIn' : '';

  return (
    <img
      src={isHighlighted ? PIECE_IMAGES_HIGHLIGHTED[playerColor] : PIECE_IMAGES[playerColor]}
      alt={`${playerColor} piece ${piece.id + 1}`}
      className={`absolute ${glowClass} ${animClass} transition-all duration-300 pointer-events-auto`}
      style={{
        left,
        top,
        width: PIECE_SIZE,
        height: PIECE_SIZE,
        objectFit: 'contain',
        opacity: isFinished ? 0.5 : 1,
        zIndex: isSelectable || isSelected ? 20 : 10,
      }}
      onClick={isSelectable ? onClick : undefined}
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : -1}
      onKeyDown={isSelectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      draggable={false}
    />
  );
}

export default memo(Piece);
