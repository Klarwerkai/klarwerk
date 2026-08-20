// @vitest-environment jsdom
// ================================================================================================
// JOB 557 / D9 — DIE SICHTBARE OWNER-NACHARBEIT AM GEMOUNTETEN RENDERER (BEN Prüflücke 1).
// ================================================================================================
//
// WAS D8 GEFEHLT HAT, IN EINEM SATZ. D8 hat den Ereignisvertrag ehrlich gemacht — bei benannter
// Eigentümerin heisst das Auditereignis `ko.returned-to-owner` statt fälschlich `…-to-author` —
// und beide Verbraucher mitgezogen. BEN hat den Stand trotzdem als „Scheinbeleg für die behauptete
// Sichtbarkeit" gewertet, und zwar zu Recht: Tests von `isReturnedForRework` beziehungsweise
// `returnedToAuthor` messen die Bibliothek, nicht den Bildschirm. Ob die Nacharbeit beim Menschen
// ankommt, entscheidet der Renderer.
//
// DIESE DATEI SCHLIESST GENAU DAS. Sie mountet BEIDE Flächen, an denen die Aussage hängt:
//
//   · `KnowledgeDetail.tsx:902` — der sichtbare Nacharbeit-Hinweis am Wissensobjekt. Er entsteht
//     aus `isReturnedForRework(audit, koId)`; ein unbekannter Aktionsname lässt ihn stumm.
//   · `MyTasks.tsx:98`          — die persönliche Aufgabenliste. Sie entsteht aus
//     `returnedToAuthor(audit, kos, userId)`; hier DARF die Owner-Rückgabe nicht auftauchen.
//
// DIE ZWEI HÄLFTEN SIND EINE AUSSAGE, NICHT ZWEI. „Sichtbar" allein wäre erfüllt, wenn die
// Owner-Rückgabe zusätzlich in der Autorenliste stünde — dann hätte die Autorin eine Aufgabe, die
// der Eigentümerin gehört: dieselbe Verwechslung, nur an eine andere Stelle verschoben. Und „nicht
// in der Autorenliste" allein wäre trivial erfüllt, solange die Rückgabe überhaupt nicht erkannt
// wird — genau der Zustand vor D8. Deshalb misst U2 BEIDES in EINEM Fall.
//
// GEMOCKT WIRD NUR DER ZUGANG, NICHT DIE SACHE. Wie in der Schwesterdatei
// `KnowledgeDetail.origin-chip.test.tsx` wird `../api/hooks` als TEILMOCK überschrieben: die Seiten
// ziehen über Unterkomponenten weitere Haken, die mit dem Gegenstand nichts zu tun haben. Weder der
// Renderer noch `isReturnedForRework` noch `returnedToAuthor` sind gemockt — geprüft werden die
// echten Komponenten und die echte Bibliothek.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditEntry, KnowledgeObject } from "../api/types";

const AUTORIN = "u-autorin";
const EIGENTUEMERIN = "u-eigentuemerin";
const KO_ID = "ko-1";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: KO_ID,
    title: "Ventil X schliesst bei Ueberdruck",
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: AUTORIN,
    author: AUTORIN,
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-19T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

/** Ein Rückgabeereignis, wie der Emittent es schreibt — der Aktionsname ist der Gegenstand. */
function rueckgabe(action: string, responsible: string): AuditEntry {
  return {
    seq: 1,
    at: "2026-08-19T10:00:00.000Z",
    actor: "u-prueferin",
    action,
    target: KO_ID,
    payload: { verdict: "warn", responsible },
    hash: "h1",
  } as unknown as AuditEntry;
}

const lage = vi.hoisted(() => ({
  ko: null as unknown,
  audit: [] as unknown[],
  kos: [] as unknown[],
}));

// TEILMOCK, kein Vollersatz — s. Kopfkommentar.
vi.mock("../api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useKo: () => ok(lage.ko),
    useKos: () => ok(lage.kos),
    useAudit: () => ok(lage.audit),
    useConflicts: leer,
    useDirectory: leer,
    useGaps: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useValidationBoard: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
// Angemeldet ist die AUTORIN — nur so ist die Frage „liegt es bei mir?" überhaupt gestellt.
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: AUTORIN, name: "Autorin", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false, setStufe2: () => {} }),
}));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "../i18n";
import { KnowledgeDetail } from "./KnowledgeDetail";
import { MyTasks } from "./MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

/** Der sichtbare Nacharbeit-Hinweis am Objekt (`KnowledgeDetail.tsx:904`). */
const BANNER = de("ko.returnedBanner");

function mountDetail(): void {
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
          { initialEntries: [`/wissen/${KO_ID}`] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
          ),
        ),
      ),
    );
  });
}

