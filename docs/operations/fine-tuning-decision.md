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

- Training auf eigenen Daten = **Datenfluss an Trainings-/Modellanbieter** + **eingebackenes** Wissen → konfligiert mit **DSGVO-Löschung** (Gewichte sind nicht selektiv „löschbar") und mit dem unveränderlichen-Audit-/Quellenprinzip.
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

*Read-only Entscheidungsnotiz. Kein Produktcode geändert; kein Training/Adapter/RAG erzeugt.*
