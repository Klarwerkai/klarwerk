// @vitest-environment jsdom
// ================================================================================================
// JOB 687 · D5 — DIE QUITTUNG DER PRÜFENTSCHEIDUNG, GEMOUNTET GEMESSEN.
// ================================================================================================
//
// Wiederhergestellt aus `RUECKGABE-BASIC6-JOB-687-D4-KORREKTUR.md` (`94ed18e6…7309`). D4 hatte diese
// Fälle in einem Prüfbaum unter `/private/tmp` gefahren — 12 grün, 3 rot. Der Prüfbaum ist mit dem
// Verzeichnis verlorengegangen, seine Nachweisführung nicht. Hier stehen die D-011-Fälle als
// Produkttest, gegen den unveränderten `Validation.tsx` (`833dd3f5…`, byteidentisch mit D4s Pin).
//
// WARUM GEMOUNTET UND NICHT BESCHRIEBEN. BENs Kernvorwurf an D3 war, dass zugesicherte Fälle nur
// behauptet waren. Ein Test, der `Validation.tsx` nach Zeichenketten durchsucht, beweist, dass ein
// Satz im Quelltext steht — nicht, dass ihn jemand sieht. Deshalb wird hier die Seite wirklich
// gerendert und der Knopf wirklich geklickt.
//
// DIE TRAGENDE KALIBRIERUNG IST K1. Ohne sie wäre „kein Toast" auch dann grün, wenn die Sonde kaputt
// ist. K1 klickt den vorhandenen Admin-Weg (`adminValidate`, `Validation.tsx:375`), der nachweislich
// einen Toast auslöst. Erst wenn die Sonde dort anschlägt, ist das Schweigen im `rate`-Pfad ein
// Befund und kein Messartefakt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

// Der Bestand und das Verhalten von `endpoints.ko.act` werden je Fall gesetzt.
const lage = vi.hoisted(() => ({
  kos: [] as unknown[],
  /** Was `endpoints.ko.act` tun soll: auflösen, oder mit diesem Fehler scheitern. */
  actFehler: null as unknown,
  /** Hält den Aufruf offen, solange gesetzt — für den Pending-Fall. */
  actHaengt: false,
}));

vi.mock("../api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
  };
});

// Die Toast-Sonde. Jeder `push` wird mitgeschrieben — das ist die Messfläche dieses Tests.
const toasts = vi.hoisted(() => ({ list: [] as { ton: string; text: string }[] }));
vi.mock("../app/ToastContext", () => ({
  useToast: () => ({
    push: (ton: string, text: string) => {
      toasts.list.push({ ton, text });
    },
  }),
}));

const rolle = vi.hoisted(() => ({ wert: "experte" as string }));
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: rolle.wert } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: rolle.wert }) }));

