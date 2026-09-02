"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { paraFormat, sureMetni } from "@/lib/bicim";

type Bakiye = {
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  bonus?: number;
  credit?: number;
};

/** Çekilemeyen kalem (bonus, kredi, kullanılan teminat) — sunucudan gelir. */
type Kalem = { etiket: string; tutar: number };

type Hesap = {
  login: number;
  grup: string;
  bakiye: Bakiye | null;
  /** Sunucuda hesaplanır: serbest teminat eksi bonus ve kredi. */
  cekilebilir: number | null;
  cekilemeyen: Kalem[];
  /** Hesabın para birimi. Çekim tutarı BU birimde girilir. */
  paraBirimi: string | null;
};
type Yontem = { id: number; tip: "banka" | "kripto"; ad: string; paraBirimi: string };

export default function CekimFormu({
  kilitli,
  hesaplar,
  yontemler,
  minTutar,
  beklemeSn,
}: {
  kilitli: boolean;
  hesaplar: Hesap[];
  yontemler: Yontem[];
  minTutar: number;
  beklemeSn: number;
}) {
  const router = useRouter();

  const [login, setLogin] = useState(hesaplar[0]?.login ?? 0);
  const [yontemId, setYontemId] = useState(yontemler[0]?.id ?? 0);
  const [tutar, setTutar] = useState("");
  const [hedefHesap, setHedefHesap] = useState("");
  const [not, setNot] = useState("");

  /** Canlı sorgudan gelen bakiye; yoksa girişteki görüntü kullanılır. */
  const [canliBakiye, setCanliBakiye] = useState<Bakiye | null>(null);
  const [canliCekilebilir, setCanliCekilebilir] = useState<number | null>(null);
  const [canliKalemler, setCanliKalemler] = useState<Kalem[] | null>(null);
  const [kalanSn, setKalanSn] = useState(0);
  const [sorguluyor, setSorguluyor] = useState(false);

  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const hesap = hesaplar.find((h) => h.login === login);
  const yontem = yontemler.find((y) => y.id === yontemId);
  const bakiye = canliBakiye ?? hesap?.bakiye ?? null;
  // Çekilebilir tutar her zaman sunucudan gelir — istemcide hesaplanmaz,
  // böylece bonus kuralı tek yerde kalır.
  const cekilebilir = canliCekilebilir ?? hesap?.cekilebilir ?? 0;
  const kalemler = canliKalemler ?? hesap?.cekilemeyen ?? [];
  const birim = hesap?.paraBirimi ?? "";
  // Ödeme yöntemi farklı bir para biriminde olabilir (USD hesap → TRY banka).
  const farkliBirim = Boolean(birim && yontem && yontem.paraBirimi !== birim);

  /* Bekleme süresi geri sayımı */
  useEffect(() => {
    if (kalanSn <= 0) return;
    const zamanlayici = setInterval(() => setKalanSn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(zamanlayici);
  }, [kalanSn]);

  /* Hesap değişince canlı bakiye görüntüsünü sıfırla */
  useEffect(() => {
    setCanliBakiye(null);
    setCanliCekilebilir(null);
    setCanliKalemler(null);
  }, [login]);

  async function bakiyeYenile() {
    setHata(null);
    setSorguluyor(true);
    try {
      const yanit = await fetch("/api/panel/bakiye", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      const veri = await yanit.json();

      if (!veri.ok) {
        if (veri.beklemede) setKalanSn(veri.kalanSn ?? beklemeSn);
        setHata(veri.mesaj ?? "Bakiye alınamadı.");
        return;
      }
      setCanliBakiye(veri.bakiye);
      setCanliCekilebilir(veri.cekilebilir ?? null);
      setCanliKalemler(veri.cekilemeyen ?? null);
      setKalanSn(beklemeSn);
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setSorguluyor(false);
    }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBasari(null);

    const sayi = Number(tutar.replace(",", "."));
    if (!Number.isFinite(sayi) || sayi <= 0) return setHata("Geçerli bir tutar girin.");
    if (sayi < minTutar) return setHata(`En düşük çekim tutarı ${minTutar}.`);
    if (bakiye && sayi > cekilebilir) {
      const adlar = kalemler.map((k) => k.etiket.toLowerCase()).join(", ");
      return setHata(
        `Çekilebilir tutarınız ${paraFormat(cekilebilir)}.` +
          (adlar ? ` ${adlar} çekilemez.` : ""),
      );
    }
    if (!hedefHesap.trim()) {
      return setHata("Paranın gönderileceği hesap bilgisini girin.");
    }

    const form = new FormData();
    form.set("tip", "cekim");
    form.set("login", String(login));
    form.set("yontemId", String(yontemId));
    form.set("tutar", String(sayi));
    form.set("hedefHesap", hedefHesap.trim());
    form.set("not", not);

    setBekliyor(true);
    try {
      const yanit = await fetch("/api/panel/talep", { method: "POST", body: form });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Talebiniz oluşturulamadı.");
        return;
      }
      setBasari(veri.mesaj);
      setTutar("");
      setHedefHesap("");
      setNot("");
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form className="iy-kart" onSubmit={gonder} noValidate>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      {basari && <div className="iy-mesaj ok" role="status">{basari}</div>}

      {hesaplar.length > 1 && (
        <label>
          <span>Hangi hesaptan çekilecek</span>
          <select value={login} onChange={(e) => setLogin(Number(e.target.value))}>
            {hesaplar.map((h) => (
              <option key={h.login} value={h.login}>{h.login} — {h.grup}</option>
            ))}
          </select>
        </label>
      )}

      {/* Bakiye kutusu */}
      <div style={{ background: "#f2f4f7", borderRadius: 9, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="kucuk-yazi">Çekilebilir tutar</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {bakiye ? `${paraFormat(cekilebilir)} ${birim}` : "—"}
            </div>
          </div>
          <button
            type="button"
            className="iy-btn sade kucuk"
            onClick={bakiyeYenile}
            disabled={sorguluyor || kalanSn > 0}
          >
            {sorguluyor
              ? "Sorgulanıyor…"
              : kalanSn > 0
                ? `${sureMetni(kalanSn)} sonra`
                : "Bakiyemi güncelle"}
          </button>
        </div>

        {bakiye && (
          <div className="kucuk-yazi" style={{ marginTop: 10 }}>
            <div>
              Bakiye {paraFormat(bakiye.balance)} · Varlık {paraFormat(bakiye.equity)}
            </div>
            {kalemler.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <strong>Çekilemeyen:</strong>{" "}
                {kalemler.map((k, i) => (
                  <span key={k.etiket}>
                    {i > 0 && " · "}
                    {k.etiket} {paraFormat(k.tutar)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {kalanSn > 0 && (
          <div className="kucuk-yazi" style={{ marginTop: 8 }}>
            Bakiye çok sık sorgulanamaz. Yeniden sorgulamak için {sureMetni(kalanSn)} bekleyin.
          </div>
        )}
        {canliBakiye && (
          <div className="kucuk-yazi" style={{ marginTop: 6, color: "#067647" }}>
            Bu değer az önce güncellendi.
          </div>
        )}
      </div>

      <label>
        <span>Çekmek istediğiniz tutar{birim && ` (${birim})`}</span>
        <input
          type="text"
          inputMode="decimal"
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          placeholder="0,00"
          required
        />
        {bakiye && (
          <div className="iy-ipucu">
            En fazla {paraFormat(cekilebilir)} {birim} çekebilirsiniz.{" "}
            <button
              type="button"
              className="iy-btn sade kucuk"
              onClick={() => setTutar(String(cekilebilir.toFixed(2)))}
            >
              Tümü
            </button>
          </div>
        )}
      </label>

      <label>
        <span>Ödeme yöntemi</span>
        <select value={yontemId} onChange={(e) => setYontemId(Number(e.target.value))}>
          {yontemler.map((y) => (
            <option key={y.id} value={y.id}>{y.ad} — {y.paraBirimi}</option>
          ))}
        </select>
      </label>

      {farkliBirim && (
        <div className="iy-mesaj bilgi" style={{ fontSize: 13.5 }}>
          Hesabınız <strong>{birim}</strong>, seçtiğiniz ödeme yöntemi ise{" "}
          <strong>{yontem?.paraBirimi}</strong>. Tutarı {birim} olarak girin;
          ödeme günün kuru üzerinden {yontem?.paraBirimi} olarak gönderilir.
        </div>
      )}

      <label>
        <span>
          {yontem?.tip === "kripto" ? "Cüzdan adresiniz" : "IBAN / hesap bilginiz"}
        </span>
        <input
          type="text"
          value={hedefHesap}
          onChange={(e) => setHedefHesap(e.target.value)}
          placeholder={yontem?.tip === "kripto" ? "TR... / 0x..." : "TR__ ____ ____ ____"}
          required
        />
        <div className="iy-ipucu">
          Para bu bilgiye gönderilecek. Hatalı bilgiden doğan gecikmelerden
          sorumlu tutulamayız.
        </div>
      </label>

      <label>
        <span>Not (isteğe bağlı)</span>
        <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} />
      </label>

      <button className="iy-btn tam" disabled={bekliyor || kilitli}>
        {bekliyor ? "Gönderiliyor…" : "Çekim Talebi Oluştur"}
      </button>

      {kilitli && (
        <p className="iy-ipucu" style={{ textAlign: "center", marginTop: 10 }}>
          Bekleyen talebiniz sonuçlanınca yeni talep oluşturabilirsiniz.
        </p>
      )}
    </form>
  );
}
