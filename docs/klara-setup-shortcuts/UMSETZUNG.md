# Klara im Setup · Umsetzung AA-02 bis AA-04

Auftrag `produkt:20261012:klara-setup-shortcuts-umsetzung` (Revision 2) · Grundlage
[`BESTAND.md`](./BESTAND.md) und [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md) aus AA-01 sowie Peters
Antwort vom 12.10.2026 („es soll auch andere funktionen unterstuetzen, wie diktat, record usw.
erstma 1“). Diese Datei beschreibt den gebauten Stand; sie ist Quelleninspektion und keine Bedien-
oder Hostabnahme. `tests/klara-setup-shortcuts/umsetzung-doku.test.ts` prüft jede Fundstelle unten.

## 1. Entscheidung Option 1 (verbindlich)

- Kürzel wirken **innerhalb des aktiven Klarwerk-Fensters** (Web-App, Host H01). Die Oberfläche nennt
  genau das: „in Klarwerk, solange das Klarwerk-Fenster aktiv ist … In anderen Programmen wie Word,
  Mail oder Finder wirken sie nicht – das ist für später vorgemerkt.“
- **Systemweit** (Option B der [Entscheidungsvorlage](./ENTSCHEIDUNG-SYSTEMWEIT.md)) ist vorgemerkt,
  nicht gebaut. Die Ablage (Konto, physische Taste plus Modifikatoren) kann ein späterer nativer Host
  ohne Umbau lesen.
- **Standard:** jede Aktion ist ab Werk **unbelegt**. Control+Command+K bleibt ein ungeprüfter
  Kandidat — und ist in der Web-App ausdrücklich abgelehnt, weil die Befehlspalette jede ⌘/Strg-
  Kombination mit K abfängt.

## 2. Bereich „Klara“ im Setup (AA-02)

Zahnrad › Persönliche Einstellungen (`/profil`) › Zeile **„Klara“** (Wert: persönlicher Name). Der
bisherige Direktweg `/profil?bereich=assistenz` bleibt; `/profil?bereich=klara` führt ebenso hin.
Kein Wert zieht um, jede Gruppe schreibt über ihren bisherigen Weg mit denselben Rechten.

| Gruppe | Bestand | Weg | Recht |
| --- | --- | --- | --- |
| Name und Erscheinung | E01–E03 | `AssistenzFormular` → `PUT /api/me/assistenz` | eigenes Konto |
| Unterstützung | E05; E06 nur lesend | `KlaraModusWahl` → `PUT /api/me/assistenz/eigeninitiative`; Hinweise am Hinweis selbst | eigenes Konto |
| Fähigkeiten | E07 | `FaehigkeitenBereich` | eigenes Konto, Ausführung `ko.read` |
| Sprachausgabe | E08 | `KlaraSprachausgabe`, „gilt nur für diesen Browser“ | Gerät |
| Tastenkürzel | AA-03 | `GET/PUT /api/me/assistenz/tastenkuerzel` | eigenes Konto |
| Vorgaben der Organisation | O01, O02 | nur Hinweis; Verweis `/admin` nur für `admin` | `users.manage` |
| Klara im Browser | H02 | Hinweis: Sprache in der Seitenleiste, Kürzel in `chrome://extensions/shortcuts` | Chrome |
| Klara in Word | H03, W01–W05 | Hinweis mit Geltung je Eintrag und Zugang Word › Klara › Zahnrad | Word-Panel |

Nicht ins Setup (wie im Plan): E04 (Einrichtungsband), E09/E10 (Sitzungszustand), O03 (Betrieb).

## 3. Aktionen mit Kürzel — Inventar mit Fundstellen und Voraussetzungen

