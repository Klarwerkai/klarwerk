# Prüfaufgaben, Aktionen und Fehlerzustände am Prüfboard — Bestandsaufnahme

*Aufnahme 20260922 · gesamt-pruefboard-bedienung. **Lauf 1** (Aufgabenrevision 2, Runde 1 auf
Basis `1.0.0-beta.1.643`, Commit `972c469b`). Nutzen laut Auftrag: Parität zur Bibliothek
(Funktionsbeschreibung §8.2). Alle Angaben unten sind am Code dieses Stands gelesen; „heute“ heißt
Commit `972c469b`. Runde 2 (Nacharbeit zu Bens Befunden B1/B2) baut auf Commit `ddaa9c4b` auf.*

## Quellenlage — was dieser Lauf NICHT hatte

Der Auftrag dieses Laufs nennt nur die sechs allgemeinen Kriterien. Die **verknüpften
Aufnahmepunkte** (R-Nummern samt Originalwortlaut, Einschränkungen und Erledigungsbelegen) wurden
nicht mitgegeben. Andere Aufnahme-Läufe vom 20260922 haben sie im Auftrag erhalten, zum Beispiel
`gesamt-loeschung-aufbewahrung` mit R-0634 … R-1564. Im Repository liegen sie nicht. Folge:

- Eine Gegenüberstellung **je Aufnahmepunkt** ist in diesem Lauf nicht möglich. Unten steht der
  Abgleich gegen Funktionsbeschreibung §8.2 und gegen die sechs Kriterien.
- Die geforderte Zuordnung „Ergebnis oder verbleibende Entscheidung je Punkt“ bleibt offen, bis die
  Punkte vorliegen. Sie ist ausdrücklich eine **fehlende Quelle** und kein erledigter Teil.
- **Runde 2:** Ben hat dieses Fehlen als Befund B2 bestätigt und verlangt, die Quelle zu beschaffen
  bzw. von der Steuerung zuordnen zu lassen. Auch der Auftrag für Runde 2 enthält keine
  Aufnahmepunkte (beide Rundenaufträge geprüft). Eine Suche nach Auftragskennung und Titel in den
  Zustands-, Wächter- und Steuerungsordnern dieses Rechners fand ebenfalls nichts. Die Bahn kann die
  Quelle nicht selbst zuordnen. **Die Steuerung muss die Aufnahmepunkte nachreichen.** Bis dahin
  bleibt das Kriterium „je Aufnahmepunkt“ unerfüllt. Aus dem Fehlen werden keine zusätzlichen
  Produktanforderungen abgeleitet.
- **Runde 3:** Bens Beleg zu Runde 2 (`beleg:84f86ed2-fbab-4380-9027-542c82b15afa`, geprüfter
  Commit `0d5aee54`) bestätigt B1 als behoben und lässt B2 aus demselben Grund offen. Auch der
  Auftrag für Runde 3 enthält keine Aufnahmepunkte: keine R-Nummer, kein Originalwortlaut, keine
  Entscheidungen oder Erledigungsbelege, und auch keinen Admin-Hinweis. Damit ist der Stand
  unverändert. Die Einzelzuordnung kann erst entstehen, wenn die Steuerung die Punkte bereitstellt.
  Eine Produktänderung folgt daraus nicht.
- **Nacharbeit 05.10.2026 (Kandidat `6b62ba41`):** Die Quelle liegt jetzt vor —
  `QUELLEN.json` des Auftrags `auftrag-61673cc1aec0e670d076`, Abschnitt `original_points`, 35
  Aufnahmepunkte aus `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/…`. Dazu Pedis
  Entscheidung vom 03.10.2026 zur Konfliktmarkierung (`entscheidung:ebf707cb`). Die
  Einzelzuordnung steht unten im Abschnitt **„Einzelzuordnung je Aufnahmepunkt“**. Die
  Abschnitte bis dorthin bleiben als historischer Stand der Runden 1–3 stehen.

## Kurzbild (§8.2 und Kriterien) — historischer Stand der Runden 1–3

