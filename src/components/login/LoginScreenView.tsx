"use client";

// ─── Login screen presentation ───────────────────────────────────────────────
// Pure presentation for the pre-game login/title screen. Knows nothing about
// Supabase, routing, or session state — the container (app/login/page.tsx) owns
// all of that and passes values + handlers down.
//
// The split exists so the admin UI Editor can render this exact component for its
// live preview (via /login?preview=1) instead of an admin-side mock that drifts.
//
// SECURITY: creator-authored strings render as React text nodes only, never as
// HTML. Authored colors go through `safeCssColor` before touching an inline
// style. Authored links go through `isSafeLinkUrl` — again, even though
// `resolveLoginScreenConfig` already filtered them, because a stored document can
// predate a guard. See docs/LOGIN_SCREEN_EDITOR_DESIGN.md §7.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GameConfig,
  MIN_PASSWORD_LENGTH,
  isSafeLinkUrl,
  resolveLoginScreenConfig,
  resolveLoginTitle,
  safeCssColor,
  type LoginScreenConfig,
} from "@ed5-mmo-studio/shared";
import { resolveLoginMedia } from "@/lib/login-config";
import { ScreenBackdropLayer, ScreenBrandBlock, screenCardStyle } from "@/components/screen-skin";
import LoginClanRails from "@/components/login/LoginClanRails";
import LoginGameAbout from "@/components/login/LoginGameAbout";

export type LoginFormMode = "login" | "signup" | "forgot";

export interface LoginScreenViewProps {
  /** Authored config, or null for the engine default. */
  config: LoginScreenConfig | null;
  /** Game-server HTTP base, used to resolve authored media. */
  mediaBase: string;
  /** Wordmark fallback when the creator authored no title. */
  gameName: string | null;

  mode: LoginFormMode;
  onModeChange: (mode: LoginFormMode) => void;

  email: string;
  onEmailChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (v: string) => void;
  rememberMe: boolean;
  onRememberMeChange: (v: boolean) => void;
  showPassword: boolean;
  onShowPasswordChange: (v: boolean) => void;

  busy: boolean;
  error: string | null;
  message: string | null;

  /** Server accepts email/password (supabase or local mode). */
  authAvailable: boolean;
  /** Server is in Supabase mode — OAuth and password recovery are real. */
  supabaseAvailable: boolean;
  /** Server actually accepts guest sessions. NOT a cosmetic toggle. */
  guestAvailable: boolean;

  onSubmit: (e: React.FormEvent) => void;
  onOAuth: (provider: "discord" | "google" | "github") => void;
  onGuest: () => void;
}

/** Password strength estimate for the signup meter. 0–4 plus a label/color. */
function estimatePasswordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  if (!pw) return { score: 0, label: "", color: "var(--hud-border-2)" };
  let score = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return {
      score: 1,
      label: `Too short (min ${MIN_PASSWORD_LENGTH})`,
      color: "var(--hud-danger)",
    };
  }
  const meta: Record<number, { label: string; color: string }> = {
    0: { label: "", color: "var(--hud-border-2)" },
    1: { label: "Weak", color: "var(--hud-danger)" },
    2: { label: "Fair", color: "var(--hud-warning)" },
    3: { label: "Good", color: "var(--hud-primary)" },
    4: { label: "Strong", color: "var(--hud-success)" },
  };
  return { score: clamped, ...meta[clamped] };
}

