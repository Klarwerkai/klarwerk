# Originalautor und Herkunft über Änderungen — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-wissen-herkunft` (Revision 1). Leitgedanke G-4 /
FR-LIF-04: „Herkunft bleibt sichtbar, der Originalautor geht nie verloren.“ Basisstand `fadddf37`
(`1.0.0-beta.1.770`). Das Verhalten prüfen die unten genannten Tests; dieses Dokument selbst liest
kein Test.*

Die Auftragsquelle führt die meisten Punkte nur mit Altquellen („Historische Aussage, heutige
Erfüllung nicht erneut geprüft“). Dieses Dokument ordnet jeden Punkt dem heutigen Bestand zu.
„Belegt durch“ nennt Verhaltenstests; ob sie auf diesem Stand grün sind, sagt erst ihr Lauf, nicht
dieses Dokument. Seit Nacharbeit 1 ist jeder Punkt am heutigen Code abgeglichen; wo ein Teil fehlt,
steht die konkrete Restarbeit oder die offene Entscheidung dabei.

## In diesem Auftrag geliefert: „gelöscht“ als eigener Zustand der Autorenzeile (K3)

Vorher hatte die Autorenzeile vier Zustände (Name, „Unbekannte Person (ref)“, „wird geladen“,
„nicht abrufbar“; mega62 H / mega63 B, R-0874 / R-1946). Ein **gelöschtes** Konto fiel auf
„Unbekannte Person“ — ein Mensch, den es nachweislich gab, sah aus wie eine Kennung, die nie eine
Person war. Jetzt:

- **Dienst** (`AuthService.listDeletedUserIds`): die Kennungen gelöschter Konten stammen aus dem
  Prüfprotokoll (`user.delete`, Ziel = Kennung). Eine Kennung, die heute wieder ein Konto ist, zählt
  nicht. Ohne verdrahtetes Protokoll gibt es keinen Beleg und damit keine gelöschten Kennungen.
- **Route** (`GET /api/directory`, `requireUser`): hinter den Konten stehen gelöschte Konten als
  `{ id, geloescht: true }` — **ohne Namen**. Den Namen von damals liest weiterhin nur die
  Verwalteransicht aus dem Prüfprotokoll (N-0027). Damit gilt „Namen nur mit geltenden Leserechten
  auflösen“ auch für Gelöschte.
- **Client**: `endpoints.directory.list` trennt die Marken ab (`lib/geloeschteKonten.ts`);
  Zuweisungslisten sehen nur Konten. `useAuthorName` reicht die Kennungen an den einen Auflöser
  (`lib/koAuthor.ts`), der „Gelöschtes Konto (ref)“ / „Deleted account (ref)“ / „Verwijderd account
  (ref)“ zeigt. Ein gepflegter Name gewinnt immer; Laden und Fehler bleiben unverändert und sagen
  nichts über die Person.

Belegt durch: `tests/wissen-herkunft/geloeschtes-konto-in-der-autorenzeile.test.ts` (neu),
`tests/ko/mega62-autor-verzeichnis.test.ts` (Bestand).

## Nacharbeit 1 geliefert: sichtbarer Autorenname im Ausgabedokument (R-0298, FR-LIF-04)

Bens Befund: Output Factory und Bibliotheksexport schrieben die **Kontokennung** in die
Autorenzeile. Jetzt:

- **Kompositionswurzel** (`services/app/src/autorennamen.ts`): `autorenNamenAus(auth)` löst
  Kennungen mit derselben Leseregel wie `GET /api/directory` auf — Anzeigename, „Gelöschtes Konto
  (ref)“, „Unbekannte Person (ref)“; fällt das Verzeichnis aus, „Autorenname nicht abrufbar“. Den
  Namen eines gelöschten Kontos gibt diese Stelle nie heraus. `build-app.ts` baut den Kontodienst
  dafür eine Stufe früher (dieselbe Instanz, die als `auth` zurückgegeben wird).
- **Output Factory** (`services/output`): Herkunftsblock und Management-Summary zeigen
  „Autor: Name (urspr. Name)“; der Datensatz behält `author`/`originalAuthor` als Kennung und trägt
  zusätzlich `authorName`/`originalAuthorName`. Ob eine Übergabe vorliegt, entscheiden die
  Kennungen, nicht die Texte.
