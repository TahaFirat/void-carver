# ADIM 2 PROMPTU: 100 Ardışık Bölüm ve 4 Kademeli Zorluk Sistemi (`KOLAY` · `ORTA` · `ZOR` · `USTA`)

Oyunun birkaç saatte bitmemesi, uzun vadeli bağımlılık yaratması ve son bölümlere ulaşmanın gerçek bir ustalık nişanı olması için **4 Kademeli x 25 Bölüm = 100 Ardışık Bölüm (`BÖLÜM 001` – `BÖLÜM 100`)** mimarisi kuruyoruz.

## Uygulanacak 100 Bölüm ve Kademe Spesifikasyonu

```markdown
# GÖREV 2: `src/levels/CampaignGenerator.ts`, `LevelDefinitions.ts` VE `MenuRenderer.ts` 100 BÖLÜM MİMARİSİ

## 1. ARDIŞIK KİLİT AÇMA KURALI (STRICT SEQUENTIAL PROGRESSION)
- Oyuncu oyuna `BÖLÜM 001` açık olarak başlar (`unlockedMaxStage = 1`).
- Yalnızca `Bölüm N` başarıyla geçildiğinde `Bölüm N + 1` kilidi açılır (`unlockedMaxStage = Math.max(unlockedMaxStage, N + 1)`).
- Kademeler de ardışıktır:
  - **KADEME 1: `KOLAY (1-25)`** -> Başlangıçta açık (`Bölüm 1`'den başlar).
  - **KADEME 2: `ORTA (26-50)`** -> Yalnızca `Bölüm 25` tamamlandığında açılır!
  - **KADEME 3: `ZOR (51-75)`** -> Yalnızca `Bölüm 50` tamamlandığında açılır!
  - **KADEME 4: `USTA (76-100)`** -> Yalnızca `Bölüm 75` tamamlandığında açılır! (Ulaşılması çok zor prestij zirvesi).

## 2. 4 ZORLUK KADEMESİNİN PROFESYONEL DENGE MATRİSİ (`CampaignGenerator.ts`)
Deterministik tohumlu (`seeded PRNG — mulberry32(stageNumber)`) + el yapımı Boss kilometre taşlarıyla **100 bölümün her birini benzersiz** üret (16 farklı 16-bit gezegen/üs haritası döngüsel ve varyasyonlu paletlerle döner, böylece görsel tekrar yaşanmaz):

| Kademe | Bölüm Aralığı | Hedef Alan `%` | Kalkan Süresi | Duvar Kutu & Sütun Yapısı | Düşman & Boss Zorluğu | Kıvılcım & Mayın Baskısı |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KOLAY** | **`01 – 25`** | **`%80`** | `110 sn` -> `86 sn` (`4` Can) | `2–4` Güçlendirme Duvarı (`0` kör sütun) | `1.0x` Boss hızı, `2–3` böcek; her 5 bölümde özel Boss (`05, 10, 15, 20, 25`) | Kıvılcım `1.18x`, Mayın `75 sn` sonra |
| **ORTA** | **`26 – 50`** | **`%82`** | `84 sn` -> `68 sn` (`3` Can) | `3–4` Güçlendirme + `1–2` Kör Zırh Sütunu (koridor oluşturur), yanıp sönen bloklar | `1.22x` Boss hızı, `3–4` karma böcek/avcı; `30, 36, 42, 48` Çift Boss! | Kıvılcım `1.32x`, Kenar bariyerleri `%20`, Mayın `55 sn` |
| **ZOR** | **`51 – 75`** | **`%85`** | `66 sn` -> `52 sn` (`3` Can) | `2–3` Güçlendirme + `3–4` Kör Zırh Sütunu (dar labirent kapıları!) | `1.40x` Boss hızı, hızlı mermi yelpazesi, `4–5` agresif avcı böcek, sık Çift Boss | Kıvılcım `1.46x`, Kenar bariyerleri `%30`, Mayın `42 sn` |
| **USTA** | **`76 – 100`** | **`%88`** (`96–100`: **`%90`!**) | `50 sn` -> `40 sn` (`3` Can, devam hakkı sınırlı!) | Yalnızca `0–1` kritik `P`/`S` kutusu + **`4–6` Kör Zırh Sütunu**! | `1.58x` Boss öfke hızı; `80, 85, 90, 95` Çift Elit Boss; **Bölüm 100: Ana Beyin + İkiz Muhafız!** | Kıvılcım `1.60x`, Kenar bariyerleri `%38`, Mayın `30 sn` |

### Özel Kilometre Taşı Boss Atamaları
- Her kademenin `5.` katı bölümleri (`05, 10, 15, 20, 25, 30, ..., 95, 100`) özel "Kademe Kapısı Boss Savaşı"dır (daha büyük Boss varyantı, özel renk paleti ve ilk geçişte ekstra yıldız bonusu).
- `StorageService.ts` kaydını `100` bölümü (`Record<number, { stars: number, bestPercent: number }>`) destekleyecek şekilde genişlet (eski `1..16` kaydı varsa otomatik koruyarak `unlockedMaxStage` değerine aktar).

## 3. SADE `5x5` KADEMELİ ANA MENÜ ARAYÜZÜ (`02-hedef-100-bolum-kademeli-menu.jpg` Birebir)
100 bölümü tek ekranda sıfır karmaşayla göstermek için:
1. Üstte yeşil ızgara gezegen + krom `VOID CARVER` + **`REKOR`**.
2. Hemen altında tek büyük kırmızı-altın başlat butonu: **`DEVAM ET • BÖLÜM 034`** *(Açık olan en son bölümü doğrudan başlatır).*
3. Altında yan yana **4 Kademe Sekmesi (`Tab Bar`)**:
   - `KOLAY 1-25` (tamamlandıysa yeşil `✔`)
   - `ORTA 26-50` (aktif seçili sekme altın çerçeveli)
   - `ZOR 51-75` (kilitliyse küçük kilit ikonu)
   - `USTA 76-100` (koyu kızıl sekme, kuru kafa / kilit ikonu)
4. Sekmelerin altında seçili kademenin **25 bölümünü gösteren `5 x 5` perçinli çelik kutu ızgarası** (örn. `26`..`50`):
   - Geçilen kutularda sadece bölüm numarası ve altın yıldız, sıradaki kutuda parlak altın çerçeve, henüz ulaşılmamış kutularda numara + küçük sarı kilit ikonu!
5. Oyun içi alt durum şeridinde hangi kademede olunduğu net yazar: **`ORTA • BÖLÜM 34` | gemiler | `68% / 82%` | `KALKAN 760`**.
```
