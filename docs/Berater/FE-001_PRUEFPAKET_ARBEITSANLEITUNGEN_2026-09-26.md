# FE-001 · Prüfpaket „Arbeitsanleitungen“ für die Verständlichkeitsprobe

**Status: noch nicht menschlich abgenommen.** Dieses Paket bereitet die verpflichtende
Nutzerabnahme von FE-001 durch Frontend-Berater und Pedi (bzw. eine neue Person) vor. Ein grüner
technischer Lauf oder eine Ben-Prüfung ersetzt sie nicht. Das Ergebnis der Probe wird unten
eingetragen – erst danach gilt FE-001 als nutzerseitig abgenommen, offen oder nacharbeitsbedürftig.

## 1 · Was geliefert wurde (Kurzfassung)

- Übersicht `/gesamtanweisungen`, nutzerseitig **„Arbeitsanleitungen“** (Menü, Überschrift, Hilfe):
  Zweck-Satz, drei Antworten (Was bringe ich mit? / Was erhalte ich? / Wie fange ich an?), ein als
  Beispiel gekennzeichnetes Beispiel, Liste mit anklickbarem Titel, Status, Abschnittszahl, Name aus
  dem Verzeichnis und lesbarem Datum, Hauptaktion „Neue Arbeitsanleitung erstellen“ mit Sperrgrund.
- Detail `/gesamtanweisungen/:id`: Schrittfolge, „Worum geht es?“ (Titel, Zweck, Geltungsbereich,
  Voraussetzungen speichern), „Abschnitt aus vorhandenem Wissen hinzufügen“ (Suche nach Titel/Begriff
  → Treffer → Vorschau → bewusste Wahl einer gespeicherten Fassung → aufnehmen; keine Kennungen),
  Lesefassung als Dokument mit Herkunft/Fassung je Abschnitt und Reihenfolge-Knöpfen, „Zur
  Entscheidung vorlegen“ mit Erklärung (wer entscheidet, was nicht angebunden ist), „Was hat sich
  geändert?“ mit Hinweis statt „Lädt …“, solange es keine zwei Stände gibt.
- Statische Seitenhilfe (Zahnrad → Seitenhilfe) für Übersicht und Detail, ohne KI.
- Technische Adressen und Verträge (`/gesamtanweisungen`, `/api/gesamtanweisungen…`) unverändert.

## 2 · Testbestand und Zugang (isoliert, keine Live-Daten)

Empfohlen: eine frische lokale Instanz mit In-Memory-Datenhaltung – sie teilt nichts mit
klarwerk.ai und ist nach dem Beenden weg.

```bash
# im Repository-Stand des Kandidaten
tools/build
PORT=3187 KLARWERK_SKIP_KEYCHAIN=1 EXTERNAL_SEARCH=off ANTHROPIC_API_KEY= DATABASE_URL= npm start
# Die Ersteinrichtung (Admin-Konto) übernimmt der nächste Befehl.
```

Vorhandenes Wissen anlegen – drei Beispieleinträge **mit lesbarem Dokumenttext**, damit die
Lesefassung später zusammenhängenden Text zeigt (derselbe Bestand wie für die Bildbelege):

```bash
node scripts/fe001/arbeitsanleitungen-belege.mjs http://127.0.0.1:3187 - --nur-bestand
# richtet die frische Instanz ein und legt an:
#   „Arbeitsplatz im Homeoffice einrichten“, „Sicher anmelden mit Zwei-Faktor“,
#   „Hilfe bei IT-Problemen holen“ (je Aussage + Dokumenttext mit Überschriften)
# Anmeldung danach: pia@fe001.test / fe001-Passwort-1 (nur diese Wegwerf-Instanz)
```

Für die Probe mit einer neuen Person: diese Einträge vorher anlegen, dann nur den Link
`http://127.0.0.1:3187/gesamtanweisungen` geben – **ohne** weitere Erklärung.

## 3 · Die vier Fragen (aus dem Originalticket)

Die Person sieht nur die Seite und beantwortet in eigenen Worten:

