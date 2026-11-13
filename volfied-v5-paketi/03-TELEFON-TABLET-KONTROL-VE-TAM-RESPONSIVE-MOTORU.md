# ADIM 3 PROMPTU: Telefon/Tablet İçin Yeni Sezgisel Kontrol ve %100 Evrensel Responsive Motoru

Hem küçük ekranlı bir iPhone'da, hem dev bir 13 inç iPad Pro'da (dikey ve yatay), hem de masaüstü tarayıcıda oyunun **sıfır siyah boşluk israfı, sıfır kayma ve maksimum kontrol kolaylığıyla** çalışması için kontrol sistemini ve ekran yerleşim motorunu yeniliyoruz.

## Uygulanacak Kontrol ve Responsive Spesifikasyonu

```markdown
# GÖREV 3: `src/input/TouchControls.ts` VE `src/core/ResponsiveLayout.ts` İNŞASI

## 1. YENİ ANLAŞILIR 4-YÖNLÜ TELEFON & TABLET KONTROLÜ (`TouchControls.ts`)
Eski yuvarlak topuzlu kolu kaldır; yerine `01-hedef-duvar-kutu-ve-yeni-kontrol.jpg` görselindeki **ilk bakışta anlaşılan 4-Yönlü Işıklı Yön Tuşları + Akıllı `KES` sistemini** kur:

1. **Sol 4-Yönlü Ayrık Işıklı D-Pad (`▲`, `▼`, `◀`, `▶`):**
   - Artı (`+`) diziliminde 4 adet büyük, pahlı, birbirinden net ayrılmış kare-yuvarlatılmış yön butonu (`buttonSize` cihaz boyutuna göre dinamik ölçeklenir; minimum dokunma alanı `56x56 CSS px`!).
   - **Kesintisiz Parmak Kaydırma (`Thumb-Slide`):** Oyuncu parmağını `▲` tuşuna koyup kaldırmadan sola `◀` kaydırdığında anında sola geçer! Ayrıca 4 tuşun ortasındaki boşluğa dokunup herhangi bir yöne `10px` çekmek de o yön tuşunu yakar (hem tuş hissi hem joystick akıcılığı bir arada!).
   - **Anlık Renk Geri Bildirimi:** Basılı olan yön tuşu kenarda yürürken parlak **Yeşil (`#28E038`)**, sahanın içini keserken parlak **Turuncu (`#FF8818`)** yanar!
2. **Gemi Üzerinde "İçeri Yön" Ok İpucu (`Inward Direction Hint`):**
   - Gemi güvenli yeşil sınır üzerinde dururken veya yürürken, sahanın içine (kesilebilir alana) bakan tarafında küçük, net bir piksel ok ucu (`▸`) görünür. Böylece yeni başlayan bir oyuncu bile hangi yön tuşunun sahanın içine gireceğini anında anlar!
3. **Sağ Büyük `KES` Butonu + `[OTOMATİK]` Tek-El Anahtarı:**
   - Sağ başparmak altında geniş, çok rahat basılan yeşil-turuncu piksel çerçeveli **`KES`** butonu bulunur.
   - Hemen sağ altında küçük, dokunulabilir **`[OTOMATİK]`** anahtarı (`StorageService` ile kaydedilir) yer alır:
     - **Kapalıyken (Varsayılan Klasik 2-El Modu):** Yön tuşları kenarda güvenle gezdirir; `KES` basılı tutulurken (veya bas-kilitle) içeri yön verildiğinde kesim başlar.
     - **Açıkken (Tek-El Kolay Mod):** `KES` tuşuna basmaya gerek kalmadan, kenardayken sahanın içine bakan ok tuşuna `0.10 sn` basmak doğrudan kesimi başlatır! Ayrıca doğrudan oyun sahası üzerinde parmak kaydırma (`Swipe`) da her zaman desteklenir!

## 2. `%100` HER CİHAZ İÇİN EVRENSEL RESPONSIVE MOTOR (`src/core/ResponsiveLayout.ts`)
Sabit `900 x 1600` kutuyu merkeze sıkıştıran eski ölçeklemeyi kaldır! Yerine şu dinamik yerleşim mimarisini kur:

