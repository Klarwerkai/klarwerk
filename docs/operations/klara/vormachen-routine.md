# Vormachen, zweckgebundenes Mitschreiben und persönliche Routine (PoC)

Auftrag: `produkt:20261011:peter-p06` (Revision 1) · PETER-20261011-P06, Fragen 35 und 36.
Phase: PoC. Agentenprüfung mit fiktiven Testdaten, keine Messung mit realen Anwendern.

## Bestand vor dieser Lieferung

| Baustein | Bestand am Basisstand `8cdeff87b` | Verwendung hier |
| --- | --- | --- |
| Persönliches Gedächtnis (`interaktionsgedaechtnis.ts`) | eigener Datenraum je Konto, Frist, Einzel- und Gesamtlöschung | dieselbe Bauform (Konto nur aus der Sitzung, fremd = 404, Prüfprotokoll ohne Inhalt); Lernnotizfrist = Gedächtnis-Standardfrist 90 Tage |
| Office-Kanäle | Word-Taskpane (`apps/web/public/word-addin/`) und Klarwerk-Web | die zwei wählbaren Hosts `word` und `klarwerk_web`; mitgeschrieben wird an ihren vorhandenen Serverwegen |
| Entwurfs-, Frage- und Prüfweg (`/api/drafts…`, `/api/ask`, Klara-Sitzung) | vorhanden | Quelle der Beobachtungen; Firmenübergabe einer Routine = eigener Entwurf (`ko.create`) |
| Vormach-/Lernweg, Routine, Außenaktions-Bestätigung | **nicht vorhanden** | in dieser Lieferung ergänzt |

`docs/aufnahme/bildschirmablauf-uebernahme.md` (Import einer extern aufgezeichneten Ablaufdatei)
bleibt unverändert; er beobachtet nichts und ist kein Lernweg.

## Bedienweg

1. **Einstellungen → Persönliche Einstellungen → „Vormachen und Routinen“.**
2. Anwendung wählen (Word oder Klarwerk im Browser), die mitzuschreibenden **Vorgänge** ankreuzen
   (Vorgänge mit Außenwirkung sind markiert), **Zweck** eintragen, **Abbruchregel** wählen →
   „Mitschreiben starten“.
3. Die Aufgabe ganz normal erledigen — in Word über das Klara-Taskpane, im Browser in Klarwerk.
   Während die Sitzung offen ist, steht auf **jeder Seite** unten links die Lernanzeige
   („Lernt mit – n Schritte mitgeschrieben“ bzw. „Pausiert“) mit dem Knopf **Pause/Fortsetzen**.
4. „Vorschau ansehen“: Schritte in Reihenfolge, je Schritt der Beleg („aus Schritt n“),
   Außenwirkung und ob korrigiert. Schritte **ändern** oder **herausnehmen**, dann
   „Routine bestätigen“. Die Bestätigung gilt nur für den gezeigten Stand.
5. **Meine Routinen**: interne Schritte „Ergebnis vorbereiten“ (Modus „Ergebnis zur Prüfung“);
   ein Schritt mit Außenwirkung: „Ausführung anfordern“, dann „Diese Ausführung bestätigen“ — jedes
   Mal neu, für genau diese eine Ausführung.
6. „Als Entwurf an die Firma übergeben“ legt eine eigene Kopie im Entwurfsweg an (Recht
   `ko.create`); sie durchläuft die normale Prüfung.
7. „Alles Private löschen“ entfernt Lernsitzungen, Lernnotizen und Routinen; übergebene Entwürfe
   bleiben.

## Was mitgeschrieben wird — jeder Vorgang mit echter Quelle

