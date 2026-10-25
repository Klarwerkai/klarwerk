// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider, einblenden } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KiLageZeile } from "../../apps/web/src/shell/KiLageZeile";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { ANKER_SPEICHERQUITTUNG, AUSGANG } from "./speicherquittung";

// Nur die Serverauskunft ist fest vorgegeben; KI-Zeile, Toast-Provider und Viewport sind echt.
vi.mock("../../apps/web/src/api/hooks", () => ({
  useKiLage: () => ({ data: { modus: "keine" } }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let wurzel: ReturnType<typeof createRoot> | undefined;

function ausgang(): unknown {
  return new Function(`return (${AUSGANG})()`)();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  wurzel = root;
  await act(async () => {
    root.render(
      createElement(ToastProvider, null, createElement(KiLageZeile), createElement(ToastViewport)),
    );
  });
});

afterEach(async () => {
  await act(async () => wurzel?.unmount());
  wurzel = undefined;
  document.body.replaceChildren();
});

describe("Speicherquittung: eigener Toast statt erstem output", () => {
  it("ordnet bei echter KI-Zeile nur den echten Speicher-Toast zu", async () => {
    const ki = document.querySelector('[data-testid="kopfband-ki-lage"]');
    expect(ki).not.toBeNull();
    expect(document.querySelector("output")).toBe(ki);
    expect(ki?.textContent).toBe(i18n.t("kilage.zeile.keine"));
    expect(document.querySelector(ANKER_SPEICHERQUITTUNG)).toBeNull();
    expect(ausgang()).toBe("");

    const satz = i18n.t("ko.revise.saved");
    await act(async () => einblenden("success", satz));
    const quittung = document.querySelector(ANKER_SPEICHERQUITTUNG);
    expect(quittung).not.toBe(ki);
    expect(quittung?.textContent).toBe(satz);
    expect(ausgang()).toBe(`quittung: ${satz}`);
  });

  it("erhaelt stale/teil vor Fehlerkasten, Einreichpflicht und echtem Toast", async () => {
    const satz = i18n.t("ko.revise.saved");
    await act(async () => einblenden("success", satz));
    const zustaende = document.createElement("div");
    zustaende.innerHTML = `
      <div data-testid="bib-speichern-lage" data-lage="stale"></div>
      <div data-testid="bib-speichern-fehler">Speichern fehlgeschlagen</div>
      <div data-testid="bib-einreichen-pflicht"></div>
    `;
    document.body.prepend(zustaende);
    expect(ausgang()).toBe("lage:stale");
    const lage = zustaende.querySelector('[data-testid="bib-speichern-lage"]');
    lage?.setAttribute("data-lage", "teil");
    expect(ausgang()).toBe("lage:teil");
    lage?.remove();
    expect(ausgang()).toBe("fehlerkasten: Speichern fehlgeschlagen");
    zustaende.querySelector('[data-testid="bib-speichern-fehler"]')?.remove();
    expect(ausgang()).toBe("einreichpflicht");
    zustaende.querySelector('[data-testid="bib-einreichen-pflicht"]')?.remove();
    expect(ausgang()).toBe(`quittung: ${satz}`);
  });

  it("weist fremde outputs ab und behaelt falschen Toasttext", async () => {
    const erwartet = i18n.t("ko.revise.saved");
    const fremd = document.createElement("output");
    fremd.textContent = erwartet;
    document.body.prepend(fremd);
    expect(document.querySelector("output")).toBe(fremd);
    expect(ausgang()).toBe("");

    await act(async () => einblenden("success", "Andere Meldung"));
    expect(ausgang()).toBe("quittung: Andere Meldung");
    expect(ausgang()).not.toBe(`quittung: ${erwartet}`);
    const knopf = document.querySelector(ANKER_SPEICHERQUITTUNG)?.querySelector("button");
    if (!(knopf instanceof HTMLButtonElement)) throw new Error("echter Toast-Schliesser fehlt");
    await act(async () => knopf.click());
    expect(document.querySelector(ANKER_SPEICHERQUITTUNG)).toBeNull();
    expect(fremd.textContent).toBe(erwartet);
    expect(ausgang()).toBe("");
  });
});
