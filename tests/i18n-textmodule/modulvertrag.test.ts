// ================================================================================================
// JOB 4367 · K2/K3 — JEDE FEHLERKLASSE WIRD ROT, MIT SCHLÜSSELNAME UND MODUL.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD UND WARUM ES NICHT REICHT, DEN GUTEN FALL ZU PRÜFEN. Ein Sammler, der
// `texte/*.ts` einliest, ist eine Einladung: zwei Module mit demselben Schlüssel überschreiben sich
// still, ein fehlender niederländischer Text fällt lautlos auf Deutsch zurück, ein Altname, den
// jemand aus `i18n.ts` zu entfernen vergisst, steht danach zweimal da. Ein Test, der nur zusieht,
// wie der heutige, saubere Bestand grün wird, sieht keine dieser drei Lagen.
//
// DESHALB WIRD JEDE FEHLERKLASSE EINZELN HERBEIGEFÜHRT — in einer Wegwerfbühne (Temp-Ordner mit
// derselben Gestalt wie `apps/web/src`), nie am Produktbaum. Am Produktbaum zu schrauben wäre
// gefährlich: die übrigen Testdateien laufen parallel und laden `i18n.ts`; ein kurz vorhandenes
// kaputtes Modul machte sie mit rot, aus einem Grund, den niemand mehr findet.
//
// UND ES WIRD DAS ECHTE PLUGIN AUSGEFÜHRT, nicht eine nachgebaute Kopie davon: dieselbe Fabrik
// `textmodulVertrag`, die `apps/web/vite.config.ts` einträgt, wird hier gerufen — mit derselben
// `configResolved`-Übergabe, die Vite macht, und danach `buildStart`. Damit ist die Zusage
// „derselbe Fehler stoppt auch den Produktbuild" gemessen und nicht behauptet. Ein voller
// `vite build` steht daneben als Gegenprobe der Runde (s. RUECKGABE) — als Testfall wäre er eine
// Minute Bündeln für eine Aussage, die dieser Aufruf in Millisekunden trifft.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pruefeTextbaum, textmodulVertrag } from "../../apps/web/src/texte/intern/sammeln";
import { repoPfad } from "../support/repoPfad";

const buehnen: string[] = [];
afterAll(() => {
  for (const ordner of buehnen) {
    rmSync(ordner, { recursive: true, force: true });
  }
});

/**
 * Eine Bühne in der Gestalt von `apps/web`: ein `src/i18n.ts` mit einem winzigen Grundbestand und
 * ein `src/texte/` mit genau den Modulen, die der Fall braucht.
 *
 * Gibt die BÜHNENWURZEL zurück (nicht `src/`) — das Plugin bekommt sie als `config.root`, so wie
 * Vite sie im echten Build übergibt.
 */
function buehne(module: Record<string, string>, grundbestand = ['"basis.vorhanden": "A"']): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-job4367-"));
  buehnen.push(wurzel);
  mkdirSync(join(wurzel, "src", "texte"), { recursive: true });
  const zeilen = grundbestand.map((eintrag) => `  ${eintrag},`).join("\n");
  writeFileSync(join(wurzel, "src", "i18n.ts"), `const de = {\n${zeilen}\n};\n`, "utf8");
  for (const [datei, inhalt] of Object.entries(module)) {
    writeFileSync(join(wurzel, "src", "texte", datei), inhalt, "utf8");
  }
  return wurzel;
}

/** Ein sauberes Modul als Ausgangspunkt — jeder Fehlerfall verstellt daran genau eine Sache. */
function sauber(name: string, schluessel = `${name}.titel`): string {
  return [
    "export default {",
    `  praefix: "${name}.",`,
    "  legacySchluessel: [],",
    `  de: { "${schluessel}": "DE" },`,
    `  en: { "${schluessel}": "EN" },`,
    `  nl: { "${schluessel}": "NL" },`,
    "};",
    "",
  ].join("\n");
}

function befunde(module: Record<string, string>, grundbestand?: string[]): string[] {
  const wurzel = grundbestand === undefined ? buehne(module) : buehne(module, grundbestand);
  return pruefeTextbaum(join(wurzel, "src"));
}

