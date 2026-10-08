// Reine, DOM-freie Logik fürs Conflict Board (SCRUM-127 / SCRUM-128).
// Keine Backend-Änderung, keine KO-Mutation: nur Auflösung von IDs zu echten KOs
// und die fachliche Definition der (Nicht-)Wirkung einer Konfliktauflösung.
import type { Conflict, ConflictWorkKind, KnowledgeObject, KonfliktVorrang } from "../api/types";

export interface ConflictKoPair {
  a: KnowledgeObject | null;
  b: KnowledgeObject | null;
}

// SCRUM-127: koA/koB zu echten Wissensobjekten auflösen (null, wenn nicht gefunden — kein Fake).
export function conflictKoPair(
  conflict: Pick<Conflict, "koA" | "koB">,
  kos: readonly KnowledgeObject[],
): ConflictKoPair {
  const byId = (koId: string): KnowledgeObject | null => kos.find((k) => k.id === koId) ?? null;
  return { a: byId(conflict.koA), b: byId(conflict.koB) };
}

// ================================================================================================
// AUFTRAG-mega32 BLOCK K (aus dem zurückgezogenen mega30, unverändert) — DIE BEWEISLAGE STEHT DA,
// BEVOR JEMAND ÜBER DEN WORTLAUT STREITET.
// ================================================================================================
//
// DER ANLASSFALL. „Alle Firmenwagen müssen blau sein" gegen „Firmenwagen ausschließlich in Rot
// bestellen". Unter BEIDEN Karten steht bereits „keine Quelle hinterlegt · kein Quelldatum". Das ist
// die Antwort auf die Frage, welche Seite stimmt — keine von beiden ist belegt — aber die Seite sagt
// es nicht, und der nächste Schritt, der daraus folgt, steht nirgends.
//
// DIE GRENZE, DIE DIESER SATZ NICHT ÜBERSCHREITET. Er ist eine Aussage über die BEWEISLAGE, NIE ein
// Urteil darüber, wer recht hat. Eine belegte Aussage kann falsch sein; sie ist nur belegt. Deshalb
// heißt „genau eine Seite trägt eine Quelle" ausdrücklich nicht „diese Seite gewinnt".
//
// KEIN MODELLAUFRUF, KEIN EGRESS, KEINE NEUE ROUTE, KEIN NEUES FELD. Ausschließlich aus `ko.sources`
// der beiden bereits geladenen Objekte — die Konfliktseite hat sie über ConflictKoSide schon in der
// Hand.
export type ConflictEvidenceBalance =
  // Keine der beiden Seiten trägt eine Quelle.
  | { kind: "neither" }
  // Genau eine Seite trägt eine Quelle — `side` benennt WELCHE, damit der Text nicht raten muss.
  | { kind: "oneSided"; side: "a" | "b" };

function hasSource(ko: KnowledgeObject | null): boolean | null {
  // Das Objekt ist nicht geladen: über seine Belege lässt sich nichts sagen. NICHT „keine Quelle" —
  // das wäre eine Behauptung über Daten, die wir nicht haben.
  return ko === null ? null : (ko.sources?.length ?? 0) > 0;
}

export function conflictEvidenceBalance(pair: ConflictKoPair): ConflictEvidenceBalance | null {
  const a = hasSource(pair.a);
  const b = hasSource(pair.b);
  if (a === null || b === null) {
    return null; // eine Seite unbekannt ⇒ die Zeile schweigt.
  }
  if (!a && !b) {
    return { kind: "neither" };
  }
  if (a !== b) {
    return { kind: "oneSided", side: a ? "a" : "b" };
  }
  return null; // beide belegt ⇒ die Zeile schweigt. Kein Dauerhinweis (Regel wie bei mega28).
}

// SCRUM-128: Fachliche Definition der Auflösungswirkung.
// Eine Freitext-Entscheidung bestimmt keinen maschinell eindeutigen Gewinner →
// daher KEINE automatische KO-Status-/Trust-Mutation (kein stilles Überschreiben).
// Wirkung ist dokumentierend (Entscheidung + Audit) und hinweisend (Revalidierung).
export interface ResolutionEffect {
  documented: boolean; // Entscheidung + Audit auf Konfliktebene
  koStatusChanged: boolean; // immer false — keine automatische Statusänderung am KO
  koTrustChanged: boolean; // immer false — keine automatische Trust-Änderung am KO
  revalidationRecommended: boolean; // bei Wahrheitskonflikten manuelle Re-Validierung empfehlen
}

export function resolutionEffect(conflict: Pick<Conflict, "type">): ResolutionEffect {
  return {
    documented: true,
    koStatusChanged: false,
    koTrustChanged: false,
    revalidationRecommended: conflict.type === "truth",
  };
}

