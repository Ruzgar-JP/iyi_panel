# İyi Yatırım — Müşteri Paneli ve Yönetim Paneli

Next.js (App Router) + PostgreSQL. Müşteri paneli `/panel`, yönetim paneli `/yonetim`.

## Kimlik nerede tutuluyor

ION'dan **CRM modülü alınmadı**; ScaleTrade tarafında yalnızca işlem hesapları
var ve oradaki "customer" kayıtları BackOffice'ten yönetilemiyor. Bu yüzden:

| Katman | Nerede |
|---|---|
| Panel kimliği (e-posta, şifre, ad, telefon) | **Bizim PostgreSQL** — tek doğru kaynak |
| İşlem hesabı (login, bakiye, terminal şifresi) | ScaleTrade |
| Bağlantı | `musteri_hesaplari` tablosu |

Panel girişi ScaleTrade'e hiç sormaz; şifre `musteriler.sifre_hash` (scrypt) ile
doğrulanır. Bakiye ve hesap profili **yönetici token'ıyla** okunur
(`/balance/me`, `/account/login` — ikisi de manager oturumu kabul ediyor).
Platformun bozuk JWT `exp` alanı bu yüzden akışı hiç etkilemez.

Hesap açarken ScaleTrade tarafında yine bir customer kaydı oluşur, çünkü
`/customer/account/open` müşteri oturumu istiyor ve manager karşılığı
(`MngAddAccount`) yalnızca TCP Server API'de. O kaydın şifresi makine
üretimidir (`musteriler.st_sifre`); müşteri onu hiç görmez.

**Tek şifre kuralı:** müşterinin seçtiği şifre hem bizim veritabanımıza
(scrypt) hem her işlem hesabına (`PUT /password`) yazılır. Panelden veya
yönetimden değiştirildiğinde ikisi birlikte güncellenir.

## Temel kural

**Bu uygulama ScaleTrade'de hiçbir para hareketi yapmaz.**

API'den yalnızca *okuma* yapılır: müşteri bilgisi, hesap listesi, bakiye.
Tek yazma işlemi işlem hesabı şifresinin değiştirilmesidir.

Para yatırma ve çekme, kendi veritabanımızda tutulan **taleplerdir**. Bakiyeyi
gerçekten değiştiren işlem BackOffice'te, insan eliyle yapılır. Panelde
"Onaylandı" demek *"para taşındı"* değil, *"yönetici bu talebi uygun buldu ve
işledi"* demektir.

## Kurulum

> **Sunucuya kurulum yapıyorsanız:** adım adım anlatım `KURULUM.md` dosyasında
> (Node/PostgreSQL kurulumu, nginx, SSL, servis, yedekleme, sorun giderme).
> Aşağıdakiler geliştirici özetidir.

```bash
npm install
cp .env.local.example .env.local     # doldurun
npm run goc                          # db/*.sql dosyalarını sırayla uygular
node scripts/yonetici-ekle.mjs "ad@iyiyatirim.org" "Ad Soyad" "GucluSifre123!"
```

`npm run goc` tekrar tekrar çalıştırılabilir; yeni sürümde eklenen tabloları
kurar, var olan veriye dokunmaz. Yerel test için `npm run kur` demo verisiyle
birlikte her şeyi hazırlar.

Betik yalnızca **ilk** yönetici içindir. Diğer personeli panelden eklersiniz:
`/yonetim/yoneticiler` → **Kullanıcılar** sayfası (aşağıya bakın).

Ardından `/yonetim/giris` → **Ödeme Yöntemleri** sayfasından en az bir banka
hesabı veya kripto cüzdanı ekleyin. Yöntem eklenmeden müşteri para yatıramaz.

`@/` alias'ı kullanmıyorsanız import yollarını göreli hale getirin.

## Müşteri paneli

