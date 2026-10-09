# Wissensupdate für das Teamgespräch

Auftrag `aufnahme:20260922:gesamt-wochenupdate`, Originalpunkt `RECHERCHE:pmo-fea-0004`:

> Ein wöchentliches Wissensupdate fasst neue Erkenntnisse für das Teamgespräch nachvollziehbar
> zusammen. Aufnahme und Ausgabeformat aus dem vorhandenen Nutzungskonzept konkretisieren; kein
> ungefragt eingerichteter Versand.

## Wo es liegt

- **Oberfläche:** Output Factory (`/output`), Abschnitt „Wissensupdate fürs Teamgespräch“ am
  Seitenende. Ein Datumsfeld („Zeitraum endet am“, leer = heute), ein Knopf „Wochenupdate
  erzeugen“, danach die Markdown-Vorschau mit „Kopieren“ und „Download .md“.
- **Schnittstelle:** `GET /api/output/wochenupdate?bis=JJJJ-MM-TT`, Recht `ko.read`.
- **Dienst:** `services/output/src/wochenupdate.ts` (Auswahl und Format),
  angebunden über `OutputService.wochenupdate`.

Der Ort folgt der früheren Einordnung: PMO-FEA-0004 („Wissens-Update-Snippet“) wurde am
02.07.2026 in die Output Factory (T1-OUT-001) überführt (`docs/qm/claude-after-report.md`,
KGURU-31). Das Update übernimmt deshalb deren Regeln, statt eigene zu erfinden.

## Aufnahme

Zeitraum: sieben Kalendertage bis einschließlich `bis` (UTC-Datum).

| Abschnitt | Aufgenommen wird … |
| --- | --- |
| Neu validiert | ein validiertes Wissensobjekt, das im Zeitraum erfasst wurde (`createdAt`) |
| Überarbeitet | ein validiertes Wissensobjekt, das vorher erfasst wurde und im Zeitraum eine neue Fassung bekam (Versionshistorie, Version > 1) |
| Fürs Gespräch: noch unsicher | Einträge der beiden Abschnitte mit Vertrauen unter 60, damit das Team sie gezielt bespricht |

Nicht aufgenommen werden offene (nicht validierte) und vertrauliche bzw. streng vertrauliche
Objekte, ebenso alles, was vor oder nach dem Zeitraum erfasst oder überarbeitet wurde.

## Ausgabeformat

Markdown, in dieser Reihenfolge:

1. Titel „Wissensupdate für das Teamgespräch“, darunter Zeitraum, Erzeugungszeitpunkt und
   die Zahl der neu validierten und überarbeiteten Einträge.
2. Prüfhinweis der Output Factory: keine Aussage darüber, ob auf Konflikte oder Duplikate geprüft wurde.
3. Hinweis „Auf Abruf erzeugt — Klarwerk verschickt dieses Update nicht …“.
4. „Neu validiert“ und „Überarbeitet“: je Eintrag Titel (bei Überarbeitung mit aktueller
   Version), Kernaussage, „Wann es gilt“, „Was zu tun ist“, dazu Kategorie, Typ, Datum und Vertrauen.
5. „Fürs Gespräch: noch unsicher“, wenn es solche Einträge gibt.
6. „Herkunft & Nachweis“: derselbe Herkunftsblock wie bei jedem Output-Dokument.

Ohne neue Erkenntnisse sagt das Dokument genau das und hat weder leere Abschnitte noch einen
Herkunftsblock.

Personen stehen nur im Herkunftsblock. Eine Übersicht, wer wie viel beigetragen hat, liefert das
Update nicht; das wäre eine Leistungsrangliste, die die EK-19-Richtung (PMO-DEC-0001) ausschließt.

## Kein Versand

Es gibt keinen Empfänger, keinen Zeitplan und keine Automatik. Das Update entsteht nur, wenn
jemand es abruft. Geteilt wird es über Kopieren oder Download, und zwar von der Person, die es abgerufen hat.
Der Abruf schreibt weder ins Prüfprotokoll noch in die Meldungen
(`tests/output/wochenupdate-route.test.ts`).

## Abgrenzung zu vorhandenen Lieferungen

- **Live-Wand / „Was gerade passiert“ (PMO-FEA-0003, eigener Auftrag
  `aufnahme:20260922:gesamt-aktivitaetsanzeige`):** zeigt laufend neues validiertes Wissen
  und nennt Personen nur mit Zustimmung. Das Wissensupdate ist dagegen ein
  zeitraumgebundenes Dokument zum Mitnehmen. Hier wurde nichts davon geändert.
- **„Validiert je Woche“ in Analytics (FR-ANA-02):** zeigt nur eine Zahl je Woche, keine
  Inhalte. Das Update nutzt dieselbe Zeitachse (`createdAt`).
- **Wirkungs-Rückmeldung (PMO-FEA-0002):** bleibt unverändert.
- **Output-Dokumentarten** (Arbeitsanweisung … Management-Summary) und **SCORM-Übergabe:**
  bleiben unverändert. Das Update ist ein eigener Weg ohne Quellenauswahl, weil hier der Zeitraum auswählt.

## Grenzen und offene Belege

- **Nutzungskonzept nicht im Repository:** Der Originalpunkt verweist auf „das vorhandene
  Nutzungskonzept“. Gemeint ist nach den Unterlagen vermutlich das Adoption-Playbook „Drei Akte“
  (`BETA_ADOPTION_PLAYBOOK_DREI_AKTE_V1.md`, KBB-112, Repository `klarwerk-business-backend`)
  bzw. die Quelle `recherche/sichtung/ADOPTION-VERGESSENE-UMFAENGE.md`. Keine der beiden
  Dateien liegt in diesem Arbeitsbaum. Aufnahme und Format sind deshalb aus den hier vorhandenen
  Belegen abgeleitet: Output-Factory-Regeln, EK-19-Richtung, Live-Wand-Einwilligung und
  Analytics-Zeitachse. Ob sie dem Playbook im Wortlaut entsprechen, ist **nicht abgeglichen**.
- **Freigabezeitpunkt:** Ein Wissensobjekt trägt keinen eigenen Zeitstempel seiner Freigabe.
  Wurde ein Objekt vor dem Zeitraum erfasst und erst im Zeitraum validiert, ohne dass eine neue
  Fassung entstand, erscheint es nicht. Das Update nennt keinen Freigabezeitpunkt, den es nicht kennt.
- **Sprache:** Das Dokument ist wie alle Output-Dokumente deutsch. Die Bedienelemente sind
  auf Deutsch, Englisch und Niederländisch vorhanden.
- **Menschliche Erprobung:** Ob das Format in einem echten Teamgespräch trägt, ist nicht
  erprobt.
