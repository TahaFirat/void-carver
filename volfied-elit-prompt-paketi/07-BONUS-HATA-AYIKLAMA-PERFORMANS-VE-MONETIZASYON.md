# BONUS PROMPTLAR: Geometri Hata Ayıklama (Edge-Case), 120 FPS Performans ve Gelir Modeli (AdMob & IAP)

Geliştirme sırasında karşılaşabileceğiniz en zorlu teknik köşe durumlarını (edge-case) nokta atışı çözmek veya oyuna **ödüllü reklam / uygulama içi satın alma** eklemek istediğinizde aşağıdaki cerrahi promptları tek tek kullanabilirsiniz.

## Bonus Prompt 1: İçbükey Poligon ve Mikro-Boşluk (Corner Glitch) Cerrahi Yaması

Orijinal 1989 ve Amiga portlarında bile `%99` kesim denerken çarpışma hassasiyeti hataları yaşanabildiği incelemelerde belgelenmiştir ([Amiga Reviews - Volfied](https://www.amigareviews.leveluphost.com/volfied.htm)). Aşağıdaki prompt, poligon kesme motorunda oluşabilecek tüm köşe hatalarını giderir:

```markdown
# GÖREV: POLİGON KESME VE KENAR HAREKETİ EDGE-CASE DENETİMİ VE SERTLEŞTİRME

`src/geometry/PolygonSplitter.ts` ve `src/entities/PlayerShip.ts` dosyalarını aşağıdaki 5 sınır durumuna (edge-case) karşı denetle, birim testlerini yaz ve olası hataları düzelt:

1. **Aynı Kenar Üzerinde Başlayıp Biten Kesimler (`Same-Edge Split`):**
   - `P_start` ve `P_end` noktaları `activePolygon`'un AYNI doğru parçası üzerindeyse, köşe ekleme sırasının (`dist(V_i, P_start)` ile `dist(V_i, P_end)` karşılaştırması) yönelim (`CW/CCW`) hatası üretmediğini kanıtla.
2. **Tam Köşe Noktasından (`Vertex-to-Vertex`) Kesim:**
   - Oyuncu tam bir poligon köşesindeyken içeri girerse veya kesimi tam bir mevcut köşede bitirirse, `0` uzunluklu çift köşe (`duplicate vertex`) oluşmasını engelle (`dedupeVertices`).
3. **Sıfır Kalınlıklı Koridor / Kendine Teğet Kesim:**
   - Oyuncu mevcut bir kenara `2px` mesafeden paralel gidip dönerse oluşabilecek dejenere ince şeritlerde Boss veya minyonların sıkışmaması için minimum kesim adımı (`MIN_SEGMENT_LEN = 4px`) kuralını uygula.
4. **Boss Sıkışma Koruması (`Boss Anti-Stuck Solver`):**
   - Oyuncu Boss'un hemen yanından teğet kesim yaptığında yeni duvar Boss'un `boundingRadius` çemberini keserse, Boss'u `activePolygon` içine doğru en yakın geçerli noktaya yumuşakça (`lerp` ile 3 karede) kaydır; Boss asla `activePolygon` dışına çıkmasın.
5. **T-Kavşağı Temizliği:**
   - Ele geçirilen alan silindikten sonra `activePolygon` çevresinde kalan `180°` düz açılı gereksiz ara noktaları (`collinear vertices`) her kesim sonunda birleştir ki kenar sayısı yüzlerce parçaya şişmesin.
```

## Bonus Prompt 2: 120Hz ProMotion (iPhone Pro / Android Flagship) ve Pil Optimizasyonu

```markdown
# GÖREV: 120Hz EKRAN AKICILIĞI, BELLEK SIFIR-TAHSİS (ZERO-ALLOCATION) VE PİL OPTİMİZASYONU

Mobil cihazlarda ısınmayı önlerken 60Hz ve 120Hz ekranlarda pürüzsüz görüntü sağlamak için render ve fizik döngüsünü optimize et:

1. **İnterpolasyonlu Render (`State Interpolation`):**
   - Fizik sabit `60 Hz` (`FIXED_DT = 1/60`) çalışırken, `120 Hz` ekranlarda titreme (`judder`) olmaması için gemi, Boss ve fitil konumlarını `alpha = accumulator / FIXED_DT` katsayısıyla bir önceki ve mevcut fizik karesi arasında doğrusal enterpole ederek çiz (`renderX = prevX + (currX - prevX) * alpha`).
2. **Önbellekli Arka Plan Katmanları (`Offscreen Layer Caching`):**
   - Her karede tüm `claimedPolygons` dizisini baştan çizmek yerine, üst uzaylı katmanını tek bir `OffscreenCanvas` (veya yardımcı `HTMLCanvasElement`) üzerinde tut; her yeni kesimde SADECE yeni ele geçirilen tek poligonu `ctx.globalCompositeOperation = 'destination-out'` ile bu katmandan oy! Böylece 50 kesim sonrasında bile çizim maliyeti `O(1)` kalsın.
3. **`devicePixelRatio` Sınırlaması:**
   - Retina ekranlarda keskin görüntü verirken GPU dolum oranını (`fill-rate`) korumak için `const dpr = Math.min(window.devicePixelRatio || 1, 2);` sınırını uygula.
```

## Bonus Prompt 3: Opsiyonel Gelir Modeli (Ödüllü Kalkan Yenileme Reklamı + "Reklamları Kaldır" IAP)

Oyunu ücretsiz indirilebilir (*Free-to-Play*) yayınlayıp gelir elde etmek isterseniz Faz 4 sonrasında bu promptu çalıştırabilirsiniz:

```markdown
# GÖREV: OYUNCU DOSTU MONETİZASYON — ÖDÜLLÜ REKLAM (ADMOB) VE REKLAMLARI KALDIRMA (IAP) MİMARİSİ

Oyunun akışını bozmayan, mağaza politikalarına %100 uyumlu hibrit gelir katmanını soyutlanmış servisler (`src/services/MonetizationService.ts`) üzerinden kur:

1. **Zorla Gösterilen Reklam Yok, Sadece Ödüllü İkinci Şans (`Rewarded Revive`):**
   - Oyuncu son canını kaybettiğinde her bölümde en fazla **1 kez** beliren *"Kalkanı Aşırı Yükle (+1 Can & Tam Kalkan — Kısa Video İzle)"* seçeneği ekle.
   - Web'de simüle edilmiş test modunda çalışsın; yerel platformda `@capacitor-community/admob` üzerinden resmi Google test ID'leriyle yapılandırılsın (kullanıcı kendi üretim AdMob App ID ve Rewarded Unit ID değerlerini `.env` dosyasından girebilsin).
   - **iOS ATT (`AppTrackingTransparency`) ve `PrivacyInfo.xcprivacy` Uyumu:** Eğer AdMob aktif edilirse, iOS'ta reklam yüklenmeden önce ATT izni isteyen akışı ve `PrivacyInfo.xcprivacy` güncelleme yönergesini ekle.
2. **Tek Seferlik Premium Paket (`Remove Ads + Elite Ship Pack`):**
   - RevenueCat (`@revenuecat/purchases-capacitor`) veya yerel mağaza köprüsü için hazır `PurchaseAdapter` arayüzü oluştur: Satın alındığında "İkinci Şans" özelliğini reklamsız ücretsiz hale getirir ve Hangar'daki özel *Quantum Sovereign* gemisini açar.
   - Apple App Store zorunluluğu olan **"Satın Alımları Geri Yükle" (`Restore Purchases`)** butonunu Ayarlar ve Hangar ekranına görünür şekilde yerleştir.
```
