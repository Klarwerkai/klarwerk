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
    - Nacharbeit 10: Das gilt auch für eine Karte, die noch unterwegs und unquittiert ist. Sie ist
      vor dem Senden an Port, Folge und Fassung gebunden. Bei einer fehlenden, abgelehnten oder
      überholten Quittung wird sie ebenfalls verworfen; eine spätere Quittung zählt nicht.
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
  4. **Begleiterverbraucher — bestellter technischer Restumfang dieses Auftrags (berichtigt in
     Nacharbeit 10).** Die frühere Formulierung „beides ist hier ausgeschlossen" war falsch: Der
     Anschluss an den vorhandenen Begleiter ist bestellt (BPA-01, AC10) und bleibt Aufgabe dieses
     Auftrags. Er besteht aus zwei Schritten:
     - **4a · Zuordnung (offen, nicht ersetzbar):** Die Führung bzw. Hostentwicklung legt fest,
       welcher vorhandene Kandidat der gemeinsame Begleiter ist (O06): BPA-04 auf
       `codex/auftrag-b4b52732c85570289b3d` oder das Maskottchen auf
       `codex/auftrag-153f1494a069ace21aa7`. Diese Auswahl trifft dieser Auftrag nicht. Stand
       11.10.2026, nachgeprüft: Es liegt keine Zuordnung vor, und weder `main` noch dieser
       Arbeitsbaum enthalten einen Begleiter (`git log main -- apps/desktop` ist leer).
     - **4b · Integration und Verbraucher (technisch, folgt 4a):** Sobald die Zuordnung vorliegt,
       wird der zugeordnete Begleiter über den regulären Lieferweg in diesen Stand integriert, ohne
       einen zweiten Begleiter zu bauen. In seiner Oberfläche wird dann die gebundene Karte nutzbar
       gemacht: als Leseansicht auf `browserkontext.json`, die die Karte nur für den angemeldeten
       Nutzer aus `nutzer` zeigt und nach `verwerfen`/`widerrufen` sofort leert. Die Brücke liefert
       dafür bereits die Ablage (0600), das Verwerfen bei Ungültigkeit und das Widerrufen.
     Danach folgen die Schritte 1–3 (Übersetzen und Einrichten, Neuladen, realer Lauf) mit dem
     integrierten gemeinsamen Begleiter.

  **Nachtrag Nacharbeit 11 — O06 ist entschieden** (`QUELLEN-HOSTZUORDNUNG-O06-20261011T211410Z`):
  - Gemeinsamer Host ist `produkt:20261010:klara-office-mac-maskottchen`, Kandidat `ff96149e`
    (`codex/auftrag-153f1494a069ace21aa7`, installiert als „Klara Begleiter.app" 0.1.0).
  - Aus BPA-04 werden aus `345b4467` die Anmeldung, die Finder-/Word-Lesewege und die Bindungs-
    und Widerrufsregeln wiederverwendet.

  *Umgesetzt in diesem Arbeitsbaum:*
  - Der **Kartenverbraucher** für den Host ist die Bibliothek `KlaraBrowserKarte` im Paket der
    Brücke (`BrowserBruecke/Sources/KlaraBrowserKarte`). Sie gibt eine Karte nur frei, wenn
    Nutzer (`nutzer`) und Konto (`mandant` = Klarwerk-Server) passen und die Karte zur aktuellen
    Anmeldesitzung gehört.
  - **So ist die Sitzungsbindung umgesetzt (Nacharbeit 13, ersetzt den Zeitvergleich aus
    Nacharbeit 12):**
    - Jede Anmeldung im Verbraucher erzeugt eine neue zufällige **Sitzungsmarke**. Der
      Verbraucher legt sie neben der Karte ab (`begleitersitzung`, 0600). Bei der Abmeldung wird
      sie gelöscht.
    - Die Brücke liest die Marke zu Beginn jeder Verbindung. Sie legt eine Karte nur ab, wenn
      genau diese Marke beim Ablegen noch gilt, und schreibt die Marke in die Karte.
    - Der Verbraucher gibt nur Karten mit der **aktuellen** Marke frei.
    - Eine verspätete Übergabe aus Sitzung A nach dem Wechsel zu B trägt die Marke von A. Sie wird
      deshalb schon von der Brücke abgelehnt. Liegt sie trotzdem in der Ablage, gibt der
      Verbraucher sie in keinem Leseweg frei (`anmelden`, Dateibeobachter, `aktuell()`). Das gilt
      auch bei gleichem Nutzer und Server und unabhängig von Zeitstempeln.
    - Abmeldung und Kontowechsel sperren ebenso. Schlägt das Ablegen der Marke fehl, gilt keine
      Marke und damit keine Karte.
  - Dieselbe eine Prüfung (`aktuell()`) benutzen `anmelden`, die Rückmeldung und der
    Dateibeobachter.
  - Keine Karte gibt es außerdem nach dem Löschen durch `verwerfen`/`widerrufen` und bei einer
    Datei mit fremdem Besitzer oder Rechten über 0600.
  - Gegenprobe: `BrowserBruecke/Tests/KlaraBrowserKarteTests/SitzungsbindungTests.swift`
    (`swift test` auf dem Mac; in dieser Bahn nicht ausgeführt).
  - Die Erweiterung schickt dafür neu den Mandanten mit der Karte.
  **Nachtrag Nacharbeit 18 — Host übernommen und angeschlossen**
  (`QUELLEN-HOSTUEBERNAHME-20261011T231344Z`). Die frühere Aussage, ein vorheriger Merge sei
  Voraussetzung, ist überholt: Die Führung hat die Quellübernahme in diesem Arbeitsbereich
  festgelegt.

  *Umgesetzt (Quellcode in `apps/desktop/klara-begleiter`, eine App):*
  - **Host aus `ff96149e`:** `main.swift`, `Fenster.swift`, `Lage.swift`, `Info.plist.vorlage`
    und `VERSION` sind byteweise unverändert übernommen. `Steuerung.swift` ist übernommen und um
    die mit „BPA-01“ markierten Stellen ergänzt. Figur, Fenster, Menüleiste und Tastenkürzel
    bleiben erhalten.
  - **BPA-04 aus `345b4467`:** `Server.swift`, `FinderAufnahme.swift` und
    `Bedienungshilfe.swift` sind unverändert übernommen. `Programme.swift` ist die frühere
    `KlaraBegleiter.swift` ohne eigene `@main`-App. Der Host öffnet sie als Fenster
    „In anderen Programmen …“; es gibt also keine zweite App.
  - **`Package.swift`** ist neu und baut genau diese App mit `KlaraBrowserKarte` aus
    `BrowserBruecke`. Die beiden Quell-Layouts sind nicht blind überschrieben.
  - **Anmeldung (Stand Nacharbeit 19):** siehe unten. Der Weg über `/api/auth/me` und eine nur
    aus der Nutzerkennung abgeleitete Sitzung aus Nacharbeit 18 ist ersetzt.
  - **Anzeige und Leerung:** `beiAenderung` setzt den Tooltip der Menüleiste und schickt die
    Karte bzw. `null` als Ereignis `klara-begleiter-browserkarte` an die Webfläche, aber nur auf
    dem eigenen Server.
    - Das Menü zeigt „Browserkarte: …“ (Titel, Seite, Fassung, Auswahl), beim Öffnen frisch über
      `aktuell()` geprüft.
    - „Quelle im Browser öffnen“ prüft die Karte beim Klick erneut.
  - **Lebenszyklus:** `beobachten()` beim Start; beim Beenden `anmelden(nil)` (Marke weg, die
    Brücke nimmt nichts mehr an) und `anhalten()`.
  - Widerruf, Tab-, Quell-, Konto- und Sitzungswechsel verwerfen verspätete Karten weiterhin über
    dieselben Wege (Erweiterung `verwerfen`/`widerrufen`, Brücke, Sitzungsmarke).
  - **Gegenproben:** `SitzungsbindungTests.swift` deckt die Anmeldefolge, die Herkunft wie in
    der Erweiterung und den Fall ab, dass Abmelden und Neuanmelden desselben Nutzers die alte und
    eine verspätete Karte sperrt.

  **Nachtrag Nacharbeit 19 — gemeinsamer Hostweg vollständig übernommen, Sitzung serverseitig
  gebunden.**

  *Sitzungsbindung (Befund 1):*
  - Neu ist die Tür `GET /api/me/klara/begleiter/sitzung` (`klara-begleiter-routes.ts`). Sie
    liefert `{ nutzer, sitzung }`; `sitzung` ist der SHA-256-Fingerabdruck des
    Sitzungsmerkmals mit eigenem Zweckpräfix. Er ist nicht umkehrbar, kein Anmeldenachweis und
    nie das Merkmal selbst.
    - Ab- und Neuanmelden desselben Nutzers ergibt einen anderen Fingerabdruck, auch wenn der
      Host die Abmeldung nie gesehen hat.
  - Der Host fragt diese Tür in einer eigenen WebKit-Skriptwelt ab.
    - `HostAnmeldungsFolge.bestaetigt(nutzer:sitzung:)` bindet Nutzer **und** Serversitzung.
    - Jeder Sitzungswechsel ergibt eine neue Sitzungsmarke; alte Karten und verspätete
      Übergaben bleiben gesperrt.
  - **Sofort entwerten:** Ein gemeldeter Wechsel entwertet die Freigabe, *bevor* nachgefragt
    wird (`anmeldungGewechselt`). Gemeldet wird er auf vier Wegen:
    - die Meldung `anmeldung` der Webfläche (`Begleiter.tsx` sendet sie bei jedem Kontowechsel);
    - eine Navigation;
    - Neuladen;
    - Verbindungsverlust.
  - Was bei einem gemeldeten Wechsel geschieht:
    - Die Marke ist sofort weg, die Anzeige leer, und laufende Nachfragen zählen nicht mehr
      (`anmeldeAbfrage`).
    - Das Menü liest danach keine Karte.
    - Erst die Antwort des Servers gibt unter einer **neuen** Marke wieder frei, auch bei
      derselben Serversitzung. Die alte Karte gilt also nie für die neue Sitzung.
  - Takt (30 s) und Menüöffnung fragen nur nach. Erkennt der Server eine andere Sitzung, sperrt
    das ebenso.
  - **Gegenproben:**
    - `tests/klara-browser/begleiter-sitzung.test.ts` (Server, S1–S3);
    - `SitzungsbindungTests.swift`: Sitzungswechsel desselben Nutzers ohne Abmeldung; sofortige
      Entwertung vor der Nachfrage.

  *Gemeinsamer Hostweg (Befund 2):*
  - **Aus `ff96149e` übernommen (KLARA-OFFICE-02):**
    - die Webfläche `/begleiter` (`pages/Begleiter.tsx`, `lib/begleiter.ts`,
      `lib/begleiterBruecke.ts`, `texte/begleiter.ts`; Route ohne Hülle in `routes.tsx` und
      `AppShell.tsx`);
    - der Kontextkanal (`klara-begleiter.ts`, `klara-begleiter-routes.ts`, registriert in
      `build-app.ts`);
    - der Word-Adapter `word-addin/begleiter.js` (eingebunden in `taskpane.html`);
    - die Bauskripte `scripts/klara-office/begleiter-*.sh`;
    - die Betriebsdoku `docs/operations/klara-office/begleitapp-mac.md`;
    - die Tests `tests/klara-office/*`;
    - die zugehörigen Wächtereinträge (Rollenabnahme, Route-Guard-Matrix, Lesewege-Register,
      API-Referenz, Schnitt-, CSP- und Zielbild-Tests, Sprachparität).
  - **Aus `345b4467` übernommen (BPA-04):**
    - `programmadapter.ts` und `programmadapter-routes.ts`, registriert in `build-app.ts`;
    - im Profil die Übersicht „In anderen Programmen“ mit dem Begleiter-Code
      (`ProgrammeUebersicht.tsx`, `api/programme.ts`, `texte/programme.ts`);
    - die Tests `tests/programmadapter/{programmadapter,hostwege}.test.ts` und E7 in
      `assistenz-mounted.test.tsx`;
    - die Betriebsdoku `docs/operations/klara/programmadapter.md`;
    - die Wächtereinträge.
  - **Berichtigung einer früheren Aussage:** `/api/auth/office-handover` und `…/redeem` gab es
    bereits in `services/auth`. Die Aussage „fehlt in main“ war falsch.
  - **Layout:** Der Host steht wieder flach unter `Sources/`, wie in `ff96149e`.
    - Das Bauskript übersetzt `Sources/*.swift` zusammen mit `KlaraBrowserKarte` in **ein** Modul.
    - `Package.swift` dient `swift build`.

  *Nicht übernommen, mit Grund:*
  - **Office-Kontext-Kern KLARA-OFFICE-01** (`office-kontext*.ts`, `word-addin/begleitung.*`,
    `558f9e132`): Er gehört zum gesonderten Auftrag `klara-office-gemeinsamer-kern` und wird
    weder von `/begleiter` noch von der Browserkarte gebraucht. `texte/begleiter.ts` steht
    deshalb auf dem Stand vor diesem Block.
  - **BPA-04-Erweiterungen im Aufgabenfenster** (`taskpane.js`: Zielprüfung vor dem Einfügen):
    Sie sind ein eigener BPA-04-Teil und berühren den Host nicht.

  *Zur Bestätigung durch die Führung offen (Produktentscheidung, nicht von dieser Bahn
  gewählt):*
  - Die Host-Zusage KO-02-06 („keine Bedienungshilfe als Ersatz für den Office-Kontext“) steht
    gegen die O06-Zuordnung, die BPA-04-Word-Lesewege in denselben Begleiter zu integrieren.
  - Umgesetzt ist die O06-Zuordnung, und zwar eng begrenzt:
    - Die Bedienungshilfe steht nur in `Bedienungshilfe.swift`.
    - Sie liest nur, nur Word für Mac, und fragt die Freigabe nur auf Klick an.
    - Figur, Webfläche und Browserkarte nutzen sie nicht.
  - Der Host-Test Q3 ist entsprechend geteilt: Q3 prüft den Host weiterhin ohne Bedienungshilfe,
    Q3b grenzt den BPA-04-Weg ab.
  - Bestätigt die Führung KO-02-06 für die gesamte App, ist `Bedienungshilfe.swift` samt Knopf
    wieder herauszunehmen.

  *Getrennt offen:*
  - **Native Prüfung:** Host, Brücke und Swift-Tests sind in dieser Bahn weder übersetzt noch
    ausgeführt, weil es hier kein Swift gibt. `scripts/klara-office/begleiter-bauen.sh` bzw.
    `swift build` und die Kartentests (Swift Testing, Aufruf oben) auf dem Mac stehen für diese
    Kandidatenfassung aus.
  - **Skriptrechte:** Die Bahn konnte die Skripte nicht als ausführbar markieren (`chmod`
    abgelehnt). Bis dahin startet man sie mit `bash scripts/klara-office/…`.
  - **Pins der Auslieferung:** `taskpane.html` hat einen Verweis mehr. Die Pins in
    `mega69-klara-waechter.test.ts` und `PANEL_VOR_SCHNITT_BLOB` sind seit Nacharbeit 20 auf die
    im Prüflauf zu `6e1a7105` gemessenen Werte gesetzt.
  - **Menü bei Entwertung (Nacharbeit 21):** Der Menüabschnitt der Browserkarte ist
    `KartenMenueAbschnitt` (`BrowserBruecke/Sources/KlaraBrowserKarte/KartenMenue.swift`).
    - Bei jeder Kartenänderung ersetzt `karteAnzeigen` die Einträge an derselben Stelle, auch im
      bereits geöffneten Menü.
    - Bei `nil` verschwinden Titel, Seite, Fassung, Auswahl und das Quellziel sofort. Alte
      Einträge verlieren Ziel, Aktion und URL.
    - Die Prüfung beim Klick bleibt.
    - Gegenprobe: `KartenMenueTests.swift`.
  - **Native Tests auf Swift Testing (Nacharbeit 22):** Auf diesem Mac fehlt XCTest. Beide
    Testdateien sind deshalb nach dem unabhängig geprüften Test-only-Vorschlag `1090a034`
    (`QUELLEN-PRO-SWIFT-TESTING-V2-1090A034-20261013`) auf Swift Testing umgestellt.
    - Erhalten sind alle 12 Szenarien (8 Sitzungsbindung, 4 Menü) mit ihren Zusicherungen und
      Fixtures. Ein früheres `try? XCTUnwrap` ist jetzt ein hartes `try #require`.
    - Laufzeitquellen und `Package.swift` sind unverändert.
    - Aufruf im Ordner `BrowserBruecke`:
      `xcrun swift test --disable-xctest --enable-swift-testing -j2`.
    - Der Reparaturbeleg `MS365-PRUEFUNG-20261013-24` (12 grün, `#require`-Gegenprobe bricht ab)
      galt der isolierten Vorschlagsfassung. Für die neue Kandidatenfassung ist der Lauf erneut
      zuzuordnen.
  - **Fremde rote Wächter (Nacharbeit 20):** route-guard-audit, mega74, Rollenabnahme-Abdeckung,
    API-Referenz und word-addin-csp scheitern an Routen und Panelzeilen aus `main`, nicht an diesem
    Auftrag. Sie sind aus der Auftrags-Prüfauswahl genommen; die Berichte bleiben im Archiv.
  - **Realer AC10-Rundweg** auf diesem Mac mit Chrome-, Brücken-, Begleiter- und macOS-Fassung.
  - **Git-Integration:** Kandidatenbildung und spätere Git-Zusammenführung übernimmt der
    reguläre Adapter.

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
