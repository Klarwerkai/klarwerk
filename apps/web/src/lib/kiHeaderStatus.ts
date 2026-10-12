// Pedi 05.07.: Header-Anzeige „In welcher KI bin ich?"
// Aggregiert die vorhandene read-only Konfiguration (/reasoner/config, nur Metadaten, keine
// Secrets) über ALLE Aufgaben zu einer ehrlichen Gesamt-Aussage: extern (Cloud außer Haus),
// intern (vom Betreiber eingerichteter KI-Server), beide oder keine KI (deterministischer
// Ersatzmodus). DOM-frei und testbar — die Statuszeile rendert nur das Ergebnis.
//
// R-0599 · DIE AUSSAGE „DSGVO JA/NEIN" IST GESTRICHEN. Sie ließ sich aus Herkunftsland und
// Modellname nicht ableiten — weder ein Ja noch ein Nein. An ihre Stelle treten, was der Server
// tatsächlich weiß: Betriebsort und Datenfluss (aus der Stufe cloud/lokal), der Anbieter (aus dem
// Clientnamen) und seine Herkunft samt Nachweisstufe (R-0702, `config.herkunft` aus der zentralen
// Zugangsverwaltung). Auftragsverarbeitung, Unterauftragnehmer und Trainingsausschluss sind in
// dieser Installation nirgends hinterlegt; sie stehen deshalb ausdrücklich als offene Prüfung da.
import type { ReasonerConfigStatus, ReasonerZugangHerkunft } from "../api/types";
import { anbieterAusClientName, anbieterUndModell } from "./aiOverview";

export type KiHeaderMode = "external" | "internal" | "mixed" | "none";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
// Die alten Hinweise (`topbar.ki*Hint`, `topbar.kiDsgvo*`) trugen die DSGVO-Aussage; sie sind
// durch den Terminologie-Vertrag (PRO 375) byteweise gesperrt und werden hier nicht mehr benutzt.
export const KI_HEADER_TEXT = {
  external: "topbar.kiExternal",
  internal: "topbar.kiInternal",
  mixed: "topbar.kiMixed",
  none: "topbar.kiNone",
  noneSubtitle: "topbar.kiNoneSubtitle",
  hintExternal: "kilage.kopf.hinweisExtern",
  hintInternal: "kilage.kopf.hinweisServer",
  hintMixed: "kilage.kopf.hinweisBeide",
  hintNone: "topbar.kiNoneHint",
  offenePruefungen: "kilage.kopf.offenePruefungen",
  herkunftBehauptet: "kilage.herkunft.behauptet",
  herkunftGeprueft: "kilage.herkunft.geprueft",
  herkunftUnbekannt: "kilage.herkunft.unbekannt",
} as const;

// Ländernamen, die das Wörterbuch kennt. Ein anderer Code bleibt als Code stehen — lieber „IE"
// als ein falsch übersetztes Land.
const BEKANNTE_LAENDER = new Set(["us", "de", "fr", "cn"]);

export interface KiHerkunftAnzeige {
  // Schlüssel des Satzes (behauptet/geprüft/unbekannt) und das einzusetzende Land.
  key: string;
  landKey: string | null;
  landCode: string | null;
}

export interface KiHeaderStatus {
  mode: KiHeaderMode;
  labelKey: string;
  subtitleKey: string | null;
  hintKey: string;
  // „<Anbieter> · <Modell>", wenn ein echtes Modell arbeitet und die Admin-Sicht es kennt.
  detail: string | null;
  // Herkunft des arbeitenden Zugangs — null, wenn keine KI arbeitet oder nichts bekannt ist.
  herkunft: KiHerkunftAnzeige | null;
  // Satz zu den offenen Prüfungen — nur, wenn eine KI Inhalte bekommt.
  offenePruefungenKey: string | null;
}

