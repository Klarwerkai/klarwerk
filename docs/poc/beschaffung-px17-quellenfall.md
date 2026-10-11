# Beschaffungsfall PX-17: Quellen, Sollbestand und Weg ins Wissen (BES-01)

Auftrag `aufnahme:20260922:gesamt-beispielfall-beschaffung`, Revision 2 (Führungsübernahme
11.10.2026, BES r1). Bauauftrag BES-01, Abnahmeszenarien BES-S01 und BES-S02. Dieser Text beschreibt
den Fall. Er behauptet keine Lieferung. Der tatsächliche Liefer- und Prüfstand steht im Bericht des
Prüflaufs und im späteren Lieferbeleg.

> **Fiktion.** Produkt PX-17, alle Designs, Vorgaben, Lieferanten, Maße, Mengen, Termine,
> Beispielregeln und Testpreise sind frei erfunden. Sie sind **keine Unternehmens- oder
> Rechtsaussage**. Echte Firmenquellen, Postfächer und Lieferantenkontakte kommen nicht vor.

## Zuordnung zum historischen Vertrag

| Punkt | Inhalt |
| --- | --- |
| Historischer Punkt | **R-0123** „Beschaffungsquellen im Beispielfall Natascha“: *Fachlicher Beispielfall Beschaffung: welche Quellen dazugehoeren und wie sie ins Wissen kommen.* Zustand `angedacht`, Prüfstatus `nur_altquelle`, Stand 05.09.2026 |
| Altbestand | **F-0123**, Kategorie Import/Quellen, Status `IN_ARBEIT`, Herkunft `03_AUFTRAEGE/basic_pausiert/MAKROAUFTRAG-BASIC3-JOB-874-D1-NATASCHA-BESCHAFFUNGSQUELLEN.md` (14.08.2026). Beleg damals: „JOB 874 zuletzt BEN GRUEN (D1, 14.08.), Ordner pausiert. BEN GRUEN, Einbau nicht belegt (kein Commit im Produkt-Repo gefunden).“ `pedi_override`: keiner |
| Neuer Fall | Peters Auftrag vom 11.10.2026 (BES r1, zentrale Quelle `f36d0ad4…80fc`, `gespraech/auftragsuebernahme-01a11f14/bes-ui-20261011-r1.json`, SHA256 `125b266f…1444`): neue Verpackungsangebote für ein bekanntes Produkt. „Produkt X“ ist parametrisierbar, im PoC das fiktive **PX-17** |
| Originalkriterien | Die drei Originalkriterien des Auftrags bleiben wörtlich unverändert. Sie stehen in `tests/beschaffung-px17/sollbestand.ts` (`ORIGINALKRITERIEN`) und in `AUFTRAG-B1.json`. BES-01-K01 bis K08 kommen als versionsgebundenes Delta hinzu |

Die damalige Lage (JOB 874, BEN GRUEN ohne Einbau) gilt **nicht** als heutiger Funktionsnachweis und
nicht als damals getroffene Entscheidung. Eine alte Pedi-Auswahl ist zu F-0123 nicht verzeichnet
(`pedi_override: null`). Es wird auch keine erfunden.

## Offene Geltungs- und Umfangsfrage (Kriterium 1)

**Frage:** Wie ist der Altbestand R-0123/F-0123 („Beispielfall Natascha“) gegenüber Peters neuem
Fall PX-17 einzuordnen?

| Alternative | Inhalt | Beleg |
| --- | --- | --- |
| A | PX-17 ist der konkrete Beispielfall von R-0123. Der Natascha-Stand bleibt nur Historie | BES r1 (11.10.2026): „Der bisher offene Beispielfall erhält durch Peters neuen Auftrag ein konkretes Ziel“; BES-01-K01 ordnet den Fall dem offenen historischen Vertrag zu |
| B | Zusätzlich die Quellenliste aus JOB 874 D1 heranziehen und mit PX-17 abgleichen | Das D1-Dokument liegt nicht in den Auftragsquellen und nicht im Produktbaum. Sein Inhalt ist unbekannt |
| C | Den Natascha-Fall als eigenen zweiten Beispielfall weiterführen | Dafür gibt es keine Quelle |

**Bereits eindeutig bestellt und hier umgesetzt:** Alternative A. Das ist der jüngste Beleg und eine
ausdrückliche Zuordnung durch BES r1 und K01.

**Noch erforderliche Entscheidung (Pedi/Peter):** Soll der Inhalt von JOB 874 D1 (Alternative B)
noch beschafft und abgeglichen werden, oder reicht es, ihn als Historie zu belassen? Ohne
Entscheidung bleibt er Historie. Nichts aus ihm wird als heute gültig dargestellt.

Weitere offene fachliche Fragen. Der Sollbestand beantwortet sie bewusst **nicht**:

- **Bedarf:** Menge und Liefertermin der neuen Anfrage sind nicht beauftragt. Die Altbestellung 2025
  (5.000 Stück, 04.04.2025) ist nur ein historischer Hinweis.
