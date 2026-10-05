// ================================================================================================
// QUELLENÄNDERUNGEN (aufnahme:20260928) · NACHARBEIT 6 — DIE EIGENEN EXPORTE HABEN PRODUKTAUFRUFER.
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT. `tests/capture/aufrufer-waechter.test.ts` (A1) ist am integrierten
// Hauptstand 4064f176 rot — wegen sieben Exporten, die dieser Auftrag weder angelegt noch berührt
// hat (`captureAdvancedFields.ts`, `wordAddin.ts`, `ko-routes.ts::ohneImportHerkunft`,
// `management/horizon.ts`, `management/profiles.ts`). Der globale Wächter bleibt unverändert und
// rot; er ist nur aus der AUFTRAGS-Prüfauswahl genommen. Damit die Exporte DIESES Auftrags nicht
// ungeprüft bleiben, hält dieser Fall dieselbe Zusage eng für sie fest: jeder ist an der Stelle, an
// der er wirken soll, wirklich gerufen — gelesen aus dem Quelltext, nicht behauptet.
//
// GEGENPROBE: in `GesamtanweisungSeite.tsx` den Aufruf `useFassungUebernehmen(anweisungId)`
// entfernen → der zugehörige Fall wird rot.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DEFINITIONEN = {
  service: "services/knowledge-object/src/gesamtanweisung-service.ts",
  typen: "services/knowledge-object/src/gesamtanweisung-types.ts",
  hooks: "apps/web/src/components/gesamtanweisung/hooks.ts",
  bildbreite: "apps/web/src/lib/imageResize.ts",
} as const;

/** [Symbol, Datei der Definition, Datei des Produktaufrufers, Muster des Aufrufs] */
const ZUSAGEN: readonly (readonly [string, string, string, RegExp])[] = [
  [
    "mitUebernommenerFassung",
    DEFINITIONEN.service,
    DEFINITIONEN.service,
    /=\s*mitUebernommenerFassung\(/,
  ],
  [
    "UEBERWACHUNG_NICHT_EINGERICHTET",
    DEFINITIONEN.typen,
    DEFINITIONEN.service,
    /ueberwachung:\s*UEBERWACHUNG_NICHT_EINGERICHTET/,
  ],
  [
    "useFassungUebernehmen",
    DEFINITIONEN.hooks,
    "apps/web/src/components/gesamtanweisung/GesamtanweisungSeite.tsx",
    /=\s*useFassungUebernehmen\(anweisungId\)/,
  ],
  [
    "imageWidthPercent",
    DEFINITIONEN.bildbreite,
    "apps/web/src/components/RichTextEditor.tsx",
    /imageWidthPercent\(selectedImageWidth\)/,
  ],
];

describe("Nacharbeit 6 · jeder Export dieses Auftrags hat einen Produktaufrufer", () => {
  for (const [symbol, definition, aufrufer, muster] of ZUSAGEN) {
    it(`${symbol} ist in ${aufrufer} gerufen`, () => {
      expect(readFileSync(definition, "utf8")).toMatch(
        new RegExp(`export (async )?(function|const) ${symbol}\\b`),
      );
      expect(readFileSync(aufrufer, "utf8")).toMatch(muster);
    });
  }

  it("die neue Tür ist im Webkatalog adressiert und vom Hook benutzt", () => {
    expect(readFileSync("apps/web/src/api/endpoints.ts", "utf8")).toMatch(
      /uebernehmen: \(id: string, version: number, bausteinId: string, aufVersion: number\)/,
    );
    expect(readFileSync(DEFINITIONEN.hooks, "utf8")).toMatch(
      /endpoints\.gesamtanweisung\.uebernehmen\(/,
    );
  });

  it("imageWidthPercent steht NICHT mehr als „bewusst ohne Aufrufer“ im Wächter (A3)", () => {
    const waechter = readFileSync("tests/capture/aufrufer-waechter.test.ts", "utf8");
    expect(waechter).not.toMatch(
      /schluessel: "apps\/web\/src\/lib\/imageResize\.ts::imageWidthPercent"/,
    );
  });
});