/** Die Anzeige einer gelieferten Herkunft. Fehlt sie, ist sie ehrlich unbekannt. */
export function kiHerkunftAnzeige(herkunft: ReasonerZugangHerkunft | undefined): KiHerkunftAnzeige {
  if (!herkunft || herkunft.nachweis === "unbekannt" || !herkunft.land) {
    return { key: KI_HEADER_TEXT.herkunftUnbekannt, landKey: null, landCode: null };
  }
  const land = herkunft.land.toLowerCase();
  return {
    key:
      herkunft.nachweis === "geprueft"
        ? KI_HEADER_TEXT.herkunftGeprueft
        : KI_HEADER_TEXT.herkunftBehauptet,
    landKey: BEKANNTE_LAENDER.has(land) ? `country.${land}` : null,
    landCode: land.toUpperCase(),
  };
}

function noneStatus(): KiHeaderStatus {
  return {
    mode: "none",
    labelKey: KI_HEADER_TEXT.none,
    subtitleKey: KI_HEADER_TEXT.noneSubtitle,
    hintKey: KI_HEADER_TEXT.hintNone,
    detail: null,
    herkunft: null,
    offenePruefungenKey: null,
  };
}

// Der deterministische Modus ist ein Ersatzpfad, keine interne KI. Ohne geladene Konfiguration
// oder ohne zugeordnete Aufgaben zeigt die Statuszeile deshalb den neutralen Z4 statt eines
// Fake-Modells.
export function kiHeaderStatus(config: ReasonerConfigStatus | undefined): KiHeaderStatus {
  if (!config) {
    return noneStatus();
  }
  const providers = config.tasks
    .map((task) => config.effectiveProvider[task])
    .filter((p): p is "cloud" | "local" | "deterministic" => p !== undefined);
  if (providers.length === 0) {
    return noneStatus();
  }
  const hasCloud = providers.includes("cloud");
  const hasLocal = providers.includes("local");
  if (hasCloud) {
    const clientName = config.model ?? config.provider;
    const anbieter = anbieterAusClientName(clientName);
    return {
      mode: hasLocal ? "mixed" : "external",
      labelKey: hasLocal ? KI_HEADER_TEXT.mixed : KI_HEADER_TEXT.external,
      subtitleKey: null,
      hintKey: hasLocal ? KI_HEADER_TEXT.hintMixed : KI_HEADER_TEXT.hintExternal,
      detail: anbieterUndModell(clientName),
      herkunft: kiHerkunftAnzeige(anbieter ? config.herkunft?.[anbieter] : undefined),
      offenePruefungenKey: KI_HEADER_TEXT.offenePruefungen,
    };
  }
  if (hasLocal) {
    return {
      mode: "internal",
      labelKey: KI_HEADER_TEXT.internal,
      subtitleKey: null,
      hintKey: KI_HEADER_TEXT.hintInternal,
      detail: config.localProvider ?? config.model ?? null,
      herkunft: kiHerkunftAnzeige(config.herkunft?.local),
      offenePruefungenKey: KI_HEADER_TEXT.offenePruefungen,
    };
  }
  return noneStatus();
}

// WP-VIP2-GATE-2 (bens Fix 3): oeffentliche Variante — abgeleitet aus dem ABSTRAHIERTEN Status
// (/api/reasoner/status: active + mode cloud/local/deterministic), den JEDER angemeldete Nutzer
// sehen darf. Ohne Provider-Detail gibt es ehrlich KEINE Herkunftsaussage (herkunft/detail null).
// Die volle Sicht mit Anbieter und Herkunft ist Admin-Sicht (users.manage, /api/reasoner/config).
export function kiHeaderStatusFromPublic(
  status: { active: boolean; mode: "cloud" | "local" | "deterministic" } | undefined,
): KiHeaderStatus {
  if (!status || !status.active || status.mode === "deterministic") {
    return noneStatus();
  }
  const cloud = status.mode === "cloud";
  return {
    mode: cloud ? "external" : "internal",
    labelKey: cloud ? KI_HEADER_TEXT.external : KI_HEADER_TEXT.internal,
    subtitleKey: null,
    hintKey: cloud ? KI_HEADER_TEXT.hintExternal : KI_HEADER_TEXT.hintInternal,
    detail: null,
    herkunft: null,
    offenePruefungenKey: KI_HEADER_TEXT.offenePruefungen,
  };
}