### Temel Prensip: Sabit Oyun Matematiği + Esnek Ekran Kabuğu
- **Oyun Fiziği ve Harita Koordinatları (`WORLD_W = 540`, `WORLD_H = 720` — tam `3:4` oran, `270 x 360` yerel Taito pikseli x `2`):** Hangi telefon, tablet veya bilgisayar olursa olsun oyun mantığı bu sabit `3:4` koordinat uzayında çalışır (böylece kutu aralıkları ve Boss hızları her cihazda %100 adildir!).
- **Kanvas Boyutu:** `<canvas>` elemanı her zaman tam `window.visualViewport` (`100dvw x 100dvh`) boyutuna ve `dpr = Math.min(window.devicePixelRatio || 1, 3)` keskinliğine dinamik ayarlanır (`resize`, `orientationchange`, `visualViewport.resize` dinleyicileriyle). Safe-area değerleri CSS değişkenlerinden (`--sat: env(safe-area-inset-top)` vb.) okunarak JS tarafına aktarılır.

### 3 Otomatik Cihaz Yerleşim Modu (`computeLayout(vw, vh, safeArea)`)

1. **`PHONE_PORTRAIT` (`vw / vh < 0.72` — iPhone SE, iPhone 12/13/14/15/16/Pro Max, Tüm Dikey Android Telefonlar):**
   - Üstte `safeArea.top` altında Skor/Rekor/Duraklat şeridi.
   - Ortada genişliği ekran genişliğine (`vw - 16px`) veya kalan yüksekliğe tam oturan (`Math.min(availW, availH * 0.75)`) maksimum büyüklükte Altın Çerçeveli Oyun Alanı!
   - Hemen altında tek satır Bölüm/Yüzde/Kalkan şeridi.
   - En altta (`safeArea.bottom` üstünde) sol `▲▼◀▶` D-Pad ve sağ `KES` + `[OTOMATİK]` kontrol güvertesi (`01-hedef-duvar-kutu-ve-yeni-kontrol.jpg`).

2. **`TABLET_PORTRAIT` (`0.72 <= vw / vh <= 1.12` — iPad Mini, iPad Air, iPad Pro 11" & 13" Dikey, Galaxy Z Fold Açık Ekran):**
   - Geniş dikey tabletlerde kontrolleri ekranın ortasına koymak başparmak erişimini bozar.
   - Bu modda `▲▼◀▶` D-Pad sol-alt köşeye (`left: safeLeft + 28px, bottom: safeBottom + 32px`), `KES` butonu sağ-alt köşeye (`right: safeRight + 28px, bottom: safeBottom + 32px`) ergonomik olarak kenetlenir; oyun alanı üst-orta bölgede dev ve jilet keskinliğinde (`integer / crisp pixel scale`) yer alır!

3. **`LANDSCAPE_SPLIT` (`vw / vh > 1.12` — Yatay Telefon, Yatay iPad, Masaüstü Web — `03-hedef-ipad-ve-yatay-responsive.jpg` Birebir!):**
   - Cihaz yatay çevrildiğinde oyun **kesintisiz olarak 3 Sütunlu Atari Kabini Yerleşimine** geçer:
     - **Sol Kanat (`Left Wing`):** Sol üstte Kademe/Bölüm ve Can ikonları, sol altta başparmağın tam altına gelen `▲▼◀▶` D-Pad!
     - **Merkez (`Center Arena`):** Ekran yüksekliğinin `%92`'sini kaplayan tam boy Altın Çerçeveli Oyun Alanı!
     - **Sağ Kanat (`Right Wing`):** Sağ üstte Skor, Rekor, `%` Hedef, Kalkan ve `❚❚` butonu; sağ altta büyük `KES` + `[OTOMATİK]` butonu!
   - Ana Menü ve Bölüm Seçim ekranı da `LANDSCAPE_SPLIT` modunda otomatik 2 sütunlu (solda Gezegen Logosu + `DEVAM ET`, sağda 4 Kademe Sekmesi + `5x5` Bölüm Izgarası) düzene geçer!
```
