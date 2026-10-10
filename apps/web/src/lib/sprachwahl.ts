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
//  · KEIN LanguageDetector, keine Browsersprache, keine Normalisierung. Was aus dem Speicher kommt,
//    muss eine WÄHLBARE Sprache sein, sonst gilt die Vorgabe. Wählbar sind die angemeldeten
//    Oberflächensprachen (R-0997: `OBERFLAECHEN_SPRACHEN` aus den Ressourcen, heute de|en|nl) UND
//    die im Betrieb angelegten Sprachen (FR-I18N-02 Übersetzungspflege, `lib/instanzSprachen.ts`).
//    `<html lang>` folgt getrennt JOB 536 (`htmlLang.ts`).
// DOM-frei (globalThis über persistentToggle, strukturelle Typen statt lib.dom) — importierbar aus
// node-env-Tests.
import { I18N_LANGUAGE_CHANGED_EVENT } from "./htmlLang";
import type { I18nLike, SprachZuhoerer } from "./htmlLang";
import { istWaehlbareSprache } from "./instanzSprachen";
import { readStoredString, safeLocalStorage, writeStoredString } from "./persistentToggle";
import { OBERFLAECHEN_SPRACHEN } from "./sprachregister";

// Der localStorage-Schlüssel der Wahl. Werte sind die wählbaren Sprachen (angemeldet oder angelegt);
// alles andere (Alt-/Fremdformat, Regionalcode, leer) fällt in `gespeicherteSprache()` auf die
// Vorgabe zurück.
export const SPRACHE_STORAGE_KEY = "kw.sprache";

/** Die Vorgabe für jeden Browser ohne gespeicherte Wahl — wie der Startwert in `index.html`. */
export const STANDARD_SPRACHE = "de";

/**
 * Die Sprache, die beim Start gilt: die gespeicherte Wahl, sonst die Vorgabe „de".
 *
 * Die Prüfung gegen die wählbaren Sprachen steht hier und nicht erst in der Oberfläche: nur so ist
 * zugesichert, dass `lng` — und damit `i18n.language` — die wählbare Menge nie verlässt. R-0997: die
 * angemeldeten Sprachen kommen aus den Ressourcen (`lib/sprachregister.ts`); der Parameter ist für
 * den Test da, der eine angemeldete weitere Sprache nachstellt. FR-I18N-02: eine im Betrieb
 * angelegte Sprache wird zusätzlich angenommen, solange dieser Browser sie aus der letzten
 * Serverauskunft kennt (`lib/instanzSprachen.ts`).
 */
export function gespeicherteSprache(sprachen: readonly string[] = OBERFLAECHEN_SPRACHEN): string {
  const gespeichert = readStoredString(safeLocalStorage(), SPRACHE_STORAGE_KEY);
  if (gespeichert !== null && istWaehlbareSprache(gespeichert, sprachen)) {
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
 * Ein Wechsel auf eine nicht angemeldete Sprache wird NICHT geschrieben — der zuletzt gültige
 * Eintrag bleibt stehen: nicht zurechtbiegen, sondern gar nicht erst schreiben. Ein „fr" ohne
 * `woerterbuch/fr.ts` würde beim nächsten Start ohnehin verworfen; es hätte nur die vorher gültige
 * Wahl vernichtet. Ist `fr` über seine Ressource angemeldet (R-0997), wird es gemerkt.
 *
 * Rückgabe ist die Abmeldung. Im Produktivbetrieb hat sie keinen Adressaten (die Anwendungshülle
 * wird nie ausgehängt); gebraucht wird sie im TEST, wo mehrere Fälle gegen dieselbe i18n-Instanz
 * laufen und sich Zuhörer sonst über Fälle hinweg anhäufen. Sie ist idempotent: ein zweiter Aufruf
 * meldet nicht versehentlich einen inzwischen neu registrierten Zuhörer ab.
 */
export function bindSpracheSpeichern(
  i18n: I18nLike,
  sprachen: readonly string[] = OBERFLAECHEN_SPRACHEN,
): () => void {
  const zuhoerer: SprachZuhoerer = (sprache) => {
    if (!istWaehlbareSprache(sprache, sprachen)) {
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