| Host | Vorgang | Quelle | Außenwirkung |
| --- | --- | --- | --- |
| Word | `word_auswahl_uebernehmen` — markierten Text als Entwurf übernehmen | `POST /api/drafts` mit `origin: "word_addin"` | nein |
| Word | `word_dokument_uebernehmen` — ganzes Dokument als Entwurf | `POST /api/drafts/from-docx` aus dem Taskpane | nein |
| Word | `word_frage` — Frage an das Firmenwissen | `POST /api/ask` bzw. `…/klara/sessions/:id/execute` aus dem Taskpane | nein |
| Word | `word_formulierung` — Formulierungsvorschlag | `POST /api/klara/sessions/:id/zuruf` | nein |
| Klarwerk-Web | `seite_oeffnen` | Seitenwechsel in der Anwendung (Pfad ohne Suchanfrage), vom Client | nein |
| Klarwerk-Web | `frage_stellen` | `POST /api/ask` | nein |
| Klarwerk-Web | `entwurf_anlegen` | `POST /api/drafts` | nein |
| Klarwerk-Web | `entwurf_speichern` | `PUT /api/drafts/:id` | nein |
| Klarwerk-Web | `zur_pruefung_einreichen` | `POST /api/drafts/:id/promote` | **ja** |

Die Arbeitswege schreibt der **Server** nach einer erfolgreichen Antwort selbst mit
(`services/app/src/vormachen-arbeitswege.ts`; in `build-app.ts` merkt `onSend` nur den gesendeten
Rumpf, mitgeschrieben wird in `onResponse`, je Anfrage genau einmal) — nur, wenn das Konto
eine offene, lernende Sitzung hat, Host und Vorgang gewählt sind **und der Lernzustand in genau
diesem Client sichtbar ist** (siehe unten). Ein Client kann einen Arbeitsweg-Vorgang nicht melden
(`422 nur_arbeitsweg`). Der Host einer Anfrage: Word bei Klara-Bindungskopfzeile,
`origin: "word_addin"` oder Herkunftsseite unter `/word-addin/`; Klarwerk-Web bei anderer
Herkunftsseite der Anwendung; sonst unbestimmt → nie mitgeschrieben. Als Rohwert wird höchstens
Titel bzw. Frage (200 Zeichen) festgehalten, nie der Entwurfsinhalt.

### Beschreibung aus der tatsächlichen Änderung

Jeder Schritt sagt, **was** getan wurde, **woran** und **welche Angaben** dabei gesetzt wurden:
Ordnungsangaben mit Wert (Art, Kategorie, Vertraulichkeit, Fachgebiet), Inhaltsfelder nur beim
Namen (Titel, Aussage, Inhalt). Der Zielbezug verweist auf den Schritt, in dem der Entwurf entstand
(„Entwurf aus Schritt 1“), sonst „vorhandener Entwurf“. Beispiel:
`Entwurf speichern (Entwurf aus Schritt 1): Kategorie „Vertrieb“`. Die Entwurfskennungen dafür sind
Rohdaten der Lernsitzung und werden mit ihr entfernt.

### Nie unsichtbar: Sichtbarkeit als Bedingung des Mitschreibens

- Die Lernanzeige (`VormachenAnzeige`) meldet beim Laden und alle 20 s
  (`GET /api/me/vormachen?anzeige=klarwerk_web`), dass der Lernzustand **in diesem Client**
  sichtbar ist. Der Server bindet die Meldung an die Anmeldesitzung (Hash des Tokens) und lässt sie
  60 s gelten (`SICHTBAR_GUELTIG_MS`). Ohne frische Meldung genau dieses Clients wird nichts
  gespeichert, nur als „nicht sichtbar“ gezählt — Tab zu, anderes Gerät, Word-Panel.
- Der Merker, dass eine Sitzung offen ist, liegt je Konto im **Browserspeicher** (alle Tabs,
  übersteht das Schließen des Starttabs, Änderungen gehen per `storage`-Ereignis an andere Tabs).
