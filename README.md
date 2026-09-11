# SohbeX / Klan Savaşları — ED5 Heavy bridge

**Grok Heavy (grok.com Ağır) bu repoya bağlıdır.** Kod işi buradan; Grok Bot sadece Wine ED5’e uygular.

- Repo: https://github.com/okedidirkedi/sohbex-ed5-heavy
- Heavy sohbet: https://grok.com/c/185287e9-d1c2-4899-88d5-9c2e74c7ed6a
- Handoff: `docs/HANDOFF.md`

## Durum (2026-09-11)
- PR #2 **MERGED** (Login→clan→/cc→/play + Aw Snap mitigations) — Wine `apps/client`’a da uygulandı.
- Guest yasak · Yamato gold · cyan yok · Metin2/KO sadece tür hissi · orijinal IP.

## Heavy nasıl çalışır
1. Bu repoyu kaynak al (clone / raw / zip).
2. Branch aç → değişiklik → mümkünse PR; yazma yoksa **unified diff + tam dosya** ver.
3. Bitince PR URL veya diff’i yaz; Bot Wine’a taşır.
4. Screenshot isteme. HUD rewrite ayrı iş (şimdi değil).

## Sıradaki
1. Enter-world doğrulama: Login → klan → `/cc` → Dünyaya Gir (`/play`).
2. Aw Snap kalırsa ek mitigasyon (OOM / WS / token / Pixi).
3. Sonra HUD Yamato polish (ayrı PR).

## Runtime (Bot box — Heavy doğrudan erişemez)
- Next `http://127.0.0.1:3000`
- game-server `http://127.0.0.1:3001` local JWT / PGlite
