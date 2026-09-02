# Durum ve Devam Notu

Bu dosya **kodda bulunmayan** bilgiyi saklar: neden böyle yapıldığı, API'de
neyin gerçekten çalıştığı, hangi tuzaklara düşüldüğü ve sırada ne olduğu.
Yeni bir oturuma başlarken önce bunu okuyun.

Son güncelleme: 2 Eylül 2026

---

## 1. Sistem haritası

Tek bir Next.js projesi, üç yüz:

| Yol | Kim kullanır |
|---|---|
| `/kayit` | Ziyaretçi — hesap açar |
| `/panel/*` | Müşteri — bakiye, para talebi, belge, şifre |
| `/yonetim/*` | Personel — talep onayı, müşteri/hesap yönetimi, kayıtlar |

`npx tsc --noEmit` ve `npm run build` temiz.

Yönetim panelinde iki sayfa yalnızca **tam yetkili** role açıktır:
`/yonetim/yoneticiler` (personel) ve `/yonetim/sistem` (kurulum kontrol
listesi + SMTP ayarları). İkisi de hem sayfada hem API'de rol denetler.

---

## 2. En kritik mimari karar

**Panel kimliği bizim PostgreSQL'imizde, işlem hesabı ScaleTrade'de.**

Sebep: ION'dan CRM modülü alınmadı. ScaleTrade'in `customer` kayıtları
BackOffice'ten görülemiyor/yönetilemiyor — orada yalnızca işlem hesapları var.

Sonuçlar:

- Panel girişi ScaleTrade'e hiç sormaz; şifre `musteriler.sifre_hash` (scrypt).
- Bakiye ve profil **yönetici token'ıyla** okunur, müşteri oturumuyla değil.
- Platformun bozuk JWT `exp` alanı akışı hiç etkilemez (oturum ömrü bizde).
- Panel şifresi sıfırlama artık mümkün (kimlik bizde olduğu için).

**Ama:** hesap açarken ScaleTrade'de yine bir `customer` kaydı oluşur, çünkü
`/customer/account/open` müşteri oturumu istiyor ve manager karşılığı
(`MngAddAccount`) yalnızca TCP'de. O kaydın şifresi makine üretimidir
(`musteriler.st_sifre`), müşteri hiç görmez. ION TCP erişimi verirse bu ara
adım tamamen kaldırılabilir.

### Tek şifre kuralı

Müşterinin seçtiği şifre **iki yere** yazılır: bizim veritabanımıza (scrypt) ve
her işlem hesabına (`PUT /password`). Panelden, yönetimden veya "şifremi
unuttum"dan değiştirildiğinde ikisi birlikte güncellenir. Ayrışırlarsa müşteri
"panele giriyorum ama terminale giremiyorum" durumuna düşer.

Kullanıcı adları farklıdır: **panel → e-posta**, **terminal → hesap numarası**.

---

## 2b. Ayarlar nerede duruyor

İki yer var ve ayrımı bilmek gerekiyor:

| Nerede | Ne | Değiştirmek için |
|---|---|---|
| `.env.local` | Altyapı: veritabanı adresi, ScaleTrade token'ı, captcha anahtarları, `AYAR_ANAHTARI` | Sunucuya SSH + yeniden başlatma |
| `sistem_ayarlari` tablosu | SMTP bilgileri, site adresi | Yönetim → Sistem sayfası |

SMTP'nin veritabanına alınmasının sebebi: sağlayıcı ve uygulama şifresi sık
değişiyor, bunu yapan kişi yazılımcı olmak zorunda değil.

**SMTP şifresi düz metin saklanmaz.** `AYAR_ANAHTARI` ile AES-256-GCM
şifrelenir (`lib/kripto.ts` → `gizliSifrele`/`gizliCoz`). Sonuçları:

- Veritabanı yedeği tek başına ele geçse bile şifre okunamaz.
- **`AYAR_ANAHTARI` değişirse kayıtlı şifre çözülemez.** Panel bunu "şifre
  çözülemedi, yeniden girin" diye söyler, sessizce başarısız olmaz.
