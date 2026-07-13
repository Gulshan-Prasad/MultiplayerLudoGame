import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { COLOR_MAP } from '../data/constants';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function WinnerModal() {
  const { state, newGame } = useGame();
  const navigate = useNavigate();
  const { gamePhase, rankings, players } = state;

  if (gamePhase !== 'GAME_OVER' || !rankings || rankings.length === 0) return null;

  const winner = rankings[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-yellow-50 to-orange-50 rounded-3xl shadow-2xl p-6 md:p-8 max-w-sm w-full mx-4 transform border-2 border-yellow-300">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Victory!</h2>

          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src={PIECE_IMAGES[winner.color]}
              alt=""
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
              draggable={false}
            />
            <div
              className="text-xl font-bold px-5 py-2 rounded-xl"
              style={{
                color: COLOR_MAP[winner.color]?.dark,
                backgroundColor: COLOR_MAP[winner.color]?.bg,
              }}
            >
              {players[winner.playerId]?.name || winner.name}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h3 className="font-semibold text-gray-700">Final Standings</h3>
            <div className="bg-white/60 rounded-xl p-2 space-y-1">
              {rankings.map((r, i) => (
                <div
                  key={r.playerId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ backgroundColor: COLOR_MAP[r.color]?.bg || '#f9f9f9' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg w-6">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅'}</span>
                    <img
                      src={PIECE_IMAGES[r.color]}
                      alt=""
                      className="w-5 h-5 object-contain"
                      draggable={false}
                    />
                    <span className="font-medium text-gray-800">
                      {players[r.playerId]?.name || r.name}
                    </span>
                  </div>
                  <span className="text-gray-500 text-sm font-semibold">#{r.rank}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={newGame}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
                rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
                transition-all duration-200"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-gray-500 to-gray-700 text-white font-bold
                rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
                transition-all duration-200"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(WinnerModal);
