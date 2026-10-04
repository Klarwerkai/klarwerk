/// <reference types="vite/client" />
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { sprachAusEintritt } from "./lib/htmlLang";
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
const textmodulFehler = pruefeTextmodule(textmodule, new Set(Object.keys(de)));
if (textmodulFehler.length > 0) {
  throw new Error(`Textmodule verletzen ihren Vertrag:\n${textmodulFehler.join("\n")}`);
}
const modulTexte = fuehreTextmoduleZusammen(textmodule);

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: { ...de, ...modulTexte.de } },
    en: { translation: { ...en, ...modulTexte.en } },
    nl: { translation: { ...nl, ...modulTexte.nl } },
  },
  // JOB 3323 (Nachführung aus JOB 3280): DIE ADRESSE SCHLÄGT DIE GESPEICHERTE WAHL — aber nur,
  // wenn sie eine Sprache des LINKVERTRAGS nennt (`EINTRITT_SPRACHEN` = de|en, htmlLang.ts). Der
  // Eintritt aus Klara (`/capture/frontdoor?draft=<id>&lang=en`) bestimmt so die Sprache DIESES
  // Aufrufs, ohne dass jemand erst umschalten muss; ohne `?lang` und bei JEDEM nicht vereinbarten
  // Wert — auch bei `nl`, das die Anwendung zwar kann, der Link aber nicht setzen darf — bleibt es
  // Zeichen für Zeichen beim bisherigen Verhalten. Die Reihenfolge ist die Rangfolge: Adresse,
  // dann gespeicherte Wahl, dann die Vorgabe „de" (in `gespeicherteSprache`).
  //
  // BEWUSST NICHT GESPEICHERT: `lng` löst kein `languageChanged` aus, `bindSpracheSpeichern`
  // (`lib/sprachwahl.ts`) schreibt also nichts. Ein Link aus Word ist der Wunsch für DIESEN
  // Aufruf, keine Wahl für diesen Browser — er soll die Wahl unter /profil nicht überschreiben.
  lng: sprachAusEintritt() ?? gespeicherteSprache(),
  fallbackLng: "de",
  interpolation: { escapeValue: false },
});

export default i18n;
