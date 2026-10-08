// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — WIE BELASTBAR IST DIESE ANTWORT, UND WARUM.
// ================================================================================================
//
// DER BEFUND (R-0318, R-0319, R-0321, R-0322, R-0335). Die Einstufung (`answer-evidence.ts`) sagt
// seit mega34, OB eine Antwort belegt ist. Was an der Antwort fehlte, waren die übrigen Teile
// derselben Auskunft — und zwar VOM SERVER, nicht als Zahl, die eine Oberfläche sich zurechtlegt:
//
//   · WIE der Vertrauenswert zustande kommt und ob er dieselbe Größe ist wie in der Bibliothek
//     (R-0319 nennt das ausdrücklich ungeklärt). Er IST dieselbe Größe: `answerStanding`
//     (services/reasoner/src/provider.ts) setzt ihn als MINIMUM über `KnowledgeObject.trust` der
//     tragenden Quellen — genau den Wert, den die Bibliothek je Eintrag zeigt. Diese Datei macht
//     die Herleitung samt schwächster Quelle sichtbar, statt sie nur zu behaupten.
//   · Aktualität, Verantwortung und Quellenqualität je tragender Quelle (R-0318).
//   · Ob der Zuständige erreichbar ist (R-0322) — die Lücke wird BENANNT, das Wissen bleibt nutzbar.
//   · BEIDE Seiten eines Konflikts mit ihren Belegen, ohne heimlichen Gewinner (R-0321).
//   · EINE Lage aus einer Zustandsfamilie statt „hat geantwortet oder nicht" (R-0335).
//
// WAS HIER AUSDRÜCKLICH NICHT GESCHIEHT:
//   · Keine Wahrheitswahrscheinlichkeit, keine Prozentangabe zu einer Konfliktseite (R-0260,
//     verworfen). Der Vertrauenswert ist ein Belastbarkeitssignal der Quelle — der Hinweis
//     `vertrauen_ist_kein_wahrheitsversprechen` reist mit jeder Auskunft.
//   · Keine zweite Einstufung. `grade` kommt unverändert aus `answerEvidence`; die Lage hier
//     ERGÄNZT sie um Verantwortung und Konfliktseiten, sie stuft nichts neu ein.
//   · Kein Modellaufruf, kein Egress, keine Suche. Alles kommt als Argument herein.
import type { Conflict } from "../../conflicts";
import {
  type KnowledgeObject,
  type KnowledgeType,
  isConfidential,
  responsibleKindOf,
  responsibleOf,
} from "../../knowledge-object";
import {
  type AnswerCheckState,
  type AnswerEvidence,
  type AnswerGrade,
  answerCheckState,
} from "./answer-evidence";
import type { BegriffHerkunft } from "./antwort-zuschnitt";

// ================================================================================================
// DIE ZUSTANDSFAMILIE (R-0335) — sechs Lagen, ein Vokabular für Konsole und Word-Fenster.
// ================================================================================================
//
// Wo jede Lage entsteht, ist Teil des Vertrags:
//   · `belegt`, `belegt_zustaendig_fehlt`, `belegt_mit_konflikt`, `wissensluecke` — hier, aus der
//     fertigen Antwort (`antwortBelastbarkeit`), im 200er-Körper von POST /api/ask.
//   · `technischer_fehler` — dort, wo keine lesbare Antwort ankommt (Nicht-200, unlesbarer Körper,
//     unbekannte Lage). Ein Server kann eine Störung nicht in einer gelungenen Antwort melden; die
//     Fläche ordnet sie zu und darf sie NIE als Wissenslücke ausgeben.
//   · `geschwaerzt` — beim späteren Lesen eines Antwortbelegs, wenn die heutigen Rechte die Belege
//     sperren (Integritätszustand `REDACTED` der Erklärroute, klara-answer-explanation-routes.ts).
//     Auf POST /api/ask kommt sie nicht vor: Vertrauliches wird dort VOR der Auswahl entfernt
//     (`dropConfidential`), eine Antwort trägt also nie einen gesperrten Beleg.
export type AntwortLage =
  | "belegt"
  | "belegt_zustaendig_fehlt"
  | "belegt_mit_konflikt"
  | "wissensluecke"
  | "technischer_fehler"
  | "geschwaerzt";

