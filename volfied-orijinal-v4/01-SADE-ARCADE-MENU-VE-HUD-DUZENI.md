# ADIM 1 PROMPTU: İkonik Ama Ultra-Sade 1989 Arcade Menü ve HUD Düzeni

Senin gönderdiğin ekran görüntüsündeki yeşil ızgara gezegenli `VOID CARVER` logosu ve oyun içi arcade çerçevesi harika bir temeldi; tek sorun fazla ve kesik yazıların kafa karıştırmasıydı. Bu adım, ikonik 1989 Taito arcade kimliğini **%100 koruyarak** tüm karmaşık yazıları temizler (`01-hedef-oynanis.jpg` ve `02-hedef-ana-menu.jpg`).

## Uygulanacak Menü ve HUD Spesifikasyonu

```markdown
# GÖREV 1: `src/rendering/MenuRenderer.ts` VE `src/core/GameEngine.ts` ARCADE SADELEŞTİRMESİ

Keskin 16-bit piksel/arcade bitmap font stili (`Press Start 2P` / özel piksel bitmap font çizeri veya keskin piksel gölgeli monospace/arcade font, `imageSmoothingEnabled = false`) kullan; tüm yazılar kısa, net Türkçe ve taşmasız olsun.

## 1. SİLİNECEK KARMAŞIK ELEMANLAR
- Ana menüdeki: `1UP`, `ENDLESS` üst satırı, `KLASİK ARCADE ALAN KUŞATMASI` kutusu, `1P BAŞLAT TUŞUNA BASIN`, yan yana duran karmaşık zorluk/sonsuz dalga kutuları, bölüm kartlarındaki yarım kesilen tüm metinler (`"Turkuaz Zırh Güver"`, `"[ KİLİTLİ ]"` vb.), `ELİT FİLO PAKETİNİ AÇ`, `MADALYALAR` ve `CREDIT 09 FREE PLAY` jeton kutusu TAMAMEN SİLİNİR!
- Oyun içindeki: D-Pad ile `KES` butonu arasındaki `[1P CONTROL DECK • YÖN + ÇİZGİ ÇEK • WASD / ARROWS + SPACE]` kutusu ve sağ alttaki boş `[ -- | HEDEF %80 ]` kutusu TAMAMEN SİLİNİR!

## 2. YENİ SADE 1989 VOLFIED ANA MENÜSÜ (`02-hedef-ana-menu.jpg` Birebir)
1. **Üst Rekor Satırı (`y = 55`):**
   - Ortada altın sarısı piksel fontla yalnızca: **`REKOR 0800390`**
2. **İkonik Gezegen ve Krom Logo (`y = 95..460`):**
   - Koyu uzay yıldız alanı üzerinde 16-bit piksel-art **yeşil enlem-boylam ızgaralı Volfied gezegen küresi**, ortasında kırmızı konturlu parlak gümüş-krom 16-bit **`VOID CARVER`** logosu ve sağ üst doğru turuncu piksel lazer izi bırakarak yükselen çift çatallı piksel `Monotros` gemisi!
3. **Tek Büyük Başlat Butonu (`y = 500..605`):**
   - Altın piksel çerçeveli, koyu kızıl dolgulu tek net buton: **`OYNA • BÖLÜM 08`** *(Açık olan son bölümü yazar).*
4. **4x4 Perçinli Piksel Bölüm Kutuları (`y = 640..1280`):**
   - 16 adet gümüş-çelik perçinli piksel kare kutu (`01`..`16`):
     - **Geçilen bölümler:** Yalnızca büyük piksel rakam (`01`..`07`) ve altında `3` adet piksel altın yıldız **`★★★`** (asla isim veya yüzde yazmaz!).
     - **Seçili/Sıradaki bölüm (`08`):** Parlak altın köşe çerçevesi ve altın rakam **`08`**.
     - **Kilitli bölümler (`09`..`16`):** Rakam ve altında küçük piksel sarı **asma kilit ikonu** (`[ KİLİTLİ ]` yazısı yok!).
5. **En Alt İkili Buton (`y = 1320..1415`):**
   - Gümüş çerçeveli koyu lacivert iki sade arcade buton: solda **`GEMİLER`**, sağda **`AYARLAR`**.
   - `GEMİLER` açıldığında: 4 piksel-art çift çatallı gemi (`GÜMÜŞ`, `KIZIL`, `ALTIN`, `GÖLGE`) ve tek kelimelik `SEÇİLİ` / `SEÇ` / `12 ★` durumu.
   - `AYARLAR` açıldığında: Sadece 4 net satır (`ZORLUK: NORMAL / ZOR`, `KONTROL: KOL+TUŞ / KAYDIR`, `SES: AÇIK / KAPALI`, `TİTREŞİM: AÇIK / KAPALI` ve tüm 16 bölüm bittiyse `SONSUZ MOD`).

## 3. YENİ TEMİZ OYUN İÇİ EKRAN DÜZENİ (`01-hedef-oynanis.jpg` Birebir)
1. **Üst Skor Şeridi (`y: 0..86`, siyah zemin):**
   - Solda beyaz piksel **`SKOR` / `0084500`**, ortada altın sarısı **`REKOR` / `0800390`**, sağda sade metal çerçeveli **`❚❚`** duraklatma butonu.
2. **Altın-Gümüş Arcade Oyun Çerçevesi (`y: 92..1260`):**
   - Köşeleri bağlantı bloklu klasik altın-sarı metalik piksel çerçeve; kenar üzerindeki kilitli bariyer bölgelerinde **kırmızı-gümüş çapraz şeritli piksel bariyer çubukları**!
3. **İnce Tek Satır Durum Şeridi (`y: 1270..1326`, siyah çerçeveli şerit):**
   - Tek bir temiz satırda soldan sağa: **`BÖLÜM 01`** | kalan can kadar küçük piksel `Monotros` gemi ikonu | ortada büyük beyaz **`64.5%`** + altın `/ 80%` | sağda **`KALKAN 942`**!
4. **Alt Arcade Kontrol Paneli (`y: 1332..1600`, koyu antrasit metal zemin):**
   - Solda klasik **parlak kırmızı topuzlu piksel-art arcade joystick** (`cx = 160`), sağda klasik **kırmızı yuvarlak arcade butonu** ve altında tek kelime **`KES`** (`cx = 745`). İkisinin arasındaki orta alan **TAMAMEN BOŞ VE TEMİZ** kalacak!
5. **Kısa Oyun İçi Piksel Etiketler:**
   - Bölüm başında ortada 1 saniye sadece **`BÖLÜM 01`** yazar. Kutu alındığında sadece **`HIZ`**, **`DONDUR`**, **`KALKAN`**, **`LAZER`**, **`TEMİZLE`**, **`SÜPER ATIŞ`** yazar.
```
