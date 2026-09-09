// @vitest-environment jsdom
// ================================================================================================
// JOB 3337 · RUNDE 6 — DER TASTATURWEG WIRD BIS ZUM ZIEL GEMESSEN, NICHT BIS ZUR MARKIERUNG.
// ================================================================================================
//
// DER BEFUND (BEN, Runde 5): „‚Profil‘ ist markiert, Enter öffnet stattdessen ‚System →
// Bereitschaft‘, reproduziert in DE und EN."
//
// DIE URSACHE war eine zweite Reihenfolge: gezeichnet wurde nach Obergruppen, die laufende Nummer
// der Zeile entstand in dieser Zeichenreihenfolge — Enter griff aber in die UNGRUPPIERTE Trefferliste
// (`CommandPalette.tsx`, vor dieser Runde: `filtered[active]`). Beide Listen sind gleich LANG, nur
// anders SORTIERT. Genau deshalb ist es niemandem aufgefallen: jede Zählung stimmte, jede
// Trefferliste war vollständig, und trotzdem landete man woanders, als dastand.
//
// WARUM ES KEIN VORHANDENER TEST GEFANGEN HAT — und das ist die eigentliche Lehre dieser Runde:
// `adressierbarkeit.test.tsx` F2 prüft den Tastaturweg bis zur MARKIERUNG (und dass sie in Sicht
// gezogen wird) und hört dort auf. Eine Markierung ist aber nur die halbe Zusage. Die ganze lautet:
// „was markiert ist, wird geöffnet." BENs Promptverbesserung sagt es als Regel — „bloße
// DOM-Anwesenheit und Scroll-Aufrufe genügen nicht" —, diese Datei ist ihre Umsetzung.
//
// DIE PRÜFUNG IST BEWUSST ERSCHÖPFEND: nicht ein Beispielziel, sondern JEDES dargestellte Ziel wird
// angesteuert und geöffnet, und die tatsächlich erreichte Route mit dem Weg VERGLICHEN, den die
// markierte Zeile selbst nennt (`data-cmd-pfad`). Ein Stichprobentest hätte den Fehler je nach
// Auswahl verfehlt — „Start" etwa steht in beiden Reihenfolgen an derselben Stelle.
//
// K0 IST DIE KALIBRIERUNG, ohne die alles Folgende wertlos wäre: sie belegt, dass sich die beiden
// Reihenfolgen ÜBERHAUPT unterscheiden. Wären sie identisch, wäre dieser Test auch mit dem Fehler
// grün gewesen — er misst dann nichts.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

import { act, createElement } from "../../apps/web/node_modules/react";
import {
  direktzugangZiele,
  trefferFuer,
  trefferNachGruppen,
} from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  ohneNetz,
  ort,
  ortMitAnker,
  setzeStufe2,
  sprache,
} from "./vorrichtung";

const t = (key: string): string => i18n.t(key);
let stand: Stand | null = null;

beforeAll(() => {
  ohneNetz();
});

