# KLARWERK — Beratungsbericht: Modellunabhängige Wissens- & Gedächtnisschicht („KLARWERK-Gehirn")

*Auftraggeber: Pedi / Klarwerk Master · Ausarbeitung: externer Architektur-/Produktberater (unabhängige Claude-Session) · Stand: 05.07.2026 · Bezug: KLLM-62/60/61, KWN-2/3, SCRUM/KGURU · Referenz: OB1 „Open Brain"*

> **Charakter des Dokuments.** Beratungsbericht mit eigener Position, nicht nur Auftragsabarbeitung — der Auftraggeber hat ausdrücklich um Meinung und Verbesserungsvorschläge gebeten. Ich liefere die sechs geforderten Deliverables (Abschnitte 2–7), beantworte die fünf offenen Fragen (Abschnitt 8), und ergänze eigene Befunde, die im Auftrag noch fehlen (Abschnitt 9 — darunter eine architektonische Falle, die entscheidend ist). OB1 und der Offline-Stack sind am aktuellen Stand (05.07.2026) recherchiert, nicht aus dem Gedächtnis zitiert; Quellen am Ende.
>
> **Kernthese vorab (damit die Richtung klar ist):** KLARWERK sollte das **Muster** von OB1 übernehmen, aber **nicht dessen Codebasis** — und vor allem sollte es sich nicht als „wir bauen ein Gehirn" verstehen, sondern als „wir schließen drei klar benennbare Lücken an einem System, das die schwierigere Hälfte bereits hat". Die eigentliche, wertvolle und projektspezifische Innovation ist nicht der Vektor-Store (den gibt es fertig), sondern der **Regelkreis aus Prüfstand-Fehler → modellunabhängigem Verhaltensartefakt** (Abschnitt 5 des Auftrags). Darauf lege ich den Schwerpunkt.

---

## 1 · Management-Summary (eine halbe Seite, für Pedi)

Das Ziel — Modelle jederzeit wechseln, ohne Wissen zu verlieren — ist richtig und wird mit jedem Modell-Release dringlicher. Die gute Nachricht: KLARWERK ist diesem Ziel **näher als der Auftrag vermutet**. Die *fachliche* Wissensschicht (kuratierte Wissensobjekte, quellenbasiertes Antworten, Trust, Konflikt-/Duplikatstatus, Audit) existiert bereits und ist schon heute modellunabhängig — das ist die schwierige Hälfte, und sie ist gebaut. Was fehlt, sind **drei konkrete, überschaubare Ergänzungen**: (1) ein versionierter Speicher für das *Verhaltenswissen* der KI (System-Prompts, Antwort-Kontrakte, Few-Shot-Beispiele, Guardrails), (2) ein *Interaktionsgedächtnis* mit Herkunft, Löschbarkeit und Vertraulichkeit, und (3) eine *lokale Embedding-Schicht*, die die heutige Stichwortsuche zu echter Bedeutungssuche aufwertet. Das ist kein Plattform-Neubau, sondern ein Anbau an den bestehenden modularen Monolithen.

Mein Rat zur Grundsatzfrage „selbst bauen oder OB1 adaptieren": **Muster adaptieren, Code selbst bauen.** OB1 ist ein exzellenter Ideengeber und bestätigt unseren Architekturansatz, aber sein Code ist an Supabase und Cloud-Edge-Funktionen gekoppelt (genau das, was die Air-Gap-Insel verbietet), steht unter einer Lizenz mit zweijähriger Kommerz-Einschränkung, und würde uns eine generische Version dessen importieren, was wir bereits besser und projektspezifisch haben. Eine Portierung wäre teurer und riskanter als ein schlanker Eigenbau auf unseren vorhandenen Bausteinen.

Die wichtigste einzelne Erkenntnis dieses Berichts, die im Auftrag noch fehlt: **Das Embedding-Modell ist auch ein Modell.** Wenn wir es wechseln, sind alle gespeicherten Vektoren wertlos und müssen neu berechnet werden. Modellunabhängigkeit für das *antwortende* LLM ist einfach; für das *Embedding*-Modell ist sie es nicht. Das muss die Architektur von Anfang an einplanen (Abschnitt 9.1), sonst baut man den Modellwechsel-Schmerz an einer neuen Stelle wieder ein.

Konkret empfehle ich: **sqlite-vec** als Vektor-Store auf der Insel (serverlos, eine Datei, ideal air-gapped) neben **pgvector** zentral (gleiche Logik), **bge-m3** als lokales deutsches Embedding-Modell (~1,4 GB, passt bequem neben den 32B-LLM in 64 GB), und einen **einwöchigen Proof-of-Concept**, der genau das Abnahmekriterium beweist: einen durchgefallenen Prüfstand-Fall über ein Verhaltensartefakt reparieren, das Modell tauschen, und zeigen, dass die Reparatur den Tausch überlebt — offline auf dem Mac Studio. Gesamtaufwand bis zur tragfähigen ersten Version: **grob 20–30 Personentage**, in Phasen lieferbar.

---

## 2 · Deliverable 1 — Bewertungsbericht OB1

**Was OB1 ist (verifiziert, 05.07.2026):** Eine self-hosted Wissens-/Gedächtnisschicht mit Postgres + pgvector als „eine Wahrheit", einem JSON-RPC-Gateway (TypeScript/Node), MCP als Zugriffsschnittstelle für verschiedene KI-Clients, einer Basistabelle `thoughts` (Vektor-Embeddings + Metadaten) und Erweiterungs-Schemata für „Agent Memory" (Provenance-Ketten, Review-Status, Use-Policy, Recall-Traces, Audit-Log) sowie Content-Fingerprint-Dedup. Reifegrad mittel-hoch: ~3.500 Stars, ~350 Commits, aktive Community, gute Doku — aber ausdrücklich Community-Projekt, kein Enterprise-Produkt.