- **Word:** Das Klara-Panel zeigt den Lernzustand mit sofortiger Pause (Block KW-VORMACHEN,
  `apps/web/public/word-addin/vormachen.js`, im Kopf von `taskpane.html` hinter `anleitung.js`). Es
  sieht 2 s nach dem Laden erstmals nach und meldet sich bei offener Word-Lernsitzung alle 20 s mit
  `?anzeige=word` (sonst alle 60 s, nur
  angemeldet, nur wenn das Panel nicht verborgen ist) und schaltet mit
  `PUT /api/me/vormachen/:id/zustand`. Erst diese Meldung desselben Panels lässt den Server
  Word-Arbeitswege mitschreiben. Ein Host, der den Zustand nicht anzeigt, ist nicht startbar
  (`409 host_ohne_anzeige`).

## Server

`services/app/src/vormachen.ts` (Dienst, Ablagen) und `services/app/src/routes/vormachen-routes.ts`
(Routen, alle nur für das eigene Konto):

| Route | Wirkung |
| --- | --- |
| `GET /api/me/vormachen` | eigene Sitzungen (Lernnotiz ohne Rohwerte), Routinen, Katalog |
| `POST /api/me/vormachen` | Start mit `host`, `vorgaenge`, `zweck`, `abbruchRegel` |
| `POST /api/me/vormachen/:id/beobachtungen` | nur Vorgänge mit Quelle `client` (Seitenwechsel) |
| `PUT /api/me/vormachen/:id/zustand` | `lernt` / `pausiert`, sofort wirksam |
| `GET /api/me/vormachen/:id/vorschau` | Vorschau mit Beleg je Schritt und Prüfsumme `stand` |
| `PUT /api/me/vormachen/:id/korrektur` | Beschreibung ändern oder Schritt herausnehmen |
| `POST /api/me/vormachen/:id/bestaetigung` | Routine aus genau diesem `stand` (alt → 409); danach Rohdaten und Lernnotiz entfernt |
| `POST /api/me/vormachen/:id/abbruch` | Abbruch nach Regel |
| `DELETE /api/me/vormachen/:id` | Sitzung oder behaltene Lernnotiz löschen |
| `POST /api/me/vormachen/routinen/:id/schritte/:schrittId/freigabe` | intern: Ergebnis zur Prüfung; Außenschritt: Anforderung (409 mit `ausfuehrung`), dann `{ bestaetigung: { ausfuehrung } }` |
| `POST /api/me/vormachen/routinen/:id/firmenuebergabe` | Entwurf über den Entwurfsweg (`ko.create`) |
| `DELETE /api/me/vormachen` | Privatlöschung |

### Regeln

- **Beobachtungsgrenze:** nur der beim Start gewählte Host und nur die gewählten Vorgänge;
  alles andere wird weder mit Beschreibung noch mit Rohwert gespeichert, nur gezählt
  („nicht mitgeschrieben: n“). Ohne offene Sitzung wird nicht einmal die Anmeldung aufgelöst.
- **Ablagen:** Lernsitzungen mit Rohdaten und Lernnotiz liegen **nur im Speicher des Dienstes**
  (ein Neustart löscht sie). **Bestätigte Routinen sind dauerhaft** (Frage 35): im Postgres-Betrieb
  Tabelle `persoenliche_routinen` (`PERSOENLICHE_ROUTINEN_SCHEMA`, additiv), im Restore-Drill als
  Pflichttabelle, im Dateninventar als „Persönliche Routinen aus dem Vormachen“.
- **Rohdaten:** höchstens 24 Stunden (`ROHDATEN_FRIST_STUNDEN`); danach bricht der Dienst die Sitzung
  nach ihrer Regel ab. Bestätigung entfernt Rohdaten und Lernnotiz; die Routine trägt nur die
  Beschreibung.
- **Abbruchregel:** `alles_verwerfen` (Voreinstellung) entfernt die Sitzung ganz;
  `lernnotiz_behalten` entfernt alle Rohwerte und behält die Notiz bis zu 90 Tage oder bis zur
  gezielten Löschung. Eine behaltene Notiz wird nie zur Routine.