| Sayfa | Ne yapar |
|---|---|
| `/panel/giris` | ScaleTrade müşteri hesabıyla giriş |
| `/panel` | Hesaplar, bakiye, belge durumu, son talepler |
| `/panel/yatirim` | Ödeme yöntemi seçimi, hesap bilgilerini kopyalama, dekont yükleme |
| `/panel/cekim` | Canlı bakiye kontrolü + bekleme süresi, çekim talebi |
| `/panel/taleplerim` | Tüm talepler, durumlar, red gerekçesi, iptal |
| `/panel/kyc` | Belge yükleme ve durum takibi |
| `/panel/sifre` | Şifre değiştirme (panel + terminal birlikte) |
| `/panel/sifremi-unuttum` | Sıfırlama bağlantısı ister |
| `/panel/sifre-sifirla` | Bağlantıdaki jetonla yeni şifre belirler |

### Bakiye nasıl çalışıyor

Bakiye **girişte bir kez** çekilip oturum satırına yazılır; panelde bu görüntü
gösterilir ve alındığı saat belirtilir. Çekim ekranındaki **"Bakiyemi güncelle"**
butonu API'yi yeniden sorgular ve `BAKIYE_BEKLEME_SN` kadar kilitlenir; buton
üzerinde geri sayım görünür.

Çekim talebi gönderildiğinde bakiye **her zaman** yeniden doğrulanır — ekrandaki
değere güvenilmez.

Çekilebilir tutar `margin_free` (serbest teminat) üzerinden hesaplanır; açık
pozisyonlarda kilitli teminat çekilemez.

**Bonus bakiyesi de düşülür** (`CEKIMDE_BONUS_DUS=1`, varsayılan). Platform
bakiye cevabında ayrı bir `bonus` kovası döndürüyor; bonus kampanyası
yürütüyorsanız bu paranın çekilmesini istemezsiniz. Bonus kullanmıyorsanız
değer 0 gelir ve bir etkisi olmaz. Kapatmak için `CEKIMDE_BONUS_DUS=0`.

Çekilebilir tutar **her zaman sunucuda** hesaplanır; tarayıcı yalnızca sonucu
gösterir, böylece kural tek yerde kalır.

### Çekim kısıtları

`.env.local` üzerinden ayarlanır:

- `ACIK_CEKIM_ADEDI` — aynı anda açık bekleyen çekim talebi (varsayılan 1)
- `CEKIM_BEKLEME_DK` — iki çekim talebi arasındaki bekleme (varsayılan 30 dk)
- `BAKIYE_BEKLEME_SN` — bakiye sorguları arası bekleme (varsayılan 60 sn)
- `MIN_TUTAR` / `MAX_TUTAR`

## Yönetim paneli

| Sayfa | Ne yapar |
|---|---|
| `/yonetim` | Bekleyen yatırım / çekim / belge sayıları, son hareketler |
| `/yonetim/talepler` | Tek listede yatırım ve çekim; filtre, arama, onay/red, **canlı bakiye** |
| `/yonetim/kyc` | Belge inceleme, onay/red |
| `/yonetim/musteriler` | Müşteri bilgileri, panel şifresi sıfırlama, hesabı devre dışı bırakma |
| `/yonetim/hesap` | İşlem hesabı bilgileri, kaldıraç, salt okunur, terminal şifresi |
| `/yonetim/yontemler` | Banka hesabı ve kripto cüzdanı ekleme/düzenleme/silme |
| `/yonetim/kayitlar` | İşlem kayıtları — kim neyi ne zaman değiştirdi |
| `/yonetim/yoneticiler` | Personel ekleme, yetki verme, şifre sıfırlama (yalnızca tam yetkili) |

Talepler listesinde her kayıt için görürsünüz: müşteri, hesap no, tutar, seçilen
yöntem, **çekimde hedef IBAN/cüzdan**, müşteri notu, dekont indirme bağlantısı ve
çekimlerde **talep anındaki bakiye görüntüsü**.

Red işleminde gerekçe zorunludur ve müşteriye aynen gösterilir.

Menüdeki rozetler bekleyen iş sayısını gösterir.

### Canlı bakiye (onaydan önce mutlaka bakın)

Listede görünen bakiye **talebin oluşturulduğu ana** aittir. Müşteri o tarihten
sonra işlem yapmış, para yatırmış veya çekmiş olabilir.