| Anliegen | Stand bei `972c469b` | Urteil |
| --- | --- | --- |
| §8.2 nur offene Beiträge | Board-Route liefert offene; entschiedene verlassen die Liste | geliefert |
| §8.2 Status-Filter + „Mir zugewiesen“ | Facette „Prüfstand“ (Pille), Kästchen „Mir zugewiesen“ (URL-Parameter) | geliefert |
| §8.2 Volltext, Domäne, Kategorie, Tag | Volltext über Titel/Aussage/Bedingungen/Maßnahmen/Kategorie/Tags; „Domäne“ = Wissensart (kein eigenes Domänenfeld am KO) | geliefert (s. Widerspruch 1) |
| §8.2 Fortschritt je Karte `grün/needed` | Stimmenpunkte im Fußband + Zeile „Stimmen“ im „Mehr“ | geliefert |
| §8.2 Konfliktkennzeichnung | Nur Reiter „Konflikte“ mit Zähler, **keine Markierung an der Karte** | offen, Entscheidung 1 |
| §8.2 Klick öffnet Beitrag | Titel-Link (Tastatur) + Flächenklick (Maus) | geliefert |
| §8.2 Kennzahlen Offen/Prüfung/Pending/Konflikte | Reiterzähler aus echten Abrufen (`PruefenKopf.tsx`) | geliefert |
| K1 KI-Prüfung getrennt von menschlicher Entscheidung | eigene Zeile „KI-Prüfung“ (`AiCheckBadge`) neben „Stimmen“/„Status“; Sperre der menschlichen Knöpfe während laufender Prüfung | geliefert |
| K1 Zuständigkeiten | bisher nur „zugewiesen“ ohne Namen, Zuweisen-Fehler ohne Meldung | **in diesem Lauf behoben** |
| K2 Rückfrage/Ablehnung begründen | Begründungspflicht (Absenden ohne Text gesperrt) | geliefert |
| K2 an den richtigen Verantwortlichen | `warn`/`down` gibt an den Eigentümer zurück, nicht an den Erzeuger (JOB 557) | geliefert |
| K2 Teilerfolg Begründung/Bewertung | bisher „Konnte nicht gespeichert werden“, zweiter Versuch schrieb die Begründung doppelt | Runde 1 nur für **einen** offenen Vorgang behoben; der Mehrkartenfall war fehlerhaft (Ben B1). **In Runde 2 je Vorgang behoben**, siehe unten |
| K2 keine ungefragte Freigabe/Rollenänderung | Stufenfrage vor jeder Freigabe, nichts vorbelegt; Admin-Weg mit Rückfrage | geliefert |
| K3 Quellen, Stufe, Zeitpunkt, Original, fehlende Belege | Quellennachweis je Quelle (Zeitpunkt, Adresse, Belegstelle, Datei); Stufe mit Herkunft; kein „keine Quellen“-Satz | geliefert (schmaler Nachweis wiederverwendet) |
| K4 Liste/Tastatur | Pfeiltasten und Mausrad nur an der Liste, eigene Rollbereiche | geliefert |
| K4 Mobil | schmale Bauform mit Vollbild-Filterblatt, Blickführung zur Karte, Umbruch langer Belege | geliefert |
| K4 Sprache | alle Texte DE/EN/NL, neue Texte als Textmodul | geliefert |
| K4 Fehlerfälle Laden | Erstfehler mit „Erneut laden“, gescheiterte Auffrischung behält die Liste | geliefert |

## In diesem Lauf geändert

### 1. Rückfrage/Ablehnung: der Teilerfolg wird wahr gemeldet

Rückfrage und Ablehnung sind zwei Aufrufe: `comment` (Begründung) und danach `rate`. Scheiterte nur
`rate`, meldete die Karte „Konnte nicht gespeichert werden“, obwohl die Begründung am Server lag.
Der nächste Versuch schrieb sie ein zweites Mal.

Jetzt (`apps/web/src/pages/Validation.tsx`, `reviewWithFeedback`; Fehlerklasse
`BegruendungFehler` in `apps/web/src/lib/validationFeedback.ts`):

- Scheitert `rate` nach gespeicherter Begründung, steht der Satz „Die Begründung ist gespeichert,
  die Bewertung nicht. …“. Der Knopf heißt „Bewertung erneut senden“ und schickt **nur** `rate`.
- Die gespeicherte Begründung bleibt auch über Abbrechen und erneutes Öffnen erhalten
  (schreibgeschützt). Eine geänderte Fassung käme ja nie am Server an.
- Scheitert schon `comment`, bleibt es bei der bisherigen, dann wahren Meldung. Die Wiederholung
  schickt dann beides.
- Keine Quittung ohne erfolgreiche Bewertung. Das ist dieselbe Regel wie an der Stufenfrage
  (`val.stufenfrage.fehlerNachStufe`).

