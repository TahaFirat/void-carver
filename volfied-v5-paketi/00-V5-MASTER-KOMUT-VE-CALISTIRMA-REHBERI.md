# VOID CARVER V5 — DUVAR KUTULAR, 100 ARDIŞIK BÖLÜM (4 KADEME), YENİ TELEFON/TABLET KONTROLÜ, %100 EVRENSEL RESPONSIVE VE ANAHTAR TESLİM iOS PAKETİ

Bu paket, V4'te kurduğumuz **1989 Taito [Volfied](https://ja.wikipedia.org/wiki/%E3%83%B4%E3%82%A9%E3%83%AB%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89) 16-Bit Arcade Pixel-Art** grafik temelini **kaldığımız yerden birebir koruyarak** üzerine istediğin 5 büyük sistemi eksiksiz inşa eder:

1. **Geçilmez Duvar Tipi Bonus Kutuları (`Solid Wall Pillars`):** Haritadaki `[🔴]` gri/altın kutular artık içinden geçilebilen hayalet ikonlar değil, **üzerinden geçilemeyen katı çelik zırh duvarlarıdır!** Kesim yaparken kutuya çarparsan gemi ölmez, duvarın önünde durur; kutuyu almak için etrafından `90°` dönerek onu alanının içine hapsetmen gerekir. Üstelik böcekler ve Boss mermileri de bu kutulardan seker!
2. **4 Kademeli, Ardışık Kilitli 100 Bölüm (`KOLAY 1-25` -> `ORTA 26-50` -> `ZOR 51-75` -> `USTA 76-100`):** Bölümler tek tek sırayla açılır; bir kademeyi bitirmeden üst kademeye geçilmez. `USTA (76-100)` kademesi `%88-%90` alan hedefi, sahte zırh sütunları, daralan kalkan ve çoklu Boss'larla ulaşılması gerçekten zor bir prestij zirvesidir.
3. **Telefon ve Tablet İçin Yenilenen Sezgisel Kontrol (`▲ ▼ ◀ ▶` Ayrık Işıklı Tuşlar + `[OTOMATİK]` Tek-El Modu):** Kaygan yuvarlak topuz kaldırıldı; yerine basılan yönü parlak renkle yakan **4 büyük ayrık yön tuşu (`▲ ▼ ◀ ▶` — parmak kaydırma destekli)**, gemi burnunda içeri yönü gösteren mini ok ipucu ve sağda büyük **`KES`** butonu + tek dokunuşluk **`[OTOMATİK]`** (tek elle oynama) anahtarı getirildi.
4. **Tamamen *Her* Cihaz İçin %100 Dinamik Responsive Motor (`ResponsiveLayout.ts`):** Küçük iPhone SE, iPhone 12 / 16 Pro Max (Dynamic Island & Safe Area), iPad Mini / Air / Pro 11" & 13" (hem Dikey hem Yatay!), katlanabilir Android telefonlar ve masaüstü geniş ekranlarda sıfır taşma ve ergonomik başparmak yerleşimi sağlar.
5. **Anahtar Teslim iOS App Store Yükleme Altyapısı (`ios-hazir-dosyalar/` + Otomasyon Betikleri):** `Info.plist`, Apple zorunlu `PrivacyInfo.xcprivacy`, `ExportOptions.plist`, otomatik iOS ikon/splash üretici, otomatik App Store `6.9" iPhone` + `13" iPad` ekran görüntüsü üretici ve **Windows bilgisayardan bile Mac gerekmeden doğrudan App Store Connect / TestFlight'a imzalı `.ipa` derleyip gönderen GitHub Actions macOS iş akışı** pakete hazır eklendi!

## Paket İçeriği

- `referans-gorseller/01-hedef-duvar-kutu-ve-yeni-kontrol.jpg` — Duvar tipi bonus kutuları ve yeni `▲ ▼ ◀ ▶` + `KES` telefon görünümü.
- `referans-gorseller/02-hedef-100-bolum-kademeli-menu.jpg` — `KOLAY / ORTA / ZOR / USTA` sekmeli 100 bölümlük sade menü görünümü.
- `referans-gorseller/03-hedef-ipad-ve-yatay-responsive.jpg` — Tablet / iPad ve yatay ekranlar için 3 sütunlu ergonomik responsive görünüm.
- `00-V5-MASTER-KOMUT-VE-CALISTIRMA-REHBERI.md` — AI kodlama ajanına tek seferde verilecek ana komut.
- `01-DUVAR-BONUS-KUTULARI-VE-YENI-OYUN-MEKANIGI.md` — Geçilmez katı kutu çarpışma matematiği ve taktiksel sekme fiziği.
- `02-100-BOLUM-4-KADEME-ZORLUK-VE-ILERLEME-SISTEMI.md` — 100 ardışık bölüm üretim algoritması, 4 zorluk kademesi ve `5x5` sekme menüsü.
- `03-TELEFON-TABLET-KONTROL-VE-TAM-RESPONSIVE-MOTORU.md` — Yeni 4-yönlü D-Pad, `[OTOMATİK]` kesim ve her ekran oranına uyum sağlayan `ResponsiveLayout.ts`.
- `04-ANAHTAR-TESLIM-IOS-APPSTORE-YUKLEME-SISTEMI.md` — Otomatik iOS hazırlık betiği, App Store ekran görüntüsü üretici ve Xcode / Bulut derleme kurulumu.
- `05-OTOMATIK-TEST-RESPONSIVE-VE-IOS-DENETIM-LISTESI.md` — Birim testleri, çoklu cihaz ekran testi ve iOS ön denetimi.
- `ios-hazir-dosyalar/PrivacyInfo.xcprivacy` — Apple onaylı hazır Gizlilik Bildirimi dosyası.
- `ios-hazir-dosyalar/ExportOptions.plist` — App Store Connect `.ipa` dışa aktarma dosyası.
- `ios-hazir-dosyalar/ios-appstore-upload.yml` — Windows/Linux üzerinden GitHub macOS sunucusunda imzalı `.ipa` üretip TestFlight'a yükleyen hazır CI/CD dosyası.
- `ios-hazir-dosyalar/IOS-ADIM-ADIM-YUKLEME-REHBERI.md` — Apple Developer & App Store Connect yükleme kılavuzu.

