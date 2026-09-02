# Kurulum Kılavuzu — İyi Yatırım Paneli

Bu belge paneli sıfırdan bir sunucuya kurmak için yazıldı. Adımları sırayla
takip edin; her adımın sonunda "nasıl anlarım çalıştığını" kutusu var.

Linux komut satırı bilmek yeterli — Next.js veya React bilmenize gerek yok.

**Tahmini süre:** 1–2 saat.

---

## İçindekiler

1. [Panel ne yapar, ne yapmaz](#1-panel-ne-yapar-ne-yapmaz)
2. [Neye ihtiyacınız var](#2-neye-ihtiyacınız-var)
3. [Hangi dosyalar gönderilir](#3-hangi-dosyalar-gönderilir)
4. [Adım 1 — Sunucuyu hazırla](#adım-1--sunucuyu-hazırla)
5. [Adım 2 — Dosyaları yükle](#adım-2--dosyaları-yükle)
6. [Adım 3 — Veritabanını oluştur](#adım-3--veritabanını-oluştur)
7. [Adım 4 — Ayar dosyasını doldur](#adım-4--ayar-dosyasını-doldur)
8. [Adım 5 — Tabloları kur](#adım-5--tabloları-kur)
9. [Adım 6 — Yönetici hesabı aç](#adım-6--yönetici-hesabı-aç)
10. [Adım 7 — Uygulamayı derle ve başlat](#adım-7--uygulamayı-derle-ve-başlat)
11. [Adım 8 — Nginx ve SSL](#adım-8--nginx-ve-ssl)
12. [Adım 9 — Captcha anahtarları](#adım-9--captcha-anahtarları)
13. [Adım 10 — E-posta ayarları (panelden)](#adım-10--e-posta-ayarları-panelden)
14. [Adım 11 — Güvenlik kontrol listesi](#adım-11--güvenlik-kontrol-listesi)
15. [Yedekleme](#yedekleme)
16. [Güncelleme](#güncelleme)
17. [Sorun giderme](#sorun-giderme)

---

## 1. Panel ne yapar, ne yapmaz

**Yapar:**

- Müşteri hesap açar (`/kayit`), aynı anda işlem platformunda da hesap oluşur
- Müşteri panelden bakiyesini görür, para yatırma/çekme **talebi** oluşturur,
  kimlik belgesi yükler, şifresini değiştirir
- Personel yönetim panelinden talepleri onaylar/reddeder, belgeleri inceler,
  müşteri ve hesapları yönetir

**YAPMAZ — bu çok önemli:**

> Bu uygulama **para taşımaz.** İşlem platformuna bakiye ekleyen veya çıkaran
> hiçbir çağrı yoktur. "Onaylandı" demek "para transfer edildi" demek değildir;
> "yönetici bu talebi uygun buldu ve BackOffice'te elle işledi" demektir.
> Parayı hareket ettiren her zaman bir insandır.

---

## 2. Neye ihtiyacınız var

| Ne | Ayrıntı |
|---|---|
| **Sunucu** | Ubuntu 22.04 veya 24.04, en az 2 GB RAM, 20 GB disk |
| **Alan adı** | Örn. `panel.iyiyatirim.org` — A kaydı sunucunun IP'sine bakmalı |
| **Node.js** | Sürüm 20 veya üstü |
| **PostgreSQL** | Sürüm 14 veya üstü |
| **Cloudflare hesabı** | Ücretsiz — captcha (Turnstile) anahtarları için |
| **E-posta hesabı** | Şifre sıfırlama postaları için SMTP erişimi olan bir kutu |
| **ScaleTrade anahtarı** | Yönetici JWT'si (bunu proje sahibinden alın) |

> **Not:** Sunucu Türkiye dışındaysa bile sorun değil; panel yalnızca
> `client.iyiyatirim.org` ile konuşur.

---

## 3. Hangi dosyalar gönderilir

Projeyi paylaşırken **şu klasörleri göndermeyin**:

| Klasör | Neden gönderilmez |
|---|---|
| `node_modules/` | 367 MB, sunucuda `npm install` ile yeniden kurulur |
| `.next/` | Derleme çıktısı, sunucuda yeniden üretilir |
| `veri/` | Yerel test veritabanı — canlıda PostgreSQL kullanılacak |
| `.env.local` | **Şifreler ve anahtarlar burada.** Asla paylaşılmaz |

Kalan her şey gönderilir (yaklaşık 1 MB). Sıkıştırmak için:

```bash
cd "$(dirname "$PWD")" && zip -r iyiyatirim-panel.zip iyiyatirim-panel -x "iyiyatirim-panel/node_modules/*" "iyiyatirim-panel/.next/*" "iyiyatirim-panel/veri/*" "iyiyatirim-panel/.env.local"
```

> **Uyarı:** `.env.local` dosyasını e-postayla, WhatsApp'tan veya herhangi bir
> mesajlaşma uygulamasından **göndermeyin**. İçindeki değerleri sunucuda elle
> yazın veya bir şifre yöneticisiyle paylaşın.

---

## Adım 1 — Sunucuyu hazırla

Sunucuya `root` olarak bağlanın.

### 1.1 Sistemi güncelle

```bash
apt update && apt upgrade -y
```

### 1.2 Node.js 20 kur

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
```

Doğrulama:

```bash
node -v
```

> ✅ `v20.x.x` veya üstü görmelisiniz.

### 1.3 PostgreSQL kur

```bash
apt install -y postgresql postgresql-contrib
```

Doğrulama:

```bash
systemctl status postgresql --no-pager
```

> ✅ `active (exited)` veya `active (running)` yazmalı.

### 1.4 Uygulama için ayrı bir kullanıcı aç

Uygulamayı **root olarak çalıştırmayın**. Bir açık bulunursa saldırgan
doğrudan tüm sunucuyu ele geçirir.

```bash
adduser --system --group --home /opt/iyipanel iyipanel
```

### 1.5 Güvenlik duvarı

Yalnızca SSH ve web portları açık kalsın. PostgreSQL (5432) **dışarıya
kapalı** olmalı — panel ona sunucunun içinden bağlanacak.

```bash
apt install -y ufw && ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Doğrulama:

```bash
ufw status
```

> ✅ Listede yalnızca 22 (OpenSSH), 80 ve 443 olmalı. 5432 **olmamalı**.

---

## Adım 2 — Dosyaları yükle

Kendi bilgisayarınızdan (zip'i hazırladığınız yerden):

```bash
scp iyiyatirim-panel.zip root@SUNUCU_IP:/opt/
```

Sunucuda:

```bash
cd /opt && apt install -y unzip && mkdir -p /opt/iyipanel && unzip -q iyiyatirim-panel.zip && cp -a iyiyatirim-panel/. iyipanel/ && rm -rf iyiyatirim-panel iyiyatirim-panel.zip
```

> `cp -a` gizli dosyaları da (`.gitignore`, `.env.local.example`) kopyalar.

Sahipliği ayarlayın:

```bash
chown -R iyipanel:iyipanel /opt/iyipanel
```

Paketleri kurun:

```bash
cd /opt/iyipanel && sudo -u iyipanel npm install
```

> ✅ Hata olmadan bitmeli. Uyarılar (`warn`) normaldir.
>
> **Neden `--omit=dev` değil:** derleme sırasında TypeScript gerekiyor ve o
> geliştirme paketlerinde. Derledikten sonra (Adım 7) isterseniz
> `npm prune --omit=dev` ile yaklaşık 200 MB geri kazanabilirsiniz.

---

## Adım 3 — Veritabanını oluştur

### Neon kullanıyorsanız

Bilgisayarınıza veya uygulama sunucunuza PostgreSQL kurmanız gerekmez. Neon
Console'da projenizi açın, **Connect** düğmesinden doğru branch, role ve
database'i seçip üretilen **Connection string** değerini kopyalayın. Adres
`postgresql://...neon.tech/...?...sslmode=require` biçiminde olmalıdır.

Bu bağlantı dizesini Adım 4'te `DATABASE_URL` olarak aynen kullanın. Neon'un
verdiği rol şemayı oluşturabildiği için aşağıdaki iki yerel kullanıcıyı açma
adımını ve bu adımın yetki betiğini **atlayın**. Adım 5'te de Neon için yalnızca
`npm run goc` komutunu çalıştırın.

### Kendi PostgreSQL sunucunuzu kullanıyorsanız

İki ayrı veritabanı hesabı oluşturacağız. Bu ayrım önemlidir: uygulama
hesabı veriyi okuyup yazabilir ama tablo oluşturamaz/değiştiremez; şema sahibi
hesabı yalnızca ilk kurulum ve güncellemelerde kısa süreli kullanılır.

| Hesap | Nerede kullanılır | Yetki |
|---|---|---|
| `iyipanel_uygulama` | `.env.local` ve çalışan panel | Veriyi okur/yazar, şemayı değiştiremez |
| `iyipanel_sahip` | Yalnızca `npm run goc` | Tablo ve göç oluşturur |

Her iki parola için `openssl rand -hex 32` komutunu **iki kez** çalıştırın ve
çıkan değerleri parola yöneticinize kaydedin. `hex` çıktısında URL'yi bozacak
`@`, `:`, `/` gibi karakterler bulunmaz.

Ardından PostgreSQL'in parola soracağı şu komutları çalıştırın:

```bash
sudo -u postgres createuser --pwprompt --no-createdb --no-createrole --no-superuser iyipanel_sahip
sudo -u postgres createuser --pwprompt --no-createdb --no-createrole --no-superuser iyipanel_uygulama
sudo -u postgres createdb --owner=iyipanel_sahip iyipanel
```

Uygulama hesabının veri erişim yetkilerini verin:

```bash
sudo -u postgres psql -d iyipanel -f /opt/iyipanel/kurulum/veritabani-yetkileri.sql
```

Doğrulama:

```bash
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -w iyipanel
```

> ✅ `iyipanel` yazmalı.

---

## Adım 4 — Ayar dosyasını doldur

Örnek dosyayı kopyalayın:

```bash
cd /opt/iyipanel && sudo -u iyipanel cp .env.local.example .env.local
```

Şifreleme anahtarı üretin (panelden girilen SMTP şifresini korur):

```bash
openssl rand -base64 32
```

Dosyayı açın:

```bash
nano /opt/iyipanel/.env.local
```

**Mutlaka doldurulacaklar:**

| Satır | Ne yazılacak |
|---|---|
| `DATABASE_URL` | `postgres://iyipanel_uygulama:UYGULAMA_PAROLASI@localhost:5432/iyipanel` |
| `DEMO_MOD` | `0` — **canlıda mutlaka 0** |
| `AYAR_ANAHTARI` | Yukarıda `openssl rand -base64 32` ile ürettiğiniz değer |
| `NEXT_PUBLIC_SITE_URL` | `https://panel.iyiyatirim.org` (kendi alan adınız) |
| `SCALETRADE_MANAGER_TOKEN` | Proje sahibinden alacağınız JWT |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | [Adım 9](#adım-9--captcha-anahtarları)'da alınacak |
| `TURNSTILE_SECRET_KEY` | [Adım 9](#adım-9--captcha-anahtarları)'da alınacak |

**Silinecek satır:** `CAPTCHA_ATLA` varsa satırı tamamen silin.

Kaydedip çıkın (`Ctrl+O`, `Enter`, `Ctrl+X`).

Dosyayı kimse okuyamasın:

```bash
chmod 600 /opt/iyipanel/.env.local && chown iyipanel:iyipanel /opt/iyipanel/.env.local
```

> ✅ `ls -l /opt/iyipanel/.env.local` çıktısı `-rw------- 1 iyipanel iyipanel`
> ile başlamalı.

---

## Adım 5 — Tabloları kur

**Neon kullanıyorsanız** `.env.local` içindeki Neon bağlantısı ile şu komut
yeterlidir:

```bash
cd /opt/iyipanel && sudo -u iyipanel npm run goc
```

**Kendi PostgreSQL sunucunuz varsa** şema sahibi hesabını geçici kullanın:

```bash
read -rsp "Şema sahibi parolası: " SAHIP_PAROLASI; echo
cd /opt/iyipanel && sudo -u iyipanel env DATABASE_URL="postgres://iyipanel_sahip:${SAHIP_PAROLASI}@localhost:5432/iyipanel" npm run goc
unset SAHIP_PAROLASI
```

Şema sahibi parolası komut geçmişine yazılmaz ve `.env.local` dosyasına
eklenmez. Adım 3'te önerilen `hex` parola biçimi URL'de doğrudan güvenlidir.

> ✅ Her `.sql` dosyası için bir `✓` görmelisiniz, sonunda
> "PostgreSQL şeması güncel."
>
> Hata alırsanız: `DATABASE_URL` içindeki şifreyi kontrol edin. Şifrede
> `@`, `:`, `/` gibi karakterler varsa sorun çıkarır — Adım 3'ü daha basit
> bir şifreyle tekrarlayın.

Bu komut tekrar tekrar çalıştırılabilir; var olan tabloları bozmaz.

---

## Adım 6 — Yönetici hesabı aç

Kendinize bir hesap açın. Şifre en az 10 karakter olmalı:

```bash
cd /opt/iyipanel && sudo -u iyipanel node scripts/yonetici-ekle.mjs "adiniz@iyiyatirim.org" "Ad Soyad" "CokGucluBirSifre123!"
```

> ✅ `Yönetici hazır: #1 adiniz@iyiyatirim.org` yazmalı.

Bu hesap **tam yetkilidir**: diğer personeli panelden kendisi ekler, sunucuya
girmeye gerek kalmaz.

---

## Adım 7 — Uygulamayı derle ve başlat

### 7.1 Derle

```bash
cd /opt/iyipanel && sudo -u iyipanel npm run build
```

> ✅ Sonunda sayfa listesi ve "Compiled successfully" görmelisiniz.
>
> ⚠️ Derleme sırasında uygulama çalışıyor olmamalı. Sonraki güncellemelerde
> önce `systemctl stop iyipanel` deyin.

### 7.2 Servis olarak kur

Hazır servis dosyasını kopyalayın:

```bash
cp /opt/iyipanel/kurulum/iyipanel.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now iyipanel
```

Doğrulama:

```bash
systemctl status iyipanel --no-pager
```

> ✅ `active (running)` yazmalı.

```bash
curl -I http://127.0.0.1:3100/panel/giris
```

> ✅ `HTTP/1.1 200 OK` dönmeli.

Günlükleri görmek için:

```bash
journalctl -u iyipanel -f
```

---

## Adım 8 — Nginx ve SSL

Panel sadece sunucunun içinde 3100 portunu dinliyor. Dışarıya nginx açacak
ve HTTPS'i o sağlayacak.

### 8.1 Nginx kur

```bash
apt install -y nginx
```

### 8.2 Yapılandırmayı koy

```bash
cp /opt/iyipanel/kurulum/nginx-ornek.conf /etc/nginx/sites-available/iyipanel
```

Alan adını kendinizinkiyle değiştirin:

```bash
sed -i 's/panel.iyiyatirim.org/SIZIN_ALAN_ADINIZ/g' /etc/nginx/sites-available/iyipanel
```

Etkinleştirin:

```bash
ln -sf /etc/nginx/sites-available/iyipanel /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```

> ✅ `nginx -t` çıktısı `syntax is ok` ve `test is successful` demeli.

### 8.3 SSL sertifikası

```bash
apt install -y certbot python3-certbot-nginx && certbot --nginx -d panel.iyiyatirim.org
```

Sorulanlar:
- E-posta adresi → sertifika bitmeden uyarı gelsin diye
- Şartlar → `Y`
- Yönlendirme → **2 (Redirect)** seçin, HTTP'den HTTPS'e zorlasın

> ✅ Tarayıcıdan `https://panel.iyiyatirim.org/panel/giris` açılmalı ve
> kilit simgesi görünmeli.

Sertifika otomatik yenilenir. Kontrol:

```bash
certbot renew --dry-run
```

---

## Adım 9 — Captcha anahtarları

Kayıt formu bot koruması olmadan çalışmaz — anahtarlar boşsa form **hiçbir
kaydı kabul etmez** (kasıtlı: koruma yoksa kapı kapalı).

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add site**
2. **Domain**: `panel.iyiyatirim.org`
3. **Widget mode**: Managed
4. Çıkan iki anahtarı kopyalayın

Sunucuda:

```bash
nano /opt/iyipanel/.env.local
```

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAA...
TURNSTILE_SECRET_KEY=0x4AAA...
```

> ⚠️ `NEXT_PUBLIC_` ile başlayan değerler derleme sırasında sayfaya gömülür.
> Bu yüzden değiştirdikten sonra **yeniden derlemek gerekir**:

```bash
cd /opt/iyipanel && systemctl stop iyipanel && sudo -u iyipanel npm run build && systemctl start iyipanel
```

> ✅ `https://panel.iyiyatirim.org/kayit` sayfasında formun altında Cloudflare
> kutucuğu görünmeli.

---

## Adım 10 — E-posta ayarları (panelden)

**Bu adım için sunucuya girmeye gerek yok.** SMTP bilgileri panelden girilir,
şifre veritabanına şifrelenerek yazılır.

1. `https://panel.iyiyatirim.org/yonetim/giris` → Adım 6'daki hesapla girin
2. Üst menüden **Sistem**
3. **E-posta (SMTP) ayarları** bölümünde:
   - Sağlayıcınızın adı yazan hazır düğmeye basın (Yandex, Gmail, Outlook,
     Brevo) — sunucu ve port kendiliğinden dolar
   - **Kullanıcı adı**: genellikle tam e-posta adresiniz
   - **Şifre**: hesabın giriş şifresi **değil**, sağlayıcının verdiği
     *uygulama şifresi*
   - **Gönderen**: `İyi Yatırım <destek@iyiyatirim.org>` — adres giriş
     yaptığınız hesaba ait olmalı
   - **Site adresi**: `https://panel.iyiyatirim.org`
4. **Ayarları kaydet**
5. **Test e-postası** bölümüne kendi adresinizi yazıp **Test gönder**

> ✅ Yeşil "gönderildi" mesajı ve gelen kutunuzda test postası.
>
> Hata alırsanız mesaj ne yapmanız gerektiğini söyler (yanlış şifre, kapalı
> port, reddedilen gönderen adresi vb.).

Bilgiler sonradan değişirse aynı sayfadan güncellersiniz; sunucuya dokunmaya
ve yeniden başlatmaya gerek yoktur.

---

## Adım 11 — Güvenlik kontrol listesi

Panelde **Yönetim → Sistem** sayfası kurulumu kendi kendine denetler. Bütün
maddeler yeşil ("Tamam") olana kadar ilerleyin.

Sayfanın kontrol ettikleri:

| Madde | Ne olmalı |
|---|---|
| Çalışma kipi | Üretim (`npm run build` + servis) |
| Veritabanı | Gerçek PostgreSQL (PGlite değil) |
| Demo modu | Kapalı (`DEMO_MOD=0`) |
| Captcha | Turnstile anahtarları kurulu, `CAPTCHA_ATLA` yok |
| Ayar şifreleme anahtarı | `AYAR_ANAHTARI` dolu |
| E-posta | SMTP tanımlı ve test geçti |
| Site adresi | `https://` ile başlıyor |
| ScaleTrade anahtarı | Dolu |
| Kurulum yöneticisi | Test hesabı pasife alınmış |

Sayfanın **göremediği**, sizin elle doğrulamanız gerekenler:

- [ ] `.env.local` izinleri `600` ve sahibi `iyipanel`
- [ ] Güvenlik duvarında 5432 kapalı (`ufw status`)
- [ ] Uygulama root olarak çalışmıyor (`ps aux | grep next`)
- [ ] SSH'a şifreyle değil, anahtarla giriliyor
- [ ] Yedekleme kurulu ve **geri yükleme denendi** (aşağıya bakın)
- [ ] Test hesapları temizlendi

### Test kayıtlarını temizleme

Geliştirme sırasında canlı platformda oluşan test kayıtları:
müşteri 1–4, 9, 34+ ve işlem hesapları 100007, 100012, 100013, 100014,
100015, 100017. Bunları BackOffice'ten silin.

---

## Yedekleme

Veritabanı hem müşteri kimliklerini hem yüklenen belgeleri tutar. **Yedek
yoksa hepsi tek bir disk arızasıyla gider.**

Yedek betiğini kurun:

```bash
cp /opt/iyipanel/kurulum/yedek.sh /usr/local/bin/iyipanel-yedek && chmod +x /usr/local/bin/iyipanel-yedek && mkdir -p /var/yedek/iyipanel
```

Her gece 03:00'te çalışsın:

```bash
crontab -e
```

Sona ekleyin:

```
0 3 * * * /usr/local/bin/iyipanel-yedek >> /var/log/iyipanel-yedek.log 2>&1
```

Hemen bir kez deneyin:

```bash
/usr/local/bin/iyipanel-yedek && ls -lh /var/yedek/iyipanel
```

> ✅ Tarihli bir `.sql.gz` dosyası oluşmalı.

### Geri yükleme (mutlaka bir kez deneyin)

```bash
gunzip -c /var/yedek/iyipanel/DOSYA.sql.gz | sudo -u postgres psql iyipanel
```

> **Yedeği sunucunun dışına kopyalayın.** Sunucu çökerse yedek de onunla
> gider. Haftada bir başka bir makineye indirin.

---

## Güncelleme

Yeni sürüm geldiğinde:

```bash
systemctl stop iyipanel
```

```bash
cd /opt/iyipanel && sudo -u iyipanel npm install
read -rsp "Şema sahibi parolası: " SAHIP_PAROLASI; echo
sudo -u iyipanel env DATABASE_URL="postgres://iyipanel_sahip:${SAHIP_PAROLASI}@localhost:5432/iyipanel" npm run goc
unset SAHIP_PAROLASI
sudo -u iyipanel npm run build
```

```bash
systemctl start iyipanel && systemctl status iyipanel --no-pager
```

> ⚠️ Derlemeyi **uygulama duruyorken** yapın. Çalışırken derlerseniz
> `Cannot find module './xxx.js'` hatası çıkar. Çıkarsa:
> `rm -rf .next` deyip yeniden derleyin.

`.env.local` dosyanız güncellemede korunur — üzerine yazılmaz.

---

## Sorun giderme

### Sayfa açılmıyor, nginx "502 Bad Gateway" diyor

Uygulama çalışmıyordur:

```bash
systemctl status iyipanel --no-pager && journalctl -u iyipanel -n 50 --no-pager
```

### "DATABASE_URL tanımlı değil"

`.env.local` dosyası yok veya `iyipanel` kullanıcısı okuyamıyor:

```bash
ls -l /opt/iyipanel/.env.local
```

Sahibi `iyipanel` değilse:

```bash
chown iyipanel:iyipanel /opt/iyipanel/.env.local
```

### Kayıt formu "captcha doğrulanamadı" diyor

Anahtarlar eksik veya Turnstile'daki alan adı, sitenin adresiyle uyuşmuyor.
Cloudflare panelinden domain alanını kontrol edin. Anahtarı değiştirdiyseniz
**yeniden derlemeyi unutmayın** (Adım 9).

### Şifre sıfırlama e-postası gitmiyor

Yönetim → Sistem → **Test gönder**. Hata mesajı sebebi söyler. En sık:
uygulama şifresi yerine hesap şifresi girilmiş.

### "Cannot find module './xxx.js'"

Uygulama çalışırken derleme yapılmış:

```bash
systemctl stop iyipanel && cd /opt/iyipanel && rm -rf .next && sudo -u iyipanel npm run build && systemctl start iyipanel
```

### Yönetim paneline giremiyorum

Şifreyi sıfırlayın (aynı komut hem ekler hem şifre değiştirir):

```bash
cd /opt/iyipanel && sudo -u iyipanel node scripts/yonetici-ekle.mjs "adiniz@iyiyatirim.org" "Ad Soyad" "YeniSifre123!"
```

### Bakiye görünmüyor

`SCALETRADE_MANAGER_TOKEN` boş veya süresi dolmuş. `.env.local` içine yazıp
servisi yeniden başlatın:

```bash
systemctl restart iyipanel
```

---

## Ek bilgi

- **Mimari kararlar ve platform tuzakları:** `DURUM.md`
- **Kod yapısı:** `README.md`
- **Test senaryoları:** `TEST.md`
