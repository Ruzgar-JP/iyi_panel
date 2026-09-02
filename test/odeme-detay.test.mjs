import assert from "node:assert/strict";
import test from "node:test";

import { odemeDetaylariniDuzelt } from "../lib/odeme-detay.ts";

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
