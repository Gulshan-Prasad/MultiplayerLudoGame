import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { STORAGE_KEY } from '../data/constants';

function MainMenu() {
  const navigate = useNavigate();
  const { loadGame } = useGame();
  const savedGameExists = !!localStorage.getItem(STORAGE_KEY);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.06] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-white/20 relative">
        <div className="text-center mb-8">
          <img
            src="/textures/Board.png"
            alt="Ludo"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg ring-2 ring-white/20 object-cover"
            draggable={false}
          />
          <h1 className="text-4xl font-bold text-white mb-2">Ludo</h1>
          <p className="text-indigo-200 text-sm">Classic board game for 2-4 players</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/local')}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-bold
              rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
              transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>🎮</span>
            <span>Local Game</span>
          </button>

          <button
            onClick={() => navigate('/online')}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
              rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
              transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>🌐</span>
            <span>Online Multiplayer</span>
          </button>

          {savedGameExists && (
            <button
              onClick={() => { loadGame(); navigate('/local'); }}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-semibold
                rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
                transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>📂</span>
              <span>Load Saved Game</span>
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-indigo-300/40 text-xs">Choose a game mode to get started</p>
        </div>
      </div>
    </div>
  );
}

export default memo(MainMenu);
