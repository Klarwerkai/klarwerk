// FR-CON-01: klassifizierte Konfliktarten.
export type ConflictType = "truth" | "experience" | "context" | "temporal" | "role";

export type ConflictStatus = "offen" | "eskaliert" | "zweitmeinung" | "geloest";

// R-0252 (Aufnahme gesamt-konfliktklassifikation): die ART DER NÖTIGEN ARBEIT — eine zweite Achse
// neben `ConflictType`, nicht deren Ersatz. Die fünf Arten sagen, wie ein Konflikt auf den
// Vertrauenswert wirkt (und dass nur „truth" eskaliert); die Arbeitsart sagt dem Prüfenden VORAB,
// womit er es zu tun hat:
//   regel   — zwei interne Festlegungen; keine Quelle der Welt entscheidet, nur eine befugte Person,
//   sache   — durch Belege entscheidbar,
//   version — dieselbe Sache in zwei Ständen.
// Additiv/optional, JSON-persistiert (keine Migration).
//
// UNABHÄNGIG VON DEN FÜNF ARTEN BESTIMMT (Ben, Nacharbeit 2): sie wird NICHT aus `type` abgeleitet —
// ein Widerspruch zweier interner Festlegungen ist ein Wahrheitskonflikt UND ein Regelkonflikt.
// Woher sie kommt:
//   · manuelle Anlage — der Mensch wählt sie,
//   · automatische Erkennung — „ueberholt" ist eine Sache in zwei Ständen (version); bei
//     „widerspruch" ordnet die Konfliktprüfung selbst ein (`arbeit`: regel/sache, detect.ts).
// Fehlt sie, ist sie NICHT bestimmt — die Oberfläche sagt genau das und rät nichts.
export type ConflictWorkKind = "regel" | "sache" | "version";

export const CONFLICT_WORK_KINDS: readonly ConflictWorkKind[] = ["regel", "sache", "version"];

/** Prüft den rohen Drahtwert, BEVOR er den Dienst erreicht (Muster `isHumanOverlapCloseReason`). */
export function isConflictWorkKind(wert: unknown): wert is ConflictWorkKind {
  return typeof wert === "string" && (CONFLICT_WORK_KINDS as readonly string[]).includes(wert);
}

// ================================================================================================
// R-0263 — GELTUNGSBEREICH UND VORRANG ZWISCHEN WISSENSPUNKTEN.
// ================================================================================================
//
// Die Einheit ist der einzelne Punkt (das Wissensobjekt), nie das Dokument: eine Konfliktentscheidung
// legt den Vorrang zwischen GENAU den zwei beteiligten Punkten fest und sonst nichts. Kein Objekt wird
// dabei verändert — Inhalt, Status, Quellen und Dokumentherkunft beider Seiten und aller übrigen
// Punkte desselben Dokuments bleiben stehen. Die Wirkung ist eine sichtbare, gelesene Beziehung.
//
//   ueberstimmt   — die eine Aussage gilt, die andere wird an dieser Stelle überstimmt
//                   („Links gilt" / „Rechts gilt", beim Versionskonflikt „… Stand gilt").
//   schraenkt_ein — PRÄZISIERUNG: die speziellere Aussage gilt in ihrem Geltungsbereich, die
//                   allgemeinere bleibt außerhalb davon gültig („10 Nm für Bolzen X" hebt „alle
//                   handfest" nicht auf). Der Geltungsbereich ist dann Pflicht.
//
// Wer was festlegt, entscheidet ein Mensch mit `conflict.resolve` — nie das Modell.
export type VorrangArt = "ueberstimmt" | "schraenkt_ein";

export const VORRANG_ARTEN: readonly VorrangArt[] = ["ueberstimmt", "schraenkt_ein"];

/** Die Wahl des Menschen, wie sie die Entscheidung mitbringt. `gilt` ist die Kennung einer Seite. */
export interface VorrangWahl {
  art: VorrangArt;
  gilt: string;
  geltungsbereich?: string | null;
}

