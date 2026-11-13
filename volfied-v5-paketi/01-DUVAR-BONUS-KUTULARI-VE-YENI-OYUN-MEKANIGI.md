# ADIM 1 PROMPTU: Duvar Tipi Geçilmez Bonus Kutuları ve Katı Engel Mekaniği

Haritadaki bonus kutularının içinden geçilememesi (duvar gibi davranması), oyunu sıradan çizgi çekmekten çıkarıp **gerçek bir taktiksel labirent kuşatmasına** dönüştürür: Oyuncu bir kutuyu almak istediğinde içinden düz geçemez; kutunun etrafından dolaşarak (`L` veya `U` manevrasıyla) onu kendi alanına katmak zorundadır!

## Uygulanacak Duvar-Kutu Fiziği ve Çarpışma Spesifikasyonu

```markdown
# GÖREV 1: `PowerUpBox.ts`, `PlayerShip.ts`, `BaseBoss.ts`, `BaseMinion.ts` VE `Projectiles.ts` DUVAR FİZİĞİ

## 1. KUTU BOYUTU, IZGARAYA KENETLENME VE GÖRSEL DUVAR HİSSİ (`PowerUpBox.ts`)
1. **Izgara Hizalı Katı Sınırlar (`AABB`):**
   - Her kutu oyun alanı ızgarasına (`GRID_STEP = 2px`) tam bölünen merkez koordinatına `(bx, by)` ve `boxSize = 44px` (`half = 22px`, yani `[bx - 22, bx + 22] x [by - 22, by + 22]`) katı çarpışma kutusuna sahiptir.
   - **Güvenli Koridor Kuralı:** Kutular başlangıç dış çerçevesinden en az `56px` içeride ve birbirlerinden kenar-kenara en az `52px` (`merkezden merkeze >= 96px`) uzakta doğmalıdır ki gemi her kutunun etrafından rahatça dönebilsin, asla sıkışmasın!
2. **Üç Kutu Türü (16-Bit Piksel-Art 3B Yüksek Duvar Çizimi):**
   - **Standart Güçlendirme Duvarı (`S`, `T`, `P`, `L`, `C`):** Kalın pahlı, köşeleri 4 perçinli gümüş-çelik kule blok + ortasında kırmızı yakut mücevher + sağ ve alt tarafında `6px` koyu siyah piksel duvar gölgesi (`#06080E`)!
   - **Özel Boss Silahı Duvarı (`★`):** Altın çerçeveli ve büyük kırmızı mücevherli katı duvar blok.
   - **Kör Zırh Sütunu (`ARMOR_PILLAR` — Orta/Zor/Usta Kademelerinde Ek Engel!):** Ortasında kırmızı mücevher OLMAYAN, üzerinde çapraz çelik perçin kabartması bulunan saf zırh sütunu! Üzerinden geçilemez; alan içine hapsedildiğinde parçalanıp `+5.000` bonus puan verir ama güçlendirme vermez — kesim rotalarını zorlaştıran taktiksel engeldir!

## 2. GEMİNİN DUVAR KUTUYA ÇARPMA MANTIĞI (`PlayerShip.ts`)
1. **Kesim Sırasında Geçilmez Engel (`STATE_CUTTING`):**
   - Gemi `pos` noktasından `nextPos = pos + dir * step` noktasına ilerlerken tüm aktif `solidBoxes` listesini kontrol et (`clearance = 2px` pay ile `expandedBox = [bx - 24, bx + 24] x [by - 24, by + 24]`).
   - Eğer `[pos, nextPos]` doğru parçası bir kutunun `expandedBox` alanına giriyorsa:
     - **Gemi ÖLMEZ ve kesim KAPANMAZ!** (Çünkü kutu güvenli yeşil dış sınır değildir).
     - Gemi tam kutu duvarının dış yüzeyine (`bx - 24`, `bx + 24`, `by - 24` veya `by + 24` — hepsi çift tam sayı ızgaradadır!) kenetlenerek durur, küçük bir metalik temas tıkırtısı + 2 piksel kıvılcım çıkarır.
     - Oyuncu dik yöne (`90°`) bastığı anda gemi kutunun kenarı boyunca pürüzsüzce dönüp kesime devam eder! İsterse ters yöne (`180°`) basarak çizgisini geri sarabilir (`Backtrack`).
2. **Matematiksel Kusursuzluk Garantisi:**
   - Gemi kutunun içinden geçemediği için `activeTrail` hiçbir zaman bir kutuyu ortadan ikiye bölmez! Kesim yeşil sınıra ulaşıp kapandığında her kutu ya **%100 `claimedPoly` içinde** kalır (anında patlar, duvar engeli silinir ve içindeki `S/T/P/L/C/★` kapsülü gemiye uçar) ya da **%100 kalan `activePolygon` içinde** kalmaya devam eder!
   - *Ek Güvenlik:* Eğer yeni oluşan yeşil sınır çizgisi bir kutunun `2px` yakınına oturduysa (`clearance`), oyuncu o kenardan tekrar içeri kesim başlatırken kutuya takılmaması için kutuya temas eden `2px` tampon noktalarından kutunun içine doğru kesim başlatılmasını da aynı duvar kontrolüyle engelle.

## 3. DÜŞMANLARIN VE MERMİLERİN DUVAR KUTULARDAN SEKMESİ
- **Böcekler (`BaseMinion`) ve Boss'lar (`BaseBoss`):** Hareket ederken aktif katı kutuların `AABB` sınırlarına çarptıklarında yüzey normaline göre (`nx, ny`) elastik sekerler (`vx = -vx` veya `vy = -vy`) ve kutunun dışına itilirler! (Not: Eklemli `CentipedeBoss` baş kısmı kutudan seker, gövde boğumları başın izini takip ettiği için doğal olarak kutunun etrafından kıvrılır!).
- **Düşman ve Oyuncu Mermileri (`Projectiles.ts`):** Mermiler katı kutuların içinden geçemez; kutuya çarpan mermi metalik kıvılcımla yok olur (veya Zor/Usta kademesinde düşman enerji topları kutudan `1` kez seker!). Böylece oyuncu kutuları Boss ateşine karşı **siper** olarak da kullanabilir!
```
