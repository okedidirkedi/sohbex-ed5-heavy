# SohbeX / Klan Savaşları — ED5 MMO handoff (Grok Heavy)

Türkçe yanıt ver. Production kalite; placeholder/demo yok. Screenshot isteme. Metin2/KO = sadece tür hissi; orijinal IP (metin taşı / 1:1 klon yok).

## Proje bağlantısı
- GitHub (public): https://github.com/okedidirkedi/sohbex-ed5-heavy
- Bu sohbet: https://grok.com/c/185287e9-d1c2-4899-88d5-9c2e74c7ed6a
- Grok Bot köprü: PR/diff → Wine `apps/client`

## Ortam (Bot box — sen doğrudan yazamazsın)
- Client: `.../@ed5-mmo-studio/studio/engine/apps/client` (Wine ED5)
- **pnpm** (npm install monorepo’da yasak)
- Next `:3000` · game-server `:3001` local JWT, `DB_MODE=pglite`
- Guest **yasak**

## Yapıldı
1. Yamato Login pin `SOHBEX_YAMATO_LOGIN` — Klan Savaşları, klan rayları, Oyun hakkında; Guest yok.
2. `/play` SSR Pixi fix → thin `page.tsx` + `PlayPageClient.tsx` (`ssr:false`).
3. CC Live Generator / HUMAN·ADULT debug kaldırıldı.
4. **PR #2 merged + Wine uygulandı:** clan-select her zaman `/cc` (guest query yok); `cc` `isGuest=false`; login guest copy temiz; play splash; auth **önce** `engine.init`; guest URL → `/login`; DPR soft-cap 1.25; `webglcontextlost`; `MAX_EAGER_ZONE_CHUNKS` 36→16.

## Sıradaki (şimdi)
1. Enter-world E2E teşhis/fix (Aw Snap kalırsa).
2. Sonra HUD Yamato polish (ayrı PR).

## Önemli dosyalar
- `src/app/login/page.tsx`
- `src/components/login/LoginScreenView.tsx`
- `src/app/cc/page.tsx`
- `src/app/play/page.tsx` + `PlayPageClient.tsx`
- `public/clan-select.html`

## Çıktı formatı
Branch/PR tercihen. Yazma credential yoksa: dosya yolu + unified diff veya tam dosya içeriği. Cyan icat etme. HUD rewrite şimdi yok.