describe("JOB 4367 · K2 — der gute Fall und die Form des Sammlers", () => {
  it("K2.1 · der echte Produktbaum erfüllt den Vertrag", () => {
    expect(pruefeTextbaum(repoPfad("apps/web/src"))).toEqual([]);
  });

  it("K2.2 · ein neues Modul wird ohne jede Änderung an i18n.ts mitgenommen", () => {
    // Der Sammler bekommt hier ein Modul, das es nirgends im Produkt gibt, und in der Bühne steht
    // kein einziger Import darauf. Er findet es trotzdem — das ist die Zusage dieses Auftrags.
    expect(befunde({ "probe.ts": sauber("probe") })).toEqual([]);
    expect(
      befunde({ "probe.ts": sauber("probe"), "zweite.ts": sauber("zweite") }),
      "zwei Module nebeneinander sind der Normalfall, nicht der Ausnahmefall",
    ).toEqual([]);
  });
});

describe("JOB 4367 · K2 — jede Fehlerklasse nennt Modul und Schlüssel", () => {
  it("K2.3 · ein Modul ohne praefix", () => {
    const fehler = befunde({
      "probe.ts": [
        "export default {",
        '  legacySchluessel: ["probe.titel"],',
        '  de: { "probe.titel": "DE" },',
        '  en: { "probe.titel": "EN" },',
        '  nl: { "probe.titel": "NL" },',
        "};",
        "",
      ].join("\n"),
    });
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain("./texte/probe.ts");
    expect(fehler[0]).toContain("kein praefix");
    expect(fehler[0]).toContain('"probe."');
  });

  it("K2.4 · ein praefix, das nicht zum Dateinamen passt", () => {
    const fehler = befunde({ "probe.ts": sauber("probe").replace('"probe."', '"fremd."') });
    expect(fehler.join("\n")).toContain('praefix "fremd." passt nicht zum Dateinamen');
    expect(fehler.join("\n")).toContain('erwartet "probe."');
  });

  it("K2.5 · derselbe Schlüssel in zwei Modulen — beide Module werden benannt", () => {
    const fehler = befunde({
      "eins.ts": sauber("eins", "gemeinsam.titel").replace(
        "legacySchluessel: []",
        'legacySchluessel: ["gemeinsam.titel"]',
      ),
      "zwei.ts": sauber("zwei", "gemeinsam.titel").replace(
        "legacySchluessel: []",
        'legacySchluessel: ["gemeinsam.titel"]',
      ),
    });
    const text = fehler.join("\n");
    expect(text).toContain('"gemeinsam.titel"');
    expect(text).toContain("./texte/eins.ts");
    expect(text).toContain("./texte/zwei.ts");
  });

  it("K2.6 · ein Altname ohne Eintrag in legacySchluessel", () => {
    const fehler = befunde({ "probe.ts": sauber("probe", "alt.name") });
    const text = fehler.join("\n");
    expect(text).toContain("./texte/probe.ts");
    expect(text).toContain('"alt.name"');
    expect(text).toContain("legacySchluessel");
  });

  it("K2.7 · ein Altname, der in i18n.ts NICHT entfernt wurde", () => {
    const fehler = befunde(
      {
        "probe.ts": sauber("probe", "basis.vorhanden").replace(
          "legacySchluessel: []",
          'legacySchluessel: ["basis.vorhanden"]',
        ),
      },
      ['"basis.vorhanden": "A"'],
    );
    const text = fehler.join("\n");
    expect(text).toContain("./texte/probe.ts");
    expect(text).toContain('"basis.vorhanden"');
    expect(text).toContain("Grundbestand");
  });

  it("K2.8 · ein Eintrag in legacySchluessel, den das Modul gar nicht führt", () => {
    const fehler = befunde({
      "probe.ts": sauber("probe").replace(
        "legacySchluessel: []",
        'legacySchluessel: ["tot.eintrag"]',
      ),
    });
    expect(fehler.join("\n")).toContain('legacySchluessel nennt "tot.eintrag"');
  });

  it("K2.9 · eine Datei ohne Standardexport und eine mit benutztem Wertimport", () => {
    const ohne = befunde({ "probe.ts": 'export const texte = { praefix: "probe." };\n' });
    expect(ohne.join("\n")).toContain("kein Standardexport");

    // BENUTZT, nicht nur geschrieben — und das ist eine Messung, kein Detail: ein UNGENUTZTER
    // Wertimport wird von `ts.transpileModule` restlos entfernt (genau wie `import type`), es
    // entsteht gar kein `require`. Der erste Anlauf dieses Falls war deshalb grün, ohne etwas
    // geprüft zu haben. Gefährlich ist nur der Import, dessen Wert im Modul vorkommt — der einzige,
    // der zur Laufzeit wirklich etwas laden würde.
    const mitImport = befunde({
      "probe.ts": `import { etwas } from "./anderswo";\n${sauber("probe").replace('"DE"', "etwas")}`,
    });
    expect(mitImport.join("\n")).toContain("reine Datenmodule");
    expect(mitImport.join("\n")).toContain("./anderswo");
  });
});

