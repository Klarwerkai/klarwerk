// ================================================================================================
// R-0801 · GEGENPROBE ZUM DECKEL: en UND nl VERLASSEN DEN EINTRITT — OHNE TEXTVERLUST.
// ================================================================================================
//
// Der Block DECKEL in `eintritt-ohne-seiten.test.ts` misst das gebaute Bündel. Er sagt, DASS die
// Sprachpakete außerhalb der Eintritts-Hülle liegen; er sagt nicht, dass dabei kein Text verloren
// ging und dass die Oberfläche die Pakete zur Laufzeit wirklich bekommt. Das prüft diese Datei:
//
//   S · DER SCHNITT, am echten `apps/web/src/i18n.ts` und mit GENAU DEM Plugin, das `vite.config.ts`
//       einträgt (`sprachpaketeNachladen`). Seit der I18N-AUFTEILUNG stehen die Blöcke in
//       `apps/web/src/woerterbuch/{de,en,nl}.ts`; das Plugin nimmt die Importe von en und nl aus
//       `i18n.ts`. Jeder Paketrumpf ist ein wörtlicher Ausschnitt SEINER Sprachdatei, trägt dieselben
//       Schlüssel wie Deutsch, und `i18n.ts` behält Zeile für Zeile seine Nummer. Fehlt ein Anker,
//       bricht das Plugin ab, statt still alles im Eintritt zu lassen.
//   N · DER NACHLADER (`lib/sprachNachlader.ts`) an einem echten i18next: Deutsch startet ohne
//       Warten, ein Wechsel stellt erst um, wenn das Paket da ist, ein Fehlschlag fällt auf Deutsch
//       zurück, statt abzubrechen.
//   Q · DER QUELLTEXT-STAND, wie ihn jeder Vitest-Lauf sieht: alle drei Sprachen liegen sofort vor.
//
// Diese Datei BAUT NICHT. Die Warnung im Kopf von `eintritt-ohne-seiten.test.ts` („bewusst keine
// zweite Testdatei", wegen `process.chdir` in `baue()`) betrifft sie deshalb nicht.
//
// NICHT GEPRÜFT, ehrlich benannt: das Nachladen in einem echten Browser über das Netz (Chromium,
// Netzwerk-Mitschnitt, Paket-404 nach einem Deploy). Das bleibt der offene Rest aus R-1530.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInstance } from "../../apps/web/node_modules/i18next";
import { sprachNachlader } from "../../apps/web/src/lib/sprachNachlader";
import { basisSchluesselAusQuelltext } from "../../apps/web/src/texte/intern/pruefung";
import {
  sprachpaketAus,
  sprachpaketeNachladen,
} from "../../apps/web/src/texte/intern/sprachpakete";

const WEB = resolve(__dirname, "..", "..", "apps", "web");
const I18N = join(WEB, "src", "i18n.ts");
const QUELLE = readFileSync(I18N, "utf8");
const SPRACHDATEI = {
  de: readFileSync(join(WEB, "src", "woerterbuch", "de.ts"), "utf8"),
  en: readFileSync(join(WEB, "src", "woerterbuch", "en.ts"), "utf8"),
  nl: readFileSync(join(WEB, "src", "woerterbuch", "nl.ts"), "utf8"),
} as const;
const IMPORT = {
  de: 'import { de } from "./woerterbuch/de";',
  en: 'import { en } from "./woerterbuch/en";',
  nl: 'import { nl } from "./woerterbuch/nl";',
} as const;
const PAKET_ID = {
  en: join(WEB, "src", "i18n.sprachpaket.en.js"),
  nl: join(WEB, "src", "i18n.sprachpaket.nl.js"),
} as const;

/** Das Plugin, wie Vite es nach `configResolved` in der Hand hat. */
function plugin(): ReturnType<typeof sprachpaketeNachladen> {
  const p = sprachpaketeNachladen();
  p.configResolved({ root: WEB });
  return p;
}

function geschnitten(quelle: string = QUELLE): string {
  const ergebnis = plugin().transform(quelle, I18N);
  if (ergebnis === null) {
    throw new Error("Das Plugin hat `i18n.ts` nicht angefasst — dann gibt es keinen Schnitt.");
  }
  return ergebnis.code;
}

function paket(sprache: "en" | "nl"): string {
  const p = plugin();
  p.transform(QUELLE, I18N);
  const code = p.load(PAKET_ID[sprache]);
  if (code === null) {
    throw new Error(`Das Plugin liefert kein Modul für ${sprache}.`);
  }
  return code;
}

