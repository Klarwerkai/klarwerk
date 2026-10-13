// @vitest-environment jsdom
// ================================================================================================
// PETER NR. 20 (12.10.2026) · DIE SICHTBARE KENNZEICHNUNG UND DER MELDEKNOPF — GEMOUNTET.
// ================================================================================================
//
// Gemessen wird der EINE Baustein, den Detailansicht, Bibliotheks-Lesefläche und Prüfkarte Stufe 2
// gemeinsam benutzen (`components/LesevarianteHinweis.tsx`), in echter i18n-Instanz:
//   · „Maschinelle Lesehilfe — maßgeblich ist das Original" steht sichtbar da,
//   · Originalquelle und belegte Fassung stehen da — oder ausdrücklich „nicht zugeordnet",
//   · die bisherigen Sätze („Übersetzung · Original: Englisch", „keine Freigabe") bleiben,
//   · „Widerspruch melden" sendet NUR mit Begründung und quittiert, ohne Freigabe-Wortlaut.
// Die Datenseite (Routen, Protokolleintrag) misst `kennzeichnung-und-widerspruch-route.test.ts`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { LesevarianteKennzeichnung } from "../../apps/web/src/api/types";
import {
  LesevarianteHinweis,
  bindungsText,
} from "../../apps/web/src/components/LesevarianteHinweis";
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde überall der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BELEGT: LesevarianteKennzeichnung = {
  originalLanguage: "en",
  herkunft: "lokale Lieferung advisor-ict-en-v1",
  quellabgleich: "bestaetigt",
  originalGeaendert: false,
  originalquelle: {
    titel: "Customer brief: Harbor Field Services",
    provider: "Confluence",
    kennung: "25067523",
    url: null,
    quellfassung: 7,
  },
  fassung: { art: "wissensobjekt", version: 3, abdruck: "abcdef123456" },
};

const UNBELEGT: LesevarianteKennzeichnung = {
  originalLanguage: "en",
  herkunft: "lokale Lieferung advisor-ict-en-v1",
  quellabgleich: "unbestaetigt",
  originalGeaendert: true,
  originalquelle: null,
  fassung: null,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function zeige(
  variante: LesevarianteKennzeichnung,
  onWiderspruch?: (begruendung: string) => Promise<unknown>,
): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(LesevarianteHinweis, {
        variante,
        zeigtOriginal: false,
        onUmschalten: () => {},
        ...(onWiderspruch ? { onWiderspruch } : {}),
      }),
    );
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function element(testid: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testid}"]`);
}

