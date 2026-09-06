// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 4 — DER GEGENFALL: WER SCHON EINGESTUFT IST, WIRD NICHT GEFRAGT.
// ================================================================================================
//
// Ohne diesen Fall wäre die Lieferung von „fragt immer" nicht zu unterscheiden — und aus „gefragt"
// wäre eine Belästigung geworden. Pedis Zusage lautet: trägt das Objekt schon eine Stufe, ändert
// sich NICHTS. Ein Klick, sofort freigegeben, genau ein Aufruf.
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

import { type Brett, finde, klick, mounteBrett, putFolge, zeile } from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

const FRAGE = '[data-testid="pruefen-stufenfrage"]';
const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';

describe("JOB 3112 · G1: eine belegte Stufe wird nicht noch einmal erfragt", () => {
  for (const stufe of ["intern", "vertraulich", "streng_vertraulich"] as const) {
    it(`\`${stufe}\` (Beleglage \`ko\`) → keine Frage, genau ein \`rate\``, async () => {
      brett = await mounteBrett({
        zeilen: [zeile({ confidentiality: stufe, confidentialityProvenance: "ko" })],
      });
      await klick(finde(brett.container, FREIGEBEN));

      expect(finde(brett.container, FRAGE), "es wurde gefragt, obwohl eingestuft").toBeNull();
      expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
    });
  }

  // Der Altfall aus JOB 3027 R3: eine Zeile kann `confidentiality` tragen und die Beleglage nicht.
  // Sie IST eingestuft (boardAuskunft.ts:112-116) — also wird auch hier nicht gefragt.
  it("eine gültige Stufe ohne Beleglage gilt als eingestuft", async () => {
    const { confidentialityProvenance: _p, ...alt } = zeile({ confidentiality: "vertraulich" });
    brett = await mounteBrett({ zeilen: [alt as ReturnType<typeof zeile>] });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });
});

describe("JOB 3112 · G2: Rückfrage und Ablehnen bleiben unberührt (Lieferung 4)", () => {
  it("„Rückfrage“ öffnet das Begründungsfeld und KEINE Stufenfrage", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-entscheidung-warn"]'));

    expect(finde(brett.container, '[data-testid="pruefen-begruendung"]')).not.toBeNull();
    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([]);
  });

  it("„Ablehnen“ ebenso — eine Ablehnung ist kein Anlass, eine Einstufung zu setzen", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-entscheidung-down"]'));

    expect(finde(brett.container, '[data-testid="pruefen-begruendung"]')).not.toBeNull();
    expect(finde(brett.container, FRAGE)).toBeNull();
  });
});
