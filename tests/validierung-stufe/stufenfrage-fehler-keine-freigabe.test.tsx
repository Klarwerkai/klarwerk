// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 5 — SCHLÄGT DAS SETZEN DER STUFE FEHL, WIRD NICHTS FREIGEGEBEN.
// ================================================================================================
//
// Die Zusage der Prüffläche steht seit JOB 3061 in ihrem Kopf (`Validation.tsx:31`): „Kein
// ‚Freigegeben' ohne 2xx." Der neue Weg ist ZWEISTUFIG, und damit gilt sie zweimal: scheitert der
// erste Schritt, darf der zweite nicht laufen — sonst entstünde genau der Zustand aus R-0994
// (validiert, `confidentiality: null`), nur diesmal, obwohl jemand die Stufe gewählt hat.
//
// Offline ist derselbe Fall: der Aufruf scheitert, es erscheint der Fehler und keine Quittung.
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

import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAction } from "../../apps/web/src/api/endpoints";
import { type Brett, de, finde, klick, mounteBrett, putFolge, zeile } from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

const FRAGE = '[data-testid="pruefen-stufenfrage"]';
const FEHLER = '[data-testid="pruefen-stufenfrage-fehler"]';
const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';

/** Das Setzen der Stufe antwortet 403; alles andere bliebe erfolgreich — wenn es denn liefe. */
function stufeVerboten(): void {
  (endpoints.ko.act as unknown as ReturnType<typeof vi.fn>).mockImplementation((async (
    _id: string,
    body: KoAction,
  ) => {
    if (body.action === "confidentiality") {
      throw new ApiError(403, "forbidden", "Herabstufung nicht erlaubt.");
    }
    return {};
  }) as never);
}

describe("JOB 3112 · E1: 403 auf die Stufe heißt: keine Freigabe", () => {
  it("es bleibt bei EINEM Aufruf — `rate` läuft nicht", async () => {
    stufeVerboten();
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(putFolge()).toEqual([{ action: "confidentiality", level: "vertraulich" }]);
    expect(putFolge().map((p) => p.action)).not.toContain("rate");
  });

  it("die Frage bleibt offen und trägt eine Fehlermeldung", async () => {
    stufeVerboten();
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(finde(brett.container, FRAGE), "die Frage wurde geschlossen").not.toBeNull();
    expect(finde(brett.container, FEHLER)?.textContent).toContain(de("val.stufenfrage.fehler"));
  });

  it("es erscheint KEINE Quittung „Freigegeben“", async () => {
    stufeVerboten();
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));

    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();
    expect(brett.container.textContent).not.toContain(de("val.decisionSaved"));
  });

  it("ein zweiter Versuch ist möglich — und er geht wieder mit der Stufe los", async () => {
    stufeVerboten();
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    // Jetzt gibt der Server nach.
    (endpoints.ko.act as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (async () => ({})) as never,
    );
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "confidentiality", level: "intern" },
      { action: "rate", verdict: "up" },
    ]);
  });
});

describe("JOB 3112 · E2: scheitert die FREIGABE selbst, entsteht ebenfalls keine Quittung", () => {
  it("`rate` antwortet 500 → Fehler am Block, Frage offen, keine Quittung", async () => {
    (endpoints.ko.act as unknown as ReturnType<typeof vi.fn>).mockImplementation((async (
      _id: string,
      body: KoAction,
    ) => {
      if (body.action === "rate") {
        throw new ApiError(500, "server_error", "kaputt");
      }
      return {};
    }) as never);
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]'));

    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
    expect(finde(brett.container, FEHLER)).not.toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();
  });
});
