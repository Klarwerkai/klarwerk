# Konfliktart, Arbeitsart, Geltungsbereich und zulässige Eskalation — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-konfliktklassifikation` (Revision 1). Grundsatz G-5:
kein stilles Überschreiben; Widersprüche sind Wissen, kein Fehler. Basisstand `d59159dc`
(`1.0.0-beta.1.752`), nachgearbeitet nach Bens Urteil zu Kandidat `a7d8012e`. Das Verhalten prüfen
die Tests unter `tests/konfliktklassifikation/`; dieses Dokument selbst liest kein Test.*

Die Auftragsquelle führt für alle elf Punkte nur Altquellen („Historische Aussage, heutige Erfüllung
nicht erneut geprüft“). Dieses Dokument ordnet jeden Punkt dem heutigen Bestand zu. „Belegt durch“
nennt Verhaltenstests; ob sie auf diesem Stand grün sind, sagt erst ihr Lauf, nicht dieses Dokument.

## Zuordnung je Originalpunkt

| Punkt | Heute | Belegt durch |
| --- | --- | --- |
| R-0209, R-1713, R-2103, FR-CON-01 — klassifizierter, sichtbarer Konflikt statt stillem Überschreiben | **Vorhanden vor diesem Auftrag.** `ConflictType` mit den fünf Arten; `ConflictService.create` legt einen offenen Konflikt mit Art und Beschreibung an und ändert keines der beiden Objekte. | `tests/konfliktklassifikation/klassifikation-und-eskalation.test.ts`, `services/conflicts/src/service.test.ts` |
| R-0215, R-1714, R-2104, FR-CON-02 — nur der Wahrheitskonflikt eskaliert, und zwar zwingend | **Eskalierbarkeit vorhanden; Verbindlichkeit in diesem Auftrag geliefert** (siehe unten). | wie oben, `tests/konfliktklassifikation/konfliktseite-arbeitsart-mounted.test.tsx` |
| R-2065 (NFR-TAI-02) — kein automatischer „Wahrheits“-Entscheid | **Vorhanden vor diesem Auftrag.** Die Erkennung legt nur offene Konflikte an; entschieden wird ausschließlich von einem Menschen mit `conflict.resolve`. | `klassifikation-und-eskalation.test.ts`, `tests/konflikt-aufraeumwege-vermerk/` |
| R-0252 — Konflikttyp benennen: Regel, Sache oder Version; Knöpfe je Typ | **In diesem Auftrag geliefert**, nachgearbeitet: unabhängig von der Konfliktart. | beide Testdateien unter `tests/konfliktklassifikation/` |
| R-0263 — Geltungsbereich und Vorrang zwischen Anweisungen | **In diesem Auftrag geliefert** (siehe unten). | beide Testdateien unter `tests/konfliktklassifikation/` |

## R-0215 / R-1714 — der Eskalationspfad ist verbindlich

Vorher konnte ein offener Wahrheitskonflikt direkt entschieden werden („Links gilt“); die Eskalation
war nur empfohlen. Jetzt:

- **Dienst** (`ConflictService`, `requireEscalatedIfTruth`): `resolve` und `secondOpinion` weisen
  einen *offenen* Wahrheitskonflikt mit `CONFLICT` (409) ab. Der Pfad ist Eskalation → ggf.
  Zweitmeinung → Entscheidung. Die übrigen vier Arten werden unverändert direkt entschieden und
  bleiben nicht eskalierbar.
- **Oberfläche**: beim offenen Wahrheitskonflikt steht „Eskalieren“ vorn im Band; Entscheidungen
  und Zweitmeinung sind sichtbar gesperrt, ein Satz darunter nennt den Grund.
- **„Kein Widerspruch“ (`dismiss`) bleibt offen.** Er entscheidet nicht, welche Aussage stimmt,
  sondern verneint den Befund (Fehlalarm einer Erkennung) — ebenfalls nur durch einen Menschen.
- Die beiden Aufräumwege beim Entfernen von Demodaten (`seed-demo.ts`, `demo-pakete.ts`) gehen
  denselben Pfad: offener Wahrheitskonflikt → erst eskalieren, dann schließen.
- Nachgeführte Bestandstests (sie entschieden offene Wahrheitskonflikte direkt) tragen jetzt den
  Eskalationsschritt; ihre jeweilige Aussage ist unverändert.