export const ANTWORT_LAGEN: readonly AntwortLage[] = [
  "belegt",
  "belegt_zustaendig_fehlt",
  "belegt_mit_konflikt",
  "wissensluecke",
  "technischer_fehler",
  "geschwaerzt",
];

/**
 * Die Begründung der Lage als geschlossene Menge von Gründen. Die Fläche übersetzt sie nur — die
 * ENTSCHEIDUNG, welcher Grund vorliegt, fällt hier.
 */
export type BelastbarkeitsGrund =
  | "keine_tragfaehige_quelle"
  | "zuordnung_unbekannt"
  | "alle_tragenden_quellen_validiert"
  | "tragende_quelle_nicht_validiert"
  | "pruefnachweis_unvollstaendig"
  | "offener_konflikt"
  | "konfliktlage_unbekannt"
  | "zustaendig_nicht_erreichbar"
  | "erreichbarkeit_unbekannt"
  | "verantwortung_nur_autor";

/** Was eine Fläche über die verantwortliche Person zeigen darf. */
export interface BelastbarkeitVerantwortung {
  /** `owner` = benannter Eigentümer; `author-fallback` = kein Eigentümer benannt, es gilt der Autor. */
  art: "owner" | "author-fallback";
  /** Kennung und Anzeigename — `null`, wenn der Aufrufer keine Personendaten sehen darf. */
  person: { id: string; name: string | null } | null;
  /** `true`/`false` belegt, `null` = nicht ermittelbar (kein Verzeichnis, Abruf gescheitert). */
  erreichbar: boolean | null;
}

/** Je TRAGENDER Quelle: Vertrauenswert, Aktualität, Verantwortung, Quellenqualität (R-0318). */
export interface QuellenBelastbarkeit {
  koId: string;
  titel: string;
  version: number;
  /** Dieselbe Größe wie in der Bibliothek: `KnowledgeObject.trust` dieser Quelle (R-0319). */
  vertrauenswert: number;
  /** Aktualität: Zeitpunkt der geltenden Fassung (letzter Verlaufseintrag, sonst Anlage). */
  stand: string;
  /** Quellenqualität: Prüfstatus des Eintrags. */
  validiert: boolean;
  /** Quellenqualität: Beweislage der Konflikterkennung (dieselbe Regel wie die Einstufung). */
  pruefstand: AnswerCheckState;
  /** Die Validierungsentscheidung ist am Eintrag festgehalten (W3-C, KW-W3-19). */
  entscheidungFestgehalten: boolean;
  verantwortung: BelastbarkeitVerantwortung;
}

/** Eine Seite eines Konflikts — mit Beleg, oder ausdrücklich nicht einsehbar. */
export type KonfliktSeite =
  | {
      einsehbar: true;
      koId: string;
      titel: string;
      aussage: string;
      version: number;
      vertrauenswert: number;
      validiert: boolean;
      /** Trägt diese Seite die gegebene Antwort? Beschreibt, beurteilt nicht. */
      traegtAntwort: boolean;
    }
  | { einsehbar: false; traegtAntwort: boolean };

/**
 * Ein offener Konflikt auf einer tragenden Quelle: BEIDE Seiten in der Reihenfolge des
 * Konfliktdatensatzes. Es gibt KEIN Feld, das eine Seite bevorzugt — die Entscheidung bleibt beim
 * Menschen (R-0321, R-0260).
 */
export interface AntwortKonflikt {
  konfliktId: string;
  /** Die Konfliktbeschreibung — nur, wenn BEIDE Seiten einsehbar sind (sie zitiert beide). */
  beschreibung: string | null;
  seiten: [KonfliktSeite, KonfliktSeite];
}

