"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { yonetimIstek } from "@/lib/yonetim-istek";

type TlsKipi = "otomatik" | "ssl" | "starttls";

export type EpostaFormu = {
  host: string;
  port: number;
  kullanici: string;
  gonderen: string;
  tls: TlsKipi;
  siteAdresi: string;
};

/** Sık kullanılan sağlayıcılar — tek tıkla doldurur. */
const HAZIR: { ad: string; host: string; port: number; not: string }[] = [
  {
    ad: "Yandex 360",
    host: "smtp.yandex.com",
    port: 465,
    not: "Kullanıcı adı tam e-posta adresinizdir. Şifre olarak hesap şifresini değil, uygulama şifresini kullanın.",
  },
  {
    ad: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 465,
    not: "İki adımlı doğrulamayı açıp bir 'uygulama şifresi' üretmeniz gerekir; normal hesap şifresi kabul edilmez.",
  },
  {
    ad: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    not: "Kiracı ayarlarında SMTP AUTH kapalıysa yönetici panelinden açılmalıdır.",
  },
  {
    ad: "Brevo (Sendinblue)",
    host: "smtp-relay.brevo.com",
    port: 587,
    not: "Kullanıcı adı ve şifre, Brevo panelindeki SMTP anahtarlarıdır; giriş şifreniz değildir.",
  },
];

