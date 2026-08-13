import { useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGame } from './context/GameContext';
import { NetworkProvider } from './network/NetworkProvider';
import { useNetwork } from './network/useNetwork';
import { useNetworkGame } from './hooks/useNetworkGame';
import MainMenu from './components/MainMenu';
import SetupScreen from './components/SetupScreen';
import MultiplayerMenu from './components/MultiplayerMenu';
import MultiplayerLobby from './components/MultiplayerLobby';
import GameBoard from './components/GameBoard';
import Dice from './components/Dice';
import PlayerPanel from './components/PlayerPanel';
import ChatBox from './components/ChatBox';
import TurnActionButton from './components/TurnActionButton';
import CoolNameInput from './components/CoolNameInput';
import WinnerModal from './components/WinnerModal';
import { GAME_STATUS, GAME_PHASES, COLOR_MAP, STORAGE_KEY } from './data/constants';

const dotPositions = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DiceDot({ cx, cy }) {
  return <circle cx={`${cx}%`} cy={`${cy}%`} r="8%" fill="#3b2a1a" />;
}

function LeaveButton({ onClick, label = 'Leave', ariaLabel = 'Leave game' }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={label}
      className="btn-3d btn-3d-red btn-sm w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg p-0"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5 5-5M6 12h12" />
      </svg>
    </button>
  );
}

function GameScreenShell({ leaveButton, playerPanels, board, belowBoard, info, dice, actions, desktopChatOffset = false }) {
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col page-bg">
      <header className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 flex-shrink-0 min-w-0">
        {leaveButton}
      </header>

      <main className={`flex-1 min-h-0 flex gap-1.5 sm:gap-3 px-1.5 sm:px-3 py-1.5 sm:py-3 min-w-0 ${desktopChatOffset ? 'lg:pr-[268px]' : ''}`}>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5 sm:gap-2">
          <div className="w-full aspect-square min-h-0 [@media(min-width:768px)_and_(min-height:500px)]:aspect-auto [@media(min-width:768px)_and_(min-height:500px)]:flex-1">
            {board}
          </div>
          {playerPanels && (
            <div className="flex-shrink-0 w-full min-w-0">{playerPanels}</div>
          )}
          {belowBoard && (
            <div className="flex-shrink-0 hidden [@media(min-width:768px)_and_(min-height:500px)]:flex justify-center min-w-0">{belowBoard}</div>
          )}

          <div className="w-full [@media(min-width:768px)_and_(min-height:500px)]:hidden flex flex-col gap-1.5">
            <div className="w-full card-classic p-1.5 sm:p-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 min-w-0">
              <div className="min-w-0 flex items-center">
                {info}
              </div>
              <div className="flex flex-col items-center justify-center h-[196px] sm:h-[244px]">
                {dice}
                <div className="h-[48px] flex items-center justify-center w-full min-w-0">
                  {belowBoard}
                </div>
              </div>
              <div className="min-w-0" />
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        </div>

        <aside className="hidden [@media(min-width:768px)_and_(min-height:500px)]:flex [@media(min-width:768px)_and_(min-height:500px)]:flex-col w-60 md:w-72 xl:w-80 flex-shrink-0 gap-2 min-h-0">
          <div className="card-classic p-3 sm:p-4 flex-shrink-0 h-[330px] flex flex-col items-center justify-center overflow-hidden">
            {info}
            <div className="mt-2 sm:mt-3 flex-shrink-0">{dice}</div>
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </aside>
      </main>
    </div>
  );
}

