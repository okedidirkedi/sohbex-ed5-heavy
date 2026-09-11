"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, loadAuthConfig } from "@/lib/supabase";
import {
  ensureGuestStorageScope,
  getGuestToken,
  clearGuestToken,
  readGuestCharacters,
  setGuestToken,
  writeGuestCharacters,
  type GuestCharacterRecord,
} from "@/lib/guest-storage";
import { readSelectedClan, type SohbexSelectedClan } from "@/lib/sohbex-clan";
import { ensureProjectRuntime, resolveBrowserGameServerHttpUrl } from "@/lib/project-runtime";
import {
  applyProjectDocumentTitle,
  applyProjectTheme,
  fetchPublicProjectConfig,
  resolveLoginMedia,
  toHttpBase,
} from "@/lib/login-config";
import {
  GameConfig,
  defaultFacingDirection,
  resolveDirectionalRow,
  cellForFrame,
  cellsFrameCount,
  resolveCharacterCreatorConfig,
  safeCssColor,
} from "@ed5-mmo-studio/shared";
import type {
  AvatarAnimationConfig,
  AvatarConfig,
  CharacterAppearance,
  CharacterCreatorConfig,
} from "@ed5-mmo-studio/shared";
import CharacterSelectShell from "./CharacterSelectShell";
import SettingsPanel from "@/components/hud/SettingsPanel";
import { BUILTIN_PACK_ID, buildDefaultGeneratorOptions } from "./default-generator-pack";
import { PackLayeredAvatarPreview, buildPackPreviewAvatarConfig } from "./pack-preview";
import { SheetFrameCanvas, useDetectedSheetGrid } from "./sheet-frame-canvas";
import { ccGridStyle, effectiveCcLayout } from "./creator-layout";
import { useIsPhoneViewport } from "@/game/use-phone-viewport";
import { ScreenBackdropLayer, screenCardStyle, surfaceStyle } from "@/components/screen-skin";
import {
  TEX_W,
  TEX_H,
  WALK_FRAME_MS,
  WALK_PHASES,
  WALK_SEQUENCE,
  drawProceduralAvatarFrame,
  proceduralAvatarSignature,
  type Facing4,
} from "@/game/procedural-avatar-draw";

/** SohbeX production pin: Yamato landscape; Create = Yamato (CharSelect-matched); Select slots = Yamato. */
const SOHBEX_YAMATO_CC_BACKDROP = {
  kind: "image" as const,
  image: { mediaSrc: "/ui/yamato/charselect-background.png", mode: "cover" as const },
  particles: true,
  overlayOpacity: 0.48,
  blurPx: 0,
};

const SOHBEX_YAMATO_CC_LOGO = undefined;

/** CharSelect cards — Yamato (kept). */
const SOHBEX_YAMATO_SURFACE = {
  background: { mediaSrc: "/ui/yamato/charselect/panel.png", mode: "stretch" as const },
  frame: { mediaSrc: "/ui/yamato/charselect/frame.png", slice: 12, width: 10 },
  accentColor: "#c9a227",
  opacity: 0.94,
  cornerRadiusPx: 4,
};

/** Create outer shell — Yamato (CharSelect-matched) wood/bronze window. */
const SOHBEX_CREATE_SHELL = {
  background: { mediaSrc: "/ui/yamato/charselect/panel.png", mode: "stretch" as const },
  frame: { mediaSrc: "/ui/yamato/charselect/frame.png", slice: 24, width: 22 },
  accentColor: "#c9a227",
  opacity: 0.98,
  cornerRadiusPx: 4,
};

/** Create columns — Yamato panel fill, no extra frame (single outer shell). */
const SOHBEX_CREATE_COLUMN = {
  background: { mediaSrc: "/ui/yamato/charselect/panel.png", mode: "stretch" as const },
  accentColor: "#c9a227",
  opacity: 0.94,
  cornerRadiusPx: 4,
};

/** Preview: Yamato frame around the character stage. */
const SOHBEX_CREATE_PREVIEW = {
  background: { mediaSrc: "/ui/yamato/charselect/panel.png", mode: "stretch" as const },
  frame: { mediaSrc: "/ui/yamato/charselect/frame.png", slice: 12, width: 10 },
  accentColor: "#c9a227",
  opacity: 1,
  cornerRadiusPx: 4,
};

/** Readable text tokens on Yamato create panels. */
const CREATE_TEXT = {
  ["--hud-text-primary" as string]: "#f5e6d3",
  ["--hud-text-secondary" as string]: "#e8d5a8",
  ["--hud-text-muted" as string]: "#c4b080",
  ["--hud-border-1" as string]: "rgba(201, 162, 39, 0.45)",
} as const;

/** SohbeX create: four fixed classes (clan already chosen on /clan-select). */
const SOHBEX_CREATE_CLASSES: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: "savasci", name: "Savaşçı", aliases: ["warrior", "fighter", "savasci", "savaşçı"] },
  { id: "buyucu", name: "Büyücü", aliases: ["mage", "wizard", "sorcerer", "buyucu", "büyücü"] },
  { id: "okcu", name: "Okçu", aliases: ["archer", "ranger", "okcu", "okçu"] },
  { id: "sifaci", name: "Şifacı", aliases: ["healer", "priest", "cleric", "sifaci", "şifacı"] },
];

function resolveSohbexClassId(
  preferred: { id: string; name: string; aliases: string[] },
  serverClasses: ClassOption[],
): string {
  const keys = new Set(
    [preferred.id, preferred.name, ...preferred.aliases].map((v) => v.toLowerCase()),
  );
  const hit = serverClasses.find((c) => {
    const id = c.id.toLowerCase();
    const name = c.name.toLowerCase();
    return keys.has(id) || keys.has(name);
  });
  return hit?.id ?? preferred.id;
}

const SOHBEX_YAMATO_CC_PIN = {
  card: {
    accentColor: "#c9a227",
    submitColor: "#2e7d32",
    submitColorTo: "#1b5e20",
    opacity: 1,
    cornerRadiusPx: 4,
  },
  surfaces: {
    // Select root stays quiet; Create modal uses CREATE_SHELL inline (not stage).
    stage: {
      accentColor: "#c9a227",
      opacity: 1,
      cornerRadiusPx: 0,
    },
    slot: { ...SOHBEX_YAMATO_SURFACE },
    slotEmpty: { ...SOHBEX_YAMATO_SURFACE, opacity: 0.85 },
    detail: { ...SOHBEX_YAMATO_SURFACE, opacity: 0.96 },
    rail: { ...SOHBEX_CREATE_COLUMN, opacity: 0.92 },
    choiceCard: { ...SOHBEX_CREATE_COLUMN },
    preview: { ...SOHBEX_CREATE_PREVIEW },
    summary: { ...SOHBEX_CREATE_COLUMN },
  },
  select: {
    inheritSkin: true as const,
    copy: {
      heading: "Karakter Seç",
      emptyHeading: "Henüz karakter yok",
      emptyBody: "Yeni bir efsane yarat — klanın seni bekliyor.",
      newCharacterLabel: "Yeni Karakter",
      enterWorldLabel: "Dünyaya Gir",
      deleteLabel: "Sil",
      deleteConfirmLabel: "Silmeyi Onayla",
      backLabel: "Geri",
      locationLabel: "Konum",
      currencyLabel: "Para",
      playTimeLabel: "Oyun süresi",
      lastPlayedLabel: "Son giriş",
    },
  },
  copy: {
    title: "Kahramanını Yarat",
    tagline: "Yolunu seç · Efsaneni yaz",
    railFooter: "Klan Savaşları",
    confirmLabel: "Oluştur",
    confirmBusyLabel: "Oluşturuluyor…",
    backLabel: "İptal",
    randomizeLabel: "Rastgele",
    namePlaceholder: "Adını yaz",
    readyLabel: "Görünüm hazır",
    incompleteLabel: "Eksik seçim var",
    noClassError: "Bir sınıf seç",
    noPresetError: "Bir karakter seç",
  },
};



/*  Types  */
interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  zone: string;
  lastOnline: string | null;
  silver: number;
  gold?: number;
  templateId?: string | null;
  classId?: string | null;
  className?: string | null;
  playtimeSeconds?: number;
  spriteSrc?: string | null;
  avatarConfig?: AvatarConfig | null;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  classId: string | null;
  iconSpriteId?: string | null;
  stats?: Record<string, number>;
  starterItems?: Array<{ definitionId: string; quantity: number }>;
  starterAbilities?: string[];
  startingCurrency?: { gold: number; silver: number };
  avatar?: Record<string, unknown>;
}

interface ClassOption {
  id: string;
  name: string;
  description: string;
  iconSpriteId?: string | null;
  statAdditive?: Record<string, number>;
  statMultiplicative?: Record<string, number>;
  starterItems?: Array<{ definitionId: string; quantity: number }>;
  starterAbilities?: string[];
}

interface CharacterGeneratorCreateOptions {
  enabled: boolean;
  reason?: string;
  error?: string;
  /** "pvgames-universal" when the pack's piece sheets are runtime-composable. */
  sheetLayout?: string | null;
  /** Always-on hidden layers (e.g. the importer's shadow piece). */
  fixedLayers?: Array<{ partId: string; categoryId: string; sheetUrl: string; zHint: number }>;
  pack?: { id: string; label: string };
  bodyModel?: { id: string; label: string };
  bodyModels?: Array<{
    id: string;
    label: string;
    tags?: string[];
    supportedTargets?: string[];
  }>;
  species?: Array<{ id: string; label: string; defaultBodyModelId?: string | null }>;
  categories?: Array<{
    id: string;
    label: string;
    optional?: boolean;
    colorRegions?: string[];
    parts: Array<{
      id: string;
      label: string;
      previewIcon?: string | null;
      colorRegions?: string[];
      /** Full piece sheet + z-order for the composited live preview (W3-60). */
      sheetUrl?: string | null;
      zHint?: number | null;
    }>;
  }>;
  palettes?: Array<{
    id: string;
    label: string;
    swatches: Array<{ id: string; value: string }>;
  }>;
  appearance?: CharacterAppearance;
}

