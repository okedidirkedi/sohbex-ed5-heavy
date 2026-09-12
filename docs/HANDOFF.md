# 4 Krallık — ED5 MMO handoff (Grok Heavy)

Türkçe yanıt ver. Production kalite; placeholder/demo yok. Screenshot isteme.
Metin2/KO = sadece tür hissi; orijinal IP (metin taşı / 1:1 klon yok).
SohbeX / Klan Savaşları ürün adı değildir — unut.

## Proje bağlantısı
- GitHub (public pack): https://github.com/okedidirkedi/sohbex-ed5-heavy
- Bu sohbet: https://grok.com/c/185287e9-d1c2-4899-88d5-9c2e74c7ed6a
- Grok Bot köprü: PR/diff → Wine `apps/client`

## Ortam (Bot box — sen doğrudan yazamazsın)
- Client: `.../@ed5-mmo-studio/studio/engine/apps/client` (Wine ED5)
- **pnpm** (npm install monorepo’da yasak)
- Next `:3000` · game-server `:3001` local JWT, `DB_MODE=pglite`
- Guest **yasak**

## Ürün
- Ad: **4 Krallık**
- Dört krallık (orijinal IP): Kızıl Sancak · Gümüş Bozkır · Mavi Liman · Demir Vadi
- Sınıflar: Savaşçı · Büyücü · Okçu · Şifacı
- Tema: Yamato gold (`#c9a227` / `#e0b23a`). Cyan yok.

## Yapıldı
1. Guest kapalı: clan-select → her zaman `/cc`; `cc` `isGuest=false`; `/play?guest=` → `/login`.
2. `/play` SSR Pixi fix → thin `page.tsx` + `PlayPageClient.tsx` (`ssr:false`).
3. CC Live Generator / HUMAN·ADULT debug kaldırıldı.
4. PR #2 Wine: auth **önce** `engine.init`; DPR soft-cap 1.25; `webglcontextlost`; `MAX_EAGER_ZONE_CHUNKS` 16.
5. Kullanıcı yüzeyi **4 Krallık** adına çevrildi (login, play splash, hakkında, krallık seçimi).

## Sıradaki
1. Enter-world E2E teşhis/fix (Aw Snap kalırsa) — Wine runtime Bot.
2. `src/lib/sohbex-clan.ts` pack’e alındı; `/cc` importu çözülmeli.
3. HUD Yamato polish yalnızca ayrı prompt ile.

## Önemli dosyalar
- `src/app/login/page.tsx`
- `src/components/login/LoginScreenView.tsx`
- `src/components/login/LoginClanRails.tsx`
- `src/components/login/LoginGameAbout.tsx`
- `src/app/cc/page.tsx`
- `src/app/play/page.tsx` + `PlayPageClient.tsx`
- `public/clan-select.html`
- `src/lib/sohbex-clan.ts` (storage key `sohbex.selectedClan` — değiştirme)

## Çıktı formatı
Branch/PR tercihen. Yazma credential yoksa: dosya yolu + unified diff veya tam dosya içeriği.
Cyan icat etme. HUD rewrite şimdi yok.
