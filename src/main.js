import * as THREE from 'three';
import './styles.css';
import { ModelLibrary } from './modelLibrary.js';
import { MultiplayerClient } from './multiplayer.js';
import {
  RAPIER,
  createPhysicsWorld,
  createArenaColliders,
  createVehicle,
  driveVehicle,
  syncVehicle,
  forwardVector,
  createRagdoll,
  syncRagdoll,
} from './physics.js';

const app = document.querySelector('#app');
const GAME_VERSION = '0.2.0-alpha';
const PEDESTRIAN_FLEE_DISTANCE = 22;
const PEDESTRIAN_SAFE_DISTANCE = 30;

const DEFAULT_SETTINGS = {
  steeringSensitivity: .72,
  steeringSmoothing: 4.2,
  cameraSensitivity: .006,
  invertCameraX: false,
  graphics: 'high',
  controlLayoutVersion: 2,
  bindings: { accelerate:'KeyW', brake:'KeyS', left:'KeyA', right:'KeyD', handbrake:'Space', fire:'KeyF', nitro:'ShiftLeft', reset:'KeyR', pause:'Escape' },
};
const GRAPHICS_PRESETS = {
  low: { label:'Низкое', pixelRatio:.72, antialias:false, shadows:false, shadowSize:512, description:'Максимальная производительность' },
  medium: { label:'Среднее', pixelRatio:1, antialias:true, shadows:true, shadowSize:1024, description:'Стабильный баланс качества' },
  high: { label:'Высокое', pixelRatio:1.5, antialias:true, shadows:true, shadowSize:2048, description:'Рекомендуемое качество' },
  ultra: { label:'Ультра', pixelRatio:2, antialias:true, shadows:true, shadowSize:4096, description:'Максимум деталей и теней' },
};

const CARS = [
  { id:'razor', name:'Razorback', class:'Muscle / баланс', price:0, speed:1.0, armor:1.0, handling:1.0, shape:'muscle' },
  { id:'marauder', name:'Marauder', class:'Interceptor / скорость', price:4200, speed:1.18, armor:.78, handling:1.1, shape:'sport' },
  { id:'brutus', name:'Brutus', class:'Wagon / броня', price:6500, speed:.82, armor:1.45, handling:.78, shape:'truck' },
  { id:'mantis', name:'Mantis', class:'Buggy / контроль', price:9000, speed:1.08, armor:.75, handling:1.38, shape:'buggy' },
  { id:'hearse', name:'Last Ride', class:'Hearse / таран', price:12000, speed:.9, armor:1.3, handling:.85, shape:'hearse' },
  { id:'phantom', name:'Phantom X', class:'Prototype / элита', price:18000, speed:1.3, armor:1.05, handling:1.24, shape:'sport' },
];

const MACHINE_GUNS = [
  { id:'scrapgun', name:'Scrap Gun', desc:'Надёжный одиночный пулемёт', price:0, cooldown:.16, damage:3.2, range:30, spread:.055, kick:34, color:0xffcf68 },
  { id:'vulcan', name:'Двойной Vulcan', desc:'Высокий темп и плотный огонь', price:1800, cooldown:.095, damage:4.1, range:36, spread:.036, kick:55, color:0xffe369 },
  { id:'shredder', name:'Shredder M8', desc:'Предельный темп и дальность', price:6200, cooldown:.058, damage:3.7, range:43, spread:.024, kick:72, color:0xfff0a8 },
];
const MISSILE_LAUNCHERS = [
  { id:'none', name:'Без ракет', desc:'Второй слот свободен', price:0, cooldown:0, speed:0, turnRate:0, lockRange:0, damageScale:0 },
  { id:'sidewinder', name:'Sidewinder', desc:'Самонаведение по цели впереди', price:4200, cooldown:1.65, speed:64, turnRate:3.6, lockRange:58, damageScale:1 },
  { id:'reaper', name:'Reaper ×2', desc:'Быстрая ракета с цепким захватом', price:9800, cooldown:1.05, speed:76, turnRate:5.2, lockRange:76, damageScale:1.28 },
];

const COLORS = ['#d5ff18','#ff3c20','#ededdf','#2669ff','#c90045','#161918','#ffb000','#7e33ff'];

const LEVELS = [
  { id:0, name:'Ржавый район', subtitle:'Промзона / 2 круга', desc:'Бывший сталелитейный квартал. Узкие проезды, бетон и толпа, которой некуда бежать.', reward:2800, enemies:3, peds:16, quota:10, laps:2, sky:0x8fc9e8, fog:0xa8c3d0, ground:0x47463f, accent:0xff6a24, weather:'SUNNY', time:'14:10', bg:'radial-gradient(circle at 30% 22%,#e8a05a,transparent 26%),linear-gradient(140deg,#6f8791,#202b30)' },
  { id:1, name:'Неоновый порт', subtitle:'Док №13 / 3 круга', desc:'Контейнерный терминал под кислотным дождём. Быстрые прямые и слепые повороты.', reward:4500, enemies:4, peds:19, quota:13, laps:3, sky:0x10192e, fog:0x091224, ground:0x151b23, accent:0x27cfff, weather:'RAIN', time:'01:15', bg:'radial-gradient(circle at 70% 20%,#125ea3,transparent 25%),linear-gradient(140deg,#101b29,#07090c)' },
  { id:2, name:'Каньон костей', subtitle:'Пустошь / 2 круга', desc:'Старая трасса через красные скалы. Обрывы, пыльные бури и тяжёлая бронетехника.', reward:6800, enemies:5, peds:21, quota:15, laps:2, sky:0x753d27, fog:0x5b2e20, ground:0x653822, accent:0xffb12b, weather:'SANDSTORM', time:'16:05', bg:'radial-gradient(circle at 50% 15%,#c66b31,transparent 25%),linear-gradient(140deg,#5d3021,#140c09)' },
  { id:3, name:'Мёртвый центр', subtitle:'Megablock / 3 круга', desc:'Разрушенный деловой центр. Перекрёстки, эстакады и охотники на быстрых машинах.', reward:9200, enemies:6, peds:24, quota:18, laps:3, sky:0x252833, fog:0x14161d, ground:0x25282a, accent:0xc43cff, weather:'ASH', time:'06:20', bg:'radial-gradient(circle at 30% 22%,#6d2d83,transparent 25%),linear-gradient(140deg,#29242e,#09090b)' },
  { id:4, name:'Адский купол', subtitle:'Финал / 4 круга', desc:'Закрытая арена корпорации WRECK. Победитель получает всё. Проигравших перерабатывают.', reward:15000, enemies:8, peds:28, quota:25, laps:4, sky:0x210909, fog:0x180606, ground:0x241313, accent:0xff1616, weather:'INFERNO', time:'00:00', bg:'radial-gradient(circle at 50% 18%,#a21313,transparent 27%),linear-gradient(140deg,#2a0c0c,#070505)' },
  { id:5, name:'Солнечный мегаполис', subtitle:'Летний город / 2 круга / 4.8 км', desc:'Огромный дневной город: проспекты, деловой центр, промзона и длинная набережная соединены в скоростной маршрут.', reward:18500, enemies:9, peds:38, quota:28, laps:2, sky:0x85c9ef, fog:0xa8d5e7, ground:0x52614b, accent:0xffd34d, weather:'SUMMER', time:'13:40', bg:'radial-gradient(circle at 75% 18%,#ffd76a,transparent 24%),linear-gradient(140deg,#5e9cc0,#213d4a)', mapSize:430, roadWidth:18, buildingCount:92, season:'summer', route:[[-176,-128],[-105,-158],[-22,-145],[58,-166],[146,-125],[174,-52],[132,8],[164,82],[91,148],[8,126],[-72,160],[-158,112],[-132,42],[-170,-22],[-88,-52],[-24,6],[62,-22],[118,-76],[28,-92],[-58,-105]] },
  { id:6, name:'Зелёный предел', subtitle:'Лесной регион / 2 круга / 5.3 км', desc:'Трасса уходит из окраин города в густой лес, проходит мимо озёр и возвращается через старый промышленный посёлок.', reward:22000, enemies:10, peds:32, quota:25, laps:2, sky:0x91c9c0, fog:0x789990, ground:0x324b32, accent:0x6cff63, weather:'FOREST', time:'10:25', bg:'radial-gradient(circle at 35% 18%,#7bbf78,transparent 25%),linear-gradient(140deg,#355b48,#10251c)', mapSize:470, roadWidth:17, buildingCount:54, natureCount:150, season:'forest', route:[[-194,-54],[-152,-142],[-68,-176],[14,-140],[98,-184],[184,-112],[152,-24],[205,60],[132,148],[44,190],[-28,138],[-112,184],[-196,108],[-154,28],[-72,56],[-10,8],[68,54],[126,-18],[62,-72],[-32,-42],[-110,-82]] },
  { id:7, name:'Багряный тракт', subtitle:'Осенний округ / 3 круга / 4.6 км', desc:'Старая столица и холмистые пригороды под дождём из листьев. Узкие кварталы сменяются широкими загородными дугами.', reward:26500, enemies:10, peds:40, quota:31, laps:3, sky:0xb98a65, fog:0x8c684f, ground:0x594331, accent:0xff8a2b, weather:'AUTUMN', time:'17:10', bg:'radial-gradient(circle at 68% 20%,#d88743,transparent 28%),linear-gradient(140deg,#70472f,#241812)', mapSize:440, roadWidth:16, buildingCount:76, natureCount:115, season:'autumn', route:[[-181,-132],[-92,-170],[-8,-126],[72,-174],[158,-112],[122,-42],[182,24],[142,118],[58,154],[-18,108],[-96,166],[-174,104],[-132,28],[-182,-40],[-92,-72],[-20,-18],[58,-54],[126,-6],[70,62],[-12,44],[-88,10],[-140,-62]] },
  { id:8, name:'Белый разлом', subtitle:'Зимний город / 2 круга / 5.7 км', desc:'Замёрзшая северная агломерация с тоннелями между кварталами, ледяными прямыми и заснеженными объездными дорогами.', reward:31000, enemies:11, peds:34, quota:27, laps:2, sky:0xb9d3e5, fog:0xc8d7df, ground:0xd1d8d8, accent:0x55cfff, weather:'BLIZZARD', time:'08:15', bg:'radial-gradient(circle at 30% 16%,#dceeff,transparent 27%),linear-gradient(140deg,#8299aa,#29343d)', mapSize:500, roadWidth:19, buildingCount:88, natureCount:100, season:'winter', route:[[-214,-154],[-132,-202],[-40,-166],[52,-214],[158,-164],[218,-72],[174,12],[224,104],[142,196],[38,170],[-58,216],[-162,166],[-222,76],[-168,-8],[-218,-86],[-120,-92],[-48,-34],[36,-82],[116,-30],[168,-104],[72,-142],[-26,-104],[-112,-136]] },
  { id:9, name:'Хребет титанов', subtitle:'Горный мегарегион / 2 круга / 6.2 км', desc:'Самая большая карта: город в долине, серпантины, карьеры и высокогорные промышленные комплексы на одном беспощадном маршруте.', reward:38000, enemies:12, peds:36, quota:30, laps:2, sky:0x8795a3, fog:0x68717a, ground:0x4d4b46, accent:0xffc65a, weather:'MOUNTAIN', time:'15:30', bg:'radial-gradient(circle at 62% 14%,#aab0aa,transparent 26%),linear-gradient(140deg,#5b6162,#1d2022)', mapSize:540, roadWidth:17, buildingCount:62, natureCount:85, mountainCount:42, season:'mountain', route:[[-226,-176],[-154,-230],[-60,-188],[18,-238],[112,-202],[218,-142],[174,-54],[236,18],[198,118],[116,214],[22,180],[-72,236],[-170,196],[-236,106],[-192,22],[-242,-68],[-164,-118],[-86,-66],[-18,-124],[64,-82],[138,-136],[190,-62],[112,18],[166,88],[76,132],[4,86],[-78,148],[-152,84],[-102,10],[-178,-54],[-94,-142]] },
];

const DEFAULT_SAVE = {
  credits: 500000,
  testGrantVersion: 1,
  weaponLoadoutVersion: 2,
  unlockedLevel: 0,
  ownedCars: ['razor'],
  ownedMachineGuns: ['scrapgun'],
  ownedMissileLaunchers: ['none'],
  selectedCar: 'razor',
  selectedMachineGun: 'scrapgun',
  selectedMissileLauncher: 'none',
  color: COLORS[0],
  upgrades: {},
  best: {},
};

let save = loadSave();
let settings = loadSettings();
let game = null;
let menuDemo = null;
let garagePreview = null;
let previewModelsPromise = null;
let toastTimer;
let bindingCaptureCleanup = null;
let multiplayerClient = null;

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem('wreckrun-save') || '{}');
    const loaded = { ...structuredClone(DEFAULT_SAVE), ...stored };
    if ((stored.weaponLoadoutVersion || 0) < DEFAULT_SAVE.weaponLoadoutVersion) {
      const legacyOwned=stored.ownedWeapons||[];
      loaded.ownedMachineGuns=['scrapgun'];
      if(legacyOwned.includes('minigun'))loaded.ownedMachineGuns.push('vulcan');
      if(legacyOwned.includes('tesla'))loaded.ownedMachineGuns.push('shredder');
      loaded.ownedMissileLaunchers=['none'];
      if(legacyOwned.includes('rockets'))loaded.ownedMissileLaunchers.push('sidewinder');
      loaded.selectedMachineGun=stored.selectedWeapon==='minigun'?'vulcan':(stored.selectedWeapon==='tesla'?'shredder':'scrapgun');
      loaded.selectedMissileLauncher=stored.selectedWeapon==='rockets'?'sidewinder':'none';
      loaded.weaponLoadoutVersion=DEFAULT_SAVE.weaponLoadoutVersion;
    }
    loaded.ownedMachineGuns=[...new Set(['scrapgun',...(loaded.ownedMachineGuns||[])])].filter(id=>MACHINE_GUNS.some(item=>item.id===id));
    loaded.ownedMissileLaunchers=[...new Set(['none',...(loaded.ownedMissileLaunchers||[])])].filter(id=>MISSILE_LAUNCHERS.some(item=>item.id===id));
    if(!loaded.ownedMachineGuns.includes(loaded.selectedMachineGun))loaded.selectedMachineGun='scrapgun';
    if(!loaded.ownedMissileLaunchers.includes(loaded.selectedMissileLauncher))loaded.selectedMissileLauncher='none';
    if ((stored.testGrantVersion || 0) < DEFAULT_SAVE.testGrantVersion) {
      loaded.credits = Math.max(loaded.credits || 0, DEFAULT_SAVE.credits);
      loaded.testGrantVersion = DEFAULT_SAVE.testGrantVersion;
    }
    localStorage.setItem('wreckrun-save', JSON.stringify(loaded));
    return loaded;
  }
  catch { return structuredClone(DEFAULT_SAVE); }
}
function persist() { localStorage.setItem('wreckrun-save', JSON.stringify(save)); }
function loadSettings(){try{const stored=JSON.parse(localStorage.getItem('wreckrun-settings')||'{}'),loaded={...structuredClone(DEFAULT_SETTINGS),...stored,bindings:{...DEFAULT_SETTINGS.bindings,...(stored.bindings||{})}};if((stored.controlLayoutVersion||0)<DEFAULT_SETTINGS.controlLayoutVersion){loaded.bindings.handbrake='Space';loaded.bindings.fire='KeyF';loaded.controlLayoutVersion=DEFAULT_SETTINGS.controlLayoutVersion;localStorage.setItem('wreckrun-settings',JSON.stringify(loaded));}return loaded;}catch{return structuredClone(DEFAULT_SETTINGS);}}
function persistSettings(){localStorage.setItem('wreckrun-settings',JSON.stringify(settings));}
function graphicsPreset(){return GRAPHICS_PRESETS[settings.graphics]||GRAPHICS_PRESETS.high;}
function keyLabel(code){return({Space:'ПРОБЕЛ',ShiftLeft:'ЛЕВЫЙ SHIFT',ShiftRight:'ПРАВЫЙ SHIFT',Escape:'ESC',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ControlLeft:'ЛЕВЫЙ CTRL',ControlRight:'ПРАВЫЙ CTRL'}[code]||code.replace(/^Key/,'').replace(/^Digit/,''));}
function money(n) { return new Intl.NumberFormat('ru-RU').format(n); }
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({"&":'&amp;',"<":'&lt;',">":'&gt;',"\"":'&quot;',"'":'&#39;'}[char]));}
function currentCar() { return CARS.find(c => c.id === save.selectedCar) || CARS[0]; }
function upgrades(carId = save.selectedCar) { return save.upgrades[carId] || { engine:0, armor:0, handling:0 }; }
function topbar(title) {
  return `<header class="topbar"><button class="back-btn" data-back>← Назад</button><h2>${title}</h2><div class="currency">ДЕТАЛИ: <strong>₡ ${money(save.credits)}</strong></div></header>`;
}
function bindBack() { document.querySelector('[data-back]')?.addEventListener('click', showMenu); }
function showToast(text) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.append(el); }
  el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

function stopShowroom() {
  bindingCaptureCleanup?.(); bindingCaptureCleanup = null;
  menuDemo?.destroy(); menuDemo = null;
  garagePreview?.destroy(); garagePreview = null;
}

function showMenu() {
  game?.destroy(); game = null; stopShowroom();
  app.innerHTML = `
    <section class="screen menu-screen">
      <div class="menu-demo" data-menu-demo aria-hidden="true"><div class="demo-loading">ЗАГРУЗКА LIVE FEED...</div><div class="demo-caption">RAPIER AI // LIVE SIMULATION</div></div>
      <main class="menu-column">
        <div class="eyebrow">WRECK INDUSTRIES // ПРЕДСТАВЛЯЕТ</div>
        <h1 class="brand">Wreckrun<span>Aftermath</span></h1>
        <p class="tagline">Десять районов. Три способа победить. Никаких правил, кроме одного: до финиша должен дожить хотя бы кто-то.</p>
        <nav class="main-nav">
          <button class="nav-btn" data-action="campaign">Продолжить бой <small>КАМПАНИЯ</small></button>
          <button class="nav-btn" data-action="garage">Гараж <small>МАШИНЫ / ОРУЖИЕ</small></button>
          <button class="nav-btn" data-action="quick">Быстрый заезд <small>УРОВЕНЬ ${save.unlockedLevel + 1}</small></button>
          <button class="nav-btn" data-action="multiplayer">Мультиплеер <small>КОМНАТЫ / ДО 12 СЛОТОВ</small></button>
          <button class="nav-btn" data-action="settings">Настройки <small>УПРАВЛЕНИЕ / ГРАФИКА</small></button>
          <button class="nav-btn" data-action="reset">Новая кампания <small>СБРОС</small></button>
        </nav>
        <div class="version">BUILD ${GAME_VERSION} // WEBGL / RAPIER // ALL SYSTEMS ARMED</div>
      </main>
    </section>`;
  document.querySelector('[data-action="campaign"]').onclick = showCampaign;
  document.querySelector('[data-action="garage"]').onclick = showGarage;
  document.querySelector('[data-action="quick"]').onclick = () => showBriefing(save.unlockedLevel);
  document.querySelector('[data-action="multiplayer"]').onclick = showMultiplayer;
  document.querySelector('[data-action="settings"]').onclick = () => showSettings('controls');
  document.querySelector('[data-action="reset"]').onclick = () => {
    if (confirm('Стереть прогресс кампании и все покупки?')) { save = structuredClone(DEFAULT_SAVE); persist(); showMenu(); }
  };
  menuDemo = createPhysicsMenuDemo(document.querySelector('[data-menu-demo]'));
}

