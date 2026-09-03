/* Novice Shooter — oyun motoru (Limbo tarzı siluet sahne + retro sniper) */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const W = 640, H = 360, GROUND = 300;
/* oyuncu haritanın solundaki yüksek sniper tepesinde konuşlanır */
const PLAYER_POS = { x: 48, y: 168 };

const cvs = $('#game-canvas');
const ctx = cvs.getContext('2d');

const P = () => DB.player();
const weaponOf = p => WEAPONS.find(w => w.id === p.equippedWeapon) || WEAPONS[0];
const armorReduce = p =>
  Math.min(0.65, (p.vest ? VESTS[p.vest - 1].reduce : 0) + (p.helmet ? HELMET.reduce : 0));
const ownsW = (p, w) => p.isAdmin || w.price === 0 || p.ownedWeapons.includes(w.id);
const ownsHat = (p, h) => p.isAdmin || h.price === 0 || p.ownedHats.includes(h.id);
const ownsJk = (p, j) => p.isAdmin || j.price === 0 || p.ownedJackets.includes(j.id);
const ownsGear = (p, key) => p.isAdmin || p.ownedGear.includes(key);

/* ---------- ses: webaudio retro bipler ---------- */
let AC = null, noiseBuf = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.3 | 0, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, slide) {
  try {
    const ac = audio(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) {}
}
function noiseHit(dur, vol) {
  try {
    const ac = audio(), s = ac.createBufferSource(), g = ac.createGain(), t = ac.currentTime;
    s.buffer = noiseBuf;
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(g); g.connect(ac.destination);
    s.start(t); s.stop(t + dur);
  } catch (e) {}
}
const SFX = {
  click: () => tone(660, 0.05, 'square', 0.08),
  /* her silahın sesi kendi karakterinde: hafif silah tiz "pat", ağır silah tok "güm" */
  shoot: (w) => {
    if (w && w.auto) {   /* taramalı: kısa sert tak-tak */
      noiseHit(0.05, 0.16);
      tone(300 - Math.random() * 40, 0.05, 'square', 0.1, -140);
      return;
    }
    const d = w ? w.dmg : 50, id = w ? w.id : 1;
    const f = Math.max(55, 235 - d * 0.6 - id * 2);
    noiseHit(0.1 + d / 900, 0.2 + d / 800);
    tone(f, 0.12 + d / 1100, d > 90 ? 'sawtooth' : 'square', 0.15, -f * 0.7);
    if (d >= 130) tone(44, 0.32, 'sine', 0.25, -18);            /* ağır silah bas gümlemesi */
    if (d <= 32) tone(820 + id * 55, 0.045, 'square', 0.06);    /* hafif silah metalik çıtlama */
  },
  dry:   () => tone(90, 0.06, 'square', 0.08),
  hit:   () => tone(300, 0.07, 'square', 0.12, -80),
  kill:  () => { tone(440, 0.08, 'square', 0.12); setTimeout(() => tone(220, 0.12, 'square', 0.12), 70); },
  hurt:  () => { noiseHit(0.12, 0.2); tone(110, 0.25, 'sawtooth', 0.18, -60); },
  buy:   () => { tone(520, 0.07, 'square', 0.1); setTimeout(() => tone(780, 0.1, 'square', 0.1), 60); },
  win:   () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'square', 0.12), i * 130)),
  lose:  () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.12), i * 160)),
};

/* ---------- sahne dekoru (sabit tohumla üretilir, titremez) ---------- */
const SCENERY = (() => {
  let s = 42;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const hillsFar = [], hillsNear = [], trees = [], grass = [];
  for (let x = -40; x <= W + 40; x += 40) hillsFar.push({ x, y: 228 + rnd() * 30 });
  for (let x = -40; x <= W + 40; x += 32) hillsNear.push({ x, y: 262 + rnd() * 20 });
  for (let i = 0; i < 7; i++) {
    trees.push({ x: 90 + i * 85 + rnd() * 40, h: 70 + rnd() * 90, lean: rnd() * 0.5 - 0.25, br: 2 + (rnd() * 3 | 0) });
  }
  for (let i = 0; i < 70; i++) grass.push({ x: rnd() * W, h: 3 + rnd() * 6 });
  return { hillsFar, hillsNear, trees, grass };
})();

