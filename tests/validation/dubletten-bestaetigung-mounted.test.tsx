// @vitest-environment jsdom
// ================================================================================================
// R-0247 — OFFENE DUBLETTE: DIE PRÜFKARTE VERLANGT VOR DEM VALIDIEREN EINE BESTÄTIGUNG.
// ================================================================================================
//
// Pedis Entscheidung 73b53301 (weiche Sperre): liegt zu einem Wissensobjekt eine offene,
// unentschiedene Dublette vor, wird nur validiert, wenn die prüfende Person ausdrücklich bestätigt,
// dass sie die Dublette gesehen hat. Keine harte Sperre, keine Auflösung der Dublette.
//
// Gemountet wird die echte Seite (`Validation.tsx`) über die Kulisse aus `tests/validierung-stufe`:
// gemockt ist nur der Endpunkt, die Kette `endpoints.duplicates.list` → react-query →
// `brauchtDublettenBestaetigung` → Karte ist echt. Die Zeilen sind eingestuft (`intern`), damit
// die Stufenfrage den gemessenen Ablauf nicht überlagert.
//
//   D1 (K1) ohne offene Dublette: ein Klick, genau ein `rate` OHNE Kennzeichen — wie bisher.
//   D2 (K2) offene Dublette: „Freigeben" zeigt die Bestätigung und schickt NICHTS.
//   D3 (K2) Abbrechen schickt nichts; erst „Dublette gesehen" validiert, mit Kennzeichen.
//   D4 (K2) Administratorweg: dieselbe Bestätigung im Menüblatt, `admin-validate` mit Kennzeichen.
//   D5 (K2/K3) der Server lehnt ab (Dublette, die die Karte nicht kannte) → Bestätigung erscheint.
//   D6 (K4) eine geschlossene Dublette fragt nichts.
//   D7 (K5) die drei Texte stehen in de/en/nl.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "controller" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../validierung-stufe/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).toastMock(o as never),
);

import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import {
  type Brett,
  de,
  finde,
  klick,
  knopfMitText,
  mounteBrett,
  paar,
  putFolge,
  zeile,
} from "../validierung-stufe/kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "controller";
});
afterEach(() => brett?.abbauen());

const HINWEIS = '[data-testid="pruefen-doppelhinweis"]';
const FRAGE = '[data-testid="pruefen-dublettenfrage"]';
const JA = '[data-testid="pruefen-dublettenfrage-ja"]';
const ABBRECHEN = '[data-testid="pruefen-dublettenfrage-abbrechen"]';
const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';

const eingestuft = () => zeile({ confidentiality: "intern", confidentialityProvenance: "ko" });

describe("R-0247 · D1 (K1): ohne offene Dublette ändert sich am Validieren nichts", () => {
  it("leere Dublettenliste → keine Frage, genau ein `rate` ohne Kennzeichen", async () => {
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [] });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });

  it("eine offene Dublette ZWEIER ANDERER Objekte fragt hier nichts", async () => {
    brett = await mounteBrett({
      zeilen: [eingestuft()],
      duplikate: [paar({ koA: "k7", koB: "k8" })],
    });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });
});

