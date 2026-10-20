'use strict';
/* ============================================================
   DEMON'S BLOOD — game engine, Level I: The Bleeding Road
   ============================================================ */

/* ---------------- constants ---------------- */
const W = 1152, H = 640, TILE = 64, COLS = 18, ROWS = 10;
const WAVE_BREAK = 24;
const WAVE_LEAD = 3;
const START_GOLD = 220, START_LIVES = 20;

const PATH_COOR = [
  [0, 1], [6, 1], [6, 4], [2, 4], [2, 7],
  [11, 7], [11, 3], [15, 3], [15, 8], [17, 8]
];

const PATH_SET = new Set();
for (let i = 0; i < PATH_COOR.length - 1; i++) {
  let [x, y] = PATH_COOR[i];
  const [x2, y2] = PATH_COOR[i + 1];
  const dx = Math.sign(x2 - x), dy = Math.sign(y2 - y);
  PATH_SET.add(x + ',' + y);
  while (x !== x2 || y !== y2) { x += dx; y += dy; PATH_SET.add(x + ',' + y); }
}

const WAYPOINTS = [{ x: -56, y: 96 }]
  .concat(PATH_COOR.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })))
  .concat([{ x: W + 56, y: 544 }]);

const SEG = [], CUM = [0];
for (let i = 1; i < WAYPOINTS.length; i++) {
  const a = WAYPOINTS[i - 1], b = WAYPOINTS[i];
  SEG.push(Math.hypot(b.x - a.x, b.y - a.y));
  CUM.push(CUM[i - 1] + SEG[i - 1]);
}

const SPAWN_PT = WAYPOINTS[1];
const EXIT_PT = WAYPOINTS[WAYPOINTS.length - 1];
const RIFT = { x: 4, y: 96 };
const PORTAL = { x: 1146, y: 544 };

const DECOR = [
  { tx: 0, ty: 0, kind: 'pillar' }, { tx: 1, ty: 0, kind: 'rock' },
  { tx: 4, ty: 0, kind: 'crystal_red' }, { tx: 8, ty: 0, kind: 'tree' },
  { tx: 10, ty: 0, kind: 'bones' }, { tx: 13, ty: 0, kind: 'rock' },
  { tx: 16, ty: 0, kind: 'crystal_purple' }, { tx: 17, ty: 0, kind: 'pillar' },
  { tx: 0, ty: 3, kind: 'tree' }, { tx: 0, ty: 6, kind: 'rock' },
  { tx: 0, ty: 8, kind: 'crystal_red' }, { tx: 0, ty: 9, kind: 'pool' },
  { tx: 1, ty: 9, kind: 'bones' }, { tx: 3, ty: 9, kind: 'rock' },
  { tx: 5, ty: 9, kind: 'tree' }, { tx: 7, ty: 9, kind: 'pool' },
  { tx: 9, ty: 9, kind: 'skulls' }, { tx: 12, ty: 9, kind: 'crystal_purple' },
  { tx: 14, ty: 9, kind: 'rock' }, { tx: 16, ty: 9, kind: 'bones' },
  { tx: 17, ty: 9, kind: 'pillar' }, { tx: 8, ty: 5, kind: 'rock' },
  { tx: 13, ty: 6, kind: 'tree' }, { tx: 17, ty: 4, kind: 'crystal_red' },
  { tx: 4, ty: 6, kind: 'skulls' }
];
const BLOCKED = new Set(DECOR.map(d => d.tx + ',' + d.ty));

const ENEMY_DEFS = {
  imp:      { name: 'Imp',              hp: 46,   speed: 88,  bounty: 9,   radius: 14, barW: 30, barH: 36 },
  ghoul:    { name: 'Ghoul',            hp: 135,  speed: 62,  bounty: 13,  radius: 16, barW: 36, barH: 46 },
  wraith:   { name: 'Wraith',           hp: 85,   speed: 104, bounty: 16,  radius: 15, barW: 34, barH: 52 },
  colossus: { name: 'Bone Colossus',    hp: 720,  speed: 34,  bounty: 46,  radius: 26, barW: 54, barH: 72, clampHalf: 42 },
  warden:   { name: 'The Blood Warden', hp: 6300, speed: 30,  bounty: 260, radius: 28, barW: 62, barH: 92, boss: true, lifeCost: 5, clampHalf: 80 }
};

const TOWER_DEFS = {
  blood: {
    name: 'Blood Spire', cost: 50, color: '#e04552', proj: 'blood',
    desc: 'Barbed blood shards strike the foe closest to the portal.',
    levels: [
      { dmg: 15, range: 150, rate: 0.62 },
      { up: 70,  dmg: 28, range: 162, rate: 0.56 },
      { up: 115, dmg: 52, range: 178, rate: 0.50 }
    ]
  },
  frost: {
    name: 'Frost Shrine', cost: 65, color: '#6fd6ff', proj: 'frost',
    desc: 'Rime slows the horde while shards chip at flesh.',
    levels: [
      { dmg: 7,  range: 135, rate: 1.0, slow: 0.45, slowDur: 1.6 },
      { up: 85,  dmg: 12, range: 146, rate: 0.9, slow: 0.55, slowDur: 2.1 },
      { up: 130, dmg: 20, range: 160, rate: 0.8, slow: 0.65, slowDur: 2.6 }
    ]
  },
  doom: {
    name: 'Doom Spire', cost: 90, color: '#b06bff', proj: 'doom',
    desc: 'Violet hellfire detonates among clustered enemies.',
    levels: [
      { dmg: 24, range: 165, rate: 1.45, splash: 72 },
      { up: 105, dmg: 44, range: 176, rate: 1.35, splash: 84 },
      { up: 160, dmg: 80, range: 190, rate: 1.25, splash: 98 }
    ]
  },
  soul: {
    name: 'Soul Altar', cost: 75, color: '#5ce08a', proj: 'soul',
    desc: 'Long reach. Poison siphons life over several seconds.',
    levels: [
      { dmg: 10, range: 195, rate: 1.05, poisonDps: 9,  poisonDur: 3.0 },
      { up: 95,  dmg: 17, range: 210, rate: 0.95, poisonDps: 16, poisonDur: 3.5 },
      { up: 150, dmg: 30, range: 230, rate: 0.85, poisonDps: 28, poisonDur: 4.0 }
    ]
  }
};

const PROJ_SPEED = { blood: 540, frost: 470, doom: 380, soul: 430 };