export default function LoginScreenView(props: LoginScreenViewProps) {
  const {
    config,
    mediaBase,
    gameName,
    mode,
    onModeChange,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    confirmPassword,
    onConfirmPasswordChange,
    rememberMe,
    onRememberMeChange,
    showPassword,
    onShowPasswordChange,
    busy,
    error,
    message,
    authAvailable,
    supabaseAvailable,
    guestAvailable,
    onSubmit,
    onOAuth,
    onGuest,
  } = props;

  const cfg = resolveLoginScreenConfig(config);
  const { backdrop, brand, card, copy, visibility, layout } = cfg;

  const isLogin = mode === "login";
  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";

  // ── Authored values, each falling back to the engine's ──
  const accent = safeCssColor(card.accentColor, "var(--hud-accent)");
  const glow = safeCssColor(brand.titleGlowColor, "rgba(245,158,11,0.35)");
  const { base: titleBase, accent: titleAccent } = resolveLoginTitle(
    brand.title,
    brand.titleAccent,
    gameName,
    GameConfig.unbranded.loginTitle,
  );
  const submitFill = card.submitColor
    ? card.submitColorTo
      ? `linear-gradient(135deg, ${safeCssColor(card.submitColor, "var(--hud-primary)")} 0%, ${safeCssColor(card.submitColorTo, "#4f46e5")} 100%)`
      : safeCssColor(card.submitColor, "var(--hud-primary)")
    : "linear-gradient(135deg, var(--hud-primary) 0%, #4f46e5 100%)";

  // SohbeX: Yamato login panel pack bound to the username/password card.
  const packSrc =
    card.background?.mediaSrc || card.frame?.mediaSrc || "";
  const yamatoLoginSkin =
    packSrc.includes("/ui/yamato/login/") ||
    packSrc.includes("/ui/fantasyrpg/login/") ||
    packSrc.includes("/ui/survival/login/") ||
    packSrc.includes("/ui/bloodline/login/");
  const packBase = packSrc.includes("/ui/bloodline/login/")
    ? "/ui/bloodline/login"
    : packSrc.includes("/ui/fantasyrpg/login/")
      ? "/ui/fantasyrpg/login"
      : packSrc.includes("/ui/survival/login/")
        ? "/ui/survival/login"
        : "/ui/yamato/login";
  const yamatoInputBg = `${packBase}/login_form.png`;
  const yamatoBtnN = `${packBase}/wide_button_n.png`;
  const yamatoBtnH = `${packBase}/wide_button_h.png`;
  const yamatoCheckN = `${packBase}/check_n.png`;
  const yamatoCheckOn = `${packBase}/check_checked.png`;
  const isFantasyRpg = packBase.includes("/ui/fantasyrpg/login");
  /** Clan portrait rails: Yamato login skin only. */
  const showYamatoClanRails = packSrc.includes("/ui/yamato/login/");

  // Cosmetic preference AND the real capability — the toggle can hide a control
  // the server supports, but must never surface one it doesn't.
  const showGuest = visibility.showGuest && guestAvailable;
  const showOAuth = visibility.showOAuthRow && supabaseAvailable && !isForgot;
  const showBigGoogle = visibility.showProminentGoogle && supabaseAvailable && !isForgot;
  const showTabs = !isForgot && visibility.showRegisterTab;

  const links = cfg.links.filter((l) => isSafeLinkUrl(l.url));

  // ── Layout geometry ──
  const isSidePanel = layout === "left-panel" || layout === "right-panel";
  const isBottomBar = layout === "bottom-bar";
  const isMinimal = layout === "minimal";
  const bareCard = isMinimal || isSidePanel;

  const stageClass = isSidePanel
    ? `relative z-10 flex min-h-full ${layout === "right-panel" ? "justify-end" : "justify-start"}`
    : isBottomBar
      ? "relative z-10 flex min-h-full flex-col items-center justify-end p-4 pb-10"
      : isFantasyRpg || yamatoLoginSkin
      ? // Top-anchored (Kayıt won't recentre). With clan rails: COLUMN so title stays on top.
        showYamatoClanRails
          ? "relative z-10 flex w-full min-h-full flex-col items-center overflow-y-auto px-2 pt-3 pb-16 sm:px-4"
          : "relative z-10 flex min-h-full items-start justify-center overflow-y-auto px-4 pb-16"
      : "relative z-10 flex min-h-full items-center justify-center p-4";

  const columnStyle: React.CSSProperties = isSidePanel
    ? {
        width: "min(460px, 100%)",
        background: "color-mix(in srgb, var(--hud-bg) 82%, transparent)",
        backdropFilter: "blur(10px)",
        [layout === "right-panel" ? "borderLeft" : "borderRight"]: "1px solid var(--hud-border-1)",
        padding: "2.5rem 2rem",
        justifyContent: "center",
      }
    : { width: "100%", maxWidth: isBottomBar ? "min(900px, 100%)" : `${card.widthPx}px` };

  const cardStyle: React.CSSProperties = bareCard
    ? {}
    : {
        ...screenCardStyle(card, mediaBase),
        // Leave room for panel frame / rim — height follows content (no stretch lock).
        ...(yamatoLoginSkin && card.background?.mediaSrc
          ? isFantasyRpg
            ? { paddingTop: 18, paddingBottom: 14, paddingLeft: 16, paddingRight: 16 }
            : {
                // No hud-panel-bg slab; height follows content (fixed minHeight caused dock clip).
                backgroundColor: "transparent",
                width: card.widthPx ? `${card.widthPx}px` : undefined,
                boxSizing: "border-box",
                // Top pad clears Yamato ornate header so GİRİŞ/KAYIT aren't sunk into the rim.
                paddingTop: 52,
                paddingBottom: 28,
                paddingLeft: 32,
                paddingRight: 32,
              }
          : {}),
      };

  const brandBlock = (
    <ScreenBrandBlock
      brand={brand}
      mediaBase={mediaBase}
      titleBase={titleBase}
      titleAccent={titleAccent}
      accent={accent}
      glow={glow}
      titleColor={isFantasyRpg ? "#f0e6ff" : undefined}
      titleClassName={
        isFantasyRpg
          ? "relative font-display text-3xl md:text-4xl tracking-[0.12em]"
          : yamatoLoginSkin
            ? "relative font-display text-4xl md:text-5xl tracking-[0.14em]"
            : "relative font-display text-5xl md:text-6xl tracking-widest"
      }
      className={
        isFantasyRpg || yamatoLoginSkin
          ? "text-center select-none shrink-0 mb-0"
          : "text-center select-none"
      }
    />
  );

  const labelColor = "var(--hud-text-secondary)";
  const inputStyle: React.CSSProperties = !yamatoLoginSkin
    ? {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--hud-border-2)",
        color: "var(--hud-text-primary)",
      }
    : isFantasyRpg
      ? {
          // Solid themed field (pack's InputField_Bg_Single is a vertical chevron
          // slice — border-image left a black content square on password inputs).
          background: "rgba(18, 14, 32, 0.92)",
          border: "1px solid #9b8bb8",
          boxShadow: "inset 0 0 0 1px rgba(212,168,75,0.15)",
          color: "#f3eefc",
          borderRadius: 2,
          height: 44,
          minHeight: 44,
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 14,
          paddingRight: 14,
          boxSizing: "border-box",
          outline: "none",
          // Kill Chrome password/autofill black slab
          WebkitTextFillColor: "#f3eefc",
          caretColor: "#f3eefc",
          filter: "none",
        }
      : {
          background: `url(${JSON.stringify(yamatoInputBg)}) center / 100% 100% no-repeat`,
          border: "1px solid transparent",
          color: "var(--hud-text-primary)",
          borderRadius: 4,
          height: 46,
          minHeight: 46,
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 14,
          paddingRight: 14,
          boxSizing: "border-box",
          outline: "none",
        };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--hud-bg)" }}>
      <ScreenBackdropLayer backdrop={backdrop} mediaBase={mediaBase} accent={accent} />

      <div className={stageClass}>
        {/* Bottom bar is the art-dominant look: the wordmark rides the top of the
            screen and the form docks low, leaving the middle to the backdrop. */}
        {isBottomBar && <div className="mb-auto pt-12">{brandBlock}</div>}
        {/* Title above; clan rails hug the login card only (yan yana). */}
        {showYamatoClanRails && !isBottomBar ? (
          <div
            className="relative z-20 mb-4 w-full shrink-0 text-center"
            style={{ paddingTop: "min(2vh, 16px)" }}
          >
            {brandBlock}
          </div>
        ) : null}
        <LoginClanRails enabled={showYamatoClanRails}>
        <div
          className={isFantasyRpg || yamatoLoginSkin ? "flex flex-col gap-3 w-full" : "flex flex-col gap-6"}
          style={{
            ...columnStyle,
            ...(!showYamatoClanRails && yamatoLoginSkin && !isFantasyRpg
              ? { marginTop: "min(4vh, 36px)" }
              : {}),
          }}
        >
          {!isBottomBar && !showYamatoClanRails && brandBlock}

          <div
            className={bareCard ? "" : yamatoLoginSkin ? "overflow-hidden" : "rounded-hud-lg overflow-hidden"}
            style={{
              ...cardStyle,
              ...(!showYamatoClanRails && yamatoLoginSkin && !isFantasyRpg
                ? { marginTop: "min(6vh, 48px)" }
                : {}),
            }}
          >
            {/* Prominent Google sign-in */}
            {showBigGoogle && (
              <div className={isFantasyRpg ? "px-4 pt-3 pb-0" : "px-6 pt-5 pb-0"}>
                <button
                  onClick={() => onOAuth("google")}
                  className="w-full flex items-center justify-center gap-3 rounded-hud py-3 text-sm font-semibold transition-all duration-200 hover:brightness-110"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid var(--hud-border-2)",
                    color: "var(--hud-text-primary)",
                  }}
                >
                  <GoogleGlyph />
                  Sign in with Google
                </button>
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-px" style={{ background: "var(--hud-border-1)" }} />
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "var(--hud-text-muted)" }}
                  >
                    or use email
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--hud-border-1)" }} />
                </div>
              </div>
            )}

            {/* Tabs */}
            {showTabs && (
              <div className="flex" style={{ borderBottom: "1px solid var(--hud-border-1)" }}>
                {(["login", "signup"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onModeChange(t)}
                    className={`relative flex-1 ${yamatoLoginSkin ? "py-3" : "py-3.5"} text-xs font-bold tracking-widest uppercase transition-all duration-200`}
                    style={{
                      color: mode === t ? accent : "var(--hud-text-muted)",
                      background: mode === t ? "rgba(245,158,11,0.06)" : "transparent",
                    }}
                  >
                    {t === "login"
                      ? (copy.signInTab ?? "Sign In")
                      : (copy.registerTab ?? "Register")}
                    {mode === t && (
                      <div
                        className="absolute bottom-0 inset-x-0 h-0.5"
                        style={{ background: accent }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Forgot header */}
            {isForgot && (
              <div className={isFantasyRpg ? "px-4 pt-3 pb-1" : "px-6 pt-5 pb-2"}>
                <button
                  onClick={() => onModeChange("login")}
                  className="flex items-center gap-1.5 text-xs uppercase tracking-widest mb-3 transition-colors"
                  style={{ color: "var(--hud-text-muted)" }}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Sign In
                </button>
                <h2 className="font-display text-lg" style={{ color: "var(--hud-text-primary)" }}>
                  Recover Account
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--hud-text-secondary)" }}>
                  We&apos;ll send a recovery link to your email.
                </p>
              </div>
            )}

            <form onSubmit={onSubmit} className={isFantasyRpg ? "px-4 py-3 space-y-3" : yamatoLoginSkin ? "px-4 py-3 space-y-3" : "px-6 py-5 space-y-4"}>
              {!authAvailable && (
                <Banner tone={yamatoLoginSkin ? "warn" : "warn"}>
                  {showGuest
                    ? yamatoLoginSkin
                      ? "Hesap girişi kapalı — aşağıdan misafir devam et."
                      : "Auth not configured — play as guest below."
                    : yamatoLoginSkin
                      ? "Hesap girişi şu an kapalı — sunucu / auth hazır olunca tekrar dene."
                      : "Sign-in is unavailable on this world right now."}
                </Banner>
              )}
              {error && <Banner tone="error">{error}</Banner>}
              {message && <Banner tone="ok">{message}</Banner>}

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  className="block text-xs font-bold tracking-widest uppercase"
                  style={{ color: labelColor }}
                >
                  {copy.emailLabel ?? "Email Address"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={copy.emailPlaceholder ?? "adventurer@realm.gg"}
                  className={
                    isFantasyRpg
                      ? "w-full text-sm outline-none transition-all duration-150"
                      : "w-full rounded-hud px-3.5 py-2.5 text-sm outline-none transition-all duration-150"
                  }
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              {!isForgot && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      className="block text-xs font-bold tracking-widest uppercase"
                      style={{ color: "var(--hud-text-secondary)" }}
                    >
                      {copy.passwordLabel ?? "Password"}
                    </label>
                    {isLogin && supabaseAvailable && (
                      <button
                        type="button"
                        onClick={() => onModeChange("forgot")}
                        className="text-xs transition-colors"
                        style={{ color: "var(--hud-text-muted)" }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      required
                      // Only enforce the raised minimum on signup — existing
                      // accounts may have shorter passwords and must still log in.
                      minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      className={
                        isFantasyRpg
                          ? "w-full pr-10 text-sm outline-none transition-all duration-150"
                          : "w-full rounded-hud px-3.5 py-2.5 pr-10 text-sm outline-none transition-all duration-150"
                      }
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => onShowPasswordChange(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--hud-text-muted)" }}
                    >
                      <EyeGlyph off={showPassword} />
                    </button>
                  </div>
                  {isSignUp && password.length > 0 && (
                    <div className="space-y-1" aria-live="polite">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => {
                          const strength = estimatePasswordStrength(password);
                          return (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-colors"
                              style={{
                                background:
                                  i < strength.score ? strength.color : "var(--hud-border-1)",
                              }}
                            />
                          );
                        })}
                      </div>
                      {(() => {
                        const strength = estimatePasswordStrength(password);
                        return strength.label ? (
                          <p className="text-xs" style={{ color: strength.color }}>
                            {strength.label}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Confirm password */}
              {isSignUp && (
                <div className="space-y-1.5">
                  <label
                    className="block text-xs font-bold tracking-widest uppercase"
                    style={{ color: "var(--hud-text-secondary)" }}
                  >
                    {yamatoLoginSkin ? "Şifre Tekrar" : "Confirm Password"}
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => onConfirmPasswordChange(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    className={
                      isFantasyRpg
                        ? "w-full text-sm outline-none transition-all duration-150"
                        : "w-full rounded-hud px-3.5 py-2.5 text-sm outline-none transition-all duration-150"
                    }
                    style={
                      isFantasyRpg
                        ? {
                            ...inputStyle,
                            ...(confirmPassword && confirmPassword !== password
                              ? { filter: "drop-shadow(0 0 3px var(--hud-danger))" }
                              : {}),
                          }
                        : {
                            ...inputStyle,
                            border: `1px solid ${
                              confirmPassword && confirmPassword !== password
                                ? "var(--hud-danger)"
                                : "var(--hud-border-2)"
                            }`,
                          }
                    }
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs" style={{ color: "var(--hud-danger)" }}>
                      Passwords do not match.
                    </p>
                  )}
                </div>
              )}

              {/* Remember me */}
              {isLogin && visibility.showRememberMe && (
                <button
                  type="button"
                  onClick={() => onRememberMeChange(!rememberMe)}
                  className="flex items-center gap-2.5 text-xs"
                  style={{ color: "var(--hud-text-secondary)" }}
                >
                  <div
                    className="relative w-5 h-5 rounded-sm flex items-center justify-center transition-all shrink-0"
                    style={
                      yamatoLoginSkin
                        ? {
                            border: "none",
                            background: `url(${JSON.stringify(yamatoCheckN)}) center / contain no-repeat`,
                          }
                        : {
                            border: "1px solid var(--hud-border-2)",
                            background: rememberMe
                              ? "var(--hud-primary)"
                              : "rgba(255,255,255,0.04)",
                          }
                    }
                  >
                    {yamatoLoginSkin && rememberMe && (
                      <span
                        aria-hidden
                        className="absolute"
                        style={{
                          width: 14,
                          height: 14,
                          background: `url(${JSON.stringify(yamatoCheckOn)}) center / contain no-repeat`,
                        }}
                      />
                    )}
                    {!yamatoLoginSkin && rememberMe && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {yamatoLoginSkin ? "Beni hatırla" : "Remember me & auto-login next time"}
                </button>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={busy || !authAvailable}
                className="relative w-full rounded-hud py-3 text-sm font-bold tracking-widest uppercase overflow-hidden group transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={
                  yamatoLoginSkin
                    ? isFantasyRpg
                      ? {
                          background: `url(${JSON.stringify(yamatoBtnN)}) center / 100% 100% no-repeat`,
                          color: "#ffffff",
                          boxShadow: "0 6px 20px rgba(37,99,235,0.35)",
                          borderRadius: 0,
                          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                          letterSpacing: "0.14em",
                          height: 52,
                          minHeight: 52,
                          paddingTop: 0,
                          paddingBottom: 0,
                        }
                      : {
                          background: `url(${JSON.stringify(yamatoBtnN)}) center / 100% 100% no-repeat`,
                          color: packBase.includes("survival") ? "#ffffff" : "#f5e6c8",
                          boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
                          borderRadius: 8,
                          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                          letterSpacing: "0.14em",
                          height: 52,
                          minHeight: 52,
                          paddingTop: 0,
                          paddingBottom: 0,
                        }
                    : {
                        background: submitFill,
                        color: "#fff",
                        boxShadow: "0 4px 24px rgba(59,130,246,0.28)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!yamatoLoginSkin || busy || !authAvailable) return;
                  e.currentTarget.style.background = `url(${JSON.stringify(yamatoBtnH)}) center / 100% 100% no-repeat`;
                }}
                onMouseLeave={(e) => {
                  if (!yamatoLoginSkin) return;
                  e.currentTarget.style.background = `url(${JSON.stringify(yamatoBtnN)}) center / 100% 100% no-repeat`;
                }}
              >
                <span className="relative z-10">
                  {busy
                    ? "Please wait"
                    : isForgot
                      ? "Send Recovery Link"
                      : isSignUp
                        ? (copy.signUpLabel ?? "Create Account")
                        : (copy.submitLabel ?? "Enter the World")}
                </span>
                {!yamatoLoginSkin && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)",
                    }}
                  />
                )}
              </button>
            </form>

            {/* OAuth row — provider labels/icons are deliberately NOT authorable. */}
            {showOAuth && (
              <div className="px-6 pb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "var(--hud-border-1)" }} />
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "var(--hud-text-muted)" }}
                  >
                    or
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--hud-border-1)" }} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOAuth("discord")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-hud py-2.5 text-xs font-semibold transition-all hover:brightness-110"
                    style={{
                      background: "rgba(88,101,242,0.14)",
                      border: "1px solid rgba(88,101,242,0.3)",
                      color: "#8ea0f8",
                    }}
                  >
                    <DiscordGlyph />
                    Discord
                  </button>
                  <button
                    onClick={() => onOAuth("google")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-hud py-2.5 text-xs font-semibold transition-all hover:brightness-110"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--hud-border-2)",
                      color: "var(--hud-text-secondary)",
                    }}
                  >
                    <GoogleGlyph />
                    Google
                  </button>
                  <button
                    onClick={() => onOAuth("github")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-hud py-2.5 text-xs font-semibold transition-all hover:brightness-110"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--hud-border-2)",
                      color: "var(--hud-text-secondary)",
                    }}
                  >
                    <GitHubGlyph />
                    GitHub
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Guest */}
          {showGuest && (
            <div className="text-center space-y-1">
              <button
                onClick={onGuest}
                className="group inline-flex items-center gap-2 text-sm transition-colors duration-200"
                style={{ color: "var(--hud-text-muted)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {copy.guestLabel ?? "Continue as Guest — No account needed"}
              </button>
              <p className="text-xs" style={{ color: "var(--hud-text-muted)", opacity: 0.5 }}>
                {copy.guestNote ?? "Guest progress is not saved between sessions"}
              </p>
            </div>
          )}

          {/* Creator links */}
          {links.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {links.map((link) => {
                const icon = resolveLoginMedia(link.icon, mediaBase);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs transition-colors hover:brightness-125"
                    style={{ color: "var(--hud-text-muted)" }}
                  >
                    {icon ? <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" /> : null}
                    {link.label}
                  </a>
                );
              })}
            </div>
          )}

          {copy.footerNote ? (
            <p
              className="text-center text-xs"
              style={{ color: "var(--hud-text-muted)", opacity: 0.6 }}
            >
              {copy.footerNote}
            </p>
          ) : null}

          {visibility.showVersion && (
            <p
              className="text-center text-xs"
              style={{ color: "var(--hud-text-muted)", opacity: 0.35 }}
            >
              {GameConfig.version}
            </p>
          )}

          <LoginGameAbout enabled={showYamatoClanRails || (yamatoLoginSkin && !isFantasyRpg)} />
        </div>
        </LoginClanRails>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "warn" | "error" | "ok"; children: React.ReactNode }) {
  const skin = {
    warn: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#fbbf24" },
    error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", color: "#fca5a5" },
    ok: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", color: "#86efac" },
  }[tone];
  return (
    <div
      className="rounded-hud px-3 py-2.5 text-xs flex gap-2"
      style={{ background: skin.bg, border: `1px solid ${skin.border}`, color: skin.color }}
    >
      {children}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function DiscordGlyph() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function EyeGlyph({ off }: { off: boolean }) {
  return off ? (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}
