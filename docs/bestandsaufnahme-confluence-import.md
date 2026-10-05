# Bestandsaufnahme Confluence-Import — Stand 29.09.2026

Auftrag `aufnahme:20260922:gesamt-confluence-import`. **Lauf 1** (Aufgabenrevision 2, Runden 1–3,
Basis `c04ec239`, Fassung `1.0.0-beta.1.612`; letzte geprüfte Fassung `0b42d694` =
`1.0.0-beta.1.616`) endete an der Nacharbeitsgrenze und ist **nicht** in `main` eingeflossen.
**Lauf 2** (Aufgabenrevision 4, Basis `1eb17b73` = `1.0.0-beta.1.621`, Arbeitsstand `fca4e6ee`,
Fassung `a6177db7` = `1.0.0-beta.1.622`) übernahm die drei Arbeitsstände von Lauf 1 und behob die
zwei Anhangsfehler aus Lauf 1 / Runde 3. Er ist ebenfalls **nicht** in `main` eingeflossen: der
Vollcheck am Linux-Prüfweg war **rot** (`pa-1790500728-a825f53a`, 16 rote Fälle), die gezielte
PostgreSQL-Integration grün (`pa-1790500802-63a9ab41`, 3 Dateien, 37 Tests). **Lauf 3**
(Aufgabenrevision 7, Basis `1530dfeb` = `1.0.0-beta.1.628`) übernimmt den Arbeitsstand `fca4e6ee`
konfliktfrei und behebt die Ursachen des roten Vollchecks, soweit sie aus dieser Lieferung stammen
(s. Abschnitt „Lauf 3“). Die Teile tragen die Fassung, die der Starter nach dem Lauf festhält. Diese
Datei hält je zugeordnetem Anliegen fest, was geliefert ist, woran man es sieht und was offen
bleibt. Sie ersetzt keine Prüfung: ein „Beleg“ ist eine Datei oder ein Test im Repository, der am
festen Commit nachläuft.

Legende: **geliefert** = im Code mit Test belegt · **dieser Lauf** = in diesem Lauf gebaut ·
**teilweise** = Teil geliefert, Rest benannt · **offen** = nicht gebaut · **ungeklärt** = ohne
jüngeren Beleg, vor Umsetzung abgleichen.

## Übersicht

