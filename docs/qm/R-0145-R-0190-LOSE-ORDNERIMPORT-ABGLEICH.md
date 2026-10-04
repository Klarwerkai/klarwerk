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

- Rumpf `{ folderId?, fortsetzungAb? }`. Jeder Aufruf inventarisiert den ganzen Ordner
  (`SharePointSourceAdapter.inventarisiereOrdner`): alle Listenseiten, alle Unterordner auf allen
  Ebenen; Ordner werden nie Kandidaten. Die Dateien werden nach Kennung sortiert.
- **Los:** die nächsten höchstens `SHAREPOINT_LOS_GROESSE` (= 50) Dateien hinter `fortsetzungAb`.
  Die Fortsetzung hängt an der Kennung, nicht an einem Versatz: verschwindet zwischen zwei Losen
  eine Datei, fällt keine weiterhin vorhandene Datei aus der Losfolge.
- **Halt:** ein Aufruf übernimmt genau ein Los. Das nächste läuft nur auf ausdrückliche Anfrage
  mit der angebotenen `los.fortsetzungAb`.
- **Nachweis:** jedes Los ist ein eigener `ImportRun` mit Scope `drive:…/folder:…/ab:<Kennung>`;
  `los.vollstaendig` entspricht `COMPLETED`. `los.ordnerAbgeschlossen` ist erst wahr, wenn hinter
  dem Los nichts mehr liegt und die Inventur vollständig war.
- **Leseweg der Laufakte:** `GET /api/admin/import/runs/…` ist hinter jedem Importweg registriert,
  der Läufe schreibt (Confluence oder SharePoint), nicht mehr nur hinter Confluence (`build-app.ts`).
- **Kein Modell:** die SharePoint-Routen haben keinen Reasoner; der Weg endet wie Tür 2 bei
  `createImportCandidates` (Prüf-Warteschlange, Annahme durch einen Menschen).
- Tür 2 und Tür 3 teilen einen Übernahmeweg (`fuehreUebernahmeAus`); Tür 2 ist im Verhalten unverändert.

Test: `tests/sharepoint-onedrive-import/ordner-in-losen-am-draht.test.ts` (L1–L6, nach bens
Befunden L7 Änderung der Ordnerliste, L8 elf Listenseiten, L9 Unterordner, L10 nur SharePoint;
Netzprobe). `wiederholimport-am-draht.test.ts` W1b erwartet seitdem 200 statt 404.

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
- Die Inventur ist gedeckelt (`SHAREPOINT_INVENTAR_MAX_SEITEN_JE_ORDNER` = 1000 Seiten je Ordner,
  `SHAREPOINT_INVENTAR_MAX_ORDNER` = 1000 Ordner). Wird eine Kante erreicht, meldet
  `los.inventar.vollstaendig: false`, und die Losfolge schliesst nie als abgeschlossen.
- Jeder Losaufruf inventarisiert den ganzen Ordner neu: bei sehr grossen Ordnern kostet das
  entsprechend viele Listenabrufe je Los.
- Eine Datei, die während einer Losfolge neu hinzukommt und deren Kennung vor der Fortsetzung liegt,
  gehört nicht zu dieser Losfolge. Eine neue Losfolge ab Anfang holt sie ohne Doppelbestand.
- Ein lokaler Ordner (Dateisystem) und andere Quellsysteme sind nicht Teil dieses Wegs.
