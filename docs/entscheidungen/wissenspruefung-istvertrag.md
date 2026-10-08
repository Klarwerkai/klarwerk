# Wissensprüfung — der Istvertrag für Quelle, Fassung, Vorschau, Prüfumfang und Freigabe

*Aufnahme 20260922 · wissenspruefung-istvertrag (G1/KW-DKP-00, R-1124, question:K15). Stand:
Basis `863a0974` (`1.0.0-beta.1.730`), 07.10.2026; Nacharbeit 1 auf Kandidat `c9be26e7`.
Zuordnung des vorhandenen Codes plus eine Produktänderung: der wahlweise Vollabgleich (R-1124,
Abschnitt 5). Die Fundstellen hält `tests/wissenspruefung-istvertrag/istvertrag-fundstellen.test.ts`
gegen den Bestand fest, den Vollabgleich `tests/wissenspruefung-istvertrag/vollabgleich.test.ts`.*

**Art der Belege.** Die Zuordnung ist **Quelleninspektion** des Arbeitsbaums. Auf Kandidat
`c9be26e7` liefen der Fundstellenwächter (22 Fälle) und zwölf genannte Belegdateien der Fälle
(112 Fälle) grün, dazu Build und Formatprüfung (Prüfbericht der Nacharbeit 1). Alle übrigen
genannten Tests sind Fundstellen ihrer eigenen Lieferungen, kein neuer Lauf.

**Grundlage, die nicht im Arbeitsbaum liegt.** Der Originalvertrag
`gespraech/wiki-start-20260915/VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md` (acht Abnahmefälle, `:38-45`)
liegt außerhalb des Produktbaums. Den Wortlaut der Fälle 1, 2, 4, 5 und 8 zitieren Code und Tests,
die Fälle 6 und 7 die Auftragsquelle (P-KW-DKP-00). **Den Wortlaut von Fall 3 zitiert keine
Stelle im Arbeitsbaum** (Abschnitt 4).

---

## 1. Fünf Begriffe, fünf Felder

Der Vertrag verlangt, dass Quellenrevision, Inhaltsversion, Vorschau, Prüfumfang und Freigabe
eindeutig getrennt sind. So sind sie heute gebaut:

| Begriff | Was es ist | Feld / Funktion | Was es **nicht** ist |
|---|---|---|---|
| **Inhaltsversion** | Zähler der Inhaltsfassung eines Wissensobjekts. Nur er steigt mit Titel, Kernaussage, Bedingungen, Maßnahmen, Fließtext | `KnowledgeObject.version`; Schnappschuss je Fassung in `ko_versions` (`KO_VERSIONS_SCHEMA`, `services/knowledge-object/src/repo-pg.ts`) | keine Aussage über Quellen, Anhänge, Einordnung oder Vertraulichkeit; die ändern sich ohne Versionssprung |
| **Quellenrevision / Prüfbasis** | Die Grundlage, unter der ein KI-Prüflauf **gestartet** ist: `quelle` (Fassung + Kennungen der Quellen und Anhänge), `kontext` (Kategorie, Schlagworte, Anlage, Vertraulichkeit), `bestand` (Quelle und Kontext **jedes** aktiven Nicht-Demo-Objekts) | `AiCheck.basis`, `pruefbasisVon`, `bestandsStempelVon`, `aiCheckUeberholt` in `services/knowledge-object/src/pruefbasis.ts`; Entscheidung `docs/entscheidungen/pruefbasis-aktualitaet.md` | keine Fassungsnummer eines Quelldokuments: für importierte Quellen gibt es keinen eigenen Revisionszähler im Prüfvertrag, nur ihre Kennung |
| **Vorschau** | Live-Abgleich eines **ungespeicherten** Entwurfs im Erfassen-Editor | `checkKnowledge` in `services/app/src/knowledge-check.ts`, Route `POST /api/knowledge/check`; Ergebnis `status` + `coverage` (`KnowledgeCheckCoverage`) | keine Bestandsprüfung: sie speichert nichts, legt keinen Befund an und setzt kein `aiCheck` |
| **Prüfumfang** | Wie weit ein Lauf tatsächlich geschaut hat | Bestandsprüfung: `DetectionCoverage` (`services/conflicts/src/coverage.ts`) bzw. `AiCheckCoverage` am Objekt; Vorschau: `KnowledgeCheckCoverage` (`candidates` mit `checked`/`limit`/`limitReached` oder `unknown`) | `status: "done"` ist **kein** Umfang. Vollständig ist ein Lauf nur, wenn `isCompleteRun` (Spiegel: `isCompleteAiCheckCoverage`, `aiCheckCoverageComplete`) es aus den Zahlen belegt **und** der Nachweis nicht `ueberholt` ist |
| **Freigabe** | Menschliche fachliche Entscheidung: `KoStatus` `offen` → `validiert` mit Entscheidungsbeleg | `KoService.setValidationStateMitBeleg` / `setValidationState` (`expectedVersion` als Compare-and-Set), Recht `ko.validate` (`services/rbac/src/policy.ts`) | hängt nicht an `aiCheck`: `services/validation/src/service.ts` liest keinen Prüfnachweis. Ein vollständiger KI-Lauf gibt nichts frei, ein unvollständiger sperrt nichts |

