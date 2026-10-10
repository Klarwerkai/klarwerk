import type { AuditEntry } from "../../audit";
import type { KnowledgeObject, KoVersionSnapshot } from "../../knowledge-object";
import type { AnswerResult } from "../../reasoner";

// ================================================================================================
// R-1630 / R-2176 — „DIESE FRAGE HÄTTE VOR EINEM JAHR EINE ANDERE ANTWORT GEHABT."
// ================================================================================================
//
// Der Wunsch aus der Roadmap (2.4): auf Wunsch zeigen, welche Antwort der damalige Wissensstand
// ergeben hätte, und den Grund der Änderung nennen. Der Befund B07 aus der Codex-Analyse dazu:
// Versionen und Audit gibt es je Objekt, aber keinen Nutzerweg für eine ganze Antwort.
//
// WIE DIE ALTE ANTWORT ENTSTEHT: dieselbe Frage, derselbe Antwortweg, dieselben Filter — nur die
// Wissensobjekte stehen in der Fassung, die zum Stichtag galt. Beide Antworten werden JETZT gebildet;
// es gibt keine gespeicherte Antwort von damals (der Antwortbeleg trägt weder Frage noch Text).
// Der Vergleich zeigt deshalb, was der damalige BESTAND ergeben hätte — nicht, was jemand damals
// tatsächlich gelesen hat.
//
// DIE DREI BELEGE, AUS DENEN DER DAMALIGE STAND ENTSTEHT, und nur diese:
//   · der Verlauf am Objekt (`history`) — welche Fassung zum Stichtag galt;
//   · die unveränderlichen Versionsabbilder (`versionsOf`) — ihr Inhalt;
//   · das Prüfprotokoll — ob diese Fassung zum Stichtag freigegeben war.
// Fehlt einer, gilt die Fassung als nicht belegt und trägt die alte Antwort nicht. Geraten wird nie.

/** Ohne eigene Angabe: genau ein Jahr vor jetzt (R-1630: „Stand vor 12 Monaten"). */
export const WISSENSSTAND_STANDARD_ABSTAND_TAGE = 365;

const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Der Stichtag als Zeitpunkt. Ohne Angabe ein Jahr vor `jetztMs`; mit Angabe (`JJJJ-MM-TT`) das Ende
 * dieses Tages (UTC), damit alles gilt, was an diesem Tag noch geschah. Ein ungültiger Tag oder ein
 * Tag, der nicht vor heute liegt, ergibt `null` — ein Vergleich mit „heute" wäre keiner.
 */
export function stichtagAus(eingabe: string | undefined, jetztMs: number): number | null {
  if (eingabe === undefined || eingabe.trim() === "") {
    return jetztMs - WISSENSSTAND_STANDARD_ABSTAND_TAGE * TAG_MS;
  }
  const tag = eingabe.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) {
    return null;
  }
  const beginn = Date.parse(`${tag}T00:00:00.000Z`);
  if (!Number.isFinite(beginn) || new Date(beginn).toISOString().slice(0, 10) !== tag) {
    return null;
  }
  const ende = beginn + TAG_MS - 1;
  return ende < jetztMs ? ende : null;
}

