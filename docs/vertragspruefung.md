# Vertragstexte gegen Regelwerk prüfen und Änderungen vorschlagen — Klärung

Auftrag `aufnahme:20260922:gesamt-vertragspruefung`, Revision 1. Ausgangsstand des Repositorys:
`81f9152d` (`1.0.0-beta.1.952`), Branch `codex/auftrag-9c228c59f67ae07cad98`.

Dieser Auftrag ist ein **Klärungsauftrag**. Er dokumentiert die offene Geltungsfrage zu R-0424,
grenzt den heutigen Bestand ab und benennt Widersprüche und fehlende Belege. **Es wird keine
Vertragsprüfung gebaut und keine Entscheidung ersetzt.**

Unterschieden wird zwischen **Quelleninspektion** (Code und Auftragsquelle gelesen), **neuem Test**
(`tests/vertragspruefung/klaerung-doku.test.ts`, Ausführung durch den Adapter/Ben) und **offenen
Voraussetzungen**. In diesem Arbeitsschritt wurde kein Test, kein Dienst und kein Modell gestartet.

---

## 1. Der aufgenommene Punkt (Originalwortlaut)

| Feld | Wert |
| --- | --- |
| Kennung | R-0424 (Alias F-0424, Landkarten-Kennung F11) |
| Titel | Vertragspruefung mit Aenderungsvorschlaegen |
| Anforderung | „Vertragstexte werden gegen ein Regelwerk geprueft und mit Aenderungsvorschlaegen versehen.“ |
| Bereich / Kategorie | Klara / Word/Office |
| Registerzustand | `angedacht`, Prüfstatus `nur_altquelle`, Aufnahmezustand `klaerung` |
| Altbestand | Status `VERWORFEN` — „Branchenwerkzeug, nicht Kern; Codex bestaetigt die Streichung. Marktbeleg Spellbook, Harvey.“ |
| Herkunft (29.08.2026) | „Landkarte v1 Zeile F11: BEWUSST NIE (Branchenwerkzeug); Landkarte v3: gestrichen.“ (`_relay/kopf/outbox/EXT-FUNKTIONSLANDKARTE-20260829.md`) |
| Hinweis | „Altbestand: Einordnung offen. Der damalige Zustand ist kein aktueller Funktionsnachweis. Auch eine alte Pedi-Auswahl bleibt unten als historische Entscheidung erhalten.“ |
| Entscheidungen | `entscheidung: null`, `entscheidungen: []`, `pedi_override: null` |
| Fundstellen | `gesamtbestand/quellenpakete/aufnahmepunkte-004.json` `$[37]` (sha256 `5a179a86…`), `gesamtbestand/REGISTER-SNAPSHOT.json` `$.eintraege[423]` (sha256 `6e22ce8e…`), Auftrag in `quellenpakete/auftraege-004.json` `$[47]` (sha256 `502e629b…`) |

Dem Auftrag ist **genau dieser eine Punkt** zugeordnet (`points: ["R-0424"]`). Die alte Quelle
`00_CONTROL/FUNKTIONSREGISTER.json:9936` liegt außerhalb des Produktarbeitsbaums und wurde nicht
gelesen; ihr Inhalt ist nur über die oben genannten Aufnahmepakete belegt.

## 2. Heutiger Stand (Quelleninspektion am Ausgangsstand)

**Eine Funktion „Vertragstext gegen ein Regelwerk prüfen und Änderungsvorschläge erzeugen“ gibt es
nicht** — weder als Route, Dienst, Reasoner-Aufgabe noch als Oberfläche oder Word-Add-in-Aktion.
Die Suche nach Vertragsprüfung/Regelwerk/Änderungsvorschlag im Code ergibt nur die folgenden,
fachlich anderen Treffer:

| Baustein | Fundstelle | Befund |
| --- | --- | --- |
| Konfliktprüfung zwischen Wissensobjekten | `services/conflicts/src/detect.ts` (`GeltungsKollisionsRegel`, `vorschlagAusUrteil`) | Prüft **zwei Wissensobjekte** gegeneinander auf Widerspruch und kann einen Präzisierungsvorschlag Klaras ableiten (R-0263). Kein Vertragstext als Eingang, kein Regelwerk als Prüfmaßstab. |
| Änderungsvorschlag im Wissensweg | `docs/klara/klara-vorschau.md` („Als Änderungsvorschlag eingereicht“) | Einreichweg für Änderungen an **Wissensinhalten** mit Freigabe; erzeugt keine Vorschläge aus einer Regelprüfung. |
| Beispielinhalt C10 | `services/app/src/example-packages/advisor-ict-v1.lokalisierung.json` („Checkliste zur Vertragsprüfung“) | Fiktiver **Wissensinhalt** (manuelle Checkliste) im Beispielpaket, Übersetzungsstand `draft_translation_not_business_approval`. Keine Funktion. |
| Schema-/Update-Vertragsprüfung | `scripts/insel/schema-vertrag.mjs`, `services/app/src/seed.ts` | Technische Prüfung von Datenbank-/Start-Verträgen. Gleiches Wort, anderes Thema. |

