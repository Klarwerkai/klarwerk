import type { NormEreignis } from "./klara-normereignisse";

export interface NormBetroffenheit {
  koId: string;
  titel: string;
  fassung: number;
  grund: { art: "gespeicherte_normzuordnung"; referenz: string };
}
export interface NormFolgeversuch {
  readonly erinnerungId: string;
  readonly erinnerungFassung: number;
  readonly routineFassung: number;
  readonly vorkommenId: string;
  readonly besitzer: string;
  /** Heutige eigene gespeicherte Zusatzbestellung und wirklich gehaltener Lauf. */
  pruefeAktuell(): Promise<void>;
}
export interface NormVorbereitung {
  folgepruefung?: { stand: "nicht_verfuegbar" | "am_original" | "klaerung_noetig" };
  ereignisse: readonly {
    normId: string;
    kennung: string;
    ausgabe: string;
    ereignis: NormEreignis;
    klaerung: readonly string[];
    betroffen: readonly NormBetroffenheit[];
  }[];
  ungeprueft: readonly { quelleId: string; hinweis: string }[];
}
