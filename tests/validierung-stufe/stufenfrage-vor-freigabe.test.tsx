// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 2 — DER KERN: ERST DIE FRAGE, DANN DIE STUFE, DANN DIE FREIGABE.
// ================================================================================================
//
// Codex hat am 06.09. an der laufenden 1.116 gemessen: „Stufenfrage fehlt"; ein Objekt ohne Stufe
// war mit HTTP 200 validiert und blieb `confidentiality: null`
// (`gespraech/abnahme/befunde/R-0994-20260906T031132683451.json`, Prüfschritt 2). Dieser Test ist
// die Umkehrung dieses Befundes.
//
// DIE REIHENFOLGE IST DIE LIEFERUNG. Eine Freigabe, deren Stufe nicht gespeichert wurde, ist genau
// der Zustand, den R-0994 beanstandet — deshalb wird nicht gezählt, DASS zwei Aufrufe abgehen,
// sondern in welcher Reihenfolge.
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

describe("JOB 3112 · F1: „Freigeben“ ohne Stufe fragt, statt zu senden", () => {
  it("der Klick öffnet den Block und setzt NULL Aufrufe ab", async () => {
    brett = await mounteBrett({
      zeilen: [zeile({ confidentiality: null, confidentialityProvenance: "unknown" })],
    });

    expect(finde(brett.container, FRAGE), "die Frage stand ungefragt da").toBeNull();
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE), "der Block ist nicht aufgeklappt").not.toBeNull();
    expect(putFolge(), "es wurde etwas geschickt, obwohl nur gefragt werden sollte").toEqual([]);
  });

  it("der Block steht im Fußband — dort, wo auch das Begründungsfeld aufklappt", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));

    const fussband = finde(brett.container, '[data-testid="pruefen-fussband"]');
    expect(fussband?.querySelector(FRAGE)).not.toBeNull();
  });
});

describe("JOB 3112 · F2: eine gewählte Stufe wird ZUERST gespeichert, dann freigegeben", () => {
  it("„Vertraulich“ → genau zwei Aufrufe, `confidentiality` vor `rate`", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "rate", verdict: "up" },
    ]);
  });

  it("„Streng vertraulich“ nimmt denselben Weg — die Wahl wird durchgereicht, nicht geglättet", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(
      finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-streng_vertraulich"]'),
    );

    expect(putFolge()[0]).toEqual({ action: "confidentiality", level: "streng_vertraulich" });
  });

  it("nach der Freigabe ist die Frage zu — sie bleibt nicht als zweiter Weg stehen", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));

    expect(finde(brett.container, FRAGE)).toBeNull();
  });
});

describe("JOB 3112 · F3: „Abbrechen“ schickt nichts und lässt den Eintrag stehen", () => {
  it("kein Aufruf, keine Frage mehr, die Karte bleibt", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-abbrechen"]'));

    expect(putFolge()).toEqual([]);
    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-karte"]')).not.toBeNull();
  });
});

describe("JOB 3112 · F4: auch die Lage „Auskunft fehlt“ wird gefragt", () => {
  it("eine Zeile ohne die beiden Auskunftsfelder öffnet dieselbe Frage", async () => {
    const { confidentiality: _c, confidentialityProvenance: _p, ...ohne } = zeile();
    brett = await mounteBrett({ zeilen: [ohne as ReturnType<typeof zeile>] });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).not.toBeNull();
    expect(putFolge()).toEqual([]);
  });
});
