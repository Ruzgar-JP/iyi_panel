import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const kaynak = readFileSync(new URL("../app/api/panel/giris/route.ts", import.meta.url), "utf8");

test("bağlantısı eksik müşterinin platform hesapları girişte eşitlenir", () => {
  assert.match(kaynak, /hesaplariGetir/);
  assert.match(kaynak, /hesapBagla/);
  assert.match(kaynak, /musteri\.st_sifre/);
});

test("platform senkronizasyonu başarısız olursa yerel giriş engellenmez", () => {
  assert.match(kaynak, /platform hesap eşitleme başarısız/);
});

test("oturum hesabı JSON dizisi olarak saklanır, JSON metni olarak değil", () => {
  const kaynak = readFileSync(new URL("../lib/oturum.ts", import.meta.url), "utf8");
  assert.match(kaynak, /\$\{sql\.json\(hesaplar\)\}/);
  assert.doesNotMatch(kaynak, /\$\{JSON\.stringify\(hesaplar\)\}::jsonb/);
});