const WAVES = [
  { name: 'Scouting Imps',      groups: [ { type: 'imp', count: 8, interval: 0.9, delay: 0 } ] },
  { name: 'Rotting Advance',    groups: [ { type: 'imp', count: 6, interval: 0.7, delay: 0 }, { type: 'ghoul', count: 4, interval: 1.4, delay: 4 } ] },
  { name: 'Bone Patrol',        groups: [ { type: 'ghoul', count: 8, interval: 1.1, delay: 0 }, { type: 'imp', count: 4, interval: 0.6, delay: 7 } ] },
  { name: 'Swift Hellions',     groups: [ { type: 'imp', count: 14, interval: 0.45, delay: 0 }, { type: 'wraith', count: 4, interval: 1.6, delay: 5 } ] },
  { name: 'The Iron Revenant',  groups: [ { type: 'colossus', count: 1, interval: 1, delay: 0 }, { type: 'ghoul', count: 8, interval: 1.0, delay: 2 } ] },
  { name: 'Wraith Swarm',       groups: [ { type: 'wraith', count: 10, interval: 0.9, delay: 0 }, { type: 'imp', count: 8, interval: 0.5, delay: 6 } ] },
  { name: 'Unholy Legion',      groups: [ { type: 'ghoul', count: 12, interval: 0.8, delay: 0 }, { type: 'colossus', count: 2, interval: 6, delay: 6 } ] },
  { name: 'Blood Rush',         groups: [ { type: 'imp', count: 20, interval: 0.3, delay: 0 }, { type: 'wraith', count: 6, interval: 1.2, delay: 6 } ] },
  { name: 'Siege of Bones',     groups: [ { type: 'colossus', count: 4, interval: 4, delay: 0 }, { type: 'ghoul', count: 10, interval: 0.9, delay: 3 } ] },
  { name: 'The Blood Warden',   groups: [ { type: 'warden', count: 1, interval: 1, delay: 0 }, { type: 'wraith', count: 8, interval: 1.4, delay: 4 }, { type: 'colossus', count: 3, interval: 5, delay: 9 } ] }
];

/* ---------------- state ---------------- */
let canvas, ctx, stage;
let state = 'title';           // title | playing | victory | defeat
let paused = false;
let speed = 1;
let gold, lives, waveIndex, waveActive, spawnQueue, waveTimer, countdown;
let barPos, spawnClock, repelledUpTo;
let enemies = [], towers = [], projectiles = [], particles = [], texts = [], decals = [], embers = [];
let bossRef = null;
let kills = 0, goldEarned = 0, timePlayed = 0;
let shake = 0;
let selectedType = null, selectedTower = null, selectedEnemy = null;
let mouse = { x: -99, y: -99, tx: -1, ty: -1, inside: false };
let bgCanvas = null;
let visualT = 0;
let hudCache = {};
let waveBtnSecond = -1;

const $ = id => document.getElementById(id);

/* ============================================================
   INIT
   ============================================================ */
function init() {
  stage = $('stage');
  canvas = $('game');
  ctx = canvas.getContext('2d');

  bgCanvas = Sprites.buildBackground({
    w: W, h: H, tile: TILE, waypoints: WAYPOINTS, decor: DECOR
  });

  document.querySelectorAll('.tower-card').forEach(card => {
    const type = card.dataset.type;
    Sprites.drawTowerIcon(card.querySelector('canvas'), type);
    card.addEventListener('click', () => {
      if (state !== 'playing') return;
      if (selectedType === type) selectedType = null;
      else { selectedType = type; selectTowerAt(-1, -1); }
      updateCards();
    });
    card.addEventListener('mouseenter', () => showTowerTip(card, type));
    card.addEventListener('mouseleave', hideTowerTip);
  });

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    selectedType = null;
    selectTowerAt(-1, -1);
    updateCards();
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', fit);

  $('btn-start').addEventListener('click', startGame);
  $('btn-pause').addEventListener('click', () => setPaused(!paused));
  $('btn-resume').addEventListener('click', () => setPaused(false));
  $('btn-speed').addEventListener('click', toggleSpeed);
  $('btn-wave').addEventListener('click', () => earlyCall());
  $('btn-close-panel').addEventListener('click', () => selectTowerAt(-1, -1));
  $('btn-close-enemy').addEventListener('click', () => {
    selectedEnemy = null;
    $('enemy-panel').classList.add('hidden');
  });
  $('btn-upgrade').addEventListener('click', upgradeSelected);
  $('btn-sell').addEventListener('click', sellSelected);
  $('btn-replay-win').addEventListener('click', startGame);
  $('btn-replay-lose').addEventListener('click', startGame);
  $('btn-menu-win').addEventListener('click', toMenu);
  $('btn-menu-lose').addEventListener('click', toMenu);

  buildWaveBar();

  fit();
  resetGame();
  canvas.classList.add('title-bg');
  requestAnimationFrame(frame);
}

function fit() {
  const sw = stage.offsetWidth || W;
  const sh = stage.offsetHeight || H;
  const s = Math.min(window.innerWidth / sw, window.innerHeight / sh);
  stage.style.transform = `scale(${s})`;
  stage.style.left = ((window.innerWidth - sw * s) / 2) + 'px';
  stage.style.top = ((window.innerHeight - sh * s) / 2) + 'px';
}

/* ============================================================
   GAME FLOW
   ============================================================ */
function resetGame() {
  gold = START_GOLD; lives = START_LIVES;
  waveIndex = -1; waveActive = false; spawnQueue = []; waveTimer = 0;
  countdown = 14;
  barPos = -WAVE_LEAD;
  spawnClock = 0; repelledUpTo = -1;
  enemies = []; towers = []; projectiles = []; particles = []; texts = []; decals = [];
  bossRef = null;
  kills = 0; goldEarned = 0; timePlayed = 0;
  shake = 0; paused = false; speed = 1;
  selectedType = null; selectedTower = null; selectedEnemy = null;
  $('enemy-panel').classList.add('hidden');
  hudCache = {}; waveBtnSecond = -1;
  $('hud').classList.add('hidden');
  $('info-panel').classList.add('hidden');
  $('boss-bar').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('victory-screen').classList.add('hidden');
  $('defeat-screen').classList.add('hidden');
  $('btn-speed').textContent = '1×';
  $('btn-speed').classList.remove('active');
  $('btn-speed').classList.remove('fast');
  $('btn-pause').classList.remove('active');
  $('toasts').innerHTML = '';
}

