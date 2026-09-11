"use client";

// ─── Login container ─────────────────────────────────────────────────────────
// Owns auth config, session check, submit/OAuth handlers and routing. All
// presentation lives in <LoginScreenView>, which is driven by the creator's
// authored `UICustomization.login` (fetched pre-auth from /public-config).
//
// See docs/LOGIN_SCREEN_EDITOR_DESIGN.md.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, loadAuthConfig } from "@/lib/supabase";
import { ensureProjectRuntime, resolveBrowserGameServerHttpUrl } from "@/lib/project-runtime";
import { GameConfig, MIN_PASSWORD_LENGTH, type LoginScreenConfig } from "@ed5-mmo-studio/shared";
import LoginScreenView, { type LoginFormMode } from "@/components/login/LoginScreenView";
import {
  applyProjectDocumentTitle,
  applyProjectTheme,
  fetchPublicProjectConfig,
  toHttpBase,
} from "@/lib/login-config";

const REMEMBER_KEY = `${GameConfig.localStoragePrefix}:remember-email`;

/** Offline / no-public-config floor: Yamato V3 art from client public/. */
const SOHBEX_YAMATO_LOGIN: LoginScreenConfig = {
  enabled: true,
  layout: "centered",
  backdrop: {
    kind: "image",
    image: { mediaSrc: "/ui/yamato/login-background.png", mode: "cover" },
    particles: false,
    overlayOpacity: 0.18,
    blurPx: 0,
  },
  brand: {
    // Yamato pack logo removed (said "YAMATO VERSION 3"); title = Klan Savaşları.
    title: "Klan Savaşları",
    tagline: "",
    showDivider: false,
    titleGlowColor: "rgba(212, 168, 75, 0.45)",
  },
  card: {
    // Yamato panel art only (frame baked in). Sized to the outer transparent box.
    background: { mediaSrc: "/ui/yamato/login/panel.png", mode: "stretch" },
    opacity: 1,
    cornerRadiusPx: 0,
    widthPx: 480,
    accentColor: "#c9a227",
    submitColor: "#8b6914",
    submitColorTo: "#5c450c",
  },
  copy: {
    signInTab: "Giriş",
    registerTab: "Kayıt",
    submitLabel: "Giriş Yap",
    signUpLabel: "Hesap Oluştur",
    emailLabel: "E-posta",
    passwordLabel: "Şifre",
  },
  visibility: { showGuest: false, showRememberMe: true, showRegisterTab: true, showVersion: false },
  applyToCharacterSelect: true,
};

