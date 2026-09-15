// @vitest-environment jsdom
// ================================================================================================
// JOB 3667 R3 · DIE WEB-FLÄCHE — DERSELBE EINREICHWEG, DEN WORD SCHON HAT.
// ================================================================================================
//
// DER BEFUND, DER DIESE RUNDE AUSGELÖST HAT (Runde 2, eigene ABWEICHUNG): die Serverregel wirkt
// produktweit. Ein `experte` bekommt seit Runde 2 auch im BROWSER ein 403 `PROPOSAL_REQUIRED`, wenn
// er ein freigegebenes Wissensobjekt direkt überschreiben will — und die Web-Fläche bot für diesen
// Fall keinen Weg an. Eine Sperre ohne Ausweg ist kein Schutz, sondern ein Defekt.
//
// GEMESSEN WIRD AN DER ECHTEN ROUTE `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` →
// `BibliothekLesen`), mit der echten Modalgrenze der Shell — dieselbe Hülle wie
// `tests/wissensobjekt-loeschen/rueckfrage-im-blick-mounted.test.tsx`. ERSETZT ist nur die
// HTTP-Grenze (`api/endpoints`); Rollen, Zustand und jede Ableitung sind Produktcode.
//
// DIE DREI FÄLLE AUS PEDIS REGEL, je eigener Fall in dieser Datei:
//   FALL 1 · Berechtigter legt direkt ab            → E7 (Speichern steht da), E8 (kein Pflichtsatz)
//   FALL 2 · Nicht Berechtigter MUSS prüfen lassen   → E1 (kein Speichern, Pflichtsatz, kein Haken)
//   FALL 3 · Berechtigter wählt freiwillig           → E9 (Haken schaltet den Weg um)
//
// BENANNTE PRÜFLÜCKE: jsdom rechnet kein Layout und ist kein Browser. Gemessen ist, WAS die Fläche
// aufruft und WAS sie sagt — nicht, wie es aussieht. Die echte Office-/Postgres-Abnahme steht
// weiterhin aus (s. RUECKGABE).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Die Rolle der Sitzung — sie entscheidet, welcher der drei Fälle gilt. */
  rolle: "experte" as "experte" | "controller" | "admin",
  ichId: "u-experte",
  /** Jeder Schreibaufruf, den die Fläche abgesetzt hat — in Reihenfolge, mit vollem Rumpf. */
  aufrufe: [] as { id: string; body: Record<string, unknown> }[],
  /** Was der nächste `act`-Aufruf je Aktion antwortet. Fehlend = Erfolg. */
  antwort: {} as Record<string, { status: number; code: string; text: string } | undefined>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({
      id: box.ichId,
      name: "Eva",
      email: "e@x.de",
      role: box.rolle,
    })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3667Ko),
        list: vi.fn(async () => [globalThis.__job3667Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (id: string, body: Record<string, unknown>) => {
          box.aufrufe.push({ id, body });
          const vorgesehen = box.antwort[String(body.action)];
          if (vorgesehen) {
            throw new ApiError(vorgesehen.status, vorgesehen.code, vorgesehen.text);
          }
          return globalThis.__job3667Ko;
        }),
        remove: vi.fn(async () => undefined),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u-experte", name: "Eva Expertin" },
          { id: "u-admin", name: "Ada Admin" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject, KoProposal } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
// JOB 3667 R5: dieselbe Fallliste, die `rumpf-erhalt.test.ts` an der echten Route fährt.
import { RUMPF_FAELLE } from "./rumpf-faelle";

declare global {
  // eslint-disable-next-line no-var
  var __job3667Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const FREIGEGEBENER_TEXT = "Bei Überdruck Ventil X manuell schließen.";

function ko(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X",
    statement: FREIGEGEBENER_TEXT,
    bodyHtml: "<p>Der freigegebene Fließtext.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 99,
    trust: 99,
    // FREIGEGEBEN — genau der Zustand, den Pedis Regel schützt.
    status: "validiert",
    version: 3,
    author: "u-admin",
    originalAuthor: "u-admin",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...over,
  } as KnowledgeObject;
}

function vorschlag(over: Partial<KoProposal> = {}): KoProposal {
  return {
    id: "p-1",
    author: "u-experte",
    at: "2026-09-13T07:00:00.000Z",
    baseVersion: 3,
    statement: "Ventil X zusätzlich verplomben.",
    status: "offen",
    origin: "klarwerk_web",
    ...over,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Shell-Hülle: scrollendes `<main>` als Anker der Modalgrenze plus echte Toast-Fläche. */
function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement(
        "main",
        { key: "main", ref: mainRef, className: "flex-1 overflow-y-auto px-9 py-7" },
        children,
      ),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Huelle,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/wissen/:id",
                        element: createElement(KnowledgeDetail),
                      }),
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement("div", { "data-testid": "seite-bibliothek" }),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function da(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function muss(testId: string): HTMLElement {
  const treffer = da(testId);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

/** Das Bearbeiten-Formular öffnen — über das echte Menü, wie ein Mensch. */
async function bearbeiten(): Promise<void> {
  await klick(muss("bib-eintrag-menue"));
  await klick(muss("bib-menue-bearbeiten"));
}

/**
 * Der Kernaussage-Kasten des Formulars — dort steht der Text, der eingereicht wird.
 *
 * ER WIRD AM ANFANG EINMAL GEHOLT UND DANN FESTGEHALTEN: gesucht wird über den freigegebenen Text,
 * und genau der ist nach dem ersten Tippen weg. Die DOM-Knoten bleiben dieselben (React zeichnet ein
 * gesteuertes `textarea` nicht neu), also ist die Referenz danach weiter gültig — ein zweiter Suchlauf
 * über den Inhalt wäre es nicht.
 */
function kernaussage(): HTMLTextAreaElement {
  const felder = [...document.body.querySelectorAll("textarea")];
  const treffer = felder.find((f) => f.value.includes(FREIGEGEBENER_TEXT));
  if (!treffer) {
    throw new Error("das Kernaussage-Feld mit dem freigegebenen Text ist nicht da");
  }
  return treffer as HTMLTextAreaElement;
}

async function tippen(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as (
      v: string,
    ) => void;
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function schreibaufrufe(aktion: string): Record<string, unknown>[] {
  return box.aufrufe.filter((a) => a.body.action === aktion).map((a) => a.body);
}

beforeEach(async () => {
  box.rolle = "experte";
  box.ichId = "u-experte";
  box.aufrufe = [];
  box.antwort = {};
  globalThis.__job3667Ko = ko();
  vi.mocked(endpoints.ko.act).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

// ================================================================================================
// FALL 2 — NICHT BERECHTIGT: DIE PRÜFUNG IST PFLICHT, UND ES GIBT EINEN WEG.
// ================================================================================================

describe("JOB 3667 R3 · Fall 2 — der Experte am freigegebenen Objekt", () => {
  it("E1 · es gibt KEIN Speichern, dafür den Einreichweg und den Satz, der die Folge nennt", async () => {
    await mount();
    await bearbeiten();

    // Der Griff, der nur absagen könnte, wird nicht angeboten — das wäre eine Scheinfunktion.
    expect(
      knopfMitText(i18n.t("ko.saveEdit")),
      "der Speichern-Knopf steht da, obwohl der Server ihn abweisen würde",
    ).toBeUndefined();
    expect(da("bib-einreichen"), "der Einreichweg fehlt — das ist die Sackgasse").not.toBeNull();
    // Der Satz sagt die FOLGE, nicht bloss das Verbot.
    expect(muss("bib-einreichen-pflicht").textContent).toBe(i18n.t("ko.propose.mustReview"));
    // KEIN Haken: hier ist die Prüfung Pflicht, kein Angebot.
    expect(
      da("bib-pruefweg-haken"),
      "der Haken steht beim nicht Berechtigten — dort ist die Prüfung aber Pflicht",
    ).toBeNull();
  });

  it("E2 · ohne ausdrücklichen Griff passiert NICHTS — auch nicht beim Tippen", async () => {
    await mount();
    await bearbeiten();
    await tippen(kernaussage(), "Ein ganz anderer Text.");

    expect(box.aufrufe, "die Fläche hat geschrieben, ohne dass jemand gegriffen hat").toHaveLength(
      0,
    );
  });

  it("E3 · der Griff reicht EINEN gebundenen Vorschlag ein — an dasselbe Objekt, mit der gesehenen Version", async () => {
    await mount();
    await bearbeiten();
    await tippen(kernaussage(), "Ventil X zusätzlich verplomben.");
    await klick(muss("bib-einreichen"));

    // GENAU EIN Schreibaufruf, und er geht an dasselbe Objekt.
    expect(box.aufrufe).toHaveLength(1);
    expect(box.aufrufe[0]?.id).toBe("ko-1");
    const eingereicht = schreibaufrufe("propose");
    expect(eingereicht).toHaveLength(1);
    expect(eingereicht[0]?.proposal).toMatchObject({
      statement: "Ventil X zusätzlich verplomben.",
      // Die Fassung, die im Bild stand — nicht eine geratene.
      baseVersion: 3,
      origin: "klarwerk_web",
    });
    // KEIN `revise`: der freigegebene Stand wird nicht angefasst.
    expect(schreibaufrufe("revise"), "die Fläche hat zusätzlich überschrieben").toHaveLength(0);
  });

  it("E4 · nach dem Einreichen sagt die Fläche, was gilt — und der Text bleibt stehen", async () => {
    await mount();
    await bearbeiten();
    const feld = kernaussage();
    await tippen(feld, "Mein Vorschlag.");
    await klick(muss("bib-einreichen"));

    const lage = muss("bib-einreichen-lage");
    expect(lage.getAttribute("data-lage")).toBe("eingereicht");
    // Der Satz behauptet NICHT, der Eintrag sei jetzt anders.
    expect(lage.textContent).toContain(i18n.t("ko.propose.done"));
    // Lieferung 5: die Eingabe ist nicht weg — das Formular steht offen und trägt den Text.
    expect(feld.value).toBe("Mein Vorschlag.");
  });

  it("E5 · scheitert der Aufruf, kostet das KEINE Eingabe", async () => {
    box.antwort.propose = { status: 500, code: "ERROR", text: "Der Server mag nicht." };
    await mount();
    await bearbeiten();
    const feld = kernaussage();
    await tippen(feld, "Mühsam getippter Text.");
    await klick(muss("bib-einreichen"));

    const lage = muss("bib-einreichen-lage");
    expect(lage.getAttribute("data-lage")).toBe("fehler");
    expect(lage.textContent).toContain("Der Server mag nicht.");
    // DAS IST DER PUNKT: kein geleertes Feld, kein stiller Verlust.
    expect(feld.value).toBe("Mühsam getippter Text.");
    expect(da("bib-einreichen"), "der Weg ist nach einem Fehler verschwunden").not.toBeNull();
  });

  it("E6 · ein Versionskonflikt verliert nichts und lässt den Menschen entscheiden", async () => {
    box.antwort.propose = { status: 409, code: "KO_STALE", text: "Stand bewegt." };
    await mount();
    await bearbeiten();
    const feld = kernaussage();
    await tippen(feld, "Mein Text trotz Konflikt.");
    await klick(muss("bib-einreichen"));

    const lage = muss("bib-einreichen-lage");
    expect(lage.getAttribute("data-lage")).toBe("stale");
    // Der Text steht noch da — ein 409, der die Arbeit verschluckt, wäre schlimmer als ein
    // stilles Überschreiben.
    expect(feld.value).toBe("Mein Text trotz Konflikt.");
    // Und beide Wege stehen zur Wahl: neu lesen, oder auf dem jetzigen Stand einreichen.
    expect(da("bib-einreichen-neu-lesen")).not.toBeNull();
    expect(da("bib-einreichen-trotzdem")).not.toBeNull();

    // „Trotzdem einreichen" nimmt die Fassung, die JETZT gilt — hier v4, nicht die alte v3.
    box.antwort.propose = undefined;
    globalThis.__job3667Ko = ko({ version: 4 });
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["ko", "ko-1"] });
      await flush();
    });
    await act(flush);
    await klick(muss("bib-einreichen-trotzdem"));

    const versuche = schreibaufrufe("propose");
    expect(versuche).toHaveLength(2);
    expect((versuche[1]?.proposal as { baseVersion: number }).baseVersion).toBe(4);
    expect((versuche[1]?.proposal as { statement: string }).statement).toBe(
      "Mein Text trotz Konflikt.",
    );
  });
});

// ================================================================================================
// FALL 1 UND 3 — DER BERECHTIGTE HAT DIE WAHL, UND ZWAR NUR ER.
// ================================================================================================

describe("JOB 3667 R3 · Fall 1 und 3 — der Berechtigte", () => {
  beforeEach(() => {
    box.rolle = "admin";
    box.ichId = "u-admin";
  });

  it("E7 · er darf direkt ablegen: der Speichern-Knopf steht da, der Pflichtsatz nicht", async () => {
    await mount();
    await bearbeiten();

    expect(
      knopfMitText(i18n.t("ko.saveEdit")),
      "der Speichern-Knopf fehlt dem Berechtigten",
    ).toBeDefined();
    expect(
      da("bib-einreichen"),
      "der Einreichweg steht daneben — dann wäre Fall 2 eine Auswahl",
    ).toBeNull();
    expect(
      da("bib-einreichen-pflicht"),
      "der Pflichtsatz steht beim Berechtigten, für den nichts Pflicht ist",
    ).toBeNull();
    // Aber der Haken ist da: Fall 3 ist SEINE Wahl.
    expect(da("bib-pruefweg-haken"), "Fall 3 ist im Browser nicht wählbar").not.toBeNull();
  });

  it("E8 · Fall 1 gemessen: sein Speichern geht als `revise` an dasselbe Objekt", async () => {
    await mount();
    await bearbeiten();
    await tippen(kernaussage(), "Vom Berechtigten direkt abgelegt.");
    await klick(knopfMitText(i18n.t("ko.saveEdit")) as HTMLButtonElement);

    const revidiert = schreibaufrufe("revise");
    expect(revidiert).toHaveLength(1);
    expect((revidiert[0]?.changes as { statement: string }).statement).toBe(
      "Vom Berechtigten direkt abgelegt.",
    );
    expect(
      schreibaufrufe("propose"),
      "der Berechtigte wurde auf den Prüfweg gezwungen",
    ).toHaveLength(0);
  });

  it("E9 · Fall 3: der Haken schaltet ihn auf denselben Einreichweg um", async () => {
    await mount();
    await bearbeiten();
    await tippen(kernaussage(), "Lieber erst ansehen lassen.");

    const haken = muss("bib-pruefweg-haken").querySelector("input") as HTMLInputElement;
    await klick(haken);

    // Jetzt ist „Speichern" weg und der Einreichweg da — genau EIN Griff, wie in Fall 2.
    expect(knopfMitText(i18n.t("ko.saveEdit"))).toBeUndefined();
    await klick(muss("bib-einreichen"));

    expect(schreibaufrufe("propose")).toHaveLength(1);
    expect(schreibaufrufe("revise")).toHaveLength(0);
    // Und der Haken ist abwählbar — freiwillig heisst freiwillig.
    await klick(haken);
    expect(knopfMitText(i18n.t("ko.saveEdit"))).toBeDefined();
  });

  // ============================================================================================
  // DER KREIS: ÜBER EINEN VORSCHLAG ENTSCHEIDEN.
  // ============================================================================================

  it("E10 · er sieht den fremden Vorschlag mit Inhalt und entscheidet über GENAU dessen Kennung", async () => {
    globalThis.__job3667Ko = ko({ proposals: [vorschlag()] });
    await mount();

    const liste = muss("bib-vorschlaege");
    expect(liste.textContent).toContain("Ventil X zusätzlich verplomben.");
    // Woher er stammt, steht da — die Fassung, auf die er sich bezieht.
    expect(liste.textContent).toContain(i18n.t("ko.propose.fromVersion", { n: "3" }));

    await klick(muss("bib-vorschlag-uebernehmen"));

    const entschieden = schreibaufrufe("decide-proposal");
    expect(entschieden).toHaveLength(1);
    expect(entschieden[0]).toMatchObject({
      proposalId: "p-1",
      decision: "uebernehmen",
      // An die Fassung gebunden, die dieser Mensch im Bild hatte.
      expectedVersion: 3,
    });
    // LIEFERUNG 8: es geht KEIN Inhalt hinaus. Entschieden wird über die eingereichte Fassung —
    // der Dienst liest sie aus dem gespeicherten Vorschlag.
    expect(Object.keys(entschieden[0] ?? {})).not.toContain("statement");
    expect(Object.keys(entschieden[0] ?? {})).not.toContain("changes");
    expect(Object.keys(entschieden[0] ?? {})).not.toContain("bodyHtml");
  });

  it("E11 · am EIGENEN Vorschlag gibt es keinen Knopf, sondern den Grund", async () => {
    globalThis.__job3667Ko = ko({ proposals: [vorschlag({ author: "u-admin" })] });
    await mount();

    const eintrag = muss("bib-vorschlag");
    expect(eintrag.getAttribute("data-eigen")).toBe("ja");
    expect(
      da("bib-vorschlag-uebernehmen"),
      "der eigene Vorschlag trägt einen Freigabeknopf",
    ).toBeNull();
    expect(da("bib-vorschlag-ablehnen")).toBeNull();
    // Kein stilles Verschwinden: der Grund steht da.
    expect(muss("bib-vorschlag-eigen").textContent).toBe(i18n.t("ko.propose.own"));
  });

  it("E12 · die Ablehnung braucht eine Begründung und schreibt sie mit", async () => {
    globalThis.__job3667Ko = ko({ proposals: [vorschlag()] });
    await mount();
    await klick(muss("bib-vorschlag-ablehnen"));

    // Ohne Grund ist die Ablehnung nicht abschickbar — „abgelehnt" ohne Auskunft wäre eine
    // Tatsache, mit der der Einreicher nichts anfangen kann.
    const ab = muss("bib-vorschlag-ablehnen-ab") as HTMLButtonElement;
    expect(ab.disabled).toBe(true);
    await tippen(
      muss("bib-vorschlag-grund") as HTMLTextAreaElement,
      "Widerspricht der Betriebsanweisung 4.",
    );
    expect((muss("bib-vorschlag-ablehnen-ab") as HTMLButtonElement).disabled).toBe(false);
    await klick(muss("bib-vorschlag-ablehnen-ab"));

    expect(schreibaufrufe("decide-proposal")[0]).toMatchObject({
      proposalId: "p-1",
      decision: "ablehnen",
      note: "Widerspricht der Betriebsanweisung 4.",
      expectedVersion: 3,
    });
  });

  it("E13 · ein ENTSCHIEDENER Vorschlag steht nicht mehr zur Entscheidung", async () => {
    globalThis.__job3667Ko = ko({
      proposals: [
        vorschlag({ id: "p-alt", status: "uebernommen", resultVersion: 3 }),
        vorschlag({ id: "p-weg", status: "abgelehnt", note: "Nein." }),
      ],
    });
    await mount();

    // Kein Kasten, weil es NICHTS zu entscheiden gibt — und kein „keine Vorschläge" als Ersatz.
    expect(
      da("bib-vorschlaege"),
      "entschiedene Vorschläge stehen weiter als offen im Bild",
    ).toBeNull();
  });

  it("E14 · ohne offenen Vorschlag steht hier NICHTS — kein Leersatz", async () => {
    await mount();
    expect(da("bib-vorschlaege")).toBeNull();
    expect(document.body.textContent ?? "").not.toContain(
      i18n.t("ko.propose.openTitle", { n: "0" }),
    );
  });
});

// ================================================================================================
// DER RIEGEL GEGEN DIE SACKGASSE UND DIE ENGE DER REGEL.
// ================================================================================================

describe("JOB 3667 R3 · die Ränder", () => {
  it("E15 · ein 403 `PROPOSAL_REQUIRED` am Speichern endet NICHT in einer Sackgasse", async () => {
    // Die Lage, die keine Ableitung vorhersagen kann: die Fläche hält das Objekt für bearbeitbar
    // (hier: noch nicht freigegeben), der Server weiss es besser. Vor dieser Runde stand hier ein
    // roter Satz und sonst nichts.
    globalThis.__job3667Ko = ko({ status: "offen" });
    box.antwort.revise = {
      status: 403,
      code: "PROPOSAL_REQUIRED",
      text: "Dieses Wissensobjekt ist freigegeben.",
    };
    await mount();
    await bearbeiten();
    const feld = kernaussage();
    await tippen(feld, "Mein Text nach der Sperre.");
    // Vorher war der direkte Weg angeboten — die Fläche wusste es nicht anders.
    await klick(knopfMitText(i18n.t("ko.saveEdit")) as HTMLButtonElement);

    // Jetzt steht der Weg da, und die Eingabe ist unversehrt.
    expect(muss("bib-einreichen-pflicht").textContent).toBe(i18n.t("ko.propose.mustReview"));
    expect(da("bib-einreichen"), "nach der Sperre gibt es keinen Ausweg").not.toBeNull();
    expect(feld.value).toBe("Mein Text nach der Sperre.");
    // Und er reicht NICHT von selbst ein: Einreichen bleibt ein bewusster Schritt.
    expect(schreibaufrufe("propose")).toHaveLength(0);

    box.antwort.revise = undefined;
    await klick(muss("bib-einreichen"));
    expect(schreibaufrufe("propose")).toHaveLength(1);
  });

  it("E16 · die Regel bleibt ENG: ein nicht freigegebenes Objekt speichert der Experte weiter direkt", async () => {
    globalThis.__job3667Ko = ko({ status: "offen" });
    await mount();
    await bearbeiten();

    // Sonst nähme diese Fläche dem Erfassungs- und Nacharbeitsweg die Grundlage — und verweigerte
    // etwas, das der Server ausdrücklich erlaubt.
    expect(knopfMitText(i18n.t("ko.saveEdit"))).toBeDefined();
    expect(da("bib-einreichen-pflicht")).toBeNull();
    expect(da("bib-einreichen")).toBeNull();
  });

  it("E17 · der Betrachter ohne Freigaberecht sieht keine Entscheidungsknöpfe", async () => {
    // Die Vorschlagsliste ist eine ENTSCHEIDUNGSfläche. Wer nicht entscheiden darf, bekommt sie
    // nicht — sonst stünden dort Knöpfe, die nur zu einer Absage führen.
    globalThis.__job3667Ko = ko({ proposals: [vorschlag({ author: "u-fremd" })] });
    await mount();
    expect(da("bib-vorschlaege")).toBeNull();
    expect(da("bib-vorschlag-uebernehmen")).toBeNull();
  });
});

// ================================================================================================
// RUNDE 4 · BEFUND 1 DES PRÜFERS — DER PRÜFER SIEHT ALLES, WAS ER FREIGIBT.
// ================================================================================================
//
// DER FEHLER, GEMESSEN AM STAND VON RUNDE 3: die Vorschlagsanzeige zeigte `v.statement`, sonst
// nichts. Der Übernehmen-Knopf genehmigte aber den GANZEN Vorschlag, und `decideProposal` schreibt
// daraus `statement` UND `bodyHtml` in die neue Fassung (`service.ts:3891`). Ein Fließtext, den
// niemand gesehen hat, wurde mitfreigegeben.
//
// DER ZWEITE, GRÖSSERE FALL STEHT IN DERSELBEN ZEILE: der Dienst übergibt
// `bodyHtml: vorschlag.bodyHtml ?? null`. `null` heisst in `naechsteFassung` „leeren" (nur
// `undefined` hiesse „lassen"). Ein Vorschlag OHNE Fließtext — und genau so reicht das Word-Fenster
// ein — ENTFERNT bei der Übernahme den Fließtext des Eintrags. Auch das gibt der Prüfer frei.

describe("JOB 3667 R4 · was übernommen wird, steht vorher da", () => {
  beforeEach(() => {
    box.rolle = "admin";
    box.ichId = "u-admin";
  });

  it("E18 · ein Vorschlag MIT eigenem Fließtext zeigt ihn — lesbar, vor dem Knopf", async () => {
    globalThis.__job3667Ko = ko({
      proposals: [
        vorschlag({
          bodyHtml: "<p>Zusätzlich ist die Plombe im Wartungsbuch zu vermerken.</p>",
        }),
      ],
    });
    await mount();

    const rumpf = muss("bib-vorschlag-rumpf");
    expect(rumpf.getAttribute("data-rumpf")).toBe("neu");
    // DAS IST DER PUNKT: der Text, der bei der Übernahme in den Eintrag ginge, steht im Bild.
    expect(
      rumpf.textContent ?? "",
      "der Fließtext des Vorschlags ist vor der Übernahme nicht zu sehen",
    ).toContain("Zusätzlich ist die Plombe im Wartungsbuch zu vermerken.");
    // Und der Satz sagt die FOLGE, nicht bloss den Befund.
    expect(rumpf.textContent).toContain(i18n.t("ko.propose.body.neu"));
    // Er steht in DEMSELBEN Eintrag wie der Knopf — nicht irgendwo auf der Seite.
    expect(muss("bib-vorschlag").contains(rumpf)).toBe(true);
    expect(muss("bib-vorschlag").contains(muss("bib-vorschlag-uebernehmen"))).toBe(true);
  });

  it("E19 · ein Vorschlag OHNE Fließtext sagt, dass der jetzige BLEIBT — und zeigt ihn", async () => {
    // Genau der Word-Fall: `rwEinreichen` schickt statement/baseVersion/origin, keinen Rumpf.
    //
    // RUNDE 5 HAT HIER DIE AUSSAGE GEDREHT, weil die WIRKUNG sich gedreht hat: bis R4 hätte die
    // Übernahme den Fließtext entfernt (`bodyHtml ?? null`), seit R5 bleibt er stehen
    // (`service.ts`, `rumpfAusVorschlag`). Die Fläche sagt die neue Wirkung, nicht die alte.
    globalThis.__job3667Ko = ko({
      bodyHtml: "<p>Der freigegebene Fließtext.</p>",
      proposals: [vorschlag({ origin: "word_addin" })],
    });
    await mount();

    const rumpf = muss("bib-vorschlag-rumpf");
    expect(rumpf.getAttribute("data-rumpf")).toBe("bleibt");
    expect(rumpf.textContent).toContain(i18n.t("ko.propose.body.bleibt"));
    // UND DAS ERGEBNIS STEHT DA: was nach der Übernahme im Eintrag steht, ist der jetzige Inhalt.
    expect(
      rumpf.querySelector(".prose-kw")?.textContent ?? "",
      "der Inhalt, der die Übernahme überlebt, steht dem Prüfer nicht vor Augen",
    ).toContain("Der freigegebene Fließtext.");
  });

  it("E25 · nur die AUSDRÜCKLICHE Löschung sagt ENTFERNT — und zeigt keinen Inhalt", async () => {
    globalThis.__job3667Ko = ko({
      bodyHtml: "<p>Der freigegebene Fließtext.</p>",
      proposals: [vorschlag({ clearBody: true })],
    });
    await mount();

    const rumpf = muss("bib-vorschlag-rumpf");
    expect(rumpf.getAttribute("data-rumpf")).toBe("entfernt");
    expect(rumpf.textContent).toBe(i18n.t("ko.propose.body.entfernt"));
    // Nach der Übernahme steht dort nichts — also steht auch hier nichts als Ergebnis.
    expect(rumpf.querySelector(".prose-kw")).toBeNull();
  });

  it("E20 · gleicht der Fließtext dem jetzigen, heisst es auch so — und er steht trotzdem da", async () => {
    globalThis.__job3667Ko = ko({
      bodyHtml: "<p>Der freigegebene Fließtext.</p>",
      proposals: [vorschlag({ bodyHtml: "<p>Der freigegebene Fließtext.</p>" })],
    });
    await mount();

    const rumpf = muss("bib-vorschlag-rumpf");
    expect(rumpf.getAttribute("data-rumpf")).toBe("gleich");
    expect(rumpf.textContent).toContain("Der freigegebene Fließtext.");
  });

  it("E21 · ohne Fließtext auf beiden Seiten wird nichts behauptet, was es nicht gibt", async () => {
    globalThis.__job3667Ko = ko({ bodyHtml: null, proposals: [vorschlag()] });
    await mount();

    expect(muss("bib-vorschlag-rumpf").getAttribute("data-rumpf")).toBe("keiner");
  });
});

// ================================================================================================
// RUNDE 4 · BEFUND 2 DES PRÜFERS — KEIN „EINGEREICHT" FÜR FELDER, DIE DER SERVER NIE BEKAM.
// ================================================================================================
//
// GEMESSEN AM CODE: der direkte Speicherweg schickt title/statement/bodyHtml/type/conditions/
// measures und dazu `tags` und `category` als eigene Aufrufe. Der Einreich-Aufruf schickt
// statement/bodyHtml/baseVersion/origin — mehr trägt ein `KoProposal` nicht, und mehr schreibt die
// Übernahme nicht. Ein Formular, das im Prüfweg trotzdem Titel, Art, Kategorie, Bedingungen,
// Maßnahmen und Schlagworte als Eingabe anbietet, verspricht ein „eingereicht", das es nicht gibt.

describe("JOB 3667 R4 · der Prüfweg bietet nur an, was er trägt", () => {
  /** Die Beschriftungen der Eingabefelder des Formulars — `Field` zeichnet sie als `label > span`. */
  function feldNamen(): string[] {
    return [...document.body.querySelectorAll("label > span")]
      .map((s) => (s.textContent ?? "").trim())
      .filter((s) => s.length > 0);
  }

  it("E22 · Fall 2: Titel, Art, Kategorie, Bedingungen, Maßnahmen und Schlagworte stehen NICHT als Eingabe", async () => {
    await mount();
    await bearbeiten();

    const namen = feldNamen();
    // Was eingereicht wird, steht da …
    expect(namen).toContain(i18n.t("capture.fStatement"));
    expect(namen).toContain(i18n.t("capture.fBody"));
    // … und was nicht mitreist, steht nicht da.
    for (const key of [
      "capture.fTitle",
      "capture.fType",
      "capture.fCategory",
      "capture.fConditions",
      "capture.fMeasures",
    ]) {
      expect(
        namen,
        `„${i18n.t(key)}" steht im Prüfweg als Eingabe, reist aber nie mit`,
      ).not.toContain(i18n.t(key));
    }
    // Und die Fläche SAGT es, statt die Felder wortlos verschwinden zu lassen.
    expect(muss("bib-pruefweg-felder").textContent).toContain(i18n.t("ko.propose.onlyFields"));
  });

  it("E23 · Gegenprobe: im direkten Weg stehen dieselben Felder weiterhin da", async () => {
    // Ohne diesen Fall wäre E22 auch dann grün, wenn das Formular die Felder ÜBERALL verlöre.
    globalThis.__job3667Ko = ko({ status: "offen" });
    await mount();
    await bearbeiten();

    const namen = feldNamen();
    expect(namen).toContain(i18n.t("capture.fTitle"));
    expect(namen).toContain(i18n.t("capture.fCategory"));
    expect(da("bib-pruefweg-felder")).toBeNull();
  });

  it("E24 · Fall 3: wer mitten im Bearbeiten umschaltet, erfährt, was NICHT mitgeht", async () => {
    box.rolle = "admin";
    box.ichId = "u-admin";
    await mount();
    await bearbeiten();

    // Erst am Titel arbeiten — im direkten Weg ist das ein gültiger Handgriff.
    const titel = [...document.body.querySelectorAll("input")].find(
      (i) => (i as HTMLInputElement).value === "Ventil X",
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
        v: string,
      ) => void;
      setter.call(titel, "Ventil X (überarbeitet)");
      titel.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    // Dann freiwillig auf den Prüfweg (Fall 3).
    await klick(muss("bib-pruefweg-haken").querySelector("input") as HTMLInputElement);

    // DAS IST DER PUNKT: die Titeländerung verschwindet nicht wortlos mit ihrem Feld.
    const verworfen = muss("bib-pruefweg-felder-verworfen");
    expect(verworfen.textContent).toContain(i18n.t("ko.revision.field.title"));

    await klick(muss("bib-einreichen"));
    const eingereicht = schreibaufrufe("propose");
    expect(eingereicht).toHaveLength(1);
    // Und der Aufruf behauptet den Titel auch nicht — er trägt genau vier Felder.
    expect(Object.keys(eingereicht[0]?.proposal as Record<string, unknown>).sort()).toEqual([
      "baseVersion",
      "bodyHtml",
      "origin",
      "statement",
    ]);
  });
});

// ================================================================================================
// RUNDE 5 · AUSGELASSEN IST NICHT GELÖSCHT — UND DIE VORSCHAU ZEIGT, WAS DIE ÜBERNAHME SCHREIBT.
// ================================================================================================
//
// DER FEHLER, GEMESSEN AM STAND VON RUNDE 4 (Steuerung/Codex 14.09.): ein Vorschlag ohne Rumpf —
// so und nicht anders reicht das Word-Fenster ein — hätte bei der Übernahme den ganzen
// ausführlichen Inhalt des Eintrags entfernt (`bodyHtml: vorschlag.bodyHtml ?? null`). R4 hat das
// nur ANGEZEIGT; R5 ändert die Wirkung: der bestehende Inhalt bleibt, geleert wird nur auf das
// ausdrückliche `clearBody`.
//
// DIESE FÄLLE LESEN DIESELBE LISTE WIE DIE WIRKUNGSPRÜFUNG (`rumpf-faelle.ts`, gefahren an der
// echten Route in `rumpf-erhalt.test.ts`). Das ist der Punkt: Vorschau und Übernahme sind hier
// nicht zwei Behauptungen, sondern zwei Messungen an EINER Liste.

describe("JOB 3667 R5 · die Vorschau sagt dasselbe wie die Übernahme", () => {
  beforeEach(() => {
    box.rolle = "admin";
    box.ichId = "u-admin";
  });

  for (const fall of RUMPF_FAELLE) {
    it(`E26 (${fall.lage}) · ${fall.name}`, async () => {
      globalThis.__job3667Ko = ko({
        bodyHtml: fall.bestand,
        proposals: [vorschlag(fall.vorschlag)],
      });
      await mount();

      const rumpf = muss("bib-vorschlag-rumpf");
      expect(rumpf.getAttribute("data-rumpf")).toBe(fall.lage);
      // Der Satz ist der Satz DIESER Lage — nicht irgendeiner.
      expect(rumpf.textContent).toContain(i18n.t(`ko.propose.body.${fall.lage}`));

      const gezeigt = rumpf.querySelector(".prose-kw")?.textContent ?? null;
      if (fall.ergebnis === "keiner") {
        // Nach der Übernahme steht dort kein Inhalt — also wird auch keiner vorgeführt.
        expect(gezeigt).toBeNull();
      } else {
        const quelle = fall.ergebnis === "bestand" ? fall.bestand : fall.vorschlag.bodyHtml;
        expect(
          gezeigt ?? "",
          "die Vorschau zeigt nicht den Inhalt, den die Übernahme schreibt",
        ).toContain((quelle ?? "").replace(/<\/?p>/g, "").trim());
      }
    });
  }
});

describe("JOB 3667 R5 · wer den Inhalt leert, meint es — und es geht als Absicht hinaus", () => {
  /** Das Rumpffeld des Formulars ist ein `contentEditable` mit angekündigtem Namen. */
  function rumpfFeld(): HTMLElement {
    const feld = document.body.querySelector<HTMLElement>(
      `[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`,
    );
    if (!feld) {
      throw new Error("das Feld für den ausführlichen Inhalt ist nicht da");
    }
    return feld;
  }

  async function rumpfLeeren(): Promise<void> {
    const feld = rumpfFeld();
    await act(async () => {
      feld.innerHTML = "";
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(flush);
  }

  it("E27 · geleerter Inhalt an einem Eintrag MIT Inhalt reist als `clearBody` — nicht als Auslassung", async () => {
    // OHNE DIESES FELD verpuffte die Arbeit: der Server führt eine Löschung seit R5 nur auf das
    // ausdrückliche Signal aus, und ein fehlendes `bodyHtml` heisst „nicht eingereicht".
    await mount();
    await bearbeiten();
    await rumpfLeeren();
    await klick(muss("bib-einreichen"));

    const eingereicht = schreibaufrufe("propose");
    expect(eingereicht).toHaveLength(1);
    const proposal = eingereicht[0]?.proposal as Record<string, unknown>;
    expect(proposal.clearBody).toBe(true);
    expect(proposal).not.toHaveProperty("bodyHtml");
  });

  it("E28 · Gegenprobe: hat der Eintrag gar keinen Inhalt, wird auch keine Löschung behauptet", async () => {
    globalThis.__job3667Ko = ko({ bodyHtml: null });
    await mount();
    await bearbeiten();
    await klick(muss("bib-einreichen"));

    const proposal = schreibaufrufe("propose")[0]?.proposal as Record<string, unknown>;
    expect(proposal).not.toHaveProperty("clearBody");
    expect(proposal).not.toHaveProperty("bodyHtml");
  });
});
