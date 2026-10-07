// @vitest-environment jsdom
// produkt:wettbewerb:20261003:lernplattform — DER KURZE BEDIENWEG, gemountet.
//
// Gemessen wird der Baustein `ScormUebergabe` mit attrappierten Endpunkten: er schickt GENAU die
// gewählte Reihenfolge, übernimmt den ersten freigegebenen Empfänger, gibt den Download erst nach
// einer freigebenden Prüfung frei, zeigt Befunde getrennt nach Inhalts- und Empfängerfreigabe und
// sagt nach dem Download ausdrücklich, dass das Paket noch NICHT in der Lernplattform eingespielt
// ist (K5, K7, K8 an der Oberfläche). Ob der Server richtig urteilt, messen paket.test.ts und
// routen.test.ts — hier steht die Anzeige seines Urteils.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  urteil: "frei" as "frei" | "gesperrt",
  pruefAufrufe: [] as unknown[],
  paketAufrufe: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    output: {
      scormPruefen: vi.fn(async (body: { empfaenger: string }) => {
        box.pruefAufrufe.push(body);
        const empfaenger = [{ id: "moodle-referenz", label: "Moodle 4.5 Referenz" }];
        const format = {
          standard: "SCORM 1.2",
          schemaversion: "1.2",
          paketart: "SCORM 1.2 Content Package (PIF, ZIP) mit genau einem SCO",
          referenzLms: "Moodle 4.5 LTS",
          netz: "keine",
          rueckkanal: "keiner",
        };
        if (box.urteil === "gesperrt") {
          return {
            exportierbar: false,
            format,
            empfaenger,
            fassung: null,
            befunde: [
              {
                code: "MEDIA_MISSING",
                schwere: "blockiert",
                bereich: "medien",
                koId: "K2",
                detail: "ventil.png",
              },
              {
                code: "RECIPIENT_NOT_ALLOWED",
                schwere: "blockiert",
                bereich: "empfaenger",
                detail: body.empfaenger,
              },
            ],
          };
        }
        return {
          exportierbar: body.empfaenger === "moodle-referenz",
          format,
          empfaenger,
          befunde: [
            {
              code: "ATTACHMENTS_NOT_INCLUDED",
              schwere: "hinweis",
              bereich: "medien",
              koId: "K1",
              detail: "protokoll.pdf",
            },
          ],
          fassung: {
            kennung: "abcdef0123456789",
            manifestId: "KLARWERK-SCORM12-abcdef0123456789",
            titel: "Schulungsunterlage",
            sprache: "de",
            objekte: [],
            dateiname: "klarwerk-scorm12-schulungsunterlage-abcdef0123456789.zip",
          },
        };
      }),
      scormPaket: vi.fn(async (body: unknown) => {
        box.paketAufrufe.push(body);
        return {
          blob: new Blob(["PK"]),
          dateiname: "klarwerk-scorm12-schulungsunterlage-abcdef0123456789.zip",
        };
      }),
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
import { ScormUebergabe } from "../../apps/web/src/components/ScormUebergabe";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function baum(koIds: string[]) {
  return createElement(
    QueryClientProvider,
    { client: qc },
    createElement(ToastProvider, null, createElement(ScormUebergabe, { koIds })),
  );
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koIds: string[]): Promise<HTMLDivElement> {
  const c = document.createElement("div");
  document.body.appendChild(c);
  container = c;
  const r = createRoot(c);
  root = r;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(baum(koIds));
    await flush();
  });
  return c;
}

function knopf(c: HTMLElement, schluessel: string): HTMLButtonElement {
  const b = [...c.querySelectorAll("button")].find((x) =>
    (x.textContent ?? "").includes(i18n.t(schluessel)),
  );
  if (!b) {
    throw new Error(`Knopf ${schluessel} fehlt`);
  }
  return b;
}

async function klick(b: HTMLElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.urteil = "frei";
  box.pruefAufrufe = [];
  box.paketAufrufe = [];
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:klarwerk-test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  if (root && container) {
    const r = root;
    act(() => r.unmount());
    container.remove();
  }
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("Bedienweg „An Lernplattform übergeben“", () => {
  it("prüft in der gewählten Reihenfolge, übernimmt den Empfänger und gibt erst dann den Download frei", async () => {
    const c = await mount(["K2", "K1"]);
    expect(c.textContent).toContain(i18n.t("lmsexport.grenzen"));
    expect(knopf(c, "lmsexport.herunterladen").disabled).toBe(true);

    await klick(knopf(c, "lmsexport.pruefen"));
    // Erst ohne Empfänger, dann automatisch mit dem ersten freigegebenen.
    expect(box.pruefAufrufe).toEqual([
      { koIds: ["K2", "K1"], sprache: "de", empfaenger: "" },
      { koIds: ["K2", "K1"], sprache: "de", empfaenger: "moodle-referenz" },
    ]);
    expect(c.textContent).toContain(
      i18n.t("lmsexport.exportierbar", { kennung: "abcdef0123456789" }),
    );
    // Was nicht mitgeht, steht als Hinweis da — mit Bereich und Datei.
    expect(c.textContent).toContain(i18n.t("lmsexport.befund.ATTACHMENTS_NOT_INCLUDED"));
    expect(c.textContent).toContain("protokoll.pdf");

    const laden = knopf(c, "lmsexport.herunterladen");
    expect(laden.disabled).toBe(false);
    await klick(laden);
    expect(box.paketAufrufe).toEqual([
      { koIds: ["K2", "K1"], sprache: "de", empfaenger: "moodle-referenz" },
    ]);
    // Inhaltsübergabe ist NICHT Veröffentlichung in der Lernplattform — das sagt die Meldung, und
    // zwar als BLEIBENDE Zeile im Kasten (der Toast verschwindet nach Sekunden und wird von
    // `ToastProvider` selbst gar nicht gezeichnet, sondern von der App-Hülle).
    const meldung = c.querySelector("[data-testid='scorm-uebergeben']");
    expect(meldung?.textContent).toBe(
      i18n.t("lmsexport.heruntergeladen", {
        datei: "klarwerk-scorm12-schulungsunterlage-abcdef0123456789.zip",
      }),
    );
  });

  it("zeigt blockierende Befunde getrennt nach Medien und Empfängerfreigabe; kein Download", async () => {
    box.urteil = "gesperrt";
    const c = await mount(["K2"]);
    await klick(knopf(c, "lmsexport.pruefen"));
    expect(c.textContent).toContain(i18n.t("lmsexport.blockiert"));
    expect(c.textContent).toContain(
      `${i18n.t("lmsexport.bereich.medien")} · ${i18n.t("lmsexport.befund.MEDIA_MISSING")}`,
    );
    expect(c.textContent).toContain(
      `${i18n.t("lmsexport.bereich.empfaenger")} · ${i18n.t("lmsexport.befund.RECIPIENT_NOT_ALLOWED")}`,
    );
    expect(knopf(c, "lmsexport.herunterladen").disabled).toBe(true);
    expect(box.paketAufrufe).toEqual([]);
  });

  it("eine geänderte Reihenfolge macht das alte Urteil ungültig", async () => {
    const c = await mount(["K1", "K2"]);
    await klick(knopf(c, "lmsexport.pruefen"));
    expect(knopf(c, "lmsexport.herunterladen").disabled).toBe(false);
    const r = root;
    if (!r) {
      throw new Error("nicht gemountet");
    }
    await act(async () => {
      r.render(baum(["K2", "K1"]));
      await flush();
    });
    expect(knopf(c, "lmsexport.herunterladen").disabled).toBe(true);
  });
});
