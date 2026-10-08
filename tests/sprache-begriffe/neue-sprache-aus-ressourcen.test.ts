// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-sprache-begriffe · K10 (R-0997) — EINE NEUE SPRACHE ÜBER RESSOURCEN, OHNE CODE.
// ================================================================================================
//
// R-0997: „Neue Sprachen lassen sich über Ressourcendateien ergänzen, ohne dass am Programm etwas
// geändert werden muss." Pflichtenheft §3.13 FR-I18N-02: „Architektur für weitere Sprachen
// erweiterbar — Abnahmekriterium: neue Sprache ohne Code-Umbau ergänzbar."
//
// Bens Befund (Nacharbeit 10): Sprachimporte, Nachladen und Textmodulvertrag waren im Programm auf
// DE/EN/NL festgelegt; JOB 536 regelt nur `<html lang>`. Seither leitet sich die Sprachmenge aus
// den Ressourcen ab — im Browser `lib/sprachregister.ts`, im Bau `registrierteSprachen`
// (`texte/intern/sprachwaechter.ts`), beide über `sprachenAusRessourcen` (`texte/intern/pruefung.ts`).
//
// WIE DIESE DATEI DAS BELEGT, OHNE EINE SPRACHE ZU ERFINDEN: Im Produktbaum liegt keine vierte
// Sprache, und eine hinzuzufügen wäre eine Produktentscheidung. Geprüft wird deshalb jede Stelle,
// die eine Sprache kennen muss, mit einer PROBE-Ressource `fr`:
//   R-1..R-2  die Ableitung aus Dateinamen; heute ergibt der Baum genau de, en, nl
//   R-3       der Bau (Plugin `textmodul-vertrag`) an einer Wegwerfbühne mit `woerterbuch/fr.ts`:
//             gebunden + Textmodule mit fr → grün; ein Modul ohne fr → Abbruch; ungebunden → Abbruch
//   R-4       das Nachladen der neuen Sprache samt Textmodulen (`ladeWeitereSprache`)
//   R-5       Textmodulvertrag und Zusammenführung über die angemeldete Menge
//   R-6       die gespeicherte Wahl merkt sich eine angemeldete Sprache
//   R-7       die GETRENNTE Regel für `<html lang>` (JOB 536) bleibt genau de|en|nl
//   R-8       keine Sprachliste mehr in den Umschaltern und im Textmodulvertrag
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { ERLAUBTE_SPRACHEN, applyHtmlLang } from "../../apps/web/src/lib/htmlLang";
import { OBERFLAECHEN_SPRACHEN, ladeWeitereSprache } from "../../apps/web/src/lib/sprachregister";
import { SPRACHE_STORAGE_KEY, gespeicherteSprache } from "../../apps/web/src/lib/sprachwahl";
import {
  type Textmodul,
  fuehreTextmoduleZusammen,
  pruefeTextmodule,
  sprachenAusRessourcen,
} from "../../apps/web/src/texte/intern/pruefung";
import { textmodulVertrag } from "../../apps/web/src/texte/intern/sammeln";
import {
  pruefeSprachdateien,
  registrierteSprachen,
} from "../../apps/web/src/texte/intern/sprachwaechter";
import { repoPfad } from "../support/repoPfad";

const MIT_FR = ["de", "en", "nl", "fr"];

const buehnen: string[] = [];
afterAll(() => {
  for (const ordner of buehnen) {
    rmSync(ordner, { recursive: true, force: true });
  }
});

/** Eine Wegwerfbühne in Gestalt von `apps/web` — nie am Produktbaum schrauben. */
function buehne(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-neue-sprache-"));
  buehnen.push(wurzel);
  mkdirSync(join(wurzel, "src", "texte"), { recursive: true });
  writeFileSync(join(wurzel, "src", "i18n.ts"), 'const de = {\n  "basis.da": "A",\n};\n', "utf8");
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, "src", pfad);
    mkdirSync(join(ziel, ".."), { recursive: true });
    writeFileSync(ziel, inhalt, "utf8");
  }
  return wurzel;
}

const DE_DATEI = 'const de = {\n  "basis.da": "A",\n};\n\nexport { de };\n';
const FR_GEBUNDEN =
  'import type { de } from "./de";\n\nconst fr: typeof de = {\n  "basis.da": "B",\n};\n\nexport { fr };\n';
