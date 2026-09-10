// @vitest-environment jsdom
// ================================================================================================
// JOB 3511 · L4 — DAS FIRMENLOGO IM KOPFBAND, GEMOUNTET.
// ================================================================================================
//
// Der Auftrag verlangt zweierlei zugleich, und genau die Gleichzeitigkeit ist hier der Prüffall:
// bei aktiver Firmen-CI erscheint das Advisor-Logo mit dem Alternativtext der Originaldatei — UND
// die Produktidentität bleibt erkennbar, das Wort KLARWERK verschwindet nicht.
//
//   L1  Aus / unbekannt   Zeichengleich die bisherige Wortmarke, kein Bild, keine Attrappe.
//   L2  An                Logo neben der Wortmarke, mit `alt` und der Adresse aus dem VERTRAG.
//   L3  Ohne Neuladen     Ein bereits gerendertes Kopfband zieht nach, wenn die Marke umschaltet.
//   L4  Halbe Zustände    Profil ohne Schalter zeigt kein Logo.
//   L5  Die Datei         Die vom Vertrag genannte Adresse liegt wirklich im ausgelieferten Baum.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/client", () => ({ api: { get: vi.fn(), put: vi.fn() } }));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
// Nebenwirkung: initialisiert die eine i18next-Instanz, aus der `NavGuardProvider` seine Texte holt.
import "../../apps/web/src/i18n";
import type { BrandingStand } from "../../apps/web/src/lib/brandTheme";
import { uebernimmBranding } from "../../apps/web/src/lib/brandTheme";
import { Logo } from "../../apps/web/src/shell/Logo";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOGO_PFAD = "/marke/advisor/adv-logo.svg";

/** Wörtlich die Form aus dem Vertrag (Auftrag §5.1). */
const stand = (teile: Partial<BrandingStand> = {}): BrandingStand => ({
  profil: "advisor",
  aktiv: true,
  version: 1,
  marke: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: LOGO_PFAD,
  },
  ...teile,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/**
 * Router UND Navigationswächter — beides ist Pflicht und keine Zierde: `Logo` rendert einen
 * `GuardedLink`, und dessen `useNavGuard` WIRFT ohne Anbieter (`NavGuardContext.tsx:102`). Die
 * Hülle steht im Produkt genauso (AppShell), der Aufbau hier bildet sie ab statt sie zu umgehen.
 */
async function stelleAuf(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(MemoryRouter, null, createElement(NavGuardProvider, null, createElement(Logo))),
    );
  });
}

const marke = (): HTMLElement => {
  const el = container.querySelector(".kw-kopfband-marke");
  expect(el, "die Wortmarke des Kopfbands").not.toBeNull();
  return el as HTMLElement;
};

const bild = (): HTMLImageElement | null =>
  container.querySelector('[data-testid="kopfband-firmenlogo"] img');

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  // Der Stand lebt im Modul; jeder Fall stellt ihn selbst her, der letzte räumt auf.
  uebernimmBranding(stand({ profil: null, aktiv: false, version: 0, marke: null }));
});

describe("JOB 3511 L · das Firmenlogo im Kopfband", () => {
  it("L1 · ohne Firmen-CI steht dort zeichengleich die Wortmarke — und sonst nichts", async () => {
    await stelleAuf();
    expect(marke().textContent).toBe("KLARWERK");
    expect(bild(), "ein Bild, obwohl keine Firmen-CI aktiv ist").toBeNull();
    // Auch die Klassen der Wortmarke bleiben, was das Chromium-Zielbild misst.
    expect(marke().className).toContain("text-[16px]");
    expect(marke().className).toContain("font-[650]");
    expect(marke().getAttribute("aria-label")).toBe("Klarwerk - zur Startseite");
  });

  it("L2 · mit Firmen-CI: das Logo NEBEN der Wortmarke, mit Alternativtext und Vertragsadresse", async () => {
    uebernimmBranding(stand());
    await stelleAuf();
    const img = bild();
    expect(img, "kein Firmenlogo, obwohl die Firmen-CI aktiv ist").not.toBeNull();
    expect(img?.getAttribute("src"), "die Adresse kommt aus dem Vertrag").toBe(LOGO_PFAD);
    expect(img?.getAttribute("alt")).toBe("Advisor ICT solutions logo");
    // DIE PRODUKTIDENTITÄT BLEIBT: das Wort ist noch da.
    expect(marke().textContent).toContain("KLARWERK");
  });

  it("L3 · ein bereits gerendertes Kopfband zieht nach — ohne Neuladen der Seite", async () => {
    await stelleAuf();
    expect(bild()).toBeNull();
    await act(async () => {
      uebernimmBranding(stand({ version: 2 }));
    });
    expect(bild()?.getAttribute("alt")).toBe("Advisor ICT solutions logo");
    await act(async () => {
      uebernimmBranding(stand({ aktiv: false, version: 3 }));
    });
    expect(bild(), "das Logo bleibt nach dem Ausschalten stehen").toBeNull();
    expect(marke().textContent).toBe("KLARWERK");
  });

  it("L4 · ein Profil OHNE Schalter zeigt kein Logo", async () => {
    uebernimmBranding(stand({ aktiv: false, version: 4 }));
    await stelleAuf();
    expect(bild()).toBeNull();
  });

  it("L5 · die vom Vertrag genannte Adresse liegt wirklich im ausgelieferten Baum", () => {
    // Ohne diesen Fall wäre L2 gruen, waehrend das Kopfband ein totes Bild zeigt.
    expect(existsSync(join(__dirname, "../../apps/web/public", LOGO_PFAD))).toBe(true);
  });
});
