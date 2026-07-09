import * as THREE from 'three';
import './styles.css';
import { ModelLibrary } from './modelLibrary.js';
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

const CARS = [
  { id:'razor', name:'Razorback', class:'Muscle / баланс', price:0, speed:1.0, armor:1.0, handling:1.0, shape:'muscle' },
  { id:'marauder', name:'Marauder', class:'Interceptor / скорость', price:4200, speed:1.18, armor:.78, handling:1.1, shape:'sport' },
  { id:'brutus', name:'Brutus', class:'Wagon / броня', price:6500, speed:.82, armor:1.45, handling:.78, shape:'truck' },
  { id:'mantis', name:'Mantis', class:'Buggy / контроль', price:9000, speed:1.08, armor:.75, handling:1.38, shape:'buggy' },
  { id:'hearse', name:'Last Ride', class:'Hearse / таран', price:12000, speed:.9, armor:1.3, handling:.85, shape:'hearse' },
  { id:'phantom', name:'Phantom X', class:'Prototype / элита', price:18000, speed:1.3, armor:1.05, handling:1.24, shape:'sport' },
];

const WEAPONS = [
  { id:'ram', name:'Кровавый таран', desc:'Пассивно: +70% урона в лоб', price:0, cooldown:0 },
  { id:'minigun', name:'Двойной Vulcan', desc:'Плотный огонь перед машиной', price:1800, cooldown:.11 },
  { id:'rockets', name:'Hellfire ×2', desc:'Ракеты с зоной поражения', price:4200, cooldown:1.35 },
  { id:'tesla', name:'Катушка «Шок»', desc:'Цепной импульс по ближайшим', price:7600, cooldown:2.4 },
];

const COLORS = ['#d5ff18','#ff3c20','#ededdf','#2669ff','#c90045','#161918','#ffb000','#7e33ff'];

const LEVELS = [
  { id:0, name:'Ржавый район', subtitle:'Промзона / 2 круга', desc:'Бывший сталелитейный квартал. Узкие проезды, бетон и толпа, которой некуда бежать.', reward:2800, enemies:3, peds:20, quota:10, laps:2, sky:0x392f2a, fog:0x241c18, ground:0x2b2925, accent:0xff5128, weather:'DUST', time:'18:40', bg:'radial-gradient(circle at 30% 22%,#b44a20,transparent 26%),linear-gradient(140deg,#25211e,#090a09)' },
  { id:1, name:'Неоновый порт', subtitle:'Док №13 / 3 круга', desc:'Контейнерный терминал под кислотным дождём. Быстрые прямые и слепые повороты.', reward:4500, enemies:4, peds:24, quota:13, laps:3, sky:0x10192e, fog:0x091224, ground:0x151b23, accent:0x27cfff, weather:'RAIN', time:'01:15', bg:'radial-gradient(circle at 70% 20%,#125ea3,transparent 25%),linear-gradient(140deg,#101b29,#07090c)' },
  { id:2, name:'Каньон костей', subtitle:'Пустошь / 2 круга', desc:'Старая трасса через красные скалы. Обрывы, пыльные бури и тяжёлая бронетехника.', reward:6800, enemies:5, peds:26, quota:15, laps:2, sky:0x753d27, fog:0x5b2e20, ground:0x653822, accent:0xffb12b, weather:'SANDSTORM', time:'16:05', bg:'radial-gradient(circle at 50% 15%,#c66b31,transparent 25%),linear-gradient(140deg,#5d3021,#140c09)' },
  { id:3, name:'Мёртвый центр', subtitle:'Megablock / 3 круга', desc:'Разрушенный деловой центр. Перекрёстки, эстакады и охотники на быстрых машинах.', reward:9200, enemies:6, peds:30, quota:18, laps:3, sky:0x252833, fog:0x14161d, ground:0x25282a, accent:0xc43cff, weather:'ASH', time:'06:20', bg:'radial-gradient(circle at 30% 22%,#6d2d83,transparent 25%),linear-gradient(140deg,#29242e,#09090b)' },
  { id:4, name:'Адский купол', subtitle:'Финал / 4 круга', desc:'Закрытая арена корпорации WRECK. Победитель получает всё. Проигравших перерабатывают.', reward:15000, enemies:8, peds:35, quota:25, laps:4, sky:0x210909, fog:0x180606, ground:0x241313, accent:0xff1616, weather:'INFERNO', time:'00:00', bg:'radial-gradient(circle at 50% 18%,#a21313,transparent 27%),linear-gradient(140deg,#2a0c0c,#070505)' },
];

const DEFAULT_SAVE = {
  credits: 3500,
  unlockedLevel: 0,
  ownedCars: ['razor'],
  ownedWeapons: ['ram'],
  selectedCar: 'razor',
  selectedWeapon: 'ram',
  color: COLORS[0],
  upgrades: {},
  best: {},
};

let save = loadSave();
let game = null;
let toastTimer;

function loadSave() {
  try { return { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(localStorage.getItem('wreckrun-save') || '{}') }; }
  catch { return structuredClone(DEFAULT_SAVE); }
}
function persist() { localStorage.setItem('wreckrun-save', JSON.stringify(save)); }
function money(n) { return new Intl.NumberFormat('ru-RU').format(n); }
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

function showMenu() {
  game?.destroy(); game = null;
  app.innerHTML = `
    <section class="screen menu-screen">
      <div class="menu-art" aria-hidden="true"></div>
      <main class="menu-column">
        <div class="eyebrow">WRECK INDUSTRIES // ПРЕДСТАВЛЯЕТ</div>
        <h1 class="brand">Wreckrun<span>Aftermath</span></h1>
        <p class="tagline">Пять районов. Три способа победить. Никаких правил, кроме одного: до финиша должен дожить хотя бы кто-то.</p>
        <nav class="main-nav">
          <button class="nav-btn" data-action="campaign">Продолжить бой <small>КАМПАНИЯ</small></button>
          <button class="nav-btn" data-action="garage">Гараж <small>МАШИНЫ / ОРУЖИЕ</small></button>
          <button class="nav-btn" data-action="quick">Быстрый заезд <small>УРОВЕНЬ ${save.unlockedLevel + 1}</small></button>
          <button class="nav-btn" data-action="reset">Новая кампания <small>СБРОС</small></button>
        </nav>
        <div class="version">BUILD 0.1.0 // WEBGL PROTOTYPE // ALL SYSTEMS ARMED</div>
      </main>
    </section>`;
  document.querySelector('[data-action="campaign"]').onclick = showCampaign;
  document.querySelector('[data-action="garage"]').onclick = showGarage;
  document.querySelector('[data-action="quick"]').onclick = () => showBriefing(save.unlockedLevel);
  document.querySelector('[data-action="reset"]').onclick = () => {
    if (confirm('Стереть прогресс кампании и все покупки?')) { save = structuredClone(DEFAULT_SAVE); persist(); showMenu(); }
  };
}

