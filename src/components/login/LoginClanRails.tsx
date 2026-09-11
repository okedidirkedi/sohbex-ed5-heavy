"use client";

import { useEffect, useState, type ReactNode } from "react";

/** SohbeX clan portrait rails for Yamato /login — info only, no guest/login side effects. */

export type LoginClanInfo = {
  id: string;
  file: string;
  name: string;
  dir: string;
  climate: string;
  focus: string;
  blurb: string;
  motto: string;
  stronghold: string;
  playstyle: string;
  strengths: string[];
  rite: string;
  rival: string;
  lore: string;
};

const CLANS: LoginClanInfo[] = [
  {
    id: "kizil-sancak",
    file: "kizil",
    name: "Kızıl Sancak",
    dir: "Doğu",
    climate: "Kızıl ovalar · kavurucu rüzgâr",
    focus: "Hücum / baskın",
    blurb: "Sancak hiç inmez; savaş ilanı bir bakışta okunur.",
    motto: "Ateş susana dek yürürüz.",
    stronghold: "Kızıl Tepe — ova üzerinde yükselen savaş kalesi",
    playstyle: "Ön hat baskısı, hızlı kuşatma, klan savaşlarında ilk darbeyi vurma. Açık arazide hız ve moral üstünlüğü arar.",
    strengths: ["Hücum temposu", "Sancak ritüelleri", "Açık alan PvP"],
    rite: "Her sefer öncesi Kızıl Yemin: sancak toprağa değmeden dönülmez.",
    rival: "Demir Vadi ile eski sınır kan davası; Gümüş Bozkır’la keşif yollarında sürtüşme.",
    lore:
      "Kızıl Sancak, doğunun kızıl tozlu ovalarından doğdu. İlk reisler, düşman kampına girmeden önce bayrağı tepelere dikerdi — korku, kılıçtan önce yürürdü. Bugün klan, savaş alanında tempo koyan güçtür: kısa, sert baskınlar; kaleyi değil, iradeyi kırar. Savaşçıları kırmızı ve bronz taşır; zaferde sancak göğe, yenilgide toprağa gömülür — bir daha aynı hatada düşmemek için.",
  },
  {
    id: "gumus-bozkir",
    file: "gumus",
    name: "Gümüş Bozkır",
    dir: "Kuzey",
    climate: "Bozkır gecesi · ay ışığı ve buz",
    focus: "Keşif / pusu",
    blurb: "Kurt uluması pusuyu haber verir; yele rüzgârla konuşur.",
    motto: "İz bırakmadan iz sür.",
    stronghold: "Aybozkır Kampı — göçebe çadır halkası ve kurt ağılları",
    playstyle: "Harita kontrolü, pusu, keşif noktaları, hareketli vuruş. Sabit savunmadan kaçınır; bilgi ve mesafe ile kazanır.",
    strengths: ["Keşif ağı", "Gece operasyonu", "Hızlı yer değiştirme"],
    rite: "Ay Uluması: sefer öncesi kurtlarla koşu; iz süremeyen savaşmaz.",
    rival: "Mavi Liman kervanlarını keser; Kızıl Sancak’ın gürültülü yürüyüşünü küçümser.",
    lore:
      "Gümüş Bozkır kuzeyin sonsuz otlaklarında yaşar. Burada şehir değil, iz vardır: ay altında koşan kurtlar, gümüş yeleli süvariler, sessiz kamplar. Klan, düşmanı görmeden önce haritayı bilir. Casusları limanlara kadar iner; okçuları sisin içinden konuşur. Onlara göre zafer gürültüde değil, doğru anda doğru yerde olmaktadır — bozkır bunu öğretir.",
  },
  {
    id: "mavi-liman",
    file: "mavi",
    name: "Mavi Liman",
    dir: "Batı",
    climate: "Sahil sisleri · tuz ve fırtına",
    focus: "Ticaret / ittifak",
    blurb: "Rıhtım hiç uyumaz; gümüş ve sır aynı sandıkta taşınır.",
    motto: "Dalga döner, söz dönmez.",
    stronghold: "Mavi Rıhtım — liman kulesi, antrepolar ve gemi tersanesi",
    playstyle: "Ekonomi, konvoy, deniz/nehir yolları, diplomasi. Savaşı altın ve lojistikle şekillendirir; gerektiğinde denizden vurur.",
    strengths: ["Ticaret ağı", "Lojistik", "İttifak kurma"],
    rite: "Tuz Yemini: limana giren her kervan tuz ve söz bırakır; bozan limandan sürülür.",
    rival: "Gümüş Bozkır pusuları kervanları keser; Demir Vadi fiyat ve silah pazarlığında serttir.",
    lore:
      "Mavi Liman batı kıyısının nabzıdır. Sisli sabahlarda gemi direkleri orman gibi yükselir; liman beyleri hem tüccar hem amiraldir. Klan savaşını yalnızca kılıçla değil, erzak, istihbarat ve borç ile yönetir. Bir ittifak limanda imzalanırsa, o gece rüzgâr bile taraf tutar. Rakipler onları ‘yumuşak’ sanır — ta ki liman zinciri kapanıp açık denizden yardım gelene dek.",
  },
  {
    id: "demir-vadi",
    file: "demir",
    name: "Demir Vadi",
    dir: "Güney",
    climate: "Maden geçitleri · kıvılcım ve duman",
    focus: "Savunma / kuşatma",
    blurb: "Örs susmaz; kale duvarı demirle nefes alır.",
    motto: "Duvar yıkılmadan teslim yok.",
    stronghold: "Demir Kapı — vadi ağzındaki demir kapılı kale ve dökümhaneler",
    playstyle: "Dayanıklı savunma, kuşatma kırıcı, zırh ve istihkâm. Geçit savaşlarında üstün; sabırlı, ağır temposu vardır.",
    strengths: ["İstihkâm", "Ağır zırh", "Kuşatma direnci"],
    rite: "Örs Gecesi: savaş öncesi bütün silahlar aynı ateşte yeniden dövülür; çatlak çelik uğursuz sayılır.",
    rival: "Kızıl Sancak’ın acele hücumunu küçümser; Mavi Liman’ın altını ‘yumuşak güç’ diye alaya alır.",
    lore:
      "Demir Vadi güneyin dar boğazlarında kuruldu. Maden dumanı gökyüzünü boyar; çekiç sesi dağlara yankılanır. Klan, toprağı değil geçidi savunur: bir kapı düşerse bütün vadi düşer. Bu yüzden duvarlar kalın, antlaşmalar kısa, yeminler demirdendir. Ustaları zırhı sanat, savaşı zanaat sayar. Düşman kapıya dayandığında Demir Vadi acele etmez — örs soğumadan zafer gelmez.",
  },
];

