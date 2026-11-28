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
//
//   T · DIE TEXTMODULE (R-0801, Gesamtcheck R-1329 Nacharbeit 49): ihre Blöcke en und nl verlassen
//       die Module und kommen im Paket `i18n.textmodule.<sprache>.js` zurück — vollständig, in
//       Glob-Reihenfolge, ohne verrutschte Zeile; direkt importierte Module bleiben ganz, und die
//       Startprüfung nimmt nur LEERE Blöcke der nachgeladenen Sprachen hin.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInstance } from "../../apps/web/node_modules/i18next";
import { fachtexteLader } from "../../apps/web/src/lib/fachtexte";
import { sprachNachlader } from "../../apps/web/src/lib/sprachNachlader";
import {
  type Textmodul,
  basisSchluesselAusQuelltext,
  pruefeTextmodule,
} from "../../apps/web/src/texte/intern/pruefung";
import {
  direktGenutzteTextmodule,
  fachtexteLaderAus,
  fachtexteMitSeite,
  nenntPraefix,
  sprachpaketAus,
  sprachpaketeNachladen,
  statischeHuelle,
  textmodulBlock,
  textmodulOhneNachgeladene,
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

const TEXTE = join(WEB, "src", "texte");
const TEXTPAKET_ID = {
  en: join(WEB, "src", "i18n.textmodule.en.js"),
  nl: join(WEB, "src", "i18n.textmodule.nl.js"),
} as const;
/** Dieselben echten Textmodule wie im Produkt, unter dessen relativen Modulnamen. */
async function echteTextmodule(): Promise<Record<string, Textmodul>> {
  const laden = import.meta.glob<Textmodul>("../../apps/web/src/texte/*.ts", { import: "default" });
  const module: Record<string, Textmodul> = {};
  for (const [pfad, ladeModul] of Object.entries(laden)) {
    module[pfad.replace("../../apps/web/src/", "./")] = await ladeModul();
  }
  return module;
}

describe("T · die Textmodule verlassen den Eintritt — ohne Textverlust", () => {
  it("T1 ein Modul verliert en und nl, behält de, keine Zeile verrutscht", () => {
    // Gesamtcheck R-1329 (Nacharbeit 58): bis hierher stand hier `hilfefaq`. Seit der Hilfeknopf
    // nachgeladen wird, nennt die Eintritts-Hülle dessen Texte nicht mehr; das Modul gibt damit auch
    // seinen deutschen Block ab (Block F). T1 nimmt deshalb das Modul, das die Hülle sicher trägt:
    // die Navigation des Kopfbands — und prüft dasselbe wie vorher, wörtlich.
    const fachtexte = fachtexteMitSeite(join(WEB, "src"));
    expect(fachtexte, "die Navigation bleibt im Eintritt").not.toContain("navigation");
    const pfad = join(TEXTE, "navigation.ts");
    const quelle = readFileSync(pfad, "utf8");
    const p = plugin();
    const ergebnis = p.transform(quelle, pfad);
    expect(ergebnis, "das Plugin hat das Textmodul nicht angefasst").not.toBeNull();
    const code = ergebnis?.code ?? "";
    expect(code.split("\n").length).toBe(quelle.split("\n").length);
    const de = textmodulBlock("de", quelle, "navigation.ts").rumpf;
    expect(de.length, "Vorbedingung: das Modul trägt deutsche Texte").toBeGreaterThan(0);
    expect(code, "der deutsche Block steht Zeichen für Zeichen da").toContain(de);
    expect(code).not.toContain(textmodulBlock("en", quelle, "navigation.ts").rumpf);
    expect(code).toContain("  en: {},\n");
    expect(code).toContain("  nl: {},\n");
  });

  it("T2 das Paket je Sprache trägt GENAU die Blöcke aller beschnittenen Module", async () => {
    const module = await echteTextmodule();
    const ganz = direktGenutzteTextmodule(join(WEB, "src"));
    expect([...ganz], "auth/maskenfehler.ts liest anmeldefehler in allen Sprachen").toContain(
      "anmeldefehler",
    );
    for (const sprache of ["en", "nl"] as const) {
      const code = plugin().load(TEXTPAKET_ID[sprache]);
      expect(code, `kein Textmodulpaket für ${sprache}`).not.toBeNull();
      const ausdruck = (code ?? "").replace(/^export default /, "");
      const wert = new Function(`return ${ausdruck}`)() as Record<string, string>;
      const erwartet = Object.assign(
        {},
        ...Object.keys(module)
          .sort()
          .filter((pfad) => !ganz.has(pfad.slice("./texte/".length, -".ts".length)))
          .map((pfad) => module[pfad]?.[sprache] ?? {}),
      ) as Record<string, string>;
      expect(Object.keys(erwartet).length, sprache).toBeGreaterThan(1000);
      expect(wert, `${sprache}: Paket weicht von den Quellen ab`).toEqual(erwartet);
      // Das ganz gebliebene Modul steht nicht doppelt im Paket.
      for (const schluessel of Object.keys(module["./texte/anmeldefehler.ts"]?.[sprache] ?? {})) {
        expect(wert).not.toHaveProperty([schluessel]);
      }
    }
  });

  it("T3 direkt importierte Module bleiben ganz; i18n.ts lädt beide Pakete gemeinsam", () => {
    const pfad = join(TEXTE, "anmeldefehler.ts");
    expect(plugin().transform(readFileSync(pfad, "utf8"), pfad)).toBeNull();
    const eintritt = geschnitten();
    expect(eintritt).toContain('const TEXTMODULE_NACHGELADEN: readonly string[] = ["en", "nl"];');
    expect(eintritt).toContain(
      'Promise.all([import("./i18n.sprachpaket.en.js"), import("./i18n.textmodule.en.js")])',
    );
    expect(eintritt).toContain(
      'Promise.all([import("./i18n.sprachpaket.nl.js"), import("./i18n.textmodule.nl.js")])',
    );
    const p = plugin();
    expect(p.resolveId("./i18n.textmodule.en.js", I18N)).toBe(TEXTPAKET_ID.en);
    expect(p.resolveId("./i18n.textmodule.en.js", join(WEB, "src", "main.tsx"))).toBeNull();
  });

  it("T4 die Startprüfung nimmt nur LEERE nachgeladene Blöcke hin — alles andere bleibt Befund", async () => {
    const module = await echteTextmodule();
    const ganz = direktGenutzteTextmodule(join(WEB, "src"));
    const beschnitten: Record<string, unknown> = {};
    for (const [pfad, m] of Object.entries(module)) {
      const name = pfad.slice("./texte/".length, -".ts".length);
      beschnitten[pfad] = ganz.has(name) ? m : { ...m, en: {}, nl: {} };
    }
    const sprachen = ["de", "en", "nl"];
    const leer = new Set<string>();
    expect(pruefeTextmodule(beschnitten, leer, sprachen, ["en", "nl"])).toEqual([]);
    // Ohne die Angabe wäre jeder leere Block ein Befund — die Angabe ist, was hier trägt.
    expect(pruefeTextmodule(beschnitten, leer, sprachen).length).toBeGreaterThan(100);
    // Ein NICHT leerer, unvollständiger Block bleibt Befund, auch wenn die Sprache nachgeladen wird.
    const halb = {
      "./texte/probe.ts": {
        praefix: "probe.",
        legacySchluessel: [],
        de: { "probe.a": "A", "probe.b": "B" },
        en: { "probe.a": "A" },
        nl: {},
      },
    };
    expect(pruefeTextmodule(halb, leer, sprachen, ["en", "nl"]).join("\n")).toContain(
      'Schlüssel "probe.b" fehlt in der Sprache "en"',
    );
  });

  it("T5 FAIL-CLOSED: ohne Blockkopf oder -schluss bricht der Bau ab", () => {
    const quelle = readFileSync(join(TEXTE, "hilfefaq.ts"), "utf8");
    const ohneKopf = quelle.replace("\n  nl: {\n", "\n  nl:{\n");
    expect(ohneKopf).not.toBe(quelle);
    expect(() => textmodulOhneNachgeladene(ohneKopf, "probe.ts")).toThrow(
      /Anker[\s\S]*Bau abgebrochen/,
    );
    const ohneSchluss = 'export default {\n  en: {\n    "a": "b",\n} satisfies X;\n';
    expect(() => textmodulBlock("en", ohneSchluss, "probe.ts")).toThrow(/Bau abgebrochen/);
    expect(textmodulBlock("en", "x\n  en: {\n  },\n", "probe.ts").rumpf).toBe("");
  });
});

// ================================================================================================
// F · DIE DEUTSCHEN FACHTEXTE (R-0801, Gesamtcheck R-1329 Nacharbeit 58)
// ================================================================================================
// Module, deren Texte die statische Eintritts-Hülle nicht nennt, geben im Bau auch ihren deutschen
// Block ab; er kommt im Paket `i18n.fachtexte.de.js`, und Seiten wie nachgeladene Flächen warten
// darauf (`lib/fachtexte.ts`). Am gebauten Bündel misst der Block DECKEL in
// `eintritt-ohne-seiten.test.ts` dieselbe Zusage noch einmal.
const SRC = join(WEB, "src");
const LADER = join(SRC, "lib", "fachtexte.ts");
const FACHPAKET_ID = join(SRC, "i18n.fachtexte.de.js");

describe("F · die deutschen Fachtexte kommen mit ihrer Fläche", () => {
  it("F1 die Erhebung der Hülle folgt statischen Importen und keinem import()", () => {
    const huelle = statischeHuelle(SRC);
    // Kalibrierung in beide Richtungen: was die Hülle sicher trägt, und was sicher nachgeladen wird.
    for (const drin of ["main.tsx", "App.tsx", "routes.tsx", "auth/AuthScreens.tsx", "i18n.ts"]) {
      expect(huelle.has(join(SRC, drin)), `${drin} gehört zur Hülle`).toBe(true);
    }
    for (const draussen of [
      "shell/AppShell.tsx",
      "kiosk/Kiosk.tsx",
      "pages/Spaces.tsx",
      "pages/Admin.tsx",
      "components/KlaraAssistant.tsx",
      "components/klara-vorschau/KlaraVorschau.tsx",
      "tutorial/TutorialBereich.tsx",
    ]) {
      expect(huelle.has(join(SRC, draussen)), `${draussen} wird nachgeladen`).toBe(false);
    }
  });

  it("F2 ausgewählt wird nur, was die Hülle nicht nennt — Altnamen und Direktimporte bleiben", () => {
    const fachtexte = fachtexteMitSeite(SRC);
    // Kalibrierung: die Wissenskennzahlen nennt allein die Admin-Seite `pages/Analytics.tsx` (über
    // `components/Wissenskennzahlen.tsx` und `lib/wissenskennzahlen.ts`) — nachgeladen, also Fachtext.
    // Wie viel die Auswahl in Bytes ausmacht, misst der Block DECKEL am gebauten Bündel.
    expect(fachtexte, "die Wissenskennzahlen kommen mit ihrer Seite").toContain("wkz");
    expect(fachtexte).toEqual([...fachtexte].sort());
    const genannt = [...statischeHuelle(SRC)]
      .filter(([datei]) => !datei.startsWith(join(SRC, "texte")))
      .filter(([datei]) => !datei.startsWith(join(SRC, "woerterbuch")))
      .filter(([datei]) => datei !== join(SRC, "lib", "lesevariante.ts"))
      .map(([, text]) => text)
      .join("\n");
    for (const name of fachtexte) {
      expect(nenntPraefix(genannt, `${name}.`), `die Hülle nennt ${name}.`).toBe(false);
      const quelle = readFileSync(join(TEXTE, `${name}.ts`), "utf8");
      expect(quelle, `${name} trägt Altnamen`).toMatch(/\blegacySchluessel:\s*\[\s*\]/);
    }
    expect(fachtexte, "direkt importiert, bleibt ganz").not.toContain("anmeldefehler");
    expect(fachtexte, "trägt Altnamen, bleibt im Eintritt").not.toContain("vorlagen");
    // Die Gegenrichtung: die Nennung wird erkannt — in jeder der drei Schreibweisen.
    expect(nenntPraefix('t("wkz.titel")', "wkz.")).toBe(true);
    expect(nenntPraefix("t('wkz.titel')", "wkz.")).toBe(true);
    expect(nenntPraefix("t(`wkz.${x}`)", "wkz.")).toBe(true);
    expect(nenntPraefix("const wkz = x.wkz.titel;", "wkz.")).toBe(false);
  });

  it("F3 ein ausgewähltes Modul verliert auch de; das Paket trägt genau diese Blöcke", async () => {
    const fachtexte = fachtexteMitSeite(SRC);
    const name = fachtexte[0] as string;
    const pfad = join(TEXTE, `${name}.ts`);
    const quelle = readFileSync(pfad, "utf8");
    const code = plugin().transform(quelle, pfad)?.code ?? "";
    expect(code.split("\n").length, "keine Zeile verrutscht").toBe(quelle.split("\n").length);
    for (const sprache of ["de", "en", "nl"]) {
      expect(code).toContain(`  ${sprache}: {},\n`);
    }
    const module = await echteTextmodule();
    const paket = plugin().load(FACHPAKET_ID);
    expect(paket, "kein Fachtextpaket").not.toBeNull();
    const ausdruck = (paket ?? "").replace(/^export default /, "");
    const wert = new Function(`return ${ausdruck}`)() as Record<string, string>;
    const erwartet = Object.assign(
      {},
      ...fachtexte.map((n) => module[`./texte/${n}.ts`]?.de ?? {}),
    ) as Record<string, string>;
    expect(Object.keys(erwartet), "Vorbedingung: das Paket trägt die Wissenskennzahlen").toContain(
      "wkz.titel",
    );
    expect(wert, "das Paket weicht von den deutschen Blöcken der Quellen ab").toEqual(erwartet);
    // Ein Modul, das im Eintritt bleibt, steht nicht im Paket.
    for (const schluessel of Object.keys(module["./texte/navigation.ts"]?.de ?? {})) {
      expect(wert).not.toHaveProperty([schluessel]);
    }
  });

  it("F4 der Lader: Anker fail-closed, Paket nur von lib/fachtexte.ts aus erreichbar", () => {
    const quelle = readFileSync(LADER, "utf8");
    const code = plugin().transform(quelle, LADER)?.code ?? "";
    expect(code).toContain(
      'const FACHTEXTE_DE: { laden?: () => Promise<Fachtextpaket> } = { laden: () => import("../i18n.fachtexte.de.js") };',
    );
    expect(code.split("\n").length).toBe(quelle.split("\n").length);
    expect(fachtexteLaderAus(quelle)).toBe(code);
    expect(() => fachtexteLaderAus(quelle.replace("= {};", "= { };"))).toThrow(
      /Anker[\s\S]*Bau abgebrochen/,
    );
    const p = plugin();
    expect(p.resolveId("../i18n.fachtexte.de.js", LADER)).toBe(FACHPAKET_ID);
    expect(p.resolveId("../i18n.fachtexte.de.js", I18N)).toBeNull();
    expect(p.resolveId("./i18n.fachtexte.de.js", join(SRC, "main.tsx"))).toBeNull();
  });

  it("F5 Warten: Seiten scheitern mit dem Paket, Flächen nicht; ein Fehlschlag wird wiederholt", async () => {
    const gelegt: Record<string, string>[] = [];
    const ziel = {
      addResourceBundle: (
        _sprache: string,
        _ns: string,
        texte: Record<string, string>,
        _tief: boolean,
        ueberschreiben: boolean,
      ) => {
        expect(ueberschreiben, "gepflegte Texte bleiben stehen").toBe(false);
        gelegt.push(texte);
      },
    };
    // Ohne Lader (Quelltext): das Stück kommt unverändert, ohne jedes Warten.
    const ohne = fachtexteLader(undefined, ziel);
    const stueck = Promise.resolve("seite");
    expect(ohne(stueck)).toBe(stueck);

    let versuche = 0;
    const lader = fachtexteLader(() => {
      versuche += 1;
      return versuche === 1
        ? Promise.reject(new Error("Paket fehlt"))
        : Promise.resolve({ default: { "probe.a": "A" } });
    }, ziel);
    await expect(lader(Promise.resolve("seite"))).rejects.toThrow("Paket fehlt");
    await expect(lader(Promise.resolve("flaeche"), "flaeche")).resolves.toBe("flaeche");
    expect(gelegt).toEqual([{ "probe.a": "A" }]);
    expect(versuche).toBe(2);
    // Danach ist das Paket da: kein weiterer Abruf, das Stück kommt durch.
    await expect(lader(Promise.resolve("seite"))).resolves.toBe("seite");
    expect(versuche).toBe(2);
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
