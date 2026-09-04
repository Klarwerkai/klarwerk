// SCRUM-415: Vertraulichkeitsstufen im Frontend — DOM-freie Helfer für Anzeige (Chip) und Auswahl.
// Reine Funktionen → testbar ohne DOM.
import type { UseQueryResult } from "@tanstack/react-query";
import type { Confidentiality, ConfidentialityProvenance } from "../api/types";
import { formatKoTimestamp } from "./koDates";

export const CONFIDENTIALITY_LEVELS: readonly Confidentiality[] = [
  "intern",
  "vertraulich",
  "streng_vertraulich",
];

// Fehlendes Feld (Alt-KOs) = „intern".
//
// JOB 3034 — DIE GRENZE ZWISCHEN DIESER FUNKTION UND DER ANZEIGE. Diese Glättung ist richtig für
// den ZUGRIFF und für die FILTERUNG (Facetten: libraryFacets.ts:105, validationFacets.ts:61; das
// Auswahlfeld der Detailseite braucht einen der drei gültigen Werte). Sie ist FALSCH für eine
// AUSKUNFT: „intern" zu sagen, wo nie jemand eingestuft hat, behauptet eine Einstufung. Was der
// Bestand hergibt, sagt deshalb `vertraulichkeitsAuskunft` weiter unten — dieselbe Trennung, die
// der Server zwischen `normalizeConfidentiality` und `discloseConfidentiality` zieht
// (services/knowledge-object/src/confidentiality.ts:64-73).
export function confidentialityOf(level: Confidentiality | undefined | null): Confidentiality {
  return level === "vertraulich" || level === "streng_vertraulich" ? level : "intern";
}

export function isConfidential(level: Confidentiality | undefined | null): boolean {
  return level === "vertraulich" || level === "streng_vertraulich";
}

// WP-POLISH-CLOSE (bens Punkt 1): fail-safe-Prüfung für AUTOMATISCHE Frage-/Chip-Flächen (Beispiel-
// Chips, Auto-Send des Bibliotheks-Fragen-Knopfs). true NUR bei eindeutig nicht-vertraulicher
// Stufe: explizit „intern" oder das FEHLENDE Feld — der Server materialisiert vertrauliche Stufen
// IMMER und „intern" bewusst nie, ein fehlendes Feld ist damit die dokumentierte intern-Codierung
// (kein unklarer Fall). JEDER andere/unbekannte Wert gilt fail-safe als vertraulich (anders als
// confidentialityOf, das Unbekanntes zu „intern" glättet — für Automatik-Flächen zu lasch).
//
// JOB 3034 — WARUM ANZEIGE UND AUTOMATIK HIER VERSCHIEDEN ENTSCHEIDEN DÜRFEN, und zwar richtig:
// dieser Riegel entscheidet, WAS HINAUSGEHEN DARF (Titel in Beispiel-Chips, Auto-Ask, Egress). Die
// Auskunft darunter entscheidet, WAS DER MENSCH LIEST. Ein Eintrag ohne Stufe ist für den Riegel
// bewusst nicht-vertraulich (sonst wäre der halbe Altbestand aus der Automatik verbannt) und für
// die Anzeige bewusst „nicht eingestuft" (sonst behauptete die Fläche eine Einstufung). Beides ist
// dieselbe Tatsache in zwei Rollen, keine zweite Wahrheit — und dieser Riegel bleibt unverändert:
// JOB 3034 ändert nichts daran, wer was sehen oder was hinausgehen darf.
export function isKnownNonConfidential(level: unknown): boolean {
  return level === undefined || level === null || level === "intern";
}

