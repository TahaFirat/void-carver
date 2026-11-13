# V4 16-BİT TAITO PIXEL-ART TABANI (KORUNACAK GRAFİK TEMELİ)

# ADIM 2 PROMPTU: 16-Bit Taito Arcade Pixel-Art Motoru ve 16 Bölüm Haritası (`PixelArtEngine.ts` & `VolfiedTerrains.ts`)

Orijinal 1989 Taito **[Volfied](https://en.wikipedia.org/wiki/Volfied)** ([Arcade Archives](https://www.arcadearchives.com/en/title/aca-301/)) dikey arcade monitöründe düşük çözünürlüklü, keskin pikselli, siyah konturlu ve zengin dokulu 16-bit grafiklerle çalışır. Eski derlemedeki "düz vektör / CSS tuğla" hissini tamamen yok edip **%100 gerçek 1989 Taito atari makinesi görüntüsü** elde etmek için oyunu yerel piksel tamponunda işleyip `imageSmoothingEnabled = false` ile tam sayı (`3x`) büyütüyoruz!

## Uygulanacak Pixel-Art Motoru ve Harita Spesifikasyonu

```markdown
# GÖREV 2: `src/rendering/PixelArtEngine.ts` VE `src/rendering/VolfiedTerrains.ts` İNŞASI

## 1. `src/rendering/PixelArtEngine.ts` — GERÇEK 16-BİT ARCADE RASTERIZER
1. **Keskin Piksel Ölçekleme (`PIXEL_SCALE = 3`):**
   - Oyun alanının iç bölgesi (örn. `810 x 1110` ekran pikseli) yerel olarak **`270 x 370` Taito Arcade Pikseli** çözünürlüğünde önbellekli `HTMLCanvasElement` katmanlarında üretilir ve ana kanvasa çizilirken `ctx.imageSmoothingEnabled = false` zorunlu tutulur! Böylece her piksel jilet gibi net 1989 arcade pikseli olarak görünür, bulanıklaşma sıfırlanır.
2. **2x2 / 4x4 Bayer Dithering ve Palet Niceleme (`bayerDitherColor`):**
   - Pürüzsüz modern CSS gradyanları YASAKTIR! Tüm gölgelendirmeler 16-bit Taito sanatçıları gibi `4..6` kademeli renk paleti ve `2x2` dama-tahtası piksel geçişi (`(px + py) % 2 === 0`) ile piksel-piksel işlenir (`Uint32Array` `ImageData`).
3. **Otomatik `1px` Siyah Piksel Kontur (`applyArcadeOutline`):**
   - Üretilen her Boss, böcek, gemi ve blok sprite'ının dış şeffaf sınır komşularına otomatik olarak `1` yerel piksel (`#080810`) siyah kontur eklenir — böylece her yaratık zemin üzerinde tıpkı `01-hedef-oynanis.jpg` görselindeki gibi net ve canlı öne çıkar!

## 2. ORİJİNAL VOLFIED KATMANLI HARİTA MANTIĞI (`LayerRenderer.ts` & `VolfiedTerrains.ts`)
Orijinal Volfied'ın en karakteristik görsel imzası şudur ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied)):
- **Üst Katman (`Stage N` Haritası):** Henüz ele geçirilmemiş `activePolygon` bölgesini kaplar.
- **Alt Katman (`Stage N+1` Haritası — Koyu Tonlu Ön Gösterim):** Oyuncu bir alanı kesip ele geçirdiğinde, kesilen bölgedeki üst katman silinir ve altından **bir sonraki bölümün 16-bit piksel haritası** (dikkati dağıtmaması için `%70` parlaklıkta koyulaştırılmış olarak) kademeli biçimde ortaya çıkar!
- **Parlak Yeşil Güvenli Sınır Çizgisi (`#28E038`):** `activePolygon`'un kenar çizgisi (oyuncunun üzerinde yürüdüğü güvenli hat) tıpkı `01-hedef-oynanis.jpg` ve orijinal Taito arcade sürümündeki gibi **keskin `2` arcade pikseli (`6px` ekran) parlak Volfied yeşili (`#28E038`, iç ince vurgu `#98FF70`, dış `1px` siyah kontur)** olarak çizilir!
- **Turuncu Kesim Lazeri (`#FF7810` + `#FFF0A0` çekirdek):** Oyuncu içeri kesime girdiğinde arkasında bıraktığı `activeTrail` çizgisi **sadece `90°` yatay ve dikey** ilerleyen parlak turuncu-sarı piksel lazer hattıdır (`01-hedef-oynanis.jpg` gibi).

## 3. 16 BÖLÜMÜN ZENGİN 16-BİT PİKSEL HARİTA SAHNELERİ (`VolfiedTerrains.ts`)
Tekdüze kırmızı tuğla ızgarası çizmek YASAKTIR! Her bölüm `270 x 370` piksel boyutunda, organik gezegen yüzeyi + gömülü uzaylı üssü/boru tesisatı birleşiminden oluşan **tam ekran 16-bit piksel-art sahne** olarak üretilir:

1. **Bölüm 01 — Kraterli Kum Gezegeni & Sağ Boru Üssü (`01-hedef-oynanis.jpg` Birebir!):** Sol ve orta kısımda piksel gölgeli irili ufaklı ay kraterleri ve çakıllarla dolu sıcak kum-okra (`#C89852` / `#9E6E32` / `#E0B46E`) gezegen toprağı; sağ `%32` şeritte ise kalın kıvrımlı gri çelik borular ve perçinli metal panellerden (`#7A8290` / `#525864` / `#A6B0BE`) oluşan uzay üssü!
2. **Bölüm 02 — Derin Kobalt Biyo-Okyanus & Batık Tapınak (`01-hedef-oynanis.jpg` sol altta görünen alt katman!):** Koyu safir-lacivert (`#0A1E6E` / `#061244` / `#1C3EA8`) su dalgaları ve batık siber-tapınak duvar kabartmaları.
3. **Bölüm 03 — Kayalık Kanyon & Merkez Reaktör Üssü:** Koyu kahve piksel kaya yumruları (`#5C3A21` / `#8A5A36`) ve sol-altta gömülü kırmızı LED göstergeli gri boru istasyonu (klasik Mega Drive *Ultimate Qix* sahnesi!).
4. **Bölüm 04 — Zümrüt Kristal Mağara & Altın İletken Hatları:** Koyu zümrüt kayaçlar (`#184A38` / `#2C7A5B`) ve altın devre kanalları.
5. **Bölüm 05 — Zırhlı Yörünge İstasyonu Güvertesi:** Izgaralı koyu çelik güverte plakaları, havalandırma ızgaraları ve sarı-siyah uyarı şeritli kapaklar.
6. **Bölüm 06 — Antik Altın-Bronz İkiz Tapınak:** Piksel kabartmalı antik uzaylı hiyeroglif taşları ve simetrik sütun kaideleri.
7. **Bölüm 07 — Mor Biyo-Kovan & Koza Duvarları:** Organik petek dokulu koyu mor-mavi uzaylı kovanı (`#382058` / `#5A3686`) ve gömülü enerji tüpleri.
8. **Bölüm 08 — Volkanik Bazalt Kanyonu & Kızıl Magma Çatlakları:** Koyu bazalt kayalar (`#3A2226` / `#583034`) arasından geçen piksel ditheringli lav damarları ve çelik köprü kirişleri (göz yormayan zengin 16-bit volkanik doku!).
9. **Bölüm 09 — Bakır Dökümhane & Dev Dişli Mekanizması:** Piksel çizimli büyük dişli çarklar, bakır kazanlar ve perçinli saclar.
10. **Bölüm 10 — Buzul Krateri & Donmuş Kruvazör Enkazı:** Buz mavisi-gri kraterler (`#5A7890` / `#88ABC2`) ve kuma gömülü uzay gemisi kanadı.
11. **Bölüm 11 — Turkuaz Denizaltı Türbin Üssü:** Koyu petrol yeşili sualtı kabloları ve metal türbin ızgaraları.
12. **Bölüm 12 — Sibernetik Kale Geçidi:** H.R. Giger tarzı koyu gri-mor biyo-mekanik kaburga duvarları ve merkezde kilitli geçit kapısı.
13. **Bölüm 13 — Biyo-Mekanik Omurga Tüneli (İç Dünya):** 12. Boss'tan sonra girilen organik-metalik omurga ve sinir kabloları zemini ([NamuWiki](https://ja.namu.wiki/w/%EB%B3%BC%ED%94%BC%EB%93%9C(%EA%B2%8C%EC%9E%84))).
14. **Bölüm 14 — Sinaptik Devre Matrisi:** Koyu zemin üzerinde altın/bakır sinaps düğümleri ve optik lifler.
15. **Bölüm 15 — Kızıl Biyo-Çekirdek Damarları:** Koyu organik zırh plakaları ve plazma enerji kanalları.
16. **Bölüm 16 — Ana Beyin Kabuğu -> Kurtuluş Çıkış Kapısı:** Kesildikçe altından Volfied gezegeninin parlak metalik **Yeraltı Kurtuluş Kapısı (`ESCAPE HATCH`)** açığa çıkar!
```

# ADIM 3 PROMPTU: Orijinal Volfied 16 Boss, Böcek, Kırmızı Mücevherli Blok ve Gemi Piksel Spriteları (`VolfiedSprites.ts`)

Bu adım; `01-hedef-oynanis.jpg` görselindeki **16-bit piksel-art sarı-yeşil kırkayak Boss'u, turuncu-yeşil böcekleri, kırmızı mücevherli gri kare blokları ve çift çatallı `Monotros` gemisini** `PixelArtEngine` ile `1px` siyah konturlu ve piksel gölgeli gerçek atari spriteları olarak üretir.

## Uygulanacak Piksel-Art Sprite Spesifikasyonu

```markdown
# GÖREV 3: `src/rendering/VolfiedSprites.ts` — ORİJİNAL 1989 TAITO TARZI 16-BİT SPRITE ÜRETİMİ

Tüm spritelar yerel düşük çözünürlükte (`16x16` ila `88x88` arcade pikseli) piksel matrisi / prosedürel piksel boyama + Bayer dithering + `applyArcadeOutline` (`1px` `#080810` siyah piksel çerçeve) ile `OffscreenCanvas` önbelleğine üretilecek ve ekrana `PIXEL_SCALE = 3` (`imageSmoothingEnabled = false`) ile keskin basılacaktır!

## 1. ÇİFT ÇATALLI `MONOTROS` GEMİSİ VE DAİRESEL YEŞİL PİKSEL KALKAN (`PlayerShip.ts`)
- **Gemi Sprite'ı (`18 x 18` arcade pikseli -> `54 x 54` ekran pikseli):**
  - `01-hedef-oynanis.jpg` görselindeki gibi ileri uzanan iki keskin gümüş-gri piksel çatal kanat (`#D8E0EA`, gölge `#788498`), gövde ortasında parlak kırmızı piksel kokpit çekirdeği (`#E82828` / `#FF7070`) ve `1px` siyah piksel kontur!
  - Hareket yönüne (`0°, 90°, 180°, 270°`) göre piksel bozulması olmadan tam `90°` döndürülerek çizilir.
- **Orijinal Yeşil Dairesel Kalkan Haresi:**
  - Gemi güvenli kenar üzerindeyken (`STATE_ON_BORDER` ve `shield > 0`), geminin etrafında 1989 arcade sürümündeki gibi `22x22` arcade pikseli çapında ince, keskin piksel-art yeşil-sarı enerji çemberi (`#38F048` / `#C8FF60`, 2 kare animasyonlu) döner! Kesime girildiğinde (`STATE_CUTTING`) bu çember kapanır.
- **Kenar Payı Koruması:** Çerçevenin iç kenarı gemi yarıçapını kurtaracak paya sahip olduğundan gemi alt/üst/yan kenarda yürürken ASLA yarım kesilmez!

## 2. İKONİK KIRMIZI MÜCEVHERLİ GRİ BLOKLAR (`PowerUpBox.ts`)
- `01-hedef-oynanis.jpg` orta sıradaki blokların BİREBİR piksel-art çizimi (`20 x 20` arcade pikseli -> `60 x 60` ekran pikseli):
  - **Standart Enerji Bloğu:** Üst ve sol kenarı açık gümüş (`#D0D6E0`), alt ve sağ kenarı koyu çelik (`#505664`) pahlı kare metal çerçeve, ortasında koyu yuva içinde parlayan piksel-art **kırmızı kare/sekizgen yakut ışık (`#D81820` + `#FF8888` piksel parlama noktası)**!
  - **Özel Boss Silahı Bloğu:** Aynı yapının dış çerçevesi **parlak altın sarısı (`#F0C028` / `#986808`)** ve ortasında daha büyük kırmızı mücevher!
  - **Açılma Anı:** Oyuncu bloğun etrafını kesip kendi alanına kattığında blok patlayarak açılır ve içinden parlak piksel-art harf kapsülü (**`S`**, **`T`**, **`P`**, **`L`**, **`C`** veya **`★`**) çıkıp gemiye uçar!

## 3. 16-BİT PİKSEL-ART KÜÇÜK CANAVARLAR (`src/entities/enemies/`)
1. **`ScarabBeetle` (`18 x 18` arcade pikseli — `01-hedef-oynanis.jpg` Böcekleri!):**
   - Parlak turuncu-kehribar (`#F07818` / `#FFA838`) ve ortası zümrüt yeşil (`#28B838`) bölmeli bombeli piksel kabuk, yanlarda 6 adet hareketli yeşil-siyah piksel bacak (2 kare yürüme animasyonu) ve önde iki küçük kıskaç!
2. **`PodFighter` (`18 x 18` arcade pikseli — Klasik Ultimate Qix Beyaz-Mor Uzaylısı):**
   - Beyaz kavisli yan zırh kanatları (`#E8ECF8`), ortada mor-pembe nabız atan uzaylı çekirdeği (`#D838B8`) — oyuncu kesime çıktığında çizgiye doğru süzülür.
3. **`BlueSphereSplitter` (`18 x 18` -> `12 x 12` arcade pikseli):**
   - Parlak mavi fasetli piksel kristal küre (`#2888F8` / `#88D0FF`); iki küçük küreye bölünür.
4. **`ArcadeSpikeMine` (`16 x 16` arcade pikseli):**
   - Bölüm uzadığında beliren dikenli gri-kırmızı piksel uzay mayını.

## 4. 16 BÖLÜMÜN ORİJİNAL TARZ 16-BİT PİKSEL-ART BOSS CANAVARLARI (`src/entities/bosses/`)
Düz çizgi film kafası çizmek KESİNLİKLE YASAKTIR! Tüm Boss'lar `PixelArtEngine` ile piksel-piksel dokulu, siyah piksel konturlu ve çok parçalı animasyonlu üretilir:

1. **Bölüm 1, 8, 15 — İkonik Zincir Boğumlu Kırkayak (`CentipedeBoss` — `01-hedef-oynanis.jpg` Boss'u!):**
   - Her biri `16x14` arcade pikseli boyutunda `10..15` adet boğumlu zırh halkası (ortadan koyu demir omurga zinciriyle bağlı, yanlarından kıvrık gri-çelik bacaklar çıkan) ve önde büyük kıskaçlı + yeşil/kırmızı gözlü kafa sprite'ı!
   - **Bölüm 1:** Sarı-Yeşil Zırh (`#D8E028` / `#38A830` — orijinal 1. bölüm birebir!).
   - **Bölüm 8:** Parlak Altın-Turuncu Zırh (`#F8B820` / `#C86810`).
   - **Bölüm 15:** Kızıl- Fuşya İmparator Zırhı (`#E82868` / `#881040`, 15 boğum, çok hızlı!).
2. **Bölüm 2 & 9 — Dev Mekanik Istakoz/Yengeç (`LobsterMechaBoss` — `44x40` arcade pikseli):**
   - Kırmızı-bakır piksel ditheringli zırh kabuğu, 6 eklemli bacak ve iki yana açılıp kapanarak mermi saçan dev piksel kıskaçlar!
3. **Bölüm 3 & 11 — Dönen Yeşil-Mor Biyo-Çark (`BioWheelBoss` — Klasik Ultimate Qix Boss'u!):**
   - Etrafında yeşil zırh pedalları dönen, aralarından pembe-mor biyo-kapsüller parlayan `42x42` arcade pikseli dairesel uzaylı organizma!
4. **Bölüm 4 & 10 — Zırhlı Orak Peygamberdevesi (`MantisBoss` — `42x42` arcade pikseli):**
   - Zümrüt ve çelik plakalı böcek gövdesi; oyuncunun kesim çizgisine doğru kilitlenip hızla atılan (`Dash`) iki büyük testereli piksel orak kol.
5. **Bölüm 5 — Ağır Uzay Kruvazörü Çekirdeği (`CruiserCoreBoss` — `46x46` arcade pikseli):**
   - Gümüş-mavi perçinli sekizgen piksel kale ve 4 yöne top ateşleyen taretler.
6. **Bölüm 6 & 14 — İkiye Ayrılıp Birleşen Simetrik İkiz Çekirdek (`TwinSplitBoss`):**
   - Kilitliyken tek büyük altın-mavi biyo-mekanik reaktör; ayrıldığında sahada simetrik uçan iki yarım küre! Ayrıldıklarında ortalarından çizgi çekip bölersen anında bölüm biter!
7. **Bölüm 7 — Büyüyüp Küçülen Plazma Amipi (`MorphingCellBoss`):**
   - Piksel halkaları nefes alır gibi büyüyüp küçülen (`0.6x` – `1.45x`) çok gözlü biyo-plazma canavarı.
8. **Bölüm 12 — 16-Bit Piksel Sibernetik Uzaylı Kafatası (`CyberSkullBoss` — `48x52` arcade pikseli):**
   - Senin eski ekran görüntündeki fikrin **gerçek 1989 Taito 16-bit piksel-art versiyonu**: Bayer dithering ile gölgelenmiş metalik gri-mavi kafatası kubbesi, alında altın-kırmızı mücevher, yanlarda boğumlu piksel güç kabloları, derin siyah göz çukurlarında parlayan kırmızı pikseller ve mermi kusarken aşağı açılan piksel-art mekanik çene!
9. **Bölüm 13 — Tek Gözlü Sinir Avcısı (`OpticNerveBoss` — `40x40` arcade pikseli):**
   - Dev piksel göz küresi ve arkasında kıvrılan 3 eklemli sinir kuyruğu.
10. **Bölüm 16 — Dev Uzaylı Ana Beyni (`AlienBrainBoss` — `54x50` arcade pikseli):**
    - Piksel kıvrımlı pembe-mor dev uzaylı beyni ve etrafını koruyan 4 adet açılır-kapanır çelik zırh kapağı!
```
