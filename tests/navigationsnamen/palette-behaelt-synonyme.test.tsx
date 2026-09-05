// @vitest-environment jsdom
// ================================================================================================
// JOB 3105 · UX-08 — BESTANDSSCHUTZ: DIE ALTEN NAMEN GEHEN NICHT VERLOREN.
// ================================================================================================
//
// Der Änderungsauftrag (`register/planung/UIUX-AUFTRAEGE-1.md:179`) sagt ausdrücklich:
// „Admin/Validierung dürfen Suchsynonyme bleiben." Wer sich seit Monaten „Validierung" tippt, darf
// beim nächsten Start nicht ins Leere greifen.
//
// DIESE DATEI IST HEUTE GRÜN UND MUSS GRÜN BLEIBEN. Sie ist die Gegenkraft zu
// `palette-findet-angezeigten-namen`: dort wird ein Name HINZUGEFÜGT, hier wird belegt, dass dabei
// keiner verschwindet. Ohne sie wäre „Namen vereinheitlichen" auch dann erfüllt, wenn man den alten
// Namen ersatzlos gestrichen hätte.
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { ANALYTICS_AUDIT_PATH } from "../../apps/web/src/lib/analyticsSections";
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

let stand: Stand | null = null;

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

describe("JOB 3105 · UX-08 · die bisherigen Namen bleiben auffindbar", () => {
  it("„Validierung“ findet weiterhin /validierung", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Validierung");
    expect(trefferPfade(s)).toEqual(["/validierung"]);
  });

  it("„Admin“ findet weiterhin /admin", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Admin");
    expect(trefferPfade(s)).toEqual(["/admin"]);
  });

  it("„Audit“ findet weiterhin den Deep-Link ins Audit-Log", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Audit");
    // Bewusst `toContain`: „Analytics & Audit" trägt das Wort ebenfalls, der Deep-Link ist also
    // nicht der einzige Treffer — behauptet wird nur, dass er dabei ist.
    expect(trefferPfade(s)).toContain(ANALYTICS_AUDIT_PATH);
  });
});
