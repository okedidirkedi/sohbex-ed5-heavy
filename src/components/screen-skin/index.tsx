"use client";

/**
 * The shared skin renderer for the three creator-authored full-screen screens:
 * login, character select and character create.
 *
 * All three author the SAME shapes — `ScreenBackdrop`, `ScreenBrand`,
 * `ScreenCard` are literal aliases of the login types, and `SurfaceSkin` is one
 * primitive reused by every card on either character screen. They therefore get
 * one renderer. The login screen grew this logic first; it was lifted here
 * verbatim rather than copied so the character screens cannot drift from the
 * screen creators already tune against.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { safeCssColor } from "@ed5-mmo-studio/shared";
import type {
  PanelBackground,
  PanelFrame,
  ScreenBackdrop,
  ScreenBrand,
  ScreenCard,
  SurfaceSkin,
} from "@ed5-mmo-studio/shared";
import { resolveLoginMedia } from "@/lib/login-config";

/** CSS `background-*` for a `PanelBackground`, honouring its fill mode. */
function backgroundLayer(bg: PanelBackground | undefined, url: string): CSSProperties {
  const mode = bg?.mode ?? "cover";
  return {
    backgroundImage: `url(${JSON.stringify(url)})`,
    backgroundSize: mode === "stretch" ? "100% 100%" : mode === "tile" ? "auto" : mode,
    backgroundRepeat: mode === "tile" ? "repeat" : "no-repeat",
    backgroundPosition: "center",
  };
}

/** CSS `border-image` for a 9-slice `PanelFrame`. */
function frameLayer(frame: PanelFrame | undefined, url: string): CSSProperties {
  return {
    borderImage: `url(${JSON.stringify(url)}) ${frame?.slice ?? 12} fill stretch`,
    borderWidth: `${frame?.width ?? 12}px`,
    borderStyle: "solid",
  };
}

/* ── Backdrop ─────────────────────────────────────────────────────────── */

export interface ResolvedBackdropArt {
  /** Style for the art layer (gradient or image). Empty for theme/particles. */
  artStyle: CSSProperties;
  /** True when authored art replaces the engine's own glow atmosphere. */
  usesArt: boolean;
  showParticles: boolean;
  imageUrl?: string;
  videoUrl?: string;
}

/** Pure part of the backdrop, so it can be unit-tested without a DOM. */
export function resolveBackdropArt(
  backdrop: ScreenBackdrop,
  mediaBase: string,
): ResolvedBackdropArt {
  const imageUrl = resolveLoginMedia(backdrop.image, mediaBase);
  const videoUrl = resolveLoginMedia(backdrop.video, mediaBase);

  let artStyle: CSSProperties = {};
  if (backdrop.kind === "gradient") {
    artStyle = {
      background: `linear-gradient(${backdrop.gradientAngle ?? 160}deg, ${safeCssColor(
        backdrop.gradientFrom,
        "var(--hud-surface-1)",
      )}, ${safeCssColor(backdrop.gradientTo, "var(--hud-bg)")})`,
    };
  } else if (backdrop.kind === "image" && imageUrl) {
    artStyle = backgroundLayer(backdrop.image, imageUrl);
  }
  if (backdrop.blurPx) artStyle.filter = `blur(${backdrop.blurPx}px)`;

  return {
    artStyle,
    // A video backdrop with no video counts as art anyway: falling back to the
    // engine glow would flash the wrong screen while the poster loads.
    usesArt: backdrop.kind === "image" || backdrop.kind === "video" || backdrop.kind === "gradient",
    showParticles: !!backdrop.particles || backdrop.kind === "particles",
    imageUrl,
    videoUrl,
  };
}

