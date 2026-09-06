// @vitest-environment jsdom
// ================================================================================================
// JOB 3155 · UX-12b — DIE HÜLLE OHNE REITER: KEIN LEERER STREIFEN ÜBER DEM INHALT.
// ================================================================================================
//
// Zustandsmodell des Auftrags (§9, „erfolgreich leer / Fehler"): Ohne `reiter`/`aktiv`/`onWechsel`
// rendert `EinstellungenSeite` schon heute GAR KEINE Leiste — `/profil` ist genau dieser Fall
// (`apps/web/src/pages/Profile.tsx:154` übergibt nur `titel` und `seitenSchluessel`). Die neue
// Breiten-Weiche stapelt Leiste und Inhalt unterhalb von `sm` untereinander; die naheliegende
// Halbheit dabei ist ein leerer Streifen oder eine leere Trennlinie an der Stelle, an der die
// Leiste stünde. Diese Datei nagelt fest, dass die Hülle in diesem Zustand genau EIN Kind trägt.
//
// WAS SIE AUSDRÜCKLICH NICHT IST: eine Breitenmessung. jsdom hat keine Layout-Maschine — jede Zahl
// daraus wäre erfunden. Die Breitenaussage trifft allein
// `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts` an der gebauten App.
import { describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { EinstellungenSeite } from "../../apps/web/src/components/einstellungen/Seite";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Gerendert {
  wurzel: HTMLElement;
  aufraeumen: () => void;
}

function rendere(mitReitern: boolean): Gerendert {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const kind = createElement("p", { "data-testid": "inhalt" }, "Inhalt");
  act(() => {
    root.render(
      mitReitern
        ? createElement(EinstellungenSeite, {
            titel: "Einstellungen",
            seitenSchluessel: "admin",
            reiter: [
              { id: "konten", label: "Konten" },
              { id: "ki", label: "KI" },
            ],
            aktiv: "konten",
            onWechsel: () => {},
            children: kind,
          })
        : createElement(EinstellungenSeite, {
            titel: "Einstellungen",
            seitenSchluessel: "admin",
            children: kind,
          }),
    );
  });
  const wurzel = container.querySelector<HTMLElement>('[data-einst="seite"]');
  if (!wurzel) {
    throw new Error("Die Einstellungshülle wurde nicht gerendert");
  }
  return {
    wurzel,
    aufraeumen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("JOB 3155 UX-12b · die Einstellungshülle ohne Reiterleiste", () => {
  it("Z1 · ohne `reiter` entsteht keine Leiste und kein leerer Streifen über dem Inhalt", () => {
    const { wurzel, aufraeumen } = rendere(false);
    try {
      expect(wurzel.querySelector('[data-einst="reiterspalte"]')).toBeNull();
      expect(wurzel.querySelectorAll('[data-einst="reiter"]').length).toBe(0);
      const spalte = wurzel.querySelector<HTMLElement>('[data-einst="spalte"]');
      expect(spalte, "die Inhaltsspalte fehlt").not.toBeNull();
      const zeile = spalte?.parentElement as HTMLElement;
      // GENAU EIN Kind: kein leerer Kasten, keine leere Trennlinie an der Stelle der Leiste.
      expect(
        zeile.children.length,
        `die Aufteilungszeile trägt ${zeile.children.length} Kinder — ohne Reiter darf nur der Inhalt darin stehen`,
      ).toBe(1);
      expect(zeile.children[0]).toBe(spalte);
      // Und der Inhalt trägt keine Restbreite aus der Weiche: `flex-1` bleibt, `min-w-0` bleibt.
      const klasse = spalte?.getAttribute("class") ?? "";
      expect(klasse).toContain("flex-1");
      expect(klasse).toContain("min-w-0");
    } finally {
      aufraeumen();
    }
  });

  it("Z2 · Kalibrierung: MIT `reiter` steht die Leiste da und die Zeile trägt zwei Kinder", () => {
    const { wurzel, aufraeumen } = rendere(true);
    try {
      const leiste = wurzel.querySelector<HTMLElement>('[data-einst="reiterspalte"]');
      expect(leiste, "die Reiterleiste fehlt").not.toBeNull();
      expect(wurzel.querySelectorAll('[data-einst="reiter"]').length).toBe(2);
      const spalte = wurzel.querySelector<HTMLElement>('[data-einst="spalte"]');
      const zeile = spalte?.parentElement as HTMLElement;
      expect(zeile.children.length).toBe(2);
      // Reiter VOR Inhalt in der Lesereihenfolge — daran hängt die Tabreihenfolge (T1).
      expect(zeile.children[0]).toBe(leiste);
      expect(zeile.children[1]).toBe(spalte);
      // Es gibt genau EINEN Ort, der Reiter zeichnet: kein zweites, „mobiles" Parallelbauteil.
      expect(
        wurzel.querySelectorAll('[data-einst="reiterspalte"]').length,
        "es steht mehr als eine Reiterleiste in der Hülle",
      ).toBe(1);
    } finally {
      aufraeumen();
    }
  });
});