const LEFT_CLANS = CLANS.slice(0, 2);
const RIGHT_CLANS = CLANS.slice(2, 4);

function stillSrc(file: string): string {
  return `/clan/media/${file}-still.png`;
}

function hoverSrc(file: string): string {
  return `/clan/media/gifs/${file}-hover.gif`;
}

function ClanPortraitCard({
  clan,
  live,
  onLive,
  onOpen,
}: {
  clan: LoginClanInfo;
  live: boolean;
  onLive: (on: boolean) => void;
  onOpen: () => void;
}) {
  const [gifArmed, setGifArmed] = useState(false);

  useEffect(() => {
    if (live) setGifArmed(true);
  }, [live]);

  return (
    <button
      type="button"
      className="login-clan-card group relative flex w-[200px] shrink-0 flex-col overflow-hidden rounded-md text-left outline-none transition-[box-shadow,border-color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[#e0b23a]/70"
      style={{
        aspectRatio: "3 / 4",
        border: live
          ? "1px solid rgba(224,178,58,0.65)"
          : "1px solid rgba(139,105,55,0.45)",
        boxShadow: live
          ? "0 0 0 1px rgba(224,178,58,0.35), 0 12px 28px rgba(0,0,0,0.55), 0 0 22px rgba(224,178,58,0.22)"
          : "0 8px 20px rgba(0,0,0,0.4)",
        background: "#0a0c10",
      }}
      aria-label={`${clan.name} — klan bilgisi`}
      onMouseEnter={() => onLive(true)}
      onMouseLeave={() => onLive(false)}
      onFocus={() => onLive(true)}
      onBlur={() => onLive(false)}
      onClick={onOpen}
    >
      <span className="absolute inset-0 overflow-hidden bg-[#07090e]">
        <img
          src={stillSrc(clan.file)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-200"
          style={{ opacity: live ? 0 : 1 }}
        />
        {gifArmed ? (
          <img
            src={hoverSrc(clan.file)}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-200"
            style={{ opacity: live ? 1 : 0 }}
          />
        ) : null}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,6,4,0.05) 35%, rgba(8,6,4,0.55) 72%, rgba(8,6,4,0.92) 100%)",
          }}
        />
      </span>
      <span className="relative z-[1] mt-auto w-full px-2 pb-2 pt-8">
        <span
          className="block text-center font-display text-[13px] font-semibold leading-tight tracking-wide"
          style={{
            color: "#f0d78c",
            textShadow: "0 1px 2px rgba(0,0,0,0.85)",
          }}
        >
          {clan.name}
        </span>
        <span
          className="mt-0.5 block text-center text-[10px] uppercase tracking-[0.14em]"
          style={{ color: "rgba(224,178,58,0.75)" }}
        >
          {clan.dir}
        </span>
      </span>
    </button>
  );
}