function startGame() {
  resetGame();
  state = 'playing';
  canvas.classList.remove('title-bg');
  $('title-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateCards();
  updateWaveBtn();
  showBanner('Level I', 'The Bleeding Road');
  toast('Summon a tower and click the ground to build.');
  toast('Call waves early for bonus gold.');
  for (let i = 0; i < 5; i++) spawnEmber(true);
}

function toMenu() {
  state = 'title';
  resetGame();
  canvas.classList.add('title-bg');
  $('title-screen').classList.remove('hidden');
}

function victory() {
  state = 'victory';
  $('v-kills').textContent = kills;
  $('v-gold').textContent = goldEarned;
  $('v-time').textContent = fmtTime(timePlayed);
  $('victory-screen').classList.remove('hidden');
}

function defeat() {
  state = 'defeat';
  $('d-waves').textContent = Math.max(0, waveIndex + (waveActive ? 1 : 0));
  $('d-kills').textContent = kills;
  $('d-time').textContent = fmtTime(timePlayed);
  $('defeat-screen').classList.remove('hidden');
}

function setPaused(p) {
  if (state !== 'playing') return;
  paused = p;
  $('pause-screen').classList.toggle('hidden', !p);
  $('btn-pause').classList.toggle('active', p);
}

function toggleSpeed() {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
  $('btn-speed').textContent = speed + '×';
  $('btn-speed').classList.toggle('active', speed > 1);
  $('btn-speed').classList.toggle('fast', speed === 3);
}

/* ============================================================
   WAVES
   ============================================================ */
function startWave() {
  waveIndex++;
  const w = WAVES[waveIndex];
  for (const g of w.groups) {
    for (let i = 0; i < g.count; i++) {
      spawnQueue.push({ type: g.type, wave: waveIndex, at: spawnClock + g.delay + i * g.interval });
    }
  }
  spawnQueue.sort((a, b) => a.at - b.at);
  waveActive = true;
  barPos = Math.max(barPos, waveIndex);
  showBanner('Wave ' + (waveIndex + 1), w.name);
  if (waveIndex === WAVES.length - 1) toast('A great darkness approaches…', true);
  updateWaveBtn();
}

function earlyCall(target) {
  if (state !== 'playing' || waveIndex >= WAVES.length - 1) return;
  const want = target === undefined ? waveIndex + 1 : Math.min(target, WAVES.length - 1);
  if (want <= waveIndex) return;
  let bonus = 0;
  for (let i = waveIndex + 1; i <= want; i++) {
    bonus += Math.round(Math.max(0, Math.ceil((i - barPos) * WAVE_BREAK)) * 1.5);
  }
  barPos = Math.max(barPos, want);
  while (waveIndex < want) startWave();
  gold += bonus;
  if (bonus) toast('Early call: +' + bonus + ' gold.', true);
}

function updateWaves(dt) {
  // A shared, always-running spawn clock drives every wave's spawns, so a new
  // wave fires on schedule even while a previous wave's monsters are alive.
  spawnClock += dt;
  while (spawnQueue.length && spawnQueue[0].at <= spawnClock) {
    const s = spawnQueue.shift();
    spawnEnemy(s.type, s.wave);
  }

  // The wave bar is a conveyor that never stops: barPos advances one stone per
  // WAVE_BREAK. A wave spawns the instant its stone reaches the left edge.
  barPos += dt / WAVE_BREAK;
  countdown = Math.max(0, (waveIndex + 1 - barPos) * WAVE_BREAK);

  if (waveIndex < WAVES.length - 1 && barPos >= waveIndex + 1) {
    startWave();
  }

  // A wave is repelled once all of its spawns have fired and none of its
  // monsters remain on the field (they may outlive the next wave's arrival).
  const liveWaves = new Set();
  for (const e of enemies) if (!e.dying && !e.leaked) liveWaves.add(e.wave);
  for (const s of spawnQueue) liveWaves.add(s.wave);
  while (repelledUpTo + 1 <= waveIndex && !liveWaves.has(repelledUpTo + 1)) {
    repelledUpTo++;
    if (repelledUpTo < WAVES.length - 1) toast('Wave ' + (repelledUpTo + 1) + ' repelled.');
  }

  waveActive = spawnQueue.length > 0 || enemies.some(e => !e.dying && !e.leaked);
  if (waveIndex >= WAVES.length - 1 && !waveActive) { victory(); return; }
}

/* ============================================================
   ENEMIES
   ============================================================ */
function spawnEnemy(type, wave) {
  const def = ENEMY_DEFS[type];
  const half = def.clampHalf || 0;
  const e = {
    type, def,
    wave: wave === undefined ? waveIndex : wave,
    x: Math.max(SPAWN_PT.x, half), y: SPAWN_PT.y,
    seg: 2,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed,
    dir: 1,
    walkPhase: Math.random() * 6.28,
    flash: 0,
    slowT: 0, slowMul: 1,
    poisonT: 0, poisonDps: 0, poisonSrc: null,
    dying: false, deathT: 0, deathRot: 0, leaked: false,
    seed: Math.random() * 10
  };
  enemies.push(e);
  for (let i = 0; i < 6; i++) {
    addParticle({
      kind: 'dot', x: RIFT.x + 10, y: RIFT.y + (Math.random() - 0.5) * 40,
      vx: 40 + Math.random() * 70, vy: (Math.random() - 0.5) * 60,
      life: 0.5, maxLife: 0.5, size: 2 + Math.random() * 2.5,
      color: Math.random() < 0.5 ? '#ff4a5e' : '#8d1526'
    });
  }
  if (def.boss) {
    bossRef = e;
    $('boss-bar').classList.remove('hidden');
    toast('The Blood Warden has come!', true);
    shake = 10;
  }
}

function progressOf(e) {
  const idx = e.seg - 1;
  if (idx < 0) return 0;
  if (idx >= SEG.length) return CUM[CUM.length - 1] + 1;
  const n = WAYPOINTS[idx + 1];
  const d = Math.hypot(n.x - e.x, n.y - e.y);
  return CUM[idx] + Math.max(0, SEG[idx] - d);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.flash > 0) e.flash -= dt;

    if (e.dying) {
      e.deathT += dt * 2.0;
      if (e.deathT >= 1) enemies.splice(i, 1);
      continue;
    }

    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowMul = 1;
      else if (Math.random() < dt * 6) {
        addParticle({
          kind: 'dot', x: e.x + (Math.random() - 0.5) * 16, y: e.y - Math.random() * 24,
          vx: (Math.random() - 0.5) * 20, vy: -14 - Math.random() * 18,
          life: 0.55, maxLife: 0.55, size: 1.6 + Math.random(),
          color: '#aeeaff'
        });
      }
    }
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      damageEnemy(e, e.poisonDps * dt, e.poisonSrc);
      if (e.dying) continue;
      if (Math.random() < dt * 5) {
        addParticle({
          kind: 'dot', x: e.x + (Math.random() - 0.5) * 14, y: e.y - 8 - Math.random() * 18,
          vx: (Math.random() - 0.5) * 16, vy: -20 - Math.random() * 16,
          life: 0.6, maxLife: 0.6, size: 1.8 + Math.random(),
          color: '#6dff5a'
        });
      }
    }

    const wp = WAYPOINTS[e.seg];
    if (!wp) { leakEnemy(e); enemies.splice(i, 1); continue; }
    const dx = wp.x - e.x, dy = wp.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = e.speed * (e.slowT > 0 ? e.slowMul : 1);
    const step = sp * dt;
    if (Math.abs(dx) > 1) e.dir = dx > 0 ? 1 : -1;
    if (step >= d) {
      e.x = wp.x; e.y = wp.y; e.seg++;
      if (e.seg >= WAYPOINTS.length) { leakEnemy(e); enemies.splice(i, 1); continue; }
    } else {
      e.x += (dx / d) * step;
      e.y += (dy / d) * step;
    }
    e.walkPhase += step * 0.085;

    const half = e.def.clampHalf || 0;
    if (half && e.seg >= WAYPOINTS.length - 1 && e.x >= W - half) {
      leakEnemy(e); enemies.splice(i, 1); continue;
    }

    e.clampX = clampForEnemy(e);
  }
}

