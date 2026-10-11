// produkt:20261010:assistenz-name-avatar (K6) — DIE BESCHRIFTUNG DES KLASSISCHEN HILFEKNOPFS.
//
// Der Hilfeknopf (`components/KlaraAssistant.tsx`) trägt keinen festen Produktnamen mehr: ohne
// gespeichertes Assistenzprofil heisst er neutral „Assistenz öffnen — Hilfe zu dieser Seite“, sein
// Panel „Deine Assistenz“. Die Tests, die ihn über seine zugängliche Beschriftung finden, lesen sie
// von hier — aus denselben Schlüsseln wie die Oberfläche, nicht als Literal.
import i18n from "../../apps/web/src/i18n";

type Uebersetze = (schluessel: string, werte?: Record<string, unknown>) => string;

const standard: Uebersetze = (schluessel, werte) => i18n.t(schluessel, werte ?? {});

/** Zugängliche Beschriftung und Tooltip des Hilfeknopfs ohne gespeichertes Profil. */
export function hilfeknopfLabel(t: Uebersetze = standard): string {
  return t("assistenz.hilfe.oeffnen", { assistenz: t("assistenz.neutral.name") });
}

/** Die zugängliche Beschriftung des Hilfe-Panels ohne gespeichertes Profil. */
export function hilfePanelLabel(t: Uebersetze = standard): string {
  return t("assistenz.neutral.titel");
}