| Anliegen | Stand | Beleg |
|---|---|---|
| R-0126 Kandidaten statt geprüftes Wissen; Titel, Text, Schlagworte, Elternkette | geliefert | `services/confluence/src/mapper.ts`, `services/confluence/src/adapter.test.ts`; in diesem Lauf zusätzlich an verschachtelten Daten: `tests/confluence-verschachtelt/verschachtelter-import.test.ts` („R-0126: alle Seiten landen als Kandidaten …“) |
| R-0131 ehrlicher Rücklink zur Confluence-Seite | geliefert, Runde 2+3 ergänzt | URL = Basisadresse + `_links.webui` (`mapper.ts`; `services/confluence/src/mapper.test.ts:49`), nur absolute http/https am Anker (`safeSourceUrl` in `buildSource`); Darstellung als Link auf genau diese URL, neuer Tab angekündigt, unsichere Adresse nie klickbar: `tests/import-volltext/pruefkarte-zeigt-volltext-und-quelle.test.tsx` V3/V8 (JOB 3288). Ist die Seite in der Quelle **bestätigt** gelöscht (404), zeigt die Fläche die Adresse nur als Text mit Hinweis (`quellhinweise-montiert.test.tsx` H1/H2); taucht sie wieder auf, wird der Link wieder angeboten (Vermerk aufgehoben, `runde3.test.ts` N2); ein unbekannter Zustand entzieht den Link nicht (N1). *Korrektur zu Runde 1:* `confluence-import-deeplink-mounted.test.tsx` (JOB 1132) prüft Ordner und Importlaufzustände, **nicht** den Rücklink. |
| R-0134 Schalter ohne Leser in der Oberfläche | geliefert (aufgelöst) | Der ungelesene Schlüssel wurde aus dem Client-Vertrag entfernt (`apps/web/src/api/types.ts`, AUFTRAG-mega69 Block H); die Oberfläche liest `enabled` der Zugangsroute (`services/app/src/services/import-access-service.ts`, `apps/web/src/components/ImportAccessPanel.tsx`). Der Betreiber schaltet über `KLARWERK_CONFLUENCE_IMPORT`; aus = Routen nicht registriert (`services/app/src/build-app.ts`). |
| R-0142 importiertes Wissen als vollständiges Wissensobjekt in der Bibliothek, DE/EN/NL | teilweise (abgeglichen) | Abgleich je Element s. Abschnitt „R-0142 im Einzelnen“. Geliefert: kein zweiter Wissenspfad, Original als Volltext, Quellen samt Anhängen, Quellrestriktion und Löschvermerk auf der normalen Lesefläche `/wissen/:id` in DE/EN/NL, Widerspruchs- und Validierungsfläche wie für jedes Objekt, hinter Import-Schalter und `users.manage`. **Offen und in Runde 3 genauer bestimmt:** abgeleitete Einheiten und Lücken (s. Widerspruch 8). |
| R-0153 Unterseiten, Eltern-Kind-Struktur statt flacher Liste | geliefert | Elternkette `confluenceSourcePath`/`confluenceAncestorIds` (`mapper.ts`), Ordnerbaum `folderTree` (`apps/web/src/lib/importSelectView.ts`), Befund `hierarchieBefund` (`adapter.ts`); Matrix `tests/app/job1042-hierarchie-bestandsmatrix.test.ts`. In diesem Lauf an einem fünfstufigen Bereich gemessen (s. R-1126). |
| R-0159 eigener Fehlercode bei zu langsamem Abruf | geliefert | `ConfluenceRequestError` mit `CONFLUENCE_TIMEOUT` und hostfreier Meldung (`services/confluence/src/rest-client.ts`), Commits `a06d2598` (JOB 2683), `85a3cfdc` (JOB 2702) |
| R-0160 Auskunft über Zugangsdaten ohne Werte; Token-Säuberung | geliefert | `confluenceCredentialState` (nur Name + ja/nein), `GET /api/import/confluence/zugang`, `redactSecrets` im Client; `tests/app/mega67-zugangszustand.test.ts`, `services/confluence/src/rest-client.test.ts` |
| R-0162 Änderungen und Löschungen nachziehen | **Runde 2+3** (vorläufige Regel) | Änderungen: höhere Quellversion → erneuter Kandidat → Annahme revidiert über den Anker (`confluence-import.ts`, `acceptToKo`), ohne Herabstufen (`adapter.test.ts`). **Löschungen:** nach vollständigem Lesen wird jeder Anker des Bereichs, dessen Seite fehlte, einzeln nachgefragt. **Nur eine HTTP-404 gilt als gelöscht**; eine Erfolgsantwort ohne brauchbare Seiten-Id wirft `ConfluenceUnusableResponseError` (Code `CONFLUENCE_UNUSABLE_RESPONSE`) und zählt wie jeder andere Nachfragefehler als „unbekannt“ (`unchecked`), **ohne** Vermerk (Runde 3). Reaktion auf eine bestätigte Löschung: Vermerk `sourceRemovedAt` am Anker (`KoService.markSourceRemoved`, Audit `ko.source-removed-in-origin`), Wissen unverändert. **Wiederauftauchen (Runde 3):** steht eine vermerkte Seite wieder in der Bereichsliste, wird der Vermerk aufgehoben, auch bei gleicher Version (`KoService.clearSourceRemoved`, Audit `ko.source-restored-in-origin`). **Dauerhaftes Laufergebnis (Runde 3, in Lauf 3 umgelegt):** der asynchrone Lauf speichert `sourceSync` (nur Quell-Kennungen) in der eigenen Ablage `services/app/src/quellabgleich-ablage.ts` (Tabelle `import_run_source_sync`, nicht mehr am eingefrorenen `ImportRun`), `GET /api/admin/import/runs/:id` liefert es unverändert als `run.sourceSync`, die Importseite zeigt es (DE/EN/NL); unbekannte Zustände machen den Lauf `PARTIAL` mit `SOURCE_SYNC_INCOMPLETE`. Probelauf meldet nur; verschobene Seiten → `outsideScope`; unvollständiges Lesen → kein Löschabgleich (`checked: false`). Tests: `tests/confluence-quellabgleich/abgleich.test.ts`, `tests/confluence-quellabgleich/runde3.test.ts` (N1 200-ohne-Id, N2 Wiederauftauchen, N4 Route). Die Reaktion „vermerken statt löschen/archivieren“ ist **meine vorläufige Regel**, keine Nutzerentscheidung. |
| R-0163 Anhänge und Bilder | **Lauf 1 Runde 2+3, Lauf 2** (Metadaten und Quellen), offen (Dateiinhalte) | Der Lese-Expand fordert `children.attachment` an; trägt er nicht alle Anhänge, blättert der Adapter die Liste dieser Seite über `/rest/api/content/{id}/child/attachment` nach — auf beiden Wegen (Anwenden `fetchItem`, Bereichsimport `collectAll`). Beim Annehmen wird jeder Anhang eine eigene Quelle am Wissensobjekt (Name, Typ, Größe, absolute Abruf-URL, `attachmentOf`); ein Re-Sync mit vollständiger Liste ersetzt sie, eine Teilliste (`sourceAttachmentsIncomplete`) entfernt nichts. **Lauf 2:** (a) *Nur eine brauchbare Liste gilt:* eine Anhangsantwort ohne `results`-Liste, mit Einträgen ohne Kennung, `null` oder 404 wirft `ConfluenceUnusableResponseError` (`istAnhangsliste`, `rest-client.ts`); fehlt die Liste am Expand ganz oder ist sie unbrauchbar, trägt das Item `sourceAttachmentsIncomplete` — die Annahme entfernt dann keine bestehende Anhangsquelle. (b) *Anhangsänderung ohne neue Seitenfassung:* der Bereichsimport gleicht für bereits importierte Seiten **in genau der Ankerfassung** die Anhangsquellen an (`LibraryService.syncImportAttachments` → `KoService.replaceSourceAttachments`, Audit `ko.source-attachments-synced` mit hinzugekommenen/entfernten Kennungen), ohne neuen Kandidaten und ohne Inhaltsrevision; Papierkorb-Objekte bleiben unberührt; Probelauf meldet nur. Ergebnis `sourceSync.attachmentsUpdated` im Lauf, in der dauerhaften Abgleichsablage des Laufs (Lauf 3: `quellabgleich-ablage.ts`) und auf der Laufkarte (DE/EN/NL). Tests: `services/confluence/src/quellangaben.test.ts`, `tests/confluence-quellabgleich/abgleich.test.ts`, `runde3.test.ts` N3, **`lauf2-anhaenge.test.ts` (A1/A2, Route)**, **`anhaenge-am-lauf-montiert.test.tsx`**, Anzeige `quellhinweise-montiert.test.tsx` H3. **Offen:** Dateiinhalte werden nicht in Klaras Objektspeicher kopiert; die Abruf-URL führt zu Confluence und braucht dort Leserecht. *(Lauf 3 R2 behoben, Bens B4: die Abrufadresse gehört jetzt zur Vorfilter-Signatur.)* Die Regel „Anhänge ohne Prüfung nachziehen“ ist — wie der Löschvermerk — **meine vorläufige Regel** (Herkunftsangabe, kein Wissensinhalt), keine Nutzerentscheidung. |
| R-0166 Anmeldeweg für Confluence im eigenen Haus | **dieser Lauf** | `KLARWERK_CONFLUENCE_AUTH=pat` → `Authorization: Bearer <PAT>`, Kennung nicht nötig; unbekannter Wert → kein Client und eigener Riegel `invalid-auth-mode` in Zugangsauskunft, Startbericht und Fläche (DE/EN/NL). Test: `services/confluence/src/auth-mode.test.ts`, `tests/app/mega67-zugang-flaeche-mounted.test.tsx`. Nicht gemessen: gegen eine echte Server-/Data-Center-Instanz. |
| R-0171 ganzen Bereich aus der Anwendung heraus übernehmen | geliefert | `POST /api/admin/import/confluence` (mit `dryRun`), Erkunden/Auswählen/Anwenden (`/explore`, `/select`, `/apply`), Oberfläche `ImportStepper`/`ImportExplore`/`ImportSelect` |
| R-0176 kleine, einzeln benutzbare Stücke | Arbeitsweise | Kein Produktzustand; die Historie (SCRUM-510 WP1–WP4, IC-1 … IC-6, JOB 1042/1132/2683/3089) zeigt die stückweise Lieferung. Dieser Lauf liefert ebenfalls einzeln benutzbare Teile (R-0166, Testdaten, Restriktionstests). |
| R-0182 / R-0649 Restriktionsformen unabhängig prüfen; Live-Reste | teilweise | **Dieser Lauf:** ausdrücklich leer, nur Benutzer, nur Gruppe (jeweils mit leerer oder fehlender Gegenliste), beides — je eigener Fall in `services/confluence/src/mapper.test.ts` („R-0182/R-0649“); geänderte Quellversion am Attrappenweg (`abgleich.test.ts`, Re-Sync). **Offen/nicht wiederholt:** geänderte Quellversion gegen eine echte Instanz, echte erlaubte OpenAI-Gruppierung, Wiederanlaufpersistenz, Prüfung von 1.112; die historischen Befunde (eigener Quellzugang 403, 1.109 `group=false`/Cloud nicht erreichbar, 1.111 wechselnde Erreichbarkeit) sind in diesem Lauf nicht wiederholt und weder bestätigt noch widerlegt. |
| R-0526 Import an ein Recht gebunden, Vertrag nennt es | geliefert | Alle Import-Routen verlangen `users.manage` (`confluence-import-routes.ts`); der Vertrag steht in `tests/security/routeGuardAudit.ts` (Einträge `/api/admin/import/confluence*`, `/api/import/confluence/zugang`) |
| R-0549 Sichtbarkeit wie in der Quelle, Gruppen → Leserechte | teilweise (Erhalt **Runde 2**), Durchsetzung **gesperrt** | **Runde 2:** die Quellberechtigung geht nicht mehr verloren — Gruppennamen und stabile Benutzerkennungen (Cloud `accountId`, Server `username`/`userKey`, nie Anzeigenamen) reisen als `sourceReadRestriction` bis an den Herkunftsanker (`readRestriction`) und werden auf der Lesefläche genannt (Gruppen namentlich, Personen nur als Anzahl). Tests: `quellangaben.test.ts` (zwei Seiten mit verschiedenen Gruppen ergeben verschiedene Items), `abgleich.test.ts`, `quellhinweise-montiert.test.tsx` H4. **Nicht durchgesetzt, und zwar mit Grund:** Klara kennt keine Leserechte je Gruppe oder Person; `services/app/src/sichtbarkeit.ts` benennt eine Freigabe je Nutzer als nicht entschiedene „Variante B“ und verbietet ausdrücklich, sie „durch die Hintertür“ zu bauen. Die Durchsetzung braucht diese Entscheidung und eine Zuordnung Confluence-Gruppe → Klara-Gruppe/Rolle. |
| R-1005 Import ohne Fachwissen über die Oberfläche starten und einstellen | teilweise | Starten, Erkunden, Auswählen, Gruppieren, Anwenden in der Oberfläche vorhanden; Zugangszustand sichtbar. Einstellen (Adresse, Space, Token, Anmeldeart) bleibt bewusst in der Umgebung — Entscheidung Pedi 30.07. (mega67 C2), s. `credential-state.ts`. Ein Space-Wechsel ohne Neustart ist damit nicht möglich. |
| R-1172 verschachtelte Testdaten | **dieser Lauf** | `tests/confluence-verschachtelt/bereich.ts`: zwei Wurzeln, fünf Ebenen, gleichnamige Zweige, restringierter Teilbaum, Kind-vor-Eltern-Lieferung, Blättern über mehrere Ergebnisseiten; Durchlauf bis Ordnerbaum und Kandidaten in `verschachtelter-import.test.ts`. |
| R-1126 / R-1800 (E6) verschachtelte Seiten in einer echten Testinstanz | Werkzeug geliefert, Anlage **nicht erfolgt — fehlende Mittel** | `tests/confluence-verschachtelt/testseiten-anlegen.ts` legt denselben Baum an (Eltern vor Kindern, Labels, Gruppenrestriktion, Titel je Space eindeutig, Präfix `E6 · `); ohne `--ausfuehren` nur Plan (16 Seiten). Test gegen Attrappe: `testseiten-anlegen.test.ts`. **Kein Abschlussbeleg:** In dieser Umgebung gibt es keine Confluence-/Atlassian-Zugangsvariablen (in Runde 3 geprüft, nur Namen) und keine Testinstanz; das Anlegen ist zudem ein Schreibzugriff auf ein Fremdsystem, der eine menschliche Freigabe braucht. Fehlende Mittel: Confluence-Testinstanz, Schreib-Zugang, Freigabe. |
| R-1601 / R-2197 „nicht restringiert“ nicht als vertraulich | geliefert | Commit `6d8d4c27` (JOB 3089, N11): `confluenceGovernanceConfidentiality` liefert `intern`; `mapper.test.ts`, `adapter.test.ts` |
| package:confluence Firmenfilter, Vorschau, Status, Wiederimport; Quelle, Berechtigungen, Änderungen nachvollziehbar | teilweise | Filter grenzt ein: `tests/library/import-theme-derivation.test.ts` („Space-Filter grenzt auf den Quell-Container ein“), `tests/library/import-entity-e2e.test.ts` (Space-Chips). Vorschau und Auswahl (`/select`, `toPreviewEntry`), Status und Fehler (Laufprotokoll, `CONFLUENCE_TIMEOUT`, `PARTIAL`), Wiederimport erkennt Bestehendes (`alreadyImported`, `services/app/src/routes/confluence-import-status.test.ts`). **Runde 2:** Berechtigungen (R-0549, Erhalt) und Löschungen (R-0162) werden am Anker nachvollziehbar festgehalten. **Grenzen:** abgefragt wird der **eine** konfigurierte Space (`KLARWERK_CONFLUENCE_SPACE`), mehrere Bereiche je Lauf gibt es nicht; Berechtigungen werden nicht durchgesetzt (s. R-0549). |