describe("JOB 4367 · K3 — eine fehlende Sprache ist ein Fehler, kein Rückfall auf Deutsch", () => {
  it("K3.1 · fehlt der Schlüssel in nl, wird er mit Namen und Sprache gemeldet", () => {
    const fehler = befunde({
      "probe.ts": sauber("probe").replace('  nl: { "probe.titel": "NL" },', "  nl: {},"),
    });
    const text = fehler.join("\n");
    expect(text).toContain("./texte/probe.ts");
    expect(text).toContain('"probe.titel"');
    expect(text).toContain('Sprache "nl"');
    expect(text, "en darf dabei nicht mitgemeldet werden — es ist ja da").not.toContain(
      'Sprache "en"',
    );
  });

  it("K3.2 · fehlt der Schlüssel in de, aber nicht in en, wird auch das gemeldet", () => {
    const fehler = befunde({
      "probe.ts": sauber("probe").replace('  de: { "probe.titel": "DE" },', "  de: {},"),
    });
    const text = fehler.join("\n");
    expect(text).toContain('"probe.titel"');
    expect(text).toContain('fehlt aber in der Sprache "de"');
  });

  it("K3.3 · fehlt eine ganze Sprache, wird sie benannt", () => {
    const fehler = befunde({
      "probe.ts": sauber("probe").replace('  nl: { "probe.titel": "NL" },', ""),
    });
    expect(fehler.join("\n")).toContain("nl fehlt oder ist kein Objekt aus Zeichenketten");
  });
});

describe("JOB 4367 · K2 — dieselbe Prüfung stoppt den Produktbuild", () => {
  /** Das echte Plugin, an eine Wurzel gebunden und ausgelöst — genau wie Vite es tut. */
  function fahrePlugin(wurzel: string): void {
    const plugin = textmodulVertrag();
    expect(plugin.name).toBe("textmodul-vertrag");
    expect(plugin.apply, "im Entwicklungsserver soll der Vertrag nicht abbrechen").toBe("build");
    plugin.configResolved({ root: wurzel });
    plugin.buildStart();
  }

  it("K2.10 · am echten Produktbaum läuft der Build durch", () => {
    expect(() => fahrePlugin(repoPfad("apps/web"))).not.toThrow();
  });

  it("K2.13 · vite.config.ts trägt das Plugin wirklich ein", () => {
    // Die Fälle darüber führen die Fabrik aus. Dass Vite sie überhaupt ruft, hängt an EINER Zeile
    // in `vite.config.ts` — ohne diesen Fall könnte sie verschwinden, ohne dass etwas rot wird.
    const konfiguration = readFileSync(repoPfad("apps/web/vite.config.ts"), "utf8");
    expect(konfiguration).toContain('from "./src/texte/intern/sammeln"');
    expect(konfiguration).toMatch(/plugins:\s*\[[^\]]*textmodulVertrag\(\)/);
  });

  it("K2.11 · ein doppelter Schlüssel bricht den Build ab — mit Schlüsselname und Modul", () => {
    const wurzel = buehne({
      "eins.ts": sauber("eins", "gemeinsam.titel").replace(
        "legacySchluessel: []",
        'legacySchluessel: ["gemeinsam.titel"]',
      ),
      "zwei.ts": sauber("zwei", "gemeinsam.titel").replace(
        "legacySchluessel: []",
        'legacySchluessel: ["gemeinsam.titel"]',
      ),
    });
    expect(() => fahrePlugin(wurzel)).toThrow(/gemeinsam\.titel[\s\S]*zwei\.ts/);
  });

  it("K2.12 · eine fehlende Sprache bricht den Build ab — mit Schlüsselname und Sprache", () => {
    const wurzel = buehne({
      "probe.ts": sauber("probe").replace('  nl: { "probe.titel": "NL" },', "  nl: {},"),
    });
    expect(() => fahrePlugin(wurzel)).toThrow(/probe\.titel.*Sprache "nl"/);
  });
});