// ================================================================================================
// R-0346 — WER FRAGT UND WARUM: DER ZUSCHNITT DER ERKLÄRUNG.
// ================================================================================================
//
// Die Rolle kommt aus der Sitzung (`SessionUser.role`), der Anlass aus dem Anfragezusammenhang:
// stammt die Frage aus dem Dokument (`questionSource: "selection"`) oder ist die Anfrage an ein
// Word-Dokument gebunden (Klara-Kopfzeilen), ist der Anlass `dokument`, sonst `frage`. Der
// Dokumenttext selbst wird dafür NICHT gelesen und reist nirgends mit (KA5) — und eine bloße
// Markierung zählt nicht, damit sie den Antwortkörper nicht verändert (KA5-R2).
//
// WAS DER ZUSCHNITT STEUERT (und was nicht):
//   · Tiefe       — wie viele Stufen der Argumentation offen stehen (kurz: Aussage und Schluss;
//                   ausführlich: alle). Weggelassen wird NICHTS; zugeklappte Stufen bleiben da.
//   · Fachsprache — `fach` zeigt Fassung, Prüfstand-Kennung und Personenkennung, `allgemein` lässt
//                   diese technischen Angaben in der Darstellung weg.
//   · Reihenfolge — in welcher Folge die Wissensarten der tragenden Quellen in der Argumentation
//                   stehen.
// Der Antworttext selbst (Modell oder wörtliche Übernahme) wird NICHT umgeschrieben — das wäre ein
// Eingriff in den Antwortweg, nicht in seine Erklärung.
//
// DIE TABELLE IST EINE BENANNTE VORGABE, KEINE ABGELEITETE WAHRHEIT. Begründung je Zeile:
//   · Anlass `dokument`: der Text verlässt das Haus — erst die verbindliche Vorgehensweise
//     (best_practice), dann, was man vermeiden muss (negativwissen), dann Technik und Erfahrung;
//     das Bauchgefühl zuletzt.
//   · Frage einer Fachrolle (experte, controller, admin): erst das technische Wissen und die
//     Erfahrung aus Fehlern, dann die Vorgehensweise; Bauchgefühl zuletzt.
//   · Sonst (viewer, Add-on ohne Sitzung): erst die Vorgehensweise, dann Technik; Bauchgefühl zuletzt.
export type FragendenRolle = "viewer" | "experte" | "controller" | "admin" | "unbekannt";
export type FrageAnlass = "dokument" | "frage";

export interface AntwortZuschnitt {
  rolle: FragendenRolle;
  anlass: FrageAnlass;
  tiefe: "kurz" | "ausfuehrlich";
  fachsprache: "allgemein" | "fach";
  reihenfolge: KnowledgeType[];
}

const REIHENFOLGE_DOKUMENT: KnowledgeType[] = [
  "best_practice",
  "negativwissen",
  "technik",
  "lernkurve",
  "bauchgefuehl",
];
const REIHENFOLGE_FACH: KnowledgeType[] = [
  "technik",
  "negativwissen",
  "lernkurve",
  "best_practice",
  "bauchgefuehl",
];
const REIHENFOLGE_ALLGEMEIN: KnowledgeType[] = [
  "best_practice",
  "technik",
  "lernkurve",
  "negativwissen",
  "bauchgefuehl",
];

export function antwortZuschnitt(rolle: FragendenRolle, anlass: FrageAnlass): AntwortZuschnitt {
  const fachrolle = rolle === "experte" || rolle === "controller" || rolle === "admin";
  return {
    rolle,
    anlass,
    tiefe: fachrolle ? "ausfuehrlich" : "kurz",
    fachsprache: fachrolle ? "fach" : "allgemein",
    reihenfolge: [
      ...(anlass === "dokument"
        ? REIHENFOLGE_DOKUMENT
        : fachrolle
          ? REIHENFOLGE_FACH
          : REIHENFOLGE_ALLGEMEIN),
    ],
  };
}