// ================================================================================================
// JOB 3034 · DIE STUFE IM KLARTEXT — EINE AUSKUNFT, EINE STELLE, AUCH FÜR DIE FEHLENDE STUFE.
// ================================================================================================
//
// WAS SICH GEÄNDERT HAT. Bis JOB 3034 stand hier `confidentialityChip`, und dessen Kern war der
// Satz `showChip: false` für „intern": die häufigste Stufe trug GAR KEIN Kennzeichen, und ein
// Eintrag, den nie jemand eingestuft hatte, war von einem ausdrücklich als „Öffentlich-intern"
// eingestuften nicht zu unterscheiden. Beide Aussagen sind ersetzt, nicht danebengelegt: es gibt
// keinen `showChip: false`-Zweig mehr und keinen Codepfad, der einen Eintrag ohne Kennzeichen zeigt.
//
// WARUM EINE FUNKTION UND NICHT ZWEI. Die Bibliothek (Trefferzeile) und die Detailseite zeigen
// DIESELBE Auskunft. Zwei Auslegungen an zwei Orten wären zwei Wahrheiten — die Lehre steht
// ausgeschrieben in `services/app/src/sichtbarkeit.ts:10-15` („sechs Flächen trugen dieselbe Zeile,
// und alle sechs waren falsch").
//
// DIE REGEL, AUSGESCHRIEBEN — ZWEI FÄLLE:
//
//   (1) DER SERVER SCHICKT `confidentialityProvenance` MIT → ER GILT. Der Detailabruf tut das
//       (`services/app/src/routes/ko-routes.ts:598` → `discloseConfidentiality`). Sagt er
//       `"unknown"`, ist der Eintrag NICHT eingestuft — auch wenn im Feld daneben noch etwas steht.
//
//   (2) DAS FELD FEHLT (heute: die Listenroute, die die Bibliothek füttert) → DIESELBE REGEL WIRD
//       HIER ANGEWANDT, nicht geraten: ein Wert aus `CONFIDENTIALITY_LEVELS` ist `"ko"`, alles
//       andere (fehlend, `null`, unbekannter String) ist `"unknown"`. Das ist zeichengleich zu
//       `discloseConfidentiality` (services/knowledge-object/src/confidentiality.ts:99-102), das
//       über `isValidConfidentiality` prüft und BEWUSST nicht über `normalizeConfidentiality`.
//       Die Spiegelung ist damit benannt und nachprüfbar — nicht erraten. Fällt die Listenroute
//       eines Tages nach (JOB 3024), greift ohne weitere Änderung Fall (1).
//
// EIN DRITTER, WIDERSPRÜCHLICHER FALL wird ausdrücklich fail-safe behandelt: meldet der Server
// `"ko"`, steht im Feld aber kein gültiger Wert, gilt „nicht eingestuft". Die Anzeige erfindet
// keine Stufe aus einer Herkunftsangabe.

/** Tönung der Stufenanzeige. `unbekannt` ist die vierte Auskunft, nicht die vierte Stufe. */
export type ConfidentialityTone = "neutral" | "warn" | "crit" | "unbekannt";

/**
 * Die Tönungstabelle beider Flächen. Sie wohnt hier und nicht in einer der Seiten, weil sonst die
 * Bibliothek einen zweiten Klassensatz für dieselbe Aussage bekäme (bis JOB 3034 stand sie als
 * `CONF_TONE` lokal in `pages/KnowledgeDetail.tsx:157`).
 * `unbekannt` ist neutral-warnend und dadurch klar von `neutral` („intern") unterscheidbar: gleiche
 * ruhige Fläche, aber gestrichelter Rand und Warnschrift — es ist ein Hinweis, kein Alarm.
 */
export const CONF_TONE_CLASS: Record<ConfidentialityTone, string> = {
  neutral: "bg-page text-muted",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  unbekannt: "border border-dashed border-trust-warn-fill/60 bg-page text-trust-warn-text",
};

/** Was die Fläche über die Stufe eines Eintrags sagen darf. `showChip` ist immer `true`. */
export interface VertraulichkeitsAuskunft {
  /** Die belegte Stufe — oder `null`, wenn der Bestand keine trägt. */
  level: Confidentiality | null;
  provenance: ConfidentialityProvenance;
  labelKey: string;
  tone: ConfidentialityTone;
  /** Immer `true`: seit JOB 3034 trägt JEDER Eintrag ein Kennzeichen, auch der nicht eingestufte. */
  showChip: true;
}

const TON_JE_STUFE: Record<Confidentiality, ConfidentialityTone> = {
  intern: "neutral",
  vertraulich: "warn",
  streng_vertraulich: "crit",
};

export function vertraulichkeitsAuskunft(ko: {
  confidentiality?: Confidentiality | null;
  confidentialityProvenance?: ConfidentialityProvenance;
}): VertraulichkeitsAuskunft {
  const gueltig = CONFIDENTIALITY_LEVELS.includes(ko.confidentiality as Confidentiality)
    ? (ko.confidentiality as Confidentiality)
    : null;
  // Fall (1): der Server hat gesprochen. Fall (2): dieselbe Regel hier.
  const provenance: ConfidentialityProvenance =
    ko.confidentialityProvenance === "unknown" ? "unknown" : gueltig ? "ko" : "unknown";
  const level = provenance === "ko" ? gueltig : null;
  if (!level) {
    return {
      level: null,
      provenance: "unknown",
      labelKey: "conf.level.nichtEingestuft",
      tone: "unbekannt",
      showChip: true,
    };
  }
  return {
    level,
    provenance: "ko",
    labelKey: `conf.level.${level}`,
    tone: TON_JE_STUFE[level],
    showChip: true,
  };
}