## R-0142 im Einzelnen (Abgleich Runde 2)

| Element des Zielzustands | Stand | Beleg |
|---|---|---|
| kein zweiter Wissenspfad | geliefert | Annahme über `LibraryService.reviewImportCandidate` → `acceptToKo` → `KoService.create`/`revise`; dieselbe Lesefläche `/wissen/:id` |
| Original bleibt Quelle | geliefert | Volltext als `bodyHtml` (JOB 3288, `tests/import-volltext/`), Anker mit Rücklink (R-0131) |
| Quellen | geliefert, Runde 2 erweitert | Anker + Anhänge + Quellrestriktion + Löschvermerk: `tests/confluence-quellabgleich/quellhinweise-montiert.test.tsx` |
| Validierungsstand, Widersprüche | geliefert (allgemein) | angenommene Objekte stehen im normalen Prüfweg (Status `offen`), Konfliktabschnitt `konflikt` in `MehrAbschnitte.tsx` — nicht Confluence-spezifisch nachgemessen |
| DE/EN/NL | geliefert | neue Texte `ko.source.*` in drei Sprachen, gemessen in H1/H3/H4 |
| hinter Rechte- und Funktionsschalter | geliefert | Import: `KLARWERK_CONFLUENCE_IMPORT` + `users.manage`; Lesen: `ko.read` + `sichtbarkeit.ts` |
| daraus abgeleitete Wissenseinheiten | **offen** | eine Seite ergibt genau ein Wissensobjekt. Die vorhandene Ergebnisfläche „Original + Einheiten“ (`apps/web/src/components/confluence-import/ImportResultView.tsx`, Vertrag `KW-W2-17`) ist **nirgends eingebunden**, und kein Produktionscode schreibt die dafür nötigen Quellrevisionen (`ExternalSourceRecord`) oder Elementreferenzen (`appendItemRefs`) — erhoben in Runde 3 |
| Lücken | **offen, derzeit nicht darstellbar** | Wissenslücken (`services/ask`, `Gap`) tragen keinen Bezug zu Wissensobjekten; die Ergebnisroute meldet deshalb vertraglich `knowledgeGapRelationState: "RELATION_NOT_AVAILABLE"` (`services/app/src/routes/import-run-routes.ts`). „Angezeigt wird nur, was der Server liefert“ verbietet, hier Lücken zu behaupten |

## Widersprüche und fehlende Belege

1. **R-0134 gegen den Bestand:** Das Anliegen sagt „kein Teil der Oberfläche liest den Schalter“. Das
   war vor AUFTRAG-mega69 richtig; seitdem ist der ungelesene Schlüssel aus dem Client-Vertrag
   entfernt und die Fläche liest die aussagekräftigere Zugangsauskunft. Der Satz ist historisch.
2. **R-0549 gegen Entscheidung 23:** R-0549 verlangt „wer in der Quelle sehen darf, sieht in Klara“.
   Entscheidung 23 (Pedi, 05.09.2026) setzt nicht restringierte Seiten auf `intern`. Beides verträgt
   sich nur, wenn „intern“ alle angemeldeten Nutzer der Instanz meint und das der Sichtbarkeit einer
   offenen Confluence-Seite entspricht; für restringierte Seiten bleibt „vertraulich“ gröber als die
   Quelle. Die Feinabbildung ist offen (s. o.).
3. **Fehlende Restriktionsangabe:** Liefert Confluence für eine Seite gar keine `restrictions`, gilt
   sie heute als `intern` — dieselbe Stufe wie „ausdrücklich leer“. Ob das so bleiben soll oder
   fail-safe `vertraulich` gelten soll, ist eine Vertraulichkeitsentscheidung; der Ist-Stand ist in
   `mapper.test.ts` festgehalten, nicht geändert.
4. **R-0153 „Arbeitsstand verloren“:** Der Arbeitsstand ist im Repository vorhanden (AUFTRAG-mega27,
   JOB 1042, JOB 1131/1132); der Satz aus der Quelle ist historisch.
5. **R-0549 gegen die offene Rechteentscheidung (Runde 2):** R-0549 verlangt Leserechte je Quelle.
   `services/app/src/sichtbarkeit.ts` hält fest, dass eine Freigabe je Nutzer („Variante B“)
   nicht entschieden ist und nicht nebenbei gebaut werden darf. Diese explizite Sperre bleibt
   wirksam; geliefert ist deshalb nur der verlustfreie Erhalt der Quellberechtigung.
6. **R-0162 ohne Reaktionsentscheidung (Runde 2):** Die Quelle verlangt „zieht nach“, legt aber nicht
   fest, wie. Gebaut ist die zurückhaltendste nachvollziehbare Reaktion (Vermerk + Audit, kein
   Löschen). Ob Klara zusätzlich archivieren oder zur Prüfung vorlegen soll, ist zu entscheiden.
7. **R-1126/R-1800 Abschlussbeleg:** Ein Beleg für angelegte Seiten in einer echten Testinstanz
   fehlt; das Werkzeug liegt bereit, ausgeführt wurde es nicht (fehlende Mittel, s. Übersicht).
8. **R-0142 gegen das Datenmodell (Runde 3):** R-0142 verlangt Lücken je importiertem Objekt und
   „angezeigt wird nur, was der Server wirklich liefert“. Die Lückendomäne kennt keinen Bezug
   Lücke → Wissensobjekt, und der Ergebnisvertrag liefert ihn ausdrücklich als nicht verfügbar.
   Beides zugleich ist erst erfüllbar, wenn eine solche Beziehung fachlich festgelegt und gebaut
   ist; ebenso braucht „abgeleitete Einheiten“ eine Entscheidung, ob eine Confluence-Seite in
   mehrere Wissensobjekte zerlegt werden soll (heute: eine Seite, ein Objekt).
9. **R-0549, Befund Runde 2 (Controller sieht fremdes Objekt):** Das ist die heutige, dokumentierte
   Regel (`sichtbarkeit.ts`: `ko.validate` sieht auch vertrauliche Objekte). Ein Quellgruppen-
   abgleich wäre genau die Freigabe je Nutzer („Variante B“), die dort ausdrücklich gesperrt ist;
   sie wird hier nicht beiläufig eingeführt.
10. **R-0182/R-0649 Live-Befunde:** Für „eigener Quellzugang 403“, „1.109 group=false“, „1.111
   wechselnde Erreichbarkeit“ und „1.112“ liegt im Repository kein jüngerer Beleg vor. Sie sind
   weder bestätigt noch widerlegt.

## Lauf 2 — Befunde aus Lauf 1 / Runde 3 (Ben) einzeln

