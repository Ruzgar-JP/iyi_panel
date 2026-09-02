-- Çalışan uygulamanın veritabanı yetkileri.
--
-- Bu betik yalnızca kendi PostgreSQL sunucusunu yöneten kurulumlar içindir.
-- Neon gibi yönetilen hizmetlerde çalıştırılmaz; Neon'da Console'dan verilen
-- rol zaten şema göçünü ve uygulamayı çalıştırır.
--
-- Çalıştırma:
--   sudo -u postgres psql -d iyipanel -f kurulum/veritabani-yetkileri.sql

BEGIN;

REVOKE ALL ON DATABASE iyipanel FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE iyipanel TO iyipanel_uygulama;
GRANT USAGE ON SCHEMA public TO iyipanel_uygulama;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO iyipanel_uygulama;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iyipanel_uygulama;

-- Sonraki göçlerde sahibin oluşturacağı tablo ve diziler de uygulamaya
-- otomatik olarak aynı veri erişim yetkilerini verir.
ALTER DEFAULT PRIVILEGES FOR ROLE iyipanel_sahip IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iyipanel_uygulama;
ALTER DEFAULT PRIVILEGES FOR ROLE iyipanel_sahip IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO iyipanel_uygulama;

COMMIT;