/* Keep wide foes (colossus, boss) fully inside the level horizontally so
   their sprite and HP bar never clip out of the visible area. */
function clampForEnemy(e) {
  const half = e.def.clampHalf || 0;
  if (!half) return 0;
  if (e.x < half) return half - e.x;
  if (e.x > W - half) return (W - half) - e.x;
  return 0;
}

function damageEnemy(e, amount, src) {
  if (e.dying || e.leaked) return;
  e.hp -= amount;
  e.flash = 0.1;
  if (amount >= 18 && Math.random() < 0.45) {
    addText('-' + Math.round(amount), e.x, e.y - 26, '#ffb0b8', 13);
  }
  if (e.hp <= 0) killEnemy(e, src);
}

function killEnemy(e, src) {
  if (e.dying) return;
  e.dying = true;
  e.deathT = 0;
  e.deathRot = (Math.random() - 0.5) * 1.4;
  kills++;
  gold += e.def.bounty;
  goldEarned += e.def.bounty;
  if (src && typeof src.kills === 'number') src.kills++;
  addText('+' + e.def.bounty, e.x, e.y - 34, '#ffd75e', 15);

  const n = e.def.boss ? 34 : 12 + Math.round(e.def.radius * 0.4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * (e.def.boss ? 190 : 120);
    addParticle({
      kind: 'blood', x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6 + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      life: 0.7 + Math.random() * 0.5, maxLife: 1.2,
      size: 2 + Math.random() * (e.def.boss ? 5 : 3.4),
      rot: Math.random() * 6.28, color: Math.random() < 0.3 ? '#c2243a' : '#7e0f1c'
    });
  }
  addParticle({ kind: 'ring', x: e.x, y: e.y - 6, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, size: 34 + e.def.radius, color: '#ff4a5e' });

  decals.push({
    x: e.x + (Math.random() - 0.5) * 10, y: e.y + 8 + Math.random() * 6,
    r: 9 + e.def.radius * 0.42, rot: Math.random() * 6.28,
    alpha: 0.5, color: '#48060f'
  });
  if (decals.length > 70) decals.shift();

  if (e.def.boss) {
    shake = 16;
    $('boss-bar').classList.add('hidden');
    bossRef = null;
    toast('The Blood Warden has fallen!');
    for (let i = 0; i < 20; i++) {
      addParticle({
        kind: 'spark', x: e.x, y: e.y - 30,
        vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420,
        life: 0.8, maxLife: 0.8, size: 4, color: '#ff8b93'
      });
    }
  }
}

function leakEnemy(e) {
  e.leaked = true;
  const cost = e.def.lifeCost || 1;
  lives -= cost;
  shake = Math.max(shake, 8);
  flashDamage();
  addText('-' + cost, PORTAL.x - 40, PORTAL.y - 40, '#ff5d67', 18);
  for (let i = 0; i < 14; i++) {
    addParticle({
      kind: 'spark', x: PORTAL.x - 30, y: PORTAL.y + (Math.random() - 0.5) * 50,
      vx: -60 - Math.random() * 160, vy: (Math.random() - 0.5) * 160,
      life: 0.6, maxLife: 0.6, size: 3.5, color: '#ff5d67'
    });
  }
  toast(e.def.boss ? 'The Warden breached the portal! (-5)' : e.def.name + ' slipped through! (-' + cost + ')', true);
  if (bossRef === e) { bossRef = null; $('boss-bar').classList.add('hidden'); }
  if (lives <= 0) { lives = 0; defeat(); }
}

/* ============================================================
   TOWERS
   ============================================================ */
function canPlace(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  const key = tx + ',' + ty;
  if (PATH_SET.has(key) || BLOCKED.has(key)) return false;
  if (towers.some(t => t.tx === tx && t.ty === ty)) return false;
  if (selectedType && gold < TOWER_DEFS[selectedType].cost) return false;
  return true;
}

