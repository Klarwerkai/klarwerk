// @vitest-environment jsdom
// ================================================================================================
// JOB 3105 · UX-08 — EIN BEREICH, EIN NAME: KOPFBAND, DRAWER, ZAHNRAD UND SCHNELLNAVIGATION.
// ================================================================================================
//
// DER KERN DIESES AUFTRAGS ist nicht „die Schnellnavigation zeigt eine andere Zeichenkette",
// sondern: der Name, den ein Mensch auf einer Fläche liest, ist derselbe, mit dem er das Ziel
// wiederfindet. Deshalb wird hier GERENDERTER Text gegen GERENDERTEN Text gestellt — kein im Test
// abgeschriebenes „Prüfen"/„Einstellungen". Eine abgeschriebene Zeichenkette bliebe grün, wenn
// beide Seiten gemeinsam falsch würden, und sie wäre eine dritte Wahrheit über den Namen.
//
// WARUM DIE VIER BAUTEILE EINZELN UND NICHT ÜBER `AppShell` MONTIERT WERDEN: Die Hülle rendert die
// Kopfband-Punkte und den Off-Canvas-Drawer NIE gleichzeitig — auf schmalen Breiten fällt
// `KopfbandPunkte` weg (`Kopfband.tsx:72`), auf breiten gibt es den Drawer nicht
// (`AppShell.tsx:81,116`). Ein Vergleich über zwei getrennte Montierungen wäre schwächer als
// dieser: hier hängen alle vier Flächen an EINER Instanz, an EINEM `RoleProvider` und an EINER
// i18n-Instanz. Es sind dieselben Bauteile, die die Hülle einsetzt (`Kopfband.tsx:72`,
// `DrawerMenue.tsx:26,29`, `ZahnradMenue.tsx:195`, `AppShell.tsx:111,152`).
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

// Kopfband und Zahnrad-Menü lesen echte Endpunkte (Zähler, Status, Schalter). Sie antworten hier
// leer/aus — dieser Fall dreht sich um NAMEN, nicht um Zahlen.
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    features: { get: vi.fn(async () => ({ features: {} })) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    validation: { board: vi.fn(async () => []) },
    lifecycle: { pending: vi.fn(async () => []) },
    gaps: {
      list: vi.fn(async () => []),
      summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } })),
    },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "deterministic" })),
      config: vi.fn(async () => ({})),
    },
    external: { policy: vi.fn(async () => null) },
    notifications: {
      list: vi.fn(async () => []),
      markSeen: vi.fn(async () => ({ unseenCount: 0 })),
    },
  },
}));

import { createElement } from "../../apps/web/node_modules/react";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { KopfbandPunkte, KopfbandPunkteListe } from "../../apps/web/src/shell/KopfbandPunkte";
import { ZahnradEintraege } from "../../apps/web/src/shell/ZahnradMenue";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  paletteOeffnen,
  paletteTippen,
  palettenTreffer,
  sichtbarerName,
} from "./vorrichtung";

let stand: Stand | null = null;

async function vierFlaechen(): Promise<Stand> {
  const s = montiere(
    createElement(
      "div",
      null,
      createElement(KopfbandPunkte),
      createElement(KopfbandPunkteListe),
      createElement(ZahnradEintraege),
      createElement(CommandPalette),
    ),
  );
  stand = s;
  await beruhige();
  return s;
}

/** Der gerenderte Name des Palettentreffers auf genau diesem Pfad. */
async function palettenName(s: Stand, pfad: string, eingabe: string): Promise<string> {
  await paletteOeffnen();
  await paletteTippen(s, eingabe);
  const treffer = palettenTreffer(s).filter((t) => t.pfad === pfad);
  expect(treffer, `kein Treffer auf ${pfad} für „${eingabe}"`).toHaveLength(1);
  return treffer[0]?.text ?? "";
}

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  vi.clearAllMocks();
});

describe("JOB 3105 · UX-08 · derselbe Bereich trägt auf jeder Fläche denselben Namen", () => {
  it("/validierung: Kopfband, Drawer-Zeile und Palettentreffer sind zeichengleich", async () => {
    const s = await vierFlaechen();
    const imKopfband = sichtbarerName(s, '[data-kopfband-punkt="validierung"]');
    const imDrawer = sichtbarerName(s, '[data-testid="drawer-punkt-validierung"]');
    // Nicht-vakuös: der Name ist überhaupt ein Name, kein leerer Text.
    expect(imKopfband.length).toBeGreaterThan(0);
    expect(imDrawer).toBe(imKopfband);

    // Gesucht wird mit dem, was der Mensch gerade GELESEN hat — nicht mit einem Testwort.
    const inDerPalette = await palettenName(s, "/validierung", imKopfband);
    expect(inDerPalette).toBe(imKopfband);
  });

  it("/admin: die Zahnrad-Zeile und der Palettentreffer sind zeichengleich", async () => {
    const s = await vierFlaechen();
    const imZahnrad = sichtbarerName(s, '[data-testid="zahnrad-einstellungen"]');
    expect(imZahnrad.length).toBeGreaterThan(0);

    const inDerPalette = await palettenName(s, "/admin", imZahnrad);
    expect(inDerPalette).toBe(imZahnrad);
  });

  it("/erfassen: Kopfband, Drawer-Zeile und Palettentreffer sind zeichengleich", async () => {
    const s = await vierFlaechen();
    const imKopfband = sichtbarerName(s, '[data-kopfband-punkt="erfassen"]');
    const imDrawer = sichtbarerName(s, '[data-testid="drawer-punkt-erfassen"]');
    expect(imKopfband.length).toBeGreaterThan(0);
    expect(imDrawer).toBe(imKopfband);

    const inDerPalette = await palettenName(s, "/erfassen", imKopfband);
    expect(inDerPalette).toBe(imKopfband);
  });
});