async function showMultiplayer(){
  stopShowroom();multiplayerClient?.close();multiplayerClient=new MultiplayerClient();let rooms=[],room=null,error='';const playerName=localStorage.getItem('wreckrun-player-name')||`Driver-${Math.floor(100+Math.random()*900)}`;
  const render=()=>{if(room){const isHost=room.hostId===multiplayerClient.playerId;app.innerHTML=`<section class="screen panel-screen multiplayer-screen">${topbar('Мультиплеер // <span>комната '+room.id+'</span>')}<main class="multiplayer-wrap"><div class="lobby-card"><div class="section-kicker"><span>${escapeHtml(room.name)}</span><span>${room.status.toUpperCase()}</span></div><h3>${LEVELS[room.levelId]?.name||'Район'}</h3><div class="lobby-stats"><div><small>ВСЕГО СЛОТОВ</small><strong>${room.slots}</strong></div><div><small>ИГРОКИ</small><strong>${room.players.length}/${room.humanSlots}</strong></div><div><small>ИИ</small><strong>${room.aiSlots}</strong></div></div><div class="lobby-players">${room.players.map((player,index)=>`<div><i style="background:${escapeHtml(player.color)}"></i><strong>${escapeHtml(player.name)}</strong><small>${player.id===room.hostId?'ХОСТ':`ИГРОК ${index+1}`}</small></div>`).join('')}${Array.from({length:room.aiSlots},(_,index)=>`<div class="ai"><i></i><strong>WRECKBOT ${index+1}</strong><small>ИИ</small></div>`).join('')}</div>${isHost?'<button class="action-btn" data-start-room>Начать заезд</button>':'<p class="lobby-wait">Хост выбирает момент старта…</p>'}<button class="ghost-btn" data-leave-room>Покинуть комнату</button></div></main></section>`;document.querySelector('[data-start-room]')?.addEventListener('click',()=>multiplayerClient.send('start'));document.querySelector('[data-leave-room]').onclick=()=>{multiplayerClient.close();multiplayerClient=null;showMenu();};document.querySelector('[data-back]').onclick=()=>{multiplayerClient.close();multiplayerClient=null;showMenu();};return;}
    app.innerHTML=`<section class="screen panel-screen multiplayer-screen">${topbar('Мультиплеер // <span>сетевые комнаты</span>')}<main class="multiplayer-wrap"><section class="lobby-card create-room"><div class="section-kicker"><span>Создать заезд</span><span>WEBSOCKET</span></div><label>Имя водителя<input data-player-name value="${escapeHtml(playerName)}" maxlength="20"></label><label>Название комнаты<input data-room-name value="Городская бойня" maxlength="28"></label><label>Карта<select data-room-level>${LEVELS.map(level=>`<option value="${level.id}">${String(level.id+1).padStart(2,'0')} // ${level.name}</option>`).join('')}</select></label><div class="lobby-form-grid"><label>Всего слотов<input type="number" data-room-slots min="2" max="12" value="8"></label><label>Слотов ИИ<input type="number" data-room-ai min="0" max="11" value="4"></label></div><button class="action-btn" data-create-room>Создать комнату</button>${error?`<p class="lobby-error">${escapeHtml(error)}</p>`:''}</section><section class="lobby-card room-browser"><div class="section-kicker"><span>Доступные комнаты</span><span>${rooms.length}</span></div>${rooms.length?rooms.map(item=>`<button class="room-row" data-join-room="${item.id}"><span><strong>${escapeHtml(item.name)}</strong><small>${LEVELS[item.levelId]?.name||'Карта'} · ИИ ${item.aiSlots}</small></span><b>${item.players.length}/${item.humanSlots}</b></button>`).join(''):'<p class="empty-rooms">Открытых комнат пока нет. Создай первую.</p>'}</section></main></section>`;document.querySelector('[data-back]').onclick=()=>{multiplayerClient.close();multiplayerClient=null;showMenu();};document.querySelector('[data-create-room]').onclick=()=>{const name=document.querySelector('[data-player-name]').value.trim()||'Водитель';localStorage.setItem('wreckrun-player-name',name);multiplayerClient.send('create',{playerName:name,roomName:document.querySelector('[data-room-name]').value,levelId:+document.querySelector('[data-room-level]').value,slots:+document.querySelector('[data-room-slots]').value,aiSlots:+document.querySelector('[data-room-ai]').value,carId:save.selectedCar,color:save.color});};document.querySelectorAll('[data-join-room]').forEach(button=>button.onclick=()=>{const name=document.querySelector('[data-player-name]').value.trim()||'Водитель';localStorage.setItem('wreckrun-player-name',name);multiplayerClient.send('join',{roomId:button.dataset.joinRoom,playerName:name,carId:save.selectedCar,color:save.color});});};
  app.innerHTML='<section class="screen loading-screen"><div class="loader-mark">MP</div><div class="eyebrow">ПОДКЛЮЧЕНИЕ К СЕРВЕРУ КОМНАТ</div><p data-load-label>WebSocket handshake…</p></section>';multiplayerClient.on('welcome',message=>{rooms=message.rooms||[];render();});multiplayerClient.on('rooms',message=>{rooms=message.rooms||[];if(!room)render();});multiplayerClient.on('room',message=>{room=message.room;render();});multiplayerClient.on('error',message=>{error=message.message;render();});multiplayerClient.on('race_started',message=>{room=message.room;startGame(room.levelId,{client:multiplayerClient,room,playerId:multiplayerClient.playerId});});try{await multiplayerClient.connect();}catch(connectionError){error=connectionError.message;rooms=[];render();}
}

function showSettings(tab='controls'){
  stopShowroom();
  const tabs={controls:'Управление',graphics:'Графика',about:'Об игре'};
  const actions=[['accelerate','Газ'],['brake','Тормоз / задний ход'],['left','Поворот влево'],['right','Поворот вправо'],['handbrake','Ручной тормоз / занос'],['fire','Пулемёт (клавиша)'],['nitro','Нитро'],['reset','Эвакуация'],['pause','Пауза']];
  let content='';
  if(tab==='controls')content=`<div class="settings-section"><div class="settings-heading"><div><div class="eyebrow">INPUT // DRIVER PROFILE</div><h3>Управление</h3></div><button class="ghost-btn compact" data-reset-controls>Сбросить</button></div><div class="setting-slider"><label><span>Чувствительность руля</span><b data-steer-value>${Math.round(settings.steeringSensitivity*100)}%</b></label><input type="range" min="45" max="120" value="${Math.round(settings.steeringSensitivity*100)}" data-steer-sensitivity></div><div class="setting-slider"><label><span>Скорость отклика руля</span><b data-smooth-value>${settings.steeringSmoothing.toFixed(1)}</b></label><input type="range" min="20" max="90" value="${Math.round(settings.steeringSmoothing*10)}" data-steer-smoothing></div><div class="setting-slider"><label><span>Чувствительность камеры</span><b data-camera-value>${Math.round(settings.cameraSensitivity*10000)}</b></label><input type="range" min="25" max="120" value="${Math.round(settings.cameraSensitivity*10000)}" data-camera-sensitivity></div><label class="setting-toggle"><span><strong>Инверсия камеры по горизонтали</strong><small>Меняет направление вращения при перетаскивании мышью</small></span><input type="checkbox" data-invert-camera ${settings.invertCameraX?'checked':''}><i></i></label><div class="binding-grid">${actions.map(([id,label])=>`<div class="binding-row"><span>${label}</span><button class="key-bind" data-bind="${id}">${keyLabel(settings.bindings[id])}</button></div>`).join('')}</div></div>`;
  if(tab==='graphics')content=`<div class="settings-section"><div class="settings-heading"><div><div class="eyebrow">RENDER // QUALITY PROFILE</div><h3>Графика</h3></div></div><div class="quality-grid">${Object.entries(GRAPHICS_PRESETS).map(([id,preset])=>`<button class="quality-card ${settings.graphics===id?'active':''}" data-quality="${id}"><strong>${preset.label}</strong><span>${preset.description}</span><small>${preset.shadows?`ТЕНИ ${preset.shadowSize}px`:'ТЕНИ ВЫКЛ'} · SCALE ${preset.pixelRatio}</small></button>`).join('')}</div><div class="settings-note"><strong>Изменения применяются при следующем запуске сцены.</strong><p>Низкий пресет отключает динамические тени и снижает внутреннее разрешение. Ультра использует повышенное разрешение и карту теней 4096 px.</p></div></div>`;
  if(tab==='about')content=`<div class="settings-section about-game"><div class="eyebrow">WRECK INDUSTRIES // DOSSIER</div><h3>Wreckrun: Aftermath</h3><p>Аркадная автомобильная бойня о гонках без правил. Побеждай кругами, уничтожением всех соперников или выполнением квоты. Машины деформируются, оружие перестраивает бой, а каждый район предлагает собственный свет, погоду и характер противников.</p><div class="about-grid"><div><small>Версия</small><strong>${GAME_VERSION}</strong></div><div><small>Движок</small><strong>THREE.JS + RAPIER</strong></div><div><small>Кампания</small><strong>10 РАЙОНОВ</strong></div><div><small>Сборка</small><strong>WEBGL DESKTOP</strong></div></div><p class="legal-note">Независимый браузерный прототип. Не является официальной игрой серии Carmageddon.</p></div>`;
  app.innerHTML=`<section class="screen panel-screen settings-screen">${topbar(`Настройки // <span>${tabs[tab]}</span>`)}<div class="settings-layout"><nav class="settings-tabs">${Object.entries(tabs).map(([id,label])=>`<button class="settings-tab ${tab===id?'active':''}" data-settings-tab="${id}">${label}</button>`).join('')}</nav><main class="settings-content">${content}</main></div></section>`;
  bindBack();document.querySelectorAll('[data-settings-tab]').forEach(button=>button.onclick=()=>showSettings(button.dataset.settingsTab));
  document.querySelector('[data-reset-controls]')?.addEventListener('click',()=>{settings={...settings,steeringSensitivity:DEFAULT_SETTINGS.steeringSensitivity,steeringSmoothing:DEFAULT_SETTINGS.steeringSmoothing,cameraSensitivity:DEFAULT_SETTINGS.cameraSensitivity,invertCameraX:DEFAULT_SETTINGS.invertCameraX,bindings:{...DEFAULT_SETTINGS.bindings}};persistSettings();showSettings('controls');});
  const bindRange=(selector,valueSelector,apply,format)=>{const input=document.querySelector(selector),output=document.querySelector(valueSelector);input?.addEventListener('input',()=>{const value=+input.value;apply(value);output.textContent=format(value);persistSettings();});};
  bindRange('[data-steer-sensitivity]','[data-steer-value]',value=>settings.steeringSensitivity=value/100,value=>`${value}%`);
  bindRange('[data-steer-smoothing]','[data-smooth-value]',value=>settings.steeringSmoothing=value/10,value=>(value/10).toFixed(1));
  bindRange('[data-camera-sensitivity]','[data-camera-value]',value=>settings.cameraSensitivity=value/10000,value=>String(value));
  document.querySelector('[data-invert-camera]')?.addEventListener('change',event=>{settings.invertCameraX=event.target.checked;persistSettings();});
  document.querySelectorAll('[data-quality]').forEach(button=>button.onclick=()=>{settings.graphics=button.dataset.quality;persistSettings();showSettings('graphics');});
  document.querySelectorAll('[data-bind]').forEach(button=>button.onclick=()=>{bindingCaptureCleanup?.();const action=button.dataset.bind,previous=settings.bindings[action];button.textContent='НАЖМИТЕ КЛАВИШУ';button.classList.add('listening');const capture=event=>{event.preventDefault();event.stopPropagation();bindingCaptureCleanup?.();if(event.code==='Escape'&&action!=='pause'){button.textContent=keyLabel(previous);button.classList.remove('listening');return;}const occupied=Object.entries(settings.bindings).find(([id,code])=>id!==action&&code===event.code);if(occupied)settings.bindings[occupied[0]]=previous;settings.bindings[action]=event.code;persistSettings();showSettings('controls');};bindingCaptureCleanup=()=>removeEventListener('keydown',capture,true);addEventListener('keydown',capture,{capture:true});});
}

function showGarage() {
  stopShowroom();
  const car = currentCar(); const up = upgrades(),machineGun=MACHINE_GUNS.find(w=>w.id===save.selectedMachineGun),missileLauncher=MISSILE_LAUNCHERS.find(w=>w.id===save.selectedMissileLauncher);
  app.innerHTML = `<section class="screen panel-screen">
    ${topbar('Гараж // <span>мясорубка</span>')}
    <div class="garage-layout">
      <div class="car-stage">
        <div class="garage-preview-3d" data-garage-preview><div class="preview-loading">ЗАГРУЗКА ПЛАТФОРМЫ...</div></div>
        <div class="stage-label"><h3>${car.name}</h3><p>${car.class.toUpperCase()} // ЛКМ: ${machineGun.name.toUpperCase()} // ПКМ: ${missileLauncher.name.toUpperCase()}</p></div>
      </div>
      <aside class="garage-controls">
        <section class="control-section"><div class="section-kicker"><span>Платформа</span><span>${save.ownedCars.length}/${CARS.length}</span></div>
          <div class="car-selector">${CARS.map(c=>`<button class="car-choice ${c.id===car.id?'active':''}" data-car="${c.id}"><strong>${c.name}</strong><small>${save.ownedCars.includes(c.id)?c.class:`₡ ${money(c.price)}`}</small></button>`).join('')}</div>
        </section>
        <section class="control-section"><div class="section-kicker"><span>Характеристики Mk.${1 + Math.max(up.engine,up.armor,up.handling)}</span><span>MAX 5</span></div>
          ${stat('Скорость', Math.min(100, car.speed*58+up.engine*8), Math.round(car.speed*220+up.engine*16)+' км/ч')}
          ${stat('Броня', Math.min(100, car.armor*55+up.armor*9), Math.round(car.armor*100+up.armor*18)+' мм')}
          ${stat('Контроль', Math.min(100, car.handling*57+up.handling*8), Math.round(car.handling*70+up.handling*7)+'%')}
          <div class="upgrade-row">
            ${upgradeButton('engine','Двигатель',up.engine)}${upgradeButton('armor','Броня',up.armor)}${upgradeButton('handling','Шасси',up.handling)}
          </div>
        </section>
        <section class="control-section"><div class="section-kicker"><span>Покраска</span><span>БЕСПЛАТНО</span></div><div class="swatches">${COLORS.map(c=>`<button class="swatch ${save.color===c?'active':''}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div></section>
        <section class="control-section"><div class="section-kicker"><span>Пулемёты // ЛКМ</span><span>${save.ownedMachineGuns.length}/${MACHINE_GUNS.length}</span></div><div class="weapon-grid">${MACHINE_GUNS.map(w=>`<button class="weapon-card ${w.id===save.selectedMachineGun?'active':''}" data-machine-gun="${w.id}"><span><strong>${w.name}</strong><small>${w.desc}</small></span><b>${w.id===save.selectedMachineGun?'УСТАНОВЛЕНО':save.ownedMachineGuns.includes(w.id)?'УСТАНОВИТЬ':'₡ '+money(w.price)}</b></button>`).join('')}</div></section>
        <section class="control-section"><div class="section-kicker"><span>Самонаводящиеся ракеты // ПКМ</span><span>${save.ownedMissileLaunchers.length}/${MISSILE_LAUNCHERS.length}</span></div><div class="weapon-grid">${MISSILE_LAUNCHERS.map(w=>`<button class="weapon-card missile ${w.id===save.selectedMissileLauncher?'active':''}" data-missile-launcher="${w.id}"><span><strong>${w.name}</strong><small>${w.desc}</small></span><b>${w.id===save.selectedMissileLauncher?'УСТАНОВЛЕНО':save.ownedMissileLaunchers.includes(w.id)?'УСТАНОВИТЬ':'₡ '+money(w.price)}</b></button>`).join('')}</div></section>
        <button class="action-btn" data-race>Выбрать район и выехать</button>
      </aside>
    </div></section>`;
  bindBack();
  document.querySelectorAll('[data-car]').forEach(btn => btn.onclick = () => buyOrSelectCar(btn.dataset.car));
  document.querySelectorAll('[data-color]').forEach(btn => btn.onclick = () => { save.color=btn.dataset.color;persist();showGarage(); });
  document.querySelectorAll('[data-machine-gun]').forEach(btn => btn.onclick = () => buyOrSelectWeapon('machineGun',btn.dataset.machineGun));
  document.querySelectorAll('[data-missile-launcher]').forEach(btn => btn.onclick = () => buyOrSelectWeapon('missileLauncher',btn.dataset.missileLauncher));
  document.querySelectorAll('[data-upgrade]').forEach(btn => btn.onclick = () => buyUpgrade(btn.dataset.upgrade));
  document.querySelector('[data-race]').onclick = showCampaign;
  garagePreview = createGaragePreview(document.querySelector('[data-garage-preview]'), car, save.color);
}

function stat(label, width, value) { return `<div class="stat-row"><span>${label}</span><div class="stat-bar"><i style="width:${width}%"></i></div><b>${value}</b></div>`; }
function upgradeButton(id,label,lvl) { const cost=(lvl+1)*900; return `<button class="buy-btn" data-upgrade="${id}" ${lvl>=5?'disabled':''}>${label} ${lvl>=5?'MAX':`+1 · ₡${money(cost)}`}</button>`; }
function buyOrSelectCar(id) {
  const car=CARS.find(c=>c.id===id);
  if (!save.ownedCars.includes(id)) { if(save.credits<car.price){showToast('Не хватает деталей');return;} save.credits-=car.price;save.ownedCars.push(id);showToast(`${car.name} куплен`); }
  save.selectedCar=id; persist(); showGarage();
}
function buyOrSelectWeapon(type,id) {
  const machineGun=type==='machineGun',weapons=machineGun?MACHINE_GUNS:MISSILE_LAUNCHERS,ownedKey=machineGun?'ownedMachineGuns':'ownedMissileLaunchers',selectedKey=machineGun?'selectedMachineGun':'selectedMissileLauncher',weapon=weapons.find(w=>w.id===id);if(!weapon)return;
  if(!save[ownedKey].includes(id)){if(save.credits<weapon.price){showToast('Не хватает деталей');return;}save.credits-=weapon.price;save[ownedKey].push(id);showToast(`${weapon.name} куплен`);}
  save[selectedKey]=id;persist();showGarage();
}
function buyUpgrade(type){
  const up=upgrades(); const cost=(up[type]+1)*900;
  if(up[type]>=5)return; if(save.credits<cost){showToast('Не хватает деталей');return;}
  save.credits-=cost;up[type]++;save.upgrades[save.selectedCar]=up;persist();showGarage();
}

function showCampaign() {
  stopShowroom();
  app.innerHTML = `<section class="screen panel-screen">${topbar('Кампания // <span>путь разрушения</span>')}
    <div class="campaign-wrap"><div class="campaign-intro"><div class="eyebrow">СЕЗОН 01 // AFTERMATH</div><h3>Доберись до<br>Адского купола</h3><p>В каждом заезде можно победить тремя способами: закончить все круги, уничтожить всех соперников или выполнить квоту по пешеходам. Грязная победа всё равно считается победой.</p></div>
    <div class="level-list">${LEVELS.map(l=>`<article class="level-card ${l.id>save.unlockedLevel?'locked':''}" data-level="${l.id}" style="--level-bg:${l.bg}"><span class="num">0${l.id+1}</span><div class="eyebrow">${l.id<=save.unlockedLevel?'ДОСТУП РАЗРЕШЁН':'ЗАБЛОКИРОВАНО'}</div><h4>${l.name}</h4><p>${l.desc}</p><div class="level-meta"><span>${l.subtitle}</span><span>₡ ${money(l.reward)}</span></div></article>`).join('')}</div></div></section>`;
  bindBack();
  document.querySelectorAll('[data-level]').forEach(card=>card.onclick=()=>{const id=+card.dataset.level;if(id<=save.unlockedLevel)showBriefing(id);});
}

function showBriefing(id){
  stopShowroom();
  const level=LEVELS[id];
  app.innerHTML=`<section class="screen panel-screen" style="background:${level.bg}"><div class="briefing-modal"><div class="modal-card"><div class="eyebrow">БРИФИНГ // УРОВЕНЬ 0${id+1}</div><h2>${level.name}</h2><p>${level.desc}</p><div class="result-stats"><div class="result-stat"><strong>${level.laps}</strong><small>КРУГА</small></div><div class="result-stat"><strong>${level.enemies}</strong><small>СОПЕРНИКОВ</small></div><div class="result-stat"><strong>${level.quota}</strong><small>КВОТА</small></div></div><p>Победи любым способом. Награда: <b style="color:var(--acid)">₡ ${money(level.reward)}</b><br>Управление: ${keyLabel(settings.bindings.accelerate)} / ${keyLabel(settings.bindings.brake)} / ${keyLabel(settings.bindings.left)} / ${keyLabel(settings.bindings.right)} · ${keyLabel(settings.bindings.handbrake)} — ручник · ЛКМ — пулемёт · ПКМ — ракета · СКМ — обзор · ${keyLabel(settings.bindings.nitro)} — нитро · ${keyLabel(settings.bindings.reset)} — эвакуация.</p><div class="modal-actions"><button class="action-btn" data-deploy>Выехать на старт</button><button class="ghost-btn" data-cancel>Вернуться</button></div></div></div></section>`;
  document.querySelector('[data-deploy]').onclick=()=>startGame(id);
  document.querySelector('[data-cancel]').onclick=showCampaign;
}

async function startGame(levelId,multiplayer=null){
  stopShowroom();
  app.innerHTML=`<section class="screen loading-screen"><div class="loader-mark">WR</div><div class="eyebrow">ЗАГРУЗКА БОЕВОГО КОМПЛЕКТА</div><div class="loader-bar"><i data-load-progress></i></div><p data-load-label>Инициализация физики…</p></section>`;
  await RAPIER.init();
  game=new WreckrunGame(LEVELS[levelId],multiplayer);
  await game.init();
}

class WreckrunGame {
  constructor(level,multiplayer=null){
    this.level=level; this.clock=new THREE.Clock(); this.keys={}; this.entities=[]; this.opponents=[]; this.pedestrians=[]; this.particles=[]; this.projectiles=[];
    this.multiplayer=multiplayer;this.remotePlayers=new Map();this.lastNetworkSend=-10;this.ragdolls=[];this.physicsDebris=[];this.destructibles=[];this.navigationObstacles=[];this.burningCars=[];this.bloodDecals=[];this.deferredEffects=[];this.effectLights=[];this.colliderVehicles=new Map();this.colliderDestructibles=new Map();this.impactFxCooldown=new Map();this.elapsed=0;this.kills=0;this.wrecks=0;this.totalDamage=0;this.runCredits=0;this.lap=0;this.checkpoint=0;this.ended=false;this.paused=false;this.lastPrimaryShot=-10;this.lastMissileShot=-10;this.pointerFire={primary:false,secondary:false};this.shake=0;this.accumulator=0;this.playerDeathPending=false;this.deathModalAt=Infinity;this.victoryPending=false;this.victoryModalAt=Infinity;this.cameraOrbitYaw=0;this.cameraOrbitPitch=0;this.cameraZoom=1;this.cameraZoomTarget=1;this.cameraDragging=false;this.lastCameraInput=-10;this.boostIntensity=0;this.boostEmit=0;
  }

  async init(){
    this.setupRenderer();this.setupScene();
    const physics=createPhysicsWorld();this.physics=physics.world;this.eventQueue=physics.eventQueue;createArenaColliders(this.physics,(this.level.mapSize||260)*.5);
    this.models=new ModelLibrary(this.renderer);
    const progress=document.querySelector('[data-load-progress]'),label=document.querySelector('[data-load-label]');
    await this.models.preload(value=>{if(progress)progress.style.width=`${Math.round(value*100)}%`;if(label)label.textContent=`Модели, текстуры и физика: ${Math.round(value*100)}%`;});
    this.setupWorld();this.setupActors();this.setupMultiplayer();this.setupUI();document.querySelector('.loading-screen')?.remove();this.bindEvents();this.animate();
  }

  setupRenderer(){
    const quality=graphicsPreset();
    this.renderer=new THREE.WebGLRenderer({antialias:quality.antialias,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality.pixelRatio)); this.renderer.setSize(innerWidth,innerHeight); this.renderer.shadowMap.enabled=quality.shadows; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15; this.renderer.domElement.id='game-canvas';app.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,650);
  }

  setupScene(){
    const quality=graphicsPreset();
    const daylight=this.level.id===0;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(this.level.sky);this.scene.fog=new THREE.FogExp2(this.level.fog,daylight?.0042:.0085);
    const hemi=new THREE.HemisphereLight(daylight?0xcfeaff:this.level.accent,daylight?0x5a4634:0x17120f,daylight?2.15:1.6);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(daylight?0xfff1cf:0xffe0c0,daylight?3.6:2.4);sun.position.set(daylight?-48:-35,daylight?78:60,daylight?-36:-25);sun.castShadow=quality.shadows;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);sun.shadow.camera.left=-96;sun.shadow.camera.right=96;sun.shadow.camera.top=96;sun.shadow.camera.bottom=-96;sun.shadow.camera.near=1;sun.shadow.camera.far=190;sun.shadow.bias=-.00018;sun.shadow.normalBias=.045;sun.shadow.radius=2;this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(daylight?0x71808a:0x252a31,daylight?.72:.55));
    for(let i=0;i<4;i++){const light=new THREE.PointLight(0xff4317,0,30,2);light.visible=true;this.scene.add(light);this.effectLights.push({light,life:0,duration:0,peak:0,owner:null});}
  }

  setupWorld(){
    const mapSize=this.level.mapSize||260,groundTexture=makeSurfaceTexture(this.renderer,`ground-${this.level.season||'arena'}`,this.level.ground),ground=new THREE.Mesh(new THREE.PlaneGeometry(mapSize,mapSize),new THREE.MeshStandardMaterial({color:this.level.ground,map:groundTexture,roughness:.96,metalness:.04}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const grid=new THREE.GridHelper(mapSize,Math.round(mapSize/2),new THREE.Color(this.level.accent).multiplyScalar(.25),new THREE.Color(0x252525));grid.position.y=.025;grid.material.opacity=this.level.route?.08:.18;grid.material.transparent=true;this.scene.add(grid);
    this.waypoints=(this.level.route||[[-55,-38],[0,-54],[55,-38],[66,0],[55,38],[0,54],[-55,38],[-66,0]]).map(([x,z])=>new THREE.Vector3(x,0,z));this.minimapBounds={x:mapSize*.55,z:mapSize*.55};
    this.buildTrack();this.buildCity();
    const obstacleCount=this.level.route?Math.round(mapSize/10):18;for(let i=0;i<obstacleCount;i++){const point=this.waypoints[Math.floor(Math.random()*this.waypoints.length)],x=point.x+(Math.random()-.5)*(this.level.roadWidth||18)*.7,z=point.z+(Math.random()-.5)*(this.level.roadWidth||18)*.7;if(i<3&&point===this.waypoints[0])continue;this.makeObstacle(x,z);}
    for(let i=0;i<(this.level.route?this.waypoints.length*2:30);i++)this.makeBreakablePole(i/(this.level.route?this.waypoints.length*2:30)*Math.PI*2);
  }

  buildTrack(){
    const roadMat=new THREE.MeshStandardMaterial({color:0x242726,map:makeSurfaceTexture(this.renderer,'asphalt',0x303332),roughness:.9,metalness:.1});
    const dashMat=new THREE.MeshBasicMaterial({color:0xd5b95a});
    if(this.level.route){const roadWidth=this.level.roadWidth||18;for(let i=0;i<this.waypoints.length;i++){const a=this.waypoints[i],b=this.waypoints[(i+1)%this.waypoints.length],delta=b.clone().sub(a),length=delta.length(),yaw=Math.atan2(delta.x,delta.z),road=new THREE.Mesh(new THREE.BoxGeometry(roadWidth,.05,length+roadWidth*.35),roadMat);road.position.copy(a).lerp(b,.5);road.position.y=.045;road.rotation.y=yaw;road.receiveShadow=true;this.scene.add(road);const joint=new THREE.Mesh(new THREE.CylinderGeometry(roadWidth*.52,roadWidth*.52,.052,18),roadMat);joint.position.set(a.x,.046,a.z);this.scene.add(joint);for(let d=5;d<length;d+=8){const dash=new THREE.Mesh(new THREE.BoxGeometry(.18,.04,3.2),dashMat);dash.position.copy(a).addScaledVector(delta.clone().normalize(),d);dash.position.y=.081;dash.rotation.y=yaw;this.scene.add(dash);}}}else{const outer=new THREE.Shape();outer.absellipse(0,0,78,62,0,Math.PI*2,false);const hole=new THREE.Path();hole.absellipse(0,0,47,31,0,Math.PI*2,true);outer.holes.push(hole);const road=new THREE.Mesh(new THREE.ShapeGeometry(outer,96),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.045;road.receiveShadow=true;this.scene.add(road);for(let i=0;i<56;i++){const a=i/56*Math.PI*2,dash=new THREE.Mesh(new THREE.BoxGeometry(3,.035,.18),dashMat);dash.position.set(Math.cos(a)*62,.08,Math.sin(a)*46);dash.rotation.y=-a;this.scene.add(dash);}}
    this.checkpointMeshes=[];
    this.waypoints.forEach((p,i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(5.8,.16,6,24),new THREE.MeshBasicMaterial({color:i===0?this.level.accent:0x52605a,transparent:true,opacity:i===0?.85:.13}));ring.position.copy(p);ring.position.y=.25;ring.rotation.x=Math.PI/2;this.scene.add(ring);this.checkpointMeshes.push(ring);});
  }

  buildCity(){
    const rng=mulberry32(777+this.level.id*313);
    if(this.level.route){this.buildRouteEnvironment(rng);return;}
    for(let i=0;i<46;i++){
      const a=rng()*Math.PI*2,radius=88+rng()*34;
      const building=this.models.createEnvironment(this.level.id,i);
      building.updateMatrixWorld(true);const initialBounds=new THREE.Box3().setFromObject(building),initialSize=initialBounds.getSize(new THREE.Vector3()),desiredHeight=(this.level.id===0||this.level.id===2?10:15)+rng()*(this.level.id===3?28:18),scale=desiredHeight/Math.max(1,initialSize.y),yaw=-a+Math.PI/2+(rng()-.5)*.16;building.scale.setScalar(scale);building.updateMatrixWorld(true);const localBounds=new THREE.Box3().setFromObject(building),localSize=localBounds.getSize(new THREE.Vector3()),localCenter=localBounds.getCenter(new THREE.Vector3());building.rotation.y=yaw;
      building.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);building.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(building);building.position.y-=bounds.min.y;
      building.traverse(object=>{if(object.isMesh){object.material.roughness=Math.min(.86,object.material.roughness??.7);if(this.level.id===4)object.material.color?.multiplyScalar(.72);}});
      this.scene.add(building);
      building.updateMatrixWorld(true);const navigationBounds=new THREE.Box3().setFromObject(building);navigationBounds.min.x-=.7;navigationBounds.max.x+=.7;navigationBounds.min.z-=.7;navigationBounds.max.z+=.7;this.navigationObstacles.push(navigationBounds);
      const rotation={x:0,y:Math.sin(yaw*.5),z:0,w:Math.cos(yaw*.5)},body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(building.position.x,building.position.y,building.position.z).setRotation(rotation)),collider=this.physics.createCollider(RAPIER.ColliderDesc.roundCuboid(Math.max(.6,localSize.x*.47),Math.max(1,localSize.y*.49),Math.max(.6,localSize.z*.47),.08).setTranslation(localCenter.x,localCenter.y,localCenter.z).setFriction(1.12).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setRestitution(.025),body);collider.userData={type:'building'};
      if(i%5===0){const glow=new THREE.PointLight(this.level.accent,11,18,2);glow.position.set(building.position.x,2.4,building.position.z);this.scene.add(glow);}
    }
    for(let i=0;i<10;i++){
      const prop=this.models.cloneAsset(i%2?'ind:tank':'ind:chimney'),a=rng()*Math.PI*2,r=76+rng()*8;prop.updateMatrixWorld(true);const original=new THREE.Box3().setFromObject(prop),originalSize=original.getSize(new THREE.Vector3()),targetHeight=i%2?3.5:9;prop.position.set(Math.cos(a)*r,0,Math.sin(a)*r);prop.rotation.y=rng()*Math.PI;prop.scale.setScalar(targetHeight/Math.max(.5,originalSize.y));prop.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(prop);prop.position.y-=b.min.y;prop.updateMatrixWorld(true);const finalBounds=new THREE.Box3().setFromObject(prop),size=finalBounds.getSize(new THREE.Vector3()),center=finalBounds.getCenter(new THREE.Vector3());this.scene.add(prop);const navBounds=finalBounds.clone();navBounds.min.x-=.65;navBounds.max.x+=.65;navBounds.min.z-=.65;navBounds.max.z+=.65;this.navigationObstacles.push(navBounds);const collider=this.physics.createCollider(RAPIER.ColliderDesc.roundCuboid(Math.max(.25,size.x*.43),Math.max(.3,size.y*.48),Math.max(.25,size.z*.43),.06).setTranslation(center.x,center.y,center.z).setFriction(1.05).setRestitution(.025));collider.userData={type:'industrial'};
    }
  }

  routeDistance(position){
    let distance=Infinity,closest=new THREE.Vector3(),point=new THREE.Vector3(position.x,0,position.z);for(let i=0;i<this.waypoints.length;i++){const segment=new THREE.Line3(this.waypoints[i],this.waypoints[(i+1)%this.waypoints.length]);segment.closestPointToPoint(point,true,closest);distance=Math.min(distance,closest.distanceTo(point));}return distance;
  }

  buildRouteEnvironment(rng){
    const mapSize=this.level.mapSize,half=mapSize*.46,count=this.level.buildingCount||70,season=this.level.season||'summer',columns=Math.ceil(Math.sqrt(count*1.55)),rows=Math.ceil(count/columns*1.55);let built=0;
    for(let row=0;row<rows&&built<count;row++)for(let column=0;column<columns&&built<count;column++){const x=THREE.MathUtils.lerp(-half,half,(column+.5)/columns)+(rng()-.5)*mapSize/columns*.45,z=THREE.MathUtils.lerp(-half,half,(row+.5)/rows)+(rng()-.5)*mapSize/rows*.45,position=new THREE.Vector3(x,0,z);if(this.routeDistance(position)<(this.level.roadWidth||18)*.9)continue;const building=this.models.createEnvironment(this.level.id,built);building.updateMatrixWorld(true);const initialBounds=new THREE.Box3().setFromObject(building),initialSize=initialBounds.getSize(new THREE.Vector3()),urban=season==='summer'||season==='winter',desiredHeight=(urban?13:8)+rng()*(urban?31:18),scale=desiredHeight/Math.max(1,initialSize.y);building.scale.setScalar(scale);building.rotation.y=Math.round(rng()*3)*Math.PI*.5+(rng()-.5)*.08;building.position.set(x,0,z);building.updateMatrixWorld(true);let bounds=new THREE.Box3().setFromObject(building);building.position.y-=bounds.min.y;building.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(season==='winter')object.material.color?.lerp(new THREE.Color(0xcbd7dc),.34);else if(season==='autumn')object.material.color?.lerp(new THREE.Color(0x8d5430),.2);else if(season==='forest')object.material.color?.multiplyScalar(.78);else if(season==='mountain')object.material.color?.lerp(new THREE.Color(0x6f716c),.28);});this.scene.add(building);building.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(building);const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),navigationBounds=bounds.clone();navigationBounds.min.x-=.8;navigationBounds.max.x+=.8;navigationBounds.min.z-=.8;navigationBounds.max.z+=.8;this.navigationObstacles.push(navigationBounds);const collider=this.physics.createCollider(RAPIER.ColliderDesc.roundCuboid(Math.max(.6,size.x*.48),Math.max(1,size.y*.49),Math.max(.6,size.z*.48),.08).setTranslation(center.x,center.y,center.z).setFriction(1.12).setRestitution(.02));collider.userData={type:'building'};if(built%9===0){const glow=new THREE.PointLight(this.level.accent,8,22,2);glow.position.set(x,2.6,z);this.scene.add(glow);}built++;}
    const natureCount=this.level.natureCount||24,treeColors=season==='winter'?[0xe9f2f4,0xbfd3d7]:season==='autumn'?[0xd55c20,0xf2a52b,0x8d351d]:season==='mountain'?[0x264536,0x385b42]:[0x277348,0x3e9655,0x195d3b];for(let i=0;i<natureCount;i++){let position=null;for(let attempt=0;attempt<18;attempt++){const candidate=new THREE.Vector3((rng()-.5)*mapSize*.93,0,(rng()-.5)*mapSize*.93);if(this.routeDistance(candidate)>(this.level.roadWidth||18)*.78){position=candidate;break;}}if(!position)continue;const height=3.2+rng()*4.8,trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,height*.48,7),new THREE.MeshStandardMaterial({color:season==='winter'?0x5d5048:0x563921,roughness:1})),crownMaterial=new THREE.MeshStandardMaterial({color:treeColors[Math.floor(rng()*treeColors.length)],roughness:.95}),crown=season==='mountain'||season==='winter'?new THREE.Mesh(new THREE.ConeGeometry(1.25+rng()*.65,height*.72,9),crownMaterial):new THREE.Mesh(new THREE.IcosahedronGeometry(1.25+rng()*.7,1),crownMaterial),tree=new THREE.Group();trunk.position.y=height*.24;crown.position.y=height*.64;crown.scale.y=season==='autumn'?.8:1;tree.add(trunk,crown);tree.position.copy(position);tree.rotation.y=rng()*Math.PI;this.scene.add(tree);if(i%3===0){const collider=this.physics.createCollider(RAPIER.ColliderDesc.cylinder(height*.28,.34).setTranslation(position.x,height*.28,position.z).setFriction(1));collider.userData={type:'tree'};this.navigationObstacles.push(new THREE.Box3(new THREE.Vector3(position.x-.45,0,position.z-.45),new THREE.Vector3(position.x+.45,height,position.z+.45)));}}
    for(let i=0;i<(this.level.mountainCount||0);i++){const angle=i/(this.level.mountainCount||1)*Math.PI*2+(rng()-.5)*.18,radius=mapSize*(.4+rng()*.08),height=24+rng()*48,mountain=new THREE.Mesh(new THREE.ConeGeometry(12+rng()*18,height,7),new THREE.MeshStandardMaterial({color:rng()<.35?0x77766f:0x595b57,roughness:1,flatShading:true}));mountain.position.set(Math.cos(angle)*radius,height*.5-.2,Math.sin(angle)*radius);mountain.rotation.y=rng()*Math.PI;mountain.castShadow=true;mountain.receiveShadow=true;this.scene.add(mountain);}
  }

  makeObstacle(x,z){
    const type=Math.random(),wide=type<.55;
    const model=wide?this.models.cloneAsset('prop:box'):this.models.cloneAsset('prop:cone'),scale=wide?.8+Math.random()*1.1:.85+Math.random()*.45,yaw=Math.random()*Math.PI;
    model.scale.setScalar(scale);model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);
    const visual=new THREE.Group();visual.add(model);visual.position.set(x,Math.max(.2,size.y*.5+.025),z);visual.rotation.y=yaw;this.scene.add(visual);
    const rotation={x:0,y:Math.sin(yaw*.5),z:0,w:Math.cos(yaw*.5)},bodyDesc=(wide?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic().setLinearDamping(.32).setAngularDamping(1.05)).setTranslation(visual.position.x,visual.position.y,visual.position.z).setRotation(rotation).setCcdEnabled(false),body=this.physics.createRigidBody(bodyDesc);
    const halfHeight=Math.max(.18,size.y*.46),radius=Math.max(.18,Math.max(size.x,size.z)*.42),desc=wide?RAPIER.ColliderDesc.roundCuboid(Math.max(.18,size.x*.43),halfHeight,Math.max(.18,size.z*.43),.055):RAPIER.ColliderDesc.cone(halfHeight,radius);
    const mass=wide?0:2.2+scale*1.4;desc.setFriction(wide?.2:.58).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(wide?0:.05);if(wide)desc.setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);else desc.setMass(mass).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(600);const collider=this.physics.createCollider(desc,body);
    const obstacle={visual,body,collider,type:wide?'crate':'cone',size,mass,health:1,breakForce:wide?0:4200,lastImpact:-10,broken:false,pendingBreak:false};
    collider.userData={type:'destructible',obstacle};this.destructibles.push(obstacle);this.colliderDestructibles.set(collider.handle,obstacle);
  }

  makeBreakablePole(a){
    let x=Math.cos(a)*78,z=Math.sin(a)*63;if(this.level.route){const progress=a/(Math.PI*2)*this.waypoints.length,index=Math.floor(progress)%this.waypoints.length,fraction=progress-Math.floor(progress),from=this.waypoints[index],to=this.waypoints[(index+1)%this.waypoints.length],point=from.clone().lerp(to,fraction),direction=to.clone().sub(from).normalize(),side=new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar((Math.floor(progress*2)%2?1:-1)*(this.level.roadWidth||18)*.62);point.add(side);x=point.x;z=point.z;}const visual=new THREE.Group(),pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3,10),new THREE.MeshStandardMaterial({color:0x181b1b,metalness:.82,roughness:.35})),cap=new THREE.Mesh(new THREE.SphereGeometry(.2,10,7),new THREE.MeshStandardMaterial({color:this.level.accent,emissive:this.level.accent,emissiveIntensity:1.8})),lamp=new THREE.PointLight(this.level.accent,this.level.id===0?3.5:7,12,2);pole.castShadow=true;cap.castShadow=true;cap.position.y=1.32;lamp.position.y=1.25;visual.add(pole,cap,lamp);visual.position.set(x,1.5,z);this.scene.add(visual);
    const body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,1.5,z)),mass=0,collider=this.physics.createCollider(RAPIER.ColliderDesc.cylinder(1.48,.22).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body),obstacle={visual,body,collider,type:'pole',size:new THREE.Vector3(.44,3,.44),mass,health:1,breakForce:0,lastImpact:-10,broken:false,pendingBreak:false};collider.userData={type:'destructible',obstacle};this.destructibles.push(obstacle);this.colliderDestructibles.set(collider.handle,obstacle);
  }

  setupActors(){
    const car=currentCar(),up=upgrades();
    const dims=carDimensions(car),startDirection=this.waypoints[1].clone().sub(this.waypoints[0]).setY(0).normalize(),start=this.waypoints[0].clone().addScaledVector(startDirection,-6);start.y=1.05;const startYaw=Math.atan2(startDirection.x,startDirection.z);
    const playerVisual=this.models.createCarVisual(car.id,save.color,dims);this.player=playerVisual.group;this.scene.add(this.player);
    this.boostLight=new THREE.PointLight(0xff5a16,0,9,2);this.scene.add(this.boostLight);
    const playerVehicle=createVehicle(this.physics,playerVisual,{...dims,position:start,yaw:startYaw,mass:980*car.armor,maxSpeed:36*car.speed+up.engine*2.2,engineForce:6800*car.speed+up.engine*620});
    Object.assign(this.player.userData,{vehicle:playerVehicle,body:playerVisual.body,wheels:playerVisual.wheels,speed:0,health:Math.round((100+up.armor*18)*car.armor),maxHealth:Math.round((100+up.armor*18)*car.armor),maxSpeed:playerVehicle.maxSpeed,handling:car.handling+up.handling*.08,nitro:100,dead:false,lastImpact:-10});
    this.colliderVehicles.set(playerVehicle.collider.handle,this.player);
    const aiColors=[0xff3b20,0x4090ff,0xf4d13b,0xb63aff,0xffffff,0x2fcf83,0xff6bc2,0x777777];
    const aiCount=this.multiplayer?.room.aiSlots??this.level.enemies;this.enemyQuota=aiCount;for(let i=0;i<aiCount;i++){
      const base=CARS[(i+this.level.id+1)%CARS.length],aiDims=carDimensions(base),visual=this.models.createCarVisual(base.id,aiColors[i%aiColors.length],aiDims),ai=visual.group,routeSlot=(i+1)*this.waypoints.length/(aiCount+1),startIndex=Math.floor(routeSlot)%this.waypoints.length,startFraction=routeSlot-Math.floor(routeSlot);
      const point=this.waypoints[startIndex],next=this.waypoints[(startIndex+1)%this.waypoints.length],pos=point.clone().lerp(next,startFraction).add(new THREE.Vector3(0,1.05,0)),yaw=Math.atan2(next.x-point.x,next.z-point.z);this.scene.add(ai);
      const vehicle=createVehicle(this.physics,visual,{...aiDims,position:pos,yaw,mass:900*base.armor,maxSpeed:27+Math.random()*5+this.level.id*1.8,engineForce:5600+this.level.id*480+Math.random()*700});
      const tactics=['hunter','ambusher','bully','racer','coward'],tactic=tactics[i%tactics.length];Object.assign(ai.userData,{vehicle,body:visual.body,wheels:visual.wheels,speed:0,health:70+this.level.id*14+base.armor*25,maxHealth:70+this.level.id*14+base.armor*25,maxSpeed:vehicle.maxSpeed,handling:base.handling,target:(startIndex+1)%this.waypoints.length,aggression:.25+Math.random()*.7,tactic,combatState:'race',stateTimer:1+Math.random()*3,ramCooldown:2+Math.random()*4,escapePoint:null,approachSide:i%2?1:-1,stuckTimer:0,recoverTimer:0,dead:false,lastImpact:-10,name:['Crusher','Widow','Butcher','Chrome Jack','Hex','Mortis','Road Wolf','Buzzard'][i]||`Wreckbot ${i+1}`});
      this.colliderVehicles.set(vehicle.collider.handle,ai);this.opponents.push(ai);
    }
    for(let i=0;i<this.level.peds;i++){const ped=this.createPedestrian(i);if(i<4){ped.position.copy(this.waypoints[0]).lerp(this.waypoints[1],.13+i*.075);ped.position.x+=(i%2?1:-1)*2.3;ped.position.y=.05;if(this.isPedestrianBlocked(ped.position,.55))this.placePedestrianSafely(ped);}else this.placePedestrianSafely(ped);this.scene.add(ped);this.pedestrians.push(ped);}
  }

  setupMultiplayer(){
    if(!this.multiplayer)return;const {client,room,playerId}=this.multiplayer,startDirection=this.waypoints[1].clone().sub(this.waypoints[0]).setY(0).normalize(),side=new THREE.Vector3(-startDirection.z,0,startDirection.x);room.players.filter(player=>player.id!==playerId).forEach((player,index)=>{const car=CARS.find(item=>item.id===player.carId)||CARS[0],visual=this.models.createCarVisual(car.id,player.color||'#ffffff',carDimensions(car)),group=visual.group;group.position.copy(this.waypoints[0]).addScaledVector(startDirection,-9-index*3).addScaledVector(side,(index%2?1:-1)*(3+Math.floor(index/2)*2));group.position.y=1.05;group.rotation.y=Math.atan2(startDirection.x,startDirection.z);group.userData.remoteName=player.name;this.scene.add(group);this.remotePlayers.set(player.id,{group,targetPosition:group.position.clone(),targetQuaternion:group.quaternion.clone(),speed:0});});this.removeNetworkState=client.on('player_state',message=>{const remote=this.remotePlayers.get(message.playerId);if(!remote)return;remote.targetPosition.fromArray(message.state.position);remote.targetQuaternion.fromArray(message.state.quaternion);remote.speed=message.state.speed;});
  }

  updateMultiplayer(dt){
    if(!this.multiplayer)return;for(const remote of this.remotePlayers.values()){remote.group.position.lerp(remote.targetPosition,1-Math.exp(-dt*12));remote.group.quaternion.slerp(remote.targetQuaternion,1-Math.exp(-dt*14));}if(this.elapsed-this.lastNetworkSend<.05)return;this.lastNetworkSend=this.elapsed;this.multiplayer.client.send('state',{state:{position:this.player.position.toArray(),quaternion:this.player.quaternion.toArray(),speed:this.player.userData.speed}});
  }

  createCar(color,shape,isPlayer){
    const car=CARS.find(item=>item.shape===shape)||CARS[0];return this.models.createCarVisual(car.id,color,carDimensions(car)).group;
  }

  createPedestrian(i){
    const person=this.models.createPerson(i),g=new THREE.Group();g.add(person.model);g.userData={dead:false,panic:0,running:false,phase:Math.random()*10,runSpeed:4.4+Math.random()*2.2,swerve:Math.random()<.5?-1:1,fleeDirection:new THREE.Vector3(),fleeThreat:null,threatLock:0,model:person.model,mixer:person.mixer,idle:person.idle,run:person.run,hips:person.hips,hipsBasePosition:person.hipsBasePosition,skin:[0xd99a78,0x8a5a42,0xf0bd91][i%3],cloth:[0xbab599,0x1e6b72,0x863328,0x41404d][i%4]};return g;
  }

  placePedestrianSafely(ped){for(let attempt=0;attempt<36;attempt++){let candidate;if(this.level.route){const point=this.waypoints[Math.floor(Math.random()*this.waypoints.length)];candidate=point.clone().add(new THREE.Vector3((Math.random()-.5)*(this.level.roadWidth||18)*.72,.05,(Math.random()-.5)*(this.level.roadWidth||18)*.72));}else{const a=Math.random()*Math.PI*2,r=18+Math.random()*60;candidate=new THREE.Vector3(Math.cos(a)*r,.05,Math.sin(a)*r);}if(!this.isPedestrianBlocked(candidate,.55)){ped.position.copy(candidate);return;}}ped.position.copy(this.waypoints[0]).add(new THREE.Vector3(0,.05,(this.level.roadWidth||12)*.25));}

  actionPressed(action){return Boolean(this.keys[settings.bindings[action]]);}

  minimapPoint(x,z){const bounds=this.minimapBounds||{x:112,z:90};return{x:THREE.MathUtils.clamp(50-x/bounds.x*50,1,99),y:THREE.MathUtils.clamp(50-z/bounds.z*50,1,99)};}

  buildMinimapMarkup(){
    const point=(x,z)=>this.minimapPoint(x,z),center=point(0,0),outerRx=78/(this.minimapBounds.x*2)*100,outerRy=62/(this.minimapBounds.z*2)*100,centerRx=62/(this.minimapBounds.x*2)*100,centerRy=46/(this.minimapBounds.z*2)*100;
    const buildings=this.navigationObstacles.map((box,i)=>{const min=point(box.min.x,box.max.z),max=point(box.max.x,box.min.z),x=Math.max(0,Math.min(min.x,max.x)),y=Math.max(0,Math.min(min.y,max.y)),w=Math.min(100-x,Math.max(.7,Math.abs(max.x-min.x))),h=Math.min(100-y,Math.max(.7,Math.abs(max.y-min.y)));return`<rect class="map-building" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx=".7" data-map-building="${i}"/>`;}).join('');
    const props=this.destructibles.map((obstacle,i)=>{const p=point(obstacle.visual.position.x,obstacle.visual.position.z),radius=obstacle.type==='crate'?1.45:.62;return`<circle class="map-prop map-prop-${obstacle.type}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${radius}" data-map-prop="${i}"/>`;}).join('');
    const checkpoints=this.waypoints.map((waypoint,i)=>{const p=point(waypoint.x,waypoint.z);return`<circle class="map-checkpoint" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.65" data-map-checkpoint="${i}"/>`;}).join('');
    return`<div class="minimap"><svg class="minimap-map" viewBox="0 0 100 100" aria-hidden="true"><rect class="map-surface" x="0" y="0" width="100" height="100"/><g class="map-grid"><path d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100"/></g><ellipse class="map-road-shadow" cx="${center.x}" cy="${center.y}" rx="${outerRx}" ry="${outerRy}"/><ellipse class="map-road" cx="${center.x}" cy="${center.y}" rx="${centerRx}" ry="${centerRy}"/>${buildings}${props}${checkpoints}</svg><i class="map-player"></i>${this.opponents.map((_,i)=>`<i class="map-enemy" data-map-enemy="${i}"></i>`).join('')}${this.pedestrians.map((_,i)=>`<i class="map-ped" data-map-ped="${i}"></i>`).join('')}</div>`;
  }

  setupUI(){
    const machineGun=MACHINE_GUNS.find(w=>w.id===save.selectedMachineGun),missileLauncher=MISSILE_LAUNCHERS.find(w=>w.id===save.selectedMissileLauncher);
    this.hud=document.createElement('div');this.hud.className='screen hud';this.hud.innerHTML=`<div class="damage-flash"></div><div class="hud-top"><div class="race-objective"><small>Три пути к победе</small><strong>Круг <span data-lap>1/${this.level.laps}</span> · Враги <span data-enemies>${this.opponents.length}</span> · Квота <span data-kills>0/${this.level.quota}</span></strong><div class="combat-stats"><span>УРОН <b data-total-damage>0</b></span><span>ДОБЫЧА <b data-run-credits>₡ 0</b></span></div></div><div class="timer"><small>${this.level.name} // ${this.level.weather}</small><span data-time>00:00.000</span></div></div>${this.buildMinimapMarkup()}<div class="event-feed"></div><div class="crosshair"></div><div class="hud-bottom"><div class="car-vitals"><div class="vital health"><span class="hud-label">Корпус</span><strong data-health>100%</strong></div><div class="vital nitro"><span class="hud-label">Нитро</span><strong data-nitro>100%</strong></div><div class="vital weapon"><span class="hud-label">ЛКМ // ${machineGun.name}</span><strong data-machine-gun-status>READY</strong></div><div class="vital missile"><span class="hud-label">ПКМ // ${missileLauncher.name}</span><strong data-missile-status>${missileLauncher.id==='none'?'EMPTY':'SEARCH'}</strong></div></div><div class="controls-hint"><b>ЛКМ</b> пулемёт · <b>ПКМ</b> ракета · <b>СКМ</b> обзор · <b>КОЛЕСО</b> зум · <b>${keyLabel(settings.bindings.accelerate)} / ${keyLabel(settings.bindings.brake)}</b> движение · <b>${keyLabel(settings.bindings.handbrake)}</b> занос · <b>${keyLabel(settings.bindings.nitro)}</b> нитро</div><div class="speedo"><strong data-speed>000</strong><span>KM/H</span><i style="--speed:0%"></i></div></div>`;app.append(this.hud);
    this.mapPlayer=this.hud.querySelector('.map-player');this.mapEnemies=this.opponents.map((_,i)=>this.hud.querySelector(`[data-map-enemy="${i}"]`));this.mapPedestrians=this.pedestrians.map((_,i)=>this.hud.querySelector(`[data-map-ped="${i}"]`));this.mapProps=this.destructibles.map((_,i)=>this.hud.querySelector(`[data-map-prop="${i}"]`));this.mapCheckpoints=this.waypoints.map((_,i)=>this.hud.querySelector(`[data-map-checkpoint="${i}"]`));
    this.feedEl=this.hud.querySelector('.event-feed');this.addEvent('Двигатели запущены. <strong>УНИЧТОЖАЙ.</strong>');
  }

  bindEvents(){
    this.onKeyDown=e=>{this.keys[e.code]=true;if(!e.repeat&&e.code===settings.bindings.pause)this.togglePause();if(!e.repeat&&e.code===settings.bindings.reset)this.resetPlayer();const debug=new URLSearchParams(location.search).has('debugRagdoll');if(debug&&e.code==='KeyK'){const target=this.pedestrians.find(p=>!p.userData.dead);if(target){target.position.copy(this.player.position).add(new THREE.Vector3(0,0,3).applyQuaternion(this.player.quaternion));this.ragdollPedestrian(target);}}if(debug&&e.code==='KeyL')this.damageCar(this.player,999);if(debug&&e.code==='KeyO'){const target=this.opponents.find(ai=>!ai.userData.dead);if(target)this.damageCar(target,999,this.player);}};
    this.onKeyUp=e=>{this.keys[e.code]=false;};this.onResize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);};
    this.onPointerDown=e=>{if(this.paused||this.ended)return;if(e.button===0)this.pointerFire.primary=true;else if(e.button===2)this.pointerFire.secondary=true;else if(e.button===1){this.cameraDragging=true;this.lastCameraInput=this.elapsed;this.pointerX=e.clientX;this.pointerY=e.clientY;this.renderer.domElement.classList.add('camera-dragging');}else return;e.preventDefault();this.renderer.domElement.setPointerCapture?.(e.pointerId);};
    this.onPointerMove=e=>{if(!this.cameraDragging)return;const dx=e.clientX-this.pointerX,dy=e.clientY-this.pointerY;this.pointerX=e.clientX;this.pointerY=e.clientY;const direction=settings.invertCameraX?-1:1;this.cameraOrbitYaw=THREE.MathUtils.euclideanModulo(this.cameraOrbitYaw+dx*settings.cameraSensitivity*direction+Math.PI,Math.PI*2)-Math.PI;this.cameraOrbitPitch=THREE.MathUtils.clamp(this.cameraOrbitPitch+dy*settings.cameraSensitivity*.75,-.38,.62);this.lastCameraInput=this.elapsed;};
    this.onPointerUp=e=>{if(e.button===0)this.pointerFire.primary=false;if(e.button===2)this.pointerFire.secondary=false;if(e.button===1&&this.cameraDragging){this.cameraDragging=false;this.lastCameraInput=this.elapsed;this.renderer.domElement.classList.remove('camera-dragging');}this.renderer.domElement.releasePointerCapture?.(e.pointerId);};this.onPointerCancel=e=>{this.pointerFire.primary=this.pointerFire.secondary=false;this.cameraDragging=false;this.renderer.domElement.classList.remove('camera-dragging');this.renderer.domElement.releasePointerCapture?.(e.pointerId);};this.onContextMenu=e=>e.preventDefault();this.onWheel=e=>{if(this.paused||this.ended)return;e.preventDefault();this.cameraZoomTarget=THREE.MathUtils.clamp(this.cameraZoomTarget+Math.sign(e.deltaY)*.12,.55,1.8);this.lastCameraInput=this.elapsed;};
    addEventListener('keydown',this.onKeyDown);addEventListener('keyup',this.onKeyUp);addEventListener('resize',this.onResize);this.renderer.domElement.addEventListener('pointerdown',this.onPointerDown);this.renderer.domElement.addEventListener('pointermove',this.onPointerMove);this.renderer.domElement.addEventListener('pointerup',this.onPointerUp);this.renderer.domElement.addEventListener('pointercancel',this.onPointerCancel);this.renderer.domElement.addEventListener('contextmenu',this.onContextMenu);this.renderer.domElement.addEventListener('wheel',this.onWheel,{passive:false});
  }

  animate=()=>{if(this.destroyed)return;this.raf=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.034);if(!this.paused&&!this.ended){this.elapsed+=dt;this.updatePlayer(dt);this.updateAI(dt);this.updatePedestrians(dt);this.physics.timestep=dt;this.physics.step(this.eventQueue);this.handlePhysicsContacts();syncVehicle(this.player.userData.vehicle);this.opponents.forEach(ai=>syncVehicle(ai.userData.vehicle));this.updateMultiplayer(dt);this.syncDestructibles();this.ragdolls.forEach(syncRagdoll);this.syncPhysicsDebris(dt);this.hitPedestrians();this.updateProjectiles(dt);this.updateBurningCars(dt);this.updateDeferredEffects(dt);this.updateParticles(dt);this.updateBloodDecals(dt);if(this.playerDeathPending&&this.elapsed>=this.deathModalAt)this.finish(false,'МАШИНА УНИЧТОЖЕНА');this.checkRules();this.updateHUD();}this.updateCamera(dt);this.renderer.render(this.scene,this.camera);};

  updatePlayer(dt){
    const d=this.player.userData;if(d.dead)return;const forward=this.actionPressed('accelerate'),reverse=this.actionPressed('brake'),left=this.actionPressed('left'),right=this.actionPressed('right'),handbrake=this.actionPressed('handbrake');
    const boosting=this.actionPressed('nitro')&&forward&&d.nitro>0;this.boostIntensity=THREE.MathUtils.damp(this.boostIntensity,boosting?1:0,boosting?7:3.2,dt);this.boostEmit-=dt;if(boosting){d.nitro=Math.max(0,d.nitro-23*dt);if(this.boostEmit<=0){this.boostEmit=.024;this.emitBoostFlames(this.player);}}else d.nitro=Math.min(100,d.nitro+4.8*dt);if(this.boostLight){this.boostLight.intensity=this.boostIntensity*14;this.boostLight.position.copy(this.player.position).add(new THREE.Vector3(0,.55,-2.35).applyQuaternion(this.player.quaternion));}
    const throttle=(forward?1:0)-(reverse?1:0),steer=((left?1:0)-(right?1:0))*d.handling;
    driveVehicle(d.vehicle,{throttle,steer,steerSensitivity:settings.steeringSensitivity,steerSmoothing:settings.steeringSmoothing,brake:!throttle&&Math.abs(d.speed)<1?.15:0,handbrake,boost:boosting},dt);d.speed=d.vehicle.controller.currentVehicleSpeed();
    if((Math.abs(steer)>.35&&Math.abs(d.speed)>12&&Math.random()<.25)||(handbrake&&Math.abs(d.speed)>7&&Math.random()<dt*26))this.emitSmoke(this.player,handbrake?0x958b7b:0x777777,handbrake?.22:.16);
    if(this.pointerFire.primary||this.actionPressed('fire'))this.fireMachineGun();if(this.pointerFire.secondary)this.fireMissile();this.checkCheckpoint();
    if(d.health<d.maxHealth*.42&&Math.random()<dt*5)this.emitSmoke(this.player,d.health<d.maxHealth*.2?0x171717:0x555555,.5);
  }

  updateAI(dt){
    const playerForward=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()),playerSide=new THREE.Vector3(playerForward.z,0,-playerForward.x);
    for(const ai of this.opponents){const d=ai.userData;if(d.dead)continue;d.speed=d.vehicle.controller.currentVehicleSpeed();d.stateTimer-=dt;d.ramCooldown=Math.max(0,d.ramCooldown-dt);const toPlayer=this.player.position.clone().sub(ai.position).setY(0),distance=toPlayer.length(),health=d.health/d.maxHealth,retreatAt=d.tactic==='coward'?.52:(d.tactic==='racer'?.18:.27);if(health<retreatAt&&d.combatState!=='retreat')this.setAIState(ai,'retreat',4);
      let target=this.waypoints[d.target].clone(),throttle=1,brake=0,boost=false;
      if(d.recoverTimer>0){d.recoverTimer-=dt;target=ai.position.clone().sub(forwardVector(d.vehicle.body,new THREE.Vector3()).multiplyScalar(12)).add(new THREE.Vector3(d.approachSide*7,0,0));throttle=-.78;
      }else{
        if(Math.abs(d.speed)<.8)d.stuckTimer+=dt;else d.stuckTimer=Math.max(0,d.stuckTimer-dt*2);if(d.stuckTimer>1.15){d.stuckTimer=0;d.recoverTimer=1.05;d.approachSide*=-1;}
        if(d.combatState==='race'){
          if(ai.position.distanceTo(this.waypoints[d.target])<10)d.target=(d.target+1)%this.waypoints.length;target=this.waypoints[d.target].clone();const attackRange=d.tactic==='hunter'?42:(d.tactic==='bully'?31:36),wantsFight=d.tactic!=='racer'||d.aggression>.82;if(d.stateTimer<=0){if(wantsFight&&d.ramCooldown<=0&&distance<attackRange&&health>.32)this.setAIState(ai,'stalk',2.2+Math.random()*1.8);else d.stateTimer=1.5+Math.random()*2.5;}
        }else if(d.combatState==='stalk'){
          const followDistance=d.tactic==='ambusher'?13:9,lateral=d.tactic==='bully'?5:10;target.copy(this.player.position).addScaledVector(playerForward,-followDistance).addScaledVector(playerSide,d.approachSide*lateral);brake=Math.abs(d.speed)>18&&distance<17?.3:0;if((distance<20&&Math.abs(d.speed)>7)||d.stateTimer<=0)this.setAIState(ai,'charge',2.8+Math.random()*1.3);
        }else if(d.combatState==='charge'){
          const lead=THREE.MathUtils.clamp(Math.abs(this.player.userData.speed)*.28,2,9);target.copy(this.player.position).addScaledVector(playerForward,lead).addScaledVector(playerSide,d.tactic==='ambusher'?d.approachSide*2.5:0);boost=d.tactic==='hunter'&&distance>10;if(distance<4.2||d.stateTimer<=0)this.beginAIDisengage(ai,this.player);
        }else if(d.combatState==='disengage'){
          target=d.escapePoint?.clone()||this.waypoints[d.target].clone();if(d.stateTimer<=0||ai.position.distanceTo(target)<5)this.setAIState(ai,'race',1+Math.random()*2);
        }else if(d.combatState==='retreat'){
          const away=ai.position.clone().sub(this.player.position).setY(0).normalize(),side=new THREE.Vector3(-away.z,0,away.x).multiplyScalar(d.approachSide*13);target.copy(ai.position).addScaledVector(away,38).add(side);boost=distance<20;if(d.stateTimer<=0){d.stateTimer=3;d.approachSide*=-1;}
        }
      }
      const desired=Math.atan2(target.x-ai.position.x,target.z-ai.position.z),yaw=new THREE.Euler().setFromQuaternion(ai.quaternion,'YXZ').y,diff=angleDelta(yaw,desired),steer=THREE.MathUtils.clamp(diff*1.55,-1,1)*d.handling;if(!brake&&Math.abs(diff)>1.18&&Math.abs(d.speed)>11)brake=.42;driveVehicle(d.vehicle,{throttle:brake?.3:throttle,steer,brake,boost},dt);if(d.health<d.maxHealth*.4&&Math.random()<dt*4)this.emitSmoke(ai,0x222222,.45);
    }
  }

  setAIState(ai,state,duration){const d=ai.userData;d.combatState=state;d.stateTimer=duration;if(state==='race'){d.ramCooldown=Math.max(d.ramCooldown,2.5+Math.random()*2.5);d.escapePoint=null;}if(state==='charge')d.approachSide=Math.random()<.5?-1:1;}

  beginAIDisengage(ai,other){if(!ai||ai===this.player||ai.userData.dead)return;const d=ai.userData,away=ai.position.clone().sub(other.position).setY(0);if(away.lengthSq()<.1)away.copy(forwardVector(d.vehicle.body,new THREE.Vector3()).negate());away.normalize();const side=new THREE.Vector3(-away.z,0,away.x).multiplyScalar(d.approachSide*(10+Math.random()*7));d.escapePoint=ai.position.clone().addScaledVector(away,20+Math.random()*12).add(side);d.ramCooldown=4+Math.random()*4;d.combatState='disengage';d.stateTimer=2.2+Math.random()*1.5;d.approachSide*=-1;
  }

  isPedestrianBlocked(position,clearance=.58){
    const boundary=(this.level.mapSize||180)*.48;if(Math.abs(position.x)>boundary||Math.abs(position.z)>boundary)return true;
    for(const box of this.navigationObstacles)if(position.x>box.min.x-clearance&&position.x<box.max.x+clearance&&position.z>box.min.z-clearance&&position.z<box.max.z+clearance)return true;
    for(const obstacle of this.destructibles){if(obstacle.broken)continue;const p=obstacle.visual.position,rx=obstacle.size.x*.5+clearance,rz=obstacle.size.z*.5+clearance;if(Math.abs(position.x-p.x)<rx&&Math.abs(position.z-p.z)<rz)return true;}
    return false;
  }

  movePedestrian(p,direction,speed,dt){
    const step=speed*dt,side=p.userData.swerve||1,angles=[0,side*.55,-side*.55,side*1.08,-side*1.08,side*1.55,-side*1.55],candidates=angles.map(angle=>direction.clone().applyAxisAngle(_up,angle));
    for(const candidateDirection of candidates){const candidate=p.position.clone().addScaledVector(candidateDirection,step);if(this.isPedestrianBlocked(candidate,.52))continue;p.position.copy(candidate);const targetYaw=Math.atan2(candidateDirection.x,candidateDirection.z);p.rotation.y+=angleDelta(p.rotation.y,targetYaw)*Math.min(1,dt*8);return;}
    p.userData.swerve*=-1;
  }

  updatePedestrians(dt){
    const threats=[this.player,...this.opponents.filter(ai=>!ai.userData.dead)];for(const p of this.pedestrians){if(p.userData.dead)continue;let nearest=this.player,nearestDistance=Infinity;for(const car of threats){const d=p.position.distanceTo(car.position);if(d<nearestDistance){nearestDistance=d;nearest=car;}}const data=p.userData;data.threatLock=Math.max(0,data.threatLock-dt);const lockedDistance=data.fleeThreat?.position?p.position.distanceTo(data.fleeThreat.position):Infinity;if(!data.fleeThreat||data.threatLock<=0&&(!threats.includes(data.fleeThreat)||nearestDistance<lockedDistance*.78||lockedDistance>25)){data.fleeThreat=nearest;data.threatLock=.38;}const threat=data.fleeThreat||nearest,running=data.running?nearestDistance<PEDESTRIAN_SAFE_DISTANCE:nearestDistance<PEDESTRIAN_FLEE_DISTANCE;data.phase+=dt*(running?8:1);if(running!==data.running){data.running=running;if(running){data.idle.fadeOut(.12);data.run.enabled=true;data.run.reset().setEffectiveWeight(1).setEffectiveTimeScale(.98+Math.random()*.16).fadeIn(.12).play();}else{data.run.fadeOut(.12);data.idle.enabled=true;data.idle.reset().setEffectiveWeight(1).fadeIn(.12).play();}}if(running&&!data.run.isRunning())data.run.reset().play();if(!running&&!data.idle.isRunning())data.idle.reset().play();data.mixer.update(dt);if(data.hips&&data.hipsBasePosition)data.hips.position.copy(data.hipsBasePosition);
      if(running){const away=p.position.clone().sub(threat.position).setY(0);if(away.lengthSq()<.01)away.set(Math.random()-.5,0,Math.random()-.5);away.normalize();const side=new THREE.Vector3(-away.z,0,away.x).multiplyScalar(Math.sin(data.phase)*.24*data.swerve),desired=away.add(side).normalize();if(data.fleeDirection.lengthSq()<.01||data.fleeDirection.dot(desired)<-.35)data.fleeDirection.copy(desired);else data.fleeDirection.lerp(desired,1-Math.exp(-dt*5.5)).normalize();const speed=data.runSpeed*(nearestDistance<7?1.28:1);this.movePedestrian(p,data.fleeDirection,speed,dt);}else p.rotation.y+=Math.sin(data.phase*.45)*dt*.06;
    }
  }

  updateRagdoll(){}

  hitPedestrians(){
    if(Math.abs(this.player.userData.speed)<4)return;
    for(const p of this.pedestrians){if(p.userData.dead||p.position.distanceTo(this.player.position)>2.35)continue;this.ragdollPedestrian(p);}
  }

  ragdollPedestrian(p,impactDirection=null,impactStrength=null,applyRecoil=true){
    if(p.userData.dead)return;p.userData.dead=true;this.kills++;const f=impactDirection?.clone().setY(0).normalize()||forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()),speed=Math.max(8,Math.abs(this.player.userData.speed)),model=p.userData.model;p.userData.mixer.timeScale=0;p.updateMatrixWorld(true);model.updateMatrixWorld(true);this.scene.attach(model);p.visible=false;
      const strength=Math.min(14,impactStrength??(3.8+speed*.38)),impulse=f.clone().multiplyScalar(strength);impulse.y=impactStrength?Math.min(3.5,strength*.24):2.6+Math.min(1.5,speed*.04);this.ragdolls.push(createRagdoll(this.physics,this.scene,p.position,impulse,{skin:p.userData.skin,cloth:p.userData.cloth},model));
      if(applyRecoil){const recoil=f.clone().multiplyScalar(-2);this.player.userData.vehicle.body.applyImpulse({x:recoil.x,y:0,z:recoil.z},true);}
      this.bloodBurst(p.position,28,f);this.addEvent(`<strong>РАЗМАЗАН!</strong> Квота ${this.kills}/${this.level.quota}`);this.shake=.45;
  }

  collideCars(){}

  contactImpactPoint(collider1,collider2,car1,car2,obstacle1,obstacle2){
    if(car1&&car2)return car1.position.clone().lerp(car2.position,.5).add(new THREE.Vector3(0,.28,0));
    const car=car1||car2,otherCollider=car1?collider2:collider1,obstacle=car1?obstacle2:obstacle1;if(!car){const a=collider1?.translation(),b=collider2?.translation();return new THREE.Vector3((a.x+b.x)*.5,Math.max(.15,(a.y+b.y)*.5),(a.z+b.z)*.5);}
    const otherSource=obstacle?.visual?.position||otherCollider?.translation(),other=new THREE.Vector3(otherSource?.x??car.position.x,car.position.y,otherSource?.z??car.position.z),toward=other.sub(car.position).setY(0);if(toward.lengthSq()<.001)toward.copy(forwardVector(car.userData.vehicle.body,new THREE.Vector3()));const distance=toward.length(),reach=Math.min(car.userData.vehicle.dimensions.length*.42,Math.max(.55,distance*.55));return car.position.clone().addScaledVector(toward.normalize(),reach).add(new THREE.Vector3(0,.22,0));
  }

  handlePhysicsContacts(){
    const breaks=[];
    this.eventQueue.drainCollisionEvents((h1,h2,started)=>{if(!started)return;const obstacle1=this.colliderDestructibles.get(h1),obstacle2=this.colliderDestructibles.get(h2),car1=this.colliderVehicles.get(h1),car2=this.colliderVehicles.get(h2),queueBreakable=(obstacle,car)=>{if(!obstacle||!['pole','crate'].includes(obstacle.type)||obstacle.pendingBreak||!car||Math.abs(car.userData.speed)<2)return;obstacle.pendingBreak=true;const direction=forwardVector(car.userData.vehicle.body,new THREE.Vector3());if(obstacle.type==='pole')this.sparkBurst(obstacle.visual.position.clone().add(new THREE.Vector3(0,.55,0)),12,direction);breaks.push({obstacle,direction,source:car});};queueBreakable(obstacle1,car2);queueBreakable(obstacle2,car1);});
    this.eventQueue.drainContactForceEvents(event=>{
      const h1=event.collider1(),h2=event.collider2(),car1=this.colliderVehicles.get(h1),car2=this.colliderVehicles.get(h2),obstacle1=this.colliderDestructibles.get(h1),obstacle2=this.colliderDestructibles.get(h2),collider1=this.physics.getCollider(h1),collider2=this.physics.getCollider(h2),force=event.totalForceMagnitude(),raw=event.maxForceDirection();
      if(force<900)return;
      const direction=new THREE.Vector3(raw.x,raw.y,raw.z);
      const ragdoll1=collider1?.userData?.type==='ragdoll'?collider1.userData:null,ragdoll2=collider2?.userData?.type==='ragdoll'?collider2.userData:null,groundContact=collider1?.userData?.type==='ground'||collider2?.userData?.type==='ground';
      const bleedRagdoll=(ragdoll,car)=>{if(!ragdoll||!car||Math.abs(car.userData.speed)<3||this.elapsed-ragdoll.bloodState.lastImpact<.28)return;ragdoll.bloodState.lastImpact=this.elapsed;const p=ragdoll.piece.body.translation(),travel=forwardVector(car.userData.vehicle.body,new THREE.Vector3());this.bloodContact(new THREE.Vector3(p.x,Math.max(.08,p.y),p.z),travel,force);};bleedRagdoll(ragdoll1,car2);bleedRagdoll(ragdoll2,car1);
      const impactKey=h1<h2?`${h1}:${h2}`:`${h2}:${h1}`,impactFxReady=this.elapsed-(this.impactFxCooldown.get(impactKey)??-10)>.14;if((car1||car2)&&!groundContact&&!ragdoll1&&!ragdoll2&&force>2800&&impactFxReady){this.impactFxCooldown.set(impactKey,this.elapsed);const point=this.contactImpactPoint(collider1,collider2,car1,car2,obstacle1,obstacle2);this.sparkBurst(point,Math.min(30,5+Math.round(force/4200)),direction);this.renderer.domElement.dataset.lastImpactSpark=`${point.x.toFixed(2)},${point.y.toFixed(2)},${point.z.toFixed(2)}`;}
      if((car1||car2)&&!ragdoll1&&!ragdoll2&&force>2200)this.applyContactGrip(car1,car2,obstacle1,obstacle2,direction,force);
      if(car1&&car2&&force>6500){this.beginAIDisengage(car1,car2);this.beginAIDisengage(car2,car1);}
      if(obstacle1&&!obstacle1.pendingBreak&&this.damageObstacle(obstacle1,force,car2)){obstacle1.pendingBreak=true;breaks.push({obstacle:obstacle1,direction:direction.clone().negate(),source:car2});}
      if(obstacle2&&!obstacle2.pendingBreak&&this.damageObstacle(obstacle2,force,car1)){obstacle2.pendingBreak=true;breaks.push({obstacle:obstacle2,direction:direction.clone(),source:car1});}
      if(force<15000)return;
      if(car1&&car2){this.resolveVehicleImpact(car1,car2,force);return;}
      const apply=(car,dir,other,otherCollider)=>{if(!car||car.userData.dead||otherCollider?.userData?.type==='ground')return;if(!other&&force<52000)return;if(this.elapsed-car.userData.lastImpact<.48)return;car.userData.lastImpact=this.elapsed;const amount=THREE.MathUtils.clamp((force-15000)/26000,0,24);if(amount<.7)return;const hit=otherCollider?.translation?.(),impactDirection=hit?new THREE.Vector3(hit.x,0,hit.z).sub(car.position).setY(0):dir;if(impactDirection.lengthSq()<.01)impactDirection.copy(dir);impactDirection.normalize();this.damageCar(car,amount,other);this.deformCar(car,impactDirection,amount);this.shake=Math.max(this.shake,Math.min(.9,amount/26));};
      apply(car1,direction,car2,collider2);apply(car2,direction.clone().negate(),car1,collider1);
    });
    breaks.forEach(item=>this.breakObstacle(item.obstacle,item.direction,item.source));
  }

  resolveVehicleImpact(car1,car2,force){
    if(this.elapsed-car1.userData.lastImpact<.42&&this.elapsed-car2.userData.lastImpact<.42)return;
    const body1=car1.userData.vehicle.body,body2=car2.userData.vehicle.body,v1=body1.linvel(),v2=body2.linvel(),to2=car2.position.clone().sub(car1.position).setY(0);if(to2.lengthSq()<.01)to2.set(1,0,0);to2.normalize();
    const attack1=Math.max(0,v1.x*to2.x+v1.z*to2.z)*body1.mass(),attack2=Math.max(0,-v2.x*to2.x-v2.z*to2.z)*body2.mass(),base=THREE.MathUtils.clamp((force-12000)/23500,0,28);let damage1=base*.72,damage2=base*.72;
    if(attack1>attack2*1.12+250){const ratio=Math.min(4,attack1/Math.max(600,attack2));damage1=base*(.06+.08/ratio);damage2=base*(1.05+Math.min(.9,(ratio-1)*.35));}
    else if(attack2>attack1*1.12+250){const ratio=Math.min(4,attack2/Math.max(600,attack1));damage2=base*(.06+.08/ratio);damage1=base*(1.05+Math.min(.9,(ratio-1)*.35));}
    const apply=(car,other,amount,direction)=>{if(car.userData.dead||amount<.45)return;car.userData.lastImpact=this.elapsed;this.damageCar(car,amount,other);this.deformCar(car,direction,amount);};
    // `to2` points at car2, therefore it is the actual contact face on car1.
    // Using its inverse here dented the rear/right side on front/left impacts.
    apply(car1,car2,damage1,to2);apply(car2,car1,damage2,to2.clone().negate());this.shake=Math.max(this.shake,Math.min(.95,Math.max(damage1,damage2)/25));
  }

  applyContactGrip(car1,car2,obstacle1,obstacle2,normal,force){
    const body1=car1?.userData.vehicle.body||obstacle1?.body,body2=car2?.userData.vehicle.body||obstacle2?.body;if(!body1&&!body2)return;
    const velocity1=body1?.linvel()||{x:0,y:0,z:0},velocity2=body2?.linvel()||{x:0,y:0,z:0},relative=new THREE.Vector3(velocity1.x-velocity2.x,velocity1.y-velocity2.y,velocity1.z-velocity2.z),n=normal.clone().normalize();
    relative.addScaledVector(n,-relative.dot(n));const tangentSpeed=relative.length();if(tangentSpeed<.35)return;
    const mass1=body1?body1.mass():Infinity,mass2=body2?body2.mass():Infinity,reduced=Number.isFinite(mass1)&&Number.isFinite(mass2)?mass1*mass2/(mass1+mass2):(Number.isFinite(mass1)?mass1:mass2),grip=Math.min(.085,.025+force/650000),magnitude=Math.min(tangentSpeed*reduced*grip,reduced*2.4),impulse=relative.multiplyScalar(-magnitude/tangentSpeed);
    if(body1)body1.applyImpulse({x:impulse.x,y:0,z:impulse.z},true);if(body2)body2.applyImpulse({x:-impulse.x,y:0,z:-impulse.z},true);
  }

  damageObstacle(obstacle,force,source){
    if(obstacle.broken||this.elapsed-obstacle.lastImpact<.07)return false;obstacle.lastImpact=this.elapsed;
    const speed=source?Math.abs(source.userData.speed):0,damage=Math.max(.15,(force-1800)/7200)+speed*.018;obstacle.health-=damage;
    if(force>4200&&obstacle.type==='crate'){const p=obstacle.visual.position.clone();for(let i=0;i<4;i++)this.emitParticle(p.clone().add(new THREE.Vector3(0,.4,0)),0x9a5528,.04+Math.random()*.07,.35+Math.random()*.35,new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4));}
    return force>=obstacle.breakForce||obstacle.health<=0;
  }

  breakObstacle(obstacle,direction,source){
    if(obstacle.broken)return;obstacle.broken=true;
    const position=obstacle.visual.position.clone(),sourceVelocity=source?.userData.vehicle.body.linvel()||{x:direction.x*8,y:0,z:direction.z*8},isPole=obstacle.type==='pole',count=5,palette=obstacle.type==='crate'?[0x5a2d12,0x8d491d,0xc17430]:(isPole?[0x111414,0x343b3b,this.level.accent]:[0xff6518,0xf1ead4,0x24282b]);if(source===this.player){const payout=obstacle.type==='pole'?65:obstacle.type==='crate'?45:20,damage=obstacle.type==='pole'?22:obstacle.type==='crate'?16:8;this.awardCombat(damage,payout,`<strong>РАЗБОРКА</strong> +₡ ${payout}`);}
    this.colliderDestructibles.delete(obstacle.collider.handle);this.physics.removeRigidBody(obstacle.body);
    if(isPole){
      obstacle.visual.traverse(object=>{if(object.isLight)object.intensity=0;});const horizontal=new THREE.Vector3(sourceVelocity.x,0,sourceVelocity.z),speed=Math.min(24,horizontal.length());if(horizontal.lengthSq()<.01)horizontal.copy(direction).multiplyScalar(8);else horizontal.setLength(speed);const velocity=horizontal.multiplyScalar(.72).addScaledVector(direction,3.2);velocity.y=2.1;this.physicsDebris.push({visual:obstacle.visual,visualOnly:true,velocity,angularVelocity:new THREE.Vector3(direction.z*4.2,.12,-direction.x*4.2),persist:true,groundY:.16});this.shake=Math.max(this.shake,.1);return;
    }
    this.scene.remove(obstacle.visual);
    for(let i=0;i<count;i++){
      const chunkScale=.13+Math.random()*.22,geometry=obstacle.type==='crate'?new THREE.BoxGeometry(chunkScale*(1.2+Math.random()),chunkScale*(.7+Math.random()),chunkScale*(1.1+Math.random())):(isPole?new THREE.BoxGeometry(chunkScale*.55,chunkScale*(2.5+Math.random()*3.5),chunkScale*.55):new THREE.TetrahedronGeometry(chunkScale*(1.1+Math.random()*.8),0)),visual=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:palette[i%palette.length],roughness:isPole?.38:.78,metalness:isPole?.82:(obstacle.type==='cone'&&i%3===2?.65:.08)}));
      visual.castShadow=true;visual.position.copy(position).add(new THREE.Vector3((Math.random()-.5)*obstacle.size.x*.65,(Math.random()-.1)*obstacle.size.y*.45,(Math.random()-.5)*obstacle.size.z*.65));this.scene.add(visual);
      const mass=obstacle.type==='crate'?.45+Math.random()*.55:1.1+Math.random()*2.2,body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(visual.position.x,visual.position.y,visual.position.z).setLinearDamping(.28).setAngularDamping(.75).setCcdEnabled(false)),collider=RAPIER.ColliderDesc.ball(chunkScale*.65);if(obstacle.type==='crate')collider.setCollisionGroups(0x00020001);this.physics.createCollider(collider.setMass(mass).setFriction(.72).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.08),body);
      const velocityScale=isPole?.14:.46;body.setLinvel({x:sourceVelocity.x*velocityScale+(Math.random()-.5)*(isPole?1.2:6),y:(isPole?.35:2.1)+Math.random()*(isPole?1.15:5),z:sourceVelocity.z*velocityScale+(Math.random()-.5)*(isPole?1.2:6)},true);body.applyTorqueImpulse({x:(Math.random()-.5)*(isPole?.32:4),y:(Math.random()-.5)*(isPole?.2:4),z:(Math.random()-.5)*(isPole?.32:4)},true);this.physicsDebris.push({visual,body,life:isPole?3.3:5+Math.random()*2,dispose:true,maxAngularSpeed:isPole?.8:7,sleepAfter:isPole?1.2:3});
    }
    for(let i=0;i<12;i++)this.emitParticle(position.clone().add(new THREE.Vector3(0,.35,0)),obstacle.type==='crate'?(i%2?0x6e3516:0xb16b31):(isPole?0x454b49:0x6d6257),.055+Math.random()*.1,.45+Math.random()*.65,new THREE.Vector3((Math.random()-.5)*7,1.5+Math.random()*5,(Math.random()-.5)*7));
    if(obstacle.type==='cone'||isPole)this.sparkBurst(position,isPole?18:10);this.shake=Math.max(this.shake,obstacle.type==='crate'?.34:(isPole?.42:.2));
  }

  syncDestructibles(){
    for(const obstacle of this.destructibles){if(obstacle.broken)continue;const p=obstacle.body.translation(),r=obstacle.body.rotation();obstacle.visual.position.set(p.x,p.y,p.z);obstacle.visual.quaternion.set(r.x,r.y,r.z,r.w);}
  }

  deformCar(car,worldDirection,amount){
    if(amount<1.2)return;
    const localDirection=worldDirection.clone().normalize().applyQuaternion(car.quaternion.clone().invert()),depth=Math.min(.22,amount*.009);
    car.userData.body.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry.attributes.position||!mesh.userData.pristinePositions)return;const attr=mesh.geometry.attributes.position,box=mesh.geometry.boundingBox||(mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox);let maxProjection=-Infinity;for(let i=0;i<attr.count;i++)maxProjection=Math.max(maxProjection,_v1.fromBufferAttribute(attr,i).dot(localDirection));const band=Math.max(.18,box.getSize(_v2).length()*.14);for(let i=0;i<attr.count;i++){_v1.fromBufferAttribute(attr,i);const projection=_v1.dot(localDirection),falloff=THREE.MathUtils.clamp(1-(maxProjection-projection)/band,0,1);if(falloff<=0)continue;const base=i*3,pristine=mesh.userData.pristinePositions;attr.setXYZ(i,THREE.MathUtils.clamp(_v1.x-localDirection.x*depth*falloff,pristine[base]-.42,pristine[base]+.42),THREE.MathUtils.clamp(_v1.y-localDirection.y*depth*falloff,pristine[base+1]-.28,pristine[base+1]+.28),THREE.MathUtils.clamp(_v1.z-localDirection.z*depth*falloff,pristine[base+2]-.42,pristine[base+2]+.42));}attr.needsUpdate=true;mesh.geometry.computeVertexNormals();});
    if(amount>11&&Math.random()<.5)this.spawnDebris(car,worldDirection,amount);
  }

  spawnDebris(car,direction,amount){
    const visual=this.models.createDebris(Math.floor(Math.random()*5));visual.scale.setScalar(.7+Math.random()*.35);visual.position.copy(car.position).add(new THREE.Vector3(0,.7,0));this.scene.add(visual);const body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(visual.position.x,visual.position.y,visual.position.z).setCcdEnabled(true).setLinearDamping(.18));this.physics.createCollider(RAPIER.ColliderDesc.cuboid(.32,.12,.48).setMass(12).setRestitution(.22).setFriction(.7),body);body.applyImpulse({x:direction.x*amount*8+(Math.random()-.5)*30,y:40+amount*4,z:direction.z*amount*8+(Math.random()-.5)*30},true);body.applyTorqueImpulse({x:8,y:13,z:6},true);this.physicsDebris.push({visual,body,life:8});
  }

  syncPhysicsDebris(dt){for(let i=this.physicsDebris.length-1;i>=0;i--){const item=this.physicsDebris[i];if(item.visualOnly){item.velocity.y-=9.8*dt;item.visual.position.addScaledVector(item.velocity,dt);const angularSpeed=item.angularVelocity.length();if(angularSpeed>.001){const rotation=new THREE.Quaternion().setFromAxisAngle(item.angularVelocity.clone().normalize(),angularSpeed*dt);item.visual.quaternion.premultiply(rotation);}if(item.visual.position.y<item.groundY){item.visual.position.y=item.groundY;item.velocity.y=Math.abs(item.velocity.y)*.08;item.velocity.x*=Math.pow(.08,dt);item.velocity.z*=Math.pow(.08,dt);item.angularVelocity.multiplyScalar(Math.pow(.035,dt));if(item.persist&&Math.hypot(item.velocity.x,item.velocity.y,item.velocity.z)<.18&&item.angularVelocity.length()<.12){this.physicsDebris.splice(i,1);continue;}}if(Number.isFinite(item.life)){item.life-=dt;if(item.life<=0){this.scene.remove(item.visual);this.physicsDebris.splice(i,1);}}continue;}const p=item.body.translation(),r=item.body.rotation(),angular=item.body.angvel(),angularSpeed=Math.hypot(angular.x,angular.y,angular.z),maxAngular=item.maxAngularSpeed||9;item.visual.position.set(p.x,p.y,p.z);item.visual.quaternion.set(r.x,r.y,r.z,r.w);if(angularSpeed>maxAngular){const s=maxAngular/angularSpeed;item.body.setAngvel({x:angular.x*s,y:angular.y*s,z:angular.z*s},true);}item.life-=dt;if(item.sleepAfter&&item.life<item.sleepAfter){const v=item.body.linvel();if(Math.hypot(v.x,v.y,v.z)<.7)item.body.sleep();item.sleepAfter=0;}if(item.life<=0){this.scene.remove(item.visual);this.physics.removeRigidBody(item.body);if(item.dispose){item.visual.geometry?.dispose();item.visual.material?.dispose();}this.physicsDebris.splice(i,1);}}}

  awardCombat(damage,credits,event=''){
    const inflicted=Math.max(0,damage),earned=Math.max(0,Math.floor(credits));if(!inflicted&&!earned)return;this.totalDamage+=inflicted;this.runCredits+=earned;if(event)this.addEvent(event);
  }

  damageCar(car,amount,source){
    const d=car.userData;if(d.dead)return;const inflicted=Math.min(amount,d.health);d.health-=amount;if(source===this.player&&car!==this.player)this.awardCombat(inflicted,inflicted*6);d.body.traverse(mesh=>{if(mesh.isMesh){const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>material.roughness=Math.min(.98,(material.roughness??.5)+amount*.003));}});
    if(car===this.player){this.hud.querySelector('.damage-flash').classList.add('on');setTimeout(()=>this.hud?.querySelector('.damage-flash')?.classList.remove('on'),90);}
    if(d.health<=0)this.destroyCar(car,source);
  }

  destroyCar(car,source){
    const d=car.userData;if(d.dead)return;d.dead=true;d.health=0;d.speed=0;for(let i=0;i<4;i++){d.vehicle.controller.setWheelEngineForce(i,0);d.vehicle.controller.setWheelBrake(i,3.5);}d.body.traverse(mesh=>{if(!mesh.isMesh)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>{material.color?.multiplyScalar(.28);material.roughness=.98;material.metalness=Math.min(.35,material.metalness??.2);});});d.vehicle.body.applyImpulse({x:(Math.random()-.5)*120,y:165,z:(Math.random()-.5)*120},true);d.vehicle.body.applyTorqueImpulse({x:520+(Math.random()-.5)*180,y:(Math.random()-.5)*240,z:330+(Math.random()-.5)*180},true);this.carExplosion(car);
    if(car===this.player){this.playerDeathPending=true;this.deathModalAt=this.elapsed+3;this.addEvent('<strong>КРИТИЧЕСКОЕ РАЗРУШЕНИЕ!</strong> Реактор нестабилен');}
    else{this.wrecks++;this.addEvent(`<strong>${d.name || 'ПРОТИВНИК'} ВЗОРВАН</strong>`);}
  }

  carExplosion(car){
    const pos=car.position.clone();this.explosion(pos,1.65);for(let i=0;i<6;i++){const direction=new THREE.Vector3((Math.random()-.5)*1.6,.2+Math.random()*.7,(Math.random()-.5)*1.6).normalize(),amount=12+Math.random()*11;this.deferEffect(.02+i*.025,()=>this.spawnDebris(car,direction,amount));}const lightSlot=this.acquireEffectLight(pos.clone().add(new THREE.Vector3(0,1.1,0)),18,14,7.5,car);this.burningCars.push({car,life:7.5,emit:.08,lightSlot});this.shake=1.35;
  }

  updateBurningCars(dt){
    for(let i=this.burningCars.length-1;i>=0;i--){const fire=this.burningCars[i];fire.life-=dt;fire.emit-=dt;if(fire.lightSlot){fire.lightSlot.light.position.copy(fire.car.position).add(new THREE.Vector3(0,.9,0));fire.lightSlot.light.intensity=8+Math.random()*16;}if(fire.emit<=0){fire.emit=.045+Math.random()*.055;const pos=fire.car.position.clone().add(new THREE.Vector3((Math.random()-.5)*1.8,.55+Math.random()*.8,(Math.random()-.5)*2.2));this.emitFlame(pos,Math.random()<.45?0xffe24a:0xff4b12,.35+Math.random()*.6,.35+Math.random()*.55,new THREE.Vector3((Math.random()-.5)*1.2,1.4+Math.random()*2,(Math.random()-.5)*1.2));if(Math.random()<.45)this.emitFlame(pos,0x242323,.55+Math.random()*.7,1+Math.random()*1.2,new THREE.Vector3((Math.random()-.5)*.8,1+Math.random()*1.3,(Math.random()-.5)*.8),true);}if(fire.life<=0){this.releaseEffectLight(fire.lightSlot);this.burningCars.splice(i,1);}}
  }

  fireMachineGun(){
    const weapon=MACHINE_GUNS.find(x=>x.id===save.selectedMachineGun)||MACHINE_GUNS[0];if(this.elapsed-this.lastPrimaryShot<weapon.cooldown)return;this.lastPrimaryShot=this.elapsed;const origin=this.player.position.clone().add(new THREE.Vector3(0,.22,0)),direction=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()).setY(0).normalize().applyAxisAngle(_up,(Math.random()-.5)*weapon.spread),ray=new RAPIER.Ray(origin,direction),worldHit=this.physics.castRay(ray,weapon.range,true,undefined,undefined,this.player.userData.vehicle.collider,this.player.userData.vehicle.body),worldDistance=worldHit?.timeOfImpact??weapon.range,end=origin.clone().addScaledVector(direction,weapon.range),segment=new THREE.Line3(origin,end),closest=new THREE.Vector3();let pedHit=null,pedPoint=null,pedDistance=Infinity;for(const p of this.pedestrians){if(p.userData.dead)continue;const target=p.position.clone().add(new THREE.Vector3(0,.72,0));segment.closestPointToPoint(target,true,closest);const along=origin.distanceTo(closest);if(along<=worldDistance+.1&&closest.distanceTo(target)<.58&&along<pedDistance){pedHit=p;pedPoint=closest.clone();pedDistance=along;}}let impact=origin.clone().addScaledVector(direction,worldDistance);if(pedHit&&pedDistance<=worldDistance){impact.copy(pedPoint);this.ragdollPedestrian(pedHit,direction,7,false);}else if(worldHit){const car=this.colliderVehicles.get(worldHit.collider.handle);if(car&&car!==this.player&&!car.userData.dead){this.damageCar(car,weapon.damage,this.player);const kick=direction.clone().multiplyScalar(weapon.kick);car.userData.vehicle.body.applyImpulse({x:kick.x,y:3,z:kick.z},true);}else this.sparkBurst(impact,4,direction.clone().negate());}this.makeTracer(origin,impact,weapon.color);
  }

  acquireMissileTarget(launcher=MISSILE_LAUNCHERS.find(x=>x.id===save.selectedMissileLauncher)){
    if(!launcher||launcher.id==='none')return null;const forward=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()).setY(0).normalize();return this.opponents.filter(o=>!o.userData.dead).map(o=>{const offset=o.position.clone().sub(this.player.position),distance=offset.length(),alignment=forward.dot(offset.normalize());return{o,distance,alignment,score:distance*(1.35-alignment)};}).filter(item=>item.distance<launcher.lockRange&&item.alignment>.12).sort((a,b)=>a.score-b.score)[0]?.o||null;
  }

  fireMissile(){
    const launcher=MISSILE_LAUNCHERS.find(x=>x.id===save.selectedMissileLauncher)||MISSILE_LAUNCHERS[0];if(launcher.id==='none'||this.elapsed-this.lastMissileShot<launcher.cooldown)return;this.lastMissileShot=this.elapsed;const target=this.acquireMissileTarget(launcher),rocket=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,.72,10),new THREE.MeshStandardMaterial({color:0x2a2d2b,emissive:0xff3d0d,emissiveIntensity:2.6,roughness:.34,metalness:.75})),launchDirection=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()).setY(0).normalize();rocket.position.copy(this.player.position).addScaledVector(launchDirection,1.65);rocket.position.y+=.3;rocket.quaternion.setFromUnitVectors(_up,launchDirection);const flare=new THREE.PointLight(0xff5a17,8,7,2);flare.position.set(0,-.32,0);rocket.add(flare);rocket.userData={vel:launchDirection.multiplyScalar(launcher.speed),speed:launcher.speed,turnRate:launcher.turnRate,target,damageScale:launcher.damageScale,life:2.65,trail:0};this.scene.add(rocket);this.projectiles.push(rocket);this.addEvent(target?`<strong>ЦЕЛЬ ЗАХВАЧЕНА:</strong> ${target.userData.name}`:'<strong>РАКЕТА:</strong> свободный пуск');
  }

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){const r=this.projectiles[i],previous=r.position.clone(),lockedTarget=r.userData.target;if(lockedTarget?.userData.dead)r.userData.target=null;if(r.userData.target){const desired=r.userData.target.position.clone().add(new THREE.Vector3(0,.1,0)).sub(r.position).normalize(),steering=1-Math.exp(-r.userData.turnRate*dt),heading=r.userData.vel.clone().normalize().lerp(desired,steering).normalize();r.userData.vel.copy(heading).multiplyScalar(r.userData.speed);r.quaternion.setFromUnitVectors(_up,heading);}r.position.addScaledVector(r.userData.vel,dt);r.userData.life-=dt;r.userData.trail-=dt;if(r.userData.trail<=0){r.userData.trail=.016;const rear=r.position.clone().addScaledVector(r.userData.vel.clone().normalize(),-.42);this.emitFlame(rear,Math.random()<.4?0xffe56d:0xff4814,.28+Math.random()*.2,.18+Math.random()*.16,r.userData.vel.clone().multiplyScalar(-.025).add(new THREE.Vector3((Math.random()-.5)*1.2,(Math.random()-.5)*.8,(Math.random()-.5)*1.2)));if(Math.random()<.55)this.emitFlame(rear,0x3d3937,.28+Math.random()*.25,.55+Math.random()*.35,new THREE.Vector3((Math.random()-.5)*.5,.45+Math.random()*.5,(Math.random()-.5)*.5),true);}const travel=r.position.clone().sub(previous),distance=travel.length(),direction=travel.clone().normalize(),ray=new RAPIER.Ray(previous,direction),worldHit=this.physics.castRay(ray,distance+.35,true,undefined,undefined,this.player.userData.vehicle.collider,this.player.userData.vehicle.body),segment=new THREE.Line3(previous,r.position),closest=new THREE.Vector3();let pedHit=null,pedPoint=null,pedDistance=Infinity;for(const p of this.pedestrians){if(p.userData.dead)continue;const target=p.position.clone().add(new THREE.Vector3(0,.75,0));segment.closestPointToPoint(target,true,closest);const d=closest.distanceTo(target);if(d<.78){const along=previous.distanceTo(closest);if(along<pedDistance){pedDistance=along;pedHit=p;pedPoint=closest.clone();}}}let vehicleHit=null,vehiclePoint=null,vehicleDistance=Infinity;for(const o of this.opponents){if(o.userData.dead)continue;const target=o.position.clone().add(new THREE.Vector3(0,.1,0)),radius=o.userData.vehicle.dimensions.width*.55;segment.closestPointToPoint(target,true,closest);if(closest.distanceTo(target)<radius){const along=previous.distanceTo(closest);if(along<vehicleDistance){vehicleDistance=along;vehicleHit=o;vehiclePoint=closest.clone();}}}const physicsDistance=worldHit?.timeOfImpact??Infinity,entityDistance=Math.min(pedDistance,vehicleDistance);if(entityDistance<Infinity&&entityDistance<=physicsDistance){if(pedDistance<=vehicleDistance)this.detonateRocket(r,pedPoint,pedHit,null);else this.detonateRocket(r,vehiclePoint,null,vehicleHit.userData.vehicle.collider);}else if(worldHit){const hitPoint=previous.clone().addScaledVector(direction,worldHit.timeOfImpact);this.detonateRocket(r,hitPoint,null,worldHit.collider);}else if(r.userData.life<0)this.detonateRocket(r,r.position.clone(),null,null);if(!r.parent)this.projectiles.splice(i,1);}
  }

  detonateRocket(rocket,position,directPed,hitCollider){
    rocket.position.copy(position);this.renderer.domElement.dataset.lastRocketImpact=directPed?'pedestrian':(hitCollider?.userData?.type||'range');const direction=rocket.userData.vel.clone().normalize(),damageScale=rocket.userData.damageScale||1;if(directPed)this.ragdollPedestrian(directPed,direction,18*damageScale,false);for(const p of this.pedestrians){if(p.userData.dead)continue;const dist=p.position.distanceTo(position);if(dist<7.5)this.ragdollPedestrian(p,p.position.clone().sub(position).normalize(),THREE.MathUtils.mapLinear(dist,0,7.5,15,5)*damageScale,false);}const obstacle=this.colliderDestructibles.get(hitCollider?.handle);if(obstacle&&!obstacle.broken){obstacle.pendingBreak=true;this.breakObstacle(obstacle,direction,this.player);}this.explosion(position,1.42*Math.min(1.2,damageScale));for(const o of this.opponents){const dist=o.position.distanceTo(position);if(!o.userData.dead&&dist<10){this.damageCar(o,THREE.MathUtils.mapLinear(dist,0,10,52,7)*damageScale,this.player);const impulse=o.position.clone().sub(position).normalize().multiplyScalar((10-dist)*165*damageScale);o.userData.vehicle.body.applyImpulse({x:impulse.x,y:135*damageScale,z:impulse.z},true);}}this.scene.remove(rocket);rocket.geometry.dispose();rocket.material.dispose();
  }

  checkCheckpoint(){
    if(this.player.position.distanceTo(this.waypoints[this.checkpoint])<10){this.checkpointMeshes[this.checkpoint].material.opacity=.13;this.checkpoint=(this.checkpoint+1)%this.waypoints.length;this.checkpointMeshes[this.checkpoint].material.opacity=.85;if(this.checkpoint===0){this.lap++;this.addEvent(`<strong>КРУГ ${this.lap}/${this.level.laps}</strong>`);}}
  }
  checkRules(){if(this.playerDeathPending)return;if(this.victoryPending){if(this.elapsed>=this.victoryModalAt)this.finish(true,'ВСЕ СОПЕРНИКИ УНИЧТОЖЕНЫ');return;}if(this.enemyQuota>0&&this.wrecks>=this.enemyQuota){this.victoryPending=true;this.victoryModalAt=this.elapsed+3;this.addEvent('<strong>ПОСЛЕДНИЙ СОПЕРНИК УНИЧТОЖЕН</strong> Подтверждение победы...');return;}if(this.lap>=this.level.laps)this.finish(true,'ГОНКА ЗАВЕРШЕНА');else if(this.kills>=this.level.quota)this.finish(true,'КВОТА ВЫПОЛНЕНА');}

  emitSmoke(car,color=0x333333,size=.4){const pos=car.position.clone().add(new THREE.Vector3((Math.random()-.5),1.1,(Math.random()-.5)));this.emitDust(pos,color,size,1.4,new THREE.Vector3((Math.random()-.5)*.7,1.5+Math.random(),(Math.random()-.5)*.7),.48);}
  emitBoostFlames(car){for(const x of[-.58,.58]){const p=car.position.clone().add(new THREE.Vector3(x,.48,-2.18).applyQuaternion(car.quaternion)),velocity=new THREE.Vector3((Math.random()-.5)*.5,.1,-7-Math.random()*3).applyQuaternion(car.quaternion);this.emitFlame(p,Math.random()<.4?0xffe99a:0xff5a16,.28+Math.random()*.16,.16+Math.random()*.1,velocity);this.emitFlame(p,0xbfeaff,.14+Math.random()*.08,.09+Math.random()*.06,velocity.clone().multiplyScalar(1.12));}}
  emitParticle(pos,color,size,life,vel=new THREE.Vector3(0,1,0)){const m=new THREE.Mesh(_particleGeometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));m.scale.setScalar(size);m.position.copy(pos);m.userData={vel:vel.clone(),life,maxLife:life,sharedGeometry:true};this.scene.add(m);this.particles.push(m);}
  emitBloodDrop(pos,size,life,vel,splat=true){const material=new THREE.MeshBasicMaterial({color:Math.random()<.22?0xe01a1a:0x810000,transparent:true,opacity:.94,depthWrite:false}),drop=new THREE.Mesh(_bloodDropGeometry,material);drop.scale.set(size*.55,size*1.35,size*.55);drop.position.copy(pos);drop.userData={vel:vel.clone(),life,maxLife:life,baseOpacity:.94,sharedGeometry:true,bloodDrop:true,splat,gravity:9.8,growth:0,baseSize:size,phase:Math.random()*Math.PI*2,spin:4+Math.random()*7};this.scene.add(drop);this.particles.push(drop);}
  emitBloodMist(pos,size,life,vel){const opacity=.6+Math.random()*.25,material=new THREE.SpriteMaterial({map:getParticleTexture('blood'),color:Math.random()<.18?0xf02222:0x980000,transparent:true,opacity,depthWrite:false}),sprite=new THREE.Sprite(material);sprite.position.copy(pos);sprite.scale.set(size*.68,size,1);sprite.userData={vel:vel.clone(),life,maxLife:life,baseOpacity:opacity,bloodMist:true,gravity:8.4,growth:0,baseSize:size,spin:(Math.random()-.5)*13};this.scene.add(sprite);this.particles.push(sprite);}
  emitSpark(pos,color,size,life,vel){const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}),spark=new THREE.Mesh(_sparkGeometry,material);spark.position.copy(pos);spark.userData={vel:vel.clone(),life,maxLife:life,baseOpacity:1,sharedGeometry:true,spark:true,gravity:11.5,growth:0,baseSize:size};this.scene.add(spark);this.particles.push(spark);}
  emitDust(pos,color,size,life,vel=new THREE.Vector3(0,1,0),opacity=.3){const material=new THREE.SpriteMaterial({map:getParticleTexture('smoke'),color,transparent:true,opacity,depthWrite:false}),sprite=new THREE.Sprite(material);sprite.position.copy(pos);sprite.scale.setScalar(size);sprite.userData={vel:vel.clone(),life,maxLife:life,baseOpacity:opacity,gravity:.35,growth:size*1.35,dust:true};this.scene.add(sprite);this.particles.push(sprite);}
  emitFlame(pos,color,size,life,vel=new THREE.Vector3(0,1,0),smoke=false){const material=new THREE.SpriteMaterial({map:getParticleTexture(smoke?'smoke':'fire'),color,transparent:true,opacity:smoke?.68:1,depthWrite:false,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending}),sprite=new THREE.Sprite(material);sprite.position.copy(pos);sprite.scale.setScalar(size);sprite.userData={vel:vel.clone(),life,maxLife:life,baseOpacity:material.opacity,gravity:smoke?-.18:.2,growth:smoke?1.9:1.25};this.scene.add(sprite);this.particles.push(sprite);}
  sparkBurst(pos,count=12,normal=new THREE.Vector3()){const n=normal.clone();if(n.lengthSq()<.001)n.set(Math.random()-.5,.12,Math.random()-.5);n.normalize();const tangent=new THREE.Vector3(-n.z,0,n.x),sparkCount=THREE.MathUtils.clamp(Math.round(count*.68),5,18),dustCount=THREE.MathUtils.clamp(Math.round(count/5),2,6);for(let i=0;i<sparkCount;i++){const velocity=n.clone().multiplyScalar((Math.random()<.78?1:-1)*(3+Math.random()*8)).addScaledVector(tangent,(Math.random()-.5)*7);velocity.y=2+Math.random()*7;this.emitSpark(pos.clone().addScaledVector(n,(Math.random()-.5)*.16),i%5?0xffa515:0xfff4c2,.045+Math.random()*.035,.14+Math.random()*.32,velocity);}for(let i=0;i<dustCount;i++){const velocity=n.clone().multiplyScalar((Math.random()-.25)*2.6).addScaledVector(tangent,(Math.random()-.5)*2.8);velocity.y=.45+Math.random()*1.5;this.emitDust(pos.clone().add(new THREE.Vector3((Math.random()-.5)*.28,-.08,(Math.random()-.5)*.28)),i%3?0x82725e:0x625f59,.18+Math.random()*.22,.38+Math.random()*.42,velocity,.16+Math.random()*.13);}const material=new THREE.SpriteMaterial({map:getParticleTexture('fire'),color:0xffefad,transparent:true,opacity:.88,depthWrite:false,blending:THREE.AdditiveBlending}),flash=new THREE.Sprite(material);flash.position.copy(pos);flash.scale.setScalar(.22+Math.min(.38,count*.009));flash.userData={vel:new THREE.Vector3(),life:.075,maxLife:.075,baseOpacity:.88,gravity:0,growth:2.4};this.scene.add(flash);this.particles.push(flash);}
  bloodBurst(pos,count=24,direction=new THREE.Vector3()){const forward=direction.clone().setY(0);if(forward.lengthSq()<.01)forward.set(Math.random()-.5,0,Math.random()-.5);forward.normalize();const side=new THREE.Vector3(-forward.z,0,forward.x),origin=pos.clone().add(new THREE.Vector3(0,.9,0)),dropCount=THREE.MathUtils.clamp(Math.round(count*.42),8,14),mistCount=THREE.MathUtils.clamp(count-dropCount,10,20);for(let i=0;i<dropCount;i++){const velocity=forward.clone().multiplyScalar(3.5+Math.random()*7).addScaledVector(side,(Math.random()-.5)*5);velocity.y=2.2+Math.random()*6.2;this.emitBloodDrop(origin.clone().add(new THREE.Vector3((Math.random()-.5)*.34,Math.random()*.42,(Math.random()-.5)*.34)),.038+Math.random()*.058,.65+Math.random()*.62,velocity,i%3===0);}for(let i=0;i<mistCount;i++){const velocity=forward.clone().multiplyScalar(3+Math.random()*8).addScaledVector(side,(Math.random()-.5)*5.5);velocity.y=1.8+Math.random()*6.5;this.emitBloodMist(origin.clone().add(new THREE.Vector3((Math.random()-.5)*.38,Math.random()*.45,(Math.random()-.5)*.38)),.07+Math.random()*.09,.42+Math.random()*.55,velocity);}for(let i=0;i<5;i++){const distance=.25+i*(.42+Math.random()*.35),point=pos.clone().addScaledVector(forward,distance).addScaledVector(side,(Math.random()-.5)*(1.1+i*.22));this.spawnBloodDecal(point,forward,.62+Math.random()*.75,18+Math.random()*9);}}
  bloodContact(pos,direction,force=3000){const forward=direction.clone().setY(0);if(forward.lengthSq()<.001)forward.set(0,0,1);forward.normalize();const side=new THREE.Vector3(-forward.z,0,forward.x),dropCount=Math.min(8,3+Math.round(force/6500)),mistCount=Math.min(12,5+Math.round(force/5200));for(let i=0;i<dropCount;i++){const velocity=forward.clone().multiplyScalar(1.8+Math.random()*5).addScaledVector(side,(Math.random()-.5)*3.8);velocity.y=1.1+Math.random()*4.6;this.emitBloodDrop(pos.clone().add(new THREE.Vector3((Math.random()-.5)*.25,.15+Math.random()*.3,(Math.random()-.5)*.25)),.032+Math.random()*.052,.48+Math.random()*.48,velocity,i%3===0);}for(let i=0;i<mistCount;i++){const velocity=forward.clone().multiplyScalar(1.5+Math.random()*6).addScaledVector(side,(Math.random()-.5)*4.2);velocity.y=.8+Math.random()*4.8;this.emitBloodMist(pos.clone().add(new THREE.Vector3((Math.random()-.5)*.28,.16+Math.random()*.3,(Math.random()-.5)*.28)),.055+Math.random()*.075,.35+Math.random()*.45,velocity);}for(let i=0;i<(force>9000?2:1);i++)this.spawnBloodDecal(pos.clone().addScaledVector(side,(Math.random()-.5)*.5),forward,.32+Math.random()*.35,12+Math.random()*7);this.renderer.domElement.dataset.ragdollBlood=String(+(this.renderer.domElement.dataset.ragdollBlood||0)+1);}
  spawnBloodDecal(position,direction=new THREE.Vector3(0,0,1),scale=1,life=22){if(this.bloodDecals.length>=120){const old=this.bloodDecals.shift();this.scene.remove(old.mesh);old.mesh.material.dispose();}const angle=Math.atan2(direction.x,direction.z)+(Math.random()-.5)*.7,material=new THREE.MeshBasicMaterial({map:getBloodTexture(),color:Math.random()<.25?0x9e0707:0x650000,transparent:true,opacity:.86,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mesh=new THREE.Mesh(_bloodDecalGeometry,material),width=(.42+Math.random()*.58)*scale,length=(.7+Math.random()*1.1)*scale;mesh.rotation.set(-Math.PI/2,0,angle);mesh.scale.set(width,length,1);mesh.position.set(position.x,.064,position.z);mesh.renderOrder=2;mesh.userData.bloodDecal=true;this.scene.add(mesh);this.bloodDecals.push({mesh,life,maxLife:life,fadeDuration:Math.min(7,life*.34),baseOpacity:material.opacity});this.renderer.domElement.dataset.bloodDecals=String(this.bloodDecals.length);}
  updateBloodDecals(dt){for(let i=this.bloodDecals.length-1;i>=0;i--){const decal=this.bloodDecals[i];decal.life-=dt;const fade=THREE.MathUtils.clamp(decal.life/decal.fadeDuration,0,1);decal.mesh.material.opacity=decal.baseOpacity*fade;if(decal.life<=0){this.scene.remove(decal.mesh);decal.mesh.material.dispose();this.bloodDecals.splice(i,1);}}this.renderer.domElement.dataset.bloodDecals=String(this.bloodDecals.length);}
  deferEffect(delay,callback){this.deferredEffects.push({delay,callback});}
  acquireEffectLight(position,peak,range,duration,owner=null){let slot=this.effectLights.find(item=>item.life<=0&&!item.owner);if(!slot)slot=this.effectLights.filter(item=>!item.owner).sort((a,b)=>a.life-b.life)[0];if(!slot)return null;slot.life=duration;slot.duration=duration;slot.peak=peak;slot.owner=owner;slot.light.position.copy(position);slot.light.distance=range;slot.light.intensity=peak;return slot;}
  releaseEffectLight(slot){if(!slot)return;slot.life=0;slot.duration=0;slot.peak=0;slot.owner=null;slot.light.intensity=0;}
  updateDeferredEffects(dt){let budget=3;for(let i=this.deferredEffects.length-1;i>=0;i--){const effect=this.deferredEffects[i];effect.delay-=dt;if(effect.delay>0||budget<=0)continue;this.deferredEffects.splice(i,1);effect.callback();budget--;}for(const slot of this.effectLights){if(slot.owner||slot.life<=0)continue;slot.life=Math.max(0,slot.life-dt);slot.light.intensity=slot.life>0?slot.peak*(slot.life/slot.duration):0;}}
  explosion(pos,intensity=1){
    const origin=pos.clone().add(new THREE.Vector3(0,.65,0)),flash=new THREE.Sprite(new THREE.SpriteMaterial({map:getParticleTexture('fire'),color:0xffffff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));flash.position.copy(origin);flash.scale.setScalar(2.8*intensity);flash.userData={vel:new THREE.Vector3(),life:.24,maxLife:.24,baseOpacity:1,gravity:0,growth:11*intensity};this.scene.add(flash);this.particles.push(flash);
    for(let layer=0;layer<2;layer++){const wave=new THREE.Sprite(new THREE.SpriteMaterial({map:getParticleTexture('shockwave'),color:layer?0xff5a18:0xffd77a,transparent:true,opacity:layer?.32:.58,depthWrite:false,blending:THREE.AdditiveBlending}));wave.position.copy(origin).add(new THREE.Vector3(0,layer*.25,0));wave.scale.setScalar((1.4+layer*.55)*intensity);wave.userData={vel:new THREE.Vector3(),life:.36+layer*.16,maxLife:.36+layer*.16,baseOpacity:layer?.32:.58,gravity:0,growth:(16-layer*3)*intensity};this.scene.add(wave);this.particles.push(wave);}
    const fireCount=Math.round(30*intensity),smokeCount=Math.round(12*intensity),sparkCount=Math.round(20*intensity),scheduleBatches=(count,size,emit,start)=>{for(let offset=0;offset<count;offset+=size){const batch=Math.min(size,count-offset);this.deferEffect(start+offset/size*.018,()=>{for(let i=0;i<batch;i++)emit(offset+i);});}};
    scheduleBatches(fireCount,10,i=>{const direction=new THREE.Vector3((Math.random()-.5)*15,2+Math.random()*13,(Math.random()-.5)*15).multiplyScalar(.8+intensity*.28);this.emitFlame(origin.clone().add(new THREE.Vector3((Math.random()-.5)*1.5,Math.random()*1.2,(Math.random()-.5)*1.5)),i%4?0xff4c12:0xffe36b,.38+Math.random()*.72*intensity,.4+Math.random()*.72,direction);},.012);
    scheduleBatches(smokeCount,6,()=>this.emitFlame(origin.clone().add(new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.5,(Math.random()-.5)*2)),0x292725,.7+Math.random()*.95,1.4+Math.random()*2,new THREE.Vector3((Math.random()-.5)*3.4,2.2+Math.random()*4.8,(Math.random()-.5)*3.4),true),.03);
    scheduleBatches(sparkCount,10,()=>this.emitSpark(pos.clone().add(new THREE.Vector3(0,.5,0)),Math.random()<.75?0xffa515:0xfff4c2,.045+Math.random()*.035,.18+Math.random()*.42,new THREE.Vector3((Math.random()-.5)*12,2+Math.random()*7,(Math.random()-.5)*12)),.02);
    this.acquireEffectLight(pos.clone().add(new THREE.Vector3(0,2,0)),42*intensity,30*intensity,.3);this.shake=Math.max(this.shake,intensity*1.15);
  }
  makeTracer(from,to,color){const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),45);}
  makeLightning(from,to){const pts=[];for(let i=0;i<=8;i++){const p=from.clone().lerp(to,i/8);if(i>0&&i<8)p.add(new THREE.Vector3((Math.random()-.5)*1.2,1+(Math.random()-.5)*1.2,(Math.random()-.5)*1.2));pts.push(p);}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8feeff}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),110);}
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i],data=p.userData;data.life-=dt;data.vel.y-=(data.gravity??(p.isSprite?.45:2.5))*dt;p.position.addScaledVector(data.vel,dt);const lifeRatio=Math.max(0,data.life/data.maxLife);if(data.bloodDrop){data.phase+=dt*data.spin;const velocityDirection=data.vel.clone();if(velocityDirection.lengthSq()>.001){const speed=velocityDirection.length(),align=new THREE.Quaternion().setFromUnitVectors(_up,velocityDirection.normalize()),roll=new THREE.Quaternion().setFromAxisAngle(velocityDirection,data.phase);p.quaternion.copy(align).multiply(roll);const base=data.baseSize,stretch=1.05+Math.min(1.45,speed*.075);p.scale.set(base*(.52+Math.sin(data.phase)*.035),base*stretch,base*(.52-Math.sin(data.phase)*.035));}if(p.position.y<=.07&&data.vel.y<0){if(data.splat)this.spawnBloodDecal(p.position,data.vel,.14+Math.random()*.18,13+Math.random()*7);data.life=0;}}else if(data.bloodMist){p.material.rotation+=dt*data.spin;const age=1-lifeRatio,base=data.baseSize;p.scale.set(base*(.68+age*.35),base*(1+age*.65),1);if(p.position.y<=.05&&data.vel.y<0)data.life=0;}else if(data.spark){const velocityDirection=data.vel.clone();if(velocityDirection.lengthSq()>.001){const speed=velocityDirection.length(),base=data.baseSize;p.quaternion.setFromUnitVectors(_up,velocityDirection.normalize());p.scale.set(base*.16,base*(1.35+Math.min(3.3,speed*.18))*Math.max(.35,lifeRatio),base*.16);}}else p.scale.addScalar(dt*(data.growth??(p.isSprite?1.15:.35)));p.material.opacity=lifeRatio*(data.baseOpacity??1);if(data.dust)p.material.opacity*=Math.sin(Math.min(1,(1-lifeRatio)*3.2)*Math.PI*.5);if(data.life<=0){this.scene.remove(p);if(!data.sharedGeometry)p.geometry?.dispose();p.material?.dispose();this.particles.splice(i,1);}}}

  keepInArena(){}
  resetPlayer(){if(this.ended)return;const nearest=this.waypoints.reduce((best,p,i)=>p.distanceTo(this.player.position)<this.waypoints[best].distanceTo(this.player.position)?i:best,0),point=this.waypoints[nearest],next=this.waypoints[(nearest+1)%this.waypoints.length],yaw=Math.atan2(next.x-point.x,next.z-point.z),body=this.player.userData.vehicle.body;body.setTranslation({x:point.x,y:1.3,z:point.z},true);body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);this.player.userData.speed=0;this.addEvent('Эвакуация: <strong>-5% корпуса</strong>');this.damageCar(this.player,this.player.userData.maxHealth*.05);}

  updateCamera(dt){
    if(!this.player)return;if(!this.cameraDragging&&this.elapsed-this.lastCameraInput>2){this.cameraOrbitYaw=THREE.MathUtils.damp(this.cameraOrbitYaw,0,2.1,dt);this.cameraOrbitPitch=THREE.MathUtils.damp(this.cameraOrbitPitch,0,2.1,dt);}this.cameraZoom=THREE.MathUtils.damp(this.cameraZoom,this.cameraZoomTarget,7,dt);const speed=Math.abs(this.player.userData.speed),bodyForward=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()).setY(0),stableForward=bodyForward.lengthSq()>.001?bodyForward.normalize():new THREE.Vector3(0,0,1),stableYaw=Math.atan2(stableForward.x,stableForward.z),distance=(10.5+speed*.08+this.boostIntensity*1.8)*this.cameraZoom,height=(5.8+speed*.035+this.boostIntensity*.45)*(.72+this.cameraZoom*.28)+this.cameraOrbitPitch*6,offset=new THREE.Vector3(Math.sin(this.cameraOrbitYaw)*distance,height,-Math.cos(this.cameraOrbitYaw)*distance).applyAxisAngle(_up,stableYaw),desired=this.player.position.clone().add(offset);desired.y=Math.max(1.55,desired.y);if(this.boostIntensity>.05){desired.x+=(Math.random()-.5)*.045*this.boostIntensity;desired.y+=(Math.random()-.5)*.035*this.boostIntensity;}if(this.shake>0){desired.x+=(Math.random()-.5)*this.shake;desired.y+=(Math.random()-.5)*this.shake;this.shake=Math.max(0,this.shake-dt*2.8);}this.camera.position.lerp(desired,1-Math.pow(.002,dt));this.camera.position.y=Math.max(1.45,this.camera.position.y);const orbitSide=Math.abs(Math.sin(this.cameraOrbitYaw)),orbitForward=Math.cos(this.cameraOrbitYaw),lookAhead=speed*.18*orbitForward*(1-orbitSide*.72),look=this.player.position.clone().add(new THREE.Vector3(0,Math.max(.85,1+this.cameraOrbitPitch*.45),0)).addScaledVector(stableForward,lookAhead);this.camera.lookAt(look);this.camera.fov=THREE.MathUtils.damp(this.camera.fov,62+Math.min(13,speed*.25)+this.boostIntensity*7,4.2,dt);this.camera.updateProjectionMatrix();this.renderer.domElement.dataset.cameraOrbit=this.cameraOrbitYaw.toFixed(3);this.renderer.domElement.dataset.cameraZoom=this.cameraZoom.toFixed(2);this.renderer.domElement.dataset.boost=this.boostIntensity.toFixed(2);
  }

  updateHUD(){
    const d=this.player.userData,remaining=this.opponents.filter(o=>!o.userData.dead).length;this.hud.querySelector('[data-lap]').textContent=`${Math.min(this.level.laps,this.lap+1)}/${this.level.laps}`;this.hud.querySelector('[data-enemies]').textContent=remaining;this.hud.querySelector('[data-kills]').textContent=`${this.kills}/${this.level.quota}`;this.hud.querySelector('[data-total-damage]').textContent=money(Math.round(this.totalDamage));this.hud.querySelector('[data-run-credits]').textContent=`₡ ${money(this.runCredits)}`;this.hud.querySelector('[data-health]').textContent=Math.max(0,Math.round(d.health/d.maxHealth*100))+'%';this.hud.querySelector('[data-nitro]').textContent=Math.round(d.nitro)+'%';const sp=Math.round(Math.abs(d.speed)*3.6);this.hud.querySelector('[data-speed]').textContent=String(sp).padStart(3,'0');this.hud.querySelector('.speedo i').style.setProperty('--speed',Math.min(100,sp/2.5)+'%');this.hud.querySelector('[data-time]').textContent=formatTime(this.elapsed);
    const machineGun=MACHINE_GUNS.find(w=>w.id===save.selectedMachineGun)||MACHINE_GUNS[0],launcher=MISSILE_LAUNCHERS.find(w=>w.id===save.selectedMissileLauncher)||MISSILE_LAUNCHERS[0],machineReady=this.elapsed-this.lastPrimaryShot>=machineGun.cooldown,missileReady=launcher.id!=='none'&&this.elapsed-this.lastMissileShot>=launcher.cooldown,missileTarget=missileReady?this.acquireMissileTarget(launcher):null;this.hud.querySelector('[data-machine-gun-status]').textContent=machineReady?'READY':'FIRE';this.hud.querySelector('[data-missile-status]').textContent=launcher.id==='none'?'EMPTY':missileReady?(missileTarget?'LOCK':'SEARCH'):'WAIT';this.hud.querySelector('.crosshair')?.classList.toggle('locked',Boolean(missileTarget));
    const playerPoint=this.minimapPoint(this.player.position.x,this.player.position.z),playerYaw=new THREE.Euler().setFromQuaternion(this.player.quaternion,'YXZ').y;if(this.mapPlayer){this.mapPlayer.style.left=playerPoint.x+'%';this.mapPlayer.style.top=playerPoint.y+'%';this.mapPlayer.style.transform=`translate(-50%,-50%) rotate(${-playerYaw}rad)`;}this.opponents.forEach((opponent,i)=>{const el=this.mapEnemies?.[i];if(!el)return;if(opponent.userData.dead){el.style.display='none';return;}const point=this.minimapPoint(opponent.position.x,opponent.position.z),yaw=new THREE.Euler().setFromQuaternion(opponent.quaternion,'YXZ').y;el.style.display='block';el.style.left=point.x+'%';el.style.top=point.y+'%';el.style.transform=`translate(-50%,-50%) rotate(${-yaw}rad)`;});this.pedestrians.forEach((pedestrian,i)=>{const el=this.mapPedestrians?.[i];if(!el)return;if(pedestrian.userData.dead){el.style.display='none';return;}const point=this.minimapPoint(pedestrian.position.x,pedestrian.position.z);el.style.display='block';el.style.left=point.x+'%';el.style.top=point.y+'%';});this.destructibles.forEach((obstacle,i)=>{const el=this.mapProps?.[i];if(el)el.style.opacity=obstacle.broken?'0':'1';});this.mapCheckpoints?.forEach((el,i)=>el?.classList.toggle('active',i===this.checkpoint));
  }
  addEvent(html){const e=document.createElement('div');e.className='event';e.innerHTML=html;this.feedEl?.prepend(e);setTimeout(()=>e.remove(),4400);while(this.feedEl?.children.length>5)this.feedEl.lastChild.remove();}

  togglePause(){if(this.ended)return;this.paused=!this.paused;if(this.paused){const m=document.createElement('div');m.className='pause-modal';m.innerHTML=`<div class="modal-card"><div class="eyebrow">СИСТЕМА // ПАУЗА</div><h2>Двигатель заглушен</h2><p>Город подождёт. Но недолго.</p><div class="modal-actions"><button class="action-btn" data-resume>Вернуться в бой</button><button class="ghost-btn" data-garage>В гараж</button><button class="ghost-btn" data-menu>Главное меню</button></div></div>`;this.hud.append(m);m.querySelector('[data-resume]').onclick=()=>this.togglePause();m.querySelector('[data-garage]').onclick=()=>{this.destroy();showGarage();};m.querySelector('[data-menu]').onclick=()=>{this.destroy();showMenu();};}else this.hud.querySelector('.pause-modal')?.remove();}

  finish(win,reason){
    if(this.ended)return;this.ended=true;const baseReward=win?this.level.reward+this.kills*45+this.wrecks*250:Math.floor(this.kills*25+this.wrecks*100),reward=baseReward+this.runCredits;save.credits+=reward;if(win){save.unlockedLevel=Math.max(save.unlockedLevel,Math.min(LEVELS.length-1,this.level.id+1));const old=save.best[this.level.id];if(!old||this.elapsed<old)save.best[this.level.id]=this.elapsed;}persist();
    const hasNext=win&&this.level.id<LEVELS.length-1,modal=document.createElement('div');modal.className='result-modal';modal.innerHTML=`<div class="modal-card" style="border-top-color:${win?'var(--acid)':'var(--hot)'}"><div class="eyebrow">${win?'ЗАЕЗД ЗАВЕРШЁН':'СИСТЕМА УНИЧТОЖЕНА'}</div><h2>${reason}</h2><p>${win?'Корпорация подтвердила результат. Новый район открыт, награда переведена в гараж.':'Ничего, кроме дымящегося металла. Боевая добыча за нанесённый урон всё равно переведена в гараж.'}</p><div class="result-stats"><div class="result-stat"><strong>${money(Math.round(this.totalDamage))}</strong><small>УРОН</small></div><div class="result-stat"><strong>₡ ${money(this.runCredits)}</strong><small>БОЕВАЯ ДОБЫЧА</small></div><div class="result-stat"><strong>₡ ${money(reward)}</strong><small>ИТОГО</small></div></div><div class="modal-actions"><button class="action-btn" data-next>${hasNext?'Следующий район':'Повторить заезд'}</button><button class="ghost-btn" data-garage>В гараж</button><button class="ghost-btn" data-menu>Главное меню</button></div></div>`;this.hud.append(modal);
    modal.querySelector('[data-next]').onclick=()=>{const id=hasNext?this.level.id+1:this.level.id;this.destroy();showBriefing(id);};modal.querySelector('[data-garage]').onclick=()=>{this.destroy();showGarage();};modal.querySelector('[data-menu]').onclick=()=>{this.destroy();showMenu();};
  }

  destroy(){if(this.destroyed)return;this.destroyed=true;cancelAnimationFrame(this.raf);removeEventListener('keydown',this.onKeyDown);removeEventListener('keyup',this.onKeyUp);removeEventListener('resize',this.onResize);this.renderer?.domElement.removeEventListener('pointerdown',this.onPointerDown);this.renderer?.domElement.removeEventListener('pointermove',this.onPointerMove);this.renderer?.domElement.removeEventListener('pointerup',this.onPointerUp);this.renderer?.domElement.removeEventListener('pointercancel',this.onPointerCancel);this.renderer?.domElement.removeEventListener('contextmenu',this.onContextMenu);this.renderer?.domElement.removeEventListener('wheel',this.onWheel);this.removeNetworkState?.();if(this.multiplayer){this.multiplayer.client.close();if(multiplayerClient===this.multiplayer.client)multiplayerClient=null;}for(const decal of this.bloodDecals||[])decal.mesh.material.dispose();this.eventQueue?.free();this.physics?.free();this.renderer?.dispose();this.renderer?.domElement.remove();this.hud?.remove();}
}