| Frage | Antwort der Person | verstanden? (ja/teilweise/nein) |
|---|---|---|
| Wofür ist die Seite da? | | |
| Was bringe ich mit? | | |
| Was erhalte ich? | | |
| Was ist mein erster Schritt? | | |
| Was bedeutet der Status dieser Anleitung, und was ist mein nächster Schritt? (Ergänzung 3) | | |

**Statusfrage (Ergänzung 3) – menschliche Bedienprobe.** Sie gehört zum Folgeauftrag
`aufnahme:20260922:gesamt-pruefstatus-anzeige:menschliche-bedienprobe` und wird nach der technischen
Lieferung von Pedi oder einer von Pedi benannten Person geleitet. Ein Testlauf, Ben oder Codex ersetzt
sie nicht. Damit die Person einen Status sieht, ohne vorher durch den Beispielablauf geführt zu werden:

1. Die Prüfleitung legt in der Wegwerf-Instanz eine vorgelegte Anleitung an – entweder mit dem
   vollständigen Belegablauf `node scripts/fe001/arbeitsanleitungen-belege.mjs http://127.0.0.1:3187`
   (endet mit „Start im Homeoffice“ im Stand „Vorgelegt“) oder von Hand nach Abschnitt 4.
2. Die Testperson hat das Erstellen **nicht** gesehen und bekommt keine Erklärung zu Status, Rollen
   oder Freigabe. Sie öffnet die Übersicht `/gesamtanweisungen` und danach die Anleitung.
3. Frage wörtlich: „Was bedeutet der Status dieser Anleitung, und was ist dein nächster Schritt?“
   Die Antwort wird möglichst wörtlich notiert, ohne Nachhelfen.
4. Verstanden heißt: Die Person sagt sinngemäß, dass die Anleitung zur Entscheidung vorliegt und
   **noch nicht freigegeben** ist, und nennt einen zu ihrem Konto passenden nächsten Schritt (z. B.
   auf die Entscheidung warten bzw. entscheiden, wenn sie es darf). Verwechselt sie „Vorgelegt“ mit
   „Freigegeben“ oder eine automatische Prüfung mit einer menschlichen Freigabe, gilt die Frage als
   **nicht verstanden**.

Bis das Ergebnis in Abschnitt 7 eingetragen ist, bleibt dieses Kriterium **offen**; es blockiert keine
technische Abnahme (Pedi-Entscheidung 03.10.2026).

## 4 · Beispielablauf (zum Mitgehen, gern nur mit Tastatur)

1. Titel „Start im Homeoffice“ eingeben → „Neue Arbeitsanleitung erstellen“.
2. Unter „Worum geht es?“ Zweck, Geltungsbereich, Voraussetzungen eintragen → „Angaben speichern“.
3. „Vorhandenes Wissen suchen“: „Homeoffice“ → Treffer wählen → Fassung wählen → Vorschau lesen →
   „Fassung 1 als Abschnitt aufnehmen“. Ebenso „anmelden“ und „IT-Problemen“.
4. In der Lesefassung einen Abschnitt „Nach oben“ verschieben.
5. Seite neu laden – alles ist noch da.
6. „Was hat sich geändert?“ → „Letzte Änderung zeigen“.
7. „Vorlegen“ – Status wird „Vorgelegt“; die Erklärung nennt, wer entscheidet.

Beobachtungsfragen: Wo zögert die Person? Welches Wort versteht sie nicht? Findet sie die
Fassungswahl und versteht, warum eine Fassung festgelegt wird?

## 5 · Technische Belege dieser Lieferung (Kandidat, nicht ausgelieferter Stand)

Aufgenommen mit `node scripts/fe001/arbeitsanleitungen-belege.mjs <url> <ordner>` gegen eine
frische lokale In-Memory-Instanz, gebaut mit `tools/build` aus dem Kandidaten-Commit. Chromium
(headless), Viewports 1280, 1024 und 360 px. Ablage: Laufordner des Bauauftrags,
`kontext-bau/fe001-belege/`.

- `MANIFEST.json` bindet jedes Bild (SHA-256) an **Commit**, sauberen Arbeitsbaum, die Skripte des
  gebauten `apps/web/dist/index.html` samt dessen SHA-256 und die Version aus `/health`.
