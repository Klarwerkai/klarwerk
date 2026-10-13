# Prüfarchiv · ben-Runden sammel26–44 im Repository

Auftrag `aufnahme:20260922:gesamt-pruefarchiv`, Revision 1. Einziger zugeordneter Originalpunkt:
**R-2042** (Alias `OFFEN:I5`, `OFFEN.md:417`).

- **Stand dieses Dokuments:** erhoben am 13.10.2026 auf Basis `2a96bab2c` (1.0.0-beta.1.973).
  Die Zeilennummern der Fundstellen gelten für diesen Stand. Der Prüfstand
  `tests/pruefarchiv/sammel26-44-verankert.test.ts` hält fest, dass jede genannte Datei die Runde
  weiterhin nennt.
- **Lieferbeleg:** Die Fassung, mit der dieses Dokument ausgeliefert wird, entsteht erst mit der
  Veröffentlichung und steht hier deshalb noch nicht.

## Was I5 sagt und was davon heute gilt

I5 lautet: „Die Verdikte sammel45–54 und die Ship-Kette dieses Tages sind in SCRUM-469 verankert,
mit Inhalts-SHA je Runde und der Fehlerklasse, die sich durch fünf Runden zieht“. Als Grund nennt I5:
`_relay/` steht in `.gitignore` und reist mit keinem Klon mit. Und: „Die älteren Runden sammel26–44
stehen weiterhin aus.“

Am heutigen Baum nachgesehen:

- `_relay/` steht weiterhin in `.gitignore:25`. `tools/zentrale-drift.ts:80-84` beschreibt dieselbe
  Grenze: Was dort liegt, ist in keinem Klon und in keiner Automatisierung.
- Im Produktarbeitsbaum gibt es kein `_relay/`. Die Verdiktberichte selbst (Wortlaut, Zeilen,
  Bytes, Inhalts-SHA) sind von hier aus also **nicht lesbar**.
- SCRUM-469 ist ein Jira-Vorgang. Laut I20 (`OFFEN.md:415`) ist der Atlassian-Zugang seit dem 30.07.
  abgeklemmt. Laut I20 ist `OFFEN.md` die Wahrheitsquelle im Repository und Jira nur die Zweitschrift.

Deshalb verankert dieser Auftrag die Runden 26–44 **im Repository** und nicht in Jira. Er hält fest,
was versioniert belegbar ist: je Runde die Stellen im Code, die Befund, geprüften Stand und
Folgearbeit nennen. Was nur im Bericht selbst stand, ist unten als **fehlender Beleg** geführt. Es
wird nicht aus dem Gedächtnis ergänzt.

## Die Runden

„nicht genannt“ heißt: Keine versionierte Stelle nennt den Wert. Ein Verdikt steht nur dort, wo eine
Fundstelle es ausdrücklich nennt. Einen geprüften Stand, den die Fundstelle nur nahelegt, kennzeichnet
„nach Lesart“.

