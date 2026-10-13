# Aufnahme 20260922 · Gleichzeitiges Bearbeiten gemeinsamer Entwürfe: Klärung von R-0109

Auftrag `aufnahme:20260922:gesamt-gleichzeitiges-bearbeiten`, Revision 1. Basis `81f9152d`
(1.0.0-beta.1.952). Stand dieses Dokuments: 13.10.2026.

**Ergebnis in einem Satz:** R-0109 („Zwei Personen arbeiten in Echtzeit am selben Entwurf oder
Wissensobjekt“) ist **nicht entschieden**. Die Quellen bestellen keine Umsetzung. Das Produkt hat
heute aber schon drei Teilwege, die nahe daran liegen. Welcher Umfang gelten soll, muss der Owner
entscheiden. Dieser Auftrag baut deshalb nichts.

## 1 · Der Originalpunkt

Quelle: `REGISTER-SNAPSHOT.json`, `$.eintraege[108]`, id `R-0109` (Alias `F-0109`), aufgenommen am
22.09.2026, zuletzt aktualisiert am 05.09.2026.

| Feld | Wortlaut / Wert |
|---|---|
| Satz | „Zwei Personen arbeiten in Echtzeit am selben Entwurf oder Wissensobjekt.“ |
| Bereich | Erfassen |
| Zustand / Prüfstatus | `angedacht` / `nur_altquelle` |
| Herkunft (25.06.2026) | `specs/stories/capture.md`, Nicht-Ziele v1: „Echtzeit-Kollaboration am selben Entwurf (gleichzeitiges Editieren)“. `specs/stories/structure.md` führt „kollaboratives Live-Editing“ ebenfalls als Nicht-Ziel. |
| Altbestand F-0109 | Status `VERWORFEN`, Begründung „nicht dokumentiert – als Nicht-Ziel der Version 1 gesetzt“, `kundenrelevant: true` |
| Entscheidung | `entscheidung: null`, `entscheidungen: []`, `pedi_override: null` |
| Abgrenzung (Notiz) | Nicht zu verwechseln mit „Zwei Menschen gleichzeitig: keine Fassung geht still verloren“. Dort geht es nicht um gemeinsames Editieren, sondern darum, dass beim Aufeinandertreffen zweier Speichervorgänge nichts still verschwindet. |

## 2 · Die offene Geltungs- und Umfangsfrage (K1, K2)

**Frage:** Gehört gleichzeitiges Bearbeiten durch zwei Personen zum Produktumfang? Und wenn ja: in
welcher Form, und für welche Objekte (Erfassungsentwurf, Artikel, Office-Anhang)?

Die Quellen nennen dazu nur den Satz und das Nicht-Ziel v1. Die Alternativen unten sind am heutigen
Bestand abgeleitet und keine neuen Anforderungen.

| Alternative | Inhalt | Was davon heute schon da ist | Was bei dieser Wahl offen wäre |
|---|---|---|---|
| **A · Nicht-Ziel bestätigen** | Das Nicht-Ziel v1 gilt weiter. R-0109 wird geschlossen; geschützt ist nur das Nacheinander-Speichern (Abschnitt 3). | alles aus Abschnitt 3 | nichts; die Spezifikationen bleiben, wie sie sind |
| **B · Heutigen Stand als Erfüllung werten** | „Gleichzeitig“ heißt: beide arbeiten zur selben Zeit am selben Artikel, sehen einander und verlieren nichts. Echtzeit gibt es nur im Office-Editor, sonst Abruf alle 5 s und Zusammenführen beim Speichern. | gemeinsamer Artikelentwurf, Bearbeitungshinweis, Office-Sitzung (Abschnitt 4) | Die Erfassungsentwürfe (Bereich „Erfassen“, den R-0109 nennt) haben weiter keinen gemeinsamen Weg, nur den Konfliktschutz. Die Nicht-Ziele in `capture.md`/`structure.md` wären nachzuziehen. |
| **C · Gemeinsamen Weg auf Erfassungsentwürfe ausdehnen** | Den vorhandenen Abschnitt-Zusammenführungsweg aus `gemeinsamer-entwurf.ts` auch für Pool-Entwürfe (FR-CAP-06) nutzen. Weiterhin keine Zeichen-für-Zeichen-Echtzeit. | Pool-Entwürfe, `DRAFT_STALE` | Umsetzung an Pool, Blatt und Mobil; Mobil/Offline schicken heute keinen gesehenen Stand mit (Abschnitt 3). |
| **D · Echte Echtzeit (Live-Co-Editing) im Klarwerk-Editor** | Gleichzeitiges Tippen, gegenseitige Cursor und sofortige Übertragung im eigenen Rich-Text-Editor. | nichts: kein WebSocket, kein Server-Sent-Event-Kanal, kein CRDT/OT im Code | eigener großer Bau (Übertragungskanal, Mehrprozessbetrieb, Rechte je Änderung, Verlauf); widerspricht dem Nicht-Ziel v1 |

