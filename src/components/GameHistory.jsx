import { memo, useRef, useEffect } from 'react';

function GameHistory({ moveHistory = [], players = {} }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [moveHistory.length]);

  if (!moveHistory || moveHistory.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic px-2">No moves yet</div>
    );
  }

  const formatPos = (pos) => {
    if (pos === -1) return 'Home';
    if (pos === 56) return 'Finish';
    if (pos >= 51 && pos < 56) return `HS${pos - 50}`;
    return `P${pos}`;
  };

  return (
    <div
      ref={scrollRef}
      className="max-h-48 overflow-y-auto space-y-1 px-2"
    >
      {moveHistory.slice(0, 20).map((move, idx) => {
        const player = players[move.player];
        const color = player?.color || 'gray';
        const colorMap = { red: '#E53935', green: '#43A047', yellow: '#FDD835', blue: '#1E88E5' };
        const dotColor = colorMap[color] || '#999';

        return (
          <div key={idx} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
            <span
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <span className="text-gray-700">
              {player?.name || move.player}:
            </span>
            <span className="text-gray-600">
              Piece {move.piece + 1}
            </span>
            <span className="text-gray-400">
              {formatPos(move.from)} → {formatPos(move.to)}
            </span>
            {move.killed && <span className="text-red-500 font-bold">⚔</span>}
            {move.finish && <span className="text-green-500 font-bold">✓</span>}
          </div>
        );
      })}
    </div>
  );
}

export default memo(GameHistory);