describe("R-0247 · D2/D3 (K2): offene Dublette → Bestätigung vor dem Validieren", () => {
  it("„Freigeben“ zeigt die Bestätigung an der Prüfkarte und schickt nichts", async () => {
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [paar()] });
    expect(finde(brett.container, HINWEIS), "Vorbedingung: Doppelhinweis steht").not.toBeNull();

    await klick(finde(brett.container, FREIGEBEN));

    const frage = finde(brett.container, FRAGE);
    expect(frage, "die Bestätigung fehlt").not.toBeNull();
    expect(frage?.textContent).toContain(de("val.doppel.bestaetigung.frage"));
    expect(finde(brett.container, '[data-testid="pruefen-karte"]')?.contains(frage as Node)).toBe(
      true,
    );
    expect(putFolge(), "ohne Bestätigung wurde validiert").toEqual([]);
  });

  it("Abbrechen schickt nichts — und ein erneuter Klick fragt wieder", async () => {
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [paar()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, ABBRECHEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([]);

    await klick(finde(brett.container, FREIGEBEN));
    expect(finde(brett.container, FRAGE)).not.toBeNull();
    expect(putFolge()).toEqual([]);
  });

  it("„Dublette gesehen“ validiert — genau ein `rate` MIT Kennzeichen; die Dublette bleibt", async () => {
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [paar()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, JA));

    // Genau dieser eine Aufruf: keine weitere Aktion, also auch keine Auflösung der Dublette.
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up", duplicateAcknowledged: true }]);
  });

  it("ohne eingestufte Stufe folgt nach der Bestätigung die Stufenfrage — erst dann wird geschickt", async () => {
    brett = await mounteBrett({ zeilen: [zeile()], duplikate: [paar()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, JA));

    expect(finde(brett.container, '[data-testid="pruefen-stufenfrage"]')).not.toBeNull();
    expect(putFolge()).toEqual([]);

    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]'));
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up", duplicateAcknowledged: true }]);
  });
});

describe("R-0247 · D4 (K2): der Administratorweg fragt dieselbe Bestätigung", () => {
  it("„Als wahr kennzeichnen“ → Ja → Bestätigung → `admin-validate` mit Kennzeichen", async () => {
    stand.rolle = "admin";
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [paar()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(brett.container, de("val.markTrue")));
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));

    expect(finde(brett.container, FRAGE), "die Bestätigung fehlt im Menüblatt").not.toBeNull();
    expect(putFolge()).toEqual([]);

    await klick(finde(brett.container, JA));
    expect(putFolge()).toEqual([{ action: "admin-validate", duplicateAcknowledged: true }]);
  });
});

describe("R-0247 · D5 (K2/K3): der Server lehnt ohne Kennzeichen ab", () => {
  it("409 DUPLICATE_ACK_REQUIRED → die Karte stellt die Bestätigung; danach mit Kennzeichen", async () => {
    brett = await mounteBrett({ zeilen: [eingestuft()], duplikate: [] });
    (endpoints.ko.act as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError(409, "DUPLICATE_ACK_REQUIRED", "Offene Dublette."),
    );
    await klick(finde(brett.container, FREIGEBEN));

    expect(
      finde(brett.container, FRAGE),
      "nach der Serverablehnung fehlt die Frage",
    ).not.toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();

    await klick(finde(brett.container, JA));
    expect(putFolge()).toEqual([
      { action: "rate", verdict: "up" },
      { action: "rate", verdict: "up", duplicateAcknowledged: true },
    ]);
  });
});

describe("R-0247 · D6 (K4): eine entschiedene (geschlossene) Dublette fragt nichts", () => {
  it("Status `geschlossen` → keine Bestätigung, `rate` ohne Kennzeichen", async () => {
    brett = await mounteBrett({
      zeilen: [eingestuft()],
      duplikate: [paar({ status: "geschlossen" })],
    });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });
});

describe("R-0247 · D7 (K5): die Texte stehen in de/en/nl", () => {
  const SCHLUESSEL = [
    "val.doppel.bestaetigung.frage",
    "val.doppel.bestaetigung.ja",
    "val.doppel.bestaetigung.abbrechen",
  ];
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: alle drei Schlüssel tragen einen eigenen Wortlaut`, () => {
      for (const key of SCHLUESSEL) {
        const text = i18n.getResource(sprache, "translation", key);
        expect(typeof text, `${sprache}/${key} fehlt`).toBe("string");
        expect(String(text).trim().length).toBeGreaterThan(0);
        expect(text).not.toBe(key);
      }
    });
  }
  it("en und nl sind keine Kopie des Deutschen", () => {
    const key = "val.doppel.bestaetigung.frage";
    const deText = i18n.getResource("de", "translation", key);
    expect(i18n.getResource("en", "translation", key)).not.toBe(deText);
    expect(i18n.getResource("nl", "translation", key)).not.toBe(deText);
  });
});
