// ================================================================================================
// JOB 3027 · STATION 4 — DIE ZWEI AUSKÜNFTE DES PRÜFBRETTS, IN DREI LAGEN UND OHNE RATEN.
// ================================================================================================
//
// WOFÜR ES DIESE DATEI GIBT. `GET /api/validation/board` liefert seit JOB 3003/3009 je Zeile
// `confidentiality` + `confidentialityProvenance` und `origin` + `originSources`
// (`services/validation/src/board-herkunft.ts:122-135`). Die Prüfseite hat diese Auskunft bis
// hierher nicht gelesen, sondern GEGLÄTTET: `validationFacets.ts:61` rief `confidentialityOf`, und
// die gibt für jeden nicht ausdrücklich vertraulichen Wert „intern" zurück
// (`./confidentiality.ts:12-15`). Ein Objekt, das der Server ausdrücklich als „nicht eingestuft"
// ausweist, stand damit unter „Intern" — die Seite behauptete eine Einstufung, die nie jemand
// gesetzt hat.
//
// WARUM DANEBEN UND NICHT IN `confidentiality.ts`. `confidentialityOf` glättet BEWUSST, und zwar
// für den Zugriffsweg: dort ist eine fehlende Stufe fail-safe „intern" (dieselbe Zeile zieht
// `services/app/src/sichtbarkeit.ts:39-43` mit ausgeschriebener Begründung). Richtig für ein TOR,
// falsch für eine AUSKUNFT. Die beiden Lesarten stehen deshalb getrennt; diese hier gilt
// ausschliesslich für das Prüfbrett, jene unverändert für alle anderen Flächen.
//
// WARUM DREI LAGEN UND NICHT ZWEI. Für den Menschen vor dem Brett sind „dieses Objekt ist nicht
// eingestuft" und „diese Antwort liefert die Einstufung nicht" zwei völlig verschiedene Zustände
// (board-herkunft.ts:10-18). Der zweite ist real und nicht theoretisch: ein Cache-Stand von VOR der
// Auslieferung von JOB 3003 trägt die Felder gar nicht. Wer beide zusammenwirft, muss raten.
//
// DIESE DATEI RÄT NICHT: sie ruft `confidentialityOf` nicht auf, sie hat keinen Standardwert, und
// jede negative Aussage („nicht eingestuft", „Herkunft unbekannt") entsteht ausschliesslich aus
// einer vom Server GELIEFERTEN Beleglage — nie aus dem Fehlen eines Feldes. Sie ist rein, DOM-frei
// und ohne i18n: sie liefert Beschriftungs-SCHLÜSSEL, keine Texte.
import type {
  BoardQuellenhinweis,
  Confidentiality,
  ConfidentialityProvenance,
  KnowledgeObject,
  KoOrigin,
} from "../api/types";
// NUR die Wertemenge, nicht die glättende Funktion: eine zweite Liste der Stufen wäre eine zweite
// Wahrheit über dieselbe Aufzählung.
import { CONFIDENTIALITY_LEVELS } from "./confidentiality";

/** Die drei Lagen der Stufenauskunft — es gibt keine vierte. */
export type StufenLage = "eingestuft" | "nicht_eingestuft" | "auskunft_fehlt";

/** Die drei Lagen der Herkunftsauskunft. */
export type HerkunftsLage = "herkunft_bekannt" | "herkunft_unbekannt" | "auskunft_fehlt";

/** Die Facettenwerte der beiden Fehlzustände — bewusst KEINE Stufennamen (`Confidentiality`). */
export const STUFE_NICHT_EINGESTUFT = "nicht_eingestuft";
export const STUFE_AUSKUNFT_FEHLT = "auskunft_fehlt";

