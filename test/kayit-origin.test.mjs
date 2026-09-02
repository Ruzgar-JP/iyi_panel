import assert from "node:assert/strict";
import test from "node:test";

import { kayitCorsBasliklari, kayitOriginineIzinVar } from "../lib/kayit-origin.ts";
import { readFileSync } from "node:fs";

test("İyi Yatırım web sitesi kayıt isteği gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar("https://www.iyiyatirim.org", "https://panel.iyiyatirim.org"),
    true,
  );
});

test("panelin kendi kayıt sayfası istek gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar("https://panel.iyiyatirim.org", "https://panel.iyiyatirim.org"),
    true,
  );
});

test("yerel web sitesi geliştirme sunucusu kayıt isteği gönderebilir", () => {
  assert.equal(
    kayitOriginineIzinVar("http://localhost:3000", "https://musteripanel.iyiyatirim.org"),
    true,
  );
  assert.equal(
    kayitCorsBasliklari("http://localhost:3000")["Access-Control-Allow-Origin"],
    "http://localhost:3000",
  );
});

test("başka bir alan adından kayıt isteği reddedilir", () => {
  assert.equal(
    kayitOriginineIzinVar("https://saldirgan.example", "https://panel.iyiyatirim.org"),
    false,
  );
});

test("Origin başlığı olmayan sunucu isteği kabul edilir", () => {
  assert.equal(kayitOriginineIzinVar(null, "https://panel.iyiyatirim.org"), true);
});

test("izinli kaynak için hata yanıtlarında da CORS başlığı vardır", () => {
  assert.equal(
    kayitCorsBasliklari("https://www.iyiyatirim.org")["Access-Control-Allow-Origin"],
    "https://www.iyiyatirim.org",
  );
});

test("kayıt işlemi seçili ScaleTrade grubunu doğrudan açmayı dener", () => {
  const kaynak = readFileSync(new URL("../app/api/kayit/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(kaynak, /grupKullanilabilirMi/);
  assert.match(kaynak, /hesapAc\(token, ST\.grup\)/);
});