function getPreviewModels(renderer) {
  if (!previewModelsPromise) {
    const library = new ModelLibrary(renderer);
    previewModelsPromise = library.preload().then(() => library).catch(error => { previewModelsPromise = null; throw error; });
  }
  return previewModelsPromise;
}

function createPreviewRenderer(container, exposure = 1.25) {
  const quality=graphicsPreset();
  const renderer = new THREE.WebGLRenderer({ antialias:quality.antialias, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=exposure;
  renderer.shadowMap.enabled=quality.shadows; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.domElement.className='preview-canvas'; container.prepend(renderer.domElement); return renderer;
}

function createGaragePreview(container, car, color) {
  const renderer=createPreviewRenderer(container,1.35),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.1,100),clock=new THREE.Clock();let raf=0,destroyed=false,visual=null;
  scene.add(new THREE.HemisphereLight(0xcce8ff,0x17120f,2.1));const key=new THREE.DirectionalLight(0xffedcf,5.2);key.position.set(-7,11,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);const rim=new THREE.DirectionalLight(0xd5ff18,3.2);rim.position.set(7,4,-5);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(9,64),new THREE.MeshStandardMaterial({color:0x111513,roughness:.82,metalness:.22}));floor.rotation.x=-Math.PI/2;floor.position.y=-.52;floor.receiveShadow=true;scene.add(floor);camera.position.set(7.5,4.5,8.5);camera.lookAt(0,.25,0);
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},observer=new ResizeObserver(resize);observer.observe(container);resize();
  getPreviewModels(renderer).then(models=>{if(destroyed)return;visual=models.createCarVisual(car.id,color,carDimensions(car)).group;visual.rotation.y=-.72;visual.position.y=.1;scene.add(visual);container.querySelector('.preview-loading')?.remove();}).catch(()=>{if(!destroyed)container.querySelector('.preview-loading').textContent='НЕ УДАЛОСЬ ЗАГРУЗИТЬ МОДЕЛЬ';});
  const animate=()=>{if(destroyed)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(visual){visual.rotation.y+=dt*.16;visual.position.y=.08+Math.sin(performance.now()*.0013)*.025;}renderer.render(scene,camera);};animate();
  return{destroy(){destroyed=true;cancelAnimationFrame(raf);observer.disconnect();renderer.dispose();renderer.domElement.remove();}};
}

