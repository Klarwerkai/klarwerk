import type { KnowledgeObject } from "../../knowledge-object";
import { type ReceiptAussagefassung, aussageFingerabdruck } from "./receipt";
import { AskError, type Gap, type GapBeanstandung, type GapBeanstandungMeldung } from "./types";

// ================================================================================================
// produkt:20261010:antwort-beanstandung-korrektur — VON DER BEANSTANDETEN AUSSAGE ZUR KORREKTUR.
// ================================================================================================
//
// WAS SCHON DA WAR UND BLEIBT: die Meldung „Antwort falsch / Quelle passt nicht" (`reportAnswer`,
// R-1089) mit signiertem Antwortbeleg, Meldekennung, idempotentem Protokolleintrag und Zustellung an
// die verantwortliche Person. Sie wird nicht neu gebaut.
//
// WAS HIER DAZUKOMMT, als reine Regeln ohne Zustand:
//   · die Eingabe einer Beanstandung — konkrete Aussage (Kennung + Wortlaut), wahlweise eine
//     Fundstelle oder „Quelle fehlt", und eine KURZE Begründung;
//   · ihre Prüfung gegen die Aussagefassung, die der Antwortbeleg signiert hat (`receipt.ts`). Der
//     Wortlaut muss zum signierten Fingerabdruck passen, die Fundstelle zur signierten Aussage. Ein
//     Titel oder ein gleich lautender Text einer späteren Fassung belegt nichts;
//   · der Vergleichsschlüssel, über den dieselbe Aussage an derselben Quelle EIN Vorgang bleibt;
//   · die Sicht eines Beteiligten auf die Beanstandung — nur der zulässige Kontext.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT: keine Feedbackdatenbank. Die Beanstandung ist eine
// Wissenslücke (`Gap.beanstandung`) im bestehenden Vorgang (Zuständigkeit, Rückfrage, fachlicher
// Abschluss nur mit freigegebenem Wissen, Rückmeldung). Weder Meldung noch Vorgang ändern ein
// Wissensobjekt; korrigiert wird über die vorhandene Überarbeitung und Fachprüfung.

/** Höchstlänge der Begründung (Zeichen) — „kurz", und nie ein Gesprächsprotokoll. */
export const BEANSTANDUNG_BEGRUENDUNG_MAX = 500;
/** Höchstlänge einer beanstandeten Aussage (Zeichen). */
export const BEANSTANDUNG_AUSSAGE_MAX = 2000;
/** Präfix des Vergleichsschlüssels — eine gewöhnliche Frage kann keinen Doppelpunkt tragen. */
export const BEANSTANDUNG_SCHLUESSEL = "beanstandung:";
/**
 * Der Fragetext eines Beanstandungsvorgangs: eine Neutralbezeichnung, nie die Aussage selbst
 * (Begründung in `AskService.beanstandungsVorgang`). Die Oberfläche übersetzt über `beanstandung`.
 */
export const BEANSTANDUNG_FRAGE = "Beanstandete Aussage einer Antwort";

export interface BeanstandungEingabe {
  readonly aussageId: string;
  readonly aussageText: string;
  readonly fundstelleId: string | null;
  readonly quelleFehlt: boolean;
  readonly begruendung: string;
}

/** Liest die Beanstandung aus dem Anfragekörper (`aussage`, `begruendung`); ungültig → BAD_REQUEST. */
export function leseBeanstandung(roh: unknown, begruendung: unknown): BeanstandungEingabe {
  const a = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : null;
  const aussageId = typeof a?.aussageId === "string" ? a.aussageId.trim() : "";
  const aussageText = typeof a?.text === "string" ? a.text.replace(/\s+/g, " ").trim() : "";
  if (!aussageId || !aussageText || [...aussageText].length > BEANSTANDUNG_AUSSAGE_MAX) {
    throw new AskError("BAD_REQUEST", "Die beanstandete Aussage fehlt oder ist ungültig.");
  }
  const fundstelleId =
    typeof a?.fundstelleId === "string" && a.fundstelleId.trim() ? a.fundstelleId.trim() : null;
  const quelleFehlt = a?.quelleFehlt === true;
  if (fundstelleId && quelleFehlt) {
    throw new AskError(
      "BAD_REQUEST",
      "Eine Fundstelle beanstanden und eine fehlende Quelle melden schliessen sich aus.",
    );
  }
  const text = typeof begruendung === "string" ? begruendung.trim() : "";
  if (text.length === 0 || [...text].length > BEANSTANDUNG_BEGRUENDUNG_MAX) {
    throw new AskError(
      "BAD_REQUEST",
      `Die Begründung muss zwischen 1 und ${BEANSTANDUNG_BEGRUENDUNG_MAX} Zeichen lang sein.`,
    );
  }
  return { aussageId, aussageText, fundstelleId, quelleFehlt, begruendung: text };
}

