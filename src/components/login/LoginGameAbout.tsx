"use client";

import { useEffect, useState } from "react";

/** SohbeX / Klan Savaşları about button + modal under the Yamato login card. */

const PILLARS = [
  {
    title: "Klan savaşı",
    body: "Dört büyük klan — Kızıl Sancak, Gümüş Bozkır, Mavi Liman, Demir Vadi — toprak, geçit ve itibar için sürekli çekişir. Zafer tek düelloda değil; sefer, lojistik ve ittifakta ölçülür.",
  },
  {
    title: "Klasik grind + PvP",
    body: "Gündüz tarla ve zindan, gece sınır baskını. Karakterini büyüt, klanına güç kat; açık dünyada risk her zaman masada.",
  },
  {
    title: "Dört sınıf",
    body: "Savaşçı, Büyücü, Okçu ve Şifacı. Her sınıfın rolü net; klan savaşında kombine güç şart.",
  },
  {
    title: "Orijinal SohbeX dünyası",
    body: "Metin2 / Knight Online hissi — tempo, klan ve grind fantazisi — ama isimler, topraklar ve sistemler tamamen SohbeX’e ait.",
  },
] as const;

export default function LoginGameAbout({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled) return null;

  return (
    <>
      <div className="mt-4 flex w-full justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition hover:brightness-110"
          style={{
            color: "#f0d78c",
            background: "rgba(20,14,8,0.65)",
            border: "1px solid rgba(196,146,64,0.45)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,220,150,0.08)",
          }}
        >
          Oyun hakkında
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-game-about-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0"
            style={{ background: "rgba(4,3,2,0.72)" }}
            aria-label="Kapat"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-[1] flex max-h-[min(88vh,720px)] w-full max-w-[560px] flex-col overflow-hidden rounded-md shadow-2xl"
            style={{
              background:
                "linear-gradient(165deg, #2a1c12 0%, #1a110c 42%, #120c09 100%)",
              border: "1px solid rgba(196,146,64,0.45)",
              boxShadow:
                "0 0 0 1px rgba(80,50,20,0.6), 0 24px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,220,150,0.12)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 3px)",
              }}
            />
            <div className="relative px-5 pt-5 pb-3">
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "rgba(224,178,58,0.8)" }}
              >
                SohbeX · Klan Savaşları
              </p>
              <h2
                id="login-game-about-title"
                className="font-display text-2xl tracking-wide"
                style={{ color: "#f3e2b0" }}
              >
                Oyun hakkında
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "rgba(232,220,196,0.9)" }}
              >
                Klanını seç, efsaneni yaz. Hesap zorunlu bir MMO: grind, sınıf rolü ve
                klan savaşı aynı masada. Misafir girişi yok — ilerleme hesabına bağlıdır.
              </p>
            </div>
            <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-2">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-sm px-3 py-2.5"
                  style={{
                    background: "rgba(0,0,0,0.22)",
                    border: "1px solid rgba(139,105,55,0.28)",
                  }}
                >
                  <p
                    className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(224,178,58,0.85)" }}
                  >
                    {p.title}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(232,220,196,0.88)" }}>
                    {p.body}
                  </p>
                </div>
              ))}
              <p className="text-xs leading-relaxed" style={{ color: "rgba(232,220,196,0.7)" }}>
                Soldaki ve sağdaki klan kartlarına tıklayarak her klanın lore’unu,
                ritüelini ve savaş tarzını okuyabilirsin. Karakter oluştururken klanını
                seçersin; bu seçim dünyadaki aidiyetini belirler.
              </p>
            </div>
            <div
              className="relative flex shrink-0 justify-end px-5 pb-5 pt-2"
              style={{ borderTop: "1px solid rgba(139,105,55,0.35)" }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm px-5 py-2 text-sm font-semibold tracking-wide transition hover:brightness-110"
                style={{
                  color: "#1a1200",
                  background: "linear-gradient(135deg, #e0b23a, #a67910)",
                  boxShadow: "0 8px 20px rgba(224,178,58,0.25)",
                  border: "1px solid rgba(255,220,140,0.35)",
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
