// @vitest-environment jsdom
// ================================================================================================
// JOB 3105 · UX-08 — MEHR NAMEN, NICHT MEHR RECHTE.
// ================================================================================================
//
// Die Abnahme verlangt es ausdrücklich (`register/planung/UIUX-AUFTRAEGE-1.md:181`): „Rollenabhängige
// Bereiche bleiben geschützt." Ein zweiter Suchtext je Ziel ist genau die Änderung, bei der ein
// Fail-open unbemerkt entstehen könnte — deshalb steht die Gegenprobe hier als eigene Datei.
//
// `canSee` (navigation.ts:441) bleibt die EINE Sichtbarkeitsregel; diese Datei misst sie am
// gerenderten Ergebnis, nicht am Quelltext.
import { afterEach, describe, expect, it, vi } from "vitest";

// Die Rolle der abgeschnittenen Sitzung ist je Fall umschaltbar — `vi.hoisted`, weil `vi.mock`
// vor allen Importen ausgeführt wird.
const sitzung = vi.hoisted(() => ({ rolle: "viewer" as string }));

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-1", name: "Rae", email: "r@x.de", role: sitzung.rolle })),
    },
  };
});

import { createElement } from "../../apps/web/node_modules/react";
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

async function paletteMit(rolle: string): Promise<Stand> {
  sitzung.rolle = rolle;
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
  sitzung.rolle = "viewer";
  vi.clearAllMocks();
});

describe("JOB 3105 · UX-08 · der zweite Suchtext öffnet keine Tür", () => {
  it("ein Viewer findet /admin auch unter „Einstellungen“ nicht", async () => {
    const s = await paletteMit("viewer");
    // NICHT-VAKUÖS, zwei Seiten: die Liste lebt (Bibliothek ist da), UND die Sitzung ist wirklich
    // beim Viewer angekommen — sonst stünde die Dev-Vorschau `experte` (RoleContext.tsx:34) da,
    // die /erfassen sähe.
    const alle = trefferPfade(s);
    expect(alle).toContain("/bibliothek");
    expect(alle).not.toContain("/erfassen");

    await paletteTippen(s, "Einstellungen");
    expect(trefferPfade(s)).not.toContain("/admin");
  });

  it("ein Viewer findet /admin auch unter dem alten Namen „Admin“ nicht", async () => {
    const s = await paletteMit("viewer");
    await paletteTippen(s, "Admin");
    expect(trefferPfade(s)).not.toContain("/admin");
  });

  it("ein Admin ohne Stufe 2 findet den Stufe-2-Punkt /kapital nicht", async () => {
    const s = await paletteMit("admin");
    // Nicht-vakuös: die Admin-Sitzung ist da (sonst fehlte /admin ohnehin).
    expect(trefferPfade(s)).toContain("/admin");
    await paletteTippen(s, "Kapital");
    expect(trefferPfade(s)).not.toContain("/kapital");
  });
});