/** Das Ergebnis der Belegprüfung: welche Quelle, in welcher Fassung, aus welcher Antwort. */
export interface GebundeneBeanstandung {
  readonly koId: string | null;
  readonly koVersion: number | null;
  readonly answerId: string | null;
  readonly aussageFingerabdruck: string;
  readonly aussageKoIds: readonly string[];
}

/**
 * Prüft die Beanstandung gegen die signierte Aussagefassung des Belegs. `koId` ist die Quelle, die
 * der Melder gewählt hat (leer erlaubt nur bei „Quelle fehlt" oder mit Fundstelle).
 *   · Beleg ohne Aussagefassung (älterer Beleg): BAD_REQUEST — die Bindung fehlt ausdrücklich.
 *   · Aussage nicht in diesem Beleg, Wortlaut weicht ab, Fundstelle gehört nicht zur Aussage, Quelle
 *     nicht ausgeliefert: FORBIDDEN — dieselbe Auskunft wie ein fremder Beleg.
 */
export function bindeBeanstandung(
  eingabe: BeanstandungEingabe,
  beleg: { readonly sources: readonly string[]; readonly fassung?: ReceiptAussagefassung },
  koId: string,
): GebundeneBeanstandung {
  const fassung = beleg.fassung;
  if (!fassung) {
    throw new AskError(
      "BAD_REQUEST",
      "Dieser Antwortbeleg trägt keine Aussagefassung — bitte die Frage neu stellen und dann beanstanden.",
    );
  }
  const verweigert = (): never => {
    throw new AskError("FORBIDDEN", "Die Aussage gehört nicht zu diesem Antwortbeleg.");
  };
  const aussage = fassung.aussagen.find((a) => a.aussageId === eingabe.aussageId) ?? verweigert();
  const fingerabdruck = aussageFingerabdruck(eingabe.aussageText);
  if (aussage.fingerabdruck !== fingerabdruck) {
    verweigert();
  }
  const gewaehlt = koId.trim();
  let quelle: string | null;
  if (eingabe.fundstelleId) {
    const stelle =
      aussage.fundstellen.find((f) => f.fundstelleId === eingabe.fundstelleId) ?? verweigert();
    if (gewaehlt && gewaehlt !== stelle.koId) {
      verweigert();
    }
    quelle = stelle.koId;
  } else if (gewaehlt) {
    const ausgeliefert =
      beleg.sources.includes(gewaehlt) || aussage.fundstellen.some((f) => f.koId === gewaehlt);
    if (!ausgeliefert) {
      verweigert();
    }
    quelle = gewaehlt;
  } else if (eingabe.quelleFehlt) {
    quelle = null;
  } else {
    throw new AskError("BAD_REQUEST", "Zu welcher Quelle gehört die beanstandete Aussage (koId)?");
  }
  const fassungDerQuelle = quelle === null ? undefined : fassung.quellenStand[quelle];
  return {
    koId: quelle,
    koVersion: typeof fassungDerQuelle === "number" ? fassungDerQuelle : null,
    answerId: fassung.answerId,
    aussageFingerabdruck: fingerabdruck,
    aussageKoIds: [...new Set(aussage.fundstellen.map((f) => f.koId))],
  };
}

/**
 * Derselbe Vorgang für dieselbe Aussage an derselben Quelle — gleich, aus welcher Antwort und von
 * wem. Ohne Quelle („Quelle fehlt") zählt die Aussage allein.
 */
export function beanstandungsSchluessel(koId: string | null, fingerabdruck: string): string {
  return `${BEANSTANDUNG_SCHLUESSEL}${koId ?? "ohne-quelle"}:${fingerabdruck}`;
}

