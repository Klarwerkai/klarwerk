import type { AuditEntry } from "../../audit";
import {
  type KnowledgeObject,
  type KoVersionSnapshot,
  isValidConfidentiality,
} from "../../knowledge-object";
import type { AnswerResult } from "../../reasoner";
import { type Verdict, computeOutcome } from "../../validation";
import type { AussagenBeleg } from "./aussage-fundstellen";

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

function abbildDerFassung(id: string, version: number, versionen: readonly KoVersionSnapshot[]) {
  return versionen.find(
    (v) =>
      v.koId === id &&
      v.version === version &&
      v.snapshot.id === id &&
      v.snapshot.version === version,
  );
}

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
    // Ohne Versionsverlauf ist nur die nie überarbeitete erste Fassung seit ihrer Anlage belegt.
    const fassungUnbekannt = heute.version !== 1 || (heute.history ?? []).length > 0;
    return fassungUnbekannt
      ? { art: "fassung_unbelegt" }
      : { art: "fassung", version: heute.version, ko: heute };
  }
  if (version === heute.version) {
    return { art: "fassung", version, ko: heute };
  }
  const abbild = abbildDerFassung(heute.id, version, versionen);
  return abbild ? { art: "fassung", version, ko: abbild.snapshot } : { art: "fassung_unbelegt" };
}

/**
 * Einstufung, Space und Quellleser können sich ohne neue Inhaltsfassung ändern. Das Abbild
 * liefert den Anfangsstand. Spätere Belege derselben Fassung schreiben ihn bis zum Stichtag fort.
 * Namen von Quelllesern stehen absichtlich nicht im Protokoll.
 */
