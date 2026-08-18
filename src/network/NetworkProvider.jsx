import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NetworkContext } from './useNetwork';
import { ConnectionManager } from './ConnectionManager';
import { SyncManager } from './SyncManager';
import { MESSAGE_TYPES } from './NetworkMessages';
import { generateRoomCode, validateRoomCode, createDefaultLobby, addPlayerToLobby, removePlayerFromLobby, updatePlayerReady, updatePlayerProfilePic } from './RoomManager';
import { deserializeGameState } from './GameSerializer';
import { CONNECTION_STATUS, NETWORK_ROLE } from './NetworkConstants';
import { GAME_PHASES, GAME_STATUS } from '../data/constants';
import { playSound } from '../utils/sound';

const _correctTurnTimer = (state, hostBroadcastTimestamp) => {
  if (!state || !state.turnTimer) return state;
  const hostElapsed = (hostBroadcastTimestamp || 0) - state.turnTimer;
  const clientTurnTimer = Date.now() - Math.max(0, hostElapsed);
  return { ...state, turnTimer: clientTurnTimer };
};

export function NetworkProvider({ children, onGameStateReceived }) {
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [networkRole, setNetworkRole] = useState(NETWORK_ROLE.NONE);
  const [roomCode, setRoomCode] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [networkError, setNetworkError] = useState(null);
  const [disconnectNotice, setDisconnectNotice] = useState(null);
  const [peerIds, setPeerIds] = useState([]);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [kicked, setKicked] = useState(false);

  const connRef = useRef(null);
  const syncRef = useRef(null);
  const playerNameRef = useRef('');
  const playerProfilePicRef = useRef(null);
  const playerIdRef = useRef(null);
  const lobbyRef = useRef(null);
  const hostPeerIdRef = useRef(null);
  const networkRoleRef = useRef(NETWORK_ROLE.NONE);
  const joinRetryTimerRef = useRef(null);
  const disconnectNoticeTimerRef = useRef(null);
  const gameStateRef = useRef(null);

  const _stopJoinRetry = useCallback(() => {
    if (joinRetryTimerRef.current) {
      clearInterval(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, []);

  const _setupConnection = useCallback((roomCodeVal, playerName, profilePic) => {
    playerNameRef.current = playerName;
    if (profilePic !== undefined) playerProfilePicRef.current = profilePic || null;

    if (!connRef.current) {
      connRef.current = new ConnectionManager();
    }

    // A fresh connection must never inherit state (gameStateRef, authoritative
    // game, pending AFK timers, join retries, or stale peer/lobby ids) from a
    // previous room. If the user left an earlier game via browser back, that
    // manager is still alive — tear it down so a stale broadcast can't
    // auto-start the new room's game or misfire on old peers.
    _stopJoinRetry();
    gameStateRef.current = null;
    lobbyRef.current = null;
    hostPeerIdRef.current = null;
    playerIdRef.current = null;
    if (syncRef.current) {
      syncRef.current.destroy();
      syncRef.current = null;
    }

    const _prevPeerIdsRef = { current: [] };
    connRef.current.onPeersChange = (peers) => {
      const myId = connRef.current?.myPeerId;
      console.log('[Ludo] onPeersChange fired, peers:', peers, 'myId:', myId);
      if (!myId) return;
      const newPeerIds = [myId, ...peers];
      setPeerIds(newPeerIds);
      setConnectionStatus(CONNECTION_STATUS.CONNECTED);

      const oldPeerIds = _prevPeerIdsRef.current;
      const leftPeerIds = oldPeerIds.filter(pid => pid !== myId && !newPeerIds.includes(pid));
      const currentLobby = lobbyRef.current;
      const departedColors = [];
      if (leftPeerIds.length > 0 && currentLobby) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        for (const leftPid of leftPeerIds) {
          const playerEntry = currentLobby.players.find(p => p.id === leftPid);
          const playerColor = playerEntry ? playerEntry.color : null;
          if (playerColor && colors.includes(playerColor)) {
            console.log(`[Ludo] Peer disconnected: ${leftPid} (${playerColor}), updating game state`);
            departedColors.push(playerColor);
            if (syncRef.current) {
              syncRef.current.handlePlayerDisconnect(playerColor);
            }
          }
          setLobby(prev => {
            const updated = removePlayerFromLobby(prev, leftPid);
            lobbyRef.current = updated;
            return updated;
          });
        }
      }
      _prevPeerIdsRef.current = newPeerIds;

      // Host migration: when the old host drops, the lowest remaining peer
      // (deterministic election via getHostPeerId) becomes the new host. If
      // that's us, promote ourselves and take over the authoritative game
      // (which also removes the departed host's pieces). Everyone else just
      // repoints at the new host and resyncs, so a dropped host never
      // softlocks the room.
      const prevHostId = hostPeerIdRef.current;
      const newHostId = connRef.current.getHostPeerId();
      const oldHostLeft = !!prevHostId && leftPeerIds.includes(prevHostId);

      if (oldHostLeft) {
        hostPeerIdRef.current = newHostId;

        if (newHostId === myId) {
          console.log('[Ludo] Old host left; I am now the host');
          networkRoleRef.current = NETWORK_ROLE.HOST;
          setNetworkRole(NETWORK_ROLE.HOST);

          setLobby(prev => {
            if (!prev) return prev;
            const players = prev.players.map(p => ({ ...p, isHost: p.id === myId }));
            const updated = { ...prev, players, hostId: myId };
            lobbyRef.current = updated;
            return updated;
          });

          const last = gameStateRef.current;
          if (last && last.gameStatus === GAME_STATUS.IN_PROGRESS && last.players && syncRef.current) {
            syncRef.current.takeoverAsHost(last, departedColors);
          }
        } else {
          console.log('[Ludo] Old host left; new host is', newHostId.slice(0, 8) + '...');
          connRef.current?.sendToPeer(MESSAGE_TYPES.FULL_STATE_SYNC, { request: true }, newHostId);
        }
      }

      if (peers.length > 0 && networkRoleRef.current === NETWORK_ROLE.CLIENT) {
        console.log('[Ludo] Sending JOIN_ROOM as client');
        connRef.current?.sendToAll(MESSAGE_TYPES.JOIN_ROOM, {
          player: {
            id: myId,
            name: playerNameRef.current,
            color: null,
            isReady: false,
            isHost: false,
            isConnected: true,
            profilePic: playerProfilePicRef.current || null,
          }
        });
      }
    };

    const peerId = connRef.current.createOrJoinRoom(roomCodeVal);
    playerIdRef.current = peerId;
    setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    connRef.current.onStatusChange = (status) => {
      if (status === 'connected') {
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      } else if (status === 'offline' || status === 'reconnecting') {
        setConnectionStatus(CONNECTION_STATUS.RECONNECTING);
      }
    };

    connRef.current.onConnectionFailed = (msg) => {
      console.error('[Ludo] Connection to game server failed:', msg);
      setNetworkError(msg || 'Failed to connect to the game server. Check your internet connection and try again.');
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    };

    connRef.current.onPeerDisconnected = (peerId, type) => {
      console.log('[Ludo] Peer disconnected (LWT/immediate):', peerId.slice(0, 8) + '...');
      const currentLobby = lobbyRef.current;
      const playerEntry = currentLobby?.players.find(p => p.id === peerId);
      if (playerEntry) {
        setDisconnectNotice(type === MESSAGE_TYPES.LEAVE_ROOM
          ? `${playerEntry.name} left the game`
          : `${playerEntry.name} disconnected`);
        clearTimeout(disconnectNoticeTimerRef.current);
        disconnectNoticeTimerRef.current = setTimeout(() => setDisconnectNotice(null), 5000);
      }
    };

    syncRef.current = new SyncManager(connRef.current);

    syncRef.current.onStateUpdate = (state) => {
      gameStateRef.current = state;
      if (onGameStateReceived) onGameStateReceived(state);
    };

    syncRef.current.setupListeners();

    connRef.current.onMessageType(MESSAGE_TYPES.JOIN_ROOM, (data, pId) => {
      console.log('[Ludo] Received JOIN_ROOM from:', pId.slice(0, 8) + '...', 'lobbyRef ready:', !!lobbyRef.current);
      const currentLobby = lobbyRef.current;
      if (!currentLobby) {
        console.warn('[Ludo] Lobby not ready yet, deferring join (client will retry)');
        return;
      }
      const updated = addPlayerToLobby(currentLobby, data.player);
      if (updated !== currentLobby) {
        lobbyRef.current = updated;
        setLobby(updated);
        console.log('[Ludo] Player added to lobby:', data.player.name, 'total:', updated.players.length, '- sending ROOM_INFO to:', pId.slice(0, 8) + '...');
        connRef.current?.sendToPeer(MESSAGE_TYPES.ROOM_INFO, { lobby: updated }, pId);
      } else {
        console.log('[Ludo] Player already in lobby, no update needed');
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.PLAYER_LEFT, (data, _pId) => {
      const currentLobby = lobbyRef.current;
      if (currentLobby && data.playerId) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        const playerEntry = currentLobby.players.find(p => p.id === data.playerId);
        const playerColor = playerEntry ? playerEntry.color : null;
        if (playerColor && colors.includes(playerColor) && syncRef.current) {
          syncRef.current.handlePlayerDisconnect(playerColor);
        }
      }
      setLobby(prev => {
        const updated = removePlayerFromLobby(prev, data.playerId);
        lobbyRef.current = updated;
        return updated;
      });
    });

    connRef.current.onMessageType(MESSAGE_TYPES.LEAVE_ROOM, (data, _pId) => {
      if (!data || !data.playerId) return;
      const currentLobby = lobbyRef.current;
      if (currentLobby) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        const playerEntry = currentLobby.players.find(p => p.id === data.playerId);
        const playerColor = playerEntry ? playerEntry.color : null;
        if (playerColor && colors.includes(playerColor) && syncRef.current) {
          syncRef.current.handlePlayerDisconnect(playerColor);
        }
      }
      setLobby(prev => {
        const updated = removePlayerFromLobby(prev, data.playerId);
        lobbyRef.current = updated;
        return updated;
      });
    });

    connRef.current.onMessageType(MESSAGE_TYPES.READY_CHANGED, (data, _pId) => {
      setLobby(prev => updatePlayerReady(prev, data.playerId, data.isReady));
    });

    connRef.current.onMessageType(MESSAGE_TYPES.ROOM_INFO, (data, _pId) => {
      if (data.lobby) {
        console.log('[Ludo] Received ROOM_INFO, lobby players:', data.lobby.players?.length, 'hostId:', data.lobby.hostId?.slice(0, 8) + '...');
        _stopJoinRetry();
        if (data.lobby.hostId) hostPeerIdRef.current = data.lobby.hostId;
        setLobby(data.lobby);
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.GAME_STATE_SYNC, (data, _pId) => {
      if (data.state && onGameStateReceived) {
        const deserialized = deserializeGameState(data.state);
        const corrected = _correctTurnTimer(deserialized, data.timestamp);
        console.log('[Ludo] GAME_STATE_SYNC received (phase:', deserialized.gamePhase, ', sequence:', data.sequence || 0, ')');
        gameStateRef.current = { ...corrected, sequence: data.sequence || 0 };
        onGameStateReceived({ ...corrected, sequence: data.sequence || 0, reason: data.reason || null });
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.FULL_STATE_SYNC, (data, peerId) => {
      if (data.request && syncRef.current && networkRoleRef.current === NETWORK_ROLE.HOST) {
        syncRef.current._sendFullStateTo(peerId);
      } else if (data.state && onGameStateReceived) {
        const deserialized = deserializeGameState(data.state);
        const corrected = _correctTurnTimer(deserialized, data.timestamp);
        gameStateRef.current = { ...corrected, sequence: data.sequence || 0 };
        onGameStateReceived({ ...corrected, sequence: data.sequence || 0, reason: null });
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.REJECTED, (data, _pId) => {
      setNetworkError(data.message || 'Action rejected');
      playSound('error');
    });

    connRef.current.onMessageType(MESSAGE_TYPES.REMATCH_REQUEST, (data, _pId) => {
      if (networkRoleRef.current !== NETWORK_ROLE.HOST) return;
      if (data.playerId === hostPeerIdRef.current) return;
      if (syncRef.current) {
        syncRef.current.restartGame();
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.KICK_PLAYER, (data, _pId) => {
      if (!data || data.targetId !== playerIdRef.current) return;
      setKicked(true);
      playSound('kick');
      _stopJoinRetry();
      if (connRef.current) connRef.current.leaveRoom();
      connRef.current = null;
      if (syncRef.current) syncRef.current.destroy();
      syncRef.current = null;
      gameStateRef.current = null;
      lobbyRef.current = null;
      hostPeerIdRef.current = null;
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      setNetworkRole(NETWORK_ROLE.NONE);
      setRoomCode(null);
      setLobby(null);
      setIsMultiplayer(false);
      setPeerIds([]);
      setChatMessages([]);
    });

    connRef.current.onMessageType(MESSAGE_TYPES.ERROR, (data, _pId) => {
      setNetworkError(data.message || 'Network error');
      playSound('error');
    });

    connRef.current.onMessageType(MESSAGE_TYPES.CHAT_MESSAGE, (data, _pId) => {
      if (networkRoleRef.current === NETWORK_ROLE.HOST && syncRef.current) {
        // Chat sends peer ids, but the game keys players by color — resolve the
        // sender's color from the lobby before asking the host to apply cheats.
        const sender = lobbyRef.current?.players.find(p => p.id === data.senderId);
        if (sender?.color) {
          console.log(`[Cheat] chat from ${data.senderName} (color ${sender.color}): "${data.text}"`);
          syncRef.current.applyChatCheat(sender.color, data.text);
        } else {
          console.log(`[Cheat] could not resolve color for sender ${data.senderId}`);
        }
      }
      if (data.senderId !== playerIdRef.current) {
        setChatMessages(prev => [...prev, data]);
        playSound('chat_message');
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.PROFILE_UPDATE, (data, _pId) => {
      if (!data || !data.playerId) return;
      setLobby(prev => updatePlayerProfilePic(prev, data.playerId, data.profilePic || null));
      lobbyRef.current = updatePlayerProfilePic(lobbyRef.current, data.playerId, data.profilePic || null);
    });

    return { peerId, isHost: connRef.current.isHost() };
  }, [onGameStateReceived, _stopJoinRetry]);

  const createRoom = useCallback((playerName, maxPlayers, profilePic) => {
    const code = generateRoomCode();
    networkRoleRef.current = NETWORK_ROLE.HOST;
    playerProfilePicRef.current = profilePic || null;
    console.log(`[Ludo] Creating room ${code} as HOST (maxPlayers=${maxPlayers})`);
    const { peerId } = _setupConnection(code, playerName, profilePic);

    hostPeerIdRef.current = peerId;
    setRoomCode(code);
    setNetworkRole(NETWORK_ROLE.HOST);
    setIsMultiplayer(true);

    const newLobby = createDefaultLobby(code, maxPlayers);
    newLobby.players = [{
      id: peerId,
      name: playerName,
      color: 'red',
      isReady: true,
      isHost: true,
      isConnected: true,
      profilePic: profilePic || null,
    }];
    newLobby.hostId = peerId;
    newLobby.playerCount = 1;
    lobbyRef.current = newLobby;
    setLobby(newLobby);

    return code;
  }, [_setupConnection]);

  const joinRoom = useCallback((code, playerName, profilePic) => {
    if (!validateRoomCode(code)) {
      setNetworkError('Invalid room code format');
      return false;
    }

    networkRoleRef.current = NETWORK_ROLE.CLIENT;
    playerProfilePicRef.current = profilePic || null;
    console.log(`[Ludo] Joining room ${code} as CLIENT`);
    _setupConnection(code, playerName, profilePic);
    setRoomCode(code);
    setNetworkRole(NETWORK_ROLE.CLIENT);
    setIsMultiplayer(true);

    // Keep re-announcing until the host confirms with ROOM_INFO (lobby set).
    // The host drops JOIN_ROOM if its lobby isn't ready yet, so retry is needed.
    _stopJoinRetry();
    joinRetryTimerRef.current = setInterval(() => {
      if (!lobbyRef.current && connRef.current && networkRoleRef.current === NETWORK_ROLE.CLIENT) {
        console.log('[Ludo] Re-sending JOIN_ROOM (lobby not received yet)');
        connRef.current.sendToAll(MESSAGE_TYPES.JOIN_ROOM, {
          player: {
            id: playerIdRef.current,
            name: playerNameRef.current,
            color: null,
            isReady: false,
            isHost: false,
            isConnected: true,
            profilePic: playerProfilePicRef.current || null,
          },
        });
      } else {
        _stopJoinRetry();
      }
    }, 3000);

    return true;
  }, [_setupConnection, _stopJoinRetry]);

  const leaveRoom = useCallback(() => {
    _stopJoinRetry();
    clearTimeout(disconnectNoticeTimerRef.current);
    disconnectNoticeTimerRef.current = null;
    if (connRef.current) {
      connRef.current.sendToAll(MESSAGE_TYPES.LEAVE_ROOM, {
        playerId: playerIdRef.current,
      });
      connRef.current.leaveRoom();
    }
    connRef.current = null;
    if (syncRef.current) syncRef.current.destroy();
    syncRef.current = null;
    gameStateRef.current = null;
    lobbyRef.current = null;
    hostPeerIdRef.current = null;
    playerIdRef.current = null;
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    setNetworkRole(NETWORK_ROLE.NONE);
    setRoomCode(null);
    setLobby(null);
    setIsMultiplayer(false);
    setPeerIds([]);
    setChatMessages([]);
    setDisconnectNotice(null);
    setKicked(false);
  }, [_stopJoinRetry]);

  const toggleReady = useCallback(() => {
    if (!lobby || !playerIdRef.current) return;
    const player = lobby.players.find(p => p.id === playerIdRef.current);
    if (!player || player.isHost) return;

    const newReady = !player.isReady;
    setLobby(prev => updatePlayerReady(prev, playerIdRef.current, newReady));
    connRef.current?.sendToAll(MESSAGE_TYPES.READY_CHANGED, {
      playerId: playerIdRef.current,
      isReady: newReady,
    });
  }, [lobby]);

  const startGame = useCallback((playerConfigs) => {
    if (networkRole !== NETWORK_ROLE.HOST) return;
    if (!syncRef.current) return;

    syncRef.current.startGame(playerConfigs);
  }, [networkRole]);

  const sendProfileUpdate = useCallback((profilePic) => {
    if (!connRef.current || !playerIdRef.current) return;
    playerProfilePicRef.current = profilePic || null;
    const updatedLobby = updatePlayerProfilePic(lobbyRef.current, playerIdRef.current, profilePic || null);
    lobbyRef.current = updatedLobby;
    setLobby(updatedLobby);
    connRef.current.sendToAll(MESSAGE_TYPES.PROFILE_UPDATE, {
      playerId: playerIdRef.current,
      profilePic: profilePic || null,
    });
  }, []);

  const networkRollDice = useCallback((playerId) => {
    if (!connRef.current || !syncRef.current) return;
    if (networkRole === NETWORK_ROLE.HOST) {
      const state = syncRef.current.getState();
      if (!state || state.currentTurn !== playerId || state.gamePhase !== GAME_PHASES.ROLLING) {
        setNetworkError('Cannot roll right now');
        return;
      }
      syncRef.current._handleRollRequest({ playerId }, connRef.current.myPeerId);
    } else {
      const hostId = hostPeerIdRef.current;
      if (hostId) connRef.current.sendToPeer(MESSAGE_TYPES.ROLL_REQUEST, { playerId }, hostId);
    }
  }, [networkRole]);

  const networkSelectPiece = useCallback((playerId, pieceId, diceValue) => {
    if (!connRef.current || !syncRef.current) return;
    if (networkRole === NETWORK_ROLE.HOST) {
      const state = syncRef.current.getState();
      if (!state || state.currentTurn !== playerId || state.gamePhase !== GAME_PHASES.SELECTING_PIECE) {
        setNetworkError('Cannot select piece right now');
        return;
      }
      syncRef.current._handleMoveRequest({ playerId, pieceId, diceValue }, connRef.current.myPeerId);
    } else {
      const hostId = hostPeerIdRef.current;
      if (hostId) connRef.current.sendToPeer(MESSAGE_TYPES.MOVE_REQUEST, { playerId, pieceId, diceValue }, hostId);
    }
  }, [networkRole]);

  const [chatMessages, setChatMessages] = useState([]);

  const sendChatMessage = useCallback((text) => {
    if (!text.trim() || !connRef.current || !lobby) return;
    const sender = lobby.players.find(p => p.id === playerIdRef.current);
    const msg = {
      senderId: playerIdRef.current,
      senderName: sender?.name || 'Unknown',
      text: text.trim(),
      timestamp: Date.now(),
    };
    connRef.current.sendToAll(MESSAGE_TYPES.CHAT_MESSAGE, msg);
    setChatMessages(prev => [...prev, msg]);
    if (networkRoleRef.current === NETWORK_ROLE.HOST && syncRef.current) {
      console.log(`[Cheat] host sent chat "${msg.text}" as ${sender?.name} (color ${sender?.color})`);
      syncRef.current.applyChatCheat(sender?.color, msg.text);
    }
  }, [lobby]);

  const networkEndTurn = useCallback((playerId) => {
    if (!connRef.current || !syncRef.current) return;
    if (networkRole === NETWORK_ROLE.HOST) {
      const state = syncRef.current.getState();
      if (!state || state.currentTurn !== playerId || state.gamePhase !== GAME_PHASES.TURN_COMPLETE) {
        setNetworkError('Cannot end turn right now');
        return;
      }
      syncRef.current._handleEndTurnRequest({ playerId }, connRef.current.myPeerId);
    } else {
      const hostId = hostPeerIdRef.current;
      if (hostId) connRef.current.sendToPeer(MESSAGE_TYPES.END_TURN_REQUEST, { playerId }, hostId);
    }
  }, [networkRole]);

  const rematch = useCallback(() => {
    if (!syncRef.current) return;
    if (networkRole !== NETWORK_ROLE.HOST) return;
    syncRef.current.restartGame();
  }, [networkRole]);

  const requestRematch = useCallback(() => {
    if (!connRef.current || !playerIdRef.current) return;
    if (networkRole === NETWORK_ROLE.HOST) return;
    const hostId = hostPeerIdRef.current;
    if (!hostId) return;
    connRef.current.sendToPeer(MESSAGE_TYPES.REMATCH_REQUEST, {
      playerId: playerIdRef.current,
    }, hostId);
  }, [networkRole]);

  const requestFullState = useCallback(() => {
    if (!connRef.current || !hostPeerIdRef.current) return;
    if (networkRole !== NETWORK_ROLE.CLIENT) return;
    connRef.current.sendToPeer(MESSAGE_TYPES.FULL_STATE_SYNC, { request: true }, hostPeerIdRef.current);
  }, [networkRole]);

  const kickPlayer = useCallback((targetId) => {
    if (!connRef.current) return;
    if (networkRole !== NETWORK_ROLE.HOST) return;
    connRef.current.sendToAll(MESSAGE_TYPES.KICK_PLAYER, { targetId });
  }, [networkRole]);

  const clearKicked = useCallback(() => {
    setKicked(false);
    setNetworkError(null);
  }, []);

  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  useEffect(() => {
    if (!lobby || !playerIdRef.current) {
      setMyPlayerId(null);
      return;
    }
    const me = lobby.players.find(p => p.id === playerIdRef.current);
    setMyPlayerId(me ? me.color : null);
  }, [lobby]);

  useEffect(() => {
    const handleTabClose = () => {
      if (connRef.current && playerIdRef.current) {
        try {
          connRef.current.sendToAll(MESSAGE_TYPES.PLAYER_LEFT, {
            playerId: playerIdRef.current,
          });
        } catch { /* ignore */ }
        try {
          connRef.current.leaveRoom();
        } catch { /* ignore */ }
      }
    };

    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
      _stopJoinRetry();
      clearTimeout(disconnectNoticeTimerRef.current);
      disconnectNoticeTimerRef.current = null;
      if (syncRef.current) syncRef.current.destroy();
      syncRef.current = null;
      if (connRef.current) {
        connRef.current.leaveRoom();
      }
      connRef.current = null;
    };
  }, [_stopJoinRetry]);

  useEffect(() => {
    if (networkError) {
      const timer = setTimeout(() => setNetworkError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [networkError]);

  const contextValue = useMemo(() => ({
    isMultiplayer,
    isHost: networkRole === NETWORK_ROLE.HOST,
    isConnected: connectionStatus === CONNECTION_STATUS.CONNECTED,
    connectionStatus,
    roomCode,
    lobby,
    networkError,
    disconnectNotice,
    peerIds,
    myPlayerId,
    kicked,
    chatMessages,
    sendChatMessage,
    sendProfileUpdate,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    networkRollDice,
    networkSelectPiece,
    networkEndTurn,
    rematch,
    requestRematch,
    requestFullState,
    kickPlayer,
    clearKicked,
    clearError: () => setNetworkError(null),
  }), [isMultiplayer, networkRole, connectionStatus, roomCode, lobby, networkError, disconnectNotice, peerIds, myPlayerId, kicked, chatMessages,
      createRoom, joinRoom, leaveRoom, toggleReady, startGame,
      networkRollDice, networkSelectPiece, networkEndTurn, sendChatMessage, sendProfileUpdate,
      rematch, requestRematch, requestFullState, kickPlayer, clearKicked]);

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
}