- **Bibliotheksexport** (`services/library-analytics`): Markdown und HTML zeigen den Namen; der
  MediaWiki-Export hatte gar keine Autorenzeile und trägt jetzt dieselbe.
- Ohne verdrahtete Auflösung (Dienst direkt gebaut) bleibt es bei den Kennungen wie bisher.

Belegt durch: `tests/wissen-herkunft/autorenname-im-ausgabedokument.test.ts` (neu),
`services/output/src/service.test.ts`, `services/library-analytics/src/service.test.ts`,
`tests/library/ai-check-coverage-reach.test.ts` (Bestand).

**Abgegrenzt, nicht geändert:** der SCORM-Export für Lernplattformen (`services/output/src/scorm.ts`,
eigener Auftrag `produkt:wettbewerb:20261003:lernplattform`). Seine „Herkunft je Einheit“ nennt
Objektkennung, Fassung und Stand, aber **keinen Autor** (`scorm.ts:368-369`). Das ist eine konkrete
technische Restarbeit am Umfang von R-0298 (mehrsprachiger Herkunftstext im SCORM-Paket); sie steht
in den Zielpfaden jenes Auftrags und wurde hier nicht doppelt gebaut. Die KA6-Zuruf-Antwort
(`services/output/src/zuruf.ts`) liefert nur einen Herkunftsdatensatz mit Kennungen, kein
Dokument mit Autorenzeile; ob ihre Fläche Namen auflöst, wurde hier nicht nachgemessen.

## Zuordnung je Originalpunkt

