import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.MULTIPLAYER_PORT || 8081);
const wss = new WebSocketServer({ port });
const rooms = new Map();
const carIds = new Set(['razor','marauder','brutus','mantis','hearse','phantom']);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
const normalizeCar = value => carIds.has(value) ? value : 'razor';
const normalizeColor = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#d5ff18';
const send = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
};
const roomSnapshot = room => ({
  id: room.id,
  name: room.name,
  levelId: room.levelId,
  slots: room.slots,
  aiSlots: room.aiSlots,
  humanSlots: room.slots - room.aiSlots,
  status: room.status,
  hostId: room.hostId,
  players: [...room.players.values()].map(player => ({ id: player.id, name: player.name, carId: player.carId, color: player.color })),
});
const publicRooms = () => [...rooms.values()].filter(room => room.status === 'lobby').map(roomSnapshot);
const broadcast = (room, payload, except = null) => {
  for (const player of room.players.values()) if (player.socket !== except) send(player.socket, payload);
};
const broadcastRoom = room => {
  broadcast(room, { type: 'room', room: roomSnapshot(room) });
  for (const client of wss.clients) send(client, { type: 'rooms', rooms: publicRooms() });
};
const leaveRoom = client => {
  const room = rooms.get(client.roomId);
  if (!room) return;
  room.players.delete(client.id);
  client.roomId = null;
  if (!room.players.size) rooms.delete(room.id);
  else {
    if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
    broadcastRoom(room);
  }
  for (const socket of wss.clients) send(socket, { type: 'rooms', rooms: publicRooms() });
};

wss.on('connection', socket => {
  const client = { id: randomUUID(), roomId: null };
  send(socket, { type: 'welcome', playerId: client.id, rooms: publicRooms() });
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return send(socket, { type: 'error', message: 'Некорректный пакет' }); }
    if (message.type === 'list') return send(socket, { type: 'rooms', rooms: publicRooms() });
    if (message.type === 'create') {
      leaveRoom(client);
      const slots = clamp(message.slots, 2, 12), aiSlots = clamp(message.aiSlots, 0, slots - 1), room = {
        id: Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: String(message.roomName || 'Бойня').trim().slice(0, 28) || 'Бойня',
        levelId: clamp(message.levelId, 0, 9), slots, aiSlots, status: 'lobby', hostId: client.id, players: new Map(),
      };
      room.players.set(client.id, { id: client.id, name: String(message.playerName || 'Водитель').slice(0, 20), carId: normalizeCar(message.carId), color: normalizeColor(message.color), socket });
      rooms.set(room.id, room);client.roomId = room.id;broadcastRoom(room);return;
    }
    if (message.type === 'join') {
      leaveRoom(client);const room = rooms.get(String(message.roomId || '').toUpperCase());
      if (!room || room.status !== 'lobby') return send(socket, { type: 'error', message: 'Комната недоступна' });
      if (room.players.size >= room.slots - room.aiSlots) return send(socket, { type: 'error', message: 'Все человеческие слоты заняты' });
      room.players.set(client.id, { id: client.id, name: String(message.playerName || 'Водитель').slice(0, 20), carId: normalizeCar(message.carId), color: normalizeColor(message.color), socket });
      client.roomId = room.id;broadcastRoom(room);return;
    }
    const room = rooms.get(client.roomId);if (!room) return;
    if (message.type === 'configure' && room.hostId === client.id && room.status === 'lobby') {
      room.slots = clamp(message.slots, 2, 12);room.aiSlots = clamp(message.aiSlots, 0, room.slots - Math.max(1, room.players.size));room.levelId = clamp(message.levelId, 0, 9);broadcastRoom(room);return;
    }
    if (message.type === 'start' && room.hostId === client.id && room.status === 'lobby') {
      room.status = 'racing';broadcast(room, { type: 'race_started', room: roomSnapshot(room) });
      for (const other of wss.clients) send(other, { type: 'rooms', rooms: publicRooms() });return;
    }
    if (message.type === 'state' && room.status === 'racing') {
      const state = message.state;if (!state || !Array.isArray(state.position) || !Array.isArray(state.quaternion)) return;
      broadcast(room, { type: 'player_state', playerId: client.id, state: { position: state.position.slice(0, 3), quaternion: state.quaternion.slice(0, 4), speed: Number(state.speed)||0 } }, socket);
    }
  });
  socket.on('close', () => leaveRoom(client));
});

console.log(`WRECKRUN multiplayer server listening on :${port}`);