function createMenuDemo(container) {
  const renderer=createPreviewRenderer(container,1.18),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,1,.1,120),clock=new THREE.Clock();let raf=0,destroyed=false,elapsed=0,actors=null;
  scene.fog=new THREE.Fog(0x151a1a,22,48);scene.add(new THREE.HemisphereLight(0xbadfff,0x29140e,2.25));const sun=new THREE.DirectionalLight(0xffd5a2,4.2);sun.position.set(-11,17,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;scene.add(sun);const glow=new THREE.PointLight(0xff4a18,8,28,2);glow.position.set(0,4,-3);scene.add(glow);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(46,30),new THREE.MeshStandardMaterial({color:0x222725,roughness:.92,metalness:.08}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);for(let i=-5;i<=5;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(1.8,.025,.08),new THREE.MeshBasicMaterial({color:0xd5bd62}));line.position.set(i*3.7,.025,1.5);scene.add(line);}camera.position.set(0,8.8,20);camera.lookAt(0,1.1,0);
  const blast=[];for(let i=0;i<28;i++){const smoke=i%5===0,sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:getParticleTexture(smoke?'smoke':'fire'),color:smoke?0x393736:(i%2?0xff4b13:0xffdf65),transparent:true,opacity:0,depthWrite:false,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending}));sprite.visible=false;scene.add(sprite);blast.push(sprite);}
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},observer=new ResizeObserver(resize);observer.observe(container);resize();
  getPreviewModels(renderer).then(models=>{if(destroyed)return;const specs=[['razor',0xff391d],['marauder',0x2777ff],['brutus',0xd5ff18]],cars=specs.map(([id,color])=>{const car=CARS.find(item=>item.id===id),group=models.createCarVisual(id,color,carDimensions(car)).group;scene.add(group);return group;}),people=Array.from({length:6},(_,i)=>{const person=models.createPerson(i),group=new THREE.Group();group.add(person.model);group.userData.person=person;scene.add(group);return group;});actors={cars,people};container.querySelector('.demo-loading')?.remove();}).catch(()=>{if(!destroyed)container.querySelector('.demo-loading').textContent='LIVE FEED НЕДОСТУПЕН';});
  const placeBlast=phase=>{const active=phase>4.1&&phase<5.65,progress=THREE.MathUtils.clamp((phase-4.1)/1.55,0,1);blast.forEach((sprite,i)=>{sprite.visible=active;if(!active)return;const angle=i*2.399,radius=progress*(1.5+i%7*.42),smoke=i%5===0;sprite.position.set(Math.cos(angle)*radius,.55+Math.sin(i*1.7)*.5+progress*(smoke?3.8:1.8),-3.2+Math.sin(angle)*radius);sprite.scale.setScalar((smoke?1.4:.75)+progress*(smoke?3.2:2));sprite.material.opacity=(1-progress)*(smoke?.6:1);});};
  const animateActors=dt=>{if(!actors)return;const phase=elapsed%8.2,{cars,people}=actors;cars[0].position.set(THREE.MathUtils.lerp(-16,16,phase/8.2),.08,2.1);cars[0].rotation.y=Math.PI/2;const crashT=THREE.MathUtils.clamp(phase/4.25,0,1);cars[1].position.set(THREE.MathUtils.lerp(15,.7,crashT),.08,-3.2);cars[1].rotation.y=-Math.PI/2+(phase>4.2?.65:0);cars[2].position.set(THREE.MathUtils.lerp(-15,-.7,crashT),.08,-3.2);cars[2].rotation.y=Math.PI/2-(phase>4.2?.62:0);const bases=[[-5,2.4],[-1.8,2.5],[2,2.4],[5.3,1.8],[-5,-.6],[5.5,-.8]];people.forEach((group,i)=>{const person=group.userData.person,danger=phase>1.1&&phase<5.2;person.idle.enabled=!danger;person.run.enabled=danger;if(danger&&!person.run.isRunning())person.run.reset().play();if(!danger&&!person.idle.isRunning())person.idle.reset().play();person.mixer.update(dt);const[x,z]=bases[i],flee=danger?THREE.MathUtils.clamp((phase-1.1)*(i%2?.75:-.65),-3.2,3.2):0;group.position.set(x,.05,z+flee);group.rotation.y=flee>=0?0:Math.PI;if(i<2&&phase>3&&phase<6){const hit=THREE.MathUtils.clamp((phase-3)/.75,0,1);group.position.x+=hit*5;group.position.y=Math.sin(hit*Math.PI)*2.6;group.rotation.z=hit*Math.PI*1.7;}});placeBlast(phase);};
  const animate=()=>{if(destroyed)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;animateActors(dt);camera.position.x=Math.sin(elapsed*.16)*2.2;camera.lookAt(0,1.15,0);renderer.render(scene,camera);};animate();
  return{destroy(){destroyed=true;cancelAnimationFrame(raf);observer.disconnect();renderer.dispose();renderer.domElement.remove();}};
}