// ================================================================================================
// R-0252 (Aufnahme gesamt-konfliktklassifikation) — WELCHE ART VON ARBEIT LIEGT VOR?
// ================================================================================================
//
// Die Fläche sagt VOR dem Inhalt, womit der Prüfende es zu tun hat — und bietet je Arbeitsart
// andere Knöpfe an:
//   regel   — zwei interne Festlegungen; keine Quelle entscheidet, nur eine befugte Person
//             (die Entscheidung verlangt ohnehin `conflict.resolve`). Keine Zweitmeinung im Band.
//   sache   — durch Belege entscheidbar. Das bisherige Band, unverändert.
//   version — dieselbe Sache in zwei Ständen. „Welcher Stand gilt", kein „beide gelten", keine
//             Zweitmeinung, keine Präzisierung.
//
// UNABHÄNGIG VON DEN FÜNF ARTEN (Ben, Nacharbeit 2). Bis hierher wurde die Arbeitsart aus `type`
// abgeleitet — und ein automatisch erkannter Widerspruch zweier interner Festlegungen erschien damit
// als Sachkonflikt mit Zweitmeinung. Diese Ableitung ist GESTRICHEN. Die Arbeitsart kommt nur noch
// vom Datensatz selbst:
//   · „gewaehlt" — ein Mensch hat sie bei der manuellen Anlage gewählt,
//   · „erkannt"  — die Konfliktprüfung hat sie eingeordnet (detect.ts `arbeitsartAusUrteil`).
// Fehlt sie, ist sie NICHT BESTIMMT: die Fläche sagt das, und das Band bietet alle Wege an, statt
// einen zu verschweigen, den eine geratene Art ausgeschlossen hätte.
export interface ConflictWorkKindInfo {
  kind: ConflictWorkKind | null;
  /** Woher die Einordnung stammt — `null`, wenn es keine gibt. */
  herkunft: "gewaehlt" | "erkannt" | null;
}

export function conflictWorkKind(
  conflict: Pick<Conflict, "arbeitsart" | "origin">,
): ConflictWorkKindInfo {
  if (!conflict.arbeitsart) {
    return { kind: null, herkunft: null };
  }
  return {
    kind: conflict.arbeitsart,
    herkunft: conflict.origin === "auto" ? "erkannt" : "gewaehlt",
  };
}

/** Das Band je Arbeitsart: Beschriftung der zwei Seitenknöpfe und welche Zusatzwege es gibt. */
export interface ConflictWorkActions {
  linksKey: string;
  rechtsKey: string;
  beideGelten: boolean;
  /** R-0263: ob „gilt" als Präzisierung (schränkt nur ein, mit Geltungsbereich) wählbar ist. */
  praezisierung: boolean;
  zweitmeinung: boolean;
}

export function conflictWorkActions(kind: ConflictWorkKind | null): ConflictWorkActions {
  if (kind === "version") {
    return {
      linksKey: "konfliktarbeit.knopf.standLinks",
      rechtsKey: "konfliktarbeit.knopf.standRechts",
      beideGelten: false,
      praezisierung: false,
      zweitmeinung: false,
    };
  }
  return {
    linksKey: "con.side.left",
    rechtsKey: "con.side.right",
    beideGelten: true,
    praezisierung: true,
    // Regel: keine Zweitmeinung — keine Quelle entscheidet. Sache und „nicht bestimmt": wie bisher.
    zweitmeinung: kind !== "regel",
  };
}

/**
 * R-0215 / R-1714 (Nacharbeit 2): solange ein Wahrheitskonflikt OFFEN ist, ist er noch nicht an
 * einen Menschen eskaliert — Entscheidung und Zweitmeinung sind dann gesperrt (der Dienst weist sie
 * mit 409 ab, `services/conflicts/src/service.ts` `requireEscalatedIfTruth`). Die anderen vier Arten
 * werden nie gesperrt.
 */
export function eskalationAusstehend(conflict: Pick<Conflict, "type" | "status">): boolean {
  return conflict.type === "truth" && conflict.status === "offen";
}

/**
 * R-0263: der Satz, den ein Punkt über einen festgelegten Vorrang trägt — aus SEINER Sicht. Gibt den
 * i18n-Schlüssel und die Kennung des Gegenübers zurück; Titel und Geltungsbereich setzt der Aufrufer
 * ein. Vier Fälle, je nach Art und Seite:
 *   überstimmt   · dieser Punkt gilt         → „Hat Vorrang vor …"
 *   überstimmt   · dieser Punkt unterliegt   → „Überstimmt durch … — bleibt mit Quellen erhalten"
 *   schränkt ein · dieser Punkt ist spezieller → „Präzisiert … für den Geltungsbereich …"
 *   schränkt ein · dieser Punkt ist allgemeiner → „Eingeschränkt durch … — außerhalb gilt er weiter"
 */
