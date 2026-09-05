// @vitest-environment jsdom
// ================================================================================================
// JOB 3105 · UX-08 — DIESELBE ZUSAGE AUF ENGLISCH.
// ================================================================================================
//
// Die Abnahme verlangt sie ausdrücklich zweisprachig (`register/planung/UIUX-AUFTRAEGE-1.md:181`):
// „In DE/EN denselben Bereich über Menü, Schnellnavigation und Hilfe finden."
//
// DIE SUCHBEGRIFFE STEHEN NICHT IM TEST. Sie werden aus den ECHTEN EN-Ressourcen gelesen
// (`i18n.getFixedT("en")`). Ein abgeschriebenes „Review"/„Settings" wäre eine zweite Wahrheit über
// die Übersetzung — und bliebe grün, wenn jemand die EN-Zeile änderte und die Palette nicht.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-admin", name: "Ada", email: "a@x.de", role: "admin" })),
    },
  };
});

import { createElement } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  paletteOeffnen,
  paletteTippen,
  trefferPfade,
} from "./vorrichtung";

const en = i18n.getFixedT("en");

let stand: Stand | null = null;

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

afterAll(async () => {
  await i18n.changeLanguage("de");
});

async function paletteMitAdmin(): Promise<Stand> {
  const s = montiere(createElement(CommandPalette));
  stand = s;
  await beruhige();
  await paletteOeffnen();
  return s;
}

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  vi.clearAllMocks();
});

describe("JOB 3105 · UX-08 · dieselbe Zusage auf Englisch", () => {
  it("der angezeigte Name von /validierung führt zu /validierung", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, en("kopfband.pruefen"));
    expect(trefferPfade(s)).toEqual(["/validierung"]);
  });

  it("der angezeigte Name von /admin führt zu /admin", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, en("menue.einstellungen"));
    expect(trefferPfade(s)).toEqual(["/admin"]);
  });

  it("die bisherigen EN-Namen bleiben Synonyme", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, en("nav.validation"));
    expect(trefferPfade(s)).toEqual(["/validierung"]);
    await paletteTippen(s, en("nav.admin"));
    expect(trefferPfade(s)).toEqual(["/admin"]);
  });
});