| Befund | Behandlung in Lauf 2 | Beleg |
|---|---|---|
| R-0163 Verträglichkeit: HTTP 200 ohne `results` galt als vollständige leere Liste, a1/a2 verschwanden | behoben: unbrauchbare Antwort wirft, Item bleibt unvollständig markiert, bestehende Anhangsquellen bleiben; ebenso `null`, Nicht-Liste, Eintrag ohne Kennung, 404, fehlende Liste am Expand | `tests/confluence-quellabgleich/lauf2-anhaenge.test.ts` „A1 …“ (Bens Probe wörtlich: `{unexpected:'not an attachment listing'}`) |
| R-0163 Wirkung: Anhangswechsel a1/a2 → a3 bei gleicher Seitenfassung wurde übersprungen | behoben: Angleich ohne Kandidat; `skipped` bleibt 1, am Objekt steht danach nur a3 | `lauf2-anhaenge.test.ts` „A2 · Bens Probe …“, Route-Fall über `GET /api/admin/import/runs/:id` |
| Testaussagekraft: beide Fälle ungetestet | ergänzt, jeweils mit Prüfung der tatsächlich am Objekt stehenden Quellen | wie oben; `quellangaben.test.ts` an die strengere Regel angepasst (Eintrag ohne Kennung ⇒ unvollständig) |
| R-0142 abgeleitete Einheiten und Lücken | **nicht gebaut** — braucht Entscheidung (s. Widerspruch 8) | — |
| R-0549 / package:confluence Quellgruppen bestimmen Lesezugriff nicht | **nicht gebaut** — Sperre „Variante B“ in `services/app/src/sichtbarkeit.ts` bleibt wirksam (Widerspruch 5/9) | — |
| R-1126 / R-1800 echte verschachtelte Testseiten | **nicht angelegt** — fehlende Mittel: auch in Lauf 2 keine Confluence-/Atlassian-Variablen in der Umgebung (nur Namen geprüft), keine Testinstanz, keine Schreibfreigabe | Werkzeug `tests/confluence-verschachtelt/testseiten-anlegen.ts` |

## Lauf 3 — der rote Vollcheck aus Lauf 2, Fall für Fall

Quelle: `pa-1790500728-a825f53a.ergebnis.json` (Commit `a6177db7`, Ausgang `nicht_bestanden`).

| Roter Fall (Vollcheck Lauf 2) | Ursache | Behandlung in Lauf 3 | Beleg (lokal, gezielt) |
|---|---|---|---|
| `tests/library-analytics-freeze144.test.ts` (2 Fälle) | Lauf 2 änderte vier eingefrorene Dateien (`library-analytics/index.ts`, `src/types.ts`, `src/repo.ts`, `src/repo-pg.ts`) ohne Freigabe | Die vier Dateien sind **wieder unverändert** (Stand `main`). Die Item-Erweiterungen stehen in `services/library-analytics/src/quellangaben.ts` (`ImportItem & …`, Säuberung `saeubereQuellangaben`) bzw. als Ausgangstyp `ConfluenceImportItem` in `services/confluence/src/mapper.ts`; das dauerhafte Abgleichsergebnis liegt in der neuen, additiven App-Ablage `quellabgleich-ablage.ts` (In-Memory + PostgreSQL, Migration `IMPORT_RUN_SOURCE_SYNC_SCHEMA`, Migrationsbeleg, Dev-Journal, Backup-Drill). Keine Freigabe-ID erfunden, kein Sollhash nachgezogen. | `tools/test tests/library-analytics-freeze144.test.ts` grün |
| `tests/bibliothek-historie-vermerk/vermerk-uebersetzung.test.ts`, `tests/live-check-postgres-prefilter/toter-kandidatenweg.test.ts` (2), `tests/live-check-suchwoerter/begruendung-nennt-die-gebaute-kette.test.ts` (7) | Die drei neuen `KoService`-Methoden standen mitten in `knowledge-object/src/service.ts` und verschoben zeilengebundene Fundstellen um 135 Zeilen | Methoden unverändert ans Klassenende verlegt (vor `require`); alle Fundstellen liegen davor | alle drei Dateien grün |
| `tests/app/pro375-terminologie-vertrag.test.ts` TV-2 | neuer DE-Text `imp.access.blocker.invalidAuthMode` enthielt den Aliasbegriff „im eigenen Haus“ | umformuliert: „für selbst betriebenes Confluence (Server/Data Center)“ | grün |
| `services/app/src/build-app.test.ts` D3 | Domänencode `SOURCE_SYNC_INCOMPLETE` fehlte auf `ERLAUBTE_FEHLERCODES` | eingetragen, mit Begründung (fester Name, kein Inhalt) | grün |
| `abbau-0/abbau-1` (Browserdeckel), `tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts` P1 | Browserdeckel-Sperrdatei bzw. Zeitgrenze im Chromium-Lauf; kein Bezug zu einer Datei dieser Lieferung erkennbar | **nicht angefasst** — keine belegte Ursache in diesem Auftrag; Klärung am festen Commit durch Ben/Linux-Tor | lokal nicht ausgeführt (Browser) |

Neu durch die Umlegung: `tests/backup-drill/tabellensatz.test.ts` verlangt jede migrierte Tabelle im
Drill — `import_run_source_sync` ist in `scripts/backup/restore-drill.sh` eingetragen. Tests der neuen
Ablage: `services/app/src/quellabgleich-ablage.test.ts` (In-Memory, Deckel, Migration/Beleg/Drill)
und `services/app/src/quellabgleich-ablage.integration.test.ts` (Wegwerf-PostgreSQL: zweifache
Migration, Wiederanlauf über neue Verbindung, Ersetzen, Altbestand mit Fremdinhalt) — **lokal nicht
ausgeführt** (keine Docker-/Dienststarts auf dem Produktions-Mac), gehört in die Serverprüfung.

**Offen durch die Freeze-Sperre:** Soll die Erweiterung doch in den eingefrorenen Laufvertrag
(`ImportRun.sourceSync`, `ImportItem`-Felder, Ausleitung in `index.ts`), braucht das eine
Freigabe je Datei nach FREEZE-144; wer sie zeichnet, ist dort als offene Ownerfrage benannt.

## Lauf 3 · Runde 2 — Bens Befunde B1 bis B8 einzeln

Ben (Runde 1): keine Codefreigabe. Jeder Befund ist hier einzeln behandelt; die Tests B2–B6/B8
stehen in `tests/confluence-quellabgleich/lauf3-nacharbeit.test.ts` (je Befund ein Fall nach
Bens Gegenprobe), die Anzeige in `anhaenge-am-lauf-montiert.test.tsx` (DE/EN/NL).

| Befund | Behandlung | Stelle |
|---|---|---|
| **B1** R-0549 — Quellgruppen bestimmen den Lesezugriff nicht | **nicht gebaut, gesperrt.** Die Durchsetzung wäre eine Freigabe je Nutzer/Gruppe („Variante B“), die `services/app/src/sichtbarkeit.ts:34-37` ausdrücklich als nicht entschieden benennt und „durch die Hintertür“ verbietet; Ben hält fest, dass der Befund keine Umgehung autorisiert. Braucht: Entscheidung zu Variante B und eine Zuordnung Confluence-Gruppe/-Benutzer → Klara-Identität. Bis dahin gilt nur, was gebaut ist: restringiert → `vertraulich` (sieht nur `ko.validate` oder der Autor), Quellrestriktion als Herkunftsangabe am Anker — und seit B5 auch bei Änderungen ohne neue Fassung aktuell. | — |
| **B2** R-0163 — Deckel von 200 entfernte a201 | behoben: jeder an der Eingangsgrenze verworfene Eintrag (unbrauchbar oder über dem Deckel) setzt `sourceAttachmentsIncomplete`; die Annahme entfernt dann nichts. | `library-analytics/src/quellangaben.ts` (`verworfen`) |
| **B3** R-0163 — Eintrag ohne Titel, Liste galt als vollständig | behoben: der Mapper nennt die Liste nur vollständig, wenn er **jeden** gelieferten Eintrag übernommen hat. | `confluence/src/mapper.ts` (`anhaengeBekannt`) |
| **B4** R-0163 — geänderte Abrufadresse bei gleicher Fassung | behoben: die Adresse (in der am Objekt gespeicherten Form `safeSourceUrl`) gehört zur Vorfilter-Signatur; die Angleichung vergleicht sie ohnehin. | `app/src/confluence-import.ts` (`nachzug`, `anhangsSignatur`) |
| **B5** R-0162/R-0549 — Restriktion bei gleicher Fassung geändert, Lauf übersprang | behoben: unveränderte Seiten werden auch auf Restriktion geprüft. `LibraryService.syncImportRestriction` zieht die Angabe am Anker nach (`KoService.replaceSourceReadRestriction`, Audit `ko.source-restriction-synced`, nur Anzahlen) und setzt die Vertraulichkeit **herauf**, wenn die Quelle strenger geworden ist (`setConfidentiality`, Audit `ko.confidentiality`). **Vorläufige Regel (meine, keine Nutzerentscheidung):** eine jetzt offene Seite wird **nicht automatisch herabgestuft** — das Objekt kann seit dem Import von Hand vertraulich gesetzt worden sein, und Herabstufen verlangt ein Recht (SCRUM-509). Ergebnis `restrictionsUpdated` am Lauf und auf der Laufkarte. | `library-analytics/src/service.ts`, `knowledge-object/src/service.ts` (Klassenende) |
| **B6** R-0162/package — gekürzte Listen als Ereigniszahlen | behoben: die Ablage speichert je Liste die **Gesamtzahl** (`counts`) und `listsTruncated`; gekürzt werden nur die Kennungslisten. Die Laufkarte zählt nach `counts` und nennt eine Kürzung ausdrücklich. | `app/src/quellabgleich-ablage.ts`, `apps/web/src/pages/Stufe2.tsx` |
| **B7** R-0142 — keine abgeleiteten Einheiten, keine Lückenbeziehung, Ergebnisroute ohne Elemente | **nicht gebaut — braucht Entscheidungen und eine Freigabe.** (1) Ob eine Seite in mehrere Wissenseinheiten zerlegt wird, ist nicht entschieden (heute: eine Seite, ein Objekt). (2) Die Lückendomäne kennt keine Beziehung Lücke → Wissensobjekt; der Ergebnisvertrag meldet sie deshalb ehrlich als `RELATION_NOT_AVAILABLE`. (3) Elementreferenzen für einen Kandidatenlauf gibt es im Vertrag nicht: `IMPORT_ITEM_OUTCOMES` kennt `CREATED/BOUND/SKIPPED/FAILED`, aber keinen Ausgang „als Kandidat eingereiht“; `types.ts` ist eingefroren (FREEZE-144). `ImportResultView.tsx` bleibt deshalb uneingebunden — eingebunden zeigte sie leere Flächen als Ergebnis. Bens Hinweis zur Testaussagekraft (`w2a-import-run-routes-148.test.ts` iteriert über möglicherweise leere `items`) ist richtig und hier nicht behoben: die Datei gehört zum Laufvertrag W2-A, nicht zu dieser Lieferung. | — |
| **B8** R-0163/package — Schreibfehler beim Anhangsnachzug still | behoben: der Fehler landet in `syncFailed`; der Lauf endet `PARTIAL` mit `SOURCE_SYNC_INCOMPLETE` und einem Grund, die Laufkarte nennt die Zahl (DE/EN/NL). Kann ein Adapter keine Löschungen nachfragen, trägt der Lauf bei gescheitertem Nachzug trotzdem einen Abgleich (`reason: "not-supported"`). | `app/src/confluence-import.ts`, `app/src/routes/confluence-import-routes.ts` |