- **Außenaktion:** Ein Außenschritt wird je Ausführung **angefordert**; der Server vergibt eine
  Ausführungskennung, gebunden an Konto, Routine, Fassung und Schritt, gültig 5 Minuten. Die
  Freigabe verlangt genau diese Kennung und **verbraucht** sie: kein zweiter Gebrauch, kein anderer
  Schritt, keine andere Routine, kein anderes Konto. Die Bestätigung der Routine genügt nicht.
- **Prüfprotokoll:** nur Ereignisse (`vormachen.*`) mit Kennungen und Zahlen, nie Zweck,
  Beschreibung oder Rohwert.
- **Löschmarkierung (RF-17):** Die Privatlöschung vermerkt **vorher** eine Markierung (Art,
  Kontokennung, Zeitpunkt; kein Inhalt) in der Datei `KLARWERK_LOESCHMARKIERUNGEN` außerhalb der
  Datenbank, eine JSON-Zeile je Löschung, mit `fsync`. Scheitert der Vermerk, wird nicht gelöscht.
  Der Wiederanlauf (`KLARWERK_WIEDERANLAUF`, `wiederanlauf.ts`) wendet alle Markierungen an, bevor
  er die erste Anfrage annimmt: Er entfernt die Routinen des Kontos, die zum Markierungszeitpunkt
  bestätigt waren. Später bestätigte bleiben. Die Auskunft `GET /api/admin/wiederanlauf` zeigt
  `persoenlicheLoeschmarkierungen` mit Zahlen; das Prüfprotokoll hält `wiederanlauf.loeschmarkierungen`
  fest. Eine unlesbare Ablage hält den Wiederanlauf an (fail-closed). Ohne gesetzte Ablage gilt
  `ort: null`: Es wird nichts vermerkt, und ein Restore brächte gelöschte Routinen zurück.

## Prüfungen

| Datei | Kriterien | Art |
| --- | --- | --- |
| `tests/vormachen-routine/vormachen-am-server.test.ts` | P06-AC01 bis AC07 | echter Server, Vormachen über die echten Entwurfswege (Web- und Word-Herkunft) |
| `tests/vormachen-routine/vormachen-mounted.test.tsx` | AC01/AC02/AC04/AC05 | echte Hülle und Fläche, echter Server |
| `tests/vormachen-routine/routinen-pg.integration.test.ts` | AC03/AC07, Frage 35 | **Persistenz**, echtes PostgreSQL: Routine übersteht Neustart, Lernsitzung nicht; Privatlöschung entfernt Zeilen |
| `tests/wiederherstellung-export/zusammenhang.integration.test.ts` (R1) | AC03, Frage 35 | **Restore**: Routinen je Konto über die echten Routen angelegt, mit der bestehenden Sicherungssteuerung (`restore-drill.sh`, `pg_dump`/`pg_restore`) in eine neue Datenbank wiederhergestellt; Zeilen gleich, je Konto über die Anwendung zurückgelesen, fremdes Konto sieht nichts |
| `tests/vormachen-routine/loeschmarkierung-wiederanlauf.test.ts` | AC07, RF-17 | Löschmarkierung am bestehenden Wiederanlauf, **simulierter** Restore (Speicherbetrieb): vor der Freigabe entfernt, neue und fremde Routinen sowie Firmenentwurf bleiben; Vermerk scheitert → keine Löschung; unlesbare Ablage → nicht bereit |
| `tests/vormachen-routine/routinen-loeschmarkierung-restore.integration.test.ts` | AC07, RF-17 | **echter Restore**: `backup.sh` → Privatlöschung → `restore-drill.sh` → Wiederanlauf → Freigabe an PostgreSQL |
| `tests/vormachen-routine/agentenvergleich-ausgefuehrt.test.ts` | AC08 | **ausgeführt**: derselbe Agent erledigt dieselben fiktiven Aufgaben auf beiden Wegen über die echten Arbeitswege; Ergebnisse verglichen; Einrichtung, Korrektur, Arbeit, Freigaben, Prüfung, Planung getrennt erfasst |
| `tests/vormachen-routine/agentenvergleich.test.ts` | AC08 | **Simulation** (Zählung der Angaben), als Gegenprobe der Rechenlogik erhalten |