**Runde 2 — Korrektur nach Ben B1.** Runde 1 hielt für die ganze Seite nur **einen** unterbrochenen
Vorgang. Ein Teilerfolg auf Karte B verdrängte den noch offenen Vorgang von Karte A. A öffnete
danach mit leerem, bearbeitbarem Feld, und das erneute Absenden schrieb ihre Begründung ein zweites
Mal. Die Aussage „behoben“ aus Runde 1 galt deshalb nur für einen einzelnen Vorgang.

Jetzt hält die Seite die bestätigten Begründungen **je Karte und Entscheidung**
(`vorgangSchluessel(id, verdict)`). Ein Abschluss räumt nur die Vorgänge seiner eigenen Karte ab
(`ohneKarte`). Offene Vorgänge anderer Karten bleiben stehen.

### 2. Zuständigkeit sichtbar, Zuweisen meldet sich

- Im „Mehr“ steht die Zeile „Zugewiesen an: <Namen>“ für die **offenen** Zuweisungen. Die
  Board-Route reicht nur offene durch, siehe `ValidationService`.
- Wer bereits offen zugewiesen ist, steht im Auswahlfeld als „<Name> (bereits zugewiesen)“ und ist
  nicht noch einmal wählbar.
- Zuweisen meldet Erfolg („Zugewiesen an <Name>.“) und Fehler mit dem Servertext. Bisher sprang das
  Feld bei einem Fehler nur still zurück.

Neue Texte: `apps/web/src/texte/pruefboard.ts` (DE/EN/NL). `i18n.ts` ist unberührt.

Beleg: `tests/pruefboard-bedienung/rueckfrage-und-zuweisen-fehlerwege.test.tsx` (gemountete
Prüffläche, jsdom, 10 Fälle).

- Runde 1: Gegenprobe ohne die Produktänderung, 7 von 8 Fällen rot. Der achte Fall prüft die
  Abwesenheit der Zeile ohne Zuweisung und ist in beiden Fassungen grün.
- Runde 2: zwei Mehrkartenfälle neu (R3). Gegenprobe mit dem Produktcode aus Runde 1 (`ddaa9c4b`):
  beide R3-Fälle und Bens Testfall rot, die übrigen 8 grün. Mit der Korrektur sind alle grün.

## Bereits geliefert — abgegrenzt, nicht neu gebaut

| Teil | Ort | Beleg |
| --- | --- | --- |
| Reiter „Offen“: Liste links, eine Karte rechts, Funktionsinventar | JOB 3061 | `tests/design/h2-funktionsinventar.test.ts` (Browser, Prüfserver) |
| Stufenfrage vor Freigabe, Teilerfolg, Sperre im Folgezustand | JOB 3112 · V3 | `tests/validierung-stufe/*` |
| Paarhinweis „zweites Exemplar“ | JOB 3112 · V3 | `tests/validierung-stufe/doppelhinweis-*` |
| Listennavigation Tastatur/Rad, Rollbereiche | JOB 3504/3593/3625/3812 | `tests/pruefen-listennavigation/*`, Block L in `tests/design/job2935-validierung-fussband.test.ts` (Browser) |
| Volltext | Prüfen-Volltext | `tests/pruefen-volltext/*` |
| Schmaler Quellennachweis (Zeitpunkt, Adresse, Belegstelle) | JOB 4013 | `tests/pruefen-quellennachweis/nachweis-an-der-pruefkarte.test.tsx` |
| Dateiname am Nachweis | JOB 4077 | `tests/quelle-dateiname-am-nachweis/*` |
| Lange Belege schmal | JOB 4361 | `tests/pruefen-quellennachweis/lange-quellen-schmal-chromium.test.ts` (Browser) |
| Stufe und Erfassungsweg am Brett | JOB 3027 | `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` |
| Zustandsmodell Laden/Fehler/Auffrischung | Auftrag §9 | `tests/pruefseite/zustandsmodell-cache.test.tsx`, `abhaengiger-ladezustand-mounted.test.tsx` |
| Rückgabe an den Eigentümer | JOB 557 · D7 | `services/validation/src/rueckgabe-eigentuemer.test.ts` |
| KI-Sperre im Folgezustand | WP-SHIP9-B3FIX2 | `tests/validation/ai-gate-lock-followstate-mounted.test.tsx` |
| Schmale Auswahl | review26 | `tests/review26-pruefen-schmal/pruefen-schmal-auswahl.test.tsx` |

Die Browser-Belege oben wurden in diesem Lauf **nicht** wiederholt. Ihre Nennung bestellt keinen
Prüflauf.

## Offene Entscheidungen