- Anahtar tanımlı değilse kaydetme *reddedilir* — düz metin yazmaktansa hata
  vermek tercih edildi.

Veritabanında kayıt yoksa eski `SMTP_*` ortam değişkenlerine düşülür; eski
kurulumlar bozulmaz.

---

## 3. API gerçekleri (deneyerek doğrulandı)

Dokümantasyon birkaç yerde yanlış. Aşağıdakiler canlı sunucuda test edildi.

### Çalışanlar

| Uç | Not |
|---|---|
| `POST /customer/registration` | Müşteri kaydı |
| `POST /customer/auth/login` | Müşteri oturumu |
| `GET /customer/account/groups` | Açılabilir gruplar + `currency` |
| `POST /customer/account/open` | Hesap açar, geçici şifre döner |
| `GET /balance/me?login=X` | **Müşteri VE yönetici** oturumu kabul eder |
| `GET /account/login?login=X` | Yalnızca yönetici — tam profil |
| `PUT /account` | Hesap günceller — yönetici |
| `PUT /password` | İşlem şifresi — **yönetici** oturumu ister |
| `POST /sign/in` | İşlem hesabı girişi (login + şifre), token gerektirmez |

### REST'te OLMAYANLAR (yalnızca TCP)

| Uç | Sonuç | Ne kaybediyoruz |
|---|---|---|
| `/customer/password` | 404 | Portal şifresi ScaleTrade'de değiştirilemez (bizde tutuyoruz, sorun değil) |
| `/customer` (güncelleme) | 404 | CRM alanları |
| Hesap **açma** (manager) | 404 | Ara customer kaydından kurtulamıyoruz |
| SSO (`/sso`, `/auth/sso`, …) | 404 | **Otomatik giriş yapılamıyor** |
| `/mailer/email` | 404 | Platform e-posta modülü kurulu değil → kendi SMTP'miz |
| `POST /sign/up` | 200 ama boş `{}` | Uç boş, kullanılamaz |

### Doküman hataları

- `GET /balance/me` "body parameters: login" diyor → gerçekte **query string**.
- `GET /account/me` aynı şekilde query string.
- `Authorization` başlığında **`Bearer` öneki YOK**, JWT doğrudan yazılır.
- Bakiye cevabında `bonus` alanı var ama client-api dokümanında yazmıyor.
- Tanımsız yollar **200 + HTML** (WebTrader SPA) döner — durum koduna değil,
  `content-type`'a bakmak gerekir. Kod bunu yapıyor.
- `AddUser`, `UpdateUser`, `GetUserBalance` **kullanımdan kaldırılmış** takma
  adlar. Yenileri: `MngAddAccount`, `MngUpdateAccount`, `GetAccountBalance`.

---

## 4. Platformdaki açık hatalar (ION'a bildirilecek)

1. **JWT `exp` = üretim zamanı.** Token ömrü sıfır saniye. Sunucu şu an `exp`'i
   denetlemiyor, o yüzden çalışıyor. Denetim açılırsa yönetici token'ıyla yapılan
   tüm okumalar kırılır. Bizim oturumlarımızı etkilemez (kendi tablomuzda).
2. **`brand_not_found`.** Terminalin kök adresi ara sıra bu ekrana düşüyor.
   Geçici çözüm: butonu doğrudan `/en/sign/in` adresine yönlendirdik.
   Kalıcı çözüm için BO → Settings → Brands altındaki **host** alanının
   `client.iyiyatirim.org` olduğundan emin olun.
3. **CORS `*`.** Platform her origin'e açık. Kayıt formunda captcha bu yüzden
   şart.

---

## 5. Düştüğümüz tuzaklar (tekrarlamayın)

- **`GROUPS` bash'te özel değişkendir.** Kabuk betiğinde ona atama yapınca
  değeri `20` (macOS `staff` GID) oluyordu; saatlerce "sunucu bozuk" sanıldı.
