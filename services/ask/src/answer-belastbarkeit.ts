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
  isConfidential,
  responsibleKindOf,
  responsibleOf,
} from "../../knowledge-object";
import { type AnswerCheckState, type AnswerEvidence, answerCheckState } from "./answer-evidence";

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
  hinweis: "vertrauen_ist_kein_wahrheitsversprechen";
}

export interface AntwortBelastbarkeitInput {
  answer: { answered: boolean; sources: readonly string[]; citedSources: readonly string[] };
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
  if (!answer.answered) {
    return {
      lage: "wissensluecke",
      gruende: ["keine_tragfaehige_quelle"],
      vertrauenswert: { wert: null, herleitung: "keine_tragende_quelle", schwaechsteQuelle: null },
      quellenAnzahl: { herangezogen: answer.sources.length, tragend: 0 },
      quellen: [],
      konflikte: [],
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

  return {
    lage: evidence.sourcesConflicted
      ? "belegt_mit_konflikt"
      : zustaendigFehlt
        ? "belegt_zustaendig_fehlt"
        : "belegt",
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
