import assert from "node:assert/strict";
import test from "node:test";

import { odemeDetaylariniDuzelt } from "../lib/odeme-detay.ts";
import { readFileSync } from "node:fs";

test("JSONB nesnesi ödeme detaylarını olduğu gibi korur", () => {
  assert.deepEqual(odemeDetaylariniDuzelt({ banka: "Ziraat", iban: "TR00" }), { banka: "Ziraat", iban: "TR00" });
});

test("yanlışlıkla JSON metni kaydedilmiş eski ödeme detaylarını düzeltir", () => {
  assert.deepEqual(
    odemeDetaylariniDuzelt('{"banka":"Ziraat","iban":"TR00"}'),
    { banka: "Ziraat", iban: "TR00" },
  );
});

test("geçersiz ödeme detayları boş nesne olur", () => {
  assert.deepEqual(odemeDetaylariniDuzelt("geçersiz"), {});
});

test("yatırım ekranında IBAN ayrı ve kopyalanabilir bir alan olarak gösterilir", () => {
  const kaynak = readFileSync(new URL("../components/panel/YatirimFormu.tsx", import.meta.url), "utf8");
  assert.match(kaynak, /iy-yontem-detay-satir/);
  assert.match(kaynak, /aria-live="polite"/);
  assert.match(kaynak, /Kopyala/);
});
