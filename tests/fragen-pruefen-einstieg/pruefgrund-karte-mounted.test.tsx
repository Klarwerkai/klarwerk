// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DER PRÜFANLASS AN DER ECHTEN PRÜFKARTE (K4).
// ================================================================================================
//
// Die echte `Validation`-Fläche über die vorhandene Kulisse (`tests/pruefen-listennavigation`):
// gemockt ist der Endpunkt, nicht der Haken.
//
//   G1  Die Karte nennt unter Inhalt und Quellen, ÜBER dem Fußband: warum der Eintrag hier liegt,
//       was zu prüfen ist, was die Entscheidung bewirkt (mit den echten Stimmen) und die
//       Sichtbarkeit. Freigeben, Rückfrage und Ablehnen stehen unverändert im Fußband.
//   G2  Mir zugewiesen und überarbeitet: der Anlass nennt beides, „Was prüfen" den Fokus auf die
//       Änderung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).rolleMock(o as never),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { endpoints } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import { type Brett, KARTE, flush, mounteBrett, zeilen } from "../pruefen-listennavigation/kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

function text(testid: string): string {
  return (
    brett.container.querySelector(`${KARTE} [data-testid="${testid}"]`)?.textContent ?? ""
  ).trim();
}

/** Steht `a` im Dokument VOR `b`? */
function davor(a: Element | null, b: Element | null): boolean {
  return Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("produkt:20261010:fragen-pruefen-einstieg · Prüfanlass an der Karte", () => {
  it("G1 · warum, was, Wirkung und Sichtbarkeit stehen zwischen Inhalt und Entscheidung", async () => {
    brett = await mounteBrett(["A", "B"]);
    const karte = brett.container.querySelector(KARTE);
    const grund = karte?.querySelector('[data-testid="pruefen-grund"]') ?? null;
    expect(grund, "der Prüfanlass fehlt an der Karte").toBeTruthy();

    expect(text("pruefen-grund-warum")).toBe(
      `${i18n.t("pruefgrund.anlass.new")} ${i18n.t("pruefgrund.warum.offen")}`,
    );
    expect(text("pruefen-grund-was")).toBe(i18n.t("val.reviewContext.hint.new"));
    // Die Kulisse führt neededValidations 3 und keine Stimme.
    expect(text("pruefen-grund-wirkung")).toBe(i18n.t("pruefgrund.wirkung", { have: 0, need: 3 }));
    expect(text("pruefen-grund-sichtbar").length).toBeGreaterThan(0);

    // Nah an Inhalt und Entscheidung: nach dem Kartentext, vor dem Fußband.
    const kartentext = karte?.querySelector('[data-testid="pruefen-karte-text"]') ?? null;
    const fussband = karte?.querySelector('[data-testid="pruefen-fussband"]') ?? null;
    expect(davor(kartentext, grund)).toBe(true);
    expect(davor(grund, fussband)).toBe(true);
    // Die bisherigen Entscheidungen bleiben da.
    for (const v of ["up", "warn", "down"]) {
      expect(fussband?.querySelector(`[data-testid="pruefen-entscheidung-${v}"]`)).toBeTruthy();
    }
    // Die Hilfe im „?"-Menü bleibt unverändert die Stelle der allgemeinen Erklärung — der
    // Prüfanlass ist eintragsbezogen ausgezeichnet und zählt nicht als Erklärtext (Textmesser H2).
    for (const dd of grund?.querySelectorAll("dd") ?? []) {
      expect(dd.getAttribute("data-text")).toBe("text");
    }
  });

  it("G2 · mir zugewiesen und überarbeitet", async () => {
    brett = await mounteBrett(["A"]);
    const [zeile] = zeilen(["A"]);
    const geaendert = { ...zeile, version: 2, assignments: ["u1"] };
    const board = endpoints.validation.board as unknown as ReturnType<typeof vi.fn>;
    board.mockResolvedValue([geaendert] as never);
    await act(async () => {
      await brett.qc.invalidateQueries();
    });
    for (let i = 0; i < 8; i += 1) {
      await flush();
    }
    expect(text("pruefen-grund-warum")).toBe(
      `${i18n.t("pruefgrund.anlass.revision", { version: 2 })} ${i18n.t("pruefgrund.warum.mir")}`,
    );
    expect(text("pruefen-grund-was")).toBe(i18n.t("val.guide.focus.revision"));
  });
});
