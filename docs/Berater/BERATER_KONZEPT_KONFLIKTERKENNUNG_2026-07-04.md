# KLARWERK — Fachkonzept: Konflikterkennung & -behandlung

*Auftraggeber: Peter Kohnert (Pedi) · Auftrag aufbereitet von Paul · Ausarbeitung: externer Architektur-/Produktberater (unabhängige Claude-Session) · Stand: 04.07.2026*

> **Zweck & Geltung.** Dieses Konzept behandelt **ausschließlich die Konflikt-Funktion** — Erkennung und Behandlung — und ist so ausgearbeitet, dass Paul es direkt gate-sauber umsetzen kann (TypeScript strict, Biome, dependency-cruiser, Vitest, UI-Smoke). Es baut auf den vier **gesetzten** Vorgaben des Auftraggebers auf (drei Trigger · automatisches Anlegen · Taxonomie durch den Berater · vorhandene KI als Erkennungsmethode) und gestaltet sie aus, statt sie zu diskutieren.
>
> **Verhältnis zum Konzept vom Vortag** (`BERATER_KONZEPT_KONFLIKTE_ROLLEN_DATEIEN_2026-07-04.md`): Dieses Dokument **ersetzt dessen Block A vollständig**. Wichtigste inhaltliche Änderung: Dort war automatische Erkennung nur als *Vorschlag mit menschlicher Bestätigung* empfohlen (Annahme A0-6) — der überarbeitete Auftrag setzt **automatisches Anlegen** verbindlich. Die Integritäts-, Zweitmeinungs- und Darstellungsteile von Block A bleiben inhaltlich gültig und sind hier **selbstständig lesbar** erneut enthalten (Paul braucht nur dieses eine Dokument). Die Blöcke B–D des Vortags-Dokuments (Rollen, Datei-Handling, Aus-Datei-Import) sind von diesem Auftrag unberührt.
>
> Grundlage ist der reale Code-Stand v0.9.45-beta: `services/conflicts` (Conflict{koA,koB,type,status,secondOpinion,decidedBy,decision}), `conflictImpact`/`conflictView` im Frontend, Papierkorb SCRUM-422 (`deletedAt`), Retrieval mit DB-Prefilter/Top-K (SCRUM-360–362), Reasoner-Provider-Kette Cloud → lokal → deterministisch mit Task-Zuordnung je Einsatz (SCRUM-424), Belegstellen-Prüfmuster aus `extract` (G-2, `excerptFoundInDocument`), `model-runs`-Protokoll, `notifications`-Feed, append-only Audit.

---

## 0 · Ausdrücklich benannte Annahmen

- **K0-1 · „Beitrag" =** Wissensobjekt (KO) oder Kommentar (`KoComment`, im KO eingebettet). Weitere Beteiligten-Arten (Quelle, Import-Punkt) sind im Schema vorgesehen, aber nicht Teil der Erstumsetzung.
- **K0-2 · Erkennungs-Gegenstand ist der Kerntext eines Beitrags:** bei KOs `title + statement + conditions + measures` (nicht das volle `bodyHtml` — Kostendeckel und Präzision; der Kern trägt die prüfbare Aussage), bei Kommentaren der Kommentartext. Der „Inhalts-Fingerabdruck" (K2.4) wird über genau diese Felder gebildet.
- **K0-3 · Demo-Daten** (`demoSeed`) werden vom Hintergrundlauf **ausgenommen** (kein Board-Rauschen aus Beispielwissen); die Trigger Validierung/Fragen behandeln sie normal, wenn ein echter Nutzer sie aktiv einreicht/abfragt.
- **K0-4 · Getrashte Beiträge** (`deletedAt` gesetzt) sind für die Erkennung unsichtbar (konsistent zu „wirken gelöscht", SCRUM-422).
- **K0-5 · Der Konfliktentscheider** ist, wer heute `conflict.resolve` trägt; Zweitmeinung gibt, wer prüfberechtigt ist und nicht Autor eines Beteiligten ist. Mehr Rollen-Ausarbeitung enthält dieses Dokument auftragsgemäß **nicht** — die Stellen, an denen ein Mensch entscheidet, sind markiert mit ⚑.
- **K0-6 · Ein-Prozess-Betrieb.** Der Hintergrundlauf ist für den modularen Monolithen (ein Node-Prozess) ausgelegt; kein externer Job-Scheduler, keine neue Infrastruktur.
- **K0-7 · Sprachpaare DE/EN** werden dem Modell zugemutet (es urteilt sprachübergreifend); die deterministische Duplikat-Erkennung arbeitet je Sprache (normalisierter Textvergleich).

---

## 1 · Ziel-Logik (was gilt, warum)

**Was gilt:** KLARWERK prüft an drei definierten Zeitpunkten — bei der Prüfung/Validierung, beim Fragen, laufend im Hintergrund — ob Beiträge einander widersprechen, sich doppeln oder gegenseitig überholen. Erkennt das System einen solchen Befund mit ausreichender Sicherheit, **legt es den Konflikt automatisch an**: sofort im Board sichtbar, mit Herkunft „automatisch erkannt", Begründung und wörtlichen Belegzitaten aus beiden Beiträgen. **Alles Weitere bleibt menschlich:** klassifizieren, Zweitmeinung, eskalieren, entscheiden — und auch das Schließen eines Fehlalarms ist ein dokumentierter menschlicher Klick. Die Auflösung ändert Status/Trust der beteiligten KOs **nie** automatisch.

**Warum das mit „nichts gilt ungeprüft" zusammenpasst:** Ein automatisch angelegter Konflikt behauptet keine Wahrheit — er behauptet nur, **dass eine Spannung existiert und angesehen werden muss**. Das ist dieselbe Logik wie ein Rauchmelder: Er löst automatisch aus (niemand „bestätigt" erst den Verdacht), aber ob es brennt und was zu tun ist, entscheiden Menschen. Maschinell ist ausschließlich das *Aufmerksam-Machen*; jede *Bewertung* (Fehlalarm? Wer hat recht? Zusammenführen?) und jede *Wirkung auf Wissen* (Status, Trust, Löschen, Überarbeiten) bleibt beim Menschen und im Audit. Die einzige automatische „Wirkung" eines offenen Konflikts ist die bereits existierende, bewusst hinweisende Nutzbarkeits-Begrenzung (`conflictImpact`: „in Prüfung" statt „gesichert") — sie markiert Unsicherheit, sie setzt keine Wahrheit.

**Die drei Verlässlichkeits-Versprechen**, an denen die Funktion gemessen wird (→ Tests, Abschnitt 9):
1. **Kein Doppel:** Derselbe Widerspruch existiert höchstens einmal als offener Konflikt, egal über wie viele Trigger er gefunden wird.
2. **Kein Geist:** Kein Konflikt zeigt je „Objekt nicht gefunden" — gelöschte Beteiligte beenden den Konflikt geordnet und dokumentiert.
3. **Kein Schweigen:** Ein einmal erkannter, offener Konflikt ist überall sichtbar, wo das betroffene Wissen auftaucht (Board, KO-Detail, Prüfung, Fragen-Antwort).

