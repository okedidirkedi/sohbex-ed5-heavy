"use client";

import nextDynamic from "next/dynamic";

/**
 * Pixi/GameEngine touches `navigator` at module load. Keep the heavy play
 * surface browser-only so Next SSR never evaluates that graph.
 */
const PlayPageClient = nextDynamic(() => import("./PlayPageClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center text-slate-300 text-sm">
      Dünya yükleniyor…
    </div>
  ),
});

export default function PlayPage() {
  return <PlayPageClient />;
}