const FR_LOSE = 'export const fr = {\n  "basis.da": "B",\n};\n';

function textmodul(sprachen: readonly string[]): string {
  const bloecke = sprachen.map((s) => `  ${s}: { "probe.titel": "${s.toUpperCase()}" },`);
  const kopf = ["export default {", '  praefix: "probe.",', "  legacySchluessel: [],"];
  return [...kopf, ...bloecke, "};", ""].join("\n");
}

function fahrePlugin(wurzel: string): void {
  const plugin = textmodulVertrag();
  plugin.configResolved({ root: wurzel });
  plugin.buildStart();
}

describe("K10 · R-0997 — die Sprachmenge kommt aus den Ressourcen", () => {
  it("R-1 aus Dateinamen: Pflichtsprachen zuerst, jede weitere angemeldete danach; Fremdes zählt nicht", () => {
    expect(sprachenAusRessourcen([])).toEqual(["de", "en", "nl"]);
    expect(
      sprachenAusRessourcen([
        "../woerterbuch/fr.ts",
        "../woerterbuch/it.ts",
        "../woerterbuch/README.md",
        "../woerterbuch/deutsch.ts",
        "../woerterbuch/en.ts",
      ]),
    ).toEqual(["de", "en", "nl", "fr", "it"]);
  });

  it("R-2 Kalibrierung: der Produktbaum meldet heute genau de, en und nl an — im Browser und im Bau", () => {
    expect([...OBERFLAECHEN_SPRACHEN]).toEqual(["de", "en", "nl"]);
    expect(registrierteSprachen(repoPfad("apps/web/src"))).toEqual(["de", "en", "nl"]);
    expect(pruefeSprachdateien(repoPfad("apps/web/src"))).toEqual([]);
  });

  it("R-3 der Bau: eine gebundene fr-Ressource meldet fr an und verlangt fr in jedem Textmodul", () => {
    const gruen = buehne({
      "woerterbuch/de.ts": DE_DATEI,
      "woerterbuch/fr.ts": FR_GEBUNDEN,
      "texte/probe.ts": textmodul(MIT_FR),
    });
    expect(registrierteSprachen(join(gruen, "src"))).toEqual(MIT_FR);
    expect(pruefeSprachdateien(join(gruen, "src"))).toEqual([]);
    expect(() => fahrePlugin(gruen)).not.toThrow();

    // Gegenprobe 1: dasselbe ohne fr-Block im Modul — der Bau hält an und nennt die Sprache.
    const ohneBlock = buehne({
      "woerterbuch/de.ts": DE_DATEI,
      "woerterbuch/fr.ts": FR_GEBUNDEN,
      "texte/probe.ts": textmodul(["de", "en", "nl"]),
    });
    expect(() => fahrePlugin(ohneBlock)).toThrow(/probe\.ts: fr fehlt/);

    // Gegenprobe 2: eine UNGEBUNDENE Datei meldet keine Sprache an — sie bleibt eine unbekannte
    // Sprache, und ein fr-Block im Modul ist dann ein unbekannter Eintrag.
    const lose = buehne({
      "woerterbuch/de.ts": DE_DATEI,
      "woerterbuch/fr.ts": FR_LOSE,
      "texte/probe.ts": textmodul(MIT_FR),
    });
    expect(registrierteSprachen(join(lose, "src"))).toEqual(["de", "en", "nl"]);
    expect(pruefeSprachdateien(join(lose, "src"))[0]).toContain(
      "woerterbuch/fr.ts: unbekannte Sprache",
    );
    expect(() => fahrePlugin(lose)).toThrow(/unbekannter Eintrag "fr"/);
  });

  it("R-4 das Nachladen: die neue Sprache kommt aus ihrer Ressource, die Textmodule darüber", async () => {
    const ressourcen = {
      "../woerterbuch/fr.ts": async () => ({ fr: { "basis.da": "Bonjour" } }),
    };
    const paket = ladeWeitereSprache("fr", { "probe.titel": "FR" }, ressourcen);
    await expect(paket).resolves.toEqual({ "basis.da": "Bonjour", "probe.titel": "FR" });
    // Ohne Ressource gibt es nichts nachzuladen (Rückfall über fallbackLng); en/nl gehen ihren
    // eigenen Weg über den Produktionsschnitt.
    expect(ladeWeitereSprache("it", undefined, ressourcen)).toBeUndefined();
    expect(ladeWeitereSprache("en", undefined, ressourcen)).toBeUndefined();
    // Eine Ressource, die ihre Sprache nicht exportiert, scheitert laut statt still.
    const kaputt = { "../woerterbuch/fr.ts": async () => ({ anders: {} }) };
    await expect(ladeWeitereSprache("fr", undefined, kaputt)).rejects.toThrow(/exportiert/);
  });

  it("R-5 Textmodulvertrag und Zusammenführung laufen über die angemeldete Menge", () => {
    const modul = (sprachen: readonly string[]): Record<string, unknown> => ({
      "./texte/probe.ts": {
        praefix: "probe.",
        legacySchluessel: [],
        ...Object.fromEntries(sprachen.map((s) => [s, { "probe.titel": s.toUpperCase() }])),
      },
    });
    const leer = new Set<string>();
    expect(pruefeTextmodule(modul(MIT_FR), leer, MIT_FR)).toEqual([]);
    const ohneFr = pruefeTextmodule(modul(["de", "en", "nl"]), leer, MIT_FR).join("\n");
    expect(ohneFr).toContain("fr fehlt");
    // Ohne Anmeldung bleibt fr ein unbekannter Eintrag — R-1169 gilt unverändert.
    const unangemeldet = pruefeTextmodule(modul(MIT_FR), leer).join("\n");
    expect(unangemeldet).toContain('unbekannter Eintrag "fr"');
    const zusammen = fuehreTextmoduleZusammen(modul(MIT_FR) as Record<string, Textmodul>, MIT_FR);
    expect(zusammen.fr).toEqual({ "probe.titel": "FR" });
    expect(zusammen.de).toEqual({ "probe.titel": "DE" });
  });
});

