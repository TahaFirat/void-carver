# ADIM 4 PROMPTU: Anahtar Teslim iOS App Store Yükleme Sistemi (Xcode + Windows Bulut IPA + Ekran Görüntüsü Otomasyonu)

Kullanıcının oyunu **Apple App Store / TestFlight**'a en ufak bir pürüz yaşamadan yükleyebilmesi için gereken tüm yerel iOS yapılandırmalarını, ikon/splash otomasyonunu, App Store Connect zorunlu ekran görüntüsü boyutlandırıcısını ve hem macOS Xcode hem de Windows üzerinden bulut `.ipa` derleme hatlarını eksiksiz kur.

## Uygulanacak iOS Mühendislik Spesifikasyonu

```markdown
# GÖREV 4: UÇTAN UCA iOS APP STORE HAZIRLIK OTOMASYONU

## 1. HAZIR iOS YAPILANDIRMA DOSYALARINI YERLEŞTİR
`volfied-v5-paketi/ios-hazir-dosyalar/` klasöründeki hazır şablonları kullanarak projedeki dosyaları oluştur veya güncelle:
1. `ios/App/App/PrivacyInfo.xcprivacy`: Apple ITMS-91053 kontrolünden %100 geçen `NSPrivacyAccessedAPICategoryUserDefaults` (`CA92.1`) gizlilik bildirimi.
2. `ios/ExportOptions.plist`: `app-store-connect` dağıtım yöntemi ve otomatik imzalama şablonu.
3. `.github/workflows/ios-appstore-upload.yml`: Windows/Linux ortamından GitHub `macos-15` sunucusu üzerinde otomatik Xcode Archive + `.ipa` imzalama + App Store Connect / TestFlight yükleme iş akışı!
4. `ios/App/App/Info.plist` güncellemeleri:
   - `CFBundleDisplayName`: `Void Carver`
   - `CFBundleDevelopmentRegion`: `tr`
   - **Evrensel iPhone & iPad Ekran Yönü Desteği:** `ResponsiveLayout.ts` hem dikey hem yatay ekranları kusursuz desteklediği için `UISupportedInterfaceOrientations` (iPhone: Portrait, LandscapeLeft, LandscapeRight) ve `UISupportedInterfaceOrientations~ipad` (iPad: 4 yönün tamamı — Apple iPad incelemesinde tam puan alır!) anahtarlarını tanımla.
   - `UIStatusBarHidden`: `<true/>`, `UIViewControllerBasedStatusBarAppearance`: `<false/>`
   - `ITSAppUsesNonExemptEncryption`: `<false/>` (TestFlight şifreleme onay sorusunu otomatik geçer).

## 2. TEK KOMUTLA iOS HAZIRLIK BETİĞİ (`scripts/ios-full-prepare.mjs`)
`package.json` içine `"ios:prepare": "node scripts/ios-full-prepare.mjs"` betiğini ekle. Bu betik sırasıyla:
1. `resources/icon-only.png` (`1024x1024`, **kesinlikle alfa/şeffaflık kanalı olmayan** 24-bit RGB PNG — Apple alfa kanallı ikonu reddeder!) ve `resources/splash.png` + `resources/splash-dark.png` (`2732x2732`) dosyalarını 16-bit Volfied piksel-art temasıyla üretir ve alfa kanalı kontrolü yapar.
2. `npm run build` ile üretim paketini derler.
3. `ios/` klasörü yoksa `npx cap add ios` çalıştırır, ardından `npx capacitor-assets generate --ios` ile tüm iPhone ve iPad ikon/LaunchScreen setlerini `Assets.xcassets` içine yazar.
4. `Info.plist` ve `PrivacyInfo.xcprivacy` dosyalarının `ios/App/App/` içinde eksiksiz bulunduğunu ve `project.pbxproj` kaynak listesine (`PBXResourcesBuildPhase`) eklendiğini doğrular.
5. `npx cap sync ios` çalıştırır.

## 3. OTOMATİK APP STORE CONNECT EKRAN GÖRÜNTÜSÜ ÜRETİCİ (`scripts/generate-appstore-screenshots.mjs`)
Apple App Store Connect'in zorunlu tuttuğu iki ana ekran boyutunda, şeffaflık içermeyen (24-bit RGB PNG) **5'er adet gerçek oyun ekran görüntüsünü** otomatik üreten bir betik yaz (`"ios:screenshots": "node scripts/generate-appstore-screenshots.mjs"`):
- **`store-listing/screenshots/iphone-6.9/` (`1320 x 2868 px` — iPhone 16 Pro Max / 6.9" zorunlu boyutu):**
  1. `01-menu-100-bolum.png` (100 Bölümlük 4 Kademeli Kampanya Menüsü)
  2. `02-kolay-kademe-kesim.png` (Bölüm 01 Klasik Kırkayak & Duvar Kutu Kesimi)
  3. `03-orta-kademe-duvar-labirent.png` (Bölüm 34 Katı Duvar Kutular Etrafından Taktiksel Kesim)
  4. `04-zor-kademe-ikiz-boss.png` (Bölüm 60 Çift Boss Ayırma & Süper Atış)
  5. `05-usta-kademe-final.png` (Bölüm 95+ Usta Kademesi Yoğun Aksiyon)
- **`store-listing/screenshots/ipad-13/` (`2064 x 2752 px` ve/veya `2752 x 2064 px` — 13" iPad Pro zorunlu boyutu):**
  - Aynı 5 sahnenin `TABLET_PORTRAIT` / `LANDSCAPE_SPLIT` responsive yerleşiminde çekilmiş yüksek çözünürlüklü PNG çıktıları!
```
