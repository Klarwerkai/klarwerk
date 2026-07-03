## [Cloud-Worker] SCRUM-418 (Härtung 2) — Extraktion aus Datei robust machen (03.07.2026, v0.9.35-beta)

**Anlass:** Pedi meldet den Extraktions-Fehler erneut („Modell-Antwort war kein gültiges JSON
(möglicherweise abgeschnitten)") trotz bestandenem Schlüssel-Test. Ursachenanalyse ergab zwei
Schwachstellen jenseits des reinen Token-Limits:

1. **JSON-Extraktion zu naiv.** Die alte Logik nahm „erstes `{` bis letztes `}`". Bettet das
   Modell die JSON in Fließtext oder Code-Fences ein — oder steht irgendwo ein `}` im
   Begleitsatz — zerbrach das Parsen (und die Rettung mit). Neu: string-/escape-bewusster
   Klammer-Scanner, der das ausgewogene Objekt am Anker `"points"` herausschält. Prosa,
   ```json-Fences und geschweifte Klammern im Text stören nicht mehr; bei echter Kürzung
   liefert der Scan den Rest ab dem points-Objekt → die Rettung (salvage) greift sauber.

2. **Belegstellen-Prüfung zu streng gegen PDF-Artefakte.** PDF-Text bringt Silbentrennung
   (`Dosier-\npumpe`), harte Zeilenumbrüche und Sonderzeichen mit. Echte Zitate scheiterten
   dadurch am G-2-Gate. Neu: toleranter Rückfall, der nur Buchstaben/Ziffern vergleicht
   (Mindestlänge 12 gegen Zufallstreffer). Der harte Whitespace-Vergleich bleibt primär —
   erfundene Zitate werden weiterhin abgewiesen.

Zusätzlich Antwort-Limit 8192 → **16384** Token (Sonnet trägt das mühelos) als Puffer.

**Tests (services/reasoner/src/extract-failure.test.ts, neu):** JSON in Prosa/Fences mit
`{…}` im Fließtext wird sauber geparst; Belegstelle mit Silbentrennung/Umbruch wird erkannt;
der tolerante Rückfall erzeugt keine Zufallstreffer (kurz + frei erfunden bleiben abgewiesen).
Bestehende Extract-Tests unverändert grün (Anker `"points"` deckt Vor-/Nachwort mit ab).

**Version:** 0.9.34-beta → 0.9.35-beta. **Gates:** Paul-Runner v10 (Gesamtbestand).

> Hinweis Betrieb: Damit die Härtung wirkt, muss der **Backend-Server neu gestartet** werden
> (der Runner baut nur das Web-Frontend neu). Ohne Neustart läuft der alte Reasoner weiter.