beforeEach(() => {
  setzeStufe2(true);
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

function paletteOeffnen(): Promise<void> {
  return new Promise((aufloesen) => {
    window.dispatchEvent(new Event("open-command-palette"));
    setTimeout(aufloesen, 0);
  });
}

async function palette(): Promise<Stand> {
  const s = montiere("/start", createElement(CommandPalette));
  stand = s;
  await beruhige();
  await paletteOeffnen();
  await beruhige(3);
  return s;
}

/** Das Suchfeld — der Ort, an dem die Tastenanschläge ankommen. */
function suchfeld(s: Stand): HTMLInputElement {
  const feld = s.container.querySelector<HTMLInputElement>('[data-cmd="suchfeld"]');
  if (!feld) {
    throw new Error("Die Liste „Gehe zu …“ hat kein Suchfeld — die Fläche steht nicht.");
  }
  return feld;
}

/** Ein echter Tastenanschlag am Suchfeld, wie ihn React verarbeitet. */
async function taste(s: Stand, key: string): Promise<void> {
  await act(async () => {
    suchfeld(s).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Die Zeilen, wie sie DASTEHEN — in genau der Reihenfolge, in der sie gezeichnet sind. */
function zeilen(s: Stand): HTMLElement[] {
  return [...s.container.querySelectorAll<HTMLElement>("[data-cmd-ziel]")];
}

/** Die eine markierte Zeile, oder `null` — die Fläche darf nie zwei markieren. */
function markiert(s: Stand): HTMLElement | null {
  const alle = s.container.querySelectorAll<HTMLElement>('[data-cmd-aktiv="true"]');
  expect(alle.length, "es ist mehr als eine Zeile gleichzeitig markiert").toBeLessThanOrEqual(1);
  return alle[0] ?? null;
}

describe("JOB 3337 · K · was markiert ist, wird auch geöffnet", () => {
  it("K0 · KALIBRIERUNG: Anzeigereihenfolge und Suchreihenfolge sind wirklich verschieden", () => {
    const ziele = direktzugangZiele(t, "admin", true);
    const gesucht = trefferFuer(ziele, "");
    const dargestellt = trefferNachGruppen(gesucht).flatMap((g) => g.ziele);

    expect(dargestellt.length, "die Gruppierung verliert oder erfindet Ziele").toBe(gesucht.length);
    // OHNE diesen Unterschied wäre der alte Fehler unsichtbar gewesen und K1/K2 wertlos: ein
    // Index in die eine Liste hätte zufällig dasselbe Ziel getroffen wie in die andere.
    const abweichend = dargestellt.filter((z, i) => gesucht[i]?.id !== z.id);
    expect(
      abweichend.length,
      "beide Reihenfolgen sind identisch — dieser Test könnte den Befund gar nicht sehen",
    ).toBeGreaterThan(0);
  });

  it("K1 · jedes dargestellte Ziel: Pfeiltasten → Enter → genau dessen Route (DE)", async () => {
    const anzahl = zeilen(await palette()).length;
    expect(anzahl, "die Liste ist leer — dann misst der Fall nichts").toBeGreaterThan(1);

    for (let stelle = 0; stelle < anzahl; stelle += 1) {
      if (stand) {
        abbauen(stand);
        stand = null;
      }
      const s = await palette();
      for (let schritt = 0; schritt < stelle; schritt += 1) {
        await taste(s, "ArrowDown");
      }

      // Was steht da, und was verspricht die markierte Zeile? BEIDES aus der Fläche gelesen —
      // keine nachgebaute Erwartung, die denselben Denkfehler wiederholen könnte.
      const zeile = markiert(s);
      expect(zeile, `nach ${stelle} Pfeilanschlägen ist nichts markiert`).not.toBeNull();
      expect(
        zeile?.getAttribute("data-cmd-stelle"),
        "die Markierung sitzt nicht auf der Zeile, zu der gewandert wurde",
      ).toBe(String(stelle));
      const versprochen = zeile?.getAttribute("data-cmd-pfad") ?? "";
      const name = zeile?.querySelector("[data-cmd-name]")?.textContent ?? "";

      await taste(s, "Enter");
      // MIT Anker verglichen: zwei Ziele („Audit-Log (in Analytics)", die Beispielpakete) tragen
      // ihn im Weg, und ein gekürzter Vergleich hätte hier einen Fehler gemeldet, den es nicht gibt.
      expect(
        ortMitAnker(s),
        `markiert war „${name}" (${versprochen}), geöffnet wurde etwas anderes`,
      ).toBe(versprochen);
    }
  });

  it("K2 · BENs Fall wörtlich: Markierung „Profil“ öffnet /profil — in DE und in EN", async () => {
    for (const lng of ["de", "en"]) {
      if (stand) {
        abbauen(stand);
        stand = null;
      }
      await sprache(lng);
      const s = await palette();
      const stelle = zeilen(s).findIndex((z) => z.getAttribute("data-cmd-ziel") === "nav:profil");
      expect(stelle, `[${lng}] „Profil" steht gar nicht in der Liste`).toBeGreaterThanOrEqual(0);

      for (let schritt = 0; schritt < stelle; schritt += 1) {
        await taste(s, "ArrowDown");
      }
      expect(
        markiert(s)?.getAttribute("data-cmd-ziel"),
        `[${lng}] die Markierung sitzt nicht auf „Profil"`,
      ).toBe("nav:profil");

      await taste(s, "Enter");
      expect(ort(s), `[${lng}] Enter auf „Profil" führte nicht auf /profil`).toBe("/profil");
    }
  });

  it("K3 · die Pfeile laufen nicht über die Liste hinaus — oben wie unten", async () => {
    const s = await palette();
    const anzahl = zeilen(s).length;

    // Oben: ArrowUp am Anfang bleibt auf der ersten Zeile, statt ins Leere zu zeigen.
    await taste(s, "ArrowUp");
    await taste(s, "ArrowUp");
    expect(
      markiert(s)?.getAttribute("data-cmd-stelle"),
      "die Markierung ist nach oben entwischt",
    ).toBe("0");

    // Unten: zehn Anschläge über das Ende hinaus enden auf der letzten Zeile — und Enter dort
    // öffnet sie auch. Ohne die zweite Hälfte wäre „geklemmt" wieder nur eine Markierungsaussage.
    for (let i = 0; i < anzahl + 10; i += 1) {
      await taste(s, "ArrowDown");
    }
    const letzte = markiert(s);
    expect(letzte?.getAttribute("data-cmd-stelle"), "die Markierung ist nach unten entwischt").toBe(
      String(anzahl - 1),
    );
    const versprochen = letzte?.getAttribute("data-cmd-pfad") ?? "";
    await taste(s, "Enter");
    expect(ortMitAnker(s), "Enter auf der letzten Zeile öffnete etwas anderes").toBe(versprochen);
  });
});