// ================================================================================================
// R-1627 / R-0281 — DIE MEHRSTUFIGE ARGUMENTATION, QUELLENGEBUNDEN.
// ================================================================================================
//
// Die Kette führt von den Aussagen der TRAGENDEN Quellen über ihre BELEGTEN fachlichen Beziehungen,
// die Einwände (offene Widersprüche) und die Vorbehalte zur inhaltlichen Schlussfolgerung. Jede Stufe
// ist an eine Quelle, eine Beziehung, einen Konflikt oder einen benannten Grund gebunden; nichts
// davon stammt aus einem Modell-Gedankengang, und `steps` liefert ausschließlich die wörtliche
// Belegstelle einer Quelle (FR-ASK-06) — es wird KEINE Herleitung aus `steps` konstruiert (KW-W1-13,
// mega39 D2). Keine Stufe trägt eine Wahrheitswahrscheinlichkeit (R-0260).
//
// BEN NACHARBEIT-9 (Befund 1): bis hierher hieß die erste tragende Quelle „Aussage" und jede weitere
// „Stützung" — allein nach Listenposition, ohne dass eine fachliche Beziehung belegt war; ein
// anderer Zuschnitt drehte die behauptete Richtung um. Jetzt gilt:
//   · Jede tragende Quelle ist eine eigene AUSSAGE. Die Reihenfolge des Zuschnitts ordnet nur die
//     Darstellung, sie stiftet keine Beziehung.
//   · Eine BEZIEHUNG zwischen zwei Aussagen steht nur da, wenn ein Mensch sie als kuratierte Kante
//     gesetzt hat (`KuratierteKante`, aktiv) — mit ihrer Art und Richtung, wie gesetzt.
//   · Ohne belegte Beziehung bleiben Aussagen UNABHÄNGIG (`unabhaengig` am Schluss) — keine stillen
//     gegenseitigen Stützungen.
//   · Der SCHLUSS trägt die inhaltliche Schlussfolgerung: die gegebene Antwortaussage samt der
//     Quellen, auf die sie gestützt ist, dazu Lage und Einstufung.
export type ArgumentStufe =
  | {
      art: "aussage";
      koId: string;
      titel: string;
      aussage: string;
      wissensart: KnowledgeType;
      /** Die wörtliche Belegstelle aus dem Antwortweg (`steps[].snippet`), sonst `null`. */
      belegstelle: string | null;
      vertrauenswert: number;
      validiert: boolean;
      stand: string;
    }
  | {
      art: "beziehung";
      /** Die Kennung der kuratierten Kante — die Beziehung ist ein eigener, prüfbarer Datensatz. */
      kanteId: string;
      beziehung: BelegteBeziehungsArt;
      gerichtet: boolean;
      vonKoId: string;
      vonTitel: string;
      zuKoId: string;
      zuTitel: string;
      /** Wer die Beziehung gesetzt hat — `null` ohne Personensicht (Add-on-Weg). */
      gesetztVon: string | null;
    }
  | { art: "einwand"; konfliktId: string; seite: KonfliktSeite }
  | { art: "vorbehalt"; grund: BelastbarkeitsGrund }
  | {
      art: "schluss";
      lage: AntwortLage;
      einstufung: AnswerGrade;
      /** Die inhaltliche Schlussfolgerung — die gegebene Antwortaussage; `null` ohne Antwort. */
      aussage: string | null;
      /** Die Quellen, auf die der Schluss gestützt ist (die tragenden). */
      gestuetztAuf: string[];
      /** Tragende Quellen ohne belegte Beziehung untereinander stehen unabhängig nebeneinander. */
      unabhaengig: boolean;
    };

/** Die Beziehungsarten der kuratierten Kanten (`KantenArt`, knowledge-object/kanten-types.ts). */
export type BelegteBeziehungsArt =
  | "gehoert_zu"
  | "ergaenzt"
  | "ersetzt"
  | "widerspricht"
  | "beispiel_fuer";

/** Eine aktive, von einem Menschen gesetzte Beziehung zwischen zwei Wissensobjekten. */
export interface BelegteBeziehung {
  id: string;
  quelleId: string;
  zielId: string;
  art: BelegteBeziehungsArt;
  richtung: "gerichtet" | "ungerichtet" | "symmetrisch";
  urheber: string;
  status: "aktiv" | "widerrufen";
}