1. ~~**Konfliktkennzeichnung an der Karte (§8.2).**~~ **Entschieden** von Pedi am 03.10.2026
   (`entscheidung:ebf707cb`): „Markierung an jeder betroffenen Karte, mit eigenem Lade- und
   Fehlerzustand für die Konfliktdaten." Umgesetzt in der Nacharbeit vom 05.10.2026, siehe unten.
2. ~~**Zuordnung je Aufnahmepunkt.**~~ Die Punkte liegen vor; die Zuordnung steht unten.
3. ~~**Stapel-Bearbeitung (R-0246)**~~ — gebaut in Nacharbeit 4, siehe Einzelzuordnung.
4. **Indexstatus (R-0237)** — neu, siehe Einzelzuordnung.

## Quellenwidersprüche

1. §8.2 nennt einen **Domänen**-Filter. Das KO hat kein Domänenfeld. Das Board filtert, wie die
   Bibliothek, nach **Wissensart** (`lib.facet.type`). Ob „Domäne“ die Wissensart meint, sagt die
   Quelle nicht. Betrifft R-0198, R-1705, R-2153 und SOLL:FR-VAL-04.
2. §8.3 verlangt echte E-Mail-/Push-Zustellung von Zuweisungen. Heute gibt es nur In-App
   (`notifyAssignment`, FR-VAL-07). Das gehört nicht zu diesem Board-Auftrag und bleibt unverändert.
3. **P-PRUEFEN-VOLLTEXT** trägt in der Quelle „erledigt 14.09.2026 — JOB 3290 ist LIVE“. Der
   Produktbaum widerspricht: JOB 3290 hat beide Hälften nur **gemessen**. Der Zielzustand stand als
   `it.fails` in `tests/pruefen-volltext/filter-inhalt.test.ts`, `pruefen-brett-gemountet.test.tsx`
   und `audit-akteur.test.ts`; die Dateiköpfe sagen selbst „misst den Mangel und behebt ihn nicht“.
   Die Erledigungsaussage der Quelle galt also der Messung, nicht der Behebung. Behoben in der
   Nacharbeit vom 05.10.2026 (Abschnitt 4 unten).
4. **R-1069** beschreibt eine Aktionszeile mit Stift und Papierkorb **auf jeder Karte**. Seit JOB 3061
   (Pedi 04.09.2026: „so irreführend und so unübersichtlich“) liegen Bearbeiten und Löschen im
   „···“-Menü der Karte. Die jüngere Entscheidung geht vor; die Funktion ist erhalten.
5. **R-0251 / R-0255** (Kartenetiketten, fünf statt acht) sind durch dieselbe jüngere Entscheidung
   überholt: die Karte trägt eine Pille und eine Metazeile, alles Weitere steht im „Mehr“.

## Nacharbeit 05.10.2026 — Kandidat `6b62ba41`

### 3. Konfliktmarkierung je Karte (§8.2, Pedis Entscheidung vom 03.10.2026)

- `apps/web/src/lib/pruefKonflikt.ts` (neu): `pruefKonfliktLage(koId, abruf)` mit vier Lagen —
  `laedt`, `fehler`, `keiner`, `betroffen` — plus `nichtFrisch` bei gescheiterter Auffrischung.
  Betroffen heißt: dieselbe Regel wie Bibliothek, Detail und Ask (`conflictImpact`, ungelöster
  Konflikt nennt das Objekt als A oder B).
- `apps/web/src/pages/Validation.tsx`:
  - An der Karte: Markierung mit `conflict.impact.title` bzw. `.truthTitle`, ab zwei Konflikten mit
    Anzahl, dazu „Zu den Konflikten →“ nur für Rollen mit Zugang zur Konfliktseite
    (`navigation.ts:274`, minRole controller). Kein Erklärsatz (Design „Prüfen“, R-1577: keine
    Vorbehaltstexte).
  - Eigener Ladezustand („Konfliktdaten werden geladen …“) und eigener Fehlerzustand (Satz +
    „Erneut laden“), beide ohne jede Aussage über Konflikte. Keine Entwarnung bei „keiner“.
  - Gescheiterte Auffrischung: Markierung bleibt, darunter „Konfliktstand nicht aktuell …“.
  - In der Warteschlange: ein benannter Punkt am betroffenen Eintrag (`aria-label`, Text des
    Eintrags bleibt der Titel).
  - Die Konfliktlage sperrt keine Prüfentscheidung — das verlangt keine Quelle.
