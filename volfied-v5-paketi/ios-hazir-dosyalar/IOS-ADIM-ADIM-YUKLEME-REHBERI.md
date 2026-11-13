# iOS App Store Connect'e Yükleme Kılavuzu (Hem Windows Bulut Hem Mac Xcode İçin)

Projedeki `npm run ios:prepare` ve `npm run ios:screenshots` komutları çalıştıktan sonra elinizde ikonları, LaunchScreen'i, `PrivacyInfo.xcprivacy` bildirimi ve `1320x2868` (iPhone 6.9") + `2064x2752` (iPad 13") ekran görüntüleri %100 hazır bir `ios/` projesi oluşur.

## Yöntem A — Windows Bilgisayardan (Mac Olmadan) GitHub Actions ile Doğrudan Yükleme

Windows 11 kullanıyorsanız yerel bir Mac'e ihtiyacınız olmadan `.github/workflows/ios-appstore-upload.yml` dosyasıyla doğrudan **TestFlight / App Store Connect**'e gönderebilirsiniz:

1. **Bundle ID Değişimi:** `capacitor.config.ts` içindeki `appId` alanını Apple Developer hesabınızda açtığınız kimlikle (örn. `com.tahafirat.voidcarver`) güncelleyin ve `npm run ios:prepare` çalıştırın.
2. **App Store Connect API Anahtarı:** [App Store Connect](https://appstoreconnect.apple.com/) > *Users and Access* > *Integrations* > *App Store Connect API* sekmesinden bir *App Manager* anahtarı oluşturun (`Issuer ID`, `Key ID` ve indirilen `.p8` dosyasının metin içeriği).
3. **GitHub Secrets Tanımlama:** Projeyi özel (private) bir GitHub deposuna atıp *Settings > Secrets and variables > Actions* bölümüne şu değerleri girin:
   - `APPLE_TEAM_ID`: 10 haneli Apple Developer Team ID'niz
   - `BUILD_CERTIFICATE_BASE64`: Apple Distribution `.p12` sertifikanızın Base64 metni
   - `P12_PASSWORD`: `.p12` şifreniz
   - `BUILD_PROVISION_PROFILE_BASE64`: App Store `.mobileprovision` profilinizin Base64 metni
   - `KEYCHAIN_PASSWORD`: Rastgele güçlü bir parola
   - `APPSTORE_API_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_API_PRIVATE_KEY`
4. **Tek Tıkla Gönderim:** GitHub'da **Actions > Build & Upload iOS IPA to App Store Connect > Run workflow** butonuna basın. 4 dakika içinde imzalı `.ipa` derlenir ve doğrudan App Store Connect'teki **TestFlight / Dağıtım** sekmenize düşer!

## Yöntem B — macOS Üzerinde Xcode ile Yükleme

1. Projede `npm run ios:prepare && npx cap open ios` çalıştırın ([Capacitor iOS Rehberi](https://capacitorjs.com/docs/ios/deploying-to-app-store)).
2. Xcode sol menüden `App` hedefini seçin -> **Signing & Capabilities** -> `Automatically manage signing` işaretleyin ve **Team** olarak Apple Developer hesabınızı seçin.
3. Üst çubuktan hedef cihazı **`Any iOS Device (arm64)`** yapın ve **Product > Archive** tıklayın.
4. Açılan pencerede **Distribute App > App Store Connect > Upload** seçerek gönderimi tamamlayın.
5. `store-listing/screenshots/` klasöründe otomatik üretilen `iphone-6.9` ve `ipad-13` görsellerini ve `store-listing/ASO-METINLERI-TR-EN.md` açıklamalarını App Store Connect sayfasına sürükleyip **Submit for Review**'a basın!