function MultiplayerGameContent() {
  const game = useNetworkGame();
  const network = useNetwork();
  const navigate = useNavigate();
  const { state, endTurn, rollDice, selectPiece } = game;
  const { players, currentTurn, gamePhase, diceValue, diceRolling, consecutiveSixes } = state;
  const [shaking, setShaking] = useState(false);
  const [landing, setLanding] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const rolling = shaking || diceRolling;

  // While rolling, cycle through random faces so the die looks alive.
  useEffect(() => {
    if (!rolling) return undefined;
    const id = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 80);
    return () => clearInterval(id);
  }, [rolling]);

  // When rolling stops, settle on the real rolled value.
  useEffect(() => {
    if (!rolling && diceValue > 0) {
      setDisplayValue(diceValue);
    }
  }, [rolling, diceValue]);

  const handleRoll = () => {
    if (gamePhase !== GAME_PHASES.ROLLING || diceRolling) return;
    setLanding(false);
    setShaking(true);
    rollDice();
    setTimeout(() => {
      setShaking(false);
      setLanding(true);
    }, 500);
    setTimeout(() => setLanding(false), 950);
  };

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];
  const isMyTurn = network.myPlayerId === currentTurn;
  const isActivePlayer = network.isMultiplayer ? isMyTurn : true;

  const showPenalty = consecutiveSixes >= 3 && gamePhase === GAME_PHASES.TURN_COMPLETE;

  const leaveButton = (
    <LeaveButton
      onClick={() => { game.resetState(); network.leaveRoom(); navigate('/'); }}
      label="Leave"
      ariaLabel="Leave game"
    />
  );

  const playerPanels = (
    <div
      className="player-grid flex-1 min-w-0 gap-1 sm:gap-1.5"
      style={{ '--player-count': playerEntries.length }}
    >
      {playerEntries.map(([pid, player]) => (
        <PlayerPanel
          key={pid}
          playerId={pid}
          player={player}
          isCurrentTurn={pid === currentTurn}
          isMe={pid === network.myPlayerId}
        />
      ))}
    </div>
  );

  const info = (
    <div className="text-center min-w-0">
      <div className="text-sm sm:text-lg font-bold truncate game-title" style={{ color: COLOR_MAP[currentPlayer?.color]?.dark }}>
        {currentPlayer?.name}'s Turn
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5 sm:mt-1">
        {isActivePlayer && (
          <span className="badge-classic bg-[#EFE2C0] text-[#5b3a1e] border-[#a89363]">{network.isHost ? 'Host' : 'Client'}</span>
        )}
        <span className={`badge-classic ${
          network.connectionStatus === 'connected'
            ? 'bg-[#e7f4e5] text-[#1b6b2e] border-[#2f9e44]'
            : 'bg-[#fde8e8] text-[#93302f] border-[#d64545]'
        }`}>
          {network.connectionStatus}
        </span>
      </div>
      <div className="h-4 sm:h-5 mt-0.5 sm:mt-1 flex items-center justify-center min-w-0">
        {!isActivePlayer && network.isMultiplayer && gamePhase !== GAME_PHASES.GAME_OVER && (
          <span className="text-[10px] sm:text-xs text-[#9a8b6e] animate-pulse truncate">
            Waiting for {currentPlayer?.name}...
          </span>
        )}
        {isActivePlayer && gamePhase === GAME_PHASES.SELECTING_PIECE && (
          <span className="text-[10px] sm:text-xs text-[#7a5c36]">
            Select a piece to move
          </span>
        )}
      </div>
    </div>
  );

  const dice = (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
      {showPenalty && (
        <div className="text-[#93302f] font-bold text-[10px] sm:text-xs md:text-sm animate-bounce bg-[#fde8e8] border-2 border-[#d64545] px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-center">
          Three 6's! Turn forfeited!
        </div>
      )}

      <div
        className={`
          relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl select-none
          transition-all duration-300 dice-3d
          ${gamePhase === GAME_PHASES.ROLLING && !diceRolling && isActivePlayer
            ? 'cursor-pointer hover:scale-110 hover:shadow-xl active:scale-95 animate-dice-wiggle'
            : 'dice-3d-idle opacity-70'}
          ${shaking || diceRolling ? 'animate-dice-roll' : ''}
          ${!shaking && !diceRolling && landing ? 'animate-dice-land' : ''}
        `}
        onClick={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? handleRoll : undefined}
        role="button"
        aria-label={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? 'Roll dice' : 'Dice'}
        tabIndex={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? 0 : -1}
        onKeyDown={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleRoll(); }
          : undefined}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <rect x="5" y="5" width="90" height="90" rx="15" fill="white" stroke="#9c7a0e" strokeWidth="2" />
          {(rolling ? displayValue : (diceValue > 0 ? diceValue : displayValue)) > 0
            && (dotPositions[rolling ? displayValue : (diceValue > 0 ? diceValue : displayValue)] || []).map((pos, i) => (
              <DiceDot key={i} cx={pos[0]} cy={pos[1]} />
            ))}
        </svg>
      </div>

      <TurnActionButton
        onRoll={handleRoll}
        onEndTurn={endTurn}
        showCooldown
        isActive={isActivePlayer}
        waitingName={currentPlayer?.name}
      />
    </div>
  );

  const belowBoard = (() => {
    if (gamePhase === GAME_PHASES.GAME_OVER) {
      return (
        <div className="text-center text-sm sm:text-lg font-bold text-[#1b6b2e] bg-[#e7f4e5] border-2 border-[#2f9e44] p-2 sm:p-3 rounded-lg">
          Game Over! Check rankings.
        </div>
      );
    }
    return null;
  })();

  return (
    <GameScreenShell
      leaveButton={leaveButton}
      playerPanels={playerPanels}
      board={<GameBoard onSelectPiece={selectPiece} />}
      belowBoard={belowBoard}
      info={info}
      dice={dice}
      desktopChatOffset
    />
  );
}

