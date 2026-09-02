#!/bin/bash
# İyi Yatırım Paneli — günlük veritabanı yedeği
#
# Kurulum:
#   cp /opt/iyipanel/kurulum/yedek.sh /usr/local/bin/iyipanel-yedek
#   chmod +x /usr/local/bin/iyipanel-yedek
#   mkdir -p /var/yedek/iyipanel
#
# Her gece 03:00 için  crontab -e  içine:
#   0 3 * * * /usr/local/bin/iyipanel-yedek >> /var/log/iyipanel-yedek.log 2>&1
#
# Geri yükleme:
#   gunzip -c /var/yedek/iyipanel/DOSYA.sql.gz | sudo -u postgres psql iyipanel

set -euo pipefail

VERITABANI="iyipanel"
HEDEF="/var/yedek/iyipanel"
GUN_SAYISI=14          # bundan eski yedekler silinir
TARIH="$(date +%Y-%m-%d_%H%M)"
DOSYA="$HEDEF/$VERITABANI-$TARIH.sql.gz"

mkdir -p "$HEDEF"

echo "[$(date '+%F %T')] Yedek başlıyor: $DOSYA"

# Önce geçici ada yazılır; yarım kalmış bir dosya geçerli yedek sanılmasın.
sudo -u postgres pg_dump "$VERITABANI" | gzip > "$DOSYA.tmp"
mv "$DOSYA.tmp" "$DOSYA"

BOYUT="$(du -h "$DOSYA" | cut -f1)"
echo "[$(date '+%F %T')] Tamam ($BOYUT)"

# Boş veya şüphesiz küçük yedek uyarı versin — sessiz başarısızlık en kötüsü
BAYT="$(stat -c%s "$DOSYA")"
if [ "$BAYT" -lt 10240 ]; then
  echo "[$(date '+%F %T')] UYARI: yedek 10 KB'den küçük, kontrol edin!"
  exit 1
fi

# Eskileri temizle
silinen="$(find "$HEDEF" -name "$VERITABANI-*.sql.gz" -mtime "+$GUN_SAYISI" -print -delete | wc -l)"
[ "$silinen" -gt 0 ] && echo "[$(date '+%F %T')] $silinen eski yedek silindi"

echo "[$(date '+%F %T')] Toplam: $(ls -1 "$HEDEF"/$VERITABANI-*.sql.gz 2>/dev/null | wc -l) yedek"

# HATIRLATMA: bu yedekler sunucunun kendi diskinde. Sunucu çökerse onlar da
# gider. Haftada bir başka bir makineye indirin:
#   scp root@SUNUCU:/var/yedek/iyipanel/*.sql.gz ./