/* grain + vinyet dokuları (bir kez üretilir) */
const grainCvs = document.createElement('canvas');
grainCvs.width = 320; grainCvs.height = 180;
{
  const g = grainCvs.getContext('2d');
  const img = g.createImageData(320, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
}
const vignetteCvs = document.createElement('canvas');
vignetteCvs.width = W; vignetteCvs.height = H;
{
  const g = vignetteCvs.getContext('2d');
  const rad = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  rad.addColorStop(0, 'rgba(0,0,0,0)');
  rad.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = rad;
  g.fillRect(0, 0, W, H);
}

/* ---------- çöp adam çizimi (oyuncu + düşman + önizleme ortak) ---------- */
/* opt: {phase, dead01, color, jacketColor, hat, rifleAngle (rad, null=yok), scale} */
function drawStick(c, x, y, h, opt) {
  const o = opt || {};
  c.save();
  c.translate(x, y);
  if (o.dead01) {
    c.rotate((o.dir || 1) * (Math.PI / 2) * Math.min(1, o.dead01));
    c.globalAlpha = Math.max(0.45, 1 - o.dead01 * 0.4);
  }
  const col = o.color || '#101010';
  const lw = Math.max(1.4, h * 0.07);
  c.lineWidth = lw;
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineCap = 'round';
  const r = h * 0.12, hipY = -h * 0.42, shY = -h * 0.72, headY = -h + r;
  const ph = o.phase || 0;
  const legAmp = h * 0.16 * (o.phase !== undefined && o.moveAmp !== undefined ? o.moveAmp : 1);
  /* bacaklar */
  c.beginPath();
  c.moveTo(0, hipY); c.lineTo(Math.sin(ph) * legAmp + h * 0.06, 0);
  c.moveTo(0, hipY); c.lineTo(Math.sin(ph + Math.PI) * legAmp - h * 0.06, 0);
  c.stroke();
  /* gövde */
  c.beginPath(); c.moveTo(0, shY - r * 0.2); c.lineTo(0, hipY); c.stroke();
  /* kıyafet: renkli gövde katmanı */
  if (o.jacketColor) {
    c.save();
    c.strokeStyle = o.jacketColor;
    c.lineWidth = lw * 1.9;
    c.beginPath(); c.moveTo(0, shY); c.lineTo(0, hipY + h * 0.03); c.stroke();
    c.lineWidth = lw * 0.9;
    c.beginPath(); c.moveTo(-h * 0.11, shY + h * 0.02); c.lineTo(h * 0.11, shY + h * 0.02); c.stroke();
    c.restore();
  }
  /* kollar */
  if (o.rifleAngle !== null && o.rifleAngle !== undefined) {
    const a = o.rifleAngle, len = h * 0.85;
    /* tüfek */
    c.save();
    c.translate(0, shY);
    c.rotate(a);
    if (o.weapon) {
      drawRifle(c, h, lw, o.weapon);
    } else {
      c.lineWidth = lw * 0.75;
      c.beginPath(); c.moveTo(-h * 0.12, h * 0.05); c.lineTo(len, 0); c.stroke();
    }
    c.restore();
    /* tüfeğe uzanan kollar */
    c.beginPath();
    c.moveTo(0, shY); c.lineTo(Math.cos(a) * h * 0.3, shY + Math.sin(a) * h * 0.3 + h * 0.05);
    c.moveTo(0, shY); c.lineTo(Math.cos(a) * h * 0.5, shY + Math.sin(a) * h * 0.5 + h * 0.03);
    c.stroke();
  } else {
    c.beginPath();
    c.moveTo(0, shY); c.lineTo(Math.sin(ph + Math.PI) * h * 0.13 - h * 0.05, shY + h * 0.24);
    c.moveTo(0, shY); c.lineTo(Math.sin(ph) * h * 0.13 + h * 0.05, shY + h * 0.24);
    c.stroke();
  }
  /* kafa */
  c.beginPath(); c.arc(0, headY, r, 0, Math.PI * 2); c.fill();
  /* şapka */
  if (o.hat && o.hat !== 'none') drawHat(c, 0, headY, r, o.hat);
  c.restore();
}

/* silah görünümü istatistiklerinden türetilir: her silahın silüeti farklıdır.
   namlu boyu zoom'la, kalınlık hasarla büyür; zoom>=3 dürbün, dmg>=100 namlu freni,
   zoom>=6 bipod; premium altın, mağaza (gerçek para) kırmızı aksan taşır */
function drawRifle(c, h, lw, w) {
  const len = h * (0.55 + w.zoom * 0.05);
  const th = Math.max(1.2, lw * (0.5 + w.dmg / 350));
  const col = '#0a0a0a';
  c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
  /* dipçik */
  c.beginPath();
  c.moveTo(-h * 0.1, -th);
  c.lineTo(-h * 0.22, h * 0.09);
  c.lineTo(-h * 0.13, h * 0.1);
  c.lineTo(-h * 0.04, h * 0.02);
  c.closePath(); c.fill();
  /* namlu */
  c.lineWidth = th;
  c.beginPath(); c.moveTo(-h * 0.06, 0); c.lineTo(len, 0); c.stroke();
  /* kabza */
  c.lineWidth = th * 0.8;
  c.beginPath(); c.moveTo(h * 0.06, 0); c.lineTo(h * 0.03, h * 0.1); c.stroke();
  /* dürbün */
  if (w.zoom >= 3) {
    const s0 = len * 0.22, s1 = len * (0.3 + Math.min(0.22, w.zoom * 0.02));
    c.lineWidth = th * 1.1;
    c.beginPath(); c.moveTo(s0, -th * 1.8); c.lineTo(s1, -th * 1.8); c.stroke();
    c.beginPath(); c.arc(s1, -th * 1.8, th * 0.9, 0, Math.PI * 2); c.fill();
  }
  /* namlu freni */
  if (w.dmg >= 100) c.fillRect(len - th * 2.2, -th * 1.1, th * 2.2, th * 2.2);
  /* bipod */
  if (w.zoom >= 6) {
    c.lineWidth = Math.max(1, th * 0.5);
    c.beginPath();
    c.moveTo(len * 0.72, 0); c.lineTo(len * 0.65, h * 0.15);
    c.moveTo(len * 0.72, 0); c.lineTo(len * 0.8, h * 0.15);
    c.stroke();
  }
  /* şarjör + ikinci kabza (taramalı) */
  if (w.auto) {
    c.fillRect(len * 0.32, th * 0.6, th * 1.8, th * 3.2);
    c.lineWidth = th * 0.8;
    c.beginPath(); c.moveTo(len * 0.55, 0); c.lineTo(len * 0.5, h * 0.09); c.stroke();
  }
  /* aksan halkası */
  const acc = w.realMoney ? '#e04040' : (w.premium ? '#ffd24a' : null);
  if (acc) { c.fillStyle = acc; c.fillRect(len * 0.5, -th * 0.9, th * 1.5, th * 1.8); c.fillStyle = col; }
}

function drawHat(c, hx, hy, r, id) {
  const def = HATS.find(h => h.id === id);
  if (!def || !def.color) return;
  c.save();
  c.fillStyle = def.color;
  const top = hy - r;
  if (id === 'cap') {
    c.fillRect(hx - r, top - r * 0.65, r * 2, r * 0.7);
    c.fillRect(hx + r * 0.6, top - r * 0.15, r * 1.1, r * 0.22);
  } else if (id === 'beret') {
    c.beginPath(); c.ellipse(hx - r * 0.1, top - r * 0.25, r * 1.1, r * 0.45, -0.15, 0, Math.PI * 2); c.fill();
  } else if (id === 'cowboy') {
    c.beginPath(); c.ellipse(hx, top - r * 0.1, r * 1.7, r * 0.35, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(hx - r * 0.7, top - r * 1.1, r * 1.4, r * 1.05);
  } else if (id === 'top') {
    c.fillRect(hx - r * 1.2, top - r * 0.12, r * 2.4, r * 0.24);
    c.fillRect(hx - r * 0.75, top - r * 1.7, r * 1.5, r * 1.62);
  } else if (id === 'crown') {
    c.beginPath();
    c.moveTo(hx - r * 0.9, top + r * 0.1);
    c.lineTo(hx - r * 0.9, top - r * 0.7); c.lineTo(hx - r * 0.45, top - r * 0.2);
    c.lineTo(hx, top - r * 0.85); c.lineTo(hx + r * 0.45, top - r * 0.2);
    c.lineTo(hx + r * 0.9, top - r * 0.7); c.lineTo(hx + r * 0.9, top + r * 0.1);
    c.closePath(); c.fill();
  }
  c.restore();
}

/* ---------- ekran yönetimi ---------- */
function show(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#screen-' + id).classList.remove('hidden');
  document.body.classList.toggle('playing', id === 'game');
  if (id !== 'game') stopLoop();
  if (id === 'menu') renderMenu();
  else if (id === 'levels') renderLevels();
  else if (id === 'armory') renderArmory();
  else if (id === 'gear') renderGear();
  else if (id === 'character') renderCharacter();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { SFX.click(); show(b.dataset.go); }
});

function coinsTxt(p) { return '$' + p.coins; }

let toastTimer = 0;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function renderMenu() {
  const p = P();
  $('#menu-player').textContent =
    'AJAN: ' + p.name + (p.isAdmin ? ' [ADMIN]' : '') + ' · ' + coinsTxt(p) + ' · BÖLÜM ' + p.level + '/' + LEVEL_COUNT;
}

function renderLevels() {
  const p = P();
  $('#levels-coins').textContent = coinsTxt(p);
  const grid = $('#level-grid');
  grid.innerHTML = '';
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const c = document.createElement('button');
    c.className = 'cell' + (n < p.level ? ' done' : n === p.level ? ' cur' : '');
    c.textContent = n;
    if (n <= p.level) c.onclick = () => { SFX.click(); startLevel(n); };
    else c.disabled = true;
    grid.appendChild(c);
  }
}

