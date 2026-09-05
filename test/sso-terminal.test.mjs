import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("SSO tokenı giriş anında üretilir ve yalnızca sunucu oturumunda saklanır", () => {
  const login = read("app/api/panel/giris/route.ts");
  const session = read("lib/oturum.ts");

  assert.match(login, /islemGirisYap\(ilkHesap\.login, sifre\)/);
  assert.match(login, /musteriOturumAc\(musteri, gorunumler, ip, stToken\)/);
  assert.match(session, /stToken:\s*string \| null/);
  assert.match(session, /\$\{stToken \?\? null\}/);
  assert.match(session, /o\.st_token/);
});

test("terminal bağlantısı yalnızca token varsa Novatrix terminal kökünde SSO kullanır", () => {
  const terminal = read("lib/terminal.ts");

  assert.match(terminal, /new URL\(TEMEL\)\.origin/);
  assert.match(terminal, /\/en\/\?token=\$\{encodeURIComponent\(stToken\)\}/);
  assert.match(terminal, /if \(!stToken\) return TEMEL/);
});