---

## 2 · Datenmodell (Entitäten, Felder, Zustände)

Additiv und migrationsarm (JSON-persistierte Zusatzfelder, Muster `KoSource.provider`); bestehende Felder bleiben lesbar.

### 2.1 Konflikt (erweitert)

```
type ParticipantKind = "ko" | "comment"          // erweiterbar: "source" | "file_point"
interface ConflictParticipant {
  kind: ParticipantKind
  refId: string                                   // koId bzw. commentId
  parentKoId?: string                             // bei kind="comment": Träger-KO
  label: string                                   // eingefrorener Kurztitel (Anzeige-Fallback, nie "nicht gefunden")
  fingerprint: string                             // Inhalts-Fingerabdruck zum Erkennungszeitpunkt (s. 2.4)
  removed?: { at: string; how: "trashed" | "purged" }   // Beteiligter entfallen (Integrität, Abschnitt 6)
}

type ConflictOrigin = "manual" | "auto"
interface ConflictDetector {                      // nur bei origin="auto"
  trigger: "validation" | "ask" | "background"
  method: "model" | "deterministic"
  modelLabel?: string                             // z. B. "claude-sonnet-4-6" | "qwen3-32b-awq (lokal)"
  promptVersion?: string                          // z. B. "kon-v1" (Reproduzierbarkeit)
  confidence?: number                             // 0..1 aus dem Modellurteil
  rationale?: string                              // EIN Satz Begründung des Modells
  quotes?: { a: string; b: string }               // wörtliche Belegzitate aus beiden Beiträgen (G-2-Muster)
  modelRunId?: string                             // Verweis ins bestehende model-runs-Protokoll
}

type ConflictResolutionReason =
  | "decided"               // Mensch hat inhaltlich entschieden
  | "dismissed"             // Fehlalarm — Mensch hat verworfen ("kein Widerspruch")
  | "participant_deleted"   // Grundlage entfiel: Beteiligter gelöscht
  | "edited_no_conflict"    // Beteiligter geändert, Mensch bestätigt: Widerspruch entfallen
  | "superseded"            // durch neueren Konflikt/Zusammenführung ersetzt (selten, dokumentierend)
  | "withdrawn"             // manuell angelegter Konflikt vom Ersteller zurückgezogen
interface ConflictResolution {
  reason: ConflictResolutionReason
  by: string | null                               // null nur bei participant_deleted (systemisch)
  note: string | null
  at: string
}

interface Conflict {
  id: string
  participants: ConflictParticipant[]             // 2..N (Erstumsetzung: genau 2, s. 7.1)
  koA?: string; koB?: string                      // Übergangsfelder (Alt-Leser); Neuanlagen füllen beide Welten
  type: ConflictType                              // Taxonomie s. Abschnitt 4
  status: "offen" | "eskaliert" | "zweitmeinung" | "geloest"   // unverändert (keine Enum-Migration)
  description: string                             // bei auto: aus rationale+quotes generiert, ehrlich als solche markiert
  pairKey: string                                 // Dedup-Schlüssel (s. 2.3)
  origin: ConflictOrigin
  detector?: ConflictDetector
  secondOpinions: SecondOpinion[]                 // strukturiert (s. Abschnitt 5)
  escalation?: { at: string; by: string; note?: string }
  resolution?: ConflictResolution
  decidedBy: string | null; decision: string | null   // bleiben (Alt-Kompatibilität; resolve füllt beides)
  createdAt: string; closedAt?: string
}
```

### 2.2 Zweitmeinung (strukturiert, ersetzt das Einzel-Freitextfeld)

```
interface SecondOpinion {
  id: string
  requestedBy: string
  assignee: string                                // konkrete Person ⚑ (Auswahl durch Menschen)
  status: "open" | "answered" | "cancelled"       // cancelled = hinfällig (z. B. Beteiligter gelöscht)
  verdict?: "supports_a" | "supports_b" | "unclear" | "both_partly"
  comment?: string
  requestedAt: string; answeredAt?: string
}
```
Das bestehende Feld `secondOpinion: string|null` bleibt als Alt-Anzeige erhalten (read-only); Neuanlagen nutzen die Liste.

### 2.3 Dedup-Schlüssel `pairKey`

`pairKey = type + "|" + sortierte Liste der Beteiligten-Referenzen` (je `kind:refId`). Invariante (systemweit erzwungen in genau einer Funktion, s. 3.4): **Es gibt höchstens EINEN offenen Konflikt je pairKey.** Derselbe Beitrags-Paar darf verschiedene *Typen* gleichzeitig offen haben (selten, aber legitim: dieselbe Doppelung kann zusätzlich einen Wahrheitswiderspruch enthalten) — deshalb ist der Typ Teil des Schlüssels.

### 2.4 Erkennungs-Ledger (neu, im `conflicts`-Modul)

Damit der Hintergrundlauf skaliert und nichts doppelt zum Modell geht:

```
interface ScanEntry {                             // je Beitrag
  kind: ParticipantKind; refId: string
  fingerprint: string                             // Hash über den Kerntext (K0-2), z. B. sha256, gekürzt
  lastScanAt: string | null                       // wann zuletzt als "A-Seite" vollständig geprüft
}
interface PairVerdict {                           // je geprüftem Paar+Typ (Ergebnis-Gedächtnis)
  pairKey: string
  fingerprints: [string, string]                  // Stände BEIDER Seiten zum Prüfzeitpunkt
  outcome: "created" | "none" | "dismissed"       // dismissed wird beim Fehlalarm-Schließen gesetzt
  at: string
}
```

Regeln: (1) Ein Paar wird **nicht erneut** dem Modell vorgelegt, solange beide Fingerprints unverändert sind (`outcome: none` oder `dismissed` wirkt als Unterdrückung). (2) Ändert sich **ein** Fingerprint (Beitrag bearbeitet), ist das Paar wieder prüfbar — auch ein früher verworfener Fehlalarm darf dann erneut entstehen (der Inhalt ist ja neu). (3) `created` + noch offener Konflikt → nie doppelt anlegen. Damit ist Idempotenz **daten-, nicht trigger-basiert** — egal welcher der drei Auslöser zuerst kommt.

**Persistenz:** eigenes Repo im `conflicts`-Modul (In-Memory + Pg-Adapter nach Bestandsmuster). ⚠ Betriebsregel des Projekts beachten: neue mutierende Repo-Methoden in `MUTATING_METHODS` (Dev-Persist) eintragen; Pg-DDL in `db.ts#migrate` ergänzen.