function renderArmory() {
  const p = P();
  $('#armory-coins').textContent = coinsTxt(p);
  const list = $('#weapon-list');
  list.innerHTML = '';
  WEAPONS.forEach(w => {
    const owned = ownsW(p, w);
    const row = document.createElement('div');
    row.className = 'row' + (p.equippedWeapon === w.id ? ' sel' : '');
    const info = document.createElement('div');
    info.className = 'winfo';
    info.innerHTML =
      '<b>' + w.name + '</b>' +
      (w.auto ? ' <span class="prem">TARAMALI</span>' : '') +
      (w.realMoney ? ' <span class="prem">&#8378;GERÇEK PARA' + (p.isAdmin ? ' (ADMIN AÇIK)' : '') + '</span>' : '') +
      (w.premium ? ' <span class="prem">&#9733;PREMIUM' + (p.isAdmin ? ' (ADMIN AÇIK)' : '') + '</span>' : '') +
      '<div class="stats">HASAR ' + w.dmg + ' · ZOOM ' + w.zoom + 'X · HIZ ' + w.cd + 'SN · SALLANMA ' + w.sway + '</div>' +
      '<div class="dmgbar"><i style="width:' + Math.min(100, w.dmg / 2.5) + '%"></i></div>';
    const btn = document.createElement('button');
    btn.className = 'btn small';
    if (p.equippedWeapon === w.id) { btn.textContent = 'KUŞANILDI'; btn.disabled = true; }
    else if (owned) {
      btn.textContent = 'KUŞAN';
      btn.onclick = () => { p.equippedWeapon = w.id; DB.save(); SFX.click(); renderArmory(); };
    } else if (w.realMoney) {
      /* gerçek para ürünü: oyun parasıyla alınamaz (App Store / Google Play) */
      btn.textContent = w.realMoney;
      btn.onclick = () => showToast('MAĞAZA ÜRÜNÜ — ' + w.name + ' GERÇEK PARA İLE ALINIR (' + w.realMoney + ')');
    } else {
      btn.textContent = 'AL $' + w.price;
      btn.disabled = p.coins < w.price;
      btn.onclick = () => {
        p.coins -= w.price; p.ownedWeapons.push(w.id); p.equippedWeapon = w.id;
        DB.save(); SFX.buy(); renderArmory();
      };
    }
    row.appendChild(info); row.appendChild(btn);
    list.appendChild(row);
  });
}

