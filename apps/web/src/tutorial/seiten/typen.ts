/** Inhalte und echte Ziele einer vorhandenen Produktseite; keine auszuführenden Aktionen. */
export interface SeitenEintrag {
  id: string;
  pfade: readonly string[];
  titelKey: string;
  /** Nur zusätzliche serverbewachte Seiten ohne Navigationsgate. */
  minRole?: "viewer" | "experte" | "controller" | "admin";
  ziel: string;
  aktion: readonly [string, string, string];
  ergebnis: readonly [string, string, string];
  sonderfall: readonly [string, string, string];
  /** Bereits gelieferte fachliche Erklärungen werden unmittelbar wiederverwendet. */
  hilfeKeys?: readonly string[];
}