// `endpoints.ko.act` ist der einzige Serverweg dieser Fläche. Er wird hier gesteuert, damit Erfolg,
// `ApiError` und ein gewöhnlicher Fehler getrennt gefahren werden können — ohne Netz.
vi.mock("../api/endpoints", () => ({
  endpoints: {
    ko: {
      act: () =>
        lage.actHaengt
          ? new Promise(() => undefined)
          : lage.actFehler
            ? Promise.reject(lage.actFehler)
            : Promise.resolve({}),
      aiCheckRetry: () => Promise.resolve({ status: "pending" }),
      remove: () => Promise.resolve(undefined),
    },
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../api/client";
import i18n from "../i18n";
import { Validation } from "./Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

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
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bestand: KnowledgeObject[] = [ko()]): void {
  lage.kos = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
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

/** Alle Knöpfe der gemounteten Seite, deren sichtbarer Text den gesuchten enthält. */
function knoepfe(text: string): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(text),
  ) as HTMLButtonElement[];
}

function knopf(text: string): HTMLButtonElement {
  const treffer = knoepfe(text);
  if (treffer.length === 0) {
    throw new Error(`Kein Knopf mit Text „${text}" auf der gemounteten Seite.`);
  }
  return treffer[0] as HTMLButtonElement;
}

/**
 * Klicken und die Zustandsfortschreibung der Mutation wirklich abwarten.
 *
 * Zwei aufgelöste Mikrotasks genügen NICHT: React Query setzt `isPending` in einem eigenen
 * Aufrufzyklus, und der davon ausgelöste Neuaufbau der Fläche läuft erst danach. Gemessen — der
 * Pending-Fall war mit der kürzeren Fassung falsch grünlos. Ein Durchlauf der Makrotask-Schlange
 * innerhalb von `act` deckt beides ab.
 */
async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Die Quittungskarte wird an ihrem Text erkannt, nicht an einer CSS-Klasse. */
function quittungDa(): boolean {
  return (container.textContent ?? "").includes(de("val.decisionSaved"));
}

beforeEach(() => {
  toasts.list = [];
  lage.actFehler = null;
  lage.actHaengt = false;
  rolle.wert = "experte";
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.kos = [];
});

// ------------------------------------------------------------------------------------------------
// KALIBRIERUNG — misst die Sonde, bevor die Sonde etwas misst.
// ------------------------------------------------------------------------------------------------
describe("K · Kalibrierung der Toast-Sonde", () => {
  it("K1 · der vorhandene Admin-Weg löst einen Erfolgstoast aus — die Sonde funktioniert", async () => {
    rolle.wert = "admin";
    mount();
    await klick(knopf(de("val.markTrue")));
    await klick(knopf(de("val.markTrueYes")));
    expect(toasts.list).toEqual([{ ton: "success", text: de("val.markTrueDone") }]);
  });

  it("K2 · ohne Klick entsteht kein Toast", () => {
    mount();
    expect(toasts.list).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// IST-MESSUNG — was der Prüfer heute wirklich sieht.
// ------------------------------------------------------------------------------------------------
describe("I · Ist-Messung des Freigeben-Wegs", () => {
  it("I1 · Erfolg zeigt die QUITTUNGSKARTE, aber KEINEN Toast", async () => {
    mount();
    expect(quittungDa()).toBe(false);
    await klick(knopf(de("val.actionApprove")));
    // Die Karte entsteht in `rate.onSuccess` über `setLastDecision` (Validation.tsx:317)
    // und rendert `val.decisionSaved` (:493).
    expect(quittungDa()).toBe(true);
    // Aber `rate` ruft kein `push` — anders als `adminValidate` (:375).
    expect(toasts.list).toEqual([]);
  });

  it("I2 · ein GESCHEITERTES Freigeben bleibt VOLLSTÄNDIG unsichtbar", async () => {
    lage.actFehler = new ApiError(409, "CONFLICT", "Das Objekt wurde zwischenzeitlich geändert.");
    mount();
    const vorher = container.textContent;
    await klick(knopf(de("val.actionApprove")));
    // Kein Toast: `rate` hat kein `onError` (Validation.tsx:311-319).
    expect(toasts.list).toEqual([]);
    // Keine Quittungskarte: sie entsteht nur in `onSuccess`.
    expect(quittungDa()).toBe(false);
    // Und der Seiteninhalt ist ZEICHENGLEICH wie vor dem Klick. Das ist der schwerste Punkt dieser
    // Scheibe: der Prüfer klickt „Freigeben", nichts passiert, und er glaubt, er habe freigegeben.
    expect(container.textContent).toBe(vorher);
  });

  it("I3 · während des Speicherns ist der Knopf gesperrt, die Beschriftung bleibt gleich", async () => {
    lage.actHaengt = true;
    mount();
    const vorher = knopf(de("val.actionApprove"));
    expect(vorher.disabled).toBe(false);
    await klick(vorher);
    const nachher = knopf(de("val.actionApprove"));
    // Bereits gebaut (Validation.tsx:1099): `rate.isPending` sperrt den Knopf.
    expect(nachher.disabled).toBe(true);
    // Was FEHLT, ist allein die Beschriftung — sie sagt nicht, dass gerade gespeichert wird.
    expect(nachher.textContent).toContain(de("val.actionApprove"));
  });
});

// ------------------------------------------------------------------------------------------------
// RED-FIRST — die drei Zusagen, die D-011 einlösen soll. Heute alle ROT.
// ------------------------------------------------------------------------------------------------
//
// Diese drei Fälle sind ABSICHTLICH rot. Sie beschreiben den Zielzustand von D-011 und sind der
// ausführbare Teil der Spezifikation aus D4. Wer sie grün macht, hat D-011 gebaut; wer sie löscht,
// hat die Zusage entfernt. Sie werden NICHT künstlich rot gehalten — auf dieser Base sind sie es
// gemessen (`rate` hat weder `push` im Erfolgs- noch ein `onError` im Fehlerweg).
describe("R · Red-first für D-011 — der Zielzustand der Quittung", () => {
  it.fails("R1 · Erfolg quittiert zusätzlich mit einem Erfolgstoast", async () => {
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "success", text: de("val.decisionSaved") }]);
  });

  it.fails("R2 · ein ApiError zeigt die SERVERMELDUNG als Fehlertoast", async () => {
    const meldung = "Das Objekt wurde zwischenzeitlich geändert.";
    lage.actFehler = new ApiError(409, "CONFLICT", meldung);
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "error", text: meldung }]);
  });

  it.fails("R3 · ein Fehler OHNE ApiError fällt auf `state.error` zurück", async () => {
    lage.actFehler = new Error("Netzabbruch");
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "error", text: de("state.error") }]);
  });
});