- **`next build` ile `next dev` aynı `.next` klasörünü kullanır.** Sunucu
  açıkken derleme yapılırsa `Cannot find module './xxx.js'` hatası çıkar.
  Çözüm: `rm -rf .next` + yeniden başlat. Derlemeyi sunucu kapalıyken yapın.
- **Next.js route dosyaları yalnızca HTTP metodlarını dışa aktarabilir.**
  Yardımcı fonksiyon export edilince derleme kırılıyor — `lib/`'e taşıyın.
- **Next.js her rotayı ayrı derler**, modül düzeyi state rotalar arasında
  paylaşılmaz. Demo defteri ve veritabanı bağlantısı `globalThis` üzerinde.
- **`??` boş string'i yakalamaz.** Ortam değişkeni tanımlı ama boşsa varsayılana
  düşmez; `||` kullanın.
- **`npm install --omit=dev` sonrası derleme yapılamaz.** TypeScript
  geliştirme paketlerinde; `next build` onu arar ve bulamayınca kırılır.
  Önce tam kurulum yapın, derledikten sonra isterseniz `npm prune --omit=dev`.
- **systemd'de `ReadWritePaths` olmayan klasörü gösterirse servis açılmaz.**
  Yol başına `-` koyun (`-/opt/iyipanel/.next`). Ayrıca `npm run start` yerine
  doğrudan `node_modules/.bin/next start` çağırın — npm hata durumunda ev
  klasörüne günlük yazmaya çalışır, `ProtectSystem=strict` buna izin vermez.
- **`NEXT_PUBLIC_` ile başlayan değişkenler derlemeye gömülür.** Captcha site
  anahtarını değiştirip yeniden derlemezseniz eski değer kullanılmaya devam
  eder. Sunucuyu yeniden başlatmak yetmez.
- **Veritabanını sıfırlarsanız oturumlar da gider.** Açık duran yönetim sayfası
  "Yetkiniz yok" verir. Artık 401'de girişe yönlendiriyoruz.

---

## 6. Para hesabı kuralı

`margin_free` müşterinin çekebileceği tutar **değildir**. İçinde bonus ve kredi
de vardır (`equity = balance + credit + profit`).

```
çekilebilir = margin_free − bonus − kredi
```

`CEKIMDE_BONUS_DUS` / `CEKIMDE_KREDI_DUS` ile kapatılabilir ama **kapatmayın** —
müşteri kendisine ait olmayan parayı çeker.

Ayrıca: **çekimde tutar hesabın para biriminde** girilir (USD), ödeme yöntemi
yalnızca teslim kanalıdır. Yatırımda ise yöntemin biriminde (TRY) — çünkü
müşteri gerçekten o parayı göndermiştir.

---

## 7. Bu uygulama para taşımaz

ScaleTrade'e bakiye ekleyen/çıkaran **hiçbir çağrı yoktur**. Yatırım ve çekim
bizim veritabanımızda *taleptir*. "Onaylandı" demek "para taşındı" değil,
"yönetici bu talebi uygun buldu ve BackOffice'te işledi" demektir. Yönetim
panelindeki onay penceresi bunu operatöre hatırlatır.

---

## 8. Şu anki durum

- Sunucu: `npm run dev` → http://localhost:3100
- Mod: **canlı** (`DEMO_MOD=0`) — gerçek ScaleTrade sunucusuna bağlı
- Veritabanı: PGlite (`veri/` klasörü), gerçek PostgreSQL'e geçiş tek satır
- Şema göçleri: `npm run goc` — `db/*.sql` dosyalarını sırayla uygular,
  tekrar çalıştırmak güvenli
- Sunucuya kurulum anlatımı: **`KURULUM.md`** (+ `kurulum/` klasöründe hazır
  nginx yapılandırması, systemd birimi ve yedekleme betiği)

Canlıda oluşan test hesapları (temizlenecek): müşteri 1–4, 9, 34+ ve işlem
hesapları 100007, 100012, 100013, 100014, 100015, 100017.

