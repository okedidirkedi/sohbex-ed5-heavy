"use client";

import nextDynamic from "next/dynamic";

/**
 * Pixi/GameEngine touches `navigator` at module load. Keep the heavy play
 * surface browser-only so Next SSR never evaluates that graph.
 */
const PlayPageClient = nextDynamic(() => import("./PlayPageClient"), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-2"
      style={{ background: "#080c14", color: "#e8d5a3" }}
    >
      <div className="font-display text-lg tracking-[0.2em] uppercase" style={{ color: "#c9a227" }}>
        4 Krallık
      </div>
      <div className="text-sm" style={{ color: "#94a3b8" }}>
        Dünyaya bağlanılıyor…
      </div>
    </div>
  ),
});

export default function PlayPage() {
  return <PlayPageClient />;
}