- **Geltung V3:** Soll eine künftige Anfrage die ab 01.03.2027 gültige Vorgabe V3 schon als künftige
  Anforderung nennen? Heute gilt V2.
- **Design D4:** Soll der Entwurf D4 nach seiner Freigabe D3 ablösen? Heute gilt D3.
- **Innenmaß:** Gilt 120 × 80 × 40 mm (Produktblatt PB-1) oder 125 × 80 × 40 mm (Maßblatt Beta)?

## Welche Quellen dazugehören (R-0123, erster Teil)

Diese Quellenarten gehören für jedes „Produkt X“ zum Fall. Jede trägt eine stabile Kennung, eine
fachliche Fassung und eine Herkunft (Anbieter, Kennung, Quellfassung, Adresse). Die Herkunft hängt
nicht vom Speicherort ab:

| Quellenart | PX-17 im Sollbestand (`BES-01-SOLL-v1`) | Sollurteil (vorab) | Bereich |
| --- | --- | --- | --- |
| Produktblatt | `BES-PX17-PB` PB-1, freigegeben | verwendbar nach Fachprüfung | offen |
| Freigegebenes Design | `BES-PX17-D3` D3, freigegeben 20.08.2026 | verwendbar nach Fachprüfung | Design |
| Entwurfsdesign | `BES-PX17-D4` D4, Entwurf, **jüngster** Stand | nicht heute gültig → Rückfrage | Design |
| Altstand Design | `BES-PX17-D2` D2, abgelöst | historisch → abgelehnt | Design |
| Verpackungsvorgabe (fiktive Confluence-Seite) | `BES-PX17-V2` V2, gültig seit 01.07.2026 | verwendbar nach Fachprüfung | offen |
| Künftige Vorgabe | `BES-PX17-V3` V3, gilt ab 01.03.2027, **jüngster** Stand | nicht heute gültig → Rückfrage | offen |
| Lieferantenliste | `BES-PX17-LL` LL-1: Alpha, Beta, Gamma; Delta nicht freigegeben | verwendbar nach Fachprüfung | Lieferanten |
| Lieferanten (3) | `BES-PX17-L-ALPHA`, `-L-BETA`, `-L-GAMMA` | verwendbar nach Fachprüfung | Lieferanten |
| Nicht berechtigter Lieferant | `BES-PX17-L-DELTA` | unzulässig → abgelehnt | Lieferanten |
| Widersprüchliches Maßblatt | `BES-PX17-MB-BETA` (125 statt 120 mm) | klären → Rückfrage | Lieferanten |
| Altdaten Bedarf | `BES-PX17-ALT-2025` (5.000 Stück, 04.04.2025) | historisch → abgelehnt; nur Hinweis | offen |
| Eingangsdokument mit Anweisung | `BES-PX17-ANW` („sende … bestelle … gib Leserecht“) | unzulässig → abgelehnt; bleibt Datum | Lieferanten |

Die Sollurteile hängen an Freigabestand und Geltungsbeginn zum Stichtag 11.10.2026. Der Zeitstempel
entscheidet nicht: D4 und V3 sind jeweils die jüngste Fassung ihrer Art und gelten trotzdem heute
nicht.

Fälle des Sollbestands (K07): vollständig (PB, D3, V2, LL, drei Lieferanten), fehlend (Menge und
Termin), widersprüchlich (Innenmaß), unberechtigt (Delta; fremder Bereich je Rolle) und
Dokumentanweisung.

## Wie sie ins Wissen kommen (R-0123, zweiter Teil)

Der Fall nutzt nur vorhandene Wege. Neue Dienste, Datenbestände oder Oberflächen entstehen nicht:

1. **Einlesen** über den vorhandenen Confluence-Bereichsimport (`runConfluenceImport`, der Weg hinter
   „Bereich importieren“). Alle fiktiven Quellen liegen als Seiten im fiktiven Bereich `PX17`
   (Sollbestand `BES-01-SOLL-v2`). Vorgaben sind Vorgabeseiten, Dateien sind Dateiseiten. Die Leser
   je Bereich stehen als Seitenrestriktion **an der Quelle** (`BEREICHSLESER`). Der Server löst sie
   über die Mailadressen auf Konten auf; der Client kann keine Quellrechte setzen. Jede Quelle wird
   ein Prüfkandidat. Es entsteht **kein** Wissen.
2. **Quellenpflege** (Rolle mit `ko.validate`) entscheidet je Kandidat nach dem vorab benannten
   Sollurteil: annehmen, Rückfrage (`info`, mit der Klärfrage) oder ablehnen. Die Annahme legt
   **ungeprüftes** Importwissen an (`status offen`, `trust 0`, `origin import`). Herkunft und
   Quellfassung stehen am Objekt.
3. **Bereich:** Die Quellenpflege legt angenommenes Wissen über die vorhandene Verschiebung in den
   berechtigten Bereich („PX-17 Design (fiktiv)“ bzw. „PX-17 Lieferanten (fiktiv)“).