function mountTasks(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(MyTasks)),
      ),
    );
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Führt die Aufgabenliste dieses Objekts? Der Titel steht als Beschriftung darin. */
function fuehrtAufgabe(): boolean {
  return text().includes("Ventil X schliesst bei Ueberdruck");
}

function abbauen(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  lage.ko = null;
  lage.audit = [];
  lage.kos = [];
});

describe("JOB 557 D9 · U — die Owner-Nacharbeit ist sichtbar und bleibt bei der Eigentümerin", () => {
  // ── U1 · DER RED-FIRST-FALL ────────────────────────────────────────────────────────────────────
  //
  // Vor D8 kennt `isReturnedForRework` nur `ko.returned-to-author`. Ein ehrlich benanntes
  // Owner-Ereignis ist ihm unbekannt, der Hinweis bleibt stumm — das Objekt steht in Nacharbeit und
  // die Oberfläche schweigt darüber. Genau das fällt hier.
  it("U1 · Owner-Rückgabe: der Nacharbeit-Hinweis erscheint am Wissensobjekt", () => {
    lage.ko = ko();
    lage.audit = [rueckgabe("ko.returned-to-owner", EIGENTUEMERIN)];
    mountDetail();
    expect(
      text(),
      "das Objekt ist an die Eigentümerin zurückgegeben, die Detailseite sagt es dem Menschen aber nicht",
    ).toContain(BANNER);
    abbauen();
  });

  // ── U2 · DIE GANZE AUSSAGE IN EINEM FALL ───────────────────────────────────────────────────────
  //
  // Beide Hälften zusammen, weil jede allein täuschen kann (s. Kopfkommentar): sichtbar am Objekt
  // UND nicht in der Aufgabenliste der Autorin. Eine Owner-Rückgabe liegt nicht bei der Autorin.
  it("U2 · Owner-Rückgabe: sichtbar am Objekt UND nicht in den Aufgaben der Autorin", () => {
    lage.ko = ko();
    lage.kos = [ko()];
    lage.audit = [rueckgabe("ko.returned-to-owner", EIGENTUEMERIN)];

    mountDetail();
    expect(text(), "erste Hälfte: der Hinweis fehlt am Objekt").toContain(BANNER);
    abbauen();

    mountTasks();
    expect(
      fuehrtAufgabe(),
      "zweite Hälfte: die Autorin bekommt eine Aufgabe angezeigt, die der Eigentümerin gehört",
    ).toBe(false);
    abbauen();
  });

  // ── U3/U4 · DER AUTOR-FALLBACK BLEIBT UNVERÄNDERT ──────────────────────────────────────────────
  //
  // Bestandsschutz, und BEN verlangt ihn ausdrücklich als Gegenfall: Wo die Verantwortliche
  // tatsächlich die Autorin ist, bleibt alles wie bisher — Hinweis am Objekt UND Aufgabe in der
  // Liste. Diese beiden Fälle sind vor wie nach der Änderung grün; das ist ihre Aufgabe.
  it("U3 · Autor-Fallback: der Nacharbeit-Hinweis erscheint unverändert", () => {
    lage.ko = ko();
    lage.audit = [rueckgabe("ko.returned-to-author", AUTORIN)];
    mountDetail();
    expect(text()).toContain(BANNER);
    abbauen();
  });

  it("U4 · Autor-Fallback: die Rückgabe erscheint weiterhin in den Aufgaben der Autorin", () => {
    lage.ko = ko();
    lage.kos = [ko()];
    lage.audit = [rueckgabe("ko.returned-to-author", AUTORIN)];
    mountTasks();
    expect(
      fuehrtAufgabe(),
      "der echte Autor-Fallback ist aus der Aufgabenliste verschwunden — das wäre ein Rückschritt",
    ).toBe(true);
    abbauen();
  });

  // ── U5 · KALIBRIERUNG ──────────────────────────────────────────────────────────────────────────
  //
  // Ohne diesen Fall wären U1 bis U4 auch dann erfüllbar, wenn der Hinweis IMMER stünde und die
  // Liste IMMER leer wäre. Er misst, dass beide Flächen überhaupt unterscheiden.
  it("U5 · ohne Rückgabeereignis: kein Hinweis am Objekt und keine Aufgabe in der Liste", () => {
    lage.ko = ko();
    lage.kos = [ko()];
    lage.audit = [];

    mountDetail();
    expect(text(), "der Hinweis steht ohne jedes Rückgabeereignis").not.toContain(BANNER);
    abbauen();

    mountTasks();
    expect(fuehrtAufgabe(), "die Aufgabenliste führt ein nie zurückgegebenes Objekt").toBe(false);
    abbauen();
  });
});
