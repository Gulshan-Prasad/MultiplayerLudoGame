import { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetwork } from '../network/useNetwork';
import { PLAYER_NAME_STORAGE_KEY } from '../data/constants';
import CoolNameInput from './CoolNameInput';

const PLAYER_ICON = '/textures/icon/Player.png';

function PlayerCountButton({ count, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`${count} players`}
      className={`relative aspect-square flex-1 rounded-xl border-none flex items-center justify-center transition-all ${
        selected
          ? 'btn-3d btn-3d-gold'
          : 'btn-3d btn-3d-cream'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ maxWidth: 76 }}
    >
      <div className="flex flex-wrap items-center justify-center gap-0.5 px-1">
        {Array.from({ length: count }).map((_, i) => (
          <img
            key={i}
            src={PLAYER_ICON}
            alt=""
            className="w-6 h-6 object-contain"
            draggable={false}
          />
        ))}
      </div>
      <span
        className={`absolute top-1 right-1.5 text-xs font-bold ${
          selected ? 'text-white' : 'text-[#5b3a1e]'
        }`}
        style={{ textShadow: selected ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 0 rgba(255,255,255,0.5)' }}
      >
        {count}
      </span>
    </button>
  );
}

function MultiplayerMenu() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, networkError, lobby } = useNetwork();
  const [mode, setMode] = useState(null);
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [profilePic, setProfilePic] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Remember the name locally so the user doesn't have to retype it.
  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
    } catch {
      // storage may be unavailable; ignore
    }
  }, [playerName]);

  // Stay in a locked "connecting…" state until we land in the lobby.
  // Clear it on failure so the player can retry.
  useEffect(() => {
    if (networkError || lobby) setBusy(false);
  }, [networkError, lobby]);

  // If the lobby never arrives, don't leave the player stuck on a spinner.
  useEffect(() => {
    if (!busy) return undefined;
    const t = setTimeout(() => {
      setBusy(false);
      setError('Timed out connecting to that room. Check the code and try again.');
    }, 20000);
    return () => clearTimeout(t);
  }, [busy]);

  const handleCreateRoom = useCallback(() => {
    if (busy) return;
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    setError('');
    setBusy(true);
    createRoom(playerName.trim(), maxPlayers, profilePic);
  }, [busy, playerName, maxPlayers, createRoom, profilePic]);

  const handleJoinRoom = useCallback(() => {
    if (busy) return;
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    const code = joinCode.trim().toUpperCase().replace(/\s/g, '');
    setError('');
    setBusy(true);
    const success = joinRoom(code, playerName.trim(), profilePic);
    if (!success) {
      setBusy(false);
      setError('Invalid room code');
    }
  }, [busy, playerName, joinCode, joinRoom, profilePic]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-bg relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="panel-classic p-6 md:p-8 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <h1 className="game-title text-2xl font-bold">Online Multiplayer</h1>
          <p className="text-[#7a5c36] text-sm mt-1">Play with friends over the internet</p>
        </div>

        <div className="mb-4">
          <CoolNameInput
            value={playerName}
            onChange={(v) => { setPlayerName(v); setError(''); }}
            profilePic={profilePic}
            onProfilePicChange={setProfilePic}
            disabled={busy}
          />
        </div>

        {!mode && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setMode('create')}
              disabled={busy}
              className="btn-3d btn-3d-amber btn-lg py-8"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={busy}
              className="btn-3d btn-3d-blue btn-lg py-8"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-[#5b3a1e] mb-1">Max Players</label>
              <div className="flex gap-2 justify-center">
                {[2, 3, 4].map(n => (
                  <PlayerCountButton
                    key={n}
                    count={n}
                    selected={maxPlayers === n}
                    disabled={busy}
                    onClick={() => setMaxPlayers(n)}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={busy}
              className="btn-3d btn-3d-green btn-lg btn-block"
            >
              {busy ? 'Creating Room…' : 'Create Room'}
            </button>
            <button
              onClick={() => setMode(null)}
              disabled={busy}
              className="w-full py-2 text-[#7a5c36] hover:text-[#9c7a0e] text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-[#5b3a1e] mb-1">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                placeholder="Enter 6-character code"
                className="input-classic px-3 py-2 text-center font-mono tracking-widest"
                maxLength={6}
                disabled={busy}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={busy}
              className="btn-3d btn-3d-blue btn-lg btn-block"
            >
              {busy ? 'Connecting…' : 'Join Room'}
            </button>
            <button
              onClick={() => setMode(null)}
              disabled={busy}
              className="w-full py-2 text-[#7a5c36] hover:text-[#9c7a0e] text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {busy && (
          <div className="mb-4 card-classic p-3 flex items-center gap-3">
            <div className="w-5 h-5 shrink-0 animate-spin rounded-full border-[3px] border-[#d8c8a4] border-t-[#9c7a0e]" />
            <div className="text-[#7a5c36] text-sm font-medium">
              {mode === 'create' ? 'Creating your room…' : 'Connecting to game server…'}
            </div>
          </div>
        )}

        {error && (
          <div className="text-[#93302f] text-sm text-center bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {error}
          </div>
        )}

        {networkError && (
          <div className="text-[#93302f] text-sm text-center bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {networkError}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-2 mt-2 text-[#7a5c36] hover:text-[#9c7a0e] text-sm transition-colors"
        >
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
}

export default memo(MultiplayerMenu);
