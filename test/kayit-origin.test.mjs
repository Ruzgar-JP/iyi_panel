import assert from "node:assert/strict";
import test from "node:test";

import { kayitOriginineIzinVar } from "../lib/kayit-origin.ts";

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

test("başka bir alan adından kayıt isteği reddedilir", () => {
  assert.equal(
    kayitOriginineIzinVar("https://saldirgan.example", "https://panel.iyiyatirim.org"),
    false,
  );
});

test("Origin başlığı olmayan sunucu isteği kabul edilir", () => {
  assert.equal(kayitOriginineIzinVar(null, "https://panel.iyiyatirim.org"), true);
});
