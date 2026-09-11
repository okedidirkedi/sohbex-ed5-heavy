# SohbeX / Klan Savaşları — ED5 client pack (private)

Grok Heavy (Ağır) için: bu repo Wine ED5 `apps/client` kaynağından kesilmiş canlı dosyaları içerir.
İşlemleri **Heavy** yapsın; patch/PR buraya. Grok Bot sadece köprü.

## Runtime (box)
- Next `http://127.0.0.1:3000`
- game-server `http://127.0.0.1:3001` local JWT
- Guest yasak · pnpm · Metin2/KO sadece tür hissi · Yamato gold (cyan icat etme)

## Görev
1. Login → `/clan-select.html` → `/cc` → `/play` (auth)
2. Aw Snap: Pixi auth-önce, chunk eager azalt, WebGL contextlost
3. Guest path temizliği
4. HUD rewrite YOK (ayrı iş)

## Paths in this repo
- `src/app/login/page.tsx`
- `src/components/login/*`
- `src/app/cc/page.tsx`
- `src/app/play/page.tsx` + `PlayPageClient.tsx`
- `public/clan-select.html`
- `docs/HANDOFF.md`
