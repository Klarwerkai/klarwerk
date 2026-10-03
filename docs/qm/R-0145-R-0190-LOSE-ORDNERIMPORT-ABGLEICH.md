# R-0145 / R-0190 — Lose, Haltepunkte und ganze Kundenordner: Bestandsabgleich

Auftrag `aufnahme:20260922:gesamt-import-adoption:lose-ordnerimport` (Revision 3).
Abgeglichene Fassung: Basis `16aaaf97` (Branch `codex/auftrag-df7bb04af6f8e4f21015`).
Einführende Einzelcommits wurden in dieser Bahn nicht ermittelt (kein Git-Lesezugriff); Belege sind
deshalb Codestellen und Testdateien der Basisfassung.

## R-0145 — Lose mit Halt, ohne KI-Aufruf je Objekt, nachvollziehbar vollständig

| Teilzusage | Stand vor diesem Auftrag | Beleg |
|---|---|---|
| Kein Modellaufruf beim Importlauf und Speichern | geliefert (Confluence) | `tests/app/w588-bulkimport-negativmatrix.test.ts` MF-1…MF-5 (Spion, mit Kalibrierung); Modellkanten nur in `/select` und `/group` (`services/app/src/routes/confluence-import-routes.ts`) |
| Kein Modell in der Kandidatenanlage | geliefert | `services/library-analytics/src/service.ts` `createImportCandidates` (kein Reasoner-Import); Dublettenfrage per Trigramm, `services/app/src/routes/library-routes.ts:268` |
| Lose bei der Confluence-Übernahme | geliefert (Oberfläche) | `apps/web/src/lib/importGroups.ts:203` (`APPLY_BATCH_SIZE = 10`), `apps/web/src/components/ImportGroups.tsx:569-608` (Los für Los; Transportfehler bricht ab, Rest bleibt „nicht versucht“ und wird einzeln wiederholt) |
| Je Los ein nachlesbarer Lauf mit Ausgang | geliefert (Confluence) | `confluence-import-routes.ts` `/apply` legt je Aufruf einen `ImportRun` an (COMPLETED/PARTIAL/FAILED); Leseweg `services/app/src/routes/import-run-routes.ts` |
| Bewusster Halt zwischen Losen (nicht nur bei Fehlern) | fehlte | — |
| Lose bei SharePoint | fehlte (eine Übernahme ≤ 50 gewählte Dateien) | `sharepoint-import-routes.ts` `MAX_SHAREPOINT_IDS` |
| Vollständiger Space-Lauf `POST /api/admin/import/confluence` | ein Lauf ohne Lose (bewusst nicht geändert) | `services/app/src/confluence-import.ts:198` |

## R-0190 — Allgemeiner Weg für ganze Kundenordner

| Weg | Stand vor diesem Auftrag | Beleg |
|---|---|---|
| Confluence (Space) | vorhanden | `confluence-import-routes.ts` |
| JSON-Re-Import | vorhanden | `library-routes.ts:787` (`/api/library/import`), `:805` (`/candidates`) |
| SharePoint/OneDrive | vorhanden, aber nur einzeln gewählte Dateien (≤ 50) | `sharepoint-import-routes.ts` Tür 1 (Liste), Tür 2 (`apply`) |
| Ganzer Ordner in einem Zug | fehlte | — |

## Was dieser Auftrag ergänzt (nicht neu gebaut wird das Gelieferte oben)

`POST /api/admin/import/sharepoint/folder-apply` (`services/app/src/routes/sharepoint-import-routes.ts`, Tür 3):

- Rumpf `{ folderId?, los? }`. Der Ordner wird gelistet, nach Datei-Kennung sortiert und in Lose zu
  `SHAREPOINT_LOS_GROESSE` (= 50) geschnitten.
- **Halt:** ein Aufruf übernimmt genau ein Los. Das nächste läuft nur auf ausdrückliche Anfrage
  (`los.naechstesLos`).
- **Nachweis:** jedes Los ist ein eigener `ImportRun` mit Scope `drive:…/folder:…/los:N-von-M`;
  `los.vollstaendig` entspricht `COMPLETED`.
- **Kein Modell:** die SharePoint-Routen haben keinen Reasoner; der Weg endet wie Tür 2 bei
  `createImportCandidates` (Prüf-Warteschlange, Annahme durch einen Menschen).
- Tür 2 und Tür 3 teilen einen Übernahmeweg (`fuehreUebernahmeAus`); Tür 2 ist im Verhalten unverändert.

Test: `tests/sharepoint-onedrive-import/ordner-in-losen-am-draht.test.ts` (L1–L6, Netzprobe).

## Quellenwidersprüche

1. Die Quelle zu R-0145 sagt, `w588-bulkimport-negativmatrix.test.ts` fehle im Produkt. In der
   Basisfassung liegt sie unter `tests/app/w588-bulkimport-negativmatrix.test.ts`.
2. `OFFEN.md:359` (L7) führt „Erzeugung in Losen mit Halt“ als ERLEDIGT. Der Kopf derselben
   Negativmatrix sagt: „Es gibt im Bestand KEINEN Halt-/Resume-Mechanismus“ (N3/N6 nicht
   ausgeführt). Beides stimmt nur teilweise: Lose und Wiederholung des Rests gibt es in der
   Confluence-Oberfläche, einen serverseitigen Halt/Wiederanlauf hatte der Bestand nicht.
3. R-0190 sagt „nur Confluence und JSON“. Seit JOB 4086 gibt es SharePoint/OneDrive, aber nur mit
   einzeln gewählten Dateien.

## Offene Grenzen

- Kein gefahrener Microsoft-365/Graph-Lauf. Die Tests laufen gegen ein Vertrags-Double.
- Tür 3 hat noch keine Fläche in der Oberfläche. Eine Bedienung durch Menschen ist nicht belegt.
- Nur Dateien direkt im Ordner; Unterordner brauchen eigene Aufrufe. Die Ordnerliste ist gedeckelt
  (`SHAREPOINT_MAX_PAGES`); ist sie abgeschnitten, meldet `los.ordnerVollstaendigGelesen: false`.
- Ändert sich der Ordner zwischen zwei Losen, verschieben sich die Lose. Doppelt eingereiht wird
  dabei nichts (Idempotenz), aber einzelne Dateien können aus der Losfolge fallen. Ein erneuter
  Durchlauf holt sie.
- Ein lokaler Ordner (Dateisystem) und andere Quellsysteme sind nicht Teil dieses Wegs.
- Der Leseweg der Laufakte ist weiterhin nur hinter dem Confluence-Schalter registriert (Befund
  aus `tests/sharepoint-onedrive-import/wiederholimport-am-draht.test.ts`, W1b; `build-app.ts` nicht geändert).
