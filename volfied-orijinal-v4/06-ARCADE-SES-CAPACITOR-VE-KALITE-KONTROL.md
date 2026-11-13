# ADIM 6 PROMPTU: 1989 Arcade Ses Sentezi, Mağaza İkonu ve Görsel Kalite Kontrolü

Projeyi sıfır hatayla tamamlamak için ses motorunu, `T` zaman dondurma efektini, Capacitor mağaza varlıklarını ve canlı tarayıcı kabul testlerini çalıştıran son adımdır.

## Uygulanacak Ses, İkon ve Doğrulama Spesifikasyonu

```markdown
# GÖREV 6: `SoundEngine.ts`, PİKSEL MAĞAZA İKONU VE CANLI GÖRSEL KABUL TESTİ

## 1. 1989 TAITO FM-SYNTH TARZI TOK ARCADE SESLERİ (`SoundEngine.ts`)
Kulak tırmalamayan, sıcak YM2151 / Taito B-System tarzı FM-benzeri Web Audio sentezlemesi kur:
- Kenarda kayarken hafif uzay gemisi reaktör nabzı.
- Kesim yaparken gerilimi hissettiren turuncu lazer tınısı (geri sarma `Backtrack` yapılırken perde yumuşakça alçalır).
- Alan kapatıldığında tok, doyurucu zırh çözülme sesi; içeride böcek sıkıştırıldıysa klasik artan perdeli arcade bonus arpeji!
- `T` (Zaman Dondurma) alındığında 10 saniye boyunca düşmanlar donar ve oyun alanı orijinal oyundaki gibi hafif siyah-beyaz (monokrom) tona geçer, son 2 saniyede renk geri gelir.

## 2. 16-BİT PİKSEL MAĞAZA İKONU VE SPLASH (`scripts/generate-placeholder-assets.mjs`)
- `1024x1024` opak PNG mağaza ikonunu ve `2732x2732` splash ekranını yeni 16-bit piksel-art yeşil ızgara gezegen, altın çerçeve ve turuncu lazer izi bırakan çift çatallı `Monotros` gemisiyle üret; `npx capacitor-assets generate` ve `npx cap sync` çalıştır.

## 3. OTOMATİK DENETİM VE TARAYICI KABUL KONTROLÜ (`scripts/volfied-v4-audit.mjs`)
1. `src/` içinde `CREDIT`, `FREE PLAY`, `CONTROL DECK`, `WASD`, `ELİT FİLO` veya `[ KİLİTLİ ]` metinlerinin kalmadığını ve `PixelArtEngine` içinde `imageSmoothingEnabled = false` kullanıldığını doğrulayan betiği çalıştır.
2. `npm test` (çizgi geri sarma `Backtrack` testi dahil), `npm run build` ve `npm run preflight` komutlarının sıfır hatayla geçtiğini doğrula.
3. `localhost:5173` üzerinde hem **Ana Menü** hem **Bölüm 1, 6, 8 ve 12** ekran görüntülerini alıp `volfied-orijinal-v4/referans-gorseller/01-hedef-oynanis.jpg` ve `02-hedef-ana-menu.jpg` ile karşılaştır:
   - [ ] Ana menüde yeşil ızgara gezegen + krom `VOID CARVER` + `OYNA • BÖLÜM XX` + sadece rakam ve yıldız/kilit içeren `01..16` perçinli kutular + `GEMİLER` / `AYARLAR` birebir görünüyor mu?
   - [ ] Oyun alanında kesim çizgileri %100 `90°` dik açılı turuncu piksel çizgi, güvenli sınırlar parlak yeşil (`#28E038`) piksel çizgi, bloklar kırmızı mücevherli gri/altın kareler ve Boss/böcekler `1px` siyah konturlu gerçek 16-bit piksel-art olarak görünüyor mu?
   - [ ] Alt kontrol alanında ortadaki yazı kutusu tamamen kalkmış, sadece sol kırmızı topuzlu arcade kol ve sağ kırmızı `KES` butonu kalmış ve gemi kenarlarda asla kırpılmadan tam görünüyor mu?
```
