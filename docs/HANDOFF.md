# 4 Krallık — ED5 MMO handoff (Grok Heavy)

Türkçe yanıt ver. Production kalite; placeholder/demo yok. Screenshot isteme.
Metin2/KO = sadece tür hissi; orijinal IP (metin taşı / 1:1 klon yok).
SohbeX / Klan Savaşları ürün adı değildir — unut.

## Kaynak
- Canlı kutu: **Taner Windows PC** (Wine ED5)
- Klasör: `T:\PROJEM\4-krallık\`
- Studio: `T:\PROJEM\4-krallık\4-krallık.ed5proj`
- Handoff (canlı): `T:\PROJEM\4-krallık\HANDOFF-HEAVY.md`
- Handoff (üst): `T:\PROJEM\HANDOFF-HEAVY.md`
- DB: PGlite, `DB_MODE=pglite`, klasör `T:\PROJEM\4-krallık\data\` (dosya adı uydurma)
- Pack köprü: https://github.com/okedidirkedi/sohbex-ed5-heavy (`docs/HANDOFF.md`)
- Next `:3000` · game-server `:3001` · local JWT · **pnpm**
- Heavy Taner diskine yazamaz. Bot önce canlı HANDOFF-HEAVY.md okur; PR/diff’i `T:\PROJEM\4-krallık\` altına uygular.
- Alt klasör uydurma. `apps\client` yalnızca diskte varsa Next kökü odur.

## Proje bağlantısı
- GitHub (public pack): https://github.com/okedidirkedi/sohbex-ed5-heavy
- Bu sohbet: https://grok.com/c/185287e9-d1c2-4899-88d5-9c2e74c7ed6a
- Grok Bot köprü: PR/diff → `T:\PROJEM\4-krallık\`

## Ortam (Taner — sen doğrudan yazamazsın)
- Kök: `T:\PROJEM\4-krallık\`
- Studio: `T:\PROJEM\4-krallık\4-krallık.ed5proj`
- Handoff: `T:\PROJEM\4-krallık\HANDOFF-HEAVY.md` (yedek: `T:\PROJEM\HANDOFF-HEAVY.md`)
- DB: PGlite `data\` (`T:\PROJEM\4-krallık\data\`)
- **pnpm** (npm install monorepo’da yasak)
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
5. Pack docs + `src/lib/sohbex-clan.ts` → 4 Krallık / `/cc` köprüsü. Kullanıcı yüzü stringleri Bot Taner’da uygular.

## Sıradaki
1. Bot: canlı `HANDOFF-HEAVY.md` oku; PR #5 + kalan yüzeyi `T:\PROJEM\4-krallık\` altına uygula; Next restart.
2. Studio: `T:\PROJEM\4-krallık\4-krallık.ed5proj`
3. Enter-world E2E teşhis/fix (Aw Snap kalırsa) — Taner runtime.
4. HUD Yamato polish yalnızca ayrı prompt ile.

## Önemli dosyalar (köke göre)
- `HANDOFF-HEAVY.md`
- `data\` (PGlite — iç dosya adı uydurma)
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