export function vorrangAmPunkt(
  v: Pick<KonfliktVorrang, "art" | "vorrangKo" | "nachrangKo">,
  koId: string,
): { schluessel: string; gegenueber: string } {
  const istVorrang = v.vorrangKo === koId;
  const gegenueber = istVorrang ? v.nachrangKo : v.vorrangKo;
  if (v.art === "schraenkt_ein") {
    return {
      schluessel: istVorrang
        ? "konfliktarbeit.amPunkt.praezisiert"
        : "konfliktarbeit.amPunkt.eingeschraenktVon",
      gegenueber,
    };
  }
  return {
    schluessel: istVorrang
      ? "konfliktarbeit.amPunkt.hatVorrang"
      : "konfliktarbeit.amPunkt.ueberstimmtVon",
    gegenueber,
  };
}

// SCRUM-252: genau EINE sinnvolle nächste Handlung aus Art + Status ableiten.
// Verweist nur auf bestehende echte Aktionen (escalate/secondOpinion/resolve) — keine neue Logik,
// keine automatische Lösung. Spiegelt die Aktionsverfügbarkeit der Konfliktseite wider:
//  - gelöst                       → keine offene Handlung (done)
//  - Wahrheitskonflikt, offen     → an einen Menschen eskalieren (R-0215: verbindlich)
//  - R-0252: Regel- und Versionskonflikt → entscheiden; eine Zweitmeinung bietet das Band dort
//    nicht an (keine Quelle entscheidet eine Festlegung; bei zwei Ständen wird der geltende gewählt).
//  - R-0252 (Nacharbeit 5): noch nicht eingeordnet → einordnen; erst danach steht fest, welche
//    Aktionen passen.
//  - Sachkonflikt: Zweitmeinung, nach der Zweitmeinung entscheiden.
export type ConflictNextStep = "escalate" | "classify" | "secondOpinion" | "resolve" | "done";

export function conflictNextStep(
  conflict: Pick<Conflict, "type" | "status" | "arbeitsart" | "origin">,
): ConflictNextStep {
  if (conflict.status === "geloest") {
    return "done";
  }
  if (eskalationAusstehend(conflict)) {
    return "escalate";
  }
  const kind = conflictWorkKind(conflict).kind;
  if (kind === null) {
    return "classify";
  }
  if (!conflictWorkActions(kind).zweitmeinung) {
    return "resolve";
  }
  return conflict.status === "zweitmeinung" ? "resolve" : "secondOpinion";
}

/**
 * Der Textschlüssel des nächsten Schritts. Die vier alten Schritte wohnen im Grundbestand
 * (`con.next.*`); „einordnen" ist neu und wohnt deshalb im Textmodul dieses Auftrags.
 */
export function naechsterSchrittSchluessel(step: ConflictNextStep): string {
  return step === "classify" ? "konfliktarbeit.next.einordnen" : `con.next.${step}`;
}

/**
 * R-0252 (Nacharbeit 5): ein Konflikt ohne Arbeitsart wird VOR der typabhängigen Bearbeitung
 * eingeordnet. Bis dahin sind Entscheidung und Zweitmeinung gesperrt; „Kein Widerspruch" bleibt
 * offen — er verneint den Befund und braucht keine Art der Arbeit.
 */
export function einordnungAusstehend(conflict: Pick<Conflict, "arbeitsart" | "status">): boolean {
  return conflict.status !== "geloest" && !conflict.arbeitsart;
}

/**
 * R-0263 (Nacharbeit 5): Klaras Vorschlag Widerspruch/Präzisierung als Satzschlüssel samt der
 * spezielleren Seite. `null`, wenn es keinen Vorschlag gibt (manuell angelegt, oder die Prüfung
 * hat keinen geliefert) — dann wird nichts behauptet.
 */
export function klaraVorschlag(
  conflict: Pick<Conflict, "detector" | "koA" | "koB">,
): { schluessel: string; seite: "a" | "b" | null; geltungsbereich: string } | null {
  const v = conflict.detector?.vorschlag;
  if (!v) {
    return null;
  }
  if (v.art === "praezisierung" && v.spezieller) {
    return {
      schluessel: "konfliktarbeit.vorschlag.praezisierung",
      seite: v.spezieller === conflict.koA ? "a" : "b",
      geltungsbereich: v.geltungsbereich ?? "",
    };
  }
  return { schluessel: "konfliktarbeit.vorschlag.widerspruch", seite: null, geltungsbereich: "" };
}
