// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 3 — „GEFRAGT, NICHT ERZWUNGEN": DER ÜBERGEH-WEG IST EIN KLICK.
// ================================================================================================
//
// Pedis Entscheidung 32 (06.09.2026 04:22) verweist auf 2623 D1 §2: „Nicht erzwungen (§3), aber
// gefragt". Dieser Test ist die messbare Fassung des Wortes „nicht erzwungen": ein Mensch, der die
// Stufe nicht kennt oder nicht setzen will, kommt mit EINEM Klick durch — und es entsteht dabei
// KEINE Einstufung, auch keine stille „intern"-Annahme.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "controller" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import { type Brett, de, finde, klick, mounteBrett, putFolge, zeile } from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';
const OHNE = '[data-testid="pruefen-stufenfrage-ohne"]';

describe("JOB 3112 · N1: „Ohne Stufe freigeben“ ist genau EIN Aufruf", () => {
  it("nur `rate` — kein `confidentiality`, keine Vorbelegung, keine „intern“-Annahme", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, OHNE));

    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });

  it("in der Folge steht KEIN einziger `confidentiality`-Aufruf", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, OHNE));

    expect(putFolge().map((p) => p.action)).not.toContain("confidentiality");
  });
});

describe("JOB 3112 · N2: der Weg ist beschriftet und liegt neben den Stufen", () => {
  it("der Übergeh-Knopf trägt den Wortlaut aus dem Register", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, OHNE)?.textContent?.trim()).toBe(de("val.stufenfrage.ohneStufe"));
  });

  it("die drei Stufen stehen zur Wahl — mit ihrem VORHANDENEN Wortlaut aus `conf.level.*`", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));

    const block = finde(brett.container, '[data-testid="pruefen-stufenfrage"]');
    for (const stufe of ["intern", "vertraulich", "streng_vertraulich"]) {
      expect(
        finde(brett.container, `[data-testid="pruefen-stufenfrage-wahl-${stufe}"]`),
        `die Wahl „${stufe}“ fehlt`,
      ).not.toBeNull();
    }
    expect(block?.textContent).toContain(de("conf.level.vertraulich"));
    // Keine vierte Stufe und kein erfundener Wortlaut: „nicht eingestuft" ist eine AUSKUNFT über
    // den Bestand, keine Wahlmöglichkeit.
    expect(block?.textContent).not.toContain(de("conf.level.nichtEingestuft"));
  });
});