// ================================================================================================
// JOB 3034 R2 · DER ZWISCHENSPEICHER ÜBERLEBT EINE GESCHEITERTE AUFFRISCHUNG.
// ================================================================================================
//
// WAS RUNDE 1 FALSCH HATTE. Der Chip stand richtig da, solange frisch geladen wurde — aber
// `QueryState` (components/ui.tsx) fragt nur `isError` und wirft dabei vorhandene Daten weg. Bei
// react-query ist nach einem gescheiterten REFETCH beides zugleich wahr: `isError: true`
// (genauer `isRefetchError: true`) UND `data` weiterhin gefüllt. Ergebnis: bei jedem gescheiterten
// Hintergrundabruf verschwanden Titel, Karte und Stufenkennzeichen auf beiden Seiten hinter einer
// Fehlerfläche. Das verletzt REGELN Punkt 7 („die zuletzt erfolgreich geholten Werte bleiben
// SICHTBAR") und Abschnitt 9 des Auftrags („der alte Chip bleibt; es entsteht KEINE neue negative
// Aussage aus einem gescheiterten Abruf") — und offline ist es derselbe Fall.
//
// DIE REGEL, EINE STELLE: liegt ein erfolgreich geholter Stand vor, GILT ER. Der Fehler des
// Auffrischungsversuchs wird dann nicht zur Aussage über den Bestand, sondern zur Aussage über den
// Abruf — die Fläche zeigt ihn als Hinweis „Stand von <Zeit> · Auffrischung fehlgeschlagen"
// (i18n `state.staleRefetchFailed`) NEBEN den weiterhin sichtbaren Werten. Ohne Stand (Erstabruf
// gescheitert) bleibt es beim Fehlerzustand: dann gibt es nichts zu zeigen, und es entsteht auch
// KEIN „nicht eingestuft" — das wäre eine Bestandsaussage ohne Bestand.
//
// WARUM DIESE FUNKTION HIER WOHNT. Ihr baulicher Ort wäre `QueryState` selbst
// (apps/web/src/components/ui.tsx), damit die Regel für JEDE Fläche gilt. Diese Datei liegt
// außerhalb der ZIELPFADE von JOB 3034; die Änderung dort ist als Folgeauftrag benannt (BEN,
// Runde 1). Bis dahin steht die Regel EINMAL hier und wird von beiden Flächen dieses Auftrags
// aufgerufen — eine zweite Auslegung in zwei Seiten wären zwei Wahrheiten.
export function abfrageMitBestand<T>(query: UseQueryResult<T>): UseQueryResult<T> {
  if (!query.isError || query.data == null) {
    return query;
  }
  // Der einzige Zweck der Behauptung: `UseQueryResult` ist eine unterschiedene Vereinigung, deren
  // Zweige sich nicht per Spread neu zusammensetzen lassen. Die gesetzten Felder sind genau die,
  // die den Erfolgszweig ausmachen; `data` ist oben als vorhanden geprüft.
  return {
    ...query,
    status: "success",
    isSuccess: true,
    isPending: false,
    isLoading: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    error: null,
  } as unknown as UseQueryResult<T>;
}

/**
 * Wahr, wenn ein vorhandener Stand gezeigt wird, OBWOHL die letzte Auffrischung scheiterte.
 * Genau dann (und nur dann) gehört der Hinweis `state.staleRefetchFailed` auf die Fläche.
 */
export function auffrischungGescheitert<T>(query: UseQueryResult<T>): boolean {
  return query.isError && query.data != null;
}

/**
 * Die EINE Bauform des Hinweises. Sie steht hier und nicht zweimal in den Seiten, weil sonst
 * dieselbe Aussage zwei Klassensätze bekäme — dieselbe Begründung wie bei `CONF_TONE_CLASS`.
 * Gestrichelter Rand und Warnschrift wie beim Ton `unbekannt`: ein Hinweis, kein Alarm.
 */
export const AUFFRISCHUNG_HINWEIS_KLASSE =
  "mb-3 block rounded-card border border-dashed border-trust-warn-fill/60 bg-page px-3 py-2 text-[12.5px] text-trust-warn-text";

/** Die Marke, an der beide Flächen UND der Abnahmetest denselben Hinweis finden. */
export const AUFFRISCHUNG_HINWEIS_MARKE = "auffrischung-fehlgeschlagen";

/**
 * Der Hinweistext zum weiterhin sichtbaren Stand. Übersetzer und Sprache kommen von der Fläche;
 * die Regel — WELCHER Schlüssel mit WELCHER Zeit gefüllt wird und was bei unbrauchbarem
 * Zeitstempel dasteht — wohnt hier, damit beide Flächen nicht zwei Auslegungen bekommen.
 * `dataUpdatedAt` ist der Zeitpunkt des zuletzt ERFOLGREICHEN Abrufs; ist er 0 oder unbrauchbar,
 * steht ein Gedankenstrich da und keine erfundene Zeit.
 */
export function auffrischungHinweisText<T>(
  query: UseQueryResult<T>,
  t: (schluessel: string, werte: Record<string, string>) => string,
  sprache: string,
): string {
  const stand = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null;
  const iso = stand && !Number.isNaN(stand.getTime()) ? stand.toISOString() : null;
  return t("state.staleRefetchFailed", { zeit: formatKoTimestamp(iso, sprache) ?? "—" });
}