export interface StufenAuskunft {
  lage: StufenLage;
  /** Die Stufe, wenn eine dasteht — sonst `null`. Nie ein Ersatzwert. */
  stufe: Confidentiality | null;
  labelKey: string;
  /** Der Wert für die Facettenschiene; bei „eingestuft" die Stufe selbst. */
  facetWert: string;
  /** Tönung NUR aus der tatsächlichen Stufe — ein Fehlzustand ist kein Alarm. */
  tone: "neutral" | "warn" | "crit";
}

export interface HerkunftsAuskunft {
  lage: HerkunftsLage;
  herkunft: KoOrigin | null;
  labelKey: string;
}

export interface BoardAuskunft {
  stufe: StufenAuskunft;
  herkunft: HerkunftsAuskunft;
}

/**
 * Was eine Antwortzeile an Auskunft MITBRINGEN KANN. `undefined` heisst hier ausdrücklich: die
 * Antwort trägt das Feld nicht (alter Cache, anderer Lesepfad) — und genau das ist die dritte Lage.
 * Bewusst strukturell und nicht `ValidationBoardKo`, dieselbe Überlegung wie bei `HerkunftsFakten`
 * am Server: wer diese Felder hat, kann die Frage stellen.
 */
export interface AuskunftsFelder {
  confidentiality?: Confidentiality | null;
  confidentialityProvenance?: ConfidentialityProvenance;
  origin?: KoOrigin | null;
  originSources?: BoardQuellenhinweis[];
}

/** Die Beschriftung je Erfassungsweg. `word_addin` nutzt den VORHANDENEN Wortlaut des Chips aus
 *  Bibliothek und KO-Detail (`Library.origin-chip.test.tsx:122`) — keine zweite Fassung. */
const HERKUNFT_LABEL_KEYS: Record<KoOrigin, string> = {
  tell: "ko.origin.tell",
  studio: "ko.origin.studio",
  expert: "ko.origin.expert",
  frontdoor: "ko.origin.frontdoor",
  word_addin: "ko.originWordAddin.label",
};

const STUFEN_TONE: Record<Confidentiality, StufenAuskunft["tone"]> = {
  intern: "neutral",
  vertraulich: "warn",
  streng_vertraulich: "crit",
};

function istStufe(wert: unknown): wert is Confidentiality {
  return CONFIDENTIALITY_LEVELS.includes(wert as Confidentiality);
}

function istHerkunft(wert: unknown): wert is KoOrigin {
  return typeof wert === "string" && wert in HERKUNFT_LABEL_KEYS;
}

/**
 * Die Stufe dieser Zeile als Auskunft.
 *
 * DIE REIHENFOLGE DER FRAGEN IST DIE AUSSAGE:
 *  1. Steht eine gültige Stufe da? Dann ist das Objekt eingestuft — unabhängig von der Beleglage.
 *     Das ist kein Schlupfloch, sondern der ehrliche Fall „alter Cache eines vertraulichen
 *     Objekts": `confidentiality` gab es am Wissensobjekt schon vor JOB 3003, die Beleglage nicht.
 *     „Einstufung nicht in dieser Antwort" wäre dort schlicht falsch — sie steht ja da.
 *  2. Sonst: sagt die Antwort ausdrücklich `unknown`? Dann trägt das Objekt keine Stufe.
 *  3. Sonst: die Antwort trägt die Auskunft nicht. Kein Standardwert, keine Vermutung.
 */
export function stufenAuskunft(felder: AuskunftsFelder): StufenAuskunft {
  const wert = felder.confidentiality;
  if (istStufe(wert)) {
    return {
      lage: "eingestuft",
      stufe: wert,
      labelKey: `conf.level.${wert}`,
      facetWert: wert,
      tone: STUFEN_TONE[wert],
    };
  }
  if (felder.confidentialityProvenance === "unknown") {
    return {
      lage: "nicht_eingestuft",
      stufe: null,
      labelKey: "val.stufe.nichtEingestuft",
      facetWert: STUFE_NICHT_EINGESTUFT,
      tone: "neutral",
    };
  }
  return {
    lage: "auskunft_fehlt",
    stufe: null,
    labelKey: "val.stufe.auskunftFehlt",
    facetWert: STUFE_AUSKUNFT_FEHLT,
    tone: "neutral",
  };
}