Bekleyen her talepte **"Güncel bakiyeyi getir"** butonu var. Basınca yönetici
token'ıyla `GET /balance/me` ve `GET /account/login` çağrılır; güncel bakiye,
çekilebilir tutar ve müşterinin iletişim bilgileri (telefon, şehir, ülke, kayıt
tarihi) gelir.

Çekim talebinin tutarı güncel çekilebilir bakiyeden yüksekse **kırmızı uyarı**
çıkar: *"Talep tutarı güncel çekilebilir bakiyeden yüksek. Onaylamayın."*

Hesap devre dışıysa veya salt okunursa bu da ayrıca gösterilir.

### Personel (kullanıcı) yönetimi

`/yonetim/yoneticiler` sayfası. İki yetki düzeyi var:

| Yetki | Ne yapabilir |
|---|---|
| **Operatör** | Talep onay/red, belge inceleme, müşteri düzenleme, ödeme yöntemleri, kayıtlar |
| **Tam yetkili** | Operatörün yaptığı her şey **+ personel ekleme, yetki değiştirme, şifre sıfırlama** |

Sayfa ve API uçları operatöre kapalıdır: menüde görünmez, adres elle yazılsa
sayfa "yetkiniz yok" der, `POST/PUT/DELETE /api/yonetim/yonetici*` **403** döner.

Şifreyi siz belirlersiniz ya da **Rastgele üret** ile üretirsiniz. Şifre yalnızca
o ekranda görünür — kaydedildikten sonra bir daha görüntülenemez, personele siz
iletirsiniz. Şifre kuralları müşteri tarafıyla aynıdır (`lib/sifre.ts`).

**Kilitlenmeye karşı üç koruma:**

1. Kendi yetkinizi ve kendi durumunuzu değiştiremezsiniz — bunu başka bir tam
   yetkili yapar. (Kendi adınızı ve şifrenizi değiştirebilirsiniz.)
2. Kendi hesabınızı silemezsiniz.
3. Sistemdeki son aktif tam yetkili kullanıcı yetkisiz bırakılamaz/silinemez.

**Silme yerine pasife alma.** Taleplerde ve belgelerde "kim onayladı" bilgisi
kullanıcı satırına bağlıdır (`islem_yapan`). Bu yüzden sisteme bir kez girmiş
kullanıcı **silinemez**; "Pasif" yapılır — girişi anında kapanır, açık oturumları
düşer, geçmiş işlemlerinde adı durmaya devam eder. Yalnızca yanlışlıkla açılmış,
hiç iz bırakmamış kayıtlar silinebilir.

Şifre değiştirildiğinde de o kullanıcının açık oturumları düşürülür.

### Sistem sayfası (`/yonetim/sistem`)

Yalnızca **tam yetkili** kullanıcıya açık. İki işi var:

**1. Kurulum kontrol listesi.** Kurulumun canlıya hazır olup olmadığını kendi
kendine denetler: çalışma kipi, gerçek PostgreSQL mi, demo kapalı mı, captcha
anahtarları, şifreleme anahtarı, SMTP, site adresi, ScaleTrade token'ı ve
kurulumla gelen test yöneticisinin hâlâ aktif olup olmadığı. Hiçbir maddede
sırrın kendisi gösterilmez — yalnızca "tanımlı mı" bilgisi.

**2. E-posta (SMTP) ayarları.** Şifre sıfırlama postalarının gittiği hesap.
Ayarlar `.env.local` yerine veritabanında (`sistem_ayarlari`) tutulur; böylece
sağlayıcı değiştiğinde sunucuya SSH ile girip yeniden başlatmak gerekmez.

- Şifre **AES-256-GCM** ile şifrelenip saklanır (`AYAR_ANAHTARI` ortam
  değişkeni). Anahtar yoksa kaydetme reddedilir — düz metin yazmaktansa
  hata vermeyi tercih ediyoruz.
- Şifre tarayıcıya **hiç gönderilmez**. Formda boş bırakmak "değiştirme"
  demektir.