export default function EpostaAyarlari({
  baslangic,
  sifreKayitli,
  anahtarHazir,
}: {
  baslangic: EpostaFormu;
  /** Veritabanında kayıtlı bir şifre var mı (değerin kendisi gelmez). */
  sifreKayitli: boolean;
  /** AYAR_ANAHTARI kurulu mu — kurulu değilse şifre kaydedilemez. */
  anahtarHazir: boolean;
}) {
  const router = useRouter();

  const [form, setForm] = useState<EpostaFormu>(baslangic);
  const [sifre, setSifre] = useState("");
  const [testAdresi, setTestAdresi] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [ipucu, setIpucu] = useState<string | null>(null);

  function degistir<A extends keyof EpostaFormu>(alan: A, deger: EpostaFormu[A]) {
    setForm((o) => ({ ...o, [alan]: deger }));
    setBasari(null);
    setHata(null);
  }

  function hazirSec(h: (typeof HAZIR)[number]) {
    setForm((o) => ({ ...o, host: h.host, port: h.port, tls: "otomatik" }));
    setIpucu(h.not);
    setBasari(null);
    setHata(null);
  }

  async function kaydet() {
    setBekliyor(true);
    setHata(null);
    setBasari(null);

    const s = await yonetimIstek("/api/yonetim/eposta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, sifre }),
    });

    setBekliyor(false);
    if (!s.ok) {
      setHata(s.mesaj);
      return;
    }

    setSifre("");
    setBasari("Ayarlar kaydedildi. Şimdi test e-postası göndererek doğrulayın.");
    router.refresh();
  }

  async function test() {
    setBekliyor(true);
    setHata(null);
    setBasari(null);

    const s = await yonetimIstek<{ mesaj: string }>("/api/yonetim/eposta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kime: testAdresi }),
    });

    setBekliyor(false);
    if (!s.ok) {
      setHata(s.mesaj);
      return;
    }
    setBasari(s.veri.mesaj);
  }

  return (
    <div className="iy-kart">
      <h2>E-posta (SMTP) ayarları</h2>
      <p className="iy-ipucu" style={{ marginTop: -8, marginBottom: 18 }}>
        Şifre sıfırlama bağlantıları bu hesaptan gönderilir. Ayarlar
        veritabanında tutulur — değiştirmek için sunucuya girmeye gerek yoktur.
      </p>

      {hata && <div className="iy-mesaj hata">{hata}</div>}
      {basari && <div className="iy-mesaj ok">{basari}</div>}

      {!anahtarHazir && (
        <div className="iy-mesaj bilgi">
          <strong>AYAR_ANAHTARI tanımlı değil.</strong> Şifreyi düz metin
          saklamamak için kaydetme reddedilir. Sunucuda{" "}
          <code>openssl rand -base64 32</code> çalıştırıp çıktıyı{" "}
          <code>.env.local</code> içine <code>AYAR_ANAHTARI=...</code> olarak
          ekleyin ve uygulamayı yeniden başlatın.
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "#344054",
          }}
        >
          Hazır ayarlar
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HAZIR.map((h) => (
            <button
              key={h.ad}
              type="button"
              className="iy-btn sade kucuk"
              onClick={() => hazirSec(h)}
            >
              {h.ad}
            </button>
          ))}
        </div>
        {ipucu && <p className="iy-ipucu">{ipucu}</p>}
      </div>

      <div className="iy-izgara">
        <label>
          <span>Sunucu adresi</span>
          <input
            value={form.host}
            onChange={(e) => degistir("host", e.target.value)}
            placeholder="smtp.yandex.com"
            autoComplete="off"
          />
        </label>

        <label>
          <span>Port</span>
          <input
            type="number"
            value={form.port}
            onChange={(e) => degistir("port", Number(e.target.value))}
            placeholder="465"
          />
          <p className="iy-ipucu">465 = SSL, 587 = STARTTLS</p>
        </label>
      </div>

      <label>
        <span>Şifreleme</span>
        <select value={form.tls} onChange={(e) => degistir("tls", e.target.value as TlsKipi)}>
          <option value="otomatik">Otomatik (porta göre) — önerilen</option>
          <option value="ssl">SSL/TLS (örtük)</option>
          <option value="starttls">STARTTLS</option>
        </select>
      </label>

      <div className="iy-izgara">
        <label>
          <span>Kullanıcı adı</span>
          <input
            value={form.kullanici}
            onChange={(e) => degistir("kullanici", e.target.value)}
            placeholder="destek@iyiyatirim.org"
            autoComplete="off"
          />
        </label>

        <label>
          <span>Şifre</span>
          <input
            type="password"
            value={sifre}
            onChange={(e) => {
              setSifre(e.target.value);
              setBasari(null);
              setHata(null);
            }}
            placeholder={sifreKayitli ? "Kayıtlı — değiştirmek için yazın" : "Uygulama şifresi"}
            autoComplete="new-password"
          />
          <p className="iy-ipucu">
            {sifreKayitli
              ? "Boş bırakırsanız mevcut şifre korunur."
              : "Şifrelenerek saklanır, bir daha ekranda gösterilmez."}
          </p>
        </label>
      </div>

      <label>
        <span>Gönderen</span>
        <input
          value={form.gonderen}
          onChange={(e) => degistir("gonderen", e.target.value)}
          placeholder="İyi Yatırım <destek@iyiyatirim.org>"
          autoComplete="off"
        />
        <p className="iy-ipucu">
          Müşterinin gelen kutusunda görünecek ad ve adres. Adresin, giriş
          yaptığınız hesaba ait olması gerekir — aksi halde sağlayıcı reddeder.
        </p>
      </label>

      <label>
        <span>Site adresi</span>
        <input
          value={form.siteAdresi}
          onChange={(e) => degistir("siteAdresi", e.target.value)}
          placeholder="https://panel.iyiyatirim.org"
          autoComplete="off"
        />
        <p className="iy-ipucu">
          Şifre sıfırlama bağlantıları bu adresle üretilir. Boş bırakılırsa
          isteğin geldiği adres kullanılır; ters vekil arkasında bu yanlış olabilir.
        </p>
      </label>

      <button type="button" className="iy-btn" onClick={kaydet} disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "Ayarları kaydet"}
      </button>

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0 18px" }} />

      <h2 style={{ marginBottom: 6 }}>Test e-postası</h2>
      <p className="iy-ipucu" style={{ marginBottom: 14 }}>
        Kaydedilmiş ayarlarla gerçek bir e-posta gönderir. Önce kaydedin, sonra
        deneyin.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <label style={{ flex: "1 1 240px", marginBottom: 0 }}>
          <span>Gönderilecek adres</span>
          <input
            type="email"
            value={testAdresi}
            onChange={(e) => setTestAdresi(e.target.value)}
            placeholder="kendi@adresiniz.com"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="iy-btn sade"
          onClick={test}
          disabled={bekliyor || !testAdresi}
          style={{ marginTop: 25 }}
        >
          {bekliyor ? "Gönderiliyor…" : "Test gönder"}
        </button>
      </div>
    </div>
  );
}