function showGarage() {
  const car = currentCar(); const up = upgrades();
  app.innerHTML = `<section class="screen panel-screen">
    ${topbar('Гараж // <span>мясорубка</span>')}
    <div class="garage-layout">
      <div class="car-stage">
        <div class="car-preview" style="--car-color:${save.color}"><div class="wheel a"></div><div class="wheel b"></div><div class="body"></div><div class="glass"></div><div class="weapon"></div></div>
        <div class="stage-label"><h3>${car.name}</h3><p>${car.class.toUpperCase()} // ОРУЖИЕ: ${WEAPONS.find(w=>w.id===save.selectedWeapon).name.toUpperCase()}</p></div>
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
        <section class="control-section"><div class="section-kicker"><span>Крышевое вооружение</span><span>${save.ownedWeapons.length}/${WEAPONS.length}</span></div><div class="weapon-grid">${WEAPONS.map(w=>`<button class="weapon-card ${w.id===save.selectedWeapon?'active':''}" data-weapon="${w.id}"><span><strong>${w.name}</strong><small>${w.desc}</small></span><b>${save.ownedWeapons.includes(w.id)?'УСТАНОВИТЬ':'₡ '+money(w.price)}</b></button>`).join('')}</div></section>
        <button class="action-btn" data-race>Выбрать район и выехать</button>
      </aside>
    </div></section>`;
  bindBack();
  document.querySelectorAll('[data-car]').forEach(btn => btn.onclick = () => buyOrSelectCar(btn.dataset.car));
  document.querySelectorAll('[data-color]').forEach(btn => btn.onclick = () => { save.color=btn.dataset.color;persist();showGarage(); });
  document.querySelectorAll('[data-weapon]').forEach(btn => btn.onclick = () => buyOrSelectWeapon(btn.dataset.weapon));
  document.querySelectorAll('[data-upgrade]').forEach(btn => btn.onclick = () => buyUpgrade(btn.dataset.upgrade));
  document.querySelector('[data-race]').onclick = showCampaign;
}

function stat(label, width, value) { return `<div class="stat-row"><span>${label}</span><div class="stat-bar"><i style="width:${width}%"></i></div><b>${value}</b></div>`; }
function upgradeButton(id,label,lvl) { const cost=(lvl+1)*900; return `<button class="buy-btn" data-upgrade="${id}" ${lvl>=5?'disabled':''}>${label} ${lvl>=5?'MAX':`+1 · ₡${money(cost)}`}</button>`; }
function buyOrSelectCar(id) {
  const car=CARS.find(c=>c.id===id);
  if (!save.ownedCars.includes(id)) { if(save.credits<car.price){showToast('Не хватает деталей');return;} save.credits-=car.price;save.ownedCars.push(id);showToast(`${car.name} куплен`); }
  save.selectedCar=id; persist(); showGarage();
}
function buyOrSelectWeapon(id) {
  const weapon=WEAPONS.find(w=>w.id===id);
  if(!save.ownedWeapons.includes(id)){if(save.credits<weapon.price){showToast('Не хватает деталей');return;}save.credits-=weapon.price;save.ownedWeapons.push(id);showToast(`${weapon.name} установлен`);}
  save.selectedWeapon=id;persist();showGarage();
}
function buyUpgrade(type){
  const up=upgrades(); const cost=(up[type]+1)*900;
  if(up[type]>=5)return; if(save.credits<cost){showToast('Не хватает деталей');return;}
  save.credits-=cost;up[type]++;save.upgrades[save.selectedCar]=up;persist();showGarage();
}

function showCampaign() {
  app.innerHTML = `<section class="screen panel-screen">${topbar('Кампания // <span>путь разрушения</span>')}
    <div class="campaign-wrap"><div class="campaign-intro"><div class="eyebrow">СЕЗОН 01 // AFTERMATH</div><h3>Доберись до<br>Адского купола</h3><p>В каждом заезде можно победить тремя способами: закончить все круги, уничтожить всех соперников или выполнить квоту по пешеходам. Грязная победа всё равно считается победой.</p></div>
    <div class="level-list">${LEVELS.map(l=>`<article class="level-card ${l.id>save.unlockedLevel?'locked':''}" data-level="${l.id}" style="--level-bg:${l.bg}"><span class="num">0${l.id+1}</span><div class="eyebrow">${l.id<=save.unlockedLevel?'ДОСТУП РАЗРЕШЁН':'ЗАБЛОКИРОВАНО'}</div><h4>${l.name}</h4><p>${l.desc}</p><div class="level-meta"><span>${l.subtitle}</span><span>₡ ${money(l.reward)}</span></div></article>`).join('')}</div></div></section>`;
  bindBack();
  document.querySelectorAll('[data-level]').forEach(card=>card.onclick=()=>{const id=+card.dataset.level;if(id<=save.unlockedLevel)showBriefing(id);});
}

function showBriefing(id){
  const level=LEVELS[id];
  app.innerHTML=`<section class="screen panel-screen" style="background:${level.bg}"><div class="briefing-modal"><div class="modal-card"><div class="eyebrow">БРИФИНГ // УРОВЕНЬ 0${id+1}</div><h2>${level.name}</h2><p>${level.desc}</p><div class="result-stats"><div class="result-stat"><strong>${level.laps}</strong><small>КРУГА</small></div><div class="result-stat"><strong>${level.enemies}</strong><small>СОПЕРНИКОВ</small></div><div class="result-stat"><strong>${level.quota}</strong><small>КВОТА</small></div></div><p>Победи любым способом. Награда: <b style="color:var(--acid)">₡ ${money(level.reward)}</b><br>Управление: WASD / стрелки · Пробел — огонь · Shift — нитро · R — эвакуация.</p><div class="modal-actions"><button class="action-btn" data-deploy>Выехать на старт</button><button class="ghost-btn" data-cancel>Вернуться</button></div></div></div></section>`;
  document.querySelector('[data-deploy]').onclick=()=>startGame(id);
  document.querySelector('[data-cancel]').onclick=showCampaign;
}

async function startGame(levelId){
  app.innerHTML=`<section class="screen loading-screen"><div class="loader-mark">WR</div><div class="eyebrow">ЗАГРУЗКА БОЕВОГО КОМПЛЕКТА</div><div class="loader-bar"><i data-load-progress></i></div><p data-load-label>Инициализация физики…</p></section>`;
  await RAPIER.init();
  game=new WreckrunGame(LEVELS[levelId]);
  await game.init();
}