function tryPlace(tx, ty) {
  const def = TOWER_DEFS[selectedType];
  if (!canPlace(tx, ty)) {
    const key = tx + ',' + ty;
    if (PATH_SET.has(key) || BLOCKED.has(key) || tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) toast('The dead ground refuses you there.');
    else if (towers.some(t => t.tx === tx && t.ty === ty)) toast('That ground is already claimed.');
    else toast('Not enough gold.', true);
    return;
  }
  gold -= def.cost;
  const tw = {
    type: selectedType, tx, ty,
    x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE,
    level: 1, cooldown: 0.35, angle: -Math.PI / 2, fire: 0, kills: 0, spent: def.cost
  };
  towers.push(tw);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 6.28;
    addParticle({
      kind: 'spark', x: tw.x, y: tw.y - 6,
      vx: Math.cos(a) * (50 + Math.random() * 90), vy: Math.sin(a) * (50 + Math.random() * 90) - 40,
      life: 0.5, maxLife: 0.5, size: 3, color: def.color
    });
  }
  addParticle({ kind: 'ring', x: tw.x, y: tw.y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, size: 44, color: def.color });
  updateCards();
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function findTarget(tw, range) {
  let best = null, bestProg = -1;
  for (const e of enemies) {
    if (e.dying || e.leaked) continue;
    const d = Math.hypot(e.x - tw.x, e.y - tw.y);
    if (d > range + e.def.radius) continue;
    const p = progressOf(e);
    if (p > bestProg) { bestProg = p; best = e; }
  }
  return best;
}

function updateTowers(dt) {
  for (const tw of towers) {
    if (tw.fire > 0) tw.fire = Math.max(0, tw.fire - dt * 4);
    tw.cooldown -= dt;
    const lv = TOWER_DEFS[tw.type].levels[tw.level - 1];
    const target = findTarget(tw, lv.range);
    if (target) {
      const ang = Math.atan2((target.y - 6) - (tw.y - 50), target.x - tw.x);
      tw.angle = lerpAngle(tw.angle, ang, Math.min(1, dt * 9));
      if (tw.cooldown <= 0) fireTower(tw, target, lv);
    }
  }
}

function fireTower(tw, target, lv) {
  const def = TOWER_DEFS[tw.type];
  tw.cooldown = lv.rate;
  tw.fire = 0.26;
  const mx = tw.x + Math.cos(tw.angle) * 16;
  const my = tw.y - 50 + Math.sin(tw.angle) * 16;
  projectiles.push({
    type: def.proj, x: mx, y: my,
    tx: target.x, ty: target.y - 6,
    target, src: tw,
    speed: PROJ_SPEED[def.proj], vx: 0, vy: 0,
    dmg: lv.dmg, splash: lv.splash || 0,
    slow: lv.slow || 0, slowDur: lv.slowDur || 0,
    poisonDps: lv.poisonDps || 0, poisonDur: lv.poisonDur || 0,
    trail: [], life: 4
  });
  for (let i = 0; i < 3; i++) {
    addParticle({
      kind: 'spark', x: mx, y: my,
      vx: Math.cos(tw.angle) * (60 + Math.random() * 70) + (Math.random() - 0.5) * 60,
      vy: Math.sin(tw.angle) * (60 + Math.random() * 70) + (Math.random() - 0.5) * 60,
      life: 0.3, maxLife: 0.3, size: 2.6, color: def.color
    });
  }
}

/* ============================================================
   PROJECTILES
   ============================================================ */
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }

    if (p.target && !p.target.dying && !p.target.leaked && p.target.hp > 0) {
      p.tx = p.target.x;
      p.ty = p.target.y - 6;
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
    const step = p.speed * dt;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 7) p.trail.shift();
    if (d <= step + 7) {
      impact(p);
      projectiles.splice(i, 1);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
}

function impact(p) {
  const ix = p.tx, iy = p.ty;
  const col = p.type === 'blood' ? '#ff2f45' : p.type === 'frost' ? '#66d9ff' : p.type === 'doom' ? '#a34dff' : '#3dff8f';

  if (p.splash > 0) {
    addParticle({ kind: 'ring', x: ix, y: iy, vx: 0, vy: 0, life: 0.38, maxLife: 0.38, size: p.splash, color: col });
    shake = Math.max(shake, 3);
    for (const e of enemies) {
      if (e.dying || e.leaked) continue;
      if (Math.hypot(e.x - ix, e.y - iy) <= p.splash + e.def.radius) applyHit(e, p);
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28;
      addParticle({
        kind: 'spark', x: ix, y: iy,
        vx: Math.cos(a) * (80 + Math.random() * 160), vy: Math.sin(a) * (80 + Math.random() * 160),
        life: 0.45, maxLife: 0.45, size: 3.4, color: col
      });
    }
  } else if (p.target && !p.target.dying && !p.target.leaked && p.target.hp > 0) {
    applyHit(p.target, p);
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.28;
      addParticle({
        kind: 'spark', x: ix, y: iy,
        vx: Math.cos(a) * (50 + Math.random() * 110), vy: Math.sin(a) * (50 + Math.random() * 110),
        life: 0.35, maxLife: 0.35, size: 2.6, color: col
      });
    }
  } else {
    addParticle({ kind: 'smoke', x: ix, y: iy, vx: 0, vy: -14, life: 0.4, maxLife: 0.4, size: 5, color: 'rgba(140,120,150,0.5)' });
  }
}

function applyHit(e, p) {
  damageEnemy(e, p.dmg, p.src);
  if (e.dying) return;
  if (p.slow > 0) {
    if (p.slow > 1 - e.slowMul) e.slowMul = 1 - p.slow;
    e.slowT = Math.max(e.slowT, p.slowDur);
  }
  if (p.poisonDps > 0) {
    if (p.poisonDps >= e.poisonDps) { e.poisonDps = p.poisonDps; e.poisonSrc = p.src; }
    e.poisonT = Math.max(e.poisonT, p.poisonDur);
  }
  e.flash = 0.12;
}

/* ============================================================
   FX: particles / texts / embers
   ============================================================ */
function addParticle(pt) {
  if (particles.length > 620) particles.shift();
  if (!pt.maxLife) pt.maxLife = pt.life;
  if (pt.rot === undefined) pt.rot = Math.random() * 6.28;
  particles.push(pt);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'blood') pt.vy += 300 * dt;
    else if (pt.kind === 'spark') { pt.vx *= 0.94; pt.vy *= 0.94; }
    else if (pt.kind === 'smoke') { pt.vx *= 0.96; pt.vy *= 0.96; }
    else { pt.vx *= 0.97; pt.vy *= 0.97; }
  }
}

function addText(str, x, y, color, size) {
  if (texts.length > 60) texts.shift();
  texts.push({ str, x, y, color, size: size || 14, life: 0.9, maxLife: 0.9 });
}

function updateTexts(dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    t.y -= dt * 34;
    if (t.life <= 0) texts.splice(i, 1);
  }
}

