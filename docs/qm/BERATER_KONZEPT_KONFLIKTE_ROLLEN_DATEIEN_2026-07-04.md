# KLARWERK — Fachkonzept: Konflikte · Rollen-Modell · Datei-Handling · „Aus Datei"-Erfassung

*Auftraggeber: Peter Kohnert (Pedi) · Auftrag aufbereitet von Paul (Cloud-Worker) · Ausarbeitung: externer Architektur-/Produktberater (unabhängige Claude-Session) · Stand: 04.07.2026*

> **Zweck.** Dieses Dokument arbeitet die vier Themenblöcke A–D fachlich so aus, dass ein Entwicklerteam sie gate-sauber (TypeScript strict, Biome, dependency-cruiser, Vitest, UI-Smoke) umsetzen kann — **ohne** dass ein zweiter Konzept-Durchlauf nötig ist. Es enthält keinen Produktionscode. Wo mehrere Wege denkbar sind, nenne ich sie, wäge ab und **empfehle einen**. Grundlage ist der reale Code-Stand v0.9.45-beta (Module `conflicts`, `validation`, `knowledge-object`, `rbac`, sowie die Frontend-Bibliotheken `conflictImpact`, `conflictView`, `captureFromFile`, `fileMultiPoint`, `captureSources`).
>
> **Leseweg:** Abschnitt 0 (Annahmen) → A (Konflikte, Kern) → B (Rollen) → C (Datei-Handling) → D (Aus-Datei-Erfassung) → Q (Querschnitt Rechte & Audit) → Anhang (Umsetzungsreihenfolge/Risiken). Jeder Block folgt derselben 7-Punkte-Gliederung: Ziel-Logik · Datenmodell · Workflow · Rechte · UI · Randfälle · offene Entscheidungen.

---

## 0 · Ausdrücklich benannte Annahmen (statt Rückfragen)

Diese Annahmen treffe ich, um in einem Durchgang durchzuarbeiten. Jede ist so gewählt, dass sie den Leitprinzipien folgt und im Zweifel die konservativere (prüf- statt automatik-lastige) Variante ist. Falls eine davon nicht deiner Absicht entspricht, ist sie der einzige Punkt, den ihr vor der Umsetzung kippen müsst — der Rest des Konzepts bleibt tragfähig.

