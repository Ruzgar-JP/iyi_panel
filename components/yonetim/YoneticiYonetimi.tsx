"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { tarihFormat } from "@/lib/bicim";
import { SIFRE_KURALLARI } from "@/lib/sifre";

type Rol = "operator" | "yonetici";

type Kullanici = {
  id: number;
  eposta: string;
  adSoyad: string;
  rol: Rol;
  aktif: boolean;
  olusturma: string;
  sonGiris: string | null;
};

type Form = {
  id: number; // 0 = yeni kayıt
  eposta: string;
  adSoyad: string;
  rol: Rol;
  aktif: boolean;
  sifre: string;
};

const BOS: Form = { id: 0, eposta: "", adSoyad: "", rol: "operator", aktif: true, sifre: "" };

const ROL_ADI: Record<Rol, string> = {
  yonetici: "Tam yetkili",
  operator: "Operatör",
};

/** Kurallara uyan, okunabilir bir şifre üretir (tarayıcıda, sunucuya gitmeden). */
function sifreUret(): string {
  const harfler = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const kucuk = "abcdefghijkmnopqrstuvwxyz";
  const rakam = "23456789";
  const simge = "!@#$%&*?";
  const havuz = harfler + kucuk + rakam + simge;

  const rastgele = (kaynak: string, adet: number) => {
    const sayilar = new Uint32Array(adet);
    crypto.getRandomValues(sayilar);
    return Array.from(sayilar, (s) => kaynak[s % kaynak.length]).join("");
  };

  // Her kuraldan en az bir karakter garanti, kalanı havuzdan; sonra karıştır.
  const parcalar = (
    rastgele(harfler, 2) + rastgele(kucuk, 4) + rastgele(rakam, 3) + rastgele(simge, 2) +
    rastgele(havuz, 3)
  ).split("");

  const sira = new Uint32Array(parcalar.length);
  crypto.getRandomValues(sira);
  return parcalar
    .map((k, i) => ({ k, s: sira[i] }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.k)
    .join("");
}

export default function YoneticiYonetimi({
  baslangic,
  kendiId,
}: {
  baslangic: Kullanici[];
  kendiId: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [silinecek, setSilinecek] = useState<number | null>(null);

  const yeni = form?.id === 0;
  const kendisi = form?.id === kendiId;

  const kurallar = SIFRE_KURALLARI.map((k) => ({ ...k, tamam: k.gecti(form?.sifre ?? "") }));
  // Yeni kullanıcıda şifre zorunlu; düzenlemede boş bırakmak "değiştirme" demek.
  const sifreTamam = yeni
    ? kurallar.every((k) => k.tamam)
    : !form?.sifre || kurallar.every((k) => k.tamam);

  function ac(f: Form) {
    setForm(f);
    setHata(null);
    setBasari(null);
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setHata(null);
    setBasari(null);
    setBekliyor(true);

    try {
      const govde = form.id === 0
        ? { eposta: form.eposta, adSoyad: form.adSoyad, rol: form.rol, sifre: form.sifre }
        : { adSoyad: form.adSoyad, rol: form.rol, aktif: form.aktif, yeniSifre: form.sifre };

      const yanit = await fetch(
        form.id === 0 ? "/api/yonetim/yonetici" : `/api/yonetim/yonetici/${form.id}`,
        {
          method: form.id === 0 ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(govde),
        },
      );
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Kaydedilemedi.");
        return;
      }

      setBasari(
        form.id === 0
          ? `${form.adSoyad} eklendi. Şifreyi kendisine iletin — bir daha görüntülenemez.`
          : (veri.mesaj ?? "Kaydedildi."),
      );
      setForm(null);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  async function sil(id: number) {
    setHata(null);
    setBasari(null);
    setBekliyor(true);
    try {
      const yanit = await fetch(`/api/yonetim/yonetici/${id}`, { method: "DELETE" });
      const veri = await yanit.json();
      if (!veri.ok) setHata(veri.mesaj ?? "Silinemedi.");
      else {
        setBasari("Kullanıcı silindi.");
        router.refresh();
      }
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
      setSilinecek(null);
    }
  }

  return (
    <>
      {basari && <div className="iy-mesaj ok">{basari}</div>}
      {hata && !form && <div className="iy-mesaj hata" role="alert">{hata}</div>}

      {!form && (
        <div style={{ marginBottom: 16 }}>
          <button className="iy-btn" onClick={() => ac({ ...BOS })}>
            Yeni kullanıcı ekle
          </button>
        </div>
      )}

      {form && (
        <form className="iy-kart" onSubmit={kaydet} style={{ marginBottom: 20 }}>
          <h2>{yeni ? "Yeni kullanıcı" : `Düzenle · ${form.eposta}`}</h2>

          {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}

          <div className="iy-izgara">
            <label>
              <span>Ad soyad</span>
              <input
                type="text"
                value={form.adSoyad}
                onChange={(e) => setForm({ ...form, adSoyad: e.target.value })}
                placeholder="Ayşe Yılmaz"
                required
              />
            </label>

            <label>
              <span>E-posta (giriş adı)</span>
              <input
                type="email"
                value={form.eposta}
                onChange={(e) => setForm({ ...form, eposta: e.target.value })}
                placeholder="ayse@iyiyatirim.org"
                autoComplete="off"
                required
                disabled={!yeni}
              />
              {!yeni && <div className="iy-ipucu">E-posta sonradan değiştirilemez.</div>}
            </label>
          </div>

          <div className="iy-izgara">
            <label>
              <span>Yetki</span>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                disabled={kendisi}
              >
                <option value="operator">Operatör — günlük işler</option>
                <option value="yonetici">Tam yetkili — kullanıcı da yönetir</option>
              </select>
              <div className="iy-ipucu">
                {kendisi
                  ? "Kendi yetkinizi değiştiremezsiniz."
                  : form.rol === "yonetici"
                    ? "Talep/belge işlemleri + personel ekleme, şifre sıfırlama."
                    : "Talep onayı, belge inceleme, müşteri ve ödeme yöntemleri. Personel yönetimi kapalı."}
              </div>
            </label>

            {!yeni && (
              <label style={{ alignSelf: "start" }}>
                <span>Durum</span>
                <select
                  value={form.aktif ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, aktif: e.target.value === "1" })}
                  disabled={kendisi}
                >
                  <option value="1">Aktif — giriş yapabilir</option>
                  <option value="0">Pasif — giriş kapalı</option>
                </select>
                <div className="iy-ipucu">
                  {kendisi
                    ? "Kendi hesabınızı kapatamazsınız."
                    : "Pasife alınca açık oturumları da düşer."}
                </div>
              </label>
            )}
          </div>

          <label>
            <span>{yeni ? "Şifre" : "Yeni şifre (boş bırakırsanız değişmez)"}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={form.sifre}
                onChange={(e) => setForm({ ...form, sifre: e.target.value })}
                autoComplete="off"
                required={yeni}
              />
              <button
                type="button"
                className="iy-btn sade"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setForm({ ...form, sifre: sifreUret() })}
              >
                Rastgele üret
              </button>
            </div>
            <div className="iy-ipucu">
              Açık gösteriliyor — kaydettikten sonra bir daha görüntülenemez,
              kullanıcıya siz iletmelisiniz.
            </div>
          </label>

          {form.sifre && (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", fontSize: 12 }}>
              {kurallar.map((k) => (
                <li key={k.id} style={{ color: k.tamam ? "#067647" : "#b42318" }}>
                  <span style={{ display: "inline-block", width: 13, fontWeight: 700 }}>
                    {k.tamam ? "✓" : "•"}
                  </span>
                  {k.etiket}
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="iy-btn" disabled={bekliyor || !sifreTamam}>
              {bekliyor ? "Kaydediliyor…" : yeni ? "Kullanıcıyı oluştur" : "Kaydet"}
            </button>
            <button
              type="button"
              className="iy-btn sade"
              onClick={() => { setForm(null); setHata(null); }}
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      <div className="iy-kaydir">
        <table>
          <thead>
            <tr>
              <th>Kullanıcı</th><th>Yetki</th><th>Durum</th>
              <th>Son giriş</th><th>Eklendi</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {baslangic.map((k) => (
              <tr key={k.id}>
                <td>
                  {k.adSoyad}
                  {k.id === kendiId && (
                    <span className="iy-rozet onaylandi" style={{ marginLeft: 6 }}>siz</span>
                  )}
                  <div className="kucuk-yazi">{k.eposta}</div>
                </td>
                <td>
                  <span className={`iy-rozet ${k.rol === "yonetici" ? "beklemede" : "iptal"}`}>
                    {ROL_ADI[k.rol]}
                  </span>
                </td>
                <td>
                  <span className={`iy-rozet ${k.aktif ? "onaylandi" : "reddedildi"}`}>
                    {k.aktif ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td className="kucuk-yazi">{k.sonGiris ? tarihFormat(k.sonGiris) : "hiç girmedi"}</td>
                <td className="kucuk-yazi">{tarihFormat(k.olusturma)}</td>
                <td>
                  {silinecek === k.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="iy-btn red kucuk" onClick={() => sil(k.id)} disabled={bekliyor}>
                        Eminim
                      </button>
                      <button className="iy-btn sade kucuk" onClick={() => setSilinecek(null)}>
                        Vazgeç
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="iy-btn sade kucuk"
                        onClick={() =>
                          ac({
                            id: k.id,
                            eposta: k.eposta,
                            adSoyad: k.adSoyad,
                            rol: k.rol,
                            aktif: k.aktif,
                            sifre: "",
                          })
                        }
                      >
                        Düzenle
                      </button>
                      {k.id !== kendiId && (
                        <button className="iy-btn sade kucuk" onClick={() => setSilinecek(k.id)}>
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