- `protokoll.txt` nennt Schritte, URLs, Viewports und Ergebnisse (u. a. Reload-Nachweis).
- Bilder: `01-einstieg-leer-*`, `02-detail-neu-*` (Hinweis statt „Lädt …“),
  `03-auswahl-fassung-vorschau-*`, `03b-suche-ohne-treffer-1280`,
  `03c-fassungen-403-mit-cache-1280`, `03d-fassungen-403-nach-reload-*` (siehe unten), `04-lesestand-gefuellt-*`
  (Herkunft, Fassung, Aktualisierungsvorschlag), `05-vergleich-1280`, `06-vorgelegt-1280`,
  `07-seitenhilfe-detail-1280`, `08-uebersicht-mit-bestand-*`, `09-fokus-sichtbar-1280`.

**Zugriffsabsage beim Fassungsabruf (E4, Nachtrag 27.09.2026).** Nach der Cache-403-Gegenprobe
des Beraters zeigt die Auswahl eine HTTP-403/404-Antwort auf den Fassungsabruf immer als fehlenden
Zugriff – auch wenn die Fassungen vorher schon geladen waren: keine Fassungswahl, keine Vorschau,
„Als Abschnitt aufnehmen“ gesperrt mit genanntem Grund, Trefferkarte ohne „wähle unten die
Fassung“. Eine vorher getroffene Wahl verfällt; erst ein erfolgreicher neuer Abruf („Erneut
laden“) und eine neue bewusste Wahl geben die Aufnahme frei. Die Bilder `03c`/`03d` entstehen mit
einer **browserseitigen Simulation** (Playwright `page.route`, nur `GET /api/kos/<Eintrag>/versions`
→ 403); am Server wird dabei kein Recht entzogen und nichts geschrieben. Ein echter Rechtewechsel
ist damit nicht belegt.

**Nachtrag 28.09.2026 (Ben-Befund Lauf 2).** Die Absage gilt je Eintrag, bis danach ein Abruf
der Fassungen **gelingt**. Scheitert die Wiederholung anders (z. B. HTTP 500), bleiben Hinweis und
Sperre stehen; die gemerkten Fassungen werden nicht wieder wählbar. Geprüft in
`tests/fe001-arbeitsanleitungen/fassungen-zugang-403.test.tsx` (Fall „403 → gescheiterte
Wiederholung (500)“). Allgemeine Regeln für 500 oder Offline legt das nicht fest. Die Absage wird
neben den gemerkten Fassungen im Zwischenspeicher der Seite gehalten und gilt daher auch, wenn die
Auswahl ohne Reload neu geöffnet wird (Fälle „erneutes Öffnen mit erhaltenem Cache“).

**Pflichtbilder im Prüfweg (Nachtrag Lauf 3, Runde 3).** Die Datei
`tests/fe001-arbeitsanleitungen/bilder-im-browser.integration.test.ts` nimmt die drei Pflichtansichten
(Einstieg, Inhalts-/Fassungsauswahl, gefüllter Lesestand) je 1280, 1024 und 360 px auf. Sie ruft dafür
die exportierten Schritte aus `scripts/fe001/arbeitsanleitungen-belege.mjs` auf und fährt einen echten
`server.ts`-Prozess gegen eine Wegwerf-Datenbank aus `KLARWERK_PG_TEST_URL`. Dabei geht sie den
Beispielablauf (E5): benennen, Kopf, drei Inhalte über ihren Titel, Reihenfolge, Reload, Lesestand,
Vorlegen, Reload. Das Gespeicherte prüft sie zusätzlich in der Datenbank. Ablage:
`.local/run/fe001-bilder-im-browser/` (oder `KLARWERK_FE001_BILDER`) mit `MANIFEST.json` (Commit aus
`git HEAD`, URL, Browser/Version, Viewport, Zeitpunkt, SHA-256 je PNG); das Manifest steht zusätzlich
in der Testausgabe. Jede Datei wird auf Vorhandensein, Größe > 0 und Maße = Viewport geprüft. Ohne
`KLARWERK_PG_TEST_URL` oder Chromium **scheitert** der Fall mit Grund; übersprungen wird nichts.

