-- 003 — Sistem ayarları (panelden düzenlenebilen yapılandırma).
--
-- Gerekçe: SMTP bilgileri .env.local'de tutulunca her değişiklikte sunucuya
-- SSH ile girip dosya düzenlemek ve uygulamayı yeniden başlatmak gerekiyordu.
-- Bunlar operasyonel ayarlardır, sık değişir ve teknik olmayan personel de
-- güncelleyebilmelidir. Bu yüzden veritabanına alındı.
--
-- Sırlar (SMTP şifresi gibi) düz metin YAZILMAZ; lib/kripto.ts içindeki
-- AES-256-GCM ile şifrelenip öyle saklanır. Anahtar AYAR_ANAHTARI ortam
-- değişkenindedir — yani veritabanı yedeği tek başına ele geçse bile
-- şifreler okunamaz.

BEGIN;

CREATE TABLE IF NOT EXISTS sistem_ayarlari (
  anahtar     TEXT        PRIMARY KEY,   -- 'smtp'
  deger       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  guncelleme  TIMESTAMPTZ NOT NULL DEFAULT now(),
  guncelleyen BIGINT      REFERENCES yoneticiler(id) ON DELETE SET NULL
);

COMMIT;
