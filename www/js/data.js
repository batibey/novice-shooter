/* Novice Shooter — oyun verileri */
'use strict';

/* Admin modu: aktifken tüm silahlar, premium içerik ve kozmetikler ücretsiz açık. */
const ADMIN_MODE = true;

/* 20 silah: düşük hasarlıdan efsaneviye.
   dmg: hasar, cd: atışlar arası süre (sn), zoom: dürbün yakınlaştırma,
   sway: nişangah sallanması (düşük = stabil), price: oyun içi para, premium: ücretli silah */
const WEAPONS = [
  { id: 1,  name: 'ESKİ DOST',   dmg: 15,  cd: 2.6, zoom: 2.0, sway: 2.4, price: 0,     premium: false },
  { id: 2,  name: 'ÇAKARALMAZ',  dmg: 20,  cd: 2.5, zoom: 2.2, sway: 2.2, price: 400,   premium: false },
  { id: 3,  name: 'İZCİ',        dmg: 26,  cd: 2.4, zoom: 2.5, sway: 2.0, price: 900,   premium: false },
  { id: 4,  name: 'AVCI',        dmg: 32,  cd: 2.3, zoom: 2.8, sway: 1.9, price: 1500,  premium: false },
  { id: 5,  name: 'KESKİN GÖZ',  dmg: 38,  cd: 2.2, zoom: 3.0, sway: 1.8, price: 2400,  premium: false },
  { id: 6,  name: 'BOZKURT',     dmg: 45,  cd: 2.1, zoom: 3.2, sway: 1.7, price: 3500,  premium: false, realMoney: '₺89,99' },
  { id: 7,  name: 'ŞAHİN',       dmg: 52,  cd: 2.0, zoom: 3.5, sway: 1.6, price: 5000,  premium: true  },
  { id: 8,  name: 'KARTAL',      dmg: 60,  cd: 1.9, zoom: 3.8, sway: 1.5, price: 6800,  premium: false },
  { id: 9,  name: 'YILDIRIM',    dmg: 68,  cd: 1.8, zoom: 4.0, sway: 1.4, price: 9000,  premium: false },
  { id: 10, name: 'FIRTINA',     dmg: 77,  cd: 1.7, zoom: 4.2, sway: 1.3, price: 12000, premium: true  },
  { id: 11, name: 'GÖLGE',       dmg: 86,  cd: 1.6, zoom: 4.5, sway: 1.2, price: 15000, premium: false },
  { id: 12, name: 'HAYALET',     dmg: 96,  cd: 1.5, zoom: 4.8, sway: 1.1, price: 18500, premium: true  },
  { id: 13, name: 'KOBRA',       dmg: 107, cd: 1.5, zoom: 5.0, sway: 1.0, price: 22000, premium: false },
  { id: 14, name: 'AKREP',       dmg: 118, cd: 1.4, zoom: 5.5, sway: 0.9, price: 26000, premium: false },
  { id: 15, name: 'PANTER',      dmg: 130, cd: 1.3, zoom: 6.0, sway: 0.8, price: 30000, premium: true,  realMoney: '₺189,99' },
  { id: 16, name: 'EJDER',       dmg: 145, cd: 1.2, zoom: 6.5, sway: 0.7, price: 35000, premium: false },
  { id: 17, name: 'KIYAMET',     dmg: 160, cd: 1.1, zoom: 7.0, sway: 0.6, price: 41000, premium: true  },
  { id: 18, name: 'TİTAN',       dmg: 178, cd: 1.0, zoom: 7.5, sway: 0.5, price: 48000, premium: false },
  { id: 19, name: 'ZEUS',        dmg: 200, cd: 0.9, zoom: 8.0, sway: 0.4, price: 56000, premium: true  },
  { id: 20, name: 'EFSANE',      dmg: 250, cd: 0.8, zoom: 9.0, sway: 0.3, price: 65000, premium: true  },
  /* taramalı: ateş basılı tutulunca seri atış yapar; yalnız gerçek parayla alınır */
  { id: 21, name: 'MİTRALYÖZ',   dmg: 18,  cd: 0.09, zoom: 2.2, sway: 2.6, price: 70000, premium: true, realMoney: '₺249,99', auto: true },
];

/* Kozmetikler — çöp adamı süsleyen şapka ve kıyafetler */
const HATS = [
  { id: 'none',   name: 'YOK',           price: 0,    color: null },
  { id: 'cap',    name: 'KASKET',        price: 300,  color: '#3f6f3f' },
  { id: 'beret',  name: 'BERE',          price: 600,  color: '#7a2a2a' },
  { id: 'cowboy', name: 'KOVBOY',        price: 1200, color: '#6b4a2a', realMoney: '₺49,99' },
  { id: 'top',    name: 'SİLİNDİR',      price: 2500, color: '#1a1a2a' },
  { id: 'crown',  name: 'KRAL TACI',     price: 8000, color: '#e8c02a' },
];
const JACKETS = [
  { id: 'none',  name: 'YOK',            price: 0,    color: null },
  { id: 'yel',   name: 'SARI MONT',      price: 500,  color: '#e8c02a' },
  { id: 'red',   name: 'KIRMIZI CEKET',  price: 900,  color: '#c03a3a' },
  { id: 'blu',   name: 'MAVİ PARKA',     price: 1400, color: '#3a6ac0' },
  { id: 'camo',  name: 'KAMUFLAJ',       price: 2600, color: '#4a5c38', realMoney: '₺59,99' },
  { id: 'gold',  name: 'ALTIN SMOKİN',   price: 9000, color: '#ffd24a' },
];

/* Zırh: can yeleği seviyeleri + kask (gelen hasarı azaltır) */
const VESTS = [
  { lvl: 1, name: 'CAN YELEĞİ I',   reduce: 0.20, price: 1000 },
  { lvl: 2, name: 'CAN YELEĞİ II',  reduce: 0.35, price: 2600 },
  { lvl: 3, name: 'CAN YELEĞİ III', reduce: 0.50, price: 6000 },
];
const HELMET = { name: 'KASK', reduce: 0.15, price: 1800 };

/* Bölümler: zorluk eğrisi.
   1-3: sabit hedef · 4+: yürüyen · 6+: ateş eden · 12+: koşan
   size küçüldükçe hedef uzaklaşır (dürbün şart olur) */
const LEVEL_COUNT = 30;
function makeLevel(n) {
  return {
    n,
    enemies: Math.min(1 + Math.ceil(n / 3), 7),
    move: n >= 4 ? (n >= 12 ? 'run' : 'walk') : 'static',
    shootBack: n >= 6,
    hp: 30 + n * 7,
    dmg: 6 + n * 1.4,
    fireEvery: Math.max(2.2, 5.5 - n * 0.11),
    size: Math.max(0.32, 1 - 0.03 * n),
    speed: n >= 12 ? 34 + n : 16 + n,
    reward: 120 + n * 60,
  };
}