Die Vergleichstabellen stehen im jeweiligen Testlauf; die Zahlen stehen im Prüfbericht, nicht hier.
Der Agent ist ein deterministisches Skript, kein Modell.

## Referenzfälle RF01–RF18, drei Arbeitswege, Gegenprüfung

Quelle: das gebundene Briefing (Quellbefund `QUELLEN-FACHHILFE-P06-ORIGINALBRIEFING-20261011.json`:
`POC_PRUEFBRIEFING.md` „Ablauf der Prüfung“ Nr. 3–7, `REFERENZFAELLE_MASCHINENBAU.md` RF-01–RF-18,
`BRIEFING_CLAUDE_TEST.md`). Die Zuordnung übernimmt nur vorhandene Belege mit ihrem tatsächlichen
Ergebnis; nichts davon ist eine neue Abnahme.

**Vorhandene Belege, auf die die Tabellen verweisen:**

- **LIVE** — die Live-Agentenprüfung zum gebundenen Briefing, `PRUEFCHAT_BELEGE/ERGEBNIS.json` in
  `AUSWERTUNG_PETER_20261011` (Auftragsquelle `QUELLEN.json`). Daten des Laufs: Prüfagent
  `codex:01a0dcde-4235-7952-9e2c-ceafc127a2d4`, 2026-10-11T08:33:27Z, Status „Zwischenstand –
  Voraussetzungen offen; keine vollständige Abnahme“. Hosts: Chrome 154.0.8037.98 und Word Mac 16.111;
  Word Web wurde nicht geprüft. Die Fassung der Instanz nennt der Beleg nur über `BEREITSTELLUNG.json`;
  die Datei liegt nicht in den Auftragsquellen.
  - Ergebnis: **alle RF-01 bis RF-18 „blockiert“, keiner vollständig ausgeführt**, unabhängige
    Claude-Bewertung „ausstehend“.
  - Blockaden:
    - B01: nur ein Administratorkonto, keine normale Fachrolle;
    - B02: Import & Quellen live aus;
    - B03: Confluence-Zugang nicht verifiziert;
    - B04: Anhängen einer Webquelle live blockiert;
    - B05: keine isolierte Testfirma mit Gegenrollen;
    - B06: kein Testkalender samt Quellrechten und Routine;
    - B07: Word-Dateidialog nicht abgeschlossen;
    - B08: Modellrouting je Schutzstufe nicht belegt.
- **P06** — die automatischen Prüfungen dieses Auftrags (Tabelle „Prüfungen“). Ihre Ergebnisse
  stehen in den Prüfberichten unter `HISTORIE/nacharbeit-*/PRUEFUNG`:
  - Server, AC01–AC07: 23 Fälle grün am Kandidaten 6aa1f2a2 (nacharbeit-11);
  - Oberfläche: 3 Fälle grün am Kandidaten 6aa1f2a2 (nacharbeit-11);
  - Restore R1: grün am Kandidaten d680a62f (nacharbeit-10).

Elternverträge mit eigenem, kandidatengebundenem Lieferbeleg zu RF-Fällen liegen in den Quellen dieses
Auftrags nicht vor. Wo die Tabelle „kein Elternbeleg“ sagt, ist der Fall also **nicht belegt**, nicht
erfüllt.

### Drei Arbeitswege (Ablauf Nr. 3)