/** Hängt eine Meldung an — dieselbe Meldekennung ein zweites Mal ändert nichts (`null`). */
export function mitBeanstandungsMeldung(
  gap: Gap,
  basis: Omit<GapBeanstandung, "meldungen">,
  meldung: GapBeanstandungMeldung,
): Gap | null {
  const vorhanden = gap.beanstandung;
  if (vorhanden?.meldungen.some((m) => m.meldungId === meldung.meldungId)) {
    return null;
  }
  const bisher = vorhanden ?? basis;
  return {
    ...gap,
    beanstandung: {
      ...bisher,
      // Ben, Nacharbeit 2: die Quellenabhängigkeiten ALLER Meldungen bleiben erhalten — eine spätere
      // Meldung kann dieselbe Aussage aus einer weiteren (auch vertraulichen) Quelle tragen.
      aussageKoIds: [
        ...new Set([...bisher.aussageKoIds, ...basis.aussageKoIds, ...quellenDerMeldung(meldung)]),
      ],
      meldungen: [...(vorhanden?.meldungen ?? []), meldung],
    },
  };
}

/** Die Quellen EINER Meldung; Altbestand ohne eigene Angabe → leer (dann gilt die Vorgangsmenge). */
function quellenDerMeldung(m: GapBeanstandungMeldung): string[] {
  return m.aussageKoIds ?? [];
}

/**
 * Alle Objekte, von denen die Beanstandung abhängt: beanstandete Quelle, Vorgangsmenge und die
 * Quellen jeder einzelnen Meldung. Konservativ — fehlt eine, gilt der Kontext als nicht frei.
 */
export function beanstandungsQuellen(b: GapBeanstandung): string[] {
  return [
    ...new Set([
      ...(b.koId ? [b.koId] : []),
      ...b.aussageKoIds,
      ...b.meldungen.flatMap(quellenDerMeldung),
    ]),
  ];
}

/** Die Quellen, die eine einzelne Meldung voraussetzt (Altbestand: die Vorgangsmenge). */
function quellenFuer(b: GapBeanstandung, m: GapBeanstandungMeldung): string[] {
  const eigene = m.aussageKoIds ?? b.aussageKoIds;
  return [...new Set([...(b.koId ? [b.koId] : []), ...eigene])];
}

/**
 * produkt:20261010:antwort-beanstandung-korrektur (Ben, Nacharbeit 2) — AN WEN EINE RÜCKFRAGE GEHT.
 *
 * Bei einer Beanstandung ist jede Rückfrage an den Melder GENAU EINER Meldung gerichtet. Ohne
 * gewählte Meldung nur, wenn es genau eine gibt; sonst BAD_REQUEST — es wird kein Melder geraten.
 */
export function beanstandungsAdressat(
  b: GapBeanstandung,
  meldungId: string | undefined,
): { readonly von: string; readonly meldungId: string } {
  const gewaehlt = meldungId?.trim();
  const meldung = gewaehlt
    ? b.meldungen.find((m) => m.meldungId === gewaehlt)
    : b.meldungen.length === 1
      ? b.meldungen[0]
      : undefined;
  if (!meldung) {
    throw new AskError(
      "BAD_REQUEST",
      gewaehlt
        ? "Diese Meldung gehört nicht zu dieser Beanstandung."
        : "Die Beanstandung hat mehrere Meldungen — die Rückfrage geht an genau eine (meldungId).",
    );
  }
  return { von: meldung.von, meldungId: meldung.meldungId };
}

// ================================================================================================
// DIE SICHT EINES BETEILIGTEN — NUR DER ZULÄSSIGE KONTEXT.
// ================================================================================================
//
//   · Der MELDER sieht seine eigenen Meldungen samt eigener Begründung, Antwortkennung und damaliger
//     Fassung — fremde Meldungen nur als Zahl.
//   · Die ZUSTÄNDIGE PERSON sieht die Aussage und die Begründungen (sie sind an sie gerichtet), aber
//     keine Melderkennungen und nie die Frage oder den übrigen Antworttext — die stehen nirgends.
//     Die Aussage selbst nur, wenn sie HEUTE jede Quelle sehen darf, aus der die Aussage stammte;
//     sonst ist sie zurückgehalten (sie könnte vertraulichen Inhalt einer fremden Quelle tragen).
//   · VERWALTENDE ohne eigene Rolle sehen Ablauf, Quelle und Zahlen — keinen Text (wie bei Lücken).

export interface BeanstandungEigeneMeldung {
  readonly meldungId: string;
  readonly at: string;
  readonly answerId: string | null;
  readonly aussageId: string;
  readonly koVersion: number | null;
  readonly fundstelleId: string | null;
  readonly quelleFehlt: boolean;
  readonly begruendung: string;
}