| Aktion (`aktion`) | vorhandener Weg | Fundstelle | Host | Voraussetzung |
| --- | --- | --- | --- | --- |
| Klara öffnen (`oeffnen`) | `oeffnen()` der Assistenz | `apps/web/src/components/klara-vorschau/KlaraVorschau.tsx` | Web | angemeldet |
| Seitenhilfe öffnen (`seitenhilfe`) | Fläche des ?-Knopfs | `apps/web/src/components/KlaraAssistant.tsx` | Web, Produktbetrieb | nicht in der Klara-Vorschau (dort gibt es den ?-Knopf nicht) |
| Diktieren (`diktieren`) | „Diktieren“ der Sprachleiste | `apps/web/src/components/klara-vorschau/KlaraSprache.tsx` | Web | Spracherkennung des Browsers und Mikrofonfreigabe; sonst öffnet das Kürzel nur das Gespräch mit dem vorhandenen Hinweis |
| Auftrag sprechen / Aufnahme (`auftragSprechen`) | „Auftrag sprechen“ der Sprachleiste | `apps/web/src/components/klara-vorschau/KlaraSprache.tsx` | Web | wie Diktieren; gesendet wird erst nach Prüfung der Karte |
| Aufnahme stoppen (`aufnahmeStoppen`) | „Aufnahme stoppen“ | `apps/web/src/components/klara-vorschau/KlaraSprache.tsx` | Web | eine laufende Aufnahme |
| Vorlesen stoppen (`vorlesenStoppen`) | `stoppeVorlesen()` | `apps/web/src/components/klara-vorschau/vorlesen.ts` | Web | — |

Anker im Code: `data-testid="klara-diktieren"`, `data-testid="klara-auftrag-sprechen"`,
`data-testid="klara-aufnahme-stoppen"`, `export function stoppeVorlesen`.

**Ausdrücklich nicht als Klara-Kürzel angeboten, mit Grund:**

- *Aufnahme mit Server-Verschriftlichung* (R-0104, `useSprachaufnahme`, Knopf
  `data-testid="ask-sprachaufnahme"` in `apps/web/src/components/fragen/FrageFeld.tsx` und die Aufnahme im
  Erfassungsblatt): eine Funktion des Fragefelds und der Erfassung, nicht von Klara. Ein Kürzel dafür
  wäre eine neue Anbindung an diese Seiten und keine vorhandene Klara-Aktion; sie bleibt ein Knopf.
- *Klara in Word* (A09) und *Browser-Seitenleiste* (A08, T05): eigene Hosts. Word kennt im Manifest
  keine Kürzel; die Chrome-Belegung verwaltet Chrome (`chrome://extensions/shortcuts`).
- *Senden, Übersetzen, Notiz, Fähigkeit ausführen* (A04–A07): brauchen Kontext oder eine bewusste
  Bestätigung (u. a. Chat-Auftrag: „nur durch bewusstes Senden“) und werden nicht per Kürzel ausgelöst.
- *Systemweite Auslösung*: vorgemerkt (Option 1), kein nativer Host im Hauptstand.

## 4. Ausführung und Konflikte (AA-04)

**Ein Weg.** `KlaraKuerzelAusfuehrung` (`apps/web/src/components/klara-setup/KlaraKuerzelAusfuehrung.tsx`)
steht einmal in der Klara-Ebene der Hülle und hält genau einen `keydown`-Hörer. Bei jeder Änderung
der Belegung wird der alte Hörer entfernt und ein neuer angemeldet; ohne Belegung hängt keiner. Er
meldet nur `klarwerk:klara-aktion`; Gespräch und Seitenhilfe führen ihren vorhandenen Weg aus.

**Konfliktregeln** (`apps/web/src/lib/klaraTastenkuerzel.ts`, `pruefeBelegung`), jeweils mit
konkreter Meldung; die bisherige Belegung bleibt:

| Grund | Regel |
| --- | --- |
| ohne Modifikator | keine Befehlstaste (⌘) und kein Strg — wäre normales Schreiben |
| VoiceOver/AltGr | Control zusammen mit Option/Alt (VO-Taste am Mac, AltGr unter Windows) |
| Befehlspalette | jede ⌘/Strg-Kombination mit K (`CommandPalette.tsx`) |
| Bearbeiten/Browser | ⌘ oder Strg mit nur einer Taste (Kopieren, Fett, neuer Tab …) |
| Browser | ⌘/Strg + Umschalt mit A B C D F G H I J L M N O P Q R S T V W Y Z; F4, F5, F11, F12 |
| macOS | ⌘⇧3–6 (Bildschirmfotos), ⌥⌘ mit B C D F H I J L M N P T U V W, ⌃⌘ mit D F Q |
| Doppelbelegung | dieselbe Kombination trägt schon eine andere Klara-Aktion (auch am Server: 409) |

Die Liste ist keine Garantie freier Kombinationen; Kürzel anderer Programme sind aus dem Browser
nicht erkennbar, und die Oberfläche sagt das.

**Dokumentiertes Fokusverhalten.**