## Google Antigravity / Cursor İçin Tek Adımda Başlatma Komutu

ZIP içindeki `volfied-v5-paketi` klasörünü mevcut projenizin (`C:\Users\Taha\Desktop\volfied\`) içine çıkarın ve AI kodlama ajanınıza doğrudan şu komutu yapıştırın:

```markdown
Mevcut 1989 Taito Volfied 16-bit piksel-art projemizi KALDIĞIMIZ YERDEN devam ettirerek `volfied-v5-paketi/` içindeki tüm V5 yükseltmelerini eksiksiz uygula!

ÖNCE ŞU 3 HEDEF GÖRSELİ İNCELE:
- `volfied-v5-paketi/referans-gorseller/01-hedef-duvar-kutu-ve-yeni-kontrol.jpg`
- `volfied-v5-paketi/referans-gorseller/02-hedef-100-bolum-kademeli-menu.jpg`
- `volfied-v5-paketi/referans-gorseller/03-hedef-ipad-ve-yatay-responsive.jpg`

ARDINDAN `01`'DEN `05`'E KADAR TÜM MARKDOWN DOSYALARINI VE `ios-hazir-dosyalar/` KLASÖRÜNÜ UYGULA:
1. **Geçilmez Duvar Tipi Bonus Kutuları (`01`):**
   - Haritadaki tüm bonus/enerji bloklarını (`PowerUpBox.ts`) içinden ASLA geçilemeyen katı zırhlı duvarlara dönüştür (`44x44` mantıksal boyut, kalın 3B alt-yan piksel gölgesiyle duvar olduğu net belli olsun).
   - Gemi kesim yaparken (`STATE_CUTTING`) bir kutunun duvarına çarparsa ölmesin, tam duvarın önünde dursun ki oyuncu kutunun etrafından `90°` dönerek onu alan içine hapsetsin! Küçük düşmanlar, Boss'lar ve mermiler de bu katı kutulardan seksin! Kutu alan içine hapsedildiği an kırılsın, engel kalksın ve güçlendirmeyi versin.
2. **4 Kademeli, Ardışık Kilitli 100 Bölüm Kampanyası (`02`):**
   - Bölüm sayısını **100 ardışık bölüme** çıkar ve 4 zorluk kademesine ayır: `KOLAY (1-25, %80 hedef)`, `ORTA (26-50, %82 hedef)`, `ZOR (51-75, %85 hedef)`, `USTA (76-100, %88-%90 hedef + içinden güçlendirme çıkmayan saf zırh duvar sütunları + çoklu Boss!)`.
   - Bölümler tek tek sırayla açılsın (`Bölüm N` bitmeden `N+1` açılmasın, `25` bitmeden `ORTA`, `50` bitmeden `ZOR`, `75` bitmeden `USTA` sekmesi açılmasın). Ana menüde `02-hedef-100-bolum-kademeli-menu.jpg` görselindeki gibi 4 kademe sekmesi ve altında sade `5x5` (`25` kutuluk) piksel ızgara göster.
3. **Yeni Anlaşılır Telefon/Tablet Kontrolü & %100 Evrensel Responsive Motor (`03`):**
   - Kaygan yuvarlak joystick'i kaldır; yerine `01-hedef-duvar-kutu-ve-yeni-kontrol.jpg` görselindeki gibi **4 ayrık, büyük, basıldığında parlayan piksel yön tuşu (`▲ ▼ ◀ ▶` — parmak kaydırma destekli)**, gemi burnunda sahaya giriş yönünü gösteren küçük ok ipucu ve sağda büyük **`KES`** butonu + tek elle oynamayı sağlayan **`[OTOMATİK]`** anahtarı ekle.
   - `src/core/ResponsiveLayout.ts` modülünü kur: Küçük telefon (`iPhone SE`), çentikli uzun telefon (`iPhone 12 / 16 Pro Max`), dikey tablet (`iPad Mini / Air / Pro`), katlanabilir ekran ve yatay ekranlarda (`03-hedef-ipad-ve-yatay-responsive.jpg` 3 sütunlu yerleşim!) %100 tam ekran, sıfır taşma ve kusursuz dokunma alanı sağla!
4. **Anahtar Teslim iOS App Store Hazırlığı (`04` & `05`):**
   - `volfied-v5-paketi/ios-hazir-dosyalar/` içindeki `PrivacyInfo.xcprivacy`, `ExportOptions.plist` ve `.github/workflows/ios-appstore-upload.yml` dosyalarını projeye yerleştir.
   - `scripts/ios-full-prepare.mjs` ve App Store Connect için `6.9" iPhone (1320x2868)` + `13" iPad Pro (2064x2752)` ekran görüntülerini otomatik üreten `scripts/generate-appstore-screenshots.mjs` betiğini oluşturup çalıştır; tüm testleri (`npm test`, `npm run build`, `npx cap sync ios`) ve çoklu ekran çözünürlüklerini doğrulayıp teslim et!
```
