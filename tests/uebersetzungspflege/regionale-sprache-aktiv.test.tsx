// @vitest-environment jsdom
// ================================================================================================
// FR-I18N-02 · BEN, NACHARBEIT 5 — BEI `fr` UND `fr-CA` IST NUR DIE GEWÄHLTE SPRACHE AKTIV.
// ================================================================================================
//
// Seit im Betrieb angelegte Sprachen wählbar sind, können eine Sprache und ihre regionale Variante
// nebeneinander stehen. Vorher verglichen Kontomenü und Profil mit `startsWith`; bei gewähltem
// `fr-CA` waren damit AUCH `fr` aktiv markiert (`aria-checked`, `aria-pressed`, Hervorhebung).
// Gemessen an den ECHTEN Flächen (`components/SprachSchalter.tsx`, `pages/Profile.tsx` → `SprachWahl`)
// mit der echten i18n-Instanz.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FunctionComponent, act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SprachSchalter, istAktiv } from "../../apps/web/src/components/SprachSchalter";
import i18n from "../../apps/web/src/i18n";
import { setzeAngelegteSprachen } from "../../apps/web/src/lib/instanzSprachen";
import { SprachWahl } from "../../apps/web/src/pages/Profile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function zeichne(element: FunctionComponent): Promise<void> {
  await act(async () => {
    root.render(createElement(element));
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(async () => {
  window.localStorage.clear();
  setzeAngelegteSprachen([
    { kennung: "fr", name: "Français" },
    { kennung: "fr-CA", name: "Français (Canada)" },
  ]);
  await i18n.changeLanguage("fr-CA");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
  setzeAngelegteSprachen([]);
  window.localStorage.clear();
});

describe("BEN Nacharbeit 5 · nur die vollständige Kennung ist aktiv", () => {
  it("R0 · die Regel selbst: fr-CA ist nicht fr, fr ist nicht fr-CA", () => {
    expect(i18n.language, "Vorbedingung: die regionale Variante ist gewählt").toBe("fr-CA");
    expect(istAktiv("fr-CA", "fr-CA")).toBe(true);
    expect(istAktiv("fr-CA", "fr")).toBe(false);
    expect(istAktiv("fr", "fr-CA")).toBe(false);
    expect(istAktiv("de", "de")).toBe(true);
  });

  it("R1 · Kontomenü: genau ein Knopf trägt aria-checked=true — fr-CA", async () => {
    await zeichne(SprachSchalter);
    const knoepfe = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    expect(knoepfe.map((k) => k.getAttribute("data-testid"))).toEqual([
      "sprach-schalter-de",
      "sprach-schalter-en",
      "sprach-schalter-nl",
      "sprach-schalter-fr",
      "sprach-schalter-fr-CA",
    ]);
    const aktiv = knoepfe.filter((k) => k.getAttribute("aria-checked") === "true");
    expect(aktiv.map((k) => k.getAttribute("data-testid"))).toEqual(["sprach-schalter-fr-CA"]);
    // Die sichtbare Hervorhebung folgt derselben Entscheidung.
    const hervorgehoben = knoepfe.filter((k) => k.className.includes("bg-ink"));
    expect(hervorgehoben.map((k) => k.getAttribute("data-testid"))).toEqual([
      "sprach-schalter-fr-CA",
    ]);
  });

  it("R2 · Profil: genau ein Knopf ist gedrückt und hervorgehoben — fr-CA", async () => {
    await zeichne(SprachWahl);
    const knoepfe = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(knoepfe.map((k) => k.textContent)).toEqual(["de", "en", "nl", "fr", "fr-CA"]);
    const gedrueckt = knoepfe.filter((k) => k.getAttribute("aria-pressed") === "true");
    expect(gedrueckt.map((k) => k.textContent)).toEqual(["fr-CA"]);
    const hervorgehoben = knoepfe.filter((k) => k.className.includes("bg-ink"));
    expect(hervorgehoben.map((k) => k.textContent)).toEqual(["fr-CA"]);
  });

  it("R3 · Gegenrichtung: bei gewähltem fr ist fr-CA NICHT aktiv", async () => {
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    await zeichne(SprachSchalter);
    const aktiv = [...container.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')];
    expect(aktiv.map((k) => k.getAttribute("data-testid"))).toEqual(["sprach-schalter-fr"]);
  });
});
