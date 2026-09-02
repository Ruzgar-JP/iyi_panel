-- 002 — Panel kimliği bizim veritabanımıza taşınıyor.
--
-- Gerekçe: ION'dan CRM modülü alınmadı; orada yalnızca işlem hesapları var ve
-- ScaleTrade'in "customer" kayıtları BackOffice'ten yönetilemiyor. Bu yüzden
-- müşterinin panel kimliği (e-posta + şifre + iletişim) burada tutulur.
--
-- ScaleTrade tarafında yine bir customer kaydı oluşur; çünkü hesap açan uç
-- (/customer/account/open) müşteri oturumu istiyor ve manager karşılığı
-- (MngAddAccount) yalnızca TCP Server API'de. O kayıt görünmez bir ara adımdır.

BEGIN;

CREATE TABLE IF NOT EXISTS musteriler (
  id            BIGSERIAL PRIMARY KEY,
  eposta        TEXT        NOT NULL UNIQUE,
  sifre_hash    TEXT        NOT NULL,              -- scrypt — panel şifresi
  ad            TEXT        NOT NULL,
  soyad         TEXT        NOT NULL,
  telefon       TEXT,
  pazarlama_izni BOOLEAN    NOT NULL DEFAULT false,
  aktif         BOOLEAN     NOT NULL DEFAULT true,

  -- ScaleTrade tarafındaki ara kayıt. Müşteri bunları hiç görmez.
  -- st_sifre makine üretimi bir kimlik bilgisidir (kullanıcı şifresi DEĞİL);
  -- yeni işlem hesabı açarken oturum almak için gerekir.
  st_customer_id BIGINT,
  st_sifre       TEXT,

  olusturma     TIMESTAMPTZ NOT NULL DEFAULT now(),
  guncelleme    TIMESTAMPTZ NOT NULL DEFAULT now(),
  son_giris     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_musteri_eposta ON musteriler (lower(eposta));

-- Bir müşterinin birden fazla işlem hesabı olabilir.
CREATE TABLE IF NOT EXISTS musteri_hesaplari (
  login       BIGINT      PRIMARY KEY,             -- ScaleTrade hesap numarası
  musteri_id  BIGINT      NOT NULL REFERENCES musteriler(id) ON DELETE CASCADE,
  grup        TEXT,
  para_birimi TEXT,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mh_musteri ON musteri_hesaplari (musteri_id);

-- Oturum tablosu artık ScaleTrade token'ı tutmuyor; kendi müşterimize bağlanıyor.
ALTER TABLE musteri_oturumlari ADD COLUMN IF NOT EXISTS musteri_id BIGINT;
ALTER TABLE musteri_oturumlari ALTER COLUMN st_token DROP NOT NULL;
CREATE INDEX IF NOT EXISTS ix_mo_musteri ON musteri_oturumlari (musteri_id);

-- Şifre sıfırlama jetonları (müşteri "şifremi unuttum" akışı için hazır).
CREATE TABLE IF NOT EXISTS sifre_sifirlama (
  jeton_hash  TEXT        PRIMARY KEY,
  musteri_id  BIGINT      NOT NULL REFERENCES musteriler(id) ON DELETE CASCADE,
  bitis       TIMESTAMPTZ NOT NULL,
  kullanildi  BOOLEAN     NOT NULL DEFAULT false,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
