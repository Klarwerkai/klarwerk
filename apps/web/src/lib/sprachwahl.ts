// JOB 3086 (PRIORITAETEN Q8): die gewählte Sprache überlebt das Neuladen. Bis hierher stand in
// `i18n.ts` ein fest verdrahtetes `lng: "de"` — wer unter `/profil` auf EN stellte, sah nach dem
// nächsten F5 wieder Deutsch. Diese Datei ist die eine Wahrheit über die GESPEICHERTE Wahl:
//  · Persistenz je Browser über die BESTEHENDE fehlertolerante Speicher-Grenze
//    (`persistentToggle.ts`): kaputter/verweigerter Speicher → die Wahl lebt nur diese Sitzung,
//    nie ein Absturz. Keine zweite Storage-Schicht, kein eigenes try/catch hier — die
//    Fehlertoleranz wohnt dort und nirgends sonst. Gleiches Muster wie `designTheme.ts`.
//  · Gelesen wird beim Auswerten von `i18n.ts` (Startwert für `lng`), GESCHRIEBEN wird an der
//    Anwendungswurzel (`main.tsx`), nicht im Umschalter. Sonst merkt sich genau ein Umschalter
//    die Wahl und der nächste nicht — dieselbe Lehre wie bei `bindHtmlLang` (htmlLang.ts:10-14).
//  · KEIN LanguageDetector, keine Browsersprache, keine Normalisierung. Was aus dem Speicher
//    kommt, muss eine WÄHLBARE Sprache sein (siehe den Absatz FR-I18N-02 darunter), sonst gilt die
//    Vorgabe. Die Regel „nicht normalisieren, sondern verwerfen" stammt aus der Spezifikation zu
//    JOB 536 (htmlLang.ts); `i18n.language` ist damit stets eine wählbare Sprache, nie ein
//    zurechtgebogener Wert.
// DOM-frei (globalThis über persistentToggle, strukturelle Typen statt lib.dom) — importierbar aus
// node-env-Tests.
//
// FR-I18N-02 (Übersetzungspflege): wählbar sind die mitgelieferten `ERLAUBTE_SPRACHEN` UND die im
// Betrieb angelegten Sprachen (`lib/instanzSprachen.ts`). Alles andere gilt weiter als nicht gesagt
// und fällt auf die Vorgabe — ohne Normalisierung. Die Ownerentscheidung zu JOB 536 betrifft das
// `<html lang>`-Attribut (`htmlLang.ts`); sie verbietet keine weiteren wählbaren Sprachen.
import { I18N_LANGUAGE_CHANGED_EVENT } from "./htmlLang";
import type { I18nLike, SprachZuhoerer } from "./htmlLang";
import { istWaehlbareSprache } from "./instanzSprachen";
import { readStoredString, safeLocalStorage, writeStoredString } from "./persistentToggle";

// Der localStorage-Schlüssel der Wahl. Werte sind die wählbaren Sprachen; alles andere (Alt-/
// Fremdformat, Regionalcode, leer, nicht angelegt) fällt in `gespeicherteSprache()` auf die Vorgabe.
export const SPRACHE_STORAGE_KEY = "kw.sprache";

/** Die Vorgabe für jeden Browser ohne gespeicherte Wahl — wie der Startwert in `index.html`. */
export const STANDARD_SPRACHE = "de";

/**
 * Die Sprache, die beim Start gilt: die gespeicherte Wahl, sonst die Vorgabe „de".
 *
 * Die Prüfung gegen die wählbaren Sprachen steht hier und nicht erst in der Oberfläche: nur so ist
 * zugesichert, dass `lng` — und damit `i18n.language` — die wählbare Menge nie verlässt. Eine im
 * Betrieb angelegte Sprache wird nur angenommen, solange dieser Browser sie aus der letzten
 * Serverauskunft kennt (`lib/instanzSprachen.ts`).
 */
export function gespeicherteSprache(): string {
  const gespeichert = readStoredString(safeLocalStorage(), SPRACHE_STORAGE_KEY);
  if (gespeichert !== null && istWaehlbareSprache(gespeichert)) {
    return gespeichert;
  }
  return STANDARD_SPRACHE;
}

/**
 * Beim App-Start (main.tsx): jeden Sprachwechsel in den Speicher schreiben.
 *
 * Anders als `bindHtmlLang` schreibt das Binden selbst NICHTS: gespeichert wird eine WAHL, nicht
 * der Startzustand. Ein Schreiben beim Binden legte in jedem Browser sofort „de" ab, obwohl
 * niemand gewählt hat — der Unterschied „noch nie gewählt" gegen „bewusst Deutsch gewählt" wäre
 * damit weg, ohne dass irgendetwas davon besser würde (beide starten auf Deutsch).
 *
 * Ein Wechsel auf eine nicht erlaubte Sprache wird NICHT geschrieben — der zuletzt gültige Eintrag
 * bleibt stehen. Dieselbe Regel wie in `applyHtmlLang` (htmlLang.ts:66-69): nicht zurechtbiegen,
 * sondern gar nicht erst schreiben. Ein „fr" im Speicher würde beim nächsten Start ohnehin
 * verworfen; es hätte nur die vorher gültige Wahl vernichtet.
 *
 * Rückgabe ist die Abmeldung. Im Produktivbetrieb hat sie keinen Adressaten (die Anwendungshülle
 * wird nie ausgehängt); gebraucht wird sie im TEST, wo mehrere Fälle gegen dieselbe i18n-Instanz
 * laufen und sich Zuhörer sonst über Fälle hinweg anhäufen. Sie ist idempotent: ein zweiter Aufruf
 * meldet nicht versehentlich einen inzwischen neu registrierten Zuhörer ab.
 */
export function bindSpracheSpeichern(i18n: I18nLike): () => void {
  const zuhoerer: SprachZuhoerer = (sprache) => {
    if (!istWaehlbareSprache(sprache)) {
      return;
    }
    writeStoredString(safeLocalStorage(), SPRACHE_STORAGE_KEY, sprache);
  };
  i18n.on(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);

  let abgemeldet = false;
  return () => {
    if (abgemeldet) {
      return;
    }
    abgemeldet = true;
    i18n.off(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);
  };
}
