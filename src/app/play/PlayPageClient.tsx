"use client";

import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { GameEngine, type AbilityAimSpec } from "@/game/engine";
import { atlasResolver } from "@/game/atlas-resolver";
import { isConstrainedDevice } from "@/game/device-profile";
import { gameState, type SocialInvite } from "@/game/state";
import { GameSocket } from "@/lib/game-socket";
import {
  ensureGuestStorageScope,
  getGuestToken,
  readGuestCharacters,
  setGuestToken,
} from "@/lib/guest-storage";
import { LocalSimSocket, getDryRunParams } from "@/lib/local-sim-socket";
import { resolveBrowserGameServerWsUrl } from "@/lib/project-runtime";
import { handleServerMessage } from "@/game/message-handler";
import { getClientPluginSystem } from "@/game/client-plugin-system";
import { setSoundBindings } from "@/game/audio/sound-bindings";
import { createClient, loadAuthConfig } from "@/lib/supabase";
import {
  tileToChunk,
  EntityType,
  tileDistance,
  PICKUP_RANGE_TILES,
  EquipmentSlot,
  ItemType,
  CraftingStationType,
  CHUNK_SIZE,
  SLOT_LMB,
  HOTBAR_START_INDEX,
  MAX_HOTBAR_SLOTS,
  GameConfig,
  WS_MAX_RECONNECT_ATTEMPTS,
  PLAYER_CONTROL_ACTION_BY_ID,
  getActionSlotMap,
  getActionsForInput,
  getViewMode,
  keyboardEventToControlInput,
  resolveCraftTier,
  itemPlaceableKind,
  placeableMapObjectDefId,
  type PlayerControlActionId,
  type GameFeature,
  type LoadingScreenConfig,
} from "@ed5-mmo-studio/shared";
import AbilityBar from "@/components/hud/AbilityBar";
import { ScreenReaderAnnouncer } from "@/components/hud/ScreenReaderAnnouncer";
import { CombatNotice } from "@/components/hud/CombatNotice";
import StatBar from "@/components/hud/StatBar";
import { usePanelChrome } from "@/components/hud/usePanelChrome";
import LevelBadge from "@/components/hud/LevelBadge";
import XpBar from "@/components/hud/XpBar";
import TerritoryPanel from "@/components/hud/TerritoryPanel";
import ChatPanel from "@/components/hud/ChatPanel";
import Minimap from "@/components/hud/Minimap";
const InventoryPanel = nextDynamic(() => import("@/components/hud/InventoryPanel"), { ssr: false });
const SkillsPanel = nextDynamic(() => import("@/components/hud/SkillsPanel"), { ssr: false });
const LoadoutPanel = nextDynamic(() => import("@/components/hud/LoadoutPanel"), { ssr: false });
import TopBar from "@/components/hud/TopBar";
import SurvivalBars from "@/components/hud/SurvivalBars";
import StatusEffectsBar, { EffectIcon } from "@/components/hud/StatusEffectsBar";
import BossBar from "@/components/hud/BossBar";
import ArenaHUD from "@/components/hud/ArenaHUD";
import DetectionIndicator from "@/components/hud/DetectionIndicator";
const CharacterPanel = nextDynamic(() => import("@/components/hud/CharacterPanel"), { ssr: false });
const CraftingPanel = nextDynamic(() => import("@/components/hud/CraftingPanel"), { ssr: false });
const EnchantPanel = nextDynamic(() => import("@/components/hud/EnchantPanel"), { ssr: false });
const UpgradePanel = nextDynamic(() => import("@/components/hud/UpgradePanel"), { ssr: false });
const AffixRerollPanel = nextDynamic(() => import("@/components/hud/AffixRerollPanel"), {
  ssr: false,
});
const SocialPanel = nextDynamic(() => import("@/components/hud/SocialPanel"), { ssr: false });
const InstancePanel = nextDynamic(() => import("@/components/hud/InstancePanel"), { ssr: false });
// Heavy open-on-demand panels are code-split (W3-19): they render only behind
// `showX &&` flags, so bundling them into the play route's first-load JS made
// every player download ~19k lines of rarely-opened UI up front. `ssr: false`
// is correct — this whole page is client-only.
const MarketPanel = nextDynamic(() => import("@/components/hud/MarketPanel"), { ssr: false });
const CurrencyExchangePanel = nextDynamic(() => import("@/components/hud/CurrencyExchangePanel"), {
  ssr: false,
});
const BuildModePanel = nextDynamic(() => import("@/components/hud/BuildModePanel"), { ssr: false });
import MountButton from "@/components/hud/MountButton";
import SettingsPanel from "@/components/hud/SettingsPanel";
import FpsCounter from "@/components/hud/FpsCounter";
import ConfirmDialog from "@/components/hud/ConfirmDialog";
import { getGameSettings, getBoolSetting, initPlayerSettings } from "@/game/player-settings";
import ExitCountdownOverlay from "@/components/hud/ExitCountdownOverlay";
import ContextMenu, { type ContextMenuOption } from "@/components/hud/ContextMenu";
import PetRadialMenu, { type RadialAction } from "@/components/hud/PetRadialMenu";
import LootRollWindow from "@/components/hud/LootRollWindow";
import RaidFrame from "@/components/hud/RaidFrame";
import PartyFrame from "@/components/hud/PartyFrame";
import DeathRecap from "@/components/hud/DeathRecap";
const MinimapExpanded = nextDynamic(() => import("@/components/hud/MinimapExpanded"), {
  ssr: false,
});
const PetPartyPanel = nextDynamic(() => import("@/components/hud/PetPartyPanel"), { ssr: false });
const PetBattleScreen = nextDynamic(() => import("@/components/hud/PetBattleScreen"), {
  ssr: false,
});
import MountSummonBar from "@/components/hud/MountSummonBar";
const BreedingPanel = nextDynamic(() => import("@/components/hud/BreedingPanel"), { ssr: false });
import EggHatchIndicator from "@/components/hud/EggHatchIndicator";
import TamingOverlay from "@/components/hud/TamingOverlay";
import PetBattleChallengeToast from "@/components/hud/PetBattleChallengeToast";
const PetBattleResultModal = nextDynamic(() => import("@/components/hud/PetBattleResultModal"), {
  ssr: false,
});
const QuestLogPanel = nextDynamic(() => import("@/components/hud/QuestLogPanel"), { ssr: false });
const AchievementsPanel = nextDynamic(() => import("@/components/hud/AchievementsPanel"), {
  ssr: false,
});
import NpcDialogueWindow from "@/components/hud/NpcDialogueWindow";
import QuestTrackerHUD from "@/components/hud/QuestTrackerHUD";
import AchievementTrackerHUD from "@/components/hud/AchievementTrackerHUD";
import NpcInteractPrompt from "@/components/hud/NpcInteractPrompt";
const ShopPanel = nextDynamic(() => import("@/components/hud/ShopPanel"), { ssr: false });
const PremiumShopPanel = nextDynamic(() => import("@/components/hud/PremiumShopPanel"), {
  ssr: false,
});
const MailPanel = nextDynamic(() => import("@/components/hud/MailPanel"), { ssr: false });
const BankPanel = nextDynamic(() => import("@/components/hud/BankPanel"), { ssr: false });
const CalendarPanel = nextDynamic(() => import("@/components/hud/CalendarPanel"), { ssr: false });
const LocationsPanel = nextDynamic(() => import("@/components/hud/LocationsPanel"), { ssr: false });
const WorldMapScreen = nextDynamic(() => import("@/components/hud/WorldMapScreen"), { ssr: false });
const WorldClockWidget = nextDynamic(() => import("@/components/hud/WorldClockWidget"), {
  ssr: false,
});
const ChestPanel = nextDynamic(() => import("@/components/hud/ChestPanel"), { ssr: false });
const TradePanel = nextDynamic(() => import("@/components/hud/TradePanel"), { ssr: false });
const InspectPanel = nextDynamic(() => import("@/components/hud/InspectPanel"), { ssr: false });
const ClaimManagementPanel = nextDynamic(() => import("@/components/hud/ClaimManagementPanel"), {
  ssr: false,
});
const FarmingPanel = nextDynamic(() => import("@/components/hud/FarmingPanel"), { ssr: false });
const PasturePanel = nextDynamic(() => import("@/components/hud/PasturePanel"), { ssr: false });
const AdminPanel = nextDynamic(() => import("@/components/hud/AdminPanel"), { ssr: false });
import ConnectionOverlay from "@/components/hud/ConnectionOverlay";
import LoadingScreen, { type LoadingPhase } from "@/components/hud/LoadingScreen";
const KeybindPanel = nextDynamic(() => import("@/components/hud/KeybindPanel"), { ssr: false });
import TouchControlsOverlay from "@/components/hud/TouchControlsOverlay";
import EventTextWindow from "@/components/hud/EventTextWindow";
import EventChoiceWindow from "@/components/hud/EventChoiceWindow";
import EventNumberInput from "@/components/hud/EventNumberInput";
import EventItemSelect from "@/components/hud/EventItemSelect";
import EventTimer from "@/components/hud/EventTimer";
import EventPictureLayer from "@/components/hud/EventPictureLayer";
import EventScrollingText from "@/components/hud/EventScrollingText";
import { coreEventState } from "@/game/core-event-state";
import {
  applyUICustomization,
  applyAccessibilityClasses,
  getEffectiveUICustomization,
  getUICustomizationRevision,
  isUiPanelEnabled,
  subscribeUICustomization,
} from "@/game/ui-customization";
import HudSlot from "@/components/hud/HudSlot";
import CustomMenuRenderer from "@/components/hud/CustomMenuRenderer";
import { startClientPerfMonitor, type ClientPerfMonitor } from "@/lib/perf-observer";

import type {
  AdminCommand,
  PlayerEntity,
  NpcEntity,
  CraftingStationEntity,
} from "@ed5-mmo-studio/shared";
import {
  abilityNeedsAim,
  resolveAbilityAimMode,
  ABILITY_RANGE_TOLERANCE_TILES,
  DEFAULT_COMBAT_CONFIG,
  NPC_INTERACT_LEAVE_RANGE_TILES,
  NPC_INTERACT_RANGE_TILES,
} from "@ed5-mmo-studio/shared";
import { getEffectiveCasting } from "@/game/cast-preference";

