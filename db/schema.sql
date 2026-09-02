-- İyi Yatırım müşteri paneli — PostgreSQL şeması
-- Çalıştırma:  psql "$DATABASE_URL" -f db/schema.sql
--
-- Tasarım notu: para hareketi bu veritabanında YAPILMAZ. Burada yalnızca
-- müşterinin *talepleri* ve bunların durumları tutulur. Bakiyeye dokunmak
-- her zaman BackOffice üzerinden, insan eliyle yapılır.

BEGIN;

-- ---------------------------------------------------------------- oturumlar
-- Müşteri panele girdiğinde ScaleTrade'den aldığımız JWT'yi tarayıcıya
-- göndermiyoruz; burada saklıyoruz ve tarayıcıya yalnızca opak bir çerez
-- veriyoruz. Platformun JWT'sindeki bozuk "exp" alanı böylece bizi
-- ilgilendirmiyor - oturum ömrünü biz belirliyoruz.
CREATE TABLE IF NOT EXISTS musteri_oturumlari (
  id              BIGSERIAL PRIMARY KEY,
  cerez_hash      TEXT        NOT NULL UNIQUE,   -- çerezin sha256'sı
  customer_id     BIGINT      NOT NULL,
  eposta          TEXT        NOT NULL,
  ad_soyad        TEXT,
  st_token        TEXT        NOT NULL,          -- ScaleTrade JWT (sunucuda kalır)
  -- Girişte bir kez alınan hesap+bakiye görüntüsü. Panelde bu gösterilir;
  -- yeniden sorgulama yalnızca çekim ekranında, bekleme süresine tabi olarak
  -- yapılır. Biçim: [{"hesap": {...}, "bakiye": {...}}]
  hesaplar        JSONB,
  bakiye_zamani   TIMESTAMPTZ,
  ip              TEXT,
  olusturma       TIMESTAMPTZ NOT NULL DEFAULT now(),
  son_gorulme     TIMESTAMPTZ NOT NULL DEFAULT now(),
  bitis           TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mo_customer ON musteri_oturumlari (customer_id);
CREATE INDEX IF NOT EXISTS ix_mo_bitis    ON musteri_oturumlari (bitis);

-- ---------------------------------------------------------------- yöneticiler
CREATE TABLE IF NOT EXISTS yoneticiler (
  id          BIGSERIAL PRIMARY KEY,
  eposta      TEXT        NOT NULL UNIQUE,
  sifre_hash  TEXT        NOT NULL,              -- scrypt
  ad_soyad    TEXT        NOT NULL,
  rol         TEXT        NOT NULL DEFAULT 'operator'
                          CHECK (rol IN ('operator','yonetici')),
  aktif       BOOLEAN     NOT NULL DEFAULT true,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now(),
  son_giris   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS yonetici_oturumlari (
  id          BIGSERIAL PRIMARY KEY,
  cerez_hash  TEXT        NOT NULL UNIQUE,
  yonetici_id BIGINT      NOT NULL REFERENCES yoneticiler(id) ON DELETE CASCADE,
  ip          TEXT,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now(),
  bitis       TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_yo_bitis ON yonetici_oturumlari (bitis);

-- ---------------------------------------------------------- ödeme yöntemleri
-- Yönetici panelinden eklenir/çıkarılır. Müşteri para yatırırken buradan seçer.
-- detaylar (jsonb) tipe göre değişir:
--   banka : {"banka":"...", "hesap_sahibi":"...", "iban":"...", "sube":"..."}
--   kripto: {"ag":"TRC20", "adres":"...", "etiket":"..."}
CREATE TABLE IF NOT EXISTS odeme_yontemleri (
  id           BIGSERIAL PRIMARY KEY,
  tip          TEXT        NOT NULL CHECK (tip IN ('banka','kripto')),
  ad           TEXT        NOT NULL,             -- "Ziraat Bankası TRY", "USDT TRC20"
  para_birimi  TEXT        NOT NULL,             -- TRY, USD, USDT ...
  detaylar     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  aciklama     TEXT,                             -- müşteriye gösterilen not
  yatirima_acik BOOLEAN    NOT NULL DEFAULT true,
  cekime_acik   BOOLEAN    NOT NULL DEFAULT true,
  aktif        BOOLEAN     NOT NULL DEFAULT true,
  sira         INT         NOT NULL DEFAULT 0,
  olusturma    TIMESTAMPTZ NOT NULL DEFAULT now(),
  guncelleme   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_oy_aktif ON odeme_yontemleri (aktif, sira);

-- ---------------------------------------------------------------- talepler
-- Para yatırma ve çekme talepleri tek tabloda; "tip" ayırıyor.
-- durum akışı:  beklemede -> onaylandi | reddedildi | iptal
CREATE TABLE IF NOT EXISTS talepler (
  id               BIGSERIAL PRIMARY KEY,
  tip              TEXT        NOT NULL CHECK (tip IN ('yatirim','cekim')),
  durum            TEXT        NOT NULL DEFAULT 'beklemede'
                               CHECK (durum IN ('beklemede','onaylandi','reddedildi','iptal')),

  customer_id      BIGINT      NOT NULL,
  eposta           TEXT        NOT NULL,
  ad_soyad         TEXT,
  login            BIGINT      NOT NULL,          -- işlem hesabı numarası

  tutar            NUMERIC(18,2) NOT NULL CHECK (tutar > 0),
  para_birimi      TEXT        NOT NULL,
  odeme_yontemi_id BIGINT      REFERENCES odeme_yontemleri(id) ON DELETE SET NULL,
  -- Yöntem sonradan silinse/değişse bile talebin o anki hâli kaybolmasın:
  yontem_ozeti     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Çekimde müşterinin parayı alacağı hesap (kendi IBAN'ı / cüzdanı)
  hedef_hesap      TEXT,

  -- Talep anındaki bakiye görüntüsü (denetim için dondurulur)
  bakiye_anlik     JSONB,

  musteri_notu     TEXT,
  yonetici_notu    TEXT,                          -- red sebebi burada
  dekont_id        BIGINT,                        -- dosyalar(id) — yatırım dekontu

  olusturma        TIMESTAMPTZ NOT NULL DEFAULT now(),
  guncelleme       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sonuclanma       TIMESTAMPTZ,
  islem_yapan      BIGINT      REFERENCES yoneticiler(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_talep_musteri ON talepler (customer_id, olusturma DESC);
CREATE INDEX IF NOT EXISTS ix_talep_durum   ON talepler (durum, tip, olusturma DESC);
CREATE INDEX IF NOT EXISTS ix_talep_login   ON talepler (login);

-- ---------------------------------------------------------------- dosyalar
-- KYC belgeleri ve yatırım dekontları. Dosyalar veritabanında (bytea) tutuluyor:
-- ek servis gerektirmez, her ortamda çalışır, yedekleme veritabanıyla birlikte
-- gelir. Hacim çok büyürse (10 GB üstü) nesne depolamaya taşımak gerekir.
CREATE TABLE IF NOT EXISTS dosyalar (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT      NOT NULL,
  orijinal_ad  TEXT        NOT NULL,
  mime         TEXT        NOT NULL,
  boyut        INT         NOT NULL,
  icerik       BYTEA       NOT NULL,
  olusturma    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dosya_musteri ON dosyalar (customer_id);

ALTER TABLE talepler
  DROP CONSTRAINT IF EXISTS fk_talep_dekont;
ALTER TABLE talepler
  ADD CONSTRAINT fk_talep_dekont
  FOREIGN KEY (dekont_id) REFERENCES dosyalar(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- KYC
CREATE TABLE IF NOT EXISTS kyc_belgeleri (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   BIGINT      NOT NULL,
  eposta        TEXT        NOT NULL,
  ad_soyad      TEXT,
  belge_turu    TEXT        NOT NULL
                CHECK (belge_turu IN ('kimlik_on','kimlik_arka','pasaport',
                                      'ikametgah','banka_dekontu','diger')),
  dosya_id      BIGINT      NOT NULL REFERENCES dosyalar(id) ON DELETE CASCADE,
  durum         TEXT        NOT NULL DEFAULT 'beklemede'
                CHECK (durum IN ('beklemede','onaylandi','reddedildi')),
  yonetici_notu TEXT,
  olusturma     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sonuclanma    TIMESTAMPTZ,
  islem_yapan   BIGINT      REFERENCES yoneticiler(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_kyc_musteri ON kyc_belgeleri (customer_id, olusturma DESC);
CREATE INDEX IF NOT EXISTS ix_kyc_durum   ON kyc_belgeleri (durum, olusturma DESC);

-- ------------------------------------------------------------- işlem kaydı
-- Kim neyi ne zaman değiştirdi. Para taleplerinde denetim izi şart.
CREATE TABLE IF NOT EXISTS islem_kayitlari (
  id          BIGSERIAL PRIMARY KEY,
  yonetici_id BIGINT      REFERENCES yoneticiler(id) ON DELETE SET NULL,
  customer_id BIGINT,
  eylem       TEXT        NOT NULL,     -- talep.onayla, kyc.reddet, yontem.sil ...
  hedef_tur   TEXT,                     -- talep | kyc | odeme_yontemi
  hedef_id    BIGINT,
  detay       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip          TEXT,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_kayit_zaman ON islem_kayitlari (olusturma DESC);
CREATE INDEX IF NOT EXISTS ix_kayit_hedef ON islem_kayitlari (hedef_tur, hedef_id);

-- ------------------------------------------------------- bakiye sorgu sayacı
-- Çekim ekranında bakiye canlı sorgulanıyor. Platformu yormamak ve kötüye
-- kullanımı önlemek için müşteri başına bekleme süresi uyguluyoruz.
CREATE TABLE IF NOT EXISTS bakiye_sorgulari (
  customer_id BIGINT      PRIMARY KEY,
  son_sorgu   TIMESTAMPTZ NOT NULL DEFAULT now(),
  adet        INT         NOT NULL DEFAULT 1
);

COMMIT;
