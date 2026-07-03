## [Cloud-Worker] SCRUM-433 — Auffindbarkeit (Erkenntnisse verbinden + Public-KI) (03.07.2026, v0.9.42-beta)

Pedi-Befund beim VIP-Vortest-Üben (03.07.): zwei vorhandene Funktionen waren faktisch
unauffindbar. Beides ist reines Frontend — nach dem Sync genügt ein Browser-Reload.

### a) Erkenntnisse aus einem Dokument verbinden
Der Weg „Erzählen → Aus Datei" extrahiert Erkenntnisse als Punkteliste mit Ankreuz-Feldern.
Das Zusammenführen mehrerer Punkte zu EINEM Eintrag gab es bereits (SCRUM-409), war aber nur
sichtbar, wenn schon 2 Punkte angehakt waren — und als unscheinbarer ghost-Knopf. Wer nicht
zufällig 2 anhakte, sah die Funktion nie.
- Die Aktion „Ausgewählte zu einem Eintrag verbinden" ist jetzt IMMER sichtbar (auffindbar),
  bis 2 Ausgewählte deaktiviert mit ehrlichem Tooltip „mind. 2 anhaken".
- Ein ruhiger Drei-Wege-Hinweis erklärt die Punkteliste dauerhaft: Verbinden (→ ein Eintrag)
  · Als Entwürfe speichern (→ je Punkt einer) · Übernehmen (→ einzeln abarbeiten).
- Höhere Emphasis (outline statt ghost). Verhalten unverändert: kein Auto-Save, Belegstellen
  bleiben am Dokument, Quellen werden beim Einreichen vermerkt.

### b) Public-KI-Anreicherung finden
Das Panel (SCRUM-426, Modellwissen ODER belegte Web-Suche) rendert nur bei Admin-Freigabe
„offen" (SCRUM-414) — vorher wurde bei jeder anderen Stufe schlicht NICHTS gezeigt. Für den
Admin (VIP bei Erstanmeldung) war damit nicht erkennbar, dass es die Funktion überhaupt gibt.
- Statt spurlos unsichtbar steht dort jetzt ein ruhiger Hinweis: „verfügbar, sobald ein Admin
  die externe Wissensabfrage auf ‚Offen' stellt (Admin → Externe Wissensabfrage)".
- Gate unverändert: Voll-Panel + Server-Durchsetzung nur bei „offen". Der Hinweis erscheint in
  Rohwissen-Erfassen und im Studio — genau dort, wo Wissen entsteht.

### Geändert
- `apps/web/src/pages/Capture.tsx` — Punkte-Aktionsleiste (Verbinden immer sichtbar + Hinweis).
- `apps/web/src/components/PublicAiEnrichPanel.tsx` — Hinweis statt `return null`.
- `apps/web/src/lib/captureFromFile.ts` — zwei neue Copy-Schlüssel.
- `apps/web/src/i18n.ts` — de+en (`capture.file.connectHint/connectDisabledHint`,
  `enrich.disabledHint`); Merge-Label auf „verbinden" geschärft.
- `apps/web/src/version.ts` — 0.9.41 → 0.9.42-beta.

**Version:** 0.9.41-beta → 0.9.42-beta (reines Frontend — Browser-Reload genügt).
**Gates:** Paul-Runner v18 (Gesamtbestand).