const VORBEHALTE: readonly BelastbarkeitsGrund[] = [
  "zuordnung_unbekannt",
  "tragende_quelle_nicht_validiert",
  "pruefnachweis_unvollstaendig",
  "konfliktlage_unbekannt",
  "zustaendig_nicht_erreichbar",
  "erreichbarkeit_unbekannt",
  "verantwortung_nur_autor",
];

export interface AntwortBelastbarkeit {
  lage: AntwortLage;
  gruende: BelastbarkeitsGrund[];
  vertrauenswert: {
    /** `null`, wenn keine tragende Quelle bekannt ist — dann wird KEIN Wert behauptet, auch keine 0. */
    wert: number | null;
    herleitung: "minimum_tragender_quellen" | "keine_tragende_quelle";
    /** Die Quelle, deren Wert die Antwort begrenzt. */
    schwaechsteQuelle: string | null;
  };
  /** Wie viele Quellen herangezogen wurden und wie viele die Antwort tragen. */
  quellenAnzahl: { herangezogen: number; tragend: number };
  quellen: QuellenBelastbarkeit[];
  konflikte: AntwortKonflikt[];
  /** R-1627: die Stufen von den Aussagen zum Schluss, in der Reihenfolge des Zuschnitts. */
  argumentation: ArgumentStufe[];
  /** R-0346: auf wen und welchen Anlass die Erklärung zugeschnitten ist. */
  zuschnitt: AntwortZuschnitt;
  /**
   * Ben nacharbeit-11: Begriffserklärungen, die der Zuschnitt aus dem Firmenwörterbuch angehängt
   * hat — AUSSERHALB der Quellenbilanz. Sie zählen nicht in `quellenAnzahl`, tragen nicht zum
   * Vertrauenswert bei und stehen nicht in `argumentation`; ihre Belastbarkeit ist ausdrücklich
   * NICHT bewertet (das Wörterbuch kennt keinen Vertrauenswert und keinen Prüfstand). Fehlt das
   * Feld, wurde nichts aus dem Wörterbuch ergänzt.
   */
  woerterbuch?: WoerterbuchErgaenzung[];
  hinweis: "vertrauen_ist_kein_wahrheitsversprechen";
}

export interface WoerterbuchErgaenzung {
  benennung: string;
  herkunft: BegriffHerkunft;
  /** Immer `null`: kein Wert wird behauptet, auch nicht der der Wissensquellen. */
  vertrauenswert: null;
  belastbarkeit: "nicht_bewertet";
}

export interface AntwortBelastbarkeitInput {
  answer: {
    answered: boolean;
    sources: readonly string[];
    citedSources: readonly string[];
    /** Der Antworttext — er ist die inhaltliche Schlussfolgerung der Kette. */
    answer?: string | null;
  };
  /** R-1627: die kuratierten Kanten, die die Route zu den tragenden Quellen gelesen hat. */
  beziehungen?: readonly BelegteBeziehung[];
  /** Die bereits gefällte Einstufung — sie wird gelesen, nicht nachgerechnet. */
  evidence: AnswerEvidence;
  /** Aufgelöste Wissensobjekte: die herangezogenen Quellen UND die Gegenseiten der Konflikte. */
  kos: ReadonlyMap<string, KnowledgeObject>;
  /** Offene Konflikte — `null` = unbekannt (dieselbe Bedeutung wie in `answerEvidence`). */
  openConflicts: readonly Conflict[] | null;
  /** Darf DIESER Aufrufer die Gegenseite eines Konflikts sehen? Fehlt sie, gilt: nein. */
  seiteSichtbar?: (ko: KnowledgeObject) => boolean;
  /** Erreichbarkeit der Verantwortlichen, je Kennung. Fehlt ein Eintrag: unbekannt. */
  erreichbar?: ReadonlyMap<string, boolean>;
  /** Anzeigenamen; nur gesetzt, wenn der Aufrufer Personendaten sehen darf. */
  namen?: ReadonlyMap<string, string> | null;
  /** Die Belegstellen des Antwortwegs (`AnswerResult.steps`) — nur für die wörtliche Stelle. */
  steps?: readonly { sourceId: string | null; snippet: string | null }[];
  /** R-0346: Rolle und Anlass. Fehlt er, gilt die enge Vorgabe (`unbekannt`, `frage`). */
  zuschnitt?: AntwortZuschnitt;
  /** Ben nacharbeit-11: die tatsächlich angehängten Wörterbucheinträge (aus `antwortZuschnitt`). */
  woerterbuch?: readonly { benennung: string; herkunft: BegriffHerkunft }[];
}

