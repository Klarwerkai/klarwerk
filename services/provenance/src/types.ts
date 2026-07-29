// ================================================================================================
// AUFTRAG-mega45 BLOCK A — DIE HERKUNFTSKETTE EINES WISSENSOBJEKTS (Epic SCRUM-545, Stufe 1).
// ================================================================================================
//
// „Klarwerk wird nicht nur durchsucht — Klarwerk zeigt, wie Wissen entsteht, wodurch es belegt ist,
// wo es widersprüchlich ist und welche Entscheidungen davon abhängen." Für den ANWENDER ist das
// kein Gesamtgraph, sondern die Herkunft EINES Objekts: Original → Beleg → Aussage → Prüfung →
// Widerspruch.
//
// WARUM DIESES MODUL SEINE EIGENEN EINGABEFORMEN DEFINIERT (Entscheidung zu A1):
// Es importiert WEDER knowledge-object NOCH conflicts NOCH model-runs. Das ist kein Selbstzweck,
// sondern das bereits eingeführte Muster dieses Repos: `services/conflicts` kennt
// `knowledge-object` nicht und lässt sich seine Gegenstände als modul-reine `DetectSubject`
// reichen (s. services/conflicts/index.ts). Der Kompositionswurzel-Code in `services/app` bildet
// den Bestand auf diese Formen ab. Drei Gründe:
//   1. `dependency-cruiser` bleibt ohne neue Kanten grün — die Projektion hängt an NIEMANDEM.
//   2. Die Projektion wird eine REINE Funktion ohne Datenbank. Der Rechte-Sammler aus Block C kann
//      sie damit über die Bauform erschöpfend durchfahren, statt eine Datenbank zu stellen.
//   3. Die Rechteentscheidung fällt VOR der Projektion (A3) und kommt als DATUM herein. Genau das
//      erzwingt die Form `ProvenanceGegenseite` unten.
//
// STRIKT LESEND (A4): hier entsteht kein Schreibweg, keine Mutation, kein neuer Vertrag an
// bestehenden Modulen. Alles additiv.

// ------------------------------------------------------------------------------------------------
// Knoten- und Kantenarten — AUSSCHLIESSLICH aus dem vorhandenen Bestand.
// ------------------------------------------------------------------------------------------------

/**
 * Die Knotenarten. Jede entspricht einer Entität, die es HEUTE gibt:
 *  · wissensobjekt — KnowledgeObject
 *  · quelle        — KoSource (SCRUM-129/FR-KO-07)
 *  · beleg         — EvidenceRecord (SCRUM-160), seit mega26 mit dem GRUND der Verknüpfung
 *  · original      — KoAttachment (das Originaldokument am Objekt)
 *  · konflikt      — Conflict (services/conflicts)
 *  · pruefung      — KoVersionSnapshot (SCRUM-159), die geprüfte/abgelöste Fassung
 *  · modelllauf    — ModelRunRecord (SCRUM-164), seit mega26 mit Laufkontext
 *
 * Neue Knotentypen des Epics (Claim, Decision, Entity — Stufe 0) sind AUSDRÜCKLICH nicht
 * Gegenstand: für sie gibt es im Bestand keinen Erzeuger, und was keinen Erzeuger hat, wird hier
 * nicht erfunden.
 */
export type ProvenanceNodeKind =
  | "wissensobjekt"
  | "quelle"
  | "beleg"
  | "original"
  | "konflikt"
  | "pruefung"
  | "modelllauf";

/**
 * Die Kantenarten — jede aus vorhandenen Daten ABGELEITET, keine erfunden:
 *  · belegt_durch — aus dem EvidenceRecord, mit dessen `excerpt` als Kantentext (mega26 Block B)
 *  · stammt_aus   — Beleg → Original/Anhang
 *  · widerspricht — aus dem Konflikt, mit dem wörtlichen Belegzitat
 *  · loest_ab     — aus der Versionsfolge
 *  · erzeugt_von  — aus dem Laufkontext des Modelllaufs (mega26 Block A)
 */
export type ProvenanceEdgeKind =
  | "belegt_durch"
  | "stammt_aus"
  | "widerspricht"
  | "loest_ab"
  | "erzeugt_von";