**Stand der Kriterien nach Runde 2 (meine Einschätzung, Urteil bei Ben):** R-0163 und
package:confluence sind um die Fehler B2–B4/B6/B8 bereinigt; offen bleiben dort die Dateiinhalte
(nicht in Klaras Objektspeicher kopiert) bzw. „mehrere Bereiche je Lauf“. R-0162 ist für Änderung,
Löschung, Wiederauftauchen, Anhänge und Restriktion belegt, mit den benannten vorläufigen Regeln.
R-0549 und R-0142 bleiben **nicht erfüllt** (B1/B7, s. o.).

## Lauf 3 · Runde 3 — Bens Befunde B1, B7, B9, B10 einzeln

Ben (Runde 2): B2–B6/B8 bestätigt behoben; B1 und B7 bestehen fort; B9 und B10 neu. Tests für
B9/B10 in `tests/confluence-quellabgleich/lauf3-nacharbeit.test.ts`, Anzeige in
`anhaenge-am-lauf-montiert.test.tsx` (DE/EN/NL).

| Befund | Behandlung | Stelle |
|---|---|---|
| **B1** R-0549 Quellrechte bestimmen den Lesezugriff nicht | **unverändert nicht gebaut — Sperre „Variante B“** (`services/app/src/sichtbarkeit.ts:34-37`), Begründung wie Runde 2. Keine Umgehung. | — |
| **B7** R-0142 Einheiten, Lücken, Ergebnisreferenzen | **unverändert nicht gebaut** — braucht die drei in Runde 2 benannten Entscheidungen bzw. die FREEZE-144-Freigabe. Bens Hinweis zur Testaussagekraft (`w2a-import-run-routes-148.test.ts`, bedingte Prüfungen über leere Listen) bleibt richtig und unbearbeitet: die Datei gehört dem Laufvertrag W2-A. | — |
| **B9** R-0163 Erstimport > 200 Anhänge verlor den Rest dauerhaft | behoben: der Deckel der Eingangssäuberung (`MAX_QUELL_ANHAENGE`) lag mit 200 **unter** dem, was der Adapter liefert, und schnitt bei jedem Lauf dieselben 200 heraus. Er steht jetzt auf 10.000, abgestimmt auf die Nachblätter-Grenze des Adapters (`MAX_ATTACHMENT_HOPS` 20 → 200, je 50 Einträge). Oberhalb davon ist die Liste unvollständig markiert (entfernt nichts), und der Lauf weist jede Seite mit unvollständig übernommener Anhangsliste neu aus (`sourceSync.attachmentsIncomplete`, Zahl in `counts`, Zeile auf der Laufkarte). **Grenze, benannt:** eine Seite mit mehr als 10.000 Anhängen verliert den Rest weiterhin. *Korrektur Lauf 5:* „dann aber sichtbar“ traf in Runde 3 **nicht** zu (Ben: 10.001 Anhänge → Lauf `COMPLETED`, `attachmentsIncomplete=[]`); behoben in Lauf 5, s. dort. | `library-analytics/src/quellangaben.ts`, `confluence/src/rest-client.ts`, `app/src/confluence-import.ts` |
| **B10** R-0162/R-0549 Restriktionsnachzug an Altanker ohne Provider wirkungslos, trotzdem „synced“ | behoben: geschrieben wird am gefundenen Anker mit **seinem** gespeicherten Provider (die Suche wertet „ohne Provider“ als Confluence, die Schreibmethode vergleicht wörtlich). Liefert das Schreiben trotz festgestellter Änderung `false`, wirft der Nachzug; der Lauf führt die Seite in `syncFailed` (PARTIAL), und die Vertraulichkeit wird dann nicht allein heraufgesetzt. | `library-analytics/src/service.ts` (`syncImportRestriction`) |

## Lauf 5 — Übernahme unter dem aktuellen Vertrag (Aufgabenrevision 15)

Lauf 5 setzt auf dem Stand von Lauf 3 / Runde 3 (`5fb2ccf3`) auf. Der Auftrag umfasst nur noch
**R-0126, R-0131, R-0142, R-0176** und das Abgrenzungs- und Belegkriterium (Entscheidung
`6a0e73c1`, Pedi, Option A). Die übrigen Anliegen dieser Datei (R-0134, R-0153, R-0159, R-0160,
R-0162, R-0163, R-0166, R-0171, R-0182, R-0526, R-0549, R-0649, R-1005, R-1126, R-1172, R-1601,
R-1800, R-2197, package:confluence) gehören in die eigenen Aufträge `confluence-import-anhaenge`,
`-rechte`, `-hierarchie`, `-abgleich`, `-onprem-anmeldung` und `-bedienung`; ihre Zeilen oben
sind Bestandsangaben, keine Lieferzusage dieses Auftrags.

| Kriterium | Stand in Lauf 5 | Beleg |
|---|---|---|
| R-0126 | geliefert (unverändert) | Übersicht; in Lauf 5 lokal grün: `verschachtelter-import.test.ts`, `mapper.test.ts`, `adapter.test.ts` |
| R-0131 | geliefert (unverändert) | Übersicht; in Lauf 5 lokal grün: `pruefkarte-zeigt-volltext-und-quelle.test.tsx` (V3/V8), `quellhinweise-montiert.test.tsx` (H1/H2), `runde3.test.ts` (N1/N2). Nicht gemessen: Rücklink gegen eine echte Confluence-Instanz |
| R-0142 | **teilweise** — Runde 1: abgeleitete Einheiten und Lücken nicht gebaut (Widerspruch 8, B7). *Runde 2: Ergebnisweg gebaut, s. „Lauf 5 · Runde 2“; Zerlegung und Lückenbeziehung weiter offen.* | Abschnitt „R-0142 im Einzelnen“; `quellhinweise-montiert.test.tsx` (DE/EN/NL) lokal grün |
| R-0176 | Arbeitsweise, kein Produktzustand | Übersicht |

