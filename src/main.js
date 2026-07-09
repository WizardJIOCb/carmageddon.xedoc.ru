import * as THREE from 'three';
import './styles.css';

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

function startGame(levelId){ app.innerHTML=''; game=new WreckrunGame(LEVELS[levelId]); }

class WreckrunGame {
  constructor(level){
    this.level=level; this.clock=new THREE.Clock(); this.keys={}; this.entities=[]; this.opponents=[]; this.pedestrians=[]; this.particles=[]; this.projectiles=[];
    this.elapsed=0;this.kills=0;this.wrecks=0;this.lap=0;this.checkpoint=0;this.ended=false;this.paused=false;this.lastShot=-10;this.shake=0;
    this.setupRenderer(); this.setupScene(); this.setupWorld(); this.setupActors(); this.setupUI(); this.bindEvents(); this.animate();
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
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:this.level.ground,roughness:.92,metalness:.08}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const grid=new THREE.GridHelper(260,130,new THREE.Color(this.level.accent).multiplyScalar(.25),new THREE.Color(0x252525));grid.position.y=.025;grid.material.opacity=.18;grid.material.transparent=true;this.scene.add(grid);
    this.waypoints=[[-55,-38],[0,-54],[55,-38],[66,0],[55,38],[0,54],[-55,38],[-66,0]].map(([x,z])=>new THREE.Vector3(x,0,z));
    this.buildTrack();this.buildCity();
    for(let i=0;i<18;i++){const x=(Math.random()-.5)*115,z=(Math.random()-.5)*80;if(Math.abs(x)<12&&Math.abs(z)<12)continue;this.makeObstacle(x,z);}
    for(let i=0;i<30;i++){const lamp=new THREE.PointLight(this.level.accent,7,12,2);const a=i/30*Math.PI*2;lamp.position.set(Math.cos(a)*71,2.7,Math.sin(a)*55);this.scene.add(lamp);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3),new THREE.MeshStandardMaterial({color:0x161816,metalness:.8}));pole.position.copy(lamp.position);pole.position.y=1.5;this.scene.add(pole);}
  }

  buildTrack(){
    const roadMat=new THREE.MeshStandardMaterial({color:0x151717,roughness:.82,metalness:.08});
    const outer=new THREE.Shape();outer.absellipse(0,0,78,62,0,Math.PI*2,false);const hole=new THREE.Path();hole.absellipse(0,0,47,31,0,Math.PI*2,true);outer.holes.push(hole);
    const road=new THREE.Mesh(new THREE.ShapeGeometry(outer,96),roadMat);road.rotation.x=-Math.PI/2;road.position.y=.045;road.receiveShadow=true;this.scene.add(road);
    const dashMat=new THREE.MeshBasicMaterial({color:0xd5b95a});
    for(let i=0;i<56;i++){const a=i/56*Math.PI*2;const dash=new THREE.Mesh(new THREE.BoxGeometry(3,.035,.18),dashMat);dash.position.set(Math.cos(a)*62,.08,Math.sin(a)*46);dash.rotation.y=-a;this.scene.add(dash);}
    this.checkpointMeshes=[];
    this.waypoints.forEach((p,i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(5.8,.16,6,24),new THREE.MeshBasicMaterial({color:i===0?this.level.accent:0x52605a,transparent:true,opacity:i===0?.85:.13}));ring.position.copy(p);ring.position.y=.25;ring.rotation.x=Math.PI/2;this.scene.add(ring);this.checkpointMeshes.push(ring);});
  }

  buildCity(){
    const rng=mulberry32(777+this.level.id*313);
    for(let i=0;i<75;i++){
      const a=rng()*Math.PI*2, radius=88+rng()*38,w=5+rng()*12,d=5+rng()*12,h=5+rng()*32;
      const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.08+rng()*.08,.06,.09+rng()*.1),roughness:.75,metalness:.22});
      const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);b.position.set(Math.cos(a)*radius,h/2-1,Math.sin(a)*radius);b.rotation.y=rng()*.3;b.castShadow=b.receiveShadow=true;this.scene.add(b);
      if(i%3===0){const sign=new THREE.Mesh(new THREE.PlaneGeometry(w*.65,1.1),new THREE.MeshBasicMaterial({color:this.level.accent}));sign.position.copy(b.position);sign.position.y=Math.min(h-1,3+rng()*h*.5);sign.position.x-=Math.cos(a)*d*.51;sign.position.z-=Math.sin(a)*d*.51;sign.lookAt(0,sign.position.y,0);this.scene.add(sign);}
    }
    if(this.level.id===1) for(let i=0;i<22;i++){const box=new THREE.Mesh(new THREE.BoxGeometry(6,2.7,2.5),new THREE.MeshStandardMaterial({color:[0x174e69,0xa3311f,0x435240][i%3],metalness:.65,roughness:.45}));box.position.set((i%6-3)*8,1.35,(Math.floor(i/6)-1.5)*7);box.castShadow=true;this.scene.add(box);}
  }

  makeObstacle(x,z){
    const type=Math.random();let mesh;
    if(type<.55) mesh=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*3,.7,1+Math.random()*2),new THREE.MeshStandardMaterial({color:0x4d4b43,roughness:.8}));
    else mesh=new THREE.Mesh(new THREE.CylinderGeometry(.55,.7,1.3,10),new THREE.MeshStandardMaterial({color:type>.8?0xbb351d:0x777064,metalness:.5,roughness:.55}));
    mesh.position.set(x,(mesh.geometry.parameters.height || 1) * .5,z);mesh.rotation.y=Math.random()*Math.PI;mesh.castShadow=true;this.scene.add(mesh);
  }

  setupActors(){
    const car=currentCar(),up=upgrades();
    this.player=this.createCar(save.color,car.shape,true);this.player.position.copy(this.waypoints[0]).add(new THREE.Vector3(0,.55,4));this.player.rotation.y=Math.PI/2;
    Object.assign(this.player.userData,{speed:0,health:Math.round((100+up.armor*18)*car.armor),maxHealth:Math.round((100+up.armor*18)*car.armor),maxSpeed:24*car.speed+up.engine*1.9,accel:19+up.engine*1.3,handling:2.05*car.handling+up.handling*.12,nitro:100,dead:false});
    this.scene.add(this.player);
    const aiColors=[0xff3b20,0x4090ff,0xf4d13b,0xb63aff,0xffffff,0x2fcf83,0xff6bc2,0x777777];
    for(let i=0;i<this.level.enemies;i++){
      const base=CARS[(i+this.level.id+1)%CARS.length];const ai=this.createCar(aiColors[i%aiColors.length],base.shape,false);ai.position.copy(this.waypoints[0]).add(new THREE.Vector3(-i*3.2,.55,-2-(i%2)*3));ai.rotation.y=Math.PI/2;
      Object.assign(ai.userData,{speed:0,health:70+this.level.id*14+base.armor*25,maxHealth:70+this.level.id*14+base.armor*25,maxSpeed:16+Math.random()*4+this.level.id*1.3,handling:1.45+Math.random()*.45,target:(i+1)%this.waypoints.length,aggression:.25+Math.random()*.7,dead:false,name:['Crusher','Widow','Butcher','Chrome Jack','Hex','Mortis','Road Wolf','Buzzard'][i]});
      this.scene.add(ai);this.opponents.push(ai);
    }
    for(let i=0;i<this.level.peds;i++){const a=Math.random()*Math.PI*2,r=20+Math.random()*48;const ped=this.createPedestrian(i);ped.position.set(Math.cos(a)*r,.05,Math.sin(a)*r);this.scene.add(ped);this.pedestrians.push(ped);}
  }

  createCar(color,shape,isPlayer){
    const g=new THREE.Group();g.userData.wheels=[];const dark=new THREE.MeshStandardMaterial({color:0x111312,roughness:.55,metalness:.65});
    const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.58});
    const dims=shape==='truck'?[2.45,.72,4.9]:shape==='buggy'?[2.25,.5,3.7]:shape==='hearse'?[2.3,.68,5.2]:[2.2,.62,4.25];
    const body=new THREE.Mesh(new THREE.BoxGeometry(...dims),bodyMat);body.position.y=.52;body.castShadow=true;g.add(body);g.userData.body=body;
    const hood=new THREE.Mesh(new THREE.BoxGeometry(dims[0]*.92,.28,dims[2]*.36),bodyMat);hood.position.set(0,.85,-dims[2]*.3);hood.rotation.x=-.04;hood.castShadow=true;g.add(hood);
    if(shape!=='buggy'){const cabinGeo=shape==='sport'?new THREE.BoxGeometry(1.72,.6,1.65):new THREE.BoxGeometry(1.85,.82,2.05);const cabin=new THREE.Mesh(cabinGeo,new THREE.MeshStandardMaterial({color:0x182124,roughness:.22,metalness:.5}));cabin.position.set(0,1.05,shape==='hearse'?.45:.25);cabin.rotation.x=shape==='sport'?-.08:0;g.add(cabin);}
    else {const cage=new THREE.Mesh(new THREE.TorusGeometry(1,.08,6,12,Math.PI),dark);cage.position.set(0,1.05,.15);cage.rotation.set(0,Math.PI/2,Math.PI/2);g.add(cage);}
    for(const x of [-1,1]) for(const z of [-1.45,1.45]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.38,14),dark);w.rotation.z=Math.PI/2;w.position.set(x*dims[0]*.47,.42,z*dims[2]/4.25);w.castShadow=true;g.add(w);g.userData.wheels.push(w);}
    const bumper=new THREE.Mesh(new THREE.BoxGeometry(dims[0]*1.06,.25,.26),dark);bumper.position.set(0,.43,-dims[2]*.53);g.add(bumper);
    const lightMat=new THREE.MeshBasicMaterial({color:isPlayer?0xe9ffb5:0xff4422});for(const x of [-.67,.67]){const l=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.05),lightMat);l.position.set(x,.69,-dims[2]*.51);g.add(l);}
    if((isPlayer&&save.selectedWeapon!=='ram')||!isPlayer){const gun=new THREE.Group();const mount=new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,.18,10),dark);gun.add(mount);for(const x of [-.2,.2]){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.25,8),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(x,.18,-.55);gun.add(barrel);}gun.position.set(0,shape==='truck'?1.55:1.48,.1);g.add(gun);g.userData.gun=gun;}
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(dims[0]*1.35,dims[2]*1.18),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;g.add(shadow);
    return g;
  }

  createPedestrian(i){
    const g=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:[0xd99a78,0x8a5a42,0xf0bd91][i%3]}),cloth=new THREE.MeshStandardMaterial({color:[0xbab599,0x1e6b72,0x863328,0x41404d][i%4]});
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.62,3,7),cloth);torso.position.y=1.12;g.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),skin);head.position.y=1.78;g.add(head);
    for(const x of [-.14,.14]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.08,.62,2,6),new THREE.MeshStandardMaterial({color:0x25292a}));leg.position.set(x,.43,0);g.add(leg);}
    for(const x of [-.34,.34]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.065,.5,2,6),skin);arm.position.set(x,1.18,0);arm.rotation.z=x>0?-.25:.25;g.add(arm);}
    g.scale.setScalar(.82+Math.random()*.22);g.userData={dead:false,panic:0,phase:Math.random()*10,parts:[...g.children]};g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});return g;
  }

  setupUI(){
    const weapon=WEAPONS.find(w=>w.id===save.selectedWeapon);
    this.hud=document.createElement('div');this.hud.className='screen hud';this.hud.innerHTML=`<div class="boost-lines"></div><div class="damage-flash"></div><div class="hud-top"><div class="race-objective"><small>Три пути к победе</small><strong>Круг <span data-lap>1/${this.level.laps}</span> · Враги <span data-enemies>${this.opponents.length}</span> · Квота <span data-kills>0/${this.level.quota}</span></strong></div><div class="timer"><small>${this.level.name} // ${this.level.weather}</small><span data-time>00:00.000</span></div></div><div class="minimap"><i class="map-player"></i>${this.opponents.map((_,i)=>`<i class="map-enemy" data-map-enemy="${i}"></i>`).join('')}</div><div class="event-feed"></div><div class="crosshair"></div><div class="hud-bottom"><div class="car-vitals"><div class="vital health"><span class="hud-label">Корпус</span><strong data-health>100%</strong></div><div class="vital nitro"><span class="hud-label">Нитро</span><strong data-nitro>100%</strong></div><div class="vital weapon"><span class="hud-label">Оружие</span><strong data-weapon>${weapon.id==='ram'?'RAM':'READY'}</strong></div></div><div class="controls-hint"><b>WASD</b> движение · <b>SPACE</b> огонь · <b>SHIFT</b> нитро · <b>ESC</b> пауза</div><div class="speedo"><strong data-speed>000</strong><span>KM/H</span><i style="--speed:0%"></i></div></div>`;app.append(this.hud);
    this.feedEl=this.hud.querySelector('.event-feed');this.addEvent('Двигатели запущены. <strong>УНИЧТОЖАЙ.</strong>');
  }

  bindEvents(){
    this.onKeyDown=e=>{this.keys[e.code]=true;if(e.code==='Escape')this.togglePause();if(e.code==='KeyR')this.resetPlayer();};
    this.onKeyUp=e=>{this.keys[e.code]=false;};this.onResize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);};
    addEventListener('keydown',this.onKeyDown);addEventListener('keyup',this.onKeyUp);addEventListener('resize',this.onResize);
  }

  animate=()=>{if(this.destroyed)return;this.raf=requestAnimationFrame(this.animate);let dt=Math.min(this.clock.getDelta(),.034);if(!this.paused&&!this.ended){this.elapsed+=dt;this.updatePlayer(dt);this.updateAI(dt);this.updatePedestrians(dt);this.updateProjectiles(dt);this.updateParticles(dt);this.checkRules();this.updateHUD();}this.updateCamera(dt);this.renderer.render(this.scene,this.camera);};

  updatePlayer(dt){
    const d=this.player.userData;if(d.dead)return;const forward=this.keys.KeyW||this.keys.ArrowUp,reverse=this.keys.KeyS||this.keys.ArrowDown,left=this.keys.KeyA||this.keys.ArrowLeft,right=this.keys.KeyD||this.keys.ArrowRight;
    if(forward)d.speed+=d.accel*dt;else if(reverse)d.speed-=d.accel*.72*dt;else d.speed*=Math.pow(.34,dt);
    const boosting=(this.keys.ShiftLeft||this.keys.ShiftRight)&&forward&&d.nitro>0;const max=boosting?d.maxSpeed*1.42:d.maxSpeed;if(boosting){d.speed+=28*dt;d.nitro=Math.max(0,d.nitro-23*dt);this.emitExhaust(this.player,0x62dfff);this.hud.querySelector('.boost-lines').classList.add('on');}else{d.nitro=Math.min(100,d.nitro+4.8*dt);this.hud.querySelector('.boost-lines').classList.remove('on');}
    d.speed=THREE.MathUtils.clamp(d.speed,-d.maxSpeed*.42,max);const steer=(left?1:0)-(right?1:0);const turnFactor=Math.min(1,Math.abs(d.speed)/8);this.player.rotation.y+=steer*d.handling*turnFactor*dt*Math.sign(d.speed||1);
    const forwardVec=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.quaternion);this.player.position.addScaledVector(forwardVec,d.speed*dt);this.keepInArena(this.player);
    this.player.userData.wheels.forEach(w=>w.rotation.x-=d.speed*dt*1.7);if(Math.abs(steer)>.2&&Math.abs(d.speed)>12&&Math.random()<.3)this.emitSmoke(this.player,0x777777,.16);
    if(this.keys.Space)this.fireWeapon();this.collideCars();this.hitPedestrians();this.checkCheckpoint();
    if(d.health<d.maxHealth*.42&&Math.random()<dt*5)this.emitSmoke(this.player,d.health<d.maxHealth*.2?0x171717:0x555555,.5);
  }

  updateAI(dt){
    for(const ai of this.opponents){const d=ai.userData;if(d.dead)continue;let target=this.waypoints[d.target];
      if(d.aggression>.72&&ai.position.distanceTo(this.player.position)<25)target=this.player.position;
      const desired=Math.atan2(-(target.x-ai.position.x),-(target.z-ai.position.z));let diff=angleDelta(ai.rotation.y,desired);ai.rotation.y+=THREE.MathUtils.clamp(diff,-d.handling*dt,d.handling*dt);d.speed=THREE.MathUtils.lerp(d.speed,d.maxSpeed,dt*.7);
      const f=new THREE.Vector3(0,0,-1).applyQuaternion(ai.quaternion);ai.position.addScaledVector(f,d.speed*dt);this.keepInArena(ai);ai.userData.wheels.forEach(w=>w.rotation.x-=d.speed*dt*1.7);
      if(ai.position.distanceTo(this.waypoints[d.target])<10)d.target=(d.target+1)%this.waypoints.length;
      if(d.health<d.maxHealth*.4&&Math.random()<dt*4)this.emitSmoke(ai,0x222222,.45);
      if(Math.random()<dt*.12&&ai.position.distanceTo(this.player.position)<22)this.damageCar(this.player,4+this.level.id,ai);
    }
  }

  updatePedestrians(dt){
    for(const p of this.pedestrians){if(p.userData.dead){this.updateRagdoll(p,dt);continue;}const dist=p.position.distanceTo(this.player.position);p.userData.phase+=dt*(dist<15?9:3);if(dist<18){const away=p.position.clone().sub(this.player.position).setY(0).normalize();p.position.addScaledVector(away,dt*(dist<8?7:3));p.rotation.y=Math.atan2(away.x,away.z);}
      p.children[2].rotation.x=Math.sin(p.userData.phase)*.4;p.children[3].rotation.x=-Math.sin(p.userData.phase)*.4;p.children[4].rotation.x=-Math.sin(p.userData.phase)*.4;p.children[5].rotation.x=Math.sin(p.userData.phase)*.4;
    }
  }

  updateRagdoll(p,dt){
    for(const part of p.userData.parts){if(!part.userData.vel)continue;part.userData.vel.y-=14*dt;part.position.addScaledVector(part.userData.vel,dt);part.rotation.x+=part.userData.spin.x*dt;part.rotation.z+=part.userData.spin.z*dt;if(part.getWorldPosition(_v1).y<.12){part.userData.vel.y=Math.abs(part.userData.vel.y)*.24;part.userData.vel.x*=.78;part.userData.vel.z*=.78;}}
  }

  hitPedestrians(){
    if(Math.abs(this.player.userData.speed)<4)return;
    for(const p of this.pedestrians){if(p.userData.dead||p.position.distanceTo(this.player.position)>2.2)continue;p.userData.dead=true;this.kills++;const f=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.quaternion);
      p.userData.parts.forEach((part,i)=>{part.userData.vel=f.clone().multiplyScalar(7+Math.abs(this.player.userData.speed)*.45+Math.random()*5);part.userData.vel.y=5+Math.random()*7;part.userData.vel.x+=(Math.random()-.5)*5;part.userData.spin=new THREE.Vector3(Math.random()*8,0,(Math.random()-.5)*10);});
      this.bloodBurst(p.position,22);this.player.userData.speed*=.88;this.addEvent(`<strong>РАЗМАЗАН!</strong> Квота ${this.kills}/${this.level.quota}`);this.shake=.45;
    }
  }

  collideCars(){
    for(const ai of this.opponents){if(ai.userData.dead)continue;const dist=ai.position.distanceTo(this.player.position);if(dist>2.8)continue;const rel=Math.abs(this.player.userData.speed-ai.userData.speed);if(rel<2)continue;const f=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.quaternion);const to=ai.position.clone().sub(this.player.position).normalize();const frontal=Math.max(0,f.dot(to));let dealt=rel*(save.selectedWeapon==='ram'?1.35:0.65)*frontal+3;this.damageCar(ai,dealt,this.player);this.damageCar(this.player,rel*.22*(1-frontal*.45),ai);ai.position.addScaledVector(to,1.2);this.player.position.addScaledVector(to,-.5);this.player.userData.speed*=-.25;ai.userData.speed*=.3;this.sparkBurst(ai.position,18);this.shake=Math.min(1,rel/18);}
  }

  damageCar(car,amount,source){
    const d=car.userData;if(d.dead)return;d.health-=amount;d.body.material.roughness=Math.min(.95,d.body.material.roughness+amount*.004);d.body.scale.x=Math.max(.78,d.body.scale.x-amount*.0015);
    if(car===this.player){this.hud.querySelector('.damage-flash').classList.add('on');setTimeout(()=>this.hud?.querySelector('.damage-flash')?.classList.remove('on'),90);}
    if(d.health<=0){d.dead=true;d.speed=0;this.explosion(car.position);if(car===this.player)this.finish(false,'МАШИНА УНИЧТОЖЕНА');else{this.wrecks++;this.addEvent(`<strong>${d.name || 'ПРОТИВНИК'} УНИЧТОЖЕН</strong>`);car.rotation.z=.85;}}
  }

  fireWeapon(){
    const w=WEAPONS.find(x=>x.id===save.selectedWeapon);if(w.id==='ram')return;if(this.elapsed-this.lastShot<w.cooldown)return;this.lastShot=this.elapsed;
    if(w.id==='minigun'){
      const targets=this.targetsAhead(34,.5);const origin=this.player.position.clone().add(new THREE.Vector3(0,1.5,0));const target=targets[0]?.position.clone().add(new THREE.Vector3(0,.6,0))||origin.clone().add(new THREE.Vector3(0,0,-35).applyQuaternion(this.player.quaternion));this.makeTracer(origin,target,0xffe369);if(targets[0])this.damageCar(targets[0],5.5,this.player);this.sparkBurst(target,5);this.player.userData.speed-=.03;
    } else if(w.id==='rockets'){
      const rocket=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.65,8),new THREE.MeshBasicMaterial({color:0xff5a19}));rocket.rotation.x=Math.PI/2;rocket.position.copy(this.player.position).add(new THREE.Vector3(0,1.45,-1.5).applyQuaternion(this.player.quaternion));rocket.quaternion.copy(this.player.quaternion);rocket.userData={vel:new THREE.Vector3(0,0,-34).applyQuaternion(this.player.quaternion),life:2};this.scene.add(rocket);this.projectiles.push(rocket);
    } else {
      const targets=this.targetsAhead(22,-.2).slice(0,3);targets.forEach((t,i)=>{this.makeLightning(this.player.position,t.position);this.damageCar(t,20-i*5,this.player);});if(targets.length)this.addEvent('<strong>ЦЕПНОЙ РАЗРЯД</strong>');
    }
  }

  targetsAhead(range,dotMin){const f=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.quaternion);return this.opponents.filter(o=>!o.userData.dead&&o.position.distanceTo(this.player.position)<range&&f.dot(o.position.clone().sub(this.player.position).normalize())>dotMin).sort((a,b)=>a.position.distanceTo(this.player.position)-b.position.distanceTo(this.player.position));}

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){const r=this.projectiles[i];r.position.addScaledVector(r.userData.vel,dt);r.userData.life-=dt;this.emitParticle(r.position,0xff6b16,.16,.3);let hit=this.opponents.find(o=>!o.userData.dead&&o.position.distanceTo(r.position)<2.4);if(hit||r.userData.life<0){this.explosion(r.position);for(const o of this.opponents)if(!o.userData.dead&&o.position.distanceTo(r.position)<9)this.damageCar(o,THREE.MathUtils.mapLinear(o.position.distanceTo(r.position),0,9,42,6),this.player);this.scene.remove(r);this.projectiles.splice(i,1);}}
  }

  checkCheckpoint(){
    if(this.player.position.distanceTo(this.waypoints[this.checkpoint])<10){this.checkpointMeshes[this.checkpoint].material.opacity=.13;this.checkpoint=(this.checkpoint+1)%this.waypoints.length;this.checkpointMeshes[this.checkpoint].material.opacity=.85;if(this.checkpoint===0){this.lap++;this.addEvent(`<strong>КРУГ ${this.lap}/${this.level.laps}</strong>`);}}
  }
  checkRules(){if(this.lap>=this.level.laps)this.finish(true,'ГОНКА ЗАВЕРШЕНА');else if(this.wrecks>=this.level.enemies)this.finish(true,'ВСЕ СОПЕРНИКИ УНИЧТОЖЕНЫ');else if(this.kills>=this.level.quota)this.finish(true,'КВОТА ВЫПОЛНЕНА');}

  emitSmoke(car,color=0x333333,size=.4){const pos=car.position.clone().add(new THREE.Vector3((Math.random()-.5),1.1,(Math.random()-.5)));this.emitParticle(pos,color,size,1.4,new THREE.Vector3((Math.random()-.5)*.7,1.5+Math.random(),(Math.random()-.5)*.7));}
  emitExhaust(car,color){const p=car.position.clone().add(new THREE.Vector3(0,.45,2.2).applyQuaternion(car.quaternion));this.emitParticle(p,color,.18,.35,new THREE.Vector3((Math.random()-.5),.2,4).applyQuaternion(car.quaternion));}
  emitParticle(pos,color,size,life,vel=new THREE.Vector3(0,1,0)){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(size,0),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));m.position.copy(pos);m.userData={vel:vel.clone(),life,maxLife:life};this.scene.add(m);this.particles.push(m);}
  sparkBurst(pos,count=12){for(let i=0;i<count;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,.5,0)),i%3?0xffb21a:0xffffff,.035+Math.random()*.055,.25+Math.random()*.55,new THREE.Vector3((Math.random()-.5)*12,2+Math.random()*7,(Math.random()-.5)*12));}
  bloodBurst(pos,count=18){for(let i=0;i<count;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,1,0)),i%3?0x8d0000:0xe01010,.06+Math.random()*.12,.45+Math.random()*.8,new THREE.Vector3((Math.random()-.5)*10,2+Math.random()*8,(Math.random()-.5)*10));const stain=new THREE.Mesh(new THREE.CircleGeometry(1+Math.random()*1.4,12),new THREE.MeshBasicMaterial({color:0x5b0000,transparent:true,opacity:.8,depthWrite:false}));stain.rotation.x=-Math.PI/2;stain.position.copy(pos);stain.position.y=.055;stain.scale.y=.55;this.scene.add(stain);}
  explosion(pos){for(let i=0;i<34;i++)this.emitParticle(pos.clone().add(new THREE.Vector3(0,.8,0)),i%4===0?0x222222:(i%2?0xff561d:0xffd22e),.1+Math.random()*.36,.5+Math.random()*1.5,new THREE.Vector3((Math.random()-.5)*15,2+Math.random()*12,(Math.random()-.5)*15));const light=new THREE.PointLight(0xff4317,24,20);light.position.copy(pos).add(new THREE.Vector3(0,2,0));this.scene.add(light);setTimeout(()=>this.scene?.remove(light),180);this.shake=1;}
  makeTracer(from,to,color){const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),45);}
  makeLightning(from,to){const pts=[];for(let i=0;i<=8;i++){const p=from.clone().lerp(to,i/8);if(i>0&&i<8)p.add(new THREE.Vector3((Math.random()-.5)*1.2,1+(Math.random()-.5)*1.2,(Math.random()-.5)*1.2));pts.push(p);}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8feeff}));this.scene.add(line);setTimeout(()=>this.scene?.remove(line),110);}
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.userData.life-=dt;p.userData.vel.y-=2.5*dt;p.position.addScaledVector(p.userData.vel,dt);p.material.opacity=Math.max(0,p.userData.life/p.userData.maxLife);p.scale.addScalar(dt*.35);if(p.userData.life<=0){this.scene.remove(p);this.particles.splice(i,1);}}}

  keepInArena(car){const x=car.position.x,z=car.position.z;if(Math.abs(x)>82){car.position.x=Math.sign(x)*82;car.userData.speed*=-.35;}if(Math.abs(z)>67){car.position.z=Math.sign(z)*67;car.userData.speed*=-.35;}}
  resetPlayer(){if(this.ended)return;const nearest=this.waypoints.reduce((best,p,i)=>p.distanceTo(this.player.position)<this.waypoints[best].distanceTo(this.player.position)?i:best,0);this.player.position.copy(this.waypoints[nearest]).add(new THREE.Vector3(0,.55,0));this.player.rotation.set(0,-Math.atan2(this.waypoints[(nearest+1)%8].x-this.player.position.x,this.waypoints[(nearest+1)%8].z-this.player.position.z),0);this.player.userData.speed=0;this.addEvent('Эвакуация: <strong>-5% корпуса</strong>');this.damageCar(this.player,this.player.userData.maxHealth*.05);}

  updateCamera(dt){
    if(!this.player)return;const speed=Math.abs(this.player.userData.speed);const offset=new THREE.Vector3(0,5.8+speed*.035,10.5+speed*.08).applyQuaternion(this.player.quaternion);const desired=this.player.position.clone().add(offset);if(this.shake>0){desired.x+=(Math.random()-.5)*this.shake;desired.y+=(Math.random()-.5)*this.shake;this.shake=Math.max(0,this.shake-dt*2.8);}this.camera.position.lerp(desired,1-Math.pow(.002,dt));const look=this.player.position.clone().add(new THREE.Vector3(0,1,0)).add(new THREE.Vector3(0,0,-speed*.18).applyQuaternion(this.player.quaternion));this.camera.lookAt(look);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,62+Math.min(13,speed*.25),dt*3);this.camera.updateProjectionMatrix();
  }

  updateHUD(){
    const d=this.player.userData,remaining=this.opponents.filter(o=>!o.userData.dead).length;this.hud.querySelector('[data-lap]').textContent=`${Math.min(this.level.laps,this.lap+1)}/${this.level.laps}`;this.hud.querySelector('[data-enemies]').textContent=remaining;this.hud.querySelector('[data-kills]').textContent=`${this.kills}/${this.level.quota}`;this.hud.querySelector('[data-health]').textContent=Math.max(0,Math.round(d.health/d.maxHealth*100))+'%';this.hud.querySelector('[data-nitro]').textContent=Math.round(d.nitro)+'%';const sp=Math.round(Math.abs(d.speed)*8);this.hud.querySelector('[data-speed]').textContent=String(sp).padStart(3,'0');this.hud.querySelector('.speedo i').style.setProperty('--speed',Math.min(100,sp/3.2)+'%');this.hud.querySelector('[data-time]').textContent=formatTime(this.elapsed);
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

  destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);removeEventListener('keydown',this.onKeyDown);removeEventListener('keyup',this.onKeyUp);removeEventListener('resize',this.onResize);this.renderer?.dispose();this.renderer?.domElement.remove();this.hud?.remove();}
}

const _v1=new THREE.Vector3();
function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
function formatTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*1000);return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

showMenu();