function deriveGameServerHttpUrl(wsUrl: string): string {
  if (/^https?:\/\//i.test(wsUrl)) return wsUrl;
  if (/^ws(s)?:\/\//i.test(wsUrl)) {
    return wsUrl.replace(/^ws(s)?:\/\//i, "http$1://").replace(/\/ws\/?$/i, "");
  }

  try {
    if (typeof window !== "undefined") {
      const resolved = new URL(wsUrl, window.location.origin);
      if (resolved.protocol === "ws:") resolved.protocol = "http:";
      if (resolved.protocol === "wss:") resolved.protocol = "https:";
      return `${resolved.protocol}//${resolved.host}`;
    }
  } catch {
    // Fall through to local dev default.
  }

  return "http://localhost:3001";
}

/**
 * Where "Character Select" (Settings -> Leave) sends the player back to.
 *
 * A guest session is identified ENTIRELY by `?guest=true` — that flag is what makes
 * /cc read the browser's local guest registry instead of asking the server for an
 * account's characters. Pushing a bare "/cc" therefore dropped a guest's identity on
 * the way out and greeted them with "No heroes yet" plus a create form, even though
 * the character they had just been playing was sitting in localStorage. Carry the
 * flag back so leaving the world returns to the same list you entered from.
 */
function characterSelectHref(): string {
  if (typeof window === "undefined") return "/cc";
  // SohbeX: never bounce back into guest CC.
  return "/cc";
}

const CHUNK_REQUEST_INTERVAL_MS = 2000; // Re-check chunk needs every 2s
const CHUNK_PENDING_TIMEOUT_MS = 10000; // Retry an unanswered ChunkRequest after 10s
// World-ready gate timing. The splash holds until the world is fully presentable
// (terrain + object textures + the player's own sprite/animation). Two escape
// hatches keep a slow/broken load from trapping the player: reveal if readiness
// hasn't advanced for STALL_MS (as-good-as-it-gets), and an absolute MAX cap.
// The old fixed 8s cap revealed content-heavy worlds mid-load — objects and the
// player's animation popped in AFTER reveal — so the cap is generous now and the
// stall detector handles the genuinely-stuck case instead.
const WORLD_READY_STALL_MS = 6000; // last-mile stall (only after core content is up)
const WORLD_READY_MAX_MS = 45000; // absolute hard cap (slow connections load big worlds)
type SkillsPanelTab = "skills" | "abilities";
type SocialPanelTab = "party" | "friends" | "guild" | "alliance";
type DuelRequestPrompt = { targetEntityId: string; targetName: string };

/**
 * The slice of an ability definition the aiming + indicator code reads.
 *
 * Structural rather than the full `AbilityDefinition` because these objects
 * arrive from three places that carry slightly different amounts of it: the
 * hotbar slots, the learned-ability list, and the definition cache.
 */
type AimableAbilityDef = {
  id: string;
  range?: number | null;
  aoeShape?: string | null;
  aoeRadius?: number | null;
  aoeGeometry?: AbilityAimSpec["aoeGeometry"];
  baseDamage?: number | null;
  targetMode?: string | null;
  requiresTarget?: boolean | null;
  /** "target" | "cursor" | "auto"; absent derives from requiresTarget. */
  aimMode?: string | null;
  /** "instant" | "cast" | "channel" — decides whether a press opens a charge. */
  type?: string | null;
  castTimeMs?: number | null;
  manaCost?: number | null;
  /** `on_hit` (targeted) vs `while_active` (piercing skill shot). */
  activationType?: string | null;
  indicatorConfig?: AbilityAimSpec["indicatorConfig"];
};

/**
 * Does pressing this ability tell the SERVER about it before the release?
 *
 * Only when something real runs during the hold: a wind-up (cast time) or a
 * channel. An INSTANT ability's hold is pure client-side aiming — opening a
 * server charge for it bought nothing and cost a lot: the server posed the
 * caster for the hold, so an instant blink pressed while running froze the
 * run animation and slid the character along in the cast pose.
 */
const abilityChargesOnPress = (ability: AimableAbilityDef): boolean =>
  (ability.castTimeMs ?? 0) > 0 || ability.type === "channel";

/**
 * The only panels that stay mounted during a full-screen turn-based pet battle:
 * the battle itself, its result, and the modals a player can legitimately be
 * looking at mid-battle.
 */
const BATTLE_SAFE_PANELS = new Set(["petBattle", "petBattleResult", "notifications", "settings"]);

// Last-seen authored loading screen per game (keyed by path). On a real phone
// network the /public-config fetch lands AFTER the splash is already up, so a
// returning player watched the engine-branded default for seconds before the
// world's own screen took over (Valcoma on iPhone, 2026-08-28). Seed from this
// cache on mount; refresh it on every authoritative delivery.
const LOADING_CFG_CACHE_PREFIX = "ed5.loadingScreen.";
function loadingCfgCacheKey(): string {
  return LOADING_CFG_CACHE_PREFIX + (typeof window !== "undefined" ? window.location.pathname : "");
}
function readCachedLoadingScreen(): { loading: LoadingScreenConfig; gameName?: string } | null {
  try {
    const raw = localStorage.getItem(loadingCfgCacheKey());
    return raw ? (JSON.parse(raw) as { loading: LoadingScreenConfig; gameName?: string }) : null;
  } catch {
    return null;
  }
}
function writeCachedLoadingScreen(loading: LoadingScreenConfig | null, gameName?: string): void {
  try {
    if (!loading) {
      localStorage.removeItem(loadingCfgCacheKey());
      return;
    }
    const name = gameName ?? readCachedLoadingScreen()?.gameName;
    localStorage.setItem(
      loadingCfgCacheKey(),
      JSON.stringify({ loading, ...(name ? { gameName: name } : {}) }),
    );
  } catch {
    /* storage unavailable — the fetch/live upgrade still applies */
  }
}

export default function PlayPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const perfMonitorRef = useRef<ClientPerfMonitor | null>(null);
  const performControlActionsRef = useRef<(actions: PlayerControlActionId[]) => boolean>(
    () => false,
  );
  /**
   * The ability currently being AIMED, in `hold` / `confirm` cast modes.
   *
   * A ref rather than React state on purpose: this changes on every keydown and
   * is only read by imperative handlers and the Pixi engine, so putting it in
   * state would re-render the whole HUD mid-aim for no visible benefit.
   *
   * `input` is the control input that opened the aim, so a keyup for a DIFFERENT
   * key cannot fire someone else's aim.
   */
  const aimRef = useRef<{
    abilityId: string;
    input: string | null;
    /** Set once the aim fires or is cancelled, so a late keyup is ignored. */
    resolved: boolean;
    /**
     * Whether the press opened a charge on the server. Instant abilities aim
     * purely client-side, so their release must be an ordinary AbilityIntent —
     * and their cancel must not echo a release the server never heard about.
     */
    charged: boolean;
  } | null>(null);

  /** Paint the reach ring + area footprint for an ability (null clears them). */
  const showAimIndicator = useCallback((ability: AimableAbilityDef | null) => {
    if (!ability || getEffectiveCasting().showAimIndicator === false) {
      engineRef.current?.setAbilityAimIndicator(null);
      return;
    }
    // Only a SELF-cast has no reach worth drawing — a ring around your own feet
    // is noise. It can still have an AREA (a nova centred on the caster), which
    // is why the footprint is decided separately from the range.
    //
    // This used to test `requiresTarget === false`, which is also true of every
    // skill shot — so a beam resolved to zero reach: no ring, and (since a line's
    // length comes from its range) no beam either.
    const isSelfCast = ability.targetMode === "self";
    const range = isSelfCast ? null : (ability.range ?? null);
    // A UNIT-targeted cast is allowed a half-tile of slack (the server forgives a
    // target drifting between the click and the tick), so the ring has to include
    // it — drawn at exactly `range`, a player can demonstrably hit things outside
    // their own indicator, which reads as the indicator being wrong. A free-aimed
    // cast gets no slack: its aim point is clamped to exactly `range`.
    const aimMode = resolveAbilityAimMode(ability);
    const tolerance = aimMode === "cursor" ? 0 : ABILITY_RANGE_TOLERANCE_TILES;
    const drawnRange = range === null ? 0 : range + tolerance;
    engineRef.current?.setAbilityAimIndicator({
      rangeTiles: drawnRange,
      aoeShape: ability.aoeShape,
      aoeRadius: ability.aoeRadius,
      aoeGeometry: ability.aoeGeometry ?? null,
      support: (ability.baseDamage ?? 0) < 0 || ability.targetMode === "allies",
      // Drive the fallback marker for abilities with no authored area: a
      // free-aimed one gets its flight path drawn, a target-locked one just
      // gets a landing marker. The engine also reads this to decide whether the
      // footprint snaps to the selected target — "cursor" mode never snaps,
      // which is exactly what the server does with it.
      requiresTarget: aimMode !== "cursor",
      activationType: ability.activationType,
      projectileHitRadiusTiles: ability.aoeRadius || null,
      indicatorConfig: ability.indicatorConfig ?? null,
    });
  }, []);

  /** Start aiming an ability: show its footprint and wait for the commit. */
  const beginAim = useCallback(
    (ability: AimableAbilityDef, input: string | null) => {
      // Tell the server the press happened NOW, so the cast bar and wind-up run
      // while the player aims. Without this the whole cast would only start on
      // release, landing the ability a full cast time after they let go.
      //
      // ONLY for abilities where something actually runs during the hold — a
      // wind-up or a channel. An instant ability's hold is pure aiming, and
      // "only cast should allow to charge": telling the server about it put
      // the caster in a cast state with nothing to cast.
      const charged =
        abilityChargesOnPress(ability) && gameState.serverCapabilities.has("abilityCharge");
      aimRef.current = { abilityId: ability.id, input, resolved: false, charged };
      showAimIndicator(ability);
      if (charged) {
        socketRef.current?.send({
          type: "AbilityChargeIntent",
          abilityId: ability.id,
          targetId: gameState.selectedTargetId,
          targetPosition: engineRef.current?.getMouseTilePosition() ?? null,
        });
      }
    },
    [showAimIndicator],
  );

  /**
   * The SERVER ended a charge we are still aiming (movement broke the wind-up,
   * we died, Stop, or the press was refused for cost). Clear the local aim only
   * — sending a cancel back would be answering a message with itself.
   */
  const dropAimLocally = useCallback((abilityId: string) => {
    const aim = aimRef.current;
    if (!aim || aim.abilityId !== abilityId) return;
    aim.resolved = true;
    aimRef.current = null;
    engineRef.current?.setAbilityAimIndicator(null);
  }, []);

  /** Drop the aim without casting. Costs nothing — that is the point of it. */
  const cancelAim = useCallback(() => {
    const aim = aimRef.current;
    if (!aim) return false;
    aimRef.current = null;
    engineRef.current?.setAbilityAimIndicator(null);
    // The server is holding a charge for this; without the cancel it would sit
    // there until the player died or reconnected. An uncharged (instant) aim
    // lived only on this client, so there is nothing to tell anyone.
    if (aim.charged) {
      socketRef.current?.send({
        type: "AbilityReleaseIntent",
        abilityId: aim.abilityId,
        targetPosition: null,
        targetId: null,
        cancel: true,
      });
    }
    return true;
  }, []);

  /**
   * Commit the aim. `at` is the point to fire at; omitted means "wherever the
   * cursor is right now", which is what releasing a held key means.
   *
   * Returns whether anything was actually cast, so callers that share a gesture
   * with movement (a left click) can tell whether to also move.
   */
  const fireAim = useCallback((at?: { x: number; y: number } | null): boolean => {
    const aim = aimRef.current;
    if (!aim || aim.resolved) return false;
    aim.resolved = true;
    aimRef.current = null;
    engineRef.current?.setAbilityAimIndicator(null);

    if (gameState.isDead) {
      // The server is still holding a charge for this press, and nothing times
      // one out. Swallowing the release stranded it: the held cast pose was
      // re-asserted onto the corpse and then onto the respawn. Dying is a
      // cancel, not a cast — say so rather than going quiet.
      if (aim.charged) {
        socketRef.current?.send({
          type: "AbilityReleaseIntent",
          abilityId: aim.abilityId,
          targetPosition: null,
          targetId: null,
          cancel: true,
        });
      }
      return false;
    }
    const point = at ?? engineRef.current?.getMouseTilePosition() ?? null;
    // A charged aim is a RELEASE, not a fresh cast: the server has been holding
    // it since the press and already ran part (or all) of the wind-up, so it
    // fires from wherever that clock got to rather than starting over. An
    // uncharged (instant) aim ran entirely on this client, so its commit is an
    // ordinary cast — the same message an old server would get.
    socketRef.current?.send(
      aim.charged
        ? {
            type: "AbilityReleaseIntent",
            abilityId: aim.abilityId,
            targetPosition: point,
            // A locked target still travels with the release: an area ability
            // aimed at a unit should resolve on that unit. Skill shots have none.
            targetId: gameState.selectedTargetId,
          }
        : {
            type: "AbilityIntent",
            abilityId: aim.abilityId,
            targetId: gameState.selectedTargetId,
            targetPosition: point,
          },
    );
    return true;
  }, []);
  // World-ready gate state (shared between the boot poll timer and the
  // ZoneChanged handler so a zone/portal transition can re-arm the gate).
  // `revealed` false = gate armed (loading screen held up); deadline = hard cap.
  // The stall refs track whether readiness is still advancing so we can reveal
  // when the load is genuinely stuck instead of on a blunt fixed timeout.
  const gateRevealedRef = useRef(false);
  const gateDeadlineRef = useRef(0);
  const gateReadinessScoreRef = useRef(-1);
  const gateProgressAtRef = useRef(0);

  // Dry Run (serverless preview) — set from the URL params during boot; drives
  // the persistent "DRY RUN" HUD badge. State (not a render-time read of
  // window.location) so the SSR pass and first client render agree.
  const [isDryRun, setIsDryRun] = useState(false);

  const [showInventory, setShowInventory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showLoadouts, setShowLoadouts] = useState(false);
  const [skillsPanelTab, setSkillsPanelTab] = useState<SkillsPanelTab>("skills");
  const [showCharacter, setShowCharacter] = useState(false);
  const [craftingStationType, setCraftingStationType] = useState<CraftingStationType | null>(null);
  // The station entity the player opened, so the craft intent can name it. An
  // NPC-opened station leaves this null and the server resolves it server-side.
  const [craftingStationEntityId, setCraftingStationEntityId] = useState<string | null>(null);
  const [showCraftingDev, setShowCraftingDev] = useState(false);
  const [showEnchant, setShowEnchant] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAffixReroll, setShowAffixReroll] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [socialPanelTab, setSocialPanelTab] = useState<SocialPanelTab>("guild");
  /**
   * Bumped whenever something asks for the guild CREATE form specifically (a
   * registrar NPC, or a Show Menu → Create Guild event). A counter rather than a
   * boolean so asking twice re-opens the form even if the panel never closed.
   */
  const [guildCreateRequested, setGuildCreateRequested] = useState(0);
  const [showMarket, setShowMarket] = useState(false);
  const [showCurrencyExchange, setShowCurrencyExchange] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBuildMode, setShowBuildMode] = useState(false);
  /** Currently-armed wall material (wallDefId) for edge placement, or null. */
  const [armedWall, setArmedWall] = useState<string | null>(null);
  // Build mode: armed object material (world-cursor placement) + remove tool.
  const [armedObjectItem, setArmedObjectItem] = useState<string | null>(null);
  const [armedTileItem, setArmedTileItem] = useState<string | null>(null);
  const [buildRemoveMode, setBuildRemoveMode] = useState(false);
  const [buildRotation, setBuildRotation] = useState(0);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showPets, setShowPets] = useState(false);
  // Re-fetch the owned-pet roster whenever the pet menu opens, so the list always
  // reflects the live server roster — the initial login PetUpdate can be empty or
  // missed. Cheap: the server just rebuilds the roster and pushes a PetUpdate.
  useEffect(() => {
    if (showPets) socketRef.current?.send({ type: "PetRosterRequestIntent" });
  }, [showPets]);
  // The pet menu lives in the inventory panel as a side drawer (like the stats
  // drawer) — opening pets (hotkey/menu) must open the inventory that hosts it.
  useEffect(() => {
    if (showPets) setShowInventory(true);
  }, [showPets]);
  const [showBank, setShowBank] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  // The Vault opens beside the real inventory (Albion-style) so you can drag
  // items between the two panels — opening the bank pulls the bag up with it.
  useEffect(() => {
    if (showBank) setShowInventory(true);
  }, [showBank]);
  const [showBreeding, setShowBreeding] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [showInstances, setShowInstances] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const [showFarming, setShowFarming] = useState(false);
  const [showPastures, setShowPastures] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState<"featured" | "buy_gold">("featured");
  const [exitMode, setExitMode] = useState<null | "character_select" | "logout">(null);
  // Pending "really drop this?" confirmation. Holds the send closure rather than
  // the ids, so the dialog cannot drift from what the drop handler decided.
  const [pendingDrop, setPendingDrop] = useState<{
    name: string;
    quantity: number;
    send: () => void;
  } | null>(null);
  const [tamingTarget, setTamingTarget] = useState<{ entityId: string; name: string } | null>(null);
  // Taming needs you within a few tiles, but wild creatures wander. Confirming a
  // tame used to fire the attempt from wherever you stood, so it answered "Too
  // far to tame" while the animal walked away and nothing chased it. This holds
  // the pending tame while we walk into range.
  const [tamingApproach, setTamingApproach] = useState<{ entityId: string; name: string } | null>(
    null,
  );

  // Chase the creature until it is inside taming range, then fire the attempt.
  // MoveIntent with a targetEntityId follows a moving entity, so a wandering
  // animal no longer walks out from under the attempt.
  useEffect(() => {
    if (!tamingApproach) return;
    const startedAt = Date.now();
    let finished = false;
    const step = () => {
      if (finished) return;
      const socket = socketRef.current;
      const ent = gameState.entities.get(tamingApproach.entityId);
      if (!socket || !ent) {
        finished = true;
        setTamingApproach(null);
        return;
      }
      const dist = tileDistance(gameState.selfPosition, ent.position);
      if (dist <= 2.5) {
        finished = true;
        socket.send({ type: "TameAttemptIntent", targetEntityId: tamingApproach.entityId });
        setTamingApproach(null);
        return;
      }
      if (Date.now() - startedAt > 15000) {
        finished = true;
        setTamingApproach(null);
        return;
      }
      socket.send({
        type: "MoveIntent",
        targetX: ent.position.x,
        targetY: ent.position.y,
        targetEntityId: tamingApproach.entityId,
        stopAtRange: 2,
      });
    };
    step();
    const iv = setInterval(step, 400);
    return () => {
      finished = true;
      clearInterval(iv);
    };
  }, [tamingApproach]);
  // ONE inspect target for players, mobs and NPCs alike — they used to be two
  // separate states rendering two different panels, and the player one showed
  // less than the mob one. See components/hud/InspectPanel.tsx.
  const [inspectTargetId, setInspectTargetId] = useState<string | null>(null);
  const [duelRequestPrompt, setDuelRequestPrompt] = useState<DuelRequestPrompt | null>(null);
  const [duelWagerInput, setDuelWagerInput] = useState("0");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    options: ContextMenuOption[];
  } | null>(null);
  const [petRadial, setPetRadial] = useState<{
    x: number;
    y: number;
    entityId: string;
    name: string;
  } | null>(null);
  const [petFoodPicker, setPetFoodPicker] = useState<{ petInstanceId: string } | null>(null);
  const [petRename, setPetRename] = useState<{ petInstanceId: string; current: string } | null>(
    null,
  );
  const [petRenameInput, setPetRenameInput] = useState("");
  const [npcPromptScreen, setNpcPromptScreen] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  // World-ready gate: hold the loading screen until the world is actually
  // presentable (terrain chunks + object/tileset textures + self sprite), not
  // just until SpawnSelf places the player. Prevents spawning into a blank-green
  // map with amber object placeholders and frozen sprites.
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("connecting");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingFadingOut, setLoadingFadingOut] = useState(false);
  // Plain-language description of what the world-ready gate is currently waiting
  // on (terrain / objects / map / character). Shown on the splash so the load is
  // observable instead of a mystery spinner.
  const [loadingDetail, setLoadingDetail] = useState<string>("");
  const [loadingConfig, setLoadingConfig] = useState<LoadingScreenConfig | null>(null);
  // Null until a real name arrives (cache, then /public-config). NOT the engine's
  // own name: that would brand an unnamed creator's splash as "ED5 MMO Studio".
  const [loadingGameName, setLoadingGameName] = useState<string | null>(null);
  // Splash-from-cache: apply the last-seen authored loading screen immediately
  // (effect, not state initializer — the SSR pass has no localStorage and a
  // divergent first render would be a hydration mismatch).
  useEffect(() => {
    const cached = readCachedLoadingScreen();
    if (!cached) return;
    setLoadingConfig((cur) => cur ?? cached.loading);
    if (cached.gameName) {
      setLoadingGameName((cur) => cur ?? cached.gameName!);
    }
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "reconnecting" | "disconnected"
  >("connected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [showKeybinds, setShowKeybinds] = useState(false);
  const [cameraRotationDegrees, setCameraRotationDegrees] = useState(0);
  const [chatFocusNonce, setChatFocusNonce] = useState(0);

  // Subscribe to game state reactively — use revision counter for change detection
  const stateRevision = useSyncExternalStore(
    (cb) => gameState.subscribe(cb),
    () => gameState.revision,
    () => gameState.revision,
  );
  // Access gameState directly; stateRevision just triggers re-renders
  const state = gameState;
  // Drive the Pixi battle stage from the battle state. The stage covers the
  // world (which keeps ticking underneath), so leaving a battle needs no reload.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const battle = state.activeBattle;
    if (battle && battle.mode !== "realtime") engine.showPetBattleStage(battle);
    else engine.hidePetBattleStage();
  }, [state.activeBattle]);

  // A live trade opens beside the real inventory (bank/vault-style) so you drag
  // items from your bag into your offer — no bag is embedded in the trade window.
  useEffect(() => {
    if (state.tradeState === "active") setShowInventory(true);
  }, [state.tradeState]);

  // Opening a chest pulls the real inventory up beside it (Albion-style) so you
  // drag items between the chest and your bag — the chest no longer embeds a bag.
  useEffect(() => {
    if (state.activeChest) setShowInventory(true);
  }, [state.activeChest]);

  // Apply "Show/Hide Menu" event commands. The server pushes open/close
  // requests into gameState.pendingMenuCommands (via the EventShowMenu message);
  // drain and map each to its panel here. Runs on every state notify — cheap,
  // since the queue is empty in the common case.
  useEffect(() => {
    if (gameState.pendingMenuCommands.length === 0) return;
    const menuSetters: Record<string, (open: boolean) => void> = {
      character: setShowCharacter,
      inventory: setShowInventory,
      skills: setShowSkills,
      quests: setShowQuests,
      achievements: setShowAchievements,
      market: setShowMarket,
      store: setShowStore,
      currencyExchange: setShowCurrencyExchange,
      social: setShowSocial,
      mail: setShowMail,
      bank: setShowBank,
      worldMap: setShowWorldMap,
      pets: setShowPets,
      settings: setShowSettings,
      enchant: setShowEnchant,
      upgrade: setShowUpgrade,
      affixReroll: setShowAffixReroll,
      // Not a panel of its own — it opens the Fellowship panel on the Guild tab
      // with the create form already showing, so a world can hand out guild
      // founding from a story beat or an NPC instead of a standing button.
      guildCreate: (open: boolean) => {
        setShowSocial(open);
        if (open) {
          setSocialPanelTab("guild");
          setGuildCreateRequested((n) => n + 1);
        }
      },
    };
    const cmds = gameState.pendingMenuCommands.splice(0);
    for (const c of cmds) {
      if (c.action === "close_all") {
        for (const set of Object.values(menuSetters)) set(false);
        continue;
      }
      if (!c.menu) continue;
      const setter = menuSetters[c.menu];
      if (!setter) continue;
      const open = c.action === "open";
      setter(open);
      if (open && c.menu === "currencyExchange") {
        socketRef.current?.send({ type: "CurrencyExchangeOpenIntent" });
      }
      if (c.menu === "market") {
        // Viewer registration — the server only streams the market order list
        // to registered viewers.
        socketRef.current?.send({ type: open ? "MarketOpenIntent" : "MarketCloseIntent" });
      }
      if (open && c.menu === "store") {
        socketRef.current?.send({ type: "ItemShopBrowseIntent" });
        socketRef.current?.send({ type: "GoldStoreBrowseIntent" });
      }
    }
  }, [stateRevision]);

  // Creator-defined HUD element layout (visibility). Re-render on customization
  // change; an absent/visible!==false element stays shown (default behavior).
  const uiRevision = useSyncExternalStore(
    subscribeUICustomization,
    getUICustomizationRevision,
    getUICustomizationRevision,
  );
  const hudLayout = getEffectiveUICustomization().layout;
  /**
   * A turn-based pet battle takes the whole screen: its stage is drawn inside the
   * world canvas, so every world HUD panel would otherwise sit on top of the
   * battlers and the move grid. Suppress the world chrome for that mode only —
   * a real-time battle deliberately keeps the world (and its HUD) visible.
   */
  /**
   * The instances window auto-opens when something happens — a ready check, a
   * queue, entering a copy — but the player can then dismiss it.
   *
   * It used to RENDER off `instanceState !== null`, so for the whole of a match
   * it sat pinned dead-centre over the arena and its ✕ did nothing (the close
   * only cleared `showInstances`, which the condition ignored). Opening on the
   * transition keeps it discoverable without it owning the screen.
   */
  const instanceCue =
    `${state.instanceReadyCheck ? "ready" : ""}|` +
    `${state.instanceState ? "in" : ""}|` +
    `${state.instanceQueue ? "queue" : ""}`;
  const prevInstanceCue = useRef("||");
  useEffect(() => {
    if (instanceCue === prevInstanceCue.current) return;
    prevInstanceCue.current = instanceCue;
    // Queued or being asked to ready up: surface the window, that IS the task.
    // Actually INSIDE the copy: get out of the way. The match is the screen now,
    // and the browser sitting over it hid the countdown and the map behind a
    // list of arenas you had already chosen from.
    if (state.instanceState) setShowInstances(false);
    else if (instanceCue !== "||" && !state.isDead) setShowInstances(true);
  }, [instanceCue, state.instanceState, state.isDead]);

  const battleOwnsScreen = state.activeBattle?.mode === "turn_based";
  const hudVisible = (id: string) =>
    hudLayout[id]?.visible !== false && (!battleOwnsScreen || BATTLE_SAFE_PANELS.has(id));
  // Creator theming for the selected-target panel (UI editor → Panels → Target Frame).
  const targetChrome = usePanelChrome("targetFrame");
  // Whether a built-in panel is switched on for this project (UI editor →
  // Panels → "Panel enabled"). An unconfigured panel is on, so an untouched
  // project behaves exactly as before. This gates both the panel itself and the
  // control that opens it, so a disabled panel is unreachable, not just hidden.
  const panelOn = (id: string) =>
    isUiPanelEnabled(id) && (!battleOwnsScreen || BATTLE_SAFE_PANELS.has(id));
  // Whether a game system is enabled in this world (runtime, per-world flags
  // delivered via FeatureFlagsSync). Gate a system's HUD on this so a disabled
  // system shows no UI. Reactive via stateRevision (setFeatures → notify).
  const featureOn = (flag: GameFeature) => state.isFeatureEnabled(flag);

  // The crafting station the panel should show: a world crafting-station entity
  // the player walked up to, else the station an NPC opened for us (the server's
  // authored value, delivered via CraftingStationOpen). Closing clears both.
  const activeCraftingStationType =
    craftingStationType ?? (state.npcCraftingStationType as CraftingStationType | null);
  /**
   * Tier window for a recipe: the crafter's level on that recipe's skill against
   * that skill's authored ladder, capped by the station. Same shared resolver the
   * server uses — this is only to shape the UI; the server re-validates the craft.
   * Null when the skill authors no ladder, which hides the selector entirely.
   */
  const craftTierRangeFor = (recipe: { requiredSkillId: string }) => {
    const ladder = state.skillDefs.get(recipe.requiredSkillId)?.craftTierLadder ?? null;
    if (!ladder || ladder.length === 0) return null;
    const stationCap = state.npcCraftingStationTier > 0 ? state.npcCraftingStationTier : null;
    return resolveCraftTier({
      skillLevel: state.skills.get(recipe.requiredSkillId)?.level ?? 0,
      ladder,
      stationCap,
      worldMaxTier: state.worldMaxTier ?? 8,
    });
  };

  const closeCraftingPanel = () => {
    setCraftingStationType(null);
    setCraftingStationEntityId(null);
    gameState.npcCraftingStationType = null;
    gameState.npcCraftingStationTier = 0;
    gameState.notify();
  };

  // TopBar menu buttons to hide, either because their system is disabled for this
  // world (feature flag) or because the creator switched the panel off in the UI
  // editor. Keyed by the button's handler name. Memoized on stateRevision +
  // uiRevision so TopBar (a custom-memoized component) only re-renders when the
  // gate set actually changes.
  const hiddenTopBarHandlers = useMemo(() => {
    const gate: Array<[string, GameFeature]> = [
      ["onQuests", "quests"],
      ["onBuildMode", "housing"],
      ["onClaims", "housing"],
      // Farming needs both: crops are planted on land claims, so the housing
      // feature gates the ground the farming feature acts on.
      ["onFarming", "housing"],
      ["onFarming", "farming"],
      ["onPastures", "housing"],
      ["onPets", "pets"],
      ["onBreeding", "pets"],
      ["onMarket", "market"],
      ["onGuild", "guilds"],
      ["onFriends", "friends"],
      ["onMail", "mail"],
      ["onBank", "bank"],
      ["onPremiumShop", "premiumShop"],
      ["onEnchant", "enchanting"],
      ["onUpgrade", "equipmentUpgrade"],
      ["onAffixReroll", "affixReroll"],
      ["onCraftingWindow", "crafting"],
      ["onCalendar", "calendar"],
    ];
    // Handler → the PANEL_CATALOG id it opens. A disabled panel loses its button
    // too, so it can't be opened from the top bar at all.
    const panelGate: Array<[string, string]> = [
      ["onInventory", "inventory"],
      ["onSkills", "skills"],
      ["onAbilities", "abilities"],
      ["onCharacter", "character"],
      ["onGuild", "guild"],
      ["onMarket", "market"],
      ["onPets", "petParty"],
      ["onBreeding", "breeding"],
      ["onQuests", "questLog"],
      ["onBuildMode", "buildMode"],
      ["onClaims", "claims"],
      ["onFarming", "farming"],
      ["onPastures", "pasture"],
      ["onMail", "mail"],
      ["onBank", "bank"],
      ["onCrafting", "crafting"],
      ["onCraftingWindow", "crafting"],
      ["onEnchant", "enchant"],
      ["onUpgrade", "upgrade"],
      ["onAffixReroll", "affixReroll"],
      ["onPremiumShop", "premiumShop"],
      ["onSettings", "settings"],
      ["onCalendar", "calendar"],
    ];
    const hidden = new Set<string>();
    for (const [handler, flag] of gate) {
      if (!state.isFeatureEnabled(flag)) hidden.add(handler);
    }
    for (const [handler, panelId] of panelGate) {
      if (!isUiPanelEnabled(panelId)) hidden.add(handler);
    }
    return hidden;
  }, [stateRevision, uiRevision]);

  const skillsPanelOpenRef = useRef(showSkills);
  const skillsPanelTabRef = useRef<SkillsPanelTab>(skillsPanelTab);
  const socialPanelOpenRef = useRef(showSocial);
  const socialPanelTabRef = useRef<SocialPanelTab>(socialPanelTab);
  const chatHudVisibleRef = useRef(hudVisible("chat"));
  skillsPanelOpenRef.current = showSkills;
  skillsPanelTabRef.current = skillsPanelTab;
  socialPanelOpenRef.current = showSocial;
  socialPanelTabRef.current = socialPanelTab;
  chatHudVisibleRef.current = hudVisible("chat");

  const openSkillsPanel = useCallback((tab: SkillsPanelTab) => {
    setSkillsPanelTab(tab);
    setShowSkills(true);
  }, []);

  /**
   * Open inspect on any entity. Players are the only kind that needs a server
   * round trip: their entity snapshot carries `equipment` as slot → sprite asset
   * id, which names no item, while mobs and NPCs already broadcast real item
   * definition ids. Requesting on open (rather than fattening every snapshot)
   * keeps the cost to one small reply per inspect.
   */
  const openInspect = useCallback((entityId: string) => {
    gameState.inspectedPlayer = null;
    const entity = gameState.entities.get(entityId);
    if (entity?.type === EntityType.Player) {
      gameState.pendingInspectEntityId = entityId;
      socketRef.current?.send({ type: "InspectPlayerIntent", targetEntityId: entityId });
    } else {
      gameState.pendingInspectEntityId = null;
    }
    setInspectTargetId(entityId);
  }, []);

  const closeInspect = useCallback(() => {
    setInspectTargetId(null);
    gameState.pendingInspectEntityId = null;
    gameState.inspectedPlayer = null;
  }, []);

  const openSocialPanel = useCallback((tab: SocialPanelTab) => {
    setSocialPanelTab(tab);
    setShowSocial(true);
  }, []);

  /** Ask the server for a calendar month, offset from today's. Stable identity —
   *  the panel re-requests on every change of this callback. */
  const requestCalendarPage = useCallback((monthOffset: number) => {
    socketRef.current?.send({ type: "CalendarPageIntent", monthOffset });
  }, []);

  /** Ask the server to fast travel. Every rule (discovered, cost, level, combat)
   *  is enforced server-side; a refusal comes back as an Error message. */
  const requestFastTravel = useCallback((locationId: string) => {
    socketRef.current?.send({ type: "FastTravelIntent", locationId });
    // Close whichever surface asked — you don't want a map sitting over the
    // world you just travelled to. A refusal still arrives as an Error toast.
    setShowLocations(false);
    setShowWorldMap(false);
    gameState.travelOffer = null;
  }, []);

  /** Closing the map ends any NPC's standing offer, matching the server's grant. */
  const closeWorldMap = useCallback(() => {
    setShowWorldMap(false);
    gameState.travelOffer = null;
  }, []);

  // An NPC offered passage: pop the map open on the stamp the handler set.
  // Nothing to pop open in a world whose creator switched the map panel off —
  // the offer still stands, it just has no map to show it on.
  const travelOfferStamp = state.travelOfferOpenedAt;
  useEffect(() => {
    if (travelOfferStamp > 0 && isUiPanelEnabled("worldMap")) setShowWorldMap(true);
  }, [travelOfferStamp]);

  // Custom-menu button actions (dispatched by CustomMenuRenderer as window events):
  // "open panel" ids map to the matching panel toggle; "command" is sent to chat.
  useEffect(() => {
    const onPanel = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      switch (id) {
        case "panel.inventory":
          setShowInventory((v) => !v);
          break;
        case "panel.character":
          setShowCharacter((v) => !v);
          break;
        case "panel.skills":
          openSkillsPanel("skills");
          break;
        case "panel.abilities":
          openSkillsPanel("abilities");
          break;
        case "panel.worldMap":
          if (isUiPanelEnabled("worldMap")) setShowWorldMap((v) => !v);
          break;
        case "panel.locations":
          if (isUiPanelEnabled("locations")) setShowLocations((v) => !v);
          break;
        case "panel.quests":
          setShowQuests((v) => !v);
          break;
        case "panel.achievements":
          setShowAchievements((v) => !v);
          break;
        case "panel.pets":
          setShowPets((v) => !v);
          break;
        case "panel.market":
          setShowMarket((v) => {
            const next = !v;
            socketRef.current?.send({ type: next ? "MarketOpenIntent" : "MarketCloseIntent" });
            return next;
          });
          break;
        case "panel.store":
          setShowStore((v) => !v);
          break;
        case "panel.build":
          setShowBuildMode((v) => {
            const next = !v;
            gameState.buildModeActive = next;
            gameState.notify();
            return next;
          });
          break;
        case "social.guild":
          openSocialPanel("guild");
          break;
        case "social.friends":
          openSocialPanel("friends");
          break;
        case "panel.enchant":
          setShowEnchant((v) => !v);
          break;
        case "panel.upgrade":
          setShowUpgrade((v) => !v);
          break;
        case "panel.affixReroll":
          setShowAffixReroll((v) => !v);
          break;
        case "panel.crafting":
          // Opens the crafting window directly (all stations) — same panel the
          // dev button shows; render is feature/panel-gated downstream.
          setShowCraftingDev((v) => !v);
          break;
        case "panel.calendar":
          setShowCalendar((v) => !v);
          break;
      }
    };
    const onCommand = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (!text) return;
      socketRef.current?.send({
        type: "ChatSend",
        channel: gameState.activeChatChannel ?? "say",
        // The HUD command bus is unbounded input — cap to the schema's 500-char limit.
        text: text.slice(0, 500),
      });
    };
    window.addEventListener("ed5-hud-panel-action", onPanel);
    window.addEventListener("ed5-hud-command", onCommand);
    return () => {
      window.removeEventListener("ed5-hud-panel-action", onPanel);
      window.removeEventListener("ed5-hud-command", onCommand);
    };
  }, [openSkillsPanel, openSocialPanel]);

  useEffect(() => {
    engineRef.current?.setCameraRotationMode(state.playerControls.movement.cameraRotation);
    engineRef.current?.applyPlayerControlZoomConfig(false);
  }, [stateRevision, state.playerControls.movement.cameraRotation, state.playerControls.zoom]);

  const sendAdminCommand = useCallback((command: AdminCommand) => {
    socketRef.current?.send({
      type: "AdminCommandIntent",
      requestId: crypto.randomUUID(),
      command,
    });
  }, []);

  const openDuelRequestPrompt = useCallback((target: DuelRequestPrompt) => {
    setDuelWagerInput("0");
    setDuelRequestPrompt(target);
  }, []);

  const sendDuelRequest = useCallback(() => {
    if (!duelRequestPrompt) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      gameState.addChatMessage("system", "System", "Cannot send duel request while disconnected.");
      gameState.notify();
      return;
    }

    const wagerGold = Math.max(0, Math.floor(Number(duelWagerInput) || 0));
    socket.send({
      type: "DuelRequestIntent",
      targetEntityId: duelRequestPrompt.targetEntityId,
      wagerGold,
    });
    setDuelRequestPrompt(null);
  }, [duelRequestPrompt, duelWagerInput]);

  const performTouchControlActions = useCallback((actions: PlayerControlActionId[]) => {
    return performControlActionsRef.current(actions);
  }, []);

  /**
   * Release for hold-style touch buttons. Camera rotation is the only one today:
   * its press starts the world spinning and there is no keyup or window blur on
   * a phone to stop it, so the button has to say when the finger lifts.
   */
  const releaseTouchControlActions = useCallback((actions: PlayerControlActionId[]) => {
    if (actions.includes("camera.rotateLeft") || actions.includes("camera.rotateRight")) {
      engineRef.current?.setCameraRotating(null);
    }
  }, []);

  /**
   * True when the on-screen touch buttons can stand in for the desktop hotbar,
   * which is what lets the bar be hidden on phone-width screens. Requires the
   * touch overlay to be on AND to expose at least one visible hotbar slot —
   * a creator who deleted every hotbar button from the touch layout keeps the
   * bar, because the alternative is a phone with no way to use an ability.
   */
  const touchHotbarReplacesBar = useMemo(() => {
    const touch = state.playerControls.touch;
    if (!touch.enabled) return false;
    return touch.buttonLayout.some(
      (button) => button.visible && button.actionId.startsWith("hotbar."),
    );
  }, [state.playerControls]);

  const resetCameraRotation = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resetCameraRotation();
    setCameraRotationDegrees(engine.getCameraRotationDegrees());
  }, []);

  const sendSocialInviteResponse = useCallback(
    (invite: SocialInvite, decision: "accept" | "decline") => {
      const socket = socketRef.current;
      if (!socket) return;

      if (invite.kind === "party") {
        if (decision === "accept") {
          if (invite.partyId) {
            socket.send({ type: "PartyAcceptIntent", partyId: invite.partyId });
          }
        } else {
          socket.send({ type: "PartyDeclineIntent" });
        }
        return;
      }

      if (invite.kind === "guild") {
        socket.send({
          type: "GuildActionIntent",
          action: decision === "accept" ? "accept" : "decline",
        });
        return;
      }

      if (invite.kind === "friend") {
        if (!invite.fromId) return;
        socket.send({
          type: decision === "accept" ? "FriendAcceptIntent" : "FriendDeclineIntent",
          targetCharacterId: invite.fromId,
        });
        return;
      }

      if (invite.kind === "raid") {
        if (decision === "accept") {
          if (invite.raidId) socket.send({ type: "RaidAcceptIntent", raidId: invite.raidId });
        } else {
          socket.send({ type: "RaidDeclineIntent" });
        }
        return;
      }

      // Alliance invites had NO branch here at all: the toast's Accept sent
      // nothing, then dismissed the invite — silently discarding it. The server
      // resolves the pending invite by the acting player's guild, so no id
      // needs to travel.
      if (invite.kind === "alliance") {
        socket.send({
          type: "AllianceActionIntent",
          action: decision === "accept" ? "accept" : "decline",
        });
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      gameState.pruneExpiredSocialInvites();
      const settings = getGameSettings();
      if (!settings.autoDeclineSocialInvites) return;
      if (gameState.pendingSocialInvites.length === 0) return;

      const invites = [...gameState.pendingSocialInvites];
      for (const invite of invites) {
        sendSocialInviteResponse(invite, "decline");
        gameState.removeSocialInvite(invite.id);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sendSocialInviteResponse]);

  useEffect(() => {
    if (!state.adminPanelEnabled && showAdmin) {
      setShowAdmin(false);
    }
  }, [showAdmin, state.adminPanelEnabled]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let destroyed = false;

    async function boot() {
      try {
        // 0. Dev-only main-thread perf instrumentation (long tasks + frame pacing).
        //    See docs/CLIENT_MULTITHREADING_PLAN.md; inspect via window.__ed5Perf.
        if (process.env.NODE_ENV === "development" && !perfMonitorRef.current) {
          perfMonitorRef.current = startClientPerfMonitor();
        }

        // Restore accessibility toggles (high-contrast / large-text / reduced-motion)
        // from local settings before the HUD paints. UIConfigSync re-applies later.
        applyAccessibilityClasses();

        // Bring up the player-settings layer: re-apply UI scale and chat text
        // size, start tracking the window's display mode (and bind F11), and
        // wire mute-on-focus-loss. All of it has to work whether or not the
        // player ever opens the Settings panel.
        initPlayerSettings();

        // Dry Run (serverless map preview): /play?dryrun=1&bundle=<url> boots
        // against a LocalSimSocket fed by the editor's bundle — there is no
        // game server, so ws-URL resolution, /public-config and auth are all
        // skipped and the media base comes from the bundle instead.
        const dryRun = getDryRunParams();
        setIsDryRun(dryRun !== null);

        const wsUrl = dryRun ? "" : await resolveBrowserGameServerWsUrl();

        if (!dryRun) {
          // Set the game-server HTTP base early so the loading screen can resolve
          // its (authored) background/logo media before the socket connects.
          const gameServerHttpUrl = deriveGameServerHttpUrl(wsUrl);
          gameState.gameServerHttpUrl = gameServerHttpUrl;

          // Warm the atlas manifests NOW (M4b): the first chunk's texture ensure
          // awaits the same deduped promise, so this takes the manifest fetch off
          // the first-chunk critical path instead of serializing behind it.
          // Best-effort — a failure just means standalone textures.
          void atlasResolver.fetchManifests();

          // Fetch the authored loading screen for the FIRST paint (pre-auth, public,
          // CORS *). Best-effort: a null/failed response renders the procedural
          // default. UIConfigSync upgrades this live once connected.
          void fetch(`${gameServerHttpUrl}/public-config`)
            .then((r) => (r.ok ? r.json() : null))
            .then((cfg) => {
              if (destroyed || !cfg) return;
              if (cfg.loading) setLoadingConfig(cfg.loading as LoadingScreenConfig);
              if (typeof cfg.gameName === "string" && cfg.gameName)
                setLoadingGameName(cfg.gameName);
              writeCachedLoadingScreen(
                (cfg.loading as LoadingScreenConfig) ?? null,
                typeof cfg.gameName === "string" && cfg.gameName ? cfg.gameName : undefined,
              );
              // Creator-assigned sounds — applied before the world loads so UI
              // audio works on the splash/menus too, not just in-world.
              if (cfg.soundBindings) setSoundBindings(cfg.soundBindings);
            })
            .catch(() => {
              /* public-config unavailable (older server / offline) → procedural default */
            });
        }

        // SohbeX: authenticate BEFORE Pixi/WebGL so unauthenticated boots
        // never allocate a GPU context (Aw Snap / Wine OOM risk).
        if (!dryRun) {
          const params = new URLSearchParams(window.location.search);
          if (params.get("guest") === "true") {
            window.location.replace("/login");
            return;
          }
          let earlyToken = "";
          try {
            earlyToken =
              localStorage.getItem(`${GameConfig.localStoragePrefix}:local-auth-token`) || "";
          } catch {
            /* ignore */
          }
          if (!earlyToken) {
            try {
              await loadAuthConfig();
              const supabase = createClient();
              if (supabase) {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.access_token) earlyToken = data.session.access_token;
              }
            } catch {
              /* ignore */
            }
          }
          if (!earlyToken) {
            window.location.replace("/login");
            return;
          }
        }
        try {
          // Soft-cap DPR for Wine/ED5 stability (Heavy Aw Snap guidance).
          (window as unknown as { __ed5DprCap?: number }).__ed5DprCap = Math.min(
            window.devicePixelRatio || 1,
            1.25,
          );
        } catch {
          /* ignore */
        }

        // 1. Create engine
        const engine = new GameEngine();
        await engine.init(canvasRef.current!);
        try {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.addEventListener(
              "webglcontextlost",
              (ev) => {
                ev.preventDefault();
                setError(
                  "Grafik bağlamı kayboldu (WebGL). Sayfayı yenile veya Dünyaya Gir’i tekrar dene.",
                );
                setLoading(false);
              },
              { once: false },
            );
          }
        } catch {
          /* ignore */
        }
        if (destroyed) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;
        engine.setCameraRotationMode(gameState.playerControls.movement.cameraRotation);
        engine.applyPlayerControlZoomConfig(true);
        engine.onCameraRotationChange = setCameraRotationDegrees;
        setCameraRotationDegrees(engine.getCameraRotationDegrees());
        coreEventState.setEngine(engine);
        if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
          (window as any).__ed5Debug = { engine, gameState };
        }

        // 2. Connect socket — check for Supabase session first (OAuth return), then local auth token, then guest token
        const selectedCharacterId =
          typeof window !== "undefined"
            ? (new URLSearchParams(window.location.search).get("character") ?? "")
            : "";
        const isGuestEntry =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("guest") === "true";

        let authToken = "";
        let guestToken = "";
        let guestResume: { name?: string; templateId?: string | null; classId?: string | null } =
          {};
        try {
          // Guest identity is stored per game — resolve which game this page is
          // playing before touching it, so game A's guest never enters game B.
          await ensureGuestStorageScope();
          guestToken = isGuestEntry ? selectedCharacterId || getGuestToken() : getGuestToken();
          if (isGuestEntry && selectedCharacterId) {
            setGuestToken(selectedCharacterId);
          }
          if (isGuestEntry && guestToken) {
            const record = readGuestCharacters().find((entry) => entry?.id === guestToken);
            if (record?.name) {
              guestResume = {
                name: String(record.name),
                templateId: typeof record.templateId === "string" ? record.templateId : null,
                classId: typeof record.classId === "string" ? record.classId : null,
              };
            }
          }
        } catch {
          /* ignore */
        }

        // Check if user has an active Supabase session (e.g. returned from Google
        // OAuth). Dry Run needs no identity at all — the sim fabricates a guest.
        if (!dryRun && !isGuestEntry) {
          try {
            await loadAuthConfig();
            const supabase = createClient();
            if (supabase) {
              const { data } = await supabase.auth.getSession();
              if (data?.session?.access_token) {
                authToken = data.session.access_token;
                // Keep guestToken so server can migrate the guest character to this account
              }
            }
          } catch {
            /* Supabase not configured or unavailable */
          }

          // Fallback: check for a local auth JWT (from local/PGLite auth)
          if (!authToken) {
            try {
              const localToken = localStorage.getItem(
                `${GameConfig.localStoragePrefix}:local-auth-token`,
              );
              if (localToken) authToken = localToken;
            } catch {
              /* ignore */
            }
          }
        }

        // The ONE construction-site branch for Dry Run. LocalSimSocket
        // implements the exact GameSocket public surface; the cast only erases
        // GameSocket's private worker fields, which no caller can reach.
        const socket = dryRun
          ? (new LocalSimSocket(dryRun.bundleUrl) as unknown as GameSocket)
          : new GameSocket(wsUrl, authToken, guestToken, selectedCharacterId, guestResume);
        socketRef.current = socket;
        const noStarterError =
          "Cannot enter world: no playable starter map is configured. In the admin editor, place a zone in World Layout and set its Starting Location.";

        // Store game server HTTP URL on gameState so paperdoll can fetch sprites.
        // (Dry Run: LocalSimSocket repoints this at the bundle's mediaBaseUrl
        // during connect() — there is no game server to derive from.)
        if (!dryRun) {
          gameState.gameServerHttpUrl = deriveGameServerHttpUrl(wsUrl);
        }

        // Connection lifecycle — drive the reconnection overlay
        socket.onConnectionEvent((event) => {
          if (destroyed) return;
          if (event.type === "open") {
            setConnectionStatus("connected");
            setReconnectAttempt(0);
            setLoadingDetail("");
          } else if (event.type === "retrying") {
            // First connect hasn't succeeded yet — the server may be
            // mid-restart (managed image roll). Show honest progress on the
            // splash instead of a frozen "Connecting…" at 0%.
            setLoadingDetail(`Server not responding — retrying (${event.attempt}/${event.max})…`);
          } else if (event.type === "close") {
            if (event.code === 4001) {
              setLoading(false);
              setConnectionStatus("disconnected");
              setError(noStarterError);
              return;
            }
            // 4429 = the server's per-IP connection cap. The worker deliberately
            // does NOT retry (each attempt would occupy another slot), so show
            // what happened instead of spinning the reconnect overlay forever.
            if (event.code === 4429) {
              setLoading(false);
              setConnectionStatus("disconnected");
              setError(
                "Too many connections from your network. Close other game tabs or editor windows and try again in a few seconds.",
              );
              return;
            }
            if (!event.manual) {
              setConnectionStatus("reconnecting");
              setReconnectAttempt((a) => a + 1);
            } else {
              setConnectionStatus("disconnected");
            }
          }
        });

        socket.onAny((msg) => {
          if (destroyed) return;
          const raw = msg as any;
          if (raw?.type === "Kicked") {
            setLoading(false);
            setConnectionStatus("disconnected");
            const reason = String(raw.reason ?? "").trim();
            setError(reason.length > 0 ? reason : noStarterError);
            socket.disconnect();
            return;
          }
          if (raw?.type === "Error") {
            const code = String(raw.code ?? "");
            const message = String(raw.message ?? "");
            const lower = message.toLowerCase();
            if (
              code === "NO_VALID_SPAWN" ||
              code === "PAYLOAD_TOO_LARGE" ||
              code === "SERIALIZATION_FAILED" ||
              lower.includes("no playable map configured") ||
              lower.includes("set a player spawn location")
            ) {
              setLoading(false);
              setConnectionStatus("disconnected");
              setError(message || noStarterError);
              socket.disconnect();
              return;
            }
          }
          handleServerMessage(msg, engine);
          // After SpawnSelf/ZoneChanged finishes processing (zoneBounds and selfPosition are now set),
          // request chunks at the correct player position.
          if (msg.type === "SpawnSelf" || msg.type === "ZoneChanged") {
            requestAllZoneChunks(socket);
            requestMapOverview(socket);
          }
          // Zone/portal transition: re-arm the world-ready gate so the loading
          // screen covers the new zone's terrain/texture stream-in — same fix as
          // initial spawn (handleZoneChanged just cleared chunks, so the world is
          // momentarily blank green with placeholders). Definitions + the self
          // sprite persist across zones, so the gate mainly re-awaits the new
          // viewport chunks. Skipped if we somehow haven't revealed yet.
          if (msg.type === "ZoneChanged" && gateRevealedRef.current) {
            gateRevealedRef.current = false;
            gateDeadlineRef.current = Date.now() + WORLD_READY_MAX_MS;
            gateReadinessScoreRef.current = -1;
            gateProgressAtRef.current = Date.now();
            setLoadingFadingOut(false);
            setLoadingPhase("world");
            setLoadingProgress(0.4);
            setLoading(true);
          }
          // After TerrainReload, the message handler clears the chunk cache.
          // Re-request all zone chunks so the updated terrain appears immediately.
          if (msg.type === "TerrainReload") {
            requestAllZoneChunks(socket);
            requestMapOverview(socket);
          }
        });

        // Attach client plugin system to the socket
        const clientPlugins = getClientPluginSystem();
        clientPlugins.attach(socket);

        // Load client-side plugin scripts when the server sends them
        socket.on("ClientPluginsLoad", (msg: any) => {
          if (destroyed) return;
          if (msg.plugins && msg.plugins.length > 0) {
            clientPlugins.loadPlugins(msg.plugins);
          }
        });

        // Apply the project's creator-defined UI customization (theme/scale).
        socket.on("UIConfigSync", (msg: any) => {
          if (destroyed) return;
          applyUICustomization(msg.customization);
          // Upgrade the loading screen live (covers re-authored splash while the
          // player is still on it, and the next connect).
          setLoadingConfig((msg.customization?.loading as LoadingScreenConfig) ?? null);
          writeCachedLoadingScreen((msg.customization?.loading as LoadingScreenConfig) ?? null);
        });

        // Adopt the world's effective feature flags so the HUD hides any system
        // the creator turned off (survival, pvp, pets…). Per-world overrides are
        // already resolved server-side.
        socket.on("FeatureFlagsSync", (msg: any) => {
          if (destroyed) return;
          state.setFeatures(msg.features ?? {});
          // An older server omits this entirely, which is exactly the signal we
          // want: no charge support, so aiming falls back to sending one plain
          // AbilityIntent on release rather than a charge/release pair the
          // server would drop (and count toward kicking the player).
          state.serverCapabilities = new Set<string>(
            Array.isArray(msg.serverCapabilities) ? msg.serverCapabilities : [],
          );
        });

        socket.on("SpawnSelf", () => {
          if (destroyed) return;
          // Do NOT drop the loading screen here — SpawnSelf only places the
          // player; terrain chunks, object/tileset textures and the self sprite
          // are still streaming. The world-ready gate (below) reveals the world
          // once it's actually presentable.
          setLoadingPhase("world");
          // No AdminAuthRequest here: SpawnSelf already carries adminRole +
          // adminPanelEnabled, and the server pushes AdminAuthState during the
          // same enter-world sequence. Asking again only produced a second
          // AdminAuthState — which is why every guest was told "Admin access
          // denied" twice on connect.
        });

        socket.on("GuestConverted", (msg) => {
          if (destroyed) return;
          const gcMsg = msg as any;
          if (gcMsg.success) {
            setSignupSuccess(true);
            setSignupError(null);
          } else {
            setSignupError(gcMsg.error ?? "Signup failed");
          }
        });

        // Build mode: place the armed OBJECT material at a clicked (valid)
        // tile. The engine validated bounds/occupancy and carries the armed
        // item + rotation; the server resolves the item's building descriptor
        // to the map object and consumes the item.
        engine.onPlaceObjectTile = (tx, ty) => {
          const build = engineRef.current?.objectBuild;
          if (!build) return;

          // Crafting stations are their own thing: they become a live entity
          // with fuel, a fee and an owner, not a decorative map object. They
          // also place in WORLD coordinates and validate their own claim
          // rights, so they don't need (or want) plot-local ones.
          const buildDef = gameState.itemDefs.get(build.itemDefinitionId);
          if (itemPlaceableKind(buildDef) === "station") {
            const stack = gameState.inventory.find(
              (it) => it.definitionId === build.itemDefinitionId && (it.quantity ?? 0) > 0,
            );
            if (!stack) return;
            socketRef.current?.send({
              type: "PlaceCraftingStationIntent",
              itemInstanceId: stack.id,
              x: tx,
              y: ty,
              context: "overworld",
            });
            return;
          }

          const claim = gameState.currentClaim;
          if (!claim?.bounds) return;
          socketRef.current?.send({
            type: "BuildPlaceIntent",
            plotId: claim.id,
            context: "overworld",
            entityType: "building",
            definitionId: build.itemDefinitionId,
            localX: tx - claim.bounds.x,
            localY: ty - claim.bounds.y,
            rotation: build.rotation,
          });
        };

        // Build mode: paint drag released — send ONE batched paint intent with
        // plot-local coords. The engine's tileBuild carries the armed material.
        engine.onPaintTiles = (tiles, erase) => {
          const build = engineRef.current?.tileBuild;
          const claim = gameState.currentClaim;
          if (!build || !claim?.bounds) return;
          socketRef.current?.send({
            type: "BuildPaintIntent",
            plotId: claim.id,
            context: "overworld",
            tiles: tiles.map((t) => ({ x: t.x - claim.bounds!.x, y: t.y - claim.bounds!.y })),
            level: 0,
            layer: build.layer,
            tilesetId: erase ? null : build.tilesetId,
            variant: 0,
            itemDefinitionId: build.itemDefinitionId,
            tool: erase ? "erase" : build.tool === "rect" ? "rect" : "pencil",
          });
        };

        // Build mode: remove tool — click one of your structures to remove it
        // (the server refunds the consumed item).
        engine.onRemovePlacedEntity = (placedEntityId) => {
          const claim = gameState.currentClaim;
          if (!claim) return;
          socketRef.current?.send({
            type: "BuildRemoveIntent",
            plotId: claim.id,
            placedEntityId,
            context: "overworld",
          });
        };

        // Build mode: place an edge wall when a wall material is armed. Walls
        // are inventory items — the server consumes the item + canonicalises the
        // side to the owning edge. Coords are plot-local (world − claim bounds).
        engine.onPlaceWallEdge = (tx, ty, side) => {
          const mat = engine.wallBuild;
          const claim = gameState.currentClaim;
          if (!mat || !claim?.bounds) return;
          socketRef.current?.send({
            type: "BuildWallIntent",
            plotId: claim.id,
            context: "overworld",
            x: tx - claim.bounds.x,
            y: ty - claim.bounds.y,
            side,
            level: 0,
            wallDefId: mat.wallDefId,
            itemDefinitionId: mat.itemDefinitionId,
          });
        };

        // When the LMB-slot ability is a skill shot (free-aim, no target lock),
        // a left-click fires it toward the clicked point instead of locking onto
        // a target. Returns true if it fired (caller should stop). Suppressed
        // while on GCD so the player can still reposition between shots.
        const fireLmbSkillShotAt = (tx: number, ty: number): boolean => {
          const lmb = gameState.abilities[SLOT_LMB];
          if (!lmb || lmb.requiresTarget !== false) return false; // not a skill shot
          if (gameState.isDead) return false;
          if (gameState.globalCooldown > 0) return false; // on cooldown — let the click move/select
          gameState.autoAttackTargetId = null;
          socket.send({
            type: "AbilityIntent",
            abilityId: lmb.id,
            targetId: null,
            targetPosition: { x: tx, y: ty },
          });
          return true;
        };

        // Click to move — with client-side prediction
        // Also stop auto-attack when clicking the ground
        engine.onTileClick = (tx, ty, movementMode, isHoldRepeat) => {
          if (gameState.isDead) return false; // Can't move while dead
          // Block movement while an event is processing
          if (coreEventState.processingEventId) return false;
          void isHoldRepeat;

          // `confirm` mode: the click IS the trigger, and it fires at the point
          // clicked rather than wherever the cursor drifted to. Consuming the
          // click matters — otherwise committing a spell also walks you into it.
          if (aimRef.current && !isHoldRepeat) {
            if (fireAim({ x: tx, y: ty })) return true;
          }
          const controls = gameState.playerControls.movement;
          const canInteractByClick = controls.clickToInteract && !controls.interactRequiresBinding;

          // Check if there's an action_button event on this tile
          const tileEvent = coreEventState.getActionEventAt(tx, ty);
          if (tileEvent && canInteractByClick) {
            if (coreEventState.isClientEvent(tileEvent.id)) {
              coreEventState.startClientEvent(tileEvent.id);
            } else {
              socket.send({ type: "EventInteract", eventId: tileEvent.id });
            }
            return false;
          }

          // Check if there's an interactive world object on this tile
          const interactiveObj = engine.getInteractiveObjectAt(tx, ty);
          if (interactiveObj && canInteractByClick) {
            socket.send({
              type: "WorldObjectInteractIntent",
              tileX: interactiveObj.originX,
              tileY: interactiveObj.originY,
            });
            return false;
          }

          // Left-click always moves (even when the LMB ability is a skill shot —
          // the skill shot is bound to right-click so the player can still walk).
          if (!controls.clickToMove) return false;

          // Stop auto-attacking when player clicks ground to move
          gameState.autoAttackTargetId = null;
          socket.send({ type: "MoveIntent", targetX: tx, targetY: ty, movementMode });
          return true;
        };

        // Right-click on ground:
        //   • hoe equipped on your claim → till soil
        //   • LMB ability is a skill shot → fire it toward the clicked tile
        //     (skill shots live on right-click so left-click stays free to move)
        //   • otherwise → move to the tile (right-click is a second move button)
        // Right-click is the universal "no, not that one" for a pending aim — the
        // same gesture League and Dota use. Answered on the raw press rather than
        // from onTileRightClick below, which never ran for the cases that matter:
        // it is skipped whenever the cursor is over an entity or the mouse moved
        // during the click, and aiming a spell at something is both of those.
        engine.onAimCancelRequest = () => cancelAim();
        gameState.onServerDroppedCharge = (abilityId) => dropAimLocally(abilityId);

        engine.onTileRightClick = (tx, ty) => {
          if (gameState.isDead) return;
          if (coreEventState.processingEventId) return;

          // Hoe-till takes priority when a hoe is equipped on your own claim.
          // Skipped entirely when farming is off for this world, so right-click
          // stays a plain move instead of firing an intent the server rejects.
          const farmingOn = gameState.isFeatureEnabled("farming");
          const toolItem = gameState.equipment.get(EquipmentSlot.Tool);
          const toolDef = toolItem ? gameState.itemDefs.get(toolItem.definitionId) : null;
          if (farmingOn && toolDef && toolDef.type === ItemType.ToolHoe && gameState.currentClaim) {
            socket.send({
              type: "FarmTillIntent",
              claimId: gameState.currentClaim.id,
              tileX: tx,
              tileY: ty,
            });
            return;
          }
          // Watering can waters tilled soil (Stardew loop — waterRequired crops
          // stop growing dry).
          if (
            farmingOn &&
            toolDef &&
            toolDef.type === ItemType.ToolWateringCan &&
            gameState.currentClaim
          ) {
            socket.send({
              type: "FarmWaterIntent",
              claimId: gameState.currentClaim.id,
              tileX: tx,
              tileY: ty,
            });
            return;
          }

          // Skill-shot LMB: right-click aims and fires the shot toward the tile.
          const lmb = gameState.abilities[SLOT_LMB];
          if (lmb && lmb.requiresTarget === false) {
            fireLmbSkillShotAt(tx, ty);
            return;
          }

          // Default: right-click moves.
          const controls = gameState.playerControls.movement;
          if (!controls.clickToMove) return;
          gameState.autoAttackTargetId = null;
          socket.send({ type: "MoveIntent", targetX: tx, targetY: ty });
        };

        // Ctrl+mouse: face cursor direction
        engine.onFaceDirection = (facing) => {
          socket.send({ type: "FaceIntent", facing });
        };

        // Click on event sprite — send EventInteract (or start client interpreter)
        engine.onEventInteract = (eventId) => {
          if (gameState.isDead) return;
          if (coreEventState.processingEventId) return;
          if (coreEventState.isClientEvent(eventId)) {
            coreEventState.startClientEvent(eventId);
          } else {
            socket.send({ type: "EventInteract", eventId });
          }
        };

        const ENTITY_DOUBLE_CLICK_MS = 350;
        let lastEntityClickId: string | null = null;
        let lastEntityClickAt = 0;

        // Click on entities — single click selects, double click starts auto-attack
        engine.onEntityClick = (entityId, modifiers) => {
          if (gameState.placedChests.has(entityId)) {
            if (!gameState.isDead && !coreEventState.processingEventId) {
              socket.send({ type: "OpenChestIntent", chestId: entityId });
            }
            return;
          }
          const entity = gameState.entities.get(entityId);
          if (!entity) return;
          if (gameState.isDead) return;
          if (coreEventState.processingEventId) return;
          // Ctrl/Cmd + click signals an explicit attack (used to attack NPCs,
          // which otherwise talk on click). The server still authorizes damage
          // (e.g. no-op in a safe zone), so this only expresses intent.
          const isAttackModifier = !!(modifiers?.ctrlKey || modifiers?.metaKey);
          const now = Date.now();
          const isDoubleClick =
            lastEntityClickId === entityId && now - lastEntityClickAt <= ENTITY_DOUBLE_CLICK_MS;
          lastEntityClickId = entityId;
          lastEntityClickAt = now;
          const controls = gameState.playerControls.movement;
          const canSelectByClick = controls.clickToSelect;
          const canInteractByClick = controls.clickToInteract && !controls.interactRequiresBinding;
          const canAutoAttackByDoubleClick = controls.doubleClickAutoAttack && canInteractByClick;

          // Skill-shot LMB: the shot is bound to right-click, so a left-click on
          // a mob/player only selects it for info — it never locks or attacks
          // (left-click stays free for movement/selection).
          if (
            (entity.type === EntityType.Mob || entity.type === EntityType.Player) &&
            entityId !== gameState.selfId
          ) {
            const lmbSlot = gameState.abilities[SLOT_LMB];
            if (lmbSlot && lmbSlot.requiresTarget === false) {
              if (canSelectByClick) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
              }
              gameState.autoAttackTargetId = null;
              gameState.notify();
              return;
            }
          }

          switch (entity.type) {
            case EntityType.Mob: {
              if (entityId === gameState.selfId) return;

              // First click selects only.
              if (canSelectByClick) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
              }
              if (!isDoubleClick || !canAutoAttackByDoubleClick) {
                gameState.autoAttackTargetId = null;
                gameState.notify();
                break;
              }

              // Second click (double click) starts auto-attacking.
              gameState.autoAttackTargetId = entityId;
              gameState.notify();

              // Only send immediate attack if already in range; otherwise auto-attack timer will handle it after moving
              const mobAbility = gameState.abilities[SLOT_LMB];
              const mobRange = mobAbility?.range ?? 1.5;
              const mobDist = tileDistance(gameState.selfPosition, entity.position);
              if (mobDist <= mobRange + 0.5) {
                const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
                socket.send({
                  type: "AbilityIntent",
                  abilityId: mobAbility?.id ?? "basic_attack",
                  targetId: entityId,
                  targetPosition: mousePos,
                });
              } else {
                // Move toward the target; auto-attack timer will fire when in range
                socket.send({
                  type: "MoveIntent",
                  targetX: entity.position.x,
                  targetY: entity.position.y,
                  targetEntityId: entityId,
                  stopAtRange: mobRange,
                });
              }
              break;
            }
            case EntityType.Player: {
              if (entityId === gameState.selfId) return;

              // Only auto-attack players who are hostile (PvP zone + not party/guild)
              const isHostile = engine.isHostilePlayer(entity as any);

              // Always select
              if (canSelectByClick) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
              }
              if (!isDoubleClick || !canAutoAttackByDoubleClick) {
                gameState.autoAttackTargetId = null;
                gameState.notify();
                break;
              }

              if (isHostile) {
                // Start auto-attacking hostile player
                gameState.autoAttackTargetId = entityId;
                gameState.notify();

                // Only send immediate attack if in range
                const pvpAbility = gameState.abilities[SLOT_LMB];
                const pvpRange = pvpAbility?.range ?? 1.5;
                const pvpDist = tileDistance(gameState.selfPosition, entity.position);
                if (pvpDist <= pvpRange + 0.5) {
                  const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
                  socket.send({
                    type: "AbilityIntent",
                    abilityId: pvpAbility?.id ?? "basic_attack",
                    targetId: entityId,
                    targetPosition: mousePos,
                  });
                } else {
                  socket.send({
                    type: "MoveIntent",
                    targetX: entity.position.x,
                    targetY: entity.position.y,
                    targetEntityId: entityId,
                    stopAtRange: pvpRange,
                  });
                }
              } else {
                // Friendly player in safe zone or same party/guild — select only, no attack
                gameState.autoAttackTargetId = null;
                gameState.notify();
              }
              break;
            }
            case EntityType.ResourceNode: {
              if (!canInteractByClick) {
                if (canSelectByClick) {
                  gameState.selectedTargetId = entityId;
                  engine.selectEntity(entityId);
                  gameState.notify();
                }
                break;
              }
              // Select the node as we harvest so it shows the selection ring and
              // target frame (the interact path previously harvested without ever
              // selecting, so resource/corpse nodes never got a highlight).
              if (canSelectByClick) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
                gameState.notify();
              }
              socket.send({ type: "HarvestIntent", nodeId: entityId });
              break;
            }
            case EntityType.DroppedItem: {
              if (!canInteractByClick) break;
              socket.send({ type: "PickupItemIntent", entityId });
              break;
            }
            case EntityType.Mount: {
              if (!canInteractByClick) {
                if (canSelectByClick) {
                  gameState.selectedTargetId = entityId;
                  engine.selectEntity(entityId);
                  gameState.notify();
                }
                break;
              }
              const dist = tileDistance(gameState.selfPosition, entity.position);
              if (dist > 3) {
                socket.send({
                  type: "MoveIntent",
                  targetX: entity.position.x,
                  targetY: entity.position.y,
                  targetEntityId: entityId,
                  stopAtRange: 3,
                });
              }
              socket.send({ type: "MountInteractIntent" });
              break;
            }
            case EntityType.Npc: {
              // Ctrl/Cmd + click attacks the NPC (select + auto-attack), mirroring
              // the Mob path. Plain click still talks. The server gates whether the
              // NPC is actually damageable (safe zone → no-op).
              if (isAttackModifier) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
                gameState.autoAttackTargetId = entityId;
                gameState.notify();
                const npcAbility = gameState.abilities[SLOT_LMB];
                const npcRange = npcAbility?.range ?? 1.5;
                const npcDist = tileDistance(gameState.selfPosition, entity.position);
                if (npcDist <= npcRange + 0.5) {
                  const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
                  socket.send({
                    type: "AbilityIntent",
                    abilityId: npcAbility?.id ?? "basic_attack",
                    targetId: entityId,
                    targetPosition: mousePos,
                  });
                } else {
                  socket.send({
                    type: "MoveIntent",
                    targetX: entity.position.x,
                    targetY: entity.position.y,
                    targetEntityId: entityId,
                    stopAtRange: npcRange,
                  });
                }
                break;
              }
              // Select the NPC so it shows in the target frame (click-to-target),
              // then open the dialogue.
              if (canSelectByClick) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
                gameState.notify();
              }
              if (!canInteractByClick) break;
              socket.send({ type: "InteractIntent", entityId });
              break;
            }
            case EntityType.Portal: {
              if (!canInteractByClick) break;
              const portal = entity as any;
              // Instance portals (instances v2) open a dungeon via the portal
              // runtime; plain zone portals keep the zone-transition path.
              if (portal.portalKind === "instance" && portal.targetInstanceDefinitionId) {
                socket.send({ type: "EnterPortalIntent", portalEntityId: portal.id });
              } else if (portal.targetZoneId) {
                socket.send({
                  type: "ZoneChangeIntent",
                  targetZoneId: portal.targetZoneId,
                  spawnPointId: portal.spawnPointId ?? undefined,
                });
              }
              break;
            }
            case EntityType.CraftingStation: {
              if (!canInteractByClick) {
                if (canSelectByClick) {
                  gameState.selectedTargetId = entityId;
                  engine.selectEntity(entityId);
                  gameState.notify();
                }
                break;
              }
              const station = entity as CraftingStationEntity;
              if (station.stationType) {
                setCraftingStationType(station.stationType);
                setCraftingStationEntityId(entityId);
              }
              break;
            }
          }
        };

        // Right-click entities — single-click smart action:
        //   Mob           → auto-attack immediately (same as double-left-click)
        //   ResourceNode  → harvest if tool equipped, walk in range first
        //   DroppedItem   → pick up
        //   NPC           → interact
        //   Portal        → zone change
        //   CraftingStation → open panel
        //   Mount         → mount/dismount
        //   Player        → context menu (inspect, trade, duel, etc.)
        engine.onEntityRightClick = (entityId, screenX, screenY) => {
          const entity = gameState.entities.get(entityId);
          if (!entity || gameState.isDead) return;
          if (entityId === gameState.selfId) return;

          // Skill-shot LMB: right-click on a mob/player free-aims the shot toward
          // it (the shot lives on right-click; left-click is for movement/select).
          if (entity.type === EntityType.Mob || entity.type === EntityType.Player) {
            const lmbSlot = gameState.abilities[SLOT_LMB];
            if (lmbSlot && lmbSlot.requiresTarget === false) {
              if (gameState.playerControls.movement.clickToSelect) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
              }
              fireLmbSkillShotAt(entity.position.x, entity.position.y);
              gameState.notify();
              return;
            }
          }

          switch (entity.type) {
            case EntityType.Pet: {
              // Your own summoned pet → open the interaction radial (mount/dismiss/
              // feed/toggles/rename/pet). Refresh the roster so instance-scoped
              // actions (feed/rename) can resolve the pet's instance id.
              if (String((entity as any).ownerEntityId ?? "") !== String(gameState.selfId ?? ""))
                break;
              socket.send({ type: "PetRosterRequestIntent" });
              // Drop any hover tooltip so it can't linger over the ring.
              setHoveredEntityId(null);
              setTooltipPos(null);
              setPetRadial({
                x: screenX,
                y: screenY,
                entityId,
                name: (entity as any).name ?? "Pet",
              });
              break;
            }
            case EntityType.Mob: {
              // A mob owned by the LOCAL player is a friendly minion — select it
              // (so its target frame shows) but never auto-attack it, mirroring the
              // pet branch's select-only behavior.
              if (
                String((entity as any).ownerEntityId ?? "") === String(gameState.selfId ?? "") &&
                (entity as any).ownerEntityId != null
              ) {
                gameState.selectedTargetId = entityId;
                engine.selectEntity(entityId);
                gameState.notify();
                break;
              }
              // Select + start auto-attack immediately
              gameState.selectedTargetId = entityId;
              engine.selectEntity(entityId);
              gameState.autoAttackTargetId = entityId;
              gameState.notify();

              const mobAbility = gameState.abilities[SLOT_LMB];
              const mobRange = mobAbility?.range ?? 1.5;
              const mobDist = tileDistance(gameState.selfPosition, entity.position);
              if (mobDist <= mobRange + 0.5) {
                const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
                socket.send({
                  type: "AbilityIntent",
                  abilityId: mobAbility?.id ?? "basic_attack",
                  targetId: entityId,
                  targetPosition: mousePos,
                });
              } else {
                socket.send({
                  type: "MoveIntent",
                  targetX: entity.position.x,
                  targetY: entity.position.y,
                  targetEntityId: entityId,
                  stopAtRange: mobRange,
                });
              }
              break;
            }
            case EntityType.ResourceNode: {
              // Walk in range and harvest if tool equipped
              const toolItem = gameState.equipment.get(EquipmentSlot.Tool);
              if (!toolItem) {
                gameState.addChatMessage(
                  "system",
                  "System",
                  "You need a tool equipped to harvest.",
                );
                gameState.notify();
                return;
              }
              engine.selectEntity(entityId);
              socket.send({ type: "HarvestIntent", nodeId: entityId });
              break;
            }
            case EntityType.DroppedItem: {
              socket.send({ type: "PickupItemIntent", entityId });
              break;
            }
            case EntityType.Npc: {
              socket.send({ type: "InteractIntent", entityId });
              break;
            }
            case EntityType.Portal: {
              const portal = entity as any;
              // Instance portals (instances v2) open a dungeon via the portal
              // runtime; plain zone portals keep the zone-transition path.
              if (portal.portalKind === "instance" && portal.targetInstanceDefinitionId) {
                socket.send({ type: "EnterPortalIntent", portalEntityId: portal.id });
              } else if (portal.targetZoneId) {
                socket.send({
                  type: "ZoneChangeIntent",
                  targetZoneId: portal.targetZoneId,
                  spawnPointId: portal.spawnPointId ?? undefined,
                });
              }
              break;
            }
            case EntityType.CraftingStation: {
              const station = entity as CraftingStationEntity;
              if (station.stationType) {
                setCraftingStationType(station.stationType);
                setCraftingStationEntityId(entityId);
              }
              break;
            }
            case EntityType.Mount: {
              const dist = tileDistance(gameState.selfPosition, entity.position);
              if (dist > 3) {
                socket.send({
                  type: "MoveIntent",
                  targetX: entity.position.x,
                  targetY: entity.position.y,
                  targetEntityId: entityId,
                  stopAtRange: 3,
                });
              }
              socket.send({ type: "MountInteractIntent" });
              break;
            }
            case EntityType.Player: {
              // Players: context menu with social/combat options
              const playerEntity = entity as PlayerEntity;
              const options: ContextMenuOption[] = [];
              options.push({
                label: "🔍 Inspect",
                onClick: () => openInspect(playerEntity.id),
              });
              options.push({
                label: "👥 Add Friend",
                onClick: () => {
                  socket.send({ type: "FriendAddIntent", targetCharacterId: entityId });
                },
              });
              options.push({
                label: "🎉 Invite to Party",
                onClick: () => {
                  socket.send({ type: "PartyInviteIntent", targetCharacterId: entityId });
                },
              });
              {
                // Raids: invite a player's group into the raid. If you lead a party
                // but aren't raiding yet, this forms the raid first, then invites.
                const myParty = gameState.party;
                const inRaid = !!gameState.raid;
                const amRaidLeader = gameState.raid?.leaderId === gameState.selfId;
                const amPartyLeader =
                  !!myParty &&
                  myParty.leaderCharacterId === gameState.selfId &&
                  myParty.memberIds.length > 1;
                if (inRaid && amRaidLeader) {
                  options.push({
                    label: "🛡️ Invite to Raid",
                    onClick: () => {
                      socket.send({ type: "RaidInviteIntent", targetCharacterId: entityId });
                    },
                  });
                } else if (!inRaid && amPartyLeader) {
                  options.push({
                    label: "🛡️ Form Raid + Invite",
                    onClick: () => {
                      socket.send({ type: "RaidConvertIntent" });
                      socket.send({ type: "RaidInviteIntent", targetCharacterId: entityId });
                    },
                  });
                }
              }
              if (
                gameState.guild &&
                gameState.guild.leaderCharacterId === gameState.selfCharacterId
              ) {
                options.push({
                  label: "🏰 Invite to Guild",
                  onClick: () => {
                    socket.send({ type: "GuildInviteIntent", targetCharacterId: entityId });
                  },
                });
              }
              options.push({
                label: "💰 Trade",
                onClick: () => {
                  socket.send({ type: "TradeRequestIntent", targetEntityId: entityId });
                },
              });
              options.push({
                label: "⚔️ Duel",
                onClick: () => {
                  openDuelRequestPrompt({
                    targetEntityId: entityId,
                    targetName: playerEntity.name ?? "Player",
                  });
                },
              });
              options.push({
                label: "🐾 Challenge to Pet Battle",
                onClick: () => {
                  const team = gameState.ownedPets
                    .filter((p) => !p.isEgg && p.currentHp > 0)
                    .slice(0, 3)
                    .map((p) => p.id);
                  if (team.length === 0) {
                    gameState.addChatMessage(
                      "system",
                      "System",
                      "You need at least one pet to battle!",
                    );
                    gameState.notify();
                    return;
                  }
                  socket.send({
                    type: "PetBattleChallengeIntent",
                    targetCharacterId: entityId,
                    team,
                  });
                },
              });
              if (options.length > 0) {
                setContextMenu({ x: screenX, y: screenY, options });
              }
              break;
            }
            default:
              // No action for other entity types (Pet, Projectile, etc.)
              break;
          }
        };

        engine.onEntityHover = (entityId, screenX, screenY) => {
          setHoveredEntityId(entityId);
          setTooltipPos({ x: screenX, y: screenY });
        };
        engine.onEntityHoverOut = () => {
          setHoveredEntityId(null);
          setTooltipPos(null);
        };

        // Dynamic chunk loading timer
        let lastChunkCheck = "";
        let lastChunkSampleX = gameState.selfPosition.x;
        let lastChunkSampleY = gameState.selfPosition.y;
        const chunkTimer = setInterval(() => {
          if (destroyed || !gameState.selfId) return;
          const { x, y } = gameState.selfPosition;
          const cc = tileToChunk(Math.floor(x), Math.floor(y));
          const key = `${cc.cx},${cc.cy}`;

          // Compute velocity since last sample for speculative chunk prefetch.
          // Only fire prefetch when motion is meaningful (>= ~1 tile per
          // sample window) — avoids wasted requests when standing still.
          const dx = x - lastChunkSampleX;
          const dy = y - lastChunkSampleY;
          const VEL_THRESHOLD = 1;
          const dirX: -1 | 0 | 1 = dx > VEL_THRESHOLD ? 1 : dx < -VEL_THRESHOLD ? -1 : 0;
          const dirY: -1 | 0 | 1 = dy > VEL_THRESHOLD ? 1 : dy < -VEL_THRESHOLD ? -1 : 0;
          lastChunkSampleX = x;
          lastChunkSampleY = y;

          if (key !== lastChunkCheck) {
            lastChunkCheck = key;
            requestChunks(socket);
            // Cull distant chunks to save GPU memory
            engine.cullDistantChunks(Math.floor(x), Math.floor(y));
          }
          // Speculative lookahead runs on every tick (not just on chunk
          // crossings) so we start fetching the far chunk as soon as the
          // player commits to a direction, well before they actually
          // cross the boundary.
          if (dirX !== 0 || dirY !== 0) {
            prefetchChunksInDirection(socket, dirX, dirY);
          }
        }, CHUNK_REQUEST_INTERVAL_MS);

        // Cooldown tick timer — only notify React when cooldowns are active
        const cooldownTimer = setInterval(() => {
          if (destroyed) return;
          const hadCooldowns = gameState.cooldowns.size > 0 || gameState.globalCooldown > 0;
          const hadActiveEffects = gameState.activeEffects.length > 0;
          if (!hadCooldowns && !hadActiveEffects) return;
          gameState.tickCooldowns(50);
          gameState.tickActiveEffects(50);
          // Only notify if timers still exist or just expired
          if (
            gameState.cooldowns.size > 0 ||
            gameState.globalCooldown > 0 ||
            gameState.activeEffects.length > 0 ||
            hadCooldowns ||
            hadActiveEffects
          ) {
            gameState.notify();
          }
        }, 50);

        // Auto-attack is the SERVER's job now (combat P1).
        //
        // This used to be a 100ms setInterval that re-sent an AbilityIntent,
        // chased the target with its own MoveIntents, and guessed at cooldowns
        // locally. That made the swing cadence a function of the player's ping
        // and clock — the same character attacked faster on a better connection,
        // and every swing cost a round trip before anything happened.
        //
        // All that remains client-side is declaring WHO: one intent per change
        // of target, sent through the single setter on gameState so every place
        // that assigns a target (click, hotkey, target-nearest, death, despawn)
        // reaches the server by the same path. The server owns when the swings
        // land, walks the player into range, and tells us the authoritative
        // answer back via AttackTargetChanged.
        // How long to wait for the server to answer before concluding it cannot
        // drive swings. Generous: it only has to beat a real round trip, and
        // guessing early would hand the timer back to the client needlessly.
        const SERVER_AUTO_ATTACK_PROBE_MS = 2500;
        let legacyProbePending = false;
        gameState.onAutoAttackTargetChange = (targetId) => {
          if (destroyed) return;
          socket.send({ type: "SetAttackTargetIntent", targetId });
          // Deploy-skew detector. The client and the game server never ship in
          // step, and a server that predates SetAttackTargetIntent DROPS it as an
          // unknown intent — silently, and counting toward kick escalation. So if
          // nothing answers, take the job back rather than leaving the player
          // unable to attack at all.
          if (targetId === null || gameState.serverAutoAttackConfirmed || legacyProbePending) {
            return;
          }
          legacyProbePending = true;
          setTimeout(() => {
            legacyProbePending = false;
            if (destroyed || gameState.serverAutoAttackConfirmed) return;
            gameState.legacyAutoAttackActive = true;
            console.warn(
              "[combat] No AttackTargetChanged reply — this game server predates " +
                "server-driven auto-attack. Falling back to the client swing timer.",
            );
          }, SERVER_AUTO_ATTACK_PROBE_MS);
        };

        // ── Legacy auto-attack fallback ──────────────────────────────────────
        // Dormant unless the probe above concluded the server cannot drive
        // swings. This is the pre-P1 loop, kept only as a compatibility path: its
        // cadence depends on the player's ping, which is exactly the defect P1
        // exists to remove — so it must never run against a server that supports
        // the real thing.
        let chasingTargetId: string | null = null;
        let lastChaseX = 0;
        let lastChaseY = 0;
        const legacyAutoAttackTimer = setInterval(() => {
          if (destroyed || !gameState.legacyAutoAttackActive) return;
          if (gameState.isDead) {
            gameState.autoAttackTargetId = null;
            chasingTargetId = null;
            return;
          }
          const targetId = gameState.autoAttackTargetId;
          if (!targetId) {
            chasingTargetId = null;
            return;
          }
          const target = gameState.entities.get(targetId);
          if (!target || (target as { isDead?: boolean }).isDead) {
            gameState.autoAttackTargetId = null;
            gameState.selectedTargetId = null;
            chasingTargetId = null;
            engineRef.current?.selectEntity(null);
            gameState.notify();
            return;
          }
          // A player target must still be hostile — an old server won't tell us.
          if (target.type === EntityType.Player && engineRef.current) {
            if (!engineRef.current.isHostilePlayer(target as never)) {
              gameState.autoAttackTargetId = null;
              chasingTargetId = null;
              gameState.notify();
              return;
            }
          }
          const ability = gameState.abilities[SLOT_LMB];
          const abilityRange = ability?.range ?? 1.5;
          const dist = tileDistance(gameState.selfPosition, target.position);
          if (dist > abilityRange + 0.5) {
            // Re-path only past a drift threshold; at 100ms this would otherwise
            // be ten A* requests a second against a moving target.
            const targetMoved =
              chasingTargetId !== targetId ||
              Math.abs(target.position.x - lastChaseX) > 1.5 ||
              Math.abs(target.position.y - lastChaseY) > 1.5;
            if (targetMoved) {
              chasingTargetId = targetId;
              lastChaseX = target.position.x;
              lastChaseY = target.position.y;
              socket.send({
                type: "MoveIntent",
                targetX: target.position.x,
                targetY: target.position.y,
                targetEntityId: targetId,
                stopAtRange: abilityRange,
              });
            }
            return;
          }
          chasingTargetId = null;
          if (gameState.globalCooldown > 0) return;
          const autoAbilityId = ability?.id ?? "basic_attack";
          if ((gameState.cooldowns.get(autoAbilityId) ?? 0) > 0) return;
          socket.send({
            type: "AbilityIntent",
            abilityId: autoAbilityId,
            targetId,
            targetPosition: engineRef.current?.getMouseTilePosition() ?? null,
          });
          if (ability?.cooldownMs && ability.cooldownMs > 0) {
            gameState.startCooldown(autoAbilityId, ability.cooldownMs);
          }
        }, 100);

        // ── World-ready gate ─────────────────────────────────────────────────
        // Poll the readiness signals and only reveal the world once it's actually
        // presentable, driving the loading screen's phase + progress meanwhile.
        // A hard safety deadline (from SpawnSelf/zone change) guarantees the
        // player is never trapped on the splash if some asset never resolves.
        // State lives in refs so the ZoneChanged handler can re-arm the gate.
        let lastProgress = -1;
        let lastDetail = "";

        const revealWorld = (reason: string, snapshot: Record<string, unknown>) => {
          if (gateRevealedRef.current || destroyed) return;
          gateRevealedRef.current = true;
          // Ground-truth log: exactly what was (and wasn't) ready at reveal, and
          // which path triggered it. Inspect this if the world looks half-loaded.
          console.log(`[WorldReady] reveal via ${reason}`, snapshot);
          // Tell the server the client is loaded so it can lift spawn protection
          // (invulnerable + hidden from others + no mob aggro while loading).
          try {
            socket.send({ type: "ClientWorldReady" });
          } catch {
            /* socket not open — server lifts protection on its own timeout */
          }
          // Force a final repaint with all now-loaded textures BEFORE the splash
          // fades, so the player never sees the fill-in re-render.
          engineRef.current?.reRenderAllChunks();
          setLoadingPhase("entering");
          setLoadingProgress(1);
          setLoadingFadingOut(true);
          // Let the splash cross-fade out over the now-rendered world, then unmount.
          setTimeout(() => {
            if (!destroyed) setLoading(false);
          }, 550);
        };

        const readyGateTimer = setInterval(() => {
          if (destroyed || gateRevealedRef.current) return;
          const eng = engineRef.current;
          const spawnReceived = !!gameState.selfId;

          if (!spawnReceived) {
            // Pre-spawn: connecting → loading content once the socket is open.
            const phase: LoadingPhase = gameState.connected ? "content" : "connecting";
            setLoadingPhase(phase);
            const p = gameState.connected ? 0.22 : 0.06;
            if (Math.abs(p - lastProgress) > 0.01) {
              lastProgress = p;
              setLoadingProgress(p);
            }
            return;
          }

          if (gateDeadlineRef.current === 0) {
            gateDeadlineRef.current = Date.now() + WORLD_READY_MAX_MS;
            gateProgressAtRef.current = Date.now();
          }

          const defsReady =
            gameState.gameDefinitionsReceived &&
            gameState.mapObjectDefsReceived &&
            gameState.tilesetDefsReceived;
          const needed = neededViewportChunkKeys();
          const have = needed.filter((k) => gameState.chunks.has(k)).length;
          const chunkFrac = needed.length > 0 ? have / needed.length : 1;
          const selfBody = eng?.isSelfBodyReady() ?? false;
          // Objects + tilesets loaded for EVERY chunk that has streamed in — not
          // just the 3x3 ring. At a zoomed-out view the player sees far more than
          // 3x3 chunks, so gating on the ring left the outer (already-loaded)
          // chunks showing amber placeholders + a visible re-render at reveal.
          // Textures are cached per def-id, so "all loaded chunks" still resolves
          // to just the distinct objects/tilesets actually used (deduped). Only
          // meaningful once the catalog (defs) has arrived.
          const loadedKeys = [...gameState.chunks.keys()];
          const viewportObjectsReady =
            gameState.mapObjectDefsReceived &&
            loadedKeys.every((k) => eng?.areChunkObjectTexturesLoaded(k) ?? true);
          const viewportTilesetsReady =
            gameState.tilesetDefsReceived &&
            loadedKeys.every((k) => eng?.areChunkTilesetTexturesLoaded(k) ?? true);

          // Readiness score (0..5): defs + viewport chunks + viewport tilesets +
          // viewport objects + self sprite. While it keeps climbing the world is
          // still assembling, so we hold the splash and reset the stall clock —
          // this is what stops the pop-in from happening AFTER reveal.
          const score =
            (defsReady ? 1 : 0) +
            chunkFrac +
            (viewportTilesetsReady ? 1 : 0) +
            (viewportObjectsReady ? 1 : 0) +
            (selfBody ? 1 : 0);
          if (score > gateReadinessScoreRef.current + 0.001) {
            gateReadinessScoreRef.current = score;
            gateProgressAtRef.current = Date.now();
          }

          const progress =
            0.25 * (defsReady ? 1 : 0.3) +
            0.25 * chunkFrac +
            0.2 * (viewportTilesetsReady ? 1 : 0) +
            0.2 * (viewportObjectsReady ? 1 : 0) +
            0.1 * (selfBody ? 1 : 0);
          if (Math.abs(progress - lastProgress) > 0.02) {
            lastProgress = progress;
            setLoadingProgress(Math.min(progress, 0.99));
          }

          // "Core" content = the VIEWPORT's terrain sheets + objects + game defs.
          // We hold the splash until this is up; the stall hatch is gated on it so
          // a slow load can't reveal a half-built world. The self sprite is the
          // last mile (revealed on a short stall if it lags); the cap is the true
          // backstop.
          const coreReady =
            defsReady && chunkFrac >= 1 && viewportTilesetsReady && viewportObjectsReady;
          const ready = coreReady && selfBody;
          const stalled = Date.now() - gateProgressAtRef.current > WORLD_READY_STALL_MS;
          const capped = Date.now() > gateDeadlineRef.current;

          // Plain-language "what are we waiting on", shown on the splash + logged.
          const detail = !gameState.gameDefinitionsReceived
            ? "Loading game data…"
            : chunkFrac < 1
              ? `Loading map… (${have}/${needed.length})`
              : !viewportTilesetsReady
                ? "Loading terrain…"
                : !viewportObjectsReady
                  ? "Loading world objects…"
                  : !selfBody
                    ? "Loading your character…"
                    : "Entering the world…";
          if (detail !== lastDetail) {
            lastDetail = detail;
            setLoadingDetail(detail);
          }

          if (ready || (coreReady && stalled) || capped) {
            revealWorld(ready ? "ready" : capped ? "timeout-cap" : "stalled", {
              gameDefs: gameState.gameDefinitionsReceived,
              tilesetDefs: gameState.tilesetDefsReceived,
              objectDefs: gameState.mapObjectDefsReceived,
              viewportTilesets: viewportTilesetsReady,
              viewportObjects: viewportObjectsReady,
              viewportChunks: `${have}/${needed.length}`,
              selfSprite: selfBody,
              waitedMs: gateDeadlineRef.current
                ? WORLD_READY_MAX_MS - (gateDeadlineRef.current - Date.now())
                : 0,
            });
          }
        }, 150);

        // Store cleanup refs
        cleanupRef.current = () => {
          clearInterval(chunkTimer);
          clearInterval(cooldownTimer);
          clearInterval(readyGateTimer);
          clearInterval(legacyAutoAttackTimer);
          gameState.onAutoAttackTargetChange = null;
        };

        // Connect
        gameState.connected = false;
        gameState.notify();
        await socket.connect();
        if (destroyed) {
          socket.disconnect();
          return;
        }
        gameState.connected = true;
        gameState.notify();
      } catch (err: any) {
        if (destroyed) return;
        console.error("Boot failed:", err);
        setError(err?.message ?? "Failed to initialize");
      }
    }

    boot();

    // Keyboard shortcuts (use refs to avoid stale closures)
    const hasAction = (actions: PlayerControlActionId[], actionId: PlayerControlActionId) =>
      actions.includes(actionId);

    const closeAllPanels = () => {
      setShowInventory(false);
      setShowSkills(false);
      setShowCharacter(false);
      setCraftingStationType(null);
      setCraftingStationEntityId(null);
      gameState.npcCraftingStationType = null;
      setShowCraftingDev(false);
      setShowEnchant(false);
      setShowUpgrade(false);
      setShowAffixReroll(false);
      setShowSocial(false);
      setShowMarket(false);
      socketRef.current?.send({ type: "MarketCloseIntent" });
      setShowCurrencyExchange(false);
      socketRef.current?.send({ type: "CurrencyExchangeCloseIntent" });
      setShowSettings(false);
      setShowBuildMode(false);
      gameState.buildModeActive = false;
      setShowWorldMap(false);
      setShowPets(false);
      setShowBreeding(false);
      setShowQuests(false);
      setShowAdmin(false);
      setShowMail(false);
      setShowBank(false);
      setShowClaims(false);
      setShowFarming(false);
      setShowPastures(false);
      setShowStore(false);
      setTamingTarget(null);
      setContextMenu(null);
      gameState.npcDialogue = null;
      gameState.shopState = null;
      gameState.selectedTargetId = null;
      gameState.autoAttackTargetId = null;
      engineRef.current?.selectEntity(null);
      gameState.notify();
    };

    // Select + begin auto-attacking a target: attack immediately if in range,
    // otherwise walk toward it (the auto-attack timer fires once in range).
    // Mirrors the right-click / double-click mob behavior so all paths agree.
    const startAutoAttack = (
      socket: GameSocket,
      entity: { id: string; position: { x: number; y: number } },
    ): void => {
      gameState.selectedTargetId = entity.id;
      engineRef.current?.selectEntity(entity.id);
      gameState.autoAttackTargetId = entity.id;
      gameState.notify();

      const ability = gameState.abilities[SLOT_LMB];
      const range = ability?.range ?? 1.5;
      const dist = tileDistance(gameState.selfPosition, entity.position);
      if (dist <= range + 0.5) {
        const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
        socket.send({
          type: "AbilityIntent",
          abilityId: ability?.id ?? "basic_attack",
          targetId: entity.id,
          targetPosition: mousePos,
        });
      } else {
        socket.send({
          type: "MoveIntent",
          targetX: entity.position.x,
          targetY: entity.position.y,
          targetEntityId: entity.id,
          stopAtRange: range,
        });
      }
    };

    // Auto-attack the currently selected target when it is a hostile mob or
    // hostile player. Returns false when nothing attackable is selected.
    const startAutoAttackSelected = (socket: GameSocket): boolean => {
      const target = gameState.selectedTargetId
        ? gameState.entities.get(gameState.selectedTargetId)
        : null;
      if (!target || (target as any).isDead || target.id === gameState.selfId) return false;
      if (target.type === EntityType.Mob) {
        startAutoAttack(socket, target);
        return true;
      }
      if (target.type === EntityType.Player && engineRef.current?.isHostilePlayer(target as any)) {
        startAutoAttack(socket, target);
        return true;
      }
      return false;
    };

    // Nearest dropped item within grab range of the player. The server walks the
    // player the rest of the way (approachEntity, range 2), so a small radius is
    // enough to mean "there's loot right here".
    const findNearbyPickupId = (): string | null => {
      const selfPos = gameState.selfPosition;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const ent of gameState.entities.values()) {
        if (ent.type !== EntityType.DroppedItem) continue;
        const d = tileDistance(selfPos, ent.position);
        // The SERVER's pickup reach, not a slightly wider guess. Searching
        // further than the server will take from meant an item in the gap was
        // answered by walking the player into it instead of picking it up.
        if (d <= PICKUP_RANGE_TILES && d < bestDist) {
          bestDist = d;
          bestId = ent.id;
        }
      }
      return bestId;
    };

    // Context-sensitive primary interaction (Space / Enter by default). Priority:
    //   1. Advance an open dialogue/event text window.
    //   2. A selected hostile target → start auto-attacking it.
    //   3. A nearby event or interactive world object → interact / talk.
    //   4. Any other selected target → its natural action (harvest, mount, NPC…).
    //   5. Fallback: a dropped item right next to the player → pick it up.
    const interactWithPrimaryTarget = (socket: GameSocket): boolean => {
      if (coreEventState.textWindow) {
        const evtId = coreEventState.textWindow.eventId;
        if (!coreEventState.respondToClientEvent(evtId, "text")) {
          socket.send({ type: "EventTextAdvance", eventId: evtId });
        }
        return true;
      }
      if (coreEventState.processingEventId) return false;

      // A selected hostile target means "fight", not "pick up loot" — attack it.
      if (startAutoAttackSelected(socket)) return true;

      const px = Math.round(gameState.selfPosition.x);
      const py = Math.round(gameState.selfPosition.y);
      const selfEntity = gameState.selfId ? gameState.entities.get(gameState.selfId) : null;
      const facing = selfEntity?.facing ?? 2;
      const dx = facing === 6 ? 1 : facing === 4 ? -1 : 0;
      const dy = facing === 2 ? 1 : facing === 8 ? -1 : 0;
      const evt =
        coreEventState.getActionEventAt(px + dx, py + dy) ||
        coreEventState.getActionEventAt(px, py);
      if (evt) {
        if (coreEventState.isClientEvent(evt.id)) {
          coreEventState.startClientEvent(evt.id);
        } else {
          socket.send({ type: "EventInteract", eventId: evt.id });
        }
        return true;
      }

      const interactiveObj =
        engineRef.current?.getInteractiveObjectAt(px + dx, py + dy) ||
        engineRef.current?.getInteractiveObjectAt(px, py);
      if (interactiveObj) {
        socket.send({
          type: "WorldObjectInteractIntent",
          tileX: interactiveObj.originX,
          tileY: interactiveObj.originY,
        });
        return true;
      }

      const entity = gameState.selectedTargetId
        ? gameState.entities.get(gameState.selectedTargetId)
        : null;

      // Ground loot beats a mob corpse. A slain mob despawns and leaves a
      // "corpse" resource node on the exact tile its drops land on, and the
      // corpse sprite is drawn over them — so the corpse wins the click, stays
      // selected, and every later Space press re-harvests it instead of ever
      // reaching the pickup fallback below.
      if (!entity || (entity.type === EntityType.ResourceNode && (entity as any).mobCorpse)) {
        const lootId = findNearbyPickupId();
        if (lootId) {
          socket.send({ type: "PickupItemIntent", entityId: lootId });
          return true;
        }
      }

      if (entity) {
        switch (entity.type) {
          case EntityType.ResourceNode:
            socket.send({ type: "HarvestIntent", nodeId: entity.id });
            return true;
          case EntityType.DroppedItem:
            socket.send({ type: "PickupItemIntent", entityId: entity.id });
            return true;
          case EntityType.Mount:
            socket.send({ type: "MountInteractIntent" });
            return true;
          case EntityType.Npc:
            socket.send({ type: "InteractIntent", entityId: entity.id });
            return true;
          case EntityType.Portal: {
            const portal = entity as any;
            if (portal.portalKind === "instance" && portal.targetInstanceDefinitionId) {
              socket.send({ type: "EnterPortalIntent", portalEntityId: portal.id });
              return true;
            }
            if (portal.targetZoneId) {
              socket.send({
                type: "ZoneChangeIntent",
                targetZoneId: portal.targetZoneId,
                spawnPointId: portal.spawnPointId ?? undefined,
              });
              return true;
            }
            break;
          }
          case EntityType.CraftingStation: {
            const station = entity as CraftingStationEntity;
            if (station.stationType) {
              setCraftingStationType(station.stationType);
              setCraftingStationEntityId(entity.id);
              return true;
            }
            break;
          }
        }
      }

      // Nothing hostile or interactive claimed the press — grab nearby loot.
      const pickupId = findNearbyPickupId();
      if (pickupId) {
        socket.send({ type: "PickupItemIntent", entityId: pickupId });
        return true;
      }

      return false;
    };

    /**
     * Directions currently held down, newest last, so diagonal-ish input follows
     * the most recent key and releasing one falls back to the other.
     *
     * Held movement is driven from here on our own clock instead of riding the
     * OS keydown auto-repeat. Auto-repeat waits ~500 ms before its first repeat,
     * which is exactly what "hold the key and the character walks one tile, stops,
     * and you have to press it again" is — the step from the initial press, then
     * the OS's silence. It also varies per machine and stops entirely if the
     * keydown is swallowed. A held key now steps on MOVE_REPEAT_MS.
     */
    const heldMoveActions: PlayerControlActionId[] = [];
    let moveRepeatTimer: ReturnType<typeof setInterval> | null = null;
    /** Slightly above the server's per-intent move throttle so steps aren't dropped. */
    const MOVE_REPEAT_MS = 120;

    const stopHeldMoveLoop = (): void => {
      if (moveRepeatTimer !== null) {
        clearInterval(moveRepeatTimer);
        moveRepeatTimer = null;
      }
    };

    const startHeldMoveLoop = (): void => {
      if (moveRepeatTimer !== null) return;
      moveRepeatTimer = setInterval(() => {
        const socket = socketRef.current;
        if (!socket || heldMoveActions.length === 0 || gameState.isDead) {
          stopHeldMoveLoop();
          return;
        }
        // Newest held direction wins.
        sendDirectionalMove(socket, [heldMoveActions[heldMoveActions.length - 1]]);
      }, MOVE_REPEAT_MS);
    };

    const releaseHeldMove = (actions: PlayerControlActionId[]): void => {
      for (const action of actions) {
        const at = heldMoveActions.indexOf(action);
        if (at >= 0) heldMoveActions.splice(at, 1);
      }
      if (heldMoveActions.length === 0) stopHeldMoveLoop();
    };

    const sendDirectionalMove = (socket: GameSocket, actions: PlayerControlActionId[]): boolean => {
      const visualDirection = hasAction(actions, "movement.forward")
        ? { x: 0, y: -1 }
        : hasAction(actions, "movement.backward")
          ? { x: 0, y: 1 }
          : hasAction(actions, "movement.left")
            ? { x: -1, y: 0 }
            : hasAction(actions, "movement.right")
              ? { x: 1, y: 0 }
              : null;
      if (!visualDirection) return false;
      const direction =
        engineRef.current?.getViewAlignedTileDelta(visualDirection.x, visualDirection.y) ??
        visualDirection;
      const targetX = Math.round(gameState.selfPosition.x + direction.x);
      const targetY = Math.round(gameState.selfPosition.y + direction.y);
      socket.send({ type: "MoveIntent", targetX, targetY, movementMode: "walk" });
      gameState.autoAttackTargetId = null;
      return true;
    };

    // Hold to spin. The key press starts the camera turning and the release
    // stops it, rather than jumping a quarter turn per press — see
    // `setCameraRotating`. The engine integrates the angle per frame.
    const rotateCameraFromActions = (actions: PlayerControlActionId[]): boolean => {
      if (gameState.playerControls.movement.cameraRotation === "disabled") return false;
      if (hasAction(actions, "camera.rotateLeft")) {
        engineRef.current?.setCameraRotating("left");
        return true;
      }
      if (hasAction(actions, "camera.rotateRight")) {
        engineRef.current?.setCameraRotating("right");
        return true;
      }
      return false;
    };

    /** Stop a held spin. Safe to call for any key — it only acts on rotate keys. */
    const releaseCameraRotation = (actions: PlayerControlActionId[]): void => {
      if (hasAction(actions, "camera.rotateLeft") || hasAction(actions, "camera.rotateRight")) {
        engineRef.current?.setCameraRotating(null);
      }
    };

    const performControlActions = (
      actions: PlayerControlActionId[],
      input?: string,
      /** True when the OS is auto-repeating a key that is still held down. */
      isRepeat = false,
    ): boolean => {
      if (actions.length === 0) return false;

      if (rotateCameraFromActions(actions)) return true;

      if (hasAction(actions, "camera.faceCursor")) {
        engineRef.current?.setFaceCursorHeld(true);
        return true;
      }

      const socket = socketRef.current;
      if (!socket || gameState.isDead) return false;

      if (sendDirectionalMove(socket, actions)) {
        // Remember the direction so the repeat loop keeps walking while held.
        // Ignore OS repeats here — the loop owns the cadence now, and letting
        // them through would queue a second stream of intents on top of it.
        if (!isRepeat) {
          for (const action of actions) {
            if (
              (action === "movement.forward" ||
                action === "movement.backward" ||
                action === "movement.left" ||
                action === "movement.right") &&
              !heldMoveActions.includes(action)
            ) {
              heldMoveActions.push(action);
            }
          }
          if (heldMoveActions.length > 0) startHeldMoveLoop();
        }
        return true;
      }

      if (hasAction(actions, "combat.autoAttack") && startAutoAttackSelected(socket)) {
        return true;
      }

      if (hasAction(actions, "combat.stop")) {
        // One key that stops everything the server is continuing on your behalf:
        // the auto-attack, the walk into range, and any cast winding up. Clear
        // the local latch too so the highlight drops on the same frame instead
        // of waiting for the round trip.
        gameState.applyServerAttackTarget(null);
        socket.send({ type: "StopIntent" });
        gameState.notify();
        return true;
      }

      if (hasAction(actions, "interaction.primary") && interactWithPrimaryTarget(socket)) {
        return true;
      }

      if (hasAction(actions, "combat.mount")) {
        socket.send({
          type: "MountToggleIntent",
          mountDefinitionId: gameState.mountSummonTarget || undefined,
        });
        return true;
      }

      if (hasAction(actions, "combat.stealth")) {
        socket.send({ type: "StealthToggleIntent" });
        return true;
      }

      if (hasAction(actions, "combat.weaponStance")) {
        // Sheathe/draw. No desired state is sent — the server flips whichever
        // stance it currently has the player in, so the pose can't desync.
        socket.send({ type: "ToggleWeaponStanceIntent" });
        return true;
      }

      if (gameState.activeBattle && gameState.activeBattle.myTurn) {
        const moveAction = actions.find((action) => action.startsWith("hotbar."));
        const moveSlot = moveAction ? Number(moveAction.split(".")[1]) - 1 : undefined;
        if (moveSlot !== undefined) {
          const myPet = gameState.activeBattle.myTeam[gameState.activeBattle.myActivePetIndex];
          const ability = myPet?.abilities?.[moveSlot];
          if (ability && ability.pp > 0) {
            socket.send({ type: "PetBattleMoveIntent", abilityId: ability.id });
            return true;
          }
        }
      }

      if (hasAction(actions, "combat.tame") && gameState.selectedTargetId) {
        const target = gameState.entities.get(gameState.selectedTargetId);
        if (target && target.type === EntityType.Mob) {
          socket.send({ type: "TameAttemptIntent", targetEntityId: gameState.selectedTargetId });
          return true;
        }
      }

      const slot = input
        ? getActionSlotMap(gameState.playerControls).get(input)
        : actions
            .map((action) => PLAYER_CONTROL_ACTION_BY_ID[action]?.actionBarSlot)
            .find((actionSlot): actionSlot is number => actionSlot !== undefined);
      if (slot === undefined) return false;

      const ability = gameState.abilities[slot];
      if (ability) {
        // Holding an ability key must not machine-gun it. The OS repeats keydown
        // ~30x/s while a key is down, and every one of those used to become an
        // AbilityIntent — which read as "abilities just keep firing", and leaned
        // on the server's throttle to absorb the rest.
        if (isRepeat) return true;
        const casting = getEffectiveCasting();
        // A second press of the key already aiming is "put it away" — the same
        // escape hatch League and Dota give you for a mis-pressed spell.
        if (aimRef.current?.abilityId === ability.id) {
          if (casting.mode === "confirm") {
            cancelAim();
            return true;
          }
          // In hold mode a repeat keydown is the OS auto-repeating a key that is
          // still down. Swallow it: it must not re-open or re-fire the aim.
          return true;
        }

        // Refuse an unaffordable cast HERE, before any indicator goes up.
        // Raising the aim and only hearing "not enough MP" on release reads as
        // the game changing its mind. The server still refuses at its end (it
        // is the authority; MP can also drain mid-hold) — this just spares the
        // player the pantomime. Fails OPEN when own MP is not replicated yet.
        const manaCost = Number(ability.manaCost ?? 0);
        const selfEntity = gameState.selfId
          ? (gameState.entities.get(String(gameState.selfId)) as { mp?: number } | undefined)
          : undefined;
        if (manaCost > 0 && typeof selfEntity?.mp === "number" && selfEntity.mp < manaCost) {
          gameState.noteCombatRefusal(`Not enough MP (need ${manaCost}).`);
          return true;
        }

        // An ability still on ITS OWN cooldown refuses on the press too — same
        // honesty as the mana gate. But not inside the input-buffer window: a
        // press landing just before ready is legitimate (the release buffers
        // server-side and fires the instant the cooldown clears), so blocking
        // the aim there would break the pre-aim the buffer exists for. The GCD
        // is deliberately not checked — weaving the next cast during it is
        // normal play. Uses the shipped default window; the server gate reads
        // the world's authored value and stays the authority.
        const cooldownMs = gameState.cooldowns.get(ability.id) ?? 0;
        if (cooldownMs > DEFAULT_COMBAT_CONFIG.combatTiming.inputBufferMs) {
          gameState.noteCombatRefusal(`Not ready (${(cooldownMs / 1000).toFixed(1)}s).`);
          return true;
        }

        // Skill shots and ground-placed areas are unusable without a preview —
        // the only other way to learn where one lands is to spend it and watch.
        // Targeted spells already know their destination, so they still fire on
        // press and tab-target combat keeps its snap.
        if (casting.mode !== "instant" && abilityNeedsAim(ability, casting)) {
          beginAim(ability, input ?? null);
          return true;
        }

        const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
        socket.send({
          type: "AbilityIntent",
          abilityId: ability.id,
          targetId: gameState.selectedTargetId,
          targetPosition: mousePos,
        });
        return true;
      }

      const hotbarIdx = slot - HOTBAR_START_INDEX;
      if (hotbarIdx >= 0 && hotbarIdx < MAX_HOTBAR_SLOTS) {
        const itemDefId = gameState.hotbarItemDefinitionIds[hotbarIdx];
        if (itemDefId) {
          const stack = gameState.inventory.find(
            (it) => it.definitionId === itemDefId && (it.quantity ?? 0) > 0,
          );
          if (stack) {
            // A hotbar slot holds an item DEFINITION whatever its kind; the
            // action comes from the item. A placeable ARMS build mode (with its
            // ghost preview and tile validation) instead of being consumed —
            // pressing the key again disarms, so a mis-pressed block is undoable.
            const hotbarDef = gameState.itemDefs.get(itemDefId);
            const placeable = itemPlaceableKind(hotbarDef);
            if (placeable) {
              if (isRepeat) return true;
              const armed = engineRef.current?.objectBuild;
              if (armed?.itemDefinitionId === itemDefId) {
                engineRef.current?.setObjectBuild(null);
                setArmedObjectItem(null);
                gameState.buildModeActive = false;
                gameState.notify();
                return true;
              }
              const mapObjectDefId = placeableMapObjectDefId(hotbarDef);
              if (!mapObjectDefId) {
                gameState.addChatMessage(
                  "system",
                  "System",
                  `${hotbarDef?.name ?? "That"} has no placement graphic set.`,
                );
                return true;
              }
              engineRef.current?.setObjectBuild({
                itemDefinitionId: itemDefId,
                mapObjectDefId,
                rotation: buildRotation,
              });
              setArmedObjectItem(itemDefId);
              gameState.buildModeActive = true;
              gameState.notify();
              return true;
            }
            socket.send({
              type: "ConsumeItemIntent",
              itemInstanceId: stack.id,
              targetId: gameState.selectedTargetId ?? undefined,
            });
            return true;
          }
        }
      }

      return false;
    };

    const performControlInput = (input: string): boolean => {
      return performControlActions(getActionsForInput(gameState.playerControls, input), input);
    };

    performControlActionsRef.current = (actions) => performControlActions(actions);

    const GAMEPAD_BUTTON_INPUTS: Record<number, string> = {
      0: "GamepadButtonSouth",
      1: "GamepadButtonEast",
      2: "GamepadButtonWest",
      3: "GamepadButtonNorth",
      4: "GamepadLeftShoulder",
      5: "GamepadRightShoulder",
      12: "GamepadDPadUp",
      13: "GamepadDPadDown",
      14: "GamepadDPadLeft",
      15: "GamepadDPadRight",
    };
    const pressedGamepadInputs = new Set<string>();
    let lastGamepadMoveAt = 0;
    /** True while the look stick is deflected far enough to be spinning the camera. */
    let gamepadRotating = false;
    let gamepadFrameId = 0;

    const pollGamepad = () => {
      const controls = gameState.playerControls;
      if (controls.gamepad.enabled && typeof navigator !== "undefined" && navigator.getGamepads) {
        const gamepad = Array.from(navigator.getGamepads()).find(Boolean);
        if (gamepad) {
          for (const [buttonIndex, input] of Object.entries(GAMEPAD_BUTTON_INPUTS)) {
            const pressed = gamepad.buttons[Number(buttonIndex)]?.pressed ?? false;
            if (pressed && !pressedGamepadInputs.has(input)) {
              pressedGamepadInputs.add(input);
              performControlInput(input);
            } else if (!pressed) {
              pressedGamepadInputs.delete(input);
            }
          }

          const deadzone = controls.gamepad.deadzone;
          const axisX = gamepad.axes[0] ?? 0;
          const axisY = gamepad.axes[1] ?? 0;
          const lookX = gamepad.axes[2] ?? 0;
          const now = Date.now();
          if (now - lastGamepadMoveAt > 170) {
            const absX = Math.abs(axisX);
            const absY = Math.abs(axisY);
            if (absX > deadzone || absY > deadzone) {
              lastGamepadMoveAt = now;
              if (absX > absY) {
                performControlInput(axisX > 0 ? "GamepadLeftStickRight" : "GamepadLeftStickLeft");
              } else {
                performControlInput(axisY > 0 ? "GamepadLeftStickDown" : "GamepadLeftStickUp");
              }
            }
          }

          if (controls.movement.cameraRotation === "gamepad_axis") {
            if (Math.abs(lookX) > deadzone) {
              const rotateRight = controls.gamepad.invertLookX ? lookX < 0 : lookX > 0;
              engineRef.current?.setCameraRotating(rotateRight ? "right" : "left");
              gamepadRotating = true;
            } else if (gamepadRotating) {
              // Only release what the STICK started, so a centred stick cannot
              // cancel a rotation the player is holding on the keyboard.
              gamepadRotating = false;
              engineRef.current?.setCameraRotating(null);
            }
          }
        }
      }
      gamepadFrameId = requestAnimationFrame(pollGamepad);
    };
    gamepadFrameId = requestAnimationFrame(pollGamepad);

    function onKey(e: KeyboardEvent) {
      // Don't capture shortcuts when typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }

      const chatBlockingUiOpen =
        !!gameState.npcDialogue ||
        !!coreEventState.textWindow ||
        !!coreEventState.choiceWindow ||
        !!coreEventState.numberInputWindow ||
        !!coreEventState.itemSelectWindow ||
        !!coreEventState.scrollingText;

      if (
        e.key === "Enter" &&
        !e.repeat &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !chatBlockingUiOpen &&
        chatHudVisibleRef.current
      ) {
        e.preventDefault();
        setChatFocusNonce((v) => v + 1);
        return;
      }

      const input = keyboardEventToControlInput(e);
      const actions = getActionsForInput(gameState.playerControls, input);

      if (hasAction(actions, "system.keybinds")) {
        e.preventDefault();
        setShowKeybinds((v) => !v);
        return;
      }

      if (hasAction(actions, "panel.inventory")) setShowInventory((v) => !v);
      if (hasAction(actions, "panel.skills")) {
        const isSameTabOpen = skillsPanelOpenRef.current && skillsPanelTabRef.current === "skills";
        setSkillsPanelTab("skills");
        setShowSkills(!isSameTabOpen);
      }
      if (hasAction(actions, "panel.character")) setShowCharacter((v) => !v);
      if (hasAction(actions, "social.guild")) {
        const isSameTabOpen = socialPanelOpenRef.current && socialPanelTabRef.current === "guild";
        setSocialPanelTab("guild");
        setShowSocial(!isSameTabOpen);
      }
      if (hasAction(actions, "social.friends")) {
        const isSameTabOpen = socialPanelOpenRef.current && socialPanelTabRef.current === "friends";
        setSocialPanelTab("friends");
        setShowSocial(!isSameTabOpen);
      }
      if (hasAction(actions, "panel.market"))
        setShowMarket((v) => {
          const next = !v;
          socketRef.current?.send({ type: next ? "MarketOpenIntent" : "MarketCloseIntent" });
          return next;
        });
      if (hasAction(actions, "panel.build")) {
        setShowBuildMode((v) => {
          const next = !v;
          gameState.buildModeActive = next;
          gameState.notify();
          return next;
        });
      }
      if (hasAction(actions, "panel.worldMap") && isUiPanelEnabled("worldMap"))
        setShowWorldMap((v) => !v);
      if (hasAction(actions, "panel.locations") && isUiPanelEnabled("locations"))
        setShowLocations((v) => !v);
      if (hasAction(actions, "panel.pets")) setShowPets((v) => !v);
      if (hasAction(actions, "panel.quests")) setShowQuests((v) => !v);
      if (hasAction(actions, "panel.achievements")) setShowAchievements((v) => !v);
      if (hasAction(actions, "panel.store")) setShowStore((v) => !v);
      if (hasAction(actions, "panel.breeding")) setShowBreeding((v) => !v);
      if (hasAction(actions, "panel.calendar")) setShowCalendar((v) => !v);
      if (hasAction(actions, "panel.abilities")) {
        const isSameTabOpen =
          skillsPanelOpenRef.current && skillsPanelTabRef.current === "abilities";
        setSkillsPanelTab("abilities");
        setShowSkills(!isSameTabOpen);
      }
      if (hasAction(actions, "system.admin") && gameState.adminPanelEnabled) {
        e.preventDefault();
        setShowAdmin((v) => !v);
      }
      if (hasAction(actions, "system.close")) {
        // Escape drops a pending aim before it closes anything. Cancelling costs
        // nothing, so the safest reading of Escape mid-aim is "not that one" —
        // and closing every panel as well would be a surprise.
        if (cancelAim()) {
          e.preventDefault();
          return;
        }
        setShowInventory(false);
        closeAllPanels();
        return;
      }

      if (performControlActions(actions, input, e.repeat)) {
        e.preventDefault();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const input = keyboardEventToControlInput(e);
      const actions = getActionsForInput(gameState.playerControls, input);
      releaseHeldMove(actions);
      releaseCameraRotation(actions);
      if (hasAction(actions, "camera.faceCursor")) {
        engineRef.current?.setFaceCursorHeld(false);
      }

      // Releasing the key that opened the aim is the commit, in hold mode only —
      // `confirm` deliberately keeps the indicator up until you click, so a
      // release must not fire it. Matching on the INPUT means letting go of some
      // other key can never fire an aim it did not start.
      const aim = aimRef.current;
      if (aim && !aim.resolved && aim.input === input && getEffectiveCasting().mode === "hold") {
        fireAim();
      }
    }

    // A keyup that never arrives would strand the aim: alt-tab, a browser
    // shortcut stealing focus, or the pointer leaving a fullscreen canvas all
    // swallow it. Dropping the aim is the safe resolution — it spends nothing.
    function onWindowBlur() {
      cancelAim();
      // A keyup that never arrives (alt-tab, a browser shortcut stealing focus)
      // would otherwise leave the character walking forever.
      heldMoveActions.length = 0;
      stopHeldMoveLoop();
      // A keyup swallowed by the blur would otherwise spin the camera forever.
      engineRef.current?.setCameraRotating(null);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      destroyed = true;
      cancelAnimationFrame(gamepadFrameId);
      stopHeldMoveLoop();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      performControlActionsRef.current = () => false;
      cleanupRef.current?.();
      cleanupRef.current = null;
      // Clean up client plugins
      const clientPlugins = getClientPluginSystem();
      clientPlugins.unloadAll();
      clientPlugins.detach();
      socketRef.current?.disconnect();
      socketRef.current = null;
      engineRef.current?.destroy();
      engineRef.current = null;
      perfMonitorRef.current?.stop();
      perfMonitorRef.current = null;
      gameState.reset();
    };
  }, []);

  // ─── NPC proximity detection — update nearbyNpcId + screen position ───
  useEffect(() => {
    const interval = setInterval(() => {
      if (!gameState.selfId) {
        if (gameState.nearbyNpcId) {
          gameState.nearbyNpcId = null;
          setNpcPromptScreen(null);
          gameState.notify();
        }
        return;
      }
      const selfPos = gameState.selfPosition;
      let closestNpc: NpcEntity | null = null;
      let closestDist = NPC_INTERACT_RANGE_TILES;

      // Walking away from an NPC ends the conversation. The server sweeps for
      // this too and is the authority, but doing it here as well is what makes
      // the window shut as you step away rather than a round trip later.
      //
      // Measured against the NPC being TALKED TO, not the nearest one: walking
      // from one vendor straight to another must still close the first.
      const openNpcId = gameState.npcDialogue?.npcEntityId ?? gameState.shopState?.npcEntityId;
      if (openNpcId) {
        const openNpc = gameState.entities.get(openNpcId);
        // An NPC that has left view entirely counts as walked-away-from; one
        // that never had an entity (event-scripted dialogue) is left alone,
        // since there is no position to have walked away from.
        if (openNpc) {
          const dx = openNpc.position.x - selfPos.x;
          const dy = openNpc.position.y - selfPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > NPC_INTERACT_LEAVE_RANGE_TILES) {
            if (gameState.closeNpcWindows(openNpcId)) gameState.notify();
          }
        }
      }

      for (const entity of gameState.entities.values()) {
        if (entity.type !== EntityType.Npc) continue;
        const dx = entity.position.x - selfPos.x;
        const dy = entity.position.y - selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestNpc = entity as NpcEntity;
        }
      }

      const oldNearby = gameState.nearbyNpcId;
      const newNearby = closestNpc?.id ?? null;

      if (oldNearby !== newNearby) {
        gameState.nearbyNpcId = newNearby;
        gameState.notify();
      }

      // Update screen position for prompt
      if (closestNpc && engineRef.current) {
        const vp = engineRef.current.tileToViewport(closestNpc.position.x, closestNpc.position.y);
        setNpcPromptScreen({ x: vp.x, y: vp.y });
      } else {
        setNpcPromptScreen(null);
      }
    }, 150); // Check 6-7 times per second

    return () => clearInterval(interval);
  }, []);

  // Send a ChunkRequest unless the chunk is already loaded or a request is
  // already in flight. Pending entries expire after a timeout so a lost
  // response (e.g. dropped during reconnect) can be retried.
  function sendChunkRequest(socket: GameSocket, cx: number, cy: number) {
    const key = `${cx},${cy}`;
    if (gameState.chunks.has(key)) return;
    const now = Date.now();
    const pendingAt = gameState.pendingChunkRequests.get(key);
    if (pendingAt !== undefined && now - pendingAt < CHUNK_PENDING_TIMEOUT_MS) return;
    gameState.pendingChunkRequests.set(key, now);
    socket.send({ type: "ChunkRequest", cx, cy });
  }

  // Request chunks around player (only request chunks not already loaded/pending)
  function requestChunks(socket: GameSocket) {
    const { x, y } = gameState.selfPosition;
    const cc = tileToChunk(Math.floor(x), Math.floor(y));
    const radius = 1; // Reduced from 2 to 1 — loads 3x3=9 chunks instead of 5x5=25
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        sendChunkRequest(socket, cc.cx + dx, cc.cy + dy);
      }
    }
    // Phones skip the prefetch ring: it triples the chunk data resident in the
    // tab (9 → 25) for a stall the engine's camera-gated baking already hides,
    // and chunk data is the second-biggest heap consumer after the bakes. The
    // 3x3 alone is more than a phone viewport can show.
    if (isConstrainedDevice()) return;
    // Prefetch the ring just outside the view radius (radius 2) so neighbours
    // are already loaded by the time the player crosses a chunk boundary —
    // avoids the request → server → ChunkData stall at the edge of the 3x3.
    // Stays within the engine's chunk-cull distance (3) so prefetched chunks
    // aren't immediately evicted and re-requested.
    const prefetchRadius = radius + 1;
    for (let dy = -prefetchRadius; dy <= prefetchRadius; dy++) {
      for (let dx = -prefetchRadius; dx <= prefetchRadius; dx++) {
        if (Math.abs(dx) !== prefetchRadius && Math.abs(dy) !== prefetchRadius) continue; // ring only
        sendChunkRequest(socket, cc.cx + dx, cc.cy + dy);
      }
    }
  }

  // The set of chunk keys that must be present for a presentable first view:
  // the 3x3 ring around the player's chunk (what requestChunks loads), clamped
  // to the zone's chunk bounds so an edge/corner spawn doesn't wait forever on
  // out-of-bounds chunks the server will never send. Used by the world-ready gate.
  function neededViewportChunkKeys(): string[] {
    const { x, y } = gameState.selfPosition;
    const cc = tileToChunk(Math.floor(x), Math.floor(y));
    const bounds = gameState.zoneBounds;
    const clamp = (cx: number, cy: number): [number, number] => {
      if (!bounds) return [cx, cy];
      const minCx = Math.floor(bounds.minX / CHUNK_SIZE);
      const minCy = Math.floor(bounds.minY / CHUNK_SIZE);
      const maxCx = Math.floor(bounds.maxX / CHUNK_SIZE);
      const maxCy = Math.floor(bounds.maxY / CHUNK_SIZE);
      return [Math.min(Math.max(cx, minCx), maxCx), Math.min(Math.max(cy, minCy), maxCy)];
    };
    const keys = new Set<string>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [cx, cy] = clamp(cc.cx + dx, cc.cy + dy);
        keys.add(`${cx},${cy}`);
      }
    }
    return [...keys];
  }

  // Speculative prefetch: request the next chunk row/column in the player's
  // direction of travel one chunk before they cross into it. Saves the
  // request → server-process → ChunkData round-trip (typically 100–300ms)
  // by overlapping it with the player's current chunk traversal.
  function prefetchChunksInDirection(socket: GameSocket, dirX: -1 | 0 | 1, dirY: -1 | 0 | 1) {
    if (dirX === 0 && dirY === 0) return;
    const { x, y } = gameState.selfPosition;
    const cc = tileToChunk(Math.floor(x), Math.floor(y));
    // Request a 1-chunk-thick band two chunks ahead in the dominant axis,
    // and the diagonal corner if both axes are moving. Cheap: at most 5
    // additional chunk requests, all deduped by `gameState.chunks.has()`.
    const targets: Array<[number, number]> = [];
    if (dirX !== 0) {
      const cx = cc.cx + dirX * 2;
      for (let dy = -1; dy <= 1; dy++) targets.push([cx, cc.cy + dy]);
    }
    if (dirY !== 0) {
      const cy = cc.cy + dirY * 2;
      for (let dx = -1; dx <= 1; dx++) targets.push([cc.cx + dx, cy]);
    }
    for (const [cx, cy] of targets) {
      sendChunkRequest(socket, cx, cy);
    }
  }

  // Ask the server for the zone's coarse terrain digest, which is what lets the
  // map show ground the player has not reached. Viewport chunk streaming can't:
  // full chunks are far too heavy to hold a large world, which is exactly why
  // `requestAllZoneChunks` gives up above MAX_EAGER_ZONE_CHUNKS and the map was
  // mostly dark. Cheap and idempotent — the server throttles repeats.
  function requestMapOverview(socket: GameSocket) {
    socket.send({ type: "MapOverviewRequest" });
  }

  // Eager full-zone loading is only safe for SMALL maps. On a large map (e.g.
  // 400x500 = ~56 chunks) requesting every chunk at once floods the client with
  // ChunkData faster than the 500ms distance cull can evict, and they all build
  // render textures simultaneously → OOM crash (same failure the editor hit).
  // Above this footprint we fall back to viewport streaming: the engine's
  // movement-driven requestChunks + cullDistantChunks keep memory bounded, and
  // the rest of the map streams in as the player moves.
  const MAX_EAGER_ZONE_CHUNKS = 16; // SohbeX/Wine: lower eager load to reduce Aw Snap OOM

  // Request ALL zone chunks so the minimap shows the full map immediately.
  // Bounded: huge zones stream via the viewport instead of loading all at once.
  function requestAllZoneChunks(socket: GameSocket) {
    // Phones/tablets always viewport-stream, even on small maps: 36 chunks
    // arriving at once bake up to 36×3 RenderTextures back-to-back during
    // load — a GPU-memory and main-thread spike that desktop absorbs but
    // that gets the tab killed on iOS Safari. The minimap fills in lazily
    // as the player moves. See MOBILE_CLIENT_PERF_PLAN M2a.
    if (isConstrainedDevice()) {
      requestChunks(socket);
      return;
    }
    const bounds = gameState.zoneBounds;
    if (!bounds) {
      // Fallback to requesting just nearby chunks if no bounds available
      requestChunks(socket);
      return;
    }
    const minCx = Math.floor(bounds.minX / CHUNK_SIZE);
    const minCy = Math.floor(bounds.minY / CHUNK_SIZE);
    const maxCx = Math.floor(bounds.maxX / CHUNK_SIZE);
    const maxCy = Math.floor(bounds.maxY / CHUNK_SIZE);
    const totalChunks = (maxCx - minCx + 1) * (maxCy - minCy + 1);
    if (totalChunks > MAX_EAGER_ZONE_CHUNKS) {
      // Large map: stream the viewport instead of loading the whole zone.
      requestChunks(socket);
      return;
    }
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        sendChunkRequest(socket, cx, cy);
      }
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-wa-bg text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-400">Connection Error</h1>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-wa-primary rounded hover:bg-wa-primary/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-wa-bg"
      onContextMenu={(e) => {
        // Right-click is a gameplay action (e.g. it opens the pet radial), so
        // suppress the browser context menu across the whole game UI — the radial
        // pops up under the cursor and would otherwise catch the contextmenu event
        // itself. Still allow it in text fields so chat/input copy-paste works.
        const target = e.target as HTMLElement;
        if (target.closest("input, textarea, [contenteditable='true']")) return;
        e.preventDefault();
      }}
    >
      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => {
          // Allow drops on canvas
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const itemInstanceId = e.dataTransfer.getData("application/item-instance-id");
          const itemDefId = e.dataTransfer.getData("application/item-definition-id");
          if (!itemInstanceId || !itemDefId) return;
          const def = gameState.itemDefs.get(itemDefId);
          if (!def) return;
          const engine = engineRef.current;
          if (!engine) return;
          const { tx, ty } = engine.screenToTileCoord(e.clientX, e.clientY);
          const claim = gameState.currentClaim;

          if (def.type === ItemType.AnimalPen && claim) {
            const pastureDefId = def.pastureDefinitionId ?? def.id;
            socketRef.current?.send({
              type: "PasturePlaceIntent",
              claimId: claim.id,
              definitionId: pastureDefId,
              localX: tx - claim.bounds.x,
              localY: ty - claim.bounds.y,
            });
          } else if (def.type === ItemType.Seed && claim) {
            socketRef.current?.send({
              type: "FarmPlantIntent",
              claimId: claim.id,
              tileX: tx,
              tileY: ty,
              seedItemId: itemDefId,
            });
          } else if (def.type === ItemType.Pet && claim) {
            const pastures = gameState.claimPastures.get(claim.id) ?? [];
            const targetPasture = pastures.find((p) => {
              const px = claim.bounds.x + p.localX;
              const py = claim.bounds.y + p.localY;
              return tx >= px && ty >= py;
            });
            if (targetPasture) {
              socketRef.current?.send({
                type: "PastureAssignPetIntent",
                claimId: claim.id,
                pastureId: targetPasture.id,
                petInstanceId: itemInstanceId,
              });
            }
          }
        }}
      />

      {/* Loading overlay — authorable splash held up by the world-ready gate */}
      {loading && (
        <LoadingScreen
          config={loadingConfig}
          gameName={loadingGameName}
          phase={loadingPhase}
          detail={loadingDetail}
          progress={loadingProgress}
          fadingOut={loadingFadingOut}
        />
      )}

      {/* Connection lost overlay */}
      {!loading && connectionStatus !== "connected" && (
        <ConnectionOverlay
          status={connectionStatus}
          attempt={reconnectAttempt}
          maxAttempts={WS_MAX_RECONNECT_ATTEMPTS}
        />
      )}

      {/* Dry Run badge — persistent so a creator can never mistake this
          serverless walk-only preview for a real playtest. */}
      {isDryRun && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-hud-toast -translate-x-1/2 rounded-hud-sm border border-[var(--hud-warning)] bg-hud-surface2 px-3 py-1 font-ui text-xs shadow-hud-sm">
          <span className="font-semibold tracking-wide text-[var(--hud-warning)]">DRY RUN</span>
          <span className="text-hud-muted"> — walk-only preview, no server</span>
        </div>
      )}

      {/* Keybind reference panel */}
      {showKeybinds && panelOn("keybinds") && (
        <KeybindPanel onClose={() => setShowKeybinds(false)} />
      )}

      {!loading && (
        <TouchControlsOverlay
          controls={state.playerControls}
          disabled={state.isDead}
          cameraRotationDegrees={cameraRotationDegrees}
          onAction={performTouchControlActions}
          onReleaseAction={releaseTouchControlActions}
          onResetCamera={resetCameraRotation}
        />
      )}

      {/* HUD Overlay */}
      {!loading && (
        <>
          {/* Creator-authored custom menus (data-bound, always-on) */}
          <CustomMenuRenderer />
          {/* Top bar */}
          {hudVisible("topBar") && (
            <HudSlot id="topBar">
              <TopBar
                name={state.selfName}
                accountGold={state.accountGold}
                premiumUntil={state.premiumUntil}
                silver={state.selfSilver}
                latency={state.latency}
                isGuest={state.selfIsGuest}
                pvpRule={state.zonePvpRule}
                pvpFlag={state.pvpFlag}
                pvpWarnSeconds={state.pvpWarnSeconds}
                weather={state.weather}
                timeOfDay={state.timeOfDay}
                calendarDateLabel={state.environment.calendarDateLabel}
                onCalendar={
                  // Gate on the feature flag ONLY — with the authored calendar
                  // off the panel still opens (forecast + clock over the default
                  // calendar). Gating on calendarState.enabled made the chips
                  // silently inert on every stock world, which players read as
                  // "there is no calendar".
                  featureOn("calendar") && panelOn("calendar")
                    ? () => setShowCalendar((v) => !v)
                    : undefined
                }
                onInventory={() => setShowInventory((v) => !v)}
                onSkills={() => openSkillsPanel("skills")}
                onCharacter={() => setShowCharacter((v) => !v)}
                onGuild={() => openSocialPanel("guild")}
                onFriends={() => openSocialPanel("friends")}
                onMarket={() => {
                  setShowMarket((v) => {
                    const next = !v;
                    // Register/unregister as a market viewer — the server only
                    // streams MarketUpdate (the order list) to open panels.
                    socketRef.current?.send({
                      type: next ? "MarketOpenIntent" : "MarketCloseIntent",
                    });
                    return next;
                  });
                }}
                onExchange={() => {
                  setShowCurrencyExchange((v) => {
                    const next = !v;
                    if (next) socketRef.current?.send({ type: "CurrencyExchangeOpenIntent" });
                    return next;
                  });
                }}
                onPets={() => setShowPets((v) => !v)}
                onBreeding={() => setShowBreeding((v) => !v)}
                onQuests={() => setShowQuests((v) => !v)}
                onAchievements={() => setShowAchievements((v) => !v)}
                onBuildMode={() => {
                  setShowBuildMode((v) => {
                    const next = !v;
                    gameState.buildModeActive = next;
                    gameState.notify();
                    return next;
                  });
                }}
                onClaims={() => setShowClaims((v) => !v)}
                onFarming={() => setShowFarming((v) => !v)}
                onPastures={() => setShowPastures((v) => !v)}
                onMail={() => setShowMail((v) => !v)}
                onBank={() => setShowBank((v) => !v)}
                onInstances={() => setShowInstances((v) => !v)}
                onGoldClick={() => {
                  setStoreInitialTab("buy_gold");
                  setShowStore((v) => {
                    const next = !v;
                    if (next) {
                      socketRef.current?.send({ type: "ItemShopBrowseIntent" });
                      socketRef.current?.send({ type: "GoldStoreBrowseIntent" });
                    }
                    return next;
                  });
                }}
                onAbilities={() => openSkillsPanel("abilities")}
                onPremiumShop={() => {
                  setStoreInitialTab("featured");
                  setShowStore((v) => {
                    const next = !v;
                    if (next) {
                      socketRef.current?.send({ type: "ItemShopBrowseIntent" });
                      socketRef.current?.send({ type: "GoldStoreBrowseIntent" });
                    }
                    return next;
                  });
                }}
                onCrafting={() => setShowCraftingDev((v) => !v)}
                onEnchant={() => setShowEnchant((v) => !v)}
                onUpgrade={() => setShowUpgrade((v) => !v)}
                onAffixReroll={() => setShowAffixReroll((v) => !v)}
                onCraftingWindow={() => setShowCraftingDev((v) => !v)}
                onAdmin={() => {
                  socketRef.current?.send({ type: "AdminAuthRequest" });
                  setShowAdmin((v) => !v);
                }}
                onSettings={() => setShowSettings((v) => !v)}
                adminPanelEnabled={state.adminPanelEnabled}
                instancesEnabled={featureOn("instances")}
                hiddenHandlers={hiddenTopBarHandlers}
                adminRole={state.adminRole}
                onGuestSignup={(email, password) => {
                  setSignupError(null);
                  setSignupSuccess(false);
                  socketRef.current?.send({ type: "GuestSignupIntent", email, password });
                }}
                onGoogleSignIn={() => {
                  try {
                    loadAuthConfig().then(() => {
                      const supabase = createClient();
                      if (supabase) {
                        supabase.auth.signInWithOAuth({
                          provider: "google",
                          options: {
                            redirectTo: `${window.location.origin}/auth/callback?next=/play`,
                          },
                        });
                      }
                    });
                  } catch (err) {
                    console.error("[Play] Google sign-in failed:", err);
                  }
                }}
                signupError={signupError}
                signupSuccess={signupSuccess}
              />
            </HudSlot>
          )}

          {/* Standalone placeable clock/date readout. Opt-in: an ABSENT layout
              entry means hidden (the catalog ships it defaultVisible: false),
              unlike the legacy elements where absent = visible. */}
          {hudLayout["worldClock"]?.visible === true && featureOn("dayNightCycle") && (
            <HudSlot id="worldClock">
              <WorldClockWidget
                timeOfDay={state.timeOfDay}
                calendarDateLabel={state.environment.calendarDateLabel}
                onCalendar={
                  featureOn("calendar") && panelOn("calendar")
                    ? () => setShowCalendar((v) => !v)
                    : undefined
                }
              />
            </HudSlot>
          )}

          {showAdmin && state.adminPanelEnabled && (
            <AdminPanel
              role={state.adminRole}
              permissions={state.adminPermissions}
              entities={state.entities}
              itemDefs={state.itemDefs}
              abilityDefs={state.abilityDefs}
              selfId={state.selfId}
              selectedTargetId={state.selectedTargetId}
              currentZoneId={state.currentZoneId}
              selfPosition={state.selfPosition}
              lastResult={state.adminLastCommandResult}
              onClose={() => setShowAdmin(false)}
              onCommand={sendAdminCommand}
            />
          )}

          {/* Health / Mana / Stamina — individually placeable stat bars */}
          {hudVisible("hpBar") && (
            <HudSlot id="hpBar">
              <StatBar
                elementId="hpBar"
                value={state.selfHp}
                max={state.selfMaxHp}
                shield={state.selfShield}
                shieldRecharging={state.selfShieldRecharging}
              />
            </HudSlot>
          )}
          {/* Only mounted in `shieldDisplay: "bar"` — in the default overlay mode
              the shield rides the health bar and this slot stays hidden. */}
          {hudVisible("shieldBar") && (
            <HudSlot id="shieldBar">
              <StatBar
                elementId="shieldBar"
                value={state.selfShield}
                max={state.selfShieldMax}
                shieldRecharging={state.selfShieldRecharging}
              />
            </HudSlot>
          )}
          {hudVisible("mpBar") && (
            <HudSlot id="mpBar">
              <StatBar elementId="mpBar" value={state.selfMp} max={state.selfMaxMp} />
            </HudSlot>
          )}
          {hudVisible("staminaBar") && (
            <HudSlot id="staminaBar">
              <StatBar
                elementId="staminaBar"
                value={state.survival.stamina}
                max={state.survival.maxStamina}
              />
            </HudSlot>
          )}
          {/* Level badge (opt-in: hidden unless the creator enabled it) */}
          {hudLayout["levelBadge"]?.visible === true && (
            <HudSlot id="levelBadge">
              <LevelBadge level={state.playerLevel} />
            </HudSlot>
          )}

          {/* XP bar — defaults to a slim rail directly under the ability bar
              (it does not displace it); movable/restyleable in the UI editor. */}
          {hudVisible("territoryPanel") && panelOn("territoryPanel") && (
            <HudSlot id="territoryPanel">
              <TerritoryPanel territory={state.territory} />
            </HudSlot>
          )}

          {hudVisible("xpBar") && (
            <HudSlot id="xpBar">
              <XpBar
                level={state.playerLevel}
                progress={state.playerLevelProgress}
                current={state.playerLevelProgressCurrent}
                needed={state.playerLevelProgressNeeded}
              />
            </HudSlot>
          )}

          {/* Survival bars (hunger, thirst, temperature) — hidden when the
              survival system is disabled for this world. */}
          {hudVisible("survivalBars") && featureOn("survival") && (
            <HudSlot id="survivalBars">
              <SurvivalBars
                vitals={state.survival}
                survivalEffects={state.survivalEffects}
                ambientTemp={state.environment.ambientTemp}
              />
            </HudSlot>
          )}

          {/* Polite live region for combat feedback with no readable on-screen
              text (cast interrupts today; dropped inputs and approach orders
              next). Deliberately NOT behind a hudVisible() gate — hiding the HUD
              must not remove an accessibility affordance. */}
          <ScreenReaderAnnouncer message={state.announcement} nonce={state.announcementNonce} />

          {/* Routine combat refusals, shown where the action failed rather than
              buried in the chat log. Screen readers get them via the announcer
              above, so this is visual only. */}
          {hudVisible("abilityBar") && (
            <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
              <CombatNotice message={state.combatNotice} nonce={state.combatNoticeNonce} />
            </div>
          )}

          {/* Ability bar — placement/visibility from the Layout tab
              (`abilityBar`), on/off from the Panels tab (`hotbar`). Both are
              authorable, so both are honored.

              On a phone the desktop hotbar is redundant AND in the way: the
              touch overlay already draws its own hotbar buttons. So when touch
              controls are on and they actually carry a hotbar slot, the bar is
              hidden below `md` and the on-screen buttons are the hotbar. If the
              creator stripped every hotbar button out of the touch layout the
              bar stays — otherwise there'd be no way to cast at all. */}
          {hudVisible("abilityBar") && panelOn("hotbar") && (
            <div className={touchHotbarReplacesBar ? "hidden md:block" : undefined}>
              <HudSlot id="abilityBar">
                <AbilityBar
                  abilities={state.abilities}
                  hotbarItemDefinitionIds={state.hotbarItemDefinitionIds}
                  cooldowns={state.cooldowns}
                  gcd={state.globalCooldown}
                  learnedAbilities={state.learnedAbilities}
                  inventory={state.inventory}
                  itemDefs={state.itemDefs}
                  playerControls={state.playerControls}
                  onHoverAbility={(ability) => {
                    // An active aim outranks a hover: sliding the cursor off the
                    // hotbar to aim must not wipe the footprint you are aiming with.
                    if (aimRef.current) return;
                    showAimIndicator(ability ?? null);
                  }}
                  onAbility={(id) => {
                    // Clicking the hotbar button is an explicit commit, so it fires
                    // even in the aim modes — the click already chose the ability,
                    // and asking for a second gesture to confirm would be fussy.
                    // A pending aim for the same ability resolves through this too.
                    if (aimRef.current?.abilityId === id) {
                      fireAim();
                      return;
                    }
                    cancelAim();
                    const mousePos = engineRef.current?.getMouseTilePosition() ?? null;
                    socketRef.current?.send({
                      type: "AbilityIntent",
                      abilityId: id,
                      targetId: gameState.selectedTargetId,
                      targetPosition: mousePos,
                    });
                  }}
                  onAssignHotbar={(hotbarSlot, abilityId, itemId) => {
                    socketRef.current?.send({
                      type: "HotbarAssignIntent",
                      hotbarSlot,
                      abilityId: abilityId ?? null,
                      itemId: itemId ?? null,
                    });
                    // Optimistic local update
                    if (abilityId) {
                      const def =
                        state.abilityDefs.get(abilityId) ??
                        state.learnedAbilities.find((a) => a.id === abilityId) ??
                        null;
                      state.abilities[7 + hotbarSlot] = def;
                    } else {
                      state.abilities[7 + hotbarSlot] = null;
                    }
                    state.notify();
                  }}
                />
              </HudSlot>
            </div>
          )}

          {/* Minimap */}
          {hudVisible("minimap") && (
            <HudSlot id="minimap">
              <Minimap
                selfPosition={state.selfPosition}
                entities={state.entities}
                selfId={state.selfId}
                zoneName={state.currentZoneName}
                zoneTier={state.currentZoneTier}
                zoneBounds={state.zoneBounds}
                selfFacing={state.selfId ? state.entities.get(state.selfId)?.facing : undefined}
                viewMode={getViewMode()}
                onOpenMap={() => {
                  if (panelOn("worldMap")) setShowWorldMap(true);
                }}
              />
            </HudSlot>
          )}

          {/* Chat */}
          {hudVisible("chat") && (
            <HudSlot id="chat">
              <ChatPanel
                messages={state.chatMessages}
                activeChannel={state.activeChatChannel}
                focusRequestNonce={chatFocusNonce}
                selfId={state.selfId ?? undefined}
                nearbyPlayers={Array.from(state.entities.values())
                  .filter((e) => e.type === EntityType.Player && e.id !== state.selfId)
                  .map((e) => ({ id: e.id, name: (e as PlayerEntity).name }))}
                onSend={(text, channel, targetId) => {
                  // Check for client-side plugin commands first
                  if (text.startsWith("/")) {
                    const parts = text.slice(1).split(/\s+/);
                    const cmd = parts[0];
                    const args = parts.slice(1);
                    if (cmd && getClientPluginSystem().handleChatCommand(cmd, args)) {
                      return; // Handled by client plugin
                    }
                  }
                  socketRef.current?.send({ type: "ChatSend", channel, text, targetId });
                }}
                onTyping={(typing, channel) => {
                  socketRef.current?.send({ type: "ChatTyping", channel, typing });
                }}
                onChannelChange={(channel) => {
                  gameState.activeChatChannel = channel;
                  gameState.notify();
                }}
                onInspectPlayer={(senderId) => {
                  const entity = state.entities.get(senderId);
                  if (entity && entity.type === EntityType.Player) {
                    openInspect(senderId);
                  }
                }}
                onWhisperPlayer={() => {
                  gameState.activeChatChannel = "whisper";
                  gameState.notify();
                }}
                onInvitePlayer={(senderId) => {
                  socketRef.current?.send({
                    type: "PartyInviteIntent",
                    targetCharacterId: senderId,
                  });
                }}
                onTradePlayer={(senderId) => {
                  socketRef.current?.send({ type: "TradeRequestIntent", targetEntityId: senderId });
                }}
                onAddFriend={(senderId) => {
                  socketRef.current?.send({ type: "FriendAddIntent", targetCharacterId: senderId });
                }}
              />
            </HudSlot>
          )}

          {/* Target frame */}
          {state.selectedTargetId &&
            panelOn("targetFrame") &&
            (() => {
              const target = state.entities.get(state.selectedTargetId!);
              if (!target) return null;
              // A boss is presented solely through the BossBar (with its inspect
              // section) — suppress the duplicate mob target frame for it.
              if (gameState.isBoss(state.selectedTargetId!)) return null;
              if (
                target.type !== EntityType.Mob &&
                target.type !== EntityType.Player &&
                target.type !== EntityType.Npc
              )
                return null;
              const t = target as any;
              const name = t.name ?? "Unknown";
              const isMob = target.type === EntityType.Mob;
              // Summoned/raised/charmed mobs carry an owner id — show who owns it.
              const ownerName =
                isMob && t.ownerEntityId != null
                  ? ((state.entities.get(String(t.ownerEntityId)) as any)?.name ?? null)
                  : null;
              const hp = t.hp ?? 0;
              const maxHp = t.maxHp ?? 1;
              const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
              const isNpc = target.type === EntityType.Npc;
              const canInspect = isMob || isNpc;
              const canTame = isMob && t.tameable === true;
              // Trainer battles: an NPC with an authored roster can be challenged.
              const canBattlePets = isNpc && (t as { battlesPets?: boolean }).battlesPets === true;
              const tierColors: Record<string, string> = {
                common: "text-gray-400",
                uncommon: "text-green-400",
                rare: "text-blue-400",
                epic: "text-purple-400",
                legendary: "text-yellow-400",
              };
              const tierColor = tierColors[t.tier ?? "common"] ?? "text-gray-400";
              const hpBarColor =
                hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-500";
              return (
                <div
                  className="hud-panel absolute top-20 left-1/2 z-30 min-w-[220px] -translate-x-1/2 rounded-lg px-4 py-2.5"
                  style={targetChrome.style}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-white truncate">{name}</span>
                      {isMob && t.tier && (
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${tierColor}`}
                        >
                          {t.tier}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        gameState.selectedTargetId = null;
                        engineRef.current?.selectEntity(null);
                        gameState.notify();
                      }}
                      className="text-gray-500 hover:text-white text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Owner line for a summoned/raised/charmed minion */}
                  {ownerName && (
                    <div className="mb-1.5 text-[10px] italic text-gray-400">
                      Summoned by {ownerName}
                    </div>
                  )}

                  {/* HP bar */}
                  <div className="w-full h-3 bg-gray-800 rounded overflow-hidden mb-0.5">
                    <div
                      className={`h-full ${hpBarColor} transition-all duration-200`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-400">
                      {Math.ceil(hp)} / {Math.round(maxHp)} HP
                    </span>
                    <span className="text-[10px] text-gray-500">{Math.round(hpPct)}%</span>
                  </div>

                  {/* Active status effects on the target (server replicates
                      entity.statusEffects to nearby clients) */}
                  {Array.isArray(target.statusEffects) && target.statusEffects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2" aria-label="Target status effects">
                      {target.statusEffects.slice(0, 10).map((se, i) => {
                        const def =
                          (se.effectId ? gameState.statusEffectDefs.get(se.effectId) : undefined) ??
                          gameState.statusEffectDefsByType.get(se.type);
                        return (
                          <EffectIcon
                            key={`t-${se.effectId ?? se.type}-${i}`}
                            effect={{
                              effectId: se.effectId,
                              type: se.type,
                              stacks: se.stacks,
                              remainingTicks: se.remainingTicks,
                              totalTicks: se.totalTicks,
                              magnitude: 0,
                              label: def?.name || se.type,
                              icon: def?.icon || "",
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Actions: Inspect (mobs + NPCs) and Tame (only tameable mobs) */}
                  {(canInspect || canTame || canBattlePets) && (
                    <div className="flex gap-1.5">
                      {canInspect && (
                        <button
                          onClick={() => openInspect(state.selectedTargetId!)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[var(--hud-border-2)] px-3 py-1.5 text-xs font-semibold text-hud-secondary transition-colors hover:bg-white/[0.06] hover:text-hud-primary"
                        >
                          🔍 Inspect
                        </button>
                      )}
                      {canTame && (
                        <button
                          onClick={() =>
                            setTamingTarget({ entityId: state.selectedTargetId!, name })
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-green-700/40 bg-green-900/50 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-800/70"
                        >
                          🪢 Tame
                        </button>
                      )}
                      {canBattlePets && (
                        <button
                          onClick={() => {
                            const team = (state.ownedPets ?? [])
                              .filter((p) => p.id)
                              .slice(0, 3)
                              .map((p) => p.id);
                            if (team.length === 0) {
                              gameState.addChatMessage(
                                "system",
                                "System",
                                "You need at least one pet to battle a trainer.",
                              );
                              gameState.notify();
                              return;
                            }
                            socketRef.current?.send({
                              type: "PetBattleChallengeNpcIntent",
                              npcEntityId: state.selectedTargetId!,
                              team,
                            });
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-amber-600/40 bg-amber-900/50 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-800/70"
                        >
                          ⚔️ Battle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Death overlay */}
          {state.isDead && panelOn("deathRecap") && (
            <DeathRecap
              killerName={state.deathKillerName}
              respawnAt={state.deathRespawnAt}
              remaining={Math.max(0, state.deathRespawnAt - Date.now())}
              spectating={state.deathSpectating}
              inArena={!!state.arenaMatch}
              onLeaveMatch={
                state.deathSpectating
                  ? () => socketRef.current?.send({ type: "ExitInstanceIntent" })
                  : undefined
              }
            />
          )}

          {/* Pet battle fullscreen overlay */}
          {state.activeBattle && panelOn("petBattle") && (
            <PetBattleScreen
              playbackMessage={state.battleMessage}
              hpOverrides={state.battleHpOverrides}
              playing={state.battlePlaying}
              onSkipPlayback={() => engineRef.current?.petBattlePlayback.skip()}
              battle={state.activeBattle}
              battleLog={state.battleLog}
              battleItems={state.inventory.flatMap((item) => {
                const def = state.itemDefs.get(item.definitionId) as any;
                return Number(def?.petHeal ?? 0) > 0 || def?.petRevive || def?.petStatusCure
                  ? [{ itemInstanceId: item.id, name: def?.name ?? item.definitionId }]
                  : [];
              })}
              onMove={(abilityId) => {
                socketRef.current?.send({ type: "PetBattleMoveIntent", abilityId });
              }}
              onOrder={(action, abilityId, fieldSlot, targetFieldSlot) => {
                socketRef.current?.send({
                  type: "PetBattleOrderIntent",
                  action,
                  abilityId,
                  fieldSlot,
                  targetFieldSlot,
                });
              }}
              onSwitch={(petIndex) => {
                socketRef.current?.send({ type: "PetBattleSwitchIntent", petIndex });
              }}
              onUseItem={(itemInstanceId, targetPetIndex) => {
                socketRef.current?.send({
                  type: "PetBattleUseItemIntent",
                  itemInstanceId,
                  targetPetIndex,
                });
              }}
              onForfeit={() => {
                socketRef.current?.send({ type: "PetBattleForfeitIntent" });
              }}
            />
          )}

          {/* Pet battle result summary */}
          {state.battleResult && !state.activeBattle && (
            <PetBattleResultModal
              won={state.battleResult.won}
              reason={state.battleResult.reason}
              rewards={state.battleResult.rewards}
              items={state.battleResult.items}
              dialogue={state.battleResult.dialogue}
              progression={state.battleResult.progression}
              onClose={() => {
                gameState.battleResult = null;
                gameState.notify();
              }}
            />
          )}

          {/* Inventory (toggle) */}
          {showInventory && panelOn("inventory") && (
            <InventoryPanel
              items={state.inventory}
              equipment={state.equipment}
              itemDefs={state.itemDefs}
              playerName={state.selfName}
              gold={state.selfSilver}
              skills={state.skills}
              skillDefs={state.skillDefs}
              selfStats={state.selfStats}
              survivalVitals={featureOn("survival") ? state.survival : undefined}
              survivalEffects={state.survivalEffects}
              ambientTemp={state.environment.ambientTemp}
              petsOpen={showPets && featureOn("pets") && panelOn("petParty")}
              onTogglePets={() => setShowPets((v) => !v)}
              // While a shop is open the bag doubles as the sell list:
              // right-click sends one to that merchant instead of equipping or
              // using it. Undefined when no shop is open, so ordinary
              // right-click behavior is untouched.
              onQuickSell={
                state.shopState && featureOn("npcShops") && panelOn("shop")
                  ? (itemId) => {
                      const npcId = state.shopState?.npcEntityId;
                      if (!npcId) return;
                      socketRef.current?.send({
                        type: "ShopSellIntent",
                        npcEntityId: npcId,
                        itemInstanceId: itemId,
                        quantity: 1,
                      });
                    }
                  : undefined
              }
              onOpenLoadouts={() => {
                socketRef.current?.send({ type: "ListLoadoutsIntent" });
                setShowLoadouts(true);
              }}
              petsDrawer={
                featureOn("pets") && panelOn("petParty") ? (
                  <PetPartyPanel
                    embedded
                    pets={state.ownedPets}
                    activePetEntityId={state.activePetEntityId}
                    activePetName={state.activePetName}
                    isRidingPet={state.isRidingPet}
                    petAutoAttackEnabled={state.petAutoAttackEnabled}
                    petAutoLootEnabled={state.petAutoLootEnabled}
                    petAggroRange={state.petAggroRange}
                    onSummon={(petInstanceId) => {
                      socketRef.current?.send({ type: "PetSummonIntent", petInstanceId });
                    }}
                    onDismiss={() => {
                      socketRef.current?.send({ type: "PetDismissIntent" });
                    }}
                    onRideToggle={() => {
                      socketRef.current?.send({ type: "PetRideToggleIntent" });
                    }}
                    onToggleAutoAttack={() => {
                      socketRef.current?.send({ type: "PetAutoAttackToggleIntent" });
                    }}
                    onToggleAutoLoot={() => {
                      socketRef.current?.send({ type: "PetAutoLootToggleIntent" });
                    }}
                    onSetAggroRange={(range) => {
                      socketRef.current?.send({ type: "PetAggroRangeSetIntent", range });
                    }}
                    onRename={(petInstanceId, newName) => {
                      socketRef.current?.send({ type: "PetRenameIntent", petInstanceId, newName });
                    }}
                    onUseItem={(petInstanceId, itemInstanceId) => {
                      socketRef.current?.send({
                        type: "PetUseItemIntent",
                        itemInstanceId,
                        petInstanceId,
                      });
                    }}
                    onSetActionPlan={(petInstanceId, actions) => {
                      socketRef.current?.send({
                        type: "PetActionPlanSetIntent",
                        petInstanceId,
                        actions,
                      });
                    }}
                    onForgetAbility={(petInstanceId, abilityId) => {
                      socketRef.current?.send({
                        type: "PetForgetAbilityIntent",
                        petInstanceId,
                        abilityId,
                      });
                    }}
                    onClose={() => setShowPets(false)}
                  />
                ) : undefined
              }
              onClose={() => {
                setShowInventory(false);
                // The pets drawer lives inside this panel — close it too so the
                // next hotkey press re-opens both together.
                setShowPets(false);
              }}
              onEquip={(itemId) => {
                socketRef.current?.send({ type: "EquipIntent", itemInstanceId: itemId });
              }}
              onUnequip={(slot, toSlotIndex) => {
                socketRef.current?.send({
                  type: "UnequipIntent",
                  slot,
                  targetSlotIndex: toSlotIndex,
                });
              }}
              onUse={(itemId) => {
                socketRef.current?.send({
                  type: "ConsumeItemIntent",
                  itemInstanceId: itemId,
                  targetId: gameState.selectedTargetId ?? undefined,
                });
              }}
              onPlaceCraftingStation={(itemId) => {
                // Same convention chests use: drop it on the tile in front of
                // you. The server validates footprint, claim rights and
                // collision, so an unlucky spot is refused with a reason.
                socketRef.current?.send({
                  type: "PlaceCraftingStationIntent",
                  itemInstanceId: itemId,
                  x: Math.round(gameState.selfPosition.x + 1),
                  y: Math.round(gameState.selfPosition.y),
                  context: "overworld",
                });
              }}
              onPlaceChest={(itemId) => {
                const x = Math.round(gameState.selfPosition.x + 1);
                const y = Math.round(gameState.selfPosition.y);
                socketRef.current?.send({
                  type: "PlaceChestIntent",
                  itemInstanceId: itemId,
                  x,
                  y,
                  context: "overworld",
                });
              }}
              onRepair={(itemId) => {
                socketRef.current?.send({ type: "RepairItemIntent", itemInstanceId: itemId });
              }}
              onRemoveRune={(itemId, slotIndex) => {
                socketRef.current?.send({
                  type: "RuneRemoveIntent",
                  itemInstanceId: itemId,
                  slotIndex,
                });
              }}
              onRenameEquipment={(itemId, newName) => {
                socketRef.current?.send({
                  type: "EquipmentRenameIntent",
                  itemInstanceId: itemId,
                  newName,
                });
              }}
              onDrop={(itemId, quantity) => {
                const send = () =>
                  socketRef.current?.send({
                    type: "DropItemIntent",
                    itemInstanceId: itemId,
                    quantity: Math.max(1, quantity ?? 1),
                  });
                // Dropping is not undoable, so it asks first unless the player
                // has turned the confirmation off (Settings → Gameplay).
                if (!getBoolSetting("confirmItemDrop")) {
                  send();
                  return;
                }
                const name = gameState.inventory.find((i) => i.id === itemId)?.name ?? "this item";
                setPendingDrop({ name, quantity: Math.max(1, quantity ?? 1), send });
              }}
              onMove={(itemId, toSlotIndex) => {
                socketRef.current?.send({
                  type: "MoveItemIntent",
                  itemInstanceId: itemId,
                  toSlotIndex,
                });
              }}
              onSplit={(itemId, quantity) => {
                socketRef.current?.send({
                  type: "SplitStackIntent",
                  itemInstanceId: itemId,
                  quantity,
                });
              }}
              onSort={() => {
                socketRef.current?.send({ type: "SortInventoryIntent" });
              }}
              onExternalItemDrop={(source, data) => {
                // Vault item dropped onto the bag → withdraw the whole stack.
                if (source === "bank" && data.instanceId) {
                  socketRef.current?.send({
                    type: "BankWithdrawIntent",
                    itemInstanceId: data.instanceId,
                    quantity: Math.max(1, data.quantity ?? 1),
                  });
                } else if (source === "chest" && data.instanceId && state.activeChest) {
                  // Chest item dropped onto the bag → withdraw the whole stack.
                  socketRef.current?.send({
                    type: "ChestWithdrawIntent",
                    chestId: state.activeChest.chestId,
                    itemInstanceId: data.instanceId,
                    quantity: Math.max(1, data.quantity ?? 1),
                  });
                }
              }}
            />
          )}

          {/* Skills + Abilities (tabbed) */}
          {showSkills && (panelOn("skills") || panelOn("abilities")) && (
            <SkillsPanel
              skills={state.skills}
              discoveredSkills={state.discoveredSkills}
              skillDefs={state.skillDefs}
              learnedAbilities={state.learnedAbilities}
              hotbarSlots={Array.from(
                { length: MAX_HOTBAR_SLOTS },
                (_, i) => state.abilities[HOTBAR_START_INDEX + i] ?? null,
              )}
              activeTab={skillsPanelTab}
              heldPassives={state.heldPassives}
              onTabChange={setSkillsPanelTab}
              onClose={() => setShowSkills(false)}
              onForget={(abilityId) => {
                socketRef.current?.send({ type: "ForgetAbilityIntent", abilityId });
              }}
              onAssignHotbar={(hotbarSlot, abilityId) => {
                socketRef.current?.send({
                  type: "HotbarAssignIntent",
                  hotbarSlot,
                  abilityId: abilityId,
                  itemId: null,
                });
                // Optimistic update
                if (abilityId) {
                  const def =
                    state.abilityDefs.get(abilityId) ??
                    state.learnedAbilities.find((a) => a.id === abilityId) ??
                    null;
                  state.abilities[7 + hotbarSlot] = def;
                } else {
                  state.abilities[7 + hotbarSlot] = null;
                }
                state.notify();
              }}
              onManageLoadouts={() => {
                socketRef.current?.send({ type: "ListLoadoutsIntent" });
                setShowLoadouts(true);
              }}
            />
          )}

          {showLoadouts && panelOn("loadout") && (
            <LoadoutPanel
              actionBarSlots={Array.from(
                { length: MAX_HOTBAR_SLOTS },
                (_, i) => state.abilities[HOTBAR_START_INDEX + i]?.id ?? null,
              )}
              loadouts={state.loadouts}
              equipResult={state.lastLoadoutEquipResult}
              onClose={() => setShowLoadouts(false)}
              onSave={(loadoutName, capture) =>
                socketRef.current?.send({ type: "SaveLoadoutIntent", loadoutName, capture })
              }
              onEquip={(name) => socketRef.current?.send({ type: "EquipLoadoutIntent", name })}
              onSwitchAbilities={(loadoutName) =>
                socketRef.current?.send({ type: "SwitchLoadoutIntent", loadoutName })
              }
              onDelete={(name) => socketRef.current?.send({ type: "DeleteLoadoutIntent", name })}
              quote={state.loadoutQuote}
              onQuoteMissing={(name) =>
                socketRef.current?.send({ type: "LoadoutQuoteMissingIntent", name })
              }
              onBuyMissing={(name, quotedTotalGold) =>
                socketRef.current?.send({
                  type: "LoadoutBuyMissingIntent",
                  name,
                  quotedTotalGold,
                })
              }
            />
          )}

          {/* Status effects (always visible if effects exist) */}
          {/* Boss encounter bar (top-center) — only while a boss is engaged.
              Gated on the Panels switch, not `hudVisible`: "bossBar" is not in
              HUD_ELEMENTS, so the old layout lookup read an id no editor control
              ever writes and could never be false. */}
          {panelOn("bossBar") && <BossBar encounter={gameState.getActiveBossEncounter()} />}

          {/* Arena match HUD — self-gating: renders nothing outside a match. */}
          <ArenaHUD onSend={(msg) => socketRef.current?.send(msg)} />

          {hudVisible("statusEffects") && (
            <HudSlot id="statusEffects">
              <StatusEffectsBar effects={state.activeEffects} />
            </HudSlot>
          )}

          {/* Stealth detection indicator (only while stealthed) */}
          {hudVisible("detectionIndicator") && (
            <HudSlot id="detectionIndicator">
              <DetectionIndicator
                stealthActive={state.stealthActive}
                level={state.detectionLevel}
                count={state.detectionCount}
                onToggle={() => socketRef.current?.send({ type: "StealthToggleIntent" })}
              />
            </HudSlot>
          )}

          {/* Mount button (always visible) */}
          {hudVisible("mountButton") && (
            <HudSlot id="mountButton">
              <MountButton
                mounted={state.isMounted}
                inCombat={false}
                onToggle={() => {
                  socketRef.current?.send({
                    type: "MountToggleIntent",
                    mountDefinitionId: state.mountSummonTarget || undefined,
                  });
                }}
              />
            </HudSlot>
          )}

          {/* Mount summon progress bar */}
          <MountSummonBar
            progress={state.mountSummonProgress}
            mountName={state.mountSummonTarget || undefined}
          />

          {/* Egg hatch indicator — world chrome, so it steps aside for a
              full-screen turn-based battle like the rest of the HUD. */}
          {state.eggHatchProgress && !battleOwnsScreen && (
            <EggHatchIndicator
              stepsRemaining={state.eggHatchProgress.stepsRemaining}
              totalSteps={state.eggHatchProgress.totalSteps}
            />
          )}

          {/* Pet battle challenge toast */}
          {state.pendingBattleChallenge && !state.activeBattle && (
            <PetBattleChallengeToast
              challengerName={state.pendingBattleChallenge.challengerName}
              onAccept={() => {
                const team = state.ownedPets
                  .filter((p) => !p.isEgg && p.currentHp > 0)
                  .slice(0, 3)
                  .map((p) => p.id);
                socketRef.current?.send({ type: "PetBattleAcceptIntent", team });
              }}
              onDecline={() => {
                socketRef.current?.send({ type: "PetBattleDeclineIntent" });
                gameState.pendingBattleChallenge = null;
                gameState.notify();
              }}
            />
          )}

          {/* Taming channel progress — the creature is held still while this runs. */}
          {state.tamingChannel && (
            <div className="absolute bottom-44 left-1/2 z-hud-bar -translate-x-1/2 rounded-lg border border-green-700/50 bg-[var(--hud-bg)] px-4 py-3 min-w-[220px]">
              <div className="mb-2 text-center text-xs text-green-300">🪢 Taming…</div>
              <div className="h-2 w-full overflow-hidden rounded bg-[var(--hud-surface-3)]">
                <div
                  className="h-full bg-green-500"
                  style={{
                    animation: `tameFill ${state.tamingChannel.durationMs}ms linear forwards`,
                  }}
                />
              </div>
              <style>{`@keyframes tameFill { from { width: 0% } to { width: 100% } }`}</style>
            </div>
          )}

          {/* Walking into range for a tame — the creature moves, so show that
              something is happening instead of silently doing nothing. */}
          {tamingApproach && !state.tamingChannel && (
            <div className="absolute bottom-44 left-1/2 z-hud-bar -translate-x-1/2 rounded-lg border border-green-700/50 bg-[var(--hud-bg)] px-4 py-2">
              <div className="text-center text-xs text-green-300">
                🪢 Approaching {tamingApproach.name}…
              </div>
              <button
                onClick={() => setTamingApproach(null)}
                className="mt-1 w-full text-center text-2xs text-hud-muted hover:text-hud-primary"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Taming overlay */}
          {tamingTarget && (
            <TamingOverlay
              targetName={tamingTarget.name}
              onTame={() => {
                setTamingApproach({
                  entityId: tamingTarget.entityId,
                  name: tamingTarget.name,
                });
                setTamingTarget(null);
              }}
              onCancel={() => setTamingTarget(null)}
            />
          )}

          {/* Inspect — one panel for players, mobs and NPCs (power, vitals, paperdoll) */}
          {inspectTargetId &&
            panelOn("inspect") &&
            (() => {
              const ent = state.entities.get(inspectTargetId);
              if (
                !ent ||
                (ent.type !== EntityType.Mob &&
                  ent.type !== EntityType.Npc &&
                  ent.type !== EntityType.Player)
              ) {
                return null;
              }
              // A boss's inspect lives inside the BossBar — don't open the separate
              // modal for it.
              if (gameState.isBoss(inspectTargetId)) return null;
              return (
                <InspectPanel
                  entity={ent}
                  itemDefs={state.itemDefs}
                  inspected={state.inspectedPlayer}
                  onClose={closeInspect}
                />
              );
            })()}

          {/* Pet party panel now renders as a drawer inside the inventory panel
              (petsDrawer prop above), mirroring the character stats drawer. */}

          {/* Breeding panel */}
          {showBreeding && panelOn("breeding") && (
            <BreedingPanel
              pets={state.ownedPets}
              breedingJobs={state.breedingJobs}
              onBreed={(pet1Id, pet2Id) => {
                socketRef.current?.send({
                  type: "PetBreedIntent",
                  pet1InstanceId: pet1Id,
                  pet2InstanceId: pet2Id,
                });
              }}
              onClose={() => setShowBreeding(false)}
            />
          )}

          <LootRollWindow
            rolls={state.lootRolls}
            itemDefs={state.itemDefs}
            selfId={state.selfId}
            onVote={(rollId, choice) =>
              socketRef.current?.send({ type: "LootRollVoteIntent", rollId, choice })
            }
          />

          {/* Party frame (suppressed while raiding — the raid frame takes over). */}
          {!state.raid && panelOn("party") && (
            <PartyFrame
              party={state.party}
              entities={state.entities}
              selfId={state.selfId}
              selfCharacterId={state.selfCharacterId ?? state.selfId}
              onLeave={() => socketRef.current?.send({ type: "PartyLeaveIntent" })}
              onKick={(characterId) =>
                socketRef.current?.send({ type: "PartyKickIntent", targetCharacterId: characterId })
              }
            />
          )}

          <RaidFrame
            raid={state.raid}
            entities={state.entities}
            selfId={state.selfId}
            onLeave={() => socketRef.current?.send({ type: "RaidLeaveIntent" })}
            onDisband={() => socketRef.current?.send({ type: "RaidDisbandIntent" })}
            onKick={(entityId) =>
              socketRef.current?.send({ type: "RaidKickIntent", targetCharacterId: entityId })
            }
          />

          {/* Character panel */}
          {showCharacter && panelOn("character") && (
            <CharacterPanel
              name={state.selfName}
              gold={state.selfSilver}
              isGuest={state.selfIsGuest}
              stats={state.selfStats}
              equipment={state.equipment}
              level={state.playerLevel}
              skills={state.skills}
              createdAt={state.createdAt}
              onUnequip={(slot) => {
                // No target slot index: let the server drop it in the first free
                // bag slot, the same as the inventory panel's unequip does when
                // nothing specific was dragged onto.
                socketRef.current?.send({ type: "UnequipIntent", slot });
              }}
              onClose={() => setShowCharacter(false)}
            />
          )}

          {/* Crafting panel — opens from a world crafting-station entity OR from an
              NPC that authored a crafting station (server CraftingStationOpen). */}
          {activeCraftingStationType && featureOn("crafting") && panelOn("crafting") && (
            <CraftingPanel
              recipes={state.knownRecipes}
              inventory={state.inventory}
              skills={state.skills}
              stationType={activeCraftingStationType}
              stationEntityId={craftingStationEntityId ?? undefined}
              station={
                craftingStationEntityId
                  ? ((state.entities.get(craftingStationEntityId) ?? null) as never)
                  : null
              }
              isStationOwner={
                !!craftingStationEntityId &&
                (
                  state.entities.get(craftingStationEntityId) as
                    | { ownerCharacterId?: string }
                    | undefined
                )?.ownerCharacterId === state.selfCharacterId
              }
              itemDefs={state.itemDefs}
              onRefuelStation={(stationId, itemInstanceId, quantity) => {
                socketRef.current?.send({
                  type: "RefuelCraftingStationIntent",
                  stationId,
                  itemInstanceId,
                  quantity,
                });
              }}
              onSetStationTax={(stationId, taxRatePercent) => {
                socketRef.current?.send({
                  type: "SetCraftingStationTaxIntent",
                  stationId,
                  taxRatePercent,
                });
              }}
              onCollectStationTax={(stationId) => {
                socketRef.current?.send({ type: "CollectCraftingStationTaxIntent", stationId });
              }}
              onPickupStation={(stationId) => {
                socketRef.current?.send({ type: "PickupCraftingStationIntent", stationId });
                closeCraftingPanel();
              }}
              onCraft={(recipeId, stationId, tier) => {
                socketRef.current?.send({
                  type: "CraftIntent",
                  recipeId,
                  // Omitted for an NPC-opened station: the server holds that
                  // record itself, and a bogus id would fail the entity lookup.
                  ...(stationId ? { stationId } : {}),
                  tier,
                });
              }}
              craftTierRangeFor={craftTierRangeFor}
              onClose={closeCraftingPanel}
            />
          )}

          {/* Dev/Admin crafting panel — shows all stations */}
          {showCraftingDev &&
            !activeCraftingStationType &&
            featureOn("crafting") &&
            panelOn("crafting") && (
              <CraftingPanel
                recipes={state.knownRecipes}
                inventory={state.inventory}
                skills={state.skills}
                onCraft={(recipeId, stationId, tier) => {
                  socketRef.current?.send({
                    type: "CraftIntent",
                    recipeId,
                    ...(stationId ? { stationId } : {}),
                    tier,
                  });
                }}
                craftTierRangeFor={craftTierRangeFor}
                onClose={() => setShowCraftingDev(false)}
              />
            )}

          {/* Enchant window (rune socketing) — recomposable panel `enchant` */}
          {showEnchant && featureOn("enchanting") && panelOn("enchant") && (
            <EnchantPanel
              onApplyRune={(itemInstanceId, runeInstanceId, slotIndex) => {
                socketRef.current?.send({
                  type: "ApplyRuneIntent",
                  itemInstanceId,
                  runeInstanceId,
                  slotIndex,
                });
              }}
              onRemoveRune={(itemInstanceId, slotIndex) => {
                socketRef.current?.send({
                  type: "RuneRemoveIntent",
                  itemInstanceId,
                  slotIndex,
                });
              }}
              onClose={() => setShowEnchant(false)}
            />
          )}

          {/* Upgrade window (+N) — recomposable panel `upgrade` */}
          {showUpgrade && featureOn("equipmentUpgrade") && panelOn("upgrade") && (
            <UpgradePanel
              onUpgrade={(itemInstanceId, materialInstanceIds) => {
                socketRef.current?.send({
                  type: "UpgradeItemIntent",
                  itemInstanceId,
                  materialInstanceIds,
                });
              }}
              onClose={() => setShowUpgrade(false)}
            />
          )}

          {/* Affix Reroll window — panel `affixReroll` */}
          {showAffixReroll && featureOn("affixReroll") && panelOn("affixReroll") && (
            <AffixRerollPanel
              onReroll={(itemInstanceId) => {
                socketRef.current?.send({ type: "AffixRerollIntent", itemInstanceId });
              }}
              onClose={() => setShowAffixReroll(false)}
            />
          )}

          {/* Unified Store (Items + Gold) */}
          {showStore && (panelOn("premiumShop") || panelOn("goldStore")) && (
            <PremiumShopPanel
              catalog={state.premiumShopCatalog}
              promotions={state.premiumShopPromotions}
              accountGold={state.accountGold ?? 0}
              lastPurchase={state.premiumShopLastPurchase}
              couponResult={state.premiumShopCouponResult}
              history={state.premiumShopHistory}
              onBuyGold={(productId) => {
                socketRef.current?.send({
                  type: "ItemShopBuyGoldIntent",
                  productId,
                  idempotencyKey: `gold_${productId}_${Date.now()}`,
                });
              }}
              onCheckoutStripe={(productId) => {
                socketRef.current?.send({ type: "ItemShopCheckoutStripeIntent", productId });
              }}
              onCheckoutPaypal={(productId) => {
                socketRef.current?.send({ type: "ItemShopCheckoutPaypalIntent", productId });
              }}
              onApplyCoupon={(code) => {
                socketRef.current?.send({ type: "ItemShopApplyCouponIntent", couponCode: code });
              }}
              onViewHistory={() => {
                socketRef.current?.send({ type: "ItemShopHistoryIntent" });
              }}
              initialTab={storeInitialTab}
              goldTiers={state.goldStoreTiers}
              goldPurchaseResult={state.goldStoreLastPurchase}
              onGoldCheckoutStripe={(tierId) => {
                socketRef.current?.send({ type: "GoldStoreCheckoutStripeIntent", tierId });
              }}
              onGoldCheckoutPaypal={(tierId) => {
                socketRef.current?.send({ type: "GoldStoreCheckoutPaypalIntent", tierId });
              }}
              onBrowseGoldTiers={() => {
                socketRef.current?.send({ type: "GoldStoreBrowseIntent" });
              }}
              premiumPlans={state.premiumPlans}
              premiumUntil={state.premiumUntil}
              premiumPurchaseResult={state.premiumLastPurchase}
              onBrowsePremiumPlans={() => {
                socketRef.current?.send({ type: "PremiumPlansBrowseIntent" });
              }}
              onBuyPremiumPlan={(planId) => {
                socketRef.current?.send({ type: "PremiumPurchaseIntent", planId });
              }}
              onClose={() => setShowStore(false)}
            />
          )}

          {/* Social panel (Party / Friends / Guild) — each tab gated on its own
              feature flag; the panel hides entirely when all three are off. */}
          {showSocial &&
            panelOn("social") &&
            (featureOn("parties") || featureOn("friends") || featureOn("guilds")) && (
              <SocialPanel
                party={state.party}
                entities={state.entities}
                selfId={state.selfId}
                selfCharacterId={state.selfCharacterId ?? state.selfId}
                friends={state.friends}
                blockedPlayers={state.blockedPlayers}
                friendSearchResults={state.friendSearchResults}
                pendingFriendRequests={state.pendingSocialInvites.filter(
                  (i) => i.kind === "friend",
                )}
                guild={state.guild}
                alliance={state.alliance}
                allianceInvite={
                  state.pendingSocialInvites.find((i) => i.kind === "alliance") ?? null
                }
                partiesEnabled={featureOn("parties")}
                friendsEnabled={featureOn("friends")}
                guildsEnabled={featureOn("guilds") && panelOn("guild")}
                alliancesEnabled={featureOn("guildAlliances")}
                activeTab={socialPanelTab}
                onTabChange={setSocialPanelTab}
                onClose={() => setShowSocial(false)}
                onPartyKick={(characterId) => {
                  socketRef.current?.send({
                    type: "PartyKickIntent",
                    targetCharacterId: characterId,
                  });
                }}
                onPartyLeave={() => {
                  socketRef.current?.send({ type: "PartyLeaveIntent" });
                }}
                onFriendSearch={(query) => {
                  socketRef.current?.send({ type: "CharacterSearchIntent", query });
                }}
                onFriendAdd={(targetCharacterId) => {
                  socketRef.current?.send({ type: "FriendAddIntent", targetCharacterId });
                }}
                onFriendRemove={(targetCharacterId) => {
                  socketRef.current?.send({ type: "FriendRemoveIntent", targetCharacterId });
                }}
                onFriendWhisper={(targetCharacterId, name) => {
                  gameState.whisperTarget = { id: targetCharacterId, name };
                  gameState.activeChatChannel = "whisper";
                  gameState.notify();
                }}
                onFriendAccept={(targetCharacterId) => {
                  socketRef.current?.send({ type: "FriendAcceptIntent", targetCharacterId });
                  gameState.removeSocialInvite(`friend:${targetCharacterId}`);
                }}
                onFriendDecline={(targetCharacterId) => {
                  socketRef.current?.send({ type: "FriendDeclineIntent", targetCharacterId });
                  gameState.removeSocialInvite(`friend:${targetCharacterId}`);
                }}
                onFriendBlock={(targetCharacterId, blockType) => {
                  socketRef.current?.send({
                    type: "FriendBlockIntent",
                    targetCharacterId,
                    blockType,
                  });
                }}
                onFriendUnblock={(targetCharacterId) => {
                  socketRef.current?.send({ type: "FriendUnblockIntent", targetCharacterId });
                }}
                onGuildCreate={(name, tag) => {
                  socketRef.current?.send({ type: "GuildCreateIntent", name, tag });
                }}
                onGuildInvite={(targetId) => {
                  socketRef.current?.send({
                    type: "GuildInviteIntent",
                    targetCharacterId: targetId,
                  });
                }}
                onGuildSetRank={(rankOrder, rankName, permissions) => {
                  socketRef.current?.send({
                    type: "GuildSetRankIntent",
                    rankOrder,
                    ...(rankName !== undefined ? { rankName } : {}),
                    ...(permissions !== undefined ? { permissions } : {}),
                  });
                }}
                onGuildAction={(action, targetId, amount) => {
                  socketRef.current?.send({
                    type: "GuildActionIntent",
                    action: action as
                      | "accept"
                      | "decline"
                      | "leave"
                      | "kick"
                      | "promote"
                      | "demote"
                      | "deposit"
                      | "withdraw",
                    targetCharacterId: targetId,
                    // Deposit/withdraw carry the silver amount; the server
                    // ignores non-positive values, so the old amount-less
                    // "Deposit Silver" button had never moved a coin.
                    amount,
                  });
                }}
                onGuildSetTax={(mobTaxPct) => {
                  socketRef.current?.send({ type: "GuildSetTaxIntent", mobTaxPct });
                }}
                onGuildUpgrade={() => {
                  socketRef.current?.send({ type: "GuildUpgradeIntent" });
                }}
                showCreateButton={
                  getEffectiveUICustomization().panels?.guild?.appearance?.showCreateButton !==
                  false
                }
                createRequestNonce={guildCreateRequested}
                onAllianceCreate={(name, tag) => {
                  socketRef.current?.send({ type: "AllianceCreateIntent", name, tag });
                }}
                onAllianceInvite={(targetGuildId) => {
                  socketRef.current?.send({ type: "AllianceInviteIntent", targetGuildId });
                }}
                onAllianceAction={(action, targetGuildId) => {
                  socketRef.current?.send({
                    type: "AllianceActionIntent",
                    action: action as
                      | "accept"
                      | "decline"
                      | "leave"
                      | "kick"
                      | "disband"
                      | "deposit"
                      | "withdraw",
                    targetGuildId,
                  });
                  // The server confirms with AllianceUpdate; drop the invite card
                  // immediately so answering it doesn't leave a stale prompt.
                  if (action === "accept" || action === "decline") {
                    gameState.removeSocialInvitesByKind("alliance");
                  }
                }}
                seasonLeaderboard={state.guildSeasonLeaderboard}
                onRequestSeasonLeaderboard={() => {
                  socketRef.current?.send({ type: "GuildSeasonLeaderboardRequest" });
                }}
              />
            )}

          {/* Market panel */}
          {showMarket && featureOn("market") && panelOn("market") && (
            <MarketPanel
              orders={state.marketOrders}
              inventory={state.inventory}
              itemDefs={state.itemDefs}
              gold={state.selfSilver}
              skills={state.skills}
              skillDefs={state.skillDefs}
              selfCharacterId={state.selfCharacterId}
              detail={state.marketItemDetail}
              onRequestDetail={(itemDefinitionId) => {
                socketRef.current?.send({ type: "MarketItemDetailIntent", itemDefinitionId });
              }}
              onBuy={(orderId) => {
                socketRef.current?.send({ type: "MarketBuyIntent", orderId });
              }}
              onList={(itemId, price) => {
                socketRef.current?.send({
                  type: "MarketListIntent",
                  itemInstanceId: itemId,
                  priceGold: price,
                });
              }}
              onCancel={(orderId) => {
                socketRef.current?.send({ type: "MarketCancelIntent", orderId });
              }}
              onClose={() => {
                setShowMarket(false);
                socketRef.current?.send({ type: "MarketCloseIntent" });
              }}
            />
          )}

          {/* Gold/Silver exchange panel */}
          {showCurrencyExchange && panelOn("currencyExchange") && (
            <CurrencyExchangePanel
              accountGold={state.accountGold}
              silver={state.selfSilver}
              range={state.currencyExchangeRange}
              lastPrice={state.currencyExchangeLastPrice}
              bestBid={state.currencyExchangeBestBid}
              bestAsk={state.currencyExchangeBestAsk}
              bids={state.currencyExchangeBids}
              asks={state.currencyExchangeAsks}
              myOrders={state.currencyExchangeMyOrders}
              recentTrades={state.currencyExchangeRecentTrades}
              candles={state.currencyExchangeCandles}
              onRequestHistory={(range) => {
                socketRef.current?.send({ type: "CurrencyExchangeHistoryIntent", range });
              }}
              onPlaceOrder={(params) => {
                socketRef.current?.send({
                  type: "CurrencyExchangePlaceOrderIntent",
                  side: params.side,
                  orderType: params.orderType,
                  quantityGold: params.quantityGold,
                  limitPriceSilver: params.limitPriceSilver ?? null,
                  stopPriceSilver: params.stopPriceSilver ?? null,
                });
              }}
              onCancelOrder={(orderId) => {
                socketRef.current?.send({ type: "CurrencyExchangeCancelOrderIntent", orderId });
              }}
              onClose={() => {
                setShowCurrencyExchange(false);
                socketRef.current?.send({ type: "CurrencyExchangeCloseIntent" });
              }}
            />
          )}

          {/* Build mode panel */}
          {showBuildMode && featureOn("housing") && panelOn("buildMode") && (
            <BuildModePanel
              active={state.buildModeActive}
              plotId={state.currentPlotId}
              onPlace={(context, definitionId, localX, localY, rotation, interiorId) => {
                // Schema requires a non-empty plotId — never send with no active plot.
                if (!state.currentPlotId) return;
                socketRef.current?.send({
                  type: "BuildPlaceIntent",
                  plotId: state.currentPlotId,
                  context,
                  interiorId,
                  entityType: "building",
                  definitionId,
                  localX,
                  localY,
                  rotation,
                });
              }}
              onRemove={(placedEntityId) => {
                if (!state.currentPlotId) return;
                socketRef.current?.send({
                  type: "BuildRemoveIntent",
                  plotId: state.currentPlotId,
                  placedEntityId,
                });
              }}
              onToggle={() => {
                gameState.buildModeActive = !gameState.buildModeActive;
                gameState.notify();
              }}
              onClose={() => {
                gameState.buildModeActive = false;
                gameState.notify();
                setShowBuildMode(false);
                engineRef.current?.setWallBuild(null);
                engineRef.current?.setObjectBuild(null);
                engineRef.current?.setTileBuild(null);
                engineRef.current?.setBuildRemoveMode(false);
                setArmedWall(null);
                setArmedObjectItem(null);
                setArmedTileItem(null);
                setBuildRemoveMode(false);
              }}
              claimSize={
                gameState.currentClaim?.bounds
                  ? {
                      w: gameState.currentClaim.bounds.width,
                      h: gameState.currentClaim.bounds.height,
                    }
                  : null
              }
              isTopDown={getViewMode() === "topdown"}
              armedObjectItemId={armedObjectItem}
              onArmObject={(item) => {
                setArmedObjectItem(item?.itemDefinitionId ?? null);
                setBuildRemoveMode(false);
                engineRef.current?.setBuildRemoveMode(false);
                engineRef.current?.setObjectBuild(
                  item
                    ? {
                        itemDefinitionId: item.itemDefinitionId,
                        mapObjectDefId: item.mapObjectDefId,
                        rotation: buildRotation,
                      }
                    : null,
                );
              }}
              rotation={buildRotation}
              onRotate={() => {
                const next = (buildRotation + 90) % 360;
                setBuildRotation(next);
                const build = engineRef.current?.objectBuild;
                if (build) engineRef.current?.setObjectBuild({ ...build, rotation: next });
              }}
              removeMode={buildRemoveMode}
              onToggleRemoveMode={(on) => {
                setBuildRemoveMode(on);
                engineRef.current?.setBuildRemoveMode(on);
                if (on) {
                  setArmedObjectItem(null);
                  engineRef.current?.setObjectBuild(null);
                  setArmedTileItem(null);
                  engineRef.current?.setTileBuild(null);
                }
              }}
              armedTileItemId={armedTileItem}
              onSetTilePaint={(cfg) => {
                setArmedTileItem(cfg?.item.itemDefinitionId ?? null);
                engineRef.current?.setTileBuild(
                  cfg
                    ? {
                        itemDefinitionId: cfg.item.itemDefinitionId,
                        tilesetId: cfg.item.tilesetId,
                        layer: cfg.item.decal ? "overlay" : cfg.item.layer,
                        tool: cfg.tool,
                        brush: cfg.brush,
                      }
                    : null,
                );
              }}
              buildableTileItems={(() => {
                const byItem = new Map<
                  string,
                  {
                    itemDefinitionId: string;
                    tilesetId: string;
                    layer: "floor" | "overlay" | "wall";
                    name: string;
                    count: number;
                    decal?: boolean;
                    def?: import("@ed5-mmo-studio/shared").ItemDefinition;
                  }
                >();
                for (const inst of state.inventory) {
                  const def = state.itemDefs.get(inst.definitionId);
                  const b = def?.building;
                  if (b?.kind !== "tile" || !b.tilesetId) continue;
                  const count = inst.quantity ?? inst.stackSize ?? 1;
                  const ex = byItem.get(def!.id);
                  if (ex) ex.count += count;
                  else
                    byItem.set(def!.id, {
                      itemDefinitionId: def!.id,
                      tilesetId: b.tilesetId,
                      layer: b.layer ?? "floor",
                      name: def!.name,
                      count,
                      decal: b.layer === "overlay" ? true : undefined,
                      def: def!,
                    });
                }
                return [...byItem.values()];
              })()}
              buildableItems={(() => {
                // Owned items whose building descriptor places a map object —
                // these generate the panel's palette categories with real icons.
                const byItem = new Map<
                  string,
                  {
                    itemDefinitionId: string;
                    mapObjectDefId: string;
                    name: string;
                    count: number;
                    category: string;
                    def?: import("@ed5-mmo-studio/shared").ItemDefinition;
                  }
                >();
                for (const inst of state.inventory) {
                  const def = state.itemDefs.get(inst.definitionId);
                  const b = def?.building;
                  if (b?.kind !== "object") continue;
                  const count = inst.quantity ?? inst.stackSize ?? 1;
                  const ex = byItem.get(def!.id);
                  if (ex) ex.count += count;
                  else
                    byItem.set(def!.id, {
                      itemDefinitionId: def!.id,
                      mapObjectDefId: b.mapObjectDefId || def!.id,
                      name: def!.name,
                      count,
                      category: b.category || "Objects",
                      def: def!,
                    });
                }
                return [...byItem.values()];
              })()}
              wallItems={(() => {
                // Group inventory wall-items by wallDefId (walls are items).
                const byWall = new Map<
                  string,
                  { wallDefId: string; itemDefinitionId: string; name: string; count: number }
                >();
                for (const inst of state.inventory) {
                  const def = state.itemDefs.get(inst.definitionId);
                  const b = def?.building;
                  if (b?.kind !== "wall" || !b.wallDefId) continue;
                  const count = inst.quantity ?? inst.stackSize ?? 1;
                  const ex = byWall.get(b.wallDefId);
                  if (ex) ex.count += count;
                  else
                    byWall.set(b.wallDefId, {
                      wallDefId: b.wallDefId,
                      itemDefinitionId: def!.id,
                      name: def!.name,
                      count,
                    });
                }
                return [...byWall.values()];
              })()}
              selectedWallDefId={armedWall}
              onSelectWall={(wallDefId, itemDefinitionId) => {
                setArmedWall(wallDefId);
                engineRef.current?.setWallBuild(
                  wallDefId && itemDefinitionId ? { wallDefId, itemDefinitionId } : null,
                );
              }}
              roofStyle={state.plotRoofStyles.get(state.currentPlotId ?? "") ?? "gable"}
              onSetRoofStyle={(roofStyle) => {
                if (!state.currentPlotId) return;
                socketRef.current?.send({
                  type: "SetPlotRoofStyleIntent",
                  plotId: state.currentPlotId,
                  roofStyle,
                });
              }}
            />
          )}

          {/* Land Claims panel */}
          {showClaims && panelOn("claims") && (
            <ClaimManagementPanel
              ownedClaims={state.ownedClaims}
              currentClaim={state.currentClaim}
              inspectedClaimInfo={state.inspectedClaimInfo}
              onClaimLand={(name) => {
                // Schema requires a non-empty zoneId — skip until the zone is known.
                if (!state.currentZoneId) return;
                socketRef.current?.send({
                  type: "ClaimLandIntent",
                  zoneId: state.currentZoneId,
                  centerX: Math.floor(state.selfPosition.x),
                  centerY: Math.floor(state.selfPosition.y),
                  name,
                });
              }}
              onUnclaimLand={(claimId) => {
                socketRef.current?.send({ type: "UnclaimLandIntent", claimId });
              }}
              onRenameClaim={(claimId, name) => {
                socketRef.current?.send({ type: "ClaimRenameIntent", claimId, name });
              }}
              onSetPermission={(claimId, targetPlayerId, role, flags) => {
                socketRef.current?.send({
                  type: "ClaimSetPermissionIntent",
                  claimId,
                  targetPlayerId,
                  role,
                  flags,
                });
              }}
              onRemovePermission={(claimId, targetPlayerId) => {
                socketRef.current?.send({
                  type: "ClaimRemovePermissionIntent",
                  claimId,
                  targetPlayerId,
                });
              }}
              onRequestClaimInfo={(claimId) => {
                socketRef.current?.send({ type: "ClaimInfoRequest", claimId });
              }}
              onClose={() => setShowClaims(false)}
            />
          )}

          {/* Farming panel */}
          {showFarming &&
            state.currentClaim &&
            state.isFeatureEnabled("farming") &&
            panelOn("farming") && (
              <FarmingPanel
                claimId={state.currentClaim.id}
                farmTiles={Array.from(state.farmTiles.values()).filter(
                  (t) => t.claimId === state.currentClaim?.id,
                )}
                seedItems={state.inventory
                  .filter((item) => {
                    // Item TYPE is the real signal — the name check is kept only so
                    // worlds whose seeds were authored under some other type (and
                    // relied on this list before) don't lose them.
                    const def = state.itemDefs.get(item.definitionId);
                    if (!def) return false;
                    return (
                      def.type === ItemType.Seed ||
                      (def.name?.toLowerCase().includes("seed") ?? false)
                    );
                  })
                  .map((item) => ({
                    definitionId: item.definitionId,
                    name: state.itemDefs.get(item.definitionId)?.name ?? item.definitionId,
                    quantity: item.quantity,
                  }))}
                onTill={(tileX, tileY) => {
                  socketRef.current?.send({
                    type: "FarmTillIntent",
                    claimId: state.currentClaim!.id,
                    tileX,
                    tileY,
                  });
                }}
                onPlant={(tileX, tileY, seedItemId) => {
                  socketRef.current?.send({
                    type: "FarmPlantIntent",
                    claimId: state.currentClaim!.id,
                    tileX,
                    tileY,
                    seedItemId,
                  });
                }}
                onHarvest={(tileX, tileY) => {
                  socketRef.current?.send({
                    type: "FarmHarvestIntent",
                    claimId: state.currentClaim!.id,
                    tileX,
                    tileY,
                  });
                }}
                onInspect={() => {
                  socketRef.current?.send({
                    type: "FarmInspectIntent",
                    claimId: state.currentClaim!.id,
                  });
                }}
                onClose={() => setShowFarming(false)}
              />
            )}

          {/* Pasture panel */}
          {showPastures && state.currentClaim && panelOn("pasture") && (
            <PasturePanel
              claimId={state.currentClaim.id}
              pastures={state.claimPastures.get(state.currentClaim.id) ?? []}
              pastureDefinitions={state.claimConfig?.pastureDefinitions ?? []}
              ownedPets={state.ownedPets}
              onPlacePasture={(definitionId, localX, localY) => {
                socketRef.current?.send({
                  type: "PasturePlaceIntent",
                  claimId: state.currentClaim!.id,
                  definitionId,
                  localX,
                  localY,
                });
              }}
              onRemovePasture={(pastureId) => {
                socketRef.current?.send({
                  type: "PastureRemoveIntent",
                  claimId: state.currentClaim!.id,
                  pastureId,
                });
              }}
              onAssignPet={(pastureId, petInstanceId) => {
                socketRef.current?.send({
                  type: "PastureAssignPetIntent",
                  claimId: state.currentClaim!.id,
                  pastureId,
                  petInstanceId,
                });
              }}
              onUnassignPet={(pastureId, petInstanceId) => {
                socketRef.current?.send({
                  type: "PastureUnassignPetIntent",
                  claimId: state.currentClaim!.id,
                  pastureId,
                  petInstanceId,
                });
              }}
              onCollectYields={(pastureId) => {
                socketRef.current?.send({
                  type: "PastureCollectYieldsIntent",
                  claimId: state.currentClaim!.id,
                  pastureId,
                });
              }}
              onClose={() => setShowPastures(false)}
            />
          )}

          {/* Frame-rate readout (Settings → Graphics → Performance) */}
          <FpsCounter />

          {/* "Really drop this?" (Settings → Gameplay) */}
          {pendingDrop && (
            <ConfirmDialog
              title="Drop item?"
              body={`${pendingDrop.name}${pendingDrop.quantity > 1 ? ` ×${pendingDrop.quantity}` : ""} will be dropped on the ground where you stand. Anyone nearby can pick it up.`}
              confirmLabel="Drop"
              destructive
              onCancel={() => setPendingDrop(null)}
              onConfirm={() => {
                pendingDrop.send();
                setPendingDrop(null);
              }}
            />
          )}

          {/* Settings panel */}
          {showSettings && panelOn("settings") && (
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onCharacterSelect={() => setExitMode("character_select")}
              onLogout={() => setExitMode("logout")}
            />
          )}

          {/* Exit / logout countdown */}
          {exitMode && (
            <ExitCountdownOverlay
              variant={exitMode}
              title={exitMode === "logout" ? "Logging Out" : "Returning to Character Select"}
              subtitle={
                exitMode === "logout"
                  ? "Saving character data and signing out…"
                  : "Saving character data — please wait."
              }
              onCancel={() => setExitMode(null)}
              onComplete={async () => {
                const mode = exitMode;
                setExitMode(null);
                try {
                  // Tell the server we're leaving so it can persist immediately,
                  // then close the socket cleanly.
                  try {
                    socketRef.current?.send({ type: "LeaveWorldIntent" } as never);
                  } catch {
                    // Protocol may not have a LeaveWorldIntent yet — disconnect handles it.
                  }
                  cleanupRef.current?.();
                  cleanupRef.current = null;
                  socketRef.current?.disconnect();
                  socketRef.current = null;

                  if (mode === "logout") {
                    try {
                      const authConfig = await loadAuthConfig();
                      const supabase = createClient();
                      if (authConfig.mode === "supabase") {
                        await supabase?.auth.signOut();
                      }
                    } catch {
                      // Best-effort sign out
                    }
                    if (typeof window !== "undefined") {
                      try {
                        localStorage.removeItem(`${GameConfig.localStoragePrefix}:auto-login`);
                        localStorage.removeItem(
                          `${GameConfig.localStoragePrefix}:local-auth-token`,
                        );
                      } catch {
                        // ignore storage errors
                      }
                    }
                    router.push("/login");
                  } else {
                    router.push(characterSelectHref());
                  }
                } catch (err) {
                  console.error("[exit] failed to exit cleanly", err);
                  router.push(mode === "logout" ? "/login" : characterSelectHref());
                }
              }}
            />
          )}

          {/* Quest log panel (full screen) */}
          {showQuests && featureOn("quests") && panelOn("questLog") && (
            <QuestLogPanel
              quests={state.activeQuests}
              completedQuestIds={state.completedQuestIds}
              trackedQuestIds={state.trackedQuestIds}
              onAbandon={(questId) => {
                socketRef.current?.send({ type: "QuestAbandonIntent", questId });
              }}
              onTurnIn={(questId) => {
                socketRef.current?.send({ type: "QuestTurnInIntent", questId });
              }}
              onToggleTrack={(questId) => {
                gameState.toggleTrackQuest(questId);
              }}
              onClose={() => setShowQuests(false)}
            />
          )}

          {/* Quest Tracker HUD (persistent side panel) */}
          {!showQuests &&
            featureOn("quests") &&
            state.activeQuests.length > 0 &&
            hudVisible("questTracker") && (
              <HudSlot id="questTracker">
                <QuestTrackerHUD
                  quests={state.activeQuests}
                  trackedQuestIds={state.trackedQuestIds}
                  onUntrack={(questId) => gameState.toggleTrackQuest(questId)}
                  onOpenLog={() => setShowQuests(true)}
                />
              </HudSlot>
            )}

          {/* Achievements window */}
          {showAchievements && panelOn("achievements") && (
            <AchievementsPanel
              achievements={state.achievements}
              totalPoints={state.achievementPoints}
              trackedIds={state.trackedAchievementIds}
              notifications={state.achievementNotifications}
              onToggleTrack={(id) => gameState.toggleTrackAchievement(id)}
              onClose={() => setShowAchievements(false)}
            />
          )}

          {/* Achievement Tracker HUD (pinned goals, under the quest tracker) */}
          {!showAchievements &&
            panelOn("achievements") &&
            state.trackedAchievementIds.size > 0 &&
            hudVisible("achievementTracker") && (
              <HudSlot id="achievementTracker">
                <AchievementTrackerHUD
                  achievements={state.achievements}
                  trackedIds={state.trackedAchievementIds}
                  onUntrack={(id) => gameState.toggleTrackAchievement(id)}
                  onOpenPanel={() => setShowAchievements(true)}
                />
              </HudSlot>
            )}

          {/* NPC Interact Prompt (proximity) — world chrome, so it steps aside
              for a full-screen turn-based battle like the rest of the HUD. */}
          {state.nearbyNpcId &&
            !state.npcDialogue &&
            !state.shopState &&
            !battleOwnsScreen &&
            npcPromptScreen &&
            (() => {
              const npcEntity = state.entities.get(state.nearbyNpcId!) as NpcEntity | undefined;
              if (!npcEntity) return null;
              return (
                <NpcInteractPrompt
                  npc={npcEntity}
                  questIndicator={state.getNpcQuestIndicator(npcEntity.id)}
                  screenX={npcPromptScreen.x}
                  screenY={npcPromptScreen.y}
                  onInteract={() => {
                    socketRef.current?.send({ type: "InteractIntent", entityId: npcEntity.id });
                  }}
                />
              );
            })()}

          {/* NPC Dialogue window — never over a running pet battle, where it
              covers the stage and the move grid. */}
          {state.npcDialogue && !state.activeBattle && panelOn("npcDialogue") && (
            <NpcDialogueWindow
              npcName={state.npcDialogue.npcName}
              text={state.npcDialogue.text}
              options={state.npcDialogue.options}
              npcRole={state.npcDialogue.npcRole}
              npcFaction={state.npcDialogue.npcFaction}
              activeQuests={state.activeQuests}
              voiceMediaId={state.npcDialogue.voiceMediaId}
              onSay={
                // Only offer the freeform chat input when the server confirmed
                // AI chat actually works (feature flag on AND a usable provider
                // key/lease exists). No confirmation → no chat box.
                featureOn("npcAiChat") && state.npcDialogue.aiChatAvailable === true
                  ? (sayText) => {
                      const npcId = gameState.npcDialogue?.npcEntityId;
                      if (npcId)
                        socketRef.current?.send({
                          type: "NpcChatIntent",
                          npcEntityId: npcId,
                          text: sayText,
                        });
                    }
                  : undefined
              }
              onSelect={(opt) => {
                const npcId = state.npcDialogue?.npcEntityId ?? "";
                switch (opt.action) {
                  // Enchant/Upgrade dialogue actions (§E entry point 3). The
                  // server validates the NPC's authored role on the intent and
                  // replies EventOpenEnchant/EventOpenUpgrade; the local open is
                  // latency-hiding (idempotent — both paths "open", not toggle)
                  // and gated on the same feature/panel switches as the render.
                  case "open_enchant":
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    if (featureOn("enchanting") && panelOn("enchant")) setShowEnchant(true);
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "open_upgrade":
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    if (featureOn("equipmentUpgrade") && panelOn("upgrade")) setShowUpgrade(true);
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "quest_accept":
                    if (opt.questId)
                      socketRef.current?.send({
                        type: "QuestAcceptIntent",
                        questId: opt.questId,
                        // Lets the server re-send this NPC's dialogue afterwards
                        // so the accepted quest stops being offered.
                        npcEntityId: npcId,
                      });
                    break;
                  case "quest_turn_in":
                    if (opt.questId)
                      socketRef.current?.send({
                        type: "QuestTurnInIntent",
                        questId: opt.questId,
                        npcEntityId: npcId,
                      });
                    break;
                  case "shop":
                    if (state.npcDialogue)
                      socketRef.current?.send({
                        type: "ShopOpenIntent",
                        npcEntityId: state.npcDialogue.npcEntityId,
                      });
                    break;
                  case "bank":
                    // Banker role: open the personal bank (server sends BankUpdate).
                    socketRef.current?.send({ type: "BankOpenIntent" });
                    setShowBank(true);
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "market":
                    // Auctioneer role: open the player market ("auction house").
                    // Register as a viewer so the server sends the order list.
                    socketRef.current?.send({ type: "MarketOpenIntent" });
                    setShowMarket(true);
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "repair":
                    // Blacksmith role: open the bag — being near the smith makes
                    // the per-item repair buttons usable (server checks proximity).
                    setShowInventory(true);
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "train":
                    // Trainer role: server validates the fee + teaches the ability.
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    break;
                  case "next":
                    // Advance dialogue — server sends next NpcDialogue message
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    break;
                  case "lore":
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    break;
                  case "vendor":
                  case "trainer":
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    break;
                  case "enter_instance":
                    // Server validates the NPC's authored instance opts into "npc"
                    // entry, then routes through the shared instance-entry op.
                    if (opt.id)
                      socketRef.current?.send({
                        type: "DialogueOptionIntent",
                        npcEntityId: npcId,
                        optionId: opt.id,
                      });
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "open_crafting":
                    // NPC-authored crafting station. The server re-derives the
                    // station from the NPC (we never send a station type) and
                    // replies with CraftingStationOpen, which opens the panel.
                    socketRef.current?.send({
                      type: "OpenCraftingStationIntent",
                      npcEntityId: npcId,
                    });
                    gameState.npcDialogue = null;
                    gameState.notify();
                    break;
                  case "close":
                  default:
                    break;
                }
                // For close actions, clear dialogue immediately
                if (opt.action === "close") {
                  gameState.npcDialogue = null;
                  gameState.notify();
                }
              }}
              onClose={() => {
                gameState.npcDialogue = null;
                gameState.notify();
              }}
            />
          )}

          {/* NPC Shop panel */}
          {state.shopState && featureOn("npcShops") && panelOn("shop") && (
            <ShopPanel
              shopName={state.shopState.shopName}
              npcEntityId={state.shopState.npcEntityId}
              buyList={state.shopState.buyList}
              sellPrices={state.shopState.sellPrices}
              inventory={state.inventory}
              gold={state.selfSilver}
              greeting={state.shopState.greeting}
              buybackList={state.shopState.buybackList}
              merchantGold={state.shopState.merchantGold}
              hoursEnabled={state.shopState.hoursEnabled}
              openHour={state.shopState.openHour}
              closeHour={state.shopState.closeHour}
              currentHour={state.shopState.currentHour}
              isFence={state.shopState.isFence}
              stolenPricePct={state.shopState.stolenPricePct}
              onBuy={(npcId, defId, qty) => {
                socketRef.current?.send({
                  type: "ShopBuyIntent",
                  npcEntityId: npcId,
                  itemDefinitionId: defId,
                  quantity: qty,
                });
              }}
              onBuyback={(npcId, defId, qty) => {
                socketRef.current?.send({
                  type: "ShopBuyIntent",
                  npcEntityId: npcId,
                  itemDefinitionId: defId,
                  quantity: qty,
                  fromBuyback: true,
                });
              }}
              onSell={(npcId, itemId, qty) => {
                socketRef.current?.send({
                  type: "ShopSellIntent",
                  npcEntityId: npcId,
                  itemInstanceId: itemId,
                  quantity: qty,
                });
              }}
              // An authored loadout kit is bought whole by the shelf row it was
              // clicked on; the server resolves its price and contents.
              onBuyKit={(npcId, stockId) => {
                socketRef.current?.send({
                  type: "ShopBuyIntent",
                  npcEntityId: npcId,
                  stockId,
                  quantity: 1,
                });
              }}
              onClose={() => {
                gameState.shopState = null;
                gameState.notify();
              }}
            />
          )}

          {/* Mail panel */}
          {showMail && featureOn("mail") && panelOn("mail") && (
            <MailPanel
              inbox={state.mailInbox}
              onRead={(mailId) => {
                socketRef.current?.send({ type: "MailReadIntent", mailId });
              }}
              onCollect={(mailId) => {
                socketRef.current?.send({ type: "MailCollectIntent", mailId });
              }}
              onDelete={(mailId) => {
                socketRef.current?.send({ type: "MailDeleteIntent", mailId });
              }}
              onSend={(recipientName, subject, body, attachedGold) => {
                socketRef.current?.send({
                  type: "MailSendIntent",
                  recipientName,
                  subject,
                  body,
                  attachedGold,
                });
              }}
              onClose={() => setShowMail(false)}
            />
          )}

          {/* Instances panel (dungeons / arenas / queue), opened from the TopBar
              "Dungeons" menu. Auto-opens on a ready-check or while in an
              instance/queue; feature-gated. */}
          {/* The browser never sits over the death screen or the victory card —
              those are the moments the player most needs to read the screen. */}
          {featureOn("instances") && showInstances && !state.isDead && !state.arenaMatchEnd && (
            <InstancePanel
              catalog={state.instanceCatalog}
              instanceState={state.instanceState}
              queue={state.instanceQueue}
              readyCheck={state.instanceReadyCheck}
              lockouts={state.instanceLockouts}
              onSend={(msg) => socketRef.current?.send(msg)}
              onClose={() => setShowInstances(false)}
            />
          )}

          {/* Calendar panel — opened by the top-bar weather/time/date chips. */}
          {showCalendar &&
            featureOn("calendar") &&
            panelOn("calendar") &&
            state.calendarDefinition &&
            state.calendarState && (
              <CalendarPanel
                definition={state.calendarDefinition}
                events={state.calendarEvents}
                state={state.calendarState}
                page={state.calendarPage}
                onRequestPage={requestCalendarPage}
                onClose={() => setShowCalendar(false)}
              />
            )}

          {/* Bank panel */}
          {showBank && featureOn("bank") && panelOn("bank") && (
            <BankPanel
              items={state.bankItems}
              maxSlots={state.bankMaxSlots}
              inventory={state.inventory}
              onDeposit={(itemId, qty) => {
                socketRef.current?.send({
                  type: "BankDepositIntent",
                  itemInstanceId: itemId,
                  quantity: qty,
                });
              }}
              onWithdraw={(itemId, qty) => {
                socketRef.current?.send({
                  type: "BankWithdrawIntent",
                  itemInstanceId: itemId,
                  quantity: qty,
                });
              }}
              onClose={() => setShowBank(false)}
            />
          )}

          {state.activeChest && featureOn("playerChests") && panelOn("chest") && (
            <ChestPanel
              chest={state.activeChest}
              inventory={state.inventory}
              onDeposit={(itemId, quantity) =>
                socketRef.current?.send({
                  type: "ChestDepositIntent",
                  chestId: state.activeChest!.chestId,
                  itemInstanceId: itemId,
                  quantity,
                })
              }
              onWithdraw={(itemId, quantity) =>
                socketRef.current?.send({
                  type: "ChestWithdrawIntent",
                  chestId: state.activeChest!.chestId,
                  itemInstanceId: itemId,
                  quantity,
                })
              }
              onPolicyChange={(accessPolicy) =>
                socketRef.current?.send({
                  type: "ChestSetPolicyIntent",
                  chestId: state.activeChest!.chestId,
                  accessPolicy,
                })
              }
              onPickup={() =>
                socketRef.current?.send({
                  type: "PickupChestIntent",
                  chestId: state.activeChest!.chestId,
                })
              }
              onClose={() =>
                socketRef.current?.send({
                  type: "CloseChestIntent",
                  chestId: state.activeChest!.chestId,
                })
              }
            />
          )}

          {/* Social invites (party/friend/guild) */}
          {state.pendingSocialInvites.length > 0 && (
            <div className="absolute top-20 left-4 z-50 flex flex-col gap-2">
              {state.pendingSocialInvites.map((invite) => {
                const borderClass =
                  invite.kind === "party"
                    ? "border-blue-500/40"
                    : invite.kind === "guild"
                      ? "border-green-500/40"
                      : invite.kind === "raid"
                        ? "border-orange-500/40"
                        : invite.kind === "alliance"
                          ? "border-violet-500/40"
                          : "border-cyan-500/40";

                // Every SocialInviteKind gets its own wording — raid and
                // alliance used to fall through to "sent you a friend request."
                const message =
                  invite.kind === "party" ? (
                    <>
                      <span className="text-blue-300 font-semibold">{invite.fromName}</span> invited
                      you to join their party.
                    </>
                  ) : invite.kind === "guild" ? (
                    <>
                      <span className="text-green-300 font-semibold">{invite.fromName}</span>{" "}
                      invited you to join{" "}
                      <span className="text-green-200 font-semibold">
                        [{invite.guildTag ?? "G"}] {invite.guildName ?? "Guild"}
                      </span>
                      .
                    </>
                  ) : invite.kind === "raid" ? (
                    <>
                      <span className="text-orange-300 font-semibold">{invite.fromName}</span>{" "}
                      invited you to join their raid.
                    </>
                  ) : invite.kind === "alliance" ? (
                    <>
                      <span className="text-violet-300 font-semibold">{invite.fromName}</span>{" "}
                      invites your guild to the alliance{" "}
                      <span className="text-violet-200 font-semibold">
                        [{invite.allianceTag ?? "A"}] {invite.allianceName ?? "Alliance"}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      <span className="text-cyan-300 font-semibold">{invite.fromName}</span> sent
                      you a friend request.
                    </>
                  );

                return (
                  <div
                    key={invite.id}
                    className={`bg-wa-surface/95 backdrop-blur rounded shadow-xl p-3 w-72 border ${borderClass}`}
                  >
                    <p className="text-xs text-white mb-2">{message}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          sendSocialInviteResponse(invite, "accept");
                          gameState.removeSocialInvite(invite.id);
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          sendSocialInviteResponse(invite, "decline");
                          gameState.removeSocialInvite(invite.id);
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trade request incoming toast */}
          {state.tradeIncomingRequest && (
            <div className="absolute top-20 right-4 z-50 bg-wa-surface/95 backdrop-blur border border-yellow-500/30 rounded shadow-xl p-3 w-64">
              <p className="text-xs text-white mb-2">
                <span className="text-yellow-400 font-semibold">
                  {state.tradeIncomingRequest.fromName}
                </span>{" "}
                wants to trade with you.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => socketRef.current?.send({ type: "TradeAcceptIntent" })}
                  className="flex-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => socketRef.current?.send({ type: "TradeDeclineIntent" })}
                  className="flex-1 px-2 py-1 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Duel request incoming toast */}
          {state.duelIncomingRequest && (
            <div className="absolute top-40 right-4 z-50 bg-wa-surface/95 backdrop-blur border border-red-500/30 rounded shadow-xl p-3 w-64">
              <p className="text-xs text-white mb-2">
                <span className="text-red-400 font-semibold">
                  {state.duelIncomingRequest.fromName}
                </span>{" "}
                challenged you to a duel.
              </p>
              <p className="text-[11px] text-gray-300 mb-2">
                Wager:{" "}
                <span className="text-yellow-400">
                  {state.duelIncomingRequest.wagerGold} silver
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => socketRef.current?.send({ type: "DuelAcceptIntent" })}
                  className="flex-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => socketRef.current?.send({ type: "DuelDeclineIntent" })}
                  className="flex-1 px-2 py-1 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Active duel HUD */}
          {state.activeDuel && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-wa-surface/95 backdrop-blur border border-red-500/30 rounded shadow-xl px-4 py-2">
              <div className="text-xs text-white">
                Duel vs{" "}
                <span className="text-red-400 font-semibold">{state.activeDuel.opponentName}</span>
                {" · "}
                Radius <span className="text-gray-300">{state.activeDuel.radius}</span>
                {" · "}
                Wager <span className="text-yellow-400">{state.activeDuel.wagerGold} silver</span>
              </div>
              <div className="mt-1 text-right">
                <button
                  onClick={() => socketRef.current?.send({ type: "DuelForfeitIntent" })}
                  className="px-2 py-1 text-[11px] bg-red-700/80 hover:bg-red-600 text-white rounded"
                >
                  Forfeit
                </button>
              </div>
            </div>
          )}

          {/* Trade panel */}
          {state.tradeState === "active" && featureOn("trading") && panelOn("trade") && (
            <TradePanel
              partnerName={state.tradePartnerName ?? "Unknown"}
              selfOffer={state.tradeSelfOffer}
              partnerOffer={state.tradePartnerOffer}
              selfGold={state.tradeSelfGold}
              partnerGold={state.tradePartnerGold}
              selfConfirmed={state.tradeSelfConfirmed}
              partnerConfirmed={state.tradePartnerConfirmed}
              inventory={state.inventory}
              gold={state.selfSilver}
              onSetOffer={(items, gold) => {
                socketRef.current?.send({ type: "TradeSetOfferIntent", items, gold });
              }}
              onConfirm={() => {
                socketRef.current?.send({ type: "TradeConfirmIntent" });
              }}
              onCancel={() => {
                socketRef.current?.send({ type: "TradeCancelIntent" });
              }}
            />
          )}

          {/* Expanded world map */}
          {showWorldMap && panelOn("worldMap") && (
            <WorldMapScreen
              selfPosition={state.selfPosition}
              entities={state.entities}
              selfId={state.selfId}
              partyMemberIds={state.party?.memberIds ?? []}
              zoneName={state.currentZoneName}
              zoneTier={state.currentZoneTier}
              zoneBounds={state.zoneBounds}
              markers={state.mapMarkers}
              totalCount={state.mapMarkerTotal}
              currentZoneId={state.currentZoneId}
              access={state.fastTravelAccess}
              offer={state.travelOffer}
              silver={state.selfSilver}
              level={state.playerLevel}
              onFastTravel={requestFastTravel}
              onClose={closeWorldMap}
            />
          )}

          {/* Discovered places + fast travel. Gated on the same flag as the
              rest of discovery, so a world with it off has no panel at all. */}
          {showLocations && panelOn("locations") && featureOn("discoveries") && (
            <LocationsPanel
              markers={state.mapMarkers}
              totalCount={state.mapMarkerTotal}
              currentZoneId={state.currentZoneId}
              onFastTravel={requestFastTravel}
              onClose={() => setShowLocations(false)}
            />
          )}

          {/* Inspect renders once, above — players share the mob/NPC panel now. */}

          {/* Entity hover tooltip. Hidden while a radial/context menu is open —
              the backdrop is pointer-events-none, so the canvas keeps firing
              hover and the 210px panel is drawn straight through the ring. */}
          {!petRadial &&
            hoveredEntityId &&
            tooltipPos &&
            (() => {
              // Engine flag, off by default: the in-world hover panel is
              // parked, not deleted. Everything below still works the moment
              // GameConfig.features.worldHoverTooltips goes back to true.
              if (!GameConfig.features.worldHoverTooltips) return null;
              const ent = state.entities.get(hoveredEntityId);
              if (!ent) return null;
              // Never show the hover tooltip for the local player hovering over
              // themselves — you already know who you are.
              if (hoveredEntityId === gameState.selfId) return null;
              const e = ent as any;

              // Respect tooltip settings
              const ts = getGameSettings();
              if (!ts.tooltipsEnabled) return null;
              const perTypeEnabled: Record<string, boolean> = {
                player: ts.tooltipPlayer === true,
                mob: ts.tooltipMob === true,
                npc: ts.tooltipNpc === true,
                resource_node: ts.tooltipResourceNode === true,
                dropped_item: ts.tooltipDroppedItem === true,
                pet: ts.tooltipPet === true,
                mount: ts.tooltipMount === true,
                portal: ts.tooltipPortal === true,
                crafting_station: ts.tooltipCraftingStation === true,
              };
              if (perTypeEnabled[ent.type] === false) return null;

              const tipW = 210;
              const tipX = Math.min(tooltipPos.x + 16, window.innerWidth - tipW - 8);
              const tipY = Math.max(8, tooltipPos.y - 12);

              const typeInfo: Record<string, { label: string; color: string }> = {
                player: { label: "Player", color: "#4ade80" },
                mob: { label: "Mob", color: "#f87171" },
                npc: { label: "NPC", color: "#22d3ee" },
                resource_node: { label: "Resource Node", color: "#fbbf24" },
                dropped_item: { label: "Dropped Item", color: "#fef3c7" },
                pet: { label: "Pet", color: "#93c5fd" },
                mount: { label: "Mount", color: "#d4a96a" },
                portal: { label: "Portal", color: "#c084fc" },
                crafting_station: { label: "Crafting Station", color: "#a3e635" },
              };
              const ti = typeInfo[ent.type] ?? { label: String(ent.type), color: "#ffffff" };

              const hpBar = (hp: number, maxHp: number) => {
                const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
                const barColor = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
                return (
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "#9ca3af",
                        marginBottom: 2,
                      }}
                    >
                      <span>HP</span>
                      <span>
                        {Math.ceil(hp)} / {Math.round(maxHp)}
                      </span>
                    </div>
                    <div style={{ background: "#1f2937", borderRadius: 2, height: 5 }}>
                      <div
                        style={{
                          width: `${pct * 100}%`,
                          height: "100%",
                          background: barColor,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                );
              };

              const rows: ReactNode[] = [];

              if (ent.type === EntityType.Player) {
                const p = ent as PlayerEntity;
                if (p.guildTag)
                  rows.push(
                    <div key="guild" style={{ color: "#fbbf24", fontSize: 11 }}>
                      [{p.guildTag}]
                    </div>,
                  );
                rows.push(
                  <div key="level" style={{ color: "#9ca3af", fontSize: 11 }}>
                    Level {p.level}
                  </div>,
                );
                rows.push(<div key="hp">{hpBar(p.hp, p.maxHp)}</div>);
                rows.push(
                  <div key="mp" style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "#60a5fa",
                        marginBottom: 2,
                      }}
                    >
                      <span>MP</span>
                      <span>
                        {p.mp} / {p.maxMp}
                      </span>
                    </div>
                    <div style={{ background: "#1f2937", borderRadius: 2, height: 5 }}>
                      <div
                        style={{
                          width: `${p.maxMp > 0 ? (p.mp / p.maxMp) * 100 : 0}%`,
                          height: "100%",
                          background: "#3b82f6",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>,
                );
              } else if (ent.type === EntityType.Mob) {
                rows.push(
                  <div
                    key="tier"
                    style={{ color: ti.color, fontSize: 11, textTransform: "capitalize" }}
                  >
                    {e.tier ?? "common"} tier
                  </div>,
                );
                if (e.hp != null && e.maxHp != null)
                  rows.push(<div key="hp">{hpBar(e.hp, e.maxHp)}</div>);
                // Summoned/raised/charmed mobs carry an owner — surface it like the
                // pet tooltip so an ally minion reads as "yours" on hover.
                if (e.ownerEntityId != null) {
                  const owner = state.entities.get(String(e.ownerEntityId));
                  if (owner)
                    rows.push(
                      <div key="owner" style={{ color: "#9ca3af", fontSize: 10 }}>
                        Owner: {(owner as any).name}
                      </div>,
                    );
                }
                if (e.carriedItems?.length) {
                  rows.push(
                    <div key="loot" style={{ marginTop: 5, color: "#9ca3af", fontSize: 10 }}>
                      Drops:{" "}
                      {(e.carriedItems as any[])
                        .slice(0, 3)
                        .map((ci: any) => {
                          const def = state.itemDefs.get(ci.definitionId);
                          return def?.name ?? ci.definitionId;
                        })
                        .join(", ")}
                      {e.carriedItems.length > 3 ? "…" : ""}
                    </div>,
                  );
                }
              } else if (ent.type === EntityType.ResourceNode) {
                rows.push(
                  <div
                    key="tier"
                    style={{ color: ti.color, fontSize: 11, textTransform: "capitalize" }}
                  >
                    {e.tier ?? ""} tier
                  </div>,
                );
                const maxS = Math.max(1, Number(e.maxHp ?? e.currentHp ?? 1));
                const curS = Math.max(0, Math.min(maxS, Number(e.currentHp ?? maxS)));
                if (e.depleted) {
                  rows.push(
                    <div key="dep" style={{ color: "#ef4444", fontSize: 11 }}>
                      Depleted
                    </div>,
                  );
                } else {
                  rows.push(
                    <div key="stacks" style={{ marginTop: 4 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "#9ca3af",
                          marginBottom: 2,
                        }}
                      >
                        <span>Stacks</span>
                        <span>
                          {curS} / {maxS}
                        </span>
                      </div>
                      <div style={{ background: "#1f2937", borderRadius: 2, height: 5 }}>
                        <div
                          style={{
                            width: `${(curS / maxS) * 100}%`,
                            height: "100%",
                            background: "#fbbf24",
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>,
                  );
                }
              } else if (ent.type === EntityType.DroppedItem) {
                const itemDef = state.itemDefs.get(e.itemDefinitionId as string);
                const displayName = itemDef?.name ?? e.itemDefinitionId;
                if (e.quantity > 1)
                  rows.push(
                    <div key="qty" style={{ color: "#9ca3af", fontSize: 11 }}>
                      Quantity: {e.quantity}
                    </div>,
                  );
                if ((itemDef as any)?.description)
                  rows.push(
                    <div
                      key="desc"
                      style={{ color: "#d1d5db", fontSize: 10, marginTop: 3, fontStyle: "italic" }}
                    >
                      {(itemDef as any).description}
                    </div>,
                  );
                if (itemDef?.type)
                  rows.push(
                    <div
                      key="itype"
                      style={{ color: "#9ca3af", fontSize: 10, textTransform: "capitalize" }}
                    >
                      {itemDef.type}
                    </div>,
                  );
                const secsLeft = Math.max(
                  0,
                  Math.round((Number(e.despawnsAt) - Date.now()) / 1000),
                );
                if (secsLeft < 60)
                  rows.push(
                    <div key="despawn" style={{ color: "#f87171", fontSize: 10 }}>
                      Despawns in {secsLeft}s
                    </div>,
                  );
                if (displayName !== (e.name ?? ""))
                  rows.push(
                    <div key="iname" style={{ color: "#fef3c7", fontSize: 11, fontWeight: "bold" }}>
                      {displayName}
                    </div>,
                  );
              } else if (ent.type === EntityType.Npc) {
                const npcTypeLabels: Record<string, string> = {
                  shop: "🛒 Shop",
                  quest: "📜 Quest",
                  both: "🛒 Shop & Quests",
                  generic: "💬 Talk",
                };
                rows.push(
                  <div key="ntype" style={{ color: ti.color, fontSize: 11 }}>
                    {npcTypeLabels[e.npcType] ?? e.npcType}
                  </div>,
                );
              } else if (ent.type === EntityType.Pet) {
                if (e.hp != null && e.maxHp != null)
                  rows.push(<div key="hp">{hpBar(e.hp, e.maxHp)}</div>);
                const owner = state.entities.get(String(e.ownerEntityId));
                if (owner)
                  rows.push(
                    <div key="owner" style={{ color: "#9ca3af", fontSize: 10 }}>
                      Owner: {(owner as any).name}
                    </div>,
                  );
              } else if (ent.type === EntityType.Mount) {
                const owner = state.entities.get(String(e.ownerEntityId));
                if (owner)
                  rows.push(
                    <div key="owner" style={{ color: "#9ca3af", fontSize: 10 }}>
                      Owner: {(owner as any).name}
                    </div>,
                  );
                if (e.despawnDistanceTiles)
                  rows.push(
                    <div key="dist" style={{ color: "#22d3ee", fontSize: 10 }}>
                      Leash: {e.despawnDistanceTiles} tiles
                    </div>,
                  );
              } else if (ent.type === EntityType.Portal) {
                rows.push(
                  <div key="dest" style={{ color: "#c084fc", fontSize: 11 }}>
                    → {e.targetZoneName ?? e.targetZoneId}
                  </div>,
                );
              } else if (ent.type === EntityType.CraftingStation) {
                rows.push(
                  <div
                    key="cstype"
                    style={{ color: ti.color, fontSize: 11, textTransform: "capitalize" }}
                  >
                    {String(e.stationType ?? "").replace(/_/g, " ")}
                  </div>,
                );
                if (e.tier)
                  rows.push(
                    <div key="cstier" style={{ color: "#9ca3af", fontSize: 10 }}>
                      Tier {e.tier}
                    </div>,
                  );
              }

              return (
                <div
                  key="entity-tooltip"
                  style={{
                    position: "fixed",
                    left: tipX,
                    top: tipY,
                    width: tipW,
                    background: "rgba(10,14,23,0.97)",
                    border: `1px solid ${ti.color}44`,
                    borderLeft: `3px solid ${ti.color}`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    pointerEvents: "none",
                    // Below HUD panels (z 50) and the top bar (z 40): a world
                    // hover tooltip must never cover open UI windows.
                    zIndex: 35,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
                    fontFamily: "monospace",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: ti.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 2,
                      opacity: 0.75,
                    }}
                  >
                    {ti.label}
                  </div>
                  <div
                    style={{ color: "#ffffff", fontWeight: "bold", fontSize: 13, lineHeight: 1.2 }}
                  >
                    {e.name ?? "Unknown"}
                  </div>
                  {rows}
                </div>
              );
            })()}

          {/* Core Event System HUD */}
          <EventPictureLayer />
          <EventTextWindow socket={socketRef.current} />
          <EventChoiceWindow socket={socketRef.current} />
          <EventNumberInput socket={socketRef.current} />
          <EventItemSelect socket={socketRef.current} />
          <EventScrollingText socket={socketRef.current} />
          <EventTimer />

          {/* Duel request prompt */}
          {duelRequestPrompt && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendDuelRequest();
                }}
                className="w-full max-w-sm rounded-[var(--hud-radius)] border border-red-500/35 bg-wa-surface/95 p-4 shadow-2xl"
              >
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-white">Duel Challenge</h2>
                  <p className="mt-1 text-xs text-gray-300">
                    Challenge{" "}
                    <span className="font-semibold text-red-300">
                      {duelRequestPrompt.targetName}
                    </span>
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">
                    Wager Silver
                  </span>
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    step={1}
                    value={duelWagerInput}
                    onChange={(event) => setDuelWagerInput(event.target.value)}
                    className="w-full rounded border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-red-400"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDuelRequestPrompt(null)}
                    className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    Send Request
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Context menu (right-click) */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              options={contextMenu.options}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Pet interaction radial (right-click a summoned pet) */}
          {petRadial &&
            (() => {
              const petName = petRadial.name;
              // Resolve the pet's instance id for feed/rename. Match the roster by
              // nickname; fall back to the sole non-egg pet when unambiguous.
              const nonEgg = state.ownedPets.filter((p) => !p.isEgg);
              const owned =
                state.ownedPets.find((p) => (p.nickname ?? "") === petName) ??
                (nonEgg.length === 1 ? nonEgg[0] : undefined);
              const petInstanceId = owned?.id ?? null;
              const riding =
                (state.isMounted || state.isRidingPet) &&
                state.activePetEntityId === petRadial.entityId;
              const send = (msg: unknown) => socketRef.current?.send(msg as any);
              const actions: RadialAction[] = [
                {
                  id: "ride",
                  label: riding ? "Dismount" : "Mount up",
                  icon: riding ? "🚶" : "🐴",
                  active: riding,
                  onClick: () => send({ type: "PetRideToggleIntent" }),
                },
                {
                  id: "feed",
                  label: "Feed",
                  icon: "🍖",
                  disabled: !petInstanceId,
                  onClick: () => petInstanceId && setPetFoodPicker({ petInstanceId }),
                },
                {
                  id: "pet",
                  label: "Pet",
                  icon: "❤️",
                  onClick: () => {
                    gameState.addChatMessage("system", "System", `You pet ${petName}. 💖`);
                    gameState.notify();
                  },
                },
                {
                  id: "autoatk",
                  label: "Auto-attack",
                  icon: "⚔️",
                  onClick: () => send({ type: "PetAutoAttackToggleIntent" }),
                },
                {
                  id: "autoloot",
                  label: "Auto-loot",
                  icon: "💰",
                  onClick: () => send({ type: "PetAutoLootToggleIntent" }),
                },
                {
                  id: "rename",
                  label: "Rename",
                  icon: "✏️",
                  disabled: !petInstanceId,
                  onClick: () => {
                    if (!petInstanceId) return;
                    setPetRenameInput(owned?.nickname ?? petName);
                    setPetRename({ petInstanceId, current: petName });
                  },
                },
                {
                  id: "dismiss",
                  label: "Dismiss",
                  icon: "✖️",
                  onClick: () => send({ type: "PetDismissIntent" }),
                },
              ];
              return (
                <PetRadialMenu
                  x={petRadial.x}
                  y={petRadial.y}
                  petName={petName}
                  actions={actions}
                  onClose={() => setPetRadial(null)}
                />
              );
            })()}

          {/* Feed food picker */}
          {petFoodPicker &&
            (() => {
              const foods = state.inventory.filter((it) => {
                const def = state.itemDefs.get(it.definitionId);
                return def && (def.type === ItemType.Food || def.type === ItemType.PetFood);
              });
              return (
                <div
                  className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60"
                  onClick={() => setPetFoodPicker(null)}
                >
                  <div
                    className="hud-panel max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-[var(--hud-border-1)] bg-[var(--hud-surface-1)] p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 text-sm font-semibold text-[var(--hud-text-primary)]">
                      Feed pet
                    </div>
                    {foods.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[var(--hud-text-muted)]">
                        No food in your inventory.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {foods.map((it) => (
                          <button
                            key={it.id}
                            onClick={() => {
                              socketRef.current?.send({
                                type: "PetUseItemIntent",
                                itemInstanceId: it.id,
                                petInstanceId: petFoodPicker.petInstanceId,
                              });
                              setPetFoodPicker(null);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--hud-text-secondary)] hover:bg-[var(--hud-surface-2)]"
                          >
                            🍖 {it.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Rename pet */}
          {petRename && (
            <div
              className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60"
              onClick={() => setPetRename(null)}
            >
              <div
                className="hud-panel w-80 rounded-lg border border-[var(--hud-border-1)] bg-[var(--hud-surface-1)] p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 text-sm font-semibold text-[var(--hud-text-primary)]">
                  Rename pet
                </div>
                <input
                  autoFocus
                  value={petRenameInput}
                  maxLength={24}
                  onChange={(e) => setPetRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const name = petRenameInput.trim();
                      if (name)
                        socketRef.current?.send({
                          type: "PetRenameIntent",
                          petInstanceId: petRename.petInstanceId,
                          newName: name,
                        });
                      setPetRename(null);
                    }
                  }}
                  className="mb-3 w-full rounded border border-[var(--hud-border-1)] bg-[var(--hud-surface-2)] px-2 py-1.5 text-sm text-[var(--hud-text-primary)] outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPetRename(null)}
                    className="rounded px-3 py-1 text-xs text-[var(--hud-text-secondary)] hover:bg-[var(--hud-surface-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const name = petRenameInput.trim();
                      if (name)
                        socketRef.current?.send({
                          type: "PetRenameIntent",
                          petInstanceId: petRename.petInstanceId,
                          newName: name,
                        });
                      setPetRename(null);
                    }}
                    className="rounded bg-[var(--hud-primary)] px-3 py-1 text-xs font-semibold text-white"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