class WreckrunGame {
  constructor(level){
    this.level=level; this.clock=new THREE.Clock(); this.keys={}; this.entities=[]; this.opponents=[]; this.pedestrians=[]; this.particles=[]; this.projectiles=[];
    this.ragdolls=[];this.physicsDebris=[];this.destructibles=[];this.colliderVehicles=new Map();this.colliderDestructibles=new Map();this.elapsed=0;this.kills=0;this.wrecks=0;this.lap=0;this.checkpoint=0;this.ended=false;this.paused=false;this.lastShot=-10;this.shake=0;this.accumulator=0;
  }

  async init(){
    this.setupRenderer();this.setupScene();
    const physics=createPhysicsWorld();this.physics=physics.world;this.eventQueue=physics.eventQueue;createArenaColliders(this.physics);
    this.models=new ModelLibrary(this.renderer);
    const progress=document.querySelector('[data-load-progress]'),label=document.querySelector('[data-load-label]');
    await this.models.preload(value=>{if(progress)progress.style.width=`${Math.round(value*100)}%`;if(label)label.textContent=`Модели, текстуры и физика: ${Math.round(value*100)}%`;});
    this.setupWorld();this.setupActors();this.setupUI();document.querySelector('.loading-screen')?.remove();this.bindEvents();this.animate();
  }

