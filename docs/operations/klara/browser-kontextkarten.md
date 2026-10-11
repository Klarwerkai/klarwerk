# Klara im Browser · Kontextkarten (R-1048) und BPA-01

Auftrag `aufnahme:20260922:gesamt-browser-kontextkarten`, Revision 2 (BPA-Gesamtpaket r2,
11.10.2026). Stand dieses Dokuments: 11.10.2026, Produktstand `1.0.0-beta.1.921` (Commit
`90b06abd3`) plus die hier beschriebene Ergänzung. Dieses Dokument trifft keine Entscheidung; es
hält fest, was entschieden ist, was offen ist und was tatsächlich geliefert und belegt ist.

## 1 · Offene Geltungs- und Umfangsfrage

**Die Frage.** Gehört „passendes geprüftes Wissen beim Arbeiten in CRM oder Ticketsystem im
Browser anzeigen" (R-1048, das Kartenprinzip aus Word im Browser) zum bestellten Umfang?

**Jüngste Belege, älteste zuerst:**

| Datum      | Quelle                                                                 | Aussage |
|------------|------------------------------------------------------------------------|---------|
| v1 (o. D.) | Altbestand F-1048, Notiz                                               | „v1 führte die Erweiterung noch als Welle 3." |
| 29.08.2026 | `EXT-FUNKTIONSLANDKARTE-20260829.md`, Landkarte v3 Zeile G7            | Status `VERWORFEN`: „Codex: streichen. Marktbeleg Guru Browser-Trigger und Glean Sidebar sprechen dafür, wurden aber verworfen." Kein `pedi_override`. |
| 05.09.2026 | `REGISTER-SNAPSHOT.json` R-1048                                        | `zustand: angedacht`, `pruefstatus: nur_altquelle`, Einordnung offen. |
| 22.09.2026 | Gesamtaufnahme, Gruppe `browser-kontextkarten`                         | R-1048 als Klärungspunkt diesem Auftrag zugeordnet (`state: klaerung`). |
| 11.10.2026 | BPA-Gesamtpaket r2, BPA-01, Peters ausdrücklicher Auftrag (G22)        | **Bestellt:** aktuelle Browserseite und Markierung sicher mit der Assistenz verbinden („Erkläre mir diese Angaben"), Chrome auf diesem Mac zuerst, AC01–AC10. |

**Alternativen, die zur Entscheidung stehen:**

- **A · Streichung bleibt.** R-1048 bleibt verworfen; geliefert wird nur BPA-01 (Seite und
  Markierung bewusst verbinden). Keine selbsttätigen Wissensvorschläge im Browser.
- **B · R-1048 als späterer Ausbau auf BPA-01.** Auf der gebundenen Kontextkarte schlägt Klara in
  ausdrücklich freigegebenen Bereichen (Bereichsfreigabe je Domain, z. B. CRM/Ticketsystem)
  passendes **geprüftes** Wissen vor. Setzt O07 (Sollset und Güteschwellen vor jeder
  produktiven Erkennung) und eine Entscheidung zu Beobachtungsmodus und Datenschutz (G09) voraus.
- **C · R-1048 sofort mit BPA-01 zusammen.** Nicht durch die Quellen gedeckt: BPA-01 bestellt
  Verbinden und Erklären, keine selbsttätige Wissensanzeige.

**Noch erforderliche Entscheidung:** A oder B, durch die Führung/Produktverantwortung (O06/O07).
Bis dahin gilt die Streichung vom 29.08. für die selbsttätige Wissensanzeige weiter; die alte
Pedi-Auswahl bzw. deren Fehlen bleibt als historische Entscheidung erhalten.

**Eindeutig bestellter Anteil, der als Umsetzung behandelt wird:** nur BPA-01 (AC01–AC10).

## 2 · Klärung R-1048

- Der damalige Zustand „Welle 3" (v1) und „verworfen" (29.08.) sind historische Aussagen, kein
  Funktionsnachweis und kein heutiger Erfüllungsstand.
- Heute vorhanden ist die Chrome-Seitenleiste zur **Übernahme** markierter Inhalte als
  ungeprüfter Entwurf (s. 3). Sie zeigt **kein** passendes geprüftes Wissen an. R-1048 im
  Wortsinn ist damit **nicht erfüllt** und wird mit diesem Auftrag auch nicht gebaut.
- BPA-01 liefert die Voraussetzung, auf der Alternative B aufsetzen könnte: eine an Mandant,
  Nutzer, Sitzung, Tab, Seite und Fassung gebundene Kontextkarte.

## 3 · Tatsächlich geliefert — mit Fassung und Beleg

**Bestand vor diesem Auftrag** (unverändert, eigene abgeschlossene Aufträge — hier nur abgegrenzt):

| Umfang | Fassung / Commit | Beleg |
|--------|------------------|-------|
| B0 Vorführung: Auswahl → Vorschau → ungeprüfter Entwurf | `ed36fa96f` (07.09.2026) | `tests/klara-browser/package.test.ts` |
| CHR-01/02/03 Seitenleiste, Gestaltung, Markierung | `7530c770b` (08.09.2026) | `tests/klara-browser/seitenleiste.test.ts`, `panel.test.tsx` |
| CHR-04/05/08 Artikel/Seite, Lücken, Herkunft bei Tabwechsel | `a7a168d7e` (08.09.2026) | `tests/klara-browser/artikel.test.tsx` |
| CHR-06/07 Zwischenablage, „In Klarwerk öffnen" | `041218b30` (09.09.2026) | `tests/klara-browser/zwischenablage.test.ts`, `wiederoeffnen.test.tsx` |
| Erkennung der aktuellen Seite, Speichern oder Grund | `e7cc46316` (11.09.2026) | Commit-Tests in `tests/klara-browser/` |
| Erweiterung im Manifest | Version `0.4.1`, Chrome ≥ 120 | `extensions/klara-browser/manifest.json` |

**Neu mit diesem Auftrag (BPA-01) — Nacharbeit 1 nach Bens Befunden:**

- `extensions/klara-browser/kontext.js` — der reine Vertrag (kein Chrome-, Netz- oder
  Speicherzugriff): gebundene Kontextkarte (URL, Titel, Auswahl, Tabellenstruktur genau der
  Markierung, Erfassungszeit, Fassung, Browser/Version, Erweiterungsversion, Konto), Kontextfolge,
  Freigaben, Sperrgründe mit nächstem Schritt (Deutsch/Englisch), Fähigkeitsausweis,
  Antwortprüfung, Abgleich, Widerruf, Kontozuordnung.
  - **Freigabe und Auswahl getrennt** (Befund 2): die einmalige Freigabe folgt Chromes
    `activeTab` — sie bleibt bei Navigation innerhalb derselben Herkunft und endet bei
    Herkunftswechsel oder Schliessen des Tabs. Die Auswahl (Karte) endet unabhängig davon bei
    jedem Dokumentwechsel.
  - **Fassung über die übermittelte Auswahl** (Befund 3): Text UND Tabellenstruktur. Eine andere
    Zell-/Zeilenzuordnung bei gleichem Text ist eine neue Fassung und verlangt Neumarkieren.
- **Verdrahtet** (Befund 1):
  - `worker.js` lädt den Vertrag per `importScripts`. Die Klickgeste (Symbol/Kontextmenü) erteilt
    die einmalige Freigabe und bindet die Karte. Im privaten Fenster wird die Seite gar nicht
    gelesen. Tabwechsel, Navigation, neues Dokument und Schliessen wirken auf Freigabe und
    Karte. Erfassung und Neulesen nutzen denselben einen Skripteinsatz (`selection.js`).
  - „Mit Klara verbinden" liest die Seite frisch, gleicht die Fassung ab und bindet den Kontext
    an eine Sitzung des **vorhandenen** Klara-Kerns: `POST /api/klara/sessions` bzw.
    `…/document-context`, angemeldet wie jeder andere Abruf der Erweiterung; Dokumentmerkmal ist
    die Seitenadresse, die der Server in eine opake Kontextkennung umrechnet. Die Markierung
    selbst geht dabei nicht an den Server. Eine verspätete Bestätigung wird nur gebunden, wenn
    sie noch zu derselben Karte gehört.
  - „Verbindung widerrufen" verwirft die Karte, sperrt neue Übermittlung, schliesst die
    Kernsitzung (`…/close`) und führt einen bereits gespeicherten Entwurf mit Herkunft als
    widerrufen — gelöscht wird nichts.
  - `panel.html`/`panel.js` zeigen die Kontextkarte (Browser, Seite, Markierung, Zeit, Tabelle,
    nicht Gelesenes, verbunden/veraltet) sowie Sperrgrund und nächsten Schritt.
- Tests: `tests/klara-browser/kontext.test.ts` (Vertrag, AC01 mit echtem `selection.js` auf dem
  synthetischen Datenblatt BPA-S01) und `tests/klara-browser/kontext-weg.test.ts` (echter Worker,
  echte Leiste, echtes Fastify mit dem Klara-Sitzungsweg).

**Stand je Kriterium:**

| Kriterium | Stand |
|-----------|-------|
| AC01 Tabellenbereich, URL, Fassung; Assistenzfenster zählt nicht | Vertrag + Browserweg im Prüfstand (Worker, Leiste, Kern) |
| AC02 Zwei Tabs, verspätete Antwort | Vertrag + Browserweg: späte Kernbestätigung nach Tabwechsel wird nicht gebunden |
| AC03 Konto-/Mandantenwechsel | Vertrag + Browserweg (abgelaufene Anmeldung, anderes Konto) |
| AC04 Einmalige Freigabe vs. Bereichsfreigabe | Vertrag + Browserweg; Chromes Regel ist nachgebildet, nicht im echten Chrome gemessen. Eine Bereichsfreigabe einzurichten bietet die Leiste noch nicht an — ohne sie gibt es keine Beobachtung |
| AC05 Domain, privates Fenster, Frame, interne Seiten | Vertrag + Browserweg inkl. sichtbarem Grund/nächstem Schritt in der Leiste |
| AC06 DOM-Tabelle / laufende Seite / PDF getrennt ausgewiesen | Tabelle unterstützt, laufende Seite nur Momentaufnahme, PDF **nicht geliefert** |
| AC07 Systemauftrag im Seitentext | Vertrag + Browserweg (kein weiterer Abruf, keine Aktion) |
| AC08 Widerruf | Vertrag + Browserweg (Kernsitzung geschlossen, Entwurf bleibt; Stopp auch während Verbinden und nach Tabwechsel) |
| AC09 Quelländerung | Vertrag + Browserweg (Text und Tabellenstruktur) |
| AC10 Reale Erweiterung mit installiertem Begleiter auf diesem Mac | **offen** — siehe 4 |

## 4 · Grenzen, Widersprüche, fehlende Belege

- **Prüfstand, kein Host.** Chrome selbst (Tabs, Skripteinsatz, Sitzungsspeicher) ist in den Tests
  gestellt; Worker, Leiste, Vertrag und Server laufen echt. Das ist Agentenprüfung, kein
  Hostnachweis (G13).
- **Begleiter (AC10) — Zuordnung, Nacharbeit 6.** Die frühere Aussage „auch kein Zweig dafür“
  war falsch und ist hiermit berichtigt. Im gemeinsamen Repository liegen zwei
  Begleiter-Kandidaten, beide auf **fremden, nicht in `main` integrierten Auftragszweigen**:

  | Kandidat | Zweig / Stand | Was er ist | Browseranschluss |
  |---|---|---|---|
  | BPA-04 „In anderen Programmen lesen und helfen" | `codex/auftrag-b4b52732c85570289b3d`, zuletzt `2f07b72b5` (1.0.0-beta.1.926, 11.10.2026); Begleiter seit `0babc7fd6` | Swift-Paket `apps/desktop/klara-begleiter` (macOS 13): Anmeldung über `office-handover/redeem`, Finder-Aufnahme, Markierung per Bedienungshilfe (nur Word), Frage über `/api/ask` | **keiner** — keine Native-Messaging-Schnittstelle, kein Kanal zur Erweiterung. Laut eigenem README nicht auf einem Mac übersetzt oder ausgeführt. |
  | „Bewegliches Maskottchen auf Peters Mac" (`klara-office-mac-maskottchen`) | `codex/auftrag-153f1494a069ace21aa7`, Begleiter seit `60f24bc22` (10.10.2026) | Swift-Fenster (Figur, Lage, Steuerung) unter demselben Pfad | **keiner** |

  Beide Kandidaten belegen denselben Pfad mit unterschiedlichem Aufbau. Welcher der gemeinsame
  Begleiter ist, entscheidet die zuständige Hostentwicklung bzw. Führung (O06). Diese Entscheidung
  wird hier nicht getroffen.

- **Browseranschluss an den Begleiter (Nacharbeit 7) — gebaut.** Kanal ist Chrome Native Messaging.
  - **Begleiterseite:** die Browserbrücke `apps/desktop/klara-begleiter/BrowserBruecke`, ein eigenes
    Swift-Ziel neben beiden Kandidaten, ohne Dateikollision. Dazu gehören das Host-Manifest
    `ai.klarwerk.klara_begleiter` und `installieren.sh`. Sie hat keinen offenen Port, prüft die
    Herkunft gegen die eingerichtete Erweiterungskennung, weist sich mit dem Einmalwert aus und
    meldet ihre Fassung und die macOS-Fassung. Sie nimmt nur die Karte des Nutzers aus `hallo` an
    und legt sie mit 0600 ab; beim Widerruf und beim Trennen verwirft sie die Karte.
  - **Erweiterungsseite:**
    - `nativeMessaging` ist ein **optionales** Recht, angefragt auf Klick „Mit Begleiter
      verbinden“ über dieselbe eine Anfragestelle wie die Zwischenablage.
    - Der Worker baut die Verbindung auf, prüft die Antwort und übergibt die gebundene Karte mit
      Quittung über Folge und Fassung.
    - Die Leiste zeigt Begleiter- und macOS-Fassung und ob die Karte übergeben ist.
    - Widerruf, Abmelden und Kontowechsel melden `widerrufen` und trennen.
  - **Geprüft** ist das im Prüfstand mit einer Host-Attrappe, die das Protokoll der Brücke spricht
    (`tests/klara-browser/kontext-weg.test.ts`, AC10).
  - **Bindung der nativen Karte (Nacharbeit 8):**
    - Vor der Übertragung an den Begleiter läuft derselbe frische Quellenabgleich (Text und
      Tabellenstruktur) samt Vorgangsprüfung wie bei Verbinden und Erklären. Eine geänderte Seite
      wird veraltet vermerkt und nicht übertragen.
    - Wird die Karte in der Erweiterung ungültig (Tabwechsel, Navigation, neue Erfassung,
      Quelländerung), schickt der Worker `verwerfen`, und die Brücke löscht die Karte sofort. Der
      Kanal bleibt dabei offen.
    - Ein noch wartender Verbindungsaufbau ist von Anfang an registriert. Widerruf und Abmelden
      schließen ihn. Eine Generation verhindert, dass ein verspätetes `hallo` oder eine verspätete
      Quittung noch einen Port oder einen Zustand setzt.

  **Was für AC10 noch fehlt, mit konkreten Voraussetzungen:**
  1. **Übersetzen und Einrichten auf diesem Mac** (`./installieren.sh <Kennung>`: `swift build`,
     Dateien unter `~/Library/Application Support`). Diese Produktbahn startet laut Auftrag keine
     Übersetzung, Installation oder Dienste. Das ist der Grund, warum die Brücke hier nicht
     übersetzt ist. Nötig sind ein Mac mit Xcode-Kommandozeilenwerkzeugen und das Benutzerkonto,
     unter dem Chrome läuft.
  2. **Neuladen der Erweiterung** in Chrome und die Zustimmung zum optionalen Recht im Dialog.
     Beides ist eine Bedienung in Peters Chrome; die Erweiterungskennung steht nur dort.
  3. **Der reale Lauf mit Protokoll:** Kandidat, Chrome-Fassung, Erweiterung 0.4.1,
     Brücken-Fassung, macOS-Fassung, Ergebnis-ID der Karte, Widerruf. Dafür sind die Schritte 1
     und 2 die Voraussetzung.
  4. **Die Anzeige der übergebenen Karte in der Begleiter-Oberfläche** (Lesen von
     `browserkontext.json`) gehört in den gemeinsamen Begleiter. Stand 11.10.2026 (nachgeprüft):
     Weder `main` noch dieser Arbeitsbaum enthalten einen Begleiter (`git log main --
     apps/desktop` ist leer). Beide Kandidaten liegen nur auf fremden, nicht integrierten
     Auftragszweigen. Ihre Oberfläche zu ändern hieße, fremden Auftragscode außerhalb dieses
     Arbeitsbaums zu ändern oder einen zweiten Begleiter zu bauen; beides ist hier ausgeschlossen.
     Konkret nötig ist, dass die Führung bzw. Hostentwicklung den gemeinsamen Begleiter wählt und
     nach `main` bringt (O06). Danach ist der Anschluss eine Leseansicht auf `browserkontext.json`
     in dessen Oberfläche. Die Brücke legt die Karte dafür bereits ab, verwirft sie bei
     Ungültigkeit und hält sie nur für das eigene macOS-Konto lesbar.

  Der Server-Sitzungsweg bleibt daneben angeschlossen. Er trägt Erklärung und Belege; der
  Begleiter bekommt die gebundene Karte.
- **„Erkläre mir diese Angaben" (Nacharbeit 3).** Nach dem Verbinden stellt die Leiste die Frage
  über den vorhandenen Ausführungsweg `POST /api/klara/sessions/{id}/execute`. Dort gelten
  unverändert Anmeldung (`ko.read`), Sitzungsbindung, Einwilligung je Dokument (KA4) und
  Dokumenttext-Freigabe.
  - Gesendet wird genau die gebundene Auswahl samt Tabellenzeilen, vorher frisch gegen die
    Quellfassung abgeglichen. Die Schutzklasse ist der Erweiterung unbekannt und geht deshalb als
    nicht `intern` hinaus (G05).
  - **Die Frage sind die markierten Angaben selbst (Nacharbeit 5).** Der Kern bindet jeden
    Sachbegriff der Frage an jede Quelle (R-0473) und verlangt zwei gemeinsame Begriffe. Eine
    vom Produkt formulierte Anweisung wie „Erkläre mir diese Angaben" bände Wörter, die keine
    Quelle führt — der Weg fände nie geprüftes Wissen. Die Frage wird deshalb als Dokumenttext
    gemeldet (`questionSource: "selection"`). „Erkläre mir diese Angaben" bleibt die Beschriftung
    der Handlung in der Leiste.
  - Folge: Gefunden wird geprüftes Wissen, das die markierten Sachbegriffe führt. Eine Quelle, die
    nur einen Teil davon nennt, trägt die Antwort nicht. Das ist die bestehende Regel des Kerns,
    hier nicht verändert.
  - Ohne Einwilligung antwortet der Kern nur aus geprüftem Wissen ohne Modell. Eine Einwilligung
    erteilt die Leiste nicht; das bleibt der bestehende Einwilligungsweg.
  - Die Antwort wird nur gebunden und angezeigt, solange Folge, Tab, Konto und Fassung der Karte
    übereinstimmen.
  - In den Prüfungen lief kein Modell: ohne Einwilligung bleibt der Weg in der Enge.
- **Belege der Antwort (Nacharbeit 4).** Der gemeinsame Quellen- und Belegvertrag des
  Ausführungswegs bleibt bis in die Leiste erhalten. Die Leiste zeigt:
  - Lage und Gründe der Belastbarkeit;
  - Einschränkungen (Prüfvorbehalt, offener oder unbekannter Konflikt);
  - jeden Absatz mit den Quellen, die ihn tragen;
  - die Quellen mit Fassung, Prüfstand und Rolle (tragend oder nur herangezogen).

  Jede Quelle hat einen Öffnungsweg zur Wissensseite in Klarwerk (`/wissen/{id}`). Der Link trägt
  keine Berechtigung; geöffnet wird mit der eigenen Anmeldung, und der Server prüft die Rechte.
- **Gültigkeit vor jeder Übermittlung (Nacharbeit 4).** Unmittelbar vor jedem Kernabruf (Verbinden,
  einschließlich Rebind und Neuanlage) und vor der Frage wird der aktuelle Zustand gegen den
  Beginn des Vorgangs geprüft: Widerruf, Anmeldung (Kennung und Sitzungsschlüssel), Konto,
  Kernsitzung, Karte (Folge, Tab, Fassung) und tragende Freigabe.
  - Bei einem Wechsel geht nichts hinaus, und es wird nichts geschrieben.
  - Kommt eine Bestätigung erst nach einem Konto- oder Anmeldewechsel an, wird die Sitzung
    geschlossen, ohne den neuen Zustand anzufassen.
- **Stopp (Nacharbeit 3).** „Verbindung widerrufen" wartet auf keinen laufenden Schritt und bleibt
  auch ohne sichtbare Karte erreichbar, etwa nach einem Tabwechsel.
  - Er entwertet sofort jede Freigabe und Karte und verwirft eine gestellte Antwort.
  - Er erhöht eine Widerrufs-Epoche: Ein Schritt, der davor begann, wirkt danach nicht mehr. Eine
    verspätet bestätigte Kernsitzung wird geschlossen, eine verspätete Antwort verworfen.
  - Ein bereits abgeschickter Abruf wird nicht technisch abgebrochen; er läuft zu Ende und bleibt
    dann wirkungslos.
- **AC10 offen.** Benötigt: installierter Begleiter, reale Chrome-Version auf diesem Mac, geladene
  Erweiterung, menschliche Bedienung und Protokoll. Ein DOM-Test oder eine Figur auf dem
  Bildschirm zählt ausdrücklich nicht.
- **Tatsächliche Chrome-Version** ist nicht gebunden (O01). Die Erweiterung liest die
  Hauptversion aus der Browserkennung; der Vertragstest verwendet den Platzhalter `141.0.0.0`.
- **Quellenwiderspruch im README:** `extensions/klara-browser/README.md` nennt „Chrome-Erweiterung
  0.2.0" und führt CHR-04 bis CHR-08 als „noch nicht enthalten"; Manifest `0.4.1` und die Commits
  `a7a168d7e`/`041218b30` liefern diese Umfänge. Das README ist nicht Teil dieses Auftrags und
  bleibt unverändert; der Widerspruch ist hier benannt.
- **R-1048-Quelle:** Für die Streichung vom 29.08.2026 liegt nur die Altquelle
  (`FUNKTIONSREGISTER.json:24274`) vor, keine erneute Prüfung.