- Abruf: derselbe Eintrag `["conflicts"]`, den der Reiterkopf schon zieht; kein zusätzlicher
  Netzabruf.
- Texte: `apps/web/src/texte/pruefboard.ts` (DE/EN/NL).
- Belege: `tests/pruefboard-bedienung/konfliktlage-regel.test.ts` (Regel),
  `tests/pruefboard-bedienung/konfliktmarkierung-mounted.test.tsx` (gemountete Fläche, Lagen
  K1–K7).

### 4. Volltextfilter durchsucht den ausführlichen Inhalt; Audit nennt den Handelnden

- `apps/web/src/lib/validationFilters.ts`: der Heuhaufen enthält jetzt den Klartext aus `bodyHtml`
  (`htmlToPlainText`, dieselbe Reduktion wie die Entwurfsliste) und, wenn ein Weg kein `bodyHtml`
  liefert, die `captionTexts` (Rückfallregel wie `librarySearch.ts:172`). N-0072,
  P-PRUEFEN-VOLLTEXT Hälfte 1.
- Beschriftung: das Feld trägt wieder „Volltext filtern …“ über den neuen Schlüssel
  `pruefboard.volltextFiltern`. `val.filter` bleibt unverändert stehen, weil der Umzugsnachweis
  `tests/i18n-textmodule/bestand-unveraendert.test.ts` seinen Wert samt Prüfsumme festhält. Am
  Eintrag `val.filter` ist nur ein Kommentar ergänzt, kein Wert geändert — seit der
  I18N-AUFTEILUNG auf main steht er in `apps/web/src/woerterbuch/de.ts`, nicht mehr in `i18n.ts`. Rest: `val.filter` ist damit
  ungenutzt; entfernen lässt er sich erst mit einem neu erzeugten Schnappschuss
  (`tests/i18n-textmodule/bestand-erzeugen.ts`).
- `services/ask/src/service.ts` / `services/app/src/routes/ask-routes.ts`: `gap.priority-changed`
  trägt den angemeldeten Nutzer; ohne Aufrufer (Demo-Seed) bleibt es `system` — über die
  vorhandene Regel `aufruferAus`. P-PRUEFEN-VOLLTEXT Hälfte 2.
- Die Sollverträge von JOB 3290 sind wie dort vorgeschrieben von `it.fails` auf `it` umgestellt;
  die Fälle, die den Befund als Tatsache festhielten (filter-inhalt K1 zweite Zeile,
  pruefen-brett-gemountet C3, audit-akteur K3), sind entfallen. C4 bindet die Beschriftung weiter an
  das Verhalten, jetzt am Schlüssel des Felds.
- Die Tests, die das Suchfeld über seinen Platzhalter finden, ziehen mit:
  `tests/pruefen-listennavigation/pfeiltasten.test.tsx`, `tests/app/mega47-persoenlicher-leerzustand.test.tsx`,
  `tests/review26-pruefen-schmal/pruefen-schmal-auswahl.test.tsx`.

### 5. Laufende Prüfung in der Liste erkennbar (R-0213)

Der Warteschlangeneintrag einer Karte mit laufender Prüfung ist gedämpft und trägt ein Schloss mit
Namen (`val.aiCheck.pending` / `.pendingAi`). Dasselbe Prädikat wie die Sperre der Karte
(`validationAiGate`). Beleg: `konfliktmarkierung-mounted.test.tsx`, Abschnitt R-0213.

### Prüfstand dieser Nacharbeit

In dieser Sitzung wurden **keine Tests ausgeführt** (Auftragsvorgabe: Cloud führt Tests und
`tools/build` aus). Alle Aussagen über das Verhalten sind Quelleninspektion; der Prüfplan steht in
`CLAUDE/PRUEFPLAN.json` des Auftrags. Auch Biome lief nicht; die Formatierung ist von Hand an
`biome.json` (Zeilenbreite 100) ausgerichtet und wird erst durch `tools/lint` belegt.

### Nacharbeit am Kandidaten `4b8a3a4f` — Prüfauswahl

- `tests/pruefboard-bedienung/konfliktmarkierung-mounted.test.tsx` (R-0213) sucht den Eintrag am
  Titel statt am Index: die Warteschlange sortiert bei Gleichstand nach Titel
  (`compareReviewPriority`), „Fertig“ stand vor „Läuft“. Sollwerte unverändert.