function renderGear() {
  const p = P();
  $('#gear-coins').textContent = coinsTxt(p);
  const list = $('#gear-list');
  list.innerHTML = '';
  const addRow = (title, statsHtml, btnTxt, btnFn, sel, disabled) => {
    const row = document.createElement('div');
    row.className = 'row' + (sel ? ' sel' : '');
    row.innerHTML = '<div class="winfo"><b>' + title + '</b><div class="stats">' + statsHtml + '</div></div>';
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = btnTxt;
    btn.disabled = !!disabled;
    if (btnFn) btn.onclick = btnFn;
    row.appendChild(btn);
    list.appendChild(row);
  };
  addRow('YELEK YOK', 'KORUMA %0', p.vest === 0 ? 'SEÇİLİ' : 'SEÇ',
    () => { p.vest = 0; DB.save(); SFX.click(); renderGear(); }, p.vest === 0, p.vest === 0);
  VESTS.forEach(v => {
    const key = 'vest' + v.lvl, owned = ownsGear(p, key);
    if (p.vest === v.lvl) addRow(v.name, 'HASAR AZALTMA %' + (v.reduce * 100), 'KUŞANILDI', null, true, true);
    else if (owned) addRow(v.name, 'HASAR AZALTMA %' + (v.reduce * 100), 'KUŞAN',
      () => { p.vest = v.lvl; DB.save(); SFX.click(); renderGear(); });
    else addRow(v.name, 'HASAR AZALTMA %' + (v.reduce * 100), 'AL $' + v.price,
      () => { p.coins -= v.price; p.ownedGear.push(key); p.vest = v.lvl; DB.save(); SFX.buy(); renderGear(); },
      false, p.coins < v.price);
  });
  const hOwned = ownsGear(p, 'helmet');
  if (!hOwned) addRow(HELMET.name, 'HASAR AZALTMA %' + (HELMET.reduce * 100), 'AL $' + HELMET.price,
    () => { p.coins -= HELMET.price; p.ownedGear.push('helmet'); p.helmet = true; DB.save(); SFX.buy(); renderGear(); },
    false, p.coins < HELMET.price);
  else addRow(HELMET.name, 'HASAR AZALTMA %' + (HELMET.reduce * 100) + (p.helmet ? ' · TAKILI' : ''),
    p.helmet ? 'ÇIKAR' : 'TAK',
    () => { p.helmet = !p.helmet; DB.save(); SFX.click(); renderGear(); }, p.helmet);
}

function renderCharacter() {
  const p = P();
  $('#char-coins').textContent = coinsTxt(p);
  drawCharPreview();
  const buildChips = (defs, listEl, equippedId, ownsFn, ownedArr, equipFn) => {
    listEl.innerHTML = '';
    defs.forEach(d => {
      const owned = ownsFn(p, d);
      const chip = document.createElement('button');
      chip.className = 'chip' + (equippedId === d.id ? ' sel' : '');
      if (equippedId === d.id) chip.textContent = d.name + ' ✓';
      else if (owned) chip.textContent = d.name;
      else if (d.realMoney) chip.textContent = d.name + ' ' + d.realMoney;
      else { chip.textContent = d.name + ' $' + d.price; chip.disabled = p.coins < d.price; }
      chip.onclick = () => {
        if (!owned && d.realMoney) {
          showToast('MAĞAZA ÜRÜNÜ — ' + d.name + ' GERÇEK PARA İLE ALINIR (' + d.realMoney + ')');
          return;
        }
        if (!owned) { p.coins -= d.price; ownedArr.push(d.id); SFX.buy(); } else SFX.click();
        equipFn(d.id);
        DB.save(); renderCharacter();
      };
      listEl.appendChild(chip);
    });
  };
  buildChips(HATS, $('#hat-list'), p.hat, ownsHat, p.ownedHats, id => { p.hat = id; });
  buildChips(JACKETS, $('#jacket-list'), p.jacket, ownsJk, p.ownedJackets, id => { p.jacket = id; });
}

