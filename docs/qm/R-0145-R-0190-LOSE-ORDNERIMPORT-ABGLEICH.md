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

- Rumpf `{ folderId?, fortsetzung? }`. Der erste Aufruf legt eine **Losfolge** an; ihre Kennung
  ist die angebotene `los.fortsetzung`.
- **Fortsetzbare Inventur ohne Gesamtkante:** die Losfolge hält eine `SharePointInventur`
  (`services/sharepoint/src/adapter.ts`): Graph-Cursor (`@odata.nextLink`) des gerade gelesenen
  Ordners, die noch zu lesenden (Unter-)Ordner auf allen Ebenen, gesehene Kennungen und gefundene,
  noch keinem Los zugeteilte Dateien. Ein Aufruf liest nur so viele Seiten, wie das nächste Los
  braucht, höchstens `SHAREPOINT_INVENTUR_SEITEN_JE_AUFRUF` (= 100); der Rest bleibt im Stand.
  Ordner werden nie Kandidaten.
- **Los:** die nächsten höchstens `SHAREPOINT_LOS_GROESSE` (= 50) gefundenen Dateien in
  Lieferfolge. Findet ein Aufruf in seinem Seitenbudget keine Datei (z. B. viele leere
  Unterordner), übernimmt er nichts und bietet die Fortsetzung an.
- **Halt:** ein Aufruf übernimmt höchstens ein Los. Weiter geht es nur mit der angebotenen
  `los.fortsetzung`.
- **Quellenänderung / Ausfall:** ein Los ist eine Folge gelesener Dateien, kein Versatz. Verschwindet
  eine zugeteilte Datei, steht sie im Los als `notFound` (PARTIAL). Scheitert ein ganzes Los
  (Zugang, Gegenstelle), gehen seine Dateien zurück in den Puffer und kommen mit der nächsten
  Fortsetzung wieder.
- **Nachweis:** jedes Los ist ein eigener `ImportRun` mit Scope
  `drive:…/folder:…/losfolge:<id>/los:<n>`; `los.vollstaendig` entspricht `COMPLETED`.
  `los.ordnerAbgeschlossen` ist erst wahr, wenn jede Seite jedes Ordners gelesen und jede gefundene
  Datei zugeteilt ist; dann gibt es keine Fortsetzung mehr.
- **Leseweg der Laufakte:** `GET /api/admin/import/runs/…` ist hinter jedem Importweg registriert,
  der Läufe schreibt (Confluence oder SharePoint), nicht mehr nur hinter Confluence (`build-app.ts`).
- **Kein Modell:** die SharePoint-Routen haben keinen Reasoner; der Weg endet wie Tür 2 bei
  `createImportCandidates` (Prüf-Warteschlange, Annahme durch einen Menschen).
- Tür 2 und Tür 3 teilen einen Übernahmeweg (`fuehreUebernahmeAus`); Tür 2 ist im Verhalten unverändert.

Test: `tests/sharepoint-onedrive-import/ordner-in-losen-am-draht.test.ts` (L1–L6, nach bens
Befunden L7 Änderung der Ordnerliste, L8 elf Listenseiten, L9 Unterordner, L10 nur SharePoint,
L11 1.001 Listenseiten in einem Ordner, L12 1.001 Ordner, L13 gescheitertes Los; Netzprobe). `wiederholimport-am-draht.test.ts` W1b erwartet seitdem 200 statt 404.

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
- Die Losfolge lebt im Speicher des App-Prozesses (höchstens 20 gleichzeitig, Ablauf 24 h nach
  der letzten Nutzung). Nach Neustart, Ablauf oder auf einer anderen Instanz ist die Fortsetzung
  unbekannt (409 `FORTSETZUNG_UNBEKANNT`); eine neue Losfolge reiht Bereits-Übernommenes nicht
  doppelt ein, liest den Ordner aber erneut.
- Wird eine Datei auf einer schon gelesenen Listenseite nachträglich hinzugefügt, gehört sie nicht
  zu dieser Losfolge; eine neue Losfolge holt sie ohne Doppelbestand. Wie Graph seine Seiten bei
  gleichzeitigen Änderungen bildet, ist im Double nachgebildet, nicht gegen Microsoft 365 gemessen.
- Ein lokaler Ordner (Dateisystem) und andere Quellsysteme sind nicht Teil dieses Wegs.
