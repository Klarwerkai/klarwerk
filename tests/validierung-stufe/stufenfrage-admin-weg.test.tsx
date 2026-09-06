// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 6 — DER ADMINISTRATORWEG, DEN CODEX GEMESSEN HAT.
// ================================================================================================
//
// R-0994, Prüfschritt 2, wörtlich: „Stufenfrage fehlt im Administratorweg; HTTP 200 validiert/null"
// (Rolle Administrator, 06.09.2026 00:59:52–01:01:02 UTC). Genau dieser Weg — „···"-Menü → „Als
// wahr kennzeichnen" → Rückfrage → `admin-validate` — bekommt hier denselben Schritt wie das
// Fußband. Die naheliegende Halbheit wäre gewesen, nur den Freigabeknopf zu bedienen.
//
// WO DIE FRAGE STEHT. Beim Freigabeknopf klappt sie im Fußband auf; hier tritt sie an die Stelle
// der Inline-Rückfrage IM MENÜ, weil das Menüblatt über der Karte liegt und seine Schließfläche
// (`PruefenMenue`, `fixed inset-0 z-30`) jeden Klick auf das Fußband abfinge. Ein Ablauf, zwei
// Orte — nicht zwei Entscheidungen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "admin" }));
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

import {
  type Brett,
  de,
  finde,
  klick,
  knopfMitText,
  mounteBrett,
  putFolge,
  zeile,
} from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "admin";
});
afterEach(() => brett?.abbauen());

const FRAGE = '[data-testid="pruefen-stufenfrage"]';

/** Menü öffnen → „Als wahr kennzeichnen" → die Rückfrage steht. */
async function bisRueckfrage(): Promise<void> {
  await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
  await klick(knopfMitText(brett.container, de("val.markTrue")));
}

describe("JOB 3112 · A1: Rückfrage, dann Stufenfrage, dann die beiden Aufrufe", () => {
  it("die Rückfrage kommt zuerst und schickt nichts", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();

    expect(brett.container.textContent).toContain(de("val.markTrueConfirm"));
    expect(finde(brett.container, FRAGE), "die Frage überholt die Rückfrage").toBeNull();
    expect(putFolge()).toEqual([]);
  });

  it("„Ja, validieren“ öffnet die Stufenfrage, statt zu validieren", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));

    expect(finde(brett.container, FRAGE)).not.toBeNull();
    expect(putFolge()).toEqual([]);
  });

  it("die gewählte Stufe wird ZUERST gespeichert, dann `admin-validate`", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "admin-validate" },
    ]);
  });

  it("„Ohne Stufe“ → genau ein `admin-validate`, kein `confidentiality`", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]'));

    expect(putFolge()).toEqual([{ action: "admin-validate" }]);
  });

  it("ein bereits eingestuftes Objekt geht wie bisher: ein Klick, ein `admin-validate`", async () => {
    brett = await mounteBrett({
      zeilen: [zeile({ confidentiality: "intern", confidentialityProvenance: "ko" })],
    });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([{ action: "admin-validate" }]);
  });
});

describe("JOB 3112 · A2: die Gegenproben des Administratorwegs", () => {
  it("Rückfrage abbrechen → null Aufrufe und keine Stufenfrage", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueCancel")));

    expect(putFolge()).toEqual([]);
    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(brett.container.textContent).not.toContain(de("val.markTrueConfirm"));
  });

  it("die Stufenfrage abbrechen → null Aufrufe", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-abbrechen"]'));

    expect(putFolge()).toEqual([]);
    expect(finde(brett.container, FRAGE)).toBeNull();
  });

  it("scheitert die Stufe, wird NICHT als wahr gekennzeichnet", async () => {
    const { ApiError } = await import("../../apps/web/src/api/client");
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    (endpoints.ko.act as unknown as ReturnType<typeof vi.fn>).mockImplementation((async (
      _id: string,
      body: { action: string },
    ) => {
      if (body.action === "confidentiality") {
        throw new ApiError(403, "forbidden", "nein");
      }
      return {};
    }) as never);
    brett = await mounteBrett({ zeilen: [zeile()] });
    await bisRueckfrage();
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(putFolge().map((p) => p.action)).not.toContain("admin-validate");
    expect(finde(brett.container, '[data-testid="pruefen-stufenfrage-fehler"]')).not.toBeNull();
  });

  it("wer nicht Administrator ist, sieht den Weg gar nicht — und damit auch die Frage nicht", async () => {
    stand.rolle = "controller";
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));

    expect(knopfMitText(brett.container, de("val.markTrue"))).toBeNull();
  });
});
