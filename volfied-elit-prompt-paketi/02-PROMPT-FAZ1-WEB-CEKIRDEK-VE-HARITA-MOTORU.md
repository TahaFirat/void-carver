# FAZ 1 PROMPTU: Web Çekirdek Oyun Motoru, Poligon Kesme Geometrisi ve Kalkan/Fitil Fiziği

Bu dosyadaki promptu **Cursor, Claude Code, Windsurf veya tercih ettiğiniz AI kodlama ajanına** ilk adım olarak doğrudan kopyalayıp yapıştırın. Bu faz, oyunun en kritik matematiksel kalbi olan **hatasız poligon kesme, bariyerli kenar hareketi, katmanlı arka plan açma, kalkan sayacı ve yanma fitili (`Fuse/Spark`)** motorunu Web üzerinde çalışır halde kurar.

## Kopyalanacak Master Prompt ( Faz 1 )

```markdown
# GÖREV: FAZ 1 — "VOID CARVER" WEB ÇEKİRDEK MOTORU VE ORTOGONAL POLİGON KESME MİMARİSİ

`@01-VOLFIED-OYUN-HARITA-VE-LEVEL-ANALIZI.md` dosyasındaki oyun kurallarını temel alarak, Vite + TypeScript + HTML5 Canvas 2D tabanlı, sıfır harici oyun motoru bağımlılığına sahip, yüksek hassasiyetli çekirdek oyun motorunu sıfırdan kur.

## 1. PROJE KURULUMU VE DOSYA MİMARİSİ
Vite + TypeScript (`strict: true`) projesi oluştur ve aşağıdaki modüler mimariyi kur:
- `index.html` (mobil tam ekran meta etiketleri: `viewport-fit=cover`, `user-scalable=no`, siyah arka plan)
- `src/main.ts` (uygulama giriş noktası ve responsive ölçekleme)
- `src/core/Config.ts` (sanal çözünürlük `900 x 1200` dikey 3:4 oyun alanı + üst/alt HUD boşluklarıyla toplam `900 x 1500` kanvas, hızlar, renk paleti)
- `src/core/GameLoop.ts` (`requestAnimationFrame`, sabit fizik adımı `FIXED_DT = 1 / 60`, `maxAccumulator = 0.05`)
- `src/geometry/Types.ts` (`Point`, `AxisSegment`, `Barrier`, `SplitResult` tipleri)
- `src/geometry/PolygonMath.ts` (Shoelace alan hesabı, Ray-Casting nokta-poligon testi, nokta-segment izdüşümü, poligon sadeleştirme/kolineer köşe temizleme)
- `src/geometry/PolygonSplitter.ts` (aktif poligonu ortogonal `trail` ile iki kapalı alt poligona bölme algoritması)
- `src/entities/PlayerShip.ts` (kenar üzerinde hareket, bariyer kontrolü, kesim başlatma, iz çizme, kalkan sayacı)
- `src/entities/TrailFuse.ts` (düşman çizgiye değdiğinde temas noktasından doğup `trail` boyunca gemiyi kovalayan yanma fitili)
- `src/rendering/LayerRenderer.ts` (`OffscreenCanvas` veya çift katmanlı Canvas ile üst uzaylı zırh dokusunun kesilen poligonlar boyunca silinip alttaki gezegen/siber katmanın açığa çıkması)
- `src/input/InputManager.ts` (Klavye Ok/WASD + Space/Shift kesim tuşu + temel fare/dokunmatik test girdisi)

## 2. KESİN GEOMETRİ VE HARİTA KURALLARI (SIFIR HATA TOLERANSI)
1. **Tam Sayı Izgara (`GRID_STEP = 2` piksel):**
   - Oyun arenası `x: [0, 900]`, `y: [0, 1200]` aralığındadır.
   - Tüm poligon köşeleri, oyuncu koordinatları ve kesim dönüş noktaları `2` pikselin tam katlarına kenetlenmelidir (`snapToGrid`). Kayan noktalı (`float`) kayma nedeniyle oyuncunun kenardan düşmesi kesinlikle yasaktır.
2. **Kenar Hareketi (`STATE_ON_BORDER`):**
   - `activePolygon`, saat yönünde (`CW`) sıralanmış ortogonal (sadece yatay veya dikey) köşelerden oluşan kapalı tek bir basit poligondur.
   - Oyuncu `STATE_ON_BORDER` durumundayken yalnızca `activePolygon` kenar segmentleri üzerinde kayabilir; köşelere ulaştığında basılı yöne göre komşu segmente pürüzsüzce döner.
3. **Kenar Bariyerleri (`Border Barriers`):**
   - Kenar üzerinde tanımlı metalik bariyer aralıkları vardır. Oyuncu bariyerin üstünden yürüyebilir fakat:
     a) Bariyer üstündeyken içeriye kesim (`STATE_CUTTING`) BAŞLATAMAZ.
     b) İçeriden kesim yaparken bariyerli bir kenar parçasına ÇARPAMAZ (bariyer katı duvar gibi davranır veya gemiyi durdurur; poligonu kapatmaz, sadece bariyersiz geçerli kenar segmentine değdiğinde kesim tamamlanır).
4. **Kesim ve Kendi İzini Kesmeme (`STATE_CUTTING`):**
   - Oyuncu geçerli bir kenardayken `Cut` tuşu basılıyken poligonun **içine** doğru olan dik yöne bastığında `STATE_CUTTING` başlar. (Poligonun dışına/temizlenmiş alana doğru çıkmak yasaktır; iç yönü `pointInPolygon(pos + dir * 2, activePolygon)` ile doğrula).
   - Kesim sırasında 180 derece tam ters yöne basılırsa gemi kendi çizgisinin üstüne binip ölmemeli; ters yön girdisi yok sayılmalıdır.
   - Gemi daha önce çizdiği kendi `activeTrail` segmentlerinden birine `2px` mesafeye kadar yaklaşırsa kendi izini kesmesine izin verme: çizgiyi kesmeden hemen önce durdur (güvenli tampon) ki oyuncu dik yöne dönüp kurtulabilsin.
5. **Poligon Bölme (`PolygonSplitter.split`):**
   - Gemi `activeTrail` ile `activePolygon` üzerindeki geçerli bir `P_end` noktasına değdiği an:
     - `P_start` (bulunduğu kenar indeksi) ve `P_end` (çarptığı kenar indeksi) poligon köşe listesine geçici düğüm olarak eklenir (aynı kenar üzerindelerse sıralamaya dikkat et!).
     - Poligon çevresi üzerinde `P_start -> P_end` ve `P_end -> P_start` yolları çıkarılır, `activeTrail` ile kapatılarak `polyA` ve `polyB` üretilir.
     - Kolineer (aynı doğrultudaki ardışık yatay-yatay veya dikey-dikey) kenarlar tek segmentte birleştirilerek (`simplifyOrthogonalPolygon`) dejenere köşeler temizlenir.
     - Test Boss noktasını (`boss.position`) içeren poligon yeni `activePolygon` olur; diğeri `claimedPolygons` listesine eklenir ve üst katman maskesinden `destination-out` ile silinir!
   - Ele geçirilen alan yüzdesi: `claimedPercent = ((INITIAL_AREA - computeArea(activePolygon)) / INITIAL_AREA) * 100`. `%80.0` ve üzerine ulaşıldığında bölüm geçiş tetiklenir.

## 3. KALKAN SAYACI VE YANMA FİTİLİ (`TRAIL FUSE`) FİZİĞİ
1. **Kenar Kalkanı (`shieldTimer`):**
   - Bölüm başında `99.9` saniyeden (HUD'da klasik Volfied stili `999` birim olarak gösterilir) geriye sayar.
   - `STATE_ON_BORDER` iken `shield > 0` ise test düşmanları gemiye değse de zarar veremez (kalkan parlaması efekti oynar).
   - `shield === 0` olduğunda kalkan halkası kaybolur; kenarda bile düşman teması gemiyi patlatır.
2. **Yanma Fitili (`TrailFuse`):**
   - Faz 1 testi için sahnede 1 adet seken Test Boss ve 3 adet küçük düşman bulundur.
   - Oyuncu `STATE_CUTTING` durumundayken herhangi bir düşman `activeTrail` segmentlerinden birine değerse, kesişim noktasında kırmızı-turuncu kıvılcımlı bir `TrailFuse` doğar.
   - `TrailFuse`, `activeTrail` köşelerini takip ederek oyuncunun normal kesim hızının `1.35x` katı hızla gemiye doğru ilerler. Gemiye ulaşırsa gemi patlar, 1 can eksilir, `activeTrail` silinir ve gemi `P_start` noktasında yeniden doğar. Gemi önce kenara ulaşırsa fitil söner.

## 4. KABUL KRİTERLERİ VE DOĞRULAMA TESTLERİ
Kodu yazdıktan sonra `src/geometry/__tests__/PolygonSplitter.test.ts` (veya dahili bir doğrulama betiği) ile şu 4 senaryoyu doğrula ve `npm run build` çalıştır:
1. Köşeden köşeye düz kesim (dikdörtgeni ikiye bölme).
2. **Aynı kenardan çıkıp aynı kenara dönen U-şekilli kesim** (en sık hata yapılan senaryodur; poligon yönelimini bozmadığını kanıtla).
3. İçbükey (L-şekilli) bir `activePolygon` içinde ikinci ve üçüncü ardışık kesimler.
4. Alan toplamı korunumu: `area(polyA) + area(polyB) === area(originalPoly)` eşitliğinin her kesimde birebir sağlandığını doğrula.
```

## Faz 1 Sonrası Sizin Kontrol Edeceğiniz Noktalar

AI ajanı Faz 1'i tamamladığında `npm run dev` ile oyunu açıp yalnızca şu 3 testi yapın:
- Aynı kenardan içeri girip U dönüşü yaparak tekrar **aynı kenara** bağlandığınızda kestiğiniz küçük kutu temizleniyor mu?
- İçbükey bir köşe oluşturduktan sonra o köşenin üzerinden yürüyebiliyor musunuz?
- Çizginize düşman çarptığında kıvılcım çizgi boyunca sizi kovalıyor mu?

Bu üçü evet ise Faz 2 promptuna geçmeye hazırsınız.