function createPhysicsMenuDemo(container){
  const renderer=createPreviewRenderer(container,1.2),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.1,140),clock=new THREE.Clock();
  let raf=0,destroyed=false,models=null,world=null,eventQueue=null,cars=[],people=[],ragdolls=[],effects=[],bloodDecals=[],deferredEffects=[],simulationTime=0,spawnTimer=0,carSerial=0,wreckCount=0;
  container.dataset.physics='rapier';container.dataset.ragdolls='0';container.dataset.wrecks='0';container.dataset.bloodDecals='0';
  scene.background=new THREE.Color(0x111719);scene.fog=new THREE.Fog(0x151a1a,36,82);scene.add(new THREE.HemisphereLight(0xc6e5ff,0x28140c,2.35));
  const sun=new THREE.DirectionalLight(0xffd6a4,4.4);sun.position.set(-12,20,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;scene.add(sun);
  const menuLights=Array.from({length:4},()=>{const light=new THREE.PointLight(0xff4b17,0,16,2);scene.add(light);return light;});
  const cityBase=new THREE.Mesh(new THREE.PlaneGeometry(92,62),new THREE.MeshStandardMaterial({color:0x171c1d,roughness:.98,metalness:.02}));cityBase.rotation.x=-Math.PI/2;cityBase.position.y=-.02;cityBase.receiveShadow=true;scene.add(cityBase);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(64,30),new THREE.MeshStandardMaterial({color:0x292b28,roughness:.93,metalness:.07}));ground.rotation.x=-Math.PI/2;ground.position.y=.005;ground.receiveShadow=true;scene.add(ground);
  const boundaryGroup=new THREE.Group(),curbMaterial=new THREE.MeshStandardMaterial({color:0x6f756f,roughness:.82,metalness:.12}),pavementMaterial=new THREE.MeshStandardMaterial({color:0x3c4240,roughness:.94,metalness:.04}),barrierMaterial=new THREE.MeshStandardMaterial({color:0x303634,roughness:.86,metalness:.18});
  const addBoundary=(x,y,z,w,h,d,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;boundaryGroup.add(mesh);return mesh;};
  addBoundary(0,.05,-16.9,60,.1,3.2,pavementMaterial);addBoundary(0,.05,16.9,60,.1,3.2,pavementMaterial);addBoundary(0,.12,-15.15,60,.24,.8,curbMaterial);addBoundary(0,.12,15.15,60,.24,.8,curbMaterial);addBoundary(0,.38,-15.48,60,.52,.24,barrierMaterial);addBoundary(0,.38,15.48,60,.52,.24,barrierMaterial);addBoundary(-29.15,.32,0,.7,.64,30,barrierMaterial);addBoundary(29.15,.32,0,.7,.64,30,barrierMaterial);scene.add(boundaryGroup);
  for(let i=-8;i<=8;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(2.1,.025,.08),new THREE.MeshBasicMaterial({color:0xd5bd62}));line.position.set(i*3.7,.025,1.1);scene.add(line);}
  camera.position.set(0,10.5,25);camera.lookAt(0,1,0);
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},observer=new ResizeObserver(resize);observer.observe(container);resize();
  const cityGroup=new THREE.Group();scene.add(cityGroup);
  const buildMenuCity=library=>{if(cityGroup.userData.built)return;cityGroup.userData.built=true;const specs=[];for(let i=0;i<8;i++)specs.push({x:-31.5+i*9,z:-21.5,yaw:i%2?0:Math.PI,height:10.5+(i%3)*2.1,index:i});specs.push({x:-34,z:-8,yaw:Math.PI/2,height:10.5,index:8},{x:-34,z:4,yaw:Math.PI/2,height:12.5,index:9},{x:34,z:-8,yaw:-Math.PI/2,height:11.5,index:10},{x:34,z:4,yaw:-Math.PI/2,height:13,index:11});for(const spec of specs){const building=library.createEnvironment(1,spec.index);building.updateMatrixWorld(true);const initialBounds=new THREE.Box3().setFromObject(building),initialSize=initialBounds.getSize(new THREE.Vector3()),scale=spec.height/Math.max(.5,initialSize.y);building.scale.setScalar(scale);building.rotation.y=spec.yaw;building.position.set(spec.x,0,spec.z);building.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(building);building.position.y-=bounds.min.y;building.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(object.material){object.material.roughness=Math.max(.72,object.material.roughness??.72);object.material.color?.multiplyScalar(.88);}});cityGroup.add(building);}container.dataset.scenery='city';};
  const clearSimulation=()=>{for(const car of cars)scene.remove(car.visual.group);for(const p of people){scene.remove(p.group);scene.remove(p.person.model);}for(const ragdoll of ragdolls)scene.remove(ragdoll.model);for(const effect of effects){if(effect.sprite)scene.remove(effect.sprite);if(effect.light&&!effect.pooledLight)scene.remove(effect.light);effect.sprite?.material?.dispose();}for(const decal of bloodDecals){scene.remove(decal.mesh);decal.mesh.material.dispose();}for(const light of menuLights)light.intensity=0;cars=[];people=[];ragdolls=[];effects=[];bloodDecals=[];deferredEffects=[];container.dataset.bloodDecals='0';eventQueue?.free();world?.free();eventQueue=null;world=null;};
  const spawnCar=()=>{if(!models||!world||cars.length>=9)return;const index=carSerial++,side=index%2?-1:1,lane=[-4,0,4][Math.floor(index/2)%3],car=CARS[Math.floor(Math.random()*CARS.length)],dims=carDimensions(car),colors=[0xff3b20,0x3286ff,0xd5ff18,0xffffff,0xb63aff,0x2fcf83],visual=models.createCarVisual(car.id,colors[index%colors.length],dims),position=new THREE.Vector3(side*26,1.05,lane+(Math.random()-.5)*.8),target=new THREE.Vector3(-side*19,0,lane),yaw=Math.atan2(target.x-position.x,target.z-position.z);scene.add(visual.group);const vehicle=createVehicle(world,visual,{...dims,position,yaw,mass:860*car.armor,maxSpeed:24+Math.random()*5,engineForce:6200+Math.random()*900});cars.push({visual,vehicle,index,speed:0,target,health:2,wrecked:false,collisionCooldown:0,burn:0,recover:0,stuck:0,retargetAt:simulationTime+1.2+Math.random()*2,steerBias:index%2?-.75:.75,attack:null});};
  const menuExplosion=position=>{const light=menuLights.reduce((best,item)=>item.intensity<best.intensity?item:best,menuLights[0]);light.position.copy(position).add(new THREE.Vector3(0,1.3,0));light.intensity=24;effects.push({light,life:.45,maxLife:.45,pooledLight:true});for(let batch=0;batch<3;batch++)deferredEffects.push({delay:.012+batch*.025,callback:()=>{for(let j=0;j<7;j++){const i=batch*7+j,smoke=i%6===0,material=new THREE.SpriteMaterial({map:getParticleTexture(smoke?'smoke':'fire'),color:smoke?0x393736:(i%3?0xff4b14:0xffe56f),transparent:true,opacity:1,depthWrite:false,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending}),sprite=new THREE.Sprite(material);sprite.position.copy(position).add(new THREE.Vector3(0,.7,0));sprite.scale.setScalar(smoke?1.2:.55);scene.add(sprite);effects.push({sprite,vel:new THREE.Vector3((Math.random()-.5)*8,1+Math.random()*7,(Math.random()-.5)*8),life:smoke?2.2:.8,maxLife:smoke?2.2:.8,growth:smoke?2.1:1.4});}}});};
  const menuBloodBurst=(position,direction)=>{const forward=direction.clone().setY(0).normalize(),side=new THREE.Vector3(-forward.z,0,forward.x);for(let i=0;i<20;i++){const material=new THREE.SpriteMaterial({map:getParticleTexture('blood'),color:i%4?0x8b0000:0xe01818,transparent:true,opacity:.94,depthWrite:false}),sprite=new THREE.Sprite(material),velocity=forward.clone().multiplyScalar(2+Math.random()*8).addScaledVector(side,(Math.random()-.5)*7),size=.1+Math.random()*.2;velocity.y=2+Math.random()*7;sprite.position.copy(position).add(new THREE.Vector3((Math.random()-.5)*.45,.8+Math.random()*.55,(Math.random()-.5)*.45));sprite.scale.set(size*.68,size*1.8,1);scene.add(sprite);effects.push({sprite,vel:velocity,life:.65+Math.random()*.7,maxLife:1.35,growth:.08,blood:true,spin:(Math.random()-.5)*14});}for(let i=0;i<5;i++){const material=new THREE.MeshBasicMaterial({map:getBloodTexture(),color:i%3?0x650000:0x9e0707,transparent:true,opacity:.82,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),mesh=new THREE.Mesh(_bloodDecalGeometry,material),point=position.clone().addScaledVector(forward,.25+i*(.45+Math.random()*.35)).addScaledVector(side,(Math.random()-.5)*(1.2+i*.18));mesh.rotation.set(-Math.PI/2,0,Math.atan2(forward.x,forward.z)+(Math.random()-.5)*.7);mesh.scale.set(.45+Math.random()*.55,.7+Math.random()*1.1,1);mesh.position.set(point.x,.064,point.z);scene.add(mesh);bloodDecals.push({mesh,life:14+Math.random()*8,maxLife:22,fadeDuration:6,baseOpacity:material.opacity});}container.dataset.bloodDecals=String(bloodDecals.length);};
  const wreckCar=car=>{if(car.wrecked)return;car.wrecked=true;wreckCount++;container.dataset.wrecks=String(wreckCount);for(let i=0;i<4;i++){car.vehicle.controller.setWheelEngineForce(i,0);car.vehicle.controller.setWheelBrake(i,7);}car.visual.body.traverse(mesh=>{if(!mesh.isMesh)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>{material.color?.multiplyScalar(.32);material.roughness=.96;});});car.vehicle.body.applyImpulse({x:(Math.random()-.5)*90,y:70,z:(Math.random()-.5)*90},true);car.vehicle.body.applyTorqueImpulse({x:(Math.random()-.5)*150,y:(Math.random()-.5)*90,z:(Math.random()-.5)*150},true);car.burn=10;menuExplosion(car.visual.group.position.clone());};
  const resetSimulation=()=>{if(!models||destroyed)return;clearSimulation();container.dataset.ragdolls='0';container.dataset.wrecks='0';wreckCount=0;carSerial=0;const physics=createPhysicsWorld();world=physics.world;eventQueue=physics.eventQueue;createArenaColliders(world);const walls=[[0,2,-15.5,30,2,.35],[0,2,15.5,30,2,.35],[-29,2,0,.35,2,16],[29,2,0,.35,2,16]];for(const[x,y,z,hx,hy,hz]of walls)world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(1.05).setRestitution(.02));const positions=Array.from({length:14},()=>[(Math.random()-.5)*31,(Math.random()-.5)*14]);people=positions.map(([x,z],index)=>{const person=models.createPerson(index),group=new THREE.Group();group.add(person.model);group.position.set(x,.05,z);scene.add(group);return{person,group,dead:false,index,running:false,idlePosition:group.position.clone(),wander:Math.random()<.5?-1:1};});spawnCar();spawnCar();simulationTime=0;spawnTimer=1.4;container.querySelector('.demo-loading')?.remove();};
  Promise.all([RAPIER.init(),getPreviewModels(renderer)]).then(([,library])=>{if(destroyed)return;models=library;buildMenuCity(library);resetSimulation();}).catch(()=>{if(!destroyed)container.querySelector('.demo-loading').textContent='PHYSICS FEED НЕДОСТУПЕН';});
  const updateAI=dt=>{spawnTimer-=dt;if(spawnTimer<=0&&simulationTime<20){spawnTimer=1.4+Math.random()*.8;spawnCar();}for(const car of cars){car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);if(car.wrecked){car.burn-=dt;if(car.burn>0&&Math.random()<dt*13){const pos=car.visual.group.position.clone().add(new THREE.Vector3((Math.random()-.5)*1.5,.8,(Math.random()-.5)*1.8));const material=new THREE.SpriteMaterial({map:getParticleTexture(Math.random()<.55?'fire':'smoke'),color:Math.random()<.55?0xff4b16:0x333333,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),sprite=new THREE.Sprite(material);sprite.position.copy(pos);sprite.scale.setScalar(.45+Math.random()*.45);scene.add(sprite);effects.push({sprite,vel:new THREE.Vector3((Math.random()-.5),1+Math.random()*1.5,(Math.random()-.5)),life:1.2,maxLife:1.2,growth:1.4});}continue;}if(car.recover>0){car.recover-=dt;driveVehicle(car.vehicle,{throttle:-.82,steer:car.steerBias,brake:0,boost:false},dt);car.speed=car.vehicle.controller.currentVehicleSpeed();if(car.recover<=0)car.retargetAt=0;continue;}const body=car.vehicle.body,p=body.translation(),active=cars.filter(other=>other!==car&&!other.wrecked);if(simulationTime>=car.retargetAt){car.retargetAt=simulationTime+2.1+Math.random()*2.4;car.attack=active.length&&Math.random()<.72?active[Math.floor(Math.random()*active.length)]:null;if(!car.attack)car.target.set(-Math.sign(p.x||1)*20,0,[-5,-2,2,5][Math.floor(Math.random()*4)]);}if(car.attack&&!car.attack.wrecked){const velocity=car.attack.vehicle.body.linvel();car.target.copy(car.attack.visual.group.position).add(new THREE.Vector3(velocity.x,0,velocity.z).multiplyScalar(.35));}else if(car.attack){car.attack=null;car.retargetAt=0;}if(Math.hypot(p.x-car.target.x,p.z-car.target.z)<4)car.retargetAt=0;const rotation=body.rotation(),yaw=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rotation.x,rotation.y,rotation.z,rotation.w),'YXZ').y,desired=Math.atan2(car.target.x-p.x,car.target.z-p.z),diff=angleDelta(yaw,desired);driveVehicle(car.vehicle,{throttle:1,steer:THREE.MathUtils.clamp(diff*1.55,-1,1),brake:Math.abs(diff)>1.3?.18:0,boost:false},dt);car.speed=car.vehicle.controller.currentVehicleSpeed();car.stuck=Math.abs(car.speed)<.65?car.stuck+dt:Math.max(0,car.stuck-dt*2);if(car.stuck>1){car.stuck=0;car.recover=1.15;car.steerBias*=-1;car.attack=null;}}for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){const a=cars[i],b=cars[j],distance=a.visual.group.position.distanceTo(b.visual.group.position);if(a.wrecked||b.wrecked||a.collisionCooldown||b.collisionCooldown||distance>3.15)continue;const va=a.vehicle.body.linvel(),vb=b.vehicle.body.linvel(),relative=Math.hypot(va.x-vb.x,va.y-vb.y,va.z-vb.z);a.collisionCooldown=b.collisionCooldown=1.2;const collisionDamage=relative>7?2:1;a.health-=collisionDamage;b.health-=collisionDamage;if(a.health<=0)wreckCar(a);if(b.health<=0)wreckCar(b);if(a.wrecked||b.wrecked)continue;a.recover=.7+Math.random()*.4;b.recover=.7+Math.random()*.4;a.steerBias*=-1;b.steerBias*=-1;a.attack=b.attack=null;const apart=a.visual.group.position.clone().sub(b.visual.group.position).setY(0);if(apart.lengthSq()<.01)apart.set(1,0,0);apart.normalize();a.vehicle.body.applyImpulse({x:apart.x*70,y:4,z:apart.z*70},true);b.vehicle.body.applyImpulse({x:-apart.x*70,y:4,z:-apart.z*70},true);}};
  const updatePeople=dt=>{for(const p of people){if(p.dead)continue;let nearest=null,distance=Infinity;for(const car of cars){if(car.wrecked)continue;const d=p.group.position.distanceTo(car.visual.group.position);if(d<distance){distance=d;nearest=car;}}const running=!!nearest&&distance<10;if(running!==p.running){p.running=running;if(running){p.person.idle.fadeOut(.12);p.person.run.reset().fadeIn(.12).play();}else{p.idlePosition.copy(p.group.position);p.person.run.fadeOut(.12);p.person.idle.reset().fadeIn(.12).play();}}if(running){const direction=p.group.position.clone().sub(nearest.visual.group.position).setY(0);if(direction.lengthSq()<.01)direction.set(1,0,0);direction.normalize();const side=new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar(Math.sin(simulationTime*4+p.index)*.28);direction.add(side).normalize();p.group.position.addScaledVector(direction,dt*(2.8+(p.index%3)*.35));p.group.rotation.y=Math.atan2(direction.x,direction.z);}else p.group.position.copy(p.idlePosition);p.group.position.x=THREE.MathUtils.clamp(p.group.position.x,-27.4,27.4);p.group.position.z=THREE.MathUtils.clamp(p.group.position.z,-13.7,13.7);p.person.mixer.update(dt);if(p.person.hips&&p.person.hipsBasePosition)p.person.hips.position.copy(p.person.hipsBasePosition);for(const car of cars){if(car.wrecked||Math.abs(car.speed)<3||p.group.position.distanceTo(car.visual.group.position)>2.55)continue;p.dead=true;p.person.mixer.timeScale=0;p.group.updateMatrixWorld(true);p.person.model.updateMatrixWorld(true);scene.attach(p.person.model);p.group.visible=false;const impactDirection=forwardVector(car.vehicle.body,new THREE.Vector3()),impulse=impactDirection.clone().multiplyScalar(Math.min(13,5.8+Math.abs(car.speed)*.3));impulse.y=3;menuBloodBurst(p.group.position,impactDirection);ragdolls.push(createRagdoll(world,scene,p.group.position,impulse,{skin:0xd99a78,cloth:0x1e6b72},p.person.model));container.dataset.ragdolls=String(ragdolls.length);break;}}};
  const updateEffects=dt=>{let budget=2;for(let i=deferredEffects.length-1;i>=0;i--){const deferred=deferredEffects[i];deferred.delay-=dt;if(deferred.delay>0||budget<=0)continue;deferredEffects.splice(i,1);deferred.callback();budget--;}for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.life-=dt;if(effect.light){effect.light.intensity=24*Math.max(0,effect.life/effect.maxLife);if(effect.life<=0){effect.light.intensity=0;if(!effect.pooledLight)scene.remove(effect.light);effects.splice(i,1);}continue;}effect.vel.y-=(effect.blood?9.6:.4)*dt;effect.sprite.position.addScaledVector(effect.vel,dt);if(effect.blood)effect.sprite.material.rotation+=dt*effect.spin;else effect.sprite.scale.addScalar(dt*effect.growth);effect.sprite.material.opacity=Math.max(0,effect.life/effect.maxLife);if(effect.life<=0){scene.remove(effect.sprite);effect.sprite.material.dispose();effects.splice(i,1);}}for(let i=bloodDecals.length-1;i>=0;i--){const decal=bloodDecals[i];decal.life-=dt;decal.mesh.material.opacity=decal.baseOpacity*THREE.MathUtils.clamp(decal.life/decal.fadeDuration,0,1);if(decal.life<=0){scene.remove(decal.mesh);decal.mesh.material.dispose();bloodDecals.splice(i,1);}}container.dataset.bloodDecals=String(bloodDecals.length);};
  const animate=()=>{if(destroyed)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);if(world){simulationTime+=dt;updateAI(dt);world.timestep=dt;world.step(eventQueue);for(const car of cars)syncVehicle(car.vehicle);updatePeople(dt);for(const ragdoll of ragdolls)syncRagdoll(ragdoll);updateEffects(dt);if(simulationTime>34)resetSimulation();}camera.position.x=Math.sin(performance.now()*.00014)*2.6;camera.lookAt(0,1,0);renderer.render(scene,camera);};animate();
  return{destroy(){destroyed=true;cancelAnimationFrame(raf);observer.disconnect();clearSimulation();renderer.dispose();renderer.domElement.remove();}};
}