  setupRenderer(){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); this.renderer.setSize(innerWidth,innerHeight); this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15; this.renderer.domElement.id='game-canvas';app.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,650);
  }

  setupScene(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(this.level.sky);this.scene.fog=new THREE.FogExp2(this.level.fog,.0085);
    const hemi=new THREE.HemisphereLight(this.level.accent,0x17120f,1.6);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffe0c0,2.4);sun.position.set(-35,60,-25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-90;sun.shadow.camera.right=90;sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x252a31,.55));
  }

  setupWorld(){
    const groundTexture=makeSurfaceTexture(this.renderer,'ground',this.level.ground),ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:this.level.ground,map:groundTexture,roughness:.96,metalness:.04}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const grid=new THREE.GridHelper(260,130,new THREE.Color(this.level.accent).multiplyScalar(.25),new THREE.Color(0x252525));grid.position.y=.025;grid.material.opacity=.18;grid.material.transparent=true;this.scene.add(grid);
    this.waypoints=[[-55,-38],[0,-54],[55,-38],[66,0],[55,38],[0,54],[-55,38],[-66,0]].map(([x,z])=>new THREE.Vector3(x,0,z));
    this.buildTrack();this.buildCity();
    for(let i=0;i<18;i++){const x=(Math.random()-.5)*115,z=(Math.random()-.5)*80;if(Math.abs(x)<12&&Math.abs(z)<12)continue;this.makeObstacle(x,z);}
    for(let i=0;i<30;i++){const lamp=new THREE.PointLight(this.level.accent,7,12,2);const a=i/30*Math.PI*2;lamp.position.set(Math.cos(a)*78,2.7,Math.sin(a)*63);this.scene.add(lamp);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3),new THREE.MeshStandardMaterial({color:0x161816,metalness:.8}));pole.position.copy(lamp.position);pole.position.y=1.5;this.scene.add(pole);}
  }

  buildTrack(){
    const roadMat=new THREE.MeshStandardMaterial({color:0x242726,map:makeSurfaceTexture(this.renderer,'asphalt',0x303332),roughness:.9,metalness:.1});
    const outer=new THREE.Shape();outer.absellipse(0,0,78,62,0,Math.PI*2,false);const hole=new THREE.Path();hole.absellipse(0,0,47,31,0,Math.PI*2,true);outer.holes.push(hole);
    const road=new THREE.Mesh(new THREE.ShapeGeometry(outer,96),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.045;road.receiveShadow=true;this.scene.add(road);
    const dashMat=new THREE.MeshBasicMaterial({color:0xd5b95a});
    for(let i=0;i<56;i++){const a=i/56*Math.PI*2;const dash=new THREE.Mesh(new THREE.BoxGeometry(3,.035,.18),dashMat);dash.position.set(Math.cos(a)*62,.08,Math.sin(a)*46);dash.rotation.y=-a;this.scene.add(dash);}
    this.checkpointMeshes=[];
    this.waypoints.forEach((p,i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(5.8,.16,6,24),new THREE.MeshBasicMaterial({color:i===0?this.level.accent:0x52605a,transparent:true,opacity:i===0?.85:.13}));ring.position.copy(p);ring.position.y=.25;ring.rotation.x=Math.PI/2;this.scene.add(ring);this.checkpointMeshes.push(ring);});
  }

  buildCity(){
    const rng=mulberry32(777+this.level.id*313);
    for(let i=0;i<46;i++){
      const a=rng()*Math.PI*2,radius=88+rng()*34;
      const building=this.models.createEnvironment(this.level.id,i);
      building.updateMatrixWorld(true);const initialBounds=new THREE.Box3().setFromObject(building),initialSize=initialBounds.getSize(new THREE.Vector3()),desiredHeight=(this.level.id===0||this.level.id===2?10:15)+rng()*(this.level.id===3?28:18),scale=desiredHeight/Math.max(1,initialSize.y);building.scale.setScalar(scale);building.rotation.y=-a+Math.PI/2+(rng()-.5)*.16;
      building.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);building.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(building);building.position.y-=bounds.min.y;
      building.traverse(object=>{if(object.isMesh){object.material.roughness=Math.min(.86,object.material.roughness??.7);if(this.level.id===4)object.material.color?.multiplyScalar(.72);}});
      this.scene.add(building);
      if(i%5===0){const glow=new THREE.PointLight(this.level.accent,11,18,2);glow.position.set(building.position.x,2.4,building.position.z);this.scene.add(glow);}
    }
    for(let i=0;i<10;i++){
      const prop=this.models.cloneAsset(i%2?'ind:tank':'ind:chimney'),a=rng()*Math.PI*2,r=76+rng()*8;prop.updateMatrixWorld(true);const original=new THREE.Box3().setFromObject(prop),originalSize=original.getSize(new THREE.Vector3()),targetHeight=i%2?3.5:9;prop.position.set(Math.cos(a)*r,0,Math.sin(a)*r);prop.rotation.y=rng()*Math.PI;prop.scale.setScalar(targetHeight/Math.max(.5,originalSize.y));prop.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(prop);prop.position.y-=b.min.y;this.scene.add(prop);
    }
  }

  makeObstacle(x,z){
    const type=Math.random(),wide=type<.55;
    const model=wide?this.models.cloneAsset('prop:box'):this.models.cloneAsset('prop:cone'),scale=wide?.8+Math.random()*1.1:.85+Math.random()*.45,yaw=Math.random()*Math.PI;
    model.scale.setScalar(scale);model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);
    const visual=new THREE.Group();visual.add(model);visual.position.set(x,Math.max(.2,size.y*.5+.025),z);visual.rotation.y=yaw;this.scene.add(visual);
    const rotation={x:0,y:Math.sin(yaw*.5),z:0,w:Math.cos(yaw*.5)},body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(visual.position.x,visual.position.y,visual.position.z).setRotation(rotation).setLinearDamping(wide?.28:.42).setAngularDamping(wide?.46:.62).setCcdEnabled(true));
    const halfHeight=Math.max(.18,size.y*.46),radius=Math.max(.18,Math.max(size.x,size.z)*.42),desc=wide?RAPIER.ColliderDesc.roundCuboid(Math.max(.18,size.x*.43),halfHeight,Math.max(.18,size.z*.43),.055):RAPIER.ColliderDesc.cone(halfHeight,radius);
    const mass=wide?32+scale*18:8+scale*5,collider=this.physics.createCollider(desc.setMass(mass).setFriction(wide?1.05:1.22).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setRestitution(wide?.055:.08).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(900),body);
    const obstacle={visual,body,collider,type:wide?'crate':'cone',size,mass,health:wide?4.5:2,breakForce:wide?26000:10500,lastImpact:-10,broken:false,pendingBreak:false};
    collider.userData={type:'destructible',obstacle};this.destructibles.push(obstacle);this.colliderDestructibles.set(collider.handle,obstacle);
  }

  setupActors(){
    const car=currentCar(),up=upgrades();
    const dims=carDimensions(car),start=this.waypoints[0].clone().add(new THREE.Vector3(0,1.05,6));
    const playerVisual=this.models.createCarVisual(car.id,save.color,dims);this.player=playerVisual.group;this.scene.add(this.player);
    const playerVehicle=createVehicle(this.physics,playerVisual,{...dims,position:start,yaw:1.72,mass:980*car.armor,maxSpeed:36*car.speed+up.engine*2.2,engineForce:6800*car.speed+up.engine*620});
    Object.assign(this.player.userData,{vehicle:playerVehicle,body:playerVisual.body,wheels:playerVisual.wheels,speed:0,health:Math.round((100+up.armor*18)*car.armor),maxHealth:Math.round((100+up.armor*18)*car.armor),maxSpeed:playerVehicle.maxSpeed,handling:car.handling+up.handling*.08,nitro:100,dead:false,lastImpact:-10});
    this.colliderVehicles.set(playerVehicle.collider.handle,this.player);
    const aiColors=[0xff3b20,0x4090ff,0xf4d13b,0xb63aff,0xffffff,0x2fcf83,0xff6bc2,0x777777];
    for(let i=0;i<this.level.enemies;i++){
      const base=CARS[(i+this.level.id+1)%CARS.length],aiDims=carDimensions(base),visual=this.models.createCarVisual(base.id,aiColors[i%aiColors.length],aiDims),ai=visual.group,startIndex=(i*2+1)%this.waypoints.length;
      const point=this.waypoints[startIndex],next=this.waypoints[(startIndex+1)%this.waypoints.length],pos=point.clone().add(new THREE.Vector3(0,1.05,0)),yaw=Math.atan2(next.x-point.x,next.z-point.z);this.scene.add(ai);
      const vehicle=createVehicle(this.physics,visual,{...aiDims,position:pos,yaw,mass:900*base.armor,maxSpeed:27+Math.random()*5+this.level.id*1.8,engineForce:5600+this.level.id*480+Math.random()*700});
      Object.assign(ai.userData,{vehicle,body:visual.body,wheels:visual.wheels,speed:0,health:70+this.level.id*14+base.armor*25,maxHealth:70+this.level.id*14+base.armor*25,maxSpeed:vehicle.maxSpeed,handling:base.handling,target:(startIndex+1)%this.waypoints.length,aggression:.25+Math.random()*.7,dead:false,lastImpact:-10,name:['Crusher','Widow','Butcher','Chrome Jack','Hex','Mortis','Road Wolf','Buzzard'][i]});
      this.colliderVehicles.set(vehicle.collider.handle,ai);this.opponents.push(ai);
    }
    for(let i=0;i<this.level.peds;i++){const ped=this.createPedestrian(i);if(i<4){ped.position.copy(this.waypoints[0]).lerp(this.waypoints[1],.13+i*.075);ped.position.x+=(i%2?1:-1)*2.3;ped.position.y=.05;}else{const a=Math.random()*Math.PI*2,r=20+Math.random()*48;ped.position.set(Math.cos(a)*r,.05,Math.sin(a)*r);}this.scene.add(ped);this.pedestrians.push(ped);}
  }

  createCar(color,shape,isPlayer){
    const car=CARS.find(item=>item.shape===shape)||CARS[0];return this.models.createCarVisual(car.id,color,carDimensions(car)).group;
  }

  createPedestrian(i){
    const person=this.models.createPerson(i),g=new THREE.Group();g.add(person.model);g.userData={dead:false,panic:0,phase:Math.random()*10,model:person.model,mixer:person.mixer,idle:person.idle,run:person.run,skin:[0xd99a78,0x8a5a42,0xf0bd91][i%3],cloth:[0xbab599,0x1e6b72,0x863328,0x41404d][i%4]};return g;
  }

  setupUI(){
    const weapon=WEAPONS.find(w=>w.id===save.selectedWeapon);
    this.hud=document.createElement('div');this.hud.className='screen hud';this.hud.innerHTML=`<div class="boost-lines"></div><div class="damage-flash"></div><div class="hud-top"><div class="race-objective"><small>Три пути к победе</small><strong>Круг <span data-lap>1/${this.level.laps}</span> · Враги <span data-enemies>${this.opponents.length}</span> · Квота <span data-kills>0/${this.level.quota}</span></strong></div><div class="timer"><small>${this.level.name} // ${this.level.weather}</small><span data-time>00:00.000</span></div></div><div class="minimap"><i class="map-player"></i>${this.opponents.map((_,i)=>`<i class="map-enemy" data-map-enemy="${i}"></i>`).join('')}</div><div class="event-feed"></div><div class="crosshair"></div><div class="hud-bottom"><div class="car-vitals"><div class="vital health"><span class="hud-label">Корпус</span><strong data-health>100%</strong></div><div class="vital nitro"><span class="hud-label">Нитро</span><strong data-nitro>100%</strong></div><div class="vital weapon"><span class="hud-label">Оружие</span><strong data-weapon>${weapon.id==='ram'?'RAM':'READY'}</strong></div></div><div class="controls-hint"><b>WASD</b> движение · <b>SPACE</b> огонь · <b>SHIFT</b> нитро · <b>ESC</b> пауза</div><div class="speedo"><strong data-speed>000</strong><span>KM/H</span><i style="--speed:0%"></i></div></div>`;app.append(this.hud);
    this.feedEl=this.hud.querySelector('.event-feed');this.addEvent('Двигатели запущены. <strong>УНИЧТОЖАЙ.</strong>');
  }

  bindEvents(){
    this.onKeyDown=e=>{this.keys[e.code]=true;if(e.code==='Escape')this.togglePause();if(e.code==='KeyR')this.resetPlayer();if(e.code==='KeyK'&&new URLSearchParams(location.search).has('debugRagdoll')){const target=this.pedestrians.find(p=>!p.userData.dead);if(target){target.position.copy(this.player.position).add(new THREE.Vector3(0,0,3).applyQuaternion(this.player.quaternion));this.ragdollPedestrian(target);}}};
    this.onKeyUp=e=>{this.keys[e.code]=false;};this.onResize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);};
    addEventListener('keydown',this.onKeyDown);addEventListener('keyup',this.onKeyUp);addEventListener('resize',this.onResize);
  }

  animate=()=>{if(this.destroyed)return;this.raf=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.034);if(!this.paused&&!this.ended){this.elapsed+=dt;this.updatePlayer(dt);this.updateAI(dt);this.updatePedestrians(dt);this.physics.timestep=dt;this.physics.step(this.eventQueue);this.handlePhysicsContacts();syncVehicle(this.player.userData.vehicle);this.opponents.forEach(ai=>syncVehicle(ai.userData.vehicle));this.syncDestructibles();this.ragdolls.forEach(syncRagdoll);this.syncPhysicsDebris(dt);this.hitPedestrians();this.updateProjectiles(dt);this.updateParticles(dt);this.checkRules();this.updateHUD();}this.updateCamera(dt);this.renderer.render(this.scene,this.camera);};

  updatePlayer(dt){
    const d=this.player.userData;if(d.dead)return;const forward=this.keys.KeyW||this.keys.ArrowUp,reverse=this.keys.KeyS||this.keys.ArrowDown,left=this.keys.KeyA||this.keys.ArrowLeft,right=this.keys.KeyD||this.keys.ArrowRight;
    const boosting=(this.keys.ShiftLeft||this.keys.ShiftRight)&&forward&&d.nitro>0;if(boosting){d.nitro=Math.max(0,d.nitro-23*dt);this.emitExhaust(this.player,0x62dfff);this.hud.querySelector('.boost-lines').classList.add('on');}else{d.nitro=Math.min(100,d.nitro+4.8*dt);this.hud.querySelector('.boost-lines').classList.remove('on');}
    const throttle=(forward?1:0)-(reverse?1:0),steer=((left?1:0)-(right?1:0))*d.handling;
    driveVehicle(d.vehicle,{throttle,steer,brake:!throttle&&Math.abs(d.speed)<1?.15:0,boost:boosting},dt);d.speed=d.vehicle.controller.currentVehicleSpeed();
    if(Math.abs(steer)>.35&&Math.abs(d.speed)>12&&Math.random()<.25)this.emitSmoke(this.player,0x777777,.16);
    if(this.keys.Space)this.fireWeapon();this.checkCheckpoint();
    if(d.health<d.maxHealth*.42&&Math.random()<dt*5)this.emitSmoke(this.player,d.health<d.maxHealth*.2?0x171717:0x555555,.5);
  }

  updateAI(dt){
    for(const ai of this.opponents){const d=ai.userData;if(d.dead)continue;let target=this.waypoints[d.target];
      if(d.aggression>.72&&ai.position.distanceTo(this.player.position)<25)target=this.player.position;
      const desired=Math.atan2(target.x-ai.position.x,target.z-ai.position.z),yaw=new THREE.Euler().setFromQuaternion(ai.quaternion,'YXZ').y,diff=angleDelta(yaw,desired);d.speed=d.vehicle.controller.currentVehicleSpeed();
      const steer=THREE.MathUtils.clamp(diff*1.45,-1,1)*d.handling,brake=Math.abs(diff)>1.15&&Math.abs(d.speed)>10?.45:0;driveVehicle(d.vehicle,{throttle:brake?.28:1,steer,brake,boost:false},dt);
      if(ai.position.distanceTo(this.waypoints[d.target])<10)d.target=(d.target+1)%this.waypoints.length;
      if(d.health<d.maxHealth*.4&&Math.random()<dt*4)this.emitSmoke(ai,0x222222,.45);
    }
  }

  updatePedestrians(dt){
    for(const p of this.pedestrians){if(p.userData.dead)continue;const dist=p.position.distanceTo(this.player.position),running=dist<19;p.userData.mixer.update(dt);if(running!==p.userData.running){p.userData.running=running;if(running){p.userData.idle.fadeOut(.18);p.userData.run.reset().fadeIn(.18).play();}else{p.userData.run.fadeOut(.3);p.userData.idle.reset().fadeIn(.3).play();}}
      if(running){const away=p.position.clone().sub(this.player.position).setY(0).normalize();p.position.addScaledVector(away,dt*(dist<8?7.4:4.2));p.rotation.y=Math.atan2(away.x,away.z);}
    }
  }

  updateRagdoll(){}

  hitPedestrians(){
    if(Math.abs(this.player.userData.speed)<4)return;
    for(const p of this.pedestrians){if(p.userData.dead||p.position.distanceTo(this.player.position)>2.35)continue;this.ragdollPedestrian(p);}
  }

  ragdollPedestrian(p){
    if(p.userData.dead)return;p.userData.dead=true;this.kills++;const f=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()),speed=Math.max(8,Math.abs(this.player.userData.speed)),model=p.userData.model;p.userData.mixer.stopAllAction();p.updateMatrixWorld(true);model.updateMatrixWorld(true);this.scene.attach(model);p.visible=false;
      const impulse=f.clone().multiplyScalar(4.5+speed*.48);impulse.y=4.8+speed*.11;this.ragdolls.push(createRagdoll(this.physics,this.scene,p.position,impulse,{skin:p.userData.skin,cloth:p.userData.cloth},model));
      const recoil=f.multiplyScalar(-42);this.player.userData.vehicle.body.applyImpulse({x:recoil.x,y:0,z:recoil.z},true);
      this.bloodBurst(p.position,22);this.addEvent(`<strong>РАЗМАЗАН!</strong> Квота ${this.kills}/${this.level.quota}`);this.shake=.45;
  }

  collideCars(){}

  handlePhysicsContacts(){
    const breaks=[];
    this.eventQueue.drainContactForceEvents(event=>{
      const h1=event.collider1(),h2=event.collider2(),car1=this.colliderVehicles.get(h1),car2=this.colliderVehicles.get(h2),obstacle1=this.colliderDestructibles.get(h1),obstacle2=this.colliderDestructibles.get(h2),collider1=this.physics.getCollider(h1),collider2=this.physics.getCollider(h2),force=event.totalForceMagnitude(),raw=event.maxForceDirection();
      if(force<900)return;
      const direction=new THREE.Vector3(raw.x,raw.y,raw.z);
      if((car1||car2)&&force>2200)this.applyContactGrip(car1,car2,obstacle1,obstacle2,direction,force);
      if(obstacle1&&!obstacle1.pendingBreak&&this.damageObstacle(obstacle1,force,car2)){obstacle1.pendingBreak=true;breaks.push({obstacle:obstacle1,direction:direction.clone().negate(),source:car2});}
      if(obstacle2&&!obstacle2.pendingBreak&&this.damageObstacle(obstacle2,force,car1)){obstacle2.pendingBreak=true;breaks.push({obstacle:obstacle2,direction:direction.clone(),source:car1});}
      if(force<15000)return;
      const apply=(car,dir,other,otherCollider)=>{if(!car||car.userData.dead||otherCollider?.userData?.type==='ground')return;if(!other&&force<52000)return;if(this.elapsed-car.userData.lastImpact<.48)return;car.userData.lastImpact=this.elapsed;let amount=THREE.MathUtils.clamp((force-15000)/26000,0,24);if(car!==this.player&&other===this.player&&save.selectedWeapon==='ram')amount*=1.5;if(amount<.7)return;this.damageCar(car,amount,other);this.deformCar(car,dir,amount);this.sparkBurst(car.position,Math.min(28,6+Math.round(amount)));this.shake=Math.max(this.shake,Math.min(.9,amount/26));};
      apply(car1,direction,car2,collider2);apply(car2,direction.clone().negate(),car1,collider1);
    });
    breaks.forEach(item=>this.breakObstacle(item.obstacle,item.direction,item.source));
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
    if(force>4200){const p=obstacle.visual.position.clone();if(obstacle.type==='cone')this.sparkBurst(p,Math.min(8,2+Math.round(force/7000)));else for(let i=0;i<4;i++)this.emitParticle(p.clone().add(new THREE.Vector3(0,.4,0)),0x9a5528,.04+Math.random()*.07,.35+Math.random()*.35,new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4));}
    return force>=obstacle.breakForce||obstacle.health<=0;
  }

  breakObstacle(obstacle,direction,source){
    if(obstacle.broken)return;obstacle.broken=true;
    const position=obstacle.visual.position.clone(),sourceVelocity=source?.userData.vehicle.body.linvel()||{x:direction.x*8,y:0,z:direction.z*8},count=obstacle.type==='crate'?9:7,palette=obstacle.type==='crate'?[0x5a2d12,0x8d491d,0xc17430]:[0xff6518,0xf1ead4,0x24282b];
    this.colliderDestructibles.delete(obstacle.collider.handle);this.scene.remove(obstacle.visual);this.physics.removeRigidBody(obstacle.body);
    for(let i=0;i<count;i++){
      const chunkScale=.13+Math.random()*.22,geometry=obstacle.type==='crate'?new THREE.BoxGeometry(chunkScale*(1.2+Math.random()),chunkScale*(.7+Math.random()),chunkScale*(1.1+Math.random())):new THREE.TetrahedronGeometry(chunkScale*(1.1+Math.random()*.8),0),visual=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:palette[i%palette.length],roughness:.78,metalness:obstacle.type==='cone'&&i%3===2?.65:.08}));
      visual.castShadow=true;visual.position.copy(position).add(new THREE.Vector3((Math.random()-.5)*obstacle.size.x*.65,(Math.random()-.1)*obstacle.size.y*.45,(Math.random()-.5)*obstacle.size.z*.65));this.scene.add(visual);
      const mass=1.1+Math.random()*2.2,body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(visual.position.x,visual.position.y,visual.position.z).setLinearDamping(.16).setAngularDamping(.12).setCcdEnabled(true)),collider=RAPIER.ColliderDesc.ball(chunkScale*.65).setMass(mass).setFriction(1.15).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setRestitution(.12);this.physics.createCollider(collider,body);
      body.setLinvel({x:sourceVelocity.x*.52+(Math.random()-.5)*7,y:2.5+Math.random()*6,z:sourceVelocity.z*.52+(Math.random()-.5)*7},true);body.applyTorqueImpulse({x:(Math.random()-.5)*8,y:(Math.random()-.5)*8,z:(Math.random()-.5)*8},true);this.physicsDebris.push({visual,body,life:5+Math.random()*3,dispose:true});
    }
    for(let i=0;i<12;i++)this.emitParticle(position.clone().add(new THREE.Vector3(0,.35,0)),obstacle.type==='crate'?(i%2?0x6e3516:0xb16b31):0x6d6257,.055+Math.random()*.1,.45+Math.random()*.65,new THREE.Vector3((Math.random()-.5)*7,1.5+Math.random()*5,(Math.random()-.5)*7));
    if(obstacle.type==='cone')this.sparkBurst(position,10);this.shake=Math.max(this.shake,obstacle.type==='crate'?.34:.2);
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

  syncPhysicsDebris(dt){for(let i=this.physicsDebris.length-1;i>=0;i--){const item=this.physicsDebris[i],p=item.body.translation(),r=item.body.rotation();item.visual.position.set(p.x,p.y,p.z);item.visual.quaternion.set(r.x,r.y,r.z,r.w);item.life-=dt;if(item.life<=0){this.scene.remove(item.visual);this.physics.removeRigidBody(item.body);if(item.dispose){item.visual.geometry?.dispose();item.visual.material?.dispose();}this.physicsDebris.splice(i,1);}}}

  damageCar(car,amount,source){
    const d=car.userData;if(d.dead)return;d.health-=amount;d.body.traverse(mesh=>{if(mesh.isMesh){const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>material.roughness=Math.min(.98,(material.roughness??.5)+amount*.003));}});
    if(car===this.player){this.hud.querySelector('.damage-flash').classList.add('on');setTimeout(()=>this.hud?.querySelector('.damage-flash')?.classList.remove('on'),90);}
    if(d.health<=0){d.dead=true;d.speed=0;for(let i=0;i<4;i++){d.vehicle.controller.setWheelEngineForce(i,0);d.vehicle.controller.setWheelBrake(i,12);}d.vehicle.body.applyTorqueImpulse({x:450,y:80,z:220},true);this.explosion(car.position);if(car===this.player)this.finish(false,'МАШИНА УНИЧТОЖЕНА');else{this.wrecks++;this.addEvent(`<strong>${d.name || 'ПРОТИВНИК'} УНИЧТОЖЕН</strong>`);}}
  }

  fireWeapon(){
    const w=WEAPONS.find(x=>x.id===save.selectedWeapon);if(w.id==='ram')return;if(this.elapsed-this.lastShot<w.cooldown)return;this.lastShot=this.elapsed;
    if(w.id==='minigun'){
      const targets=this.targetsAhead(34,.5);const origin=this.player.position.clone().add(new THREE.Vector3(0,1.5,0));const target=targets[0]?.position.clone().add(new THREE.Vector3(0,.6,0))||origin.clone().add(new THREE.Vector3(0,0,35).applyQuaternion(this.player.quaternion));this.makeTracer(origin,target,0xffe369);if(targets[0]){this.damageCar(targets[0],5.5,this.player);const kick=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3()).multiplyScalar(85);targets[0].userData.vehicle.body.applyImpulse({x:kick.x,y:5,z:kick.z},true);}this.sparkBurst(target,5);
    } else if(w.id==='rockets'){
      const rocket=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.65,8),new THREE.MeshBasicMaterial({color:0xff5a19}));rocket.rotation.x=Math.PI/2;rocket.position.copy(this.player.position).add(new THREE.Vector3(0,1.45,1.5).applyQuaternion(this.player.quaternion));rocket.quaternion.copy(this.player.quaternion);rocket.userData={vel:new THREE.Vector3(0,0,34).applyQuaternion(this.player.quaternion),life:2};this.scene.add(rocket);this.projectiles.push(rocket);
    } else {
      const targets=this.targetsAhead(22,-.2).slice(0,3);targets.forEach((t,i)=>{this.makeLightning(this.player.position,t.position);this.damageCar(t,20-i*5,this.player);});if(targets.length)this.addEvent('<strong>ЦЕПНОЙ РАЗРЯД</strong>');
    }
  }

  targetsAhead(range,dotMin){const f=forwardVector(this.player.userData.vehicle.body,new THREE.Vector3());return this.opponents.filter(o=>!o.userData.dead&&o.position.distanceTo(this.player.position)<range&&f.dot(o.position.clone().sub(this.player.position).normalize())>dotMin).sort((a,b)=>a.position.distanceTo(this.player.position)-b.position.distanceTo(this.player.position));}

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){const r=this.projectiles[i];r.position.addScaledVector(r.userData.vel,dt);r.userData.life-=dt;this.emitParticle(r.position,0xff6b16,.16,.3);let hit=this.opponents.find(o=>!o.userData.dead&&o.position.distanceTo(r.position)<2.4);if(hit||r.userData.life<0){this.explosion(r.position);for(const o of this.opponents){const dist=o.position.distanceTo(r.position);if(!o.userData.dead&&dist<9){this.damageCar(o,THREE.MathUtils.mapLinear(dist,0,9,42,6),this.player);const impulse=o.position.clone().sub(r.position).normalize().multiplyScalar((9-dist)*150);o.userData.vehicle.body.applyImpulse({x:impulse.x,y:120,z:impulse.z},true);}}this.scene.remove(r);this.projectiles.splice(i,1);}}
  }

  checkCheckpoint(){
    if(this.player.position.distanceTo(this.waypoints[this.checkpoint])<10){this.checkpointMeshes[this.checkpoint].material.opacity=.13;this.checkpoint=(this.checkpoint+1)%this.waypoints.length;this.checkpointMeshes[this.checkpoint].material.opacity=.85;if(this.checkpoint===0){this.lap++;this.addEvent(`<strong>КРУГ ${this.lap}/${this.level.laps}</strong>`);}}
  }
  checkRules(){if(this.lap>=this.level.laps)this.finish(true,'ГОНКА ЗАВЕРШЕНА');else if(this.wrecks>=this.level.enemies)this.finish(true,'ВСЕ СОПЕРНИКИ УНИЧТОЖЕНЫ');else if(this.kills>=this.level.quota)this.finish(true,'КВОТА ВЫПОЛНЕНА');}

  emitSmoke(car,color=0x333333,size=.4){const pos=car.position.clone().add(new THREE.Vector3((Math.random()-.5),1.1,(Math.random()-.5)));this.emitParticle(pos,color,size,1.4,new THREE.Vector3((Math.random()-.5)*.7,1.5+Math.random(),(Math.random()-.5)*.7));}
  emitExhaust(car,color){const p=car.position.clone().add(new THREE.Vector3(0,.45,-2.2).applyQuaternion(car.quaternion));this.emitParticle(p,color,.18,.35,new THREE.Vector3((Math.random()-.5),.2,-4).applyQuaternion(car.quaternion));}
  emitParticle(pos,color,size,life,vel=new THREE.Vector3(0,1,0)){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(size,0),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));m.position.copy(pos);m.userData={vel:vel.clone(),life,maxLife:life};this.scene.add(m);this.particles.push(m);}
  sparkBurst(pos,count=12){for(let i=0;i<count;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,.5,0)),i%3?0xffb21a:0xffffff,.035+Math.random()*.055,.25+Math.random()*.55,new THREE.Vector3((Math.random()-.5)*12,2+Math.random()*7,(Math.random()-.5)*12));}
  bloodBurst(pos,count=18){for(let i=0;i<count;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,1,0)),i%3?0x8d0000:0xe01010,.06+Math.random()*.12,.45+Math.random()*.8,new THREE.Vector3((Math.random()-.5)*10,2+Math.random()*8,(Math.random()-.5)*10));const stain=new THREE.Mesh(new THREE.CircleGeometry(1+Math.random()*1.4,12),new THREE.MeshBasicMaterial({color:0x5b0000,transparent:true,opacity:.8,depthWrite:false}));stain.rotation.x=-Math.PI/2;stain.position.copy(pos);stain.position.y=.055;stain.scale.y=.55;this.scene.add(stain);}
  explosion(pos){for(let i=0;i<34;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,.8,0)),i%4===0?0x222222:(i%2?0xff561d:0xffd22e),.1+Math.random()*.36,.5+Math.random()*1.5,new THREE.Vector3((Math.random()-.5)*15,2+Math.random()*12,(Math.random()-.5)*15));const light=new THREE.PointLight(0xff4317,24,20);light.position.copy(pos).add(new THREE.Vector3(0,2,0));this.scene.add(light);setTimeout(()=>this.scene?.remove(light),180);this.shake=1;}
  makeTracer(from,to,color){const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),45);}
  makeLightning(from,to){const pts=[];for(let i=0;i<=8;i++){const p=from.clone().lerp(to,i/8);if(i>0&&i<8)p.add(new THREE.Vector3((Math.random()-.5)*1.2,1+(Math.random()-.5)*1.2,(Math.random()-.5)*1.2));pts.push(p);}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8feeff}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),110);}
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.userData.life-=dt;p.userData.vel.y-=2.5*dt;p.position.addScaledVector(p.userData.vel,dt);p.material.opacity=Math.max(0,p.userData.life/p.userData.maxLife);p.scale.addScalar(dt*.35);if(p.userData.life<=0){this.scene.remove(p);this.particles.splice(i,1);}}}

  keepInArena(){}
  resetPlayer(){if(this.ended)return;const nearest=this.waypoints.reduce((best,p,i)=>p.distanceTo(this.player.position)<this.waypoints[best].distanceTo(this.player.position)?i:best,0),point=this.waypoints[nearest],next=this.waypoints[(nearest+1)%this.waypoints.length],yaw=Math.atan2(next.x-point.x,next.z-point.z),body=this.player.userData.vehicle.body;body.setTranslation({x:point.x,y:1.3,z:point.z},true);body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);this.player.userData.speed=0;this.addEvent('Эвакуация: <strong>-5% корпуса</strong>');this.damageCar(this.player,this.player.userData.maxHealth*.05);}

  updateCamera(dt){
    if(!this.player)return;const speed=Math.abs(this.player.userData.speed);const offset=new THREE.Vector3(0,5.8+speed*.035,-10.5-speed*.08).applyQuaternion(this.player.quaternion),desired=this.player.position.clone().add(offset);if(this.shake>0){desired.x+=(Math.random()-.5)*this.shake;desired.y+=(Math.random()-.5)*this.shake;this.shake=Math.max(0,this.shake-dt*2.8);}this.camera.position.lerp(desired,1-Math.pow(.002,dt));const look=this.player.position.clone().add(new THREE.Vector3(0,1,0)).add(new THREE.Vector3(0,0,speed*.18).applyQuaternion(this.player.quaternion));this.camera.lookAt(look);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,62+Math.min(13,speed*.25),dt*3);this.camera.updateProjectionMatrix();
  }

  updateHUD(){
    const d=this.player.userData,remaining=this.opponents.filter(o=>!o.userData.dead).length;this.hud.querySelector('[data-lap]').textContent=`${Math.min(this.level.laps,this.lap+1)}/${this.level.laps}`;this.hud.querySelector('[data-enemies]').textContent=remaining;this.hud.querySelector('[data-kills]').textContent=`${this.kills}/${this.level.quota}`;this.hud.querySelector('[data-health]').textContent=Math.max(0,Math.round(d.health/d.maxHealth*100))+'%';this.hud.querySelector('[data-nitro]').textContent=Math.round(d.nitro)+'%';const sp=Math.round(Math.abs(d.speed)*3.6);this.hud.querySelector('[data-speed]').textContent=String(sp).padStart(3,'0');this.hud.querySelector('.speedo i').style.setProperty('--speed',Math.min(100,sp/2.5)+'%');this.hud.querySelector('[data-time]').textContent=formatTime(this.elapsed);
    const weapon=WEAPONS.find(w=>w.id===save.selectedWeapon),ready=this.elapsed-this.lastShot>=weapon.cooldown;this.hud.querySelector('[data-weapon]').textContent=weapon.id==='ram'?'RAM':ready?'READY':'WAIT';
    this.opponents.forEach((o,i)=>{const el=this.hud.querySelector(`[data-map-enemy="${i}"]`);if(!el)return;if(o.userData.dead){el.style.display='none';return;}el.style.left=(50+o.position.x/1.7)+'%';el.style.top=(50+o.position.z/1.4)+'%';});
  }
  addEvent(html){const e=document.createElement('div');e.className='event';e.innerHTML=html;this.feedEl?.prepend(e);setTimeout(()=>e.remove(),4400);while(this.feedEl?.children.length>5)this.feedEl.lastChild.remove();}

  togglePause(){if(this.ended)return;this.paused=!this.paused;if(this.paused){const m=document.createElement('div');m.className='pause-modal';m.innerHTML=`<div class="modal-card"><div class="eyebrow">СИСТЕМА // ПАУЗА</div><h2>Двигатель заглушен</h2><p>Город подождёт. Но недолго.</p><div class="modal-actions"><button class="action-btn" data-resume>Вернуться в бой</button><button class="ghost-btn" data-garage>В гараж</button><button class="ghost-btn" data-menu>Главное меню</button></div></div>`;this.hud.append(m);m.querySelector('[data-resume]').onclick=()=>this.togglePause();m.querySelector('[data-garage]').onclick=()=>{this.destroy();showGarage();};m.querySelector('[data-menu]').onclick=()=>{this.destroy();showMenu();};}else this.hud.querySelector('.pause-modal')?.remove();}

  finish(win,reason){
    if(this.ended)return;this.ended=true;const reward=win?this.level.reward+this.kills*45+this.wrecks*250:Math.floor(this.kills*25+this.wrecks*100);if(win){save.credits+=reward;save.unlockedLevel=Math.max(save.unlockedLevel,Math.min(LEVELS.length-1,this.level.id+1));const old=save.best[this.level.id];if(!old||this.elapsed<old)save.best[this.level.id]=this.elapsed;persist();}
    const modal=document.createElement('div');modal.className='result-modal';modal.innerHTML=`<div class="modal-card" style="border-top-color:${win?'var(--acid)':'var(--hot)'}"><div class="eyebrow">${win?'ЗАЕЗД ЗАВЕРШЁН':'СИСТЕМА УНИЧТОЖЕНА'}</div><h2>${reason}</h2><p>${win?'Корпорация подтвердила результат. Новый район открыт, награда переведена в гараж.':'Ничего, кроме дымящегося металла. Собери новую машину и попробуй ещё раз.'}</p><div class="result-stats"><div class="result-stat"><strong>${this.kills}</strong><small>ПЕШЕХОДЫ</small></div><div class="result-stat"><strong>${this.wrecks}</strong><small>МАШИНЫ</small></div><div class="result-stat"><strong>₡ ${money(reward)}</strong><small>НАГРАДА</small></div></div><div class="modal-actions"><button class="action-btn" data-next>${win&&this.level.id<4?'Следующий район':'Повторить заезд'}</button><button class="ghost-btn" data-garage>В гараж</button><button class="ghost-btn" data-menu>Главное меню</button></div></div>`;this.hud.append(modal);
    modal.querySelector('[data-next]').onclick=()=>{const id=win&&this.level.id<4?this.level.id+1:this.level.id;this.destroy();showBriefing(id);};modal.querySelector('[data-garage]').onclick=()=>{this.destroy();showGarage();};modal.querySelector('[data-menu]').onclick=()=>{this.destroy();showMenu();};
  }

  destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);removeEventListener('keydown',this.onKeyDown);removeEventListener('keyup',this.onKeyUp);removeEventListener('resize',this.onResize);this.eventQueue?.free();this.physics?.free();this.renderer?.dispose();this.renderer?.domElement.remove();this.hud?.remove();}
}

const _v1=new THREE.Vector3();
const _v2=new THREE.Vector3();
const _surfaceTextures=new Map();
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
