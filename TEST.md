# Yerel test ortamı

Kurulum gerektirmeyen bir test alanı. PostgreSQL, Docker, ScaleTrade hesabı —
hiçbiri gerekmez.

## Başlatma

```bash
npm install
npm run kur
npm run dev
```

Adres: **http://localhost:3100**

| Sayfa | Adres | Giriş |
|---|---|---|
| Kayıt | `/kayit` | — (yeni hesap açar) |
| Müşteri | `/panel/giris` | `demo@iyiyatirim.org` / `Demo1234!` |
| Yönetim | `/yonetim/giris` | `yonetici@iyiyatirim.org` / `Yonetim1234!` |

Demo modda `/kayit` sayfasından açtığınız hesaplarla da panele girebilirsiniz —
kendi belirlediğiniz şifreyle. Kayıtlar sunucu yeniden başlayınca sıfırlanır.

Durdurmak için terminalde `Ctrl+C`.

## Nasıl çalışıyor

**Veritabanı: PGlite.** PostgreSQL'in WASM'a derlenmiş hâli — gerçek Postgres,
ama kurulum yok. Veriler `veri/` klasörüne yazılır. Sıfırlamak için o klasörü
silip `npm run kur` çalıştırın.

**ScaleTrade: demo modu.** `DEMO_MOD=1` iken hiçbir dış istek yapılmaz.
Müşteri girişi, hesap listesi, bakiye ve profil sahte verilerden gelir. Yani
canlı sunucuya kazara tek bir istek bile gitmez.

Demo hesabın başlangıç durumu:

| Alan | Değer |
|---|---|
| Bakiye | 2.500,00 |
| Varlık (equity) | 2.543,20 |
| Kullanılan teminat | 400,00 |
| Bonus | 250,00 |
| **Çekilebilir** | **1.850,00** (2.100 serbest teminat − 250 bonus) |

## Denenecek senaryolar

0. **Kayıt** — `/kayit` sayfasından bir hesap açın. Şifre kuralları yazdıkça
   işaretlenir (8 karakter, büyük harf, küçük harf, özel karakter). Kayıt
   bitince açılan pencerede **geçici şifre gösterilmez** — belirlediğiniz
   şifreyle `/panel/giris` üzerinden girebilirsiniz.

1. **Para yatırma** — Müşteri panelinden yöntem seçin, IBAN'ı kopyalayın, tutar
   girin, isterseniz dekont ekleyin, gönderin.
2. **Onay** — Yönetim panelinde talebi görün. **"Güncel bakiyeyi getir"**e basın;
   canlı bakiye ve müşterinin iletişim bilgileri gelir. Onaylarken not yazın.
3. **Müşteri tarafı** — Taleplerim sayfasında durumun *Onaylandı* olduğunu ve
   yöneticinin notunu görün.
4. **Çekim limitleri** — 1.850'den fazlasını isteyin, engellenir. 10'dan azını
   isteyin, engellenir. Geçerli bir tutar gönderin, sonra hemen tekrar deneyin:
   *"Bekleyen bir çekim talebiniz var."*
5. **Bakiye bekleme süresi** — Çekim ekranında **"Bakiyemi güncelle"**e iki kez
   basın; ikincisinde geri sayım başlar (testte 20 sn, üretimde 60 sn).
6. **Red** — Yönetimden bir talebi reddedin. Gerekçe zorunludur ve müşteriye
   aynen gösterilir.
7. **Belge** — Müşteriden bir PDF/JPG yükleyin, yönetimden onaylayın veya
   reddedin.
8. **Ödeme yöntemleri** — Yönetimden yeni bir banka hesabı veya kripto cüzdanı
   ekleyin; müşteri tarafında anında görünür. Pasife alın, kaybolur.