const _v1=new THREE.Vector3();
const _v2=new THREE.Vector3();
const _up=new THREE.Vector3(0,1,0);
const _particleGeometry=new THREE.IcosahedronGeometry(1,0);
const _bloodDropGeometry=new THREE.SphereGeometry(1,8,6);
const _sparkGeometry=new THREE.CylinderGeometry(1,1,1,5,1,false);
const _bloodDecalGeometry=new THREE.PlaneGeometry(1,1);
const _surfaceTextures=new Map();
const _particleTextures=new Map();
let _bloodTexture=null;
function getBloodTexture(){
  if(_bloodTexture)return _bloodTexture;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle='rgba(255,255,255,.98)';ctx.beginPath();for(let i=0;i<22;i++){const angle=i/22*Math.PI*2,radius=32+Math.sin(i*3.7)*8+(Math.random()-.5)*15,x=64+Math.cos(angle)*radius,y=64+Math.sin(angle)*radius*.72;ctx.lineTo(x,y);}ctx.closePath();ctx.fill();for(let i=0;i<24;i++){const angle=Math.random()*Math.PI*2,distance=34+Math.random()*27,radius=1.5+Math.random()*5;ctx.beginPath();ctx.arc(64+Math.cos(angle)*distance,64+Math.sin(angle)*distance*.72,radius,0,Math.PI*2);ctx.fill();}_bloodTexture=new THREE.CanvasTexture(canvas);_bloodTexture.colorSpace=THREE.SRGBColorSpace;return _bloodTexture;
}
function getParticleTexture(type){
  if(_particleTextures.has(type))return _particleTextures.get(type);const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,31);if(type==='fire'){gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.18,'rgba(255,230,115,.98)');gradient.addColorStop(.52,'rgba(255,105,25,.72)');gradient.addColorStop(1,'rgba(255,35,0,0)');}else if(type==='shockwave'){gradient.addColorStop(0,'rgba(255,248,224,.92)');gradient.addColorStop(.16,'rgba(255,188,89,.55)');gradient.addColorStop(.5,'rgba(255,88,18,.08)');gradient.addColorStop(.76,'rgba(255,156,54,.42)');gradient.addColorStop(1,'rgba(255,72,8,0)');}else if(type==='blood'){gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.38,'rgba(255,255,255,.94)');gradient.addColorStop(.72,'rgba(255,255,255,.46)');gradient.addColorStop(1,'rgba(255,255,255,0)');}else{gradient.addColorStop(0,'rgba(255,255,255,.78)');gradient.addColorStop(.45,'rgba(220,220,220,.48)');gradient.addColorStop(1,'rgba(150,150,150,0)');}ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);_particleTextures.set(type,texture);return texture;
}
function makeSurfaceTexture(renderer,key,color){
  if(_surfaceTextures.has(key))return _surfaceTextures.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),base=new THREE.Color(color),image=ctx.createImageData(256,256);
  for(let i=0;i<image.data.length;i+=4){const grain=(Math.random()-.5)*34+(Math.random()<.035?-35:0);image.data[i]=THREE.MathUtils.clamp(base.r*255+grain,0,255);image.data[i+1]=THREE.MathUtils.clamp(base.g*255+grain,0,255);image.data[i+2]=THREE.MathUtils.clamp(base.b*255+grain,0,255);image.data[i+3]=255;}ctx.putImageData(image,0,0);ctx.globalAlpha=.22;ctx.strokeStyle='#050606';ctx.lineWidth=1;
  for(let i=0;i<18;i++){ctx.beginPath();let x=Math.random()*256,y=Math.random()*256;ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=(Math.random()-.5)*32;y+=(Math.random()-.5)*32;ctx.lineTo(x,y);}ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(key==='asphalt'?26:18,key==='asphalt'?26:18);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());_surfaceTextures.set(key,texture);return texture;
}
function carDimensions(car){
  if(car.shape==='truck')return{width:2.5,height:1.15,length:4.9,wheelBase:1.55,wheelRadius:.52};
  if(car.shape==='buggy')return{width:2.15,height:.82,length:3.85,wheelBase:1.28,wheelRadius:.48};
  if(car.shape==='hearse')return{width:2.3,height:1.05,length:5.15,wheelBase:1.72,wheelRadius:.5};
  if(car.shape==='sport')return{width:2.12,height:.82,length:4.18,wheelBase:1.38,wheelRadius:.45};
  return{width:2.24,height:.98,length:4.45,wheelBase:1.48,wheelRadius:.47};
}
function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
function formatTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*1000);return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

showMenu();
