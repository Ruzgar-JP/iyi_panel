# Uygulamayı Yayına Alma

Panele **telefon uygulaması** özelliği eklendi. Müşteri, uygulama mağazasına
girmeden ana ekranına bir simge ekliyor; simgeye dokununca işlem terminali
tam ekran açılıyor.

Bu belge iki işi anlatır:

1. Güncellemeyi sunucuya alma
2. Siteye "Uygulamayı Yükle" butonlarını koyma

**Süre:** 15–20 dakika.

---

## Ne değişti

| | |
|---|---|
| Yeni sayfa | `/uygulama` — kurulum ekranı (müşteriye bu gösterilir) |
| Yeni sayfa | `/terminal` — uygulama açılınca gelen tam ekran terminal |
| Yeni sayfa | `/tani` — teşhis; sorun olursa bakılır, müşteriye gösterilmez |
| Değişmedi | `/panel`, `/yonetim`, `/kayit` — hepsi aynı çalışıyor |

**Veritabanına dokunulmadı.** Yeni tablo yok, göç çalıştırmaya gerek yok.
`.env.local` dosyasına da yeni bir satır eklenmedi.

---

## Adım 1 — Güncellemeyi sunucuya al

Dosyaları `/opt/iyipanel` içine kopyaladıktan sonra:

```bash
systemctl stop iyipanel
```

```bash
cd /opt/iyipanel && sudo -u iyipanel npm install && sudo -u iyipanel npm run build
```

```bash
systemctl start iyipanel && systemctl status iyipanel --no-pager
```

> ⚠️ Derlemeyi uygulama **duruyorken** yapın. Çalışırken derlerseniz
> `Cannot find module './xxx.js'` hatası çıkar. Çıkarsa `rm -rf .next` deyip
> yeniden derleyin.

---

## Adım 2 — Kurulumu doğrulayın (bu adımı atlamayın)

Aşağıdaki komut, uygulamanın Android'de kurulabilir olup olmadığını belirleyen
**tek kritik şeyi** kontrol eder: manifest bağlantısının `<head>` içinde olması.

```bash
curl -s https://musteripanel.iyiyatirim.org/uygulama | python3 -c "import sys;h=sys.stdin.read();i=h.find('</head>');j=h.find('rel=\"manifest\"');print('SONUC:', 'TAMAM' if 0<=j<i else 'HATA - manifest head disinda')"
```

> ✅ `SONUC: TAMAM` yazmalı.
>
> `HATA` yazarsa Android'de kurulum penceresi **hiç açılmaz** ve hiçbir yerde
> hata mesajı görünmez — sessizce çalışmaz. Bu durumda haber verin.

Neden bu kadar önemli: tarayıcı, gövdeye düşmüş bir manifest etiketini yok
sayıyor. Geliştirme sırasında tam bu yüzden kurulum çalışmıyordu ve bulması
uzun sürdü.

Diğer sayfalar:

```bash
for y in /uygulama /terminal /manifest.webmanifest /sw.js; do printf "%-24s %s\n" "$y" "$(curl -s -o /dev/null -w '%{http_code}' https://musteripanel.iyiyatirim.org$y)"; done
```

> ✅ Dördü de `200` dönmeli.

---

## Adım 3 — Siteye butonları koyun

`kurulum/site-butonlari.html` dosyasını açın. İçindeki `<style>` ve
`<div class="iy-uygulama">` bloklarını, sitenizde butonların görünmesini
istediğiniz yere olduğu gibi yapıştırın.

Dosya kendi kendine yeterli: dışarıdan font, resim veya kütüphane yüklemiyor,
her sitede çalışır. Dar ekranda butonlar alt alta geçer.

Bağlantılar şunlar:

| Buton | Adres |
|---|---|
| Android | `https://musteripanel.iyiyatirim.org/uygulama?p=android` |
| iPhone | `https://musteripanel.iyiyatirim.org/uygulama?p=ios` |

Tek buton tercih ederseniz parametresiz `/uygulama` adresi telefonu kendi
tanır; dosyanın sonunda o örnek de var.

> **Alan adı farklıysa:** dosyada `musteripanel.iyiyatirim.org` yazan iki yeri
> değiştirin.

---

## Adım 4 — İki telefonda deneyin

### Android (Chrome)

1. `https://musteripanel.iyiyatirim.org/uygulama` adresini açın
2. **Uygulamayı yükle** butonuna dokunun
3. Chrome'un kendi kurulum penceresi çıkmalı → **Yükle**

> ✅ Ana ekranda İyi Yatırım simgesi belirir. Simgeye dokununca tarayıcı
> çubuğu olmadan, doğrudan işlem terminali açılır.

**Pencere çıkmaz da "Chrome menüsünden ekleyin" yazısı çıkarsa:** telefonda
uygulama zaten kuruludur. Ana ekrandan simgeyi silmek yetmez —
**Ayarlar → Uygulamalar → İyi Yatırım → Kaldır** yapıp tekrar deneyin.

### iPhone (Safari ile açın)

Safari şart: Chrome, Instagram veya WhatsApp'ın içindeki tarayıcıda ekleme
seçeneği çıkmaz. (Sayfa bunu fark edip uyarıyor.)

1. `https://musteripanel.iyiyatirim.org/uygulama` adresini Safari'de açın
2. Ekrandaki üç adımı izleyin: sağ alttaki **⋯** → **Paylaş** →
   **Ana Ekrana Ekle** → **Ekle**

> ✅ Ana ekranda simge belirir, dokununca tam ekran açılır.

**Not:** iPhone'da tek dokunuşla kurulum mümkün değil — Apple tarayıcılara
kurulum yetkisi vermiyor. Bu yüzden ekranda adımlar ve nereye dokunulacağını
gösteren küçük bir animasyon var. Android'de tek dokunuş çalışıyor.

---

## Sorun çıkarsa

Müşteriye gösterilmeyen bir teşhis sayfası var:

```
https://musteripanel.iyiyatirim.org/tani
```

Sorunlu telefonda bu adresi açın. Kurulumun hangi koşulda takıldığını satır
satır gösterir; ekran görüntüsünü gönderin.

| Belirti | Bakılacak yer |
|---|---|
| Android'de kurulum penceresi çıkmıyor | `/tani` → **Kurulum olayı geldi** satırı |
| "Zaten kurulu" diyor ama simge yok | Ayarlar → Uygulamalar → İyi Yatırım → Kaldır |
| Terminal boş/beyaz açılıyor | Ağ bağlantısı; `/tani` → **SW** satırları |
| iPhone'da ekleme seçeneği yok | Safari ile açılmamış olabilir |

---

## Müşteriye ne denecek

Kısa bir metin, siteye veya duyuruya konabilir:

> **İyi Yatırım'ı telefonunuza ekleyin**
>
> Uygulama mağazasına gerek yok, yer kaplamaz. Ana ekranınıza eklenen
> simgeye dokunduğunuzda işlem ekranı doğrudan açılır.
>
> Android'de tek dokunuş yeterli. iPhone'da Safari ile açıp ekrandaki üç
> adımı izleyin.
