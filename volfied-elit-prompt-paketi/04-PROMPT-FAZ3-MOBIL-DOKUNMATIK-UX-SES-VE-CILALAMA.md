# FAZ 3 PROMPTU: Mobil-Öncelikli Dokunmatik UX, Web Audio Synth Ses Motoru ve Meta-İlerleme

Klasik arcade oyunlarını ([Volfied - GameFAQs](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)) dokunmatik ekrana taşırken en büyük tehlike **parmağın gemiyi kapatması** ve **90 derecelik keskin dönüşlerde yaşanan gecikmedir**. Ayrıca Apple App Store inceleme ekibinin oyunu "basit bir web demosu" sayıp Guideline 4.2'den reddetmemesi için zengin bir **Kampanya Haritası, Gemi Garajı, Başarımlar ve Kalıcı Kayıt** katmanı şarttır. Bu prompt her ikisini de tek adımda çözer.

## Kopyalanacak Master Prompt ( Faz 3 )

```markdown
# GÖREV: FAZ 3 — MOBİL DOKUNMATİK ERGONOMİSİ, PROSEDÜREL WEB AUDIO SES MOTORU, GÖRSEL EFEKTLER ("JUICE") VE META-SİSTEMLER

Faz 2'de tamamlanan Web oyununu ticari mobil oyun kalitesine taşımak için dokunmatik kontrol mimarisini, sentezleyici ses motorunu, görsel geri bildirimleri ve kalıcı meta-oyun ekranlarını uygula.

## 1. MOBİL-ÖNCELİKLİ DOKUNMATİK KONTROL SİSTEMİ (`src/input/TouchControls.ts`)
Arena (`900 x 1200`) ekranın üst-orta bölümüne yerleşirken, alt `300px` ergonomik başparmak kontrol bölgesi (`Thumb Zone`) olarak ayrılmalı ve parmak ASLA geminin üstünü kapatmamalıdır. Ayarlar menüsünden seçilebilir **3 Kontrol Modu** inşa et:
1. **Mod A — Yüzen Sanal D-Pad + Kesim Anahtarı (Varsayılan Mobil Mod):**
   - Sol/orta alt bölgede parmağın dokunduğu yerde beliren hassas 4-yönlü ortogonal D-Pad (`deadzone = 12px`, diyagonal açıları en baskın eksene `|dx| > |dy|` yuvarlar).
   - Sağ altta büyük `CARVE (KESİM)` butonu: Basılı tutarken (`Hold`) veya tek dokunuşla kilitlemeli (`Toggle` — Ayarlarda seçilebilir) kesim modunu aktif tutar; ayrıca `L` veya `BOSS_CANNON` aktifken otomatik ateşlemeyi tetikler.
2. **Mod B — Tek Başparmak Kaydırma (`One-Thumb Swipe + Auto-Carve`):**
   - Ekranın herhangi bir yerinde kısa kaydırma (`>= 18px`) yön değiştirir. Güvenli kenardayken poligonun içine doğru kaydırma yapıldığında `Cut` tuşuna basmaya gerek kalmadan otomatik kesim başlatır!
3. **Mod C — Masaüstü Klavye & Gamepad API:**
   - `WASD` / Yön tuşları + `Space` / `Shift` + standart HTML5 `navigator.getGamepads()` desteği.

### Kritik Dönüş İyileştirmesi: Köşe Tamponlama (`Corner Turn Buffering`)
- Oyuncu kenar köşesine `16px` mesafedeyken erken dönüş yönüne basarsa, bu girdiyi `120ms` boyunca tamponda (`inputBuffer`) tut ve gemi tam köşe koordinatına ulaştığı karede otomatik döndür.
- Kesim (`STATE_CUTTING`) sırasında yanlışlıkla kendi çizgisine `180°` dönme girdilerini tamamen filtrele.

## 2. PROSEDÜREL WEB AUDIO SYNTHESIZER (`src/audio/SoundEngine.ts`)
Harici ses dosyası kullanmadan, saf `AudioContext` (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, beyaz gürültü tamponu) ile gerçek zamanlı çalışan bir bilimkurgu ses motoru yaz:
- **iOS `WKWebView` Ses Kilidi Açıcı:** İlk `pointerdown` veya `touchstart` olayında `audioCtx.resume()` çağrısı yaparak mobil tarayıcı sessizlik kilidini otomatik aç.
- Üretilecek ses efektleri:
  - `playBorderHum()`: Kenarda hareket ederken hafif fütüristik motor tınısı.
  - `playLaserCutLoop()`: Kesim çizgisi çizerken gerilimi yükselen (`pitch` kesim uzadıkça hafifçe artan) enerji sesi.
  - `playPolygonShatter(percentClaimed)`: Alan ele geçirildiğinde kesilen yüzde büyüklüğüne göre derinleşen kristal kırılma + bas patlama sesi.
  - `playFuseAlarm()`: Çizgiye düşman değip fitil ateşlendiğinde acil durum siren darbesi.
  - `playPowerUp(type)`: Güçlendirme kutusu açıldığında arpej sesi (`BOSS_CANNON` için epik güçlenme efekti).
  - `playLaserShot()` & `playBossHit()` & `playShipExplode()`.
  - Opsiyonel düşük tempolu prosedürel ambiyans katmanı (Ayarlardan Ses Efektleri ve Ambiyans ses seviyeleri ayrı ayrı `%0-%100` kısılabilir, sessize alınabilir).

## 3. GÖRSEL CİLALAMA ("GAME JUICE") VE PERFORMANS
- **Parçacık Havuzu (`Object Pool`):** Çöp toplayıcı (`GC`) takılmalarını önlemek için önceden ayrılmış `300` parçacıklı havuz kullan (`new` ile her kare nesne yaratma).
- Alan ele geçirildiğinde: Kesilen poligon parçası kısa bir neon parlamayla (`180ms`) parçacıklara ayrılarak alttaki gezegen katmanını ortaya çıkarsın; `%20+` büyük kesimlerde `40ms` mikro duraksama (`hit-stop`) ve hafif ekran sarsıntısı (`screen shake`) uygula.
- Kenar kalkanı `%20`'nin altına düştüğünde gemi etrafındaki kalkan halkası kırmızı yanıp sönsün ve uyarı nabzı versin.

## 4. TAM MOBİL META-OYUN VE EKRAN AKIŞI (APP STORE 4.2 UYUMLULUĞU)
Uygulamanın yerel bir mobil oyun derinliğine sahip olması için şu ekranları Canvas/DOM hibrit veya tam Canvas UI olarak, pürüzsüz geçişlerle inşa et:
1. **Ana Menü:** Oyun logosu ("VOID CARVER: SECTOR 80"), *Kampanya (16 Sektör)*, *Sonsuz Arcade Modu (Endless)*, *Gemi Hangarı*, *Başarımlar & İstatistikler*, *Ayarlar*.
2. **Sektör Seçim Haritası (16 Bölüm):** Geçilen bölümler, kazanılan Yıldızlar (`1-3 ★`), her bölümdeki en yüksek kesim yüzdesi (`Best %`) ve en yüksek skor.
3. **Zorluk Seçimi:** *Keşif (Kolay)*, *Komutan (Normal)*, *Efsane (Zor — klasik arcade zorluğu, tüm 16 bölüm açık)* ([Volfied - Internet Archive](https://archive.org/details/arcade_volfied)).
4. **Gemi Hangarı (Oyun İçi Yıldızlarla Açılan Kozmetikler):** Gerçek para gerektirmeden bölümlerden toplanan yıldızlarla açılan 5 farklı özgün gemi gövdesi ve kesim izi rengi (Neon Cyan, Solar Amber, Plasma Violet, Emerald Grid, Crimson Nova).
5. **Soyutlanmış Kayıt Servisi (`src/services/StorageService.ts`):** Şimdilik `localStorage` kullanan fakat Faz 4'te `@capacitor/preferences` ile tek satırda değiştirilebilecek `async get/set` arayüzü ile tüm ilerlemeyi, açılan gemileri, rekorları ve kontrol/ses ayarlarını kaydet.
6. **Duraklatma (Pause) ve Odak Kaybı:** `visibilitychange` veya `blur` olayında oyunu otomatik duraklat (mobilde telefon çaldığında oyuncunun yanmasını önler).

## 5. KABUL KRİTERLERİ
- Chrome DevTools mobil cihaz simülasyonunda (iPhone 15 Pro ve Pixel 8 boyutlarında) dikey modda hiçbir UI taşması olmadığını, parmağın gemiyi kapatmadığını ve `npm run build` çıktısının hatasız üretildiğini doğrula.
```
