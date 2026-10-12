# Aussage-Paarpflichten — dauerhaft und wiederaufnehmbar

*Aufnahme 20260922 · paarpflichten-dauerhaft (G2, KW-DKP). Basis `c3877786` (`1.0.0-beta.1.779`),
08.10.2026. Grundlage ist der Istvertrag `docs/entscheidungen/wissenspruefung-istvertrag.md`: Er
hält fest, dass kein Weg „jeder gegen jeden" prüft (Abschnitt 3), dass ungeprüfte Paare nicht
benennbar sind (question:K15, „Ungeprüfte Paare") und dass ein Paarnachweis fehlt (Abschnitt 3,
„Neuer Implementierungsbedarf"). Diese Lieferung baut den Paarnachweis als Datenvertrag und
Ausführungsweg. Code: `services/conflicts/src/paarpflichten.ts`, Brücke
`services/app/src/paarpflicht-aussagen.ts`. Belege: `tests/wissenspruefung-paarpflichten/`.*

## 1. Was eine Paarpflicht ist

Für eine **gewählte Aussagemenge** (Lauf) ist jedes ungeordnete Paar zweier Aussagen eine Pflicht:
n Aussagen ergeben genau n·(n−1)/2 Pflichten, kein Selbstpaar, keine Reihenfolge (`a.refId <
b.refId`, Paarschlüssel wie das Prüfgedächtnis: `memoryKey`). Es gibt **keine Vorauswahl** und
**kein Kandidatenlimit** beim Planen. `DETECTION_CANDIDATE_CAP` und `CANDIDATE_LIMIT` bleiben, was
sie sind (Vorauswahl der Erkennung bzw. Vorschau); für Pflichten begrenzt ein Limit nur, wie viele in
**einem Schritt** abgearbeitet werden. Der Rest bleibt gezählt (`bilanz.rest`).

## 2. Datenvertrag

Tabellen in `CONFLICTS_SCHEMA` (dieselbe Migrationsstufe wie `conflicts` und
`conflict_pair_memory`):

- `conflict_pair_obligation_runs` — Laufkopf: `lauf_id` (Primärschlüssel), `data jsonb` mit der
  **Bindung** des Laufs: Aussagemenge (je Aussage Kennung, Version, Quellrevision, Quellen,
  Kontext; nach Kennung sortiert) und Laufkontext (Bestandsstempel, Prüffassung).
- `conflict_pair_obligations` — Pflichten: `id` (`<laufId>#<pairKey>`, Primärschlüssel), `lauf_id`,
  `pair_key`, `UNIQUE (lauf_id, pair_key)`, `data jsonb`.

| Feld | Inhalt | Herkunft (wiederverwendet) |
|---|---|---|
| `a`, `b` · `refId` | Kennung der Aussage | `KnowledgeObject.id` |
| `a`, `b` · `version` | Aussageversion | `KnowledgeObject.version` |
| `a`, `b` · `quelle` | Quellrevision: Fingerabdruck aus Fassung, Quellen und Anhängen | Prüfbasis-Teil `quelle` (`pruefbasisVon`, `services/knowledge-object/src/pruefbasis.ts`) |
| `a`, `b` · `quellen` | Kennungen der gebundenen Quellen und Anhänge, sortiert | `KnowledgeObject.sources`/`attachments` |
| `a`, `b` · `kontext` | Fingerabdruck von Kategorie, Schlagworten, Anlage, Vertraulichkeit | Prüfbasis-Teil `kontext` |
| `kontext.bestand` | Bestandsstempel bei der Planung | `KoService.pruefbestandStempel` / `bestandsStempelVon` |
| `kontext.pruefFassung` | Fassung der Prüfanweisung | vom Aufrufer gesetzt |
| `zustand` | `offen` · `in_arbeit` · `geurteilt` · `unbestimmt` · `fehler` | neu |
| `beansprucht` | `{ token, bis }` während `in_arbeit` | neu |
| `urteil` | `{ ergebnis, modell, sicherheit?, at }` — nur bei `geurteilt`/`unbestimmt` | neu |
| `hinweis` | `{ art: fehler \| kein_modell, grund, at }` | neu |
| `vorlagen` | wie oft die Pflicht einem Prüfer vorgelegt wurde — Grundlage der fairen Auswahl | neu |
| `fehlversuche`, `angelegt`, `aktualisiert` | Zähler und Zeitstempel | neu |

**Kein Text.** Gespeichert werden Kennungen und Fingerabdrücke, keine Kerntexte, keine
Modellbegründung, keine Fehlermeldung eines Prüfers (geworfene Fehler werden als
`pruefer_ausnahme` vermerkt). Das folgt dem Prüfgedächtnis (`pair-memory.ts`).

**Lauf ist an seine Bindung gebunden.** Wird ein Lauf erneut mit anderer Aussagemenge, anderen
Ständen oder anderem Kontext geplant, wirft `planen` `LAUF_STAND_ABWEICHUNG` — keine stille
Umdeutung oder Erweiterung gespeicherter Pflichten. Eine neue Fassung ist ein neuer Lauf.

**Atomar (Nacharbeit 1, bens Befund zu `cfc43d4a`).** Bindung prüfen und Pflichten anlegen ist
EIN Schritt: in Postgres eine Transaktion (Kopf `INSERT … ON CONFLICT DO NOTHING`, dann
`SELECT … FOR UPDATE`, Vergleich, erst dann die Pflichten), im Speicher ein Abschnitt ohne
Unterbrechung. Ein abgewiesener Aufruf schreibt nichts; zwei gleichzeitige Planungen desselben
Laufs reihen sich am Kopf, die zweite sieht die Bindung der ersten. Vorher schrieb `planen` neue
Paare vor der Prüfung und hinterließ bei Abweisung einen gemischten Lauf.

## 3. Ausführungsvertrag (API)

Modul `services/conflicts` (modul-rein, kennt `knowledge-object` nicht):

| API | Vertrag |
|---|---|
| `paarpflichtenPlanen(laufId, aussagen, kontext, jetzt)` | rein; alle Paare; doppelte Kennung → `AUSSAGE_DOPPELT`, weniger als zwei → `ZU_WENIG_AUSSAGEN` |
| `PaarpflichtService.planen(laufId, aussagen, kontext)` | atomar über `PaarpflichtRepo.planen(laufkopf, pflichten)`; wiederholbar mit gleicher Bindung; andere Bindung → `LAUF_STAND_ABWEICHUNG`, nichts geschrieben |
| `PaarpflichtService.abarbeiten(laufId, pruefer, { limit? })` | beansprucht je Schritt **eine** Pflicht mit Frist, fragt den Prüfer, schließt per Compare-and-Set (Token) ab; eine Pflicht höchstens einmal je Aufruf; Auswahl: seltenste `vorlagen` zuerst, dann Paarschlüssel |
| `PaarpflichtService.offeneLaeufe()`, `laufkopf(laufId)` | Läufe mit offener, beanspruchter oder wiederholbarer Arbeit (Wiederaufnahme); die gespeicherte Bindung |
| `PaarpflichtService.bilanz(laufId)` | `gesamt`, `offen`, `inArbeit`, `geurteilt`, `unbestimmt`, `fehler`, `ohneModell`, `rest`, `abgeschlossen` |
| `PaarpflichtPruefer(a, b, kontext)` | liefert `urteil` (mit `modell`), `unbestimmt` (mit `modell`), `kein_modell` oder `fehler`; muss genau die gespeicherten Fassungen beurteilen, sonst `fehler` |
| `ergebnisAusKonfliktUrteil(ausgang, modell)` | Abbildung des Reasoner-Ausgangs: `no-model`/`confidential` → `kein_modell`; anderes `null` → `fehler`; `unsicher` oder Widerspruch/Überholt unter `CONFLICT_MIN_CONFIDENCE` → `unbestimmt`; sonst `urteil` |
| `InMemoryPaarpflichtRepo`, `PgPaarpflichtRepo` | gleiche Vertragsfläche; Postgres beansprucht mit `FOR UPDATE SKIP LOCKED` |

App-Root (`services/app/src/paarpflicht-aussagen.ts`): `paarpflichtAussagenLaden(ko, ids,
pruefFassung)` liest die Aussagen im jetzigen Stand und den Bestandsstempel; eine unbekannte
Kennung bricht ab.

### Ausführungsweg (Nacharbeit 1, bens Befund zu `cfc43d4a`)

| Teil | Ort | Vertrag |
|---|---|---|
| Ablage | `AppRepos.paarpflichten` (`build-app.ts`): `PgPaarpflichtRepo` in `buildPgServices`, `InMemoryPaarpflichtRepo` sonst; Dev-Journal (`dev-persist.ts`) für `planen`, `beanspruchen`, `abschliessen` | derselbe Repo-Satz wie alle anderen Ablagen |
| Dienst | `AppServices.paarpflichten` | `PaarpflichtService` über der Ablage |
| Prüfer | `paarpflichtPrueferFuer({ ko, reasoner })` (`services/app/src/paarpflicht-ausfuehrung.ts`) | lädt beide Aussagen; fehlt eine → `fehler: aussage_fehlt`; weicht Version, Quellrevision, Quellen oder Kontext von der gespeicherten Fassung ab → `fehler: fassung_ueberholt` (kein Urteil unter altem Stand). Sonst `reasoner.judgeConflictOutcome(Kerntext A, Kerntext B, "de", vertraulich)` → `ergebnisAusKonfliktUrteil(…, "reasoner:konfliktpruefung")` |
| Ausführung | `createPaarpflichtAusfuehrung` — in `buildApp` aus `services.reasoner` gebaut (wie der KI-Prüf-Worker) | In-Process, ein Lauf zur Zeit. Runden ohne Limit; weiter, solange eine Runde etwas entschieden hat; eine Runde nur mit „kein Modell" beendet den Durchgang (keine Endlosschleife). Bleibt eine fremd beanspruchte Pflicht, folgt ein Wiederanstoß nach Fristablauf |
| Wiederaufnahme | `buildApp` ruft `wiederaufnehmen()` | liest `offeneLaeufe()` aus der Ablage und reiht jeden Lauf ein |
| Routen | `services/app/src/routes/paarpflichten-routes.ts` | `POST /api/paarpflichten/laeufe` `{ aussagen: string[] }` → `202 { laufId, bilanz }`; `GET /api/paarpflichten/laeufe/:laufId`; `POST /api/paarpflichten/laeufe/:laufId/fortsetzen`. Recht `ko.validate` (wie `POST /api/kos/:id/ai-check` mit Vollabgleich), jede Aussage zusätzlich `darfSehen`; nicht sichtbar = nicht gefunden (404). Mindestens zwei verschiedene Kennungen, sonst 400. Antworten nur mit Kennungen und Zählwerten |

Es gibt **keine** Wahl „ganzer Bestand" und **keinen** automatischen Start: Läufe entstehen nur aus
einer ausdrücklichen Auswahl; die Wiederaufnahme setzt nur Begonnenes fort.

## 4. Zustände und Zählung

- **geurteilt** — ein Modell hat ein Fachurteil gegeben. Ohne nicht-leeren Modellbeleg ist ein
  gemeldetes Urteil keins und wird `fehler` (`urteil_ohne_modell`).
- **unbestimmt** — ein Modell hat geantwortet, aber kein belastbares Urteil; gespeichert, nicht
  wiederholt, getrennt gezählt.
- **fehler** — technischer Fehler; bis `PAARPFLICHT_MAX_FEHLVERSUCHE` (3) erneut beanspruchbar,
  danach bleibt er stehen. Nicht Teil von `rest`, aber verhindert `abgeschlossen`.
- **offen** mit `hinweis.art = kein_modell` — **kein Modellaufruf, kein Urteil**: bleibt offen,
  zählt in `rest` und `ohneModell`, nie als abgeschlossen.
- `abgeschlossen` heißt: jede Pflicht trägt ein gespeichertes Modellurteil (`geurteilt` oder
  `unbestimmt`), kein Fehler, kein Rest. Es ist **keine Freigabe**.

## 5. Absturz und Wiederaufnahme

Beanspruchen setzt `in_arbeit` mit `bis = jetzt + PAARPFLICHT_FRIST_MS` (5 min). Stirbt der Prozess
zwischen Modellaufruf und Abschluss, bleibt höchstens **eine** Pflicht `in_arbeit`; nach Fristablauf
nimmt jeder Lauf sie wieder auf. Ein verspäteter Abschluss mit dem alten Token schreibt nichts
(`verworfen`). Damit ist je Pflicht höchstens **ein Urteil gespeichert**.

**Faire Auswahl (Nacharbeit 1, bens Befund zu `cfc43d4a`).** Jede Beanspruchung erhöht den
gespeicherten Zähler `vorlagen`; gewählt wird die am seltensten vorgelegte beanspruchbare Pflicht,
bei Gleichstand nach Paarschlüssel. Eine Pflicht, die ohne Modell offen blieb, kommt erst wieder
an die Reihe, wenn jede andere ebenso oft vorlag — über Aufrufe mit `limit` und über Neustarts
hinweg. Vorher wählten beide Ablagen nach Paarschlüssel, und drei Pflichten ohne Modell verdrängten
bei `limit` 3 dauerhaft alle übrigen.

**Grenze, ehrlich:** Die abgestürzte Pflicht wird dem Modell ein zweites Mal vorgelegt (das erste
Ergebnis wurde nie geschrieben). Ebenso, wenn ein Prüfer länger als die Frist braucht und ein
anderer Lauf übernimmt — dann gibt es zwei Modellaufrufe, aber nur ein gespeichertes Urteil.

## 6. Migrationsgrenzen und Abgrenzung

- **Rein additiv:** zwei neue Tabellen (Laufkopf, Pflichten), keine Änderung an `conflicts`,
  `conflict_pair_memory`, `ko_versions`, Kanten oder `aiCheck`. Kein Altbestand wird umgedeutet;
  es gibt keine Rückwärtsbefüllung.
- **Rechte und Freigaben unverändert:** Die Pflichten berühren weder `KoStatus` noch `ko.validate`,
  `conflict.resolve` oder `oeffentlicheKiErlaubt`. Ob ein vertrauliches Paar an ein Modell darf,
  entscheidet weiter der Reasoner; ohne zulässiges Modell entsteht `kein_modell`.
- **Ablage:** Beide Tabellen stehen in `PFLICHTTABELLEN` (`scripts/backup/restore-drill.sh`) und im
  `BESTANDSRESET_LOESCHGRAPH` (fallen mit dem Wissen).
- **Keine Graphdatenbank:** Paare sind Zeilen; der bestehende Graph (`ko_kanten`) bleibt unberührt.

## 7. Nicht gebaut (offen)

- **Keine Bedienfläche.** Läufe entstehen über die Routen (Abschnitt 3); einen Knopf im Prüfbrett
  und eine Anzeige der Bilanz gibt es nicht.
- **Keine Vollpaarprüfung des Bestands.** Der Nachtrag zu KW-DKP-00 schließt sie aus (Istvertrag,
  Abschnitt 5). Welche Aussagemengen als Lauf gewählt werden sollen und ob es eine Obergrenze je
  Lauf gibt, ist nicht entschieden — gebaut ist nur die ausdrückliche Wahl durch `ko.validate`.
- **Modellbeleg:** `ConflictJudgeOutcome` trägt keine Modellkennung; gespeichert wird der Weg
  `reasoner:konfliktpruefung`, nicht das konkrete Modell.
- **KI-Anfragebremse:** Die neuen Routen stehen nicht in `KI_ROUTEN` (`ki-anfragebremse.ts`). Die
  Liste ist durch `tests/integrations-api/ki-bremse-angemeldet.test.ts` wortgleich festgeschrieben
  und gehört einem anderen Auftrag; ob die Laufanlage gebremst werden soll, ist zu entscheiden.
- **Nicht gemessen:** ein echtes Modell, ein echter Prozessneustart (gemessen sind ein
  Instanzwechsel auf derselben Postgres-Datenbank im selben Node-Prozess und der
  Dev-Journal-Wiederaufbau), Laufkosten an großem Bestand.
