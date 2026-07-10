import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.MULTIPLAYER_PORT || 8081);
const wss = new WebSocketServer({ port });
const rooms = new Map();
const carIds = new Set(['razor','marauder','brutus','mantis','hearse','phantom']);
const machineGunIds = new Set(['scrapgun','vulcan','shredder']);
const machineGunStats = { scrapgun:{damage:3.2,kick:34,range:60,cooldown:160}, vulcan:{damage:4.1,kick:55,range:72,cooldown:95}, shredder:{damage:3.7,kick:72,range:86,cooldown:58} };
const missileLauncherIds = new Set(['none','sidewinder','reaper']);
const missileLauncherStats = { sidewinder:{speed:64,life:2.65,damageScale:1}, reaper:{speed:76,life:2.65,damageScale:1.28} };
const combatKinds = new Set(['machine_gun','missile_launch','missile_explode','vehicle_impact','ai_damage']);

const clamp = (value, min, max) => { const number=Number(value);return Math.max(min,Math.min(max,Number.isFinite(number)?number:min)); };
const normalizeCar = value => carIds.has(value) ? value : 'razor';
const normalizeColor = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#d5ff18';
const normalizeWeapon = (value, allowed, fallback) => allowed.has(value) ? value : fallback;
const vector = value => Array.isArray(value) && value.length >= 3 && value.slice(0,3).every(Number.isFinite) ? value.slice(0,3).map(number => clamp(number,-5000,5000)) : null;
const impulseVector = value => Array.isArray(value) && value.length >= 3 && value.slice(0,3).every(Number.isFinite) ? value.slice(0,3).map(number => clamp(number,-8000,8000)) : null;
const quaternion = value => Array.isArray(value) && value.length >= 4 && value.slice(0,4).every(Number.isFinite) ? value.slice(0,4).map(number => clamp(number,-1,1)) : null;
const vectorDistance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const worldEvent = event => { const kind=String(event?.kind||''),index=Math.trunc(clamp(event?.index,0,511)),direction=vector(event?.direction);if(!['destructible_break','pedestrian_hit'].includes(kind)||!direction)return null;return{kind,index,direction,strength:clamp(event?.strength,0,30)}; };
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
  raceNumber: room.raceNumber || 0,
  raceStartedAt: room.raceStartedAt || 0,
  finishedCount: room.finishedPlayers?.size || 0,
  lastResults: room.lastResults || [],
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
const publicRoomsUpdate = () => { for (const client of wss.clients) send(client, { type: 'rooms', rooms: publicRooms() }); };
const maybeStartRace = room => {if(room.status!=='loading'||!room.players.size||![...room.players.keys()].every(id=>room.readyPlayers?.has(id)))return false;room.status='racing';room.raceStartedAt=Date.now()+1800;broadcast(room,{type:'race_go',startsAt:room.raceStartedAt,room:roomSnapshot(room)});publicRoomsUpdate();return true;};
const raceResults = room => [...(room.finishedPlayers?.values()||[])];
const maybeCompleteRace = room => {
  if(room.status!=='racing'||!room.players.size||![...room.players.keys()].every(id=>room.finishedPlayers?.has(id)))return false;
  room.status='lobby';room.lastResults=raceResults(room);room.finishedPlayers=new Map();broadcast(room,{type:'race_complete',room:roomSnapshot(room),results:room.lastResults});publicRoomsUpdate();return true;
};
const leaveRoom = client => {
  const room = rooms.get(client.roomId);
  if (!room) return;
  room.players.delete(client.id);
  room.finishedPlayers?.delete(client.id);
  room.readyPlayers?.delete(client.id);
  client.roomId = null;
  if (!room.players.size) rooms.delete(room.id);
  else {
    if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
    if(!maybeStartRace(room)&&!maybeCompleteRace(room))broadcastRoom(room);
  }
  publicRoomsUpdate();
};

