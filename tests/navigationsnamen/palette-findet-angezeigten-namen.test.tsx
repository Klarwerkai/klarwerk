// @vitest-environment jsdom
// ================================================================================================
// JOB 3105 · UX-08 — WER EINEN NAMEN GELESEN HAT, FINDET DAMIT SEIN ZIEL.
// ================================================================================================
//
// DER BEFUND (Codex, unabhängige Livemessung 05.09.2026 22:56–22:58 MESZ, v1.0.0-beta.1.109,
// `register/planung/UIUX-AUFTRAEGE-1.md:173`): „Menü → Einstellungen führt zu /admin mit Überschrift
// Einstellungen; die Schnellnavigation nennt dasselbe Ziel Admin. Validierung in der
// Schnellnavigation führt zu /validierung mit Überschrift und Hauptnavigation Prüfen. Die Eingaben
// Einstellungen und Prüfen ergeben dort jeweils Kein Treffer."
//
// Genau diese zwei Eingaben stehen hier als Fälle. Der dritte Abweichler („Erfassen") ist heute
// zufällig grün — er bleibt als Wächter drin, damit er es bleibt.
import { afterEach, describe, expect, it, vi } from "vitest";

// Ohne Netz: die Rolle kommt aus einer echten, aber abgeschnittenen Sitzung. `admin` sieht alle
// Ziele — der Rollenschutz selbst hat seine eigene Datei (palette-rolle-bleibt-geschuetzt).
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
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  paletteOeffnen,
  paletteTippen,
  palettenTreffer,
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

describe("JOB 3105 · UX-08 · die Schnellnavigation kennt den angezeigten Namen", () => {
  it("die Sitzung ist wirklich Admin — sonst wären die Fälle unten aus dem falschen Grund wahr", async () => {
    const s = await paletteMitAdmin();
    // Ohne geladene Sitzung stünde die Rolle auf der Dev-Vorschau `experte` (RoleContext.tsx:34),
    // und /admin fehlte auch nach der Änderung. Dieser Fall trennt beides.
    expect(trefferPfade(s)).toContain("/admin");
  });

  it("Fall 1: „Prüfen“ führt zu /validierung — der Name aus Kopfband und Seitentitel", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Prüfen");
    expect(palettenTreffer(s).map((t) => t.pfad)).toEqual(["/validierung"]);
  });

  it("Fall 2: „Einstellungen“ führt zu /admin — der Name aus dem Zahnrad-Menü und der Seite", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Einstellungen");
    expect(palettenTreffer(s).map((t) => t.pfad)).toEqual(["/admin"]);
  });

  it("Fall 3: „Erfassen“ führt zu /erfassen — heute schon grün, bleibt bewacht", async () => {
    const s = await paletteMitAdmin();
    await paletteTippen(s, "Erfassen");
    expect(palettenTreffer(s).map((t) => t.pfad)).toEqual(["/erfassen"]);
  });
});