Pflichtdateien für den gezielten Serverlauf (E3–E7, E9):
`tests/fe001-arbeitsanleitungen/bilder-im-browser.integration.test.ts`,
`tests/gesamtanweisung-nutzerweg/menueweg-tastatur-sprachen-prozess.integration.test.ts`,
`tests/gesamtanweisung-nutzerweg/liste-nach-prozesswechsel.integration.test.ts`,
`tests/gesamtanweisung-tastaturweg/tastaturweg-im-echten-browser.test.ts`,
`tests/wiki-gesamtanweisung-abnahme/a5-neustart.integration.test.ts`,
`tests/wiki-gesamtanweisung-abnahme/a8-menue-und-migration.integration.test.ts`,
`tests/wiki-gesamtanweisung-fassungsbindung/postgres-fassungsbindung.integration.test.ts`,
`tests/wiki-gesamtanweisung/postgres-atomar.integration.test.ts`,
dazu die Komponentenfälle `tests/fe001-arbeitsanleitungen/*.test.tsx`.

**Bindung der Bilder.** Die vorhandenen Bilder stammen aus Lauf 2 (Kandidat `1b63069c`, Ablage
`laufbelege/…_2/bau/fe001-belege/`). Für den aktuellen Kandidaten sind sie nur ein visueller
Teilbeleg. Sie müssen mit `scripts/fe001/arbeitsanleitungen-belege.mjs` am genau geprüften Commit
neu aufgenommen werden; auf dem Produktions-Mac werden dafür keine Dienste gestartet.

**Nachtrag Lauf 4 (28.09.2026).** Der Stand aus Lauf 3 (`3dd28c25`) wurde nicht ausgeliefert. Lauf 4
überträgt ihn unverändert in der Sache auf die aktuelle Basis `41fad46c` (mit FE-003); angepasst
sind nur die gemessenen Zählwerte der beiden Sammler-Tests (`mega47`, `mega84`). Bilder und
Serverfälle gelten erst für den neuen Lauf-4-Commit, wenn sie dort erneut aufgenommen bzw.
ausgeführt sind.

**Nachtrag Lauf 4, Runde 2 (Ben-Befunde BEN-01/BEN-02).** Scheitert das Nachladen der Stände,
obwohl eine ältere Liste vorliegt, steht der Fehler mit „Erneut laden“ neben der alten Liste (E7).
Eine geänderte, noch nicht übernommene Abschnittsvoraussetzung ist am Feld gekennzeichnet und sperrt
„Vorlegen“ mit sichtbarem Grund (E8). Geprüft in
`tests/fe001-arbeitsanleitungen/staende-und-voraussetzung-ungespeichert.test.tsx` samt Gegenproben.

**Nachtrag Lauf 5 (29.09.2026, Ben-Befund BEN-04).** Lauf 4 (`f4ea9ff4`) wurde nicht ausgeliefert;
Lauf 5 überträgt ihn unverändert in der Sache auf die Basis `1530dfeb` (mit der Restprüfung A7).
Die Einstiegsbilder aus Lauf 4 zeigten die Aktion „Neue Arbeitsanleitung erstellen“ vom
Nutzungshinweis verdeckt: der Hinweis erscheint erst, wenn seine Serverauskunft angekommen ist, und
der Belegablauf hatte nur einmal nach ihm gesehen. Jetzt fragt der Belegablauf den Server
(`/api/features`, `/api/auth/notice`), ob der Hinweis fällig ist, wartet dann auf ihn und bestätigt
ihn regulär mit „Verstanden — weiter“ (keine Veränderung über das DOM). Vor jedem Pflichtbild wird
geprüft, dass kein Hinweis sichtbar ist und die Hauptaktion der Ansicht sichtbar und nicht überdeckt
ist; sonst entsteht kein Bild und der Lauf scheitert. Der Bildtest hält die Serverantwort zum
Hinweis absichtlich 4 s zurück und prüft damit genau diesen späten Fall.