type CharacterGeneratorCategory = NonNullable<
  CharacterGeneratorCreateOptions["categories"]
>[number];

async function fetchCharacterGeneratorCreateOptions(
  httpUrl: string,
  params: { speciesId?: string | null; bodyModelId?: string | null } = {},
): Promise<CharacterGeneratorCreateOptions | null> {
  const url = new URL(`${httpUrl}/api/character-generator/options`);
  if (params.speciesId) url.searchParams.set("speciesId", params.speciesId);
  if (params.bodyModelId) url.searchParams.set("bodyModelId", params.bodyModelId);
  const res = await fetch(url.toString()).catch(() => null);
  if (res?.ok) {
    const options = (await res.json()) as CharacterGeneratorCreateOptions;
    if (options.enabled) return options;
  }
  // No project pack (or the game-server is unreachable): fall back to the
  // built-in procedural "South Park" default pack so the creator always shows a
  // live preview and a character is always creatable. The server skips
  // appearance validation when no pack is active, so the submission is accepted.
  return buildDefaultGeneratorOptions(params) as unknown as CharacterGeneratorCreateOptions;
}

// Friendly labels for raw stat keys.
const STAT_LABELS: Record<string, string> = {
  str: "Strength",
  strength: "Strength",
  dex: "Dexterity",
  dexterity: "Dexterity",
  int: "Intellect",
  intellect: "Intellect",
  intelligence: "Intellect",
  vit: "Vitality",
  vitality: "Vitality",
  con: "Constitution",
  constitution: "Constitution",
  wis: "Wisdom",
  wisdom: "Wisdom",
  cha: "Charisma",
  charisma: "Charisma",
  hp: "Health",
  health: "Health",
  mp: "Mana",
  mana: "Mana",
  atk: "Attack",
  def: "Defense",
  spd: "Speed",
  speed: "Speed",
};

