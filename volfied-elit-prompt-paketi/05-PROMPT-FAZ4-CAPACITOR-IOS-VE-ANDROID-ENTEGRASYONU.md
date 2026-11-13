# FAZ 4 PROMPTU: Capacitor ile iOS ve Android Yerel Mobil Uygulamaya Dönüştürme

Web oyununuz tarayıcıda kusursuz çalıştıktan sonra, tek kod tabanını **[Capacitor](https://capacitorjs.com/)** (v8+) kullanarak **Xcode (`ios/App`)** ve **Android Studio (`android/app`)** projelerine dönüştürmek için bu dosyadaki promptu AI kodlama ajanınıza verin.

Bu faz; **[Capacitor Haptics](https://capacitorjs.com/docs/apis/haptics)** titreşim geri bildirimlerini, **[Capacitor Status Bar](https://capacitorjs.com/docs/apis/status-bar)** / **[System Bars](https://capacitorjs.com/docs/next/apis/system-bars)** tam ekran görünümünü, **[Capawesome Screen Orientation](https://capawesome.io/docs/sdks/capacitor/screen-orientation/)** ekran kilidini ve **[@capacitor/assets](https://capacitorjs.com/docs/v7/guides/splash-screens-and-icons)** ikon/açılış ekranı üretim hattını eksiksiz kurar.

## Kopyalanacak Master Prompt ( Faz 4 )

```markdown
# GÖREV: FAZ 4 — CAPACITOR (iOS & ANDROID) YEREL KÖPRÜ, EKLENTİLER, SAFE-AREA VE İKON/SPLASH OTOMASYONU

Mevcut Vite + TypeScript Web oyunumuzu Apple App Store ve Google Play Store standartlarına tam uyumlu bir Capacitor mobil uygulamasına dönüştür. Web tarayıcısında çalışmayı bozmadan (`Capacitor.isNativePlatform()` kontrolüyle) yerel donanım özelliklerini entegre et.

## 1. PAKET KURULUMLARI VE `capacitor.config.ts` YAPILANDIRMASI
Aşağıdaki resmi Capacitor paketlerini `package.json` içine ekle ve kur:
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- `@capacitor/app` (arka plan/ön plan yaşam döngüsü ve Android geri tuşu için)
- `@capacitor/haptics` (kesim, köşe dönüşü, kutu açma ve patlama titreşimleri için)
- `@capacitor/status-bar` (tam ekran oyun deneyimi için; Android 16 / API 36 uyumluluk notlarını gözeterek)
- `@capacitor/splash-screen` (pürüzsüz açılış geçişi için)
- `@capacitor/preferences` (iOS/Android işletim sistemi temizliğinden etkilenmeyen kalıcı yerel kayıt için)
- `@capawesome/capacitor-screen-orientation` (ekranı dikey `portrait` modda kilitlemek için)
- Geliştirme bağımlılığı (`devDependencies`): `@capacitor/assets`

`capacitor.config.ts` dosyasını oluştur:
- `appId`: `'com.yourstudio.voidcarver'` (kullanıcının kendi alan adıyla değiştirebileceği net sabit)
- `appName`: `'Void Carver'`
- `webDir`: `'dist'`
- `backgroundColor`: `'#05070F'`
- `ios.contentInset`: `'never'` (Canvas ve CSS `env(safe-area-inset-*)` ile tam kontrol sağlamak için)
- `plugins.SplashScreen`: `launchShowDuration: 1500`, `launchAutoHide: false` (oyun motoru ilk karesini çizdiğinde `SplashScreen.hide()` ile biz kapatacağız ki asla beyaz ekran görünmesin!), `backgroundColor: '#05070F'`.

## 2. YEREL DONANIM KÖPRÜSÜ (`src/native/NativeBridge.ts`)
Web'de hata vermeyen (graceful fallback), iOS ve Android'de yerel API'leri çağıran tekil bir `NativeBridge` servisi yaz ve oyun olaylarına bağla:
1. **Dokunsal Geri Bildirim (`Haptics`):**
   - Kenar köşelerinde veya kesim sırasında `90°` dönüş yapıldığında: `Haptics.selectionChanged()` veya çok hafif `ImpactStyle.Light` (Ayarlardan kapatılabilir).
   - Gri güçlendirme kutusu ele geçirildiğinde: `ImpactStyle.Medium`.
   - Alan kesilip poligon parçalandığında (`>= %10` kesim): `ImpactStyle.Heavy`.
   - Fitil gemiye yetiştiğinde veya Boss çarptığında: `Haptics.notification({ type: NotificationType.Error })`.
2. **Yaşam Döngüsü ve Android Geri Tuşu (`@capacitor/app`):**
   - `App.addListener('appStateChange', ({ isActive }) => ...)`: Uygulama arka plana atıldığında (`!isActive`) oyunu anında `PAUSED` durumuna al ve `SoundEngine` ses bağlamını askıya al (`suspend`); geri dönüldüğünde ses bağlamını uyandır (`resume`).
   - `App.addListener('backButton', ...)`: Android fiziksel geri tuşuna basıldığında oyun içindeyse Duraklatma menüsünü aç, alt menülerdeyse Ana Menüye dön.
3. **Kalıcı Depolama Geçişi (`@capacitor/preferences`):**
   - Faz 3'teki `StorageService.ts` sınıfını güncelle: Yerel platformda `@capacitor/preferences` (`Preferences.get` / `Preferences.set`) kullan (iOS `WKWebView` bellek baskısında `localStorage` silinebildiği için bu adım App Store kalitesi açısından zorunludur), Web'de `localStorage` yedeğini koru.
4. **Tam Ekran ve Yön Kilidi:**
   - Açılışta `ScreenOrientation.lock({ type: OrientationType.PORTRAIT })` ve `StatusBar.hide()` çağrılarını güvenli `try/catch` bloğuyla çalıştır.

## 3. MOBİL WEBVIEW CSS VE DOKUNMATİK SERTLEŞTİRME
`index.html` ve global CSS içinde iOS `WKWebView` ve Android `WebView` üzerinde "bu bir web sitesidir" hissi verebilecek tüm tarayıcı davranışlarını tamamen kapat:
- `overscroll-behavior: none; touch-action: none;` (lastik bant kaydırma ve çift dokunuşla yakınlaştırmayı engelle)
- `-webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;` (uzun basınca metin seçimi veya büyüteç çıkmasını engelle)
- **Çentik ve Dynamic Island Güvenli Alanı (`Safe Area Insets`):** Üst HUD göstergelerini (Skor, `%` Alan, Kalkan `999` sayacı, Can) `padding-top: max(12px, env(safe-area-inset-top))` ve alt D-Pad bölgesini `padding-bottom: max(16px, env(safe-area-inset-bottom))` değerlerini okuyarak konumlandır; hiçbir iPhone veya Android ekranında çentik veya alt çubuk HUD üstüne binmesin.

## 4. İKON VE SPLASH EKRANI ÜRETİM HATTI (`resources/`)
Proje kökünde `scripts/generate-placeholder-assets.mjs` (Canvas/SVG veya saf PNG üretici Node betiği) hazırla; tek komutla `resources/` klasörü altına mağaza standartlarına uygun kaynak görselleri üretsin:
- `resources/icon-only.png` ve `resources/icon-foreground.png` + `resources/icon-background.png` (`1024 x 1024 px`, **şeffaflık/alfa kanalı OLMAYAN** tam opak PNG — Apple şeffaf ikonu reddeder!).
- `resources/splash.png` ve `resources/splash-dark.png` (`2732 x 2732 px`, merkezde siber gemi amblemi, `#05070F` arka plan).
- `package.json` içine şu otomasyon betiklerini ekle:
  - `"mobile:init": "npx cap add ios && npx cap add android"`
  - `"mobile:assets": "npx capacitor-assets generate"`
  - `"mobile:sync": "npm run build && npx cap sync"`
  - `"mobile:ios": "npm run build && npx cap sync ios && npx cap open ios"`
  - `"mobile:android": "npm run build && npx cap sync android && npx cap open android"`

## 5. KABUL KRİTERLERİ
- `npm run build` çalıştır, `dist/` çıktısının çevrimdışı (internet bağlantısı tamamen kapalıyken; harici CDN fontu veya scripti olmadan!) eksiksiz çalıştığını doğrula.
- Eğer `ios/` ve `android/` klasörleri henüz eklenmemişse `npx cap add ios` ve `npx cap add android` ardından `npx cap sync` komutlarını çalıştırıp sıfır hata alındığını doğrula.
```

## Önemli Teknik Notlar (Kaynak Doğrulamalı)

- **Android 12+ ve Android 16 (API 36) Davranışı:** Google, Android 12 ve sonrasında tam ekran görsel yerine koyu arka plan üzerinde ortalanmış ikonlu yeni Splash Screen API'sini zorunlu kılmıştır ([Capacitor Splash Screens & Icons](https://capacitorjs.com/docs/v7/guides/splash-screens-and-icons)). Ayrıca Android 16 (API 36) hedefleyen Capacitor 8 uygulamalarında eski `overlaysWebView` ayarı yerine uçtan uca (`edge-to-edge`) görünüm varsayılan olduğundan, CSS `env(safe-area-inset-*)` kullanımı en güvenli çözümdür ([Capacitor Status Bar API](https://capacitorjs.com/docs/apis/status-bar), [Capacitor System Bars API](https://capacitorjs.com/docs/next/apis/system-bars)).
- **Apple İkon Kuralı:** App Store ikonu `1024 x 1024 px` boyutunda, yuvarlatılmış köşe içermeyen ve alfa (şeffaflık) kanalı bulunmayan düz PNG olmalıdır ([Capgo Mağaza Hazırlık Rehberi](https://capgo.app/blog/how-to-prepare-app-store-and-google-play-listing/)).
