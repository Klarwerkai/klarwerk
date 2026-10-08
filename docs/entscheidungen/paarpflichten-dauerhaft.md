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

Tabelle `conflict_pair_obligations` (in `CONFLICTS_SCHEMA`, dieselbe Migrationsstufe wie
`conflicts` und `conflict_pair_memory`): `id` (`<laufId>#<pairKey>`, Primärschlüssel), `lauf_id`,
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
| `fehlversuche`, `angelegt`, `aktualisiert` | Zähler und Zeitstempel | neu |

**Kein Text.** Gespeichert werden Kennungen und Fingerabdrücke, keine Kerntexte, keine
Modellbegründung, keine Fehlermeldung eines Prüfers (geworfene Fehler werden als
`pruefer_ausnahme` vermerkt). Das folgt dem Prüfgedächtnis (`pair-memory.ts`).

**Lauf ist an seine Stände gebunden.** Wird ein Lauf erneut mit anderen Ständen oder anderem
Kontext geplant, wirft `planen` `LAUF_STAND_ABWEICHUNG` — keine stille Umdeutung gespeicherter
Pflichten. Eine neue Fassung ist ein neuer Lauf.

## 3. Ausführungsvertrag (API)

Modul `services/conflicts` (modul-rein, kennt `knowledge-object` nicht):

| API | Vertrag |
|---|---|
| `paarpflichtenPlanen(laufId, aussagen, kontext, jetzt)` | rein; alle Paare; doppelte Kennung → `AUSSAGE_DOPPELT`, weniger als zwei → `ZU_WENIG_AUSSAGEN` |
| `PaarpflichtService.planen(laufId, aussagen, kontext)` | einfügen, wenn nicht vorhanden; wiederholbar; prüft Standbindung |
| `PaarpflichtService.abarbeiten(laufId, pruefer, { limit? })` | beansprucht je Schritt **eine** Pflicht mit Frist, fragt den Prüfer, schließt per Compare-and-Set (Token) ab; eine Pflicht höchstens einmal je Aufruf |
| `PaarpflichtService.bilanz(laufId)` | `gesamt`, `offen`, `inArbeit`, `geurteilt`, `unbestimmt`, `fehler`, `ohneModell`, `rest`, `abgeschlossen` |
| `PaarpflichtPruefer(a, b, kontext)` | liefert `urteil` (mit `modell`), `unbestimmt` (mit `modell`), `kein_modell` oder `fehler`; muss genau die gespeicherten Fassungen beurteilen, sonst `fehler` |
| `ergebnisAusKonfliktUrteil(ausgang, modell)` | Abbildung des Reasoner-Ausgangs: `no-model`/`confidential` → `kein_modell`; anderes `null` → `fehler`; `unsicher` oder Widerspruch/Überholt unter `CONFLICT_MIN_CONFIDENCE` → `unbestimmt`; sonst `urteil` |
| `InMemoryPaarpflichtRepo`, `PgPaarpflichtRepo` | gleiche Vertragsfläche; Postgres beansprucht mit `FOR UPDATE SKIP LOCKED` |

App-Root (`services/app/src/paarpflicht-aussagen.ts`): `paarpflichtAussagenLaden(ko, ids,
pruefFassung)` liest die Aussagen im jetzigen Stand und den Bestandsstempel; eine unbekannte
Kennung bricht ab.

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

**Grenze, ehrlich:** Die abgestürzte Pflicht wird dem Modell ein zweites Mal vorgelegt (das erste
Ergebnis wurde nie geschrieben). Ebenso, wenn ein Prüfer länger als die Frist braucht und ein
anderer Lauf übernimmt — dann gibt es zwei Modellaufrufe, aber nur ein gespeichertes Urteil.

## 6. Migrationsgrenzen und Abgrenzung

- **Rein additiv:** eine neue Tabelle, keine Änderung an `conflicts`, `conflict_pair_memory`,
  `ko_versions`, Kanten oder `aiCheck`. Kein Altbestand wird umgedeutet; es gibt keine
  Rückwärtsbefüllung.
- **Rechte und Freigaben unverändert:** Die Pflichten berühren weder `KoStatus` noch `ko.validate`,
  `conflict.resolve` oder `oeffentlicheKiErlaubt`. Ob ein vertrauliches Paar an ein Modell darf,
  entscheidet weiter der Reasoner; ohne zulässiges Modell entsteht `kein_modell`.
- **Ablage:** Die Tabelle steht in `PFLICHTTABELLEN` (`scripts/backup/restore-drill.sh`) und im
  `BESTANDSRESET_LOESCHGRAPH` (fällt mit dem Wissen).
- **Keine Graphdatenbank:** Paare sind Zeilen; der bestehende Graph (`ko_kanten`) bleibt unberührt.

## 7. Nicht gebaut (offen)

- **Keine Verdrahtung in Worker, Route oder Oberfläche.** Es gibt keinen Endpunkt, der einen Lauf
  startet, keinen Job, der ihn im Hintergrund abarbeitet, und keine Anzeige der Bilanz. Die
  Kompositionswurzel (`build-app.ts`) und das Dev-Journal kennen das Register nicht.
- **Keine Vollpaarprüfung des Bestands.** Der Nachtrag zu KW-DKP-00 schließt sie aus (Istvertrag,
  Abschnitt 5). Wer welche Aussagemenge als Lauf wählt, ist nicht entschieden.
- **Prüfer gegen den Reasoner** ist nur als Abbildung (`ergebnisAusKonfliktUrteil`) gebaut; der
  Modellbeleg muss vom Aufrufer kommen, weil `ConflictJudgeOutcome` keine Modellkennung trägt.
- **Nicht gemessen:** ein echtes Modell, ein echter Prozessabbruch (der Test bricht den Abschluss
  ab und startet mit neuem Pool neu), Laufkosten an großem Bestand.
