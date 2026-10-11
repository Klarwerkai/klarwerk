// @vitest-environment jsdom
// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · EINE EINZELNE ZUSTIMMUNG — STIMME UND WAS NOCH FEHLT.
// ================================================================================================
//
// Originalkriterium dieses Prüfstands:
//   K1 · Einzelne Zustimmung zeigt Stimme und verbleibende erforderliche Bewertungen, ohne
//        vollständige Validierung zu behaupten.
//
// Bauform wie `apps/web/src/pages/Validation.quittung.test.tsx`: die echte Prüffläche, der
// Serverweg `endpoints.ko.act` liefert hier die Antwortform von `ValidationService.rate`
// (`up`, `warn`, `down`, `trust`, `status`) — dieselben Felder, die die Route nach einer Bewertung
// sendet (`ko-routes.ts`, `case "rate"`). „Validiert" darf die Quittung NUR sagen, wenn diese
// Antwort `status: "validiert"` trägt.
//
// GEGENPROBE (benannt, nicht gefahren): in `zustimmungsquittung` den Zweig `validiert` an
// `rest === 0` statt an `lage.validiert` hängen → Fall Q4 wird rot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({
  kos: [] as unknown[],
  /** Die Antwort des Bewertungsaufrufs. */
  antwort: {} as unknown,
  aufrufe: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
    useLibrarySearch: () => ok([]),
  };
});

vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => undefined }),
}));

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/api/endpoints")>();
  return {
    ...echt,
    endpoints: {
      ...echt.endpoints,
      ko: {
        ...echt.endpoints.ko,
        act: (id: string, body: unknown) => {
          lage.aufrufe.push({ id, body });
          return Promise.resolve(lage.antwort);
        },
        aiCheckRetry: () => Promise.resolve({ status: "pending" }),
        remove: () => Promise.resolve(undefined),
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
import i18n from "../../apps/web/src/i18n";
import { stimmenlageAus, zustimmungsquittung } from "../../apps/web/src/lib/reviewDecision";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function de(key: string, werte?: Record<string, unknown>): string {
  return String(i18n.t(key, { lng: "de", ...werte }));
}

/** Ein eingestuftes, offenes Objekt — der unveränderte Ein-Klick-Weg „Freigeben". */
function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Zu prüfendes Wissen",
    statement: "Eine Aussage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-10-07T00:00:00.000Z",
    history: [],
    confidentiality: "intern",
    confidentialityProvenance: "ko",
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Die reinen Fälle (Teil A) montieren nichts — dann gibt es auch nichts abzubauen.
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function mount(): void {
  lage.kos = [ko()];
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  container = c;
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
}

function freigebenKnopf(): HTMLButtonElement {
  const treffer = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
    (b.textContent ?? "").includes(de("val.actionApprove")),
  );
  if (!treffer) {
    throw new Error("Kein Freigeben-Knopf auf der Fläche.");
  }
  return treffer as HTMLButtonElement;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

function quittung(): HTMLElement | null {
  return (container ?? document.body).querySelector<HTMLElement>(
    '[data-testid="pruefen-quittung"]',
  );
}

const inhalt = (e: Element | null) => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

beforeEach(async () => {
  lage.antwort = {};
  lage.aufrufe = [];
  await i18n.changeLanguage("de");
});

afterEach(() => {
  const r = root;
  if (r) {
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  lage.kos = [];
});

describe("A · K1 — die Ableitung liest die Stimmenlage, sie rechnet keine Validierung aus", () => {
  it("offen: Stimme, Erforderliches und Fehlendes", () => {
    const q = zustimmungsquittung(
      stimmenlageAus({ up: 1, warn: 0, down: 0, trust: 33, status: "offen" }, 3),
    );
    expect(q).toEqual({
      art: "offen",
      schluessel: "statusfreigabe.zustimmung.offen",
      werte: { count: 2, have: 1, need: 3 },
    });
    expect(de(q.schluessel, q.werte)).toContain("1 von 3");
    expect(de(q.schluessel, q.werte)).toContain("noch nicht validiert");
  });

  it("validiert nur mit `status: validiert` — eine erreichte Zahl allein genügt nicht", () => {
    expect(
      zustimmungsquittung(stimmenlageAus({ up: 3, warn: 0, down: 0, status: "validiert" }, 3)).art,
    ).toBe("validiert");
    // Drei grüne, aber der Server meldet „offen" (etwa: Bedarf inzwischen erhöht): kein „validiert".
    const offen = zustimmungsquittung(
      stimmenlageAus({ up: 3, warn: 0, down: 0, status: "offen" }, 3),
    );
    expect(offen.art).toBe("offen");
    expect(de(offen.schluessel, offen.werte)).toContain("noch nicht validiert");
  });

  it("rot blockiert; ohne Stimmenlage ehrlich unbekannt", () => {
    const rot = zustimmungsquittung(
      stimmenlageAus({ up: 1, warn: 0, down: 1, status: "offen" }, 3),
    );
    expect(rot.art).toBe("blockiert");
    // Ben (nacharbeit-2): auch blockiert stehen Bedarf und Rest da — die Blockade kommt hinzu.
    expect(rot).toEqual({
      art: "blockiert",
      schluessel: "statusfreigabe.zustimmung.blockiertRest",
      werte: { count: 1, have: 1, need: 3, rest: 2 },
    });
    const satz = de(rot.schluessel, rot.werte);
    expect(satz).toContain("1 von 3");
    expect(satz).toContain("noch offen: 2");
    expect(satz).toContain("1 rote Bewertung");
    expect(satz).toContain("nicht validiert");
    // Genug grüne, aber rot: kein Rest, trotzdem nicht validiert.
    const genug = zustimmungsquittung(
      stimmenlageAus({ up: 3, warn: 0, down: 2, status: "offen" }, 3),
    );
    expect(genug.schluessel).toBe("statusfreigabe.zustimmung.blockiertGenug");
    expect(de(genug.schluessel, genug.werte)).toContain("3 von 3");
    expect(de(genug.schluessel, genug.werte)).toContain("nicht validiert");
    expect(zustimmungsquittung(stimmenlageAus({}, 3)).art).toBe("unbekannt");
    expect(zustimmungsquittung(stimmenlageAus({ id: "ko-1", status: "geprüft" }, 3)).art).toBe(
      "unbekannt",
    );
  });
});

describe("Q · K1 — die Quittung an der montierten Prüffläche", () => {
  it("Q1 · erste von drei Zustimmungen: Stimme gezählt, noch zwei erforderlich, nicht validiert", async () => {
    lage.antwort = { up: 1, warn: 0, down: 0, trust: 33, status: "offen" };
    mount();
    await klick(freigebenKnopf());
    expect(lage.aufrufe).toEqual([{ id: "ko-1", body: { action: "rate", verdict: "up" } }]);
    const q = quittung();
    expect(q?.getAttribute("data-stimmenlage")).toBe("offen");
    const stimme = de("statusfreigabe.zustimmung.offen", { count: 2, have: 1, need: 3 });
    expect(inhalt(q)).toBe(`${de("val.decisionSaved")} — ${stimme}`);
    expect(inhalt(q)).not.toContain("jetzt validiert");
  });

  it("Q2 · zweite von drei: noch eine erforderlich (Einzahl)", async () => {
    lage.antwort = { up: 2, warn: 0, down: 0, trust: 66, status: "offen" };
    mount();
    await klick(freigebenKnopf());
    expect(inhalt(quittung())).toContain(
      de("statusfreigabe.zustimmung.offen", { count: 1, have: 2, need: 3 }),
    );
  });

  it("Q3 · eine rote Bewertung liegt vor: blockiert, nicht validiert", async () => {
    lage.antwort = { up: 1, warn: 0, down: 1, trust: 0, status: "offen" };
    mount();
    await klick(freigebenKnopf());
    expect(quittung()?.getAttribute("data-stimmenlage")).toBe("blockiert");
    const werte = { count: 1, have: 1, need: 3, rest: 2 };
    expect(inhalt(quittung())).toBe(
      `${de("val.decisionSaved")} — ${de("statusfreigabe.zustimmung.blockiertRest", werte)}`,
    );
    expect(inhalt(quittung())).not.toContain("jetzt validiert");
  });

  it("Q4 · die letzte erforderliche Zustimmung: erst jetzt — und nur weil der Server es meldet — validiert", async () => {
    lage.antwort = { up: 3, warn: 0, down: 0, trust: 99, status: "validiert" };
    mount();
    await klick(freigebenKnopf());
    expect(quittung()?.getAttribute("data-stimmenlage")).toBe("validiert");
    expect(inhalt(quittung())).toContain(
      de("statusfreigabe.zustimmung.validiertZahl", { have: 3, need: 3 }),
    );
  });

  it("Q5 · Antwort ohne Stimmenlage: keine Zahl, keine Validierung behauptet", async () => {
    lage.antwort = { id: "ko-1", status: "geprüft" };
    mount();
    await klick(freigebenKnopf());
    expect(quittung()?.getAttribute("data-stimmenlage")).toBe("unbekannt");
    expect(inhalt(quittung())).toContain(de("statusfreigabe.zustimmung.unbekannt"));
    expect(inhalt(quittung())).not.toContain("jetzt validiert");
  });
});