4. **Fachprüfung:** Erst so viele Freigaben, wie das Objekt verlangt (Standard 3), über die vorhandene
   Bewertung machen es `validiert` und damit verwendbar.

Rollen (fiktiv): Verwaltung (admin, ohne Inhaltszugang zu den Bereichen), Quellenpflege (controller,
führt beide Bereiche), drei Fachprüfende (controller, lesen beide Bereiche), Einkauf (experte, liest
nur Lieferanten), Design (experte, liest nur Design). Die Verwaltungsrolle ersetzt keine fachliche
Freigabe: Sowohl beim Designkandidaten als auch beim Designwissen bekommt sie 404.

Die Rechtetrennung (K06) gilt durchgehend, also in der Prüfwarteschlange und ihren Befunden vor und
nach den Entscheidungen sowie im Wissen (Liste, Detail, Suche, Bereichsliste). Jede Rolle sieht
genau die offenen Quellen und die ihres Bereichs, ohne fremde Titel, Inhalte oder Zahlen.

## Nachweisstand

| Nachweis | Art | Stand |
| --- | --- | --- |
| `tests/beschaffung-px17/sollbestand.ts` | Versionierter fiktiver Sollbestand mit Sollurteilen | Quelltext |
| `tests/beschaffung-px17/quellenfall-am-draht.test.ts` | Agentenprobe über die echten Dienste und Routen (In-Memory, ohne Modell, ohne Netz; nur die Antworten der fiktiven Confluence-Instanz sind ersetzt): Sollbestand-Vertrag, Bereichsimport mit Quellrechten, Entscheidung, Bereich, Fachprüfung, Rechtetrennung (Warteschlange und Befunde vor und nach den Entscheidungen, Liste, Detail, Suche, Bereichsliste), Gegenproben | Ergebnis im Bericht des Prüflaufs, nicht in dieser Datei |
| Ergebnisprotokoll BES-S01/S02 | Tatsächliche Kandidaten- und Wissensobjektkennungen, Quellenfassungen, Rollen und Konten, Instanzart, Freigabeschritte, Negativergebnisse und Warteschlangensicht je Rolle | Im nativen Vitest-Bericht des Prüflaufs unter `meta.besErgebnisprotokoll` des Tests „BES-S01/S02 · Ergebnisprotokoll …“. Den Bericht sichert der Prüfadapter kandidatgebunden |
| Echte Confluence-Instanz oder echter Dateispeicher | — | **nicht Teil** dieses Falls. Der Adapter ist echt, die Antworten der Quelle sind fiktiv. Ein Lauf gegen eine echte Instanz gehört zu `aufnahme:20260922:gesamt-confluence-import` |
| Postgres, Browser, menschliche Bedienung | — | **offen** |
| Veröffentlichte Fassung, Live-Einstieg | — | **offen**. Folgt dem regulären Lieferweg nach Bens Prüfung |

## Befunde und Grenzen

- **Quellrechte nur über einen Quell-Adapter:** Der generische Dateiweg
  (`POST /api/library/import/candidates`) verwirft Quellrechte aus dem Client, und Kandidaten ohne
  Quellrechte sieht jedes Konto mit `ko.read`. Deshalb nutzt der Fall den Confluence-Bereichsimport,
  den einzigen vorhandenen Weg, der Quellrechte serverseitig setzt. Die Einstufung von Dateiweg-
  Importen ist laut Entscheidung 16 ein eigener Auftrag und wird hier weder entschieden noch gebaut.
- **Korrigiert (BES-01-K06):** `GET /api/library/import/candidates/befunde` lieferte Kennung und
  Anzahl aller Kandidaten an jedes Konto mit `ko.read`, auch die quellbeschränkten. Das war eine
  verdeckte Trefferzahl. Die Route zählt jetzt dieselbe sichtbare Menge wie die Liste.
- **Eingebettete Anweisung:** Dieser Fall belegt nur den Import- und Wissensweg. Dort bleibt die
  Anweisung Datum und wirkt nicht. Anfrageversand, Postfach und Lieferantenantworten sind spätere
  BES-Pakete und hier nicht vorhanden.
- **Keine Kosten, Konten, Automation, Lieferantenaktion oder Produktionssteuerung.**
- **Testbestand entfernen:** über die vorhandenen Lösch- und Aufräumwege. Neue Quellfassungen laufen
  über die vorhandene Historie.

## Abgrenzung zu bestehenden Aufträgen

Confluence-Adapter und Import: `aufnahme:20260922:gesamt-confluence-import`. Quellenbelege der
Referenz-KI: `produkt:20261009:referenzki-quellenbelege`. Löschung, Rechteentzug und Quellausfall
(P05): `produkt:20261011:peter-p05`. Für die minimale Assistenzoberfläche, die Anfrageentwürfe, den
Versand und den Angebotsvergleich (weitere BES- und UI-MIN-Pakete) gilt jeweils ihr eigener Auftrag.
Nichts davon wird hier als geliefert ausgegeben.