**Bens B9-Rest (R-0163, Lauf 3 R3) — behoben**, obwohl R-0163 zum Anhangsauftrag gehört: der
Fehler steckte in Code dieser Lieferung und machte die eigene Belegaussage oben falsch. Ursache:
`attachmentsIncomplete` im Laufergebnis las die rohen Adapter-Items; eine Marke, die erst die
Eingangssäuberung setzt (Deckel `MAX_QUELL_ANHAENGE`), fehlte dort. Korrektur:
`LibraryService.importAttachmentsIncomplete` wendet dieselbe Säuberung an
(`library-analytics/src/service.ts`), der Lauf nutzt sie (`app/src/confluence-import.ts`). Der
Laufstatus bleibt bei unvollständiger Anhangsliste `COMPLETED` — wie schon für die im Mapper
gesetzte Marke; der Hinweis ist `attachmentsIncomplete` samt Zahl in `counts`. Test:
`lauf3-nacharbeit.test.ts` „B9-Rest“ (Lauf, Probelauf, echte Routen); ohne die Korrektur beide
Fälle rot (`expected [] to deeply equal ['P-1']`).

**Belege des Vorlaufs, nicht wiederholt:** Vollcheck Lauf 2 rot (`pa-1790500728-a825f53a`),
gezielte PostgreSQL-Integration grün (`pa-1790500802-63a9ab41`); für Lauf 3 und Lauf 5 liegt kein
Vollcheck- oder Server-Integrationsbeleg vor (`quellabgleich-ablage.integration.test.ts` lokal
nicht ausgeführt).

## Lauf 5 · Runde 2 — Bens B7 (R-0142): der Ergebnisweg

Ben (Runde 1): B9-Rest behoben; **B7 besteht fort** — nach Lauf und Annahme lieferte
`GET /api/admin/import/runs/:id/result` `items: []`, die Lückenbindung war fest
`RELATION_NOT_AVAILABLE`, und die Ergebnisfläche hatte keinen Aufrufer. Seine Gegenprobe
(`ben-b7.test.ts`) läuft am Stand dieser Runde **grün** (Ausgabe: ein Element `CREATED` mit
Objekt-Id und Quellrevision).

**Ursache:** Der Lauf schrieb weder Quellrevision (`ExternalSourceRecord`) noch Elementreferenz
(`ImportRunItemRef`) — beide Ablagen und Vertragstypen gab es (W2-A/148), aber keinen Schreiber.

**Gebaut (innerhalb des bestehenden Wissenswegs, ohne FREEZE-144-Dateien zu ändern):**

| Teil | Wie | Stelle |
|---|---|---|
| Quellrevision je Seite | Beim Einreihen im Namen eines Laufs wird je Seite die Revision festgehalten (idempotent über Quelle+Seite+Version, unveränderlich; `rawOrRenderedContentReference = null` ⇒ `NOT_CAPTURED`, der Volltext liegt am Wissensobjekt), `sourceMetadata.importId` nennt den aufnehmenden Lauf. | `library-analytics/src/laufbindung.ts` (neu), `LibraryService.createImportCandidates` (4. Argument `lauf`), `bindeAnLauf` |
| Laufbindung am Kandidaten | `importRun = {importId, ordinal, sourceRecordId}`, nur vom Server gesetzt; die Eingangssäuberung entfernt jede vom Client mitgeschickte Bindung. | `quellangaben.ts`, `laufbindung.ts` |
| Elementreferenz bei Entscheidung | Erst die menschliche Entscheidung schreibt die Referenz: `CREATED` (Objekt trägt den Stempel genau dieses Kandidaten), `BOUND` (bestehendes Objekt fortgeschrieben/adoptiert), `SKIPPED` (abgelehnt oder als Dublette nicht angelegt). Rückfrage (`info`) schreibt nichts. Ein offener Kandidat hat **keinen** Ausgang — `IMPORT_ITEM_OUTCOMES` kennt dafür keinen Wert, und es wird keiner erfunden. | `LibraryService.vermerkeEntscheidungImLauf` (Klassenende), Verdrahtung `build-app.ts` |
| beide Laufwege | Gesamtlauf (`POST /api/admin/import/confluence`) und Selektivimport (`/apply`, Ordnung = Position in `includeIds`). | `confluence-import.ts`, `confluence-import-routes.ts` |
| Importergebnis je Wissensobjekt | `GET /api/admin/import/knowledge/:koId`: Quellrevision, Lauf, Elementausgang, Lückenbindung; `users.manage` **und** `darfSehen` am Objekt (unsichtbar/nicht importiert ⇒ 404). Nur bei eingeschaltetem Import registriert. | `import-run-routes.ts`; Vertrag `tests/security/routeGuardAudit.ts` (mit `zeilenrecht`), Urteil `PRAEDIKAT` in `mega74-lesewege-sammler.test.ts` |
| zusammenhängende Anzeige DE/EN/NL | Auf der Wissensseite (`/wissen/:id`, Abschnitt „Quellen und Belege“) — derselben Fläche mit Original, Quellen, Validierung und Widersprüchen — steht für Admins der Block „Importergebnis“: Quellfassung, Lauf, Ausgang, Lückenhinweis. Angezeigt wird nur, was der Server liefert; fehlende Teile werden benannt. Die gesperrte W2-Resultatfläche bleibt ohne Aufrufer (Block 5 in `w2a-import-run-routes-148.test.ts` grün). | `apps/web/src/components/bibliothek/ImportErgebnis.tsx` (neu), `MehrAbschnitte.tsx`, `i18n.ts` (`ko.importResult.*`) |

**Tests:** `tests/confluence-quellabgleich/r0142-ergebnisweg.test.ts` E1–E6 (E1 = Bens Gegenprobe,
dazu BOUND im zweiten Lauf, SKIPPED bei Ablehnung, Rückfrage ohne Referenz, Client-Bindung
verworfen, Objekt-Route samt 404, `/apply`); vor der Korrektur im Annahmepfad waren E1/E2/E5/E6
rot. Anzeige: `import-ergebnis-montiert.test.tsx` I1 (DE/EN/NL) bis I4; mit ausgehängtem Block alle
sechs rot.

**Wächter-Korrektur (Harness):** `tests/re-import-dubletten/port-aufrufer-waechter.test.ts` zählte
nur Argumente; ein wörtliches `undefined` an der Port-Stelle galt als „Port übergeben“. Die neuen
Aufrufe (`items, actor, undefined, lauf`) hätten den Wächter damit getäuscht und die Altfälle als
„behoben“ gemeldet. Jetzt ist ein wörtlich leerer dritter Wert portlos (Kalibrierfall W3c); die
beiden Altfall-Einträge bleiben zutreffend.

**Weiterhin nicht erfüllt bzw. nicht entschieden (konkret):**
1. *Abgeleitete Wissenseinheiten:* eine Confluence-Seite ergibt genau **ein** Wissensobjekt; das
   Ergebnis referenziert genau diese Einheit. Eine Zerlegung einer Seite in mehrere Einheiten ist
   nicht entschieden und nicht gebaut (Widerspruch 8).
2. *Lücken:* die Lückendomäne (`services/ask`, `Gap`) kennt keine Beziehung Lücke → Wissensobjekt,
   und das Wissensnetz hält ausdrücklich fest, dass „was fachlich als Lücke zählt, offen ist“
   (`services/wissensnetz/src/luecken-einstieg.ts`). Server und Fläche melden deshalb
   `RELATION_NOT_AVAILABLE` bzw. „es wird keine Lücke behauptet“. Eine solche Beziehung wäre eine
   neue Anforderung jenseits der Quellen.
3. *Laufzähler* (`counters`) bleiben die Zahlen zum Laufende (eingereihte Kandidaten,
   `itemsBound = 0`); sie werden nach Entscheidungen nicht fortgeschrieben. Die Elementreferenzen
   sind die Wahrheit (KW-S4-26 §177-179).
4. *Lauf-Quelle* `source` der Ergebnisroute bleibt bei einem Bereichslauf `null` (ein Lauf über
   viele Seiten hat keine einzelne Revision); die Revision steht je Element (`sourceRecordId`).
5. *Grenzen der Bindung:* (a) Die Objekt-Route findet den Lauf über die Revision; wurde dieselbe
   Fassung in einem früheren Lauf abgelehnt und in einem späteren erneut eingereiht und angenommen,
   zeigt sie den früheren Lauf ohne Ausgang für dieses Objekt („kein Ausgang“), die Ergebnisroute des
   späteren Laufs trägt die Referenz korrekt. (b) Ein Accept, den erst die Claim-Recovery
   (`recoverStaleReviewClaims`) vollendet, schreibt keine Referenz. (c) Scheitert das Schreiben der
   Referenz nach einer bereits gespeicherten Entscheidung, wird das laut protokolliert, die
   Entscheidung bleibt. (d) Kandidaten aus Läufen vor dieser Runde tragen keine Bindung.
