import { joinRoom, selfId } from '@trystero-p2p/torrent';
import { APP_NAME, HEARTBEAT_INTERVAL_MS } from './NetworkConstants';
import { MESSAGE_TYPES } from './NetworkMessages';

const STALE_PEER_CHECK_MS = 5000;
const STALE_PEER_TIMEOUT_MS = 45000;

// Combined STUN + TURN servers for real-world NAT traversal.
// STUN handles typical NATs; TURN relays traffic when direct
// connectivity is impossible (symmetric NAT, strict firewalls).
// Free public TURN: Open Relay Project (https://openrelayproject.org)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const RELAY_CONFIG = {
  // Use more public WebTorrent trackers for robust signaling.
  redundancy: 4,
};

export class ConnectionManager {
  constructor() {
    this.room = null;
    this.actions = {};
    this.peerIds = [];
    this.peerConnections = {};
    this.heartbeatTimers = {};
    this.isActive = false;
    this.myPeerId = null;
    this.onPeersChange = null;
    this._lastSeen = {};
    this._messageListeners = {};
    this._staleCheckTimer = null;
  }

  createOrJoinRoom(roomCode) {
    if (this.room) this.leaveRoom();

    console.log('[Ludo] Creating room:', roomCode, 'selfId:', selfId);
    this.room = joinRoom(
      {
        appId: APP_NAME,
        rtcConfig: {
          iceServers: ICE_SERVERS,
        },
        relayConfig: RELAY_CONFIG,
      },
      roomCode,
      {
        onJoinError: (details) => {
          console.warn('[Ludo][Trystero] join error:', details);
        },
      }
    );
    this.myPeerId = selfId;
    this.isActive = true;

    console.log('[Ludo] Room created, setting up actions/peers');
    this._setupActions();
    this._setupPeersListener();
    this._setupHeartbeat();
    this._startStalePeerCheck();
    console.log('[Ludo] Room setup complete, active peers:', Object.keys(this.room.getPeers()));

    return this.myPeerId;
  }

  _setupActions() {
    for (const name of Object.values(MESSAGE_TYPES)) {
      const action = this.room.makeAction(name);
      this.actions[name] = action;
    }
  }

  _setupPeersListener() {
    this.room.onPeerJoin = (peerId) => {
      this._lastSeen[peerId] = Date.now();
      const peers = Object.keys(this.room.getPeers());
      console.log('[Ludo] Peer joined:', peerId, 'total peers:', peers.length, 'all:', peers);
      this.peerIds = peers;
      if (this.onPeersChange) {
        console.log('[Ludo] Calling onPeersChange with:', this.peerIds);
        this.onPeersChange([...this.peerIds]);
      } else {
        console.log('[Ludo] onPeersChange is NOT SET - event lost!');
      }
    };

    this.room.onPeerLeave = (peerId) => {
      delete this._lastSeen[peerId];
      const peers = Object.keys(this.room.getPeers());
      console.log('[Ludo] Peer left:', peerId, 'remaining:', peers);
      this.peerIds = peers;
      if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
    };
  }

  _setupHeartbeat() {
    // Refresh last-seen on every incoming heartbeat so the stale-peer
    // check never drops a live peer. Without this listener, heartbeats
    // are sent but never handled, and _lastSeen goes stale.
    this.onMessageType(MESSAGE_TYPES.HEARTBEAT, () => {
      // last-seen bookkeeping is handled by onMessageType's wrapper
    });

    const interval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(interval);
        return;
      }
      const action = this.actions[MESSAGE_TYPES.HEARTBEAT];
      if (action) action.send({ timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  _startStalePeerCheck() {
    this._staleCheckTimer = setInterval(() => {
      if (!this.isActive) {
        clearInterval(this._staleCheckTimer);
        this._staleCheckTimer = null;
        return;
      }
      const now = Date.now();
      for (const peerId of this.peerIds) {
        if (peerId === this.myPeerId) continue;
        const lastSeen = this._lastSeen[peerId] || 0;
        if (now - lastSeen > STALE_PEER_TIMEOUT_MS) {
          console.log(`[Ludo] Peer ${peerId} stale (last seen ${now - lastSeen}ms ago), forcing leave`);
          delete this._lastSeen[peerId];
          this.peerIds = this.peerIds.filter(p => p !== peerId);
          if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
        }
      }
    }, STALE_PEER_CHECK_MS);
  }

  sendToPeer(messageType, data, peerId) {
    const action = this.actions[messageType];
    if (!action) return;
    action.send(data, { target: peerId });
  }

  sendToAll(messageType, data) {
    const action = this.actions[messageType];
    if (!action) return;
    action.send(data);
  }

  sendToHost(data) {
    const hostId = this.getHostPeerId();
    if (!hostId) return;
    if (hostId === this.myPeerId) return;
    const action = this.actions[MESSAGE_TYPES.ROLL_REQUEST];
    if (action) action.send(data, { target: hostId });
  }

  onMessageType(messageType, callback) {
    const action = this.actions[messageType];
    if (!action) return;
    this._messageListeners[messageType] = callback;
    action.onMessage = (data, { peerId }) => {
      if (peerId && peerId !== this.myPeerId) {
        this._lastSeen[peerId] = Date.now();
      }
      callback(data, peerId);
    };
  }

  getHostPeerId() {
    const allPeers = [this.myPeerId, ...this.peerIds].filter(Boolean);
    if (allPeers.length === 0) return this.myPeerId;
    allPeers.sort();
    return allPeers[0];
  }

  isHost() {
    return this.getHostPeerId() === this.myPeerId;
  }

  getPeerIds() {
    return [this.myPeerId, ...this.peerIds];
  }

  leaveRoom() {
    this.isActive = false;
    this.actions = {};
    this._lastSeen = {};
    this._messageListeners = {};
    if (this._staleCheckTimer) {
      clearInterval(this._staleCheckTimer);
      this._staleCheckTimer = null;
    }
    if (this.room) {
      try {
        this.room.leave();
      } catch (e) { /* ignore */ }
    }
    this.room = null;
    this.peerIds = [];
    this.peerConnections = {};
  }
}