**Die Trennung von Kandidatenauswahl und fachlicher Prüfpflicht** folgt daraus: Kandidatenauswahl,
Vektorsuche, Prüfsumme und Zähler bestimmen nur, **was einem Vergleich vorgelegt** wird. Die
fachliche Pflicht — Widerspruch oder Dublette beurteilen und das Objekt freigeben — liegt beim
Menschen im Prüfbrett und in der Konflikt-/Überschneidungsentscheidung (`conflict.resolve`).

## 2. Codezuordnung: Import, Prüfung, Rechte, Freigabe, PostgreSQL, Herkunft, Versionen, Graph

| Pfad | Dateien / Funktionen | PostgreSQL | Belegtests (vorhanden) |
|---|---|---|---|
| **Import** | Annahme eines Importkandidaten mit synchronem Prüflauf: `recordImportAcceptAiCheck` in `services/app/src/routes/library-routes.ts` → `detectConflictsForKo`/`detectDuplicatesForKo` → `KoService.recordAiCheckOutcome(…, basis)`; Startbasis wird **vor** dem Lauf erfasst. Rückfindung `KoService.findByImportCandidateId` | `kos` + Importanker (`KO_IMPORT_ANCHOR_SCHEMA`, `repo-pg.ts`) | `tests/pruefbasis-aktualitaet/runde3-import-und-mutationsantworten.test.ts`, `tests/import-kandidaten-echt/annahme-in-validierung.test.ts` |
| **Prüfung (Bestand)** | `createAiCheckRunner` (`services/app/src/ai-check-worker.ts`) → `detectConflictsForKo` (`services/app/src/conflict-detection.ts`) und `detectDuplicatesForKo` (`services/app/src/duplicate-detection.ts`) → `ConflictService.detectForSubject` (`services/conflicts/src/service.ts`), `OverlapService.detectForSubject` (`services/conflicts/src/overlap-service.ts`) | `conflicts` (`services/conflicts/src/repo-pg.ts`), `ko_overlaps` (`services/conflicts/src/overlap-repo-pg.ts`), `aiCheck` im KO-Datensatz, Schreibstand `ko_schreibstand` | `tests/conflicts/detection-cap-honesty.test.ts`, `tests/conflicts/coverage-invariant-parity.test.ts`, `services/conflicts/src/repo-pg.integration.test.ts`, `tests/pruefbasis-aktualitaet/pruefbasis-aktualitaet.test.ts` |
| **Prüfung (Vorschau)** | `checkKnowledge` (`services/app/src/knowledge-check.ts`): `KoService.findCandidates` mit `CANDIDATE_LIMIT` = 40 → `dropConfidential` → Trigramm ≥ 0,18 → Konflikt-Judge nur, wenn die Route ihn übergibt (`ConflictService.assessAgainstPool`) | Kandidatensuche in der Suchprojektion (`services/knowledge-object/src/search-projection-repo-pg.ts`) | `tests/vorschau-reichweite/genau-vierzig.test.ts`, `tests/vorschau-reichweite/vorschau-reichweite-pg-im-browser.integration.test.ts` |
| **Prüfung (Textprüfung Word)** | `checkText` (`services/app/src/check-text-detection.ts`), Deckel `RETRIEVAL_TOP_K` = `DETECTION_CANDIDATE_CAP`; Unterschiede zur Vorschau in `docs/klara/bestandsblick-zwei-pruefwege.md` | wie Vorschau | `tests/pruefwege-vergleich/zwei-pruefwege-antworten-verschieden.test.ts` |
| **Rechte** | `ko.validate`, `conflict.resolve`, `ko.relate` (`services/rbac/src/policy.ts`). Vertraulichkeit `isConfidential` (`services/knowledge-object/src/confidentiality.ts`) reist als Paarmarke an den Reasoner; ob ein Paar an eine öffentliche KI darf, entscheidet allein `oeffentlicheKiErlaubt` (`services/reasoner/src/service.ts`, JOB 3549, Pedi 10.09.): nur mit Grundfreigabe `kiFreigabe.oeffentlicheKi === true`, ein vertrauliches Paar **zusätzlich** mit `vertraulicheInhalte === true`; sonst nur ein vertraulichkeitstaugliches lokales Modell (`chainForChoice`). Bestandsprüfung: vertrauliche Objekte bleiben im Pool — der **Dublettenweg** hat eine deterministische Ebene (sehr hohe Textdeckung, ohne Modell), der **Konfliktweg** urteilt nur per Modell (`services/conflicts/src/service.ts`, `assessAgainstPool`: „kein deterministischer Pfad"); ohne zulässiges Modell wird das Paar übersprungen (`skippedReasons`). Die Vorschau nimmt vertrauliche Objekte ganz heraus (`dropConfidential`) | `KO_SICHTBARKEIT_SCHEMA` (`repo-pg.ts`) | `tests/wiki-diskussion/zugriff-entzogen.test.ts`, `tests/wiki-gesamtanweisung/f3-entzogenes-recht.test.ts`, `tests/wissensgraph-integration/rechte-am-draht.test.ts` |
| **Freigabe** | `KoService.setValidationStateMitBeleg` (Compare-and-Set gegen `expectedVersion`), Validierungsdienst `services/validation/src/service.ts`; Gesamtanweisung: keine Freigabe aus Bausteinen | `services/validation/src/repo-pg.ts`, `gesamtanweisungen`/`gesamtanweisung_staende` (`services/knowledge-object/src/gesamtanweisung-repo-pg.ts`) | `tests/wiki-gesamtanweisung/f5-keine-freigabe-aus-bausteinen.test.ts`, `tests/wiki-gesamtanweisung/postgres-atomar.integration.test.ts` |
| **Herkunft** | `KoSource`/`attachments` am Objekt, Evidenzsätze `ko_evidence` (`KO_EVIDENCE_SCHEMA`); Herkunftsprojektion `services/provenance/src/project.ts` (gekürzt ab `MAX_PROVENANCE_NODES`, ausgewiesen) | `ko_evidence` | `tests/json-herkunft-rundlauf/herkunft-identitaet-importeur.test.ts`, `tests/ux26-herkunft-belege/` |
| **Versionen** | `KnowledgeObject.version`; Befunde binden **beide** Fassungen (`koAVersion`/`koBVersion`, `isCurrent` vor dem Schreiben); `aiCheck.koVersion` + `aiCheck.basis`; Diskussionsbeitrag `KoComment.koVersion` (vom Server gesetzt, Altbestand bleibt unbekannt); Gesamtanweisung bindet Bausteinfassungen | `ko_versions` | `tests/wiki-diskussion/versionsbezug.test.ts`, `tests/wiki-diskussion/alte-beitraege-bleiben.test.ts`, `tests/wiki-gesamtanweisung-fassungsbindung/postgres-fassungsbindung.integration.test.ts` |
| **Bestehender Graph** | Kuratierte Kanten `services/knowledge-object/src/kanten-service.ts` (`KantenSchreibService`, `KantenLeseService`, `KantenAbweichung` `unveraendert`/`geaendert`/`unbekannt` aus `BeurteilterStand`), Wissensnetz-Lesemodell `services/wissensnetz/src/lesemodell.ts` | `ko_kanten`, `ko_kanten_beitrag` (`services/knowledge-object/src/kanten-repo-pg.ts`) | `tests/wissensgraph-integration/version-ist-keine-inhaltspruefung.test.ts`, `tests/wissensgraph-integration/bestand-postgres.integration.test.ts` |

## 3. Kandidatensuche, Vektorsuche, Prüfsumme und Zähler — keine Vollpaarprüfung

Keiner dieser Wege prüft „jeder gegen jeden". Ihre Zahlen sind Vorauswahl- oder Laufgrößen:

| Größe | Wert / Ort | Was sie aussagt |
|---|---|---|
| `DETECTION_CANDIDATE_CAP` | 20, `services/app/src/detection-cap.ts` (Pedi 26.07., kehrt „jeder gegen jeden" vom 04.07. um) | höchstens 20 **Vergleiche** je Bestandslauf und Weg |
| `CANDIDATE_LIMIT` | 40, `services/app/src/knowledge-check.ts` | höchstens 40 vorausgewählte Objekte je Vorschau |
| Fachliche Vorauswahl des Konfliktwegs | `selectCandidates` (`services/conflicts/src/detect.ts`): nur Nachbarn nach Kategorie, Anlage, Schlagwort oder Textnähe ≥ 0,3 | schneidet im Normalfall **auch ohne Deckel** ab; `coverage.capped` meldet das als Verengung. Nur der gewählte Vollabgleich (R-1124) hebt sie auf |
| Vektorsuche | `SemanticPrefilter.topK` (`services/app/src/duplicate-detection.ts`) | heute nur Indizierung; das Verengen des Erkennungspools ist entfallen (bens V2.2). Kein Prüfnachweis |
| Ähnlichkeitsprüfsumme | MinHash, `CHECKSUM_CANDIDATE_CAP` = 5 (`services/conflicts/src/similarity-checksum.ts`) | schlägt nur zusätzliche Kandidaten vor, prüft nicht |
| Gleicher Hash | Gesamtanweisung (`tests/wiki-gesamtanweisung/f7-gleicher-hash.test.ts`) | „Ein gleicher Hash bestaetigt Unveraendertheit, nicht Richtigkeit." (Startvertrag, im Test zitiert) |
| `aiCheck.status = "done"` | `services/knowledge-object/src/types.ts` | der Lauf ist zu Ende — nicht, dass er vollständig war (dafür `isCompleteRun`) und nicht, dass er aktuell ist (dafür `ueberholt`) |
| Abdeckungszähler | `DetectionCoverage` (`available ⊇ selected ⊇ alreadyOpen + attempted ⊇ completed`), Zusammenfassung `AiCheckCoverageSummary` (`unchecked`/`incomplete`/`noCoverage`) | Zahlen **je Lauf** bzw. **je Objekt**, keine Paarliste |

**Wiederverwendung (vorhanden, nicht neu bauen):** Abdeckungsvertrag und Vollständigkeitsregel
(`coverage.ts`, Paritätswächter), Prüfbasisbindung (`pruefbasis.ts`), Fassungsbindung der Befunde,
Prüfumfang der Vorschau, Kantenabweichung, Rechte- und Vertraulichkeitsweg.

**Neu gebaut (Nacharbeit 1):** der wahlweise Vollabgleich eines Objekts gegen den ganzen Bestand
(R-1124, Abschnitt 5) — auf dem vorhandenen Deckelparameter, Abdeckungsvertrag und Wiederholen-Weg.

**Neuer Implementierungsbedarf (nicht gebaut):** ein Prüfumfangsnenner der Vorschau (6c); ein
Paarnachweis (welche Paare geprüft/ungeprüft sind); eine Bedienfläche und ein Merkmal für den
Vollabgleich (Abschnitt 5).

## 4. Die acht Abnahmefälle des Originalvertrags

| Fall | Wortlaut (Quelle des Zitats) | Stand | Beleg / Lücke |
|---|---|---|---|
| 1 | Versionsloser Bestandskommentar bleibt lesbar mit **unbekanntem** Versionsbezug; die aktuelle Version wird nicht nachträglich als Basis erfunden (`tests/wiki-diskussion/alte-beitraege-bleiben.test.ts`, Kopf) | geliefert, JOB 4146 (`a83db297`, 16.09.) | `KoComment.koVersion` optional; `alte-beitraege-bleiben.test.ts`, `tests/wiki-diskussion/diskussion-in-der-flaeche.test.tsx` H2b |
| 2 | „Beitrag an Version 3, Dokument inzwischen Version 4 — der ALTE Bezug bleibt sichtbar, und es geschieht KEINE automatische fachliche Übernahme" (`tests/wiki-diskussion/versionsbezug.test.ts`) | geliefert, JOB 4146 | `versionsbezug.test.ts` |
| 3 | **Wortlaut im Arbeitsbaum nicht vorhanden** | **ungeklärt** | Keine Stelle zitiert Fall 3. Nächstliegend ist der ohne Fallnummer zitierte Satz „unbekannter Prüfumfang bleibt ‚Umfang nicht belegt'" (`services/knowledge-object/src/gesamtanweisung-types.ts`); umgesetzt als `KnowledgeCheckCoverage` `unknown` und `INHALT_UNBEKANNT`. Die Zuordnung zu Fall 3 ist **nicht belegt** — sie braucht den Originalvertrag `:38-45` |
| 4 | „Entzogener Zugriff: weder Faden, Zitat, Benachrichtigung noch KI-Eingabe verraten geschützten Inhalt." (`tests/wiki-gesamtanweisung/f3-entzogenes-recht.test.ts`) | geliefert für Diskussion (JOB 4146) und Gesamtanweisung (JOB 4154, `de2ff1ed`) | Zugriffsprüfung vor Fadeninhalt (`services/app/src/routes/ko-routes.ts`), `tests/wiki-diskussion/zugriff-entzogen.test.ts`, `f3-entzogenes-recht.test.ts` |
| 5 | Dieselbe Wiederholung ergibt denselben einen Beitrag (Beitragsschlüssel; `services/knowledge-object/src/service.ts`, „Vertrag Fall 5") | geliefert, JOB 4146 | `clientKey`; `tests/wiki-diskussion/idempotenz.test.ts`, `tests/wiki-diskussion/wiederholung-verliert-nichts.test.ts` W2 |
| 6 | „Vorschau abgeschlossen, Bestandsprüfung nicht" (Auftragsquelle P-KW-DKP-00) | geliefert als Teilumfang, Aufnahme vorschau-reichweite (`fd8fa02c` 30.09., ship `dc40e085` `1.0.0-beta.1.639`) | Prüfung unten (6a–6c) |
| 7 | „Kontext/Quellenbasis geändert" (Auftragsquelle P-KW-DKP-00) | geliefert für `aiCheck`, Aufnahme pruefbasis-aktualitaet (`a494a430` 25.09., ship `609ed871` `1.0.0-beta.1.607`) | Prüfung unten (7a–7c) |
| 8 | „KI nicht verfuegbar: Lesen, Finden, Kommentieren und berechtigte bestehende menschliche Workflows bleiben erreichbar." (`tests/wiki-gesamtanweisung/f6-ohne-ki.test.ts`) | geliefert für die Gesamtanweisung (JOB 4154) | `f6-ohne-ki.test.ts`. Für die Wissensprüfung gilt dasselbe im Code: ohne Judge liefert die Vorschau ehrlich `pending`, die Freigabe hängt nicht am KI-Lauf (Abschnitt 1) |

### Fall 6 und 7 — unabhängig gegen den Vertrag geprüft

- **6a erfüllt.** Vorschau und Bestandsprüfung sind getrennte Typen und Wege: `KnowledgeCheckResult.status`
  (Vorschau, nichts gespeichert) gegen `AiCheck.status` (Bestandsprüfung am gespeicherten Objekt).
  Ein „done" der Vorschau setzt keinen Prüfnachweis.
- **6b erfüllt.** Jede Vorschauantwort trägt ihren Umfang (`candidates` oder `unknown`); der Kommentar
  am Vertrag sagt ausdrücklich, dass auch ohne erreichte Grenze kein Abgleich mit dem ganzen Bestand
  stattfand.
- **6c Lücke.** Der Vorschauumfang kennt **keinen Nenner**: `checked` und `limit`, aber nicht, wie
  groß der vergleichbare Bestand war. Der Bestandsweg hat ihn (`available`). Die Vorschau kann
  deshalb „40 von 40 Kandidaten", aber nicht „40 von N" sagen.
- **7a erfüllt.** Quelle, Kontext und Bestand sind Teil der Basis; jede Änderung macht den Nachweis
  überholt, Altbestand ohne Basis gilt als überholt.
- **7b offen, dokumentiert.** Prüfregeln (Deckel, Duplikatschwelle) sind nicht Teil der Basis
  (`pruefbasis-aktualitaet.md`, Folge 3). Eine Regeländerung entwertet keine Nachweise.
- **7c Widerspruch zwischen zwei Versionsverträgen.** Die Prüfbasis bindet Quellen, Anhänge und
  Kontext; die **Graphkante** bindet nur die Inhaltsfassungen beider Endpunkte (`BeurteilterStand`,
  `services/knowledge-object/src/kanten-types.ts`). Kommt an einem Endpunkt eine Quelle hinzu oder
  ändert sich die Einordnung ohne Versionssprung, ist der KI-Nachweis „überholt", die Kante
  aber „unveraendert". Beide Aussagen sind für sich korrekt beschrieben (die Kante sagt nur
  „Fassung"), ein gemeinsamer Vertrag liegt aber nicht vor. Wer das angleicht, ändert
  `kanten-service.ts` (Lieferung JOB 4151) — nicht Teil dieser Lieferung.

**Gesperrter Stellenbezug 4282.** Bleibt gesperrt. Im Produktbaum gibt es keinen Code, keinen Test
und keinen Auftrag mit diesem Bezug (die einzige Zeichenfolge „4282" ist ein Prüfwert in
`OFFEN.md`, Zeile 130). Diese Lieferung legt keinen an.

## 5. R-1124 (gebaut) und question:K15 (offen)

### R-1124 — wahlweiser Vollabgleich eines Objekts gegen den ganzen Bestand

Zielzustand: Widerspruchs- und Dublettenprüfung wahlweise gegen den ganzen Bestand statt nur gegen
die 20 nächsten Treffer. **Gebaut in Nacharbeit 1** (Bens Befund zu `c9be26e7`: der Vergleich EINES
Objekts gegen den Bestand ist keine Vollpaarprüfung; die frühere Ausklammerung entfällt).

| Teil | Umsetzung |
|---|---|
| Wahl | `POST /api/kos/:id/ai-check` mit `{ "umfang": "vollstaendig" }`, Recht `ko.validate` (`services/app/src/routes/ko-routes.ts`). Zulässig auch bei einem aktuellen fertigen Nachweis; läuft schon ein Job: `409 AI_CHECK_LAEUFT`; unbekannter Umfang: `400 AI_CHECK_UMFANG_UNBEKANNT`. Ohne Angabe gilt alles wie bisher |
| Umfang | `PruefUmfang` und `vergleichsDeckel` (`services/app/src/detection-cap.ts`): `gedeckelt` = 20, `vollstaendig` = ohne Deckel |
| Konfliktweg | `detectConflictsForKo(…, umfang)` → `detectForSubject` mit `cap = ∞` und `vollabgleich: true`; `selectCandidates(…, nurNachbarn = false)` reiht **jedes** aktive Nicht-Demo-Objekt (`services/conflicts/src/detect.ts`, `services/conflicts/src/service.ts`) |
| Dublettenweg | `detectDuplicatesForKo(…, umfang)` mit `cap = ∞`; `selectOverlapCandidates` hat keinen fachlichen Vorfilter, der Pool ist ganz |
| Ablauf | Worker trägt den Umfang je Job (`enqueue(…, umfang)`; ein wartender Job wird hochgestuft, nie herab; ein Neueinreihen wegen gewanderter Basis behält ihn), Runner reicht ihn an beide Wege (`services/app/src/ai-check-worker.ts`) |
| Zusage | Nacharbeit 3 (Bens Befund zu `3e62e335`): die Route merkt die Wahl **synchron** vor (`vollabgleichVormerken`), bevor sie den Vermerk schreibt und liest. Die Vormerkung hält einen wartenden Job dieses Objekts vom Start zurück, bis `einreihen` ihn hochstuft; im Fehlerpfad löst `verwerfen` die Sperre. Läuft schon ein Job, gibt es keine Vormerkung: `409`, Prüfstatus unberührt. `200 … umfang: vollstaendig` heißt damit: der Worker hat den Vollabgleich angenommen (`vollabgleich.test.ts` V7/V8) |
| Ergebnis | dieselbe Abdeckung wie immer: vollständig heißt es nur nach `isCompleteRun` — jeder Vergleich hat geurteilt (`selected === available`, `attempted === completed`, nichts übersprungen). Seit dem Prüfgedächtnis des Hauptstands (R-1103) beurteilt der Konfliktweg ein Paar mit gleichem, schon beurteiltem Textstand nicht erneut; es zählt als angesehen (`alreadyOpen`), nicht als vorgelegt (`vollabgleich.test.ts` V4) |

**Was der Vollabgleich nicht ist:** keine Vollpaarprüfung (es gibt keinen Lauf „alle gegen alle";
nichts startet automatisch) und keine Freigabe. Einreichen, Abruf der Prüfliste und Import bleiben
gedeckelt.

**Verbleibende Grenzen, dem Zielzustand zugeordnet:**

- **„Besonders wichtige Bestände"** sind nirgends bestimmt (kein Merkmal, keine Quelle für Kategorie,
  Feld oder Zuständigkeit). Gebaut ist deshalb die Wahl **je Objekt** durch einen Menschen mit
  `ko.validate`; ein Bestandsmerkmal mit automatischem Vollabgleich bleibt eine Entscheidung für Pedi.
- **Bedienfläche:** die Wahl ist ein Serverweg; ein Knopf im Prüfbrett ist nicht gebaut.
- **Kosten und Frist:** ohne Deckel kostet ein Lauf bis zu zwei Urteile je Bestandsobjekt (Pedi
  26.07.: Deckel wegen ~25.000 Urteilen bei 12.480 Objekten). Die Jobfrist
  `AI_CHECK_JOB_TIMEOUT_MS` (120 s) gilt unverändert; reicht sie nicht, endet der Nachweis ehrlich
  als `failed/timeout`, nie als vollständig. Kein Lauf an einem großen Bestand ist gemessen.
- **Vertrauliche Paare** urteilt der Konfliktweg nur mit zulässigem Modell (Abschnitt 2, Rechte);
  ohne es sind sie übersprungen, und der Lauf ist nicht vollständig.
- **Nicht dauerhaft:** die Wahl lebt nur im Speicher des Workers; nach einem Neustart läuft der
  wartende Job gedeckelt.
- **Quellenlage:** R-1124 (29.08.) ist im Register eine Idee ohne Entscheidung; der Nachtrag zu
  KW-DKP-00 (15.09.) schließt eine Vollpaar-Implementierung aus. Beides trägt der Bau: Vollabgleich
  je gewähltem Objekt, keine Vollpaarprüfung.

### question:K15 — was offen bleibt

Abgeleitet und bestätigt: Such-Top-K, Prüfsumme, gleicher Hash und `aiCheck`-done ersetzen keine
vollständige fachliche Pflicht (Abschnitt 3). Im konkreten Bestand ungeklärt:

| Frage | Stand im Code |
|---|---|
| **Nenner** | je Bestandslauf `available` (Objekte, nicht Paare); Vorschau ohne Nenner (6c); kein Bestandsnenner über Paare |
| **Ungeprüfte Paare** | nicht benennbar: das Abdeckungsprotokoll hält Zahlen, keine Kennungen (`pruefbasis.ts`, Kopf) |
| **Mehrfachkonflikte** | Befunde sind paarweise (`koA`/`koB`, höchstens ein offener je `pairKey`); ein Widerspruch zwischen drei Objekten ist als drei Paare oder gar nicht abgebildet |
| **Rechte** | vertrauliche Objekte im Bestandsvergleich: Dubletten deterministisch ja, Modellurteil (Konflikt und Dublette) nur über `oeffentlicheKiErlaubt` mit beiden Freigaben oder ein taugliches lokales Modell; Vorschau ohne sie. Das Prüfbrett meldet einen Konflikt nur, wenn der Leser die Gegenseite sehen darf (`AiCheck.konfliktGefunden`) — ob ein unsichtbarer Konflikt jemandem gemeldet wird, der ihn sehen darf, ist nicht belegt |
| **Invalidierung** | `aiCheck`: global an die Basis gebunden; Befunde: an beide Fassungen; Kanten: nur an Fassungen (7c); Vorschau: nichts gespeichert, nichts zu entwerten |

„Keine Freigabe von Punkt 3" (K15) bleibt unberührt: diese Lieferung gibt nichts frei.

## 6. Abgrenzung zu gesonderten Lieferungen

| Lieferung | Umfang | hier |
|---|---|---|
| Aufnahme vorschau-reichweite (`1.0.0-beta.1.639`) | Fall 6, Prüfumfang der Vorschau | wiederverwendet, 6c als Lücke benannt |
| Aufnahme pruefbasis-aktualitaet (`1.0.0-beta.1.607`) | Fall 7, Basisbindung `aiCheck` | wiederverwendet, 7b/7c benannt |
| Aufnahme gesamt-bestandsblick (`docs/klara/bestandsblick-zwei-pruefwege.md`) | Textprüfung gegen Vorschau | nur verwiesen |
| Kandidatendeckel wächst mit dem Bestand (`1.0.0-beta.1.658`, `bestandsgerechterKandidatendeckel`) | Klaras Fragebegriffe | nicht die Wissensprüfung; ändert `CANDIDATE_LIMIT` nicht |
| JOB 4146 / 4151 / 4154 (16.09.) | Diskussion, Graphkanten, Gesamtanweisung (Fälle 1, 2, 4, 5, 8) | nur zugeordnet |
| mega28–mega33 (`5150cd5a` ff.) | Deckel und Abdeckungsvertrag | wiederverwendet |

## 7. Fehlende Belege

- Wortlaut von Abnahmefall 3 und die Originalzeilen `:38-45` des Vertrags im Produktbaum.
- Außer den in „Art der Belege" genannten Läufen auf `c9be26e7` bestätigt kein Lauf dieser
  Lieferung die genannten Verhaltenstests erneut; der Vollabgleich (Nacharbeit 1) ist erst mit dem
  nächsten Prüflauf belegt.
- Kein Nachweis an einem echten Kundenbestand: Nenner, ungeprüfte Paare und Laufkosten eines
  Vollabgleichs sind nicht gemessen.

## 8. Quellenwidersprüche in Kommentaren (unverändert, benannt)

Seit JOB 3549 (Pedi 10.09.) entscheidet `oeffentlicheKiErlaubt`; vertrauliche Inhalte dürfen mit
beiden Freigaben in den Cloudweg. Älter und damit überholt lauten:

- `services/app/src/conflict-detection.ts` (Pool-Kommentar): die Vertraulichkeitsmarke sorge dafür,
  „dass die Cloud sie nie sieht" — außerdem: „Konflikte haben keine deterministische Ebene" (das
  stimmt).
- `services/app/src/duplicate-detection.ts` (Pool-Kommentar): die Marke „hält die Cloud draußen".
- `services/app/src/ai-check-worker.ts` (Runner): der Reasoner „nimmt bei `confidential` die Cloud
  aus der Judge-Kette (kein Egress)".
- `services/knowledge-object/src/types.ts` (`Confidentiality`): vertraulich „gehen NIE in externe
  Kontexte".

Diese Kommentare sind nicht Gegenstand der Änderung; maßgeblich ist der Reasoner-Code.
