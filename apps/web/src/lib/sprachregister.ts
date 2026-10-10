/// <reference types="vite/client" />
// ================================================================================================
// R-0997 / FR-I18N-02 · DIE OBERFLÄCHENSPRACHEN KOMMEN AUS DEN RESSOURCEN, NICHT AUS EINER LISTE.
// ================================================================================================
//
// FR-I18N-02 (Pflichtenheft §3.13): „Architektur für weitere Sprachen erweiterbar — neue Sprache
// ohne Code-Umbau ergänzbar." Bis hierher stand die Menge an fünf Stellen fest im Programm
// (`i18n.ts`: Importe und `istNachladbar`; `texte/intern/pruefung.ts`: Textmodulvertrag;
// Sprachschalter, Profil, Anmeldung, gespeicherte Wahl über `ERLAUBTE_SPRACHEN`). Diese Datei ist
// jetzt die EINE Ableitung für den Browser: jede Datei `woerterbuch/<kürzel>.ts` meldet ihre
// Sprache an (`sprachenAusRessourcen`, dieselbe Funktion, die der Bau über den Dateibaum fährt).
//
// EINE SPRACHE ERGÄNZEN heisst damit: `woerterbuch/fr.ts` anlegen wie `en.ts`
// (`const fr: typeof de = {` … `export { fr };` — der Typcheck meldet jede fehlende Zeile), jedem
// Textmodul seinen `fr`-Block geben, den Sprachnamen `lib.facet.lang.fr` in jedes Wörterbuch. Der
// Bau hält an, solange ein Block fehlt (`textmodul-vertrag`, `texte/intern/sammeln.ts`).
//
// WAS AUSDRÜCKLICH GETRENNT BLEIBT: die Regel für `<html lang>` (`lib/htmlLang.ts`,
// `ERLAUBTE_SPRACHEN`) — Ownerentscheidung JOB 536 vom 13.08.2026: genau de|en|nl, alles andere ist
// ein No-op. Eine neu angemeldete Sprache ist damit wählbar und vollständig übersetzt, setzt aber
// `<html lang>` NICHT um; das Attribut behält den zuletzt gültigen Wert. Die Regel zu erweitern ist
// eine Entscheidung, die hier nicht vorweggenommen wird. Ebenso unberührt: der Linkvertrag
// `EINTRITT_SPRACHEN` (de|en) und das Word-Seitenfenster mit seinen eigenen Wörterbüchern.
//
// IM BÜNDEL: `de`, `en` und `nl` sind ausgenommen — `de` liegt im Eintritt, `en`/`nl` schneidet der
// Produktionsbau als eigene Pakete aus (`texte/intern/sprachpakete.ts`). Jede weitere Sprache wird
// über `import.meta.glob` zu einem eigenen, nachgeladenen Stück; heute gibt es keine, das Muster
// trifft also nichts und der Eintritt bleibt Byte für Byte, wie er ist.
import { SPRACHEN, spracheAusPfad, sprachenAusRessourcen } from "../texte/intern/pruefung";

/** Lädt das Modul einer Sprachdatei (Vite: ein eigenes, nachgeladenes Stück). */
export type SprachRessource = () => Promise<Record<string, unknown>>;

const WEITERE_RESSOURCEN = import.meta.glob([
  "../woerterbuch/*.ts",
  "!../woerterbuch/de.ts",
  "!../woerterbuch/en.ts",
  "!../woerterbuch/nl.ts",
]) as Readonly<Record<string, SprachRessource>>;

/** Die Oberflächensprachen: DE/EN/NL und jede über `woerterbuch/` angemeldete weitere Sprache. */
export const OBERFLAECHEN_SPRACHEN: readonly string[] = sprachenAusRessourcen(
  Object.keys(WEITERE_RESSOURCEN),
);

/**
 * Lädt das Wörterbuch einer weiteren Sprache aus ihrer Ressource und legt die Textmodule derselben
 * Sprache darüber — oder `undefined`, wenn keine Ressource diese Sprache anmeldet (dann bleibt es
 * beim Rückfall über `fallbackLng`, wie für jeden fremden Wert).
 *
 * Exportiert mit den Ressourcen als Parameter: der Test fährt genau diese Funktion mit einer
 * Probe-Ressource, ohne dass im Produktbaum eine erfundene Sprache liegen muss.
 */
export function ladeWeitereSprache(
  sprache: string,
  zusatz: Readonly<Record<string, string>> | undefined,
  ressourcen: Readonly<Record<string, SprachRessource>> = WEITERE_RESSOURCEN,
): Promise<Record<string, string>> | undefined {
  if ((SPRACHEN as readonly string[]).includes(sprache)) {
    return undefined;
  }
  const pfad = Object.keys(ressourcen).find((p) => spracheAusPfad(p) === sprache);
  const laden = pfad === undefined ? undefined : ressourcen[pfad];
  if (laden === undefined) {
    return undefined;
  }
  return laden().then((modul) => {
    const paket = modul[sprache];
    if (typeof paket !== "object" || paket === null) {
      throw new Error(`woerterbuch/${sprache}.ts exportiert „${sprache}" nicht.`);
    }
    return { ...(paket as Record<string, string>), ...zusatz };
  });
}