function spawnEmber(titleMode) {
  const e = {
    x: titleMode ? W / 2 + (Math.random() - 0.5) * 180 : PORTAL.x - Math.random() * 120,
    y: titleMode ? H * 0.76 : PORTAL.y + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 18,
    vy: -18 - Math.random() * 42,
    life: 2.4 + Math.random() * 2.4, maxLife: 4.8,
    size: 1.2 + Math.random() * 2.4,
    color: Math.random() < 0.35 ? '#ffb45c' : (Math.random() < 0.5 ? '#ff4a5e' : '#ff8b93')
  };
  e.maxLife = e.life;
  embers.push(e);
}

function updateEmbers(dt) {
  const titleMode = state === 'title';
  const rate = titleMode ? 7 : 4;
  if (Math.random() < dt * rate) spawnEmber(titleMode);
  if (!titleMode && Math.random() < dt * 2.2) {
    embers.push({
      x: Math.random() * W, y: H + 6,
      vx: (Math.random() - 0.5) * 12, vy: -26 - Math.random() * 40,
      life: 3 + Math.random() * 3, maxLife: 6,
      size: 1 + Math.random() * 1.8, color: '#c96a3a'
    });
  }
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.life -= dt;
    if (e.life <= 0 || e.y < -20) { embers.splice(i, 1); continue; }
    e.x += (e.vx + Math.sin(visualT * 2.4 + e.y * 0.02) * 12) * dt;
    e.y += e.vy * dt;
  }
  if (embers.length > 140) embers.splice(0, embers.length - 140);
}

/* ============================================================
   INPUT
   ============================================================ */
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (W / r.width),
    y: (ev.clientY - r.top) * (H / r.height)
  };
}

function onMouseMove(ev) {
  const p = canvasPos(ev);
  mouse.x = p.x; mouse.y = p.y;
  mouse.tx = Math.floor(p.x / TILE);
  mouse.ty = Math.floor(p.y / TILE);
  mouse.inside = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
}

function onMouseDown(ev) {
  if (state !== 'playing' || paused) return;
  onMouseMove(ev);
  if (ev.button === 2) return;
  if (!mouse.inside) return;
  if (selectedType) tryPlace(mouse.tx, mouse.ty);
  else selectAt(mouse.x, mouse.y);
}

function enemyAt(x, y) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (e.dying || e.leaked) continue;
    const hit = Math.max(e.def.radius + 10, 20);
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= hit && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function selectAt(x, y) {
  const e = enemyAt(x, y);
  if (e) {
    selectedEnemy = e;
    selectedTower = null;
    selectedType = null;
    renderEnemyPanel();
    renderPanel();
    updateCards();
    return;
  }
  selectedEnemy = null;
  $('enemy-panel').classList.add('hidden');
  selectTowerAt(mouse.tx, mouse.ty);
}

function onKey(ev) {
  if (state !== 'playing') return;
  if (ev.code === 'Space') { ev.preventDefault(); setPaused(!paused); return; }
  if (paused) return;
  if (ev.code === 'KeyF') { toggleSpeed(); return; }
  if (ev.code === 'Escape') {
    selectedType = null;
    selectTowerAt(-1, -1);
    updateCards();
    return;
  }
  const map = { Digit1: 'blood', Digit2: 'frost', Digit3: 'doom', Digit4: 'soul' };
  if (map[ev.code]) {
    selectedType = selectedType === map[ev.code] ? null : map[ev.code];
    if (selectedType) selectTowerAt(-1, -1);
    updateCards();
  }
}

function selectTowerAt(tx, ty) {
  selectedTower = towers.find(t => t.tx === tx && t.ty === ty) || null;
  if (selectedTower) { selectedType = null; selectedEnemy = null; $('enemy-panel').classList.add('hidden'); }
  renderPanel();
  updateCards();
}

function renderEnemyPanel() {
  const panel = $('enemy-panel');
  const e = selectedEnemy;
  if (!e || e.dying || e.leaked || !enemies.includes(e)) {
    selectedEnemy = null;
    panel.classList.add('hidden');
    return;
  }
  const def = e.def;
  panel.classList.remove('hidden');
  $('ep-title').textContent = def.name;
  $('ep-sub').textContent = def.boss ? 'Boss' : 'Foe';
  const gemFill = def.boss ? '#e04552' : '#8a6a7a';
  $('ep-gem').style.background =
    `radial-gradient(circle at 34% 28%, ${Sprites.lighten(gemFill, 0.5)}, ${gemFill} 45%, ${Sprites.darken(gemFill, 0.7)})`;

  const rows = [];
  rows.push(['Health', Math.max(0, Math.ceil(e.hp)) + ' / ' + e.maxHp]);
  rows.push(['Bounty', e.def.bounty + ' g']);
  rows.push(['Speed', Math.round(def.speed)]);
  rows.push(['Portal cost', (def.lifeCost || 1) + ' HP']);
  $('ep-stats').innerHTML = rows.map(r => `<li><span>${r[0]}</span><span>${r[1]}</span></li>`).join('');
}

function upgradeSelected() {
  const tw = selectedTower;
  if (!tw) return;
  const def = TOWER_DEFS[tw.type];
  if (tw.level >= 3) return;
  const up = def.levels[tw.level].up;
  if (gold < up) { toast('Not enough gold.', true); return; }
  gold -= up;
  tw.spent += up;
  tw.level++;
  tw.cooldown = 0.1;
  addParticle({ kind: 'ring', x: tw.x, y: tw.y - 10, vx: 0, vy: 0, life: 0.55, maxLife: 0.55, size: 60, color: def.color });
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.28;
    addParticle({
      kind: 'spark', x: tw.x, y: tw.y - 20,
      vx: Math.cos(a) * (60 + Math.random() * 110), vy: Math.sin(a) * (60 + Math.random() * 110) - 50,
      life: 0.55, maxLife: 0.55, size: 3.2, color: def.color
    });
  }
  toast(def.name + ' ascends to Level ' + ['I', 'II', 'III'][tw.level - 1] + '.');
  renderPanel();
  updateCards();
}

