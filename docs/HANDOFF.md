# SohbeX / Klan Savaşları — ED5 MMO handoff (Grok Heavy)

Türkçe yanıt ver. Production kalite; placeholder/demo yok. Screenshot isteme. Metin2/KO = sadece tür hissi; orijinal IP (metin taşı / 1:1 klon yok).

## Ortam (Parez’in makinesi / Grok Bot box)
- Client: `.../@ed5-mmo-studio/studio/engine/apps/client` (Wine ED5)
- Paket: **pnpm** (npm install monorepo’da yasak)
- Next: `http://127.0.0.1:3000`
- Game-server: `http://127.0.0.1:3001` — local auth (`JWT_SECRET`), `DB_MODE=pglite`
- Guest MMO’da **yasak** (client `guestAvailable={false}`, `showGuest: false`)

## Yapıldı
1. Yamato Login pin `SOHBEX_YAMATO_LOGIN` — public-config İngilizce default’u ezer; “Klan Savaşları”, klan rayları, Oyun hakkında; Guest yok.
2. Next :3000 ölürse varsayılan “MY MMO” görünür → client’tan Next’i yeniden başlat.
3. `/play` SSR Pixi `navigator is not defined` → `play/page.tsx` thin `dynamic(..., { ssr:false })` + `PlayPageClient.tsx`.
4. Char create: “Live Generator Preview” + “HUMAN / ADULT” (species/body debug) kaldırıldı.
5. Login → `/clan-select.html` → `/cc` hesapla çalışıyor.

## Sıradaki iş (şimdi bunu yap)
1. Hesapla Login → klan → `/cc` → **Dünyaya Gir** (`/play?character=...`).
2. Chrome **Aw, Snap** veya yükleme hatası varsa root-cause + fix (OOM, WS, auth token, Pixi).
3. Sonra in-game HUD Yamato polish.

## Önemli dosyalar
- `src/app/login/page.tsx` — Yamato pin
- `src/components/login/LoginScreenView.tsx` — Yamato skin / klan rails
- `src/app/cc/page.tsx` — CharSelect/Create; Live overlay kaldırıldı
- `src/app/play/page.tsx` + `PlayPageClient.tsx` — client-only play
- JWT secret: `/workspace/ed5-bind/jwt-secret.txt` (Grok Bot box)

## Not
Sen grok.com’sun; yerel ED5 diskine doğrudan yazamazsan: patch’leri dosya yolu + unified diff / tam dosya içeriği olarak ver ki Parez veya Grok Bot uygulasın. Önce Dünyaya Gir E2E teşhisi.