describe("S · der Schnitt am echten i18n.ts", () => {
  it("S1 en und nl verlassen die Eintrittsdatei, Deutsch bleibt, keine Zeile verrutscht", () => {
    const eintritt = geschnitten();
    expect(QUELLE, "Vorbedingung: die Quelle importiert beide Sprachen").toContain(IMPORT.en);
    expect(QUELLE).toContain(IMPORT.nl);
    expect(eintritt).not.toContain(IMPORT.en);
    expect(eintritt).not.toContain(IMPORT.nl);
    expect(eintritt, "das deutsche Wörterbuch bleibt im Eintritt").toContain(IMPORT.de);
    expect(eintritt.split("\n").length, "Leerzeilen statt Block: die Zeilenzahl bleibt").toBe(
      QUELLE.split("\n").length,
    );
    expect(eintritt).toContain('import("./i18n.sprachpaket.en.js")');
    expect(eintritt).toContain('import("./i18n.sprachpaket.nl.js")');
    expect(eintritt).toContain(
      "const VORLIEGEND: Partial<Record<NachladbareSprache, Woerterbuch>> = {};",
    );
  });

  it("S2 jedes Paket ist ein wörtlicher Ausschnitt seiner Sprachdatei mit den Importen seiner Spreads", () => {
    for (const sprache of ["en", "nl"] as const) {
      const code = paket(sprache);
      const kopf = "export default {\n";
      const rumpf = code.slice(code.indexOf(kopf) + kopf.length, code.length - "};\n".length);
      expect(code.indexOf(kopf), `${sprache}: kein Standardexport`).toBeGreaterThanOrEqual(0);
      expect(code.endsWith("\n};\n"), `${sprache}: das Objekt ist nicht geschlossen`).toBe(true);
      expect(
        SPRACHDATEI[sprache].includes(`\nconst ${sprache}: typeof de = {\n${rumpf}};\n`),
        sprache,
      ).toBe(true);
      const spread = sprache === "en" ? "lesevarianteTexteEn" : "lesevarianteTexteNl";
      expect(code).toContain(`import { ${spread} } from "./lib/lesevariante";`);
    }
    expect(paket("en")).toContain('"ask.help.sources.title": "Why only sourced answers?"');
    expect(paket("nl")).toContain(
      '"ask.help.sources.title": "Waarom alleen onderbouwde antwoorden?"',
    );
  });

  it("S3 kein Schlüssel geht verloren: en, nl und der verbliebene Grundbestand sind gleich", () => {
    // Der Grundbestand, aus dem die Textmodul-Prüfung schöpft, ist das deutsche Wörterbuch — und
    // das bleibt im Eintritt (S1: sein Import steht nach dem Schnitt unverändert da).
    const deutsch = basisSchluesselAusQuelltext([SPRACHDATEI.de]);
    expect(deutsch.size, "keine Schlüssel gefunden").toBeGreaterThan(1000);
    expect(geschnitten().split(IMPORT.de)).toHaveLength(2);
    for (const sprache of ["en", "nl"] as const) {
      const schluessel = basisSchluesselAusQuelltext([paket(sprache)]);
      expect([...schluessel].sort(), `${sprache} trägt andere Schlüssel als de`).toEqual(
        [...deutsch].sort(),
      );
    }
  });

  it("S4 andere Module und fremde Importierer bleiben unberührt", () => {
    const p = plugin();
    expect(p.transform("export const x = 1;", join(WEB, "src", "main.tsx"))).toBeNull();
    expect(p.resolveId("./i18n.sprachpaket.en.js", join(WEB, "src", "main.tsx"))).toBeNull();
    expect(p.resolveId("./i18n.sprachpaket.en.js", I18N)).toBe(PAKET_ID.en);
    expect(p.load(join(WEB, "src", "main.tsx"))).toBeNull();
  });

  it("S5 ohne vorherigen Schnitt liest das Paketmodul die Quelle selbst — mit demselben Ergebnis", () => {
    expect(plugin().load(PAKET_ID.en)).toBe(paket("en"));
  });

  it("S6 FAIL-CLOSED: fehlt ein Anker, bricht der Bau ab, statt en/nl still im Eintritt zu lassen", () => {
    const ohneZeile = QUELLE.replace(
      "const VORLIEGEND: Partial<Record<NachladbareSprache, Woerterbuch>> = { en, nl };",
      "const VORLIEGEND = { en, nl };",
    );
    expect(ohneZeile).not.toBe(QUELLE);
    expect(() => geschnitten(ohneZeile)).toThrow(/Anker[\s\S]*Bau abgebrochen/);
    const ohneImport = QUELLE.replace(IMPORT.nl, 'import { nl } from "./woerterbuch/nl.ts";');
    expect(ohneImport).not.toBe(QUELLE);
    expect(() => geschnitten(ohneImport)).toThrow(/Anker[\s\S]*Bau abgebrochen/);
    // Und an der Sprachdatei selbst: ohne ihren Blockkopf entsteht kein (leeres) Paket.
    const ohneBlock = SPRACHDATEI.nl.replace("\nconst nl: typeof de = {\n", "\nconst nl = {\n");
    expect(ohneBlock).not.toBe(SPRACHDATEI.nl);
    expect(() => sprachpaketAus("nl", ohneBlock)).toThrow(/Anker[\s\S]*Bau abgebrochen/);
    expect(() => sprachpaketAus("nl", SPRACHDATEI.nl)).not.toThrow();
  });
});

