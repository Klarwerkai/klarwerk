// Pedi 05.07.: Header-Anzeige „In welcher KI bin ich — und was ist der DSGVO-Status?"
// Aggregiert die vorhandene read-only Konfiguration (/reasoner/config, nur Metadaten, keine
// Secrets) über ALLE Aufgaben zu einer ehrlichen Gesamt-Aussage: extern (Cloud außer Haus),
// intern (lokal/regelbasiert im Haus) oder gemischt.
// DSGVO-Bestätigung (Pedi 05.07., zweite Runde): IMMER „nein" — außer es ist eine interne KI
// aus Europa (regelbasiert = eigenes System = Europa). Dazu das Herkunftsland der KI; das
// liefert interimsweise kiOrigin() aus der Anbieter-Kennung, später zentral Nerds
// KI-Zugangs-Steuerung. DOM-frei und testbar — die Topbar rendert nur das Ergebnis.
import type { ReasonerConfigStatus } from "../api/types";
import { KI_ORIGIN_TEXT, kiOrigin } from "./kiOrigin";

export type KiHeaderMode = "external" | "internal" | "mixed";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
export const KI_HEADER_TEXT = {
  external: "topbar.kiExternal",
  internal: "topbar.kiInternal",
  mixed: "topbar.kiMixed",
  dsgvoYes: "topbar.kiDsgvoYes",
  dsgvoNo: "topbar.kiDsgvoNo",
  hintExternal: "topbar.kiExternalHint",
  hintInternal: "topbar.kiInternalHint",
  hintMixed: "topbar.kiMixedHint",
} as const;

export interface KiHeaderStatus {
  mode: KiHeaderMode;
  // true NUR bei interner KI aus Europa — alles andere (extern, gemischt, außereuropäisch,
  // unbekannte Herkunft) ist ehrlich „nein". Kein Fake-Ja.
  dsgvoConfirm: boolean;
  labelKey: string;
  dsgvoKey: string;
  countryKey: string;
  hintKey: string;
  // Modell-/Anbietername, wenn ein echtes Modell arbeitet — bei rein Regelbasiert bewusst null.
  detail: string | null;
}

function verdict(
  mode: KiHeaderMode,
  labelKey: string,
  hintKey: string,
  countryKey: string,
  confirm: boolean,
  detail: string | null,
): KiHeaderStatus {
  return {
    mode,
    dsgvoConfirm: confirm,
    labelKey,
    dsgvoKey: confirm ? KI_HEADER_TEXT.dsgvoYes : KI_HEADER_TEXT.dsgvoNo,
    countryKey,
    hintKey,
    detail,
  };
}

// Ableitung des Header-Zustands. Ehrlich: ohne geladene Konfiguration oder ohne zugeordnete
// Aufgaben null — die Topbar zeigt dann NICHTS statt eines Fake-Status.
export function kiHeaderStatus(config: ReasonerConfigStatus | undefined): KiHeaderStatus | null {
  if (!config) {
    return null;
  }
  const providers = config.tasks
    .map((task) => config.effectiveProvider[task])
    .filter((p): p is "cloud" | "local" | "deterministic" => p !== undefined);
  if (providers.length === 0) {
    return null;
  }
  const hasCloud = providers.includes("cloud");
  const hasInhouse = providers.some((p) => p === "local" || p === "deterministic");
  if (hasCloud) {
    // Extern oder gemischt: DSGVO-Bestätigung immer „nein" (externe Verarbeitung ist im Spiel).
    const detail = config.model ?? config.provider;
    const origin = kiOrigin(detail);
    return hasInhouse
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
  // Rein regelbasiert: eigenes System, läuft im Haus in Europa — kein Modellname (nichts erfinden).
  return verdict(
    "internal",
    KI_HEADER_TEXT.internal,
    KI_HEADER_TEXT.hintInternal,
    KI_ORIGIN_TEXT.ownSystem,
    true,
    null,
  );
}
