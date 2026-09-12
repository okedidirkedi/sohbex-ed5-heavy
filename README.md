# 4 Krallık — ED5 Heavy köprüsü

**Grok Heavy (grok.com Ağır) bu projeye bağlıdır.**  
Parez prompt atınca **tüm ED5 ayar ve kod işini Heavy yapar.** Grok Bot sadece Wine’a uygular.

| | |
|--|--|
| Repo | https://github.com/okedidirkedi/sohbex-ed5-heavy |
| Heavy sohbet | https://grok.com/c/185287e9-d1c2-4899-88d5-9c2e74c7ed6a |
| Sistem prompt | `docs/HEAVY-SYSTEM.md` |
| Kilit ayarlar | `docs/ED5-SETTINGS.md` |
| Durum / sıradaki | `docs/HANDOFF.md` |

## Durum
- Ürün adı: **4 Krallık** (SohbeX / Klan Savaşları markası yok).
- Guest yasak · Yamato gold · cyan yok · orijinal IP.
- PR #2 Wine’da: guest kapalı, auth → `engine.init`, Aw Snap yumuşatmaları.

## Parez → Heavy
1. Ağır modelde sohbete yaz.
2. Heavy `HEAVY-SYSTEM` + `ED5-SETTINGS`’e uyar, PR/diff üretir.
3. Bot PR/diff’i Wine `apps/client`’a taşır ve runtime doğrular.
