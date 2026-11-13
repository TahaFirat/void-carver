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