describe("N · der Nachlader an einem echten i18next", () => {
  const DEUTSCH = { gruss: "Hallo" };

  it("N1 Deutsch startet ohne Warten und ohne Nachladen", () => {
    const gefragt: string[] = [];
    const i18n = createInstance();
    void i18n
      .use(
        sprachNachlader((sprache) => {
          gefragt.push(sprache);
          return undefined;
        }),
      )
      .init({
        lng: "de",
        fallbackLng: "de",
        partialBundledLanguages: true,
        resources: { de: { translation: DEUTSCH } },
      });
    // Synchron, ohne `await`: genau so baut `main.tsx` den ersten Bildschirm für Deutsch.
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t("gruss")).toBe("Hallo");
    expect(gefragt, "für die Startsprache darf nichts nachgeladen werden").toEqual([]);
  });

  it("N2 ein Wechsel stellt erst um, wenn das Paket da ist — vorher bleibt die bisherige Sprache", async () => {
    let freigeben: (texte: Record<string, string>) => void = () => {};
    const englisch = new Promise<Record<string, string>>((r) => {
      freigeben = r;
    });
    const i18n = createInstance();
    await i18n.use(sprachNachlader((sprache) => (sprache === "en" ? englisch : undefined))).init({
      lng: "de",
      fallbackLng: "de",
      partialBundledLanguages: true,
      resources: { de: { translation: DEUTSCH } },
    });
    const wechsel = i18n.changeLanguage("en");
    expect(i18n.language, "solange das Paket fehlt, bleibt die bisherige Sprache").toBe("de");
    expect(i18n.t("gruss")).toBe("Hallo");
    freigeben({ gruss: "Hello" });
    await wechsel;
    expect(i18n.language).toBe("en");
    expect(i18n.t("gruss")).toBe("Hello");
  });

  it("N3 scheitert das Nachladen, bleibt die Oberfläche lesbar — auf Deutsch, ohne Abbruch", async () => {
    const i18n = createInstance();
    await i18n
      .use(
        sprachNachlader((sprache) =>
          sprache === "nl" ? Promise.reject(new Error("Netz weg")) : undefined,
        ),
      )
      .init({
        lng: "de",
        fallbackLng: "de",
        partialBundledLanguages: true,
        resources: { de: { translation: DEUTSCH } },
      });
    await i18n.changeLanguage("nl");
    expect(i18n.t("gruss"), "Rückfall über `fallbackLng`").toBe("Hallo");
  });

  it("N4 eine fremde Sprache fragt nichts nach und bricht nichts", async () => {
    const i18n = createInstance();
    await i18n.use(sprachNachlader(() => undefined)).init({
      lng: "de",
      fallbackLng: "de",
      partialBundledLanguages: true,
      resources: { de: { translation: DEUTSCH } },
    });
    await i18n.changeLanguage("fr");
    expect(i18n.t("gruss")).toBe("Hallo");
  });
});

describe("Q · der Quelltext-Stand, wie ihn jeder Vitest-Lauf sieht", () => {
  it("Q1 alle drei Sprachen liegen sofort vor, und `sprachBereit` erfüllt sich", async () => {
    const modul = await import("../../apps/web/src/i18n");
    for (const sprache of ["de", "en", "nl"]) {
      const buendel = modul.default.getResourceBundle(sprache, "translation") as
        | Record<string, string>
        | undefined;
      const anzahl = Object.keys(buendel ?? {}).length;
      expect(anzahl, `${sprache} fehlt im Quelltext-Stand`).toBeGreaterThan(1000);
    }
    await expect(modul.sprachBereit).resolves.toBeDefined();
  });
});