| Arbeitsweg | Tatsächliches Ergebnis (Beleg) | P06-Anteil und Rest |
| --- | --- | --- |
| W1 · Erfassen → Entwurf → fachliche Bestätigung → Wiederfinden | **LIVE: blockiert.** Erfassen → Entwurf → Einreichen → Wiederfinden lief real als Admin, aber die fachliche Bestätigung fehlt und die Quelle ist blockiert (B01, B04). | P06 schreibt den Weg nur mit, ohne ihn zu ändern: AC01/AC04, am echten Entwurfsweg grün. Offen ist die fachliche Bestätigung durch eine normale Fachrolle (Elternvertrag, braucht B01). |
| W2 · Belegte Frage → Quellenänderung → Geltungsentscheidung | **LIVE: blockiert**, die Quellenanbindung fehlt (B02–B04). | P06: `frage_stellen` ist als Vorgang wählbar (AC01). Quellenänderung und Geltung sind Elternumfang ohne eigenen Beleg; offen. |
| W3 · Persönliche Routine → Vorschau → bestätigte Ausführung → Termin-/Löschentscheidung | **LIVE: blockiert**, „Testkalender und eingerichtete Routine fehlen“ (B06). | **P06**, grün: Vorschau (AC04), Bestätigung nur aus dem gezeigten Stand (AC03/AC04), Außenbestätigung je Ausführung (AC05), Löschentscheidung über Privatlöschung (AC07, mit Löschmarkierung über den Restore hinweg, s. RF-17) und Abbruch nach Regel (AC06). **Terminänderung: nicht belegt** (s. RF-14). |

### Referenzfälle

| Fall | Tatsächliches Ergebnis (Beleg) | P06-Anteil und Rest |
| --- | --- | --- |
| RF-01–RF-04 · Realfälle (Hubtisch, Drehmoment, Druckanzeige, Pumpe) | LIVE: blockiert (B01, B04) | Kein P06-Anteil (Wissens- und Fragewege). Kein Elternbeleg; offen. |
| RF-05 · Confluence mit Bereichs-/Elternbeschränkung | LIVE: blockiert (B01–B03) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-06 · Inhalt ohne Einstufung, Import „firmenintern“ | LIVE: blockiert (B01, B02) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-07 / RF-08 · Existenz ohne bzw. mit Existenzrecht | LIVE: blockiert (B01, B05) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-09 · Ursprungsobjekt nach Import gelöscht | LIVE: blockiert (B02, B03) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-10 · Leserecht nach Import entzogen | LIVE: blockiert (B01–B03) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-11 · Stufe „Keine KI“ | LIVE: blockiert (B05, B08) | Kein P06-Anteil; das Vormachen ruft keine KI. Kein Elternbeleg; offen. |
| RF-12 · extern bestätigtes Testdokument | LIVE: blockiert (B01, B04) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-13 · Admin ohne Weisungsrecht, dann befugte Person | LIVE: blockiert (B01, B05) | Kein P06-Anteil. Kein Elternbeleg; offen. |
| RF-14 · Routine im Prüfmodus, externer Termin gelöscht, Dialog nur geschlossen → Ausführung bleibt pausiert, explizite Entscheidung nötig | LIVE: blockiert (B06) | **P06, grün:** Die Routine läuft im Prüfmodus („Ergebnis zur Prüfung“). Eine angeforderte, aber nicht bestätigte Außenausführung gibt nichts frei: Nach dem ersten Zug ist nichts freigegeben (Oberfläche U3). Ohne den zweiten Zug verfällt die Anforderung, und eine Fortsetzung braucht eine neue Anforderung samt Bestätigung (Server AC05: „bindet die Bestätigung …“, „verfällt nach ihrer Frist“). Ein eigener Dialog-schließen-Fall ist nicht geprüft. **Nicht belegt: der Auslöser „externer Termin gelöscht“.** Im Produkt gibt es keinen Kalenderweg: Routinen haben keinen Termin, es gibt keinen Kalenderanschluss, und die Oberfläche sagt „Aufgaben, Erinnerungen und Termine sind noch in Arbeit und hier nicht freigegeben“ (`apps/web/src/texte/klaraprodukt.ts`). Die Entscheidung dazu (Frage 40: „Externe Löschung erfordert Entscheidung zur Fortführung; betroffene Ausführung bis dahin pausieren“) gehört zu PETER-20261011-P07. Einen Kalender hier zu bauen, wäre eine Doppelimplementierung und ein neuer Scheduler (Nichtziel). Offen, bis P07 den Kalenderweg liefert und B06 (Testkalender) vorliegt. |
| RF-15 · Kalenderserie über Zeitumstellung | LIVE: blockiert (B06) | Kein P06-Anteil (P07, Frage 41). Kein Elternbeleg; offen. |
| RF-16 · zwei Firmen, Partnerfreigabe | LIVE: blockiert (B01, B05) | P06-Anteil grün: Routinen sind je Konto getrennt (AC01/AC07). Firmentrennung: kein Elternbeleg; offen. |
| RF-17 · Privatverlauf löschen, geteilte Firmennotiz behalten, später Testrestore → Privatbestand entfernt, geteiltes Wissen erhalten, Löschmarkierung vor Wiederfreigabe angewendet | LIVE: blockiert (B05) | **P06, vollständig umgesetzt (Nacharbeit 12):** Die Privatlöschung vermerkt vorher eine Löschmarkierung außerhalb der Datenbank. Der Wiederanlauf wendet sie an, bevor er eine Anfrage annimmt, also vor der Freigabe. Der getrennt übergebene Firmenentwurf bleibt. Gegenproben: `loeschmarkierung-wiederanlauf.test.ts` (simulierter Restore) und `routinen-loeschmarkierung-restore.integration.test.ts` (echtes `backup.sh` → Privatlöschung → `restore-drill.sh` → Wiederanlauf → Freigabe). Ergebnis im Prüfbericht des Kandidaten nach Nacharbeit 12. |
| RF-18 · Reset mit fehlendem Bestätigungsschritt | LIVE: blockiert (B05) | Kein P06-Anteil (P08). Kein Elternbeleg; offen. |

