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

**Neu mit diesem Auftrag (BPA-01, Adapterseite der Kontextbrücke):**

- `extensions/klara-browser/kontext.js` — reiner Vertrag ohne Chrome-, Netz- oder Speicherzugriff:
  gebundene Kontextkarte (URL, Titel, Auswahl, Tabellenstruktur genau der Markierung,
  Erfassungszeit, Inhaltsfassung, Browser/Version, Erweiterungsversion, Konto), Kontextfolge,
  Freigaben `einmalig` (Chrome-`activeTab`-Regel) und `bereich`, Sperrgründe mit nächstem Schritt,
  Fähigkeitsausweis, Antwortprüfung, Abgleich bei Quelländerung, Widerruf.
- `tests/klara-browser/kontext.test.ts` — AC01–AC09 einzeln; AC01 mit dem echten `selection.js`
  auf einem synthetischen Datenblatt (Ventile V-17/V-18, BPA-S01).

**Stand je Kriterium:**

| Kriterium | Stand |
|-----------|-------|
| AC01 Tabellenbereich, URL, Fassung; Assistenzfenster zählt nicht | Vertrag + Test (Simulation) |
| AC02 Zwei Tabs, verspätete Antwort | Vertrag + Test (Simulation) |
| AC03 Konto-/Mandantenwechsel | Vertrag + Test (Simulation) |
| AC04 Einmalige Freigabe vs. Bereichsfreigabe | Vertrag + Test (Simulation); die tatsächliche Chrome-Regel ist nur nachgebildet |
| AC05 Domain, privates Fenster, Frame, interne Seiten | Vertrag + Test (Simulation) |
| AC06 DOM-Tabelle / laufende Seite / PDF getrennt ausgewiesen | Vertrag + Test: Tabelle unterstützt, laufende Seite nur Momentaufnahme, PDF **nicht geliefert** |
| AC07 Systemauftrag im Seitentext | Vertrag + Test (Simulation) |
| AC08 Widerruf | Vertrag + Test (Simulation) |
| AC09 Quelländerung | Vertrag + Test (Simulation) |
| AC10 Reale Erweiterung mit installiertem Begleiter auf diesem Mac | **offen** — siehe 4 |

## 4 · Grenzen, Widersprüche, fehlende Belege

- **Nicht verdrahtet.** `kontext.js` wird von `worker.js` und `panel.js` noch nicht geladen; die
  Leiste zeigt die Kontextkarte also noch nicht an, und die Erweiterung erteilt noch keine
  `einmalig`-/`bereich`-Freigaben über diesen Vertrag. Die Prüfungen sind Simulation bzw.
  Agentenprüfung, kein Hostnachweis (G13).
- **Kein Begleiter, kein Kern-Schema im Baum.** `apps/desktop/klara-begleiter/` existiert in
  diesem Arbeitsbaum nicht; ebenso kein gemeinsames Kontextschema aus
  `produkt:20261010:klara-office-gemeinsamer-kern`. Native Messaging ist im Manifest bewusst
  **nicht** angefordert. Die Karte folgt G04 und wird auf das Kern-Schema abgebildet, sobald es
  geliefert ist — kein zweiter Kern.
- **AC10 offen.** Benötigt: installierter Begleiter, reale Chrome-Version auf diesem Mac, geladene
  Erweiterung, menschliche Bedienung und Protokoll. Ein DOM-Test oder eine Figur auf dem
  Bildschirm zählt ausdrücklich nicht.
- **Tatsächliche Chrome-Version** ist nicht gebunden (O01); der Test verwendet einen
  Platzhalter `141.0.0.0`.
- **Quellenwiderspruch im README:** `extensions/klara-browser/README.md` nennt „Chrome-Erweiterung
  0.2.0" und führt CHR-04 bis CHR-08 als „noch nicht enthalten"; Manifest `0.4.1` und die Commits
  `a7a168d7e`/`041218b30` liefern diese Umfänge. Das README ist nicht Teil dieses Auftrags und
  bleibt unverändert; der Widerspruch ist hier benannt.
- **R-1048-Quelle:** Für die Streichung vom 29.08.2026 liegt nur die Altquelle
  (`FUNKTIONSREGISTER.json:24274`) vor, keine erneute Prüfung.
