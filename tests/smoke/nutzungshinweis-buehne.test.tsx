// @vitest-environment jsdom
// JOB 3367: Kalibrierung der Diagnose, kein Nachweis für den Cloud-Navigationsfehler.
import { afterEach, expect, it, vi } from "vitest";
import { installiereNavDiagnose } from "../../tests-smoke/support/nav-diagnose";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function buehne() {
  document.body.innerHTML =
    '<header><a data-kopfband-punkt="erfassen" href="/erfassen">Erfassen</a></header>';
  const zeilen: Record<string, unknown>[] = [];
  vi.spyOn(console, "debug").mockImplementation((prefix, json) => {
    if (prefix === "KW-NAV-DIAG") zeilen.push(JSON.parse(json));
  });
  const stop = installiereNavDiagnose();
  const link = document.querySelector("a");
  if (!link) throw new Error("Kalibrierungslink fehlt");
  return { zeilen, stop, link };
}

it("D1: auch ein verschluckter Klick behält Ziel, Abbruchstelle und Endzustand", async () => {
  vi.useFakeTimers();
  const { zeilen, stop, link } = buehne();
  try {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await vi.runAllTimersAsync();
    expect(zeilen).toContainEqual(
      expect.objectContaining({ art: "click-capture", ziel: "/erfassen" }),
    );
    expect(zeilen).toContainEqual(
      expect.objectContaining({ art: "preventDefault", stack: expect.any(String) }),
    );
    expect(zeilen).toContainEqual(expect.objectContaining({ art: "stopImmediatePropagation" }));
    expect(zeilen).toContainEqual(expect.objectContaining({ art: "click-end", verhindert: true }));
  } finally {
    stop();
  }
});

it("D2: History-Aufruf und Ergebnis sind getrennt; Argumente und Fehler bleiben erhalten", () => {
  const push = vi.spyOn(window.history, "pushState");
  const { zeilen, stop } = buehne();
  try {
    window.history.pushState(
      { idx: 3, geheim: "NICHT-LOGGEN" },
      "",
      "/erfassen?token=NICHT-LOGGEN",
    );
    expect(push).toHaveBeenCalledWith(
      { idx: 3, geheim: "NICHT-LOGGEN" },
      "",
      "/erfassen?token=NICHT-LOGGEN",
    );
    expect(window.location.pathname).toBe("/erfassen");
    expect(zeilen).toContainEqual(
      expect.objectContaining({ art: "pushState-call", ziel: "/erfassen" }),
    );
    expect(zeilen).toContainEqual(
      expect.objectContaining({ art: "pushState-return", index: 3, pfad: "/erfassen" }),
    );
    expect(() => window.history.pushState({}, "", "https://fremd.invalid/")).toThrow();
    expect(zeilen).toContainEqual(
      expect.objectContaining({ art: "pushState-throw", fehler: "SecurityError" }),
    );
    expect(JSON.stringify(zeilen)).not.toContain("NICHT-LOGGEN");
  } finally {
    stop();
  }
});

it("D3: verspäteter Hinweis und Guard-Dialog werden mit ihrer Reihenfolge erfasst", async () => {
  const { zeilen, stop } = buehne();
  try {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section data-testid="notice-banner"></section>',
    );
    await Promise.resolve();
    document.body.insertAdjacentHTML("beforeend", "<div data-navguard-dialog></div>");
    document.querySelector("header")?.setAttribute("inert", "");
    await Promise.resolve();
    document.querySelector('[data-testid="notice-banner"]')?.remove();
    await Promise.resolve();
    const lagen = zeilen.filter((z) => z.art === "dom");
    expect(lagen.map((z) => [z.hinweis, z.guardDialog, z.kopfbandInert])).toEqual([
      [false, false, false],
      [true, false, false],
      [true, true, true],
      [false, true, true],
    ]);
  } finally {
    stop();
  }
});

it("D4: Abbau stellt die nativen Methoden wieder her und beendet den Mitschnitt", () => {
  const vorher = { push: window.history.pushState, prevent: Event.prototype.preventDefault };
  const { zeilen, stop, link } = buehne();
  stop();
  const anzahl = zeilen.length;
  link.addEventListener("click", (event) => event.preventDefault());
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  expect(zeilen).toHaveLength(anzahl);
  expect(window.history.pushState).toBe(vorher.push);
  expect(Event.prototype.preventDefault).toBe(vorher.prevent);
});
