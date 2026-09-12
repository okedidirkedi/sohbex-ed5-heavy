# 4 Krallık ED5 — kilit ayarlar (Heavy uygular)

Parez “ayar yap / bağla / düzelt” dediğinde bu tabloyu bozmadan uygula.

## Auth / guest
| Ayar | Değer |
|------|--------|
| Guest MMO | **kapalı** |
| `cc` `isGuest` | `false` |
| Login guest copy / Misafir CTA | yok |
| `clan-select.html` sonrası | her zaman `/cc` ( `?guest=true` yok ) |
| `/play?guest=...` | `/login`’e yönlendir |
| Auth | local JWT (Supabase zorunlu değil) |

## Server / client
| Ayar | Değer |
|------|--------|
| Next | `:3000` |
| Game-server | `:3001` |
| WS fallback | `ws://localhost:3001` (local sayfada remote bake yok) |
| DB | PGlite local |
| Paket yöneticisi | pnpm |

## UI / marka
| Ayar | Değer |
|------|--------|
| Oyun adı | **4 Krallık** |
| Login pin | `SOHBEX_YAMATO_LOGIN` (internal pin adı; public-config İngilizce default’u ezer) |
| Login | Yamato panel, krallık rayları, “Oyun hakkında”, üstte ortalı başlık |
| CharSelect / Create | rpgmmo / Yamato gold; Live Generator + HUMAN/ADULT debug **yok** |
| Tema rengi | gold; cyan yok |
| Dil | Türkçe metinler tercih |
| Fraksiyon dili | **krallık** (klan değil) |
| Dört krallık | Kızıl Sancak, Gümüş Bozkır, Mavi Liman, Demir Vadi |

## Play / Aw Snap (PR #2 — korunacak)
| Ayar | Değer |
|------|--------|
| `/play` | thin `page.tsx` + `PlayPageClient.tsx` `dynamic(..., { ssr:false })` |
| Pixi / engine.init | **auth doğrulandıktan sonra** |
| `MAX_EAGER_ZONE_CHUNKS` | **16** (36 değil) |
| DPR soft-cap | **1.25** |
| `webglcontextlost` | handler var |
| Play splash | “4 Krallık / Dünyaya bağlanılıyor…” |

## Akış (E2E)
`Login` → `/clan-select.html` → `/cc` → **Dünyaya Gir** → `/play?character=...`

## Heavy’nin dokunmaması (ayrı prompt şart)
- Tam HUD rewrite (Parez ayrıca istemedikçe)
- Metin2/KO asset veya isim klonu
- Guest’i geri açmak
- Storage key `sohbex.selectedClan` (compat)