**Nachtrag Lauf 5, Runde 2 (BEN-04/BEN-05).** Die Nachprüfung des Hinweisvermerks läuft jetzt aus
der angemeldeten Seite und verlangt HTTP 200 samt Antwortstruktur (`due`, `currentVersion`), bevor
`due === false` gilt; die frühere Abfrage über den Browserkontext trug keine Sitzung. Der gemeinsame
Sichtbarkeitsprüfer (`tests/gesamtanweisung-nutzerweg/weg.ts`, `SICHT_HILFEN`) wertet eine
Schriftfarbe nur noch bei Alpha 0 als durchsichtig; die deckende Hinweisfarbe `rgb(138, 90, 0)`
galt vorher fälschlich als unsichtbar. Abgesichert in
`tests/gesamtanweisung-nutzerweg/sicht-hilfen-farbe.test.ts`.

Diese Bilder belegen den Kandidaten in einer Testumgebung, nicht den auf klarwerk.ai ausgelieferten
Stand; ausgeliefert ist er erst nach Ben-Prüfung, grünem Tor und Ship.

**Nachtrag Prüfstatus-Anzeige (Pedi 28.09.2026, Ergänzung 3).** Übersicht und Detailansicht zeigen
jetzt denselben Statusblock (`FreigabeStatus`, abgeleitet in `zustand.ts` → `freigabeanzeige`):
Standwort, „Stand N“, Bedeutung, Prüfangaben und „Nächster Schritt“ nach den Rechten des Betrachters.
Der angenommene Stand heißt sichtbar „Freigegeben“ (bisher „Entschieden“); „Vorgelegt“ sagt
ausdrücklich „noch nicht freigegeben“. Bei einer Freigabe stehen Stand und Zeitpunkt da; **wer**
freigegeben oder abgelehnt hat, speichert der Server bisher nicht – das steht so auf der Seite. Eine
zweite Person wird nicht vorausgesetzt (es gibt keine solche Kontoregel). Geprüft in
`tests/fe001-arbeitsanleitungen/pruefstatus-uebersicht-und-detail.test.tsx`. Zusatzfrage für die
Probe unten: „Was bedeutet der Status dieser Anleitung, und was ist dein nächster Schritt?“
Runde 2 (Ben-Befund BEN-01): Wer kein Erfassungsrecht hat (Rolle Viewer), bekommt keinen
Vorlegen-Knopf mehr, und Ändern ist mit sichtbarem Grund gesperrt – passend zur Serverregel
`ko.create`. Der Abgleich der älteren Kriterien des Auftrags steht in
`docs/Berater/PRUEFSTATUS_ANZEIGE_BESTANDSABGLEICH_2026-10-03.md`.

## 6 · Bekannte Grenzen

- Eine automatische fachliche Prüfung ist nicht angebunden (wird so angezeigt).
- Beim Vorlegen wird niemand benachrichtigt (wird so angezeigt).
- Wer freigegeben oder abgelehnt hat, wird nicht gespeichert; ebenso der Zeitpunkt einer Ablehnung
  (wird so angezeigt). Das festzuhalten wäre eine Server- und Datenbankänderung.
- Der optionale „Inhaltsnachweis“ bleibt ein Feld für Fachleute. Ohne ihn steht am Abschnitt
  „Zu dieser Fassung liegt kein Nachweis vor.“, und der Vergleich stützt sich auf die erfassten
  Inhaltsmerkmale statt auf einen gleichen Nachweis. Ob dieser Satz für neue Nutzer störend wirkt,
  ist Teil der Probe.

## 7 · Ergebnis der Probe (vom Frontend-Berater auszufüllen)

- Datum / Person(en): …
- Ergebnis: erfüllt / offen / Nacharbeit
- Befunde: …
- Statusfrage (Ergänzung 3): Probe geleitet von (Pedi / benannte Person): … · Testperson
  unvorbereitet (ja/nein): … · Rolle des Testkontos: … · gezeigter Stand: … · Antwort wörtlich: … ·
  verstanden (ja/teilweise/nein): … — **Stand: noch nicht durchgeführt.**
