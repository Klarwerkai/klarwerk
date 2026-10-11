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
| AC08 Widerruf | Vertrag + Browserweg (Kernsitzung geschlossen, Entwurf bleibt) |
| AC09 Quelländerung | Vertrag + Browserweg (Text und Tabellenstruktur) |
| AC10 Reale Erweiterung mit installiertem Begleiter auf diesem Mac | **offen** — siehe 4 |

## 4 · Grenzen, Widersprüche, fehlende Belege

- **Prüfstand, kein Host.** Chrome selbst (Tabs, Skripteinsatz, Sitzungsspeicher) ist in den Tests
  gestellt; Worker, Leiste, Vertrag und Server laufen echt. Das ist Agentenprüfung, kein
  Hostnachweis (G13).
- **Kein Begleiter, kein separates Kern-Schema im Baum.** `apps/desktop/klara-begleiter/` und ein
  Core-/Native-Kandidat aus `produkt:20261010:klara-office-gemeinsamer-kern` existieren in diesem
  Arbeitsbaum nicht (auch kein Zweig dafür). Angeschlossen ist deshalb der vorhandene,
  authentifizierte Klara-Sitzungsweg des Servers — kein zweiter Kern. Native Messaging ist im
  Manifest bewusst **nicht** angefordert.
- **Keine Frage an das Modell.** Das Verbinden registriert Kontext und Sitzung; eine Erklärung der
  Markierung durch Klara (Ausführungsweg mit Zustimmung/Dokumenttext-Riegel) ist in diesem
  Auftrag nicht verdrahtet und wurde nicht ausgelöst.
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
