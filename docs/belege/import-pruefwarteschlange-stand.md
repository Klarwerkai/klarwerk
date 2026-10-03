# Import-Prüfwarteschlange: Stand je Anliegen

Auftrag `aufnahme:20260922:gesamt-import-adoption:pruef-warteschlange` (Revision 3).
Fassung: Basis `16aaaf97` (1.0.0-beta.1.664) plus die Änderung aus diesem Auftrag.
Grundlage ist die Quelleninspektion. Ausgeführte Tests stehen hier nicht. Die führt die Cloud aus
(Testdateien siehe unten).

## Bereits geliefert und nicht neu gebaut

| Anliegen | Stand | Beleg (Codestelle / Test) |
|---|---|---|
| R-1734 Kandidaten erzeugen + Queue | geliefert | `services/library-analytics/src/service.ts:531` `createImportCandidates` (Status `neu`, `koId: null`); Route `POST/GET /api/library/import/candidates` `services/app/src/routes/library-routes.ts:805-844`; Oberfläche `apps/web/src/pages/Stufe2.tsx:1096`, `apps/web/src/api/endpoints.ts:1014-1020`; Test `tests/import-kandidaten-echt/entscheidung-am-echten-dienst.test.ts` (L2/L3) |
| R-1735 annehmen/ablehnen/Info anfordern | geliefert | `service.ts:1117` `reviewImportCandidate` (Status `angenommen`/`abgelehnt`/`info-angefragt`, Prüfer an `reviewedBy`); Route `PUT /api/library/import/candidates/:id` verlangt `ko.validate` und prüft die Aktion gegen eine Positivliste (`library-routes.ts:877-893`); Schaltflächen `Stufe2.tsx:1032-1056`; Test L4/L5/F1-F3 der o. g. Datei |
| R-0143 Erst menschliche Übernahme erzeugt Wissensobjekt | geliefert für die Warteschlangenwege | Nur `accept` ruft `acceptToKo` (`service.ts:1186`, `:1509`); Test `tests/import-kandidaten-echt/annahme-in-validierung.test.ts` W1/W2 |
| R-1736 Angenommen → Validierung/Wissensobjektfluss | geliefert | Erstanlage über `koService.create` → `buildCreatedKo` (`services/knowledge-object/src/service.ts:2045-2052`: `trust 0`, `status offen`, `assignments []`); das Validierungs-Board liest `status offen` (`services/validation/src/service.ts:496-497`); Test W3 |
| R-0180/R-2108 ungeprüft + Originalquelle | geliefert für externe Quellen | Herkunftsanker `buildSource` (`service.ts:1757-1777`: `url` (bereinigt), `kind external`, `peerValidated false`, `provider`, `externalId`, `sourceVersion`), wenn `externalUpsert` aktiv ist (`services/app/src/build-app.ts:1037-1049`: Confluence- oder SharePoint-Schalter); Test W4 |

## Welche Importwege außer Confluence schon über die Warteschlange laufen

- **Confluence**: `services/app/src/confluence-import.ts:251` und `routes/confluence-import-routes.ts:1274`.
- **SharePoint**: `services/app/src/routes/sharepoint-import-routes.ts:537` (`createImportCandidates([item], user.id)`).
- **JSON-Upload der Oberfläche**: `Stufe2.tsx:1096` → `POST /api/library/import/candidates` (`library-routes.ts:816`).
- **Demo-Korpus**: `services/app/src/demo-corpus.ts:14-15` (Kandidat → `accept`).

- **Direkter API-Eingang `POST /api/library/import`** (Nacharbeit 1, bens F1): Bis Kandidat
  `1d1cc373` legte er über `LibraryService.importJson` Wissensobjekte direkt an. Jetzt reiht er über
  dieselbe Einreihstelle wie der Kandidatenweg ein (`einreihen` in `library-routes.ts`, gleiche
  Dublettenregel). Die Antwort nennt `imported: 0`, `uebersprungen`/`skipped` (Einträge, aus denen
  auch eine Annahme kein Objekt macht), `eingereiht` und `kandidaten`. Ein Objekt entsteht erst
  durch `PUT /api/library/import/candidates/:id` (Recht `ko.validate`). Gegenprobe:
  `tests/import-kandidaten-echt/direkter-import-reviewpflicht.test.ts` D1–D3. Die Dienstmethode
  `importJson` bleibt bestehen, hat aber keinen Produktaufrufer mehr.

## In diesem Auftrag ergänzt: Kennzeichnung „importiert“ (R-0180/R-2108)

Vorher trug das angenommene Objekt keine Herkunft. Das Prüf-Board zeigte deshalb „Herkunft
unbekannt“ (`services/validation/src/board-herkunft.ts:128`).

- `origin: "import"` bei der Erstanlage aus der Annahme (`service.ts:1676`). Die Wertmenge steht in
  `services/knowledge-object/src/types.ts` (Modell) und in `apps/web/src/api/types.ts`.
- Die öffentlichen Schreibwege `POST /api/kos` und der frische Zweig des Dokumentwegs verwerfen
  `origin: "import"` aus dem Rumpf (`ohneImportHerkunft` in `services/app/src/routes/ko-routes.ts`).
  Andere Herkunftswerte bleiben erhalten. Ein Entwurf kann den Wert nicht tragen, denn
  `ERLAUBTE_HERKUNFT` in `services/capture` ist unverändert.
- Das Prüf-Board beschriftet die Herkunft mit `ko.origin.import` („Importiert“/„Imported“/„Geïmporteerd“)
  (`apps/web/src/lib/boardAuskunft.ts`, `apps/web/src/i18n.ts`).
- Tests: `tests/import-kandidaten-echt/annahme-in-validierung.test.ts` W3/W6/W7 und
  `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` (Fall `import`).

## Nacharbeit 1: Originalquelle unabhängig vom Anker-Schalter (bens F2)

Eine mitgelieferte, sichere URL (`safeSourceUrl`: absolut, http/https) bleibt jetzt auch OHNE
`externalId` oder bei ausgeschaltetem `externalUpsert` als Quelle am angenommenen Objekt
(`originalquelleOhneAnker` in `services/library-analytics/src/service.ts`). Diese Quelle trägt
bewusst keine `externalId`/`sourceVersion` und ist damit kein Re-Sync-Anker. Eine unsichere URL
(z. B. `javascript:`) erzeugt keine Quelle. Gegenprobe: `annahme-in-validierung.test.ts` W5a–W5c.

## Was von der Kandidatenannahme weiterhin gilt bzw. offen bleibt

1. **Validierungszuweisung**: Die Annahme weist niemanden automatisch zu. Den Prüfer wählt ein
   Mensch über den regulären Weg (`ValidationService.assign`, Recht `ko.assign`). Dass dieser Weg
   vom angenommenen Importobjekt zu genau einer offenen Aufgabe der benannten Person führt, misst
   W8. Eine automatische Prüferauswahl ist im Original nicht verlangt und nicht gebaut.
2. **Re-Import eines bestehenden Objekts** (Revise-Zweig) setzt die Herkunft nicht nachträglich.
   Altobjekte aus früheren Annahmen tragen weiterhin keine Herkunft (kein Backfill).
3. Ungeprüft sind Postgres, Browser, ein echter Confluence- oder SharePoint-Lauf und die
   Bedienung durch einen echten Menschen. Echtes HTTP über `app.inject` decken D1–D3 ab.