/**
 * Die Herkunft dieser Zeile als Auskunft. Dieselben drei Lagen, dieselbe Regel: `null` ist die
 * AUSSAGE „unbekannt" (der Server setzt es ausdrücklich, board-herkunft.ts:128), das fehlende Feld
 * ist die Aussage über die ANTWORT. Ein Wert, den dieser Client nicht kennt (neuer Erfassungsweg,
 * fremd geschriebene Zeile), ist ebenfalls keine benennbare Herkunft — er wird NICHT roh angezeigt.
 */
export function herkunftsAuskunft(felder: AuskunftsFelder): HerkunftsAuskunft {
  const wert = felder.origin;
  if (istHerkunft(wert)) {
    return { lage: "herkunft_bekannt", herkunft: wert, labelKey: HERKUNFT_LABEL_KEYS[wert] };
  }
  if (wert === null) {
    return { lage: "herkunft_unbekannt", herkunft: null, labelKey: "val.herkunft.unbekannt" };
  }
  return { lage: "auskunft_fehlt", herkunft: null, labelKey: "val.herkunft.auskunftFehlt" };
}

export function boardAuskunft(felder: AuskunftsFelder): BoardAuskunft {
  return { stufe: stufenAuskunft(felder), herkunft: herkunftsAuskunft(felder) };
}

/**
 * Die Beschriftung EINES Facettenwertes der Stufen-Dimension. Sie kommt aus derselben Zuordnung wie
 * die Karte — sonst sagten Schiene und Karte über denselben Zustand zweierlei.
 */
export function stufenFacetLabelKey(wert: string): string {
  if (wert === STUFE_NICHT_EINGESTUFT) {
    return "val.stufe.nichtEingestuft";
  }
  if (wert === STUFE_AUSKUNFT_FEHLT) {
    return "val.stufe.auskunftFehlt";
  }
  return `conf.level.${wert}`;
}

/**
 * Eine Antwortzeile, so wie sie ankommen KANN: das Wissensobjekt, und die vier Auskunftsfelder je
 * nach Antwortstand vorhanden oder nicht.
 */
export type BoardZeileRoh = Omit<KnowledgeObject, "confidentiality" | "origin"> & AuskunftsFelder;

/** Eine Prüfbrett-Zeile, wie die Seite sie weiterreicht: das Wissensobjekt UND seine Auskunft. */
export interface PruefZeile extends KnowledgeObject {
  auskunft: BoardAuskunft;
}

/**
 * Die Naht: EINMAL je Zeile die Auskunft ableiten, danach arbeitet die Seite auf einem gewöhnlichen
 * Wissensobjekt weiter (Filter, Sortierung, Abzeichen bleiben unangetastet).
 *
 * DIE ZEILE WIRD NICHT UMGEFORMT. Seit JOB 3027 R2 tragen `confidentiality` und `origin` am
 * `KnowledgeObject` auch `null` (Begründung dort) — die Antwort reist also unverändert weiter, und
 * die Ableitung kommt daneben. Ein Umschreiben von `null` auf „Feld fehlt" wäre eine zweite,
 * stillschweigende Auslegung derselben Antwort gewesen; genau das soll dieser Job beenden.
 */
export function pruefZeile(zeile: BoardZeileRoh): PruefZeile {
  return { ...zeile, auskunft: boardAuskunft(zeile) };
}

/** Der Bestand des Bretts, einmal gelesen. Kein Bestand (laden/Fehler) = keine Zeile, keine Aussage. */
export function boardZeilen(daten: readonly BoardZeileRoh[] | undefined): PruefZeile[] {
  return (daten ?? []).map(pruefZeile);
}