function argumentation(
  carryingKos: readonly KnowledgeObject[],
  konflikte: readonly AntwortKonflikt[],
  gruende: readonly BelastbarkeitsGrund[],
  lage: AntwortLage,
  einstufung: AnswerGrade,
  input: AntwortBelastbarkeitInput,
  zuschnitt: AntwortZuschnitt,
): ArgumentStufe[] {
  const rang = (art: KnowledgeType): number => {
    const i = zuschnitt.reihenfolge.indexOf(art);
    return i < 0 ? zuschnitt.reihenfolge.length : i;
  };
  // Stabil sortiert: gleiche Wissensart behält die Reihenfolge der tragenden Quellen.
  const geordnet = carryingKos
    .map((ko, i) => ({ ko, i }))
    .sort((a, b) => rang(a.ko.type) - rang(b.ko.type) || a.i - b.i)
    .map((e) => e.ko);
  const stufen: ArgumentStufe[] = geordnet.map((ko) => {
    const stelle = input.steps?.find((s) => s.sourceId === ko.id && (s.snippet ?? "").trim());
    return {
      art: "aussage",
      koId: ko.id,
      titel: ko.title,
      aussage: ko.statement,
      wissensart: ko.type,
      belegstelle: stelle?.snippet?.trim() ?? null,
      vertrauenswert: ko.trust,
      validiert: ko.status === "validiert",
      stand: standVon(ko),
    };
  });
  // Belegte Beziehungen: NUR aktive kuratierte Kanten, deren BEIDE Enden tragende Quellen sind.
  // Eine Kante zu einem fremden Objekt wäre eine Aussage über etwas, das die Antwort nicht trägt.
  const tragend = new Map(carryingKos.map((ko): [string, KnowledgeObject] => [ko.id, ko]));
  const verbunden = new Set<string>();
  const gesehen = new Set<string>();
  for (const k of input.beziehungen ?? []) {
    const von = tragend.get(k.quelleId);
    const zu = tragend.get(k.zielId);
    if (k.status !== "aktiv" || !von || !zu || von.id === zu.id || gesehen.has(k.id)) {
      continue;
    }
    gesehen.add(k.id);
    verbunden.add(von.id);
    verbunden.add(zu.id);
    stufen.push({
      art: "beziehung",
      kanteId: k.id,
      beziehung: k.art,
      gerichtet: k.richtung === "gerichtet",
      vonKoId: von.id,
      vonTitel: von.title,
      zuKoId: zu.id,
      zuTitel: zu.title,
      gesetztVon: input.namen ? (input.namen.get(k.urheber) ?? k.urheber) : null,
    });
  }
  // Der Einwand ist die GEGENSEITE — die Seite, die die Antwort nicht trägt.
  for (const k of konflikte) {
    for (const s of k.seiten) {
      if (!s.traegtAntwort) {
        stufen.push({ art: "einwand", konfliktId: k.konfliktId, seite: s });
      }
    }
  }
  for (const grund of gruende) {
    if (VORBEHALTE.includes(grund)) {
      stufen.push({ art: "vorbehalt", grund });
    }
  }
  stufen.push({
    art: "schluss",
    lage,
    einstufung,
    aussage: input.answer.answer?.trim() ? input.answer.answer.trim() : null,
    gestuetztAuf: geordnet.map((ko) => ko.id),
    unabhaengig: geordnet.length > 1 && geordnet.some((ko) => !verbunden.has(ko.id)),
  });
  return stufen;
}