**Passung des Musters zu KLARWERK — hoch.** OB1 validiert unseren Ansatz Punkt für Punkt: Trennung Wissen/Modell, gemeinsamer Store als Wahrheit, Adapter-/Gateway-Muster für austauschbare Modelle, Provenance, Dedup per Fingerprint, MCP als Zugriff. Bemerkenswert: OB1s „Agent Memory"-Schema (Provenance, Review-Status, Use-Policy, Audit) ist fast deckungsgleich mit dem, was KLARWERK für Wissensobjekte bereits hat — das ist eine unabhängige Bestätigung, dass unser Datenmodell in die richtige Richtung zeigt.

**Was konkret wiederverwendbar ist — die Ideen, nicht der Code:**
- Das **`thoughts` + Sidecar-Schema-Muster** (eine schlanke Kern-Entität, spezialisierte Erweiterungstabellen daneben) ist ein gutes Vorbild für unsere Interaktionsgedächtnis-Schicht (Abschnitt 4.3).
- Der **Fingerprint-Dedup**-Ansatz deckt sich exakt mit dem, was wir im Duplikat-Konzept bereits entworfen haben — kein Neuland, aber eine Bestätigung.
- Die **Recall-Traces** (nachvollziehen, welche Erinnerung wann eine Antwort beeinflusst hat) sind eine Idee, die wir übernehmen sollten — sie ist die „nichts gilt ungeprüft"-Disziplin, angewandt auf das Gedächtnis.

**Was ersetzt werden muss (die Air-Gap-Lücke — verifiziert):**
- OB1 setzt primär auf **Supabase** (gehostetes Postgres + Edge Functions) und Cloud-Frontend-Hosting (Vercel/Netlify); Capture-Integrationen für Slack/Discord. **Alles davon ist auf der Insel unzulässig** (Air-Gap). Es gibt zwar eine self-hosted-Kubernetes-Alternative, aber Kubernetes auf einem Einzel-Mac-Studio ist massiv überdimensioniert.
- OB1 erzeugt **Embeddings über Cloud-APIs** (Claude/OpenAI in den Importen). Das ist auf der Insel ausgeschlossen — wir brauchen ein **lokales** Embedding-Modell. Genau die Lücke, die der Auftrag benennt.
- Das JSON-RPC-Gateway ist generisch; unser **Provider-Konzept (KLLM-61)** ist bereits das, was das Gateway leisten soll, plus deterministischer Fallback und ehrliche Modus-Kennzeichnung — spezifischer und besser auf unsere Ehrlichkeits-DNA zugeschnitten.

**Lizenz — wichtiger Hinweis, bitte ernst nehmen:** OB1 steht unter **FSL-1.1-MIT** (Functional Source License). Das ist **keine** klassische MIT-Lizenz: FSL erlaubt Nutzung/Änderung, **verbietet aber für zwei Jahre die Verwendung in einem konkurrierenden kommerziellen Produkt**; erst nach zwei Jahren fällt der jeweilige Release auf MIT zurück. Für KLARWERK — ein kommerzielles Wissensmanagement-Produkt — ist das ein realer Stolperstein, falls OB1-Code direkt übernommen würde: Man müsste je Codeteil prüfen, ob er älter als zwei Jahre ist (dann MIT) oder nicht (dann FSL-eingeschränkt). Das ist ein **weiterer, unabhängiger Grund**, OB1 als Ideengeber statt als Codelieferant zu behandeln: Die *Konzepte* sind frei nutzbar (Ideen sind nicht lizenzierbar), der *Code* trägt eine Einschränkung, die genau unser Geschäftsmodell berührt. — *Hinweis: Lizenzfragen mit kommerzieller Tragweite sollte vor einer Code-Übernahme ein Jurist bestätigen; ich bin kein Anwalt und beschreibe nur den dokumentierten Lizenztext.*

**Aufwand Portierung vs. Eigenbau — meine Schätzung:**
- *Air-Gap-Portierung von OB1:* Supabase entfernen, Edge-Functions durch lokale Dienste ersetzen, Cloud-Embeddings durch lokale ersetzen, Cloud-Capture entfernen, Lizenz je Modul prüfen, das Ganze an unser bestehendes KO-/Provider-/Audit-Modell **anschließen statt daneben stellen** — grob 25–40 PT, mit dem Risiko, am Ende zwei überlappende Wissens-Datenmodelle zu haben (OB1s `thoughts` **und** unsere KOs).
- *Eigenbau auf Bestand:* die drei Lücken (Verhaltensartefakte, Interaktionsgedächtnis, lokale Embeddings) als Anbau an den Monolithen — grob 20–30 PT, ohne Datenmodell-Dopplung, ohne Lizenzfrage, mit voller Passung zur Ehrlichkeits-/Trust-/Audit-Logik.

**Fazit OB1:** Als **Blaupause hervorragend** — es zeigt, dass das Muster trägt, und liefert konkrete Detail-Ideen (Sidecar-Schema, Recall-Traces, Fingerprint-Dedup). Als **Codebasis für die Insel ungeeignet** (Cloud-Kopplung) und **lizenzrechtlich heikel** (FSL) für ein Konkurrenzprodukt. → **Adopt the pattern, build the code.**

---

## 3 · Deliverable 2 — Zielarchitektur (Insel + zentral)

### 3.1 Das mentale Modell: drei Schichten, ein Träger, austauschbare Modelle