9. **Personel ekleme** — `/yonetim/yoneticiler` → **Yeni kullanıcı ekle**.
   Yetkiyi *Operatör* bırakın, **Rastgele üret** ile şifre oluşturun. Çıkış
   yapıp o kullanıcıyla girin: menüde **Kullanıcılar** yoktur, adresi elle
   yazınca "yalnızca tam yetkili" der. Tam yetkiliyle geri dönüp o kullanıcıyı
   **Pasif** yapın — açık oturumu anında düşer, bir daha giremez.

## Doğrulanmış davranışlar

Bu ortamda uçtan uca çalıştırılarak test edildi:

- Şema gerçek PostgreSQL'de kuruluyor (9 tablo, 24 indeks)
- SQL parçaları parametreleniyor — enjeksiyon denemesi tabloya zarar vermiyor
- Oturum çerezleri `httpOnly` — `document.cookie` bunları göremiyor
- Başka bir müşterinin hesabı sorgulanınca `403`
- Uzantısı `.pdf` ama içeriği farklı olan dosya reddediliyor
- Çıkış sonrası talep oluşturma `401`
- Aynı talep iki kez onaylanamıyor (ikinci yönetici `409` alır)
- Bonus çekilebilir tutardan düşülüyor (2.100 → 1.850)
- Kayıtta müşterinin seçtiği şifre işlem hesabına da uygulanıyor; müşteri o
  şifreyle giriş yapabiliyor
- Şifre ayarlama adımı başarısız olursa kayıt iptal edilmiyor, geçici şifre
  gösteriliyor (yedek yol denendi)
- Aynı e-postayla ikinci kayıt `409` ile reddediliyor
- Operatör personel yönetimine giremiyor: sayfa engelli, ekleme/düzenleme/silme
  uçları `403`
- Yönetici kendi rolünü/durumunu değiştiremiyor, kendini silemiyor (`400`)
- Sisteme girmiş bir kullanıcı silinemiyor (`409`), pasife alınabiliyor
- Pasife alınan kullanıcının açık oturumu anında düşüyor, girişi reddediliyor
- Personel şifresi değiştirilince o kullanıcının oturumları kapanıyor

## Gerçek sunucuya bağlanmak

`.env.local` içinde:

```
DEMO_MOD=0
SCALETRADE_MANAGER_TOKEN=<yönetici JWT>
```

Ana sayfada sarı bir uyarı çıkar: *"Demo modu kapalı, gerçek sunucuya
bağlanılıyor."*

⚠️ `client.iyiyatirim.org` **canlı sunucudur**. Demo modu kapatınca giriş
denemeleri gerçek müşteri hesaplarına gider. Yine de bu panel ScaleTrade'de
**hiçbir para hareketi yapmaz** — talepler yalnızca yerel veritabanına yazılır.

### Para birimi kuralı

Hesap USD, banka hesabınız TRY olabilir. Kural şu:

- **Yatırımda** tutar ödeme yönteminin biriminde girilir (müşteri gerçekten
  o parayı gönderdi).
- **Çekimde** tutar **hesabın biriminde** girilir (hesaptan o kadar düşecek).
  Ödeme yöntemi yalnızca paranın nasıl ulaştırılacağını belirler; TRY
  karşılığını ödeme sırasında siz belirlersiniz.

Para birimleri farklıysa çekim ekranında müşteriye açıklayıcı bir uyarı çıkar.
Hesabın para birimi girişte `GET /customer/account/groups` ucundan alınır.

## Gerçek PostgreSQL'e geçmek

`.env.local` içinde `DATABASE_URL`'i değiştirmeniz yeterli:

```
DATABASE_URL=postgres://kullanici:sifre@host:5432/veritabani?sslmode=require
```

Kod değişmez — `lib/db.ts` sürücüyü adrese bakarak seçer. Şemayı bir kez
kurun:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Üretime çıkarken `@electric-sql/pglite` bağımlılığını kaldırabilirsiniz.

## Bilinen uyarı

`npm install` sırasında `postcss` için 2 güvenlik uyarısı çıkar. Bu paket
Next.js'in derleme zamanı bağımlılığıdır, uygulamanın çalışma zamanını
etkilemez ve şu an bir düzeltmesi yayınlanmamıştır.