function standVon(ko: KnowledgeObject): string {
  const letzter = ko.history?.[ko.history.length - 1];
  return letzter?.at ?? ko.createdAt;
}

function quelle(ko: KnowledgeObject, input: AntwortBelastbarkeitInput): QuellenBelastbarkeit {
  const verantwortlich = responsibleOf(ko);
  const erreichbar = input.erreichbar?.get(verantwortlich);
  return {
    koId: ko.id,
    titel: ko.title,
    version: ko.version,
    vertrauenswert: ko.trust,
    stand: standVon(ko),
    validiert: ko.status === "validiert",
    pruefstand: answerCheckState(ko),
    entscheidungFestgehalten: ko.validationDecisionRef !== undefined,
    verantwortung: {
      art: responsibleKindOf(ko),
      person: input.namen
        ? { id: verantwortlich, name: input.namen.get(verantwortlich) ?? null }
        : null,
      erreichbar: erreichbar ?? null,
    },
  };
}

function seite(
  id: string,
  carrying: readonly string[],
  input: AntwortBelastbarkeitInput,
): KonfliktSeite {
  const traegtAntwort = carrying.includes(id);
  const ko = input.kos.get(id);
  // Eine tragende Seite hat der Aufrufer bereits als Quelle bekommen. Jede andere nur, wenn sie
  // auflösbar, nicht vertraulich UND für ihn sichtbar ist — sonst wird ihre Existenz genannt, ihr
  // Inhalt nicht. „Nicht einsehbar" ist ehrlich; ein Weglassen würde den Konflikt verschweigen.
  const sichtbar =
    ko !== undefined &&
    !isConfidential(ko.confidentiality) &&
    (traegtAntwort || (input.seiteSichtbar?.(ko) ?? false));
  if (!ko || !sichtbar) {
    return { einsehbar: false, traegtAntwort };
  }
  return {
    einsehbar: true,
    koId: ko.id,
    titel: ko.title,
    aussage: ko.statement,
    version: ko.version,
    vertrauenswert: ko.trust,
    validiert: ko.status === "validiert",
    traegtAntwort,
  };
}

/**
 * Die Belastbarkeit einer Antwort. REINE RECHNUNG über die Eingaben.
 *
 * Rangfolge der Lage, und warum: ein offener Konflikt betrifft den INHALT der Antwort, die
 * fehlende Erreichbarkeit nur den Weg zur Klärung. Liegen beide vor, steht der Konflikt in der
 * Lage — die Verantwortungslücke bleibt als Grund und je Quelle sichtbar, sie wird nicht
 * verschluckt.
 */
