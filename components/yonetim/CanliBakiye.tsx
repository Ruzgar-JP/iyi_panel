"use client";

import { useState } from "react";

import { paraFormat, tarihFormat } from "@/lib/bicim";
import { yonetimIstek } from "@/lib/yonetim-istek";

type Bakiye = {
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  bonus?: number;
  credit: number;
};

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

/**
 * Talebi incelerken hesabın GÜNCEL durumunu getirir.
 * Listede görünen bakiye talep anına aittir; onaydan önce bu butona basılmalı.
 */
export default function CanliBakiye({
  login,
  talepTutari,
}: {
  login: number;
  talepTutari?: number;
}) {
  type Kalem = { etiket: string; tutar: number };
  const [veri, setVeri] = useState<
    { bakiye: Bakiye; cekilebilir: number; cekilemeyen: Kalem[]; profil: Profil | null } | null
  >(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function getir() {
    setHata(null);
    setBekliyor(true);
    const s = await yonetimIstek<{
      bakiye: Bakiye; cekilebilir: number; cekilemeyen: Kalem[]; profil: Profil | null;
    }>(`/api/yonetim/hesap/${login}`);
    setBekliyor(false);

    if (!s.ok) { setHata(s.mesaj); return; }
    setVeri({
      bakiye: s.veri.bakiye,
      cekilebilir: s.veri.cekilebilir,
      cekilemeyen: s.veri.cekilemeyen ?? [],
      profil: s.veri.profil,
    });
  }

  if (!veri) {
    return (
      <div>
        <button className="iy-btn sade kucuk" onClick={getir} disabled={bekliyor}>
          {bekliyor ? "Sorgulanıyor…" : "Güncel bakiyeyi getir"}
        </button>
        {hata && (
          <div className="kucuk-yazi" style={{ color: "#b42318", marginTop: 5 }}>
            {hata}
          </div>
        )}
      </div>
    );
  }

  const { bakiye, cekilebilir, profil } = veri;
  const yetersiz = talepTutari != null && talepTutari > cekilebilir;

  return (
    <div className="kucuk-yazi" style={{ minWidth: 210 }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: yetersiz ? "#b42318" : "#067647",
          marginBottom: 4,
        }}
      >
        Çekilebilir: {paraFormat(cekilebilir)}
      </div>

      {yetersiz && (
        <div
          className="iy-mesaj hata"
          style={{ padding: "6px 9px", fontSize: 12.5, marginBottom: 6 }}
        >
          Talep tutarı güncel çekilebilir bakiyeden yüksek. Onaylamayın.
        </div>
      )}

      <div>Bakiye: {paraFormat(bakiye.balance)}</div>
      <div>Varlık: {paraFormat(bakiye.equity)}</div>
      {veri.cekilemeyen.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <span style={{ color: "#b54708" }}>Çekilemeyen:</span>{" "}
          {veri.cekilemeyen.map((k, i) => (
            <span key={k.etiket}>
              {i > 0 && " · "}
              {k.etiket} {paraFormat(k.tutar)}
            </span>
          ))}
        </div>
      )}

      {profil && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e4e7ec" }}>
          <div>{profil.telefon || "telefon yok"}</div>
          <div>
            {[profil.sehir, profil.ulke].filter(Boolean).join(", ") || "adres bilgisi yok"}
          </div>
          <div>Kayıt: {tarihFormat(new Date(profil.kayitZamani * 1000))}</div>
          {!profil.aktif && (
            <div style={{ color: "#b42318", fontWeight: 600 }}>Hesap devre dışı</div>
          )}
          {profil.saltOkunur && (
            <div style={{ color: "#b54708", fontWeight: 600 }}>Salt okunur hesap</div>
          )}
        </div>
      )}

      <button
        className="iy-btn sade kucuk"
        onClick={getir}
        disabled={bekliyor}
        style={{ marginTop: 8 }}
      >
        {bekliyor ? "…" : "Yenile"}
      </button>
    </div>
  );
}