function ClanInfoPanel({
  clan,
  onClose,
}: {
  clan: LoginClanInfo;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-clan-info-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0"
        style={{ background: "rgba(4,3,2,0.72)" }}
        aria-label="Kapat"
        onClick={onClose}
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
        <div className="relative flex gap-4 p-5">
          <div
            className="relative h-[168px] w-[126px] shrink-0 overflow-hidden rounded-sm"
            style={{
              border: "1px solid rgba(224,178,58,0.4)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
              background: "#0a0c10",
            }}
          >
            <img
              src={stillSrc(clan.file)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
            <img
              src={hoverSrc(clan.file)}
              alt={clan.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "rgba(224,178,58,0.8)" }}
            >
              SohbeX Klanı
            </p>
            <h2
              id="login-clan-info-title"
              className="font-display text-2xl leading-tight tracking-wide"
              style={{ color: "#f3e2b0" }}
            >
              {clan.name}
            </h2>
            <p
              className="mt-2 font-display text-sm italic leading-snug"
              style={{ color: "rgba(224,178,58,0.9)" }}
            >
              “{clan.motto}”
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0" style={{ color: "rgba(224,178,58,0.7)" }}>
                  Yön
                </dt>
                <dd style={{ color: "#e8dcc4" }}>{clan.dir}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0" style={{ color: "rgba(224,178,58,0.7)" }}>
                  İklim
                </dt>
                <dd style={{ color: "#e8dcc4" }}>{clan.climate}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0" style={{ color: "rgba(224,178,58,0.7)" }}>
                  Odak
                </dt>
                <dd style={{ color: "#e8dcc4" }}>{clan.focus}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0" style={{ color: "rgba(224,178,58,0.7)" }}>
                  Merkez
                </dt>
                <dd style={{ color: "#e8dcc4" }}>{clan.stronghold}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-2">
          <p className="text-sm leading-relaxed" style={{ color: "rgba(232,220,196,0.92)" }}>
            {clan.lore}
          </p>
          <div>
            <p
              className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "rgba(224,178,58,0.75)" }}
            >
              Oyun tarzı
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(232,220,196,0.88)" }}>
              {clan.playstyle}
            </p>
          </div>
          <div>
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "rgba(224,178,58,0.75)" }}
            >
              Güçler
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {clan.strengths.map((s) => (
                <li
                  key={s}
                  className="rounded-sm px-2 py-0.5 text-xs"
                  style={{
                    color: "#f0d78c",
                    background: "rgba(224,178,58,0.12)",
                    border: "1px solid rgba(224,178,58,0.28)",
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "rgba(224,178,58,0.75)" }}
              >
                Ritüel
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(232,220,196,0.85)" }}>
                {clan.rite}
              </p>
            </div>
            <div>
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "rgba(224,178,58,0.75)" }}
              >
                Rekabet
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(232,220,196,0.85)" }}>
                {clan.rival}
              </p>
            </div>
          </div>
        </div>
        <div
          className="relative flex shrink-0 justify-end px-5 pb-5 pt-2"
          style={{ borderTop: "1px solid rgba(139,105,55,0.35)" }}
        >
          <button
            type="button"
            onClick={onClose}
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
  );
}

function ClanRailColumn({
  clans,
  label,
  liveId,
  setLiveId,
  onOpen,
}: {
  clans: LoginClanInfo[];
  label: string;
  liveId: string | null;
  setLiveId: (id: string | null) => void;
  onOpen: (clan: LoginClanInfo) => void;
}) {
  return (
    <aside
      className="hidden min-[1000px]:flex w-[200px] shrink-0 flex-col items-stretch justify-center gap-2 self-stretch"
      aria-label={label}
    >
      {clans.map((clan) => (
        <ClanPortraitCard
          key={clan.id}
          clan={clan}
          live={liveId === clan.id}
          onLive={(on) => setLiveId(on ? clan.id : null)}
          onOpen={() => onOpen(clan)}
        />
      ))}
    </aside>
  );
}

/**
 * When `enabled`, lays out left/right clan portrait rails around the login column.
 * When disabled, passes children through unchanged (non-Yamato skins).
 */
export default function LoginClanRails({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [openClan, setOpenClan] = useState<LoginClanInfo | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!openClan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenClan(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openClan]);

  if (!enabled) return <>{children}</>;

  return (
    <>
      <div className="flex w-full max-w-[1600px] items-center justify-center gap-1 min-[1000px]:gap-1.5">
        <ClanRailColumn
          clans={LEFT_CLANS}
          label="Klanlar — sol"
          liveId={liveId}
          setLiveId={setLiveId}
          onOpen={setOpenClan}
        />
        <div className="flex min-w-0 max-w-full shrink-0 justify-center">
          {children}
        </div>
        <ClanRailColumn
          clans={RIGHT_CLANS}
          label="Klanlar — sağ"
          liveId={liveId}
          setLiveId={setLiveId}
          onOpen={setOpenClan}
        />
      </div>
      {openClan ? (
        <ClanInfoPanel clan={openClan} onClose={() => setOpenClan(null)} />
      ) : null}
    </>
  );
}