/**
 * Der Status eines Knotens. Die ersten fünf Werte sind die vom Auftrag benannten.
 *
 * `vermerk` ist der SECHSTE und eine bewusste, hier begründete Ergänzung: Quelle, Beleg, Original
 * und Modelllauf sind AUFZEICHNUNGEN, keine Aussagen über Wahrheit. Ihnen einen der fünf Werte zu
 * geben, wäre genau die Verwechslung, gegen die B3 antritt — eine angehängte Quelle wäre sonst
 * „menschlich geprüft", nur weil ein Mensch sie angehängt hat. `vermerk` sagt ehrlich: dieser
 * Knoten belegt, dass etwas GESCHAH, und behauptet nichts über den Wahrheitsgehalt.
 */
export type ProvenanceNodeStatus =
  | "entwurf"
  | "maschinell_bestaetigt"
  | "menschlich_geprueft"
  | "veraltet"
  | "abgeloest"
  | "vermerk";

// ------------------------------------------------------------------------------------------------
// Das Ergebnis.
// ------------------------------------------------------------------------------------------------

export interface ProvenanceNode {
  /** Stabile, artpräfixierte Knotenkennung (z. B. "beleg:ev-1"). */
  id: string;
  kind: ProvenanceNodeKind;
  label: string;
  status: ProvenanceNodeStatus;
  /** Zeitpunkt, wo der Bestand einen führt. Nie geraten. */
  at?: string;
  /**
   * B3: FEHLT DEM OBJEKT DER BELEG, IST GENAU DAS SICHTBAR — statt dass die Stelle leer bleibt.
   * Nur am Wurzelobjekt gesetzt.
   */
  unbelegt?: boolean;
  /** Zusatzzeile im Klartext (Anbieter, Konfliktart, Modell). Nie ein Wahrheitsversprechen. */
  detail?: string;
}

/**
 * A2 — JEDE KANTE TRÄGT IHRE HERKUNFT. Kennung, Erzeuger, Zeitpunkt und, wo vorhanden, die
 * Begründung. Es gibt in diesem Modul KEINEN Weg, eine Kante ohne `herkunft` zu bauen: das Feld
 * ist pflichtig, und die Projektion lässt eine Beziehung, deren Erzeuger im Bestand fehlt,
 * schlicht WEG (und meldet sie im Prüfprotokoll). Das ist die Regel, an der die Hand in mega23 zu
 * Recht angehalten hat.
 */
export interface ProvenanceEdgeOrigin {
  /** Wer die Beziehung erzeugt hat — Nutzerkennung oder benannte Erkennung. Nie leer. */
  by: string;
  /** Wann. Nie leer. */
  at: string;
  /** Warum — z. B. der `excerpt` des Evidence-Records oder die Begründung der Erkennung. */
  reason?: string;
}

export interface ProvenanceEdge {
  id: string;
  kind: ProvenanceEdgeKind;
  from: string;
  to: string;
  origin: ProvenanceEdgeOrigin;
}

/**
 * A3 — DIE UMFANGS-KÜRZUNG WIRD AUSGEWIESEN. Eine abgeschnittene Darstellung, die vollständig
 * aussieht, ist schlimmer als keine.
 *
 * Was hier BEWUSST NICHT steht, ist die Rechte-Kürzung. Sie hat in dieser Struktur kein Feld, weil
 * jede Zahl, jedes Merkmal, jeder Rest von ihr genau das verriete, was sie schützen soll. Sie wird
 * ausschliesslich im `ProvenanceAudit` gezählt — und der verlässt den Server nicht.
 */
export interface ProvenanceScopeCut {
  byScope: boolean;
  omittedNodes: number;
}

export interface ProvenanceGraph {
  root: string;
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  truncated: ProvenanceScopeCut;
}

/**
 * Das PRÜFPROTOKOLL der Projektion — ausdrücklich NICHT Teil der Antwort an den Anwender.
 * Es trägt die beiden Zahlen, die im Bild fehlen müssen bzw. dort nichts zu suchen haben:
 * die rechtebedingten Auslassungen und die Beziehungen ohne Erzeuger.
 *
 * Die Trennung ist der Kern von A3: `graph` geht an den Client, `audit` niemals. Der Rechte-Sammler
 * aus Block C prüft genau diese Grenze.
 */
export interface ProvenanceAudit {
  /** Wie viele Knoten die Rechteprüfung entfernt hat. Erscheint NIE im Graphen. */
  redactedByRights: number;
  /** Beziehungen, die es im Bestand gibt, denen aber der Erzeuger fehlt — deshalb nicht projiziert. */
  droppedWithoutOriginator: { kind: ProvenanceEdgeKind; ref: string; grund: string }[];
}

export interface ProvenanceProjection {
  graph: ProvenanceGraph;
  audit: ProvenanceAudit;
}