| Runde | Geprüfter Stand | Verdikt | Befund laut Fundstelle | Folgearbeit | Fundstellen | Inhalts-SHA |
|---|---|---|---|---|---|---|
| sammel26 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel27 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel28 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel29 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel30 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel31 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel32 | nicht genannt | nicht genannt („schwerster Befund“) | `conflicts.data ?? []` las „noch nicht geladen“ und „Abruf fehlgeschlagen“ als „keine Konflikte“. Eine Antwort konnte dadurch `verified` werden. | mega34 Block A | `tests/ask/mega34-konfliktstand-pflichtsignal.test.tsx:3` | fehlt |
| sammel33 | WP-SHIP8-CLOSE-5 (nach Lesart) | ROT-1 genannt | `ko.created` beim parallelen Nachzug nicht genau einmal; Re-Sync-Vollendung; Review-Aktionsbeleg verlierbar | WP-SHIP8-CLOSE-6 | `tests/app/review-claim-recovery.test.ts:643` | fehlt |
| sammel34 | WP-SHIP8-CLOSE-6 und Word-Kopierweg (nach Lesart) | ROT-1, ROT-2 und GELB genannt | ROT-1: `auditPending` nicht vorbeugend im Statuswrite. ROT-2: Der Claim kannte Akteur und Aktion nicht. GELB: `reviewedAction` nicht persistiert. Außerdem: „Ein echter Cmd+C- und Kontextmenue-Test gehoert zum Word-Smoke.“ | WP-SHIP8-CLOSE-7; mega36 Block E (Kontextmenü bleibt Handprüfung) | `tests/app/review-claim-recovery.test.ts:849`, `tests-smoke/word-taskpane-kopieren.spec.ts:5` | fehlt |
| sammel35 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel36 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel37 | mega38 | nicht genannt | Fünf Befunde: A Arbeitsliste mit eigener Rollentabelle statt derselben Quelle; C nach einem Fehler stand die Antwort der alten Frage; D2 zweite Schrittliste ohne Aussage; E1 `apps/web/package-lock.json` fehlte in der dist-Frische; Topbar-Chips aus mega38 Block H als rohe `Link`s ohne `guard()` | mega39 Blöcke A, C, D2, E1 | `apps/web/src/lib/workCenter.ts:69`, `apps/web/src/pages/Ask.tsx:1013`, `apps/web/src/lib/askSteps.ts:2`, `scripts/dist-frische.ts:94`, `tests/ask/mega39-fehler-ohne-fremde-antwort.test.tsx:6`, `tests/app/mega39-topbar-chips-guarded-mounted.test.tsx:6` | fehlt |
| sammel38 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel39 | mega40 (nach Lesart) | Blocker genannt | Weiß auf reinem Funke `#E8630A` (3,38:1) war als Grafikgrenze gepinnt, trägt im Produkt aber kleine Texte | mega41 Block A | `apps/web/src/styles/modern.css:59`, `tests/app/mega40-kontrast-modern.test.ts:8` | fehlt |
| sammel40 | mega41 (nach Lesart) | nicht genannt | `opacity: 1` auf Fläche und `*` zu grob, `hover:opacity-95` am Filterknopf wirkungslos; Reihenfolge der Badge-Regel von keinem Test gehalten | mega42 Blöcke A und B | `apps/web/src/styles/modern.css:92`, `tests/app/mega40-kontrast-modern.test.ts:1009`, `tests/app/mega40-kontrast-modern.test.ts:1075` | fehlt |
| sammel41 | nicht genannt | nicht genannt | keine versionierte Spur | nicht genannt | — | fehlt |
| sammel42 | mega43 (nach Lesart) | GESAMTVERDIKT GELB | drei Wächter-Auflagen G1–G3 (Alpha, Inline-Stile, Kontrastpaare aus der Bauform) und Punkt 5 (inaktive Knöpfe) | mega44 | `tests/app/mega43-klara-werkbank-palette.test.ts:3`, `tests/app/mega43-klara-werkbank-palette.test.ts:386` | fehlt |
| sammel43 | nicht genannt | nicht genannt | vier Überbehauptungen in den Kommentaren des Palettensammlers (Kaskade, Alpha-Rundung, Inline-Parser) | mega45 Block G | `tests/app/mega43-klara-werkbank-palette.test.ts:55` | fehlt |
| sammel44 | nicht genannt | ROT, Ship-Blocker | Das mobile Filterblatt lag in seinem eigenen inerten Hintergrund und war weder bedienbar noch schließbar. Zweiter Befund, kein Blocker: `mineEmpty` aus der facettierten Endmenge. | mega47 Blöcke B, C1 und D | `tests-smoke/ui-smoke.spec.ts:376`, `tests/app/mega47-modale-flaechen-sammler.test.tsx:6`, `tests/app/mega47-persoenlicher-leerzustand.test.tsx:4` | fehlt |

**Zählung:** 19 Runden. 9 haben versionierte Spuren (32, 33, 34, 37, 39, 40, 42, 43, 44), 10 keine
(26–31, 35, 36, 38, 41). Bei keiner der 19 Runden ist ein Inhalts-SHA im Repository belegt.

**Wiederkehrende Fehlerklasse (Lesart der Fundstellen, kein Wortlaut von ben):** Mehrere dieser
Befunde haben dieselbe Bauart. Eine zweite Wahrheit läuft neben der ersten: die eigene Rollentabelle
(sammel37 A), die zweite Schrittliste (sammel37 D2) und die zweite Palette in Klara
(`mega43-klara-werkbank-palette.test.ts:8`). Oder eine Aussage reicht weiter als ihr Beleg: „leer“
heißt nicht „nichts vorhanden“ (sammel32), die Kommentar-Überbehauptungen (sammel43), Wächter enger
als ihr Anspruch (sammel42). Ob ben diese Klasse selbst so benannt hat, steht in keinem versionierten
Text.

## Abgrenzung

- **sammel45–54 und die Ship-Kette:** Diesen Teil hat I5 als erledigt geführt (SCRUM-469). Er ist
  nicht Gegenstand dieses Auftrags und wird nicht neu gebaut. Aus dem Repository ist er nicht
  nachprüfbar (Jira), siehe unten den Widerspruch zu sammel45.