function sellSelected() {
  const tw = selectedTower;
  if (!tw) return;
  const ref = Math.floor(tw.spent * 0.6);
  gold += ref;
  const def = TOWER_DEFS[tw.type];
  towers = towers.filter(t => t !== tw);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.28;
    addParticle({
      kind: 'spark', x: tw.x, y: tw.y - 10,
      vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 30,
      life: 0.4, maxLife: 0.4, size: 2.6, color: '#9a8b95'
    });
  }
  toast('Dismantled ' + def.name + ' (+' + ref + ' gold).');
  selectedTower = null;
  renderPanel();
  updateCards();
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(dt) {
  timePlayed += dt;
  updateWaves(dt);
  updateEnemies(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateTexts(dt);
}

/* ============================================================
   RENDER
   ============================================================ */
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  if (state === 'title') {
    Sprites.drawTitleScene(ctx, W, H, t, embers);
    return;
  }

  ctx.drawImage(bgCanvas, 0, 0);

  for (const d of decals) Sprites.drawDecal(ctx, d);
  Sprites.drawDecorOverlay(ctx, DECOR, TILE, t);
  Sprites.drawSpawnRift(ctx, RIFT.x, RIFT.y, t);
  Sprites.drawPortal(ctx, PORTAL.x, PORTAL.y, t);

  drawPlacement(t);

  const ts = towers.slice().sort((a, b) => a.y - b.y);
  for (const tw of ts) {
    Sprites.drawTower(ctx, tw.type, tw.x, tw.y, tw.level, { t, angle: tw.angle, fire: tw.fire });
  }

  const es = enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of es) Sprites.drawEnemy(ctx, e, t);

  for (const p of projectiles) Sprites.drawProjectile(ctx, p, t);
  for (const pt of particles) Sprites.drawParticle(ctx, pt);

  drawTexts();
  drawEmbers();

  Sprites.drawFog(ctx, W, H, t);
  Sprites.drawVignette(ctx, W, H, t);
}

function drawPlacement(t) {
  if (selectedTower) {
    const def = TOWER_DEFS[selectedTower.type];
    const lv = def.levels[selectedTower.level - 1];
    Sprites.drawRangeCircle(ctx, selectedTower.x, selectedTower.y, lv.range, def.color, true);
  }
  if (!selectedType || !mouse.inside) return;
  const def = TOWER_DEFS[selectedType];
  const lv = def.levels[0];
  const valid = canPlace(mouse.tx, mouse.ty);
  const col = valid ? def.color : '#ff2f2f';
  const px = mouse.tx * TILE, py = mouse.ty * TILE;
  ctx.fillStyle = Sprites.rgba(valid ? def.color : '#ff2f2f', 0.16);
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = Sprites.rgba(col, 0.9);
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  Sprites.drawRangeCircle(ctx, px + TILE / 2, py + TILE / 2, lv.range, col, valid);
  ctx.save();
  ctx.globalAlpha = 0.55;
  Sprites.drawTower(ctx, selectedType, px + TILE / 2, py + TILE / 2, 1, { t, angle: -Math.PI / 2, fire: 0 });
  ctx.restore();
}

