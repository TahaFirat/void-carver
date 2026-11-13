# Volfied Benzeri Web ve Mobil Oyun Geliştirme: Elit Prompt Mühendisliği Paketi

Bu paket, Taito'nun 1989 tarihli kült arcade oyunu **[Volfied](https://en.wikipedia.org/wiki/Volfied)** (Kuzey Amerika'da Sega Genesis üzerinde *Ultimate Qix*, PlayStation'da *Qix Neo* olarak da bilinir) mekaniklerini sıfırdan, telif ihlali yaratmayan özgün bir bilimkurgu evreniyle **önce modern Web (HTML5 Canvas + TypeScript + Vite)** olarak inşa etmeniz, ardından **[Capacitor](https://capacitorjs.com/)** ile **Apple App Store (iOS)** ve **Google Play Store (Android)** mağazalarında yayınlamanız için tasarlanmış uçtan uca bir yapay zekâ kodlama (AI-Assisted Engineering) prompt setidir.

## Paket İçeriğindeki Dosyalar ve Uygulama Sırası

Yapay zekâ kodlama ajanları (Cursor, Claude Code, Windsurf, GitHub Copilot, Gemini CLI vb.) tek seferde "bana tüm oyunu ve mobil uygulamayı yaz" dendiğinde poligon kesme matematiğinde (özellikle içbükey L/U şekilli kesimlerde), mobil dokunmatik gecikmelerinde ve iOS `WKWebView` ses/ekran sınırlarında hatalı kod üretir. Bu sorunu tamamen ortadan kaldırmak için proje **deterministik 5 faza ve 8 modüler dosyaya** bölünmüştür:

| Sıra | Dosya Adı | Kullanım Amacı ve Çıktısı |
| :--- | :--- | :--- |
| **00** | `00-BASLANGIC-VE-PROMPT-KULLANIM-REHBERI.md` | Mimari kararlar, teknoloji yığını, AI sistem kuralları (`.cursorrules` / `CLAUDE.md`) ve adım adım iş akışı |
| **01** | `01-VOLFIED-OYUN-HARITA-VE-LEVEL-ANALIZI.md` | Orijinal oyunun harita/poligon algoritması, kalkan, fitil, bariyer, gri kutular, boss ve 16 level analiz dokümanı (GDD) |
| **02** | `02-PROMPT-FAZ1-WEB-CEKIRDEK-VE-HARITA-MOTORU.md` | **Faz 1 Promptu:** Vite + TS kurulumu, kenar/bariyer hareketi, ortogonal kesim, poligon bölme, %80 hesabı, kalkan ve fitil fiziği |
| **03** | `03-PROMPT-FAZ2-DUSMAN-BOSS-GUCLENDIRME-VE-16-LEVEL.md` | **Faz 2 Promptu:** Yaratık AI tipleri, 16 özgün Boss (Bölüm 6 Çift Boss dahil), `S/T/P/L/C` + Boss silahı kutuları ve skor motoru |
| **04** | `04-PROMPT-FAZ3-MOBIL-DOKUNMATIK-UX-SES-VE-CILALAMA.md` | **Faz 3 Promptu:** Mobil dokunmatik kontroller (köşe tamponlama), Web Audio synth ses motoru, parçacık efektleri ve meta-sistemler |
| **05** | `05-PROMPT-FAZ4-CAPACITOR-IOS-VE-ANDROID-ENTEGRASYONU.md` | **Faz 4 Promptu:** Capacitor v8 kurulumu, Haptics, Safe Area, Status/System Bars, Ekran Yönü kilidi, İkon/Splash ve çevrimdışı kayıt |
| **06** | `06-PROMPT-FAZ5-APPSTORE-VE-PLAYSTORE-YAYINLAMA-REHBERI.md` | **Faz 5 Promptu ve Rehberi:** Apple Guideline 4.2 onay kalkanı, `PrivacyInfo.xcprivacy`, Xcode IPA, Android Keystore/AAB ve ASO metinleri |
| **07** | `07-BONUS-HATA-AYIKLAMA-PERFORMANS-VE-MONETIZASYON.md` | **Bonus Promptlar:** Poligon ve çarpışma edge-case yamaları, 120 FPS optimizasyonu, AdMob ödüllü reklam ve IAP entegrasyonu |