Ein früherer Funktionsnachweis zu R-0424 existiert nicht; der Registerzustand „angedacht“ ist laut
Hinweis kein aktueller Funktionsnachweis.

## 3. Die offene Geltungs-/Umfangsfrage (K1, K2)

**Widerspruch der Quellen:**

* Der Altbestand führt F-0424 als `VERWORFEN` („BEWUSST NIE“, „gestrichen“, „Codex bestaetigt die
  Streichung“, 29.08.2026).
* Das Register führt R-0424 zugleich als `angedacht`, `kundenrelevant: true`, und die Gesamtaufnahme
  vom 22.09.2026 hat ihn als offenen Klärungsauftrag aufgenommen („Altbestand: Einordnung offen“).
* Der Hinweis verweist auf „eine alte Pedi-Auswahl … unten als historische Entscheidung“; im
  zugeordneten Eintrag ist **keine** Pedi-Auswahl enthalten (`entscheidung: null`, `entscheidungen:
  []`, `pedi_override: null`). **Beleg fehlt.**
* Der „Marktbeleg Spellbook, Harvey“ ist nur als Name genannt; ein Marktbeleg-Dokument liegt in den
  Auftragsunterlagen nicht vor. **Beleg fehlt.**
* Wer „Codex bestaetigt die Streichung“ wann ausgesprochen hat, steht nur in der Landkarte vom
  29.08.2026; eine jüngere Nutzerentscheidung zu R-0424 liegt nicht vor.

**Alternativen:**

| | Inhalt | Folge |
| --- | --- | --- |
| A | Streichung vom 29.08.2026 gilt weiter („Branchenwerkzeug, nicht Kern“). | R-0424 wird als verworfen geschlossen; kein Bau. Konfliktprüfung und Änderungsvorschlagsweg bleiben unverändert. |
| B | Vertragsprüfung wird als eigenständiges Branchen-/Erweiterungsmodul zugelassen. | Eigener, neu zu beschreibender Auftrag mit Regelwerksquelle, Eingangsformaten (z. B. Word), Vorschlagsdarstellung, Rechte- und Datenschutzrahmen, KI-Betriebsart und Haftungsgrenze (keine Rechtsberatung). Nicht Gegenstand dieses Auftrags. |
| C | Nur die vorhandenen Bausteine werden für Verträge nutzbar gemacht. | Regelwerk als Wissensobjekte, Prüfung über die bestehende Konfliktprüfung, Vorschläge über den bestehenden Änderungsvorschlagsweg. Erfordert vorher die Entscheidung, ob Vertragstexte überhaupt als Wissensinhalt eingelesen werden dürfen. |

**Jüngste Belege:** Funktionslandkarte v1/v3 vom 29.08.2026 (Streichung), Registerstand vom
05.09.2026 (`aktualisiert: 2026-09-05T09:20:53+02:00`, Zustand `angedacht`), Gesamtaufnahme vom
22.09.2026 (Zustand `klaerung`), Quelleninspektion dieses Dokuments am Stand `1.0.0-beta.1.952`.

**Noch erforderlich:** eine Entscheidung (Pedi), welche Alternative gilt. **Eindeutig bestellt ist
aus den Quellen nur die Klärung selbst** — eine Umsetzung ist aus keiner Quelle eindeutig bestellt.
Deshalb enthält diese Lieferung keine Produktfunktion.

## 4. Gelieferter Umfang und Abgrenzung (K3)

* **Geliefert:** dieses Klärungsdokument und der Absicherungstest
  `tests/vertragspruefung/klaerung-doku.test.ts`, der die genannten Fundstellen und den
  Nicht-Bestand gegen den Code hält.
* **Vorhandene abgeschlossene Teilumfänge:** keine zu R-0424. Konfliktprüfung (R-0263, R-1632/R-1633)
  und Änderungsvorschlagsweg sind eigene, bereits bestehende Funktionen und werden durch diesen
  Auftrag weder erweitert noch als Erfüllung von R-0424 gewertet.
* **Gesonderte Aufträge:** Ein anderer Auftrag mit Zuordnung zu R-0424 ist in den Auftragsunterlagen
  nicht genannt. Der Beispielinhalt C10 gehört zum Demo-Datenpaket, nicht zu diesem Auftrag.
* **Lieferbeleg mit Fassung** entsteht erst nach Veröffentlichung (Deployment/Livefassung) und ist
  hier nicht behauptet.
