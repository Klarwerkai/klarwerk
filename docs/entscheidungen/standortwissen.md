# Standort- und schichtspezifische Geltung von Wissen — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-standortwissen` (Revision 1). Basisstand `e6f577df`
(`1.0.0-beta.1.765`). Das Verhalten prüfen die Tests unter `tests/standortwissen/`; dieses Dokument
selbst liest kein Test. „Belegt durch“ nennt Verhaltenstests — ob sie auf diesem Stand grün sind,
sagt erst ihr Lauf.*

Die Auftragsquelle führt beide Punkte nur mit Altquelle („Historische Aussage, heutige Erfüllung
nicht erneut geprüft“, `KLARWERK-Funktions-Roadmap.md:79` bzw. `:85`), Registerzustand `angedacht`,
Empfehlungen ES-045/ES-046 und EC-20260905 jeweils „später“ — ausdrücklich Priorisierung, keine
Sperre. Der Punkt steht im Auftrag mit `state: arbeitsauftrag`; der Auftrag schließt Ideen und
späteren Ausbau ein. Gebaut ist deshalb genau der Wortlaut der Quelle.

## Abgleich mit dem Bestand vor diesem Auftrag

- **Vorhanden:** die fünf Konfliktarten (`ConflictType`, darunter `context` und `role` mit den
  Beschriftungen „Kontext“/„Rolle“); manuell wählbar, aber von der automatischen Erkennung nie
  vergeben (`relationToType` kennt nur `truth`/`temporal`).
- **Nicht vorhanden:** jede Angabe, wo ein Wissenspunkt gilt (Konzern/Werk/Schicht), und jede
  Gewichtung beim Fragen nach Schicht oder Rolle. Spaces (`produkt:20261007:spaces`) regeln
  *Sichtbarkeit*, nicht Geltung; Fachgebiet (`domain`) ist eine Sachachse.

## Zuordnung je Originalpunkt

| Punkt | Geliefert | Belegt durch |
| --- | --- | --- |
| R-1632 — „Wissen kann als Konzern-Standard, Werks-Praxis oder Schicht-Spezifisch geführt werden“ | `KnowledgeObject.geltung` (`ebene` konzern/werk/schicht, `werk`, `schicht`, optional `rolle`), Regel in `services/knowledge-object/src/geltung.ts`; gesetzt über `PUT /api/kos/:id` `action: "geltung"` (Recht `ko.create`, Sichtbarkeitstor, `null` entfernt, ungültig → 400, Beleg `ko.geltung-changed`, keine neue Inhaltsfassung); sichtbar und änderbar im Abschnitt „Provenienz“ der Leseansicht. | `geltung-regel.test.ts` (G1–G2), `geltung-routen-und-fragen.test.ts` (R1), `geltung-flaeche.test.tsx` (U3–U4) |
| R-1632 — Vererbung | Konzern-Standard wird überall geerbt, Werks-Praxis von allen Schichten ihres Werks, Schicht-spezifisch gilt nur dort (`geltungFuerFrage`). | `geltung-regel.test.ts` (V1–V3) |
| R-1632 — „Kollisionen werden als Kontext-Konflikt sauber dargestellt“ | Ein automatisch erkannter Widerspruch zweier Punkte mit verschiedener Geltung wird als `context` angelegt (anderer Ort) bzw. `role` (gleicher Ort, andere Rolle); die Beschreibung nennt beide Geltungen. Gleiche oder fehlende Geltung → unverändert `truth` mit Eskalationspflicht. Regel aus knowledge-object, an der App-Wurzel in den Konfliktdienst gereicht. | `geltung-regel.test.ts` (K1–K3), `geltung-konflikt.test.ts` (D1–D4, W1–W2) |
| R-1633 — „gewichtet Antworten aus der Frühschicht höher … falls relevant“ | „Ich frage für“ Werk/Schicht/Rolle auf der Fragen-Seite → `POST /api/ask` `fragekontext` (nur Konsolenzweig, wie der Gesprächsfaden). Je Quelle ein `geltungsrang`; `rankCandidates` ordnet damit **hinter** den Relevanzschlüsseln und **vor** Status/Trust — an beiden Toren. Nichts wird ausgeblendet. | `geltung-routen-und-fragen.test.ts` (F1, F3), `geltung-rangfolge.test.ts` (P1–P3) |
| R-1633 — „Sichtbar im UI“ | Antwortfeld `geltung` (Kontext, je Quelle Geltung und Passung, vom Server berechnet); unter den Quellenchips „Gewichtet für: …“ mit Passung je Quelle. | `geltung-routen-und-fragen.test.ts` (F1), `geltung-flaeche.test.tsx` (U1–U2) |
| R-1633 — „Macht den Rollen-Konflikt-Typ produktiv nutzbar“ | Die Rolle filtert beim Fragen (andere Rolle → „gilt anderswo“) und macht einen erkannten Widerspruch am selben Ort zum Rollenkonflikt. | `geltung-regel.test.ts` (V3, K2), `geltung-konflikt.test.ts` (D3) |

## Abgrenzung

- **Konfliktklassifikation** (`aufnahme:20260922:gesamt-konfliktklassifikation`, geliefert in
  `1.0.0-beta.1.765`, `docs/entscheidungen/konfliktklassifikation.md`): Arbeitsart, Eskalation und
  R-0263 *Vorrang zwischen genau zwei Punkten* nach einer menschlichen Entscheidung. Unverändert;
  dieser Auftrag setzt nur die **Konfliktart** einer automatischen Erkennung aus der Geltung.
- **Spaces** (`produkt:20261007:spaces`): wer ein Objekt sehen darf. Die Geltung ändert keine
  Sichtbarkeit, keine Freigabe und keine Vertraulichkeit.

## Grenzen, Quellenwidersprüche und fehlende Belege

- Die Quelle nennt „Kollisionen“ ohne Regel, wann zwei Geltungen kollidieren. Festgelegt ist: nur
  wenn **beide** Punkte eine Geltung tragen und sie verschieden ist; fehlt sie an einer Seite, wird
  nichts umgedeutet.
- „Vierter und fünfter Konflikttyp“ (Roadmap) passt nicht zur Reihenfolge im Code (`context` ist
  der dritte, `role` der fünfte). Gebaut ist nach dem Inhalt: Ort → `context`, Rolle → `role`.
- Die Probeläufe vor dem Einreichen (`assessAgainstPool`, Entwurfsprüfung) ordnen nicht nach
  Geltung — ein Entwurf trägt noch keine.
- Geltung wird nur nachträglich am Objekt gesetzt, nicht schon beim Erfassen; Import und Word-Weg
  setzen keine. Der Fragekontext wird nicht gespeichert (gilt für die offene Seite) und wirkt nicht
  im Word-/Add-on-Weg.
- Ein bereits offener Konflikt wird nicht umgedeutet, wenn später eine Geltung gesetzt wird.
- Kein Test belegt, wie ein echtes Modell solche Widersprüche erkennt; die Tests setzen das
  Modellurteil ein. Keine echte menschliche Bedienung und kein Produktivlauf sind Teil dieses
  Belegs; der Lieferbeleg mit Fassung entsteht erst mit der Veröffentlichung.
