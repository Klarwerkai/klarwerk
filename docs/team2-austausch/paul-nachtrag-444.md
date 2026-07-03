## [Cloud-Worker] SCRUM-444 — Evidenz-Kennzeichnung (ARGUS-Zahlen als Projektionen) (03.07.2026, v0.9.47-beta)

Pedi-Entscheidung (Berater-Frage 7): die aus ARGUS übernommenen harten Zahlen (98,5 % Genauigkeit,
1.247 Konflikte/Monat, 99,9 % Uptime u. ä.) sind nicht gemessen und dürfen extern nur als
gekennzeichnete Projektionen/Beispiele auftreten. Markenkern: **Vertrauen ist Evidenz — nie behauptet.**

### Audit-Ergebnis (Repo)
Diese harten Zahlen stehen **nicht** im KLARWERK-Repo — geprüft: Frontend, i18n, Demo-Seed,
Kapital-/Management-Sicht, VIP-Leitfaden, der SCRUM-440-Druckbereich. Was die App zeigt, sind
echte Live-Werte dieser Instanz (Trust, Bus-Faktor, Bereitschafts-/Sicherheits-Kennzahlen) bzw.
das ausdrücklich als Schätzung gekennzeichnete Valuation-Modell (`mgmt.valuationDisclaimer`).
Die ARGUS-Zahlen leben also im externen Investoren-Material (Deck) — dort von Pedi zu relabeln.

### Umgesetzt (in-Repo, defensiv)
1. **Druckbarer Vertrauen-&-Sicherheit-Auszug (SCRUM-440):** neue Evidenz-Rahmung am Fuß des
   Bereichs „Sicherheit" — „Alle Kennzahlen hier sind Live-Werte dieser Instanz — gemessen, nicht
   behauptet. Zielwerte oder Beispielrechnungen werden immer ausdrücklich als solche gekennzeichnet."
   Steht im `print-area`, erscheint also auf dem Blatt, das der Investor mitnimmt.
2. **VIP-Leitfaden (docs):** neuer „Was du meidest"-Punkt — harte ARGUS-Zahlen nie als Ist-Zahl,
   nur als Zielwert/Beispielrechnung; plus Versionsstände aktualisiert (0.9.33/0.9.34 → 0.9.47).

### Empfohlene Relabelings fürs Deck (Pedi)
- „98,5 % Genauigkeit" → „Zielwert Extraktions-Präzision (Projektion)".
- „99,9 % Uptime" → „angestrebte Verfügbarkeit (Zielwert, noch nicht gemessen)".
- „1.247 Konflikte/Monat" → „Beispielrechnung bei ~X Nutzern (Modellannahme)".

### Geändert
- `apps/web/src/pages/Admin.tsx` — Evidenz-Zeile im Sicherheits-Auszug (print-area).
- `apps/web/src/i18n.ts` — `adm.sich.evidenceNote` (de+en).
- `apps/web/src/version.ts` — 0.9.46 → 0.9.47-beta.
- `docs/team2-austausch/VIP-VORTEST-LEITFADEN-0507.md` — ARGUS-Warnung + Versionsstände.

**Version:** 0.9.46-beta → 0.9.47-beta (reines Frontend + Doku — Browser-Reload genügt).
**Gates:** Paul-Runner v23 (Gesamtbestand).