- **A0-1 — „Beteiligter" ist ein Verweis, kein Duplikat.** Ein Konflikt speichert *Referenzen* auf Beiträge (Typ + ID), nie deren Inhalt. So bleibt ein Konflikt bei Bearbeitung der Beiträge automatisch aktuell und erzeugt kein zweites Wahrheits-Datum.
- **A0-2 — Kommentare bekommen den *leichten* Lebenszyklus.** Ein Kommentar (`KoComment`, heute im KO eingebettet) ist ein Beitrag, der einen Konflikt *auslösen/beteiligt sein* kann, aber selbst **nicht** validiert wird und keinen Trust trägt. Ein Konflikt „Kommentar ↔ KO" oder „Kommentar ↔ Kommentar" ist erlaubt; er durchläuft denselben Status-, aber einen **reduzierten Aktions**-Pfad (kein „Revalidierung des Kommentars", weil Kommentare nicht validiert werden).
- **A0-3 — Cluster (>2 Beteiligte) werden im Datenmodell vorgesehen, in der Ersteinführung aber auf Paare beschränkt genutzt.** Das Schema erlaubt N Beteiligte; die UI der ersten Ausbaustufe legt/zeigt Paare. So ist der teure Modell-Umbau einmalig, ohne die UI sofort zu überladen.
- **A0-4 — „Aufgelöst durch Löschung" ist ein eigener, sichtbarer Endzustand**, nicht dasselbe wie eine menschliche Entscheidung. Beide enden „gelöst", aber mit unterscheidbarem `resolution`-Grund (s. A.2). Das erhält die Ehrlichkeit: niemand hat inhaltlich entschieden.
- **A0-5 — „Konfliktfrei" ist ein *Ereignis/Vermerk*, kein dauerhaftes neues KO-Statusfeld.** Es bedeutet: „der zuletzt bestehende Widerspruch an diesem Beitrag ist entfallen". Es verändert **weder** `status` **noch** `trust` des KO automatisch (Prinzip „kein stilles Überschreiben"). Es wird als History-/Audit-Ereignis festgehalten und in der UI als beruhigender Hinweis gezeigt.
- **A0-6 — Automatische Erkennung bleibt Vorschlag, nie Setzung.** Ein erkannter möglicher Widerspruch wird zu einem *Hinweis mit Bestätigungs-Button*, nie zu einem Konflikt-Datensatz ohne menschlichen Klick.
- **A0-7 — „Wirksame Rolle" ist eine Ableitung zur Laufzeit, kein zweites Rollenfeld am Nutzer.** Der Nutzer behält genau eine Kontorolle; die wirksame Rolle je Handlung wird aus Kontorolle + Kontext (Autor? welche Ressource?) berechnet.
- **A0-8 — Der Zweitmeinungs-Auftrag ist ein eigenes, dem Prüfauftrag *nachgebautes* Objekt im `conflicts`-Modul**, nicht die Wiederverwendung des `validation`-`Assignment` (Begründung: Modulgrenzen/Zyklen, s. Q-3). Die „Meine Aufgaben"-Sicht aggregiert beide Quellen erst im Frontend.
- **A0-9 — Sprache.** Alle neuen Zeichenketten DE **und** EN; interne Status-/Enum-Werte bleiben englisch/technisch (wie heute `offen|validiert` gemischt existiert — ich schlage keine Enum-Umbenennung vor, um Migrationen zu vermeiden).

---

## A · Konflikte (Kern-Thema)

### A.1 · Ziel-Logik in Worten

Ein Konflikt ist die **sichtbare, dokumentierte Feststellung, dass zwei oder mehr Beiträge einander widersprechen oder in Spannung stehen** — und zugleich der geführte Weg, wie Menschen diese Spannung auflösen. KLARWERK entscheidet einen Konflikt **nie selbst**: Das System erkennt (schlägt vor), stellt gegenüber, holt Menschen dazu, hält die Entscheidung fest und sorgt dafür, dass die Wissensbasis währenddessen **ehrlich** bleibt (konfligierendes Wissen wird nicht als „gesichert" ausgespielt). Der Konflikt hat einen klaren Lebenszyklus mit sprechenden Stufen, und er bleibt **integer**, auch wenn Beteiligte gelöscht, bearbeitet oder wiederhergestellt werden.

Drei Leitgedanken, die jede Detailentscheidung in Block A tragen:

1. **Der Konflikt ist ein Verweis-Objekt, kein Inhalts-Objekt.** Er zeigt auf Beiträge, er kopiert sie nicht. Damit ist die Integritätsfrage (A.4) überhaupt sauber lösbar.
2. **Auflösen heißt entweder *entscheiden* (Mensch) oder *entfällt* (Grundlage weg).** Beides endet „gelöst", aber der *Grund* ist unterscheidbar und bleibt im Audit.
3. **Wirkung auf das KO ist hinweisend, nicht mutierend.** Ein offener Konflikt begrenzt die *Nutzbarkeitsaussage* ehrlich (heute schon: `conflictImpact` → „in Prüfung"), aber er schreibt niemals automatisch `status`/`trust`. Das ist bereits die bewusste Architektur (`conflictView.resolutionEffect`: `koStatusChanged=false`, `koTrustChanged=false`) und bleibt es.

### A.2 · Datenmodell-Auswirkungen

**Heute** (`services/conflicts/src/types.ts`): `Conflict { id, koA, koB, type, description, status, secondOpinion, decidedBy, decision, createdAt }`, `type: truth|experience|context|temporal|role`, `status: offen|eskaliert|zweitmeinung|geloest`. Genau zwei KO-IDs, ein Freitext-Zweitmeinungsfeld, kein Adressat, kein Bezug zu gelöschten Beiträgen.

**Ziel-Modell.** Ich schlage eine additive, migrationsarme Erweiterung vor — die bestehenden Felder bleiben lesbar, neue Felder sind optional (JSON-persistiert, keine harte Migration; Muster wie `KoSource.provider`).

**(a) Beteiligte verallgemeinern — `ConflictParticipant`.**

```
type ParticipantKind = "ko" | "comment"   // erweiterbar: "source" | "file_point"
interface ConflictParticipant {
  kind: ParticipantKind
  refId: string          // koId, oder commentId
  parentKoId?: string    // bei kind="comment": das KO, an dem der Kommentar hängt
  label?: string         // zum Anzeige-Zeitpunkt eingefrorener Kurztitel (Fallback, s. A.4)
}
interface Conflict {
  id: string
  participants: ConflictParticipant[]   // NEU: 2..N; ersetzt koA/koB perspektivisch
  koA?: string; koB?: string            // BLEIBEN vorerst (Rückwärtskompatibilität + Migration)
  type: ConflictType
  description: string
  status: ConflictStatus
  resolution?: ConflictResolution       // NEU (s. unten)
  secondOpinions: SecondOpinion[]       // NEU: strukturiert statt Einzel-Freitext
  decidedBy: string | null
  decision: string | null
  createdAt: string
  closedAt?: string                     // NEU
}
```

**Migrationsregel (verwaiste/alte Konflikte):** Beim Lesen wird ein Alt-Konflikt mit `koA/koB` **on-the-fly** als zwei `ko`-Participants interpretiert (ein reiner Lese-Adapter, kein Schreibvorgang). Neuanlagen schreiben `participants`; `koA/koB` werden zusätzlich mit den ersten beiden KO-Participants befüllt, solange irgendein Konsument sie noch liest (Übergang), und in einer späteren, separaten Aufräum-Migration entfernt. Das hält dependency-cruiser und die Route-Contract-Tests grün.

**(b) Auflösungsgrund — `ConflictResolution`.** Der Kern der Ehrlichkeit: *warum* endete der Konflikt?

```
type ConflictResolutionReason =
  | "decided"            // ein Mensch hat entschieden (heutiges resolve)
  | "participant_deleted"// Grundlage entfiel: mind. ein Beteiligter gelöscht
  | "edited_no_conflict" // ein Beteiligter wurde so geändert, dass kein Widerspruch mehr besteht (nach Bestätigung)
  | "withdrawn"          // manuell zurückgezogen (Konflikt war unbegründet)
interface ConflictResolution {
  reason: ConflictResolutionReason
  by: string | null      // null bei rein systemischer Auflösung (deleted)
  note: string | null
  at: string
}
```

**(c) Zweitmeinung strukturieren — `SecondOpinion` + Zweitmeinungs-Auftrag.** Statt eines einzelnen Freitextfelds ohne Adressat:

```
interface SecondOpinion {
  id: string
  requestedBy: string
  assignee: string          // konkrete Person
  status: "open" | "answered" | "cancelled"
  verdict?: "supports_a" | "supports_b" | "unclear" | "both_partly"  // strukturiert + optional
  comment?: string          // Freitext-Begründung
  requestedAt: string
  answeredAt?: string
}
```

Der Zweitmeinungs-Auftrag lebt **im `conflicts`-Modul** (nicht im `validation`-`Assignment`, s. A0-8/Q-3). Er ist dem Prüfauftrag nachgebaut: `{conflictId, assignee, status}`, damit die „Meine Aufgaben"-Sicht ihn wie einen Prüfauftrag anzeigen kann.

**(d) Konflikttyp-Taxonomie schärfen.** Die fünf Werte existieren bereits (`truth|experience|context|temporal|role`), aber nur `truth` hat heute einen eigenen Pfad. Ich fülle die Bedeutung und den Pfad je Typ (A.6), ohne das Enum zu ändern (keine Migration).

**(e) „Konfliktfrei"-Vermerk am Beitrag.** Kein neues Statusfeld. Ich empfehle: ein **History-/Audit-Ereignis** am KO (`ko.conflict-cleared`, mit Konflikt-ID und Grund) plus einen **abgeleiteten, nicht persistierten** UI-Zustand „zuletzt konfliktfrei geworden" (aus Audit/History gelesen). Begründung in A0-5: ein persistiertes „konfliktfrei=true" wäre ein stilles Trust-nahes Signal und würde bei jeder neuen Spannung wieder pflegebedürftig — das Audit ist die ehrliche, unveränderliche Quelle.

### A.3 · Workflow & Zustandsübergänge

**Statusmenge bleibt** `offen · eskaliert · zweitmeinung · geloest` (keine Enum-Migration). Neu ist nur, dass „geloest" jetzt immer einen `resolution.reason` trägt.

**Normaler Pfad (Wahrheitskonflikt):**

```
offen ──escalate──▶ eskaliert ──requestSecondOpinion──▶ zweitmeinung ──resolve(decided)──▶ geloest
  │                                                                                          ▲
  └───────────────── resolve(decided) direkt (Controller entscheidet sofort) ───────────────┘
```

**Nicht-Wahrheitskonflikt** (experience/context/temporal/role): nicht eskalierbar (bleibt so). `offen ──requestSecondOpinion──▶ zweitmeinung ──resolve──▶ geloest`, oder `offen ──resolve──▶ geloest`. Das entspricht der bestehenden `conflictNextStep`-Logik und wird nur um den strukturierten Zweitmeinungs-Auftrag ergänzt.

**Integritäts-Übergänge (neu, A.4):**

```
(jeder Status außer geloest) ──letzter aktiver Beteiligter gelöscht──▶ geloest (reason=participant_deleted)
(jeder Status außer geloest) ──Beteiligter bearbeitet, Widerspruch bestätigt entfallen──▶ geloest (reason=edited_no_conflict)
geloest(participant_deleted) ──Beteiligter aus Papierkorb wiederhergestellt──▶ reopened? (Entscheidung A.7-Frage 3)
```

**Schritt-für-Schritt — Zweitmeinung (der wichtigste neue Ablauf):**

1. Ein Berechtigter (s. A.5) öffnet den Konflikt und wählt **„Zweitmeinung einholen"**.
2. Er wählt **eine oder mehrere konkrete Personen** (Auswahl gefiltert: nur Berechtigte, **nie** der Autor eines beteiligten Beitrags — Vier-Augen, s. Q).
3. Pro gewählter Person entsteht **ein** `SecondOpinion{status:open}` + ein Zweitmeinungs-Auftrag. Der Konflikt geht (falls noch `offen`/`eskaliert`) auf `zweitmeinung`.
4. Jede Person sieht den Auftrag in **„Meine Aufgaben"**, öffnet ihn, sieht die **Gegenüberstellung** der Beiträge und trägt Einschätzung (strukturiertes `verdict` + optionaler Freitext) ein → `SecondOpinion{status:answered}`.
5. Der Verantwortliche sieht alle eingegangenen Meinungen gebündelt und **entscheidet** (`resolve`, `reason=decided`) — oder holt weitere Meinungen.
6. „Wann reicht eine, wann alle?" — Empfehlung: **konfigurierbar wie die Prüferanzahl**, Default „mindestens eine Antwort genügt, um entscheiden zu *dürfen*"; der Verantwortliche darf immer manuell früher/später entscheiden. (Analog zu `defaultNeededValidations`, aber nicht erzwingend — Zweitmeinung ist beratend, nicht blockierend.)

**Eskalation — was sie konkret ändert:** Heute nur `status → eskaliert`. Neu: Eskalation trägt eine **Priorität** und einen **Adressaten-Typ** (s. A.7-Frage 5). Empfehlung: Eskalation adressiert eine **Rolle** (die nächsthöhere Instanz = Controller, bei Bedarf Admin), nicht eine namentliche Person — so bleibt sie robust gegen Personalwechsel; zusätzlich darf der Eskalierende optional eine Person benennen. Eskalation erzeugt eine **Benachrichtigung** an alle Träger der Zielrolle und hebt den Konflikt im Board sichtbar hervor.

### A.4 · Integrität bei Löschen / Bearbeiten / Wiederherstellen (Bug + Soll)

**Der Bug (bestätigt am Code):** `Conflict` referenziert `koA/koB` als reine IDs; wird ein KO gelöscht, bleibt die Referenz. Das Frontend löst die ID über `conflictKoPair` auf und zeigt bei `null` den Fallback `con.koMissing` („Objekt nicht gefunden") — im Board erscheint also eine **Fehler-Karte für einen gelöschten Beteiligten**. Ursache: Es gibt keinen Mechanismus, der beim Löschen eines Beitrags die referenzierenden Konflikte nachzieht.

**Soll-Logik (wörtlich sinngemäß aus dem Auftrag, präzisiert):**

- **Regel 1 — Löschen eines Beteiligten löst betroffene Konflikte auf.** Wird ein Beitrag gelöscht, der an einem oder mehreren Konflikten beteiligt ist, werden **diese Konflikte aufgelöst** mit `resolution.reason = participant_deleted`. Sie verschwinden damit aus der Liste der ungelösten Konflikte (`unresolved()` filtert `status !== "geloest"` — bleibt gültig).
- **Regel 2 — Bleibt genau ein aktiver Beteiligter übrig, wird dieser „konfliktfrei" vermerkt.** Für den/die verbleibenden Beteiligten wird das Ereignis `ko.conflict-cleared` (bzw. der Kommentar-Vermerk) geschrieben. In der UI erscheint am Beitrag ein ruhiger Hinweis „Widerspruch entfallen (der andere Beitrag wurde entfernt)".

**Der zentrale Architektur-Punkt — *wo* wird das ausgelöst?** Das Löschen lebt heute im `knowledge-object`-Modul (Soft-Delete `deletedAt`, SCRUM-422). `conflicts` darf man nicht einfach von dort heraus aufrufen, ohne die Modulrichtung zu prüfen. Zwei saubere Wege:

- **Weg 1 (Event/Hook, empfohlen):** Das KO-Modul emittiert beim (Soft-)Delete ein Domänen-Ereignis `ko.deleted{koId}` (bzw. `comment.deleted`). Ein **Koordinator im App-Composition-Root** (`services/app`, der ohnehin alle Module kennt) ruft daraufhin `conflicts.onParticipantRemoved(kind, refId)`. Vorteil: keine neue Modulkante `knowledge-object → conflicts` (die eine unerwünschte Richtung/ggf. Zyklus wäre); die Abhängigkeit lebt im App-Modul, das legitim beide kennt. Das ist exakt das Muster, das der Auftrag mit „Konfliktrechte ↔ Validierung im App-Layer verdrahten" nahelegt.
- **Weg 2 (synchroner Service-Aufruf):** KO-Delete ruft direkt `conflicts.resolveByParticipant(...)`. Einfacher, aber erzeugt die Modulkante `knowledge-object → conflicts`. **Nicht empfohlen**, weil `conflicts` konzeptionell „oberhalb" von `knowledge-object` sitzt (es referenziert KOs) — die Kante ginge gegen die Abhängigkeitsrichtung.

**`conflicts.onParticipantRemoved(kind, refId)` — die Kern-Routine:**

1. Finde alle **nicht-gelösten** Konflikte, an denen `(kind, refId)` beteiligt ist.
2. Für jeden: markiere den Beteiligten als `removed` (der Participant bleibt als Referenz erhalten, mit eingefrorenem `label` für die History — kein Fehler-Fallback mehr, sondern „‚Titel XY' (entfernt)").
3. Zähle die **verbleibenden aktiven** Beteiligten.
   - **0 oder 1 aktiv** → Konflikt `geloest`, `resolution.reason=participant_deleted`, `closedAt=now`. Bei genau 1 aktivem Rest: `ko.conflict-cleared`-Ereignis für diesen Rest.
   - **≥2 aktiv** (nur im Cluster-Fall möglich) → Konflikt bleibt offen, nur der eine Beteiligte ist `removed`; das Board zeigt ihn ausgegraut als „entfernt", der Widerspruch zwischen den übrigen besteht weiter.
4. **Laufende Vorgänge schließen:** offene `SecondOpinion{open}` → `cancelled` (mit Vermerk „Konflikt endete: Beteiligter entfernt"), zugehörige Zweitmeinungs-Aufträge in „Meine Aufgaben" verschwinden bzw. werden als „hinfällig" markiert. Eskalation wird beendet.
5. **Alles ins Audit** (`conflict.auto-resolved`, `conflict.participant-removed`, `secondOpinion.cancelled`) — auch die automatische Auflösung ist vollständig nachvollziehbar.

**Papierkorb vs. endgültig (SCRUM-422).** KLARWERK löscht KOs zunächst in den Papierkorb (`deletedAt` gesetzt, aus allen Pfaden ausgeblendet), Endlöschung nach Frist. Empfehlung:

- **Beim Verschieben in den Papierkorb (Soft-Delete)** wird die Auflösungs-Routine ausgeführt — denn der Beitrag ist ab sofort „wirkt gelöscht" und darf im Board keine Fehler-Karte erzeugen. Der Konflikt geht auf `geloest(participant_deleted)`.
- **Bei Wiederherstellung aus dem Papierkorb** siehe A.7-Frage 3. Empfehlung dort: den Konflikt **nicht** automatisch reaktivieren, sondern dem wiederherstellenden Admin einen **Hinweis + Angebot** zeigen („Dieser Beitrag stand in einem Konflikt, der durch die Löschung endete. Erneut als Konflikt anlegen?"). Das wahrt „nichts gilt ungeprüft" — die Wiederherstellung setzt nicht stillschweigend einen alten Widerspruch zurück.
- **Endlöschung nach Frist:** Falls der Konflikt beim Soft-Delete (fälschlich) nicht aufgelöst wurde, ist die Endlöschung der letzte sichere Zeitpunkt, dieselbe Routine auszuführen (idempotent — doppelter Aufruf ändert nichts).

**Bearbeiten statt Löschen.** Wird ein Beteiligter so **geändert**, dass inhaltlich kein Widerspruch mehr besteht: **nicht** automatisch auflösen (Grundsatz „nichts gilt ungeprüft" — das System kann Textgleichheit prüfen, aber nicht *Bedeutung* sicher beurteilen). Stattdessen: Beim Speichern einer Revision, die einen an einem offenen Konflikt beteiligten Beitrag betrifft, erscheint ein **Hinweis am Konflikt** („Ein Beteiligter wurde seit Konflikt-Anlage bearbeitet — noch aktuell?") und ein 1-Klick-Angebot **„Als aufgelöst markieren (bearbeitet, kein Widerspruch mehr)"** → `resolve(reason=edited_no_conflict)`, ausgeführt durch einen Menschen. So bleibt die Entscheidung menschlich, aber der Weg ist bequem.

**Mehrfach-Beteiligung.** Ein Beitrag in mehreren Konflikten: `onParticipantRemoved` iteriert über **alle** referenzierenden Konflikte, jeder wird einzeln nach der „nur einer übrig → konfliktfrei"-Regel behandelt. Der „konfliktfrei"-Vermerk am verbleibenden Beitrag wird nur geschrieben, wenn **an diesem Beitrag** kein weiterer ungelöster Konflikt mehr hängt (sonst wäre der Hinweis irreführend).

**Migration Bestand (verwaiste Konflikte).** Einmalige Bereinigung: Ein idempotentes Skript (bzw. ein Lazy-Check beim Board-Laden) prüft für jeden ungelösten Konflikt, ob seine KO-Referenzen noch auf existierende (nicht getrashte) KOs zeigen; verwaiste werden nach derselben Routine aufgelöst (`participant_deleted`, `note="Bestandsbereinigung 2026-07"`). So verschwinden die heutigen Fehler-Karten auch für Alt-Daten. **Wichtig:** read-only Erkennung darf im Board sofort greifen (keine Fehler-Karte mehr anzeigen), die *schreibende* Auflösung braucht einen Berechtigten/Systemlauf — im Zweifel zeigt das Board den verwaisten Konflikt bis dahin als „wird bereinigt", nie als Fehler.

### A.5 · Rollen-/Rechte-Wirkung (Konflikte)

Verzahnt mit Block B. Heutiger Stand: `escalate`/`resolve` verlangen `conflict.resolve` (Controller+Admin), `secondOpinion` verlangt `ko.validate` (Controller+Admin). Ziel-Bild (konsistent mit B — Experten dürfen fremde Beiträge prüfen):

| Aktion | Wer darf (Ziel) | Bedingung |
|---|---|---|
| Konflikt anlegen (manuell) | Experte, Controller, Admin | nicht Viewer |
| Erkannten Widerspruch bestätigen → Konflikt | wie „anlegen" | s. A.6 automatische Erkennung |
| **Zweitmeinung anfragen** | Controller, Admin — **und Experte**, wenn nicht Autor eines Beteiligten | Vier-Augen: nie zum eigenen Beitrag |
| **Zweitmeinung *geben*** (Auftrag beantworten) | Experte, Controller, Admin | **nie** Autor eines beteiligten Beitrags; nur die zugewiesene Person |
| **Eskalieren** | Controller, Admin (nächsthöhere Instanz) | nur Wahrheitskonflikte |
| **Auflösen/entscheiden** | Controller, Admin | nicht Autor eines Beteiligten (Vier-Augen); Admin, der selbst Beteiligter ist, handelt nicht als Entscheider |
| Konflikt zurückziehen (`withdrawn`) | Ersteller oder Controller/Admin | dokumentiert |

Die neue Permission-Landschaft dafür (Details Q): eine **kontextabhängige** Prüfung „darf prüfen/zweitmeinen, wenn Rolle ≥ Experte **und** nicht Autor". Das ist genau die Erweiterung aus Block B; Konflikte sind ihr erster großer Nutznießer.

### A.6 · Wechselwirkungen & Darstellung

**Nutzbarkeit / Ask / Validierung.** Bereits heute korrekt gelöst und bleibt: `conflictImpact` begrenzt die *Nutzbarkeitsaussage* eines KO mit offenem Konflikt ehrlich auf „in Prüfung" (Truth am stärksten), ohne `status`/`trust` zu mutieren; Ask/Bibliothek/KO-Detail teilen sich diese Ableitung. Ergänzung: **Ask muss konfligierendes Wissen kennzeichnen** — eine Antwort, die auf einem KO mit offenem (v. a. Wahrheits-)Konflikt beruht, trägt einen sichtbaren Hinweis „Zu diesem Punkt gibt es einen offenen Widerspruch" und spielt das KO nicht als gesichert aus. Das ist die konsequente Fortsetzung der vorhandenen Logik in die „Fragen"-Antwort.

**Konflikttyp-Taxonomie mit Pfad** (Bedeutung gefüllt, Enum unverändert):

| Typ | Bedeutung | Pfad-Besonderheit |
|---|---|---|
| `truth` (Wahrheit) | Aussagen widersprechen sich sachlich (A: „X ist rot", B: „X ist blau") | eskalierbar; stärkste Nutzbarkeits-Begrenzung; Revalidierung empfohlen |
| `experience` (Erfahrung) | unterschiedliche Erfahrungswerte, beide evtl. gültig je Kontext | nicht eskalierbar; Zweitmeinung → ggf. beide behalten mit Geltungsbereich |
| `context` (Geltungsbereich) | gelten für verschiedene Anlagen/Fälle, nur scheinbar Widerspruch | Auflösung oft = „Geltungsbereich präzisieren", kein Verwerfen |
| `temporal` (Aktualität) | einer ist veraltet | Auflösung oft = Lebenszyklus/Revalidierung des älteren |
| `role` (Zuständigkeit) | Widerspruch aus unterschiedlicher Rollen-/Verantwortungssicht | Zweitmeinung durch die zuständige Instanz |

Jeder Typ nutzt dieselben Aktionen, aber der **empfohlene nächste Schritt** und die Beschriftung unterscheiden sich (Ausbau der vorhandenen `conflictNextStep`). Für die Ersteinführung reicht: Truth = voller Pfad, die anderen vier = „Zweitmeinung → entscheiden" mit typspezifischem Hilfetext.

**Board / Darstellung.** Kern-Fixes: (1) **keine Fehler-Karte** für entfernte Beteiligte — stattdessen ausgegraute Karte „‚Titel' (entfernt am …)". (2) **Klare Gegenüberstellung** (existiert: `KoPanel` links/rechts) — im Cluster-Fall als Liste. (3) **Sprechender Pfad** — die drei Stufen (`eskaliert · zweitmeinung · geloest`, heute in `PATH`) werden mit erklärenden Labels versehen: „An höhere Instanz gegeben", „Kolleg:innen um Zweitmeinung gebeten", „Entschieden". (4) **Mehrfachkonflikte je Beitrag** verständlich bündeln: am KO-Detail eine Zeile „In N Konflikten beteiligt" mit Aufklappliste statt N verstreuter Hinweise.

**Benachrichtigung & Audit.** Wer wird wann informiert: Zweitmeinungs-Auftrag → die zugewiesene Person (In-App-Feed, wie Prüfaufträge); Eskalation → Träger der Zielrolle; Auflösung → Ersteller + beteiligte Autoren; automatische Auflösung durch Löschung → beteiligte Autoren („Konflikt endete, weil …"). Jeder Schritt (Anlegen, Zuweisen, Antworten, Eskalieren, Auflösen, Auto-Auflösen, Zurückziehen) erzeugt ein Audit-Ereignis (append-only Hash-Kette).

### A.7 · Offene Entscheidungen — mit Empfehlung

1. **Beteiligten-Modell paarweise vs. Cluster.** → **Empfehlung: Schema für N vorsehen (A0-3), UI zunächst paarweise.** Der teure Teil ist das Datenmodell; die einmalige Verallgemeinerung jetzt spart einen zweiten Migrationsschmerz, ohne die UI zu überfrachten.
2. **Zweitmeinung: eigenes Objekt vs. `validation`-`Assignment`.** → **Empfehlung: eigenes `SecondOpinion`/Zweitmeinungs-Auftrag im `conflicts`-Modul** (A0-8/Q-3), FE aggregiert. Vermeidet Modulzyklus und Zweckvermischung; „Meine Aufgaben" zeigt beide Quellen einheitlich.
3. **Wiederherstellung aus Papierkorb → Konflikt reaktivieren?** → **Empfehlung: nicht automatisch; Hinweis + Angebot** an den wiederherstellenden Admin (A.4). Automatisches Reaktivieren würde einen alten, ungeprüften Widerspruch stillschweigend setzen.
4. **Wann reicht eine Zweitmeinung, wann alle?** → **Empfehlung: beratend, nicht blockierend; Default „≥1 Antwort erlaubt Entscheidung"**, konfigurierbar analog Prüferanzahl; der Verantwortliche darf immer manuell entscheiden.
5. **Eskalations-Adressat: Rolle vs. Person.** → **Empfehlung: primär Rolle (nächsthöhere Instanz), optional zusätzlich benannte Person.** Robust gegen Personalwechsel; Eskalation setzt Priorität + Benachrichtigung + Board-Hervorhebung.
6. **Automatische Erkennung — ob/wo/wie** (A.5 unten). → **Empfehlung: ja, aber nur als Vorschlag; Stufe 1 regelbasiert beim Erfassen/Einreichen, Stufe 2 modellgestützt später.**
7. **„Konfliktfrei" technisch.** → **Empfehlung: Audit-/History-Ereignis + abgeleiteter UI-Hinweis, kein persistiertes KO-Flag** (A0-5). Wirkt auf die *Darstellung* der Nutzbarkeit (Hinweis entfällt), nie automatisch auf `status`/`trust`.
8. **Migration verwaister Konflikte.** → **Empfehlung: Lazy-Erkennung im Board (sofort keine Fehler-Karte) + idempotenter Bereinigungslauf** (`participant_deleted`, Bestandsvermerk).

**Automatische Konflikterkennung (A.5 des Auftrags, konsolidiert hier):** Heute wird ein Widerspruch beim Eintrag nicht erkannt (Beispiel Firmenwagen-Farbe). Empfehlung in zwei Stufen, beide **nur markierend**:

- **Stufe 1 (regelbasiert, günstig, sofort):** Beim Einreichen/Strukturieren eines KO sucht das System nach Beiträgen *ähnlicher Kategorie/Tags/Titel* und zeigt dem Autor/Prüfer einen Hinweis „Mögliche Spannung zu ‚…' — als Konflikt anlegen?". Nutzt die vorhandene Retrieval-/Keyword-Logik; kein Modell nötig. Greift am sinnvollsten **im Prüfbereich** (der Prüfer hat den Überblick), sekundär beim Erfassen.
- **Stufe 2 (modellgestützt, später):** Der Reasoner vergleicht die neue Aussage semantisch gegen die naheliegenden bestehenden und schlägt *mit Begründung* mögliche Widersprüche vor. Erst nach der LLM-Anbindung sinnvoll; identischer Grundsatz: **nur Vorschlag, ein Mensch bestätigt** → erst dann entsteht ein `Conflict`-Datensatz.

**Umsetzungs-/Migrationsrisiken (Block A):** (1) Die Beteiligten-Verallgemeinerung berührt die Route-Contract-/Guard-Tests — der Lese-Adapter `koA/koB → participants` muss beide Test-Welten grün halten. (2) Der Event-/Hook-Weg (A.4 Weg 1) verlangt eine minimale Ereignis-Infrastruktur im App-Modul; wird sie zu schwer, ist ein direkter, aber *richtungs­konformer* Aufruf im Composition-Root der pragmatische Kompromiss. (3) Idempotenz aller Auflösungs-Pfade ist Pflicht (Soft-Delete, Endlöschung, Bereinigungslauf dürfen sich überlappen). (4) `conflictImpact` liest heute `koA/koB` — der Adapter muss auch dort greifen, sonst „sehen" Nutzbarkeits-Hinweise Cluster-Konflikte nicht.

---

## B · Rollen-Modell (RBAC)

### B.1 · Ziel-Logik in Worten

Heute ist das Prüfrecht an die **Kontorolle** gebunden: nur Controller und Admin tragen `ko.validate`; ein Experte darf gar nicht prüfen. Das Ziel kehrt die Perspektive um: **Prüfberechtigung ist eine Frage der Handlung im Kontext, nicht nur des Kontotyps.** Ein Experte *ist* für fremde Beiträge ein Prüfer (Vier-Augen: nie für die eigenen). Ein Admin, der einen Beitrag *schreibt*, handelt dabei als Experte; prüft er einen fremden Beitrag, handelt er als Controller. Die Kontorolle bleibt die **Obergrenze** der möglichen Handlungen; die **wirksame Rolle** je Handlung ergibt sich aus Kontorolle + Kontext.

Der Leitgedanke: **„Darf prüfen, wenn Rolle ≥ Experte UND nicht Autor."** Das ist eine ressourcenbezogene Erlaubnis (kennt den zu prüfenden Beitrag und seinen Autor), keine rein rollenbezogene — und genau das kann der heutige Guard noch nicht (er kennt nur die Rolle).

### B.2 · Datenmodell-Auswirkungen

**Kein neues Rollenfeld am Nutzer** (A0-7). Die Kontorolle (`viewer|experte|controller|admin`) bleibt unverändert, ebenso `ROLE_PERMISSIONS`. Neu kommt eine **ressourcenbezogene Berechtigungsschicht** hinzu:

- Eine neue Permission **`ko.validate.foreign`** (oder gleichwertig: eine Kontext-Regel) drückt aus „darf fremde Beiträge prüfen". Zwei saubere Umsetzungen:
  - **(i) Rollenmatrix erweitern + Autor-Check im Service.** `experte` erhält `ko.validate`; die Autor-Ausschluss-Prüfung („nicht der eigene Beitrag") wandert **verbindlich in den Service** (`validation.rate`, Zweitmeinung, Konfliktaktionen). Der rollenbasierte Guard bleibt die Grobschranke, der Autor-Check die Feinschranke.
  - **(ii) Ressourcenbewusster Guard.** Ein erweiterter Guard `requirePermissionForResource(permission, resolveResource)` bekommt zusätzlich den Ziel-Beitrag und prüft Rolle **und** Autor-Beziehung in einem.
- Für die **UI-Transparenz** (B.5) genügt eine abgeleitete, nicht persistierte Funktion `effectiveRole(user, action, resource)` → `"experte" | "controller" | …`, die anzeigt, „in welcher Rolle du gerade handelst". (Eine `effectiveRole.ts` existiert bereits im Frontend-Bestand und kann der Anker sein.)

**Empfehlung: Weg (i) + (ii) kombiniert, aber Autor-Check als *einzige Wahrheit* im Service.** Die Rollenmatrix bekommt `experte → ko.validate` (macht Experten grundsätzlich prüfberechtigt); der **verbindliche** Ausschluss „nicht Autor / nicht Beteiligter" wird **serverseitig im jeweiligen Service** erzwungen (nicht nur im Guard), weil nur der Service Ressource + Autor kennt und weil so keine Route diesen Schutz „vergessen" kann. Der ressourcenbewusste Guard (ii) ist die zusätzliche, testbare Grobschranke auf Routen-Ebene.

### B.3 · Workflow / Zustandsübergänge

Kein neuer Status, aber eine geänderte **Erlaubnis-Auswertung** an jeder Prüf-/Konfliktaktion:

```
Aktion angefragt (z. B. rate, secondOpinion, escalate, resolve)
  └─ Guard: Rolle ≥ nötige Grundrolle?        (401/403 wie heute)
       └─ Service: ist Actor Autor/originalAuthor eines betroffenen Beitrags?
            ├─ ja  → 403 SELF_REVIEW_FORBIDDEN ("Eigene Beiträge kann man nicht selbst prüfen.")
            └─ nein → ausführen, Audit mit wirksamer Rolle
```

Für die **Standard-Prüfer-Zuweisung** (SCRUM-395) heißt das: Der Kandidatenkreis für Prüfer/Zweitmeinung schließt den Autor (und `originalAuthor`) automatisch aus.

### B.4 · Rollen-/Rechte-Wirkung (die Matrix nach dem Umbau)

| Handlung | viewer | experte | controller | admin | Zusatzregel |
|---|:--:|:--:|:--:|:--:|---|
| Lesen (`ko.read`) | ✓ | ✓ | ✓ | ✓ | — |
| Erfassen/Erstellen (`ko.create`) | — | ✓ | ✓ | ✓ | handelt als „Experte" (wirksame Rolle) |
| **Fremden Beitrag prüfen** (`ko.validate`) | — | **✓ (neu)** | ✓ | ✓ | **nie eigenen** (Autor/originalAuthor) |
| Prüfer zuweisen (`ko.assign`) | — | — | ✓ | ✓ | Autor ausgeschlossen |
| Konflikt eskalieren/auflösen (`conflict.resolve`) | — | — | ✓ | ✓ | nicht als Beteiligter |
| Zweitmeinung geben | — | ✓ | ✓ | ✓ | nur zugewiesen, nie eigener Beitrag |
| Nutzer verwalten (`users.manage`) | — | — | — | ✓ | Letzter-Admin-Schutz |

**Grenzfrage „Darf ein Experte den Beitrag eines Admins prüfen?"** — Auftraggeber sagt ja, und das ist konsistent: Prüfrecht hängt an „fremd + Rolle ≥ Experte", nicht an der Rolle des Autors. **Einzige sinnvolle Ausnahme:** Es sollte weiterhin gelten, dass Nutzer-**Verwaltung** (Rollen vergeben, Konten anlegen) Admin-exklusiv bleibt — das ist kein Prüf-, sondern ein Governance-Recht und wird von B nicht berührt. Der bestehende **Letzter-Admin-Schutz** (`canChangeRole`) bleibt unangetastet.

### B.5 · UI-Konsequenzen

- **Wirksame Rolle sichtbar machen:** Wo ein Experte gerade einen fremden Beitrag prüft, zeigt die Oberfläche einen ruhigen Hinweis „Du prüfst als Kontrolleur" (bzw. beim Erstellen „Du erfasst als Experte"). Kein Modus-Umschalter — die App leitet es aus der Handlung ab und benennt es nur.
- **Eigene Beiträge:** Am eigenen Beitrag ist der Prüf-Button nicht aktiv, mit ehrlichem Hinweis „Eigene Beiträge prüfen Kolleg:innen (Vier-Augen-Prinzip)" — statt eines stummen Fehlers.
- **Prüf-/Zweitmeinungs-Auswahl:** Personenlisten blenden den Autor aus bzw. zeigen ihn ausgegraut mit Begründung.
- **Konsistenz DE/EN** für alle neuen Texte.

### B.6 · Randfälle

- **Autor = originalAuthor vs. aktueller Bearbeiter:** Ausschluss gilt für **beide** (`author` und `originalAuthor`), damit auch der Erst-Autor nach einer Übergabe seinen eigenen Ursprungsbeitrag nicht „fremd" prüft. Empfehlung: konservativ beide ausschließen.
- **Mehrautoren durch Revision/Übergabe:** Wer je Autor einer Version war, gilt für diesen Beitrag als befangen. Umsetzbar über die vorhandene `history[]` (Autoren je Version). Für die Ersteinführung reicht `author` + `originalAuthor`; die History-Erweiterung ist ein optionales Verschärfungs-Ticket.
- **Admin als einziger Prüfer verfügbar (kleines Team):** Wenn außer dem Autor niemand prüfberechtigt ist, muss die App das **ehrlich** sagen („Zurzeit ist keine unabhängige Prüfung möglich — weitere Konten mit Prüfrecht nötig"), statt den Autor doch prüfen zu lassen. Das ist die Vier-Augen-Integrität über Bequemlichkeit.
- **Rollen-Downgrade während offener Aufträge:** Verliert jemand das Prüfrecht, während er einen offenen Prüf-/Zweitmeinungsauftrag hat, wird der Auftrag ungültig markiert (nicht still gelöscht) und neu zugewiesen.

### B.7 · Offene Entscheidungen — mit Empfehlung

1. **Guard-Erweiterung: Matrix+Service-Check (i) vs. ressourcenbewusster Guard (ii).** → **Empfehlung: beides, mit Service-Check als verbindlicher Wahrheit.** Grund: Der Guard ist die testbare Grobschranke (Route-Guard-Audit bleibt aussagekräftig), aber nur der Service kennt Ressource+Autor sicher — dort darf der Schutz nicht umgehbar sein.
2. **Autor-Begriff für Befangenheit: `author` allein vs. `author`+`originalAuthor` vs. alle History-Autoren.** → **Empfehlung: `author`+`originalAuthor` in Stufe 1**, alle History-Autoren als optionale Verschärfung.
3. **Wirksame Rolle: nur anzeigen vs. auch auditieren.** → **Empfehlung: beides** — anzeigen (Transparenz) **und** im Audit die wirksame Rolle mitschreiben (Q-Audit), damit später nachvollziehbar ist, „als was" jemand gehandelt hat.

**Umsetzungs-/Migrationsrisiken (Block B):** (1) `experte → ko.validate` in der Matrix ändert die Route-Guard-Erwartung — der Guard-Audit-Test und die Rechte-Tests müssen mitgezogen werden. (2) Der Autor-Ausschluss muss **an allen** relevanten Service-Eintrittspunkten sitzen (rate, Zweitmeinung, Konflikt-Aktionen) — eine vergessene Stelle wäre eine Vier-Augen-Lücke; ein gemeinsamer Helfer `assertNotSelfReview(actor, ...beteiligte)` reduziert das Risiko. (3) Kleine Teams: der „keine unabhängige Prüfung möglich"-Fall muss getestet sein, sonst blockiert er stillschweigend den Kreislauf.

---

## C · Datei-Handling & Quellen-Vermerk

### C.1 · Ziel-Logik in Worten

Überall, wo man eine Datei hochlädt (Erfassen, Studio, KO-Detail), muss man sie **wieder löschen** können. Dabei sind **zwei Fälle** sauber zu trennen: Eine Datei, die nur **hochgeladen**, aber noch **nicht als benannte Quelle zitiert** wurde, ist ein loser Anhang — sie darf **still** verschwinden. Eine Datei, die bereits **als benannte Quelle angehängt und genannt** wurde, ist Teil der Beleg-Geschichte des Wissens — ihr Entfernen darf die Geschichte nicht spurlos löschen, sondern hinterlässt einen **dauerhaften, sichtbaren Vermerk** („Quelle ‚…' am … entfernt"), damit spätere Leser den Vorgang nachvollziehen. Das ist die Datei-Ebene desselben Prinzips wie überall: **nichts verschwindet unbelegt aus der Nachvollziehbarkeit.**

### C.2 · Datenmodell-Auswirkungen

Der Code trennt bereits **Anhang** (`KoAttachment`: `objectId`/`dataUrl`, Thumbnail) von **Quelle** (`KoSource`: `label`, `url`, `excerpt`, `kind:"external"`, `peerValidated:false`). Beim Erfassen sammelt `captureSources` „pending sources" lokal und hängt sie erst beim Speichern an. Der Object-Store hält die eigentliche Datei (`/api/objects/:id/raw`), `bodyFileLink` referenziert sie sicher im Fließtext.

**Der Unterschied „schon zitiert?" ist heute nicht explizit modelliert.** Ich schlage vor, ihn ableitbar zu machen statt ein Flag zu pflegen:

- Eine hochgeladene Datei gilt als **„als Quelle genannt"**, sobald ein `KoSource`-Eintrag existiert, dessen Beleg auf sie zeigt, **oder** sobald sie über `bodyFileLink` im `bodyHtml` referenziert ist. Beides ist aus dem Bestand ableitbar — kein neues Feld nötig.
- Für den **Vermerk** kommt ein leichter, additiver Datensatz hinzu:

```
interface SourceRemovalNote {   // additiv, JSON-persistiert am KO (wie sources[])
  id: string
  removedSourceLabel: string    // eingefrorener Name der entfernten Quelle
  removedSourceRef?: string      // ehemalige objectId/sourceId (informativ)
  reason?: string                // optionaler Freitext des Löschenden
  by: string
  at: string
}
```

Dieser Vermerk lebt **am KO** (sichtbar für Leser, Teil der Provenienz) **und** als Audit-Ereignis (`ko.source-removed`, unveränderlich). Bewusst redundant: Der KO-Vermerk ist die *lesbare* Spur für Fachnutzer, das Audit die *manipulationssichere* Spur.

### C.3 · Workflow

**Fall (a) — loser Upload, noch nicht zitiert:**
1. Nutzer entfernt die Datei (Erfassen/Studio/KO-Detail).
2. System prüft: existiert eine `KoSource` oder `bodyHtml`-Referenz darauf? **Nein** →
3. Datei/Anhang wird entfernt, Object-Store-Objekt freigegeben; **kein** Pflicht-Vermerk (optional ein leiser Audit-Eintrag `attachment.removed`). Kein sichtbarer Leser-Hinweis.

**Fall (b) — bereits als Quelle genannt:**
1. Nutzer entfernt die Quelle/Datei.
2. System erkennt die Zitat-Beziehung → **Bestätigungsdialog** mit ehrlichem Hinweis: „Diese Datei ist als Quelle ‚…' genannt. Beim Entfernen bleibt ein sichtbarer Vermerk erhalten." (optionales Grund-Freitextfeld).
3. Bestätigung → `KoSource`/Anhang entfernt, **`SourceRemovalNote` geschrieben** (am KO) + Audit `ko.source-removed`. Belegstellen im `bodyHtml`, die auf die Datei zeigten, werden **nicht** stillschweigend gelöscht: Der tote Link wird durch einen **markierten Textvermerk** ersetzt („Quelle entfernt am …"), damit der Fließtext ehrlich bleibt (s. C.4-Integrität).
4. Object-Store-Objekt: freigeben **erst**, wenn keine andere Referenz mehr darauf zeigt (dieselbe Datei kann mehrfach zitiert sein).

### C.4 · Rollen-/Rechte-Wirkung

- **Wer darf löschen?** Empfehlung: der **Autor** seines eigenen Beitrags (solange in Bearbeitung/vor Validierung), sowie **Controller/Admin** jederzeit. Nach Validierung sollte das Entfernen einer *zitierten* Quelle eine stärkere Rolle verlangen (Controller/Admin), weil es die Beleglage eines gesicherten KO verändert — konsistent mit dem Grundsatz, dass gesichertes Wissen nicht still verändert wird.
- Das Entfernen einer zitierten Quelle an einem **validierten** KO sollte zusätzlich als **Revalidierungs-Anlass** vorgeschlagen werden (nicht erzwungen) — die Beleglage hat sich geändert.

### C.5 · UI-Konsequenzen

- Überall ein **Papierkorb-/Entfernen-Icon** an Uploads/Quellen (heute teils vorhanden, vereinheitlichen).
- Fall (b): **Bestätigungsdialog** in neutraler Fläche (die CI-Regel aus SCRUM-412 beachten: destruktive Farbe nur am Aktionsknopf), mit dem Satz, dass ein Vermerk bleibt.
- **Leser-Sicht:** entfernte Quellen erscheinen als ruhiger, ausgegrauter Vermerk in der Quellen-/Provenienz-Sektion („Quelle ‚…' entfernt am … von …"), nicht als Fehler. Der Vermerk ist **unveränderlich**.
- DE/EN für alle Texte.

### C.6 · Randfälle

- **Dieselbe Datei mehrfach zitiert** (mehrere Belegstellen aus einer Datei — `captureSources` erlaubt das bewusst): Erst wenn die **letzte** Zitat-Referenz entfernt ist, wird das Object-Store-Objekt freigegeben; jeder Entfern-Vorgang erzeugt seinen eigenen Vermerk.
- **Datei zitiert **und** als Body-Link:** beide Referenzarten prüfen; der Body-Link wird zum Textvermerk, die Quelle zum `SourceRemovalNote`.
- **Löschen des ganzen KO:** die Quellen-Vermerke sind Teil des KO und wandern mit in den Papierkorb; bei Endlöschung entfällt der Leser-Vermerk, aber das **Audit** (`ko.source-removed`) bleibt.
- **Externe Quelle ohne Datei** (nur URL/Label, kein Upload): dieselbe Vermerk-Logik greift — auch eine genannte URL-Quelle hinterlässt beim Entfernen einen Vermerk.

### C.7 · Offene Entscheidungen — mit Empfehlung

1. **„Zitiert?" per Flag vs. Ableitung.** → **Empfehlung: Ableitung** (aus `sources[]` + `bodyHtml`-Referenz). Kein pflegebedürftiges Flag, keine Migration.
2. **Vermerk am KO vs. nur Audit vs. beides.** → **Empfehlung: beides** — lesbarer KO-Vermerk (Provenienz) + unveränderliches Audit. Der Auftrag will „für spätere Leser dokumentieren" → der sichtbare KO-Vermerk ist Pflicht, das Audit die Absicherung.
3. **Löschrecht für zitierte Quellen an validierten KOs.** → **Empfehlung: Controller/Admin, mit Revalidierungs-Vorschlag.** Autor darf lose Uploads und Quellen an *noch nicht validierten* eigenen Beiträgen frei entfernen.

**Umsetzungs-/Migrationsrisiken (Block C):** (1) Die „letzte Referenz?"-Freigabe im Object-Store braucht eine korrekte Referenzzählung — sonst verwaisen Objekte oder werden zu früh gelöscht (Belegstelle bricht). (2) Der Body-Link→Textvermerk-Ersatz muss durch den bestehenden Sanitizer laufen (keine neue HTML-Freiheit). (3) `SourceRemovalNote` additiv am KO — keine Migration, aber die Export-/Snapshot-Pfade (Bibliothek-Export, KoVersionSnapshot) sollten den Vermerk mitführen, sonst „verschwindet" er im Export.

---

## D · „Aus Datei"-Erfassung (Import-Ablauf)

### D.1 · Ziel-Logik in Worten

Aus einem Dokument erzeugt die KI eine **Punkteliste** möglicher Wissenseinträge (mit wörtlicher Belegstelle je Punkt, G-2). Der heutige Ablauf schickt die ausgewählten Punkte als **Warteschlange einzeln** durch den Wizard (`FileDraftQueue`, `advanceFileQueue`) und ist nach dem letzten Punkt zu Ende. Das Ziel behebt vier konkrete Schwächen, die Arbeit **verlieren** oder den Nutzer **einsperren**: Der Import muss jederzeit **abbrechbar** sein; man muss **alle auf einmal wählen/abwählen** können; nach dem „Verbinden"/Verarbeiten von Punkten darf der Ablauf **nicht automatisch weiterspringen** (sonst gehen die übrigen gefundenen Punkte aus dem Blick); und bleibt am Ende **mehr als ein** Punkt übrig, muss man sie **als Entwürfe speichern und von dort weiter erfassen** können. Kurz: **Die gefundene Liste ist das bleibende Arbeitsmaterial; nichts daran verschwindet ungewollt, und niemand wird durch einen Auto-Sprung aus der Übersicht geworfen.**

### D.2 · Datenmodell-Auswirkungen

Rein **Frontend-Zustand** (keine Backend-Entität nötig; die Bausteine existieren: `SelectableExtractPoint`, `createPointDrafts`, `mergedDraftFromPoints`, Draft-Pool FE-CAP-07). Ich schlage vor, den heutigen linearen `FileDraftQueue{index}` durch eine **Liste mit Status je Punkt** zu ersetzen (bzw. zu ergänzen):

```
type ImportPointStatus = "open" | "connected" | "saved" | "discarded"
interface ImportPoint extends SelectableExtractPoint {
  status: ImportPointStatus
  groupId?: string          // bei "connected": Kennung der Verbindungsgruppe
  draftId?: string          // bei "saved": Referenz auf den erzeugten Entwurf
}
interface ImportSession {
  fileName: string
  points: ImportPoint[]      // die BLEIBENDE Gesamtliste über alle Schritte
  createdAt: string
}
```

Der Import ist damit eine **stehende Liste**, kein durchlaufender Zeiger. „Verarbeitete" Punkte bleiben sichtbar (als `connected`/`saved` markiert), statt aus der Queue zu fallen.

### D.3 · Begriff „Verbinden/Verbunden" — präzise

Der Auftrag lässt drei Lesarten zu. Ich definiere verbindlich (und empfehle): **„Verbinden" = mehrere gefundene Punkte werden zu EINEM Wissenseintrag zusammengeführt** (fachlich: sie beschreiben denselben Sachverhalt und sollen ein KO werden). Das entspricht dem vorhandenen `mergedDraftFromPoints` (≥2 Punkte → 1 Entwurf, alle Belegstellen im Body, Quelle je Punkt). **Nach dem Verbinden bleiben die Ursprungspunkte in der Liste sichtbar, als `connected` (Gruppe G) markiert** — sie sind nicht weg, sondern erkennbar „zu einem Eintrag zusammengefasst". Das ist genau die Auftragsforderung „sollen wieder in der Liste erscheinen (als verbunden markiert)".

Abgrenzung: „Verbinden" ist **nicht** „Verknüpfen" (zwei eigenständige KOs mit einer Beziehung) und **nicht** nur „Markieren". Falls ihr später *auch* echtes Verknüpfen wollt, ist das ein separates Feature (SCRUM-433 „Erkenntnisse verbinden" geht in diese Richtung) — hier meint „verbinden" das Zusammenführen zu einem Entwurf.

### D.4 · Workflow / Zustandsübergänge

```
Dokument hochladen → KI-Punkteliste (alle "open", alle vorausgewählt)
  ├─ [Alle wählen] / [Alle abwählen]          ← Massenauswahl (neu)
  ├─ je Punkt: Checkbox an/aus
  ├─ [Verbinden] (≥2 gewählte)  → gewählte Punkte → status "connected" (groupId=G),
  │      EIN merged-Entwurf entsteht → Studio öffnet sich für diesen Entwurf,
  │      ABER die Liste bleibt bestehen; nach Studio zurück zur Liste (KEIN Auto-Sprung)
  ├─ je Punkt: [Als Entwurf speichern] → status "saved" (draftId), bleibt sichtbar
  ├─ [Auswahl als Entwürfe speichern] (mehrere) → createPointDrafts, alle → "saved"
  ├─ je Punkt: [Überspringen/Verwerfen] → status "discarded" (bleibt sichtbar, ausgegraut)
  └─ [Import abbrechen]  → Bestätigung → Session beenden; bereits gespeicherte
         Entwürfe/„connected"-Ergebnisse BLEIBEN als Entwürfe erhalten (nichts verschwindet)
Ende: Bleibt >1 Punkt übrig (offen/verbunden), Angebot „Alle als Entwürfe speichern &
      weiter erfassen" → landet im Draft-Pool (FE-CAP-07); „weiter" führt in den Draft-Pool,
      NICHT automatisch in den nächsten Einzel-Wizard.
```

**Kernänderung gegenüber heute:** Der lineare `advanceFileQueue` (index++ → Ende) wird durch **explizite Nutzer-Aktionen auf einer stehenden Liste** ersetzt. Kein automatischer Sprung zum nächsten Punkt; der Nutzer bestimmt, wann er welchen Punkt bearbeitet. Der Einzel-Wizard-Weg (ein Punkt nach dem anderen) bleibt als *Option* erhalten, ist aber nicht mehr der erzwungene Default.

### D.5 · Rollen-/Rechte-Wirkung

Erfassen ist `ko.create` (Experte+). Keine neuen Rechte. Der aus dem Import erzeugte Inhalt ist ein **Entwurf** des importierenden Experten (er wird dessen Autor) und durchläuft anschließend den normalen Prüf-Kreislauf (inkl. der Vier-Augen-Regel aus Block B — ein anderer prüft).

### D.6 · UI-Konsequenzen

- **Massenauswahl:** „Alle wählen / Alle abwählen" als Kopf-Aktion über der Punkteliste (heute nur Einzel-`togglePoint`).
- **Bleibende Liste mit Status-Badges:** je Punkt sichtbar „offen / verbunden (Gruppe) / gespeichert / verworfen"; verbundene teilen ein Gruppen-Label; gespeicherte verlinken auf ihren Entwurf.
- **Abbrechen** jederzeit sichtbar, mit ehrlichem Hinweis, dass gespeicherte Entwürfe erhalten bleiben.
- **Kein Auto-Sprung:** nach „Verbinden"/„Speichern" kehrt der Fokus zur Liste zurück, nicht in den nächsten Punkt.
- **Import-Quittung** (SCRUM-409 hat `loadedStats` schon angelegt): „X gefunden · Y gespeichert · Z verbunden · verbleibend N".
- **Massen-Speichern-Abschluss:** „N Entwürfe gespeichert — im Erfassen-Pool weiterbearbeiten".
- DE/EN durchgängig.

### D.7 · Randfälle

- **Abbrechen mit teils gespeicherten Punkten:** gespeicherte Entwürfe bleiben (sie sind bereits echte Entwürfe im Pool); nur die *Import-Sitzung* endet. Klare Ansage im Dialog.
- **Verbinden, dann Studio verworfen:** Wird der merged-Entwurf im Studio verworfen, gehen die zugehörigen Punkte von `connected` **zurück auf `open`** (die Gruppe löst sich auf) — nichts ist verloren, der Nutzer kann neu entscheiden.
- **Ein Punkt in mehreren Verbindungen:** ausschließen — ein Punkt gehört zu höchstens einer aktiven Gruppe; erneutes Verbinden verschiebt ihn (mit Hinweis).
- **Sehr viele Punkte / sehr langes Dokument:** die Extraktion ist bereits abschnittsweise und deckelt (SCRUM-418/427); die Liste sollte bei sehr vielen Punkten virtualisiert/gruppiert dargestellt werden, damit sie bedienbar bleibt.
- **Doppelte Punkte** (KI findet denselben Sachverhalt zweimal): kein Auto-Merge; Hinweis „ähnlich zu Punkt X" als Angebot zum Verbinden.

### D.8 · Offene Entscheidungen — mit Empfehlung

1. **Lineare Queue behalten vs. stehende Statusliste.** → **Empfehlung: stehende Statusliste** (`ImportSession`), Einzel-Wizard als Option. Das ist die direkte Antwort auf „kein Auto-Sprung / nichts verlieren".
2. **„Weiter erfassen" nach Massen-Speichern — wohin?** → **Empfehlung: in den bestehenden Draft-Pool (FE-CAP-07)**, nicht in einen erzwungenen Einzel-Wizard. Der Nutzer wählt dort, welchen Entwurf er als Nächstes ausbaut.
3. **Abbruch-Semantik.** → **Empfehlung: Import-Sitzung endet, Entwürfe bleiben.** Nur die flüchtige Sitzung ist weg; alles bewusst Gespeicherte überlebt.
4. **Verbinden = Zusammenführen (nicht Verknüpfen).** → **Empfehlung: so definieren** (D.3); echtes Verknüpfen ist ein separates Thema.

**Umsetzungs-/Migrationsrisiken (Block D):** (1) Reiner FE-Umbau, keine Backend-/Migrationslast — aber `Capture.tsx` ist bereits sehr groß (~130 KB); der Import-Zustand sollte in eine eigene, testbare Lib (`importSession.ts`, DOM-frei) ausgelagert werden, sonst wächst die Monolith-Datei weiter (Audit-Befund M1). (2) Der Draft-Pool (FE-CAP-07) muss die aus Merge/Massen-Speichern erzeugten Entwürfe sauber aufnehmen (Titel/Body/Quelle je Punkt) — die Bausteine (`createPointDrafts`, `mergedDraftFromPoints`, `extractSectionsHtml`) existieren und werden nur neu orchestriert. (3) UI-Smoke: ein Kernfluss „Datei → mehrere Punkte → alle speichern → im Pool sichtbar" sollte in die Smoke-Suite, weil dieser Weg heute keinen Klick-Test hat.

---

## Q · Querschnitt — Rechte, Aufgaben, Audit, Modulgrenzen

Weil A, B und C/D dieselben Rechte- und Nachvollziehbarkeits-Fragen berühren, hier die verbindenden Festlegungen.

**Q-1 · Ein Vier-Augen-Grundsatz, eine Durchsetzungsstelle.** „Nie zum eigenen Beitrag" (prüfen, zweitmeinen, entscheiden) wird durch **einen** gemeinsamen Service-Helfer `assertNotSelfReview(actorId, ...beteiligteAutoren)` erzwungen, der in `validation` (rate), `conflicts` (secondOpinion/escalate/resolve) und in der Prüfer-/Zweitmeinungs-Zuweisung aufgerufen wird. Eine Stelle, überall genutzt, testbar — statt verstreuter Einzelprüfungen.

**Q-2 · Wirksame Rolle im Audit.** Jede Prüf-/Konflikt-/Rechtehandlung schreibt im Audit neben `actor` und `action` die **wirksame Rolle** (`effectiveRole`) mit. So ist später nachvollziehbar, dass „Admin X *als Kontrolleur* Beitrag Y geprüft" hat. Additiv zum bestehenden Audit-Payload, keine Ketten-Änderung.

**Q-3 · Modulgrenzen (dependency-cruiser).** Die heutigen Richtungen: `validation → knowledge-object`, `conflicts → audit`, `rbac → auth`. Neue Bedürfnisse und ihre saubere Auflösung:
- **Konflikt-Auflösung bei KO-Löschung** (A.4): **nicht** `knowledge-object → conflicts` (falsche Richtung). Stattdessen **Koordination im `app`-Composition-Root** per Ereignis/Hook — `app` darf beide kennen.
- **Zweitmeinungs-Aufgaben** (A.3): **nicht** `conflicts → validation` (Zweckvermischung/mögliche Kante). Stattdessen **eigenes Zweitmeinungs-Objekt in `conflicts`**; die „Meine Aufgaben"-Aggregation passiert im **Frontend** (das ohnehin beide APIs liest).
- **Vier-Augen-Helfer** (Q-1): als kleine, abhängigkeitsarme Funktion, die die Autoren-IDs als Parameter bekommt (kein Modul muss ein anderes dafür importieren).
Ergebnis: keine neuen Backend-Modulkanten, keine Zyklen — die Gate-Regel bleibt grün.

**Q-4 · Benachrichtigungen** (`notifications`): Zweitmeinungs-Auftrag, Eskalation, Auflösung, automatische Auflösung durch Löschung und Quellen-Entfernung an validierten KOs erzeugen je einen In-App-Feed-Eintrag an die jeweils Betroffenen — über das vorhandene Notification-/Feed-Muster (wie Prüfaufträge heute).

**Q-5 · Ein durchgängiges Audit-Vokabular** (neue Aktionen): `conflict.participant-added/removed`, `conflict.escalated`, `conflict.second-opinion.requested/answered/cancelled`, `conflict.resolved` (mit `reason`), `conflict.auto-resolved`, `ko.conflict-cleared`, `ko.source-removed`, `import.drafts-created`. Alle append-only, alle mit wirksamer Rolle.

---

## Anhang · Umsetzungsreihenfolge, Aufwand, Risiken

**Empfohlene Reihenfolge** (jede Stufe für sich gate-grün lieferbar):

| Stufe | Inhalt | Warum zuerst | grobe Größe |
|---|---|---|---|
| 1 | **Konflikt-Integrität bei Löschen** (A.4): `onParticipantRemoved`, Auto-Auflösung, „konfliktfrei"-Vermerk, Bestandsbereinigung, Board zeigt keine Fehler-Karten mehr | behebt einen **sichtbaren Bug** mit Datenintegritäts-Charakter; kleiner, klar abgegrenzter Nutzen | M |
| 2 | **Rollen-Umbau** (B): `experte → ko.validate` + verbindlicher Vier-Augen-Service-Check (Q-1), wirksame Rolle in UI+Audit | schaltet die vom Auftraggeber gewünschte Prüf-Breite frei; Voraussetzung für die Konflikt-Rechte in Stufe 3 | M |
| 3 | **Zweitmeinung/Eskalation strukturieren** (A.2/A.3): `SecondOpinion` + Zweitmeinungs-Auftrag, Adressaten, „Meine Aufgaben"-Aggregation, sprechende Pfad-Labels | macht die verwirrenden Aktionen (Eskalieren vs. Zweitmeinung) endlich unterscheidbar und adressierbar | L |
| 4 | **Datei-/Quellen-Vermerk** (C): Fall-a/-b-Trennung, `SourceRemovalNote`, Body-Link→Textvermerk | eigenständig, geringes Risiko, klarer Nachvollziehbarkeits-Gewinn | S–M |
| 5 | **Aus-Datei-Import als stehende Liste** (D): `ImportSession`, Massenauswahl, kein Auto-Sprung, Massen-Speichern → Pool | reiner FE-Umbau; hoher UX-Gewinn, kein Backend-Risiko | M |
| 6 | **Beteiligten-Verallgemeinerung + Kommentar-Konflikte** (A.2 Cluster, Kommentar als Beteiligter) | die konzeptionell größte, aber am wenigsten dringende Erweiterung — erst wenn 1–3 stehen | L |
| 7 | **Automatische Erkennung Stufe 1** (A.6, regelbasiert) | Komfort/Qualität, baut auf allem darüber auf | M |

**Querschnitts-Risiken (gesamt):** (1) Jede Rechte-Änderung zieht den Route-Guard-Audit-Test und die Rechte-Tests mit — diese bewusst mitpflegen (das Projekt hat dafür bereits die erzwungene Guard-Matrix). (2) Der einzige echte Architektur-Knoten ist die **KO-Löschung → Konflikt-Auflösung** über das App-Modul (Q-3, Weg 1) — sauber lösbar, aber der Punkt, an dem am ehesten eine falsche Modulkante entsteht; hier genau auf die Abhängigkeitsrichtung achten. (3) Alle Auto-Auflösungs- und Freigabe-Pfade müssen **idempotent** sein (Soft-Delete, Endlöschung, Bereinigung, doppelte Events). (4) `Capture.tsx` nicht weiter aufblähen — neue Import-Logik als DOM-freie Lib. (5) Prinzipien-Check als Abnahme jeder Stufe: **kein** automatischer `status`/`trust`-Schreibvorgang, **jede** Zustandsänderung im Audit, **jede** Vier-Augen-Regel serverseitig erzwungen.

**Konsistenz mit den Leitprinzipien (Selbstprüfung):**
- *„Nichts gilt ungeprüft."* → Automatische Erkennung nur als Vorschlag; Wiederherstellung reaktiviert Konflikte nicht still; Bearbeiten löst nicht automatisch auf. ✓
- *„Kein stilles Überschreiben."* → „Konfliktfrei" und Konflikt-Wirkung bleiben hinweisend; keine automatische KO-`status`/`trust`-Mutation (bestehende Architektur bleibt). ✓
- *Beleg-/Nachvollziehbarkeit.* → `SourceRemovalNote` + durchgängiges Audit-Vokabular; auch automatische Auflösungen sind protokolliert. ✓
- *Mensch in der Schleife / Vier-Augen.* → ein gemeinsamer Service-Check, Autor nie Prüfer/Entscheider des eigenen Beitrags. ✓

---

*Ende des Fachkonzepts. Ausgearbeitet in einem Durchgang gemäß Auftrag; alle mehrdeutigen Punkte sind als „Offene Entscheidung mit Empfehlung" oder als benannte Annahme (Abschnitt 0) markiert und ohne weiteren Konzept-Durchlauf umsetzbar. Kein Code, keine Tickets, keine Konfiguration verändert — reine Beratungsleistung.*
