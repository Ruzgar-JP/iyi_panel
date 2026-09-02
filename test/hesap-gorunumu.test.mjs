import assert from "node:assert/strict";
import test from "node:test";

import { hesapGorunumleriniDiziyeCevir } from "../lib/hesap-gorunumu.ts";

test("geçerli oturum hesap listesini olduğu gibi kullanır", () => {
  const hesaplar = [{ login: 123456, grup: "standard", paraBirimi: "USD", kaldirac: 100, bakiye: null }];
  assert.deepEqual(hesapGorunumleriniDiziyeCevir(hesaplar), hesaplar);
});

test("önceki sürümün hesap/bakiye yuvalı oturum biçimini dönüştürür", () => {
  assert.deepEqual(
    hesapGorunumleriniDiziyeCevir([
      { hesap: { login: 123456, group: "standard", currency: "USD", leverage: 100 }, bakiye: { balance: 10 } },
    ]),
    [{ login: 123456, grup: "standard", paraBirimi: "USD", kaldirac: 100, bakiye: { balance: 10 } }],
  );
});

test("bozuk veya dizi olmayan oturum verisi paneli çökertmez", () => {
  assert.deepEqual(hesapGorunumleriniDiziyeCevir({ login: 123456 }), []);
  assert.deepEqual(hesapGorunumleriniDiziyeCevir('{"login":123456}'), []);
});

test("önceki sürümün çift JSON kodlanmış oturum listesini açar", () => {
  const hesaplar = [{ login: 123456, grup: "standard", paraBirimi: "USD", kaldirac: 100, bakiye: null }];
  assert.deepEqual(hesapGorunumleriniDiziyeCevir(JSON.stringify(JSON.stringify(hesaplar))), hesaplar);
});