Ablauf Nr. 4 (Negativfälle): Die zu P06 anwendbaren Negativfälle sind die Ablehnungsfälle in AC01,
AC02, AC05, AC06 und AC07 von `vormachen-am-server.test.ts`:
- fremder Host oder Vorgang;
- keine Anzeige, Pause, fremdes Konto;
- falsche, verbrauchte oder verfallene Ausführung;
- unbekannte Regel, fehlendes `ko.create`.

Dazu kommen L2/L3 von `loeschmarkierung-wiederanlauf.test.ts`: Ist die Markierung nicht schreibbar, wird
nicht gelöscht; ist die Ablage unlesbar, wird der Wiederanlauf nicht bereit.

Ablauf Nr. 5–6 (Agentenaufwand, Zeiten, Kosten): siehe unten.
- **Unabhängige Claude-Gegenprüfung:** kann diese Bearbeitungssitzung nicht selbst leisten (das
  wäre Selbstabnahme) und auch nicht selbst auslösen. Sie ist ein eigener Prüfschritt im
  bestehenden Prüfweg mit eigener Rolle; Rolle, Kandidat, Ergebnis und verbleibende Befunde trägt
  erst dieser Schritt ein. Bis dahin offen. Voraussetzung: Das Briefing benennt die bestehende
  Claude-Prüfrolle `18920aa1-d192-4115-83a1-2179b270f9b1`. Sie muss im regulären Prüfweg genau
  diesen Kandidaten mit Auftrag, Briefing und Prüfberichten bewerten. Die externe Gegenprüfung der
  .909-Instanz ist keine Gegenprüfung dieses Kandidaten.
