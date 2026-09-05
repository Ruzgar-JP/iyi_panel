import assert from "node:assert/strict";
import test from "node:test";

import { kayitCorsBasliklari, kayitOriginineIzinVar } from "../lib/kayit-origin.ts";
import { readFileSync } from "node:fs";

test("Novatrix Markets web sitesi kayıt isteği gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar(
      "https://www.novatrixmarkets.com",
      "https://musteripanel.novatrixmarkets.com",
    ),
    true,
  );
});

test("panelin kendi kayıt sayfası istek gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar(
      "https://musteripanel.novatrixmarkets.com",
      "https://musteripanel.novatrixmarkets.com",
    ),
    true,
  );
});

test("yerel web sitesi geliştirme sunucusu kayıt isteği gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar("http://localhost:3000", "https://musteripanel.novatrixmarkets.com"),
    true,
  );
  assert.equal(
    kayitCorsBasliklari("http://localhost:3000")["Access-Control-Allow-Origin"],
    "http://localhost:3000",
  );
});

test("başka bir alan adından kayıt isteği reddedilir", () => {
  assert.equal(
    kayitOriginineIzinVar("https://saldirgan.example", "https://musteripanel.novatrixmarkets.com"),
    false,
  );
});

test("Origin başlığı olmayan sunucu isteği kabul edilir", () => {
  assert.equal(kayitOriginineIzinVar(null, "https://musteripanel.novatrixmarkets.com"), true);
});

test("izinli kaynak için hata yanıtlarında da CORS başlığı vardır", () => {
  assert.equal(
    kayitCorsBasliklari("https://www.novatrixmarkets.com")["Access-Control-Allow-Origin"],
    "https://www.novatrixmarkets.com",
  );
});

test("kayıt işlemi seçili ScaleTrade grubunu doğrudan açmayı dener", () => {
  const kaynak = readFileSync(new URL("../app/api/kayit/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(kaynak, /grupKullanilabilirMi/);
  assert.match(kaynak, /hesapAc\(token, ST\.grup\)/);
});

test("hız sınırı captcha doğrulamasından sonra uygulanır", () => {
  const kaynak = readFileSync(new URL("../app/api/kayit/route.ts", import.meta.url), "utf8");
  assert.ok(kaynak.indexOf("captchaDogrula(g.captchaJetonu") < kaynak.lastIndexOf("cokDenendiMi"));
});

test("captcha reddi gizli anahtarı ifşa etmeden tanı etiketi döndürür", () => {
  const kaynak = readFileSync(new URL("../app/api/kayit/route.ts", import.meta.url), "utf8");
  assert.match(kaynak, /CAPTCHA\/\$\{captcha\.etiket/);
  assert.doesNotMatch(kaynak, /TURNSTILE_SECRET_KEY.*mesaj/);
});