```
        ┌──────────────────────────────────────────────────────────┐
        │   ANTWORTENDES LLM (austauschbar):                        │
        │   Ollama/MLX (Insel)  ·  Claude/ChatGPT/Gemini (zentral)  │
        └───────────────▲──────────────────────────────────────────┘
                        │  Provider-/Gateway-Schicht (KLLM-61) — schon vorhanden
        ┌───────────────┴──────────────────────────────────────────┐
        │   KLARWERK-GEHIRN (modellunabhängig, lebt NEBEN dem Modell)│
        │                                                            │
        │  Schicht 1 · FACHWISSEN     Wissensobjekte, Belegstellen,  │
        │     (vorhanden, härten)     Trust, Konflikt/Duplikat, Audit│
        │                                                            │
        │  Schicht 2 · VERHALTEN      Prompts, Antwort-Kontrakte,    │
        │     (NEU — Kern-IP)         Few-Shot, Guardrails, je Task, │
        │                             versioniert, Prüfstand-gekoppelt│
        │                                                            │
        │  Schicht 3 · GEDÄCHTNIS     frühere Q&A, Präferenzen,      │
        │     (NEU)                   Kontext; Provenance/Retention/  │
        │                             Vertraulichkeit; Stufe 2       │
        │                                                            │
        │  Quer:  EMBEDDING-SCHICHT (lokal, bge-m3) + Vektor-Store   │
        │         (Insel: sqlite-vec · zentral: pgvector)           │
        │  Quer:  PROVENANCE · REVIEW · AUDIT · Vertraulichkeit      │
        └────────────────────────────────────────────────────────────┘
                        ▲
                        │  Signierter USB-Sync (KWN-3), gerichtet je Schicht
        ┌───────────────┴──────────────┐        ┌──────────────────────┐
        │  INSEL (air-gapped Mac Studio)│◄──USB──►│  ZENTRAL (Server)    │
        └───────────────────────────────┘        └──────────────────────┘
```

**Leitprinzip:** Modell oben, Wissen unten, klare Naht dazwischen. Der Modellwechsel berührt **nur** die oberste Schicht (Provider-Konfiguration). Alle drei Wissensschichten bleiben unangetastet. Das ist die konkrete Bedeutung von „Wissen lebt neben dem Modell".

### 3.2 Warum getrennte Vektor-Stores je Betriebsort (wichtige Empfehlung)

Der Auftrag lässt die Wahl offen (pgvector oder eingebettet). Meine klare Empfehlung: **je Betriebsort das passende, aber eine gemeinsame logische Schema-Definition.**

- **Insel: `sqlite-vec`.** Die Insel ist ein Einzel-Rechner ohne Betriebspersonal, air-gapped, das die VIP selbst bedient. Ein Postgres-Server dort ist Betriebslast ohne Gegenwert (Prozess-Management, Backups, Port, Neustart-Verhalten). sqlite-vec ist eine **einzelne Datei ohne Server** — ideal für Backup (kopieren), Signatur (hashen), USB-Transport (mitnehmen) und Air-Gap (nichts lauscht auf einem Port). Es läuft nativ auf Apple Silicon, ist ausgereift und für Bestände dieser Größenordnung (einige tausend bis zehntausende Einträge) mehr als schnell genug. Genau das Profil der Insel.
- **Zentral: `pgvector`.** Der zentrale Betrieb hat ohnehin Postgres (die App nutzt es), Mehrbenutzer, Skalierung, echtes Ops. Dort ist pgvector die richtige Wahl und deckt sich mit OB1.
- **Eine Schema-Definition, zwei Backends.** Die Vektor-Logik wird hinter ein schmales Repo-Interface gelegt (wie bei KLARWERK üblich: In-Memory/Pg-Adapter — hier sqlite-vec/pgvector-Adapter). Die Anwendung sieht nur „speichere/suche Vektor", nicht das Backend. Das ist exakt das bestehende KLARWERK-Muster und hält den Code an beiden Orten identisch.

Das beantwortet zugleich einen praktischen Air-Gap-Vorteil: Ein sqlite-vec-Store **ist** das Transport-Artefakt für den USB-Sync — es gibt keinen Export-Schritt, die Datei selbst wandert (signiert).

### 3.3 Embedding-Schicht (lokal, deutsch): Empfehlung bge-m3

Verifizierte Optionen für Apple Silicon neben einem lokalen 32B-LLM in 64 GB:

| Modell | Größe (RAM) | Deutsch-Qualität | Besonderheit | Eignung Insel |
|---|---|---|---|---|
| **bge-m3** (568M) | ~1,4 GB (fp16) / 0,7 GB (Q8) | stark (nDCG ~49,6) | liefert dense **und** sparse Vektoren in einem Durchgang; 8K Kontext | **empfohlen** — Sweet Spot |
| Qwen3-Embedding-8B | 9–18 GB | höchste (~56) | 32K Kontext | zu schwer neben 32B-LLM in 64 GB |
| nomic-embed-v2 (137M) | ~0,4 GB | schwach für Deutsch (~42) | sehr schnell, englischlastig | nur wenn Deutsch zweitrangig — hier nicht |