wss.on('connection', socket => {
  const client = { id: randomUUID(), roomId: null };
  send(socket, { type: 'welcome', playerId: client.id, serverTime:Date.now(), rooms: publicRooms() });
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return send(socket, { type: 'error', message: 'Некорректный пакет' }); }
    if (message.type === 'list') return send(socket, { type: 'rooms', rooms: publicRooms() });
    if (message.type === 'create') {
      leaveRoom(client);
      const slots = Math.trunc(clamp(message.slots, 2, 12)), aiSlots = Math.trunc(clamp(message.aiSlots, 0, slots - 1)), room = {
        id: Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: String(message.roomName || 'Бойня').trim().slice(0, 28) || 'Бойня',
        levelId: clamp(message.levelId, 0, 9), slots, aiSlots, status: 'lobby', hostId: client.id, players: new Map(), raceNumber:0, raceStartedAt:0, readyPlayers:new Set(), finishedPlayers:new Map(), impactCooldowns:new Map(), lastResults:[],
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
      room.slots = Math.trunc(clamp(message.slots,Math.max(2,room.players.size),12));room.aiSlots = Math.trunc(clamp(message.aiSlots,0,room.slots-room.players.size));room.levelId = Math.trunc(clamp(message.levelId,0,9));broadcastRoom(room);return;
    }
    if (message.type === 'start' && room.hostId === client.id && room.status === 'lobby') {
      room.status = 'loading';room.raceNumber=(room.raceNumber||0)+1;room.raceStartedAt=0;room.readyPlayers=new Set();room.finishedPlayers=new Map();room.impactCooldowns=new Map();broadcast(room,{type:'race_started',room:roomSnapshot(room)});publicRoomsUpdate();return;
    }
    if(message.type==='race_ready'&&room.status==='loading'){room.readyPlayers.add(client.id);broadcast(room,{type:'race_loading',ready:room.readyPlayers.size,total:room.players.size});maybeStartRace(room);return;}
    if(message.type==='race_finished'&&room.status==='racing'){
      if(room.finishedPlayers.has(client.id))return;const result=message.result||{},player=room.players.get(client.id),record={playerId:client.id,name:player?.name||'Водитель',win:Boolean(result.win),reason:String(result.reason||'ЗАЕЗД ЗАВЕРШЁН').slice(0,80),time:clamp(result.time,0,86400),kills:clamp(result.kills,0,9999),wrecks:clamp(result.wrecks,0,9999),damage:clamp(result.damage,0,10000000),reward:clamp(result.reward,0,10000000)};room.finishedPlayers.set(client.id,record);broadcast(room,{type:'race_progress',finished:room.finishedPlayers.size,total:room.players.size,results:raceResults(room)});maybeCompleteRace(room);return;
    }
    if (message.type === 'state' && room.status === 'racing') {
      const state = message.state,position=vector(state?.position),rotation=quaternion(state?.quaternion);if(!position||!rotation)return;const suspension=Array.isArray(state.suspension)?state.suspension.slice(0,4).map(value=>clamp(value,.05,1.2)):[];const sanitized={position,quaternion:rotation,speed:clamp(state.speed,-150,150),steer:clamp(state.steer,-.7,.7),suspension,health:clamp(state.health,0,100000),maxHealth:clamp(state.maxHealth,1,100000),nitro:clamp(state.nitro,0,100),kills:clamp(state.kills,0,9999),wrecks:clamp(state.wrecks,0,9999),damage:clamp(state.damage,0,10000000),lap:clamp(state.lap,0,999),checkpoint:clamp(state.checkpoint,0,999),boosting:Boolean(state.boosting),dead:Boolean(state.dead)},player=room.players.get(client.id);if(player)player.lastState=sanitized;broadcast(room,{type:'player_state',playerId:client.id,state:sanitized},socket);
      return;
    }
    if (message.type === 'ai_state' && room.status === 'racing' && room.hostId === client.id) {
      if (!Array.isArray(message.states)) return;const states=message.states.slice(0,room.aiSlots).map((state,index)=>{const position=vector(state?.position),rotation=quaternion(state?.quaternion),suspension=Array.isArray(state?.suspension)?state.suspension.slice(0,4).map(value=>clamp(value,.05,1.2)):[];if(!position||!rotation)return null;return{index,position,quaternion:rotation,speed:clamp(state.speed,-150,150),steer:clamp(state.steer,-.7,.7),suspension,health:clamp(state.health,0,100000),maxHealth:clamp(state.maxHealth,1,100000),dead:Boolean(state.dead)};}).filter(Boolean);broadcast(room,{type:'ai_state',states},socket);return;
    }
    if (message.type === 'world_state' && room.status === 'racing' && room.hostId === client.id) {
      if(!Array.isArray(message.pedestrians))return;const pedestrians=message.pedestrians.slice(0,128).map((state,index)=>{const position=vector(state?.position);if(!position)return null;return{index,position,rotationY:clamp(state.rotationY,-Math.PI*4,Math.PI*4),running:Boolean(state.running),dead:Boolean(state.dead)};}).filter(Boolean),destructibles=Array.isArray(message.destructibles)?message.destructibles.slice(0,512).map((state,index)=>{const position=vector(state?.position),rotation=quaternion(state?.quaternion);if(!position||!rotation)return null;return{index,position,quaternion:rotation,broken:Boolean(state.broken)};}).filter(Boolean):[],ragdolls=Array.isArray(message.ragdolls)?message.ragdolls.slice(0,128).map(state=>{const index=Math.trunc(clamp(state?.index,0,127)),pieces=Array.isArray(state?.pieces)?state.pieces.slice(0,16).map(piece=>{const position=vector(piece?.position),rotation=quaternion(piece?.quaternion);return position&&rotation?{position,quaternion:rotation}:null;}).filter(Boolean):[];return pieces.length?{index,pieces}:null;}).filter(Boolean):[],broken=Array.isArray(message.broken)?message.broken.slice(0,512).map(value=>Math.trunc(clamp(value,0,511))):[];broadcast(room,{type:'world_state',pedestrians,destructibles,ragdolls,broken},socket);return;
    }
    if (message.type === 'world_event' && room.status === 'racing' && room.hostId === client.id) {const event=worldEvent(message.event);if(event)broadcast(room,{type:'world_event',event},socket);return;}
    if (message.type === 'world_interaction' && room.status === 'racing' && room.hostId !== client.id) {const event=worldEvent(message.event),host=room.players.get(room.hostId);if(event&&host)send(host.socket,{type:'world_interaction',playerId:client.id,event});return;}
    if (message.type === 'combat' && room.status === 'racing') {
      const event=message.event,kind=String(event?.kind||'');if(!combatKinds.has(kind))return;
      const now=Date.now(),shooter=room.players.get(client.id),gun=machineGunStats[shooter?.machineGunId]||machineGunStats.scrapgun,minimumDelay=kind==='machine_gun'?gun.cooldown*.82:(kind==='ai_damage'?35:90);if(now-(client.lastCombatAt?.[kind]||0)<minimumDelay)return;client.lastCombatAt={...(client.lastCombatAt||{}),[kind]:now};
      if(kind==='machine_gun'){const origin=vector(event.origin),impact=vector(event.impact);if(!origin||!impact)return;let targetId=null,damage=0,kick=0;const requestedTarget=room.players.get(String(event.targetId||'')),validTarget=requestedTarget&&requestedTarget.id!==client.id&&requestedTarget.lastState&&shooter?.lastState&&vectorDistance(origin,shooter.lastState.position)<5&&vectorDistance(impact,requestedTarget.lastState.position)<4.2&&vectorDistance(origin,impact)<=gun.range+2;if(validTarget){targetId=requestedTarget.id;damage=gun.damage;kick=gun.kick;}broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,origin,impact,color:clamp(event.color,0,0xffffff),hit:Boolean(event.hit),targetId,damage,kick}},socket);return;}
      if(kind==='missile_launch'){const origin=vector(event.origin),direction=vector(event.direction),id=String(event.id||'').slice(0,48),launcher=missileLauncherStats[shooter?.missileLauncherId];if(!origin||!direction||!id||!launcher||shooter?.lastState&&vectorDistance(origin,shooter.lastState.position)>6)return;client.missiles=client.missiles||new Map();client.missiles.set(id,{origin,launchedAt:now,...launcher});while(client.missiles.size>8)client.missiles.delete(client.missiles.keys().next().value);const requestedTargetId=String(event.targetPlayerId||''),targetPlayerId=room.players.has(requestedTargetId)&&requestedTargetId!==client.id?requestedTargetId:null;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,id,origin,direction,speed:launcher.speed,turnRate:clamp(event.turnRate,0,12),life:launcher.life,targetIndex:clamp(event.targetIndex,-1,99),targetPlayerId}},socket);return;}
      if(kind==='missile_explode'){const id=String(event.id||'').slice(0,48),position=vector(event.position),missile=client.missiles?.get(id);client.missiles?.delete(id);if(!id||!position||!missile)return;const age=Math.max(0,(now-missile.launchedAt)/1000);if(age>missile.life+.8||vectorDistance(position,missile.origin)>missile.speed*age+8)return;const targetIds=[...new Set(Array.isArray(event.targetIds)?event.targetIds.slice(0,12).map(String):[])],hits=[];for(const targetId of targetIds){const target=room.players.get(targetId);if(!target||targetId===client.id||!target.lastState)continue;const distance=vectorDistance(position,target.lastState.position);if(distance>=10)continue;const damage=(52-distance*4.5)*missile.damageScale,dx=target.lastState.position[0]-position[0],dz=target.lastState.position[2]-position[2],length=Math.hypot(dx,dz)||1,strength=(10-distance)*165*missile.damageScale;hits.push({targetId,damage:clamp(damage,0,70),impulse:[dx/length*strength,135*missile.damageScale,dz/length*strength]});}broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,id,position,intensity:1.42*Math.min(1.2,missile.damageScale),hits}},socket);return;}
      if(kind==='vehicle_impact'){const sourceId=client.id,targetId=String(event.targetId||''),impactId=String(event.impactId||'').slice(0,64),position=vector(event.position),direction=vector(event.direction),impulse=impulseVector(event.impulse);if(!room.players.has(targetId)||targetId===sourceId||!impactId||!position||!direction||!impulse)return;const pairKey=[sourceId,targetId].sort().join(':'),lastImpact=room.impactCooldowns?.get(pairKey)||0;if(now-lastImpact<480)return;room.impactCooldowns?.set(pairKey,now);broadcast(room,{type:'combat_event',playerId:sourceId,event:{kind,sourceId,targetId,impactId,position,direction,impulse,sourceDamage:clamp(event.selfDamage,0,30),targetDamage:clamp(event.damage,0,30)}});return;}
      if(kind==='ai_damage'){if(client.id===room.hostId)return;const targetIndex=Math.trunc(clamp(event.targetIndex,0,Math.max(0,room.aiSlots-1))),damage=clamp(event.damage,0,60),host=room.players.get(room.hostId);if(!host||damage<=0)return;send(host.socket,{type:'combat_event',playerId:client.id,event:{kind,targetIndex,damage}});return;}
      const position=vector(event.position);if(!position)return;broadcast(room,{type:'combat_event',playerId:client.id,event:{kind,id:String(event.id||'').slice(0,48),position,intensity:clamp(event.intensity,.25,2.5)}},socket);
    }
  });
  socket.on('close', () => leaveRoom(client));
});

console.log(`WRECKRUN multiplayer server listening on :${port}`);
