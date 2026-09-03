/* Novice Shooter — minimalist DB
   Cihaz-içi kalıcı depolama (localStorage) üzerinde tek tablo: players.
   Capacitor ile paketlendiğinde native WebView içinde kalıcıdır; sunucu gerektirmez.
   Şema: { players: [ {id, name, isAdmin, coins, level, ownedWeapons, ownedHats,
           ownedJackets, ownedGear, equippedWeapon, hat, jacket, vest, helmet, createdAt} ],
           activePlayerId } */
'use strict';

const DB = {
  KEY: 'novice_shooter_db_v1',
  data: null,

  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this.data = null; }
    if (!this.data || !Array.isArray(this.data.players)) {
      this.data = { players: [], activePlayerId: null };
    }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  createPlayer(name) {
    const p = {
      id: Date.now(),
      name,
      isAdmin: ADMIN_MODE,
      coins: 1500,
      level: 1,               // açık olan en yüksek bölüm
      ownedWeapons: [1],
      ownedHats: ['none'],
      ownedJackets: ['none'],
      ownedGear: [],          // 'vest1','vest2','vest3','helmet'
      equippedWeapon: 1,
      hat: 'none',
      jacket: 'none',
      vest: 0,                // 0 = yok, 1-3 = yelek seviyesi
      helmet: false,
      createdAt: new Date().toISOString(),
    };
    this.data.players.push(p);
    this.data.activePlayerId = p.id;
    this.save();
    return p;
  },

  player() {
    return this.data.players.find(p => p.id === this.data.activePlayerId) || null;
  },

  reset() {
    localStorage.removeItem(this.KEY);
    this.load();
  },
};

/* konsoldan sıfırlamak için: dbReset() */
window.dbReset = () => { DB.reset(); location.reload(); };