- **Test gönder** butonu önce SMTP'ye bağlanıp kimlik doğrular, sonra gerçek
  bir e-posta yollar. Hata mesajları sadeleştirilir ("uygulama şifresi girin",
  "port kapalı olabilir" gibi).
- Veritabanında kayıt yoksa eski `SMTP_*` ortam değişkenlerine düşülür —
  mevcut kurulumlar bozulmaz.

## Görünüm

Panellerin arka planındaki görsel `public/` klasöründedir:

| Dosya | Nerede görünür |
|---|---|
| `public/arkaplan-panel.svg` | Müşteri paneli, kayıt sayfası |
| `public/arkaplan-yonetim.svg` | Yönetim paneli |

İkisi farklıdır ki personel bir bakışta hangi panelde olduğunu görsün.

Kendi görselinizi koymak için: dosyayı `public/` içine atın ve `app/panel.css`
başındaki iki satırı değiştirin:

```css
.iy         { --arkaplan: url("/arkaplan-panel.svg"); }   /* müşteri  */
.iy.yonetim { --arkaplan: url("/arkaplan-yonetim.svg"); } /* yönetim  */
```

Aynı yerdeki `--perde` görselin üstündeki beyaz tülü ayarlar: sayıları
büyütürseniz görsel soluklaşır, küçültürseniz belirginleşir. Görseli tamamen
kaldırmak için `--arkaplan: none;` yazın.

## Güvenlik

| Önlem | Nerede |
|---|---|
| Personel yönetimi rol kontrolü (sayfa + API) | `app/api/yonetim/yonetici/` |
| ScaleTrade JWT'si tarayıcıya hiç inmez — sunucudaki oturum satırında durur | `lib/oturum.ts` |
| Tarayıcıda yalnızca opak, httpOnly çerez | `lib/oturum.ts` |
| Oturum jetonunun kendisi değil, sha256 özeti saklanır | `lib/kripto.ts` |
| Yönetici şifreleri scrypt + sabit süreli karşılaştırma | `lib/kripto.ts` |
| Giriş denemesi sınırı (müşteri 8/15dk, yönetici 6/15dk) | giriş route'ları |
| Kullanıcı yoksa da şifre doğrulaması çalışır (hesap sayımı engellenir) | `yonetim/giris` |
| Hesap sahipliği her istekte doğrulanır | `bakiye`, `talep`, `sifre` |
| Dosya indirmede müşteri kimliği zorunlu filtre | `dosya/[id]` |
| Dosyalar imzasıyla doğrulanır, uzantıya güvenilmez | `lib/dosyalar.ts` |
| Dosyalar `attachment` olarak sunulur + `nosniff` | `dosya/[id]` |
| Talep durumu yalnızca "beklemede" iken değişir (çift onay koruması) | `lib/talepler.ts` |
| Her onay/red/silme işlem kaydına yazılır | `islem_kayitlari` |
| `content-type` kontrolü — API tanımsız yollarda 200+HTML dönüyor | `lib/scaletrade.ts` |
| CSP, HSTS, `frame-ancestors 'none'`, `X-Powered-By` kapalı | `next.config.mjs` |
| Panel/yönetim sayfaları önbelleğe alınmaz (çıkıştan sonra "geri" tuşu) | `next.config.mjs` |
| Panelden girilen SMTP şifresi AES-256-GCM ile şifreli saklanır | `lib/kripto.ts` |
| Sistem ayarları yalnızca **tam yetkili** kullanıcıya açık | `api/yonetim/eposta` |
| Kurulum/güvenlik kontrol listesi (canlıya hazır mı) | `/yonetim/sistem` |

### Şifremi unuttum

`/panel/sifremi-unuttum` → e-posta ile tek kullanımlık bağlantı gönderilir
(varsayılan 60 dakika geçerli). Bağlantı `/panel/sifre-sifirla?jeton=...`
adresine gider; yeni şifre hem panele hem tüm işlem hesaplarına yazılır ve
müşterinin açık oturumları kapatılır.

Güvenlik notları:

