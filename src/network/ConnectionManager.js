import mqtt from 'mqtt';
import { APP_NAME, HEARTBEAT_INTERVAL_MS } from './NetworkConstants.js';
import { MESSAGE_TYPES } from './NetworkMessages.js';

const STALE_PEER_CHECK_MS = 5000;
const STALE_PEER_TIMEOUT_MS = 45000;

// Single public MQTT broker used for ALL traffic (signaling + game data).
// Every peer must connect to the SAME broker so pub/sub topics align.
// The broker is a real server that both players can always reach, so the
// connection works across NAT/VPN without any STUN/TURN or WebRTC.
const MQTT_URL = 'wss://broker.emqx.io:8084/mqtt';

function makePeerId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(20);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
  }
  let id = '';
  for (let i = 0; i < 20; i++) id += chars[bytes[i] % chars.length];
  return id;
}

export class ConnectionManager {
  constructor() {
    this.client = null;
    this.roomCode = null;
    this.peerIds = [];
    this.isActive = false;
    this.myPeerId = makePeerId();
    this.onPeersChange = null;
    this._lastSeen = {};
    this._messageListeners = {};
    this._staleCheckTimer = null;
    this._heartbeatTimer = null;
  }

  _topic(roomCode) {
    return `ludo/${APP_NAME}/${roomCode}`;
  }

  _broadcastTopic() {
    return `${this._topic(this.roomCode)}/broadcast`;
  }

  _peerTopic(peerId) {
    return `${this._topic(this.roomCode)}/peer/${peerId}`;
  }

  createOrJoinRoom(roomCode) {
    if (this.client) this.leaveRoom();
    this.roomCode = roomCode;
    this.isActive = true;

    console.log('[Ludo] Joining MQTT room:', roomCode, 'peerId:', this.myPeerId);
    this.client = mqtt.connect(MQTT_URL, {
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 15000,
      clientId: `ludo_${this.myPeerId}`,
    });

    this.client.on('connect', () => {
      console.log('[Ludo][MQTT] connected, subscribing room:', roomCode);
      if (!this.client) return;
      this.client.subscribe(this._broadcastTopic());
      this.client.subscribe(this._peerTopic(this.myPeerId));
      this._setupHeartbeat();
      this._startStalePeerCheck();
      this.sendToAll(MESSAGE_TYPES.HEARTBEAT, { timestamp: Date.now() });
    });

    this.client.on('message', (_topic, payload) => {
      this._handleMessage(payload);
    });

    this.client.on('error', (err) => {
      console.warn('[Ludo][MQTT] error:', err && err.message ? err.message : err);
    });

    this.client.on('offline', () => {
      console.warn('[Ludo][MQTT] offline');
    });

    this.client.on('reconnect', () => {
      console.log('[Ludo][MQTT] reconnecting...');
    });

    return this.myPeerId;
  }

  _handleMessage(payload) {
    if (!this.isActive) return;
    let msg;
    try {
      msg = JSON.parse(payload.toString());
    } catch {
      return;
    }
    const sender = msg.sender;
    if (!sender || sender === this.myPeerId) return;

    this._lastSeen[sender] = Date.now();

    if (!this.peerIds.includes(sender)) {
      console.log('[Ludo] Peer detected:', sender);
      this.peerIds.push(sender);
      if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
    }

    const cb = this._messageListeners[msg.type];
    if (cb) cb(msg.data, sender);
  }

  _setupHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
    }
    this._heartbeatTimer = setInterval(() => {
      if (!this.isActive || !this.client || !this.client.connected) return;
      this.sendToAll(MESSAGE_TYPES.HEARTBEAT, { timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  _startStalePeerCheck() {
    if (this._staleCheckTimer) {
      clearInterval(this._staleCheckTimer);
    }
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
          console.log(`[Ludo] Peer ${peerId} stale (last seen ${now - lastSeen}ms ago), removing`);
          delete this._lastSeen[peerId];
          this.peerIds = this.peerIds.filter(p => p !== peerId);
          if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
        }
      }
    }, STALE_PEER_CHECK_MS);
  }

  sendToPeer(messageType, data, peerId) {
    if (!this.client || !this.client.connected) return;
    const topic = this._peerTopic(peerId);
    this.client.publish(topic, JSON.stringify({ type: messageType, data, sender: this.myPeerId }), { qos: 1 });
  }

  sendToAll(messageType, data) {
    if (!this.client || !this.client.connected) return;
    const topic = this._broadcastTopic();
    this.client.publish(topic, JSON.stringify({ type: messageType, data, sender: this.myPeerId }), { qos: 1 });
  }

  sendToHost(data) {
    const hostId = this.getHostPeerId();
    if (!hostId || hostId === this.myPeerId) return;
    this.sendToPeer(MESSAGE_TYPES.ROLL_REQUEST, data, hostId);
  }

  onMessageType(messageType, callback) {
    this._messageListeners[messageType] = callback;
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
    this.peerIds = [];
    this._lastSeen = {};
    this._messageListeners = {};
    if (this._staleCheckTimer) {
      clearInterval(this._staleCheckTimer);
      this._staleCheckTimer = null;
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this.client) {
      try {
        this.client.end(true);
      } catch { /* ignore */ }
    }
    this.client = null;
    this.roomCode = null;
  }
}