**Noch erforderliche Entscheidung (Owner):**

1. Gilt das Nicht-Ziel v1 noch (A), oder ist es durch die Lieferungen aus Abschnitt 4 überholt (B)?
2. Falls nicht A: Gehört der Erfassungsentwurf dazu (C), oder reicht der Artikel?
3. Ist Echtzeit im engen Sinn (D) überhaupt verlangt, oder genügt „gleichzeitig ohne stillen
   Verlust“?

**Eindeutig bestellter Anteil:** keiner. R-0109 steht auf `angedacht`, ein Zielzustand oder eine
Entscheidung ist nicht hinterlegt. Gebaut wird deshalb nichts. In den beiden Spezifikationen steht
jetzt ein Verweis auf dieses Dokument; das Nicht-Ziel selbst ist unverändert.

## 3 · Abgrenzung: „keine Fassung geht still verloren“ (nicht R-0109)

Dieser Schutz gehört zum gesonderten Auftrag `aufnahme:20260922:gesamt-entwurf-datenerhalt`
(R-0074, „überholter Entwurf als eigener Fehlerfall“). Dort ist er laut
`tests/entwurf-datenerhalt/README.md` als „bereits geliefert“ geführt: JOB 2684 D9 `c393f26d`
(`DRAFT_STALE`), Mobil/Desktop JOB 4193 D6 `e12d1849` · 1.0.0-beta.1.539. Dieser Auftrag ändert
daran nichts.

So funktioniert er heute (Quelle `services/capture/src/service.ts`, `pruefeStand`/`continueDraft`):

- Studio und Vordertür schicken den gesehenen Stand (`expectedUpdatedAt`) mit. Bei Abweichung kommt
  `DRAFT_STALE`; es wird nichts gemischt und nichts überschrieben.
- Geschrieben wird bedingt in der Ablage (`updateWennStand`), auch über zwei Serverprozesse hinweg.
- **Grenze:** Mobil und die Offline-Warteschlange schicken keinen Stand mit. Für sie gilt weiter „letzter
  Schreiber gewinnt“, Feld für Feld zusammengeführt. Das ist im Code so dokumentiert.

Das ist **Konfliktschutz beim Nacheinander-Speichern, kein gemeinsames Bearbeiten**. Er beantwortet
R-0109 nicht.

## 4 · Was heute geliefert ist und R-0109 berührt (K3)

Alle drei Wege sind von anderen Aufträgen gebaut. Dieser Auftrag hat sie weder geändert noch neu
gebaut.

