import { expect, it } from "vitest";
import { pruefeTextmodule } from "../../apps/web/src/texte/intern/pruefung";

const PFAD = "./texte/probe.ts";

it("prüft große Sprachblöcke konstant oft und meldet fehlende Schlüssel exakt", () => {
  const schluessel = Array.from({ length: 2048 }, (_, i) => `probe.${String(i).padStart(4, "0")}`);
  const scans = { de: 0, en: 0, nl: 0 };
  const sprachmap = (text: string): Record<string, string> =>
    Object.fromEntries(schluessel.map((name) => [name, text]));
  const gezaehlt = (sprache: keyof typeof scans, werte: Record<string, string>) =>
    new Proxy(werte, {
      ownKeys(ziel) {
        scans[sprache] += 1;
        return Reflect.ownKeys(ziel);
      },
    });
  const en = sprachmap("EN");
  const nl = sprachmap("NL");
  delete en["probe.0007"];
  delete nl["probe.0011"];
  const modul = {
    praefix: "probe.",
    legacySchluessel: [],
    de: gezaehlt("de", sprachmap("DE")),
    en: gezaehlt("en", en),
    nl: gezaehlt("nl", nl),
  };

  expect(pruefeTextmodule({ [PFAD]: modul }, new Set<string>())).toEqual([
    `${PFAD}: Schlüssel "probe.0007" fehlt in der Sprache "en".`,
    `${PFAD}: Schlüssel "probe.0011" fehlt in der Sprache "nl".`,
  ]);
  for (const sprache of ["de", "en", "nl"] as const) {
    expect(scans[sprache], sprache).toBeGreaterThan(0);
    expect(scans[sprache], sprache).toBeLessThanOrEqual(4);
  }
});

it("prüft Modulinstanzen erneut mit Zusatzsprache und doppelter Sprachreihenfolge", () => {
  const sprachmap = (): Record<string, unknown> => ({ "probe.titel": "Text" });
  const modul = {
    praefix: "probe.",
    legacySchluessel: [],
    de: sprachmap(),
    en: sprachmap(),
    nl: sprachmap(),
    fr: sprachmap(),
  };
  const module = { [PFAD]: modul };
  const sprachen = ["fr", "nl", "en", "nl", "de"];
  expect(pruefeTextmodule(module, new Set<string>(), sprachen)).toEqual([]);

  delete modul.fr["probe.titel"];
  delete modul.nl["probe.titel"];
  modul.en["probe.zusatz"] = "Zusatz";
  expect(pruefeTextmodule(module, new Set<string>(), sprachen)).toEqual([
    `${PFAD}: Schlüssel "probe.titel" fehlt in der Sprache "fr".`,
    `${PFAD}: Schlüssel "probe.titel" fehlt in der Sprache "nl".`,
    `${PFAD}: Schlüssel "probe.titel" fehlt in der Sprache "nl".`,
    `${PFAD}: Schlüssel "probe.zusatz" steht in "en", fehlt aber in der Sprache "de".`,
  ]);

  modul.fr["probe.titel"] = 17;
  modul.nl["probe.titel"] = false;
  expect(pruefeTextmodule(module, new Set<string>(), sprachen)).toEqual([
    `${PFAD}: fr fehlt oder ist kein Objekt aus Zeichenketten.`,
    `${PFAD}: nl fehlt oder ist kein Objekt aus Zeichenketten.`,
    `${PFAD}: nl fehlt oder ist kein Objekt aus Zeichenketten.`,
  ]);

  modul.fr["probe.titel"] = "FR";
  modul.nl["probe.titel"] = "NL";
  delete modul.en["probe.zusatz"];
  expect(pruefeTextmodule(module, new Set<string>(), sprachen)).toEqual([]);
});
