# ADIM 5 PROMPTU: Otomatik Duvar-Kutu, 100 Bölüm, Çoklu Cihaz Responsive ve iOS Kabul Testleri

Projeyi teslim etmeden önce tüm yeni sistemlerin hatasız çalıştığını doğrulayan zorunlu kalite kontrol adımıdır.

## Uygulanacak Doğrulama ve Test Spesifikasyonu

```markdown
# GÖREV 5: BİRİM TESTLERİ, 5 CİHAZ RESPONSIVE TESTİ VE iOS ÖN DENETİMİ

## 1. YENİ BİRİM TESTLERİ (`npm test`)
Mevcut geometri testlerine ek olarak şu 4 yeni birim testini yaz ve çalıştır:
1. **Duvar Kutu Geçilmezlik Testi (`SolidBoxCollision.test.ts`):**
   - `STATE_CUTTING` durumundaki gemi bir `[🔴]` kutusuna doğru ilerlediğinde kutunun içine girmediğini, ölmediğini, tam duvar sınırında durduğunu ve `90°` dik yöne komut verildiğinde kutunun etrafından dönerek yoluna devam ettiğini doğrula.
   - Kesim yeşil sınıra bağlandığında `claimedPoly` içinde kalan duvar kutunun kırıldığını ve `solidBoxes` engel listesinden silindiğini doğrula.
   - Böcek ve mermilerin katı kutu duvarından sektiğini doğrula.
2. **100 Bölüm ve 4 Kademe Ardışık Kilit Testi (`Campaign100.test.ts`):**
   - `1`'den `100`'e kadar her bölümün geçerli Boss, harita, kalkan ve birbirine çakışmayan (`gap >= 48px`) kutu koordinatlarıyla üretildiğini doğrula!
   - `Bölüm 24` bitmeden `ORTA (26-50)` kademesinin açılmadığını, `Bölüm 25` geçildiğinde `Bölüm 26` ve `ORTA` sekmesinin açıldığını doğrula.

## 2. 5 FARKLI EKRAN BOYUTUNDA CANLI RESPONSIVE DOĞRULAMASI
Geliştirme sunucusunda (`localhost:5173`) aşağıdaki 5 farklı cihaz çözünürlüğünü tek tek test et ve hiçbirinde taşma, siyah ölü alan veya kontrol çakışması olmadığını doğrula:
1. **Küçük Telefon:** `375 x 667` (iPhone SE — Dikey)
2. **Standart/Uzun Telefon:** `390 x 844` (iPhone 12) ve `430 x 932` (iPhone 15/16 Pro Max — Dikey)
3. **Tablet Dikey:** `820 x 1180` (iPad Air — Dikey `TABLET_PORTRAIT` modu)
4. **Tablet Yatay:** `1180 x 820` (iPad Air — Yatay `LANDSCAPE_SPLIT` 3 sütunlu mod)
5. **Masaüstü / Yatay Telefon:** `844 x 390` ve `1440 x 900`

## 3. TAM iOS HAZIRLIK ÇALIŞTIRMASI
Sırasıyla şu komutları çalıştır ve hepsinin sıfır hatayla tamamlandığını raporla:
1. `npm test`
2. `npm run ios:prepare` (`build` + opak ikon üretimi + `capacitor-assets` + `PrivacyInfo.xcprivacy` + `cap sync ios`)
3. `npm run ios:screenshots` (App Store Connect hazır PNG ekran görüntüleri)
4. `npm run preflight`
```