function LocalGameContent() {
  const { state, saveGame, loadGame, undoMove, newGame, resetState } = useGame();
  const navigate = useNavigate();
  const { gameStatus, players, currentTurn, gamePhase, moveHistory } = state;
  const hasSavedGame = !!localStorage.getItem(STORAGE_KEY);

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];

  const leaveButton = (
    <LeaveButton
      onClick={() => { resetState(); navigate('/'); }}
      label="Main Menu"
      ariaLabel="Back to main menu"
    />
  );

  const playerPanels = (
    <div
      className="player-grid flex-1 min-w-0 gap-1 sm:gap-1.5"
      style={{ '--player-count': playerEntries.length }}
    >
      {playerEntries.map(([pid, player]) => (
        <PlayerPanel
          key={pid}
          playerId={pid}
          player={player}
          isCurrentTurn={pid === currentTurn}
        />
      ))}
    </div>
  );

  const info = (
    <div className="text-center min-w-0">
      <div className="text-sm sm:text-lg font-bold truncate game-title" style={{ color: COLOR_MAP[currentPlayer?.color]?.dark }}>
        {currentPlayer?.name}'s Turn
      </div>
      <div className="h-4 sm:h-5 mt-0.5 sm:mt-1 flex items-center justify-center text-[10px] sm:text-xs text-[#7a5c36]">
        {gamePhase === GAME_PHASES.SELECTING_PIECE && 'Select a piece to move'}
        {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
      </div>
    </div>
  );

  const dice = (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
      <Dice />
    </div>
  );

  const belowBoard = (() => {
    if (gamePhase === GAME_PHASES.GAME_OVER) {
      return (
        <div className="text-center text-sm sm:text-lg font-bold text-[#1b6b2e] bg-[#e7f4e5] border-2 border-[#2f9e44] p-2 sm:p-3 rounded-lg">
          Game Over! Check rankings.
        </div>
      );
    }
    return null;
  })();

  const actions = (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <button
        onClick={newGame}
        className="btn-3d btn-3d-red btn-sm flex-1 min-w-[64px]"
      >
        New
      </button>
      <button
        onClick={saveGame}
        className="btn-3d btn-3d-green btn-sm flex-1 min-w-[64px]"
        disabled={gameStatus !== GAME_STATUS.IN_PROGRESS}
      >
        Save
      </button>
      {hasSavedGame && (
        <button
          onClick={loadGame}
          className="btn-3d btn-3d-purple btn-sm flex-1 min-w-[64px]"
        >
          Load
        </button>
      )}
      <button
        onClick={undoMove}
        className="btn-3d btn-3d-gray btn-sm flex-1 min-w-[64px]"
        disabled={moveHistory.length === 0 || gamePhase === GAME_PHASES.GAME_OVER}
      >
        Undo
      </button>
    </div>
  );

  return (
    <GameScreenShell
      leaveButton={leaveButton}
      playerPanels={playerPanels}
      board={<GameBoard />}
      belowBoard={belowBoard}
      info={info}
      dice={dice}
      actions={actions}
    />
  );
}

function LocalGameView() {
  const { state, resetState } = useGame();
  const { gameStatus } = state;

  // If a stale online-game state leaked into local mode, wipe it and start fresh.
  const isMultiplayerResidue = state.sequence != null;
  useEffect(() => {
    if (isMultiplayerResidue) resetState();
  }, [isMultiplayerResidue, resetState]);

  if (!isMultiplayerResidue && gameStatus !== GAME_STATUS.NOT_STARTED) {
    return <LocalGameContent />;
  }

  return <SetupScreen />;
}

function MultiplayerGameView() {
  const network = useNetwork();

  if (!network.isMultiplayer) {
    return <Navigate to="/online" replace />;
  }

  return <MultiplayerGameContent />;
}

function OnlineView() {
  const network = useNetwork();
  const navigate = useNavigate();

  useEffect(() => {
    if (network.roomCode && network.lobby) {
      navigate(`/online/${network.roomCode}`, { replace: true });
    }
  }, [network.lobby, network.roomCode, navigate]);

  if (network.roomCode && network.lobby) {
    return <Navigate to={`/online/${network.roomCode}`} replace />;
  }

  return <MultiplayerMenu />;
}