**Audit-Vokabular (append-only, neu):** `conflict.auto-created` (mit detector-Metadaten), `conflict.dismissed`, `conflict.auto-resolved`, `conflict.participant-removed`, `conflict.second-opinion.requested/answered/cancelled`, `conflict.escalated`, `conflict.resolved`, `conflict.reclassified`, `ko.conflict-cleared`, `conflicts.scan.completed` (Hintergrundlauf-Zusammenfassung).

---

## 3 · Trigger-Design (die drei Auslöser)

**Gemeinsame Architektur zuerst.** Alle drei Trigger erzeugen nur **Prüfaufträge** für dieselbe zentrale Pipeline: `enqueueDetection(subjekt, cause)` → Kandidaten-Vorauswahl (Abschnitt 4-Stufe-1) → Urteil (Stufe 2) → `raiseDetected(...)` (3.4). Eine Warteschlange, ein Worker (Konkurrenz 1, K0-6), Priorität `validation > ask > background`. Die Queue selbst ist flüchtig (In-Memory); **Absturzsicherheit kommt aus dem Ledger**, nicht aus der Queue — nach einem Neustart rekonstruiert der Hintergrundlauf offene Arbeit aus `fingerprint ≠ lastScan`-Vergleichen. Kein neues Framework, ein schlichtes Array + Timer im Composition-Root.

**Modulgrenzen (dependency-cruiser):** `conflicts` darf `knowledge-object` **nicht** importieren und umgekehrt nicht. Die Verdrahtung der Trigger lebt im **App-Composition-Root** (`services/app`), der beide kennt: KO-/Validierungs-/Ask-Ereignisse rufen dort `enqueueDetection` auf; der Detektor holt sich KO-Texte über eine **vom App-Root injizierte Lese-Funktion** (`loadParticipantText(kind, refId)`) statt über einen Modul-Import. Gleiches Muster für den Reasoner-Zugriff (injizierter `judge`-Callback auf die vorhandene Provider-Kette). Damit entstehen **keine neuen Modulkanten**.

### 3.1 Trigger 1 — In der Prüfung/Validierung

- **Auslösepunkt A (früh, empfohlen als Hauptpunkt):** beim **Einreichen** eines Beitrags in die Prüfung (Statuswechsel in die Review-Sicht). Grund: Bis der Prüfer die Karte öffnet, liegt das Ergebnis meist schon vor — der Prüfer sieht erkannte Spannungen **bevor** er entscheidet, ohne auf ein Modell warten zu müssen. Die Eingabe selbst wird nicht blockiert (Vorgabe): Einreichen gelingt sofort, die Prüfung läuft asynchron hinterher.
- **Auslösepunkt B (spät, zusätzlich):** unmittelbar **vor dem Freigeben** (Prüfer öffnet die Entscheidungsansicht): Falls für dieses KO noch ungeprüfte Paare im Ledger stehen (z. B. weil zwischen Einreichen und Prüfung neue KOs validiert wurden), werden sie mit hoher Priorität nachgezogen; die Review-Ansicht zeigt bis dahin ehrlich „Widerspruchs-Prüfung läuft …" statt einer falschen Entwarnung.
- **Umfang:** geprüft wird der eingereichte Beitrag gegen den **validierten Bestand + aktuell in Prüfung befindliche** Beiträge (dort entstehen die teuersten Kollisionen), per Kandidaten-Vorauswahl gedeckelt.
- **UI-Wirkung:** Im Prüf-Kontext erscheint eine Karte „Mögliche Widersprüche (N)" mit den automatisch angelegten Konflikten; ohne Befund: „Keine Widersprüche zum geprüften Bestand erkannt (Stand: …)" — eine ehrliche Aussage mit Zeitstempel, nie ein absolutes „konfliktfrei".

### 3.2 Trigger 2 — Beim Fragen

