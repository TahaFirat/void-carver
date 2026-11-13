# VOID CARVER V4 — BİREBİR 1989 ORİJİNAL VOLFIED 16-BİT ARCADE GRAFİK + SADE MOBİL ZİRVE PAKETİ

Bu paket; senin gönderdiğin ekran görüntüsündeki **klasik 1989 Taito [Volfied](https://ja.wikipedia.org/wiki/%E3%83%B4%E3%82%A9%E3%83%AB%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89) ([Arcade Archives](https://www.arcadearchives.com/en/title/aca-301/)) ruhunu ve düzenini** (yeşil ızgaralı gezegen logosu, altın/gümüş arcade çerçevesi, kırmızı-beyaz şeritli bariyerler, ortası kırmızı mücevherli gri kare kutular, çift çatallı gümüş-kırmızı `Monotros` gemisi, yeşil alan sınır çizgisi, kırmızı topuzlu arcade kol ve kırmızı `KES` butonu) **%100 koruyup temel alır**; ancak önceki derlemedeki basit vektör çizimleri **gerçek 16-bit Taito Arcade Pixel-Art kalitesine** yükseltir ve menü/ekran yazılarını kafa karışıklığı yaratmayacak şekilde sadeleştirir.

## Senin Attığın Ekran Görüntüsü Üzerinde Neyi Koruduk, Neyi Mükemmelleştirdik?

| Öğe | Senin Attığın Görüntüde Nasıldı? | V4 Paketiyle Nasıl Olacak? (`referans-gorseller/` Birebir) |
| :--- | :--- | :--- |
| **Genel Görsel Tarz** | Volfied düzenine yakındı ama Boss (gri kafa) ve böcekler düz `ctx.arc` çizgi film gibiydi | **Gerçek 1989 Taito 16-Bit Pixel-Art Motoru (`PixelArtEngine.ts`):** `270x360` yerel arcade piksel çözünürlüğünde, `1px` siyah piksel konturlu, Bayer dithering gölgeli ve `imageSmoothingEnabled = false` ile jilet keskinliğinde `3x` büyütülen orijinal atari grafikleri! |
| **Bölüm Zeminleri** | Tekrarlı düz kırmızı dikdörtgen tuğlalar vardı | **Orijinal Volfied Çok-Bileşenli 16-Bit Piksel Zeminleri (`VolfiedTerrains.ts`):** Kraterli çöl gezegeni + gömülü gri borulu uzay üssü, kayalık kanyon + reaktör tesisatı, kobalt devre okyanusu! Kesilen her bölge parlak **yeşil (`#28E038`) piksel sınır çizgisiyle** ayrılır ve altından **bir sonraki bölümün 16-bit piksel haritası** çıkar! |
| **Kutular ve Bariyerler** | Ortası kırmızı ışıklı gri kare kutular ve kırmızı-gümüş bariyerler doğruydu | **Birebir Korundu ve Piksel-Art Olarak Keskinleştirildi:** Gri pahlı `[🔴]` enerji blokları ve altın çerçeveli `[🔴]` özel blok aynen korunur; alan içine hapsedildiğinde `S`, `T`, `P`, `L`, `C`, `★` piksel kapsülleri çıkar! |
| **Ana Menü** | Yeşil ızgara gezegen + krom logo harikaydı ama altında 40 tane karmaşık/yarım kesilen yazı ve `CREDIT 09` vardı | **Aynı İkonik Yeşil Gezegen + Krom Logo Korundu, Karmaşa Silindi (`02-hedef-ana-menu.jpg`):** Sadece `REKOR`, tek büyük `OYNA • BÖLÜM XX` butonu, içinde yalnızca `01`..`16` ve `★★★` / kilit bulunan perçinli piksel kutular, en altta sadece `GEMİLER` ve `AYARLAR`! |
| **Oyun İçi HUD & Kontroller** | Alt ortada gereksiz `[1P CONTROL DECK WASD]` kutusu vardı ve gemi alt kenarda yarım kesiliyordu | **Klasik Kırmızı Arcade Kol + Kırmızı `KES` Butonu Korundu (`01-hedef-oynanis.jpg`):** Ortadaki gereksiz yazı kutusu silindi, gemi kırpılması düzeltildi, çizgi geri sarma (`Backtrack`) ve `L`/`★` alındığında kenardan otomatik ateş eklendi! |

## Paket İçeriği

- `referans-gorseller/01-hedef-oynanis.jpg` — Orijinal 1989 Taito Volfied 16-bit piksel-art oyun içi hedef görünümü.
- `referans-gorseller/02-hedef-ana-menu.jpg` — Orijinal Volfied yeşil gezegenli, sadeleştirilmiş 16-bit piksel-art Ana Menü görünümü.
- `00-ORIJINAL-VOLFIED-MASTER-KOMUT.md` — Google Antigravity / Cursor için tek adımda çalıştırılacak ana komut.
- `01-SADE-ARCADE-MENU-VE-HUD-DUZENI.md` — Yeşil gezegenli ikonik menünün ve klasik arcade HUD şeridinin kafa karıştırmayacak şekilde sadeleştirilmesi.
- `02-16-BIT-TAITO-PIXEL-ART-MOTORU-VE-HARITALAR.md` — `PixelArtEngine.ts` (`imageSmoothingEnabled = false`, Bayer dithering, `1px` siyah kontur) ve 16 bölümün orijinal Volfied gezegen+üs piksel zeminleri (`VolfiedTerrains.ts`).
- `03-ORIJINAL-VOLFIED-16-BOSS-BOCEK-VE-BLOK-SPRITELARI.md` — Sarı-yeşil/altın/kızıl kırkayak, dev yengeç, yeşil-mor biyo-küre, ikiz çekirdek, 16-bit piksel sibernetik kafatası, `Monotros` gemisi, yeşil dairesel kalkan ve `[🔴]` gri blokların piksel-art üretim kodları (`VolfiedSprites.ts`).
- `04-KUSURSUZ-MOBIL-OYNANIS-VE-GERCEK-VOLFIED-KURALLARI.md` — Çizgi geri sarma (`Backtrack`), hibrit kırmızı arcade kol + parmak kaydırma, kenarda otomatik ateş, dar koridorda Boss küçülmesi.
- `05-16-BOLUM-PROFESYONEL-ZORLUK-VE-SKOR-SISTEMI.md` — Orijinal 1989 arcade zorluk eğrisi, yanıp sönen kutular, 13–16 nöral iç dünya ve 1.000.000 puanlık özel bonuslar.
- `06-ARCADE-SES-CAPACITOR-VE-KALITE-KONTROL.md` — Orijinal arcade ses sentezlemesi, piksel-art mağaza ikonu ve canlı tarayıcı kabul listesi.

## Google Antigravity / Cursor İçin Tek Adımda Başlatma Komutu

ZIP içindeki `volfied-orijinal-v4` klasörünü proje kök dizininize (`C:\Users\Taha\Desktop\volfied\`) çıkarın ve AI kodlama ajanınıza doğrudan şu komutu gönderin:

```markdown
Mevcut projemizi görsel olarak 1989 Taito orijinal VOLFIED (Arcade / Ultimate Qix) 16-bit piksel-art tasarımının BİREBİR kalitesine taşıyoruz; aynı zamanda menüyü sadeleştirip mobil kontrolleri kusursuzlaştırıyoruz!

ÖNCE ŞU İKİ HEDEF GÖRSELİ AÇ VE İNCELE:
- `volfied-orijinal-v4/referans-gorseller/01-hedef-oynanis.jpg`
- `volfied-orijinal-v4/referans-gorseller/02-hedef-ana-menu.jpg`

Ardından `volfied-orijinal-v4/` klasöründeki `01`'den `06`'ya kadar tüm Markdown dosyalarını sırasıyla okuyup eksiksiz uygula:
1. **Gerçek 16-Bit Taito Pixel-Art Motoru (`02` & `03`):**
   - Düz vektör (`ctx.arc`) çizgi film çizimlerini ve tekdüze kırmızı tuğla ızgarasını SİL!
   - `src/rendering/PixelArtEngine.ts`, `VolfiedTerrains.ts` ve `VolfiedSprites.ts` modüllerini kur: Oyun alanını yerel düşük çözünürlüklü piksel tamponunda (`1 arcade pikseli = 3x3 ekran pikseli`, `ctx.imageSmoothingEnabled = false`) Bayer 2x2 dithering ve `1px` siyah piksel konturlarıyla işle!
   - `01-hedef-oynanis.jpg` görselindeki gibi: Altın-gümüş metal çerçeveyi, kırmızı-beyaz şeritli kenar bariyerlerini, kesilen alanları ayıran parlak yeşil (`#28E038`) Volfied sınır çizgisini, ortası kırmızı mücevherli gri kare blokları (`[🔴]` ve altın çerçeveli özel blok), kraterli gezegen + gri borulu uzay üssü zeminlerini (kesildikçe alttan bir sonraki bölümün piksel haritası çıkacak!) ve 16 orijinal tarz 16-bit piksel Boss + böcek + çift çatallı `Monotros` gemisini birebir üret!
2. **Sadeleştirilmiş İkonik Arcade Menü & HUD (`01`):**
   - `02-hedef-ana-menu.jpg` görselindeki gibi: Yeşil ızgara gezegen + krom `VOID CARVER` logosu + turuncu iz bırakan piksel gemiyi KORU; ancak `CREDIT 09`, `FREE PLAY`, yarım kesilen bölüm isimleri ve kalabalık zorluk kutularını SİL! Sadece `REKOR`, tek büyük `OYNA • BÖLÜM XX`, içinde yalnızca numara (`01`..`16`) ve `★★★`/kilit ikonu olan 16 perçinli kutu ve altta `GEMİLER` ile `AYARLAR` kalsın.
   - Oyun ekranında üstte `SKOR` / `REKOR` / `❚❚`, çerçevenin hemen altında tek ince satırda `BÖLÜM XX` + gemi ikonları + `64.5% / 80%` + `KALKAN 942`, en altta ise YALNIZCA sol kırmızı topuzlu arcade joystick ve sağ kırmızı `KES` butonu kalsın (ortadaki `[1P CONTROL DECK WASD]` kutusunu tamamen sil!).
3. **Kusursuz Mobil Kontroller & Orijinal Volfied Kuralları (`04`, `05`, `06`):**
   - Çizgi çekerken `180°` geri dönüp çizgiyi geri sarma (`Backtrack`), hem kırmızı arcade kol + `KES` hem doğrudan parmak kaydırma desteği, `L`/`★` alındığında kenardan otomatik ateş, kenarda geminin asla yarım kesilmemesi, dar koridorda Boss küçülmesi ve 16 bölümlük profesyonel zorluk dengesini uygula; testleri ve `localhost:5173` ekran görüntülerini doğrulayıp teslim et!
```