function drawCharPreview() {
  const p = P();
  const c = $('#char-canvas').getContext('2d');
  const cw = 220, ch = 240;
  const sky = c.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, '#c9c9c9'); sky.addColorStop(1, '#8e8e8e');
  c.fillStyle = sky; c.fillRect(0, 0, cw, ch);
  c.fillStyle = '#141414'; c.fillRect(0, ch - 30, cw, 30);
  drawStick(c, cw / 2, ch - 30, 150, {
    color: '#101010', jacketColor: (JACKETS.find(j => j.id === p.jacket) || {}).color,
    hat: p.hat, rifleAngle: -0.15, weapon: weaponOf(p), phase: 0.6, moveAmp: 0.4,
  });
}

/* ---------- oyun durumu ---------- */
let G = null, rafId = 0, lastT = 0;
function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

function startLevel(n) {
  const L = makeLevel(n);
  const es = [];
  for (let i = 0; i < L.enemies; i++) {
    const span = 350;
    const x0 = 250 + (L.enemies === 1 ? span / 2 : i * span / (L.enemies - 1)) + (Math.random() * 24 - 12);
    es.push({
      x: x0, y: GROUND, h: 90 * L.size, hp: L.hp,
      dir: Math.random() < 0.5 ? -1 : 1,
      phase: Math.random() * 6.28,
      dead: false, deadT: 0,
      patrolMin: Math.max(235, x0 - 45), patrolMax: Math.min(620, x0 + 45),
      fireT: 1.5 + Math.random() * L.fireEvery, shotT: 0,
    });
  }
  G = {
    L, n, es, alive: es.length, php: 100,
    cross: { x: 420, y: GROUND - 40 }, scoped: false,
    lastShot: -99, t: 0, over: false,
    flash: 0, shake: 0, tracer: null, floats: [], bonus: 0,
  };
  $('#overlay-result').classList.add('hidden');
  show('game');
  lastT = performance.now();
  stopLoop();
  rafId = requestAnimationFrame(loop);
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  update(dt);
  render();
  rafId = requestAnimationFrame(loop);
}

function swayOff() {
  const w = weaponOf(P());
  const amp = w.sway * (G.scoped ? 5 : 2.5);
  const t = G.t;
  return {
    x: Math.sin(t * 1.3) * amp + Math.sin(t * 2.7) * amp * 0.4,
    y: Math.cos(t * 1.9) * amp * 0.8,
  };
}
function aimPoint() {
  const s = swayOff();
  return { x: G.cross.x + s.x, y: G.cross.y + s.y };
}