## Neden Bu Teknoloji Yığını Seçildi?

Mağaza onay hızı, 60/120 FPS akıcılık ve sıfır harici sunucu maliyeti için en optimal yığın belirlenmiştir:

1. **Çekirdek Oyun Motoru: TypeScript + Vite + Saf HTML5 Canvas 2D (`OffscreenCanvas` Katmanlı Mimari)**
   - *Volfied* tarzı oyunlarda asıl iş yükü 3B fizik değil, **dinamik poligon maskeleme (`globalCompositeOperation = 'destination-out'`)** ve **ortogonal çizgi-poligon kesişim matematiğidir**. Saf TypeScript + Canvas 2D yaklaşımı ağır oyun motoru şişkinliği olmadan < 2 MB paket boyutu üretir, iOS `WKWebView` ve Android `WebView` içinde anında açılır ve deterministik piksel/ızgara hassasiyeti sağlar.
2. **Ses Motoru: Prosedürel Web Audio API Synthesizer**
   - Harici `.mp3`/`.wav` telif sorunlarını ve yükleme gecikmelerini sıfırlar; orijinal 1989 arcade atmosferindeki ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)) retro-fütüristik lazer, kalkan uğultusu, fitil cızırtısı ve alan kırılma patlamalarını gerçek zamanlı osilatörlerle üretir.