export function lesestandZumStichtag(
  fassung: KnowledgeObject,
  heute: KnowledgeObject,
  versionen: readonly KoVersionSnapshot[],
  eintraege: readonly AuditEntry[],
  stichtagMs: number,
): KnowledgeObject | null {
  const rechte = eintraege
    .filter(
      (e) =>
        e.target === heute.id &&
        ["ko.confidentiality", "ko.quellrechte", "ko.space-changed"].includes(e.action),
    )
    .sort((a, b) => a.seq - b.seq);
  if (rechte.length === 0) return fassung;
  // Bei Altbestand ohne Abbild beweist der heutige Stand die Rechte nur dann, wenn sie nach
  // dem Stichtag nicht mehr geändert wurden.
  const abbild = abbildDerFassung(fassung.id, fassung.version, versionen);
  if (!abbild) return rechte.some((e) => !(zeitpunkt(e.at) <= stichtagMs)) ? null : fassung;
  const anfang = zeitpunkt(abbild.at);
  if (!(anfang <= stichtagMs)) return null;
  // Ohne Zeitstempel lässt sich eine Rechteänderung keinem Stichtag zuordnen.
  if (rechte.some((e) => Number.isNaN(zeitpunkt(e.at)))) return null;
  let { confidentiality, spaceId, quellrechte } = abbild.snapshot;
  let unbekannteLeser = false;
  let spaetereQuellrechte = false;
  for (const e of rechte) {
    const at = zeitpunkt(e.at);
    if (at < anfang) continue;
    if (at > stichtagMs) {
      if (e.action === "ko.quellrechte") spaetereQuellrechte = true;
      continue;
    }
    if (e.action === "ko.space-changed") {
      if (e.payload.version !== fassung.version) continue;
      if (typeof e.payload.nachher === "string") spaceId = e.payload.nachher;
      else if (e.payload.nachher === null) spaceId = undefined;
      else return null;
      continue;
    }
    if (!isValidConfidentiality(e.payload.level)) return null;
    confidentiality = e.payload.level;
    if (e.action === "ko.quellrechte") {
      if (e.payload.leser === null) {
        quellrechte = undefined;
        unbekannteLeser = false;
      } else {
        unbekannteLeser = true;
      }
    }
  }
  if (unbekannteLeser) {
    // Nur wenn genau dieser Leserkreis bis heute gilt, sind seine Kennungen noch belegbar.
    if (spaetereQuellrechte || !Array.isArray(heute.quellrechte?.leser)) return null;
    quellrechte = heute.quellrechte;
  }
  const { confidentiality: _stufe, spaceId: _space, quellrechte: _rechte, ...inhalt } = fassung;
  return {
    ...inhalt,
    ...(confidentiality !== undefined ? { confidentiality } : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
    ...(quellrechte ? { quellrechte } : {}),
  };
}

const DIREKTE_FREIGABEN = new Set([
  "ko.admin-validated",
  "ko.owner-validated",
  "ko.weisung-validated",
  "ko.weisung",
  "ko.externe-freigabe-uebernommen",
]);

/** Letzte wirksame Entscheidung dieser Fassung bis zum Stichtag, in Reihenfolge des Prüfprotokolls. */
export function freigabeZumStichtagBelegt(
  ko: KnowledgeObject,
  version: number,
  eintraege: readonly AuditEntry[],
  stichtagMs: number,
): boolean {
  const verlauf = eintraege
    .filter((e) => e.target === ko.id && zeitpunkt(e.at) <= stichtagMs)
    .sort((a, b) => a.seq - b.seq);
  const stimmen = new Map<string, Verdict>();
  let freigegeben = false;
  let letzteStimme: AuditEntry | undefined;
  for (const e of verlauf) {
    // Der Konfliktbeleg führt am Objekt auf „offen“ zurück und hat historisch keine Versionsnummer.
    if (e.action === "ko.conflict-review") {
      freigegeben = false;
      letzteStimme = undefined;
    }
    if (e.payload.koVersion !== version) continue;
    if (e.action === "ko.rated") {
      letzteStimme = e;
      const { verdict, benoetigt } = e.payload;
      if (verdict !== "up" && verdict !== "warn" && verdict !== "down") {
        stimmen.delete(e.actor);
        freigegeben = false;
        continue;
      }
      // Wie im Rating-Repository zählt nur die letzte Stimme jeder Person für diese Fassung.
      stimmen.set(e.actor, verdict);
      if (typeof benoetigt === "number" && Number.isSafeInteger(benoetigt) && benoetigt > 0) {
        freigegeben = computeOutcome([...stimmen.values()], benoetigt).status === "validiert";
      } else {
        // Alte Belege ohne Stimmenziel tragen nur mit dem gebundenen Annahme-/Entscheidungsverweis.
        const refs = [
          ko.annahmeRef?.koVersion === version ? ko.annahmeRef : undefined,
          ko.version === version && ko.status === "validiert"
            ? ko.validationDecisionRef
            : undefined,
        ];
        freigegeben =
          verdict === "up" &&
          refs.some((ref) => ref?.auditSeq === e.seq && ref.auditHash === e.hash);
      }
    } else if (e.action === "ko.returned-to-author" || e.action === "ko.returned-to-owner") {
      // Die Rückgabe ist der zweite Eintrag derselben Warn-/Gegenstimme. Eine Warnung bei
      // ausreichenden grünen Stimmen lässt die Fassung gemäß der Peer-Regel gültig.
      if (
        !letzteStimme ||
        letzteStimme.actor !== e.actor ||
        letzteStimme.payload.verdict !== e.payload.verdict
      ) {
        freigegeben = false;
      }
      letzteStimme = undefined;
    } else if (e.action === "ko.weisung-gesichtet") {
      freigegeben = e.payload.ergebnis === "bestaetigt";
      letzteStimme = undefined;
    } else if (DIREKTE_FREIGABEN.has(e.action)) {
      freigegeben = true;
      letzteStimme = undefined;
    }
  }
  return freigegeben;
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
  /**
   * REF-01 (Ben nacharbeit-7, K1): die EIGENEN Aussagebindungen beider ausgegebenen Antworten — je
   * mit ihren Quellen in GENAU der Fassung, aus der sie entstanden (heute: aktuelle, damals: die
   * Fassung zum Stichtag). `null` ohne beantworteten Text. Keine Bindung wird übertragen.
   */
  readonly heuteAussagen: AussagenBeleg | null;
  readonly damalsAussagen: AussagenBeleg | null;
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

/** Die vom Antworttext zitierten, tatsächlich vorgelegten Quellen. */
export function zitierteVergleichsquellen(antwort: AnswerResult): Set<string> {
  return new Set(
    antwort.answered ? antwort.citedSources.filter((id) => antwort.sources.includes(id)) : [],
  );
}

/** Hat sich die Antwort geändert — im Text oder in der tragenden Grundlage? */
export function antwortGeaendert(heute: AnswerResult, damals: AnswerResult): boolean {
  if (heute.answered !== damals.answered) {
    return true;
  }
  if ((heute.answer ?? "").trim() !== (damals.answer ?? "").trim()) {
    return true;
  }
  const heuteZitiert = zitierteVergleichsquellen(heute);
  const damalsZitiert = zitierteVergleichsquellen(damals);
  return (
    heuteZitiert.size !== damalsZitiert.size ||
    [...heuteZitiert].some((id) => !damalsZitiert.has(id))
  );
}