describe("K10 · die Wahl folgt der Anmeldung, `<html lang>` bleibt bei JOB 536", () => {
  afterEach(() => {
    globalThis.localStorage.removeItem(SPRACHE_STORAGE_KEY);
    document.documentElement.setAttribute("lang", "de");
  });

  it("R-6 eine angemeldete Sprache wird beim Start übernommen, eine nicht angemeldete nicht", () => {
    globalThis.localStorage.setItem(SPRACHE_STORAGE_KEY, "fr");
    expect(gespeicherteSprache(MIT_FR)).toBe("fr");
    expect(gespeicherteSprache()).toBe("de");
  });

  it("R-7 die Regel für <html lang> ist getrennt und unverändert: genau de|en|nl, fr ist ein No-op", () => {
    expect([...ERLAUBTE_SPRACHEN]).toEqual(["de", "en", "nl"]);
    document.documentElement.setAttribute("lang", "de");
    applyHtmlLang("fr");
    expect(document.documentElement.getAttribute("lang")).toBe("de");
    applyHtmlLang("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
  });

  it("R-8 keine Sprachliste mehr im Programm: Umschalter und Laufzeit lesen die angemeldete Menge", () => {
    const lies = (p: string): string => readFileSync(repoPfad(`apps/web/src/${p}`), "utf8");
    expect(lies("components/SprachSchalter.tsx")).toContain("OBERFLAECHEN_SPRACHEN.map(");
    expect(lies("pages/Profile.tsx")).toContain("OBERFLAECHEN_SPRACHEN as SPRACHEN");
    expect(lies("auth/BrandPanel.tsx")).toContain("OBERFLAECHEN_SPRACHEN.map(");
    for (const datei of ["pages/Profile.tsx", "auth/BrandPanel.tsx", "lib/sprachwahl.ts"]) {
      expect(lies(datei), datei).not.toMatch(/\[\s*"de",\s*"en",\s*"nl"\s*\]/);
    }
    const i18n = lies("i18n.ts");
    expect(i18n).toContain("pruefeTextmodule(textmodule, basis, OBERFLAECHEN_SPRACHEN)");
    expect(i18n).toContain("fuehreTextmoduleZusammen(textmodule, OBERFLAECHEN_SPRACHEN)");
    expect(i18n).toContain("return ladeWeitereSprache(sprache, modulTexte[sprache]);");
  });
});
