import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NetworkContext } from './useNetwork';
import { ConnectionManager } from './ConnectionManager';
import { SyncManager } from './SyncManager';
import { MESSAGE_TYPES } from './NetworkMessages';
import { generateRoomCode, validateRoomCode, createDefaultLobby, addPlayerToLobby, removePlayerFromLobby, updatePlayerReady } from './RoomManager';
import { deserializeGameState } from './GameSerializer';
import { CONNECTION_STATUS, NETWORK_ROLE } from './NetworkConstants';
import { GAME_PHASES } from '../data/constants';

export function NetworkProvider({ children, onGameStateReceived }) {
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [networkRole, setNetworkRole] = useState(NETWORK_ROLE.NONE);
  const [roomCode, setRoomCode] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [networkError, setNetworkError] = useState(null);
  const [peerIds, setPeerIds] = useState([]);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);

  const connRef = useRef(null);
  const syncRef = useRef(null);
  const playerNameRef = useRef('');
  const playerIdRef = useRef(null);
  const lobbyRef = useRef(null);
  const hostPeerIdRef = useRef(null);
  const networkRoleRef = useRef(NETWORK_ROLE.NONE);

  const _setupConnection = useCallback((roomCodeVal, playerName) => {
    playerNameRef.current = playerName;

    if (!connRef.current) {
      connRef.current = new ConnectionManager();
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
      if (leftPeerIds.length > 0 && currentLobby) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        for (const leftPid of leftPeerIds) {
          const playerEntry = currentLobby.players.find(p => p.id === leftPid);
          const playerColor = playerEntry ? playerEntry.color : null;
          if (playerColor && colors.includes(playerColor)) {
            console.log(`[Ludo] Peer disconnected: ${leftPid} (${playerColor}), updating game state`);
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
          }
        });
      }
    };

    const peerId = connRef.current.createOrJoinRoom(roomCodeVal);
    playerIdRef.current = peerId;
    setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    if (!syncRef.current) {
      syncRef.current = new SyncManager(connRef.current);
    }

    syncRef.current.onStateUpdate = (state) => {
      if (onGameStateReceived) onGameStateReceived(state);
    };

    syncRef.current.setupListeners();

    connRef.current.onMessageType(MESSAGE_TYPES.JOIN_ROOM, (data, pId) => {
      console.log('[Ludo] Received JOIN_ROOM from:', pId, 'lobbyRef:', lobbyRef.current);
      const currentLobby = lobbyRef.current;
      if (!currentLobby) {
        console.log('[Ludo] Lobby not ready yet, deferring');
        return;
      }
      const updated = addPlayerToLobby(currentLobby, data.player);
      if (updated !== currentLobby) {
        lobbyRef.current = updated;
        setLobby(updated);
        console.log('[Ludo] Sending ROOM_INFO to:', pId);
        connRef.current?.sendToPeer(MESSAGE_TYPES.ROOM_INFO, { lobby: updated }, pId);
      } else {
        console.log('[Ludo] Player already in lobby, no update needed');
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.PLAYER_LEFT, (data, _pId) => {
      setLobby(prev => {
        const updated = removePlayerFromLobby(prev, data.playerId);
        lobbyRef.current = updated;
        return updated;
      });
      const currentLobby = lobbyRef.current;
      if (currentLobby && data.playerId) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        const playerEntry = currentLobby.players.find(p => p.id === data.playerId);
        const playerColor = playerEntry ? playerEntry.color : null;
        if (playerColor && colors.includes(playerColor) && syncRef.current) {
          syncRef.current.handlePlayerDisconnect(playerColor);
        }
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.READY_CHANGED, (data, _pId) => {
      setLobby(prev => updatePlayerReady(prev, data.playerId, data.isReady));
    });

    connRef.current.onMessageType(MESSAGE_TYPES.ROOM_INFO, (data, _pId) => {
      if (data.lobby) {
        console.log('[Ludo] Received ROOM_INFO, setting lobby:', data.lobby);
        if (data.lobby.hostId) hostPeerIdRef.current = data.lobby.hostId;
        setLobby(data.lobby);
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.GAME_STATE_SYNC, (data, _pId) => {
      if (data.state && onGameStateReceived) {
        const deserialized = deserializeGameState(data.state);
        onGameStateReceived({ ...deserialized, sequence: data.sequence || 0 });
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.FULL_STATE_SYNC, (data, peerId) => {
      if (data.request && syncRef.current && networkRoleRef.current === NETWORK_ROLE.HOST) {
        syncRef.current._sendFullStateTo(peerId);
      } else if (data.state && onGameStateReceived) {
        const deserialized = deserializeGameState(data.state);
        onGameStateReceived({ ...deserialized, sequence: data.sequence || 0 });
      }
    });

    connRef.current.onMessageType(MESSAGE_TYPES.REJECTED, (data, _pId) => {
      setNetworkError(data.message || 'Action rejected');
    });

    connRef.current.onMessageType(MESSAGE_TYPES.ERROR, (data, _pId) => {
      setNetworkError(data.message || 'Network error');
    });

    connRef.current.onMessageType(MESSAGE_TYPES.CHAT_MESSAGE, (data, _pId) => {
      if (data.senderId !== playerIdRef.current) {
        setChatMessages(prev => [...prev, data]);
      }
    });

    return { peerId, isHost: connRef.current.isHost() };
  }, [onGameStateReceived]);

  const createRoom = useCallback((playerName, maxPlayers) => {
    const code = generateRoomCode();
    networkRoleRef.current = NETWORK_ROLE.HOST;
    const { peerId } = _setupConnection(code, playerName);

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
    }];
    newLobby.hostId = peerId;
    newLobby.playerCount = 1;
    lobbyRef.current = newLobby;
    setLobby(newLobby);

    return code;
  }, [_setupConnection]);

  const joinRoom = useCallback((code, playerName) => {
    if (!validateRoomCode(code)) {
      setNetworkError('Invalid room code format');
      return false;
    }

    networkRoleRef.current = NETWORK_ROLE.CLIENT;
    _setupConnection(code, playerName);
    setRoomCode(code);
    setNetworkRole(NETWORK_ROLE.CLIENT);
    setIsMultiplayer(true);

    return true;
  }, [_setupConnection]);

  const leaveRoom = useCallback(() => {
    if (connRef.current) {
      connRef.current.sendToAll(MESSAGE_TYPES.LEAVE_ROOM, {
        playerId: playerIdRef.current,
      });
      connRef.current.leaveRoom();
    }
    connRef.current = null;
    syncRef.current = null;
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    setNetworkRole(NETWORK_ROLE.NONE);
    setRoomCode(null);
    setLobby(null);
    setIsMultiplayer(false);
    setPeerIds([]);
    setChatMessages([]);
  }, []);

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

  const networkRollDice = useCallback((playerId, diceValue) => {
    if (!connRef.current || !syncRef.current) return;
    if (networkRole === NETWORK_ROLE.HOST) {
      const state = syncRef.current.getState();
      if (!state || state.currentTurn !== playerId || state.gamePhase !== GAME_PHASES.ROLLING) {
        setNetworkError('Cannot roll right now');
        return;
      }
      syncRef.current._handleRollRequest({ playerId, diceValue }, connRef.current.myPeerId);
    } else {
      connRef.current.sendToPeer(MESSAGE_TYPES.ROLL_REQUEST, { playerId, diceValue }, hostPeerIdRef.current);
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
      connRef.current.sendToPeer(MESSAGE_TYPES.MOVE_REQUEST, { playerId, pieceId, diceValue }, hostPeerIdRef.current);
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
      connRef.current.sendToPeer(MESSAGE_TYPES.END_TURN_REQUEST, { playerId }, hostPeerIdRef.current);
    }
  }, [networkRole]);

  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  useEffect(() => {
    if (!lobby || !playerIdRef.current) {
      setMyPlayerId(null);
      return;
    }
    const myLobbyIndex = lobby.players.findIndex(p => p.id === playerIdRef.current);
    if (myLobbyIndex >= 0) {
      const colors = ['red', 'green', 'yellow', 'blue'];
      setMyPlayerId(colors[myLobbyIndex]);
    }
  }, [lobby]);

  useEffect(() => {
    const handleTabClose = () => {
      if (connRef.current && playerIdRef.current) {
        try {
          connRef.current.sendToAll(MESSAGE_TYPES.PLAYER_LEFT, {
            playerId: playerIdRef.current,
          });
        } catch (e) { /* ignore */ }
        try {
          connRef.current.leaveRoom();
        } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
      if (connRef.current) {
        connRef.current.leaveRoom();
      }
    };
  }, []);

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
    peerIds,
    myPlayerId,
    chatMessages,
    sendChatMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    networkRollDice,
    networkSelectPiece,
    networkEndTurn,
    clearError: () => setNetworkError(null),
  }), [isMultiplayer, networkRole, connectionStatus, roomCode, lobby, networkError, peerIds, myPlayerId, chatMessages,
      createRoom, joinRoom, leaveRoom, toggleReady, startGame,
      networkRollDice, networkSelectPiece, networkEndTurn, sendChatMessage]);

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
}