/** Die abgelegte Beziehung am entschiedenen Konflikt. */
export interface KonfliktVorrang {
  art: VorrangArt;
  /** Der Punkt mit Vorrang — bei `schraenkt_ein` der speziellere. */
  vorrangKo: string;
  /** Der Punkt, der überstimmt bzw. eingeschränkt wird — er bleibt bestehen. */
  nachrangKo: string;
  /** Pflicht bei `schraenkt_ein`, sonst `null` (überstimmt gilt ohne Einschränkung). */
  geltungsbereich: string | null;
}

/** Prüft die rohe Wahl aus dem HTTP-Rumpf auf ihre FORM; die Bedeutung prüft der Dienst. */
export function isVorrangWahl(wert: unknown): wert is VorrangWahl {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const w = wert as Record<string, unknown>;
  return (
    typeof w.art === "string" &&
    (VORRANG_ARTEN as readonly string[]).includes(w.art) &&
    typeof w.gilt === "string" &&
    (w.geltungsbereich === undefined ||
      w.geltungsbereich === null ||
      typeof w.geltungsbereich === "string")
  );
}

// Konzept 04.07. (Stufe 1): warum ein Konflikt endete. Additiv/optional — Alt-Daten haben das
// Feld nicht (JSON-persistiert, keine DB-Migration). "participant_deleted" = ein Beteiligter
// wurde gelöscht (systemische Beendigung, kein menschlicher Entscheider).
// D-AISTATE PAKET 4 (bens V5, aistate-fix3): "superseded" = systemisch gegenstandslos geworden —
// eine beteiligte KO-Seite wurde revidiert; der Befund galt einer älteren Versionskombination
// (kein menschlicher Entscheider, analog participant_deleted).
export type ConflictResolutionReason =
  | "decided"
  | "dismissed"
  | "participant_deleted"
  | "edited_no_conflict"
  | "withdrawn"
  | "superseded";

// Berater-Konzept 04.07. (Stufe 4): Herkunft eines Konflikts. Additiv/optional — Alt-Daten ohne das
// Feld gelten als „manuell" (Anzeige-Fallback). „auto" = von der Erkennung angelegt (mit detector).
export type ConflictOrigin = "manual" | "auto";

// SCRUM-492: strukturierte Kollisionsfelder eines Widerspruchs — je Seite knappe Kernaussage +
// konkret kollidierender „streitwert" (z. B. „blau"/„rot"). streitwertWoertlich = der Streitwert
// kommt wörtlich aus dem zugehörigen Belegzitat (Parser-geprüft). Additiv/optional, JSON-persistiert.
export interface KollisionSeite {
  kernaussage: string;
  streitwert: string;
  streitwertWoertlich: boolean;
}
export interface Kollision {
  streitpunkt: string;
  seiteA: KollisionSeite;
  seiteB: KollisionSeite;
}

// Metadaten der automatischen Erkennung (nur bei origin="auto") — macht den Fund erklärbar und
// reproduzierbar: Begründung + wörtliche Belegzitate + Sicherheit + promptVersion. Keine Secrets.
export interface ConflictDetector {
  trigger: "validation" | "ask" | "background";
  method: "model" | "deterministic";
  modelLabel?: string;
  promptVersion?: string;
  confidence?: number;
  rationale?: string;
  quotes?: { a: string; b: string };
  // SCRUM-492: strukturierte Gegenüberstellung für die Board-Kacheln (optional, additiv).
  kollision?: Kollision;
  // R-0263: Klaras VORSCHLAG Widerspruch/Präzisierung (optional, additiv). Er entscheidet nichts —
  // die Vorrang-Wahl samt Geltungsbereich trifft die befugte Person bei der Entscheidung.
  vorschlag?: KlaraVorschlag;
}

/**
 * R-0263: Klaras Vorschlag am Befund. `spezieller` ist hier die KENNUNG des engeren Punkts (nicht
 * „a"/„b" des Modellurteils). Der vorgeschlagene Geltungsbereich ist Modelltext über den Inhalt und
 * wird bei Redaktion geleert wie `rationale` (services/app/src/sichtbarkeit.ts `redigiereKonflikt`).
 */
export interface KlaraVorschlag {
  art: "widerspruch" | "praezisierung";
  spezieller?: string;
  geltungsbereich?: string;
}