- *Aufnahme:* „Festlegen/Ändern“ setzt den Fokus in das Aufnahmefeld. Die nächste Kombination mit
  ⌘/Strg wird übernommen; reine Zusatztasten warten mit Hinweis; Escape bricht ab; Tab oder ein Klick
  daneben brechen ebenso ab. Danach steht der Fokus wieder auf „Festlegen/Ändern“ derselben Zeile —
  auch nach „Entfernen“ und „Standard wiederherstellen“. Während der Aufnahme löst kein Kürzel eine
  Klara-Aktion aus, und auch die Befehlspalette reagiert nicht.
- *Textfelder und Editoren:* Schreiben löst nie etwas aus (jede Belegung braucht ⌘/Strg).
  Behandelt ein Feld oder Editor die Kombination selbst (`preventDefault`), geht er vor.
- *Dialoge:* Solange eine modale Fläche offen ist (Modalgrenze, z. B. Befehlspalette, Drawer), löst
  kein Kürzel aus.
- *Wiederholung:* Gedrückt gehalten (`repeat`) zählt nicht als neue Betätigung.
- *Klara öffnen:* öffnet das vorhandene Gespräch oder holt es nach vorn und setzt den Fokus auf
  seinen Titel; Verlauf, Eingabe und Auswahl bleiben, eine zweite Fläche entsteht nicht.
- *Diktieren/Auftrag sprechen:* öffnen zuerst das Gespräch (sichtbarer Stopp) und starten dann den
  vorhandenen Weg; läuft schon eine Aufnahme, startet keine zweite.

**Darstellung.** Mac: ⌃ ⌥ ⇧ ⌘ in Apple-Reihenfolge, sonst „Strg+Umschalt+E“ bzw. „Ctrl+Shift+E“; die
ausgeschriebene Form („Control Umschalt Befehl Y“) steht für Screenreader und als Tooltip daneben.
Erkannt wird die physische Taste (`KeyboardEvent.code`), beschriftet die gedrückte (auf deutschem
Layout „Y“ für `KeyZ`).

## 5. Ablage

`assistenz_profile.data.tastenkuerzel` (vorhandene Tabelle, keine neue): `{ belegungen, geaendertAm }`
— fehlt eine Aktion, gilt der Standard; `null` heisst „entfernt“. Eigener Schreibweg
`schreibeTastenkuerzel` mit Inhaltsvergleich; Profilschreiben übernimmt den gespeicherten Stand, ein
Kürzelwechsel ändert die Profilfassung nicht. Konto ausschliesslich aus der Sitzung, fremde Kennung
403. Ins Prüfprotokoll geht nur das Ereignis `assistenz.tastenkuerzel.geaendert`.

**Konsistenz im Browser** (`lib/klaraTastenkuerzel.ts`, Nacharbeit 3): Gleichzeitige Ladevorgänge
desselben Kontos (Setup und Ausführungsweg) teilen sich eine Anfrage; jede Schreiboperation erhöht
eine Schreibmarke, und eine Ladeantwort, die vor oder während des Schreibens angefordert wurde, wird
verworfen. Ist der Schreibausgang unklar (Antwort verloren, Serverfehler 5xx), liest der Speicher den
Serverstand nach: bis dahin heisst der Ausgang „unklar“; zeigt der Server die Änderung, gilt sie als
gespeichert („Bestätigt durch Abgleich“), sonst „Nicht gespeichert“. Scheitert auch der Abgleich,
bleibt der Ausgang „unbekannt“ sichtbar, angezeigt und wirksam ist der zuletzt bestätigte Stand, und
„Erneut abgleichen“ klärt ihn. Eine eindeutige Ablehnung (4xx) braucht keinen Abgleich.

## 6. Grenzen

- Gemessen sind Regeln, Server und Bedienung in jsdom am echten Server sowie PostgreSQL; **nicht**
  gemessen sind echte Browser-Tastatur, Fokusbild, Mikrofon, VoiceOver und deutsche/englische
  Hardware-Layouts am Mac — das ist Host- und Bedienabnahme (AA-05) und bleibt offen.
- Ein Chromium-Smoke unter `tests-smoke/` wurde nicht ergänzt: der Ordner und die Smoke-Konfiguration
  liegen außerhalb der für diesen Auftrag erlaubten Pfade.
- Laufende Kandidaten C01–C06 (BESTAND 6) wurden nicht verändert; C02/C03 berühren dieselben Dateien
  und müssen bei ihrer Integration gegen diesen Stand abgeglichen werden.
