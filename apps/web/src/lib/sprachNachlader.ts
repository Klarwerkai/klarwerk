import type { BackendModule, ReadCallback } from "i18next";

// ================================================================================================
// R-0801 · DER NACHLADER FÜR SPRACHPAKETE — die Startsprache kommt mit, die anderen erst bei Bedarf.
// ================================================================================================
//
// WOZU. Bis hierher lagen alle drei Wörterbücher (de, en, nl) im Eintritts-Stück, und jeder Mensch
// lud alle drei, obwohl er genau eine Sprache sieht. Gemessen am 03.10.2026 (Kandidat 06e6c8f):
// Eintritt 1 750 692 B gegen den verbindlichen Deckel 1 360 000 B aus R-0801. Der Produktionsbau
// nimmt en und nl deshalb aus dem Eintritt heraus (Plugin `sprachpaketeNachladen`,
// `texte/intern/sprachpakete.ts`), und DIESER Nachlader holt sie, sobald i18next eine Sprache
// braucht, deren Bündel noch fehlt.
//
// WARUM ALS i18next-BACKEND UND NICHT ALS EIGENER AUFRUF VOR `changeLanguage`. Es gibt mehrere
// Umschalter (`pages/Profile.tsx`, `components/SprachSchalter.tsx`, `auth/BrandPanel.tsx`) und den
// Start aus gespeicherter Wahl oder Adresse (`i18n.ts`, `lng`). Hinge das Nachladen an einem
// Umschalter, lüde genau dieser und kein anderer. Als Backend liegt es dort, wo JEDER Wechsel
// vorbeikommt: i18next fragt ihn nur für Sprachen ohne Bündel (`partialBundledLanguages`), und
// `changeLanguage` stellt die Sprache erst um, wenn das Bündel da ist — bis dahin bleibt die
// bisherige Sprache sichtbar, statt kurz Schlüssel oder Deutsch zu zeigen.
//
// SCHEITERT DAS NACHLADEN (Netzabbruch, veraltetes Stück nach einem Deploy), meldet der Nachlader
// den Fehler an i18next. Die Oberfläche bricht dann nicht ab, sondern fällt über `fallbackLng`
// auf Deutsch zurück. BEWUSST OHNE WIEDERHOLUNG (zweites Argument `false`): i18next wiederholte
// sonst bis zu fünfmal mit wachsender Pause (rund 11 s), und so lange wartete der erste Aufbau in
// `main.tsx`. i18next merkt sich den Fehlschlag für diesen Seitenaufruf; erst ein Neuladen der Seite
// holt das Paket erneut.
//
// Gegenprobe: `tests/erstladezeit/sprachpakete-nachladen.test.ts`.

/** Liefert das Wörterbuch einer Sprache — oder `undefined`, wenn es nichts nachzuladen gibt. */
type SprachpaketLader = (sprache: string) => Promise<Record<string, string>> | undefined;

function alsFehler(fehler: unknown): Error {
  return fehler instanceof Error ? fehler : new Error(String(fehler));
}

export function sprachNachlader(laden: SprachpaketLader): BackendModule {
  return {
    type: "backend",
    init() {
      // Nichts einzurichten: der Lader trägt alles, was er braucht, selbst mit.
    },
    read(sprache: string, _namensraum: string, fertig: ReadCallback) {
      const paket = laden(sprache);
      if (paket === undefined) {
        // Keine nachladbare Sprache (z. B. die Startsprache oder ein fremder Wert): ein leeres
        // Bündel, damit i18next über `fallbackLng` weiterarbeitet und nicht erneut fragt.
        fertig(null, {});
        return;
      }
      paket.then(
        (texte) => fertig(null, texte),
        (fehler: unknown) => fertig(alsFehler(fehler), false),
      );
    },
  };
}
