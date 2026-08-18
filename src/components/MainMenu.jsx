import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

function MainMenu() {
  const navigate = useNavigate();
  const { resetState } = useGame();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-bg relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.06] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="panel-classic p-8 max-w-sm w-full relative">
        <div className="text-center mb-8">
          <img
            src="/textures/Board.png"
            alt="Ludo"
            className="w-20 h-20 mx-auto mb-4 rounded-xl border-4 border-[#3e2416] shadow-[4px_4px_0_#1e1109] object-cover"
            draggable={false}
          />
          <h1 className="game-title text-4xl font-bold mb-2">Ludo</h1>
          <p className="text-[#7a5c36] text-sm">Classic board game for 2-4 players</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { resetState(); navigate('/local'); }}
            className="btn-3d btn-3d-green btn-lg flex-1 rounded-none"
          >
            <span>Local Game</span>
          </button>

          <button
            onClick={() => navigate('/online')}
            className="btn-3d btn-3d-blue btn-lg flex-1 rounded-none"
          >
            <span>Online Multiplayer</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[#9a8b6e] text-xs">Choose a game mode to get started</p>
        </div>
      </div>
    </div>
  );
}

export default memo(MainMenu);