export function antwortBelastbarkeit(input: AntwortBelastbarkeitInput): AntwortBelastbarkeit {
  const { answer, evidence } = input;
  const hinweis = "vertrauen_ist_kein_wahrheitsversprechen" as const;
  const zuschnitt = input.zuschnitt ?? antwortZuschnitt("unbekannt", "frage");
  if (!answer.answered) {
    return {
      lage: "wissensluecke",
      gruende: ["keine_tragfaehige_quelle"],
      vertrauenswert: { wert: null, herleitung: "keine_tragende_quelle", schwaechsteQuelle: null },
      quellenAnzahl: { herangezogen: answer.sources.length, tragend: 0 },
      quellen: [],
      konflikte: [],
      argumentation: [
        {
          art: "schluss",
          lage: "wissensluecke",
          einstufung: evidence.grade,
          aussage: null,
          gestuetztAuf: [],
          unabhaengig: false,
        },
      ],
      zuschnitt,
      hinweis,
    };
  }
  const carrying = answer.citedSources;
  const quellen = carrying.flatMap((id) => {
    const ko = input.kos.get(id);
    return ko ? [quelle(ko, input)] : [];
  });
  const konflikte: AntwortKonflikt[] = (input.openConflicts ?? [])
    .filter((c) => carrying.includes(c.koA) || carrying.includes(c.koB))
    .map((c) => {
      const seiten: [KonfliktSeite, KonfliktSeite] = [
        seite(c.koA, carrying, input),
        seite(c.koB, carrying, input),
      ];
      return {
        konfliktId: c.id,
        beschreibung: seiten.every((s) => s.einsehbar) ? c.description : null,
        seiten,
      };
    });

  const gruende: BelastbarkeitsGrund[] = [];
  if (carrying.length === 0) {
    gruende.push("zuordnung_unbekannt");
  } else if (quellen.length === carrying.length && quellen.every((q) => q.validiert)) {
    gruende.push("alle_tragenden_quellen_validiert");
  } else {
    gruende.push("tragende_quelle_nicht_validiert");
  }
  if (evidence.checkCaveat !== null && evidence.checkCaveat.reason !== "unattributed") {
    gruende.push("pruefnachweis_unvollstaendig");
  }
  if (evidence.sourcesConflicted) {
    gruende.push("offener_konflikt");
  }
  if (evidence.conflictsUnproven) {
    gruende.push("konfliktlage_unbekannt");
  }
  const zustaendigFehlt = quellen.some((q) => q.verantwortung.erreichbar === false);
  if (zustaendigFehlt) {
    gruende.push("zustaendig_nicht_erreichbar");
  }
  if (quellen.some((q) => q.verantwortung.erreichbar === null)) {
    gruende.push("erreichbarkeit_unbekannt");
  }
  if (quellen.some((q) => q.verantwortung.art === "author-fallback")) {
    gruende.push("verantwortung_nur_autor");
  }

  let schwaechste: QuellenBelastbarkeit | null = null;
  for (const q of quellen) {
    if (schwaechste === null || q.vertrauenswert < schwaechste.vertrauenswert) {
      schwaechste = q;
    }
  }

  const lage: AntwortLage = evidence.sourcesConflicted
    ? "belegt_mit_konflikt"
    : zustaendigFehlt
      ? "belegt_zustaendig_fehlt"
      : "belegt";
  const carryingKos = carrying.flatMap((id) => {
    const ko = input.kos.get(id);
    return ko ? [ko] : [];
  });

  return {
    lage,
    gruende,
    vertrauenswert:
      schwaechste === null
        ? { wert: null, herleitung: "keine_tragende_quelle", schwaechsteQuelle: null }
        : {
            wert: schwaechste.vertrauenswert,
            herleitung: "minimum_tragender_quellen",
            schwaechsteQuelle: schwaechste.koId,
          },
    quellenAnzahl: { herangezogen: answer.sources.length, tragend: carrying.length },
    quellen,
    konflikte,
    argumentation: argumentation(
      carryingKos,
      konflikte,
      gruende,
      lage,
      evidence.grade,
      input,
      zuschnitt,
    ),
    zuschnitt,
    ...(input.woerterbuch && input.woerterbuch.length > 0
      ? {
          woerterbuch: input.woerterbuch.map(
            (w): WoerterbuchErgaenzung => ({
              benennung: w.benennung,
              herkunft: { ...w.herkunft },
              vertrauenswert: null,
              belastbarkeit: "nicht_bewertet",
            }),
          ),
        }
      : {}),
    hinweis,
  };
}

/**
 * Welche Wissensobjekte müssen für die Gegenseiten noch geladen werden? Die Route lädt sie über
 * denselben Leseweg wie die Quellen — hier wird nur bestimmt, WELCHE.
 */
export function konfliktGegenseiten(
  carrying: readonly string[],
  openConflicts: readonly Conflict[] | null,
): string[] {
  const ids = new Set<string>();
  for (const c of openConflicts ?? []) {
    if (carrying.includes(c.koA) || carrying.includes(c.koB)) {
      for (const id of [c.koA, c.koB]) {
        if (!carrying.includes(id)) {
          ids.add(id);
        }
      }
    }
  }
  return [...ids];
}
