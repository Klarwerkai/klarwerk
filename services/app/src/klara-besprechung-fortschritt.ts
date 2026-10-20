import type { wavPlan } from "../../media";
/** F15-Fortschritt IN der vorhandenen privaten Quellnotiz, kein zweiter Job-/Textbestand. */
export interface BesprechungsFortschritt {
  stand:
    | "bereit"
    | "teilweise"
    | "laeuft"
    | "pausiert"
    | "fehlgeschlagen"
    | "abgebrochen"
    | "abgeschlossen";
  quellAbdruck: string;
  teile: ReturnType<typeof wavPlan>;
  versuche: number;
  lauf: { id: string; bis: number; ausFassung: number } | null;
  grund: "keine_ki" | "anbieterfehler" | "angefordert" | null;
}