6. *PostgreSQL-Weg nicht lokal gemessen:* Der Lauf schreibt jetzt in `PgExternalSourceRepo`, die
   Entscheidung in `PgImportRunRepo.appendItemRefs` (beide unverändert, FREEZE-144). Gehört auf den
   Prüfserver: `services/library-analytics/src/repo-pg.integration.test.ts`,
   `services/app/src/quellabgleich-ablage.integration.test.ts` und der Liefercheck.
7. *Bekannter Fremdbefund:* `npx depcruise` meldet einen Zyklus `apps/web/src/api/types.ts →
   app/navigation.ts → lib/captureFrontDoor.ts → api/types.ts`; er besteht im Ausgangsstand
   (`types.ts` importiert `Role` aus `navigation`), diese Runde ändert keine dieser Kanten.

## Lauf 5 · Runde 3 — Bens B7 (Lücken), B11, B12, B13

Ben (Runde 2): Ergebnisweg bestätigt; offen blieben die Lücken (B7) und drei ausgeführte
Randfälle (B11–B13). Seine unveränderten Proben `ben-b7.test.ts` und `ben-r2-randfaelle.test.ts`
laufen am Stand dieser Runde **grün** (4/4).

| Befund | Ursache | Korrektur | Beleg |
|---|---|---|---|
| **B11** Ablehnung in Lauf 1, Annahme derselben Fassung in Lauf 2 → Objekt zeigte Lauf 1, `item: null` | Die Objekt-Route fand den Lauf über `sourceMetadata.importId` der Revision — das ist der Lauf, der die Fassung ZUERST aufnahm, nicht der der Annahme. | Der Herkunftsanker trägt jetzt `importRunId` = Lauf der Annahme, die ihn geschrieben hat (Erstanlage und Fortschreibung; `buildSource`, `KoSource.importRunId` additiv). Die Route liest diesen Lauf und darin die jüngste Referenz auf genau dieses Objekt; die Revision ist die der Referenz. Nur Altanker ohne Kennung fallen auf die Revision zurück. | `r0142-ergebnisweg.test.ts` E8; ohne die Ankerkennung rot |
| **B12** einmaliger Schreibfehler der Referenz → dauerhaft `items: []` | Der Fehler wurde nur protokolliert; nichts holte die Referenz nach. | `LibraryService.zieheLaufReferenzenNach`: je entschiedenem, laufgebundenem Kandidaten fehlende Referenzen nachschreiben (je Lauf ein `listItemRefs`, nur Fehlendes, idempotent über `(importId, ordinal)`). Läuft am Ende jeder `recoverStaleReviewClaims` — also bei jedem Laden der Prüfwarteschlange (`library-routes.ts`), auch wenn nichts hing. | E9 (zweiter Nachzug schreibt 0); ohne Nachzug rot |
| **B13** Wiederaufnahme vollendet Annahme, schreibt keine Referenz | `recoverStaleReviewClaims` kannte die Laufbindung nicht. | Derselbe Nachzug direkt nach der Vollendung; Ausgang über dieselbe Regel wie live (`schreibeLaufReferenz`: `CREATED`, wenn das Objekt den Stempel genau dieses Kandidaten trägt, gesucht inkl. Papierkorb). | E10 (idempotent bei Wiederholung); ohne Nachzug rot |
| **B7** Lücken fest `RELATION_NOT_AVAILABLE` | Die Lückendomäne kennt keinen Objektbezug (Lücken entstehen aus unbeantworteten Fragen; auch „Erfassen aus Lücke“ speichert keine Bindung). | Der Bezug wird **aus vorhandenen Serverdaten** erhoben, ohne neue Zuordnungsregel: `AskService.offeneLueckenZu` rechnet für jede offene Lücke die deterministische Vorauswahl der Antwortsuche (`prefilterCandidates` über `queryTokens(frage)`) — eine offene Lücke betrifft ein Objekt, wenn die Antwortsuche es für ihre Frage heranzieht. Kein KI-Aufruf, kein Schreiben. Beide Ergebnisrouten liefern dann `AVAILABLE` + Kennungen (`[]` = nachgesehen, keine), die Objekt-Route zusätzlich die Lücken redigiert wie `/api/gaps` und den Prüfumfang `knowledgeGapScope`. Nur sichtbare Objekte bekommen einen Bezug (`darfSehen`, im Routenvertrag als `zeilenrecht` eingetragen). Die Wissensseite zeigt Anzahl, Fragen (bzw. „Fragetext nicht freigegeben“), die Regel und — falls gedeckelt — den Umfang, in DE/EN/NL. | E7 (Lücken über den echten Antwortweg angelegt, BEVOR das Wissen importiert wurde: die passende steht am Objekt und am Element, die fremde und eine geschlossene nicht); Anzeige `import-ergebnis-montiert.test.tsx` I2 (DE/EN/NL), I2b |

**Grenzen, benannt:**
1. *Lückenbezug ist eine Ablesung, keine Kuratierung:* er sagt „die Antwortsuche zieht dieses
   Wissen für diese offene Frage heran“, nicht „dieses Wissen beantwortet sie“. Ob eine Lücke damit
   geschlossen ist, entscheidet weiter ein Mensch (`/api/gaps`).
2. *Deckel:* je Aufruf werden die 50 jüngsten offenen Lücken geprüft (`OFFENE_LUECKEN_BEZUG_DECKEL`,
   je Lücke eine Vorauswahl mit bis zu 8 Abfragen). Bei mehr offenen Lücken ist die Liste eine
   Untergrenze; Antwort und Fläche sagen das (`knowledgeGapScope`).
3. *Ohne verdrahteten Lückenport* (direkt konstruierte Routen) bleibt die Antwort ehrlich
   `RELATION_NOT_AVAILABLE` — so in Bens Probenaufbau; die Kompositionswurzel verdrahtet ihn.
4. *Nachzug nur beim Laden der Prüfwarteschlange:* bis dahin fehlt nach einem Schreibfehler die
   Referenz am Lauf. Kandidaten aus Läufen vor Runde 2 tragen keine Bindung; Altanker ohne
   `importRunId` nutzen weiter die Revision (Grenze 5a aus Runde 2 gilt nur noch für sie).
5. *Abgeleitete Wissenseinheiten:* unverändert eine Seite = ein Objekt; Ben leitet aus R-0142 keine
   Pflicht zur Zerlegung ab.
6. *PostgreSQL nicht lokal gemessen:* zusätzlich zu Runde 2 liest der Lückenbezug `findCandidates`
   je Lücke auf der echten Ablage; `importRunId` reist im JSON des Ankers (keine Migration).
   Serverprüfung wie in Runde 2 benannt.

## Lauf 5 · Runde 4 — Bens B14, B15, B16 (Kandidat `97b9bdc3`)

Ben (Runde 3): B11–B13 bestätigt behoben, B7 liefert Lücken aus echten Dienstdaten. Drei neue
Befunde; je einer hier, mit Test. Diese Runde wurde **ohne eigene Testausführung** geliefert (der
Auftrag untersagt Testläufe in dieser Sitzung); die Tests laufen über `CLAUDE/PRUEFPLAN.json`. Grüne
Belege früherer Runden gelten nur für ihre Fassung.

| Befund | Ursache | Korrektur | Test |
|---|---|---|---|
| **B14** Lesefehler der Herkunftsabfrage → `BOUND` statt `CREATED`, dauerhaft | `schreibeLaufReferenz` fing den Fehler von `findByImportCandidateId` als „kein Stempel“ ab. | Kein Abfangen mehr: bei Lesefehler entsteht **keine** Referenz (Entscheidung bleibt gespeichert, Fehler protokolliert); der Nachzug schreibt sie beim nächsten Laden mit dem richtigen Ausgang. `undefined` heisst nur noch „kein Objekt trägt den Stempel“. | `r0142-ergebnisweg.test.ts` E11 (Bens Probe nachgebaut) |
| **B15** abgeschaltete KI → beide Ergebnisrouten HTTP 500 | Der Lückenbezug nutzt die KI-sperrgebundene Vorauswahl; ihr `KI_ABGESCHALTET` lief bis an die Route durch. | Die Sperre bleibt unangetastet. Die Routen fangen den Fehler des Lückenbezugs ab und liefern das gespeicherte Ergebnis mit `RELATION_NOT_AVAILABLE` und `knowledgeGapUnavailableReason` (`KI_ABGESCHALTET` bzw. `LUECKENBEZUG_FEHLER`). Die Wissensseite nennt den Grund (DE/EN/NL). | E12 (echter Abschaltweg `PUT /api/reasoner/config`); `import-ergebnis-montiert.test.tsx` I6 |
| **B16** 50 von 51 geprüft, kein Treffer → „Keine offene Wissenslücke betrifft dieses Wissen.“ | Der Satz hing nur an der Trefferzahl. | Bei begrenzter Prüfung heisst es jetzt „Unter den 50 geprüften offenen Lücken betrifft keine dieses Wissen. Über die übrigen ist nichts gesagt.“ (DE/EN/NL); die globale Aussage nur bei vollständiger Prüfung. | `import-ergebnis-montiert.test.tsx` I5 (DE/EN/NL, Bens Fall) |