- `tests/app/mega47-modale-flaechen-sammler.test.tsx` ist nicht mehr Teil der Auftragsauswahl. Sein
  roter Fall „JOB 1181 · Klassenbindungen“ (228 statt 226) ist ein fremder Basisfehler: der Diff
  dieses Auftrags gegen den integrierten Hauptstand `6a25d896` fügt nur literale `className`-Werte
  hinzu, die geänderte Warteschlangen-Bindung war über `ist` schon vorher offen, und kein neuer Name
  verdeckt einen bisher aufgelösten. Der Sollwert 226 stammt von fe-001 (`6b09800e`). Der Test selbst
  bleibt unverändert und global sichtbar rot.

## Einzelzuordnung je Aufnahmepunkt

Stand: Kandidat `6b62ba41` plus Nacharbeit vom 05.10.2026. „Geliefert“ heißt: im Code vorhanden
und mit dem genannten Test belegbar; es ist **keine** menschliche oder Design-Abnahme. Wo die Quelle
eine solche Abnahme verlangt, steht sie als offen da.

| Punkt | Originalanforderung (gekürzt) | Ergebnis | Beleg / verbleibende Entscheidung |
| --- | --- | --- | --- |
| R-0198 | Status, Volltext, Domäne, Kategorie, Schlagworte, „mir zugewiesen“ kombinierbar | geliefert; Volltext seit 05.10. inkl. Inhalt | `tests/pruefen-volltext/filter-inhalt.test.ts` (K5 AND, A1–A5), `services/validation/src/service.test.ts` (FR-VAL-04). Domäne: Widerspruch 1 |
| R-0202 | Protokoll unterscheidet Rückgabe an Verantwortlichen und an Autor | geliefert | `ko.returned-to-owner` / `ko.returned-to-author` (`services/validation/src/service.ts:440-476`); `services/validation/src/rueckgabe-eigentuemer.test.ts`, `tests/validation/return-and-revalidate.test.ts` |
| R-0213 | laufende Prüfung in der Liste erkennbar, nicht doppelt bearbeitbar | geliefert (Liste seit 05.10.) | Sperre: `tests/validation/ai-gate-lock-followstate-mounted.test.tsx`; Liste: `konfliktmarkierung-mounted.test.tsx` (R-0213) |
| R-0214 | Löschen in der Prüferliste verschwindet wirklich, Liste schlüssig | geliefert | `tests/wissensobjekt-loeschen/zweites-loeschen-mounted.test.tsx`, `rueckfrage-im-blick-mounted.test.tsx` |
| R-0219 | Posteingang nur offene Objekte | geliefert | `services/validation/src/service.test.ts` („FR-VAL-03“) |
| R-0226 | Validierungsseite auf das Zielbild; drei Entscheidungen, zwei mit Begründungspflicht; Stufe im Bestand | im Code geliefert (JOB 3061, 3112) | `tests/validierung-stufe/*`, `tests/validation/validation-feedback.test.ts`; Design-Lead-Abnahme mit Vorher/Nachher **offen (menschlich)** |
| R-0237 | Indexstatus sichtbar, zunächst nur Anzeige | **nicht gebaut** | Quelle: KW-AI-INDEX-02 „vorbereitet, nicht freigegeben“. Entscheidung offen: soll eine Anzeige ohne Indexlogik gebaut werden? Ohne Datenquelle wäre jede Anzeige eine Behauptung |
| R-0238 | Kommentarpflicht bei bedingt/abgelehnt, nicht bei Bestätigung; laut Qualifikation „widersprechende Ablehnung erzeugt Konfliktvorschlag“ | geliefert; Konfliktvorschlag **gebaut in Nacharbeit 4** | Kommentarpflicht: `isFeedbackSubmittable`, `tests/validation/validation-feedback.test.ts`. Konfliktvorschlag: `rate` mit `verdict: "down"` und `widerspruch { koB, type, description }` legt im selben Aufruf einen manuellen Konflikt („offen“, `createdBy` = Ablehnende) an; ungültige Angaben werden vor der Bewertung abgewiesen. Nacharbeit 7: scheitert der Vorschlag nach gespeicherter Bewertung, antwortet der Server mit `KONFLIKTVORSCHLAG_OFFEN` und `bewertungGespeichert: true`; die Wiederholung bewertet idempotent (Upsert) und verwendet einen schon angelegten offenen Vorschlag derselben Person wieder. Beim Wiederöffnen einer unterbrochenen Ablehnung kehren Gegenüber und Art mit der Begründung zurück. Nacharbeit 8: die Antwort nennt den tatsächlich offenen Schritt — `KONFLIKTVORSCHLAG_OFFEN` (Vorschlag fehlt) oder `KONFLIKTFOLGE_OFFEN` (Vorschlag steht, nur die Rückholung der betroffenen Beiträge fehlt) — samt bewerteter Fassung. Die Fortsetzung schickt `fortsetzungFuerFassung` und bewertet **nicht** erneut; sie setzt nur die fehlenden Konfliktschritte fort, solange die eigene Ablehnung genau dieser Fassung besteht. Wurde inzwischen überarbeitet, antwortet der Server 409 `FASSUNG_UEBERARBEITET` (nichts bewertet, nichts angelegt), und die Fläche sagt es. Belege: `tests/validation/rework-flow-e2e.test.ts` (HTTP), `rueckfrage-und-zuweisen-fehlerwege.test.tsx` W1 (Fläche) |
| R-0242 | Revisions-Schleife: Rückgabe mit Kommentaren, Überarbeitung, Neueinreichung | geliefert | `tests/validation/return-and-revalidate.test.ts`, `tests/validation/rework-flow-e2e.test.ts`, `tests/ko/review-rework-context.test.ts` |
| R-0246 | Stapel-Bearbeitung: mehrere auswählen, gesammelt bestätigen/zuweisen | **gebaut in Nacharbeit 4** | Kästchen je Eintrag, ab Controller; „Alle auswählen“, Aktionen und Ergebnis im Kopfmenü „Stapel“ (Nacharbeit 5: über der Liste kostete die Leiste die Liste 26 px und verletzte die Geometrieverträge in Block L von `job2935-validierung-fussband.test.ts`). Die Kästchen erscheinen nur im Auswahlmodus („Mehrere auswählen“ im Menü, oder solange etwas ausgewählt ist) — Nacharbeit 6: dauerhaft sichtbar verkürzten sie jeden Titel, ein Eintrag brach eine Zeile tiefer um und L19 sah die neue Auswahl nicht mehr. Nacharbeit 7: geprüft wird vor jedem einzelnen Aufruf am jetzigen Stand (inzwischen gesperrt → nicht geschickt, weggefallen → „entfallen“); das Ergebnis bleibt auch bei danach leerer Warteschlange im Menü erreichbar. Bestätigen je Objekt mit denselben Sperren wie die Einzelfreigabe: laufende KI-Prüfung, offene Dublette und fehlende Stufe werden nicht geschickt, sondern mit Grund gemeldet und bleiben ausgewählt; Zuweisen über `assign`. Ergebnis je Objekt aus der Serverantwort. Regel: `apps/web/src/lib/pruefStapel.ts`; Beleg: `tests/pruefboard-bedienung/stapel-bearbeitung-mounted.test.tsx` S1–S5. Die frühere Einordnung „nicht gebaut, Entscheidung offen“ war keine belegte Nutzerentscheidung (Ben, Nacharbeit 4) |
| R-0251 | Etiketten der Validierungskarte klar, ohne Doppelung (JOB 1100) | überholt durch JOB 3061 | `tests/app/validation-card-labels-mounted.test.tsx`; Widerspruch 5 |
| R-0255 | fünf statt acht Abzeichen, ohne Angabe zu verlieren (D-033) | überholt durch JOB 3061 | Funktionsinventar „Mehr“ (`Validation.tsx` Kopfkommentar); Browser: `tests/design/h2-funktionsinventar.test.ts`; Widerspruch 5 |
| R-0262 | Fehlerfall beim Freigeben sichtbar quittiert | geliefert | `tests/validierung-stufe/stufenfrage-fehler-keine-freigabe.test.tsx`, `stufenfrage-teilerfolg.test.tsx`, `apps/web/src/pages/Validation.quittung.test.tsx` |
| R-0977 | Karte als Ganzes anklickbar, Details eingeklappt | geliefert | `tests/validation/validation-card.test.ts` (`cardClickOpens`); „Mehr“ als `<details>` |
| R-0992 | Validierungsseite ohne kaputtes Layout (Station 4); Freigeben als gefüllter grüner Knopf | im Code geliefert (JOB 3061/3812) | Fußband `pruefen-entscheidung-up` (`bg-trust-pos-fill`, Häkchen); Browser: `tests/design/job2935-validierung-fussband.test.ts`; Vorher/Nachher und Design-Lead-Abnahme **offen (menschlich)** |
| R-1069 | Bearbeiten und Löschen im Board; ohne Berechtigung unsichtbar | geliefert in jüngerer Form | im „···“-Menü (Widerspruch 4); die Seite verlangt `controller` (`navigation.ts:264`), Löschen zusätzlich `darfLoeschen`; `tests/wissensobjekt-loeschen/*` |
| R-1081 | Pflicht-Begründung bei Rückfrage/Ablehnung, landet als Kommentar | geliefert | `tests/validation/validation-feedback.test.ts`, `tests/pruefboard-bedienung/rueckfrage-und-zuweisen-fehlerwege.test.tsx` |
| R-1082 | Prüf-Fokus neu gegen überarbeitet | geliefert | `tests/validation/validation-review-context.test.ts`, `validation-board-focus.test.ts` |
| R-1083 | Prüf-Führung „Was prüfe ich jetzt?“ | geliefert | im „?“-Menü; `tests/validation/review-guidance.test.ts` |
| R-1559 | H2 Prüfen nach Pages-Maßstab (JOB 3061) | geliefert, live belegt laut Quelle | nicht neu bestellt |
| R-1577 | Design Prüfen: vier Reiter, Konflikt/Duplikat als Kartenpaar, keine Vorbehaltstexte | im Code, nicht abgenommen | Design-Abnahme **offen (menschlich)**; die neue Konfliktmarkierung hält die Regel „keine Vorbehaltstexte“ ein |
| R-1704 | Board: Arbeitsliste offener Objekte (FE-VAL-01) | geliefert | wie R-0219 |
| R-1705 | Filter Status, Domäne, Kategorie, Tags, Zuweisung (FE-VAL-02) | geliefert | wie R-0198; Domäne: Widerspruch 1 |
| R-1709 | Revisions-Schleife mit Kommentaren (FE-VAL-06) | geliefert | wie R-0242 |
| R-2152 | Board zeigt nur offene KOs (FR-VAL-03) | geliefert | wie R-0219 |
| R-2153 | Board-Filter (FR-VAL-04) | geliefert | wie R-0198 |
| N-0072 | Volltextfilter findet ausführlichen Inhalt nicht | **behoben 05.10.** | `filter-inhalt.test.ts` A1–A5, `pruefen-brett-gemountet.test.tsx` S1/C4 |
| P-PRUEFEN-LISTENNAVIGATION | links durch die Liste, rechts der Artikel; Rad und Pfeile, nur an der Liste | geliefert (JOB 3504/3593/3625/3812) | `tests/pruefen-listennavigation/*`; Browser: Block L in `job2935-validierung-fussband.test.ts` |
| P-PRUEFEN-VOLLTEXT | Volltext ohne Inhalt; Audit `gap.priority-changed` unter „system“ | **behoben 05.10.** (beide Hälften) | `filter-inhalt.test.ts`, `pruefen-brett-gemountet.test.tsx`, `audit-akteur.test.ts` (B1–B3, K4 bleibt „system“); Widerspruch 3 |
| TEST-A05 | Validieren, freigeben und revidieren (Gesamtprüfung 14.09.) | im Code belegt, Gesamtweg offen | Freigabe/Rückfrage/Ablehnen gemountet: `tests/pruefseite/entscheidungswege-mounted.test.tsx`. Laut Quelle „sichtbar, aber nicht ausgeführt; KI-Prüfung ohne Modell gescheitert“ — ein menschlicher Durchlauf mit verfügbarem Modell ist **offen (externe Voraussetzung)** |
| priority:PRUEFEN-LISTENNAVIGATION | dieselbe Anforderung wie P-PRUEFEN-LISTENNAVIGATION | geliefert | wie dort |
| priority:PRUEFEN-VOLLTEXT | dieselbe Anforderung wie P-PRUEFEN-VOLLTEXT | behoben 05.10. | wie dort |
| package:listen | Pfeiltasten/Mausrad, Auswahl sichtbar, Textfelder und Scrollen bleiben bedienbar | geliefert | `tests/pruefen-listennavigation/pfeiltasten.test.tsx` (inkl. „Pfeiltasten in einem Textfeld bewegen die Auswahl NICHT“), `mausrad.test.tsx`, `rollbereich-lagen.test.tsx` |
| SOLL:FR-VAL-03 | nur offene KOs, validierte in der Bibliothek | geliefert | wie R-0219 |
| SOLL:FR-VAL-04 | Board-Filter, alle kombinierbar | geliefert | wie R-0198 |

Die Browser-Belege in dieser Tabelle wurden in dieser Sitzung nicht wiederholt; der Prüfplan nennt,
welche davon der Cloudlauf an diesem Kandidaten fährt.
