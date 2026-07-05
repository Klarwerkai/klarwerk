# Verhaltensartefakte — gemeinsames Schema (Superset-Vorschlag)

*Für: Paul (App/Cloud-Worker) & NERD (Insel) · Zweck: SCRUM-393 von Anfang an als Obermenge bauen, die die Insel-Schicht 2 spiegelt · Stand: 05.07.2026 · Bezug: KLLM-64, SCRUM-393/386/312, SCRUM-415*

## Prinzip

Ein Datenmodell, ein Eigentümer (App, zentral), ein Spiegel (Insel, zentral→Insel). Artefakte sind **datengetriebene Bausteine**, kein je Modell handgeschriebener Monolith-Prompt. Der finale Prompt entsteht zur Laufzeit; beim Modellwechsel ändert sich an den Artefakten nichts.

## Anschluss an das, was heute real existiert

- **Reasoner-Form:** `/api/reasoner { task, text, instruction }` (Tasks heute: structure · ask · assist · interview · extract).
- **Presets:** SCRUM-386 — benannte `instruction`s für `assist` (seit SCRUM-312). Das ist der existierende Prompt-Kontrakt; ein Preset ist im Schema unten `art = instruction_preset`.
- **Provider/Modell:** `taskConfig` (global + je Task, `auto/cloud/local/deterministic`) + `probe`/`probeLocal`. Der Modelltausch bleibt hier; das Schema fasst ihn nicht an.
- **Vertraulichkeit:** SCRUM-415 — `intern · vertraulich · streng_vertraulich`, `isConfidential`, Regel „vertrauliche Inhalte nie in externe Kontexte". Gleiche Vokabel, gleicher Helfer.

## Schema (Superset)

```ts
type Task =
  | "structure" | "ask" | "assist" | "interview" | "extract"   // App-Reasoner heute
  | "select" | "conflict" | "dedupe";                           // Prüfstand-Zusatz (siehe offener Punkt)

type ArtefaktArt =
  | "system_prompt"       // Grund-Systemprompt je Task
  | "antwort_kontrakt"    // Format-/Ehrlichkeitsregeln (z. B. „nur aus Quellen", JSON)
  | "instruction_preset"  // = SCRUM-386 benannte instruction (assist etc.)
  | "few_shot"            // Musterlösung (Eingabe → ideale Antwort)
  | "guardrail";          // Regel/Negativbeispiel aus einem Fehlerfall

interface Verhaltensartefakt {
  id: string;
  task: Task;
  art: ArtefaktArt;
  name?: string;                  // für instruction_preset: der Anzeigename (SCRUM-386)
  inhalt: string;                 // der Prompt-Baustein / das Beispiel / die Regel
  sprache: "de" | "en" | "neutral";
  version: number;                // semantisch; alte Versionen bleiben lesbar
  aktiv: boolean;                 // nur aktive werden injiziert
  modellklasse?: "lokal-klein" | "lokal-gross" | "cloud-stark" | "alle";  // Dosierung (Konzept 9.3), NICHT Inhalt

  // Prüfstand-Rückfluss (Insel-Beitrag, im Schema von Anfang an vorgesehen):
  herkunftsfall?: string;         // Prüfstand-Fall-ID, der das Artefakt auslöste (z. B. "KON-5")
  belegMessung?: { vorher: number; nachher: number; pruefstandVersion: string };

  provenienz: Provenienz;         // gemeinsamer Kern, unten
}

interface Provenienz {
  quelle: "kurator" | "auto" | "pruefstand" | "nutzer" | "import";
  erstelltVon: string; erstelltAm: string;
  reviewStatus: "entwurf" | "geprueft" | "freigegeben" | "verworfen";
  vertraulichkeit: "intern" | "vertraulich" | "streng_vertraulich";   // SCRUM-415-Vokabel
  audit: AuditRef[];              // append-only
  fingerprint: string;            // Dedup
}
```

## Prompt-Zusammenbau (Laufzeit, deterministisch)

```
finalPrompt(task, modellklasse) =
    system_prompt(task)
  + aktive antwort_kontrakt(task)
  + aktive guardrails(task)
  + top-N few_shots(task, dosiert nach modellklasse)
```

Das Ergebnis speist die bestehende `/api/reasoner { task, text, instruction }`-Kette; `taskConfig` wählt den Provider. Ein schwächeres Modell bekommt mehr Few-Shots, ein starkes weniger — das ist ein **Dosierungs-Parameter**, kein Umschreiben der Artefakte. Zusammenbau ist eine reine Funktion über die aktiven Artefakte → testbar, versioniert.

## Freigabe-Regel (Governance)

Ein Artefakt wird erst injiziert, wenn `reviewStatus = freigegeben` **und** das Prüfstand-Regressions-Gate grün ist (der neue Guardrail verbessert seinen Zielfall und verschlechtert keinen anderen). Vertrauliche Inhalte nie in externe Kontexte (SCRUM-415).

## Sync

Dieses Schema ist der **zentrale** Store (App). Die Insel-Schicht 2 ist ein kuratierter Spiegel (zentral→Insel, Konzept 6.3). Insel-lokale Guardrails aus Insel-Prüfstandläufen wandern als **Vorschlag** zurück (nicht automatisch aktiv).

## Der eine offene Abstimmungspunkt: Task-Taxonomie

Heute: App-Reasoner kennt **5** Tasks (structure/ask/assist/interview/extract); der Prüfstand nutzt **8** (zusätzlich select/conflict/dedupe, und `answer` statt `ask`). Vorschlag zur Entscheidung beim SCRUM-393-Bau:

- `ask` ≙ `answer` (gleicher Task, ein Name — ich schlage `ask` als kanonisch vor, `answer` als Alias im Prüfstand-Mapping).
- select/conflict/dedupe: entweder (a) eigene Reasoner-Tasks, (b) Sub-Modi von `ask`/`structure`, oder (c) reine Insel-/Prüfstand-Artefakt-Tasks ohne eigenen Reasoner-Endpunkt. **Empfehlung:** (c) zunächst — die drei sind heute Prüfstand-Aufgaben, kein App-Feature; das Schema trägt sie als `task`-Werte, ohne dass die App dafür einen Reasoner-Task bauen muss. Wird (a) später gebraucht, ist es additiv.

Das ist die einzige Stelle, die Paul und ich vor dem SCRUM-393-Bau final festklopfen sollten; alles andere oben ist anschlussfertig.

## Was NICHT hier drin ist (App-Eigentum)

Admin-UI der Prompt-Verwaltung (SCRUM-393), Mandanten-Persistenz und Preset-Setup je Kunde (SCRUM-386), die Editor-Palette (SCRUM-384). Dieses Dokument definiert nur das **gemeinsame Datenmodell + den Zusammenbau-Kontrakt**, gegen den beide Seiten bauen.
