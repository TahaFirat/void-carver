# Volfied (1989) Derinlemesine Oyun, Harita, Geometri ve Level Analizi (GDD Referansı)

Bu doküman, Taito'nun 1989 yılında yayımladığı **[Volfied](https://en.wikipedia.org/wiki/Volfied)** ([StrategyWiki](https://strategywiki.org/wiki/Volfied), [Arcade Archives](https://www.arcadearchives.com/en/title/aca-301/)) oyununun tüm mekaniklerini mühendislik düzeyinde çözümler. AI kodlama ajanınıza oyun mantığını anlatırken bu dosyayı doğrudan referans (`@01-VOLFIED-OYUN-HARITA-VE-LEVEL-ANALIZI.md`) olarak verebilirsiniz.

## 1. Hikâye ve Görsel Katman Felsefesi

Orijinal oyunda pilot, kendi gezegeni olan Volfied'a döndüğünde gezegenin uzaylı istilasına uğradığını ve yeraltına sığınan halkın SOS sinyali gönderdiğini görür ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied), [GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)).

- **Çift Katmanlı Harita Açma (Layer Reveal) Sistemi:** Her bölümde ekranın tamamı uzaylı istilasını temsil eden üst bir doku/yüzey katmanıyla kaplıdır. Oyuncu alanları kesip ele geçirdikçe üst katman silinir ve altından bir sonraki bölümün arka plan grafiği veya kurtarılan gezegen katmanı kademeli olarak ortaya çıkar ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied), [Internet Archive - Volfied](https://archive.org/details/arcade_volfied)).
- **Atmosferik Ses Tasarımı:** Bölüm içlerinde dikkat dağıtıcı yoğun müzik yerine gerilimi artıran uzay/bilimkurgu ses efektleri (kalkan nabzı, lazer kesim sesi, boss hareket uğultusu, fitil yanma alarmı) ön plandadır ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)).

## 2. Harita ve Geometri Mantığı (Polygon & Border Architecture)

*Volfied*'ın kalbi piksel boyama (flood-fill) değil, **2B Ortogonal Poligon Bölme (Orthogonal Polygon Partitioning)** mimarisidir. Piksel tabanlı flood-fill yaklaşımları mobil yüksek çözünürlüklerde hem darboğaz yaratır hem de kenar yürüyüşü (`border traversal`) fiziğini bozar. Doğru mimari şu 4 bileşenden oluşur:

| Geometrik Bileşen | Teknik Tanımı | Oyun İçi Davranışı |
| :--- | :--- | :--- |
| **Aktif Alan (`ActivePolygon`)** | Saat yönünde sıralı, birbirine dik (`90°`) doğru parçalarından oluşan tek bir basit poligon (başlangıçta `900x1200` dikdörtgen) | Boss ve küçük düşmanların içinde dolaştığı, henüz ele geçirilmemiş uzaylı bölgesi |
| **Güvenli Kenar (`Perimeter / Border`)** | `ActivePolygon` poligonunun dış çevresini oluşturan kenar çizgileri kümesi | Oyuncu gemisinin kesim yapmıyorken üzerinde sadece ileri/geri/köşe yönlerinde hareket edebildiği ray hattı ([Internet Archive](https://archive.org/details/arcade_volfied)) |
| **Kenar Bariyerleri (`Border Barriers`)** | Kenar üzerindeki metalik/kilitli duvar segmentleri | Oyuncu bu segmentlerin üzerinden yürüyebilir ancak **bu noktalardan içeriye kesim başlatamaz ve içeriden gelen bir kesimi bu bariyerlere bağlayamaz** ([Internet Archive](https://archive.org/details/arcade_volfied), [Retro Games Trove](https://www.retrogamestrove.com/game/ultimate-qix-aka-volfied/)) |
| **Kesim İzi (`Active Trail / Stix`)** | Kenardan ayrılan oyuncunun arkasında bıraktığı ortogonal kırıklı çizgi (`Polyline`) | Henüz kapanmamış savunmasız lazer izi; düşman değerse fitil ateşlenir ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)) |

### Alan Kesme (Territory Claiming) Algoritmasının 6 Adımı

1. **Kesim Başlatma (`Launch`):** Oyuncu güvenli kenar üzerinde (bariyer olmayan bir noktada) `Kesim` aksiyonu aktifken `ActivePolygon` içine bakan dik yöne basar. Başlangıç noktası `P_start` kenar üzerine düğüm olarak eklenir.
2. **İz Çizimi (`Drawing`):** Gemi yalnızca yatay veya dikey hareket eder. Yön her `90°` değiştiğinde `activeTrail` dizisine yeni bir köşe (`Vertex`) eklenir. Gemi kendi `activeTrail` segmentlerine değemez.
3. **Kenara Kavuşma (`Reconnect`):** Gemi `ActivePolygon` kenarındaki geçerli (bariyer olmayan) bir `P_end` noktasına çarptığı an kesim tamamlanır.
4. **Poligon İkiye Bölme (`Split`):** `ActivePolygon` çevresi üzerinde `P_start`tan `P_end`e giden iki farklı çevre yolu (`Path_CW` ve `Path_CCW`) vardır. Bu iki çevre yolu `activeTrail` ile birleştirildiğinde iki kapalı poligon elde edilir:
   - `Poly_1 = Path_CW + reverse(activeTrail)`
   - `Poly_2 = Path_CCW + activeTrail`
5. **"İç" ve "Dış" Tayini (`Boss Containment Rule`):** Nokta-Poligon İçinde mi (`Point-in-Polygon` / Ray-Casting) testi uygulanır ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied)):
   - **Standart Tek Boss Durumu:** Ana Boss'un merkez koordinatı hangi poligondaysa (örneğin `Poly_1`), o poligon **"Dış Alan" (yeni `ActivePolygon`)** olur; Boss'un olmadığı `Poly_2` ise **"İç Alan" (Ele Geçirilen Bölge)** ilan edilir.
   - **Çift Boss Özel Durumu (Örn. Bölüm 6):** Sahnede 2 Ana Boss varsa ve `Poly_1` birinci boss'u, `Poly_2` ikinci boss'u içeriyorsa (yani oyuncu iki boss'un tam arasından alanı ikiye böldüyse), **bölüm yüzdesine bakılmaksızın anında kazanılır** ve özel ayırma bonusu verilir ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Volfied)).
6. **Alan Hesabı, İmha ve Kutu Toplama:**
   - Ele geçirilen `Poly_2` alanı **Shoelace Formülü** ($\frac{1}{2} |\sum (x_i y_{i+1} - x_{i+1} y_i)|$) ile hesaplanır ve toplam ele geçirilen alana eklenir.
   - `Poly_2` içinde kalan tüm **küçük düşmanlar (minions)** anında patlatılarak ek puan kazandırır ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied)).
   - `Poly_2` içinde kalan tüm **Gri Güçlendirme Kutuları** tetiklenir ve içindeki güçlendirme oyuncuya verilir ([Internet Archive](https://archive.org/details/arcade_volfied)).

## 3. Kalkan (Shield), Yanma Fitili (Fuse) ve Ölüm Kuralları

*Volfied*'ı sıradan bulmaca oyunlarından ayıran en kritik gerilim mekaniği **üç katmanlı tehdit sistemidir**:

1. **Zaman Ayarlı Kenar Kalkanı (`Perimeter Shield Timer`):**
   - Oyuncu kesim yapmıyorken (güvenli kenar üzerindeyken) gemiyi koruyan bir enerji kalkanına sahiptir ([Internet Archive](https://archive.org/details/arcade_volfied), [LaunchBox](https://gamesdb.launchbox-app.com/games/details/21835-volfied)).
   - Kalkan sayacı bölüm başladığında dolu başlar (klasik göstergede `999` birim veya saniye bazlı sayaç) ve zamanla geri sayar.
   - Kalkan aktifken (`shield > 0`), içerideki düşmanlar veya mermiler kenardaki gemiye çarpsa bile gemi patlamaz.
   - **Kritik Kural:** Kalkan sayacı **`0` olduğunda** geminin kenardaki kalkanı tamamen kapanır; artık kenarda dursa bile içeriden gelen herhangi bir düşman veya mermi teması gemiyi **tek vuruşta yok eder** ([Internet Archive](https://archive.org/details/arcade_volfied), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Volfied)).
2. **Kesim Sırasında Savunmasızlık ve Yanma Fitili (`Trail Fuse / Red Spark`):**
   - Oyuncu kenardan ayrılıp kesim çizgisi çizerken kalkan kapalıdır. Boss, küçük düşman veya düşman mermisi doğrudan gemiye çarparsa oyuncu anında yanar.
   - Düşman gemiye değil de **oyuncunun o an çizmekte olduğu tamamlanmamış çizgiye (`activeTrail`) dokunursa**, temas noktasında parlak bir **yanma fitili (fuse)** ateşlenir ve çizilen hat boyunca yüksek hızla oyuncunun gemisine doğru koşar ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)). Oyuncu fitil kendisine yetişmeden önce güvenli kenara ulaşıp poligonu kapatırsa kurtulur; yetişirse patlar ve `P_start` noktasına döner.
3. **Kenar Avcısı Düşmanlar (`Border Chasers`):**
   - Bölümde belirli bir süre geçtikten sonra oyuncunun kenarda süresiz oyalanmasını engellemek için doğrudan güvenli kenar/ele geçirilmiş bölge hattına girebilen özel devriye düşmanları belirir; bunlarla temas kalkan durumuna bakılmaksızın ölümcüldür ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)).

## 4. Gri Kutular ve Güçlendirme (Power-Up) Tablosu

Haritanın iç kısımlarına serpiştirilmiş sabit **Gri Kutular** (ve bazı bölümlerde **Kırmızı Işıklı Özel Kutu**) bulunur. Bu kutular üzerinden geçilerek değil, **etrafındaki alan kesilip ele geçirilen bölge içine hapsedilerek** açılır ([Internet Archive](https://archive.org/details/arcade_volfied), [Amiga Reviews](https://www.amigareviews.leveluphost.com/volfied.htm)):

| Kutu Kodu | Güçlendirme Adı | Oyun İçi Etkisi ve Süresi | Boss Etkileşimi |
| :--- | :--- | :--- | :--- |
| **`S`** | **Speed Up (Hız Artışı)** | Geminin hem kenar hem de kesim hızını kademeli olarak artırır; oyuncu ölene veya bölüm bitene kadar kalıcıdır ([Amiga Reviews](https://www.amigareviews.leveluphost.com/volfied.htm)) | Dolaylı avantaj (fitilden ve boss'tan kaçışı kolaylaştırır) |
| **`T`** | **Time Freeze (Zaman Durdurma)** | Boss dahil sahnedeki tüm uzaylıları ve mermileri ~10 saniye boyunca tamamen dondurur ([Amiga Reviews](https://www.amigareviews.leveluphost.com/volfied.htm), [LaunchBox](https://gamesdb.launchbox-app.com/games/details/21835-volfied)) | Boss ve mermileri donar; dev alan kesmek için en stratejik fırsattır |
| **`P`** | **Pause Shield (Kalkan Durdurma)** | Kenar kalkan sayacının geri sayımını geçici bir süre boyunca dondurur ([Internet Archive](https://archive.org/details/arcade_volfied)) | Doğrudan etki yok |
| **`L`** | **Laser (Lazer Topu)** | Gemiye kenardan içeriye doğru ateş edebilen süreli seri lazer silahı verir; küçük düşmanları tek vuruşta yok eder ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Volfied)) | **Ana Boss bu lazere karşı tamamen bağışıktır** ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Volfied)) |
| **`C`** | **Crush / Clear (Temizlik)** | O an ekranda bulunan tüm küçük düşmanları (minions) anında patlatır ve puanlarını yazar ([Internet Archive](https://archive.org/details/arcade_volfied)) | Ana Boss etkilenmez (küçük düşmanlar bir süre sonra yeniden doğabilir) |
| **`ÖZEL` (Kırmızı Işıklı Kutu)** | **Boss İmha Silahı (Orijinalde Kırmızı Küre/Plazma)** | Sadece üzerinde kırmızı ışık yanıp sönen özel bloktan çıkar; gemiye ağır plazma/füze atışı verir ([Internet Archive](https://archive.org/details/arcade_volfied)) | **Ana Boss'u birkaç isabetle yok eder; Boss ölünce bölüm anında biter ve dev özel bonus verir** ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)) |

## 5. Level Geçme Koşulları, Puanlama ve 16 Bölüm İlerleyişi

### Üç Farklı Bölüm Tamamlama (Win) Yolu
1. **Alan Yüzdesi Barajı (`>= %80.0`):** Sahnenin en az **%80,0**'ini ele geçirmek standart geçiş koşuludur ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied)).
2. **Yüksek Yüzde Risk-Ödül Matematiği (`%80.1` – `%99.9`):** Oyuncu %79,9'dayken tek bir dev kesimle alanı %95–%99,9 bandına taşırsa, %80 üzerindeki her ek yüzde dilimi için katlanarak artan **Yüzde Aşım Bonusu** kazanır ([LaunchBox](https://gamesdb.launchbox-app.com/games/details/21835-volfied), [Amiga Reviews](https://www.amigareviews.leveluphost.com/volfied.htm)).
3. **Boss İmhası veya Çift Boss Ayırma:** Kırmızı ışıklı kutudan çıkan özel silahla Boss'u vurarak öldürmek veya çift boss'lu bölümde iki boss'u farklı poligonlara hapsetmek, mevcut yüzde %80'in altında olsa bile bölümü anında tamamlar ve **Özel Tamamlama Bonusu** kazandırır ([Volfied - Wikipedia](https://en.wikipedia.org/wiki/Volfied)).

### 16 Bölümlük Zorluk Eğrisi Tasarımı
Orijinal arcade sürümü toplam **16 özgün aşamadan** oluşur ([Volfied - StrategyWiki](https://strategywiki.org/wiki/Volfied)). Mobil uyarlamamızda telif sorunsuz özgün Boss arketipleriyle şu ilerleyiş uygulanacaktır:

- **Bölüm 1–4 (Keşif ve Temel Kesim):** Sabit sekme açılı mekanik/biyolojik Boss'lar, az sayıda kenar bariyeri, uzun kalkan süresi (`120 sn`), bol gri kutu.
- **Bölüm 5–8 (Taktiksel Baskı ve Çift Boss):** Oyuncu kesime çıktığında hızlanıp çizgiye yönelen (`Aggro`) Boss'lar, **Bölüm 6'da Çift İkiz Çekirdek Boss** ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Volfied)), yelpaze mermi atan düşmanlar, köşe bariyerleri.
- **Bölüm 9–12 (Alan Daraltma ve Mermi Cehennemi):** Ekranın önemli kısmını kaplayan dev Boss'lar ([GameFAQs İncelemesi](https://gamefaqs.gamespot.com/pc/935480-volfied/reviews/122862)), kesim çizgisine lazer/ateş püskürten saldırılar, daha hızlı kalkan erimesi (`85 sn`), erken beliren kenar avcıları.
- **Bölüm 13–16 (Elit Final Sektörü):** Işınlanan veya parçalara ayrılıp birleşen hibrit Boss'lar, yoğun kenar bariyerleri, `65 sn` kalkan süresi, yüksek hızlı fitil yanması ve Bölüm 16'da Ana İstilacı İmparator Boss savaşı.
