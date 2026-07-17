# Klara-Add-in-Bundle (statisch serviert unter `/addin/*`)

Dieses Verzeichnis enthält das **gebaute** Klara-Add-in-Bundle als eingecheckte statische Dateien.
Das Backend serviert sie unter `https://app.klarwerk.ai/addin/…` — **nur** bei aktivem
`KLARWERK_ADDON_API` (Flag OFF → Route nicht registriert → 404). Serving-Logik + Traversal-Schutz:
`services/app/src/routes/addin-static-routes.ts` (explizite Datei-Map, kein Wildcard-Static).

Quelle: eigenes Repo `klarwerk-office-addin` (SCRUM-490 H, Add-in-Commit `5128431`).

## Bundle-Dateien (die einzigen serviert)
- `taskpane.html`, `taskpane.css`, `taskpane.js`, `klarwerk-client.js`
- `assets/icon-32.png`, `assets/icon-80.png`

Source-Maps werden **nicht** eingecheckt/serviert (kein Runtime-Bedarf; `sourceMappingURL`-Kommentare
sind aus den JS-Dateien entfernt).

## Regenerieren (wenn sich das Add-in ändert)
Im Add-in-Repo bauen und die Runtime-Dateien hierher kopieren (Maps strippen):

```bash
ADDIN=~/Documents/klarwerk-office-addin
DST=services/app/addin-static   # relativ zum dev_Klarwerk-Repo-Root

( cd "$ADDIN" && npm run build )
cp "$ADDIN/public/taskpane.html" "$DST/taskpane.html"
cp "$ADDIN/public/taskpane.css"  "$DST/taskpane.css"
cp "$ADDIN/public/assets/icon-32.png" "$DST/assets/icon-32.png"
cp "$ADDIN/public/assets/icon-80.png" "$DST/assets/icon-80.png"
perl -pe 's{^//# sourceMappingURL=.*$}{}' "$ADDIN/public/taskpane.js"        > "$DST/taskpane.js"
perl -pe 's{^//# sourceMappingURL=.*$}{}' "$ADDIN/public/klarwerk-client.js" > "$DST/klarwerk-client.js"
```

Danach `KLARWERK_SKIP_KEYCHAIN=1 bash tools/check` (Root-Gate) laufen lassen — der Serving-Test prüft die
Erreichbarkeit + Content-Types + Icon-Dimensionen (>1x1) + „kein Mock/ko.read im Bundle". Neue
Bundle-Datei? → zusätzlich in die `BUNDLE`-Map in `addin-static-routes.ts` eintragen (sonst 404).

## Icons (SCRUM-490 WP3)
Die Icons `assets/icon-32.png` + `assets/icon-80.png` (weißes „K"-Monogramm auf Klarwerk-Teal) werden im
Add-in-Repo per Zero-Dependency-Skript erzeugt: `cd "$ADDIN" && npm run icons` (bzw.
`node scripts/make-icons.mjs`, eigener PNG-Encoder, nur node:zlib). Danach wie oben nach `$DST/assets/`
kopieren. Dateinamen + Manifest-URLs bleiben unverändert.