function drawTexts() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of texts) {
    const a = Math.min(1, t.life / (t.maxLife * 0.5));
    ctx.globalAlpha = a;
    ctx.font = `700 ${t.size}px Cinzel, Georgia, serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(t.str, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.restore();
}

function drawEmbers() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of embers) {
    const a = Math.max(0, e.life / e.maxLife);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.fillStyle = Sprites.rgba(e.color, 0.95);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * (0.5 + a * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
   HUD / UI SYNC
   ============================================================ */
function syncHUD() {
  if (hudCache.gold !== gold) {
    $('val-gold').textContent = gold;
    hudCache.gold = gold;
    updateCards();
    if (selectedTower) renderPanel();
  }
  if (hudCache.lives !== lives) {
    $('val-lives').textContent = lives;
    hudCache.lives = lives;
  }
  const waveText = waveActive || countdown <= 0
    ? 'Wave ' + (waveIndex + 1) + ' / ' + WAVES.length
    : 'Next: Wave ' + (waveIndex + 2) + ' / ' + WAVES.length;
  if (hudCache.wave !== waveText) {
    $('val-wave').textContent = waveText;
    hudCache.wave = waveText;
  }

  const sec = Math.ceil(countdown);
  if (sec !== waveBtnSecond) {
    waveBtnSecond = sec;
    updateWaveBtn();
  }

  if (bossRef && !bossRef.dying && !bossRef.leaked && enemies.includes(bossRef)) {
    const frac = Math.max(0, bossRef.hp / bossRef.maxHp);
    $('boss-fill').style.width = (frac * 100) + '%';
  }

  if (selectedEnemy) renderEnemyPanel();
  updateWaveBar();
}

function updateCards() {
  document.querySelectorAll('.tower-card').forEach(card => {
    const type = card.dataset.type;
    const cost = TOWER_DEFS[type].cost;
    card.classList.toggle('selected', selectedType === type);
    card.classList.toggle('cant', gold < cost);
    const cv = card.querySelector('.cost-val');
    if (cv) cv.textContent = cost;
  });
}

function buildWaveBar() {
  const bar = $('wave-bar');
  bar.innerHTML = '<div id="wave-track"></div>';
  const track = bar.querySelector('#wave-track');
  WAVES.forEach((w, i) => {
    const stone = document.createElement('div');
    stone.className = 'wavestone';
    stone.dataset.index = i;
    stone.innerHTML = `<span class="ws-num">${i + 1}</span>`;
    stone.addEventListener('mouseenter', () => showWaveTip(stone, i));
    stone.addEventListener('mouseleave', hideWaveTip);
    stone.addEventListener('click', () => { hideWaveTip(); earlyCall(i); });
    track.appendChild(stone);
  });
}

function updateWaveBar() {
  const track = $('wave-track');
  if (!track) return;
  const stones = track.children;
  if (!stones.length) return;
  const step = stones.length > 1 ? stones[1].offsetLeft - stones[0].offsetLeft : stones[0].offsetWidth
             || stones[0].getBoundingClientRect().width;
  // Conveyor: barPos is where the left edge sits on the stone axis. Each stone
  // sits at (i - barPos) steps from the left edge, so the whole strip keeps
  // moving left forever. Stones that reach the left edge disappear.
  const pos = barPos === undefined ? -WAVE_LEAD : barPos;
  const currentIdx = Math.floor(pos);
  const scroll = pos * step;
  track.style.transform = 'translateX(' + (-scroll) + 'px)';
  for (let i = 0; i < stones.length; i++) {
    const el = stones[i];
    el.classList.toggle('passed', i < pos);
    el.classList.toggle('done', i < currentIdx);
    el.classList.toggle('current', i === currentIdx && state === 'playing');
    el.classList.toggle('soon', i === currentIdx + 1 && state === 'playing');
  }
}

function showWaveTip(stone, index) {
  const tip = $('wave-tip');
  const w = WAVES[index];
  const rows = w.groups.map(g => {
    const def = ENEMY_DEFS[g.type];
    return `<div class="wt-row">` +
      `<span class="wt-enemy">${def.name} <span class="wt-count">×${g.count}</span></span>` +
      `<span class="wt-meta">${def.hp} HP</span>` +
      `</div>`;
  }).join('');
  tip.innerHTML =
    `<div class="wt-title">Wave ${index + 1}: ${w.name}</div>` +
    `<div class="wt-sub">${totalCount(w)} enemies</div>` + rows;
  const stageRect = stage.getBoundingClientRect();
  const sr = stone.getBoundingClientRect();
  const scale = stage.offsetWidth ? stageRect.width / stage.offsetWidth : 1;
  const left = (sr.left - stageRect.left) / scale + sr.width / scale / 2 - 125;
  tip.style.left = Math.max(4, Math.min(1314 - 254, left)) + 'px';
  tip.style.top = (sr.top - stageRect.top) / scale - 8 + 'px';
  tip.style.transform = 'translateY(-100%)';
  tip.classList.remove('hidden');
}

function hideWaveTip() {
  $('wave-tip').classList.add('hidden');
}

function totalCount(w) {
  return w.groups.reduce((n, g) => n + g.count, 0);
}

function updateWaveBtn() {
  const label = $('wave-label'), bonus = $('wave-bonus'), btn = $('btn-wave');
  if (state !== 'playing') { btn.disabled = true; return; }
  if (waveIndex >= WAVES.length - 1) {
    label.textContent = 'All Waves Cleared';
    bonus.textContent = '';
    btn.disabled = true;
    return;
  }
  label.textContent = 'Call Wave ' + (waveIndex + 2);
  bonus.textContent = '+' + Math.round(Math.max(0, Math.ceil(countdown)) * 1.5) + ' gold';
  btn.disabled = countdown <= 0;
}

function renderPanel() {
  const panel = $('info-panel');
  const tw = selectedTower;
  if (!tw) { panel.classList.add('hidden'); return; }
  const def = TOWER_DEFS[tw.type];
  const lv = def.levels[tw.level - 1];
  panel.classList.remove('hidden');
  $('ip-title').textContent = def.name;
  $('ip-level').textContent = 'Level ' + ['I', 'II', 'III'][tw.level - 1];
  $('ip-gem').style.background =
    `radial-gradient(circle at 34% 28%, ${Sprites.lighten(def.color, 0.5)}, ${def.color} 45%, ${Sprites.darken(def.color, 0.7)})`;

  const rows = [];
  rows.push(['Damage', Math.round(lv.dmg)]);
  rows.push(['Range', Math.round(lv.range)]);
  rows.push(['Attacks / s', (1 / lv.rate).toFixed(2)]);
  if (tw.type === 'blood') rows.push(['Targets', 'First in range']);
  if (tw.type === 'frost') rows.push(['Slow', Math.round(lv.slow * 100) + '% · ' + lv.slowDur + 's']);
  if (tw.type === 'doom') rows.push(['Splash', Math.round(lv.splash) + ' px']);
  if (tw.type === 'soul') rows.push(['Poison', lv.poisonDps + '/s · ' + lv.poisonDur + 's']);
  rows.push(['Kills', tw.kills]);
  $('ip-stats').innerHTML = rows.map(r => `<li><span>${r[0]}</span><span>${r[1]}</span></li>`).join('');

  const upBtn = $('btn-upgrade');
  if (tw.level >= 3) {
    upBtn.textContent = 'Max Level';
    upBtn.disabled = true;
  } else {
    const up = def.levels[tw.level].up;
    upBtn.textContent = 'Upgrade — ' + up + ' g';
    upBtn.disabled = gold < up;
  }
  $('btn-sell').textContent = 'Sell — ' + Math.floor(tw.spent * 0.6) + ' g';
}

function showTowerTip(card, type) {
  const tip = $('tower-tip');
  const def = TOWER_DEFS[type];
  const lv = def.levels[0];
  const rows = [];
  rows.push(['Damage', Math.round(lv.dmg)]);
  rows.push(['Range', Math.round(lv.range)]);
  rows.push(['Attacks / s', (1 / lv.rate).toFixed(2)]);
  if (type === 'blood') rows.push(['Targets', 'First']);
  if (type === 'frost') rows.push(['Slow', Math.round(lv.slow * 100) + '% · ' + lv.slowDur + 's']);
  if (type === 'doom') rows.push(['Splash', Math.round(lv.splash) + ' px']);
  if (type === 'soul') rows.push(['Poison', lv.poisonDps + '/s · ' + lv.poisonDur + 's']);
  tip.innerHTML =
    `<div class="tt-name">${def.name}</div>` +
    `<div class="tt-cost">Cost ${def.cost} gold</div>` +
    `<div class="tt-desc">${def.desc}</div>` +
    `<ul class="tt-stats">${rows.map(r => `<li><span>${r[0]}</span><span>${r[1]}</span></li>`).join('')}</ul>`;
  const stageRect = stage.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const scale = stage.offsetWidth ? stageRect.width / stage.offsetWidth : 1;
  const top = (cr.top - stageRect.top) / scale - 8;
  tip.style.top = Math.max(4, top) + 'px';
  tip.classList.remove('hidden');
}

function hideTowerTip() {
  $('tower-tip').classList.add('hidden');
}

function showBanner(main, sub) {
  const b = $('banner');
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.innerHTML = main + (sub ? `<span class="b-sub">${sub}</span>` : '');
  b.style.animation = '';
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => b.classList.add('hidden'), 3200);
}

function toast(msg, warn) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3300);
}

function flashDamage() {
  const el = $('damage-flash');
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastTs = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - lastTs) / 1000);
  lastTs = now;
  visualT += rdt;

  if (state === 'playing' && !paused) update(rdt * speed);
  updateEmbers(rdt);
  if (shake > 0) shake = Math.max(0, shake - rdt * 26);

  render(visualT);
  if (state === 'playing') syncHUD();

  requestAnimationFrame(frame);
}

init();
