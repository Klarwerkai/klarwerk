// Reine, DOM-freie Logik fürs Conflict Board (SCRUM-127 / SCRUM-128).
// Keine Backend-Änderung, keine KO-Mutation: nur Auflösung von IDs zu echten KOs
// und die fachliche Definition der (Nicht-)Wirkung einer Konfliktauflösung.
import type { Conflict, ConflictWorkKind, KnowledgeObject } from "../api/types";

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
//             Zweitmeinung.
//
// DIE ACHSE IST EINE ZWEITE, NICHT DIE FÜNF ARTEN NOCHMAL (Registernotiz zu R-0252). Ausdrücklich
// gewählt wird sie nur bei der manuellen Anlage. Fehlt sie, wird sie aus der Art ABGELEITET — und
// die Fläche sagt das dazu, statt eine Ableitung als Feststellung auszugeben:
//   truth      → sache   (Wahrheit: was stimmt, zeigen Belege)
//   experience → sache   (Erfahrungen lassen sich an Beobachtungen und Nachweisen messen)
//   temporal   → version (die Erkennung legt „überholt" als Zeitkonflikt an: zwei Stände)
//   context    → regel   (wo welche Festlegung gilt, legt eine befugte Person fest)
//   role       → regel   (Festlegungen verschiedener Rollen — dieselbe Frage)
// GRENZE, benannt: ein automatisch erkannter Widerspruch zweier interner Festlegungen ist „truth"
// und erscheint deshalb als Sachkonflikt. Eine Umordnung nach der Anlage gibt es nicht.
export interface ConflictWorkKindInfo {
  kind: ConflictWorkKind;
  /** true = bei der Anlage gewählt; false = aus der Art abgeleitet. */
  ausdruecklich: boolean;
}

const ABGELEITETE_ARBEITSART: Readonly<Record<Conflict["type"], ConflictWorkKind>> = {
  truth: "sache",
  experience: "sache",
  temporal: "version",
  context: "regel",
  role: "regel",
};

export function conflictWorkKind(
  conflict: Pick<Conflict, "type" | "arbeitsart">,
): ConflictWorkKindInfo {
  if (conflict.arbeitsart) {
    return { kind: conflict.arbeitsart, ausdruecklich: true };
  }
  return { kind: ABGELEITETE_ARBEITSART[conflict.type] ?? "sache", ausdruecklich: false };
}

/** Das Band je Arbeitsart: Beschriftung der zwei Seitenknöpfe und welche Zusatzwege es gibt. */
export interface ConflictWorkActions {
  linksKey: string;
  rechtsKey: string;
  beideGelten: boolean;
  zweitmeinung: boolean;
}

export function conflictWorkActions(kind: ConflictWorkKind): ConflictWorkActions {
  if (kind === "version") {
    return {
      linksKey: "konfliktarbeit.knopf.standLinks",
      rechtsKey: "konfliktarbeit.knopf.standRechts",
      beideGelten: false,
      zweitmeinung: false,
    };
  }
  return {
    linksKey: "con.side.left",
    rechtsKey: "con.side.right",
    beideGelten: true,
    zweitmeinung: kind === "sache",
  };
}

// SCRUM-252: genau EINE sinnvolle nächste Handlung aus Art + Status ableiten.
// Verweist nur auf bestehende echte Aktionen (escalate/secondOpinion/resolve) — keine neue Logik,
// keine automatische Lösung. Spiegelt die Aktionsverfügbarkeit der Konfliktseite wider:
//  - gelöst                       → keine offene Handlung (done)
//  - Wahrheitskonflikt, offen     → an einen Menschen eskalieren (R-0215: nur er, und er zwingend)
//  - Sachkonflikt (auch Wahrheit, eskaliert): offen/eskaliert → Zweitmeinung, Zweitm. → entscheiden
//  - R-0252: Regel- und Versionskonflikt → entscheiden; eine Zweitmeinung bietet das Band dort
//    nicht an (keine Quelle entscheidet eine Festlegung; bei zwei Ständen wird der geltende gewählt).
export type ConflictNextStep = "escalate" | "secondOpinion" | "resolve" | "done";

export function conflictNextStep(
  conflict: Pick<Conflict, "type" | "status" | "arbeitsart">,
): ConflictNextStep {
  if (conflict.status === "geloest") {
    return "done";
  }
  if (conflict.type === "truth" && conflict.status === "offen") {
    return "escalate";
  }
  if (!conflictWorkActions(conflictWorkKind(conflict).kind).zweitmeinung) {
    return "resolve";
  }
  return conflict.status === "zweitmeinung" ? "resolve" : "secondOpinion";
}
