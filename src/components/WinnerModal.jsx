import { memo, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useNetwork } from '../network/useNetwork';
import { COLOR_MAP } from '../data/constants';
import { playSound } from '../utils/sound';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function WinnerModal() {
  const { state, newGame, resetState } = useGame();
  const network = useNetwork();
  const navigate = useNavigate();
  const location = useLocation();
  const { gamePhase, rankings, players } = state;
  const [waitingRematch, setWaitingRematch] = useState(false);

  useEffect(() => {
    if (gamePhase === 'GAME_OVER' && rankings && rankings.length > 0) {
      playSound('win');
    }
  }, [gamePhase, rankings]);

  // Only show on an actual game screen. A game-over state left in memory (e.g.
  // after leaving a game via browser back) must not overlay other screens.
  if (location.pathname !== '/local' && location.pathname !== '/online/game') return null;
  if (gamePhase !== 'GAME_OVER' || !rankings || rankings.length === 0) return null;

  const winner = rankings[0];

  const handleMainMenu = () => {
    if (network.isMultiplayer) {
      resetState();
      network.leaveRoom();
    }
    playSound('navigate');
    navigate('/');
  };

  const handlePlayAgain = () => {
    if (network.isMultiplayer) {
      // Stay in the room: the host restarts the game, everyone rehydrates.
      if (network.isHost) {
        network.rematch();
      } else {
        network.requestRematch();
        playSound('rematch');
        setWaitingRematch(true);
      }
      return;
    }
    newGame();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: '#241510' }}>
      <div className="panel-classic p-6 md:p-8 max-w-sm w-full mx-4 animate-bounceIn">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="game-title text-2xl font-bold mb-2">Victory!</h2>

          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src={PIECE_IMAGES[winner.color]}
              alt=""
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
              draggable={false}
            />
            <div
              className="text-xl font-bold px-5 py-2 rounded-xl border-2"
              style={{
                color: COLOR_MAP[winner.color]?.dark,
                backgroundColor: COLOR_MAP[winner.color]?.bg,
                borderColor: COLOR_MAP[winner.color]?.primary,
              }}
            >
              {players[winner.playerId]?.name || winner.name}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h3 className="font-semibold text-[#5b3a1e]">Final Standings</h3>
            <div className="bg-[#efe2c0] rounded-xl p-2 space-y-1 border-2 border-[#a89363]">
              {rankings.map((r, i) => (
                <div
                  key={r.playerId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border-2"
                  style={{ backgroundColor: COLOR_MAP[r.color]?.bg || '#f9f9f9', borderColor: COLOR_MAP[r.color]?.primary }}
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
                  <span className="text-[#7a5c36] text-sm font-semibold">#{r.rank}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="btn-3d btn-3d-blue btn-md flex-1"
            >
              {network.isMultiplayer
                ? (network.isHost ? 'Rematch' : (waitingRematch ? 'Waiting for host…' : 'Request Rematch'))
                : 'Play Again'}
            </button>
            <button
              onClick={handleMainMenu}
              className="btn-3d btn-3d-gray btn-md flex-1"
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