/** Drifting particle field — the engine's default atmosphere. */
export function ParticleBackground({ color = "rgb(180,200,255)" }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    type P = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      alpha: number;
      alphaD: number;
    };
    const particles: P[] = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      alpha: Math.random(),
      alphaD: (Math.random() - 0.5) * 0.004,
    }));
    let raf = 0;
    let last = 0;
    const interval = 1000 / 30; // throttle to 30fps
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < interval) return;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha += p.alphaD;
          if (p.alpha <= 0 || p.alpha >= 1) p.alphaD *= -1;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
        }
        ctx.globalAlpha = p.alpha * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    ctx.fillStyle = color;
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [color]);
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />;
}

/**
 * The whole backdrop stack: art (video / image / gradient), particle overlay,
 * the engine's glow atmosphere when nothing was authored, and the legibility
 * scrim. Every layer is `absolute inset-0 z-0`, so the host only has to be a
 * positioned box and put its own content above `z-0`.
 */
export function ScreenBackdropLayer({
  backdrop,
  mediaBase,
  accent,
}: {
  backdrop: ScreenBackdrop;
  mediaBase: string;
  accent: string;
}) {
  const { artStyle, usesArt, showParticles, imageUrl, videoUrl } = resolveBackdropArt(
    backdrop,
    mediaBase,
  );

  return (
    <>
      {backdrop.kind === "video" && videoUrl ? (
        <video
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          style={backdrop.blurPx ? { filter: `blur(${backdrop.blurPx}px)` } : undefined}
          src={videoUrl}
          poster={imageUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : backdrop.kind === "image" && imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          style={backdrop.blurPx ? { filter: `blur(${backdrop.blurPx}px)` } : undefined}
        />
      ) : usesArt ? (
        <div className="pointer-events-none absolute inset-0 z-0" style={artStyle} />
      ) : null}

      {showParticles && <ParticleBackground />}

      {/* Engine atmosphere — only when there's no authored art to cover. */}
      {!usesArt && (
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute -top-32 left-1/2 h-[500px] w-[1000px] -translate-x-1/2 rounded-full opacity-20"
            style={{
              background: "radial-gradient(ellipse, var(--hud-primary) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-[400px] w-[600px] rounded-full opacity-10"
            style={{ background: `radial-gradient(ellipse, ${accent} 0%, transparent 70%)` }}
          />
        </div>
      )}

      {/* Scrim — keeps text legible over authored art. */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: usesArt
            ? `rgba(0,0,0,${backdrop.overlayOpacity ?? 0.45})`
            : "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 25%, transparent 75%, rgba(0,0,0,0.7))",
        }}
      />
    </>
  );
}

/* ── Brand ────────────────────────────────────────────────────────────── */

/**
 * Logo-or-wordmark plus tagline and divider. An authored logo REPLACES the text
 * title (the alt text carries the words), which is what makes `logoWidthPx`
 * meaningful.
 */
export function ScreenBrandBlock({
  brand,
  mediaBase,
  titleBase,
  titleAccent,
  accent,
  glow,
  className = "text-center select-none",
  titleClassName = "relative font-display text-5xl md:text-6xl tracking-widest",
  titleColor,
}: {
  brand: ScreenBrand;
  mediaBase: string;
  titleBase: string;
  titleAccent?: string;
  accent: string;
  glow: string;
  className?: string;
  titleClassName?: string;
  titleColor?: string;
}) {
  const logoUrl = resolveLoginMedia(brand.logo, mediaBase);
  // Authored only. Falling back to the engine's tagline put OUR marketing line
  // ("A living, player-driven world") under someone else's game title; the
  // render below already omits the element when there is nothing to say.
  const tagline = brand.tagline ?? "";

  return (
    <div className={className}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${titleBase}${titleAccent ?? ""}`}
          className="mx-auto h-auto"
          style={{ width: `${brand.logoWidthPx ?? 320}px`, maxWidth: "100%" }}
        />
      ) : (
        <div className="relative inline-block">
          <div
            className="absolute inset-0 opacity-20"
            style={{ background: `radial-gradient(ellipse, ${accent}, transparent)` }}
          />
          <h1
            className={titleClassName}
            style={{
              color: titleColor || "var(--hud-text-primary)",
              fontFamily: brand.titleFontFamily || undefined,
              textShadow: `0 0 40px ${glow}, 0 2px 8px rgba(0,0,0,0.9)`,
            }}
          >
            {titleBase}
            {titleAccent ? <span style={{ color: accent }}>{titleAccent}</span> : null}
          </h1>
        </div>
      )}
      {tagline ? (
        <p
          className="mt-2 text-xs uppercase tracking-[0.3em]"
          style={{ color: "var(--hud-text-secondary)" }}
        >
          {tagline}
        </p>
      ) : null}
      {brand.showDivider !== false && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <div
            className="h-px max-w-[80px] flex-1"
            style={{ background: `linear-gradient(to right, transparent, ${accent})` }}
          />
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          <div
            className="h-px max-w-[80px] flex-1"
            style={{ background: `linear-gradient(to left, transparent, ${accent})` }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Card / surface skins ─────────────────────────────────────────────── */

/** Background + 9-slice frame + radius + opacity for the main card. */
export function screenCardStyle(card: ScreenCard, mediaBase: string): CSSProperties {
  const bgUrl = resolveLoginMedia(card.background, mediaBase);
  const frameUrl = resolveLoginMedia(card.frame, mediaBase);
  const bg = bgUrl
    ? {
        ...backgroundLayer(card.background, bgUrl),
        // Keep a solid fallback under the art so stretch gaps never flash empty.
        backgroundColor: "var(--hud-panel-bg)",
      }
    : { background: "var(--hud-panel-bg)" };
  return {
    ...bg,
    border: frameUrl ? undefined : "1px solid var(--hud-border-2)",
    ...(frameUrl ? frameLayer(card.frame, frameUrl) : {}),
    borderRadius: card.cornerRadiusPx != null ? `${card.cornerRadiusPx}px` : undefined,
    opacity: card.opacity,
    boxShadow: "var(--hud-panel-shadow), 0 0 60px rgba(59,130,246,0.06)",
  };
}

/**
 * One authored surface skin (UI Editor → Character Creator → Card Skins) as
 * inline style. Returns `undefined` for an unskinned surface so a caller can
 * spread it and leave the component's own look untouched — an unauthored screen
 * must render byte-identically to before.
 *
 * `--screen-surface-accent` is published so descendants can pick the accent up
 * without every one of them needing the skin threaded through.
 */
export function surfaceStyle(
  skin: SurfaceSkin | undefined,
  mediaBase: string,
): CSSProperties | undefined {
  if (!skin) return undefined;
  const bgUrl = resolveLoginMedia(skin.background, mediaBase);
  const frameUrl = resolveLoginMedia(skin.frame, mediaBase);
  const style: CSSProperties & Record<string, string | number | undefined> = {};

  if (bgUrl) Object.assign(style, backgroundLayer(skin.background, bgUrl));
  if (frameUrl) Object.assign(style, frameLayer(skin.frame, frameUrl));
  if (skin.cornerRadiusPx != null) style.borderRadius = `${skin.cornerRadiusPx}px`;
  if (skin.opacity != null) style.opacity = skin.opacity;
  if (skin.accentColor) {
    const accent = safeCssColor(skin.accentColor, "var(--hud-accent)");
    style["--screen-surface-accent"] = accent;
    // The character screens paint their filigree from `--hud-accent`, so a
    // per-surface accent has to shadow it within that subtree.
    style["--hud-accent"] = accent;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

/** Convenience: wrap children in a skinned box, or render them bare. */
export function SkinnedSurface({
  skin,
  mediaBase,
  className,
  children,
}: {
  skin: SurfaceSkin | undefined;
  mediaBase: string;
  className?: string;
  children: ReactNode;
}) {
  const style = surfaceStyle(skin, mediaBase);
  if (!style) return <>{children}</>;
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