export interface Conflict {
  id: string;
  koA: string;
  koB: string;
  type: ConflictType;
  // R-0252: die Arbeitsart (s. ConflictWorkKind). Fehlt = nicht bestimmt.
  arbeitsart?: ConflictWorkKind;
  // R-0263: der bei der Entscheidung festgelegte Vorrang zwischen den beiden Punkten (s. oben).
  // Nur an entschiedenen Konflikten; „Beide gelten" legt keinen Vorrang fest und lässt ihn weg.
  vorrang?: KonfliktVorrang;
  description: string;
  status: ConflictStatus;
  secondOpinion: string | null;
  decidedBy: string | null;
  decision: string | null;
  resolutionReason?: ConflictResolutionReason;
  // Berater-Konzept 04.07. (Stufe 4): Herkunft + Erkennungs-Metadaten (additiv, JSON-persistiert).
  origin?: ConflictOrigin;
  detector?: ConflictDetector;
  // D-AISTATE PAKET 4 (bens V5, 23.07.): die geprüften KO-Versionen beider Seiten. Additiv/optional —
  // Altbestand ohne die Felder gilt als versionsungebunden (die Paar-Dedupe blockt konservativ wie
  // bisher). Neue automatische Befunde tragen sie IMMER; die Dedupe erkennt darüber Stale-Befunde
  // (Befund zu einer inzwischen revidierten Fassung) und lässt den neuen Lauf frisch prüfen.
  koAVersion?: number;
  koBVersion?: number;
  // AUFTRAG-mega26 Block B: WER DEN KONFLIKT BEHAUPTET HAT (additiv, optional).
  //
  // Der automatisch erkannte Zweig ist vollständig auskunftsfähig: `origin:"auto"` plus `detector`
  // mit Begründung, wörtlichen Belegzitaten, Sicherheit und promptVersion. Der MANUELLE Zweig war
  // es nicht — dort trug den Actor ausschliesslich das Audit, und `detector` bleibt systematisch
  // leer. Wer den Konflikt später las, sah eine Behauptung ohne Urheber; die Zuordnung war nur
  // über eine zweite, getrennt berechtigte Quelle (/api/audit) möglich.
  //
  // Der Erzeuger KENNT den Actor zum Schreibzeitpunkt: die Anlage-Route reicht den
  // authentifizierten `user.id` bereits als Parameter an `create` durch — er landete bisher nur
  // nicht am Datensatz. Genau derselbe Wert, der ins Audit geht, steht jetzt auch hier.
  //
  // Der auto-Zweig setzt das Feld BEWUSST nicht: dort ist der Erzeuger die Erkennung selbst, und
  // sie weist sich über `origin`/`detector` aus. Altbestand ohne das Feld bleibt gültig.
  createdBy?: string;
  createdAt: string;
}

export interface ConflictInput {
  koA: string;
  koB: string;
  type: ConflictType;
  // R-0252: optional — manuelle Anlage (Wahl) und automatische Erkennung (Einordnung) reichen sie durch.
  arbeitsart?: ConflictWorkKind;
  description: string;
  // D-AISTATE PAKET 4 (bens V5): geprüfte KO-Versionen (additiv, optional).
  koAVersion?: number;
  koBVersion?: number;
}

// R-0215 / R-1714 (Nacharbeit 2): `CONFLICT` (409) — ein offener Wahrheitskonflikt wird erst
// eskaliert, bevor über ihn entschieden oder eine Zweitmeinung abgelegt wird. `VALIDATION` (400) —
// eine Vorrang-Wahl passt nicht zum Konflikt (R-0263). Beide Codes stehen bereits im Haus
// (http.ts STATUS_BY_CODE, build-app ERLAUBTE_FEHLERCODES); ein eigener Name wäre eine zweite Wahrheit.
export type ConflictErrorCode =
  | "NOT_FOUND"
  | "NOT_ESCALATABLE"
  | "ALREADY_RESOLVED"
  | "CONFLICT"
  | "VALIDATION";

export class ConflictError extends Error {
  readonly code: ConflictErrorCode;

  constructor(code: ConflictErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ConflictError";
  }
}
