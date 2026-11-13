# ADIM 4 PROMPTU: Kusursuz Mobil Oynanış ve Gerçek 1989 Volfied Kuralları

Görsel olarak 1989 Taito **[Volfied](https://ja.wikipedia.org/wiki/%E3%83%B4%E3%82%A9%E3%83%AB%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89)** ([NamuWiki](https://ja.namu.wiki/w/%EB%B3%BC%ED%94%BC%EB%93%9C(%EA%B2%8C%EC%9E%84))) sadakatini yakalarken, dokunmatik telefon ekranında oynanışı yağ gibi akıcı ve adil hale getiren tüm mekanik kurallar bu adımda uygulanır.

## Uygulanacak Fizik ve Mobil Kontrol Spesifikasyonu

```markdown
# GÖREV 4: `PlayerShip.ts`, `TouchControls.ts`, `TrailFuse.ts` VE `GameEngine.ts` KUSURSUZ OYNANIŞ

## 1. GERÇEK VOLFIED ÇİZGİ GERİ SARMA (`LINE BACKTRACK / RETREAT`)
Orijinal 1989 Taito arcade sürümündeki en kritik kuralı uygula:
- Oyuncu içeride turuncu kesim çizgisini (`activeTrail`) çizerken tam ters yöne (`180°` geri yöne) çekerse gemi durmaz ve patlamaz; **kendi çizdiği hattı `1.15x` hızla geri sararak (sökerek) güvenli yeşil kenara doğru geri çekilebilir!**
- Tamamen başlangıç noktasına (`P_start`) geri sararsa tekrar güvenli yeşil kenara (`STATE_ON_BORDER`) oturur ve dairesel yeşil kalkan haresi yeniden açılır.

## 2. KIRMIZI ARCADE KOL + PARMAK KAYDIRMA HİBRİT KONTROL (`TouchControls.ts`)
- Alt kontrol panelinde `01-hedef-oynanis.jpg` görselindeki gibi solda **parlak kırmızı topuzlu piksel-art arcade joystick** (dokunulan yöne topuzu gerçekten eğilen 5-yön animasyonlu: Merkez, Yukarı, Aşağı, Sol, Sağ!) ve sağda **kırmızı piksel-art `KES` butonu** (basılınca aşağı gömülen 2 kare sprite) yer alır.
- **Akıllı Çift Destek:** Oyuncu ister sol kol + `KES` butonuyla oynar, ister doğrudan oyun alanı üzerinde parmağını kaydırarak (`Direct Swipe`) yön verir ve kenardan içeri kaydırdığında otomatik kesime başlar!
- **140ms Köşe Dönüş Tamponu (`Corner Buffer`) + `18px` Köşe Mıknatısı:** Köşelere yaklaşırken erken basılan yön komutu hafızada tutulur ve tam köşede milimetrik `90°` dönüş yapılır.

## 3. KENARDA OTOMATİK LAZER / SÜPER ATIŞ (`AUTO-FIRE ON SHIELD LINE`)
- Oyuncu **`L` (Lazer)** veya **`★` (3'lü Süper Plazma Atışı)** kapsülünü aldığında, güvenli yeşil sınır çizgisi üzerindeyken geminin burnu sahanın içine döner ve **otomatik seri ateş** eder (`KES` tuşuna basıp yanlışlıkla kenardan dışarı fırlayıp ölme hatası %100 engellenir!).

## 4. KALKAN `0` UYARISI, `S` HIZ DENGESİ VE DAR KORİDORDA BOSS KÜÇÜLMESİ
- **Kalkan `0` Son 3 Saniye Uyarı Flaşı:** `KALKAN` sayacı `0`'a indiğinde geminin yeşil dairesel kalkanı `3.0` saniye boyunca kırmızı-sarı yanıp sönerek sesli uyarı verir, ardından kapanır.
- **`S` Hızı Kıvılcımı Geçer:** Normal gemi hızı `300 px/s`, çizgideki turuncu-kırmızı kıvılcım (`Spark`) `380 px/s`, `S` (Hız) alınmış gemi `430 px/s` (orijinal Volfied kuralı: `S` alan oyuncu çizgi kıvılcımından kaçabilir!).
- **Dar Koridorda Dinamik Boss Küçülmesi:** Kalan alan daraldığında Boss gövdesi dar geçitlere sığmak için yumuşakça `%62` ölçeğe kadar küçülür (`%99` kesim yapmayı mümkün kılar); eğer Boss tamamen hareketsiz kalacak bir cebe `1.8 sn` sıkıştırılırsa patlayarak bölümü `+100.000` bonusla otomatik tamamlar!
```