| Punkt | Heute | Belegt durch |
| --- | --- | --- |
| R-0057, R-2100, SOLL:FR-CAP-07 — Originalautor bleibt beim Fortsetzen eines Entwurfs | **Vorhanden vor diesem Auftrag.** Das Wissensobjekt trägt den Entwurfs-Autor, nicht den Bearbeiter. | `services/capture/src/service.test.ts` (FR-CAP-07), `tests/app/ko-author-paths.test.ts` |
| R-0083 — Herkunftskette bleibt über Änderungen | **Vorhanden vor diesem Auftrag.** `revise` übernimmt `author`/`originalAuthor` unverändert, jede Fassung als Schnappschuss. | `tests/ko/ko-lineage.test.ts`, `tests/audit-gesamt/objektkette.test.ts` |
| R-0110 — alle „frontdoor“-Fundstellen umschreiben | **Verworfen (entschiedene Grenze).** In diesem Auftrag keine frontdoor-Stelle geändert. | — |
| R-0114, R-0573, R-1863 (W10) — Weisungs-Fakt / befugte Person setzt Wissen gültig | **Offen — Entscheidung für Pedi.** Es gibt keine Weisungsbefugnis im Rechtemodell (`docs/entscheidungen/konfliktklassifikation.md`, „Grenzen“). Zu entscheiden: wo die Befugnis sitzt (neues Recht, Konto-Eigenschaft oder Controller/Verwalter) und ob eine Weisung nachgelagert gesichtet wird. Ohne diese Entscheidung nicht gebaut. Vorhanden und nahe dran: Verwalter-Freigabe in einem Schritt mit Protokolleintrag (`ko.admin-validated`, R-1093), Vorrang/Geltungsbereich im Konfliktsystem. | — |
| R-0164, R-0178 — Wissen aus extern freigegebenem Dokument ohne Neuprüfung / als externe Referenz | **Offen — Richtungsentscheidung.** Die Quelle selbst nennt „ob das überhaupt so gewollt ist“ als offen (W2, vom Boss zurückgestellt). Nicht gebaut. | — |
| R-0204 — Evidenz je Quelle und Anhang mit Fassung, Herkunft, Zeitpunkt | **Vorhanden vor diesem Auftrag.** `EvidenceRecord` mit `koVersion`, `createdBy`, `createdAt`. | `tests/demo-erster-nutzerweg/promote-traegt-die-herkunft.test.ts` |
| R-0222 — System- und Nutzereigentum am Antwortbeleg | **Vorhanden vor diesem Auftrag** (JOB 541 D3, `owner` am Antwortbeleg; Systemantwort bleibt Systemeigentum). | `services/ask/src/snapshot-ko-version-und-ref.test.ts` |
| R-0218 (OFFEN G10) — der Platzhalter in `provenance-routes.ts` darf nicht scharf gehen, bevor der Zugriffsschutz (G1) steht | **Erfüllt.** Die Voraussetzung steht: `GET /api/kos/:id/provenance` prüft das Zentrum (`darfSehen`, 404 bei fehlender Sichtbarkeit) und jede Konfliktgegenseite fail-closed (`provenance-routes.ts:110`, `:130`); die Route ist damit gleich streng wie `GET /api/kos/:id`. Die Prüfliste führt das Zeilenrecht gemessen (`routeGuardAudit.ts:288`). Keine Restarbeit. | `tests/security/job1170-herkunft-zentrum-vertraulich.test.ts`, `tests/security/g10-herkunft-zentrum-vertraulich.test.ts` |
| R-0714 — vorbereiteter Herkunftsweg bleibt inaktiv, bis seine Voraussetzung steht | **Erfüllt als Zustand.** Die Route ist nur registriert, wenn der Betriebsschalter `herkunft` an ist (Vorgabe AUS, `provenance-routes.ts:79-81`); die Oberfläche ruft sie nirgends auf (Leserregister Art „ohneFlaeche“). Die Herkunftskette am Objekt kommt unabhängig davon aus dem Prüfprotokoll (`lib/koLineage.ts`). **Offene Entscheidung (Betrieb/Pedi):** ob und wann der Schalter angeschaltet und eine eigene Fläche dafür gebaut wird — die Quellen enthalten dazu keine Entscheidung. | `tests/app/mega46-schalter-auskunft.test.ts`, `tests/funktionsschalter/schalter-leser.test.ts` |
| R-0225 — Validierungsreferenz am Wissensobjekt | **Erfüllt.** `KnowledgeObject.validationDecisionRef { auditSeq, auditHash }` (`knowledge-object/src/types.ts:650`) wird nur aus dem Rückgabewert des Entscheidungsbelegs geschrieben — atomar mit Zustand und Beleg (`service.ts:6310`) und beim nachträglichen Setzen (`service.ts:6397`). Der Antwortbeleg übernimmt den Verweis; geprüft wird er über `pruefeValidationDecisionRef` (eine Revision macht ihn folgerichtig `WRONG_SUBJECT`). Altbestand ohne Feld ist ehrlich `MISSING`, kein Backfill (Pedis Entscheidung). | `services/ask/src/snapshot-ko-version-und-ref.test.ts` (Lauf Nacharbeit 1: bestanden), `services/validation/src/validation-ref-67.test.ts`, `tests/app/w3c-ko-validierungsreferenz-traeger-134.test.ts` |
| R-0228 — Verifizierungsmarke mit Prüfer und Zeitpunkt | **In Nacharbeit 3 geliefert.** Die Lesefläche zeigt direkt unter dem Kopf des Eintrags eine Marke (`components/trust/Verifizierungsmarke.tsx`): wer fachlich prüfte, wann, für welche Fassung (mit Hinweis, wenn die Prüfung einer früheren Fassung galt), wer die Validierung getragen hat, und ob der maschinelle Prüflauf vollständig, unvollständig (x von y) oder ohne Abdeckungsprotokoll war. Der menschliche Teil kommt serverseitig aus GENAU dem verwiesenen Protokolleintrag (`services/app/src/verifizierungsmarke.ts`, Folgenummer und Hash müssen passen, kein Suchen), nur an `GET /api/kos/:id` hinter dem Sichtbarkeitstor; Prüfer als Kennung, Namen über das Verzeichnis. Fehlendes heißt ehrlich „Fachliche Prüfung nicht belegt“ (kein Entscheidungsverweis — seit Nacharbeit 5 neutral, weil Altbestand den Verweis auch nach einer Validierung nicht trägt und nicht nachgetragen wird; vorhandene Validierende stehen getrennt daneben), „nicht auffindbar“, „nicht abrufbar“, „nicht geladen“ bzw. „keine erfasst“. **Grenze:** die Marke ist eine Anzeige; die volle Kettenprüfung des Protokolls führt weiterhin der Antwortbeleg (`pruefeValidationDecisionRef`). | `tests/wissen-herkunft/verifizierungsmarke.test.ts`, `tests/wissen-herkunft/verifizierungsmarke-anzeige.test.tsx` |
| R-0241 — Quell-Autor in der Validierung sichtbar | **Vorhanden vor diesem Auftrag** (Prüfkarte zeigt den Quell-Autor über `originalAuthor`). | `tests/app/ko-author-paths.test.ts` (FIX 4) |
| R-0268 — Herkunftssätze im Editor geschützt | **Historisch erledigt belegt** (27.08.). | — |
| R-0298, SOLL:FR-LIF-04, R-2130 — Herkunftszeile / Autor überall sichtbar, auch an jedem Ausgabedokument | **Teilweise erfüllt, in Nacharbeit 1 weitgehend vervollständigt.** Oberfläche: Bibliothek, Detail, Aufgaben, Fragen, Risiko, Validierung über `useAuthorName` (Bestand), um „gelöscht“ ergänzt. Bis Nacharbeit 1 nannten Ausgabedokumente nur die **Kennung**; jetzt Namen in Output Factory und Bibliotheksexport (Markdown, MediaWiki, HTML), s. Abschnitt oben. **Rest:** SCORM-Export ohne Autor — abgegrenzt zum Auftrag `produkt:wettbewerb:20261003:lernplattform`. Fachbereich, Version, Status und Gültigkeit stehen im Herkunftsblock der Output Factory bereits. | `tests/wissen-herkunft/autorenname-im-ausgabedokument.test.ts`, `tests/ko/mega62-autor-verzeichnis.test.ts`, `services/output/src/service.test.ts` |
| R-0532, R-1837 (OFFEN G15) — Urheberschaft an Bildern über den Anhangseintrag | **Erfüllt.** Beide Regeln stehen in `services/app/src/sichtbarkeit.ts:909-941`: (a) ein Anhangseintrag mit serverseitigem Verfasser schlägt den Verfasser der Fassung; (b) eine Fließtext-Fundstelle zählt nur, wenn sie gegenüber der Vorgängerfassung neu eingebracht wurde. Die benannte Restgröße („`fassung.author` ist kein angemeldeter Nutzer“, Import-Re-Sync) ist mit mega82 Block A / OFFEN G21 geschlossen: der Import handelt als angemeldeter Importeur, der Quellautor reist nur als `originalAuthor`. Keine Restarbeit bekannt. | `tests/security/mega80-verfasser-buergt-nicht-fuer-geerbtes.test.ts`, `tests/security/mega82-importeur-handelt.test.ts` |
| R-0737, R-1744 — Herkunftskette / Lineage-Sicht je Wissen | **Vorhanden vor diesem Auftrag** (`lib/koLineage.ts`, Abschnitt in `MehrAbschnitte.tsx`). Quellenwiderspruch: Frontend-Checkliste FE-ANA-05 „Stufe 2, Haken leer“ gegen Gesamtkonzept „gebaut“. | `tests/ko/ko-lineage.test.ts` |
| R-0874, R-1946 (A22) — Autorenname mit ehrlichen Zuständen | **Historisch erledigt belegt** (Ship 9); in diesem Auftrag um „gelöscht“ ergänzt (s. oben). | s. oben |
| R-0879 — Herkunfts-Kennzeichen am Wissensstück | **Historisch erledigt belegt** (K1.2, Commit `423cc34`). | `apps/web/src/pages/Library.origin-chip.test.tsx` |
| R-1093 — Verwalter-Sonderweg „als wahr kennzeichnen“ | **Codepfad vorhanden** (`ko.admin-validated`); hier nicht erneut geprüft. | — |
| R-1355 — Herkunftsangaben nur aus einer zentralen Stelle (automatische Codeprüfung) | **In Nacharbeit 3 geliefert.** Abgleich: die Herkunftsfelder des Wissensobjekts (`originalAuthor`, `origin`, `importCandidateId`, `importedVia`, `dokumentHerkunft`) entstanden schon nur in `KoService.create` — alle Anlagewege (Entwurfs-Promote, Bibliotheksimport, Dokumentweg, Seed) bringen nur EINGABEN mit. Die Regel steht jetzt als eine Funktion in `services/knowledge-object/src/herkunft.ts` (`urheberschaftBeiAnlage`, `herkunftsmerkmaleBeiAnlage`), `create` benutzt sie unverändert in Verhalten und Feldreihenfolge. Die Codeprüfung (Syntaxbaum, mit eingeschleusten Gegenfällen kalibriert) sichert: im Wissensobjekt-Modul setzt nur `herkunft.ts` diese Felder (einzige Ausnahme `KoProposal.origin`); dienstweit leitet niemand sonst den Wissensträger ab (`originalAuthor:` mit Bedingung/Rückfall); niemand schreibt den Wissensträger eines bestehenden Objekts um (`{ ...vorhanden, originalAuthor }`). Die Quellenliste hat ihren eigenen zentralen Weg (`sanitizeSources`). **Grenze (R-0110):** die frontdoor-Fundstellen des Entwurfswegs sind unberührt. Der Auftragstext von JOB 1451 liegt den Quellen weiterhin nicht bei; die Umsetzung folgt dem Wortlaut von R-1355. | `tests/wissen-herkunft/herkunft-nur-zentral.test.ts` |
| R-2205, package:herkunft — Herkunft und Vertrauenswerte am Wissen | Sammelpunkt; Teile s. R-0204, R-0222, R-0737. | — |
| P-IMPORT-NACHWEIS-FREIGABE — Import → Nachweis → Freigabe | **Erledigt laut Quelle** (JOB 4013/4077/4095, `1.0.0-beta.1.530`); kein Rest. | `tests/quelle-dateiname-am-nachweis/datei-an-der-pruefkarte.test.tsx`, `tests/bibliothek-quellennachweis/nachweis-im-bibliotheksabschnitt.test.tsx` |
| P-PROMOTE-HERKUNFT — promote trägt die Herkunft | **Erledigt laut Quelle** (JOB 3934/4137, `1.0.0-beta.1.534`). | `tests/demo-erster-nutzerweg/promote-traegt-die-herkunft.test.ts` |
| K1 Importeur / Bearbeiter / Verantwortlicher getrennt; Übergabe schreibt Herkunft nicht um | **Vorhanden vor diesem Auftrag.** `setAuthor` (FR-LIF-02) ändert nur `author`; `originalAuthor` bleibt; Importeur handelt, die Genannte bleibt Urheberin; `ownership.owner` ist getrennt von `author`. Die einzelne Autorenübergabe ist belegt und wird nicht neu gebaut. | `services/lifecycle/src/service.test.ts`, `tests/json-herkunft-rundlauf/urheberschaft-im-rundlauf.test.ts`, `tests/json-herkunft-rundlauf/herkunft-identitaet-importeur.test.ts`, `tests/security/mega82-importeur-handelt.test.ts` |