Yönetim girişi: `yonetici@iyiyatirim.org` / `Yonetim1234!` (yönetici #1,
tam yetkili)

Yerel veritabanında bir **test operatörü** duruyor: `ayse@iyiyatirim.org`
(yönetici #34, pasif). Yetki sınırlarını denemek için açıldı, girişi kapalı.
Silinemiyor çünkü sisteme bir kez girmiş — kural böyle (bkz. §9). Gerçek
PostgreSQL'e geçilince zaten gelmeyecek.

---

## 9. Personel yönetimi (2 Eylül'de eklendi)

`/yonetim/yoneticiler` — tam yetkili kullanıcı buradan personel açar.
`yoneticiler` tablosu şemada zaten vardı (`rol`, `aktif`); yalnızca arayüz ve
uçlar yazıldı, şema değişmedi.

**Roller:** `operator` günlük işi yapar; `yonetici` ayrıca personel yönetir.
Kontrol iki yerde: sayfa (menüde görünmez + doğrudan adreste "yetkiniz yok") ve
API (403). İkisi ayrı ayrı denendi.

**Neden silme yok:** taleplerdeki `islem_yapan` bu satıra bağlı ve
`ON DELETE SET NULL`. Sisteme girmiş kullanıcı silinirse "kim onayladı" bilgisi
kaybolur. Bu yüzden yalnızca hiç iz bırakmamış kayıt silinebilir; gerisi
pasife alınır (girişi kapanır, oturumları düşer, geçmişte adı kalır).

**Neden kendi rolünü değiştiremiyorsun:** tek yönetici kendini operatöre
indirirse panele girip geri alacak kimse kalmaz. Aynı sebeple kendini pasife
alamaz ve silemez. Ad ve şifre değiştirmek serbest.

Koddaki "son tam yetkili" kontrolü bugün için fazladan bir emniyet kemeri —
kendi rolünü değiştirme yasağı zaten o duruma düşmeyi engelliyor. Yasak
gevşetilirse devreye girsin diye duruyor.

**Şifre:** kurallar müşteriyle ortak (`lib/sifre.ts`). Şifre değişince o
kullanıcının açık oturumları düşer.

## 10. Canlıya çıkmadan önce yapılacaklar

| # | İş | Neden |
|---|---|---|
| 1 | **Cloudflare Turnstile** anahtarları | Kayıt formu şu an captcha'sız (`CAPTCHA_ATLA=1`) |
| 2 | `CAPTCHA_ATLA` satırını **silin** | Üretimde yok sayılıyor ama bulunmasın |
| 3 | **SMTP** ayarları | Artık **panelden**: Yönetim → Sistem → test gönder |
| 4 | Site adresi | Panelden girilebilir; `.env` yedek olarak duruyor |
| 4b | **`AYAR_ANAHTARI`** üretin | Olmadan SMTP şifresi kaydedilemez |
| 5 | Gerçek **PostgreSQL** | `DATABASE_URL` + iki şema dosyası |
| 6 | Hız sınırlarını **paylaşımlı sayaca** taşıyın | Sunucusuz ortamda bellek içi sayaç gevşer |
| 7 | Test kayıtlarını **temizleyin** | Yukarıdaki liste |
| 8 | BO → Brands **host** alanı | `brand_not_found` için |

Bu maddelerin çoğu **Yönetim → Sistem** sayfasındaki kontrol listesinde
canlı olarak görünüyor; hepsi yeşile dönene kadar ilerleyin.

## 11. ION'dan istenecekler

1. **TCP Server API host + port** — bunlar açılır:
   - Otomatik giriş (SSO) — müşteri terminale şifresiz geçer
   - `MngAddAccount` ile ara customer kaydından kurtulma
2. **Admin yetkili kimlik** — SSO `SESSION_ADMIN` istiyor, elimizdeki manager
3. **JWT `exp` hatasının düzeltilmesi**
4. Kalıcı bir **yönetici token'ı** (şu an `.env.local`'de elle duruyor)
