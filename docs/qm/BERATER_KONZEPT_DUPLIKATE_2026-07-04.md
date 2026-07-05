# KLARWERK — Fachkonzept: Duplikat-Erkennung & Zusammenführung („Überschneidungen")

*Auftraggeber: Peter Kohnert (Pedi) · Ausarbeitung: externer Architektur-/Produktberater (unabhängige Claude-Session) · Stand: 04.07.2026*

> **Zweck & Geltung.** Dieses Konzept behandelt **ausschließlich Duplikate/Überschneidungen**: Wie erkennt das System, dass sich zwei Artikel inhaltlich überschneiden, wie zeigt es **ehrlich an, wie stark**, und wie führt es Menschen zu der Entscheidung „zusammenführen, verwandt lassen oder getrennt lassen". Es folgt demselben Aufbau und denselben Leitprinzipien wie das Konflikt-Konzept (`BERATER_KONZEPT_KONFLIKTERKENNUNG_2026-07-04.md`) und nutzt **dieselbe technische Basis** (Trigger-Pipeline, Fingerprint-Ledger, eine Anlegestelle, Reasoner-Task-Muster, Zitat-Wächter) — Paul baut also auf dem auf, was für Konflikte bereits funktioniert.
>
> **Delta zum Konflikt-Konzept (wichtig, damit keine zwei Wahrheiten entstehen):** Dort war `duplicate` als sechster **Konflikttyp** vorgesehen (deterministische Erkennung ab ≈ 0,9 Textähnlichkeit). Nach Pedis Auftrag vom 04.07. werden Duplikate **aus dem Konflikt-Board herausgelöst** und bekommen eine **eigene Entität und eine eigene Seite**. Konkret ersetzt dieses Dokument im Konflikt-Konzept: den Enum-Zusatz `duplicate` (entfällt — wird NICHT gebaut bzw. wieder ausgebaut, falls schon begonnen), die Zeile „duplicate" in der Taxonomie-Tabelle (5.1) und den deterministischen Doppelungs-Direkt-Erkenner (4.1), der jetzt in die Duplikat-Pipeline speist statt einen Konflikt anzulegen. Alles andere im Konflikt-Konzept bleibt unverändert gültig.
>
> **Warum die Trennung richtig ist (Begründung der Pedi-Idee „eigene Seite"):** Ein Konflikt heißt „etwas ist möglicherweise **falsch**" — er begrenzt die Nutzbarkeit und verlangt Dringlichkeit. Eine Überschneidung heißt „nichts ist falsch, aber der Bestand ist **unaufgeräumt**" — sie verlangt Kuratierung, keine Alarmierung. Vermischt man beides in einem Board, verwässert das die Dringlichkeit der Konflikte und erschlägt die Duplikat-Pflege mit dem falschen Ton. Außerdem ist Überschneidung ein **Spektrum** (identisch → enthalten → teilweise → verwandt) mit eigener Anzeige (Grad, gemeinsame Passagen) und eigenem Endpunkt (**Zusammenführen** — ein redaktioneller Mehrschritt-Vorgang, kein dokumentierender Entscheid). Eigene Seite, eigenes Vokabular, gemeinsame Technik.

---

## 0 · Ausdrücklich benannte Annahmen

- **D0-1 · Gegenstand** sind Wissensobjekte (KOs) untereinander. Kommentare/Quellen sind KEINE Duplikat-Beteiligten (ein Kommentar „doppelt" keinen Artikel im kuratorischen Sinn); das Beteiligten-Schema bleibt trotzdem generisch (wie bei Konflikten), damit spätere Erweiterungen ohne Umbau möglich sind.
- **D0-2 · Vergleichs-Gegenstand** ist der Kerntext (`title + statement + conditions + measures`, wie Konflikt-Konzept K0-2) **plus** die Metadaten `category`, `tags`, `asset` als Blocking-/Bonus-Signale. `bodyHtml` fließt NICHT in den Ähnlichkeits-Score ein (Kosten/Präzision), wird aber im Zusammenführen-Assistenten natürlich mitbehandelt.
- **D0-3 · Keine Vektor-/Embedding-Infrastruktur.** Es existiert bewusst keine (Projekt-Ist). Die Kandidatensuche bleibt lexikalisch + metadaten-basiert; semantisch urteilt das Sprachmodell über vorgefilterte Paare. Embeddings sind eine spätere Option (10.7), kein Bestandteil dieser Umsetzung.
- **D0-4 · Modul-Verortung:** Die Duplikat-Entität lebt **technisch im `conflicts`-Modul** (zweite Entität mit eigenen Routen `/api/duplicates`), weil sie Ledger, Warteschlange, Worker und Integritäts-Routinen teilt. Produktseitig ist sie vollständig getrennt (eigene Seite, eigenes Vokabular). Ein späteres Herauslösen in ein eigenes Modul bleibt möglich (10.6).
- **D0-5 · Demo-Daten** (`demoSeed`) und **getrashte** Beiträge sind wie bei Konflikten vom Hintergrundlauf ausgenommen bzw. unsichtbar.
- **D0-6 · Der Entscheider** („wer darf zusammenführen/getrennt lassen") ist, wer den betroffenen Artikel ohnehin bearbeiten bzw. Bestand kuratieren darf — kein neues Rollen-Design in diesem Dokument; menschliche Entscheidungspunkte sind mit ⚑ markiert.
- **D0-7 · Begriff in der Oberfläche:** Seite **„Duplikate"** (Pedis Wort, sofort verständlich), Untertitel „Überschneidungen im Wissensbestand"; die einzelne Karte heißt „Überschneidung", weil nicht jeder Fund ein echtes 1:1-Duplikat ist. EN: „Duplicates" / „Overlap".

---

## 1 · Ziel-Logik (was gilt, warum)

**Was gilt:** KLARWERK erkennt an denselben bewährten Zeitpunkten (beim Einreichen zur Prüfung, laufend im Hintergrund, optional als Hinweis schon beim Erfassen), dass sich zwei Artikel inhaltlich überschneiden. Ist die Überschneidung erheblich, entsteht **automatisch ein Eintrag auf der Duplikate-Seite** — mit ehrlicher Anzeige, **wie** die beiden sich zueinander verhalten (identisch / einer enthält den anderen / teilweise überschneidend / verwandt), **welche Passagen** sich decken (wörtliche Zitate aus beiden), und einer **Empfehlung**, ob man zusammenführen sollte. Die Entscheidung und das Zusammenführen selbst bleiben vollständig menschlich und laufen über den normalen Bearbeitungs- und Prüfweg — es verschwindet nie automatisch ein Artikel, und zusammengeführtes Wissen gilt erst nach erneuter Prüfung wieder als gesichert.

**Warum Duplikat-Erkennung schwerer ist als Widerspruchs-Erkennung — und was das Konzept daraus macht:** Ein Widerspruch ist im Kern eine Ja/Nein-Frage („schließen sich A und B aus?"). Überschneidung ist ein **Grad und eine Beziehung**: Zwei Artikel können identisch sein, einer kann den anderen vollständig enthalten, sie können sich nur in einem Aspekt decken, oder sie behandeln dasselbe Thema unter verschiedenen Bedingungen — und fast nie ist „Duplikat: ja/nein" die ehrliche Antwort. Deshalb liefert die Erkennung hier **kein Binärurteil, sondern ein Überschneidungs-Profil** (Beziehungstyp + Grad + gemeinsame Passagen + Empfehlung), und die Oberfläche zeigt genau dieses Profil, statt eine Scheinpräzision („87 % Duplikat") zu behaupten.

**Die drei Verlässlichkeits-Versprechen** (analog Konflikte, → Tests Abschnitt 9):
1. **Kein Doppel:** Dasselbe Artikelpaar hat höchstens einen offenen Überschneidungs-Eintrag.
2. **Kein Verlust:** Zusammenführen vernichtet nie Inhalt — der aufgehende Artikel bleibt als nachvollziehbarer, verlinkter Bestand erhalten (Herkunft, Quellen, Historie), und das Ergebnis durchläuft die normale Prüfung.
3. **Kein Geist:** Gelöschte Beteiligte beenden den Eintrag geordnet (identische Integritäts-Routine wie bei Konflikten); die Seite zeigt nie „Objekt nicht gefunden".

---

## 2 · Datenmodell

Additiv, nach dem Muster des Konflikt-Konzepts; wo möglich werden dessen Strukturen wörtlich wiederverwendet.

### 2.1 Überschneidungs-Eintrag (neue Entität, im `conflicts`-Modul)

```
type OverlapRelation =
  | "identisch"        // praktisch derselbe Artikel
  | "a_enthaelt_b"     // B ist Teilmenge von A
  | "b_enthaelt_a"     // A ist Teilmenge von B
  | "teilweise"        // erheblicher gemeinsamer Kern, beide haben Eigenanteile
  | "verwandt"         // gleiches Thema, geringe Textdeckung (Grenzfall, s. Schwellen)

interface OverlapAspect {                    // EINE sich deckende Aussage, belegt
  beschreibung: string                       // z. B. "Beide nennen 10 Sekunden Wartezeit nach dem Anfahren"
  zitatA: string                             // wörtlich aus A (Zitat-Wächter wie bei Konflikten)
  zitatB: string                             // wörtlich aus B
}

type OverlapRecommendation =
  | "zusammenfuehren"                        // ein Artikel, klare Empfehlung
  | "zusammenfuehren_pruefen"                // wahrscheinlich sinnvoll, Eigenanteile beachten
  | "getrennt_lassen"                        // bewusst zwei Artikel (z. B. verschiedene Geltungsbereiche)
  | "verwandt_verlinken"                     // getrennt, aber aufeinander verweisen

interface OverlapDetector {                  // Struktur identisch zum ConflictDetector
  trigger: "validation" | "background" | "capture_hint" | "manual"
  method: "model" | "deterministic"
  modelLabel?: string; promptVersion?: string  // "dup-v1"
  lexicalScore: number                       // 0..1 — deterministische TEXT-Überschneidung (reproduzierbar)
  confidence?: number                        // Modell-Sicherheit für relation/empfehlung
  rationale?: string                         // EIN Satz
  modelRunId?: string
}

type OverlapResolutionReason =
  | "merged"               // zusammengeführt (mit Verweis auf Überlebenden + neue Version)
  | "kept_separate"        // Mensch: bewusst getrennt (Begründung), unterdrückt Wiederanlage
  | "linked_related"       // Mensch: als verwandt markiert, beide bleiben
  | "dismissed"            // Fehlalarm (keine echte Überschneidung)
  | "participant_deleted"  // Beteiligter gelöscht (Integritäts-Routine)
  | "superseded"           // durch anderen Vorgang gegenstandslos (z. B. einer wurde ohnehin überarbeitet)

interface OverlapEntry {
  id: string
  participants: ConflictParticipant[]        // WIEDERVERWENDET (kind:"ko", label-Snapshot, fingerprint, removed?)
  relation: OverlapRelation
  aspects: OverlapAspect[]                   // 1..5 belegte gemeinsame Aussagen
  eigenanteilA?: string; eigenanteilB?: string   // je EIN Satz: was hat nur A / nur B (für die Merge-Entscheidung zentral)
  recommendation: OverlapRecommendation
  status: "offen" | "in_bearbeitung" | "geschlossen"    // bewusst schlanker als Konflikte (kein Eskalieren/Zweitmeinung als Pflichtpfad)
  pairKey: string                            // "dup|" + sortierte KO-IDs (EIN offener Eintrag je Paar)
  origin: "auto" | "manual"
  detector?: OverlapDetector
  resolution?: { reason: OverlapResolutionReason; by: string | null; note: string | null;
                 mergedIntoKoId?: string; mergedVersion?: number; at: string }
  createdAt: string; closedAt?: string
}
```

**Bewusst schlanker Lebenszyklus:** Überschneidungen brauchen kein Eskalieren und keine formale Zweitmeinung als eigene Zustände — es geht nicht um Wahrheit, sondern um Redaktion. Wer unsicher ist, nutzt die normalen Wege (Kommentar, Ansprache). `in_bearbeitung` markiert, dass jemand den Zusammenführen-Assistenten geöffnet hat (verhindert Doppelarbeit, s. 5.3).

### 2.2 Markierung am aufgegangenen Artikel

```
// Additives Feld am KnowledgeObject (JSON-persistiert, keine Migration):
mergedInto?: { koId: string; version: number; at: string; by: string }
```

Ein Artikel mit `mergedInto` ist **kein gelöschter** Artikel: Er bleibt dauerhaft lesbar (Banner „Dieser Artikel ist am … in ‚X' aufgegangen", mit Link), wird aber aus Bibliothek-Standardsicht, Fragen-Retrieval, Validierungs-Board und Kennzahlen ausgenommen (wie getrasht — nur ohne Ablauffrist und ohne Endlöschung). Begründung gegen „einfach in den Papierkorb": Der Papierkorb **endlöscht nach Frist** — damit verschwänden Herkunft, Kommentare und Quellen des aufgehenden Artikels; für Nachvollziehbarkeit („woher stammt diese Aussage im zusammengeführten Artikel?") muss der Ursprung dauerhaft erhalten bleiben. ⚠ Alle Lese-/Retrieval-Pfade, die heute `deletedAt` ausblenden, müssen zusätzlich `mergedInto` ausblenden (eine gemeinsame Helferfunktion `isRetired(ko)`, an EINER Stelle definiert).

### 2.3 Dedup & Ledger (Wiederverwendung)

`pairKey`-Invariante und Fingerprint-Ledger (`PairVerdict`/`ScanEntry`) werden aus dem Konflikt-Konzept **mitbenutzt** — mit Namensraum im Schlüssel (`dup|…` vs. `truth|…`), damit dieselbe Paarprüfung für Konflikt und Duplikat unabhängig geführt wird. `PairVerdict.outcome` erhält die zusätzlichen Werte `kept_separate` und `merged` (beide unterdrücken die Wiederanlage: `kept_separate` bis zur Inhaltsänderung eines Beteiligten, `merged` dauerhaft — ein aufgegangener Artikel wird nicht erneut gepaart). Audit-Vokabular neu: `overlap.auto-created`, `overlap.dismissed`, `overlap.kept-separate`, `overlap.linked-related`, `overlap.merge-started/completed/aborted`, `overlap.auto-resolved`, `ko.merged-into`, `ko.merge-received` (am Überlebenden), `overlaps.scan.completed`. Dev-Persist: neue Repos/Methoden in `MUTATING_METHODS`; Pg-DDL ergänzen (bekannter Doppel-Pfad).

---

## 3 · Trigger-Design

Dieselbe Pipeline wie Konflikte (eine Queue, ein Worker, Priorität nutzerferner Arbeit zuletzt); die Duplikatprüfung eines Paars läuft im selben Durchgang wie die Konfliktprüfung (ein Kandidat, zwei Fragen — spart die Hälfte der Modellaufrufe, s. 4.3).

- **T1 · Beim Einreichen zur Prüfung (Hauptpunkt):** Der eingereichte Artikel wird gegen den Bestand geprüft; erhebliche Überschneidungen erscheinen dem Prüfer als Karte „Überschneidung mit bestehendem Artikel (N)" — der beste Moment, ein Duplikat zu stoppen, **bevor** es validiert wird. Der Prüfer kann direkt aus der Prüfansicht in den Zusammenführen-Assistenten ⚑ oder bewusst „getrennt lassen" wählen. Einreichen wird nie blockiert.
- **T0 · Hinweis beim Erfassen (neu, nur für Duplikate, optional zuschaltbar):** Während des Erfassens (nach Eingabe von Titel + Kernaussage, unscharf ab ~15 Wörtern) zeigt eine ruhige Seitenkarte „Ähnliche Artikel im Bestand (2)" mit Kurzvorschau und „Ansehen"-Link — **rein deterministisch** (lexikalische Kandidatensuche, kein Modellaufruf, keine Latenz), **niemals blockierend**, kein automatischer Eintrag. Begründung für die Abweichung vom Konflikt-Triggerset: Das billigste Duplikat ist das, das **gar nicht erst geschrieben** wird — beim Erfassen kann der Autor den bestehenden Artikel öffnen und dort ergänzen statt zu doppeln. Bei Konflikten wäre derselbe Hinweis kontraproduktiv (er würde Autoren vom ehrlichen Widersprechen abhalten); bei Duplikaten ist er reine Zeitersparnis. Default: **an**; Admin kann ihn abschalten. *(Offene Entscheidung 10.1 mit Empfehlung.)*
- **T3 · Laufend im Hintergrund:** identisch zum Konflikt-Hintergrundlauf (gleicher Zeitplan, gleiches Paar-Budget, gemeinsamer Lauf); findet nachträglich entstandene Überschneidungen und arbeitet den Bestand systematisch ab. Zusammenfassung je Lauf im Audit + Seitenkopf.
- **T2 · Beim Fragen: bewusst NICHT als eigener Duplikat-Trigger.** Für die Antwortqualität sind Duplikate unkritisch (zwei gleiche Aussagen stützen sich höchstens); ein eigener Ask-Trigger brächte Aufwand ohne Nutzerwert. Einziges Ask-Signal: Zitiert eine Antwort zwei Artikel, zwischen denen ein **offener** Überschneidungs-Eintrag existiert, zeigt sie dezent „Hinweis: Diese beiden Quellen überschneiden sich (D-…)" — reine Kennzeichnung Bekannten, kein Modellaufruf, keine Latenz.

**Idempotenz:** identisch zum Konflikt-Konzept — alle Trigger münden in `raiseOverlap(pair, profil)`, das gegen offenen Eintrag (pairKey), Ledger-Unterdrückung (`none`/`kept_separate`/`dismissed` bei unveränderten Fingerprints, `merged` dauerhaft) und den Zitat-Wächter prüft, bevor angelegt wird.

---

## 4 · Erkennungslogik (das „Schwieriger" ernst genommen)

### 4.1 Stufe 1 — Deterministischer Überschneidungs-Score (immer verfügbar, reproduzierbar)

Für Kandidatenwahl UND ehrliche Anzeige wird ein **lexikalischer Überschneidungsgrad** berechnet (0–100 %): gewichtete Ähnlichkeit je Feld (Vorschlag: Titel 0,30 · Kernaussage 0,40 · Bedingungen 0,15 · Maßnahmen 0,15; normalisiert: Kleinschreibung, Satzzeichen, Stoppwörter; Token-/Trigram-Vergleich — im Pg-Betrieb pg_trgm-gestützt, In-Memory als reine Stringlogik). Kategorie-/Tag-/Anlagen-Gleichheit wirkt als Kandidaten-Blocking und leichter Bonus, fließt aber **nicht** in die angezeigte Prozentzahl ein (die Zahl soll „Textdeckung" bedeuten, nicht „Themennähe" — sonst wird sie unglaubwürdig).

**Schwellen (Config, Startwerte — bewusst konservativ, Präzision vor Vollständigkeit):**

| lexicalScore | Verhalten |
|---|---|
| ≥ 0,85 | **Auto-Eintrag ohne Modell** (`method:"deterministic"`, relation `identisch`, Empfehlung `zusammenfuehren`) — auch im modelllosen Betrieb |
| 0,45 – 0,85 | **Kandidat fürs Modell** (Stufe 2) — hier liegen die schweren Fälle (Paraphrase, Teilmenge, Teilüberschneidung) |
| < 0,45 | kein Kandidat — AUSSER Titel-Ähnlichkeit ≥ 0,8 (gleicher Titel, anderer Text ist ein klassisches Duplikat-Muster) |

**Ehrliche Grenze (ausgesprochen, nicht versteckt):** Ohne semantische Suche entgehen der Stufe 1 Paraphrasen mit geringer Wortdeckung („Pumpe entlüften nach Anfahren" vs. „Nach dem Start Luft aus der Dosiereinheit lassen"). Abmilderung: Metadaten-Blocking (gleiche Kategorie/Anlage kommt auch bei niedrigem Score in die Modell-Kandidaten, budgetiert), der T0-Hinweis (der Autor erkennt sein Thema selbst) und die manuelle Meldung („Als Duplikat melden" am KO, s. 5.4). Die Recall-Lücke wird in der Admin-Statuszeile nicht behauptet weg zu sein — und Option 10.7 (Embeddings über den lokalen LLM-Server) ist der benannte spätere Ausbau.

### 4.2 Stufe 2 — Modell-Urteil: das Überschneidungs-Profil (`dup-v1`)

Gleiche Infrastruktur wie `kon-v1` (Task-Einsatz in der KI-Verwaltung, Provider-Kette, Temperatur 0, ModelRun-Protokoll, `enable_thinking=false` lokal). Eingabe: beide Kerntexte, neutral A/B. Erwartetes striktes JSON:

```
{ "beziehung": "identisch" | "a_enthaelt_b" | "b_enthaelt_a" | "teilweise" | "verwandt" | "verschieden" | "unsicher",
  "gemeinsame_aussagen": [ { "beschreibung": "…", "zitat_a": "wörtlich", "zitat_b": "wörtlich" } ],   // max. 5
  "nur_in_a": "EIN Satz oder leer", "nur_in_b": "EIN Satz oder leer",
  "empfehlung": "zusammenfuehren" | "zusammenfuehren_pruefen" | "getrennt_lassen" | "verwandt_verlinken",
  "confidence": 0.0–1.0, "begruendung": "EIN Satz." }
```

Prompt-Regeln: nur beurteilen, was in den Texten steht; **verschiedene Geltungsbereiche, die explizit im Text stehen** (andere Anlage, andere Bedingung) → `getrennt_lassen` empfehlen, auch bei hoher Textdeckung; im Zweifel `unsicher`. **Zitat-Wächter** wie bei Konflikten: jedes `zitat_a`/`zitat_b` muss wörtlich im jeweiligen Kerntext vorkommen, sonst wird die betroffene gemeinsame Aussage gestrichen; bleiben null belegte Aussagen übrig, wird der Fund verworfen (keine unbelegte Überschneidungs-Behauptung).

**Anlage-Schwellen:** Eintrag entsteht bei `beziehung ∈ {identisch, a_enthaelt_b, b_enthaelt_a, teilweise}` und `confidence ≥ 0,7`. `verwandt` erzeugt **keinen** automatischen Eintrag (sonst füllt sich die Seite mit Themennähe-Rauschen) — `verwandt`-Urteile landen nur im Ledger (`none`) und stehen dem T0-Hinweis zur Verfügung. `verschieden/unsicher` → Ledger `none`.

### 4.3 Kombi-Prüfung mit Konflikten (Kosten halbieren)

Konflikt- und Duplikatprüfung teilen Kandidatenwahl und Paar-Budget. Empfehlung: **ein kombinierter Prompt je Paar** (`pair-v1`), der beide Fragen in einem Aufruf beantwortet (Widerspruch? Überschneidung?) und dessen Antwort in beide Anlegestellen gespeist wird. Fallback bei Qualitätsproblemen: zwei getrennte Prompts (Config-Schalter). Damit kostet die Duplikat-Erkennung im Regelfall **keinen einzigen zusätzlichen Modellaufruf** gegenüber dem, was für Konflikte ohnehin läuft. *(Offene Entscheidung 10.2 mit Empfehlung „kombiniert, aber als eigener promptVersion-Strang messbar".)*

### 4.4 Unsicherheit, Fehlurteile, modellloser Betrieb

Identische Mechanik wie Konflikte: „Getrennt lassen"/„Fehlalarm" ⚑ schließen mit Audit und unterdrücken die Wiederanlage bis zur Inhaltsänderung; Häufungen sind über den Seitenfilter sichtbar und die Stellschraube ist die Schwelle/promptVersion. Ohne Modell: nur die ≥ 0,85-Stufe läuft (ehrlich als „eingeschränkt — nur nahezu wortgleiche Doppelungen" in der Statuszeile benannt).

---

## 5 · Behandlung: die Duplikate-Seite & das Zusammenführen

### 5.1 Eigene Seite „Duplikate" (Empfehlung: JA — Pedis Idee bestätigt)

Eigenständige Seite in der Navigation (Bereich Bestand/Qualität, neben Konflikten; eigenes Sidebar-Badge = Anzahl offener Einträge). Aufbau je Karte:

- **Gegenüberstellung** beider Artikel (bewährtes Konflikt-Muster: zwei Panels, Links ins KO-Detail), darüber der Kopf:
- **Beziehungs-Chip** („Identisch" / „A enthält B" / „Teilweise überschneidend" — die primäre, ehrliche Aussage) + **Textüberschneidung ~72 %** (die deterministische Zahl, mit ?-Hilfe: „Anteil deckungsgleicher Formulierungen im Kerntext — ein Anhaltspunkt, kein Urteil") + Herkunfts-Badge („Automatisch erkannt · Modell X · Sicherheit 81 %" / „Manuell gemeldet von …").
- **Gemeinsame Aussagen** aufklappbar: je Zeile Beschreibung + die beiden wörtlichen Zitate — **in beiden Panels farblich ruhig hervorgehoben** (die sichtbare Antwort auf „inwieweit überschneiden sie sich"). Darunter „Nur in A: …" / „Nur in B: …" (die Eigenanteile — das, was bei einer Zusammenführung nicht verloren gehen darf).
- **Empfehlungs-Chip** („Zusammenführen empfohlen" / „Prüfen" / „Getrennt lassen" / „Verwandt verlinken") mit Begründungssatz.
- **Aktionen:** `Zusammenführen…` ⚑ (Assistent, 5.2) · `Getrennt lassen` ⚑ (Pflicht-Kurzbegründung; unterdrückt Wiederanlage) · `Als verwandt verlinken` ⚑ · `Fehlalarm` ⚑.
- **Filter/Sortierung:** Beziehungstyp · Empfehlung · Herkunft · Status; Sortierung nach Überschneidungsgrad absteigend. Kopfzeile: letzter Hintergrundlauf. Mehrfach-Überschneidungen je Artikel gebündelt („‚X' überschneidet sich mit 3 Artikeln" → Aufklappliste; der Assistent führt dann paarweise, beginnend mit der stärksten).

### 5.2 Der Zusammenführen-Assistent (der redaktionelle Kern) ⚑

Geführter Ablauf in vier Schritten — kein Automatismus, jede Übernahme ist ein bewusster Klick (dasselbe Prinzip wie im Studio/„Aus Datei"):

1. **Führungsartikel wählen.** Vorschlag durch das System (der validierte vor dem offenen; bei gleichem Status der ältere/etabliertere — Kriterium sichtbar erklärt), Mensch kann umdrehen.
2. **Inhalte zusammenführen.** Nebeneinander-Ansicht; die gemeinsamen Aussagen sind vor-markiert („bereits enthalten"), die **Eigenanteile des aufgehenden Artikels** sind die Arbeitsliste: je Punkt „Übernehmen / Weglassen". Optional KI-Formulierungshilfe über den vorhandenen Assist-Einsatz (Vorschau + bewusste Übernahme, wie überall). Bedingungen/Maßnahmen/Tags werden als Vereinigungsmenge vorgeschlagen, jede Position abwählbar.
3. **Mitnahme von Belegen.** Quellen und Anhänge des aufgehenden Artikels als Checkliste „in den Führungsartikel übernehmen" (Standard: alle an); Kommentare werden NICHT kopiert (sie bleiben am Ursprung lesbar), ein Hinweis-Kommentar „Inhalt aus ‚Y' zusammengeführt" wird am Führungsartikel ergänzt.
4. **Abschluss mit ehrlicher Folge.** Anzeige vor dem Bestätigen: „Es entsteht Version N+1 von ‚X' (geht erneut in die Prüfung). ‚Y' bleibt als aufgegangener Artikel erhalten und verweist auf ‚X'." → Bestätigen: `revise` am Führungsartikel (normale Versionierung + Snapshot, Status gemäß bestehender Revisionsregeln → **erneute Validierung; nichts gilt ungeprüft — auch zusammengeführtes Wissen nicht**) · `mergedInto` am aufgehenden Artikel · Eintrag `geschlossen (merged)` · Audit-Kette (`overlap.merge-completed`, `ko.merged-into`, `ko.merge-received`) · Benachrichtigung an beide Autoren.

**Abbruch** jederzeit: keine halben Zustände — bis zum Schritt-4-Bestätigen wird nichts geschrieben (der Assistent arbeitet auf einem Entwurf); `in_bearbeitung` fällt auf `offen` zurück (`overlap.merge-aborted` im Audit).

### 5.3 Statusfluss des Eintrags

`offen → in_bearbeitung (Assistent geöffnet, mit Inhaber + Zeit; verhindert parallele Doppelarbeit — zweiter Interessent sieht „wird gerade von … bearbeitet") → geschlossen (reason)`. `in_bearbeitung` verfällt automatisch nach 24 h ohne Abschluss zurück auf `offen` (kein Dauer-Lock durch verwaiste Sitzungen; Übergang protokolliert).

### 5.4 Manuelles Melden bleibt vollwertig

Am KO-Detail: Aktion „Überschneidung melden" ⚑ (Zielartikel per Suche wählen) → `origin:"manual"`, ohne Modellpflicht; der deterministische Score wird trotzdem berechnet und angezeigt. Der Mensch ist — wie bei Konflikten — der letzte Detektor.

---

## 6 · Integrität, Randfälle

- **Löschen/Papierkorb/Endlöschung/Wiederherstellung eines Beteiligten:** exakt die Konflikt-Routine (`onParticipantRemoved` wird um die Overlap-Einträge erweitert): Eintrag `geschlossen (participant_deleted)`, Label-Snapshots statt Fehlerkarten, Wiederherstellung erzeugt keinen Auto-Reopen (Hintergrundlauf findet echte Überschneidung ohnehin wieder — hier ist das ausreichend, ein Hinweis-Dialog wie bei Konflikten ist nicht nötig, weil kein Klärungs-Vorgang verloren geht).
- **„Bearbeitet statt gelöscht":** Fingerprint-Änderung eines Beteiligten setzt am offenen Eintrag den Hinweis „Beteiligter wurde bearbeitet — Überschneidung ggf. verändert"; der nächste Lauf prüft neu; ändert sich das Profil wesentlich (Beziehungstyp), wird der Eintrag **aktualisiert** (nicht dupliziert; Verlauf im Audit).
- **Konflikt UND Überschneidung am selben Paar:** beides darf offen sein (getrennte pairKey-Namensräume). **Reihenfolge-Regel:** Der Zusammenführen-Assistent warnt bei offenem **Wahrheitskonflikt** am Paar und empfiehlt, erst den Konflikt zu entscheiden („erst klären, was stimmt — dann zusammenführen"); Zusammenführen bleibt möglich ⚑ (bewusst, auditiert), aber nie der stille Default.
- **A ⊂ B (Teilmenge):** Empfehlung des Systems lautet dann „B als Führungsartikel, A aufgehen lassen" — Schritt 1 des Assistenten schlägt das begründet vor.
- **Kaskade:** Artikel C überschneidet A und B; A und B werden zusammengeführt → offene Einträge C–A/C–B bleiben, der C–(aufgegangener)-Eintrag wird per Integritäts-Routine geschlossen (aufgegangen = retired), C–Überlebender wird beim nächsten Lauf mit neuem Fingerprint geprüft.
- **Aufgegangene Artikel:** tauchen nie wieder als Kandidaten auf (Ledger `merged` dauerhaft; `isRetired`-Filter in Kandidatenwahl).
- **Selbst-Duplikat über Versionen** (alte Version ähnelt neuer): Versionen desselben KO sind nie Kandidaten (gleiche ID → ausgeschlossen).
- **DE/EN-Paar** (derselbe Inhalt in zwei Sprachen): lexikalisch unsichtbar, Modell erkennt es als `identisch` — Empfehlung hier ausnahmsweise `getrennt_lassen`/`verwandt_verlinken`, solange die App keine Übersetzungs-Verknüpfung hat; der Prompt bekommt diese Regel explizit (kein Zusammenführen über Sprachgrenzen empfehlen).

---

## 7 · Wechselwirkungen & UI (Zusammenfassung außerhalb der Seite)

- **Prüfung:** Karte „Überschneidung mit bestehendem Artikel" in der Review-Ansicht (T1), mit Direkteinstieg in Assistent/„getrennt lassen" — Duplikate werden idealerweise **vor** der Validierung erledigt.
- **Erfassen:** T0-Hinweiskarte (deterministisch, abschaltbar, nie blockierend).
- **KO-Detail:** Zeile „Überschneidungen (N)" analog Konflikten; bei aufgegangenen Artikeln der Banner mit Link; beim Führungsartikel unter Herkunft: „Enthält Inhalte aus ‚Y' (zusammengeführt am …)".
- **Fragen:** nur Kennzeichnung bekannter offener Einträge, wenn beide Seiten zitiert werden (T2); aufgegangene Artikel werden nie zitiert.
- **Bibliothek:** Standard ohne aufgegangene; Filter „aufgegangene anzeigen" für Nachvollziehbarkeit.
- **KI-Verwaltung:** Einsatz „Duplikatprüfung" (bzw. kombinierter Einsatz „Bestandsprüfung", 4.3) mit denselben Reglern wie Konflikte (Provider, Schwelle, Tagesbudget, Statuszeile inkl. modellloser Einschränkung).
- **Benachrichtigungen:** Auto-Eintrag → Autoren beider Artikel; Zusammenführung → beide Autoren + ggf. Prüfer des Führungsartikels; alles über den vorhandenen Feed.

---

## 8 · Migration & Bestand

1. **Rückbau `duplicate`-Konflikttyp** (falls aus dem Konflikt-Konzept schon gebaut): bestehende `duplicate`-Konflikte werden in Overlap-Einträge überführt (`origin` und `detector` übernehmen), der Enum-Wert wird nicht mehr erzeugt; falls noch nicht gebaut: gar nicht erst anlegen (Kopfnote-Delta).
2. **Erstlauf** über den Bestand, zweistufig wie bei Konflikten: Phase 1 nur deterministisch (≥ 0,85 — die sicheren Fälle; Sichtung durch Pedi), Phase 2 Modell-Profilierung der 0,45–0,85-Kandidaten unter Tagesbudget, kategorienweise. Erwartung ehrlich setzen: Der Erstlauf ist eine **Bestandsaufnahme der Bestandshygiene** — viele Funde sind Arbeit, kein Fehler; die Seite sortiert nach Grad, man arbeitet von oben.
3. **Ledger/Fingerprints:** werden vom Konflikt-Erstlauf mitgeschrieben (gemeinsame Infrastruktur); der Duplikat-Erstlauf nutzt sie nach.
4. **Risiken:** (a) `isRetired`-Filter muss wirklich **alle** Lesepfade abdecken (Bibliothek, Ask-Retrieval, Board, Analytics, Export) — ein vergessener Pfad zeigt aufgegangene Artikel als lebendig; deshalb EIN zentraler Helfer + ein Test je Pfad. (b) Merge erzeugt eine Revision → die bestehenden Revisions-/Snapshot-/Trust-Regeln greifen unverändert; nichts Neues erfinden. (c) Guard-Matrix: alle neuen Routen (`/api/duplicates*`, merge-start/complete/abort, kept-separate, dismiss, manuelles Melden) eintragen. (d) UI-Logik als DOM-freie Lib (`duplicateBoard.ts`, `mergeWizard.ts`) — `Conflicts.tsx`/`Capture.tsx` nicht weiter aufblähen. (e) Kombinierter Prompt (4.3): Qualität je Frage getrennt messen (9.3), sonst maskiert die eine Aufgabe Regressionen der anderen.

---

## 9 · Test- & Abnahmekriterien

### 9.1 Deterministische Kernfälle (Vitest; Modell als Fake-Client)

1. **Wortgleiches Duplikat:** zwei nahezu identische Artikel → Auto-Eintrag `identisch` OHNE Modell, Empfehlung `zusammenfuehren`, Seite zeigt beide mit Score.
2. **Paraphrase (Fake-Modell `teilweise`, 2 belegte Aussagen):** Eintrag entsteht mit Aspekten + Eigenanteilen; Zitate wörtlich verifiziert; nicht-wörtliches Zitat → Aspekt gestrichen; null Aspekte → kein Eintrag.
3. **Teilmenge:** Fake-Urteil `a_enthaelt_b` → Assistent schlägt A als Führungsartikel vor.
4. **Idempotenz:** T1 + T3 gleiches Paar → genau ein offener Eintrag; `verwandt`-Urteil → KEIN Eintrag, Ledger `none`.
5. **Getrennt lassen:** schließt mit Begründung; gleiche Fingerprints → keine Wiederanlage; Bearbeitung eines Artikels → Paar wieder prüfbar.
6. **Merge-Fluss komplett:** Assistent → Version N+1 am Führungsartikel (Snapshot vorhanden, Status nach Revisionsregel → erneute Prüfung), Quellen übernommen, `mergedInto` gesetzt, Eintrag `merged`, Audit-Kette vollständig; **Abbruch** in Schritt 3 → keinerlei Schreibvorgang, Status zurück auf `offen`.
7. **Retired überall unsichtbar:** aufgegangener Artikel erscheint nicht in Bibliothek-Standard, Ask-Retrieval, Validierungs-Board, Kandidatenwahl; Banner + Link vorhanden; Bibliothek-Filter zeigt ihn.
8. **Integrität:** Beteiligter in den Papierkorb → Eintrag `participant_deleted`, keine Fehlerkarte; Kaskadenfall (6) korrekt.
9. **Konflikt-zuerst-Regel:** offener Wahrheitskonflikt am Paar → Assistent zeigt Warnung, Abschluss verlangt ausdrückliche Bestätigung (auditiert).
10. **T0-Hinweis:** erscheint deterministisch bei ähnlichem Titel/Kernaussage, ruft kein Modell (Fake-Zähler 0), blockiert das Speichern nie; abgeschaltet → erscheint nicht.
11. **Modellloser Modus:** nur ≥ 0,85-Einträge; Statuszeile „eingeschränkt" sichtbar.
12. **`in_bearbeitung`-Verfall:** nach 24 h zurück auf `offen`, protokolliert.

### 9.2 Guard-/Vertrags-Tests
Alle neuen Routen in der Guard-Matrix; Merge-Abschluss nur für Bearbeitungsberechtigte des Führungsartikels (403 sonst); Contract-Tests für die Overlap-Antwortform.

### 9.3 Prüfstand-Erweiterung (Modellqualität messbar)
Block **DUP-1…DUP-6**: wortgleiches Paar (identisch) · Paraphrase (teilweise/enthalten, mit belegbaren Zitaten) · Geltungsbereichs-Paar (MUSS `getrennt_lassen` empfehlen) · Themennähe ohne Deckung (MUSS `verwandt/verschieden`) · DE/EN-Paar (identisch erkennen, NICHT zusammenführen empfehlen) · `unsicher`-Fall (ehrliches Passen). **Scharfschaltung** der Modellstufe analog Konflikten: gewähltes Modell ≥ 10/12 im DUP-Block, Geltungsbereichs-Fall darf nicht gerissen werden. Beim kombinierten Prompt (4.3) werden KON- und DUP-Block **getrennt** gewertet.

### 9.4 Abnahme-Formulierung für Pedi (Sichtprüfung)
„Zwei sich überschneidende Artikel anlegen → nach dem Einreichen erscheint der Fund von selbst auf der Duplikate-Seite: mit Beziehungs-Chip, Textüberschneidung in Prozent, den gemeinsamen Passagen wörtlich markiert und einer Empfehlung. ‚Zusammenführen' führt Schritt für Schritt: Führungsartikel wählen, Eigenanteile übernehmen, Quellen mitnehmen — am Ende gibt es EINE neue Version, die normal geprüft wird, und der andere Artikel zeigt dauerhaft ‚aufgegangen in …'. ‚Getrennt lassen' mit Begründung sorgt dafür, dass derselbe Vorschlag nicht wiederkommt, solange sich nichts ändert."

---

## 10 · Offene Entscheidungen — mit Empfehlung

1. **T0-Hinweis beim Erfassen (Abweichung vom Konflikt-Triggerset).** → **Ja, Default an** — deterministisch, latenzfrei, nie blockierend; das wirksamste Mittel gegen Duplikate ist Vermeidung. Abschaltbar für den Fall, dass er im Alltag stört.
2. **Kombinierter Prompt (Konflikt+Duplikat je Paar) vs. getrennte Aufrufe.** → **Kombiniert** (halbiert Modellkosten des Hintergrundlaufs), aber mit getrennter Qualitätsmessung (9.3) und Config-Fallback auf getrennte Prompts.
3. **Anzeige des Grades: eine „semantische" Prozentzahl vs. Beziehungs-Chip + Textüberschreidungs-%.** → **Chip primär, Text-% sekundär.** Eine einzelne „87 % Duplikat"-Zahl wäre Scheinpräzision; der Beziehungstyp ist die ehrliche Hauptaussage, die reproduzierbare Textdeckung der Anhaltspunkt.
4. **Aufgehender Artikel: Papierkorb vs. dauerhafter `mergedInto`-Verbleib.** → **`mergedInto`** — der Papierkorb endlöscht nach Frist und würde Herkunft/Quellen/Kommentare vernichten; Zusammenführen ist Kuratierung, nicht Löschung.
5. **`verwandt`-Funde automatisch anlegen?** → **Nein** — nur `identisch/enthalten/teilweise`; Themennähe-Rauschen würde die Seite entwerten. `verwandt` bleibt dem T0-Hinweis und der manuellen Meldung vorbehalten.
6. **Eigenes Modul vs. zweite Entität im `conflicts`-Modul.** → **Zweite Entität in `conflicts`** (D0-4): teilt Ledger/Worker/Integritäts-Routine ohne neue Modulkanten; produktseitig vollständig getrennt. Herauslösen bleibt später möglich, wenn das Modul zu groß wird.
7. **Embeddings/semantische Suche für besseren Recall.** → **Jetzt nicht** (keine Vektor-Infrastruktur, bewusste Projektentscheidung). Benannter Ausbaupfad: Wenn der lokale LLM-Server in Dauerbetrieb geht, kann er Embeddings liefern — dann Kandidatenwahl um Ähnlichkeitssuche erweitern, Rest des Konzepts bleibt unverändert.
8. **Merge-Ergebnis: automatisch erneut zur Prüfung?** → **Ja, über die bestehenden Revisionsregeln** — zusammengeführter Text ist neuer Text; „nichts gilt ungeprüft" gilt auch hier. Keine Sonderregel „Merge behält validiert" (das wäre stilles Überschreiben der Prüfaussage).

---

*Ende des Konzepts. Ein Durchgang, vollständig; Annahmen in Abschnitt 0, Entscheidungen mit Empfehlung in Abschnitt 10. Ersetzt im Konflikt-Konzept ausschließlich die `duplicate`-Bestandteile (siehe Kopfnote); alles andere dort bleibt gültig. Kein Code, keine Tickets, keine Konfiguration verändert.*
