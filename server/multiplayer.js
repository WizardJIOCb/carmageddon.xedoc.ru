import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.MULTIPLAYER_PORT || 8081);
const wss = new WebSocketServer({ port });
const rooms = new Map();
const carIds = new Set(['razor','marauder','brutus','mantis','hearse','phantom']);
const machineGunIds = new Set(['scrapgun','vulcan','shredder']);
const missileLauncherIds = new Set(['none','sidewinder','reaper']);
const combatKinds = new Set(['machine_gun','missile_launch','missile_explode','vehicle_impact']);

const clamp = (value, min, max) => { const number=Number(value);return Math.max(min,Math.min(max,Number.isFinite(number)?number:min)); };
const normalizeCar = value => carIds.has(value) ? value : 'razor';
const normalizeColor = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#d5ff18';
const normalizeWeapon = (value, allowed, fallback) => allowed.has(value) ? value : fallback;
const vector = value => Array.isArray(value) && value.length >= 3 && value.slice(0,3).every(Number.isFinite) ? value.slice(0,3).map(number => clamp(number,-5000,5000)) : null;
const playerRecord = (message, socket, id) => ({ id, name:String(message.playerName||'Водитель').slice(0,20), carId:normalizeCar(message.carId), color:normalizeColor(message.color), machineGunId:normalizeWeapon(message.machineGunId,machineGunIds,'scrapgun'), missileLauncherId:normalizeWeapon(message.missileLauncherId,missileLauncherIds,'none'), socket });
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
  players: [...room.players.values()].map(player => ({ id: player.id, name: player.name, carId: player.carId, color: player.color, machineGunId:player.machineGunId, missileLauncherId:player.missileLauncherId })),
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
      room.players.set(client.id, playerRecord(message,socket,client.id));
      rooms.set(room.id, room);client.roomId = room.id;broadcastRoom(room);return;
    }
    if (message.type === 'join') {
      leaveRoom(client);const room = rooms.get(String(message.roomId || '').toUpperCase());
      if (!room || room.status !== 'lobby') return send(socket, { type: 'error', message: 'Комната недоступна' });
      if (room.players.size >= room.slots - room.aiSlots) return send(socket, { type: 'error', message: 'Все человеческие слоты заняты' });
      room.players.set(client.id, playerRecord(message,socket,client.id));
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
      broadcast(room, { type: 'player_state', playerId: client.id, state: { position: state.position.slice(0, 3), quaternion: state.quaternion.slice(0, 4), speed:clamp(state.speed,-150,150), health:clamp(state.health,0,100000), maxHealth:clamp(state.maxHealth,1,100000), nitro:clamp(state.nitro,0,100), kills:clamp(state.kills,0,9999), wrecks:clamp(state.wrecks,0,9999), damage:clamp(state.damage,0,10000000), lap:clamp(state.lap,0,999), checkpoint:clamp(state.checkpoint,0,999), boosting:Boolean(state.boosting), dead:Boolean(state.dead) } }, socket);
      return;
    }
    if (message.type === 'combat' && room.status === 'racing') {
      const event=message.event,kind=String(event?.kind||'');if(!combatKinds.has(kind))return;
      const now=Date.now(),minimumDelay=kind==='machine_gun'?35:90;if(now-(client.lastCombatAt?.[kind]||0)<minimumDelay)return;client.lastCombatAt={...(client.lastCombatAt||{}),[kind]:now};
      if(kind==='machine_gun'){const origin=vector(event.origin),impact=vector(event.impact);if(!origin||!impact)return;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,origin,impact,color:clamp(event.color,0,0xffffff),hit:Boolean(event.hit)}},socket);return;}
      if(kind==='missile_launch'){const origin=vector(event.origin),direction=vector(event.direction);if(!origin||!direction)return;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,id:String(event.id||'').slice(0,48),origin,direction,speed:clamp(event.speed,10,140),turnRate:clamp(event.turnRate,0,12),life:clamp(event.life,.2,6),targetIndex:clamp(event.targetIndex,-1,99)}},socket);return;}
      if(kind==='vehicle_impact'){const targetId=String(event.targetId||''),impactId=String(event.impactId||'').slice(0,64),position=vector(event.position),direction=vector(event.direction),impulse=vector(event.impulse);if(!room.players.has(targetId)||targetId===client.id||!impactId||!position||!direction||!impulse)return;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,targetId,impactId,position,direction,impulse,damage:clamp(event.damage,0,30)}},socket);return;}
      const position=vector(event.position);if(!position)return;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,id:String(event.id||'').slice(0,48),position,intensity:clamp(event.intensity,.25,2.5)}},socket);
    }
  });
  socket.on('close', () => leaveRoom(client));
});

console.log(`WRECKRUN multiplayer server listening on :${port}`);