- Yanıt **her zaman aynıdır** — e-posta kayıtlı olsun olmasın. Aksi halde bu uç,
  hangi adreslerin sistemde olduğunu sızdıran bir sorgulama aracına dönerdi.
- Jetonun kendisi yalnızca e-postada bulunur; veritabanında **sha256 özeti**
  saklanır.
- Yeni bir istek, o müşterinin eski kullanılmamış jetonlarını geçersiz kılar.
- Tüketim tek sorguda yapılır (`UPDATE ... WHERE kullanildi = false RETURNING`),
  aynı jetonla iki eşzamanlı istek gelirse yalnızca biri geçer.
- Sıfırlama sonrası müşteriye bilgilendirme e-postası gider — hesabı ele
  geçirilmişse fark etsin.

**SMTP gerekli.** `.env.local` içinde `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM` doldurulmalı. Tanımlı değilse geliştirmede bağlantı
sunucu günlüğüne yazılır (yerel test için), **üretimde hata verir** — sessizce
yutulmaz.

### Talep silme

Hatalı kayıtlar `/yonetim/talepler` üzerinden silinebilir. **Gerekçe zorunludur**
(hem arayüzde hem sunucuda) ve silmeden önce talebin tam kopyası
`islem_kayitlari` tablosuna yazılır — satır gider, izi kalır. `/yonetim/kayitlar`
sayfasından görülebilir.

### Şifre değiştirme hakkında

ScaleTrade'in `PUT /password` ucu **müşteri oturumu kabul etmiyor**, yönetici
oturumu istiyor. Bu yüzden çağrı `SCALETRADE_MANAGER_TOKEN` ile yapılır.

Bu bir yetki yükseltmesi olduğu için, çağrıdan **önce** müşterinin mevcut portal
şifresi `/customer/auth/login` ile doğrulanır. Bu doğrulama kaldırılmamalı.

Token tanımlanmazsa yalnızca şifre değiştirme kapalı olur; panelin geri kalanı
çalışır.

## Bilinen kısıtlar

- **Giriş denemesi sayacı sunucu belleğinde.** Vercel gibi sunucusuz ortamda her
  örneğin kendi sayacı olur. Oturumlar veritabanında olduğu için etkilenmez;
  yalnızca kaba kuvvet sınırı gevşer. Tek sunucuda sorun yok.
- **Dosyalar veritabanında (bytea).** Ek servis gerektirmez, yedekleme
  veritabanıyla gelir. 10 GB üstüne çıkarsa nesne depolamaya taşınmalı —
  `lib/dosyalar.ts` arayüzü aynı kalır.
- **Platformun JWT `exp` alanı bozuk** (üretim anına eşit, yani ömür sıfır).
  Bizi etkilemiyor çünkü oturum ömrünü kendi tablomuzdan yönetiyoruz, ancak
  ION'a bildirilmesi gereken bir hata.

## Doğrulanmış API davranışları

Dokümantasyonla gerçek sunucu bazı yerlerde ayrışıyor; kod gerçek davranışa göre
yazıldı:

| Uç | Dokümanda | Gerçekte |
|---|---|---|
| `GET /balance/me` | "body parameters: login" | **query string**: `?login=100007` |
| `GET /account/me` | body | query string |
| `GET /balance/me` | TCP komutu gibi belgelenmiş | **REST'te de çalışıyor**, hem müşteri hem yönetici oturumuyla |
| `GET /account/login` | TCP komutu gibi belgelenmiş | **REST'te de çalışıyor** (yalnızca yönetici) |
| Bakiye cevabı | client-api dokümanında `bonus` yok | `bonus` alanı **dönüyor** |
| `Authorization` başlığı | — | `Bearer` öneki **yok**, JWT doğrudan |
| Tanımsız yollar | — | 200 + HTML (WebTrader SPA) |

Ayrıca `AddUser`, `UpdateUser` ve `GetUserBalance` adları **kullanımdan
kaldırılmış takma adlar**; yenileri sırasıyla `MngAddAccount`,
`MngUpdateAccount` ve `GetAccountBalance`.
