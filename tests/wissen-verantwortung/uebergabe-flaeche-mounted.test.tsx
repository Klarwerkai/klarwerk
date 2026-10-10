// @vitest-environment jsdom
// ================================================================================================
// R-0554 / R-2128 — DIE ÜBERGABE IN DER VERWALTUNG: ERST VORSCHAU, DANN DER ZUG, DANN DAS ERGEBNIS.
// ================================================================================================
//
// Gemountet wird die echte Komponente `Wissensuebergabe`; das Netz darunter ist ein Doppel, das
// jeden Aufruf mitschreibt. Gemessen wird: ohne Nachfolger keine Vorschau; die Vorschau zeigt die
// Mengen je Art und die Titel; erst danach steht „Jetzt übergeben" da; ein Wechsel des Nachfolgers
// verwirft die Vorschau; das Ergebnis nennt gescheiterte Schritte.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netz = vi.hoisted(() => ({
  aufrufe: [] as { weg: string; von: string; an: string }[],
  fehlgeschlagen: [] as { art: string; id: string; grund: string }[],
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    lifecycle: {
      uebergabeVorschau: async (von: string, an: string) => {
        netz.aufrufe.push({ weg: "vorschau", von, an });
        return {
          von,
          an,
          wissensobjekte: [{ id: "ko-1", title: "Kühlwasserfilter spülen" }],
          eigentum: [{ id: "ko-2", title: "Druckluft entlüften" }],
          papierkorb: [],
          entwuerfe: [{ id: "d-1" }],
          luecken: [],
          pruefaufgaben: [{ koId: "ko-3" }, { koId: "ko-4" }],
        };
      },
      uebergeben: async (von: string, an: string) => {
        netz.aufrufe.push({ weg: "uebergeben", von, an });
        return {
          von,
          an,
          uebergeben: {
            wissensobjekt: 1,
            eigentum: 1,
            papierkorb: 0,
            entwurf: 1,
            luecke: 0,
            pruefaufgabe: 2,
          },
          fehlgeschlagen: netz.fehlgeschlagen,
        };
      },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Wissensuebergabe } from "../../apps/web/src/components/Wissensuebergabe";
import i18n from "../../apps/web/src/i18n";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
};

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

function knopf(beschriftung: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => text(b) === beschriftung,
    ) ?? null
  );
}

async function klicken(b: HTMLButtonElement | null): Promise<void> {
  expect(b).not.toBeNull();
  await act(async () => {
    (b as HTMLButtonElement).click();
  });
  await flush();
}

async function waehlen(wert: string): Promise<void> {
  const feld = container.querySelector<HTMLSelectElement>("[data-wissensuebergabe-an]");
  await act(async () => {
    (feld as HTMLSelectElement).value = wert;
    (feld as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

async function montieren(): Promise<void> {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(Wissensuebergabe, {
            von: "anna",
            kandidaten: [
              { id: "anna", name: "Anna Geht" },
              { id: "bert", name: "Bert Nachfolger" },
              { id: "clara", name: "Clara" },
            ],
          }),
        ),
      ),
    );
  });
  await flush();
}

beforeEach(async () => {
  netz.aufrufe.length = 0;
  netz.fehlgeschlagen = [];
  await montieren();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const t = (k: string, o?: Record<string, unknown>): string => (o ? i18n.t(k, o) : i18n.t(k));

describe("R-0554 · Übergabe in der Verwaltung", () => {
  it("Ü1 · die ausscheidende Person ist kein wählbarer Nachfolger; ohne Wahl keine Vorschau", () => {
    const optionen = [...container.querySelectorAll("[data-wissensuebergabe-an] option")].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(optionen).toEqual(["", "bert", "clara"]);
    expect(knopf(t("verantwortung.uebergabe.vorschau"))?.disabled).toBe(true);
    expect(knopf(t("verantwortung.uebergabe.ausfuehren"))).toBeNull();
  });

  it("Ü2 · Vorschau zeigt Mengen und Titel — erst danach lässt sich übergeben", async () => {
    await waehlen("bert");
    await klicken(knopf(t("verantwortung.uebergabe.vorschau")));
    expect(netz.aufrufe).toEqual([{ weg: "vorschau", von: "anna", an: "bert" }]);
    const vorschau = text(container.querySelector("[data-wissensuebergabe-vorschau]"));
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.entwurf")}: 1`);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.pruefaufgabe")}: 2`);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.luecke")}: 0`);
    expect(vorschau).toContain("Kühlwasserfilter spülen");
    expect(vorschau).toContain("Druckluft entlüften");

    await klicken(knopf(t("verantwortung.uebergabe.ausfuehren")));
    expect(netz.aufrufe.at(-1)).toEqual({ weg: "uebergeben", von: "anna", an: "bert" });
    const ergebnis = text(container.querySelector("[data-wissensuebergabe-ergebnis]"));
    expect(ergebnis).toContain(`${t("verantwortung.uebergabe.art.wissensobjekt")}: 1`);
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("Ü3 · ein Wechsel des Nachfolgers verwirft die Vorschau", async () => {
    await waehlen("bert");
    await klicken(knopf(t("verantwortung.uebergabe.vorschau")));
    expect(knopf(t("verantwortung.uebergabe.ausfuehren"))).not.toBeNull();
    await waehlen("clara");
    expect(container.querySelector("[data-wissensuebergabe-vorschau]")).toBeNull();
    expect(knopf(t("verantwortung.uebergabe.ausfuehren"))).toBeNull();
  });

  it("Ü4 · gescheiterte Schritte werden benannt, nicht verschwiegen", async () => {
    netz.fehlgeschlagen = [{ art: "entwurf", id: "d-1", grund: "geändert" }];
    await waehlen("bert");
    await klicken(knopf(t("verantwortung.uebergabe.vorschau")));
    await klicken(knopf(t("verantwortung.uebergabe.ausfuehren")));
    expect(text(container.querySelector("[role=alert]"))).toBe(
      t("verantwortung.uebergabe.teilweise", { anzahl: 1 }),
    );
  });
});