export interface BeanstandungSicht {
  /** Die beanstandete Quelle; `null` bei fehlender Quelle oder ohne Zugriff des Betrachters. */
  readonly koId: string | null;
  readonly quelleZugaenglich: boolean;
  readonly quelleFehlt: boolean;
  /** Die Fassung(en), die die beanstandeten Antworten damals trugen — nie umgeschrieben. */
  readonly fassungenDamals: readonly number[];
  readonly aussage: string;
  readonly aussageZurueckgehalten: boolean;
  readonly meldungen: number;
  readonly eigeneMeldungen: readonly BeanstandungEigeneMeldung[];
  /**
   * Nur für die zuständige Person: die Begründungen, ohne Melderkennung. `meldungId` ist die
   * Meldekennung (keine Person) — an sie richtet sich eine Rückfrage.
   */
  readonly begruendungen: readonly {
    readonly meldungId: string;
    readonly at: string;
    readonly text: string;
  }[];
}

export function beanstandungSicht(
  b: GapBeanstandung,
  betrachter: {
    readonly id: string;
    readonly fragend: boolean;
    readonly zustaendig: boolean;
    /** Darf der Betrachter dieses Objekt HEUTE sehen? Unbekannt/gelöscht → `false`. */
    readonly siehtObjekt: (koId: string) => boolean;
  },
): BeanstandungSicht {
  const eigene = b.meldungen.filter((m) => m.von === betrachter.id);
  const quelleZugaenglich = b.koId !== null && betrachter.siehtObjekt(b.koId);
  // Ben, Nacharbeit 2: geprüft wird gegen ALLE Quellen aller zugeführten Meldungen (Vereinigung) —
  // eine weitere, gesperrte Quelle einer späteren Meldung hält Aussage und Begründungen zurück.
  const kontextFrei = beanstandungsQuellen(b).every((id) => betrachter.siehtObjekt(id));
  // Der Melder bekam die Aussage selbst ausgeliefert — sie bleibt ihm aber nur, solange er die
  // Quellen SEINER Meldungen heute noch lesen darf (Rechteentzug wirkt beim nächsten Abruf).
  const eigeneFrei =
    eigene.length > 0 &&
    eigene.every((m) => quellenFuer(b, m).every((id) => betrachter.siehtObjekt(id)));
  const aussageFrei = (betrachter.fragend && eigeneFrei) || (betrachter.zustaendig && kontextFrei);
  return {
    koId: quelleZugaenglich ? b.koId : null,
    quelleZugaenglich,
    quelleFehlt: b.koId === null,
    fassungenDamals: [
      ...new Set(
        b.meldungen.flatMap((m) => (typeof m.koVersion === "number" ? [m.koVersion] : [])),
      ),
    ].sort((x, y) => x - y),
    aussage: aussageFrei ? b.aussageText : "",
    aussageZurueckgehalten: !aussageFrei,
    meldungen: b.meldungen.length,
    eigeneMeldungen: eigene.map((m) => ({
      meldungId: m.meldungId,
      at: m.at,
      answerId: m.answerId,
      aussageId: m.aussageId,
      koVersion: m.koVersion,
      fundstelleId: m.fundstelleId,
      quelleFehlt: m.quelleFehlt,
      begruendung: m.begruendung,
    })),
    begruendungen:
      betrachter.zustaendig && kontextFrei
        ? b.meldungen.map((m) => ({ meldungId: m.meldungId, at: m.at, text: m.begruendung }))
        : [],
  };
}

/**
 * PV-04-05: eine KORREKTUR ist eine neuere, geprüfte Fassung — oder ein anderes, geprüftes Objekt.
 * Dieselbe Quelle in der beanstandeten (oder einer älteren) Fassung ist keine Korrektur; dafür gibt
 * es die begründete Zurückweisung.
 */
export function istKorrektur(
  b: GapBeanstandung,
  ko: Pick<KnowledgeObject, "id" | "version">,
): boolean {
  if (b.koId === null || ko.id !== b.koId) {
    return true;
  }
  const damals = b.meldungen.flatMap((m) => (typeof m.koVersion === "number" ? [m.koVersion] : []));
  return damals.length === 0 ? true : ko.version > Math.max(...damals);
}
