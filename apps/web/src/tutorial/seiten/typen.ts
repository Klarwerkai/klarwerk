/** Inhalte und echte Ziele einer vorhandenen Produktseite; keine auszuführenden Aktionen. */
export interface SeitenEintrag {
  id: string;
  pfade: readonly string[];
  titelKey: string;
  /** Nur zusätzliche serverbewachte Seiten ohne Navigationsgate. */
  minRole?: "viewer" | "experte" | "controller" | "admin";
  ziel: string;
  /** Bereits gelieferte fachliche Erklärungen werden unmittelbar wiederverwendet. */
  hilfeKeys?: readonly string[];
}
