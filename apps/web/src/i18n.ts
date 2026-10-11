/// <reference types="vite/client" />
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { sprachAusEintritt } from "./lib/htmlLang";
import { sprachNachlader } from "./lib/sprachNachlader";
import { OBERFLAECHEN_SPRACHEN, ladeWeitereSprache } from "./lib/sprachregister";
import { gespeicherteSprache } from "./lib/sprachwahl";
import {
  type Textmodul,
  fuehreTextmoduleZusammen,
  pruefeTextmodule,
} from "./texte/intern/pruefung";
import { de } from "./woerterbuch/de";
import { en } from "./woerterbuch/en";
import { nl } from "./woerterbuch/nl";

// Zweisprachigkeit DE/EN (G-8). Strings über Keys; Ressourcen wachsen je Screen.
// I18N-AUFTEILUNG (Aufnahme 20260922): die drei Grundwörterbücher wohnen je Sprache in
// `woerterbuch/de.ts`, `woerterbuch/en.ts` und `woerterbuch/nl.ts` — Zeile für Zeile verschoben,
// kein Schlüssel und kein Wert geändert. Neue Texte kommen in ein Textmodul (`texte/`).

// ================================================================================================
// R-0801 · NUR DIE STARTSPRACHE GEHÖRT IN DEN EINTRITT — en und nl werden nachgeladen.
// ================================================================================================
//
// Die drei Wörterbücher stehen je Sprache in `woerterbuch/` (I18N-AUFTEILUNG) und werden oben
// statisch importiert. Getrennt wird erst im PRODUKTIONSBAU: das Plugin `sprachpaketeNachladen`
// (`texte/intern/sprachpakete.ts`) nimmt die Importe von `en` und `nl` aus dieser Datei heraus,
// liefert ihre Blöcke als eigene Stücke, ersetzt `{ en, nl }` in `VORLIEGEND` durch `{}` und trägt
// in `NACHLADEN` je Sprache ein `import()` ein. Es bricht den Bau ab, wenn es einen seiner Anker
// nicht genau einmal findet — sonst lägen beide Sprachen still wieder im Eintritt.
//
// Im Quelltext — und damit in jedem Vitest-Lauf und im Entwicklungsserver — liegen weiterhin alle
// drei Sprachen sofort vor; der Nachlader (`lib/sprachNachlader.ts`) wird dann nie gefragt.
//
// R-0997 / FR-I18N-02: `en`/`nl` sind hier nur noch der Sonderfall des Produktionsschnitts, keine
// Grenze der Sprachmenge mehr. Welche Sprachen die Oberfläche kann, kommt aus den Ressourcen
// (`lib/sprachregister.ts`, `OBERFLAECHEN_SPRACHEN`): jede weitere `woerterbuch/<kürzel>.ts` wird
// nachgeladen (`ladeWeitereSprache` in `nachladen` unten), und Textmodulvertrag wie Zusammenführung
// laufen über genau diese Menge. Eine neue Sprache braucht keine Zeile in dieser Datei.
type NachladbareSprache = "en" | "nl";
type Woerterbuch = typeof de;

const VORLIEGEND: Partial<Record<NachladbareSprache, Woerterbuch>> = { en, nl };
const NACHLADEN: Partial<Record<NachladbareSprache, () => Promise<Woerterbuch>>> = {};

// ================================================================================================
// JOB 4367 · DIE TEXTMODULE — jeder Nutzerweg bringt seine eigenen Texte mit.
// ================================================================================================
//
// WAS SICH ÄNDERT UND WAS NICHT. Für einen Anwender: nichts. Jeder Text bleibt Zeichen für Zeichen
// derselbe; `tests/i18n-textmodule/bestand-unveraendert.test.ts` misst das gegen einen vor dem
// Umbau erzeugten Schnappschuss des Basisstands. Was sich ändert, ist die Datei, die eine Bahn
// anfasst: wer an UX08 arbeitet, schreibt in `texte/ux08.ts` — nicht mehr in diese Datei, in die
// bis heute JEDER Nutzerweg schrieb und an der sich deshalb jede zweite Bahn verklemmte.
//
// WIE SIE GEFUNDEN WERDEN. `import.meta.glob` löst Vite beim Bauen STATISCH auf: aus dem Muster
// wird eine Liste echter Importe. Es gibt also kein dynamisches Nachladen und keinen Pfad, den ein
// Bündler nicht sieht — eine neue Datei in `texte/` ist nach dem nächsten Bau da, ohne dass jemand
// diese Zeile anfasst. `*` überschreitet kein `/`: `texte/intern/` (die Werkzeuge) wird nicht
// eingesammelt.
//
// WARUM HIER GEPRÜFT WIRD, OBWOHL TOR UND BUILD ES SCHON TUN. Der Sammler frisst, was da liegt:
// zwei Module mit demselben Schlüssel überschrieben sich still, und wer gewinnt, entschiede die
// alphabetische Reihenfolge der Dateinamen. Ein lauter Abbruch ist besser als ein falscher Text.
// DIESE Prüfung ist aber ausdrücklich die SCHWÄCHSTE der drei — sie meldet erst im Browser, also
// nach dem Ausliefern. Die tragenden stehen in `tests/i18n-textmodule/` (Tor) und im Plugin
// `textmodul-vertrag` in `apps/web/vite.config.ts` (Produktbuild).
const textmodule = import.meta.glob<Textmodul>("./texte/*.ts", { eager: true, import: "default" });
const basis = new Set(Object.keys(de));
const textmodulFehler = pruefeTextmodule(textmodule, basis, OBERFLAECHEN_SPRACHEN);
if (textmodulFehler.length > 0) {
  throw new Error(`Textmodule verletzen ihren Vertrag:\n${textmodulFehler.join("\n")}`);
}
const modulTexte = fuehreTextmoduleZusammen(textmodule, OBERFLAECHEN_SPRACHEN);

