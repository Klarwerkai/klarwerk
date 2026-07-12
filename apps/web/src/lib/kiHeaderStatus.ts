// Pedi 05.07.: Header-Anzeige „In welcher KI bin ich — und was ist der DSGVO-Status?"
// Aggregiert die vorhandene read-only Konfiguration (/reasoner/config, nur Metadaten, keine
// Secrets) über ALLE Aufgaben zu einer ehrlichen Gesamt-Aussage: extern (Cloud außer Haus),
// intern (lokales Modell), beide oder keine KI (deterministischer Ersatzmodus).
// DSGVO-Bestätigung (Pedi 05.07., zweite Runde): IMMER „nein" — außer es ist eine interne KI
// aus Europa. Dazu das Herkunftsland der KI; das
// liefert interimsweise kiOrigin() aus der Anbieter-Kennung, später zentral Nerds
// KI-Zugangs-Steuerung. DOM-frei und testbar — die Topbar rendert nur das Ergebnis.
import type { ReasonerConfigStatus } from "../api/types";
import { kiOrigin } from "./kiOrigin";

export type KiHeaderMode = "external" | "internal" | "mixed" | "none";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
export const KI_HEADER_TEXT = {
  external: "topbar.kiExternal",
  internal: "topbar.kiInternal",
  mixed: "topbar.kiMixed",
  none: "topbar.kiNone",
  noneSubtitle: "topbar.kiNoneSubtitle",
  dsgvoYes: "topbar.kiDsgvoYes",
  dsgvoNo: "topbar.kiDsgvoNo",
  hintExternal: "topbar.kiExternalHint",
  hintInternal: "topbar.kiInternalHint",
  hintMixed: "topbar.kiMixedHint",
  hintNone: "topbar.kiNoneHint",
} as const;

export interface KiHeaderStatus {
  mode: KiHeaderMode;
  // true NUR bei interner KI aus Europa — alles andere (extern, gemischt, außereuropäisch,
  // unbekannte Herkunft) ist ehrlich „nein". Kein Fake-Ja.
  dsgvoConfirm: boolean;
  labelKey: string;
  dsgvoKey: string | null;
  countryKey: string | null;
  subtitleKey: string | null;
  hintKey: string;
  // Modell-/Anbietername, wenn ein echtes Modell arbeitet.
  detail: string | null;
}

function verdict(
  mode: KiHeaderMode,
  labelKey: string,
  hintKey: string,
  countryKey: string | null,
  confirm: boolean,
  detail: string | null,
  subtitleKey: string | null = null,
): KiHeaderStatus {
  return {
    mode,
    dsgvoConfirm: confirm,
    labelKey,
    dsgvoKey: countryKey ? (confirm ? KI_HEADER_TEXT.dsgvoYes : KI_HEADER_TEXT.dsgvoNo) : null,
    countryKey,
    subtitleKey,
    hintKey,
    detail,
  };
}

function noneStatus(): KiHeaderStatus {
  return verdict(
    "none",
    KI_HEADER_TEXT.none,
    KI_HEADER_TEXT.hintNone,
    null,
    false,
    null,
    KI_HEADER_TEXT.noneSubtitle,
  );
}

// Der deterministische Modus ist ein Ersatzpfad, keine interne KI. Ohne geladene Konfiguration
// oder ohne zugeordnete Aufgaben zeigt die Topbar deshalb den neutralen Z4 statt eines Fake-Modells.
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
    // Extern oder gemischt: DSGVO-Bestätigung immer „nein" (externe Verarbeitung ist im Spiel).
    const detail = config.model ?? config.provider;
    const origin = kiOrigin(detail);
    return hasLocal
      ? verdict(
          "mixed",
          KI_HEADER_TEXT.mixed,
          KI_HEADER_TEXT.hintMixed,
          origin.countryKey,
          false,
          detail,
        )
      : verdict(
          "external",
          KI_HEADER_TEXT.external,
          KI_HEADER_TEXT.hintExternal,
          origin.countryKey,
          false,
          detail,
        );
  }
  if (providers.includes("local")) {
    // Internes Modell: „ja" NUR bei belegter Herkunft Europa — unbekannt zählt wie „nein".
    const detail = config.localProvider ?? config.model ?? null;
    const origin = kiOrigin(detail);
    return verdict(
      "internal",
      KI_HEADER_TEXT.internal,
      KI_HEADER_TEXT.hintInternal,
      origin.countryKey,
      origin.eu === true,
      detail,
    );
  }
  return noneStatus();
}
