"use client";

import { useCallback, useEffect, useState } from "react";

import { paraFormat, tarihFormat } from "@/lib/bicim";
import { SIFRE_KURALLARI } from "@/lib/sifre";
import { yonetimIstek } from "@/lib/yonetim-istek";

type Profil = {
  ad: string;
  eposta: string;
  telefon: string;
  ulke: string;
  sehir: string;
  adres: string;
  grup: string;
  paraBirimi: string;
  aktif: boolean;
  saltOkunur: boolean;
  kayitZamani: number;
  oncekiBakiye: number;
  oncekiAyBakiyesi: number;
};

type Bakiye = { balance: number; equity: number; margin: number; bonus?: number };

type Duzenleme = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  comment: string;
  leverage: string;
  enable: boolean;
  enable_read_only: boolean;
};

export default function HesapYonetimi({ baslangicLogin }: { baslangicLogin: string }) {
  const [arama, setArama] = useState(baslangicLogin);
  const [login, setLogin] = useState<number | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [bakiye, setBakiye] = useState<Bakiye | null>(null);
  const [form, setForm] = useState<Duzenleme | null>(null);

  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);

  const [yeniSifre, setYeniSifre] = useState("");
  const [sifreAcik, setSifreAcik] = useState(false);
  const [sifreBekliyor, setSifreBekliyor] = useState(false);

  const doldur = (p: Profil): Duzenleme => ({
    name: p.ad ?? "",
    email: p.eposta ?? "",
    phone: p.telefon ?? "",
    address: p.adres ?? "",
    city: p.sehir ?? "",
    country: p.ulke ?? "",
    comment: "",
    leverage: "",
    enable: p.aktif,
    enable_read_only: p.saltOkunur,
  });

  const getir = useCallback(async (no: number) => {
    setHata(null);
    setBasari(null);
    setYukleniyor(true);
    const s = await yonetimIstek<{ profil: Profil | null; bakiye: Bakiye }>(
      `/api/yonetim/hesap/${no}`,
    );
    setYukleniyor(false);

    if (!s.ok) {
      setHata(s.mesaj);
      setProfil(null);
      setForm(null);
      return;
    }
    setLogin(no);
    setProfil(s.veri.profil);
    setBakiye(s.veri.bakiye);
    setForm(s.veri.profil ? doldur(s.veri.profil) : null);
  }, []);

  useEffect(() => {
    const no = Number(baslangicLogin);
    if (Number.isInteger(no) && no > 0) void getir(no);
  }, [baslangicLogin, getir]);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !login) return;
    setHata(null);
    setBasari(null);
    setYukleniyor(true);

    // Kaldıraç boşsa gönderme — sunucu mevcut değeri korur
    const govde: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      country: form.country,
      enable: form.enable ? 1 : 0,
      enable_read_only: form.enable_read_only ? 1 : 0,
    };
    if (form.comment.trim()) govde.comment = form.comment.trim();
    if (form.leverage.trim()) govde.leverage = Number(form.leverage);

    const s = await yonetimIstek<{ profil: Profil }>(`/api/yonetim/hesap/${login}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
    });
    setYukleniyor(false);

    if (!s.ok) { setHata(s.mesaj); return; }
    setProfil(s.veri.profil);
    setForm(doldur(s.veri.profil));
    setBasari("Hesap bilgileri güncellendi.");
  }

  async function sifreSifirla() {
    if (!login) return;
    setHata(null);
    setBasari(null);
    setSifreBekliyor(true);
    const s = await yonetimIstek<{ mesaj: string }>(`/api/yonetim/hesap/${login}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yeniSifre }),
    });
    setSifreBekliyor(false);

    if (!s.ok) { setHata(s.mesaj); return; }
    setBasari(s.veri.mesaj);
    setYeniSifre("");
    setSifreAcik(false);
  }

  const alan = (k: keyof Duzenleme) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) =>
      f ? { ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value } : f,
    );

  const sifreDurumu = SIFRE_KURALLARI.map((k) => ({ ...k, tamam: k.gecti(yeniSifre) }));
  const sifreTamam = sifreDurumu.every((k) => k.tamam);

  return (
    <>
      <div className="iy-kart" style={{ marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const no = Number(arama);
            if (Number.isInteger(no) && no > 0) void getir(no);
            else setHata("Geçerli bir hesap numarası girin.");
          }}
          style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
        >
          <label style={{ margin: 0, flex: 1 }}>
            <span>Hesap numarası</span>
            <input
              type="text"
              inputMode="numeric"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="100012"
            />
          </label>
          <button className="iy-btn" disabled={yukleniyor}>
            {yukleniyor ? "Aranıyor…" : "Getir"}
          </button>
        </form>
      </div>

      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      {basari && <div className="iy-mesaj ok" role="status">{basari}</div>}

      {profil && form && (
        <>
          <div className="iy-kart">
            <h2>
              Hesap {login}{" "}
              <span className="kucuk-yazi" style={{ fontWeight: 400 }}>
                · {profil.grup} · {profil.paraBirimi} · kayıt{" "}
                {tarihFormat(new Date(profil.kayitZamani * 1000))}
              </span>
            </h2>

            {bakiye && (
              <p className="kucuk-yazi" style={{ marginTop: -6 }}>
                Bakiye {paraFormat(bakiye.balance)} · Varlık {paraFormat(bakiye.equity)} ·
                Teminat {paraFormat(bakiye.margin)}
                {(bakiye.bonus ?? 0) > 0 && <> · Bonus {paraFormat(bakiye.bonus)}</>}
              </p>
            )}

            <form onSubmit={kaydet}>
              <div className="iy-izgara">
                <label>
                  <span>Ad Soyad</span>
                  <input type="text" value={form.name} onChange={alan("name")} />
                </label>
                <label>
                  <span>E-posta</span>
                  <input type="email" value={form.email} onChange={alan("email")} />
                </label>
              </div>

              <div className="iy-izgara">
                <label>
                  <span>Telefon</span>
                  <input type="tel" value={form.phone} onChange={alan("phone")} />
                </label>
                <label>
                  <span>Şehir</span>
                  <input type="text" value={form.city} onChange={alan("city")} />
                </label>
              </div>

              <div className="iy-izgara">
                <label>
                  <span>Ülke</span>
                  <input type="text" value={form.country} onChange={alan("country")} />
                </label>
                <label>
                  <span>Kaldıraç (boş = değiştirme)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.leverage}
                    onChange={alan("leverage")}
                    placeholder="şu an 1:—"
                  />
                </label>
              </div>

              <label>
                <span>Adres</span>
                <input type="text" value={form.address} onChange={alan("address")} />
              </label>

              <label>
                <span>Not (boş = değiştirme)</span>
                <input type="text" value={form.comment} onChange={alan("comment")} />
              </label>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <input type="checkbox" checked={form.enable} onChange={alan("enable")} />
                  <span style={{ margin: 0, fontWeight: 400 }}>Hesap aktif</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.enable_read_only}
                    onChange={alan("enable_read_only")}
                  />
                  <span style={{ margin: 0, fontWeight: 400 }}>
                    Salt okunur (işlem yapamaz)
                  </span>
                </label>
              </div>

              <button className="iy-btn" disabled={yukleniyor}>
                {yukleniyor ? "Kaydediliyor…" : "Bilgileri Kaydet"}
              </button>
            </form>
          </div>

          <div className="iy-kart">
            <h2>İşlem şifresini sıfırla</h2>
            <p className="kucuk-yazi" style={{ marginTop: -8 }}>
              Bu, müşterinin <strong>terminale</strong> girerken kullandığı şifredir.
              Panel (portal) şifresi ayrı tutuluyor ve buradan değiştirilemez.
            </p>

            {!sifreAcik ? (
              <button className="iy-btn sade" onClick={() => setSifreAcik(true)}>
                Şifre sıfırla
              </button>
            ) : (
              <>
                <label>
                  <span>Yeni işlem şifresi</span>
                  <input
                    type="text"
                    value={yeniSifre}
                    onChange={(e) => setYeniSifre(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="iy-ipucu">
                    Şifre açık gösteriliyor — müşteriye iletmeniz gerekiyor.
                  </div>
                </label>

                <ul style={{ listStyle: "none", padding: 0, margin: "-8px 0 14px", fontSize: 13 }}>
                  {sifreDurumu.map((k) => (
                    <li
                      key={k.id}
                      style={{ padding: "2px 0", color: k.tamam ? "#067647" : yeniSifre ? "#b42318" : "#667085" }}
                    >
                      <span style={{ display: "inline-block", width: 14, fontWeight: 700 }}>
                        {k.tamam ? "✓" : "•"}
                      </span>
                      {k.etiket}
                    </li>
                  ))}
                </ul>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="iy-btn red"
                    onClick={sifreSifirla}
                    disabled={sifreBekliyor || !sifreTamam}
                  >
                    {sifreBekliyor ? "…" : "Şifreyi Değiştir"}
                  </button>
                  <button
                    className="iy-btn sade"
                    onClick={() => { setSifreAcik(false); setYeniSifre(""); }}
                  >
                    Vazgeç
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