function OnlineRoomView() {
  const { roomCode: routeCode } = useParams();
  const network = useNetwork();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [error, setError] = useState('');

  const code = (routeCode || '').toUpperCase().replace(/\s/g, '');

  // Already connected to this exact room -> show the lobby.
  if (network.roomCode === code && network.lobby) {
    return <MultiplayerLobby />;
  }

  // Join pressed and we're now connecting/receiving the lobby for this room.
  const isConnecting = network.roomCode === code && !network.lobby;

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    const ok = network.joinRoom(code, playerName.trim(), profilePic);
    if (!ok) setError('Invalid room code');
  };

  const statusText = isConnecting
    ? (network.connectionStatus === 'connected'
        ? 'Connected — waiting for room info…'
        : network.connectionStatus === 'reconnecting'
          ? 'Connection lost — reconnecting…'
          : network.connectionStatus === 'disconnected'
            ? 'Connection failed — retrying…'
            : 'Connecting to game server…')
    : null;

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
          <div className="text-4xl mb-2">🎮</div>
          <h1 className="game-title text-2xl font-bold">Join Room</h1>
          <p className="text-[#7a5c36] text-sm mt-1">Enter your name to join this game</p>
        </div>

        <div className="card-classic p-4 mb-4 text-center">
          <div className="text-xs text-[#7a5c36] mb-1">Room Code</div>
          <div className="room-code-classic text-3xl px-4 py-2 select-all">
            {code}
          </div>
        </div>

        <div className="mb-4">
          <CoolNameInput
            value={playerName}
            onChange={(v) => { setPlayerName(v); setError(''); }}
            profilePic={profilePic}
            onProfilePicChange={setProfilePic}
            disabled={isConnecting}
          />
        </div>

        {error && (
          <div className="text-[#93302f] text-sm text-center mb-4 bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          className="btn-3d btn-3d-green btn-lg btn-block"
          disabled={isConnecting}
        >
          {isConnecting ? 'Joining…' : 'Join Room'}
        </button>

        {statusText && (
          <div className="mt-3 card-classic p-3 flex items-center gap-3">
            <div className="w-5 h-5 shrink-0 animate-spin rounded-full border-[3px] border-[#d8c8a4] border-t-[#9c7a0e]" />
            <div className="text-[#7a5c36] text-sm font-medium">{statusText}</div>
          </div>
        )}

        {network.networkError && (
          <div className="mt-3 text-[#93302f] text-sm text-center bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {network.networkError}
          </div>
        )}

        <button
          onClick={() => navigate('/online')}
          className="w-full py-2 mt-3 text-[#7a5c36] hover:text-[#9c7a0e] text-sm transition-colors"
        >
          ← Back to Online Menu
        </button>
      </div>
    </div>
  );
}

function DisconnectBanner() {
  const network = useNetwork();
  const location = useLocation();
  if (!network.disconnectNotice) return null;
  // Only show inside the online flow; a notice can be stale after leaving a
  // session via browser back.
  if (!location.pathname.startsWith('/online')) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div className="btn-3d btn-3d-red btn-md px-4 py-2 text-sm shadow-lg animate-slideIn">
        ⚠ {network.disconnectNotice}
      </div>
    </div>
  );
}

function RoutesWithGameStateHandler() {
  const { hydrateState, resetState } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Tracks whether the user is currently inside the online (lobby/game) flow.
  // A ref (not a dep) so the live message handlers always read the *current*
  // value even though they were registered when the connection was created.
  const inOnlineFlowRef = useRef(location.pathname.startsWith('/online'));
  useEffect(() => {
    inOnlineFlowRef.current = location.pathname.startsWith('/online');
  }, [location.pathname]);

  // Leaving a local game (including browser back) wipes the in-memory board so
  // you never return to a "previous game".
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev === '/local' && location.pathname !== '/local') {
      resetState();
    }
  }, [location.pathname, resetState]);

  const handleGameStateReceived = useCallback((newState) => {
    // Only hydrate/navigate while the user is actually in the online flow.
    // After leaving via browser back, late or stale game-state broadcasts must
    // not yank the user back into a game (or overwrite a local game in memory).
    if (newState && newState.players && inOnlineFlowRef.current) {
      hydrateState(newState);
      navigate('/online/game', { replace: true });
    }
  }, [hydrateState, navigate]);

  return (
    <NetworkProvider onGameStateReceived={handleGameStateReceived}>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/local" element={<LocalGameView />} />
        <Route path="/online" element={<OnlineView />} />
        <Route path="/online/:roomCode" element={<OnlineRoomView />} />
        <Route path="/online/game" element={<MultiplayerGameView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatBox />
      <DisconnectBanner />
      <WinnerModal />
    </NetworkProvider>
  );
}

function App() {
  return (
    <HashRouter>
      <RoutesWithGameStateHandler />
    </HashRouter>
  );
}

export default App;