function zeitpunkt(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/** Welche Fassung eines Objekts zum Stichtag galt — oder warum das nicht belegt ist. */
export type FassungZumStichtag =
  | { readonly art: "fassung"; readonly version: number; readonly ko: KnowledgeObject }
  | { readonly art: "gab_es_nicht" }
  | { readonly art: "fassung_unbelegt" };

/**
 * Die Fassung zum Stichtag.
 *
 * Der VERLAUF bestimmt die Nummer: die höchste Fassung, deren Eintrag spätestens am Stichtag steht.
 * Ist das die heutige Fassung, ist das heutige Objekt der damalige Inhalt. Sonst liefert das
 * Versionsabbild genau dieser Nummer den Inhalt. Fehlt es, ist die Fassung nicht belegt — das
 * nächstliegende Abbild an ihre Stelle zu setzen wäre ein erfundener Stand.
 */
export function fassungZumStichtag(
  heute: KnowledgeObject,
  versionen: readonly KoVersionSnapshot[],
  stichtagMs: number,
): FassungZumStichtag {
  const erstellt = zeitpunkt(heute.createdAt);
  if (Number.isNaN(erstellt)) {
    return { art: "fassung_unbelegt" };
  }
  if (erstellt > stichtagMs) {
    return { art: "gab_es_nicht" };
  }
  let version: number | undefined;
  for (const eintrag of heute.history ?? []) {
    const at = zeitpunkt(eintrag.at);
    if (Number.isNaN(at)) {
      return { art: "fassung_unbelegt" };
    }
    if (at <= stichtagMs && (version === undefined || eintrag.version > version)) {
      version = eintrag.version;
    }
  }
  if (version === undefined) {
    // Kein Verlaufseintrag bis zum Stichtag, obwohl das Objekt schon bestand: nur wenn es auch
    // danach keinen gibt, ist der heutige Inhalt der damalige.
    const spaeter = (heute.history ?? []).length > 0;
    return spaeter
      ? { art: "fassung_unbelegt" }
      : { art: "fassung", version: heute.version, ko: heute };
  }
  if (version === heute.version) {
    return { art: "fassung", version, ko: heute };
  }
  const abbild = versionen.find((v) => v.koId === heute.id && v.version === version);
  return abbild ? { art: "fassung", version, ko: abbild.snapshot } : { art: "fassung_unbelegt" };
}

/** Die Entscheidungen, die eine Freigabe tragen (Spiegel der Auditregel, `VALIDATION_DECISION_ACTIONS`). */
const FREIGABE_ENTSCHEIDUNGEN = ["ko.rated", "ko.admin-validated"];
const RUECKGABEN = ["ko.returned-to-author", "ko.returned-to-owner"];

/**
 * War GENAU DIESE Fassung zum Stichtag freigegeben — belegt im Prüfprotokoll?
 *
 * Zwei Belegwege, beide an die Fassung gebunden (`payload.koVersion`):
 *   1. die Entscheidung, auf die das Objekt heute verweist (`validationDecisionRef`) — wenn sie
 *      dieselbe Fassung betrifft und vor dem Stichtag fiel. Das ist der Weg der Bewertungen, deren
 *      Freigabe sonst nur aus der Stimmenzählung folgt.
 *   2. eine Admin-Freigabe dieser Fassung vor dem Stichtag, auf die bis dahin keine Rückgabe
 *      derselben Fassung folgte.
 * Alles andere ist „nicht belegt". Das heisst ausdrücklich nicht „war nicht freigegeben".
 */
export function freigabeZumStichtagBelegt(
  heute: KnowledgeObject,
  version: number,
  eintraege: readonly AuditEntry[],
  stichtagMs: number,
): boolean {
  const passt = (e: AuditEntry): boolean =>
    e.target === heute.id &&
    e.payload.koVersion === version &&
    !Number.isNaN(zeitpunkt(e.at)) &&
    zeitpunkt(e.at) <= stichtagMs;
  const ref = heute.validationDecisionRef;
  if (ref && heute.status === "validiert" && heute.version === version) {
    const entscheidung = eintraege.find((e) => e.seq === ref.auditSeq);
    if (
      entscheidung &&
      entscheidung.hash === ref.auditHash &&
      FREIGABE_ENTSCHEIDUNGEN.includes(entscheidung.action) &&
      passt(entscheidung)
    ) {
      return true;
    }
  }
  const freigaben = eintraege.filter((e) => e.action === "ko.admin-validated" && passt(e));
  if (freigaben.length === 0) {
    return false;
  }
  const letzte = Math.max(...freigaben.map((e) => e.seq));
  return !eintraege.some((e) => RUECKGABEN.includes(e.action) && passt(e) && e.seq > letzte);
}

/**
 * Warum sich eine Quelle zwischen Stichtag und heute unterscheidet. Mehrere Gründe können
 * zusammentreffen (überarbeitet UND danach noch nicht wieder freigegeben).
 */
export type Aenderungsgrund =
  /** Das Objekt wurde erst nach dem Stichtag angelegt. */
  | "neu_seit_stichtag"
  /** Der Inhalt wurde seit dem Stichtag überarbeitet. */
  | "ueberarbeitet"
  /** Die damalige Fassung ist nicht belegt (Verlauf oder Versionsabbild fehlen). */
  | "fassung_unbelegt"
  /** Eine Freigabe der damaligen Fassung zum Stichtag ist im Prüfprotokoll nicht belegt. */
  | "freigabe_damals_unbelegt"
  /** Heute ist das Objekt nicht freigegeben und deshalb keine Grundlage. */
  | "heute_nicht_freigegeben"
  /** Die damalige Fassung darf nicht in den Antwortweg (Stufe, Sichtbarkeit oder Schutzdaten). */
  | "damals_gesperrt"
  /** Gleiche Fassung, zu beiden Zeitpunkten Grundlage. */
  | "unveraendert";

/** Ein Verlaufseintrag zwischen Stichtag und heute — der Vermerk wird in der Oberfläche übersetzt. */
export interface Aenderungseintrag {
  readonly version: number;
  readonly at: string;
  readonly note: string;
  readonly restoredFrom?: number;
}

export interface VergleichsQuelle {
  readonly id: string;
  /** Der heutige Titel; `titelDamals` nur, wenn er sich unterscheidet und die Fassung belegt ist. */
  readonly title: string;
  readonly titelDamals: string | null;
  readonly versionHeute: number;
  readonly versionDamals: number | null;
  readonly inAntwortHeute: boolean;
  readonly inAntwortDamals: boolean;
  readonly gruende: readonly Aenderungsgrund[];
  readonly aenderungen: readonly Aenderungseintrag[];
  /**
   * Die Kernaussagen — nur von Fassungen, die zu ihrem Zeitpunkt Antwortgrundlage sein durften
   * (freigegeben, zulässig), und nur, wenn sie sich unterscheiden. Ungeprüfter Inhalt erscheint hier
   * nie; dieselbe Grenze wie bei `ungeprueft` im Antwortweg.
   */
  readonly aussageDamals: string | null;
  readonly aussageHeute: string | null;
}

export interface WissensstandVergleich {
  /** Der Stichtag als ISO-Zeitpunkt. */
  readonly stichtag: string;
  readonly heute: AnswerResult;
  readonly damals: AnswerResult;
  /** Unterscheiden sich Antworttext oder tragende Grundlage? */
  readonly antwortGeaendert: boolean;
  readonly quellen: readonly VergleichsQuelle[];
}

/** Eine Seite des Vergleichs je Objekt, wie der Dienst sie ermittelt hat. */
export interface VergleichsSeiten {
  readonly heute: KnowledgeObject;
  /** Darf das heutige Objekt Antwortgrundlage sein (freigegeben und zulässig)? */
  readonly grundlageHeute: boolean;
  readonly fassung: FassungZumStichtag;
  readonly freigabeDamals: boolean;
  /** Darf die damalige Fassung in den Antwortweg (Stufe, Sichtbarkeit, Schutzdaten)? */
  readonly damalsZulaessig: boolean;
}

/** Darf die damalige Fassung Grundlage der alten Antwort sein? */
export function grundlageDamals(seiten: VergleichsSeiten): KnowledgeObject | null {
  return seiten.fassung.art === "fassung" && seiten.freigabeDamals && seiten.damalsZulaessig
    ? seiten.fassung.ko
    : null;
}

/** Die Gründe eines Objekts — abgeleitet, nicht behauptet. */
export function aenderungsgruende(seiten: VergleichsSeiten): Aenderungsgrund[] {
  const { fassung } = seiten;
  if (fassung.art === "gab_es_nicht") {
    return seiten.grundlageHeute
      ? ["neu_seit_stichtag"]
      : ["neu_seit_stichtag", "heute_nicht_freigegeben"];
  }
  if (fassung.art === "fassung_unbelegt") {
    return seiten.grundlageHeute
      ? ["fassung_unbelegt"]
      : ["fassung_unbelegt", "heute_nicht_freigegeben"];
  }
  const gruende: Aenderungsgrund[] = [];
  if (fassung.version < seiten.heute.version) {
    gruende.push("ueberarbeitet");
  }
  if (!seiten.damalsZulaessig) {
    gruende.push("damals_gesperrt");
  } else if (!seiten.freigabeDamals) {
    gruende.push("freigabe_damals_unbelegt");
  }
  if (!seiten.grundlageHeute) {
    gruende.push("heute_nicht_freigegeben");
  }
  return gruende.length > 0 ? gruende : ["unveraendert"];
}

/** Die Verlaufseinträge NACH der damaligen Fassung — das, was seither am Objekt geschah. */
export function aenderungenSeit(
  heute: KnowledgeObject,
  fassung: FassungZumStichtag,
): Aenderungseintrag[] {
  const ab = fassung.art === "fassung" ? fassung.version : 0;
  return (heute.history ?? [])
    .filter((e) => e.version > ab)
    .map((e) => ({
      version: e.version,
      at: e.at,
      note: e.note,
      ...(e.restoredFrom !== undefined ? { restoredFrom: e.restoredFrom } : {}),
    }));
}

/** Der Eintrag einer Quelle im Vergleich. */
export function vergleichsQuelle(
  seiten: VergleichsSeiten,
  inAntwortHeute: boolean,
  inAntwortDamals: boolean,
): VergleichsQuelle {
  const damals = grundlageDamals(seiten);
  const heute = seiten.heute;
  const aussageUnterschied =
    damals !== null && seiten.grundlageHeute && damals.statement !== heute.statement;
  return {
    id: heute.id,
    title: heute.title,
    titelDamals: damals !== null && damals.title !== heute.title ? damals.title : null,
    versionHeute: heute.version,
    versionDamals: seiten.fassung.art === "fassung" ? seiten.fassung.version : null,
    inAntwortHeute,
    inAntwortDamals,
    gruende: aenderungsgruende(seiten),
    aenderungen: aenderungenSeit(heute, seiten.fassung),
    aussageDamals: aussageUnterschied ? damals.statement : null,
    aussageHeute: aussageUnterschied ? heute.statement : null,
  };
}

/** Hat sich die Antwort geändert — im Text oder in der tragenden Grundlage? */
export function antwortGeaendert(heute: AnswerResult, damals: AnswerResult): boolean {
  if (heute.answered !== damals.answered) {
    return true;
  }
  if ((heute.answer ?? "").trim() !== (damals.answer ?? "").trim()) {
    return true;
  }
  const getragen = (r: AnswerResult): string =>
    [...(r.citedSources.length > 0 ? r.citedSources : r.sources)].sort().join("|");
  return getragen(heute) !== getragen(damals);
}