function update(dt) {
  G.t += dt;
  /* taramalı silah: ateş basılı tutuldukça seri atış */
  if (autoFiring && !G.over && weaponOf(P()).auto) fire(true);
  G.flash = Math.max(0, G.flash - dt * 1.2);
  G.shake = Math.max(0, G.shake - dt * 14);
  if (G.tracer) { G.tracer.t -= dt; if (G.tracer.t <= 0) G.tracer = null; }
  G.floats.forEach(f => { f.t -= dt; f.y -= 14 * dt; });
  G.floats = G.floats.filter(f => f.t > 0);
  let alive = 0;
  for (const e of G.es) {
    e.shotT = Math.max(0, e.shotT - dt);
    if (e.dead) { e.deadT += dt; continue; }
    alive++;
    if (G.L.move !== 'static') {
      e.x += G.L.speed * G.L.size * e.dir * dt;
      if (e.x < e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      if (e.x > e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
      e.phase += dt * (G.L.move === 'run' ? 11 : 6);
    }
    if (G.L.shootBack && !G.over) {
      e.fireT -= dt;
      if (e.fireT <= 0) enemyFire(e);
    }
  }
  G.alive = alive;
  if (!G.over && alive === 0) {
    G.over = true;
    setTimeout(() => finish(true), 900);
  }
  updateHUD();
}

function enemyFire(e) {
  e.shotT = 0.12;
  e.fireT = G.L.fireEvery * (0.7 + Math.random() * 0.6);
  const dmg = Math.max(1, Math.round(G.L.dmg * (1 - armorReduce(P()))));
  G.php -= dmg;
  G.flash = 0.4;
  G.shake = 6;
  SFX.hurt();
  G.floats.push({ x: PLAYER_POS.x + 26, y: PLAYER_POS.y - 100, txt: '-' + dmg, t: 1, col: '#ff6666' });
  if (G.php <= 0) {
    G.php = 0;
    G.over = true;
    setTimeout(() => finish(false), 700);
  }
}

function fire(isAuto) {
  if (!G || G.over) return;
  const w = weaponOf(P());
  if (G.t - G.lastShot < w.cd) { if (!isAuto) SFX.dry(); return; }
  G.lastShot = G.t;
  SFX.shoot(w);
  G.shake = Math.max(G.shake, w.auto ? 1.5 : 3);
  const a = aimPoint();
  if (w.auto) { /* tarama saçılması */
    a.x += (Math.random() - 0.5) * 16;
    a.y += (Math.random() - 0.5) * 12;
  }
  G.tracer = { x: a.x, y: a.y, t: 0.08 };
  let hitAny = false;
  for (const e of G.es) {
    if (e.dead) continue;
    const r = e.h * 0.13, hy = e.y - e.h + r;
    const dHead = Math.hypot(a.x - e.x, a.y - hy);
    const inBody = Math.abs(a.x - e.x) < e.h * 0.18 && a.y > e.y - e.h && a.y < e.y;
    if (dHead < r * 1.6 || inBody) {
      hitAny = true;
      const head = dHead < r * 1.6;
      const dmg = Math.round(w.dmg * (head ? 2 : 1));
      e.hp -= dmg;
      G.floats.push({ x: e.x, y: e.y - e.h - 8, txt: (head ? 'KAFA! ' : '') + '-' + dmg, t: 1, col: head ? '#ffd24a' : '#ffffff' });
      if (e.hp <= 0) {
        e.dead = true;
        SFX.kill();
        const b = 20 + G.n * 3;
        G.bonus += b;
        G.floats.push({ x: e.x, y: e.y - e.h - 22, txt: '+' + b, t: 1.2, col: '#9dff4a' });
      } else SFX.hit();
      break;
    }
  }
  if (!hitAny) {
    /* ıskaladın: nişancılar tetiklenir */
    if (G.L.shootBack) for (const e of G.es) if (!e.dead) e.fireT = Math.min(e.fireT, 0.9 + Math.random() * 0.6);
    if (a.y > GROUND - 3) G.floats.push({ x: a.x, y: GROUND - 6, txt: '·', t: 0.7, col: '#888888' });
  }
}

function finish(win) {
  stopLoop();
  const p = P();
  const ov = $('#overlay-result');
  ov.innerHTML = '';
  const h2 = document.createElement('h2');
  const line = document.createElement('p');
  if (win) {
    const total = G.L.reward + G.bonus;
    p.coins += total;
    const wasNew = G.n === p.level && p.level < LEVEL_COUNT;
    if (wasNew) p.level++;
    DB.save();
    SFX.win();
    h2.textContent = G.n === LEVEL_COUNT ? 'TÜM GÖREVLER TAMAM!' : 'GÖREV TAMAM';
    line.textContent = 'ÖDÜL: $' + G.L.reward + ' + BONUS $' + G.bonus + ' = $' + total;
  } else {
    SFX.lose();
    h2.textContent = 'VURULDUN';
    h2.className = 'fail';
    line.textContent = 'HEDEF ' + (G.es.length - G.alive) + '/' + G.es.length;
  }
  ov.appendChild(h2); ov.appendChild(line);
  const mkBtn = (txt, fn, big) => {
    const b = document.createElement('button');
    b.className = 'btn' + (big ? ' big' : '');
    b.textContent = txt;
    b.onclick = () => { SFX.click(); fn(); };
    ov.appendChild(b);
  };
  if (win && G.n < LEVEL_COUNT) mkBtn('SONRAKİ BÖLÜM ▶', () => startLevel(G.n + 1), true);
  if (!win) mkBtn('TEKRAR DENE', () => startLevel(G.n), true);
  mkBtn('BÖLÜMLER', () => show('levels'));
  ov.classList.remove('hidden');
}

function updateHUD() {
  const p = P();
  $('#hp-fill').style.width = G.php + '%';
  $('#hud-info').textContent = 'BÖLÜM ' + G.n + ' · HEDEF ' + G.alive + '/' + G.es.length;
  $('#hud-coins').textContent = '$' + p.coins + (G.bonus ? ' +' + G.bonus : '');
  $('#hud-weapon').textContent = weaponOf(p).name;
  $('#btn-fire').classList.toggle('cd', G.t - G.lastShot < weaponOf(p).cd);
  $('#btn-scope').classList.toggle('on', G.scoped);
}

/* ---------- render ---------- */
function worldToScreen(x, y, z, cx, cy) {
  return { x: (x - cx) * z + W / 2, y: (y - cy) * z + H / 2 };
}

function render() {
  const p = P();
  const w = weaponOf(p);
  let z = 1, cx = W / 2, cy = H / 2;
  if (G.scoped) {
    z = w.zoom;
    cx = G.cross.x;
    cy = G.cross.y;
  }
  const shx = (Math.random() * 2 - 1) * G.shake;
  const shy = (Math.random() * 2 - 1) * G.shake;

  ctx.save();
  ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
  drawScene(p);
  ctx.restore();

  /* ekran-uzayı katmanları */
  const s = swayOff();
  const ret = worldToScreen(G.cross.x + s.x, G.cross.y + s.y, z, cx, cy);
  if (G.scoped) drawScopeMask(ret);
  else drawCrosshair(ret);

  /* yüzen yazılar */
  ctx.font = 'bold 11px "Courier New"';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    const fp = worldToScreen(f.x, f.y, z, cx, cy);
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = f.col;
    ctx.fillText(f.txt, fp.x, fp.y);
  }
  ctx.globalAlpha = 1;

  /* hasar flaşı */
  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(255,30,30,' + (G.flash * 0.5).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  /* grain + vinyet: limbo havası */
  ctx.globalAlpha = 0.55;
  ctx.drawImage(grainCvs, Math.random() * -6, Math.random() * -6, W + 12, H + 12);
  ctx.globalAlpha = 1;
  ctx.drawImage(vignetteCvs, 0, 0);
}

function drawScene(p) {
  /* gökyüzü */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#c9c9c9');
  sky.addColorStop(1, '#8e8e8e');
  ctx.fillStyle = sky;
  ctx.fillRect(-W, -H, W * 3, H * 3);
  /* soluk güneş */
  ctx.fillStyle = 'rgba(238,238,238,0.5)';
  ctx.beginPath(); ctx.arc(500, 66, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e9e9e9';
  ctx.beginPath(); ctx.arc(500, 66, 26, 0, Math.PI * 2); ctx.fill();
  /* uzak tepeler */
  ctx.fillStyle = '#757575';
  ctx.beginPath();
  ctx.moveTo(-W, H);
  SCENERY.hillsFar.forEach(pt => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(W * 2, H);
  ctx.closePath(); ctx.fill();
  /* yakın tepeler */
  ctx.fillStyle = '#565656';
  ctx.beginPath();
  ctx.moveTo(-W, H);
  SCENERY.hillsNear.forEach(pt => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(W * 2, H);
  ctx.closePath(); ctx.fill();
  /* sis bandı */
  ctx.fillStyle = 'rgba(200,200,200,0.14)';
  ctx.fillRect(-W, 240, W * 3, 46);
  /* çıplak ağaçlar (siluet) */
  ctx.strokeStyle = '#2e2e2e';
  ctx.lineCap = 'round';
  for (const t of SCENERY.trees) {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t.x, GROUND + 2);
    const tipX = t.x + t.lean * t.h, tipY = GROUND - t.h;
    ctx.quadraticCurveTo(t.x, GROUND - t.h * 0.6, tipX, tipY);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let b = 0; b < t.br; b++) {
      const fy = GROUND - t.h * (0.45 + b * 0.18);
      const bx = t.x + t.lean * t.h * (0.4 + b * 0.15);
      ctx.beginPath();
      ctx.moveTo(bx, fy);
      ctx.lineTo(bx + (b % 2 ? 18 : -16), fy - 14);
      ctx.stroke();
    }
  }
  /* düşman telegrafı: nişan alma çizgisi */
  for (const e of G.es) {
    if (e.dead || !G.L.shootBack) continue;
    if (e.fireT < 0.7 && !G.over) {
      const pul = 0.25 + 0.35 * Math.abs(Math.sin(G.t * 14));
      ctx.strokeStyle = 'rgba(255,255,255,' + pul.toFixed(2) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.h * 0.72);
      ctx.lineTo(PLAYER_POS.x, PLAYER_POS.y - 60);
      ctx.stroke();
    }
    if (e.shotT > 0) {
      ctx.strokeStyle = 'rgba(255,90,60,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.h * 0.72);
      ctx.lineTo(PLAYER_POS.x, PLAYER_POS.y - 60);
      ctx.stroke();
    }
  }
  /* düşmanlar */
  for (const e of G.es) {
    drawStick(ctx, e.x, e.y, e.h, {
      color: '#101010',
      phase: G.L.move === 'static' || e.dead ? 0.4 : e.phase,
      moveAmp: G.L.move === 'static' ? 0.25 : 1,
      dead01: e.dead ? Math.min(1, e.deadT * 2.2) : 0,
      dir: e.dir,
      rifleAngle: G.L.shootBack && !e.dead
        ? Math.atan2((PLAYER_POS.y - 60) - (e.y - e.h * 0.72), PLAYER_POS.x - e.x)
        : null,
    });
  }
  /* zemin */
  ctx.fillStyle = '#141414';
  ctx.fillRect(-W, GROUND, W * 3, H * 2);
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 1.5;
  for (const g of SCENERY.grass) {
    ctx.beginPath();
    ctx.moveTo(g.x, GROUND + 1);
    ctx.lineTo(g.x + 1.5, GROUND - g.h);
    ctx.stroke();
  }
  /* sniper tepesi: soldaki yüksek uçurum */
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.moveTo(-W, H * 2);
  ctx.lineTo(-W, PLAYER_POS.y + 4);
  ctx.lineTo(-16, PLAYER_POS.y - 3);
  ctx.lineTo(84, PLAYER_POS.y + 1);
  ctx.lineTo(106, PLAYER_POS.y + 34);
  ctx.lineTo(126, GROUND - 26);
  ctx.lineTo(148, GROUND + 8);
  ctx.lineTo(148, H * 2);
  ctx.closePath(); ctx.fill();
  /* uçurum yüzü çentikleri + tepe otları */
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(96, PLAYER_POS.y + 24); ctx.lineTo(112, PLAYER_POS.y + 44);
  ctx.moveTo(112, GROUND - 52); ctx.lineTo(128, GROUND - 34);
  ctx.stroke();
  ctx.strokeStyle = '#0d0d0d';
  for (let gx = 2; gx < 84; gx += 9) {
    ctx.beginPath();
    ctx.moveTo(gx, PLAYER_POS.y); ctx.lineTo(gx + 1.5, PLAYER_POS.y - 5);
    ctx.stroke();
  }
  /* oyuncu: tepeden aşağıya nişan alır */
  const shY = PLAYER_POS.y - 4 - 92 * 0.72;
  const aimA = Math.atan2(G.cross.y - shY, G.cross.x - PLAYER_POS.x);
  drawStick(ctx, PLAYER_POS.x, PLAYER_POS.y - 4, 92, {
    color: '#0a0a0a',
    jacketColor: (JACKETS.find(j => j.id === p.jacket) || {}).color,
    hat: p.hat,
    rifleAngle: clamp(aimA, -0.5, 1.15),
    weapon: weaponOf(p),
    phase: 0.5, moveAmp: 0.3,
  });
  /* iz: atış çizgisi (namlu ucundan) */
  if (G.tracer) {
    const ta = Math.atan2(G.tracer.y - shY, G.tracer.x - PLAYER_POS.x);
    ctx.strokeStyle = 'rgba(255,240,180,' + (G.tracer.t / 0.08 * 0.9).toFixed(2) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(PLAYER_POS.x + Math.cos(ta) * 74, shY + Math.sin(ta) * 74);
    ctx.lineTo(G.tracer.x, G.tracer.y);
    ctx.stroke();
  }
}

function drawCrosshair(r) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x - 10, r.y); ctx.lineTo(r.x - 3, r.y);
  ctx.moveTo(r.x + 3, r.y); ctx.lineTo(r.x + 10, r.y);
  ctx.moveTo(r.x, r.y - 10); ctx.lineTo(r.x, r.y - 3);
  ctx.moveTo(r.x, r.y + 3); ctx.lineTo(r.x, r.y + 10);
  ctx.stroke();
}