**Empfehlung bge-m3.** Es ist der beste Kompromiss aus deutscher Retrieval-Qualität, RAM-Budget (bequem neben dem lokalen LLM) und einem echten Zusatznutzen: Es liefert in einem Durchgang **dense + sparse** Vektoren — das erlaubt hybride Suche (Bedeutung *und* exakte Begriffe/Kennungen wie „F3", „6 bar", „KO-7"), was für Fachwissen mit vielen Codes/Werten genau richtig ist (reine Bedeutungssuche verliert Kennungen, reine Stichwortsuche verliert Paraphrasen — bge-m3 kann beides). Qwen3-Embedding wäre qualitativ besser, ist aber mit 9–18 GB neben dem 32B-LLM in 64 GB zu eng; wenn die Insel später auf ein 128-GB-Modell aufrüstet, ist ein Upgrade eine bewusste, versionierte Entscheidung (siehe die Embedding-Falle, 9.1).

### 3.4 Andocken an Bestehendes (nicht duplizieren)

- **Schicht 1** ist die vorhandene KO-Wissensbasis + Ask-Retrieval (SCRUM/KGURU). Die Embedding-Schicht wertet das *Retrieval* auf (Bedeutungssuche statt nur Stichwort — die seit dem Ist-Dossier bekannte Lücke), ohne das KO-Datenmodell zu ändern: Der Vektor-Index ist ein *zusätzlicher* Zugriffsweg auf dieselben KOs, kein zweiter Speicher.
- **Provider-/Gateway-Schicht** ist KLLM-61. Das „AI-Gateway" aus OB1 bauen wir **nicht** neu — es existiert. Die Verhaltensschicht (2) speist nur ihre Artefakte in die vorhandene Provider-Aufruf-Kette ein.
- **Audit/Provenance/Vertraulichkeit** sind vorhandene Querschnitts-Mechanismen (append-only Audit, Provenienz an KOs, SCRUM-415-Vertraulichkeit). Schichten 2 und 3 nutzen sie, statt eigene zu erfinden.

---

## 4 · Datenmodell der drei Schichten

Gemeinsame Provenance-/Trust-Logik über alle drei, ohne die bestehende KO-Struktur zu brechen (beantwortet offene Frage 2). Jeder Eintrag jeder Schicht trägt denselben Herkunfts-Kern:

```
interface Provenienz {
  quelle: "kurator" | "auto" | "pruefstand" | "nutzer" | "import"
  erstelltVon: string; erstelltAm: string
  reviewStatus: "entwurf" | "geprueft" | "freigegeben" | "verworfen"
  vertraulichkeit: "oeffentlich" | "intern" | "vertraulich"   // SCRUM-415
  audit: AuditRef[]                                            // append-only
  fingerprint: string                                          // Dedup (Duplikat-Konzept)
}
```

### 4.1 Schicht 1 — Fachwissen (vorhanden, härten)
Bleibt das KO-Modell (Titel, Aussage, Bedingungen, Maßnahmen, Belegstellen, Trust, Konflikt-/Duplikatstatus, Version, Historie, Snapshots). **Härtung für Portabilität:** ein versioniertes, vollständiges **Export-/Import-Format** (JSON-Bundle mit KOs + Evidence + Snapshots + Provenance + Vektoren-optional), das der USB-Sync transportiert. Der Vektor-Index wird beim Import **neu berechnet oder mitgeliefert** (abhängig von der Embedding-Version, 9.1). Das ist überschaubar — die Struktur existiert, es fehlt nur das saubere, signierbare Bündelformat.

### 4.2 Schicht 2 — Verhaltensartefakte (NEU, die Kern-Innovation)
Modellunabhängige, versionierte Artefakte, organisiert **pro Aufgabentyp** (structure, extract, answer, interview, assist, select, **conflict, dedupe**):

```
type ArtefaktArt = "system_prompt" | "antwort_kontrakt" | "few_shot" | "guardrail"
interface Verhaltensartefakt {
  id: string
  task: TaskId                         // die 8 Aufgaben
  art: ArtefaktArt
  version: number                      // semantisch versioniert; alte bleiben lesbar
  inhalt: string                       // der Prompt-Baustein / das Beispiel / die Regel
  sprache: "de" | "en" | "neutral"
  aktiv: boolean                       // nur aktive werden injiziert
  herkunftsfall?: string               // NEU: bei guardrail → die Prüfstand-Fall-ID, die ihn auslöste
  wirksamAb?: string                   // Modell-/Datumsbindung optional
  belegMessung?: { vorher: number; nachher: number; pruefstandVersion: string }  // Wirkungsnachweis
  provenienz: Provenienz
}
```

**Warum das der eigentliche Wert ist:** Heute steckt „wie antworte ich richtig" halb im Modell, halb in handgepflegten Prompts. Dieses Modell macht daraus **Daten mit Herkunft und Wirkungsnachweis**. Ein Guardrail ist nicht mehr „irgendwann in den Prompt geschrieben", sondern „entstanden aus Prüfstand-Fall KON-5, hob dort die Punktzahl von 1 auf 2, gilt für alle Modelle". Beim Modellwechsel wandern diese Artefakte unverändert mit — das ist die technische Substanz des Versprechens „Verbesserung überlebt den Wechsel". Der Zusammenbau des tatsächlichen Prompts je Aufruf (System-Prompt + aktive Guardrails + passende Few-Shots) ist eine reine Funktion über die aktiven Artefakte — deterministisch, testbar, versioniert.

### 4.3 Schicht 3 — Interaktionsgedächtnis (NEU, mit Vorsicht)
Nach dem OB1-`thoughts`-Muster, aber mit KLARWERK-Ehrlichkeitsdisziplin:

```
interface Gedaechtniseintrag {
  id: string
  art: "frage_antwort" | "praeferenz" | "kontext"
  inhalt: string
  vektor: number[]                     // für semantischen Recall
  bezugKO?: string[]                   // welche KOs waren beteiligt
  provenienz: Provenienz               // inkl. Vertraulichkeit + reviewStatus
  recallTraces: { verwendetAm: string; inAntwort: string }[]   // OB1-Idee: nachvollziehen, wann es wirkte
  verfallAm?: string                   // Retention
}
```

**Meine ausdrückliche Warnung (und Designentscheidung):** Ein Interaktionsgedächtnis, das ungeprüft in Antworten zurückfließt, ist ein stiller Halluzinations- und Datenschutz-Kanal — es widerspräche „nichts gilt ungeprüft", wenn eine frühere, unbelegte Antwort später als Quelle behandelt würde. Deshalb: **Schicht 3 ist Stufe 2, nie Stufe 1.** Gedächtnis darf Antworten *kontextualisieren* („du hattest zu diesem Thema schon gefragt …") und das Retrieval *priorisieren*, aber es ist **nie eine zitierfähige Quelle** — Quellen bleiben ausschließlich validierte KOs. Jeder Eintrag ist herkunftsmarkiert, vertraulichkeits-klassifiziert, einzeln löschbar und mit Verfallsdatum. Die `recallTraces` machen sichtbar, wann eine Erinnerung eine Antwort beeinflusst hat — das ist die Prüfbarkeit, die diese Schicht überhaupt erst verantwortbar macht. **Default auf der Insel: Interaktionsgedächtnis bleibt lokal und wird nicht per USB synchronisiert** (Datenschutz, 6.3/8.3).