async function klicke(testid: string): Promise<void> {
  const el = element(testid);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element „${testid}" fehlt`);
  }
  await act(async () => {
    el.click();
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

async function tippe(wert: string): Promise<void> {
  const feld = element("lesevariante-widerspruch-text");
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Begründungsfeld fehlt");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("Peter Nr. 20 · Kennzeichnung: maschinelle Lesehilfe, Originalquelle, Fassung", () => {
  it("K-a · belegt: alle drei Angaben stehen sichtbar da, die bisherigen Sätze bleiben", async () => {
    await zeige(BELEGT);
    expect(element("lesevariante-maschinell")?.textContent).toBe(
      "Maschinelle Lesehilfe — maßgeblich ist das Original",
    );
    expect(element("lesevariante-originalquelle")?.textContent).toBe(
      "Originalquelle: Customer brief: Harbor Field Services · Confluence 25067523 · Quellfassung 7",
    );
    expect(element("lesevariante-fassung")?.textContent).toBe(
      "Fassung: Original Version 3 (Abdruck abcdef123456)",
    );
    expect(element("lesevariante-originalquelle-fehlt")).toBeNull();
    expect(element("lesevariante-fassung-fehlt")).toBeNull();
    expect(text()).toContain("Übersetzung · Original: Englisch");
    expect(text()).toContain("Übersetzung, keine Freigabe");
  });

  it("K-b · unbelegt: „nicht zugeordnet“ steht ausdrücklich da — nichts wird erfunden", async () => {
    await zeige(UNBELEGT);
    expect(element("lesevariante-originalquelle-fehlt")?.textContent).toBe(
      "Originalquelle nicht zugeordnet",
    );
    expect(element("lesevariante-fassung-fehlt")?.textContent).toContain(
      "Fassung nicht zugeordnet",
    );
    expect(element("lesevariante-originalquelle")).toBeNull();
    expect(element("lesevariante-fassung")).toBeNull();
    // Die übrigen Vorbehalte bleiben daneben stehen.
    expect(element("lesevariante-veraltet")).not.toBeNull();
    expect(element("lesevariante-unbestaetigt")).not.toBeNull();
    expect(element("lesevariante-maschinell")).not.toBeNull();
  });

  it("K-c · auf Englisch dieselbe Kennzeichnung in der Lesesprache", async () => {
    await i18n.changeLanguage("en");
    await zeige(BELEGT);
    expect(element("lesevariante-maschinell")?.textContent).toBe(
      "Machine reading aid — the original prevails",
    );
    expect(element("lesevariante-originalquelle")?.textContent).toContain("Original source:");
  });

  it("K-d · die Kurzformen (Liste, Vorschau) tragen dieselben Angaben als einen Satz", () => {
    const t = i18n.t.bind(i18n) as unknown as Parameters<typeof bindungsText>[1];
    expect(bindungsText(BELEGT, t)).toBe(
      "Maschinelle Lesehilfe — maßgeblich ist das Original · Originalquelle: Customer brief: Harbor Field Services · Confluence 25067523 · Quellfassung 7 · Fassung: Original Version 3 (Abdruck abcdef123456)",
    );
    expect(bindungsText(UNBELEGT, t)).toContain("Originalquelle nicht zugeordnet");
    expect(bindungsText(UNBELEGT, t)).toContain("Fassung nicht zugeordnet");
    // Für den Test von `afterEach` braucht es eine gemountete Wurzel.
    container = document.createElement("div");
    root = createRoot(container);
  });
});

describe("Peter Nr. 20 · Widerspruch melden", () => {
  it("M-a · ohne Meldeweg der Fläche steht kein Meldeknopf da", async () => {
    await zeige(BELEGT);
    expect(element("lesevariante-widerspruch-oeffnen")).toBeNull();
  });

  it("M-b · ohne Begründung wird NICHT gesendet; mit Begründung genau einmal, getrimmt", async () => {
    const gesendet: string[] = [];
    await zeige(BELEGT, async (begruendung) => {
      gesendet.push(begruendung);
      return { gemeldet: true };
    });
    await klicke("lesevariante-widerspruch-oeffnen");
    expect(element("lesevariante-widerspruch-formular")).not.toBeNull();
    await klicke("lesevariante-widerspruch-senden");
    expect(gesendet).toEqual([]);
    expect(text()).toContain("Bitte beschreiben, was sich widerspricht.");
    await tippe("  Die Übersetzung nennt 20 statt 25 Nutzer.  ");
    await klicke("lesevariante-widerspruch-senden");
    expect(gesendet).toEqual(["Die Übersetzung nennt 20 statt 25 Nutzer."]);
    const quittung = element("lesevariante-widerspruch-gemeldet")?.textContent ?? "";
    expect(quittung).toContain("Prüfprotokoll");
    expect(quittung).toContain("Freigabe bleiben unverändert");
    // Die Kennzeichnung selbst bleibt unverändert stehen.
    expect(element("lesevariante-maschinell")).not.toBeNull();
    expect(element("lesevariante-widerspruch-formular")).toBeNull();
  });

  it("M-c · scheitert die Meldung, sagt die Fläche es und behält den Text", async () => {
    await zeige(BELEGT, async () => {
      throw new Error("503");
    });
    await klicke("lesevariante-widerspruch-oeffnen");
    await tippe("Abweichung");
    await klicke("lesevariante-widerspruch-senden");
    expect(element("lesevariante-widerspruch-fehler")?.textContent).toBe(
      "Die Meldung konnte nicht gespeichert werden.",
    );
    expect(element("lesevariante-widerspruch-gemeldet")).toBeNull();
    const feld = element("lesevariante-widerspruch-text") as HTMLTextAreaElement | null;
    expect(feld?.value).toBe("Abweichung");
  });
});
