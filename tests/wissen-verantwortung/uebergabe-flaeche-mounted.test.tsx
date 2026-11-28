// @vitest-environment jsdom
// ================================================================================================
// R-0554 / R-2128 — DIE VORSCHAU DER ÜBERGABE: MENGEN JE ART UND DIE TITEL, IN DER EINEN DARSTELLUNG.
// ================================================================================================
//
// Gesamtcheck R-1329 (Aufrufer-Wächter, Nacharbeit 41): bis hierher montierte diese Datei die
// Komponente `Wissensuebergabe` — eine eigene Übergabefläche, die seit ADMIN-05 nirgends mehr
// montiert war (beide Wege laufen über EINEN Einstieg, `UebergabeAblauf.tsx`). Sie ist entfernt.
// Ihre vier Zusagen sind am lebenden Weg gemessen:
//   · Ü1 (kein Bestätigen ohne vollständige Wahl) und Ü4 (gescheiterte Schritte benannt):
//     `tests/uebergabe-ablauf/einstieg-mounted.test.tsx`, K2 und K4;
//   · Ü3 (ein Wechsel des Nachfolgers verwirft die Vorschau): dort der Fall „Ü3“;
//   · Ü2 (die Vorschau zeigt Mengen je Art und die Titel): HIER, an `UebergabeVorschauInhalt` —
//     der Darstellung, die weiterhin montiert ist (Konto entfernen mit Nachfolger,
//     `pages/AdminKontenDetails.tsx`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { UebergabeVorschau } from "../../apps/web/src/api/types";
import { UebergabeVorschauInhalt } from "../../apps/web/src/components/Wissensuebergabe";
import i18n from "../../apps/web/src/i18n";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const t = (k: string): string => i18n.t(k);

async function montieren(vorschau: UebergabeVorschau): Promise<void> {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("de");
  await act(async () => {
    root.render(createElement(UebergabeVorschauInhalt, { vorschau }));
  });
}

const VORSCHAU: UebergabeVorschau = {
  von: "anna",
  an: "bert",
  wissensobjekte: [{ id: "ko-1", title: "Kühlwasserfilter spülen" }],
  eigentum: [{ id: "ko-2", title: "Druckluft entlüften" }],
  papierkorb: [],
  entwuerfe: [{ id: "d-1" }],
  luecken: [],
  pruefaufgaben: [{ koId: "ko-3" }, { koId: "ko-4" }],
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("R-0554 · Ü2 · die Vorschau der Übergabe", () => {
  it("Ü2 · Mengen je Art und die Titel der Beiträge", async () => {
    await montieren(VORSCHAU);
    const vorschau = text(container);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.entwurf")}: 1`);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.pruefaufgabe")}: 2`);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.luecke")}: 0`);
    expect(vorschau).toContain("Kühlwasserfilter spülen");
    expect(vorschau).toContain("Druckluft entlüften");
    // Je Art genau eine Zeile — die Menge wird nicht doppelt ausgesagt.
    expect(
      [...container.querySelectorAll("[data-wissensuebergabe-art]")].map((e) =>
        e.getAttribute("data-wissensuebergabe-art"),
      ),
    ).toEqual(["wissensobjekt", "eigentum", "papierkorb", "entwurf", "luecke", "pruefaufgabe"]);
  });

  it("Ü2 · ohne Übergabegegenstand sagt die Vorschau das, statt Nullen aufzulisten", async () => {
    await montieren({
      ...VORSCHAU,
      wissensobjekte: [],
      eigentum: [],
      entwuerfe: [],
      pruefaufgaben: [],
    });
    expect(text(container)).toBe(t("verantwortung.uebergabe.leer"));
    expect(container.querySelector("[data-wissensuebergabe-art]")).toBeNull();
  });
});