| Weg | Auftrag | Was er leistet | Echtzeit? | Beleg im Baum |
|---|---|---|---|---|
| **Gemeinsamer Artikelentwurf** | `produkt:20261007:artikel-gemeinsam` | Mehrere Berechtigte bearbeiten eine Arbeitsfassung desselben Artikels (Wissensobjekts), erreichbar aus dem Artikelgespräch und vom Artikel. Beim Speichern wird abschnittsweise drei-Wege-zusammengeführt; derselbe Abschnitt verschieden geändert ergibt `409` mit Wahl. Die Lesefassung bleibt bis zur Übernahme (`expectedVersion`). | **nein.** Die Seite fragt alle 5 s nach (`ABRUF_MS` in `apps/web/src/pages/GemeinsamerEntwurf.tsx`), zusammengeführt wird beim Speichern. | `services/app/src/gemeinsamer-entwurf.ts`; Tests `tests/artikel-gemeinsam/gemeinsam-am-server.test.ts` S1–S7, `zusammenfuehrung.test.ts` Z1–Z7, `gemeinsam-pg.integration.test.ts`, Smoke `tests-smoke/artikel-gemeinsam-browser.spec.ts` |
| **Bearbeitungshinweis** | Wiki-Bearbeitungsreservierung | Zeigt, wer gerade einen Eintrag bearbeitet (Erneuerung 30 s, Ablauf 120 s). Hinweis, keine Sperre. | Anwesenheit ja, Inhalt nein | `services/app/src/bearbeitungshinweis.ts`; `tests/wiki-bearbeitungsreservierung/hinweis-am-server.test.ts` S1–S6 |
| **Office im Artikel** | `produkt:20261007:office-artikel-editor` | Word/Excel/PowerPoint-Anhang im eingebetteten Collabora-Editor (WOPI). Mehrere Nutzer teilen **eine** Editor-Sitzung je Datei. | **ja, aber nur für den Office-Anhang**, nicht für Artikeltext oder Erfassungsentwurf | `docs/entscheidungen/office-im-artikel-integrationsweg.md` §5.2 und §9; `tests/office-artikel-editor/office-routes.test.ts` O4 |

**Fassung:** Die Auslieferungsfassung dieser drei Wege konnte in diesem Arbeitsgang nicht aus der
Git-Historie gelesen werden. Belegt ist nur, dass alle drei im Basisstand `81f9152d`
(1.0.0-beta.1.952) enthalten sind. Der Lieferbeleg für dieses Dokument entsteht erst mit seiner
Veröffentlichung.

**Nicht vorhanden:** Echtzeitbearbeitung des Artikeltexts oder eines Erfassungsentwurfs. Im Code
gibt es keinen WebSocket, keinen Server-Sent-Event-Kanal und keine CRDT/OT-Bibliothek.

## 5 · Quellenwidersprüche und fehlende Belege

- **„Alte Pedi-Auswahl“:** Der Hinweis an R-0109 sagt, „eine alte Pedi-Auswahl bleibt unten als
  historische Entscheidung erhalten“. Im Eintrag stehen aber `entscheidung: null`, `entscheidungen: []`
  und `pedi_override: null`. Eine Pedi-Auswahl zu R-0109 ist in der Quelle **nicht vorhanden**.
- **„VERWORFEN“ gegen „angedacht“:** Der Altbestand F-0109 steht auf `VERWORFEN`, der Registereintrag
  auf `angedacht` mit Prüfstatus `nur_altquelle`. Laut Hinweis ist der Altstand kein heutiger Nachweis;
  eine jüngere Einordnung fehlt.
- **Begründung fehlt:** Für das Nicht-Ziel v1 gibt es keine dokumentierte Begründung, auch
  `user_value` sagt nur „Begründung nicht dokumentiert“.
- **Nicht-Ziel gegen Bestand:** `capture.md` und `structure.md` führen Echtzeit-Kollaboration bzw.
  kollaboratives Live-Editing als Nicht-Ziel. Gleichzeitig sind seit Oktober 2026 der gemeinsame
  Artikelentwurf und die gemeinsame Office-Sitzung (mit Echtzeit) geliefert. Ob diese Lieferungen das
  Nicht-Ziel ablösen, ist nirgends entschieden.
- **Bereich:** R-0109 steht unter „Erfassen“, nennt aber „Entwurf oder Wissensobjekt“. Die gelieferten
  Teilwege liegen alle am Wissensobjekt (Artikel), keiner am Erfassungsentwurf.
- **Altquelle nicht zugänglich:** Der Beleg `FUNKTIONSREGISTER.json:2554` liegt außerhalb dieses
  Repositorys und wurde nicht gelesen.

## 6 · Grenzen dieses Arbeitsgangs

- Quelleninspektion an Code, Tests und Dokumenten im Basisstand. In diesem Arbeitsgang sind keine
  Tests gelaufen; die Auswahl in `PRUEFPLAN.json` belegt die Aussagen zu Abschnitt 3 und 4 am
  Kandidaten.
- Nicht geprüft: echte gleichzeitige Bedienung durch zwei Menschen, der Office-Weg mit echtem
  Collabora-Dienst und die Smoke-Fälle von `artikel-gemeinsam`. Sie gehören zu den genannten
  Aufträgen.