- **I20 · Nachtrag nach dem Wiederverbinden** (`OFFEN.md:415`): eigener offener Registerpunkt. Er
  betrifft Ship 9, sammel60, T6, I20 und C1, nicht die Runden 26–44.
- **I8 · Scheiben-Zusatz an ben-Auftragsnamen** (`OFFEN.md:402`): eigener offener Punkt, der
  künftige Benennung betrifft, nicht das Archiv.
- **Spätere Runden** (sammel55 ff.) stehen mit Inhalts-SHA bereits in `OFFEN.md` (B-Zeilen in
  `OFFEN.md:130-209`) und in `docs/aufnahme/20260922-gesamt-paket2-scope.md`. Sie sind nicht
  Gegenstand.
- **Die Befunde selbst:** Dieses Dokument archiviert Prüfberichte. Ob die damaligen Befunde heute
  noch geschlossen sind, prüft es nicht. Die genannten Prüfstände sind für diesen Auftrag nicht
  erneut gelaufen.

## Quellenwidersprüche

- **sammel45: „je GRÜN“ gegen „ROT“.** `OFFEN.md:215` (B6) führt „ben sammel45–49 je GRÜN“. Dagegen
  steht `tests/app/mega47-modale-flaechen-sammler.test.tsx:15`: „sammel45 (ben, ROT)“. Dieselbe Datei
  nennt in Z. 22 einen Befund aus sammel46 (Register A17). Ohne den Bericht in `_relay/` ist nicht zu
  entscheiden, ob B6 nur das Schlussverdikt nach Nacharbeit meint. Das berührt den als erledigt
  geführten Teil von I5.
- **„Ship 8“ zweimal.** sammel33 und sammel34 gehören zu `WP-SHIP8-CLOSE-6`/`-7`. In der Ship-Kette
  von `OFFEN.md` ist „Ship 8“ dagegen `bcf1f15` mit mega60 (`OFFEN.md:277`, B15), also weit nach
  sammel44. Die WP-SHIP8-Zählung ist nach Lesart eine ältere, eigene Zählung. Ein versionierter Beleg
  dafür fehlt.
- **sammel34 mit zwei Gegenständen.** Die Runde wird sowohl für die Review-Claim-Kanten
  (`review-claim-recovery.test.ts:849`) als auch für den Word-Kopierweg zitiert
  (`word-taskpane-kopieren.spec.ts:5`, mega36). Ob eine Runde beides prüfte oder eine Nummer doppelt
  vergeben ist, bleibt offen.
- **SCRUM-469 als Ablage.** `docs/qm/claude-after-report.md:10983` und `:10997` nennen
  SCRUM-469-Kommentare (13949, 13950, 13956) zu „ben-Batch“-Prüfungen vom 19.07. Das ist eine
  Zählung ohne `sammel`-Nummer. Ob einzelne dieser Kommentare Runden aus 26–44 sind, ist aus dem
  Repository nicht zuzuordnen.

## Fehlende Belege

- Für alle 19 Runden: Wortlaut, Zeilen- und Bytezahl sowie **Inhalts-SHA** des Verdikts.
- Für 10 Runden (26–31, 35, 36, 38, 41): jede versionierte Spur, also auch geprüfter Stand,
  Verdikt und Befund.
- Das Gesamtverdikt fehlt für sammel32, 33, 34, 37, 39, 40 und 43. Bei sammel33 und 34 sind nur
  Einzelpunkte (ROT-1, ROT-2, GELB) genannt, bei sammel39 nur „Blocker“.
- Der geprüfte Stand ist allein für sammel37 ausdrücklich belegt („sammel37-mega38“). Für sammel33,
  34, 39, 40 und 42 ist er nur nach Lesart erschlossen, für sammel32, 43 und 44 gar nicht genannt.

Schließen kann diese Lücke nur, wer Zugriff auf `_relay/` des Kopfes oder auf SCRUM-469 hat. Das
geht über die Bahn hinaus: Der Arbeitsbaum enthält kein `_relay/`, und der Jira-Zugang ist laut I20
abgeklemmt. Werden die Berichte nachgereicht, gehört je Runde eine Zeile mit Inhalts-SHA in die
Tabelle oben, und „fehlt“ wird ersetzt. Der Prüfstand lässt das zu: Er verlangt für jede Runde genau
eine Zeile, aber kein bestimmtes SHA-Feld.
