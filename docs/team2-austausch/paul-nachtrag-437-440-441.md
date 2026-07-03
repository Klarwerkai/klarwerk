## [Cloud-Worker] SCRUM-437/440/441 — VIP-Bereitschaft + Druck + Erststart-Häkchen (03.07.2026, v0.9.45-beta)

Erstes Bündel aus Pedis „setze alle um"-Freigabe (03.07.). Reines Frontend — Browser-Reload genügt.
Die restlichen vier bestätigten Punkte (436 PMO-Sammel-Draft, 438 Herkunfts-Chip, 439 Audit-verify,
442 Beta-Readiness) folgen als Backend-/PMO-Bündel.

### SCRUM-441 — Erststart-Karte an echten Fortschritt gekoppelt
Die drei Schritte der Erststart-Karte (SCRUM-429) zeigen jetzt „erledigt"-Häkchen aus echten Zählern:
Wissen erfasst? (total > 0), geprüft? (validiert > 0), Verwaltung/Setup? (beide KIs verbunden).
Erledigte Schritte werden grün markiert — der Erstlauf füllt sich mit echtem Fortschritt, nichts geraten.

### SCRUM-437 — VIP-Bereitschafts-Checkliste (neuer Admin-Bereich „Bereitschaft")
Ein-Blick-Kontrolle vor dem Test: fünf Zeilen mit ehrlicher Ampel aus echten Zahlen —
verbundene KIs (beide/teilweise/keine), validiertes Wissen, offene Prüfungen, Upload-Grenzen
(Anzahl · KB), externe Wissensabfrage-Stufe. „Offene Prüfungen" und die Stufe sind wertungsfrei
(info), nicht als Mangel dargestellt. DOM-freie Ableitung in `lib/vipReadiness.ts` (testbar).

### SCRUM-440 — Auszug druckbar
„Vertrauen & Sicherheit" und „Bereitschaft" haben einen „Drucken"-Knopf. Der Druck ist isoliert:
eine Body-Klasse (`printing-extract`) blendet per CSS die App-Hülle und Bildschirm-Bedienelemente
aus, sodass nur der markierte Auszug (`.print-area`) auf dem Blatt landet — normales Strg+P auf
allen anderen Seiten bleibt unverändert.

### Neu/Geändert
- `apps/web/src/lib/vipReadiness.ts` (neu) — Bereitschafts-Zeilen (DOM-frei, testbar).
- `apps/web/src/lib/adminFirstRun.ts` — `firstRunStepDone` (Fortschritts-Ableitung).
- `apps/web/src/components/AdminFirstRunCard.tsx` — Häkchen aus Analytics.
- `apps/web/src/pages/Admin.tsx` — Bereich „Bereitschaft" + Druck-Knöpfe + Print-Bereiche.
- `apps/web/src/lib/adminSections.ts` — fünfter Bereich „bereitschaft".
- `apps/web/src/index.css` — isoliertes Druck-Stylesheet (`body.printing-extract`).
- `apps/web/src/i18n.ts` — neue Schlüssel in DE **und** EN.
- Tests: `tests/app/vip-readiness.test.ts` (neu); `admin-first-run` erweitert (Häkchen-Logik);
  `admin-sections`-Test auf 5 Bereiche.
- `apps/web/src/version.ts` — 0.9.44 → 0.9.45-beta.

**Version:** 0.9.44-beta → 0.9.45-beta (reines Frontend — Browser-Reload genügt).
**Gates:** Paul-Runner v21 (Gesamtbestand).