// ------------------------------------------------------------------------------------------------
// Die Eingabe — der Bestandsauszug, den die Kompositionswurzel zusammenträgt.
// ------------------------------------------------------------------------------------------------

export interface ProvenanceKoIn {
  id: string;
  titel: string;
  status: "offen" | "validiert";
  version: number;
  /** Die Hintergrund-KI-Prüfung ist erfolgreich durchgelaufen (KnowledgeObject.aiCheck). */
  maschinellGeprueft: boolean;
}

export interface ProvenanceQuelleIn {
  id: string;
  bezeichnung: string;
  anbieter?: string;
  /** KoSource.author — der Erzeuger dieser Quelle. */
  urheber: string;
  /** KoSource.at */
  zeitpunkt: string;
}

export interface ProvenanceOriginalIn {
  id: string;
  bezeichnung: string;
  /** KoAttachment.author */
  urheber: string;
  /** KoAttachment.at */
  zeitpunkt: string;
}

export interface ProvenanceBelegIn {
  id: string;
  art: "source" | "attachment";
  /** Auf welche Quelle bzw. welches Original sich der Beleg bezieht. */
  quelleId?: string;
  originalId?: string;
  bezeichnung: string;
  /** mega26 Block B: der GRUND der Verknüpfung. Fehlt bei Altbestand und bei Anhängen. */
  grund?: string;
  /** EvidenceRecord.createdBy */
  urheber: string;
  /** EvidenceRecord.createdAt */
  zeitpunkt: string;
}

export interface ProvenanceVersionIn {
  version: number;
  /** KoVersionSnapshot.author */
  urheber: string;
  /** KoVersionSnapshot.at */
  zeitpunkt: string;
  vermerk: string;
}

/**
 * A3, DER GEFÄHRLICHSTE TEIL — DIE GEGENSEITE EINES KONFLIKTS.
 *
 * Ein Anwender sieht die Kette eines Objekts, das er ohnehin sehen darf. Die Kette kann aber zu
 * einem Objekt führen, das er NICHT sehen darf — der häufigste Fall ist ein Konflikt mit einem
 * vertraulicheren Wissensobjekt.
 *
 * Diese Form erzwingt die Lösung baulich: ist die Gegenseite nicht sichtbar, trägt der Datensatz
 * ÜBERHAUPT KEINE Angabe über sie — keine Kennung, keinen Titel, keine Stufe, kein Kürzel. Die
 * Projektion KANN nichts verraten, weil sie nichts bekommt. Die Entscheidung selbst fällt vorher
 * und serverseitig in der Kompositionswurzel (services/app), wo beide Module im Zugriff sind.
 */
export type ProvenanceGegenseite =
  | { sichtbar: true; id: string; titel: string }
  | { sichtbar: false };

export interface ProvenanceErkennerIn {
  bezeichnung: string;
  begruendung?: string;
  /** Wörtliches Belegzitat der Erkennung. */
  zitat?: string;
}

export interface ProvenanceKonfliktIn {
  id: string;
  art: string;
  /**
   * Die Beschreibung des Konflikts. ACHTUNG — sie zitiert regelmässig BEIDE Seiten wörtlich. Bei
   * unsichtbarer Gegenseite ist sie deshalb selbst ein Verräter und darf den Server nicht
   * verlassen; die Projektion lässt den ganzen Knoten weg, nicht nur den Titel der Gegenseite.
   */
  beschreibung: string;
  status: string;
  gegenseite: ProvenanceGegenseite;
  /** Conflict.origin — "manual" | "auto"; fehlt bei Altbestand (gilt als manuell). */
  herkunft?: "manual" | "auto";
  /** Conflict.detector — nur bei origin="auto". */
  erkenner?: ProvenanceErkennerIn;
  /** mega26 Block B: Conflict.createdBy. FEHLT systematisch bei manuellem Altbestand. */
  urheber?: string;
  zeitpunkt: string;
}

export interface ProvenanceLaufIn {
  id: string;
  aufgabe: string;
  anbieter: string;
  modell?: string;
  /** mega26 Block A: ModelRunRecord.actor — der authentifizierte Anfragende. Optional. */
  akteur?: string;
  zeitpunkt: string;
}

export interface ProvenanceInput {
  ko: ProvenanceKoIn;
  quellen: readonly ProvenanceQuelleIn[];
  originale: readonly ProvenanceOriginalIn[];
  belege: readonly ProvenanceBelegIn[];
  versionen: readonly ProvenanceVersionIn[];
  konflikte: readonly ProvenanceKonfliktIn[];
  laeufe: readonly ProvenanceLaufIn[];
}
