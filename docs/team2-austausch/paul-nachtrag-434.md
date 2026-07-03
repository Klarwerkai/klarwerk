## [Cloud-Worker] SCRUM-434 — Auffindbarkeit-Feinschliff + PMO-Automatik (03.07.2026, v0.9.43-beta)

Direkte Umsetzung der drei von Pedi bestätigten Vorschläge („ich stimme allen zu") aus dem
SCRUM-433-Feedback, plus die PMO-Fortschritts-Automatik (Weg b), die Pedi mit dem Muster
`PMO-MUSTER-FUER-PAUL.md` freigeschaltet hat.

### 1) Nach „Verbinden" direkt ins Studio
Werden mehrere Erkenntnisse aus einem Dokument zu EINEM Eintrag verbunden, öffnet sich jetzt
unmittelbar das Wissens-Studio mit dem zusammengeführten Artikel — durchgehender Fluss vom
Verbinden zum Strukturieren/Prüfen, ohne Zwischenstopp. (`mergeSelectedPoints` → `setStudioOpen(true)`.)

### 2) Ein-Klick-Sprung zum Regler
Im gesperrten Public-KI-Hinweis (aus SCRUM-433) führt jetzt ein Link „Zu den Admin-Einstellungen"
mit einem Klick nach `/admin`. Die Route ist geschützt; wer keine Rechte hat, landet ehrlich auf
dem Start — kein falsches Versprechen.

### 3) Public-KI-Anreicherung auch im Verfeinern-Studio
Das Studio, das aus dem „Aus Datei"-Weg (Verfeinern-Schritt) geöffnet wird, bekam bisher die
Freigabestufe nicht durchgereicht — das Anreicherungs-Panel blieb dort still gesperrt. Jetzt
werden `externalStage`/`enrichLocale` auch dort übergeben; bei Freigabe „offen" erscheint das
volle Panel konsistent überall.

### PMO-Fortschritts-Automatik (Weg b)
Paul hat keinen Zugriff auf `~/Documents/KLARWERK_Reporting_PMO/`. Statt dort zu schreiben legt
Paul Update-Drafts in `docs/team2-austausch/pmo-drafts/` ab; der Runner (neuer Schritt 5) kopiert
sie auf dem Mac in den PMO-Ordner und wendet sie via `node scripts/apply-item-update.mjs <draft>`
an (Backup + Audit-Log), verschiebt Angewendetes nach `pmo-drafts/angewendet/`.
- Läuft NUR bei grünen Gates; ein PMO-Fehler macht den Lauf NICHT rot (Progress-Pflege blockiert
  keine Code-Lieferung), wird aber sichtbar protokolliert.
- Schema-Doku: `docs/team2-austausch/pmo-drafts/README.md` (Schlüssel `fields_to_update`, zehn
  zulässige Status-Werte, `mode: update_existing` legt nie neue Items an).
- Erster echter Draft: `2026-07-03-T1-KI-001-done.json` (Knowledge Capture → done, Beleg
  SCRUM-375/384/405/409/433/434).

### Geändert
- `apps/web/src/pages/Capture.tsx` — Verbinden→Studio; enrich-Props ans Verfeinern-Studio.
- `apps/web/src/components/PublicAiEnrichPanel.tsx` — Admin-Sprung-Link im gesperrten Hinweis.
- `apps/web/src/i18n.ts` — `enrich.openAdmin` (de+en).
- `apps/web/src/version.ts` — 0.9.42 → 0.9.43-beta.
- `docs/team2-austausch/paul-runner.sh` — Schritt 5 (PMO-Automatik) + v19.
- `docs/team2-austausch/pmo-drafts/` — README + erster Draft.

**Version:** 0.9.42-beta → 0.9.43-beta (reines Frontend — Browser-Reload genügt).
**Gates:** Paul-Runner v19 (Gesamtbestand). PMO-Schritt läuft auf dem Mac.