## R-0252 — die Arbeitsart, unabhängig von den fünf Konfliktarten

Bens Befund zur ersten Lieferung: die Arbeitsart wurde aus der Konfliktart abgeleitet (truth →
Sache), sodass ein automatisch erkannter Widerspruch zweier interner Festlegungen als Sachkonflikt
mit Zweitmeinung erschien. Diese Ableitung ist entfernt.

- **Herkunft der Arbeitsart** (`Conflict.arbeitsart`, JSONB, keine Migration):
  - manuelle Anlage — der Mensch wählt sie; seit Nacharbeit 5 ist die Wahl **Pflicht** (Feld „Art
    der Arbeit“ ohne wählbare Leer-Option, „Konflikt eröffnen“ bleibt bis zur Wahl gesperrt);
  - automatische Erkennung — „überholt“ ist ein Versionskonflikt; bei „widerspruch“ ordnet die
    Konfliktprüfung selbst ein: das Urteil trägt `arbeit: "regel" | "sache"`
    (`services/reasoner/src/provider-model.ts`, Vertrag und Regel; Parser verwirft andere Werte).
    Ein Widerspruch zweier interner Festlegungen wird so ein **Regelkonflikt der Art „truth“**.
  - fehlt sie (Altbestand, widersprechende Ablehnung R-0238, oder die Prüfung hat nicht
    eingeordnet), gibt es den **Einordnungsweg** (Nacharbeit 5): auf der Konfliktseite stehen vorn
    „Als Regel-/Sach-/Versionskonflikt einordnen“; `POST /api/conflicts/:id/arbeitsart` (Recht
    `conflict.resolve`) speichert die Wahl und protokolliert sie als `conflict.classified`. Bis dahin
    sind die typabhängigen Aktionen (Entscheidungen, Zweitmeinung) sichtbar gesperrt, ein Satz nennt
    den Grund, der nächste Schritt heißt „einordnen“. „Kein Widerspruch“ bleibt offen.
- **Vorab gesagt**: Satz vor dem Kartenpaar (`konflikt-arbeitsart`) mit Herkunft („bei der Anlage
  so eingeordnet“ / „von der Konfliktprüfung so eingeordnet“).
- **Knöpfe je Typ** (`conflictWorkActions`): Sachkonflikt — Links/Rechts/Beide, (Kein Widerspruch),
  Zweitmeinung; Regelkonflikt — ohne Zweitmeinung; Versionskonflikt — „Linker/Rechter Stand gilt“,
  ohne „Beide gelten“, ohne Zweitmeinung, ohne Präzisierung.

## R-0263 — Geltungsbereich und Vorrang zwischen Wissenspunkten

**Berichtigung der historischen Einordnung.** Die erste Lieferung hat R-0263 nicht gebaut und den
Registerstatus „IDEE“ sowie den Vermerk „als offene Entscheidung geführt, kein Auftrag“ als Sperre
behandelt. Das war falsch: der heutige Auftrag schließt Ideen und späteren Ausbau ausdrücklich ein,
der Punkt steht in der Auftragsquelle mit `state: arbeitsauftrag`, und die Quelle legt die Richtung
selbst fest („Klara soll den Unterschied Widerspruch/Präzisierung vorschlagen, entscheiden muss die
befugte Person“). Gebaut ist genau diese Richtung — die Entscheidung trifft der Mensch.

- **Einheit ist der Punkt.** Ein Konflikt verbindet zwei Wissensobjekte; die Entscheidung legt den
  Vorrang zwischen **genau diesen zwei** fest (`Conflict.vorrang`). Ein Vorrang für einen dritten
  Punkt oder ein ganzes Dokument ist nicht ausdrückbar (`VALIDATION`).
- **Vorrang-Beziehung** (`KonfliktVorrang`): `vorrangKo`, `nachrangKo`, `art`:
  - `ueberstimmt` — „Links/Rechts gilt“: die eine Aussage gilt, die andere ist an dieser Stelle
    überstimmt;
  - `schraenkt_ein` — **Präzisierung**: die speziellere Aussage gilt in ihrem **Geltungsbereich**
    (Pflicht), die allgemeinere bleibt außerhalb davon gültig („10 Nm für Bolzen X“ hebt „alle
    handfest“ nicht auf).
  - „Beide gelten, je nach Kontext“ legt keinen Vorrang fest.