function prettyStatName(key: string): string {
  return (
    STAT_LABELS[key.toLowerCase()] ??
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function buildCharacterCreateAppearance(input: {
  originId: string;
  values: Record<string, string | number>;
}): CharacterAppearance {
  const selections: Record<string, string> = {};
  const colors: Record<string, string> = {};

  for (const [key, value] of Object.entries(input.values)) {
    const normalized = String(value);
    if (normalized.startsWith("#") || key.toLowerCase().includes("color")) {
      colors[key] = normalized;
    } else {
      selections[key] = normalized;
    }
  }

  return {
    version: 1,
    packId: "project-active",
    speciesId: input.originId,
    bodyModelId: input.originId,
    selections,
    colors,
    metadata: {
      source: "client-character-creator",
    },
  };
}

function prettyId(id: string): string {
  return id
    .replace(/^(def_|res_|item_|abil_|ability_|skill_)/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Combine template base stats with the class's additive + multiplicative
 * modifiers, mirroring the server-side stat formula.
 */
function computeCombinedStats(
  tpl: TemplateOption | null | undefined,
  cls: ClassOption | null | undefined,
): Record<string, number> {
  const base: Record<string, number> = { ...(tpl?.stats ?? {}) };
  const add = cls?.statAdditive ?? {};
  const mul = cls?.statMultiplicative ?? {};
  for (const k of Object.keys(add)) base[k] = (base[k] ?? 0) + (add[k] ?? 0);
  for (const k of Object.keys(mul)) base[k] = (base[k] ?? 0) * (mul[k] ?? 1);
  return base;
}

function hasAvatarConfig(value: unknown): value is AvatarConfig {
  if (!value || typeof value !== "object") return false;
  const cfg = value as Partial<AvatarConfig>;
  return !!(
    cfg.spriteSrc ||
    cfg.spriteAssetId ||
    (Array.isArray(cfg.animations) && cfg.animations.some((a) => a.spriteSrc || a.spriteAssetId))
  );
}

function resolvePreviewSpriteSrc(spriteSrc?: string, spriteAssetId?: string): string | null {
  if (spriteSrc) {
    if (
      spriteSrc.startsWith("data:") ||
      spriteSrc.startsWith("/") ||
      /^https?:\/\//i.test(spriteSrc)
    ) {
      return spriteSrc;
    }
  }
  if (spriteAssetId) return `/api/media/${encodeURIComponent(spriteAssetId)}`;
  return spriteSrc ?? null;
}

function resolveGeneratorPreviewIconSrc(packId: string | undefined, previewIcon?: string | null) {
  if (!previewIcon) return null;
  if (
    previewIcon.startsWith("data:") ||
    previewIcon.startsWith("/") ||
    /^https?:\/\//i.test(previewIcon)
  ) {
    return previewIcon;
  }
  if (!packId) return null;
  return `/api/assets/character-generator/packs/${encodeURIComponent(
    packId,
  )}/source/mz/${previewIcon
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

const CC_FRONT_FACING = 4;
const ROTATE_FACINGS_4 = [4, 6, 0, 2];
const ROTATE_FACINGS_8 = [4, 5, 6, 7, 0, 1, 2, 3];

function getPreviewFacing(
  anim: AvatarAnimationConfig,
  view: "front" | "rotate",
  step: number,
): number {
  if (view !== "rotate") return CC_FRONT_FACING;
  if (anim.directions === 4)
    return ROTATE_FACINGS_4[step % ROTATE_FACINGS_4.length] ?? CC_FRONT_FACING;
  if (anim.directions !== undefined && anim.directions >= 8) {
    return ROTATE_FACINGS_8[step % ROTATE_FACINGS_8.length] ?? CC_FRONT_FACING;
  }
  return CC_FRONT_FACING;
}

function getPreviewDirectionRow(anim: AvatarAnimationConfig, facing: number): number {
  const rows = anim.directionRows;
  if (Array.isArray(rows) && Number.isFinite(rows[facing])) return rows[facing]!;
  // Shared facing tables (defaultFacingDirection) rather than a local copy — a
  // forked table drifts from the renderer and the avatar editor's Direction
  // Mapping preview. Sheets that declare no direction count stay pinned to row 0
  // here, which is this preview's own convention, not the renderer's 5-dir default.
  if (anim.directions === 4 || (anim.directions !== undefined && anim.directions >= 8)) {
    return defaultFacingDirection(anim.directions, facing).row;
  }
  return 0;
}

function getPreviewVisualFrameCount(anim: AvatarAnimationConfig, sheetCols: number): number {
  if (Array.isArray(anim.cells) && anim.cells.length > 0)
    // Direction-partitioned cells play frameCount frames per facing; legacy
    // flat strips play every cell.
    return cellsFrameCount(anim.cells, anim.directions, anim.frameCount, anim.cellsPartitioned);
  return Math.max(1, anim.frameCount || sheetCols || 1);
}

function getPreviewFrameIndex(
  anim: AvatarAnimationConfig,
  rawFrame: number,
  visualFrameCount: number,
): number {
  const frameCount = Math.max(1, visualFrameCount);
  const mode = anim.playbackMode;
  if (mode === "static") return 0;
  if (mode === "ping-pong" || mode === "ping-pong-once") {
    const cycle = Math.max(1, frameCount * 2 - 2);
    const pos = mode === "ping-pong" ? rawFrame % cycle : Math.min(rawFrame, cycle);
    return pos < frameCount ? pos : cycle - pos;
  }
  if (anim.looping === false || mode === "once") return Math.min(rawFrame, frameCount - 1);
  return rawFrame % frameCount;
}

function resolvePreviewAnimation(
  avatarConfig: AvatarConfig,
  pose: "idle" | "walk" | "run",
): AvatarAnimationConfig | null {
  const animations = avatarConfig.animations ?? [];
  const exact = animations.find((a) => a.name?.toLowerCase() === pose);
  if (exact) return exact;
  if (pose === "run") {
    const walk = animations.find((a) => a.name?.toLowerCase() === "walk");
    if (walk) return walk;
  }
  return animations.find((a) => a.name?.toLowerCase() === "idle") ?? animations[0] ?? null;
}

function CharacterCreatorSpritePreview({
  avatarConfig,
  fallbackUrl,
  pose,
  view,
  alt,
}: {
  avatarConfig: AvatarConfig | null;
  fallbackUrl: string | null;
  pose: "idle" | "walk" | "run";
  view: "front" | "rotate";
  alt: string;
}) {
  const anim = avatarConfig ? resolvePreviewAnimation(avatarConfig, pose) : null;
  const cols = Math.max(1, anim?.sheetCols || avatarConfig?.sheetCols || 1);
  const rows = Math.max(1, anim?.sheetRows || avatarConfig?.sheetRows || 1);
  const frameLimit = anim ? getPreviewVisualFrameCount(anim, cols) : 1;
  const [frame, setFrame] = useState(0);
  const [rotateStep, setRotateStep] = useState(0);
  const src =
    resolvePreviewSpriteSrc(anim?.spriteSrc, anim?.spriteAssetId) ??
    resolvePreviewSpriteSrc(avatarConfig?.spriteSrc, avatarConfig?.spriteAssetId) ??
    fallbackUrl;

  useEffect(() => {
    setFrame(0);
    if (!anim || frameLimit <= 1 || anim.playbackMode === "static") return;
    const duration = Math.max(60, anim.frameDurationMs || 160);
    const id = window.setInterval(() => setFrame((f) => f + 1), duration);
    return () => window.clearInterval(id);
  }, [
    anim?.name,
    anim?.spriteSrc,
    anim?.spriteAssetId,
    anim?.frameDurationMs,
    anim?.playbackMode,
    frameLimit,
  ]);

  const sheetGrid = useDetectedSheetGrid(src, !avatarConfig || !anim);

  useEffect(() => {
    setRotateStep(0);
    if (!anim || view !== "rotate") return;
    const directions = anim.directions ?? 1;
    if (directions < 4) return;
    const id = window.setInterval(() => setRotateStep((step) => step + 1), 450);
    return () => window.clearInterval(id);
  }, [anim?.name, anim?.spriteSrc, anim?.spriteAssetId, anim?.directions, view]);

  if (!src) return null;

  if (!avatarConfig || !anim) {
    // A character with no avatar config still has a SHEET, and drawing the
    // sheet whole is how a walk cycle for eight characters ends up as the
    // portrait — twelve columns of tiny people where one face should be.
    // The RPG Maker layout is detectable from the filename sigil and the pixel
    // size, so crop to the first character facing front rather than show the
    // contact sheet. Undetectable sheets still fall through to the raw image:
    // guessing a grid for art that has none would crop it to a corner.
    if (sheetGrid) {
      // Scaled the same way the configured preview is, so an RPG Maker sprite
      // fills the slot instead of sitting 48px tall in the middle of it.
      const fit = Math.min(6, 340 / sheetGrid.frameHeight, 300 / sheetGrid.frameWidth);
      return (
        <SheetFrameCanvas
          src={src}
          cols={sheetGrid.cols}
          rows={sheetGrid.rows}
          col={sheetGrid.col}
          row={sheetGrid.row}
          width={Math.round(sheetGrid.frameWidth * fit)}
          height={Math.round(sheetGrid.frameHeight * fit)}
          alt={alt}
          testId="character-sprite-preview"
        />
      );
    }
    return (
      <img
        key={`${src}-${pose}-${view}`}
        data-testid="character-sprite-preview"
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain"
        style={{
          imageRendering: "pixelated",
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  const frameW = Math.max(1, avatarConfig.frameWidth || 32);
  const frameH = Math.max(1, avatarConfig.frameHeight || 48);
  const scale = Math.min(6, 340 / frameH, 300 / frameW);
  const displayW = Math.round(frameW * scale);
  const displayH = Math.round(frameH * scale);
  const playbackFrame = getPreviewFrameIndex(anim, frame, frameLimit);
  const facing = getPreviewFacing(anim, view, rotateStep);
  const directionRow = getPreviewDirectionRow(anim, facing);
  let col = (anim.startCol ?? 0) + playbackFrame;
  // Shared resolver: stance names like "1h-idle" stay 8-directional (must offset by
  // facing); only true "*-down"/"*-up-left" names pin to their row (W3-62).
  let row = resolveDirectionalRow({
    name: anim.name,
    colIndex: anim.colIndex,
    directionRow,
  });

  if (Array.isArray(anim.cells) && anim.cells.length > 0) {
    const cell = cellForFrame(
      anim.cells,
      anim.directions,
      anim.frameCount,
      anim.cellsPartitioned,
      directionRow,
      playbackFrame,
    );
    row = cell?.[0] ?? row;
    col = cell?.[1] ?? col;
  } else if (anim.startFrame !== undefined) {
    const directionOffset = anim.directions && anim.directions > 1 ? directionRow * frameLimit : 0;
    const linear = anim.startFrame + directionOffset + playbackFrame;
    col = linear % cols;
    row = Math.floor(linear / cols);
  }

  col = Math.max(0, Math.min(cols - 1, col));
  row = Math.max(0, Math.min(rows - 1, row));

  // Draw the single frame through the shared downscaling loader instead of a
  // CSS background — which decoded + rasterized the whole (potentially
  // 10000²-class) sheet for the preview (W3-71).
  return (
    <div className="shrink-0">
      <SheetFrameCanvas
        src={src}
        cols={cols}
        rows={rows}
        col={col}
        row={row}
        width={displayW}
        height={displayH}
        alt={alt}
        testId="character-sprite-preview"
        // Same recolor the world will render, so the creator preview isn't a lie.
        recolor={avatarConfig.recolor}
      />
    </div>
  );
}

function selectedGeneratorPartLabels(
  appearance: CharacterAppearance,
  categories: CharacterGeneratorCategory[],
): string[] {
  return categories
    .map((category) => {
      const partId = appearance.selections[category.id];
      if (!partId) return null;
      const part = category.parts.find((candidate) => candidate.id === partId);
      return part?.label ?? prettyId(partId);
    })
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
}

function CharacterGeneratorLivePreview({
  appearance,
  options,
  pose,
  view,
  bare = false,
}: {
  appearance: CharacterAppearance;
  options: CharacterGeneratorCreateOptions;
  pose: "idle" | "walk" | "run";
  view: "front" | "rotate";
  /**
   * Portrait mode: no caption badge, no species/build card, and a canvas sized
   * to its container. For the summary bust, where the plinth's chrome is both
   * redundant and far too big to fit.
   */
  bare?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState(0);

  // Real pack pieces (RPG Tools imports): composite the SELECTED sheets into
  // the same layered avatar the game renders (W3-60). Falls back to the
  // procedural draw when the pack isn't runtime-composable (e.g. builtin pack).
  const packAvatarConfig = useMemo(
    () => buildPackPreviewAvatarConfig(options, appearance),
    [options, appearance],
  );

  useEffect(() => {
    if (packAvatarConfig) return; // pack preview keeps its own clock
    const duration = pose === "run" ? 90 : pose === "walk" ? WALK_FRAME_MS : 420;
    const id = window.setInterval(() => setFrame((current) => current + 1), duration);
    return () => window.clearInterval(id);
  }, [pose, packAvatarConfig]);

  const rotateStep = view === "rotate" ? Math.floor(frame / 3) % 4 : 0;
  const direction = (["down", "right", "up", "left"] as Facing4[])[rotateStep] ?? "down";
  // Same walk cycle the in-game ProceduralAvatarRenderer plays.
  const walkFrame = pose === "idle" ? 0 : WALK_SEQUENCE[frame % WALK_SEQUENCE.length];
  const phase = WALK_PHASES[walkFrame] ?? 0;
  const bob =
    pose === "idle" ? Math.sin(frame / 2) * 1.5 : phase === 0 ? (pose === "run" ? 4 : 2) : 0;

  // Rasterize the SAME frame the in-game Pixi renderer bakes into its
  // billboard textures (shared draw routine — W3-63, no preview fork).
  const appearanceSignature = proceduralAvatarSignature(appearance);
  useEffect(() => {
    if (packAvatarConfig) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 4;
    canvas.width = TEX_W * scale;
    canvas.height = TEX_H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.scale(scale, scale);
    drawProceduralAvatarFrame(ctx, appearance, direction, phase);
    ctx.restore();
    // The signature captures everything the draw reads from `appearance`.
  }, [appearanceSignature, direction, phase, packAvatarConfig]);

  // SohbeX: hide engine debug chrome (Live Generator / species·body labels).
  // Preview canvas stays; HUMAN/ADULT etc. are internal generator IDs, not player copy.
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-end overflow-hidden"
      data-testid="generator-live-preview"
      role="img"
      aria-label="Karakter önizleme"
    >
      {packAvatarConfig ? (
        <PackLayeredAvatarPreview avatarConfig={packAvatarConfig} pose={pose} view={view} />
      ) : (
        <canvas
          ref={canvasRef}
          className={`relative z-10 w-auto ${bare ? "h-full" : "h-[350px]"}`}
          style={{
            filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.62))",
            transform: `translateY(${-18 - bob}px)`,
            transition: "transform 120ms ease-out",
          }}
        />
      )}
    </div>
  );
}

const MAX_CHARACTERS = 5;
const LOCAL_AUTH_TOKEN_KEY = `${GameConfig.localStoragePrefix}:local-auth-token`;

// Guest identity (token + local character registry) is stored per GAME via
// @/lib/guest-storage — this client is shared across games, and unscoped keys
// used to leak game A's guest characters into game B's character select.

/*  Main CC Page  */
export default function CcPage() {
  return (
    <Suspense>
      <CcPageInner />
    </Suspense>
  );
}

function CcPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // M4a: every path out of this screen lands on /play — prefetch it while the
  // player is still picking a hero so the route's JS is warm before "enter
  // world" instead of downloading after the click.
  useEffect(() => {
    router.prefetch("/play");
  }, [router]);

  const urlGuest = searchParams.get("guest") === "true";
  // SohbeX: no guest — MMO requires account login.
  useEffect(() => {
    if (urlGuest) router.replace("/login");
  }, [urlGuest, router]);
  // A guest session lives ENTIRELY in `?guest=true`, so any navigation that loses the
  // query string (a reload, a bookmark, an Electron deep-link, an in-game "Character
  // Select") used to strand the player on an empty list: no auth token means the
  // server list can't be fetched, and without the flag the local guest registry is
  // never read either. When there's no token but this browser does hold guest
  // characters, treat the session as a guest one instead of showing "no heroes".
  const [guestFallback, setGuestFallback] = useState(false);
  // SohbeX: guest sessions forbidden — never treat as guest even if storage has leftovers.
  const isGuest = false;

  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sprite preview map keyed by template id, populated on mount so the
  // character slots and detail portrait can show real art instead of the
  // letter fallback.
  const [templateSpriteMap, setTemplateSpriteMap] = useState<Record<string, string>>({});
  const [templateAvatarMap, setTemplateAvatarMap] = useState<Record<string, AvatarConfig>>({});
  const [classNameMap, setClassNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const httpUrl = await resolveBrowserGameServerHttpUrl();
        const res = await fetch(`${httpUrl}/api/character-classes`);
        if (!res.ok) return;
        const data = await res.json();
        const classes: any[] = data.classes ?? [];
        const map: Record<string, string> = {};
        for (const c of classes) if (c?.id && c?.name) map[c.id] = c.name;
        if (!cancelled) setClassNameMap(map);
      } catch (err) {
        console.warn("[CC] Failed to load classes:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const httpUrl = await resolveBrowserGameServerHttpUrl();
        const res = await fetch(`${httpUrl}/api/character-templates`);
        if (!res.ok) return;
        const data = await res.json();
        const tpls: any[] = data.templates ?? [];
        const map: Record<string, string> = {};
        const avatarMap: Record<string, AvatarConfig> = {};
        for (const t of tpls) {
          const avatar = t.avatar ?? {};
          if (t.id && hasAvatarConfig(avatar)) avatarMap[t.id] = avatar;
          const animations: AvatarAnimationConfig[] | undefined = avatar.animations;
          const idle =
            animations?.find((a) => a?.name?.toLowerCase() === "idle") ?? animations?.[0];
          const src =
            resolvePreviewSpriteSrc(idle?.spriteSrc, idle?.spriteAssetId) ??
            resolvePreviewSpriteSrc(avatar?.spriteSrc, avatar?.spriteAssetId);
          if (src && t.id) map[t.id] = src;
        }
        if (!cancelled) {
          setTemplateSpriteMap(map);
          setTemplateAvatarMap(avatarMap);
        }
      } catch (err) {
        console.warn("[CC] Failed to load template sprites:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Character creation modal state
  const [showCreate, setShowCreate] = useState(false);
  // True when the character list couldn't be loaded (no auth token / fetch error),
  // as opposed to a successful load that returned zero characters. We must not
  // auto-open the creator on a FAILED load — that dumped logged-in players who
  // arrived from in-game (before their token/session resolved) into the creation
  // flow instead of their character select.
  const loadFailedRef = useRef(false);
  const [createName, setCreateName] = useState("");
  const [createTemplates, setCreateTemplates] = useState<TemplateOption[]>([]);
  const [createClasses, setCreateClasses] = useState<ClassOption[]>([]);
  const [defaultAvatarConfig, setDefaultAvatarConfig] = useState<AvatarConfig | null>(null);
  const [createGeneratorOptions, setCreateGeneratorOptions] =
    useState<CharacterGeneratorCreateOptions | null>(null);
  const [createGeneratorReloading, setCreateGeneratorReloading] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState<string | null>(null);
  const [createClassId, setCreateClassId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createSubmittingRef = useRef(false);

  // Customization steps state — Appearance/Face/Hair/Colors live as sub-tabs
  // under a single "Customize" rail entry so the rail stays compact.
  type CreateStep = "class" | "preset" | "customize";
  type CustomizeTab = "appearance" | "face" | "hair" | "gear" | "colors";
  const [createStep, setCreateStep] = useState<CreateStep>("class");
  const [customizeTab, setCustomizeTab] = useState<CustomizeTab>("appearance");
  const [createOriginId, setCreateOriginId] = useState<string>("human");
  // Pose name maps to the avatar config animation row (idle/walk/run).
  const [createPose, setCreatePose] = useState<"idle" | "walk" | "run">("idle");
  const [createView, setCreateView] = useState<"front" | "rotate">("front");
  const [generatorPartSearchByCategory, setGeneratorPartSearchByCategory] = useState<
    Record<string, string>
  >({});
  // Appearance / face / hair / colors will be wired in later iterations.
  const [createAppearance, setCreateAppearance] = useState<Record<string, string | number>>({});

  const [authConfigReady, setAuthConfigReady] = useState(false);
  useEffect(() => {
    ensureProjectRuntime()
      .catch(() => null)
      .finally(() => loadAuthConfig().finally(() => setAuthConfigReady(true)));
  }, []);

  // Character select and create style through var(--hud-*) but, unlike /login, never
  // received the project's values. Only a client-side nav FROM /login inherited them,
  // because Next keeps the same document — a bookmark, an Electron deep-link,
  // /cc?guest=true, or the /play/[playSlug] redirect all painted the engine default
  // no matter what the creator picked. This is the missing wire, and it covers both
  // screens at once since CharacterSelectShell shares this document.
  //
  // Best-effort and time-boxed inside fetchPublicProjectConfig: a cold or dead game
  // server must degrade to the engine default, never stall character selection.
  const [ccConfig, setCcConfig] = useState<CharacterCreatorConfig | null>(null);
  const [ccMediaBase, setCcMediaBase] = useState("");
  // The project's own name, for the wordmark on character select. Null until it
  // arrives (or forever, for an unnamed project) — never the engine's name.
  const [ccGameName, setCcGameName] = useState<string | null>(null);

  const [selectedClan, setSelectedClan] = useState<SohbexSelectedClan | null>(null);
  useEffect(() => {
    setSelectedClan(readSelectedClan());
    try {
      if (sessionStorage.getItem("sohbex.resumeCreate") === "1") {
        sessionStorage.removeItem("sohbex.resumeCreate");
        setShowCreate(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void resolveBrowserGameServerHttpUrl()
      .then((httpUrl) => {
        const base = toHttpBase(httpUrl);
        if (!cancelled) setCcMediaBase(base);
        return fetchPublicProjectConfig(base);
      })
      .then((cfg) => {
        if (cancelled || !cfg) return;
        applyProjectTheme(cfg.theme);
        applyProjectDocumentTitle(cfg.gameName);
        setCcGameName(cfg.gameName);
        setCcConfig(cfg.characterCreator);
      })
      .catch(() => {
        /* engine default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Engine default ⊕ authored. Resolving here (not at each use site) means an
  // absent config and an authored one take the same code path.
  // SohbeX guest polish: always pin Yamato art to Next public paths (same spirit
  // as login's SOHBEX_YAMATO_LOGIN merge). Public-config / DB often returns
  // kind:"theme" or /api/assets paths that 404 offline — which left create on
  // the dim rgba(0,0,0,0.82) scrim.
  const cc = useMemo(() => {
    const resolved = resolveCharacterCreatorConfig(ccConfig);
    return {
      ...resolved,
      layout: "wizard-rail" as const,
      railWidthPx: 170,
      contentWidthPx: 220,
      summaryWidthPx: 300,
      summaryPortrait: false,
      backdrop: SOHBEX_YAMATO_CC_BACKDROP,
      card: { ...resolved.card, ...SOHBEX_YAMATO_CC_PIN.card },
      surfaces: { ...resolved.surfaces, ...SOHBEX_YAMATO_CC_PIN.surfaces },
      select: {
        ...resolved.select,
        ...SOHBEX_YAMATO_CC_PIN.select,
        copy: {
          ...resolved.select?.copy,
          ...SOHBEX_YAMATO_CC_PIN.select.copy,
        },
      },
      copy: {
        ...resolved.copy,
        ...SOHBEX_YAMATO_CC_PIN.copy,
      },
      brand: {
        ...resolved.brand,
        logo: undefined,
        title: "Klan Savaşları",
        tagline: "Klanını seç · Efsaneni yaz",
        showDivider: false,
        titleGlowColor: "rgba(201, 162, 39, 0.45)",
      },
    };
  }, [ccConfig]);

  // The creator's authored Layout (UI Editor → Character Creator → Screen) is
  // realized here, as a grid-area map. Phone widths resolve to `compact`
  // whatever was authored — the authored column widths are desktop pixels and
  // do not fit; see `effectiveCcLayout`.
  const isPhone = useIsPhoneViewport();
  const ccGrid = useMemo(() => {
    const base = ccGridStyle(effectiveCcLayout(cc.layout, isPhone), {
      railWidthPx: cc.railWidthPx,
      contentWidthPx: cc.contentWidthPx,
      summaryWidthPx: cc.summaryWidthPx,
    });
    // SohbeX: drop the Özelleştir step rail — content | preview | summary only.
    const DIVIDER = "1px solid color-mix(in srgb, var(--hud-accent) 22%, transparent)";
    if (base.stacked) {
      return {
        ...base,
        grid: {
          ...base.grid,
          gridTemplateAreas: '"preview" "summary"',
        },
        region: {
          ...base.region,
          rail: { display: "none" },
          content: { display: "none" },
          preview: { gridArea: "preview", borderBottom: DIVIDER, minHeight: "42vh" },
          summary: { gridArea: "summary" },
        },
      };
    }
    const summaryW = cc.summaryWidthPx ?? 300;
    // SohbeX: Özelleştir/content column hidden — preview | summary only.
    return {
      ...base,
      grid: {
        ...base.grid,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        justifyContent: "center",
        paddingInline: "36px",
        paddingBottom: "20px",
        paddingTop: "6px",
        columnGap: "16px",
        gridTemplateColumns: `minmax(360px, 520px) ${summaryW}px`,
        gridTemplateAreas: '"preview summary"',
      },
      region: {
        ...base.region,
        rail: { display: "none" },
        content: { display: "none" },
        preview: {
          gridArea: "preview",
          borderRight: DIVIDER,
          minWidth: 0,
          maxWidth: 520,
        },
        summary: {
          gridArea: "summary",
          minWidth: 0,
          maxWidth: summaryW,
          overflow: "hidden",
        },
      },
    };
  }, [cc.layout, cc.railWidthPx, cc.contentWidthPx, cc.summaryWidthPx, isPhone]);

  // Authored skins (UI Editor → Character Creator → Brand & Copy / Card Skins).
  // `surfaces.stage` is the fine-grained skin and layers OVER the coarse `card`
  // control, so setting either alone works and setting both is not a conflict.
  const ccSurface = useCallback(
    (id: string) => surfaceStyle(cc.surfaces?.[id], ccMediaBase),
    [cc.surfaces, ccMediaBase],
  );
  const ccAccent = safeCssColor(cc.card?.accentColor, "var(--hud-accent)");
  // Only a deliberately authored backdrop replaces the dim scrim: the create
  // flow floats over the select screen, and painting the engine's default
  // "theme" glows here would hide that screen for no reason.
  const ccHasBackdrop = !!cc.backdrop && cc.backdrop.kind !== "theme";
  const ccLogoUrl = resolveLoginMedia(cc.brand?.logo, ccMediaBase);
  // createClient() reads runtime config from globalThis populated by loadAuthConfig().
  // Until that resolves it returns null; the dependency on authConfigReady triggers a
  // re-render so getAuthToken sees the real client.
  const supabase = authConfigReady ? createClient() : null;

  const getAuthToken = useCallback(async (): Promise<string> => {
    const session = await supabase?.auth.getSession();
    const supabaseToken = session?.data?.session?.access_token;
    if (supabaseToken) return supabaseToken;

    try {
      return localStorage.getItem(LOCAL_AUTH_TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  }, [supabase]);

  /*  Load characters (guest = localStorage, logged-in = server)  */
  useEffect(() => {
    let cancelled = false;
    if (isGuest) {
      void (async () => {
        // The registry is scoped per game — resolve which game this page serves
        // BEFORE reading, or a fresh tab could read another game's characters.
        await ensureGuestStorageScope();
        if (cancelled) return;
        const list = readGuestCharacters();
        // Paint from the local registry first so the slots appear instantly, then fold
        // in the server's numbers below. The registry only ever stored identity (name,
        // template, class) — level/silver/playtime are server-owned, which is why every
        // guest slot read "Level 1 / 0 silver / 0 playtime" until the merge lands.
        const mapped = list.map((c) => ({
          id: c.id,
          name: c.name,
          level: 1,
          zone: c.className ?? c.templateName ?? "starter",
          lastOnline: c.lastPlayed ?? c.createdAt,
          silver: 0,
          gold: 0,
          templateId: (c as any).templateId ?? null,
          classId: (c as any).classId ?? null,
          className: (c as any).className ?? null,
          playtimeSeconds: (c as any).playtimeSeconds ?? 0,
          spriteSrc: null,
        }));
        setCharacters(mapped);
        setSelectedId((prev) => prev ?? mapped[0]?.id ?? null);
        setLoading(false);
        if (mapped.length > 0) {
          try {
            const httpUrl = await resolveBrowserGameServerHttpUrl();
            const res = await fetch(`${httpUrl}/api/characters/list-guest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ characterIds: mapped.map((c) => c.id) }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const byId = new Map<string, any>(
              (data.characters ?? []).map((c: any) => [c.characterId, c]),
            );
            if (cancelled || byId.size === 0) return;
            // Merge, never replace: a character the server hasn't got a row for (an
            // offline server, a wiped world) keeps its local entry instead of vanishing.
            setCharacters((prev) =>
              prev.map((c) => {
                const row = byId.get(c.id);
                if (!row) return c;
                return {
                  ...c,
                  name: row.name ?? c.name,
                  level: row.level ?? c.level,
                  zone: row.zoneId ?? c.zone,
                  silver: row.silver ?? c.silver,
                  gold: row.gold ?? c.gold,
                  playtimeSeconds: row.playtimeSeconds ?? c.playtimeSeconds,
                  templateId: row.templateId ?? c.templateId,
                  classId: row.classId ?? c.classId,
                };
              }),
            );
          } catch (err) {
            console.warn("[CC] Failed to load guest character stats:", err);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    loadFailedRef.current = false;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          // No account token. If this browser holds guest characters, this is a guest
          // session that lost its `?guest=true` — switch to the guest list rather than
          // reporting an empty account.
          //
          // Gated on authConfigReady: before it flips there is no Supabase client yet,
          // so a logged-in player briefly looks token-less. Falling back then would
          // show them a stale guest roster from an earlier session on this browser.
          await ensureGuestStorageScope();
          if (authConfigReady && readGuestCharacters().length > 0) {
            if (!cancelled) setGuestFallback(true);
            return;
          }
          loadFailedRef.current = true;
          setLoading(false);
          return;
        }
        const httpUrl = await resolveBrowserGameServerHttpUrl();
        const res = await fetch(`${httpUrl}/api/characters?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error("Failed to load characters");
        const data = await res.json();
        if (!cancelled) {
          const mapped = (data.characters ?? []).map((c: any) => ({
            id: c.characterId,
            name: c.name,
            level: c.level ?? 1,
            zone: c.zoneId ?? "starter",
            lastOnline: c.createdAt ?? null,
            silver: c.silver ?? 0,
            gold: c.gold ?? 0,
            templateId: c.templateId ?? null,
            classId: c.classId ?? null,
            className: null as string | null,
            playtimeSeconds: c.playtimeSeconds ?? 0,
            spriteSrc: null,
          }));
          setCharacters(mapped);
          setSelectedId((prev) => prev ?? mapped[0]?.id ?? null);
        }
      } catch (err) {
        console.warn("[CC] Failed to load characters:", err);
        loadFailedRef.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthToken, isGuest, authConfigReady]);

  // Auto-select the first character once they load so the detail panel
  // (right scroll in CharacterSelectShell) is populated by default.
  useEffect(() => {
    if (!selectedId && characters.length > 0) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  /*  Actions  */
  const handleEnterWorld = useCallback(
    (idOverride?: string) => {
      const characterId = idOverride ?? selectedId;
      if (!characterId) return;
      setEntering(true);
      if (isGuest) {
        // The guestToken IS the characterId — server resumes via loadCharacter(guestToken).
        try {
          setGuestToken(characterId);
          // Stamp lastPlayed.
          const list = readGuestCharacters();
          const idx = list.findIndex((c) => c.id === characterId);
          if (idx >= 0) {
            list[idx] = { ...list[idx], lastPlayed: new Date().toISOString() };
            writeGuestCharacters(list);
          }
        } catch {
          /* ignore */
        }
        router.push(`/play?guest=true&character=${encodeURIComponent(characterId)}`);
      } else {
        router.push(`/play?character=${encodeURIComponent(characterId)}`);
      }
    },
    [selectedId, isGuest, router],
  );

  const handleCreateCharacter = useCallback(() => {
    // Open create modal and lazy-load templates/classes (same UX for guests + logged-in).
    setCreateError(null);
    setCreateSubmitting(false);
    createSubmittingRef.current = false;
    setCreateName("");
    setCreateTemplateId(null);
    setCreateClassId(null);
    // Open on "Select Character" — the character IS the primary choice, and the
    // first one is preselected below so the preview is never empty. When there's
    // only one character the preset step collapses and the snap-forward effect
    // lands on class/customize exactly like before.
    setCreateStep("preset");
    setCreateOriginId("human");
    setCreatePose("idle");
    setCreateView("front");
    setCreateAppearance({});
    setGeneratorPartSearchByCategory({});
    setCreateGeneratorOptions(null);
    setCreateGeneratorReloading(false);
    setShowCreate(true);
    setCreateLoading(true);
    (async () => {
      try {
        const httpUrl = await resolveBrowserGameServerHttpUrl();
        const [tplRes, clsRes, avatarRes, generatorOptions] = await Promise.all([
          fetch(`${httpUrl}/api/character-templates`),
          fetch(`${httpUrl}/api/character-classes`),
          fetch(`${httpUrl}/api/character-avatar`),
          fetchCharacterGeneratorCreateOptions(httpUrl),
        ]);
        const tpls = tplRes.ok ? ((await tplRes.json()).templates ?? []) : [];
        const clss = clsRes.ok ? ((await clsRes.json()).classes ?? []) : [];
        const avatarConfig = avatarRes.ok ? ((await avatarRes.json()).avatarConfig ?? null) : null;
        const tplOptions: TemplateOption[] = tpls.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? "",
          classId: t.classId ?? null,
          iconSpriteId: t.iconSpriteId ?? null,
          stats: t.stats ?? {},
          starterItems: t.starterItems ?? [],
          starterAbilities: t.starterAbilities ?? [],
          startingCurrency: t.startingCurrency ?? { gold: 0, silver: 0 },
          avatar: t.avatar ?? {},
        }));
        const clsOptions: ClassOption[] = clss.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          iconSpriteId: c.iconSpriteId ?? null,
          statAdditive: c.statAdditive ?? {},
          statMultiplicative: c.statMultiplicative ?? {},
          starterItems: c.starterItems ?? [],
          starterAbilities: c.starterAbilities ?? [],
        }));
        setDefaultAvatarConfig(hasAvatarConfig(avatarConfig) ? avatarConfig : null);
        setCreateGeneratorOptions(generatorOptions);
        if (generatorOptions?.appearance) {
          setCreateOriginId(
            generatorOptions.appearance.speciesId ??
              generatorOptions.appearance.bodyModelId ??
              "human",
          );
        }
        setCreateTemplates(tplOptions);
        setCreateClasses(clsOptions);
        // Preselect the first character (and a singleton class) so the creator
        // opens on a populated "Select Character" step with a live preview
        // instead of an empty picker. A template that locks a class keeps that
        // lock — same rule the picker's own onClick applies.
        if (tplOptions.length > 0) {
          setCreateTemplateId(tplOptions[0].id);
          if (tplOptions[0].classId) setCreateClassId(null);
        }
        if (clsOptions.length === 1 && !tplOptions[0]?.classId) setCreateClassId(clsOptions[0].id);
      } catch (err) {
        console.warn("[CC] Failed to load creation options:", err);
      } finally {
        setCreateLoading(false);
      }
    })();
  }, []);

  // If the active step is not visible — collapsed for want of options, or hidden
  // by the creator — snap to the first one that is. Resolving visibility the same
  // way the rail does keeps the two from disagreeing about which steps exist.
  useEffect(() => {
    if (!showCreate) return;
    const lockedTplClass = createTemplates.find((t) => t.id === createTemplateId)?.classId ?? null;
    const hasChoice: Record<string, boolean> = {
      class: createClasses.length > 1 && !lockedTplClass,
      preset: createTemplates.length > 1,
      customize: true,
    };
    const visible = cc.steps
      .filter(
        (s) =>
          !s.hidden && s.id in hasChoice && ((s.autoCollapse ?? true) ? hasChoice[s.id] : true),
      )
      .map((s) => s.id);
    // "customize" is never removable, so there is always somewhere to land.
    if (!visible.includes(createStep)) {
      setCreateStep((visible[0] ?? "customize") as CreateStep);
    }
  }, [showCreate, createStep, createTemplates, createClasses, createTemplateId, cc.steps]);

  const handleConfirmCreate = useCallback(async () => {
    if (createSubmittingRef.current) return;
    setCreateError(null);
    const name = createName.trim();
    if (!name) {
      setCreateError("Enter a character name");
      return;
    }
    if (createTemplates.length > 0 && !createTemplateId) {
      setCreateError(cc.copy.noPresetError?.trim() || "Select a character");
      return;
    }
    // If chosen template doesn't lock a class and any class is selectable, require selection
    const chosenTpl = createTemplates.find((t) => t.id === createTemplateId) ?? null;
    if (chosenTpl && !chosenTpl.classId && createClasses.length > 0 && !createClassId) {
      setCreateError(cc.copy.noClassError?.trim() || "Select a class");
      return;
    }
    const activeGeneratorAppearance = createGeneratorOptions?.appearance ?? null;
    const missingGeneratorCategories =
      activeGeneratorAppearance && createGeneratorOptions?.categories
        ? createGeneratorOptions.categories.filter(
            (category) => !category.optional && !activeGeneratorAppearance.selections[category.id],
          )
        : [];
    if (missingGeneratorCategories.length > 0) {
      setCreateError(
        `Choose ${missingGeneratorCategories
          .slice(0, 3)
          .map((category) => category.label)
          .join(", ")} before entering the world.`,
      );
      setCreateStep("customize");
      setCustomizeTab("appearance");
      return;
    }
    createSubmittingRef.current = true;
    setCreateSubmitting(true);
    try {
      const httpUrl = await resolveBrowserGameServerHttpUrl();
      const finalClassId = chosenTpl?.classId ? null : (createClassId ?? null);
      const appearance =
        createGeneratorOptions?.appearance ??
        buildCharacterCreateAppearance({
          originId: createOriginId,
          values: createAppearance,
        });

      if (isGuest) {
        const res = await fetch(`${httpUrl}/api/characters/create-guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            templateId: createTemplateId ?? null,
            classId: finalClassId,
            appearance,
          }),
        });
        // Some failure modes (network errors, proxies, 502s) return an empty body,
        // which makes `res.json()` throw "Unexpected end of JSON input". Read the
        // body as text first so the user sees a helpful status code instead of a
        // raw parse error.
        const text = await res.text();
        let data: { success?: boolean; error?: string; character?: { id: string } } = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = {};
          }
        }
        if (!res.ok || !data.success) {
          setCreateError(data.error ?? `Failed to create character (HTTP ${res.status})`);
          createSubmittingRef.current = false;
          setCreateSubmitting(false);
          return;
        }
        const newId: string = data.character!.id;
        const tplName =
          createTemplates.find((t) => t.id === (createTemplateId ?? ""))?.name ?? null;
        const clsName = createClasses.find((c) => c.id === (finalClassId ?? ""))?.name ?? null;
        const record: GuestCharacterRecord = {
          id: newId,
          name,
          templateId: createTemplateId ?? null,
          classId: finalClassId,
          templateName: tplName,
          className: clsName,
          createdAt: new Date().toISOString(),
          lastPlayed: new Date().toISOString(),
        };
        const next = [...readGuestCharacters().filter((c) => c.id !== newId), record];
        writeGuestCharacters(next);
        setGuestToken(newId);
        setShowCreate(false);
        setEntering(true);
        router.push(`/play?guest=true&character=${encodeURIComponent(newId)}`);
        return;
      }

      const token = await getAuthToken();
      if (!token) {
        setCreateError("Not signed in");
        createSubmittingRef.current = false;
        setCreateSubmitting(false);
        return;
      }
      const res = await fetch(`${httpUrl}/api/characters/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          templateId: createTemplateId ?? null,
          classId: finalClassId,
          appearance,
        }),
      });
      const text = await res.text();
      let data: { success?: boolean; error?: string; character?: { id: string } } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }
      if (!res.ok || !data.success) {
        setCreateError(data.error ?? `Failed to create character (HTTP ${res.status})`);
        createSubmittingRef.current = false;
        setCreateSubmitting(false);
        return;
      }
      const newId: string = data.character!.id;
      setShowCreate(false);
      setEntering(true);
      router.push(`/play?character=${newId}`);
    } catch (err) {
      console.error("[CC] Create character error:", err);
      setCreateError("Network error");
      createSubmittingRef.current = false;
      setCreateSubmitting(false);
    }
  }, [
    createName,
    createTemplateId,
    createClassId,
    createOriginId,
    createAppearance,
    createGeneratorOptions,
    createTemplates,
    createClasses,
    getAuthToken,
    isGuest,
    router,
    cc.copy,
  ]);

  const handleDeleteCharacter = useCallback(
    (id: string) => {
      if (confirmDelete === id) {
        setDeleting(id);
        setError(null);
        (async () => {
          try {
            if (isGuest) {
              // Guest roster lives in localStorage — server sync is best-effort only.
              try {
                const httpUrl = await resolveBrowserGameServerHttpUrl();
                const res = await fetch(`${httpUrl}/api/characters/delete-guest`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ characterId: id }),
                });
                if (!res.ok && res.status !== 404) {
                  console.warn("[CC] guest delete API:", res.status);
                }
              } catch (apiErr) {
                console.warn("[CC] guest delete API unreachable:", apiErr);
              }
              writeGuestCharacters(readGuestCharacters().filter((c) => c.id !== id));
              if (getGuestToken() === id) {
                clearGuestToken();
              }
            } else {
              const httpUrl = await resolveBrowserGameServerHttpUrl();
              const token = await getAuthToken();
              if (!token) {
                throw new Error("Silmek için oturum gerekli.");
              }
              const res = await fetch(`${httpUrl}/api/characters/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, characterId: id }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}) as { error?: string });
                throw new Error(data?.error || `Silme başarısız (${res.status})`);
              }
            }
            setCharacters((prev) => prev.filter((c) => c.id !== id));
            if (selectedId === id) setSelectedId(null);
          } catch (err) {
            console.error("[CC] Failed to delete character:", err);
            setError(err instanceof Error ? err.message : "Karakter silinemedi");
          } finally {
            setDeleting(null);
            setConfirmDelete(null);
          }
        })();
      } else {
        setError(null);
        setConfirmDelete(id);
        window.setTimeout(() => {
          setConfirmDelete((cur) => (cur === id ? null : cur));
        }, 5000);
      }
    },
    [confirmDelete, getAuthToken, isGuest, selectedId],
  );

  const handleLogout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(`${GameConfig.localStoragePrefix}:auto-login`);
    localStorage.removeItem(LOCAL_AUTH_TOKEN_KEY);
    router.push("/login");
  }, [supabase, router]);

  const handleBack = useCallback(() => {
    router.push("/login");
  }, [router]);

  /* Close menu on outside click */
  useEffect(() => {
    if (!showMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showMenu]);

  /* Auto-prompt character creation ONLY when a successful load returned zero
   * characters (a genuinely new account) — never when the load failed, or an
   * existing player who bounced here from in-game gets forced into creation. */
  useEffect(() => {
    if (!loading && !loadFailedRef.current && characters.length === 0 && !showCreate) {
      handleCreateCharacter();
    }
  }, [loading, characters.length]);

  const selected = characters.find((c) => c.id === selectedId) || null;
  const canCreate = characters.length < MAX_CHARACTERS;

  /*  Loading state  */
  if (loading) {
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
            Loading Characters
          </p>
        </div>
      </div>
    );
  }

  /*  Entering splash  */
  if (entering) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--hud-bg)" }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div
              className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--hud-accent) transparent transparent transparent" }}
            />
            <div
              className="absolute inset-3 rounded-full border border-t-transparent animate-spin"
              style={{
                borderColor: "var(--hud-primary) transparent transparent transparent",
                animationDirection: "reverse",
                animationDuration: "0.7s",
              }}
            />
            <div
              className="absolute inset-6 rounded-full border border-t-transparent animate-spin"
              style={{
                borderColor: "var(--hud-accent) transparent transparent transparent",
                animationDuration: "0.4s",
              }}
            />
          </div>
          <div className="text-center">
            <p
              className="font-display text-lg tracking-widest"
              style={{ color: "var(--hud-text-primary)" }}
            >
              {GameConfig.loadingText}
            </p>
            <p
              className="text-xs tracking-[0.2em] uppercase mt-1 animate-pulse"
              style={{ color: "var(--hud-text-secondary)" }}
            >
              {selected ? `Playing as ${selected.name}` : "Preparing your adventure"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CharacterSelectShell
        characters={characters.map((c) => ({
          ...c,
          className: c.className ?? (c.classId ? (classNameMap[c.classId] ?? null) : null),
          spriteSrc: c.templateId
            ? templateAvatarMap[c.templateId]
              ? (templateSpriteMap[c.templateId] ?? c.spriteSrc ?? null)
              : null
            : (c.spriteSrc ?? null),
          avatarConfig: c.templateId ? (templateAvatarMap[c.templateId] ?? null) : null,
        }))}
        config={cc.select}
        mediaBase={ccMediaBase}
        gameName={ccGameName}
        selectedClan={selectedClan}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onEnterWorld={handleEnterWorld}
        onCreate={handleCreateCharacter}
        onDelete={handleDeleteCharacter}
        onBack={handleBack}
        onSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
        isGuest={isGuest}
        loading={loading}
        entering={entering}
        deleting={deleting}
        confirmDelete={confirmDelete}
        canCreate={canCreate}
        error={error}
        maxCharacters={MAX_CHARACTERS}
        screenSkin={{ backdrop: cc.backdrop, card: cc.card, surfaces: cc.surfaces }}
      />
      {showSettings && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onCharacterSelect={() => setShowSettings(false)}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* Create Character Modal — Divinity-style hero forge (rail + class + preview + identity) */}
      {showCreate &&
        (() => {
          const lockedTpl = createTemplates.find((t) => t.id === createTemplateId);
          const lockedClassId = lockedTpl?.classId ?? null;
          const activeCls = createClasses.find((c) => c.id === (lockedClassId ?? createClassId));

          // Step rail. Order, naming and visibility come from the authored
          // config; an unauthored project resolves to the engine's three steps
          // in their original order, so this renders exactly as it always has.
          //
          // Class and Preset still auto-collapse at 0-1 options (singletons are
          // auto-selected on load), but that is now a per-step toggle rather
          // than a hardcode — a creator who wants the step shown regardless can
          // say so.
          const hasChoice: Record<string, boolean> = {
            class: createClasses.length > 1 && !lockedClassId,
            preset: createTemplates.length > 1,
            customize: true,
          };
          const isDone: Record<string, boolean> = {
            class: !!activeCls,
            preset: !!createTemplateId,
            customize:
              Object.keys(createAppearance).length > 0 ||
              Boolean(createGeneratorOptions?.appearance),
          };
          const ENGINE_STEP_COPY: Record<string, { label: string; sub: string }> = {
            class: { label: "Sınıf", sub: "Yolunu seç" },
            preset: { label: "Karakter", sub: "Bir karakter seç" },
            customize: { label: "Özelleştir", sub: "Görünüm, yüz, saç, renkler" },
          };
          type StepDef = {
            key: CreateStep;
            label: string;
            sub: string;
            done: boolean;
            disabled: boolean;
          };
          const steps: StepDef[] = cc.steps
            .filter((s) => {
              if (s.hidden) return false;
              // Custom steps have no engine body yet; they surface once a step
              // can host widgets (P4) rather than rendering an empty column.
              if (!(s.id in ENGINE_STEP_COPY)) return false;
              if ((s.autoCollapse ?? true) && !hasChoice[s.id]) return false;
              return true;
            })
            .map((s) => ({
              key: s.id as CreateStep,
              label: s.label?.trim() || ENGINE_STEP_COPY[s.id]!.label,
              sub: s.sub?.trim() || ENGINE_STEP_COPY[s.id]!.sub,
              done: isDone[s.id] ?? false,
              disabled: false,
            }));

          // Combine template + class to surface real attribute values.
          const activeTpl = createTemplates.find((t) => t.id === createTemplateId) ?? null;
          const combinedStats = computeCombinedStats(activeTpl, activeCls ?? null);
          const statEntries = Object.entries(combinedStats).slice(0, 6);
          const statMax = Math.max(1, ...statEntries.map(([, v]) => Math.ceil(Math.max(0, v))));

          // Combined starter loadout (template + class).
          const combinedStarterItems = [
            ...(activeTpl?.starterItems ?? []),
            ...(activeCls?.starterItems ?? []),
          ];
          const combinedStarterAbilities = [
            ...(activeTpl?.starterAbilities ?? []),
            ...(activeCls?.starterAbilities ?? []),
          ];

          const activeAvatarConfig = hasAvatarConfig(activeTpl?.avatar)
            ? activeTpl.avatar
            : defaultAvatarConfig;
          // Sprite icon fallback: full avatar configs are preferred because they
          // can crop idle/walk/run frames from the actual character sheet.
          const previewSpriteId = activeTpl?.iconSpriteId ?? activeCls?.iconSpriteId ?? null;
          const previewSpriteUrl = previewSpriteId
            ? `/api/media/${encodeURIComponent(previewSpriteId)}`
            : null;
          const hasConfiguredSprite = Boolean(activeAvatarConfig || previewSpriteUrl);
          // The built-in procedural pack is only a last-resort placeholder. A
          // character/template sprite from Avatar & Animations must take priority.
          // Project-installed generator packs remain active because they are
          // intentional creator content rather than the South Park fallback.
          const activeGeneratorOptions =
            hasConfiguredSprite && createGeneratorOptions?.pack?.id === BUILTIN_PACK_ID
              ? null
              : createGeneratorOptions;

          const generatorCategories =
            activeGeneratorOptions?.enabled && activeGeneratorOptions.categories
              ? activeGeneratorOptions.categories
              : [];
          const generatorAppearance = activeGeneratorOptions?.appearance ?? null;
          const generatorSelectedCount = generatorAppearance
            ? Object.values(generatorAppearance.selections).filter(Boolean).length
            : 0;
          const missingGeneratorCategories =
            generatorAppearance && generatorCategories.length > 0
              ? generatorCategories.filter(
                  (category) => !category.optional && !generatorAppearance.selections[category.id],
                )
              : [];
          const generatorAppearanceReady = missingGeneratorCategories.length === 0;
          const createSubmitDisabled =
            createSubmitting ||
            createLoading ||
            createGeneratorReloading ||
            !createName.trim() ||
            !createClassId;
          const categorizeGeneratorCategory = (
            category: NonNullable<CharacterGeneratorCreateOptions["categories"]>[number],
          ): Exclude<CustomizeTab, "colors"> => {
            // An explicit mapping (UI Editor → Character Creator → Steps →
            // category map) always wins. The keyword guess below cannot know
            // that a pack's "Wings" category belongs under Gear, and before this
            // there was no way to tell it — the setting existed but nothing read
            // it, so every mis-guessed category was stuck where the engine put it.
            const mapped = cc.categoryMap?.[category.id];
            if (
              mapped === "appearance" ||
              mapped === "face" ||
              mapped === "hair" ||
              mapped === "gear"
            ) {
              return mapped;
            }
            const key = `${category.id} ${category.label}`.toLowerCase();
            if (
              key.includes("hair") ||
              key.includes("beard") ||
              key.includes("mustache") ||
              key.includes("rearhair") ||
              key.includes("fronthair")
            ) {
              return "hair";
            }
            if (
              key.includes("face") ||
              key.includes("eye") ||
              key.includes("brow") ||
              key.includes("nose") ||
              key.includes("mouth") ||
              key.includes("ear")
            ) {
              return "face";
            }
            if (
              key.includes("outfit") ||
              key.includes("cloth") ||
              key.includes("clothes") ||
              key.includes("armor") ||
              key.includes("robe") ||
              key.includes("shirt") ||
              key.includes("pants") ||
              key.includes("boot") ||
              key.includes("belt") ||
              key.includes("cape") ||
              key.includes("cloak") ||
              key.includes("hat") ||
              key.includes("helm") ||
              key.includes("accessor") ||
              key.includes("weapon")
            ) {
              return "gear";
            }
            return "appearance";
          };
          const visibleGeneratorCategories =
            customizeTab === "colors"
              ? []
              : generatorCategories.filter(
                  (category) => categorizeGeneratorCategory(category) === customizeTab,
                );
          const generatorColorRegions = generatorAppearance
            ? Array.from(
                new Set(
                  generatorCategories.flatMap((category) => {
                    const selectedPartId = generatorAppearance.selections[category.id];
                    const selectedPart = category.parts.find((part) => part.id === selectedPartId);
                    return [
                      ...(category.colorRegions ?? []),
                      ...(selectedPart?.colorRegions ?? []),
                    ];
                  }),
                ),
              ).sort()
            : [];
          const generatorSwatches =
            activeGeneratorOptions?.palettes?.flatMap((palette) => palette.swatches) ?? [];
          const visibleGeneratorSwatches =
            generatorSwatches.length > 0
              ? generatorSwatches.slice(0, 24)
              : [
                  { id: "skin-light", value: "#f2c7a4" },
                  { id: "skin-medium", value: "#b87950" },
                  { id: "skin-dark", value: "#6b3f2a" },
                  { id: "hair-black", value: "#1f1b18" },
                  { id: "hair-brown", value: "#6d4328" },
                  { id: "hair-blond", value: "#d8b86f" },
                  { id: "accent-blue", value: "#3b82f6" },
                  { id: "accent-gold", value: "#f59e0b" },
                ];
          const updateGeneratorSelection = (categoryId: string, partId: string | null) => {
            setCreateGeneratorOptions((current) => {
              if (!current?.appearance) return current;
              return {
                ...current,
                appearance: {
                  ...current.appearance,
                  selections: {
                    ...current.appearance.selections,
                    [categoryId]: partId,
                  },
                },
              };
            });
          };
          const updateGeneratorColor = (regionId: string, value: string) => {
            setCreateGeneratorOptions((current) => {
              if (!current?.appearance) return current;
              return {
                ...current,
                appearance: {
                  ...current.appearance,
                  colors: {
                    ...current.appearance.colors,
                    [regionId]: value,
                  },
                },
              };
            });
          };

          return (
            <div
              // No inset on a phone: 24px of padding around a full-screen form
              // is 24px the form does not have.
              className="fixed inset-0 z-30 flex items-center justify-center p-0 sm:px-3 sm:py-4"
              style={
                ccHasBackdrop
                  ? undefined
                  : { background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }
              }
            >
              {/* Authored backdrop (UI Editor → Character Creator → Screen →
                  Backdrop). Without one the flow keeps the plain dim scrim it
                  always had, so an unauthored project is unchanged. */}
              {ccHasBackdrop && (
                <ScreenBackdropLayer
                  backdrop={cc.backdrop}
                  mediaBase={ccMediaBase}
                  accent={ccAccent}
                />
              )}
              <div
                // `dvh` on phones so the iOS URL bar collapsing/expanding never
                // leaves the confirm button under the browser chrome.
                className="relative z-10 flex h-full max-h-[100dvh] w-full flex-col overflow-hidden rounded-none sm:h-[calc(100vh-36px)] sm:max-h-[calc(100vh-36px)] sm:rounded-hud-lg"
                style={{
                  ...screenCardStyle(cc.card ?? {}, ccMediaBase),
                  maxWidth: "1280px",
                  width: "100%",
                  ...surfaceStyle(SOHBEX_CREATE_SHELL, ccMediaBase),
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-8 py-3 sm:px-10 sm:py-3.5"
                  style={{
                    borderBottom:
                      cc.brand?.showDivider === false ? undefined : "1px solid var(--hud-border-1)",
                  }}
                >
                  <div className="flex items-center justify-start">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        background: "color-mix(in srgb, var(--hud-accent) 10%, transparent)",
                        border: "2px solid color-mix(in srgb, var(--hud-accent) 35%, transparent)",
                      }}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style={{ color: "var(--hud-accent)" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6L12 2z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="min-w-0 text-center">
                    {ccLogoUrl ? (
                      <img
                        src={ccLogoUrl}
                        alt={cc.copy.title?.trim() || "Kahramanını Yarat"}
                        className="mx-auto h-auto"
                        style={{
                          width: `${cc.brand?.logoWidthPx ?? 320}px`,
                          maxWidth: "100%",
                        }}
                      />
                    ) : (
                      <h3
                        className="font-display text-2xl tracking-[0.18em]"
                        style={{
                          color: "var(--hud-text-primary)",
                          fontFamily: cc.brand?.titleFontFamily || undefined,
                          textShadow: cc.brand?.titleGlowColor
                            ? `0 0 24px ${safeCssColor(cc.brand.titleGlowColor, "transparent")}`
                            : undefined,
                        }}
                      >
                        {cc.copy.title?.trim() || "Kahramanını Yarat"}
                      </h3>
                    )}
                    <p
                      className="mt-0.5 text-[10px] uppercase tracking-[0.3em]"
                      style={{ color: "var(--hud-text-muted)" }}
                    >
                      {cc.copy.tagline?.trim() || "Yolunu seç · Efsaneni yaz"}
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    {characters.length > 0 && (
                      <button
                        onClick={() => setShowCreate(false)}
                        className="rounded-hud px-3 py-2 text-xs uppercase tracking-widest transition-colors"
                        style={{
                          color: "var(--hud-text-muted)",
                          border: "1px solid var(--hud-border-1)",
                        }}
                      >
                        {cc.copy.backLabel?.trim() || "İptal"}
                      </button>
                    )}
                  </div>
                </div>

                {createLoading ? (
                  <div
                    className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest py-20"
                    style={{ color: "var(--hud-text-muted)" }}
                  >
                    Kahraman seçenekleri yükleniyor…
                  </div>
                ) : (
                  <div
                    // Stacked (compact / phone) scrolls as one column; the
                    // multi-column layouts keep each region scrolling on its own.
                    className={`grid min-h-0 flex-1 ${ccGrid.stacked ? "overflow-y-auto" : "overflow-hidden"}`}
                    style={ccGrid.grid}
                  >
                    {/* COLUMN 1 — Step rail removed (SohbeX: Özelleştir panel hidden). */}

                    {/* COLUMN 2 — Özelleştir/content removed (SohbeX). */}

                    {/* COLUMN 3 — Character preview */}
                    <div
                      className="relative my-2 flex min-h-0 flex-col overflow-hidden"
                      style={{
                        ...ccGrid.region.preview,
                        ...ccSurface("preview"),
                        ...CREATE_TEXT,
                        backgroundColor: "rgba(8,4,4,0.9)",
                        backgroundBlendMode: "multiply",
                      }}
                    >
                      {/* Light beam */}
                      <div
                        className="absolute left-1/2 top-0 -translate-x-1/2 w-1/2 h-2/3 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(147,197,253,0.18), transparent 70%)",
                          filter: "blur(20px)",
                        }}
                      />
                      {/* Sprite area */}
                      <div className="relative flex min-h-0 flex-1 items-end justify-center pb-4">
                        <div
                          className="relative w-80 h-[360px] flex items-end justify-center"
                          style={{
                            filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))",
                          }}
                        >
                          {generatorAppearance && activeGeneratorOptions ? (
                            <CharacterGeneratorLivePreview
                              appearance={generatorAppearance}
                              options={activeGeneratorOptions}
                              pose={createPose}
                              view={createView}
                            />
                          ) : (
                            <CharacterCreatorSpritePreview
                              avatarConfig={activeAvatarConfig}
                              fallbackUrl={previewSpriteUrl}
                              pose={createPose}
                              view={createView}
                              alt={activeTpl?.name ?? activeCls?.name ?? "Hero preview"}
                            />
                          )}
                          {/* Glow circle floor */}
                          <div
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-44 h-6 rounded-full"
                            style={{
                              background:
                                "radial-gradient(ellipse, rgba(96,165,250,0.4) 0%, rgba(96,165,250,0) 70%)",
                            }}
                          />
                        </div>
                      </div>

                    </div>

                    {/* COLUMN 4 — Identity panel */}
                    <div
                      className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-2 hud-scroll sm:px-6"
                      style={{
                        ...ccGrid.region.summary,
                        ...ccSurface("summary"),
                        ...CREATE_TEXT,
                      }}
                    >
                      {/* Hero name — top of panel, centered (clan already chosen on /clan-select). */}
                      <div className="text-center">
                        <label
                          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.28em]"
                          style={{ color: "var(--hud-text-primary)" }}
                        >
                          Kahraman Adı
                        </label>
                        <input
                          type="text"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          placeholder={cc.copy.namePlaceholder?.trim() || "Adını yaz"}
                          maxLength={32}
                          autoFocus
                          className="w-full rounded-hud px-3.5 py-2.5 text-center font-display text-sm tracking-wider"
                          style={{
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid color-mix(in srgb, var(--hud-accent) 55%, transparent)",
                            color: "var(--hud-text-primary)",
                          }}
                        />
                        <div
                          className="mt-1 text-center text-[10px] uppercase tracking-widest"
                          style={{ color: "var(--hud-text-muted)" }}
                        >
                          {createName.length}/32
                        </div>
                      </div>

                      {selectedClan && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              sessionStorage.setItem("sohbex.resumeCreate", "1");
                            } catch {
                              /* ignore */
                            }
                            window.location.href = "/clan-select.html";
                          }}
                          className="rounded-hud px-3 py-2 text-center transition-colors"
                          style={{
                            background: "color-mix(in srgb, var(--hud-accent) 10%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--hud-accent) 40%, transparent)",
                            cursor: "pointer",
                            width: "100%",
                          }}
                          title="Klanı değiştir"
                          aria-label={`Klan: ${selectedClan.name}. Değiştirmek için tıkla.`}
                        >
                          <div
                            className="text-[10px] uppercase tracking-[0.28em]"
                            style={{ color: "var(--hud-text-muted)" }}
                          >
                            Klan
                          </div>
                          <div
                            className="mt-0.5 font-display text-sm tracking-wider"
                            style={{ color: "var(--hud-text-primary)" }}
                          >
                            {selectedClan.name}
                          </div>
                          <div
                            className="mt-1 text-[9px] uppercase tracking-[0.22em]"
                            style={{ color: "var(--hud-text-secondary)" }}
                          >
                            Değiştir
                          </div>
                        </button>
                      )}

                      <div className="h-px" style={{ background: "var(--hud-border-1)" }} />

                      {/* Class pick — SohbeX four archetypes */}
                      <div>
                        <label
                          className="mb-2 block text-center text-[11px] font-semibold uppercase tracking-[0.28em]"
                          style={{ color: "var(--hud-text-primary)" }}
                        >
                          Bir Sınıf Seç
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {SOHBEX_CREATE_CLASSES.map((cls) => {
                            const resolvedId = resolveSohbexClassId(cls, createClasses);
                            const sel = createClassId === resolvedId;
                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={() => setCreateClassId(resolvedId)}
                                className="rounded-hud px-2 py-3 text-center transition-all"
                                style={{
                                  background: sel
                                    ? "color-mix(in srgb, var(--hud-accent) 14%, transparent)"
                                    : "rgba(0,0,0,0.35)",
                                  border: `1px solid ${sel ? "var(--hud-accent)" : "var(--hud-border-1)"}`,
                                  color: sel ? "var(--hud-accent)" : "var(--hud-text-secondary)",
                                }}
                              >
                                <span className="font-display text-xs uppercase tracking-[0.18em]">
                                  {cls.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {createError && (
                        <div
                          className="rounded-hud px-3 py-2 text-xs"
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            color: "#fca5a5",
                          }}
                        >
                          {createError}
                        </div>
                      )}

                      {/* CTA — pinned to bottom of summary column */}
                      <div className="mt-auto shrink-0 pt-3">
                        <button
                          onClick={handleConfirmCreate}
                          disabled={createSubmitDisabled}
                          className="relative flex w-full items-center justify-center gap-2 overflow-hidden py-3 text-sm font-bold uppercase tracking-[0.22em] transition-all duration-200"
                          style={{
                            background: `url(${JSON.stringify("/ui/yamato/charselect/btn_primary.png")}) center / 100% 100% no-repeat`,
                            color: "#fff",
                            opacity: createSubmitDisabled ? 0.55 : 1,
                            border: "1px solid color-mix(in srgb, var(--hud-accent) 40%, transparent)",
                            borderRadius: 4,
                            minHeight: 48,
                            cursor: createSubmitDisabled ? "not-allowed" : "pointer",
                            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                            boxShadow: createSubmitDisabled
                              ? "none"
                              : "0 4px 20px rgba(46,125,50,0.4)",
                          }}
                        >
                          <span className="relative z-10">
                            {createSubmitting
                              ? cc.copy.confirmBusyLabel?.trim() || "Oluşturuluyor…"
                              : cc.copy.confirmLabel?.trim() || "Oluştur"}
                          </span>
                          <svg
                            className="w-4 h-4 relative z-10"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6L12 2z"
                            />
                          </svg>
                        </button>
                        <p
                          className="mt-1.5 text-center text-[9px] uppercase tracking-[0.25em]"
                          style={{ color: "var(--hud-text-muted)" }}
                        >
                          Maceran seni bekliyor.
                        </p>
                        <div
                          className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-[9px] uppercase tracking-widest"
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
                              strokeWidth={1.75}
                              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                            />
                          </svg>
                          {isGuest
                            ? "İlerleme bu cihazda saklanır"
                            : "İlerleme otomatik kaydedilir"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </>
  );
}
