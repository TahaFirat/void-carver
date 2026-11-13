# FAZ 5 PROMPTU VE MAĞAZA YAYIN KILAVUZU: Apple App Store & Google Play Store

Faz 4 ile `ios/` ve `android/` yerel projeleriniz oluştuğunda, uygulamanızı **Apple App Store** ([Capacitor iOS Yayın Rehberi](https://capacitorjs.com/docs/ios/deploying-to-app-store)) ve **Google Play Store** ([Capacitor Android Yayın Rehberi](https://capacitorjs.com/docs/android/deploying-to-google-play)) incelemelerinden **ilk gönderimde onay alacak** şekilde paketlemek için bu dosyayı kullanın.

Bu dosya iki bölümden oluşur:
1. **AI Kodlama Ajanına Verilecek Faz 5 Mağaza Paketi Üretim Promptu** (`PrivacyInfo.xcprivacy`, Gizlilik Politikası HTML sayfası, ASO açıklamaları ve derleme kontrol betiğini otomatik üretir).
2. **Sizin Xcode ve Android Studio Üzerinde Uygulayacağınız Adım Adım Yayınlama Kontrol Listesi.**

## Bölüm 1: Kopyalanacak Master Prompt ( Faz 5 — Mağaza Uyumluluk ve ASO Paketi )

```markdown
# GÖREV: FAZ 5 — APP STORE & GOOGLE PLAY STORE ONAY KALKANI, GİZLİLİK BİLDİRİMİ VE MAĞAZA METİNLERİ

Capacitor mobil projemizi Apple App Store ve Google Play Store incelemesine göndermeden önce zorunlu olan tüm yerel yapılandırma dosyalarını, gizlilik politikasını ve ASO mağaza metinlerini eksiksiz üret.

## 1. APPLE GİZLİLİK BİLDİRİMİ (`ios/App/App/PrivacyInfo.xcprivacy`) VE `Info.plist` AYARLARI
Apple incelemesinde otomatik ikili dosya reddini (ITMS-91053) önlemek için:
- `ios/App/App/PrivacyInfo.xcprivacy` dosyasını oluştur/güncelle:
  - `NSPrivacyTracking`: `false` (reklam/izleme SDK'sı yoksa)
  - `NSPrivacyCollectedDataTypes`: boş dizi `[]` (sunucuya kişisel veri toplanmıyorsa)
  - `NSPrivacyAccessedAPITypes`: `@capacitor/preferences` (`UserDefaults`) kullanımı için `NSPrivacyAccessedAPICategoryUserDefaults` (`CA92.1` — yalnızca uygulama içi oyun ilerlemesini/ayarlarını kaydetmek amacıyla) ve gerekli dosya zaman damgası bildirimini ekle.
- `ios/App/App/Info.plist` içine şu anahtarları ekle/doğrula:
  - `ITSAppUsesNonExemptEncryption`: `<false/>` (her TestFlight/App Store yüklemesinde şifreleme sorusunu otomatik geçer).
  - `UIRequiresFullScreen`: `<true/>` (iPad çoklu görev bölünmüş ekranında oyun oranının bozulmasını önler ve dikey kilidi korur).
  - `UIStatusBarHidden`: `<true/>` ve `UIViewControllerBasedStatusBarAppearance`: `<false/>`.

## 2. ANDROID HEDEF SDK, İZİNLER VE İMZALAMA ŞABLONU (`android/app/build.gradle`)
- `android/variables.gradle` içinde güncel Google Play zorunluluklarına uygun `compileSdkVersion` ve `targetSdkVersion` (`35` veya üstü) değerlerini doğrula.
- `android/app/src/main/AndroidManifest.xml` içinde `android:screenOrientation="portrait"` ayarını `MainActivity` etiketine ekle; oyun internet gerektirmiyorsa gereksiz kamera/konum/mikrofon izinlerinin bulunmadığını doğrula (`VIBRATE` izni Haptics için korunur).
- `android/app/build.gradle` içine güvenli ortam değişkenlerinden (`KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) okuyan `signingConfigs.release` bloğunu ekle (şifreleri asla koda gömme; `.gitignore` içine `*.jks`, `*.keystore`, `keystore.properties` ekle).

## 3. STATİK GİZLİLİK POLİTİKASI VE DESTEK SAYFASI (`store-listing/privacy-policy.html` & `support.html`)
Her iki mağaza da herkese açık bir **Privacy Policy URL** ve **Support URL** zorunlu tutar (GitHub Pages, Cloudflare Pages veya Vercel üzerinden ücretsiz yayınlanabilir).
- `store-listing/privacy-policy.html` ve `store-listing/support.html` dosyalarını hem Türkçe hem İngilizce sekmeli, şık ve mobil uyumlu tek sayfa HTML olarak üret (çevrimdışı çalışan, kişisel veri toplamayan ve cihaz içi `Preferences` kaydını şeffafça açıklayan yasal metinle).

## 4. ASO MAĞAZA LİSTELEME METİNLERİ (`store-listing/ASO-METINLERI-TR-EN.md`)
Telif/marka ihlali yaratmadan ("Volfied", "Qix", "Taito" kelimelerini ASLA kullanmadan; bunun yerine *"arcade territory capture"*, *"space grid slicer"*, *"retro sci-fi action puzzle"* anahtar kelimelerini kullanarak) Türkçe ve İngilizce olarak şunları hazırla:
- Uygulama Adı (`<= 30` karakter) ve Alt Başlık (`<= 30` karakter)
- App Store Tanıtım Metni (`<= 170` karakter) ve Anahtar Kelime Havuzu (`<= 100` karakter, virgülle ayrılmış, boşluksuz)
- Google Play Kısa Açıklama (`<= 80` karakter)
- App Store & Google Play Uzun Açıklama (`<= 4000` karakter — 16 Boss savaşı, `%80+` alan kesme stratejisi, kalkan gerilimi, güçlendirme kutuları ve çevrimdışı oynanış vurgulu)
- İnceleme Ekibi Notu (`App Review Notes` — oyunun nasıl oynandığını, 16 bölümlük kampanya ve gemi hangarı özelliklerini Apple inceleme uzmanına net anlatan İngilizce kısa not).

## 5. MAĞAZA ÖNCESİ OTOMATİK DENETİM BETİĞİ (`scripts/preflight-check.mjs`)
`npm run preflight` komutu çalıştırıldığında şu kontrolleri yapan bir Node betiği yaz:
1. Kaynak kodda veya mağaza metinlerinde yasaklı ticari markaların (`volfied`, `qix`, `taito`, `monotros`) geçmediğini doğrular.
2. `dist/` klasöründe harici `http://` veya CDN bağımlılığı olmadığını doğrular.
3. `resources/icon-only.png` dosyasının `1024x1024` olduğunu ve alfa (şeffaflık) kanalı içermediğini kontrol eder.
4. `PrivacyInfo.xcprivacy` dosyasının mevcut olduğunu doğrular.
```

## Bölüm 2: Adım Adım Mağaza Yayınlama Rehberi (Sizin Uygulayacağınız Kılavuz)

### A. Mağaza Görsel Gereksinimleri Tablosu
[Capgo Mağaza Hazırlık Rehberi](https://capgo.app/blog/how-to-prepare-app-store-and-google-play-listing/) ve [Capacitor Resmi Dokümanları](https://capacitorjs.com/docs/v7/guides/splash-screens-and-icons) uyarınca hazırlamanız gereken görseller:

| Görsel Öğesi | Apple App Store Zorunluluğu | Google Play Store Zorunluluğu |
| :--- | :--- | :--- |
| **Uygulama İkonu** | `1024 x 1024 px` PNG, **şeffaflık yok**, köşe yuvarlatma yok (binary içinde) | `512 x 512 px` 32-bit PNG, maks. 1 MB (Play Console'a yüklenir) |
| **Özellik Grafiği (Feature Graphic)** | İstenmez | `1024 x 500 px` JPEG veya 24-bit PNG (**Zorunlu**) |
| **Ekran Görüntüleri** | Cihaz boyutu başına 3–10 adet (6.9" / 6.5" iPhone ve 13" iPad boyutları yeterlidir) | Cihaz tipi başına 2–8 adet (Telefon + 7"/10" Tablet) |
| **Önizleme Videosu** | Opsiyonel (`15–30 sn` yerel ekran kaydı) | Opsiyonel (1 adet YouTube bağlantısı) |

### B. Apple App Store'a Gönderim (macOS + Xcode)
1. **Apple Developer Hesabı:** Yıllık $99 üyeliğinizi aktif edin ve `https://appstoreconnect.apple.com` üzerinde **My Apps > + > New App** adımıyla `com.yourstudio.voidcarver` Bundle ID'sini kaydedin.
2. **Projeyi Senkronize Edin ve Açın:**
   ```bash
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
3. **Xcode İmzalama (`Signing & Capabilities`):**
   - Sol panelden `App` hedefini seçin, **Signing & Capabilities** sekmesinde `Automatically manage signing` kutusunu işaretleyip **Team** olarak geliştirici hesabınızı seçin.
   - **General** sekmesinde `Version` (`1.0.0`) ve `Build` (`1`) numaralarını kontrol edin.
4. **Arşivleme ve Yükleme (`Archive`):**
   - Üst cihaz seçiciden simülatör yerine **`Any iOS Device (arm64)`** seçin.
   - Menüden **Product > Archive** tıklayın. Derleme bitince açılan Organizer penceresinde **Distribute App > App Store Connect > Upload** adımlarını izleyin ([Capacitor iOS Rehberi](https://capacitorjs.com/docs/ios/deploying-to-app-store)).
5. **Apple Guideline 4.2 ("Minimum Functionality") Onay İpuçları:**
   - Apple, sadece basit bir web sitesini saran uygulamaları Guideline 4.2'den reddedebilir. Faz 3 ve Faz 4'te eklediğimiz **yerel Haptics titreşimleri, 16 bölümlük yıldızlı kampanya, Gemi Hangarı kozmetik sistemi, çevrimdışı çalışma ve tam ekran Safe-Area uyumu** sayesinde uygulamanız gerçek bir yerel arcade oyunu olarak değerlendirilir.
   - Ekran görüntülerinizde hem yoğun bir Boss kesim anını (`%84` alan + parlayan kalkan), hem Bölüm 6 çift boss sahnesini, hem de Gemi Hangarı ekranını mutlaka gösterin.

### C. Google Play Store'a Gönderim (Android Studio — Windows / macOS / Linux)
1. **Google Play Console Hesabı:** Tek seferlik $25 kayıt ücretiyle hesabınızı açın (`https://play.google.com/console`). *Not: Kişisel yeni geliştirici hesaplarında Üretim (`Production`) yayını öncesi Google Play'in "14 gün boyunca en az 12 test kullanıcısıyla Kapalı Test (Closed Testing)" kuralı geçerlidir; şirket (DUNS numaralı Organization) hesaplarında doğrudan üretime çıkılabilir.*
2. **Release Keystore Anahtarı Oluşturma (Sadece 1 Kez Yapılır ve Yedeklenir!):**
   ```bash
   keytool -genkey -v -keystore void-carver-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias voidcarver
   ```
   *Bu `.jks` dosyasını ve şifresini güvenli bir bulut kasasında yedekleyin; kaybederseniz Play Store'daki uygulamanıza bir daha güncelleme gönderemezsiniz.*
3. **İmzalı `.aab` (Android App Bundle) Üretimi:**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```
   - Android Studio açılınca Gradle eşitlemesinin bitmesini bekleyin.
   - Üst menüden **Build > Generate Signed App Bundle or APK > Android App Bundle** seçin ([Capacitor Android Rehberi](https://capacitorjs.com/docs/android/deploying-to-google-play)).
   - `void-carver-release.jks` dosyanızı seçip `release` derlemesini başlatın. Üretilen `android/app/release/app-release.aab` dosyasını alın.
4. **Play Console Formları:**
   - **Uygulama İçeriği (App Content):** Gizlilik Politikası URL'si (`privacy-policy.html` adresiniz), Veri Güvenliği (Data Safety: *"Veri toplanmıyor / üçüncü taraflarla paylaşılmıyor"*), Reklam Beyanı ve IARC Yaş Derecelendirmesi (Hafif bilimkurgu/fantastik şiddet — genellikle `PEGI 3` / `ESRB Everyone` çıkar, orijinal [Arcade Archives VOLFIED](https://strategywiki.org/wiki/Volfied) derecesiyle uyumludur) formlarını doldurup `.aab` paketini yükleyin.