- **Präzisierung sichtbar behandeln**: nach „Links/Rechts gilt“ wählt der Mensch „überstimmt“ oder
  „präzisiert nur“; bei Präzisierung ist die Entscheidung erst mit Geltungsbereich bestätigbar.
- **Änderung auf die betroffenen Punkte begrenzt**: die Entscheidung schreibt an keinem Objekt —
  Fassung, Status, Aussage, Quellen und Dokumentherkunft beider Seiten und aller übrigen Punkte
  bleiben unverändert (Routentest vergleicht drei Objekte vor/nach).
- **Sichtbar am Punkt**: `GET /api/conflicts/vorrang/:id` (Recht `ko.read`, Paar-Tor `paarSichtbar`,
  Geltungsbereich hinter `feldFreigabe`) und im Abschnitt „Konflikt“ des Wissensobjekts:
  „Überstimmt durch …“, „Hat Vorrang vor …“, „Eingeschränkt durch … im Geltungsbereich …“,
  „Präzisiert … für den Geltungsbereich …“.
- Neue Route eingetragen in `tests/beta-rollenabnahme/tabelle.ts`, `tests/security/routeGuardAudit.ts`,
  `tests/security/mega74-lesewege-sammler.test.ts` und `docs/architektur/http-api-referenz.md`.

- **Klaras Vorschlag** (Nacharbeit 5): die Konfliktprüfung liefert bei einem Widerspruch zusätzlich
  `vorschlag` — „widerspruch“ oder „praezisierung“ mit der spezielleren Seite und dem engeren
  Geltungsbereich (Parser: nur vollständige Vorschläge). Er wird am Befund abgelegt
  (`detector.vorschlag`, die speziellere Seite als Kennung), im Entscheidungsfeld als „Klaras
  Vorschlag … Entscheiden müssen Sie.“ angezeigt und belegt **nichts** vor: die Wahl überstimmt /
  präzisiert samt Geltungsbereich trifft die befugte Person. Bei Redaktion wird der vorgeschlagene
  Geltungsbereich geleert wie die Begründung.

**Grenzen.** Den Vorschlag gibt es nur bei automatisch erkannten Befunden; bei einem von Hand
gemeldeten Konflikt hat der Mensch die Lage selbst beschrieben und es läuft keine Prüfung. Wie gut
ein echtes Modell Präzisierungen erkennt, belegt kein Test. Eine eigene Weisungsbefugnis im
Rechtemodell gibt es nicht —
entscheiden darf, wer `conflict.resolve` trägt. Die Erkennung prüft nicht gegen bereits festgelegten
Vorrang (ein erneut erkannter Widerspruch desselben Paars wird wie bisher als Befund angelegt).

## Quellenwidersprüche und fehlende Belege

- `specs/stories/conflicts.md` führt FR-CON-01 und FR-CON-02 mit offenen Kästchen `[ ]`, die
  Altquelle (FUNKTIONSREGISTER) mit „Jira Done, 5 Tests“, `Frontend-Funktions-Checkliste.md`
  FE-CON-03/04 mit „✅“ und offenen Prüfspalten. Keiner dieser Stände ist ein Lauf; der heutige
  Beleg sind die oben genannten Tests.
- Der **manuell** angelegte Wahrheitskonflikt holt validierte Bezugsobjekte zurück in die Prüfung
  (`markTruthConflictReview`); der **automatisch** erkannte tut das nicht. Die Quelle äußert sich
  dazu nicht; hier unverändert.
- Die Einordnungspflicht vor der Bearbeitung setzt die **Oberfläche** durch. Der Dienst nimmt
  `resolve` auch ohne Arbeitsart an, weil API-Aufrufer und die widersprechende Ablehnung (R-0238)
  Konflikte ohne sie anlegen; ob das am Server ebenfalls gesperrt werden soll, ist eine
  Produktentscheidung.
- Die Prompt-Erweiterungen um `arbeit` und `vorschlag` sind additiv; die Prompt-Kennung bleibt `kon-v1`. Wie zuverlässig
  ein echtes Modell Regel und Sache trennt, belegt kein Test — das wäre ein Lauf gegen ein Modell.
- Keine echte menschliche Bedienung und kein Produktivlauf sind Teil dieses Belegs.
