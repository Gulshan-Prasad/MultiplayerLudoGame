import { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { PLAYER_COLORS, PLAYER_NAMES_STORAGE_KEY, PLAYER_PICS_STORAGE_KEY } from '../data/constants';
import CoolNameInput from './CoolNameInput';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function SetupScreen() {
  const navigate = useNavigate();
  const { startGame } = useGame();
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_NAMES_STORAGE_KEY) || 'null');
      if (Array.isArray(saved) && saved.length === PLAYER_COLORS.length) return saved;
    } catch {
      // ignore malformed saved names
    }
    return ['Red', 'Green', 'Yellow', 'Blue'];
  });
  const [error, setError] = useState('');
  const [playerPics, setPlayerPics] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_PICS_STORAGE_KEY) || 'null');
      if (Array.isArray(saved)) {
        return PLAYER_COLORS.map((_, i) => saved[i] || null);
      }
    } catch {
      // ignore malformed saved pics
    }
    return PLAYER_COLORS.map(() => null);
  });

  // Remember the names locally so the user doesn't have to retype them.
  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_NAMES_STORAGE_KEY, JSON.stringify(playerNames));
    } catch {
      // storage may be unavailable; ignore
    }
  }, [playerNames]);

  // Remember the chosen pictures locally, same as the names.
  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_PICS_STORAGE_KEY, JSON.stringify(playerPics));
    } catch {
      // storage may be unavailable; ignore
    }
  }, [playerPics]);

  const handleNameChange = useCallback((index, value) => {
    setPlayerNames(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError('');
  }, []);

  const handlePicChange = useCallback((index, value) => {
    setPlayerPics(prev => {
      const next = [...prev];
      next[index] = value || null;
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    const names = playerNames.slice(0, playerCount);
    const emptyNames = names.filter(n => !n.trim());
    if (emptyNames.length > 0) {
      setError('Please enter names for all players');
      return;
    }
    if (new Set(names.map(n => n.trim().toLowerCase())).size !== names.length) {
      setError('Player names must be unique');
      return;
    }
    startGame(names.map((name, i) => ({
      name: name.trim(),
      color: PLAYER_COLORS[i],
      profilePic: playerPics[i] || null,
    })));
  }, [playerNames, playerCount, playerPics, startGame]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-bg relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="panel-classic p-4 sm:p-6 max-w-md w-full relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to main menu"
            className="btn-3d btn-3d-red btn-md w-11 h-11 flex items-center justify-center rounded-lg text-xl leading-none"
          >
            ←
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
            <span className="text-3xl">🎲</span>
            <h1 className="game-title text-2xl font-bold">Ludo Game</h1>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#5b3a1e] mb-1.5">
            Number of Players
          </label>
          <div className="flex gap-3">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => {
                  setPlayerCount(n);
                  setError('');
                }}
                className={`btn-3d btn-md flex-1 ${
                  playerCount === n ? 'btn-3d-gold' : 'btn-3d-cream'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <label className="block text-sm font-semibold text-[#5b3a1e]">Player Names</label>
          {PLAYER_COLORS.slice(0, playerCount).map((color, i) => (
            <div key={color}>
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={PIECE_IMAGES[color]}
                  alt=""
                  className="w-6 h-6 object-contain flex-shrink-0"
                  draggable={false}
                />
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a5c36]">
                  Player {i + 1}
                </span>
              </div>
              <CoolNameInput
                value={playerNames[i]}
                onChange={(v) => handleNameChange(i, v)}
                profilePic={playerPics[i]}
                onProfilePicChange={(v) => handlePicChange(i, v)}
                placeholder={`Player ${i + 1}`}
                variant="green"
                label={null}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="text-[#93302f] text-sm text-center mb-4 bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          className="btn-3d btn-3d-green btn-lg btn-block"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

export default memo(SetupScreen);
