// @vitest-environment jsdom
// Aufnahme gesamt-auditprotokoll · R-0613 / R-1085 / package:audit — DAS PRÜFPROTOKOLL, GEMOUNTET.
//
// Gemessen am echten Bauteil `PruefprotokollDetail`:
//   · der Knopf „Kette exportieren" ruft `GET /api/audit/export`, legt die Datei zum Herunterladen
//     an und zeigt danach den Kopf der Kette (Nummer + Hash) im Klartext — das ist der Wert, der
//     außerhalb der Anlage abgelegt wird;
//   · die Zählung und der Prüfknopf (R-1085) stehen weiter da;
//   · die Hilfe der Karte erklärt den Qualitätsbezug (ISO 9001 / ISO/IEC 27001), sagt keine
//     Zertifizierung zu und grenzt die Leistungsbewertung von Personen aus (R-0669).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KOPF_HASH = "a".repeat(64);

vi.mock("../../apps/web/src/api/endpoints", () => {
  const eintrag = {
    seq: 7,
    at: "2026-09-26T10:00:00.000Z",
    actor: "a-1",
    action: "ko.revalidated",
    target: "ko-1",
    payload: { version: 3 },
    prevHash: "p",
    hash: "h",
  };
  return {
    endpoints: {
      audit: {
        // produkt:20261009:admin-audit-verstaendlich: die Karte liest seitenweise.
        seite: vi.fn(async () => ({
          entries: [eintrag],
          nextBefore: null,
          limit: 25,
          objekte: {},
          namensbelege: [],
        })),
        verify: vi.fn(async () => ({ ok: true, count: 1 })),
        exportChain: vi.fn(async () => ({
          format: "klarwerk-audit-export",
          formatVersion: 1,
          exportedAt: "2026-09-26T10:00:01.000Z",
          count: 7,
          head: { seq: 7, hash: "a".repeat(64) },
          inspection: { ok: true, count: 7 },
          entries: [eintrag],
        })),
      },
      directory: { list: vi.fn(async () => [{ id: "a-1", name: "Ada Admin" }]) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { PruefprotokollDetail } from "../../apps/web/src/pages/AdminSicherheitDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const text = (el: Element | null): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            null,
            createElement(PruefprotokollDetail, { onZurueck: () => undefined }),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function knopf(beschriftung: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find((x) => text(x).includes(beschriftung));
  if (!b) {
    throw new Error(`Knopf „${beschriftung}“ fehlt`);
  }
  return b as HTMLButtonElement;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // jsdom kennt keine Objekt-URLs; das Herunterladen selbst ist Browserleistung.
  URL.createObjectURL = vi.fn(() => "blob:audit");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Prüfprotokoll · Export der Kette mit Kopf", () => {
  // produkt:20261009:admin-audit-verstaendlich: die grüne Zählmarke über der geladenen
  // Gesamtliste ist entfallen (seitenweises Lesen, K4/K6); der Seitentitel nennt die Seite. Der
  // Rohcode steht nur noch in den technischen Angaben (K2).
  it("Seitentitel, Prüfknopf und Exportknopf stehen da; der neue Aktionsname ist lesbar", async () => {
    await mount();
    expect(text(container)).toContain(i18n.t("auditprotokoll.tabelle.seite", { shown: 1 }));
    knopf(i18n.t("adm.sich.verify.button"));
    knopf(i18n.t("adm.sich.export.button"));
    expect(text(container)).toContain("Neu validiert (stimmt noch)");
    const spalten = container.querySelector("tbody")?.cloneNode(true) as HTMLElement;
    for (const technik of spalten.querySelectorAll("[data-audit-technik]")) {
      technik.remove();
    }
    expect(text(spalten)).not.toContain("ko.revalidated");
    expect(text(container.querySelector('[data-audit-kennung="action"]'))).toBe("ko.revalidated");
  });

  it("der Export ruft die Kette ab, lädt sie herunter und zeigt den Kopf", async () => {
    const klick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await mount();
    await act(async () => {
      knopf(i18n.t("adm.sich.export.button")).click();
      await flush();
    });
    expect(endpoints.audit.exportChain).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(klick).toHaveBeenCalledTimes(1);
    const kopf = container.querySelector('[data-testid="audit-export-kopf"]');
    expect(text(kopf)).toContain(KOPF_HASH);
    expect(text(kopf)).toContain("Nr. 7");
    // Nach dem Export frisch gelesen: der Abruf hat selbst einen Eintrag angehängt.
    expect(
      (endpoints.audit.seite as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
    klick.mockRestore();
  });
});

describe("package:audit · der Hilfetext nennt den Qualitätsbezug ohne Zertifizierungszusage", () => {
  it.each(["de", "en", "nl"])("%s", async (sprache) => {
    await i18n.changeLanguage(sprache);
    const hinweis = i18n.t("adm.sich.qualityNote");
    expect(hinweis).not.toBe("adm.sich.qualityNote");
    expect(hinweis).toContain("ISO 9001");
    expect(hinweis).toContain("ISO/IEC 27001");
    // Die Zusage wird ausdrücklich verneint, nicht gegeben.
    expect(hinweis).toMatch(/keine zu\.|does not promise one|belooft er geen/);
    await i18n.changeLanguage("de");
  });
});
