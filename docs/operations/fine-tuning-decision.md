# Klarwerk — Fine-Tuning / LoRA: Entscheidungsnotiz

> Dokumentierte Architektur-/Produktentscheidung. **Kein Training, kein Adapter, keine GPU-Arbeit.**
> Verwandt: `docs/operations/evaluation-quality-assurance.md`, `maintenance-update-process.md` §8,
> `monitoring-logging.md`, `docs/compliance/gdpr-compliance-runbook.md`,
> `docs/demo/stage-1-demo-path.md`.

---

## 1. Entscheidung

**Fine-Tuning / LoRA wird jetzt NICHT durchgeführt und ist aktuell NICHT nötig.**
Die bestehende Knowledge-OS-/Reasoner-/QA-Architektur deckt den Bedarf ab. Diese Notiz hält die Begründung fest und definiert **klare Kriterien**, ab wann LoRA später sinnvoll **erwogen** werden könnte.

---

## 2. Begründung — warum Knowledge OS / Quellenbindung zuerst

- **Wissen liegt in Knowledge Objects, nicht in Modellgewichten.** Der Reasoner ist **anbieteragnostisch** und **verankert Antworten in vorhandenen, validierten KOs** („Anti-Halluzination: Quellen/Trust kommen aus den Daten, das Modell formuliert nur", `services/reasoner/src/provider-model.ts`). Das Modell ist sogar **optional** — ohne `ANTHROPIC_API_KEY` läuft der deterministische Fallback.
- **Leitprinzip:** *„The AI may change. Your knowledge never does."* Fine-Tuning würde Wissen **in die Gewichte einbacken** — das Gegenteil dieses Prinzips (austauschbares Modell, dauerhaftes geprüftes Wissen).
- **Domänenwissen kommt über den Kreis** Capture → Validate → Use → Maintain in die KOs, **mit Quelle/Trust/Status/Version** und auditierbar. Genau die Stärken, die Fine-Tuning **nicht** liefert (kein Quellnachweis, keine Validierung, keine Revalidierung).
- **Qualität ist bereits geprüft** (SCRUM-206): Quellenbindung, ehrliche Wissenslücke, Trust/Klasse, Fallback-Stabilität — gated über CI. Es gibt kein gemessenes Qualitätsproblem, das nur Training lösen würde.

---

## 3. Welche Probleme würde Fine-Tuning lösen — und löst Klarwerk sie schon anders?

| Problem | Fine-Tuning-Ansatz | Klarwerk heute (besser/ausreichend) |
| --- | --- | --- |
| Domänenfakten verfügbar machen | in Gewichte trainieren | **validierte KOs + Quellenbindung** (nachweisbar, aktualisierbar) |
| Aktuell bleiben | neu trainieren | **Revalidierung/Lifecycle** (kein Re-Training nötig) |
| Halluzination vermeiden | hoffen, dass Training hilft | **keine Rateantwort ohne Beleg → ehrliche Wissenslücke** (getestet) |
| Domänen-Stil/Strukturierung | LoRA für Stil | **Reasoner formuliert/strukturiert** über Prompt; ausreichend in Stage-1 |
| Nachvollziehbarkeit | — (Gewichte sind opak) | **Audit + Quellen + Version** |

---

## 4. Ist RAG/Vector vorhanden? Reihenfolge Fine-Tuning vs. RAG

- **RAG/Vector/Embeddings sind NICHT vorhanden** (im Code nur Kommentare „KEINE RAG/Vector-DB"). Retrieval erfolgt heute über **deterministische Keyword-/KO-Auswahl** + Quellenbindung.
- **Richtige Reihenfolge:** (1) Quellenbindung an KOs ✓ → (2) bei Skalierungsbedarf **Retrieval/RAG** → (3) **erst zuletzt** ggf. Fine-Tuning/LoRA für **Stil/Strukturierung** (nie zum Faktenspeichern).
- **Fine-Tuning vor RAG wäre verfrüht:** Faktenwissen gehört in abrufbare, validierbare Daten, nicht in Gewichte. → LoRA ist **nicht** der nächste Schritt.

> **Abgleich 13.10.2026:** Der erste Satz ist für Vektoren überholt — es gibt inzwischen `services/embedding`
> (Duplikat-Vorfilter, Vorgabe AUS). Der Antwortweg wählt seine Quellen weiterhin ohne Embedder. Einzelheiten §13.

---

## 5. Datenanforderungen (Voraussetzung, heute nicht erfüllt)

- **Großer, kuratierter, validierter KO-Korpus** (Stage-1-Seed = wenige KOs → **zu klein**).
- Saubere, labelbare Trainingsbeispiele (Frage→belegte Antwort) in ausreichender Menge/Diversität.
- **DSGVO-konforme** Datenbasis (keine ungerechtfertigten personenbezogenen/sensiblen Daten; Rechtsgrundlage; Export an Trainings-/Modellanbieter geklärt).

## 6. Eval-Anforderungen (vor jedem Training)

- **Baseline messen** mit dem QA-Verfahren (`evaluation-quality-assurance.md`, B1–B4): Answered-Rate, Gap-Honesty, Quellenbindung, Knowledge-Class.
- **Vorher/Nachher-Vergleich** auf einem ausreichend großen Eval-Set; Training nur bei **messbarer** Verbesserung ohne Regression bei Halluzination/Quellenbindung.
- Ohne belastbare Baseline-Verbesserung **kein** Roll-out.

## 7. Datenschutz / Compliance

- Training auf eigenen Daten = **Datenfluss an Trainings-/Modellanbieter** + **eingebackenes** Wissen → konfligiert mit **DSGVO-Löschung** (Gewichte sind nicht selektiv „löschbar") und mit dem append-only-Audit-/Quellenprinzip.
- Erfordert DSFA/Bewertung (`gdpr-compliance-runbook.md` §2), AV-Vertrag, ggf. self-hosted/kontrolliertes Modell.

## 8. Risiken (warum „nicht jetzt")

- **Overfitting** auf kleinen/unausgewogenen Korpus.
- **Wissensverfall:** eingebackenes Wissen veraltet — ohne Revalidierungsmechanik (KOs lösen das, Gewichte nicht).
- **Falsche Autorität:** flüssige, aber **unbelegte** Antworten — untergräbt Quellenbindung/Trust.
- **Datenschutz/Lock-in/Kosten:** GPU/Training, Provider-Bindung, irreversible Datenflüsse.

---

## 9. Wann Fine-Tuning/LoRA später sinnvoll **erwogen** werden könnte (Kriterien)

Alle Punkte sollten erfüllt sein, **bevor** LoRA überhaupt geprüft wird:
1. **Großer, validierter KO-/Beispielkorpus** vorhanden (genug Menge + Qualität).
2. **Retrieval/RAG** bereits etabliert und ausgereizt — und ein **spezifisches, gemessenes** Defizit bleibt (z. B. Domänen-Stil/Strukturierung), das Prompting/Retrieval nicht löst.
3. **Eval-Baseline** vorhanden + Bereitschaft, Vorher/Nachher zu messen.
4. **DSGVO-/Compliance-Pfad** geklärt (Datenbasis, Anbieter, ggf. self-hosted).
5. **Rollback-Regel:** LoRA-Adapter **abschaltbar** (Env/Provider zurück auf Basismodell/Fallback) — nie ohne Rückweg.
6. Scope: LoRA **nur für Stil/Strukturierung**, **nicht** zum Speichern von Fakten (die bleiben in KOs).

---

## 10. Overfitting-/Rollback-Regeln (falls je gestartet)

- Train/Eval-Split; auf Halluzination/Quellenbindung-Regression prüfen (nicht nur „klingt besser").
- Adapter **per Env/Provider deaktivierbar** → sofortiger Rückfall auf Basismodell bzw. deterministischen Fallback.
- Versionierte Adapter + dokumentierte Trainingsdaten; jederzeitiger Rückbau.

---

## 11. Nicht-Ziele

- Kein Training, kein Adapter, keine GPU-/Runtime-Arbeit in diesem Item.
- Keine RAG-/Vector-/Embedding-Implementierung.
- Keine neue Modellarchitektur, kein ModelAdapter-/Conductor-Umbau.
- Keine produktive Modellumstellung; reine **Entscheidungsdokumentation**.

---

## 12. Fazit

Klarwerks Wert entsteht aus **geprüftem, quellengebundenem Wissen** und einem **austauschbaren** Modell — nicht aus modell-internem Wissen. **Fine-Tuning/LoRA ist derzeit weder nötig noch der richtige nächste Schritt.** Die obigen Kriterien (§9) definieren, wann eine spätere Prüfung gerechtfertigt wäre; bis dahin gilt: **Wissen in KOs, Modell nur als Formulierer.**

---

## 13. Abgleich mit dem heutigen Stand (13.10.2026)

Anlass: die Registerpunkte **R-0720** („Modell auf eigenen Daten nachtrainieren", Altbestand F-0720) und **R-0864** („Kein eigenes Nachtrainieren von Modellen", Altbestand F-0864). Beide stehen im Register als „angedacht" mit Prüfstatus „nur_altquelle" — ihr damaliger Zustand ist kein heutiger Nachweis.

Was sich seit §1–§12 geändert hat:

- **Vektoren gibt es inzwischen.** `services/embedding` liefert einen deterministischen Stub als Vorgabe (`KLARWERK_EMBEDDING_PROVIDER` ungesetzt = `stub`), einen internen Provider nur für eine bestätigte interne Adresse und **keinen** Cloud-Anbieter (`createEmbeddingProviderFromEnv`). Der dauerhafte Speicher `PgEmbeddingStore` (R-0470) löscht je Objekt (`EmbeddingStore.delete`, DSGVO Art. 17).
- **Eingesetzt wird das nur im Duplikat-Vorfilter** — und der ist standardmäßig **AUS** (`KLARWERK_DUP_PREFILTER`, `services/app/src/build-app.ts`).
- **Der Antwortweg bleibt ohne Embedder.** `services/ask/src/service.ts`: „Der semantische Vorfilter bleibt unberührt und AUS." Die Quellen wählt `selectCandidates`, gebunden an validierte KOs.
- **Die KI ist heute administrativ abschaltbar** (§16): Die Adminwahl „deterministisch" schaltet den KI-Frageweg ab, laufende Aufrufe enden mit `KiAbgeschaltetFehler`.

Folge: Kriterium §9.2 („Retrieval/RAG etabliert und ausgereizt") ist **weiterhin nicht erfüllt**. Den gleichen überholten Satz trägt `rag-readiness-decision.md` §3. Das RAG-Dokument fortzuschreiben gehört nicht zu dieser Klärung.

---

## 14. Offene Geltungsfrage — Entscheidung erforderlich

**Die Quellen sagen Unterschiedliches darüber, wie endgültig das „Nein" ist:**

| Quelle | Datum | Aussage |
| --- | --- | --- |
| `specs/stories/reasoner.md`, Nicht-Ziele (v1) | 25.06.2026 | „Fine-Tuning eigener Modelle" ist Nicht-Ziel. |
| Diese Notiz §1/§9 | 25.07.2026 (laut Register; die Datei trägt kein Datum) | „jetzt NICHT … aktuell NICHT nötig", mit Kriterien für eine spätere Prüfung. |
| R-0720 / F-0720 (Status VERWORFEN), Notiz | 05.09.2026 (Registerstand) | „Falls es je käme: nur für Stil und Struktur, nie zum Speichern von Fakten, und abschaltbar." |
| R-0864 / F-0864 (Status VERWORFEN) | 15.08.2026, BEN GRUEN 17.08. (JOB 1044) | „Es wurde entschieden, keine eigenen Modelle nachzutrainieren." |
| Berater-Konzept Wissensschicht §5.1 (`docs/qm/BERATER_KONZEPT_WISSENSSCHICHT_KLARWERK-GEHIRN_2026-07-05.md`) | 05.07.2026 | Regelkreis-Ebene 5: „NUR als Ausnahme: LoRA/Fine-Tuning (modellspezifisch, getrennt versioniert)". |

**Alternativen:**

- **A — Endgültig verworfen.** Kein Nachtrainieren, auch nicht für Stil/Struktur. §9 und §15 entfallen als Prüfpfad.
- **B — „Jetzt nicht", spätere Evaluation nur für Stil/Struktur.** Sie ist erst zulässig, wenn alle Eingangsbedingungen aus §15 erfüllt sind. Das entspricht dem heute dokumentierten Stand.
- **C — wie B, zusätzlich als Ebene 5 des Regelkreises.** Ein Prüfstand-Fehler darf eine Evaluation erst auslösen, wenn die Ebenen 1–4 nachweislich ausgeschöpft sind. Dann gilt das je Modell und wird getrennt versioniert.

**Gemeinsam in allen Alternativen:** Firmenfakten kommen nie in Modellgewichte. Wissen bleibt in KOs.

**Erforderliche Entscheidung:** Die Produktverantwortung (Pedi) muss zwischen A, B und C wählen. Bis dahin ist **keine der Alternativen freigegeben**. Umgesetzt ist nur der eindeutig bestellte Anteil: die Kriterien in §15 und die Bewertung in §16. Es gibt **kein Training, keinen Adapter, keinen Trainingsauftrag und keinen Hardwarekauf.**

---

## 15. Kriterien für eine spätere Stil-/Struktur-Evaluation (Konkretisierung von §9)

Eine Evaluation ist **kein Trainingsauftrag**. Sie prüft nur, ob ein Adapter für Stil und Struktur gerechtfertigt wäre. Die Messmittel gibt es bereits:
- der Prüfstand nach `docs/team2-austausch/VERTRAG-PRUEFSTAND-ARTEFAKTE.md` (Fälle v2, Checks, Scoring),
- die Baseline B1–B4 aus `evaluation-quality-assurance.md`.

### 15.1 Eingangsbedingungen — alle müssen erfüllt sein, sonst findet keine Evaluation statt

| Nr. | Bedingung (§9) | Prüfbar als | Stand 13.10.2026 |
| --- | --- | --- | --- |
| E1 | Das gemessene Defizit liegt **nur** in Stil/Struktur | Prüfstand-Fälle scheitern wiederholt nur an **Formfehlern** (Abgrenzung siehe unten). Sie scheitern nicht an einem **Inhaltsfehler**: nicht an `enthaelt`, `belegstelleImText`, `ehrlichLeer` oder `ehrlichUnwissend` und nicht an einem falschen fachlichen Wert in `jsonFeld`. | offen — keine Messreihe im Repository |
| E2 | Die günstigeren Ebenen sind ausgeschöpft | Für jeden betroffenen Fall sind Antwort-Kontrakt/System-Prompt, Few-Shot und Guardrail (Regelkreis-Ebenen 2–4) erprobt. Das Prüfstand-Delta ist ohne Erfolg gemessen. | offen |
| E3 | Retrieval ist etabliert | Der Antwortweg wählt produktiv semantisch oder hybrid aus, und das Defizit bleibt trotzdem bestehen. | nicht erfüllt (§13) |
| E4 | Es gibt eine Baseline | Prüfstand-Lauf je Zielmodell auf der Zielhardware und B1–B4 sind dokumentiert. | teilweise — KWN-2 hat nur Referenzspalten von anderer Hardware, die Messung auf dem Zielgerät ist offen |
| E5 | Die Trainingsbeispiele sind faktenfrei | Die Beispiele zeigen nur Form (Gliederung, Tonalität, JSON-Form). Die Inhalte sind synthetisch: keine KO-Inhalte, keine Firmen- oder Kundenfakten, keine personenbezogenen Daten. | offen |
| E6 | Der Datenschutzpfad ist geklärt | DSFA/VVT, AVV oder Self-Hosting sind geklärt. Fine-Tuning ist ein DSFA-Auslöser nach `docs/compliance/data-protection-requirements.md`. | offen |
| E7 | Es gibt einen Abschaltweg | Der Adapter ist eine eigene, abwählbare Wahl in der vorhandenen KI-Zuordnung (§16). Abschalten heißt zurück auf das Basismodell oder auf „deterministisch", ohne Neuaufbau und ohne Datenverlust. | Die Mechanik für die Modellwahl ist vorhanden, ein Adapter nicht |
| E8 | Es gibt einen kuratierten, validierten Beispielkorpus (§5, §9.1) | Ein versioniertes Korpusverzeichnis belegt drei Dinge. **Umfang:** Zahl der Beispiele insgesamt und je Stil-/Strukturfall, mit Versionsstand. **Abdeckung:** Jeder unter E1 benannte Formfehler ist nach Aufgabe (z. B. `structure`, `conflict`, `dedupe`, `interview`) und Formart (JSON-Form, Feldstruktur, Gliederung, Rückfrageform, Tonalität) durch Beispiele abgedeckt; nicht abgedeckte Fälle sind ausdrücklich genannt. **Validierungsnachweis:** Jedes Beispiel ist geprüft auf korrekte Zielform, Faktenfreiheit nach E5 (synthetisch, keine KO-, Firmen-, Kunden- oder Personendaten) und Abstand zum Prüfstand. Kein Prüfstand-Fall und keine Paraphrase davon gehört in den Korpus (Train/Eval-Trennung, §10). Prüfer und Datum sind festgehalten. | offen — kein Korpus vorhanden |

**Formfehler und Inhaltsfehler (für E1 und R1).** Die Prüfstand-Checks prüfen teils Form, teils Inhalt. `jsonFeld` prüft beides (`VERTRAG-PRUEFSTAND-ARTEFAKTE.md`, „checks“):
- **Formfehler**, nur diese zählen für E1 und R1:
  - `json` scheitert, die Antwort ist also kein parsebares JSON;
  - das von `jsonFeld` verlangte Feld fehlt in der Antwort oder steht nicht auf oberster Ebene;
  - `istFrage` scheitert, die Antwort hat also keine Frageform.
- **Inhaltsfehler**, diese sind von E1 und R1 ausgeschlossen:
  - das Feld ist vorhanden, trägt aber den falschen fachlichen Wert. Beispiele: `widerspruch` true statt false, falscher `kandidat`, falsche `beziehung`;
  - alle Fehler an `enthaelt`, `enthaeltNicht`, `enthaeltEines`, `belegstelleImText`, `ehrlichLeer` und `ehrlichUnwissend`.

  Scheitert ein Fall an einem Inhaltsfehler, begründet er keine Stil-/Struktur-Evaluation. Das gilt auch, wenn er zusätzlich einen Formfehler hat.
- **Ehrlich-Fälle mit `jsonFeld`** (`widerspruch`=false, `beziehung`=eigenstaendig) bleiben Ehrlich-Fälle im Sinne von R2. Ein falscher Wert dort ist ein Ehrlichkeitsfehler, kein Formfehler.

### 15.2 Bewertungsregeln (vorher/nachher, gleiche Fälle, gleiche Hardware)

| Nr. | Regel | Folge bei Verstoß |
| --- | --- | --- |
| R1 | Die **Formfehler** aus E1 nehmen in genau den benannten Fällen messbar ab. Eine Änderung fachlicher `jsonFeld`-Werte oder anderer Inhaltschecks zählt **nicht** als Verbesserung. | keine Empfehlung |
| R2 | Bei den Ehrlich-Fällen (einschließlich `jsonFeld` mit `widerspruch`=false oder `beziehung`=eigenstaendig) und beim Belegstellen-Check gibt es keinen Rückgang. | Abbruch |
| R3 | Fakten-Leck-Probe: Fragen zu Firmenfakten ohne passendes KO enden weiter als Wissenslücke (B2/B4). Eine inhaltliche Antwort aus den Gewichten ist ein Leck. | Abbruch |
| R4 | Löschprobe: Nach dem Löschen eines KO beantwortet das System die zugehörige Frage auch mit Adapter nicht mehr. | Abbruch |
| R5 | Der gesamte Prüfstand ist das Regressions-Gate (Regelkreis Schritt 6). Kein anderer Fall darf sich verschlechtern. | Abbruch |
| R6 | Das Ergebnis wird versioniert dokumentiert: Adapter-, Basismodell- und Beispielsatz-Version sowie die Hardware. | ohne Dokumentation kein Einsatz |

Zahlenschwellen (Mindestverbesserung, Zahl der Wiederholungsläufe, Mindestumfang des Beispielkorpus je Fall) sind **bewusst nicht festgelegt**. Sie gehören zur Entscheidung in §14.

---

## 16. Bewertung gegen Datenstrategie und Abschaltbarkeit

| Aspekt | Datenstrategie heute (Code) | Nachtrainieren mit Firmenwissen | Adapter nur für Stil/Struktur |
| --- | --- | --- | --- |
| Wo das Wissen liegt | KOs mit Quelle, Status und Version. Vektoren sind nur abgeleitet und je `embeddingVersion` getrennt. | in den Gewichten → **unvereinbar** | keine Fakten, das Wissen bleibt in KOs |
| Modellwechsel | KI-Zuordnung je Aufgabe (`auto`, Anbieter, `local`, `deterministic`); das Wissen bleibt unberührt | Das Wissen hinge am Modell und ginge beim Wechsel verloren | Der Adapter ist modellgebunden und muss bei jedem Basismodellwechsel neu evaluiert werden. Das Wissen bleibt unberührt. |
| Löschpflicht | KO löschen; die Vektoren werden kaskadiert gelöscht (`EmbeddingStore.delete`) | Gewichte lassen sich nicht selektiv löschen → **Konflikt** | nur vertretbar, wenn E5 hält |
| Abschaltbarkeit | Die Adminwahl „deterministisch" schaltet den KI-Frageweg ab (`kiAbschaltung`, `KiAbgeschaltetFehler`). Ein Lesefehler fällt sicher auf `LOAD_FAILURE_FALLBACK_POLICY` = `deterministic` zurück. `KLARWERK_REASONER_POLICY` überschreibt pro Deployment. | — | Der Adapter müsste als eigene Wahl in diese Zuordnung aufgenommen werden. Heute kennt die Mechanik keinen Adapter. |

**Ergebnis:**
- Firmenwissen nachzutrainieren widerspricht der Datenstrategie und bleibt **ausgeschlossen**.
- Ein Adapter nur für Stil und Struktur wäre mit der Datenstrategie **nur unter E5 und E7 vereinbar**. Heute gibt es keinen solchen Adapter.
- Die KI-Zuordnung um einen Adapter zu erweitern, setzt eine Entscheidung für B oder C (§14) voraus. Diese Erweiterung ist nicht Teil dieser Klärung.

---

## 17. Lieferstand und Abgrenzung

- **Mit dieser Klärung geliefert:**
  - §13–§17 und der Hinweis an §4,
  - der Quellenwächter `tests/modelltraining-entscheidung/entscheidungsnotiz.test.ts`.

  Die Fassung entsteht erst mit der Veröffentlichung. Bis dahin fehlt der Lieferbeleg (Version, Deployment).
- **Früher geliefert (historisch, nicht erneut geprüft):**
  - §1–§12 dieser Notiz (laut Register: JOB 1044, BEN GRUEN 17.08.2026),
  - das Nicht-Ziel in `specs/stories/reasoner.md`.
- **Gesonderte Bestände, nicht Teil dieser Klärung:**
  - die RAG-Readiness (`rag-readiness-decision.md`) und ihre Fortschreibung,
  - die Embedding-/Vorfilter-Arbeit (R-0470, AW-12),
  - die KWN-2-Messung auf dem Mac Studio,
  - die KI-Auswahl im Adminbereich.
- **Quellenwidersprüche:**
  1. §4 und `rag-readiness-decision.md` §3 („keine Embeddings") widersprechen `services/embedding`.
  2. R-0864 („entschieden, nicht nachzutrainieren") widerspricht der R-0720-Notiz, §9 und Berater-Konzept §5.1 (siehe §14).
  3. Das Register nennt den Zustand „angedacht", der Altbestand den Status „VERWORFEN".
- **Fehlende Belege:**
  - Die Notiz selbst trägt kein Datum, das „25.07." stammt nur aus dem Register.
  - Die Rückgabe von JOB 1044 liegt nicht im Repository.
  - Es gibt keine Prüfstand-Messreihe auf der Zielhardware.
  - Ein Defizit in Stil/Struktur ist nicht belegt.

---

*Read-only Entscheidungsnotiz. Kein Produktcode geändert; kein Training/Adapter/RAG erzeugt.*
