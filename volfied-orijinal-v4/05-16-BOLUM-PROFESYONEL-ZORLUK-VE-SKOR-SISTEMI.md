# ADIM 5 PROMPTU: 16 Bölümlük Profesyonel Zorluk Eğrisi ve Orijinal Skor Sistemi

Oyuncunun hiçbir bölümde sıkılmaması ve zorluğun gerçek bir Taito arcade klasiği gibi adil yükselmesi için **[Volfied](https://ja.wikipedia.org/wiki/%E3%83%B4%E3%82%A9%E3%83%AB%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89)** ([NamuWiki](https://ja.namu.wiki/w/%EB%B3%BC%ED%94%BC%EB%93%9C(%EA%B2%8C%EC%9E%84))) 16 bölüm dengesi bu adımda kurulur.

## Uygulanacak 16 Bölüm Dengesi ve Puanlama Spesifikasyonu

```markdown
# GÖREV 5: `src/levels/LevelDefinitions.ts` VE `src/core/ScoreSystem.ts` DENGELEMESİ

## 1. 16 BÖLÜMÜN HARİTA, BOSS, KALKAN VE BLOK TABLOSU

| Bölüm | 16-Bit Piksel Harita Sahnesi | Ana Boss | Küçük Düşmanlar | Kalkan (`Normal` / `Zor`) | `[🔴]` Blok İçerikleri | Özel Ritim & Mekanik |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | Kraterli Çöl + Sağ Boru Üssü | `CentipedeBoss` (Sarı-Yeşil, 10 boğum) | `3x ScarabBeetle` | `999` (`110s` / `90s`) | `S`, `T`, `L`, `P` + Altın `★` | Klasik 1. Bölüm açılışı (`01-hedef-oynanis.jpg`) |
| **02** | Kobalt Biyo-Okyanus & Tapınak | `LobsterMechaBoss` | `2x Scarab`, `1x PodFighter` | `999` (`105s` / `85s`) | `S`, `P`, `L`, `C` | Dev kıskaçlardan saçılan 3'lü mermi |
| **03** | Kayalık Kanyon & Reaktör Üssü | `BioWheelBoss` (Yeşil-Mor) | `2x PodFighter`, `1x BlueSplitter` | `999` (`100s` / `82s`) | `S`, `T`, `P`, Altın `★` | *Ultimate Qix* ikonik sahnesi |
| **04** | Zümrüt Kristal Mağara | `MantisBoss` | `3x Scarab`, `1x PodFighter` | `999` (`96s` / `78s`) | `S`, `T`, `C`, `[L yanıp söner]` | Kesim çizgisine ani sıçrama (`Dash`) |
| **05** | Yörünge İstasyonu Güvertesi | `CruiserCoreBoss` | `2x PodFighter`, `2x Scarab` | `999` (`92s` / `75s`) | `S`, `P`, `L`, `[★ yanıp söner]` | 4 yönlü taret ve kenar bariyerleri |
| **06** | Antik Altın-Bronz İkiz Tapınak | **`TwinSplitBoss` (Ayrılan İkiz)** | `2x Scarab` | `999` (`95s` / `78s`) | `S`, `T`, `P` | İkiye ayrıldıkları an ortadan tek çizgiyle anında zafer! |
| **07** | Mor Biyo-Kovan & Kozalar | **`MorphingCellBoss`** | `2x BlueSplitter`, `1x Pod` | `999` (`90s` / `72s`) | `S`, `L`, `C`, `[T yanıp söner]` | Büyüyüp küçülen Boss zamanlaması |
| **08** | Volkanik Bazalt & Magma | **`CentipedeBoss` (Altın, 12 boğum)** | `3x Scarab`, `1x PodFighter` | `999` (`88s` / `70s`) | `S`, `T`, `P`, `[★ yanıp söner]` | Hızlı altın kırkayak ve yelpaze mermi |
| **09** | Bakır Dökümhane & Dişliler | `LobsterMechaBoss` (Zırhlı) | `2x PodFighter`, `2x BlueSplitter` | `999` (`85s` / `68s`) | `S`, `P`, `C`, `[L yanıp söner]` | Dar bariyer açıklıkları |
| **10** | Buzul Krateri & Enkaz | `MantisBoss` (Çift Hamle) | `3x PodFighter`, `1x Scarab` | `999` (`82s` / `65s`) | `S`, `T`, `P`, `[★ yanıp söner]` | Çizgi geri sarma (`Backtrack`) ustalığı |
| **11** | Turkuaz Denizaltı Türbini | `BioWheelBoss` (Elektrik) | `2x BlueSplitter`, `2x Pod` | `999` (`80s` / `62s`) | `S`, `P`, `L`, `C` | Güdümlü plazma topları |
| **12** | Sibernetik Kale Geçidi | **`CyberSkullBoss` (16-Bit Kafa)** | `3x PodFighter`, `2x Scarab` | `999` (`78s` / `60s`) | `S`, `T`, `P`, `[★ yanıp söner]` | Açılır çeneli 16-bit sibernetik kafatası geçidi! |
| **13** | Biyo-Mekanik Omurga (İç Dünya) | `OpticNerveBoss` | `3x PodFighter`, `1x Splitter` | `999` (`75s` / `58s`) | Normal: `P`, `[S]` / Zor: Yok | Orijinal 13. Bölüm gerilimi: az kutu! |
| **14** | Sinaptik Devre Matrisi | **`TwinSplitBoss` (Nöral İkiz)** | `2x PodFighter`, `2x Splitter` | `999` (`74s` / `56s`) | Normal: `S`, `[P]` / Zor: `[P]` | Hızlı ikiz nöronları bölme düellosu |
| **15** | Kızıl Biyo-Çekirdek | **`CentipedeBoss` (Kızıl, 15 boğum)** | `3x Scarab`, `2x PodFighter` | `999` (`72s` / `55s`) | Normal: `S`, `P`, `[T]` / Zor: `[P]` | 15 boğumlu en tehlikeli kırkayak! |
| **16** | Ana Beyin -> Kurtuluş Kapısı | **`AlienBrainBoss` (Final)** | `3x PodFighter`, `2x Splitter` | `999` (`75s` / `55s`) | Normal: `S`, `P`, `[★]` / Zor: `P` | Ana Beyin imhası ve gezegenden kurtuluş! |

## 2. ORİJİNAL VOLFIED SKOR VE YILDIZ TUTARLILIĞI (`ScoreSystem.ts`)
- `%80.0` geçiş: `+10.000` taban puan; `%99.9`'a yaklaştıkça **`+500.000` puana** kadar çıkan üstel yüzde bonusu.
- **İlk Çizgide `%80+` Efsanevi Ödülü:** Bölümün ilk kesiminde `>= %80` kapatılırsa **`+1.000.000` puan**!
- **`★` Özel Blok:** Açıldığında `+100.000`, Boss'u vurup patlattığında `+100.000` puan ve anında **`★★★` (3 Yıldız)** bölüm geçişi!
- Bölüm 6/14 İkiz Ayırma veya Boss Sıkıştırma ile erken geçiş yapıldığında menüde kafa karıştıran düşük yüzde saklanmaz; doğrudan `★★★` tam başarı kaydedilir.
```
