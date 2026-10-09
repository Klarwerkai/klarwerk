// R-0599 (Ben nacharbeit-2) · DIE KI-LAGE STEHT DAUERHAFT IN DER KOPFZEILE — FÜR JEDEN.
//
// Bis hierher stand die KI-Zeile nur im Zahnrad-Menü und nur für Verwalter (`StatusZeilen.tsx`).
// Der Originalauftrag verlangt: „In der Kopfzeile steht dauerhaft, ob gerade eine externe, eine
// hausinterne oder keine KI arbeitet und welcher Anbieter dahintersteht." Die Quelle ist die
// Serverauskunft `GET /api/ki-lage` (`Reasoner.kiLage()`), nicht eine Ableitung im Browser.
//
// Was der sichtbare Kurzsatz sagt: Modus und Anbieter. Was der Zeigehinweis dazu sagt: Betriebsort
// und Datenfluss, die Herkunft des Anbieters mit Nachweisstufe und die offenen Prüfungen — dieselben
// Sätze wie in der Verwalterzeile (`kiHeaderStatus.ts`), keine zweite Formulierung. Eine
// DSGVO-Ja/Nein-Aussage gibt es hier so wenig wie dort.
//
// DOM-frei und testbar — die Komponente rendert nur das Ergebnis.
import type { ReasonerKiLage } from "../api/types";
import { KI_HEADER_TEXT, type KiHerkunftAnzeige, kiHerkunftAnzeige } from "./kiHeaderStatus";

export const KI_LAGE_TEXT = {
  extern: "kilage.zeile.extern",
  externOhneName: "kilage.zeile.externOhneName",
  intern: "kilage.zeile.intern",
  keine: "kilage.zeile.keine",
  unbekannt: "kilage.zeile.unbekannt",
  verfuegbarErreichbar: "kilage.verfuegbarkeit.erreichbar",
  verfuegbarUngeprueft: "kilage.verfuegbarkeit.ungeprueft",
  verfuegbarZuletztGescheitert: "kilage.verfuegbarkeit.zuletztGescheitert",
  verfuegbarUnerreichbar: "kilage.verfuegbarkeit.unerreichbar",
} as const;

export interface KiLageAnzeige {
  /** Der sichtbare Kurzsatz und seine Einsetzwerte. */
  textKey: string;
  params: Record<string, string>;
  /**
   * Ben nacharbeit-7/-9 (R-0940/R-2142): was der Server über die Erreichbarkeit der KI WEISS, an die
   * der nächste Lauf zuerst sendet — als Zusatz zum Kurzsatz („antwortet" / „Erreichbarkeit noch
   * nicht bestätigt" / „zuletzt nicht erreichbar"). `null`, wenn es nichts zu erreichen gibt. Auch
   * nach einem Fehlschlag bleibt der Anbieter genannt: die Ausführung versucht ihn erneut, und erst
   * wenn das wieder scheitert, steht ein Ersatzweg fest — den behauptet die Zeile deshalb nicht.
   */
  verfuegbarkeitKey: string | null;
  /** Die Sätze des Zeigehinweises, in Reihenfolge. */
  hinweisKeys: string[];
  herkunft: KiHerkunftAnzeige | null;
  /** „warn", sobald Inhalte an eine KI gehen; neutral, wenn keine arbeitet oder nichts bekannt ist. */
  ton: "neutral" | "warn";
}

export function kiLageAnzeige(lage: ReasonerKiLage | undefined): KiLageAnzeige {
  if (!lage) {
    return {
      textKey: KI_LAGE_TEXT.unbekannt,
      params: {},
      verfuegbarkeitKey: null,
      hinweisKeys: [],
      herkunft: null,
      ton: "neutral",
    };
  }
  const verfuegbarkeitKey =
    lage.verfuegbarkeit === "erreichbar"
      ? KI_LAGE_TEXT.verfuegbarErreichbar
      : lage.verfuegbarkeit === "ungeprueft"
        ? KI_LAGE_TEXT.verfuegbarUngeprueft
        : lage.verfuegbarkeit === "unerreichbar"
          ? KI_LAGE_TEXT.verfuegbarZuletztGescheitert
          : null;
  // Der Fehlschlag gehört in den Zeigehinweis mit dem ausgeschriebenen Satz — ohne Ersatzzusage.
  const fehlschlag =
    lage.verfuegbarkeit === "unerreichbar" ? [KI_LAGE_TEXT.verfuegbarUnerreichbar] : [];
  if (lage.modus === "extern") {
    return {
      textKey: lage.anbieterName ? KI_LAGE_TEXT.extern : KI_LAGE_TEXT.externOhneName,
      params: lage.anbieterName ? { anbieter: lage.anbieterName } : {},
      verfuegbarkeitKey,
      hinweisKeys: [...fehlschlag, KI_HEADER_TEXT.hintExternal, KI_HEADER_TEXT.offenePruefungen],
      herkunft: kiHerkunftAnzeige(lage.herkunft ?? undefined),
      ton: "warn",
    };
  }
  if (lage.modus === "intern") {
    return {
      textKey: KI_LAGE_TEXT.intern,
      params: {},
      verfuegbarkeitKey,
      hinweisKeys: [...fehlschlag, KI_HEADER_TEXT.hintInternal, KI_HEADER_TEXT.offenePruefungen],
      herkunft: kiHerkunftAnzeige(lage.herkunft ?? undefined),
      ton: "warn",
    };
  }
  return {
    textKey: KI_LAGE_TEXT.keine,
    params: {},
    verfuegbarkeitKey: null,
    hinweisKeys: [KI_HEADER_TEXT.hintNone],
    herkunft: null,
    ton: "neutral",
  };
}