3. **Mobil Köprü: [Capacitor](https://capacitorjs.com/) (v8+)**
   - Web kod tabanını bozmadan doğrudan yerel Xcode (`ios/App`) ve Android Studio (`android/app`) projelerine dönüştürür ([Capacitor iOS Rehberi](https://capacitorjs.com/docs/ios/deploying-to-app-store), [Capacitor Android Rehberi](https://capacitorjs.com/docs/android/deploying-to-google-play)).
   - **[Capacitor Haptics](https://capacitorjs.com/docs/apis/haptics)**, **[Capacitor Status Bar](https://capacitorjs.com/docs/apis/status-bar)** / **[System Bars](https://capacitorjs.com/docs/next/apis/system-bars)**, **[Capawesome Screen Orientation](https://capawesome.io/docs/sdks/capacitor/screen-orientation/)** ve **[@capacitor/assets](https://capacitorjs.com/docs/v7/guides/splash-screens-and-icons)** eklentileriyle oyunu sıradan bir web sayfası olmaktan çıkarıp yerel (native) mobil oyun hissine taşır.

## AI Kodlama Ajanına İlk Verilecek "Global Sistem Kuralı" (`CLAUDE.md` veya `.cursorrules`)

Kodlamaya başlamadan önce proje kök dizininizde bir `.cursorrules` veya `CLAUDE.md` dosyası oluşturup aşağıdaki bloğu yapıştırın. Ardından `01` numaralı analiz dosyasını referans vererek `02`'den `06`'ya kadar olan promptları **sırayla** çalıştırın.

```markdown
# SYSTEM ROLE & ARCHITECTURAL INVARIANTS (VOLFIED-LIKE MOBILE ARCADE GAME)

Sen kıdemli bir Oyun Motoru Mimarı (2D Hesaplamalı Geometri uzmanı) ve Mobil Capacitor Yayın Mühendisisin.
Geliştirdiğimiz oyun, 1989 Taito klasiği Volfied mekaniklerinden ilham alan fakat %100 özgün IP, isimlendirme ("VOID CARVER: SECTOR 80"), özgün vektör/prosedürel görseller ve özgün ses sentezleyicisi kullanan ticari kalitede bir Web + iOS + Android oyunudur.

## KESİN MÜHENDİSLİK KURALLARI (ASLA İHLAL ETME)
1. **Tam Sayı Izgara Geometri (Integer Grid Coordinates):** Tüm oyun alanı mantıksal `900 x 1200` (dikey mobil-öncelikli 3:4 arena, çift kat sayı: 2px veya 1px tam sayı ızgarası) sanal koordinat sisteminde çalışır. Poligon köşeleri (`Vertex`), oyuncu konumu ve çizilen kesim izi (`Trail`) ASLA kayan noktalı (`float`) yuvarlama hatasına bırakılmaz; her köşe tam sayı (`Math.round`) ızgaraya kenetlenir.
2. **Sıfır Kendi Kendini Kesme (No Self-Intersection):** Oyuncu kesim yaparken (`STATE_CUTTING`) kendi aktif izine (`activeTrail`) değemez veya üstünden geçemez; 180 derece ters yöne basıldığında gemi kendi izini kesip ölmemeli, bu girdi yok sayılmalı veya duraksamalıdır.
3. **Poligon Bölme Doğruluğu:** Kesim kenara ulaştığında, mevcut oyun alanı poligonu (`activePolygon`) çizilen `trail` boyunca iki kapalı alt poligona (`polyA`, `polyB`) bölünür. Ana Boss'un merkez noktasını barındıran poligon yeni `activePolygon` ("dış/aktif alan") olur; diğer poligon ele geçirilmiş ("iç/temizlenmiş alan") kabul edilir. Poligon alanı her zaman **Shoelace Formülü** ile hesaplanır ve `1.0 - (currentArea / initialArea)` üzerinden net yüzde (`%0.0` - `%99.9`) üretilir.
4. **Mobil-Öncelikli Kontroller ve Performans:** Tüm girdi sistemi hem masaüstü klavye (`WASD`/Ok tuşları + `Space`/`Shift`) hem de mobil dokunmatik (Sanal D-Pad / Kaydırma + Köşe Dönüş Tamponlama `Corner Turn Buffering`) desteklemelidir. Oyun döngüsü `requestAnimationFrame` üzerinde sabit zaman adımı (`fixed timestep = 1/60s`, `maxDelta = 0.05s`) ile çalışmalıdır.
5. **Telif ve Marka Güvenliği:** Kodda, arayüzde veya mağaza metinlerinde "Volfied", "Qix", "Taito", "Monotros" kelimeleri ASLA geçmeyecektir.
6. **Eksiksiz Kod Üretimi:** Asla `// TODO`, `// buraya eklenecek` veya yarım bırakılmış fonksiyon yazma. Her faz sonunda proje `npm run build` ile sıfır TypeScript hatasıyla derlenmeli ve tarayıcıda doğrudan oynanabilir olmalıdır.
```

## Adım Adım Uygulama İş Akışı

1. Boş bir klasör açın, yukarıdaki kuralları `CLAUDE.md` / `.cursorrules` olarak kaydedin ve `01-VOLFIED-OYUN-HARITA-VE-LEVEL-ANALIZI.md` dosyasını proje köküne koyun (böylece AI ajanı her adımda oyun tasarım kurallarını okuyabilir).
2. **`02-PROMPT-FAZ1-WEB-CEKIRDEK-VE-HARITA-MOTORU.md`** içindeki promptu AI ajanına verin. Tarayıcıda (`npm run dev`) geminin kenarda yürüdüğünü, bariyerlere takıldığını, içeriyi kestiğini, içbükey (L ve U tipi) kesimlerde poligonun hatasız bölündüğünü, kalkanın azaldığını ve çizgiye düşman değince kırmızı fitilin (`Spark/Fuse`) gemiyi kovaladığını doğrulayın.
3. Faz 1 kusursuz çalıştığında **`03-PROMPT-FAZ2-DUSMAN-BOSS-GUCLENDIRME-VE-16-LEVEL.md`** promptunu vererek 16 bölümü, Bölüm 6 çift boss bölme mekaniğini, gri kutuları (`S`, `T`, `P`, `L`, `C`), kırmızı ışıklı boss silahı kutusunu ve puanlama sistemini ekletin.
4. **`04-PROMPT-FAZ3-MOBIL-DOKUNMATIK-UX-SES-VE-CILALAMA.md`** promptunu vererek mobil parmak ergonomisini, Web Audio ses motorunu, bölüm seçimi / gemi garajı meta ekranlarını (App Store 4.2 onayı için kritiktir) tamamlayın.
5. Web sürümü %100 bittiğinde **`05-PROMPT-FAZ4-CAPACITOR-IOS-VE-ANDROID-ENTEGRASYONU.md`** promptunu çalıştırarak iOS ve Android yerel projelerini üretin.
6. Son olarak **`06-PROMPT-FAZ5-APPSTORE-VE-PLAYSTORE-YAYINLAMA-REHBERI.md`** içindeki adımları ve mağaza metin üretici promptunu kullanarak imzalı `.ipa` ve `.aab` paketlerinizi mağazalara yükleyin.