- **Agentenvergleich mit den PoC-Modellagenten (Claude, ChatGPT):** nicht ausgeführt. Der
  ausgeführte Vergleich nutzt einen deterministischen Skriptagenten. Voraussetzung des fehlenden
  Teilwegs: ein vom Betreiber beauftragter Lauf, in dem Claude und ChatGPT als Agenten dieselben drei
  fiktiven Aufgaben aus `agentenvergleich-ausgefuehrt.test.ts` an dieser Instanz bearbeiten (Baseline
  und Routineweg), samt Zugang über die sichere Betreiber-Einspeisung; Ergebnisse und tatsächliche
  Planung/Korrektur werden dann wie dort erfasst. Nach Briefing Nr. 5–6 sind zu erfassen: aktive
  Bedienzeit, Warten, Rückfragen, Korrektur, Fehlversuche; Ende-zu-Ende-Zeit, Modellanteil,
  erste/warme Anfrage, p50/p95, Fehlerquote, Kosten; Baseline ist dieselbe Aufgabe ohne Klarwerk.
  Der Skriptvergleich bleibt technischer Nachweis der Erfassung und ersetzt diesen Lauf nicht. Einen solchen Agentenlauf gibt es im vorhandenen
  Prüfweg nicht (der `model=true`-Weg prüft Produktfunktionen mit Modell, keine Agenten), und er ist
  von dieser Sitzung aus weder startbar noch belegbar.

## Offene Grenzen (PoC)

- **Tatsächliche Word-Hostbedienung: offen.** `tests/vormachen-routine/word-panel-anzeige.test.tsx`
  fährt die ausgelieferte `vormachen.js` in jsdom gegen den echten Server — das ist **keine**
  Word-Bedienung. Voraussetzung des fehlenden Teilwegs: ein Word-Host mit dem auf diese Instanz
  zeigenden, per Sideload geladenen Klara-Add-in (Peters Mac bzw. Word im Browser mit dem
  hinterlegten Konto) und ein Mensch oder Hostautomat, der darin eine Word-Lernsitzung startet, die
  Anzeige mit Pause sieht und eine Auswahl als Entwurf übernimmt. Über diesen Zugang verfügt die
  Bearbeitung nicht; nur dieser Teilweg bleibt offen. Rein lokale Word-Bearbeitungen (Tippen,
  Formatieren) erreichen den Server nicht und sind nicht wählbar.
- **Restore:** ausgeführt im bestehenden Prüfweg PV-01 (Tabelle „Prüfungen“), getrennt von der
  Persistenzprüfung; Voraussetzung ist der dort genannte PostgreSQL-Prüfstand mit `pg_dump`,
  `pg_restore`, `psql`, `createdb` — fehlen sie, überspringt der Fall und ist **kein** Beleg.
- **Betreiber-Voraussetzung für RF-17 im Betrieb:** `KLARWERK_LOESCHMARKIERUNGEN` muss auf einen
  dauerhaften Pfad **außerhalb** der Datenbank und ihrer Sicherung zeigen, etwa ein eigenes Volume.
  `docker-compose.prod.yml` und die Coolify-Konfiguration setzen ihn heute nicht; das ist ein
  Betreiberschritt und nicht Teil dieser Lieferung. Geht diese Datei mit dem Host verloren, sind auch
  die Markierungen weg, die nach der Sicherung entstanden sind.
- **Gedächtnis-Privatlöschung:** Das Interaktionsgedächtnis (Elternvertrag) hat eine eigene
  Privatlöschung; sie ist hier nicht an die Löschmarkierung angeschlossen (nicht P06-Umfang).
- **Keine Ausführung von Außenaktionen durch die Routine.** Die Freigabe ist das Tor; den
  Arbeitsweg ruft danach die Person (bzw. im Vergleich der Agent) selbst auf.
- **Kein Modell, kein Scheduler, keine zweite Figur.** Die Routine läuft nur auf Anstoß der Person.
- Echte menschliche Bedienung und Messung mit realen Anwendern sind nicht Teil der automatischen
  Prüfungen; der Agentenvergleich ist keine Humanstudie.