const AUTO_LOGIN_KEY = `${GameConfig.localStoragePrefix}:auto-login`;
const LOCAL_AUTH_TOKEN_KEY = `${GameConfig.localStoragePrefix}:local-auth-token`;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  // The admin UI Editor iframes this route to preview an unsaved config, pushed
  // in over postMessage. Preview mode never authenticates or navigates.
  const isPreview = searchParams.get("preview") === "1";

  const [mode, setMode] = useState<LoginFormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [autoChecking, setAutoChecking] = useState(!isPreview);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError === "auth_callback_failed" ? "Authentication failed — please try again." : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [serverAuthMode, setServerAuthMode] = useState<"supabase" | "local" | "guest-only" | null>(
    null,
  );
  const [allowGuests, setAllowGuests] = useState(false);
  const [authConfigReady, setAuthConfigReady] = useState(false);

  // Creator branding, fetched pre-auth. Null until it lands (or forever, if the
  // project authored none / the server is unreachable) → engine default.
  const [loginConfig, setLoginConfig] = useState<LoginScreenConfig | null>(SOHBEX_YAMATO_LOGIN);
  const [gameName, setGameName] = useState<string | null>(null);
  const [mediaBase, setMediaBase] = useState("");

  // Re-evaluate after loadAuthConfig() resolves so createClient() returns a real client.
  const supabase = authConfigReady ? createClient() : null;
  const supabaseAvailable = serverAuthMode === "supabase" && supabase !== null;
  // Auth is available if Supabase is configured OR server reports "local" mode
  const authAvailable = supabaseAvailable || serverAuthMode === "local";

  // Desktop playtest handoff: the Studio launches `/login#playtest=<token>`
  // with a freshly minted local-auth JWT for the project's Playtester account.
  // Store it in the exact slot a normal local sign-in uses, scrub the fragment
  // from the URL/history, and jump straight into the world — no login form, no
  // character-select click-through (the server resumes the account's first
  // character, or creates one on first entry). The fragment never reaches any
  // server; the ref stops the auto-login effect racing us toward /cc.
  const playtestHandoffRef = useRef(false);
  useEffect(() => {
    if (isPreview || typeof window === "undefined") return;
    // Desktop-only handoff: the Studio always loads the client at localhost.
    // On any public deployment of this same bundle, an attacker-crafted
    // https://…/login#playtest=<their token> link would otherwise silently
    // seed the victim's auth slot with an attacker-controlled session.
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") return;
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash) return;
    const token = new URLSearchParams(rawHash).get("playtest");
    if (!token) return;
    try {
      localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTO_LOGIN_KEY, "true");
    } catch {
      return; // storage unavailable — fall back to the normal login flow
    }
    playtestHandoffRef.current = true;
    // Never leave the token in the URL (window history, devtools, copy/paste).
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    router.replace("/play");
  }, [isPreview, router]);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }

    // Absolute ceiling: never leave the user on "Connecting" if studio runtime
    // or auth/config hangs (game-server often down in local polish).
    const bootFailsafe = window.setTimeout(() => {
      setAuthConfigReady(true);
      setAutoChecking(false);
    }, 2500);

    // Fetch full auth config from the game server (mode + Supabase URL/anon).
    // This replaces the legacy build-time NEXT_PUBLIC_SUPABASE_* env vars so
    // the engine buyer can configure auth from the admin UI without rebuilding.
    ensureProjectRuntime()
      .catch(() => null)
      .then((runtime) => {
        // F1: a bare client URL with no project/launch context resolves no
        // runtime. Rather than fall through to the dead ws://localhost:3001
        // fallback (which breaks the character creator), send the visitor to the
        // "pick a world" landing. Guarded to real hosts with no configured
        // default server, so local dev and self-hosted single-server deploys
        // keep their existing behaviour. Launch-token / public-play flows resolve
        // a non-null runtime and are unaffected.
        if (
          !isPreview &&
          !runtime &&
          typeof window !== "undefined" &&
          !/^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(window.location.hostname) &&
          !process.env.NEXT_PUBLIC_GAME_SERVER_WS_URL
        ) {
          router.replace("/games");
          return;
        }

        // Branding rides its own fetch, in parallel with the auth config, and is
        // hard time-boxed inside fetchPublicProjectConfig: a cold or dead game
        // server must degrade to the engine default, never hang the login form.
        void resolveBrowserGameServerHttpUrl()
          .then((httpUrl) => {
            const base = toHttpBase(httpUrl);
            setMediaBase(base);
            return fetchPublicProjectConfig(base);
          })
          .then((cfg) => {
            if (!cfg) {
              setLoginConfig(SOHBEX_YAMATO_LOGIN);
              return;
            }
            // The login page has always styled everything through var(--hud-*);
            // it just never received the project's values. This is the wire.
            applyProjectTheme(cfg.theme);
            applyProjectDocumentTitle(cfg.gameName);
            // SohbeX guest polish: always pin Yamato art to Next public paths.
            // Public-config / DB mediaSrc often points at game-server /api/assets
            // which 404s offline and leaves only the particle starfield.
            // SohbeX: public-config English defaults must NEVER paint. Pin Yamato only.
            void cfg.login;
            setLoginConfig(SOHBEX_YAMATO_LOGIN);
            setGameName("Klan Savaşları");
          })
          .catch(() => {
            setLoginConfig(SOHBEX_YAMATO_LOGIN);
          });

        if (isPreview) {
          setAuthConfigReady(true);
          return;
        }

        const failsafe = window.setTimeout(() => {
          // Offline / hung game-server: show the form (guest) instead of Connecting forever.
          setAuthConfigReady(true);
        }, 3500);
        loadAuthConfig()
          .then((cfg) => {
            setServerAuthMode(cfg.mode);
            // SohbeX MMO: hesap zorunlu — misafir yok.
            setAllowGuests(false);
            setAuthConfigReady(true);
          })
          .catch(() => {
            setServerAuthMode(null);
            setAuthConfigReady(true);
          })
          .finally(() => {
            window.clearTimeout(failsafe);
            window.clearTimeout(bootFailsafe);
          });
      });
    return () => {
      window.clearTimeout(bootFailsafe);
    };
  }, [isPreview, router]);

  // Live preview: the admin UI Editor pushes its unsaved working copy in.
  const previewRef = useRef(isPreview);
  previewRef.current = isPreview;
  useEffect(() => {
    if (!isPreview) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; login?: LoginScreenConfig | null } | null;
      if (!data || data.type !== "ed5:login-preview") return;
      setLoginConfig(data.login ?? null);
    };
    window.addEventListener("message", onMessage);
    // Tell the opener we're ready for a first push.
    window.parent?.postMessage({ type: "ed5:login-preview-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [isPreview]);

  // Once auth config is ready, check for an existing session for auto-login.
  useEffect(() => {
    if (!authConfigReady || isPreview) return;
    // A playtest handoff is already navigating to /play — don't race it to /cc.
    if (playtestHandoffRef.current) return;
    const autoLogin = localStorage.getItem(AUTO_LOGIN_KEY);
    if (supabase) {
      const sessionTimer = window.setTimeout(() => setAutoChecking(false), 2000);
      supabase.auth
        .getSession()
        .then((res: { data: { session: unknown | null } }) => {
          if (res.data.session && autoLogin === "true") router.replace("/clan-select.html");
          else setAutoChecking(false);
        })
        .catch(() => setAutoChecking(false))
        .finally(() => window.clearTimeout(sessionTimer));
    } else {
      const localToken = localStorage.getItem(LOCAL_AUTH_TOKEN_KEY);
      if (localToken && autoLogin === "true") {
        router.replace("/clan-select.html");
        return;
      }
      setAutoChecking(false);
    }
  }, [authConfigReady, supabase, router, isPreview]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPreview) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    // ── Local auth mode: register/login via game server HTTP ──
    if (!supabaseAvailable && serverAuthMode === "local") {
      try {
        const httpUrl = await resolveBrowserGameServerHttpUrl();
        if (mode === "forgot") {
          setError("Password recovery is not available in local auth mode.");
          return;
        }

        const endpoint = mode === "signup" ? "/auth/register" : "/auth/login";
        if (mode === "signup") {
          if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
          }
          if (password !== confirmPassword) {
            throw new Error("Passwords do not match.");
          }
        }

        const resp = await fetch(`${httpUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName: email.split("@")[0] }),
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error ?? "Auth failed");

        // Store the JWT so the play page can use it
        localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, data.token);

        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, email);
          localStorage.setItem(AUTO_LOGIN_KEY, "true");
        } else {
          localStorage.removeItem(REMEMBER_KEY);
          localStorage.removeItem(AUTO_LOGIN_KEY);
        }

        if (mode === "signup") {
          setMessage("Account created! Signing you in...");
        }
        router.push("/clan-select.html");
      } catch (err: any) {
        setError(err.message ?? "Authentication failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Supabase auth mode ──
    if (!supabase) {
      setError("Auth not configured.");
      setLoading(false);
      return;
    }
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/login`,
        });
        if (error) throw error;
        setMessage("Recovery link sent! Check your email.");
        return;
      }
      if (mode === "signup") {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              origin_site: window.location.hostname.toLowerCase(),
            },
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email);
        localStorage.setItem(AUTO_LOGIN_KEY, "true");
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(AUTO_LOGIN_KEY);
      }
      router.push("/clan-select.html");
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "discord" | "google" | "github") {
    if (isPreview) return;
    if (!supabase) {
      setError("Auth not configured.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/clan-select.html` },
    });
    if (error) setError(error.message);
  }

  function switchMode(next: LoginFormMode) {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  if (autoChecking) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--hud-bg)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--hud-accent) transparent transparent transparent" }}
            />
            <div
              className="absolute inset-2 rounded-full border border-t-transparent animate-spin"
              style={{
                borderColor: "var(--hud-primary) transparent transparent transparent",
                animationDirection: "reverse",
                animationDuration: "0.7s",
              }}
            />
          </div>
          <p
            className="text-xs tracking-widest uppercase animate-pulse"
            style={{ color: "var(--hud-text-secondary)" }}
          >
            Connecting
          </p>
        </div>
      </div>
    );
  }

  return (
    <LoginScreenView
      config={loginConfig}
      mediaBase={mediaBase}
      gameName={gameName}
      mode={mode}
      onModeChange={switchMode}
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      confirmPassword={confirmPassword}
      onConfirmPasswordChange={setConfirmPassword}
      rememberMe={rememberMe}
      onRememberMeChange={setRememberMe}
      showPassword={showPassword}
      onShowPasswordChange={setShowPassword}
      busy={loading}
      error={error}
      message={message}
      authAvailable={isPreview ? true : authAvailable}
      supabaseAvailable={isPreview ? true : supabaseAvailable}
      guestAvailable={false}
      onSubmit={handleSubmit}
      onOAuth={handleOAuth}
      onGuest={() => {/* misafir kapalı — MMO hesap zorunlu */}}
    />
  );
}