---

## 5 · Deliverable 4 — Nachbesserungs-/Regelkreis (der wichtigste Teil)

Das ist die Stelle, an der KLARWERK etwas baut, das über OB1 hinausgeht und projektspezifisch wertvoll ist: ein geschlossener Kreislauf, der Prüfstand-Schwächen in modellunabhängige Verbesserungen verwandelt.

### 5.1 Der Kreislauf konkret

```
1. MESSEN      Prüfstand läuft (KWN-2, 53 Fälle) je Modell → Fall fällt durch (0/1 Punkt)
2. KLASSIFIZIEREN  Ursache bestimmen (halbautomatisch, Abschnitt 5.2):
                   Wissenslücke? · Format/Kontrakt? · fehlendes Beispiel? · echte Modellschwäche?
3. NACHBESSERN  auf der billigsten wirksamen Ebene (Auftrag Abschnitt 7, Reihenfolge 1→5):
                   1) KO ergänzen (Wissenslücke)           → Schicht 1
                   2) Antwort-Kontrakt/System-Prompt schärfen → Schicht 2 (art=antwort_kontrakt/system_prompt)
                   3) Few-Shot-Beispiel aus einem BESTANDENEN Fall → Schicht 2 (art=few_shot)
                   4) Guardrail/Negativbeispiel aus dem DURCHGEFALLENEN Fall → Schicht 2 (art=guardrail, herkunftsfall gesetzt)
                   5) NUR als Ausnahme: LoRA/Fine-Tuning (modellspezifisch, getrennt versioniert)
4. ERNEUT MESSEN  Prüfstand-Delta: derselbe Fall jetzt 2 Punkte? belegMessung am Artefakt speichern
5. DOKUMENTIEREN  in Bestenliste/Bereichs-Auswertung; Artefakt aktiv schalten
6. GEGEN-REGRESSION  Prüfstand als Ganzes erneut → das neue Artefakt darf keinen anderen Fall verschlechtern
```

Schritt 6 ist meine Ergänzung (im Auftrag nicht genannt, aber essenziell): Ein Guardrail, der KON-5 rettet, aber ANT-3 bricht, ist kein Fortschritt. Der Prüfstand ist dafür schon da — er muss nur als **Regressions-Gate** verstanden werden, nicht nur als Momentaufnahme.

### 5.2 Ursachen-Klassifizierung (halbautomatisch)
Der Prüfstand weiß bei jedem Fehler bereits viel: Welche `checks` fielen? `json:false` → Format/Kontrakt (Ebene 2). `belegstelleImText:false` → das Modell erfindet Zitate → Guardrail (Ebene 4). `ehrlichUnwissend`/`ehrlichLeer` gerissen → Ehrlichkeits-Schwäche → schärferer Kontrakt (Ebene 2) + Negativbeispiel (Ebene 4). `enthaelt` eines Fakts fehlt, obwohl er im Kontext stand → Modellschwäche (Few-Shot, Ebene 3); fehlt der Fakt, weil er *nirgends* steht → Wissenslücke (Ebene 1). Diese Zuordnung lässt sich zu ~80 % aus dem Check-Typ **automatisch vorschlagen**; die letzte Entscheidung trifft ein Mensch ⚑. Das macht den Rückfluss (die im Auftrag geforderte Systematisierung) real automatisierbar.

### 5.3 Format der Artefakte (beantwortet offene Frage 4)
Genau das Schema aus 4.2. Entscheidend für Modellunabhängigkeit: Artefakte sind **datengetriebene Bausteine**, kein je Modell handgeschriebener Monolith-Prompt. Der finale Prompt entsteht zur Laufzeit aus `systemPrompt(task) + aktive Guardrails(task) + top-N Few-Shots(task)`. Beim Modellwechsel ändert sich **nichts** an den Artefakten; höchstens die *Auswahl-Parameter* (ein schwächeres Modell bekommt mehr Few-Shots, ein starkes weniger — auch das eine Konfig, kein Umschreiben). Versionierung semantisch; alte Versionen bleiben für Reproduzierbarkeit lesbar; `belegMessung` dokumentiert die Wirkung je Prüfstand-Version.

### 5.4 Meine Zusatzidee: Few-Shots automatisch aus dem Prüfstand ziehen
Der Prüfstand hat **bestandene** Fälle (2 Punkte) — das sind per Definition Musterlösungen. Statt Few-Shots von Hand zu pflegen, kann der Regelkreis sie **automatisch aus bestandenen Fällen desselben Task** vorschlagen (Eingabe → ideale Antwort). Damit wird der Prüfstand nicht nur Fehlerquelle (Ebene 4), sondern auch Vorbildquelle (Ebene 3) — er füttert beide Nachbesserungs-Ebenen aus sich selbst.

---

## 6 · Deliverable 3 — Sicherheit, Governance & Sync

### 6.1 Sicherheit (KLARWERK-Regeln, verbindlich)
Keys ausschließlich macOS-Schlüsselbund; keine Secrets in Dateien/Repos/Logs. Auf der Insel **kein Datenabfluss**: Embedding und LLM laufen rein lokal, der Vektor-Store ist eine lokale Datei, kein Dienst lauscht nach außen. Cloud-Modelle nur außerhalb der Insel, über die bestehende Provider-Konfiguration. Der lokale LLM-Endpunkt bleibt localhost-gebunden (bestehende Tunnel-Regel).