function istNachladbar(sprache: string): sprache is NachladbareSprache {
  return sprache === "en" || sprache === "nl";
}

/** Das Bündel einer Sprache, sofern es schon beim Start vorliegt — sonst nichts. */
function vorliegend(sprache: NachladbareSprache) {
  const paket = VORLIEGEND[sprache];
  return paket ? { [sprache]: { translation: { ...paket, ...modulTexte[sprache] } } } : {};
}

/** Holt ein fehlendes Bündel nach; die Textmodule derselben Sprache kommen dazu wie oben. */
function nachladen(sprache: string): Promise<Record<string, string>> | undefined {
  if (!istNachladbar(sprache)) {
    // R-0997: jede weitere, über `woerterbuch/` angemeldete Sprache — sonst nichts (Rückfall).
    return ladeWeitereSprache(sprache, modulTexte[sprache]);
  }
  const zusatz = modulTexte[sprache];
  return NACHLADEN[sprache]?.().then((paket) => ({ ...paket, ...zusatz }));
}

// R-0801: `sprachBereit` erfüllt sich, sobald die Startsprache vollständig vorliegt. Für Deutsch
// geschieht das sofort; für eine gespeicherte Wahl en/nl wartet `main.tsx` damit den ersten Aufbau
// ab, damit die Oberfläche nicht erst deutsch erscheint und dann umspringt.
export const sprachBereit = i18n
  .use(sprachNachlader(nachladen))
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: { ...de, ...modulTexte.de } },
      ...vorliegend("en"),
      ...vorliegend("nl"),
    },
    // Fehlt einer Sprache das Bündel, fragt i18next den Nachlader; vorhandene Bündel bleiben.
    partialBundledLanguages: true,
    // JOB 3323 (Nachführung aus JOB 3280): DIE ADRESSE SCHLÄGT DIE GESPEICHERTE WAHL — aber nur,
    // wenn sie eine Sprache des LINKVERTRAGS nennt (`EINTRITT_SPRACHEN` = de|en, htmlLang.ts). Der
    // Eintritt aus Klara (`/capture/frontdoor?draft=<id>&lang=en`) bestimmt so die Sprache DIESES
    // Aufrufs, ohne dass jemand erst umschalten muss; ohne `?lang` und bei JEDEM nicht vereinbarten
    // Wert — auch bei `nl`, das die Anwendung zwar kann, der Link aber nicht setzen darf — bleibt es
    // Zeichen für Zeichen beim bisherigen Verhalten. Die Reihenfolge ist die Rangfolge: Adresse,
    // dann gespeicherte Wahl, dann die Vorgabe „de" (in `gespeicherteSprache`).
    //
    // BEWUSST NICHT GESPEICHERT: das `languageChanged` des Starts kommt, bevor `bindSpracheSpeichern`
    // (`lib/sprachwahl.ts`) zuhört — bei nachgeladener Startsprache erst nach `sprachBereit`, und
    // genau deshalb bindet `main.tsx` den Schreiber erst danach. Ein Link aus Word ist der Wunsch
    // für DIESEN Aufruf, keine Wahl für diesen Browser — er soll die Wahl unter /profil nicht
    // überschreiben.
    lng: sprachAusEintritt() ?? gespeicherteSprache(),
    fallbackLng: "de",
    interpolation: { escapeValue: false },
    // R-1034: im Betrieb gepflegte Texte kommen NACH dem ersten Zeichnen vom Server
    // (`lib/textpflege.ts`). Ohne diese Bindung zeichnete React sie erst beim nächsten
    // Sprachwechsel; mit ihr erscheint die Anpassung sofort.
    react: { bindI18nStore: "added" },
  });

export default i18n;
