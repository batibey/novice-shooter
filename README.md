# NOVICE SHOOTER

Retro atari görünümlü, Limbo tarzı siluet haritalarda geçen bir sniper oyunu.
Hedefler 2 boyutlu çöp adamlar; oyuncu da şapka/ceket ile süslenebilen bir çöp adam.
Tek kod tabanıyla **iOS + Android** (Capacitor) ve tarayıcıda çalışır.

## Teknoloji

- **HTML5 Canvas + saf JavaScript** — motor, çizim, ses (WebAudio ile retro bip/patlama sesleri, ses dosyası yok)
- **Capacitor** — aynı kodu native iOS ve Android uygulamasına paketler
- **Sunucu yok, sıfır işletme maliyeti** — her şey cihazda çalışır

## Çalıştırma (tarayıcıda test)

```bash
npm start          # http://localhost:8137
```

## iOS / Android derleme

```bash
npm install                # Capacitor'ı indirir (bir kez)
npx cap add android        # android/ klasörünü oluşturur
npx cap add ios            # ios/ klasörünü oluşturur (Xcode + CocoaPods gerekir)
npx cap sync               # www/ içeriğini native projelere kopyalar
npx cap open android       # Android Studio ile aç → çalıştır/derle
npx cap open ios           # Xcode ile aç → çalıştır/derle
```

Not: Oyun yatay (landscape) oynanır; dikey tutulursa "telefonu çevir" uyarısı çıkar.
İstenirse native projelerde orientation kilidi eklenebilir
(Android: `AndroidManifest.xml` → `android:screenOrientation="sensorLandscape"`,
iOS: Xcode → Deployment Info → yalnız Landscape işaretle).

## Oynanış

- **Sürükle** → nişan al · **⊕** → dürbün aç/kapat · **◉** → ateş
- Klavye (masaüstü): Boşluk = ateş, S veya Shift = dürbün
- Kafadan vuruş **2x hasar** ("KAFA!")
- Iskalarsan düşman nişancılar hemen karşılık verir; can yeleği + kask hasarı azaltır
- 30 bölüm: 1-3 sabit hedef → 4+ yürüyen → 6+ ateş eden → 12+ koşan;
  bölüm ilerledikçe hedefler uzaklaşır/küçülür (dürbün şart), canları ve hasarları artar

## İçerik

- **21 silah**: ESKİ DOST (15 hasar) → EFSANE (250 hasar) + taramalı MİTRALYÖZ; hasar,
  atış hızı, zoom ve sallanma dengesi silah başına farklı. 9 tanesi **premium** — admin
  hesapta hepsi açık.
- **MİTRALYÖZ (taramalı)**: ateş düğmesi basılı tutulunca seri atış yapar (saçılmalı,
  mermi başına 18 hasar, ~11 mermi/sn); yalnız gerçek parayla alınır (₺249,99).
- **Gerçek para (mağaza) ürünleri**: MİTRALYÖZ (₺249,99), BOZKURT (₺89,99), PANTER (₺189,99)
  silahları ile KOVBOY şapka (₺49,99) ve KAMUFLAJ kıyafet (₺59,99) yalnız gerçek parayla alınabilir
  (`realMoney` alanı, `data.js`). Admin hesapta bunlar da açık. Gerçek satın alma için
  yayında Capacitor IAP eklentisi (App Store / Google Play faturalandırması) bağlanmalı;
  şimdilik admin olmayan oyuncuya "mağaza ürünü" bildirimi gösterilir.
- **Teçhizat**: Can Yeleği I/II/III (%20/%35/%50) + Kask (%15) hasar azaltma
- **Kozmetik**: 5 şapka + 5 kıyafet (çöp adamın üstünde görünür)

## DB (minimalist)

`www/js/db.js` — cihaz-içi kalıcı depolama (localStorage; Capacitor WebView'da kalıcıdır).
Tek tablo `players`:

```
{ id, name, isAdmin, coins, level,            ← oyuncu kaydı + kaldığı bölüm
  ownedWeapons, ownedHats, ownedJackets, ownedGear,
  equippedWeapon, hat, jacket, vest, helmet, createdAt }
```

- Konsoldan sıfırlama: `dbReset()`
- **Admin modu**: `www/js/data.js` içinde `ADMIN_MODE = true` — kayıt olan oyuncu admin
  olur, tüm silah/premium/kozmetik ücretsiz açılır. Yayın sürümünde `false` yapın.

## Dosya yapısı

```
www/
  index.html        ekranlar: kayıt, menü, bölümler, cephanelik, teçhizat, karakter, oyun
  css/style.css     retro CRT teması (yeşil-siyah, tarama çizgileri)
  js/data.js        silahlar, kozmetikler, zırh, bölüm üretici (makeLevel)
  js/db.js          oyuncu DB'si
  js/game.js        motor: sahne, çöp adam çizimi, nişan/dürbün/atış, düşman YZ, HUD
capacitor.config.json
package.json
```