### 6.2 Governance
Jeder Eintrag jeder Schicht trägt Provenance, Review-Status, Vertraulichkeit (SCRUM-415), Löschbarkeit und Audit — das gemeinsame `Provenienz`-Objekt (Abschnitt 4). Für die Verhaltensschicht heißt „freigegeben": ein Artefakt wird erst injiziert, wenn es Review-Status `freigegeben` hat **und** das Prüfstand-Regressions-Gate (5.1 Schritt 6) grün ist. Für das Gedächtnis: einzeln löschbar, vertraulichkeits-klassifiziert, nie zitierfähig (4.3).

### 6.3 Sync Insel ↔ Zentral (signiertes USB-Paket, KWN-3) — gerichtet je Schicht
Der häufigste Fehler bei solchen Syncs ist „ein Topf, last-writer-wins". Das ist hier falsch, weil die drei Schichten **verschiedene Flussrichtungen und Vertraulichkeiten** haben. Mein Vorschlag (beantwortet offene Frage 3):

| Schicht | Standard-Richtung | Konfliktregel | Löschungen |
|---|---|---|---|
| **1 · Fachwissen** | bidirektional, review-gated | KO-Version + Trust entscheiden; bei echtem Inhalts-Konflikt → **Konflikt-/Duplikat-Mechanismus** (unsere vorhandene Logik!), kein stilles Überschreiben | als **Tombstone** übertragen (nie „fehlt = behalten"), Endlöschung beidseitig nach Regel |
| **2 · Verhalten** | **zentral → Insel** (kuratiert, meist Einbahn) | Zentral ist die kuratierende Instanz; Insel-lokale Guardrails aus Insel-Prüfstandläufen wandern als Vorschlag zurück ⚑ | Deaktivieren statt löschen (Artefakt-Historie bleibt) |
| **3 · Gedächtnis** | **bleibt Insel-lokal** (Default kein Sync) | entfällt (kein Sync) — Datenschutz; optionaler, ausdrücklich freigegebener Export einzelner Einträge | lokal löschbar; kein Abfluss |

**Transport-Integrität:** Das USB-Bundle ist ein signiertes Archiv (Hash je Datei + Gesamt-Signatur; Schlüssel im Schlüsselbund, nie im Bundle). Beim Import: Signatur prüfen → bei Bruch **komplett ablehnen**, nie teilweise einspielen. Das Bundle enthält je Schicht ein versioniertes Manifest (welche Versionen, welche Embedding-Version — kritisch, 9.1). Richtung und Inhalt sind vor dem Einspielen sichtbar (die VIP sieht, *was* kommt), bevor sie bestätigt ⚑ — dasselbe Ehrlichkeitsprinzip wie bei den Schreibtisch-Apps.

---

## 7 · Deliverable 5+6 — Make-or-Adopt-Empfehlung, Phasenplan, PoC

### 7.1 Empfehlung: Eigenbau auf Bestand, Muster von OB1
Begründung gebündelt: (a) die schwierige Hälfte (Fachwissen + Retrieval + Trust + Audit) existiert; (b) OB1s Code ist Cloud-gekoppelt und für die Insel unbrauchbar; (c) FSL-Lizenz berührt unser kommerzielles Modell; (d) eine Portierung riskiert doppelte Wissens-Datenmodelle; (e) der eigentliche Wert (Verhaltens-Regelkreis) ist ohnehin projektspezifisch und in OB1 nicht enthalten. **Kosten des Eigenbaus liegen unter denen der Portierung, bei geringerem Risiko und voller Passung.**

### 7.2 Phasenplan (grob, in lieferbaren Scheiben)

| Phase | Inhalt | Aufwand | Ergebnis |
|---|---|---|---|
| **0 · PoC** (7.3) | Verhaltensartefakt-Store minimal + 1 Task + 1 Prüfstand-Fix + Modelltausch offline | 3–5 PT | Beweis: Fix überlebt Modellwechsel, offline |
| **1 · Verhaltensschicht** | Artefakt-Schema, Prompt-Zusammenbau, Regelkreis-Anbindung an Prüfstand, Regressions-Gate | 6–8 PT | Schwächen modellunabhängig schließbar (Abnahme 3) |
| **2 · Embedding + Vektor** | bge-m3 lokal, sqlite-vec-Adapter, Ask-Retrieval auf hybride Suche heben, Embedding-Versionierung (9.1) | 6–8 PT | echte Bedeutungssuche, offline; bessere Antworten/Auswahl für jedes Modell |
| **3 · Sync + Governance** | signiertes USB-Bundle je Schicht, gerichtete Regeln, Tombstones, Manifest inkl. Embedding-Version | 4–6 PT | kontrollierter Insel-Abgleich (Abnahme 4/5) |
| **4 · Gedächtnis** | Schicht 3 (Stufe-2-Kontext, Recall-Traces, Retention/Vertraulichkeit) | 4–6 PT | Interaktionsgedächtnis, sicher |
| **5 · MCP-Zugriff** | ein MCP-Server über die drei Schichten (read-mostly), damit externe Werkzeuge denselben Speicher nutzen | 3–4 PT | gemeinsame Zugriffsschnittstelle |

Reihenfolge bewusst: **Verhalten vor Embedding.** Der Regelkreis ist der größte Hebel und braucht keine Vektor-Infrastruktur; die Embedding-Aufwertung ist wertvoll, aber unabhängig davon. So liefert schon Phase 1 einen sichtbaren Abnahme-Nachweis.

### 7.3 Proof-of-Concept (beantwortet offene Frage 5)
**Zuschnitt: eine Aufgabe, ein Fehler, ein Modelltausch — offline, in einer Woche.** Konkret:
1. Wähle den Task **conflict** (oder den ehrlichen „weiß nicht"-Fall bei **answer**) — dort trennen sich schwache und starke Modelle am deutlichsten.
2. Nimm einen Prüfstand-Fall, den das **schwächere lokale Modell** (z. B. Qwen3-32B) reißt — etwa einen Ehrlich-Fall, bei dem es fälschlich einen Widerspruch behauptet.
3. Baue den minimalen Verhaltensartefakt-Store (eine sqlite- oder JSON-Datei) + den Prompt-Zusammenbau; lege ein **Guardrail-Artefakt** an (Negativbeispiel/Regel aus genau diesem Fall, `herkunftsfall` gesetzt).
4. Miss erneut: derselbe Fall jetzt bestanden; Regressions-Lauf grün.
5. **Tausche das Modell** (Qwen → MLX oder anderes lokales Modell) über die Provider-Konfiguration, ohne das Artefakt anzufassen.
6. Zeige: Der Fix wirkt weiterhin — **die Verbesserung hat den Modellwechsel überlebt, vollständig offline.**

Das ist der kleinstmögliche Aufbau, der **alle drei kritischen Abnahmekriterien gleichzeitig** demonstriert (Modelltausch ohne Wissensverlust · offline auf der Insel · Prüfstand-Fix ohne Fine-Tuning, wechselfest). Aufwand: 3–5 PT.

---

## 8 · Beantwortung der fünf offenen Fragen (gebündelt)

1. **Vektor-Store & Embedding (Apple Silicon, Deutsch):** sqlite-vec auf der Insel, pgvector zentral, gemeinsames Schema; **bge-m3** als Embedding (~1,4 GB fp16, ~0,7 GB Q8 — passt neben dem 32B-LLM in 64 GB; deutsche Retrieval-Qualität stark; dense+sparse für Codes/Werte). RAM-Budget: LLM (Q4 32B ≈ 18–20 GB) + bge-m3 (~1,4 GB) + Store/App → komfortabel in 64 GB.
2. **Datenmodell für alle drei Schichten mit gemeinsamer Provenance/Trust, ohne die KO-Struktur zu brechen:** das gemeinsame `Provenienz`-Objekt (Abschnitt 4) als Kern jeder Entität; Schicht 1 bleibt das KO-Modell unverändert (Vektor-Index nur additiv), Schicht 2/3 sind neue Entitäten, die dieselbe Provenance/Audit/Vertraulichkeit tragen. Keine Migration am KO nötig.
3. **Konfliktauflösung beim USB-Sync:** gerichtet je Schicht (Tabelle 6.3). Fachwissen bidirektional/review-gated, Inhaltskollisionen laufen in unsere **vorhandene** Konflikt-/Duplikat-Logik (kein last-writer-wins, kein stilles Überschreiben); Verhalten zentral→Insel kuratiert; Gedächtnis bleibt Insel-lokal. Löschungen immer als **Tombstones** (nie „fehlt = behalten"), Vertraulichkeit reist als Attribut mit und wird beim Import respektiert.
4. **Format/Versionierung der Verhaltensartefakte:** Schema in 4.2; datengetriebene Bausteine statt Monolith-Prompt; semantische Version, alte lesbar; `herkunftsfall` + `belegMessung` koppeln jedes Guardrail an den Prüfstand-Fall und seinen Wirkungsnachweis → der Rückfluss ist automatisierbar (5.2).
5. **PoC-Zuschnitt & Aufwand:** ein Task (conflict/„weiß nicht"), ein durchgefallener Fall, ein Modelltausch, offline — **3–5 PT** (Abschnitt 7.3). Erster „Kunde": die VIP-Insel selbst, weil dort Air-Gap und Prüfstand schon existieren.

---

## 9 · Eigene Befunde & Verbesserungsvorschläge (über den Auftrag hinaus)

### 9.1 Die Embedding-Falle — der wichtigste eigene Befund
Der ganze Auftrag zielt auf Modellunabhängigkeit — aber das **Embedding-Modell ist selbst ein Modell**, und es ist die **einzige** Modellkomponente, die man *nicht* frei tauschen kann. Grund: Vektoren verschiedener Embedding-Modelle sind nicht kompatibel; ein Wechsel des Embedding-Modells macht **jeden gespeicherten Vektor wertlos**, und die semantische Suche liefert stillschweigend Unsinn, bis der gesamte Bestand neu berechnet ist. Das ist genau der „Wissen geht beim Modellwechsel verloren"-Schmerz, nur an einer Stelle, an der man ihn nicht erwartet.

**Konsequenz für die Architektur (bitte von Anfang an einplanen):**
- Jeder Vektor-Eintrag trägt eine **`embeddingVersion`** (Modellname + Version + Dimension). Das Sync-Manifest ebenso.
- Ein Embedding-Wechsel ist ein bewusster, versionierter **Re-Index-Vorgang** (alle KOs/Gedächtniseinträge neu einbetten), nicht ein stiller Konfig-Change. Auf der Insel läuft der Re-Index offline über Nacht; das Ergebnis ist ein neuer, signierter Store.
- Bis der Re-Index fertig ist, darf **kein gemischter Store** befragt werden (sonst falsche Treffer). Der Store ist embedding-homogen oder er sagt ehrlich „Index wird neu gebaut".
- **Empfehlung:** bge-m3 als Standard bewusst *einfrieren* und nur mit gutem Grund wechseln — die Retrieval-Qualität ist gut genug, und Stabilität ist hier mehr wert als das letzte Quäntchen nDCG. Das antwortende LLM tauscht man oft; das Embedding-Modell selten und geplant.

Diesen Punkt nennt weder OB1 noch der Auftrag prominent — er ist aber die eine Stelle, an der das Versprechen „Wissen überlebt Modellwechsel" ohne Sorgfalt gebrochen würde.

### 9.2 Prüfstand als Regressions-Gate in der USB-Pipeline
Kein Verhaltensartefakt sollte per USB auf die Insel gelangen, ohne dass zuvor der Prüfstand **grün mit Delta** lief (der neue Guardrail verbessert seinen Zielfall und verschlechtert keinen anderen). Das macht den Prüfstand vom Messinstrument zum **Freigabe-Tor** — und verhindert, dass eine gutgemeinte Regel die Gesamtqualität heimlich senkt. Klein umzusetzen (das Tor existiert schon als Messung), großer Effekt.

### 9.3 „Wirksame Modell-Klasse" statt „ein Prompt für alle"
Weil schwache und starke Modelle unterschiedlich viel Führung brauchen, sollte der Prompt-Zusammenbau die **Modell-Klasse** kennen (z. B. „lokal-klein", „lokal-groß", „cloud-stark") und die Few-Shot-Anzahl/Guardrail-Ausführlichkeit daran skalieren — ohne die Artefakte selbst zu ändern. So bleibt ein Artefakt modellunabhängig, aber seine *Dosierung* passt sich an. Das hebt gerade die schwächeren lokalen Modelle (das Insel-Szenario) spürbar.

### 9.4 Gedächtnis strikt Stufe 2 halten (Wiederholung, weil zentral)
Ich betone es bewusst noch einmal als Empfehlung: Der verlockendste Fehler bei „Agent Memory" ist, frühere Antworten wie Wissen zu behandeln. Das würde die gesamte Ehrlichkeits-DNA von KLARWERK untergraben. Gedächtnis priorisiert und kontextualisiert — Quelle ist **nie** eine Erinnerung, immer nur ein validiertes KO. Die `recallTraces` sind der Kontrollmechanismus, der das prüfbar hält.

### 9.5 Kleiner strategischer Hinweis
Diese Schicht ist mehr als Technik — sie ist ein **Verkaufsargument**: „Ihr Wissen und die gelernten Verbesserungen gehören Ihnen und überleben jeden KI-Wechsel, auch komplett offline." Das trifft genau die On-Premises-/Souveränitäts-Erzählung der Insel-Variante und differenziert gegen reine Cloud-Chatbots. Der Regelkreis (Abschnitt 5) ist dabei das konkrete, vorführbare Beweisstück — er sollte in der VIP-Demo einen festen Platz bekommen.

---

## 10 · Abnahmekriterien — wie dieses Konzept sie erfüllt

| Abnahmekriterium | Erfüllt durch |
|---|---|
| LLM austauschbar ohne Wissensverlust | Drei-Schichten-Trennung (3.1); Modellwechsel berührt nur die Provider-Schicht; Verhaltensartefakte + KOs + Gedächtnis bleiben unverändert. PoC beweist es (7.3). |
| Läuft offline auf dem Mac Studio | sqlite-vec + bge-m3 + lokaler LLM, kein externer Dienst (3.2/3.3/6.1). |
| Prüfstand-Fehler ohne Fine-Tuning behebbar, wechselfest | Regelkreis Ebenen 1–4 (Abschnitt 5); Guardrail als Datenartefakt überlebt Modellwechsel; PoC zeigt genau das. |
| Sync kontrolliert, signiert, mit Konfliktbehandlung | Gerichteter USB-Sync je Schicht, Tombstones, Signatur, Manifest inkl. Embedding-Version (6.3, 9.1). |
| Alle Sicherheitsregeln | Keychain-Only, kein Insel-Abfluss, Provenance/Vertraulichkeit/Audit über alle Schichten (6.1/6.2). |

---

## Quellen (recherchiert 05.07.2026)

- OB1 „Open Brain", Repository & Doku: github.com/NateBJones-Projects/OB1 — Architektur (Postgres+pgvector, JSON-RPC-Gateway, MCP, `thoughts`+Agent-Memory-Schema, Fingerprint-Dedup), Supabase/Edge-Functions-Kopplung, Lizenz **FSL-1.1-MIT**, Reifegrad (~3,5k Stars, ~350 Commits, Community-getrieben).
- Lokale Embeddings auf Apple Silicon 2026 (bge-m3 vs. nomic vs. Qwen3-Embedding): Contra Collective, „Local Embeddings on Apple Silicon" — bge-m3 568M, ~1,4 GB fp16 / 0,7 GB Q8, deutsche nDCG ~49,6, dense+sparse; Qwen3-Embedding-8B höhere Qualität aber 9–18 GB; nomic schwach für Deutsch.
- Embedded Vektor-Stores 2026 (sqlite-vec vs. pgvector vs. LanceDB): mehrere Vergleiche (u. a. llbbl.blog „pgvector vs sqlite-vec", CallSphere „Vector DB Benchmarks 2026", asg017/sqlite-vec) — sqlite-vec als serverlose, air-gap-taugliche Einzeldatei-Lösung; pgvector als Server-Standard für zentralen Mehrbenutzerbetrieb.
- Modell-Vergleiche (MTEB/BEIR-Kontext) zu bge-m3 & multilingual: Milvus/BentoML/Ollama-Modellkarten.

---

*Ende des Beratungsberichts. Sechs Deliverables geliefert, fünf offene Fragen beantwortet, eigene Befunde ergänzt (Abschnitt 9). Empfehlung: Muster von OB1 übernehmen, schlanken Eigenbau auf den vorhandenen KLARWERK-Bausteinen, Schwerpunkt auf den Verhaltens-Regelkreis; PoC in einer Woche offline vorführbar. Kein Code, keine Tickets, keine Konfiguration verändert — reine Beratungsleistung. Lizenz- und rechtliche Aussagen sind Hinweise, kein Ersatz für juristische Prüfung.*
