# FAZ 2 PROMPTU: Düşman AI, 16 Boss Sistemi, Gri Güçlendirme Kutuları ve Skor Motoru

Faz 1'deki poligon kesme ve kalkan/fitil çekirdeği doğrulandıktan sonra bu dosyadaki promptu AI kodlama ajanınıza verin. Bu faz, **[Volfied](https://en.wikipedia.org/wiki/Volfied)** ([StrategyWiki](https://strategywiki.org/wiki/Volfied), [Internet Archive](https://archive.org/details/arcade_volfied)) oyununun tüm stratejik derinliğini oluşturan **gri kutuları (`S`, `T`, `P`, `L`, `C` + Kırmızı Işıklı Boss Silahı), küçük düşman tiplerini, Bölüm 6 Çift Boss mekaniğini, 16 bölümlük ilerleyişi ve puanlama matematiğini** inşa eder.

## Kopyalanacak Master Prompt ( Faz 2 )

```markdown
# GÖREV: FAZ 2 — DÜŞMAN AI EKOSİSTEMİ, 16 BOSS TASARIMI, GRİ GÜÇLENDİRME KUTULARI VE SKOR MOTORU

Mevcut Faz 1 çekirdek motorunun üzerine `@01-VOLFIED-OYUN-HARITA-VE-LEVEL-ANALIZI.md` kurallarına sadık kalarak tam kapsamlı düşman yapay zekâsını, güçlendirme bloklarını, 16 bölümlük kampanya verisini ve puanlama sistemini entegre et.

## 1. KÜÇÜK DÜŞMAN (MINION) ARKEPİTLERİ VE POLİGON İÇİ FİZİK
Tüm iç alan düşmanları daima `activePolygon` sınırları içinde kalmalıdır; yeni bir kesim yapıldığında:
- Ele geçirilen poligonun (`claimedPoly`) içinde kalan küçük düşmanlar **anında patlar**, zincirleme kombo puanı (`500 * 2^(yakalananSayisi-1)`) verir ve yüzen puan metni (`FloatingText`) çıkarır.
- `activePolygon` kenarlarına çarpan düşmanlar kenar normaline göre yansır (`bounce`).

Aşağıdaki 4 küçük düşman sınıfını (`src/entities/enemies/`) uygula:
1. **`DroneBouncer`:** Sabit diyagonal açılarla poligon duvarlarından seker.
2. **`LineHunter`:** Oyuncu `STATE_ON_BORDER` iken rastgele devriye gezer; oyuncu `STATE_CUTTING` durumuna geçtiği an hızını `%35` artırarak oyuncunun `activeTrail` çizgisine doğru yönelir (fitili ateşlemeye çalışır).
3. **`PrismSplitter`:** Büyük kristalimsi düşman; periyodik olarak 2 küçük hızlı parçaya bölünür veya kenara dik mermi atar.
4. **`BorderCrawler` (Kenar Avcısı):** Bölümde `45` saniye (üst bölümlerde `25` saniye) geçtikten sonra güvenli kenar hattında doğar, kenar çizgileri boyunca oyuncuya doğru yürür. Kalkan (`shieldTimer`) dolu olsa bile oyuncuya temas ederse anında öldürür!

## 2. 16 ÖZGÜN BÖLÜM VE BOSS SİSTEMİ (`src/levels/LevelDefinitions.ts` & `src/entities/bosses/`)
Telif sorunu yaratmayacak %100 özgün siber-uzaylı Boss tasarımlarıyla (Canvas prosedürel çok-parçalı vektör/geometrik zırh çizimi, dönen çekirdekler, eklemli uzuvlar ve sağlık barı ile) **16 bölümün tamamını** yapılandır:
- **Boss Genel Kuralı:**
  - Kesim tamamlandığında Boss ASLA ele geçirilen tarafta kalmaz; poligon bölme zaten Boss'un bulunduğu tarafı `activePolygon` yapar.
  - Eğer Boss'un çarpışma yarıçapı (`boundingRadius`) yeni daralmış `activePolygon` duvarıyla çakışırsa, Boss'u duvarın iç normaline doğru güvenli noktaya it (`resolvePolygonPenetration`) ki Boss asla duvar dışına taşmasın veya sıkışmasın.
  - Oyuncu alanı `%65` üzerinde daralttığında Boss `ENRAGED` moduna girer (renk tonu kızarır, hareket/saldırı sıklığı `%25` artar).
- **Boss Davranış Modülleri (16 bölüme dağıtılacak 6 ana Boss AI tipi):**
  1. `TitanCore` (Bölüm 1, 5): Ağır sarkaç hareketi + 4 yönlü enerji küresi atışı.
  2. `SerpentMecha` (Bölüm 2, 9, 13): Çok segmentli (boğumlu yılan/solucan) gövde; oyuncunun kesim çizgisine doğru kıvrılarak hamle yapar.
  3. `ArachnoMatrix` (Bölüm 3, 10): Kısa menzilli ani sıçrama (`DashCharge` — öncesinde `0.5s` görsel nişan uyarısı verir) + ağ/plazma mermisi.
  4. `TwinNexus` (**Bölüm 6 ve Bölüm 14 — ÇİFT BOSS MEKANİĞİ**): Sahnede **2 bağımsız Ana Boss** dolaşır!
     - **Özel Kazanma Kuralı:** Oyuncu yaptığı kesimle `TwinNexus_A` ve `TwinNexus_B` boss'larını iki ayrı poligona bölerse (biri `polyA` içinde, diğeri `polyB` içinde kalırsa), ele geçirilen alan `%80` olmasa bile **bölüm ANINDA KAZANILIR** ve `+50.000 TWIN SPLIT BONUS` verilir!
     - İkisi aynı tarafta kalırsa normal alan kesme devam eder.
  5. `PrismLeviathan` (Bölüm 4, 7, 11, 15): Ekranın büyük kısmını kaplayan döner zırhlı kruvazör; kenara doğru tarama mermileri (kalkan sıfırsa kenardaki oyuncuyu da vurur) fırlatır.
  6. `VoidEmperor` (Bölüm 8, 12, 16 Final): Faz değiştiren hibrit Boss; kısa mesafeli faz kayması (ışınlanma öncesi gölge izi gösterir), yelpaze mermi yağmuru ve minyon çağırma yeteneğine sahiptir.

Her bölüm tanımında (`LevelConfig`) şu alanlar yer almalıdır:
`id (1..16)`, `sectorName`, `bossType`, `minionSetup`, `shieldDuration`, `barrierSegments`, `greyBoxes`, `hasRedLightBossBox`, `backgroundTheme` (her bölüm kesildikçe bir sonraki bölümün arka plan temasını alttan gösterir!).

## 3. GRİ KUTULAR VE KIRMIZI IŞIKLI BOSS SİLAHI (`src/entities/PowerUpBox.ts`)
Harita içinde sabit koordinatlarda duran `36x36` boyutlu metalik Gri Kutular (ve seçili bölümlerde üstünde kırmızı LED çakan Özel Kutu) oluştur:
- Düşmanlar kutuların içinden serbestçe geçebilir.
- Oyuncu kesim çizgisini bir kutunun tam üstünden geçirirse çizgi kutunun kenarından geçer veya kutu çizgiyi engellemez; kutu **ele geçirilen poligonun (`claimedPoly`) içinde kaldığı an** kırılır ve içindeki güçlendirmeyi anında oyuncuya verir:
  1. **`S` (Speed Up):** Oyuncu hız çarpanını `+0.20x` artırır (maksimum `2.0x`), bölüm sonuna veya ölüme kadar sürer.
  2. **`T` (Time Freeze):** Tüm Boss'ları, minyonları, kenar avcılarını ve düşman mermilerini `10.0` saniye boyunca dondurur (buz mavisi görsel filtre + geri sayım çubuğu).
  3. **`P` (Shield Lock):** Kalkan sayacının (`shieldTimer`) azalmasını `15.0` saniye durdurur ve `+150` birim kalkan yeniler.
  4. **`L` (Border Laser):** `12.0` saniye boyunca oyuncu güvenli kenardayken içeriye doğru otomatik/tuşlu seri lazer ateşler. Küçük düşmanları 1 vuruşta yok eder (`+300` puan); **Ana Boss'a çarptığında metalik sekme kıvılcımı çıkar ama Boss hasar almaz (Boss bağışıktır)**.
  5. **`C` (Crush Wave):** Ekran genelinde şok dalgası patlatarak tüm aktif küçük düşmanları ve mermileri anında yok eder.
  6. **`BOSS_CANNON` (Sadece Kırmızı Işıklı Kutudan Çıkar):** `10.0` saniye boyunca ağır plazma topları ateşler. Ana Boss'a hasar verebilen TEK silahtır (`6` tam isabette Boss'u patlatır). Boss bu silahla yok edildiğinde **bölüm anında tamamlanır** ve `+100.000 BOSS DESTROYED BONUS` verilir!

## 4. PUANLAMA, CAN VE BÖLÜM SONU ÖZET EKRANI
- Kesilen her `%1` alan için taban puan: `100` puan; tek seferde `>= %15` büyük kesim yapılırsa `2.5x Büyük Kesim Çarpanı`.
- Bölüm tamamlama (`>= %80.0`) sonrasında **Bölüm Sonu Hesaplama Ekranı**:
  - Taban Geçiş Bonusu: `10.000` puan.
  - **Yüzde Aşım Bonusu:** `%80.0` üzerindeki her `%0.1` dilim için katlanan ödül (özellikle `%95.0 - %99.9` arası dev bonus tablosu: örn. `%99+` kesimde `+150.000 MASTER CARVE BONUS`).
  - Kalan Kalkan Bonusu (`kalanBirim * 20`).
  - Yıldız Derecelendirmesi: `%80-%89.9` = 1 Yıldız, `%90-%95.9` = 2 Yıldız, `>= %96.0` veya Boss İmhası / Çift Boss Ayırma = 3 Yıldız.
- Her `150.000` puanda `+1 Ekstra Can` (`1UP`).

## 5. KABUL KRİTERLERİ
- Bölüm seçici debug kısayolu (`1-9` veya menü) ile Bölüm 6'nın açılıp iki Boss'un ortasından tek çizgi çekildiğinde bölümün anında kazanıldığını doğrula.
- Gri kutuların üzerinden değil, alan içine hapsedilerek toplandığını doğrula.
- `npm run build` komutunun sıfır TypeScript uyarısı/hatası ile tamamlandığını doğrula.
```