**Weiter offen:** R-0131 — kein an diese Fassung gebundener Beleg einer tatsächlichen Navigation zur
Confluence-Seite; vorhanden sind nur die jsdom-Prüfungen der gerenderten Zieladresse
(`pruefkarte-zeigt-volltext-und-quelle.test.tsx` V3/V8, `quellhinweise-montiert.test.tsx` H1/H2) und
die URL-Bildung (`mapper.test.ts`). Fehlende Mittel: eine erreichbare Confluence-Testinstanz und ein
Mensch bzw. Browserlauf gegen sie. PostgreSQL-Nachweise wie in Runde 2/3 benannt.

**Nacharbeit 1 (Kandidat `2153161b`, Prüflauf):** (a) `services/app/src/quellabgleich-ablage.integration.test.ts`
scheiterte am Prüfserver ohne Container-Laufzeit („Could not find a working container runtime
strategy“), beide Fälle unausgeführt. Er nutzt jetzt wie `repo-pg.integration.test.ts` zuerst die
abgesicherte `KLARWERK_PG_TEST_URL` (`guardedLocalPgTestUrl`), sonst Testcontainers; ohne beides
scheitert er weiter hart. Eigene Zeilen tragen ein Präfix und werden danach entfernt.
(b) `tests/security/mega74-lesewege-sammler.test.ts` ist rot wegen `GET /api/support` ohne
Register-Urteil — eingeführt vom Supportkontakt-Auftrag und mit dem Hauptstand integriert, von
dieser Lieferung nicht berührt. Nicht hier repariert; aus der Auftragsauswahl genommen und als
fremder Basisbefund benannt. Der globale Test bleibt rot, bis jener Auftrag sein Urteil nachträgt.

**Nacharbeit 2 (Integration mit main `5f3e3a81`):** acht Konfliktdateien zusammengeführt, beide
Seiten erhalten. Fachlich wichtig: main schreibt seit R-0169 die Quellrevision selbst bei der
Annahme (`quellrevisionFestschreiben`, Schlüssel `importProviderKey`, Abdruck `quellinhaltAbdruck`,
CONFLICT bei anderem Inhalt). Die Laufbindung (R-0142) schrieb sie bisher mit eigenem Schlüssel und
Abdruck beim Einreihen — die spätere Annahme wäre daran gescheitert. Jetzt schreibt **ein** Weg:
`bindeAnLauf` ruft `quellrevisionFestschreiben`; `halteQuellrevisionFest` ist entfernt. Der Anker
trägt `sourceRecordId` (main) und `importRunId` (hier) nebeneinander; die Objekt-Route liest die
Revision zuerst über `sourceRecordId`. `createImportCandidates` nimmt `quellangabenEingereicht`
(main) und `lauf` (hier) im selben Optionsobjekt. Der Laufabschluss setzt den Leseabbruch-Code aus
main vor `SOURCE_SYNC_INCOMPLETE`.

**Nacharbeit 3 (Prüflauf Kandidat `eff67eaa`):** Eigene Befunde behoben — `IMPORT_RUN_SOURCE_SYNC_SCHEMA`
steht nach der Zusammenführung wieder am Ende von `schemas` (`db.ts`) und des Migrationsbelegs
(`quellabgleich-ablage.test.ts` verlangt das wörtlich); eine überzählige Leerzeile in
`import-run-routes.ts` (Biome) entfernt. Fremde Basisbefunde aus main `5f3e3a81`, hier nicht
repariert und aus der Auftragsauswahl genommen: Drilltabellen von `MANAGEMENT_PROFILE_SCHEMA`
(`tabellensatz.test.ts`), fehlendes `zeilenrecht` der unveränderten Bibliotheks-Importrouten (`g10`),
`DokumentError`/`ManagementProfileError` und drei Codes auf den Loglisten (`build-app.test.ts`).

**Nacharbeit 4 (Integration mit main `3127ef2c`):** sechs Konfliktdateien, beide Seiten erhalten.
(a) i18n: main hat die Wörterbücher nach `apps/web/src/woerterbuch/` verlegt; neue Texte gehören in
Textmodule. Die 33 Texte dieser Lieferung (DE/EN/NL, Wortlaut unverändert) stehen jetzt in
`apps/web/src/texte/confluenceimport.ts`, unter ihren bisherigen Namen (`legacySchluessel`).
(b) R-0162: main bringt die Lieferung des ausgegliederten Abgleich-Auftrags (`reconcileRemovals`,
`adapter.isGoneAtSource`, `getPageStateById`): eine bestätigt gelöschte Seite schickt ihr Objekt in
den Papierkorb, solange es keine weitere Quelle trägt. Diese Regel ist maßgeblich und läuft zuerst;
der Quellabgleich dieser Lieferung läuft danach, sieht nur noch aktive Objekte und vermerkt
`sourceRemovedAt` damit nur an stehen gebliebenen (R-0131: der Rücklink verspricht dort nichts mehr).
Seine Einzelnachfrage nutzt jetzt `isGoneAtSource` statt `fetchItem`, weil mains `getPageById` eine
unbrauchbare 2xx-Antwort als „nicht vorhanden" liest. Der doppelte `sourceScope`-Getter im Adapter
ist entfernt. `PARTIAL` zählt beide Abgleiche. (c) Annahme: main hat sie hinter die Annahme-Sperre
verlegt; Säuberung samt Quellangaben und Laufbindung sitzen jetzt in deren Schritten (`annehmen`,
`nachSperrverlust`). `recoverStaleReviewClaims` nimmt mains Dublettenregel und zieht danach weiter die
Elementreferenzen nach. **Folge für frühere Tests dieser Lieferung:** Fälle, die nach einer
bestätigten Löschung ein AKTIVES, nur vermerktes Objekt erwarten (z. B. `runde3.test.ts` N2,
`abgleich.test.ts`), widersprechen mains maßgeblicher Papierkorb-Regel aus R-0162 (ausgegliedert) und
können rot werden; sie sind dann dem Abgleich-Auftrag zuzuordnen, nicht hier umzudeuten.

**Nacharbeit 5 (Integration mit main `52b0f80e`):** sieben Konfliktdateien, beide Seiten erhalten.
main bringt die Lieferung des ausgegliederten Anhangs-Auftrags (R-0163): Anhangsliste je Seite
(`listAttachments`, Rückgabe `truncated`), Dateiinhalte (`downloadAttachment`, `fetchAttachment`,
Übernahme in den Objektspeicher über `anhaenge` am `LibraryService`), Item-Felder
`attachments`/`attachmentsIncomplete`. Die Herkunftsangaben dieser Lieferung (Anhänge als Quellen am
Objekt, `sourceAttachments`/`sourceAttachmentsIncomplete`) bleiben daneben bestehen; die Felder
überschneiden sich nicht. Gleich benannt war nur die Client-Methode: meine strenge Liste (wirft bei
unbrauchbarer Antwort, Bens A1) heißt jetzt `listAttachmentsStreng`. `fetchItem` liefert beide
Angaben. Der Laufabschluss nennt mains Anhangslücke und den Quellabgleich dieser Lieferung unter
demselben Code `SOURCE_SYNC_INCOMPLETE` (eine Konstante); der Leseabbruch geht vor. Grenze: zwei
Anhangsmodelle für dieselbe Seite sind eine Doppelung, die der Anhangs-Auftrag auflösen sollte — sie
hier zu entscheiden, wäre eine Produktentscheidung jenseits dieses Auftrags.

## Abgrenzung

- SharePoint/OneDrive-Import (JOB 4086) ist ein eigener Adapter und eigener Auftrag.
- Jira ist im Nutzen genannt, aber kein Kriterium dieses Auftrags.
- Die Vorführseite `apps/web/public/demonstration/importwege.html` (JOB 3138) erklärt den Import,
  ist aber kein Live-Import.