## Quellenwidersprüche und fehlende Belege

- R-0737 / R-1744: Konzeptpapier (31.07.) „gebaut“ gegen Frontend-Checkliste (23.06.) „Stufe 2“.
- R-0114 / R-0573: beide verweisen auf dieselbe offene W10-Entscheidung; keine jüngere Entscheidung
  in den Quellen.
- R-0164 / R-0178: eine Quelle „offene Richtungsfrage“, die andere „vom Boss zurückgestellt“.
- R-0225 und R-0532: die Quellen sagen „Einbau nicht belegt“; der heutige Code trägt beide
  (Abgleich Nacharbeit 1, s. Tabelle). Die Quellenaussage ist damit überholt.
- R-1355: die Quelle sagt „gebaut, wartet auf Einbau“; im Bestand war nichts davon vorhanden, und
  der Auftragstext von JOB 1451 fehlt in den Quellen. In Nacharbeit 3 nach dem Wortlaut von R-1355
  neu gebaut (s. Tabelle) — ob JOB 1451 weitere Felder meinte, ist aus den Quellen nicht feststellbar.
- R-0298: die Quelle verweist für Ausgabedokumente auf eine eigene Zeile „Stufe 2“; einen
  bestehenden Auftrag dazu gibt es außer dem Lernplattform-Auftrag (SCORM) nicht — deshalb in
  Nacharbeit 1 hier vervollständigt.
- Ein Lieferbeleg mit Fassung für diesen Auftrag entsteht erst mit der Veröffentlichung (K6).