function drawScopeMask(r) {
  const R = H * 0.46;
  /* dürbün dışı karartma */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fill('evenodd');
  /* dürbün çemberi */
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.stroke();
  /* artı çizgiler (sallanan nişangahtan geçer) */
  ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(20,20,20,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, H / 2 - R); ctx.lineTo(r.x, H / 2 + R);
  ctx.moveTo(W / 2 - R, r.y); ctx.lineTo(W / 2 + R, r.y);
  ctx.stroke();
  /* nişangah noktası */
  ctx.strokeStyle = '#c00';
  ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/* ---------- girdi ---------- */
let dragging = false, lastPX = 0, lastPY = 0, autoFiring = false;
const wrap = $('#game-wrap');
wrap.addEventListener('pointerdown', e => {
  if (e.target.closest('.hudbtn') || e.target.closest('#overlay-result')) return;
  dragging = true; lastPX = e.clientX; lastPY = e.clientY;
});
window.addEventListener('pointermove', e => {
  if (!dragging || !G) return;
  const rect = cvs.getBoundingClientRect();
  const k = W / rect.width;
  const z = G.scoped ? weaponOf(P()).zoom : 1;
  G.cross.x = clamp(G.cross.x + (e.clientX - lastPX) * k / z, 6, W - 6);
  G.cross.y = clamp(G.cross.y + (e.clientY - lastPY) * k / z, 6, H - 6);
  lastPX = e.clientX; lastPY = e.clientY;
});
window.addEventListener('pointerup', () => { dragging = false; autoFiring = false; });
window.addEventListener('pointercancel', () => { dragging = false; autoFiring = false; });

$('#btn-fire').addEventListener('pointerdown', e => { e.preventDefault(); fire(); autoFiring = true; });
$('#btn-scope').addEventListener('pointerdown', e => {
  e.preventDefault();
  if (G && !G.over) { G.scoped = !G.scoped; SFX.click(); }
});
window.addEventListener('keydown', e => {
  if (!G || $('#screen-game').classList.contains('hidden')) return;
  if (e.code === 'Space') { e.preventDefault(); fire(); }
  if (e.code === 'ShiftLeft' || e.code === 'KeyS') { if (!G.over) G.scoped = !G.scoped; }
});

/* ---------- başlangıç ---------- */
DB.load();
$('#btn-register').addEventListener('click', () => {
  const v = $('#reg-name').value.trim() || 'OYUNCU';
  DB.createPlayer(v.toUpperCase());
  SFX.click();
  show('menu');
});
$('#reg-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#btn-register').click();
});
try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}

if (DB.player()) show('menu');
else show('register');
