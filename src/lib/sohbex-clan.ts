/** Selected kingdom — localStorage bridge from /clan-select.html → /cc */

export const SOHBEX_SELECTED_CLAN_KEY = "sohbex.selectedClan";

export type SohbexSelectedClan = {
  id: string;
  file: string;
  pos: string;
  name: string;
  dir: string;
  climate: string;
  focus: string;
  blurb: string;
  chosenAt?: string;
};

function isSelectedClan(value: unknown): value is SohbexSelectedClan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    v.name.length > 0
  );
}

/** SSR-safe read of the kingdom chosen on clan-select. */
export function readSelectedClan(): SohbexSelectedClan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SOHBEX_SELECTED_CLAN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSelectedClan(parsed) ? (parsed as SohbexSelectedClan) : null;
  } catch {
    return null;
  }
}
