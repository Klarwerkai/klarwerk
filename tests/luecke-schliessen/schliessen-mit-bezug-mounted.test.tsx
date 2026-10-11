// @vitest-environment jsdom
// ================================================================================================
// R-0846 / L6 — DER PRODUKTIVE SCHLIESSWEG TRÄGT DEN OBJEKTBEZUG.
// ================================================================================================
//
// Ben, Nacharbeit 4: Die Seite „Risiko & Lücken" schloss eine Lücke mit `{ close: true }` — ohne
// Objektbezug. Jetzt wählt man beim Schliessen das Wissensobjekt, das die Lücke beantwortet, und
// genau diese Kennung geht an den Server. Ob sie gilt, entscheidet der Server (`AskService.closeGap`,
// Fälle in services/ask/src/service.test.ts und tests/datenintegritaet/datenintegritaet-pg F5);
// lehnt er ab, sagt die Zeile es, und die Lücke bleibt offen.
//
//   S1 — Die Auswahl nennt die Wissensobjekte; gewählt wird, gesendet wird (Lücke, Objekt).
//   S2 — Lehnt der Server ab, steht die Ablehnung an der Zeile.
//   S3 — Ohne Wissensobjekte lässt sich nicht schliessen (die Auswahl ist gesperrt).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  kos: [] as unknown[],
  schliessen: vi.fn(async (_id: string, _koId: string): Promise<unknown> => ({})),
  // R-0953 (Nacharbeit 4): die drei übrigen Lückenaktionen, damit ihr Fehlerweg messbar ist.
  zuweisen: vi.fn(async (_id: string, _expertId: string): Promise<unknown> => ({})),
  priorisieren: vi.fn(async (_id: string, _priority: string): Promise<unknown> => ({})),
  loeschen: vi.fn(async (_id: string): Promise<unknown> => undefined),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      conflicts: { list: ok([]) },
      gaps: {
        list: ok([
          {
            id: "gap-1",
            question: "Wie wechsle ich das Ventil?",
            status: "offen",
            assignee: null,
            priority: "mittel",
            createdAt: "2026-10-01T08:00:00.000Z",
          },
        ]),
        summary: ok({ open: 1, byPriority: { hoch: 0, mittel: 1, niedrig: 0 } }),
        close: lage.schliessen,
        assign: lage.zuweisen,
        setPriority: lage.priorisieren,
        remove: lage.loeschen,
      },
      ko: { list: vi.fn(async () => lage.kos) },
      directory: { list: ok([{ id: "u-tom", name: "Tom Beispiel" }]) },
      analytics: { busfactor: ok([]), expertise: ok([]) },
      aiCheck: {
        coverageSummary: ok({ total: 0, incomplete: 0, unchecked: 0, noCoverage: 0 }),
      },
      lifecycle: { pending: ok([]) },
      management: {
        riskHorizon: ok({ generatedAt: "", seesAll: true, areas: [] }),
        profiles: ok({ categories: [], retirement: [] }),
      },
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Risk } from "../../apps/web/src/pages/Risk";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const VENTIL = {
  id: "ko-ventil",
  title: "Ventilwechsel an Anlage 1",
  category: "Anlage 1",
  status: "validiert",
  author: "pia",
  originalAuthor: "pia",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/risiko"] },
                createElement(Risk),
                createElement(ToastViewport),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function auswahl(): HTMLSelectElement {
  const feld = container.querySelector<HTMLSelectElement>('[data-testid="luecke-schliessen"]');
  if (!feld) {
    throw new Error("Die Schliessauswahl der Lücke fehlt.");
  }
  return feld;
}

async function waehle(koId: string): Promise<void> {
  await act(async () => {
    const feld = auswahl();
    feld.value = koId;
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(flush);
}

beforeEach(async () => {
  lage.kos = [VENTIL];
  lage.schliessen.mockReset();
  lage.schliessen.mockImplementation(async () => ({}));
  lage.zuweisen.mockReset();
  lage.zuweisen.mockImplementation(async () => ({}));
  lage.priorisieren.mockReset();
  lage.priorisieren.mockImplementation(async () => ({}));
  lage.loeschen.mockReset();
  lage.loeschen.mockImplementation(async () => undefined);
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0846 / L6 · Schliessen einer Wissenslücke mit Objektbezug", () => {
  it("S1 · die Auswahl nennt das Wissensobjekt, und gesendet wird Lücke plus Objekt", async () => {
    await mount();
    const optionen = Array.from(auswahl().options, (o) => o.textContent);
    expect(optionen).toContain("Ventilwechsel an Anlage 1");
    expect(auswahl().disabled).toBe(false);

    await waehle("ko-ventil");
    expect(lage.schliessen).toHaveBeenCalledTimes(1);
    expect(lage.schliessen).toHaveBeenCalledWith("gap-1", "ko-ventil");
  });

  it("S2 · lehnt der Server den Bezug ab, steht die Ablehnung an der Zeile", async () => {
    lage.schliessen.mockImplementation(async () => {
      throw new Error("BAD_REQUEST");
    });
    await mount();
    await waehle("ko-ventil");
    const meldung = container.querySelector('[data-testid="luecke-zeile"] [role="alert"]');
    expect(meldung?.textContent).toBe(i18n.t("risk.closeFailed"));
  });

  it("S3 · ohne Wissensobjekte ist die Auswahl gesperrt — geschlossen wird nichts", async () => {
    lage.kos = [];
    await mount();
    expect(auswahl().disabled).toBe(true);
    expect(lage.schliessen).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------------------------------------
// R-0953 (Bestandsabgleich, Nacharbeit 4): Zuweisen, Priorisieren und Löschen scheiterten STILL —
// die Auswahl sprang zurück, und niemand erfuhr warum. Jetzt melden alle Lückenaktionen Erfolg
// und Fehler als Einblendung über den Benachrichtigungs-Bus.
// ------------------------------------------------------------------------------------------------
const einblendungen = (): string[] =>
  Array.from(container.querySelectorAll("output"), (o) => (o.textContent ?? "").trim());

async function waehleIn(feld: HTMLSelectElement | null | undefined, wert: string): Promise<void> {
  if (!feld) {
    throw new Error("Auswahlfeld fehlt");
  }
  await act(async () => {
    feld.value = wert;
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(flush);
}

const zeile = (): Element | null => container.querySelector('[data-testid="luecke-zeile"]');

async function klickeIn(knopf: Element | null | undefined): Promise<void> {
  expect(knopf, "Vorbedingung: „Erneut versuchen“ steht an der Zeile").not.toBeNull();
  await act(async () => {
    (knopf as HTMLElement | null | undefined)?.click();
  });
  await act(flush);
}
const prioritaetsfeld = (): HTMLSelectElement | null | undefined =>
  zeile()?.querySelector<HTMLSelectElement>(`select[title="${i18n.t("risk.priorityLabel")}"]`);
const zuweisungsfeld = (): HTMLSelectElement | undefined =>
  Array.from(zeile()?.querySelectorAll("select") ?? []).find(
    (s) => s.options[0]?.textContent === i18n.t("risk.assign"),
  );
const loeschknopf = (): HTMLButtonElement | null | undefined =>
  zeile()?.querySelector<HTMLButtonElement>(`button[title="${i18n.t("risk.delete")}"]`);

describe("R-0953 · die Lückenaktionen melden Erfolg und Fehler", () => {
  it("E1 · Priorität: Fehler als Einblendung, danach Erfolg als Einblendung", async () => {
    lage.priorisieren.mockImplementationOnce(async () => {
      throw new Error("Pruefstand: Priorität gestoert");
    });
    await mount();
    await waehleIn(prioritaetsfeld(), "hoch");
    expect(lage.priorisieren).toHaveBeenCalledWith("gap-1", "hoch");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.priorityFailed"));
    // R-0956 (Ben, Nacharbeit 7): die Wahl bleibt nach dem Fehler stehen …
    expect(prioritaetsfeld()?.value, "die gewählte Priorität bleibt").toBe("hoch");
    // … und „Erneut versuchen“ sendet genau sie noch einmal.
    await klickeIn(zeile()?.querySelector('[data-testid="luecke-erneut-prioritaet"]'));
    expect(lage.priorisieren).toHaveBeenCalledTimes(2);
    expect(lage.priorisieren).toHaveBeenLastCalledWith("gap-1", "hoch");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.prioritySaved"));
    expect(zeile()?.querySelector('[data-testid="luecke-erneut-prioritaet"]')).toBeNull();
  });

  it("E2 · Zuweisen: Fehler als Einblendung, danach Erfolg als Einblendung", async () => {
    lage.zuweisen.mockImplementationOnce(async () => {
      throw new Error("Pruefstand: Zuweisung gestoert");
    });
    await mount();
    await waehleIn(zuweisungsfeld(), "u-tom");
    expect(lage.zuweisen).toHaveBeenCalledWith("gap-1", "u-tom");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.assignFailed"));
    // R-0956 (Ben, Nacharbeit 7): die gewählte Person steht weiter im Feld …
    expect(zuweisungsfeld()?.value, "die gewählte Person bleibt").toBe("u-tom");
    // … und „Erneut versuchen“ sendet genau sie noch einmal.
    await klickeIn(zeile()?.querySelector('[data-testid="luecke-erneut-person"]'));
    expect(lage.zuweisen).toHaveBeenCalledTimes(2);
    expect(lage.zuweisen).toHaveBeenLastCalledWith("gap-1", "u-tom");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.assigned"));
  });

  it("E5 · Schliessen: das gewählte Objekt bleibt nach dem Fehler stehen und lässt sich erneut senden", async () => {
    lage.schliessen.mockImplementationOnce(async () => {
      throw new Error("BAD_REQUEST");
    });
    await mount();
    await waehle("ko-ventil");
    expect(auswahl().value, "das gewählte Objekt bleibt").toBe("ko-ventil");
    await klickeIn(zeile()?.querySelector('[data-testid="luecke-erneut-schliessen"]'));
    expect(lage.schliessen).toHaveBeenCalledTimes(2);
    expect(lage.schliessen).toHaveBeenLastCalledWith("gap-1", "ko-ventil");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.closed"));
  });

  it("E3 · Löschen: Fehler als Einblendung, die Lücke bleibt; danach Erfolg als Einblendung", async () => {
    lage.loeschen.mockImplementationOnce(async () => {
      throw new Error("Pruefstand: Loeschen gestoert");
    });
    await mount();
    await act(async () => {
      loeschknopf()?.click();
    });
    await act(flush);
    expect(lage.loeschen).toHaveBeenCalledWith("gap-1");
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.removeFailed"));
    expect(zeile(), "die Lücke steht weiter da").not.toBeNull();

    await act(async () => {
      loeschknopf()?.click();
    });
    await act(flush);
    expect(einblendungen()).toContain(i18n.t("risk.gapToast.removed"));
  });

  it("E4 · Schliessen: der Fehler steht an der Zeile UND als Einblendung", async () => {
    lage.schliessen.mockImplementation(async () => {
      throw new Error("BAD_REQUEST");
    });
    await mount();
    await waehle("ko-ventil");
    expect(einblendungen()).toContain(i18n.t("risk.closeFailed"));
  });
});