- **Sofort (synchron, 0 ms Modell-Latenz):** Die Antwort kennzeichnet **bekannte** offene Konflikte der zitierten KOs (vorhandene `conflictImpact`-Ableitung; Ausbau s. Abschnitt 7). Kein Modellaufruf im Antwortpfad — die Antwortzeit der Fragen-Funktion bleibt unangetastet.
- **Nachlaufend (asynchron):** Die zur Antwort herangezogene Top-K-Menge (typisch ≤ 5–10 KOs) wird als Prüfauftrag eingereiht: alle Paare innerhalb dieser Menge, die laut Ledger noch nicht mit aktuellem Stand geprüft sind. Findet das Modell einen Widerspruch, entsteht der Konflikt **Minuten später** automatisch im Board — die *nächste* gleichartige Frage zeigt ihn dann sofort als Kennzeichnung. Begründung: Der Fragen-Trigger ist der präziseste Kandidaten-Filter überhaupt (die Retrieval-Logik hat inhaltliche Nähe schon bewiesen), aber er darf die Antwort nicht verlangsamen.
- **Kennzeichnung in der Antwort** (Vorgabe „erkannt und gekennzeichnet"): Zitierte Quellen mit offenem Wahrheitskonflikt tragen ein sichtbares „⚠ Widerspruch offen (K-…)"; stehen **beide** Seiten eines offenen Wahrheitskonflikts in der Quellenmenge, sagt die Antwort das ausdrücklich („Zu diesem Punkt liegen widersprüchliche gesicherte Aussagen vor — Klärung läuft") statt stillschweigend eine Seite zu bevorzugen.

### 3.3 Trigger 3 — Laufend im Hintergrund

- **Zeitpunkt:** periodischer Lauf im App-Prozess (Config `CONFLICT_SCAN_INTERVAL_MIN`, Default 60 min; zusätzlich täglicher „tiefer" Lauf, Default 03:00 lokale Zeit) — nur wenn der Prozess läuft (Desktop-/Server-Betrieb identisch; kein externer Scheduler, K0-6).
- **Arbeitsvorrat:** „schmutzige" Beiträge zuerst — alle, deren aktueller Fingerprint vom Ledger-Stand abweicht oder die noch nie A-Seite waren. Je Lauf ein **Budget** (Config `CONFLICT_SCAN_PAIR_BUDGET`, Default 50 Modell-Paare), damit ein Lauf nie unbegrenzt Kosten/Last erzeugt; Rest wandert in den nächsten Lauf. Reihenfolge: zuletzt geänderte zuerst (dort ist die Wahrscheinlichkeit neuer Widersprüche am höchsten).
- **Skalierung:** Durch Kandidaten-Vorauswahl ist der Aufwand **O(N·k)** statt O(N²) (k = Kandidaten-Deckel, Default 8). Beta-Größenordnung (einige hundert KOs): Ein Erstlauf über den Gesamtbestand liegt bei wenigen hundert Modell-Paaren — mit dem lokalen Modell (Prüfstand: Ø 1,7 s/Aufgabe, ≈ 0,52 €/1.000) **eine Nacht, Kosten im Cent-Bereich**; mit Cloud-Modell entsprechend Token-Preis, durch das Tagesbudget gedeckelt (`CONFLICT_SCAN_DAILY_MODEL_CAP`, Default 500 Paare/Tag).
- **Transparenz:** Jeder Lauf schreibt `conflicts.scan.completed` (geprüfte Paare, Funde, Dauer, Modus) ins Audit; das Board zeigt „Letzter Hintergrund-Abgleich: … · N Paare · M Funde".

### 3.4 Idempotenz über alle Trigger — eine einzige Anlegestelle

Alle drei Trigger münden in **eine** Funktion:

```
raiseDetected(pair, type, verdict):
  1. pairKey bilden
  2. existiert OFFENER Konflikt mit pairKey?            → Ende (nichts anlegen), Ledger aktualisieren
  3. existiert PairVerdict (none/dismissed) mit IDENTISCHEN Fingerprints? → Ende (Unterdrückung)
  4. Belegzitate wörtlich in beiden Kerntexten enthalten? (G-2-Prüfung)   → sonst VERWERFEN als
     Modell-Halluzination (Audit: verdict discarded, kein Konflikt)
  5. Konflikt anlegen (origin=auto, detector-Metadaten, Board sichtbar),
     PairVerdict{created} schreiben, Audit conflict.auto-created, Benachrichtigung (Abschnitt 7)
```

Schritt 2+3 machen Doppel-Anlegen unmöglich, unabhängig davon, welcher Trigger zuerst feuert oder ob zwei Trigger dasselbe Paar gleichzeitig einreihen (der Ein-Worker serialisiert; die Prüfung liegt zusätzlich **in** der Anlegestelle, nicht nur in der Queue). Schritt 4 überträgt das bewährte Extract-Muster (wörtliche Belegstelle oder gar nicht) auf die Erkennung — die stärkste einzelne Absicherung gegen falsch-positive Modellfantasie.

---

## 4 · Erkennungslogik (Kandidaten, Modell, Unsicherheit)

### 4.1 Stufe 1 — Kandidaten-Vorauswahl (deterministisch, kostenlos)

Bevor irgendein Modell urteilt, wird die Paarmenge hart eingedampft. Für einen Beitrag X werden als Kandidaten betrachtet (Vereinigungsmenge, dann Deckel):

1. **Gleiche Kategorie** oder **überlappende Tags** oder **gleiche Anlage** (`asset`) — die fachliche Nachbarschaft;
2. **Textnähe** über die vorhandene Retrieval-Logik (Keyword-Overlap; im Pg-Betrieb pg_trgm-gestützter Prefilter) auf `title + statement`;
3. **Top-k-Deckel** (Default 8) nach Ähnlichkeits-Score; Ledger filtert bereits Geprüftes mit unveränderten Fingerprints heraus.

Zusätzlich zwei **deterministische Direkt-Erkenner** (ohne Modell, laufen immer — auch ohne konfigurierten KI-Schlüssel):

- **Doppelung:** normalisierter Kerntext-Vergleich (Kleinschreibung, Satzzeichen/Stoppwörter reduziert; Trigram-Ähnlichkeit ≥ 0,9) → legt `duplicate`-Konflikt an (`method: "deterministic"`, confidence 1.0, Zitate = die beiden Kernaussagen selbst).
- **Zeitlich überholt (eng gefasst):** nahezu gleicher Kerntext (≥ 0,8) bei **abweichenden Werten/Zahlen oder jüngerer Version desselben Themas** → Kandidat für `temporal`, wird aber (weil inhaltliches Urteil nötig) **ans Modell** gegeben, wenn eines konfiguriert ist; ohne Modell wird er als `duplicate`-naher Fund NICHT angelegt (ehrliche Grenze, s. 4.4).

### 4.2 Stufe 2 — Modell-Urteil (vorhandene KI, bestätigt)

**Bestätigung der Vorgabe:** Ja — Bedeutungs-Widerspruch ist genuin semantisch; regelbasierte Verfahren erkennen „blau vs. rot" nur bei fast identischem Wortlaut und versagen bei Paraphrasen. Das Sprachmodell über die **vorhandene** Reasoner-Infrastruktur ist der richtige Weg: Es wird als **neuer Task-Einsatz „Konfliktprüfung"** nach dem exakten Muster des `extract`-Tasks integriert (Provider-Kette Cloud → lokal → deterministisch, Task-Zuordnung je Einsatz in der KI-Verwaltung, ModelRun-Protokoll, harte Auflage für den lokalen Weg: `enable_thinking=false` + `<think>`-Filter — die dokumentierte KLLM-61-Regel). **Nichts neu bauen**, nur ein weiteres Task-Profil in der bestehenden Abstraktion.

**Prompt-Vertrag (versioniert, `promptVersion: "kon-v1"`, Temperatur 0):** Eingabe sind die beiden Kerntexte (K0-2) mit neutralen Labels A/B (keine Autoren, keine Trust-Werte — das Modell soll Inhalt vergleichen, nicht Autorität). Erwartete Antwort ist **striktes JSON**:

```
{ "relation": "widerspruch" | "doppelung" | "ueberholt" | "kein_konflikt" | "unsicher",
  "older": "a" | "b" | null,            // nur bei "ueberholt": welcher Stand ist der überholte
  "confidence": 0.0–1.0,
  "begruendung": "EIN Satz.",
  "zitat_a": "wörtliches Zitat aus A",
  "zitat_b": "wörtliches Zitat aus B" }
```

Regeln im Prompt: nur urteilen, was **in den Texten steht** (kein Weltwissen ergänzen); unterschiedlicher Geltungsbereich (andere Anlage/Bedingung explizit im Text) ist **kein** Widerspruch → `kein_konflikt` mit Begründung; im Zweifel `unsicher`. Antworten, die kein gültiges JSON sind oder deren Zitate nicht wörtlich vorkommen (3.4 Schritt 4), werden verworfen und im ModelRun als fehlgeschlagen protokolliert — es entsteht **kein** Konflikt aus kaputten Antworten.

**Schwellen (Config, Startwerte):** angelegt wird bei `widerspruch|doppelung|ueberholt` **und** `confidence ≥ 0.7` (`CONFLICT_MIN_CONFIDENCE`). `unsicher` oder darunter → `PairVerdict{none}` (kein Konflikt, keine Verdachtsliste — Vorgabe 4.2 „kein Verdacht-Zwischenschritt"; das Paar wird bei Inhaltsänderung automatisch neu geprüft). Die Schwelle ist bewusst konservativ: **Präzision vor Vollständigkeit**, weil jeder Fehlalarm menschliche Zeit kostet und das Vertrauen ins Board verbraucht; Vollständigkeit holt der Hintergrundlauf über die Zeit nach.

### 4.3 Falsch-Positive / Falsch-Negative / Reproduzierbarkeit

- **Falsch-positiv:** Ein-Klick-Aktion **„Fehlalarm — kein Widerspruch"** ⚑ am Konflikt (Pflicht-Kurzbegründung optional) → `geloest` mit `resolution.reason="dismissed"`, Audit `conflict.dismissed`, `PairVerdict{dismissed}` unterdrückt die Wiederanlage, **solange beide Inhalte unverändert sind**. Häufung von Fehlalarmen ist sichtbar (Board-Filter „verworfen") und ist das Signal, die Schwelle zu erhöhen oder den Prompt zu schärfen (promptVersion-Bump).
- **Falsch-negativ:** ehrlich benannte Grenze — Erkennung sieht nur Kandidaten der Vorauswahl. Gegenmittel: (1) der Fragen-Trigger prüft genau die Menge, die Nutzer real zusammen abrufen (die relevantesten Paare); (2) der Hintergrundlauf arbeitet den Bestand systematisch ab; (3) **manuelles Anlegen bleibt vollwertig erhalten** — der Mensch ist der letzte Detektor, wie bisher.
- **Reproduzierbarkeit:** Temperatur 0, versionierter Prompt, `detector` speichert Modell + promptVersion + confidence + Zitate + ModelRun-Verweis. Derselbe Fund ist damit später erklärbar („warum wurde das angelegt?") — wichtig für Vertrauen und für die Prüfstand-Erweiterung (9.3).
- **Lokal vs. extern:** über die vorhandene Task-Zuordnung konfigurierbar (Empfehlung: Hintergrundlauf bevorzugt **lokal** — Massenarbeit, Kostendeckel, Datensparsamkeit; Validierungs-/Fragen-Trigger nutzen die jeweils konfigurierte Kette). Keine Kundendaten verlassen das Haus, wenn lokal gewählt ist — die Modellwahl bleibt Betreiberentscheidung (Rahmenbedingung).

### 4.4 Ehrlicher Betrieb ohne Modell

Ist kein Modell konfiguriert (deterministischer Modus), gilt: Doppelungs-Erkennung läuft weiter (deterministisch), **Widerspruchs-/Überholt-Erkennung ist AUS** — und die App **sagt das**: Statuszeile in Board und KI-Verwaltung „Widerspruchs-Erkennung: eingeschränkt (kein KI-Modell verbunden)". Niemals ein regelbasierter Pseudo-Widerspruchs-Detektor, der Genauigkeit vortäuscht (Ehrlichkeit vor Optik).

---

## 5 · Taxonomie & Behandlungs-Lebenszyklus

### 5.1 Konflikt-Typen (Taxonomie — Entscheidung des Beraters)

Das bestehende Enum (`truth|experience|context|temporal|role`) bleibt erhalten (keine Migration, manuelle Anlage unverändert möglich); es kommt **ein** Wert `duplicate` hinzu. Die automatische Erkennung erzeugt **nur drei** Typen — die drei, die ein Modell zuverlässig aus Texten ableiten kann:

| Typ | Bedeutung | Herkunft | Nutzbarkeits-Wirkung (hinweisend) | Passender Umgang (empfohlener Pfad) |
|---|---|---|---|---|
| **`truth` — Widerspruch** | Aussagen schließen einander aus (blau vs. rot) | auto + manuell | **stärkste** Begrenzung: beide Seiten „in Prüfung" statt „gesichert" (bestehende `conflictImpact`-Stufe) | klassisch: ggf. Zweitmeinung → Entscheidung ⚑; danach Re-Validierung des korrigierten KO empfohlen |
| **`duplicate` — Doppelung** (neu) | zwei Beiträge sagen dasselbe | auto (deterministisch + Modell) + manuell | **keine** Begrenzung (nichts ist falsch) — nur Hinweis-Badge | Entscheidung ⚑ „Zusammenführen/eines archivieren/beide behalten (begründet)"; Auflösung dokumentiert die Wahl, ausgeführt wird sie als normale menschliche Bearbeitung |
| **`temporal` — Überholt** | jüngerer Stand ersetzt älteren (Werte/Verfahren geändert) | auto (Modell) + manuell | milder Hinweis am **älteren** Beitrag „möglicherweise überholt" | Re-Validierung/Lebenszyklus des älteren anstoßen ⚑; Auflösung = „aktualisiert/archiviert/beide gültig (Geltungsbereich)" |
| `experience` — Erfahrungs-Differenz | unterschiedliche Erfahrungswerte, beide evtl. kontextgültig | **nur manuell** | leichter Hinweis | Zweitmeinung → Entscheidung, oft „beide mit präzisiertem Geltungsbereich" |
| `context` — Geltungsbereich | scheinbarer Widerspruch, andere Randbedingungen | **nur manuell** (bzw. Ziel einer Umklassifizierung) | leichter Hinweis | Geltungsbereiche präzisieren ⚑ |
| `role` — Zuständigkeits-Sicht | Widerspruch aus Rollen-/Verantwortungsperspektive | **nur manuell** | leichter Hinweis | Klärung durch die zuständige Instanz ⚑ |

**Warum das Modell keine `context`/`experience`/`role`-Konflikte anlegt:** Diese Unterscheidungen verlangen Wissen über den Betrieb, das nicht im Text steht — genau die Fälle, in denen Modelle raten würden. Stattdessen: Das Modell meldet den Fund als `truth`, und der Mensch kann ihn per leichter Aktion **umklassifizieren** (`conflict.reclassified`, Audit) — z. B. „das ist kein Wahrheits-, sondern ein Geltungsbereichs-Konflikt". Umklassifizieren ändert Typ + Nutzbarkeits-Wirkung, nie Inhalte.

### 5.2 Aktionen & sprechender Pfad

Statusmenge unverändert; die drei Aktionen bekommen klare Bedeutung, Adressaten und Beschriftung:

- **Zweitmeinung = kollegial (seitlich).** ⚑ Anfragender wählt **eine oder mehrere konkrete Personen** (nie Autor eines Beteiligten); je Person entsteht ein `SecondOpinion{open}` + Eintrag in deren „Meine Aufgaben" + Benachrichtigung. Die Person sieht die Gegenüberstellung und gibt strukturiert Einschätzung (`verdict` + Freitext). Konflikt zeigt alle Meinungen gebündelt. Zweitmeinungen sind **beratend, nicht blockierend**: Entscheiden darf der Entscheider jederzeit; Empfehlung „ab ≥ 1 Antwort" als weicher Hinweis.
  *Beschriftung:* „Kolleg:innen um Einschätzung bitten" / *EN:* „Ask colleagues for their assessment".
- **Eskalieren = nach oben.** ⚑ „Auf dieser Ebene nicht lösbar" → Übergabe an die nächsthöhere Instanz (Adressat = **Instanz/Gruppe**, nicht zwingend Person; optional Person benennen), mit Priorität + Benachrichtigung an diese Instanz + Hervorhebung im Board. Bleibt Wahrheitskonflikten vorbehalten (bestehende Regel — bei den übrigen Typen gibt es fachlich nichts „nach oben" zu heben, sie sind Gestaltungsentscheidungen).
  *Beschriftung:* „An die nächste Instanz übergeben — hier nicht entscheidbar" / *EN:* „Escalate — cannot be decided at this level".
- **Auflösen = entscheiden (dokumentierend).** ⚑ Der Entscheider hält fest: Ergebnis-Kategorie (`A gilt` / `B gilt` / `beide, Geltungsbereich präzisiert` / `beide überarbeiten` / `kein Widerspruch (Fehlalarm)` → mappt auf `decided` bzw. `dismissed`) + Freitext. **Keine automatische Folge** an den KOs; die Auflösung **empfiehlt** die nächsten menschlichen Schritte (Re-Validierung, Überarbeitung, Zusammenführung) als verlinkte Aufgaben.
  *Beschriftung:* „Entscheidung festhalten" / *EN:* „Record the decision".

**Sprechender Pfad im Board** (statt der nackten Statusworte): `offen` → „Neu — bitte ansehen" · `zweitmeinung` → „Einschätzungen angefragt (N offen)" · `eskaliert` → „Bei der nächsten Instanz" · `geloest` → je nach `resolution.reason`: „Entschieden am …" / „Fehlalarm (verworfen)" / „Gegenstandslos — Beteiligter gelöscht" / „Gegenstandslos — Inhalt geändert".

---

## 6 · Integrität bei Löschen/Ändern von Beteiligten (Bug-Fix + Regeln)

**Bug-Ursache (Code):** `Conflict` hält nackte IDs; das Board löst sie live auf und zeigt bei Fehlschlag „Objekt nicht gefunden". Es existiert kein Nachzieh-Mechanismus beim Löschen.

**Regelwerk (verbindlich, alle Pfade idempotent):**

1. **Soft-Delete (Papierkorb) eines Beteiligten** → sofort für **jeden** referenzierenden, nicht-gelösten Konflikt: Beteiligter wird `removed{how:"trashed"}` markiert (Label-Snapshot bleibt — nie wieder „nicht gefunden"); verbleiben **< 2 aktive** Beteiligte → Konflikt `geloest` mit `resolution{reason:"participant_deleted", by:null}`, `closedAt` gesetzt; offene Zweitmeinungen → `cancelled` (Benachrichtigung „hinfällig: Beteiligter entfernt"); Eskalation gilt als beendet; Audit `conflict.auto-resolved` + `conflict.participant-removed`.
2. **„Konfliktfrei"-Markierung:** Bleibt genau **ein** aktiver Beteiligter übrig **und** hängt an ihm kein weiterer offener Konflikt, wird am verbleibenden KO das Ereignis **`ko.conflict-cleared`** geschrieben (History + Audit). Die UI zeigt daraus einen ruhigen Hinweis „Widerspruch entfallen — der andere Beitrag wurde entfernt (Datum)". **Technisch ist das ein Ereignis/abgeleiteter Badge, kein persistiertes Flag und keine `status`/`trust`-Änderung**: Die Nutzbarkeits-Begrenzung entfällt von selbst (sie hing am offenen Konflikt), der Prüf-/Vertrauens-Stand des KO bleibt exakt, wie er war — kein Auto-Trust-Überschreiben. War das KO durch den Wahrheitskonflikt „in Prüfung", bleibt es das, bis ein Mensch re-validiert (Empfehlung wird als Aufgabe verlinkt ⚑).
3. **Wiederherstellung aus dem Papierkorb:** Der Konflikt wird **nicht** automatisch wiedereröffnet. Der Wiederherstellende ⚑ sieht den Hinweis „Dieser Beitrag stand in Konflikt K-… (beendet durch Löschung). Erneut anlegen?" mit Ein-Klick-Neuanlage (neuer Konflikt, Verweis auf den alten; der alte bleibt unverändert Geschichte). Begründung: Eine stille Reaktivierung würde einen ungeprüften Alt-Widerspruch setzen — „nichts gilt ungeprüft". Zusätzlich fängt der Hintergrundlauf den Fall ohnehin ab (wiederhergestellter Inhalt = prüfbarer Fingerprint).
4. **Endgültige Löschung** (Fristablauf/Demo-Purge): dieselbe Routine, `removed{how:"purged"}`; falls Schritt 1 versäumt wurde (Altbestand), greift sie hier nach. Der geschlossene Konflikt bleibt mit Label-Snapshots vollständig lesbar in History/Audit.
5. **Beitrag in mehreren Konflikten:** Die Routine iteriert über **alle** referenzierenden Konflikte; jeder wird einzeln nach Regel 1–2 behandelt; der „konfliktfrei"-Hinweis prüft je Rest-KO die Gesamtlage (Regel 2, zweite Bedingung).
6. **„Bearbeitet statt gelöscht":** **keine** automatische Auflösung (das System kann Bedeutungs-Entfall nicht sicher beurteilen — derselbe Grund, aus dem es anlegt, aber nicht entscheidet). Stattdessen zweigleisig: (a) Am Konflikt erscheint der Hinweis „Beteiligter wurde seit Anlage bearbeitet — Widerspruch noch aktuell?" mit Ein-Klick-Angebot ⚑ „Auflösen: Inhalt geändert, kein Widerspruch mehr" (`edited_no_conflict`). (b) Die Bearbeitung ändert den Fingerprint → das Paar wird beim nächsten Trigger **neu geprüft**; urteilt das Modell jetzt `kein_konflikt`, bleibt der offene Konflikt trotzdem bestehen (nur Mensch schließt), aber der Hinweis aus (a) wird um „Automatische Neuprüfung fand keinen Widerspruch mehr" ergänzt — die Entscheidung ist damit trivial, bleibt aber menschlich.
7. **Kommentar als Beteiligter:** identische Regeln; „gelöscht" heißt hier Kommentar entfernt bzw. Träger-KO getrasht (dann entfallen alle seine Kommentar-Beteiligungen mit).

**Verdrahtung ohne Modulkanten-Bruch:** Das KO-Modul ruft **nicht** `conflicts` auf. Der App-Composition-Root reagiert auf Trash/Purge/Restore (an genau den Stellen, an denen SCRUM-420 die Geister-Karten der Re-Validierung heilt — dasselbe bewährte Muster) und ruft `conflicts.onParticipantRemoved(kind, refId, how)` bzw. `onParticipantRestored(...)` auf.

---

## 7 · Wechselwirkungen & UI-Konsequenzen

**Validierung:** Review-Ansicht zeigt die Karte „Mögliche Widersprüche (N)" (3.1) mit Gegenüberstellung und Direktlink; ein offener Wahrheitskonflikt am geprüften KO ist für den Prüfer unübersehbar, blockiert aber nicht technisch (der Prüfer kann bewusst „trotzdem freigeben" — dokumentiert im Audit ⚑).

**Fragen:** Kennzeichnung zitierten Wissens mit offenem Konflikt (3.2); beidseitige Zitate eines offenen Wahrheitskonflikts werden ausdrücklich benannt; keine Modell-Latenz im Antwortpfad.

**Board:** (1) **Herkunfts-Badge** „Automatisch erkannt · Modell X · Sicherheit 82 %" bzw. „Manuell angelegt von …"; aufklappbar: Begründungssatz + die beiden wörtlichen Zitate (die Gegenüberstellung zeigt damit *warum*, nicht nur *dass*). (2) **Ein-Klick „Fehlalarm"** prominent bei `origin=auto`. (3) **Keine Fehler-Karten:** entfernte Beteiligte erscheinen ausgegraut mit Label-Snapshot + „entfernt am …". (4) **Bündelung:** je Beitrag eine Zeile „In N Konflikten" mit Aufklappliste (KO-Detail identisch). (5) **Filter:** Typ · Status · Herkunft (auto/manuell) · „nur Fehlalarme". (6) Kopfzeile: letzter Hintergrundlauf (3.3). (7) Sprechender Pfad (5.2). Alle Texte DE/EN.

**KI-Verwaltung (Admin):** neuer Einsatz „Konfliktprüfung" in der bestehenden Task-Zuordnung (Cloud/lokal/aus), Schwellen- und Budget-Werte als Einstellungen, Statuszeile inkl. „eingeschränkt ohne Modell" (4.4), Zähler „Modell-Paare heute / Budget".

**Benachrichtigungen** (vorhandener Feed): automatisch angelegter Konflikt → Autoren der Beteiligten + Konfliktentscheider-Instanz ⚑; Zweitmeinungs-Anfrage → die gewählte Person; Eskalation → Ziel-Instanz; Auflösung/Fehlalarm/Auto-Auflösung → Ersteller, beteiligte Autoren, Meinungsgeber.

**Audit:** jedes Ereignis aus dem Vokabular (2.4), append-only; automatische Vorgänge sind dadurch genauso lückenlos nachvollziehbar wie menschliche.

---

## 8 · Migration & Bestand

1. **Verwaiste Konflikte bereinigen (einmalig, idempotent):** Lauf über alle nicht-gelösten Konflikte; Referenzen auf fehlende/getrashte Beiträge → Regel-6-Routine (`participant_deleted`, `note:"Bestandsbereinigung 2026-07"`). Bis der Lauf gelaufen ist, rendert das Board fehlende Beteiligte bereits defensiv als „entfernt" (Anzeige-Fallback), nie als Fehler.
2. **Alt-Konflikte anreichern:** `participants` aus `koA/koB` ableiten (Lese-Adapter sofort; physisches Nachschreiben im selben Bereinigungslauf), `origin:"manual"` setzen, `pairKey` berechnen; Alt-`secondOpinion`-Freitext bleibt als historische Notiz sichtbar.
3. **Erstlauf der Hintergrund-Erkennung:** bewusst gestuft, damit das Board nicht über Nacht „explodiert": **Phase 1** nur deterministische Doppelungs-Erkennung über den Gesamtbestand (billig, präzise) → Pedi sichtet das Ergebnis; **Phase 2** Modell-Widerspruchsprüfung unter Tagesbudget, Kategorie für Kategorie, beginnend mit der aktivsten. Fortschritt und Funde je Lauf im Audit + Board-Kopfzeile. Abnahme-Hinweis an den Betreiber: Der Erstlauf ist ein *Befund über den Bestand*, keine Fehlfunktion — viele Funde sind hier ein gutes Zeichen.
4. **Ledger-Aufbau:** Fingerprints aller Beiträge werden beim Erstlauf initial geschrieben; danach inkrementell bei jeder Bearbeitung (Hook im Composition-Root am Ende der KO-/Kommentar-Mutationen).

**Umsetzungs-/Migrationsrisiken:** (a) Die zwei neuen Repos (PairVerdict/ScanEntry, SecondOpinions am Konflikt) müssen in Dev-Persist (`MUTATING_METHODS`) **und** Pg-DDL nachgezogen werden — der bekannte Doppel-Pfad des Projekts; vergessene Einträge = stiller Ledger-Verlust (dann drohen Doppelprüfungen, keine Doppelkonflikte — die verhindert 3.4 unabhängig davon). (b) Modell-`fetch` hat heute keinen Timeout (Audit-Befund) — für den Hintergrundlauf ist ein AbortController-Timeout **Voraussetzung**, sonst kann ein hängender lokaler Server den Worker blockieren. (c) Guard-Matrix: neue Routen (`dismiss`, `reclassify`, `second-opinion`-Anfrage/Antwort, Scan-Status) müssen in `routeGuardAudit` eingetragen werden. (d) `Conflicts.tsx` wächst — neue Logik (Badges, Filter, Fehlalarm) als DOM-freie Lib (`conflictBoard.ts`) nach Projektmuster.

---

## 9 · Test- & Abnahmekriterien („Konflikte werden immer erkannt und richtig behandelt")

### 9.1 Deterministisch prüfbare Kernfälle (Vitest; Modell durch Fake-Client ersetzt, dessen Antworten die Tests vorgeben)

1. **Firmenwagen-Fall (der Maßstab des Auftraggebers):** KO A „Der Firmenwagen ist blau" (validiert) · KO B „Der Firmenwagen ist rot" wird eingereicht → Trigger 1 → genau **ein** `truth`-Konflikt, `origin:auto`, Zitate wörtlich, Board zeigt Gegenüberstellung, Review-Ansicht von B zeigt die Warnkarte, Ask-Antworten mit A oder B tragen die Kennzeichnung.
2. **Idempotenz über Trigger:** derselbe Fund über Trigger 1, dann Trigger 3 (und einmal parallel eingereiht) → weiterhin genau ein offener Konflikt (pairKey-Invariante).
3. **Doppelung deterministisch:** zwei nahezu identische Kernaussagen → `duplicate`-Konflikt **ohne** Modell (auch im modelllosen Modus).
4. **Fehlalarm-Fluss:** auto-Konflikt → „Fehlalarm" ⚑ → `geloest/dismissed` + Audit; erneuter Scan mit unveränderten Fingerprints → **keine** Wiederanlage; Bearbeitung von B (Fingerprint-Änderung) → Paar wieder prüfbar.
5. **Halluzinations-Wächter:** Fake-Modell liefert Zitat, das nicht wörtlich vorkommt → **kein** Konflikt, Vorgang als verworfen protokolliert.
6. **Löschen-Integrität:** offener Konflikt, B in den Papierkorb → Konflikt `geloest/participant_deleted`, offene Zweitmeinung `cancelled`, `ko.conflict-cleared` an A (sofern A keinen weiteren offenen Konflikt hat), Board ohne Fehler-Karte; Wiederherstellung von B → kein Auto-Reopen, Hinweis mit Neuanlage-Angebot vorhanden.
7. **Mehrfach-Konflikte:** A steht in zwei Konflikten (mit B und C); B wird gelöscht → nur Konflikt A–B endet; **kein** `conflict-cleared` an A (A–C ist noch offen).
8. **„Bearbeitet statt gelöscht":** Bearbeitung eines Beteiligten setzt den Konflikt-Hinweis; automatische Neuprüfung `kein_konflikt` ergänzt den Hinweis; der Konflikt bleibt offen, bis ein Mensch `edited_no_conflict` klickt.
9. **Kommentar-Konflikt:** Kommentar an KO X widerspricht KO Y (manuell angelegt) → Beteiligte `{comment}`/`{ko}` korrekt; Löschen des Kommentars → Regel-6-Fluss.
10. **Modellloser Modus ehrlich:** ohne konfiguriertes Modell → Widerspruchs-Erkennung aus + Statuszeile sichtbar; Doppelungs-Fall (3) funktioniert trotzdem.
11. **Budget/Ledger:** unveränderte Paare gehen nicht erneut zum (Fake-)Modell; Pair-Budget pro Lauf wird eingehalten; Lauf-Zusammenfassung im Audit.
12. **Ask-Pfad latenzfrei:** der synchrone Antwortpfad ruft nachweislich kein Modell für die Erkennung auf (Fake-Client-Zähler = 0 im Antwort-Test); Kennzeichnung bekannter Konflikte vorhanden.

### 9.2 Guard-/Vertrags-Tests

Alle neuen Routen in der Guard-Matrix; Vier-Augen an Zweitmeinung/Auflösung serverseitig (Autor eines Beteiligten → 403, deterministisch getestet); Route-Contract für die erweiterten Conflict-Antwortfelder (Alt-Clients mit `koA/koB` bleiben bedient).

### 9.3 Modell-Qualität messbar machen (Prüfstand-Erweiterung)

Der vorhandene Prüfstand (12 deutsche Fälle, 0–2 Punkte, „Ehrlich-passen"-K.-o.) wird um einen Block **KON-1…KON-6** erweitert: klarer Widerspruch (muss erkannt werden) · Paraphrasen-Widerspruch · Geltungsbereichs-Fall (darf **kein** Widerspruch sein) · Doppelung · Überholt-Paar · „unsicher"-Fall (ehrliches `unsicher` ist die richtige Antwort). Damit ist die Erkennungsqualität je Modell (Cloud vs. Qwen3-lokal) **gemessen statt behauptet**, mit derselben Infrastruktur wie bei KLLM-57. **Abnahmeempfehlung:** Erkennung geht erst dann standardmäßig „scharf", wenn das gewählte Modell im KON-Block ≥ 10/12 erreicht und den Geltungsbereichs-Fall nicht reißt.

### 9.4 Abnahme-Formulierung für Pedi (Sichtprüfung)

„Zwei widersprüchliche Aussagen (Firmenwagen blau/rot) einreichen → nach der Einreichung erscheint der Konflikt von selbst im Board, mit Begründung und beiden Zitaten; die Fragen-Funktion kennzeichnet beide Aussagen; Löschen einer der beiden räumt den Konflikt sichtbar und nachvollziehbar auf; ein Fehlalarm lässt sich mit einem Klick begründet schließen und kommt nicht wieder, solange sich nichts ändert."

---

## 10 · Offene Entscheidungen — mit Empfehlung

1. **Cluster (>2 Beteiligte) sofort oder später?** → **Schema jetzt N-fähig, Erstumsetzung paarweise** (Erkennung urteilt ohnehin paarweise; Cluster entstehen später höchstens durch manuelles Hinzufügen). Kein zweiter Modell-Umbau nötig.
2. **Schwelle & Verhalten unter der Schwelle.** → **0.7, `unsicher`/darunter wird still verworfen** (Ledger merkt sich den Stand) — auftragsgemäß kein Verdacht-Zwischenschritt. Alternative (Verdachtsliste) wurde bewusst **nicht** gewählt; sollte die Fehlalarm-Quote im Betrieb unter 0.7 zu hoch sein, ist die Schwelle die einzige Stellschraube, kein Umbau.
3. **Erkennung in der Prüfung: beim Einreichen vs. beim Freigeben.** → **Beides** (3.1): Einreichen als Hauptpunkt (Ergebnis liegt vor, wenn der Prüfer kommt), Freigabe-Moment als Nachzügler-Check mit ehrlichem „läuft noch"-Status.
4. **Hintergrundlauf-Modell.** → **bevorzugt lokal** (Kosten/Datensparsamkeit; Qwen3-32B hat Referenzniveau bewiesen), per Task-Zuordnung jederzeit umstellbar; Cloud-Betrieb durch Tagesbudget gedeckelt.
5. **Duplicate als neuer Typ vs. Wiederverwendung `experience`.** → **Neuer Wert `duplicate`** — Doppelung ist kein Meinungs-, sondern ein Bestands-Zustand; eigene Wirkung (keine Nutzbarkeits-Begrenzung) und eigener Pfad (Zusammenführen) rechtfertigen den einen zusätzlichen Enum-Wert (additiv, alte Daten unberührt).
6. **„Konfliktfrei": Flag am KO vs. Ereignis + abgeleiteter Badge.** → **Ereignis + Ableitung** (6.2): erfüllt die geforderte Markierung sichtbar, ohne ein pflegebedürftiges, trust-nahes Persistenzfeld einzuführen; kollidiert nie mit „kein Auto-Trust-Überschreiben".
7. **Wiederherstellung → Konflikt zurück?** → **Nein, Hinweis + Ein-Klick-Neuanlage** ⚑ (6.3); der Hintergrundlauf ist das Sicherheitsnetz.
8. **Trotzdem-Freigeben bei offenem Wahrheitskonflikt erlauben?** → **Ja, mit ausdrücklichem, auditiertem Bestätigungsschritt** ⚑ — ein hartes Blockieren würde die Konfliktklärung zum Flaschenhals der Validierung machen; die Ehrlichkeit bleibt über Kennzeichnung + Audit gewahrt. (Reines Fluss-Design; wer das darf, regelt das bestehende Rechtemodell.)

---

*Ende des Konzepts. Ein Durchgang, vollständig; alle Unklarheiten als benannte Annahme (Abschnitt 0) oder offene Entscheidung mit Empfehlung (Abschnitt 10) aufgelöst. Ersetzt Block A des Vortags-Konzepts (siehe Kopfnote); Blöcke B–D dort bleiben gültig. Kein Code, keine Tickets, keine Konfiguration verändert.*
