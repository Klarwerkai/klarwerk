// @vitest-environment jsdom
// ================================================================================================
// JOB 4146 · D6 — DER FADEN AUF DER ECHTEN LESEFLÄCHE
// ================================================================================================
//
// GEMESSEN WIRD AN DER ECHTEN ROUTE `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` →
// `BibliothekLesen` → `MehrAbschnitte`) und nicht an der Unterkomponente allein. Das ist die
// Promptverbesserung aus JOB 4075 R3 (`LEHREN.md`, 15.09. 07:02): ein Test, der nur `MehrAbschnitte`
// mountet, belegte nicht, dass ein Mensch die Angabe je zu sehen bekommt — der Abschnitt entsteht
// erst beim Aufklappen von „Mehr". Bauform übernommen aus
// `tests/bibliothek-quellennachweis/nachweis-im-bibliotheksabschnitt.test.tsx`.
//
// WAS DIESER FALL BELEGT — die vier Zusagen aus §1 und §5 des Auftrags:
//   H1  der Faden: die Antwort steht UNTER ihrem Bezugsbeitrag (DOM-Enthaltensein, nicht Reihenfolge)
//   H2  der Fassungsbezug steht dran, und wenn der Eintrag weitergegangen ist, stehen beide Zahlen
//   H3  antworten · erledigt setzen · wieder öffnen gehen über die echten Aktionen hinaus
//   H4  scheitert das Absenden, steht der getippte Text NOCH IM FELD, daneben ein verständlicher Satz
//
// DAZU SEIT R5 (BENs Korrekturpflichten 2 und 3, `jobs/4146/runde-4/ben.md`):
//   H6  der Antwortentwurf überlebt das ERNEUTE ÖFFNEN desselben Fadens
//   H7  er überlebt den FADENWECHSEL, und er wandert dabei nicht in den fremden Faden mit
//   H8  bei einer abgebrochenen ÜBERTRAGUNG sagt der Satz „unklar", nicht „nicht gespeichert"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

const box = vi.hoisted(() => ({
  ko: null as unknown,
  aktionen: [] as Record<string, unknown>[],
  aktFehler: null as Error | null,
  // R6: die ANGEHALTENE Antwort. Solange hier ein Versprechen liegt, ist die Absendung unterwegs —
  // der Mensch tippt derweil weiter. Erst das Auflösen liefert den Erfolg nach (H9).
  halt: null as Promise<void> | null,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: vi.fn(async () => [box.ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (_id: string, body: Record<string, unknown>) => {
          box.aktionen.push(body);
          if (box.halt) {
            await box.halt;
          }
          if (box.aktFehler) {
            throw box.aktFehler;
          }
          return box.ko;
        }),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u1", name: "Eva" },
          { id: "u2", name: "Pedi" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
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
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView =
  () => {};

const FRAGE = "frage-1";
const FRAGE2 = "frage-2";
const ANTWORT = "antwort-1";

interface Beitrag {
  id: string;
  author: string;
  text: string;
  at: string;
  replyTo?: string;
  koVersion?: number;
  resolution?: { state: "erledigt" | "offen"; by: string; at: string };
}

function ko(comments: Beitrag[], version = 5): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments,
    sources: [],
    attachments: [],
  } as unknown as KnowledgeObject;
}

const frage = (over: Partial<Beitrag> = {}): Beitrag => ({
  id: FRAGE,
  author: "u2",
  text: "Gilt das auch für Linie 3?",
  at: "2026-08-02T08:00:00.000Z",
  koVersion: 3,
  ...over,
});

/**
 * Ein Bestandsbeitrag OHNE Fassungsbezug — das Feld fehlt wirklich, es steht nicht auf `undefined`.
 * Genau so liegt ein Altkommentar im Bestand (Vertrag Fall 1), und nur so misst H2b die richtige Lage.
 */
const frageOhneVersion = (): Beitrag => {
  const { koVersion: _fehlt, ...rest } = frage();
  return rest;
};

/** Ein zweiter Wurzelbeitrag — nur so lässt sich der FADENWECHSEL überhaupt messen (H7). */
const frage2 = (over: Partial<Beitrag> = {}): Beitrag => ({
  id: FRAGE2,
  author: "u2",
  text: "Und wie oft wird gespült?",
  at: "2026-08-02T09:00:00.000Z",
  koVersion: 4,
  ...over,
});

const antwort = (over: Partial<Beitrag> = {}): Beitrag => ({
  id: ANTWORT,
  author: "u1",
  text: "Ja, seit der Umrüstung im Mai.",
  at: "2026-08-03T09:00:00.000Z",
  koVersion: 5,
  replyTo: FRAGE,
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(bestand: KnowledgeObject): Promise<void> {
  box.ko = bestand;
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
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
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
  await diskussionOeffnen();
}

/** Der Weg, den ein Mensch geht: „Mehr" aufklappen, dann den Abschnitt aufklappen. */
async function diskussionOeffnen(): Promise<void> {
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("Der Knopf „Mehr“ fehlt auf der Lesefläche");
  }
  await ausloesen(mehr);
  const d = container.querySelector<HTMLDetailsElement>('[data-bib-abschnitt="kommentare"]');
  if (!d) {
    throw new Error("Der Abschnitt der Diskussion ist nicht gemountet");
  }
  await act(async () => {
    d.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

async function tippen(feld: HTMLTextAreaElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

const el = (marke: string, wert?: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(wert ? `[${marke}="${wert}"]` : `[${marke}]`);

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * Eine Absendung anhalten und später nachliefern. Zurück kommt der Griff, der den Erfolg freigibt —
 * ohne ihn bleibt die Mutation hängen, genau wie eine Antwort, die auf dem Rückweg trödelt.
 */
function absendungAnhalten(): () => Promise<void> {
  let freigeben: () => void = () => {};
  box.halt = new Promise<void>((r) => {
    freigeben = r;
  });
  return async () => {
    box.halt = null;
    await act(async () => {
      freigeben();
      await flush();
    });
    await act(flush);
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.aktionen = [];
  box.aktFehler = null;
  box.halt = null;
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
});

describe("JOB 4146 · D6 — Diskussion auf der Lesefläche", () => {
  it("H1 · die Antwort steht unter ihrem Bezugsbeitrag", async () => {
    await mount(ko([frage(), antwort()]));

    const wurzel = el("data-bib-diskussion-beitrag", FRAGE);
    const kind = el("data-bib-diskussion-beitrag", ANTWORT);
    expect(wurzel).not.toBeNull();
    expect(kind).not.toBeNull();
    // ENTHALTENSEIN, nicht Reihenfolge: eine flache Liste in der richtigen Sortierung sähe gleich
    // aus und wäre doch kein Faden.
    expect(wurzel?.contains(kind as Node)).toBe(true);
    expect(text(kind)).toContain("Ja, seit der Umrüstung im Mai.");
  });

  it("H2 · der Fassungsbezug steht am Beitrag — mit beiden Zahlen, wenn der Eintrag weiterging", async () => {
    await mount(ko([frage({ koVersion: 3 }), antwort({ koVersion: 5 })], 5));

    const alt = text(el("data-bib-diskussion-version", FRAGE));
    expect(alt).toContain("3");
    expect(alt).toContain("5");
    // Der Beitrag auf der aktuellen Fassung nennt nur seine eigene Zahl — sonst behauptete die
    // Fläche eine Abweichung, die es nicht gibt.
    const aktuell = text(el("data-bib-diskussion-version", ANTWORT));
    expect(aktuell).toContain("5");
    expect(aktuell).not.toContain("3");
  });

  it("H2b · ein Beitrag ohne Fassungsbezug sagt „unbekannt“ und erfindet keine Zahl (Vertrag Fall 1)", async () => {
    await mount(ko([frageOhneVersion()], 5));

    const zeile = text(el("data-bib-diskussion-version", FRAGE));
    expect(zeile).not.toBe("");
    expect(zeile).not.toMatch(/\d/);
  });

  it("H3 · antworten, erledigt setzen, wieder öffnen — über die echten Aktionen", async () => {
    await mount(ko([frage()]));

    // 1 · ANTWORTEN
    const antwortenKnopf = el("data-bib-diskussion-antworten", FRAGE);
    expect(antwortenKnopf).not.toBeNull();
    await ausloesen(antwortenKnopf as HTMLElement);
    const feld = el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null;
    expect(feld).not.toBeNull();
    await tippen(feld as HTMLTextAreaElement, "Ja, seit Mai.");
    await ausloesen(el("data-bib-diskussion-antwortsenden", FRAGE) as HTMLElement);

    expect(box.aktionen.at(-1)).toMatchObject({
      action: "comment",
      text: "Ja, seit Mai.",
      replyTo: FRAGE,
    });
    // Der Beitragsschlüssel reist mit — er ist der Idempotenzumfang dieses Pakets (Vertrag Fall 5).
    expect(typeof box.aktionen.at(-1)?.clientKey).toBe("string");

    // 2 · ERLEDIGT SETZEN
    await ausloesen(el("data-bib-diskussion-erledigen", FRAGE) as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual({ action: "comment-resolve", commentId: FRAGE });
  });

  it("H3b · ein erledigter Faden zeigt Urheber und Zeitpunkt und lässt sich wieder öffnen", async () => {
    await mount(
      ko([
        frage({
          resolution: { state: "erledigt", by: "u1", at: "2026-08-04T10:00:00.000Z" },
        }),
      ]),
    );

    const stand = text(el("data-bib-diskussion-klaerung", FRAGE));
    expect(stand).toContain("Eva");
    expect(stand).toMatch(/2026/);
    // DER WORTLAUT: geklärt, nie freigegeben oder geprüft.
    expect(stand.toLowerCase()).not.toMatch(/freigegeben|freigabe|geprüft|validiert/);

    await ausloesen(el("data-bib-diskussion-oeffnen", FRAGE) as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual({ action: "comment-reopen", commentId: FRAGE });
  });

  it("H4 · scheitert das Absenden, bleibt der getippte Text stehen — mit einem verständlichen Satz daneben", async () => {
    await mount(ko([frage()]));
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    const feld = el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement;
    await tippen(feld, "Meine mühsam getippte Antwort.");

    box.aktFehler = new Error("Netz weg");
    await ausloesen(el("data-bib-diskussion-antwortsenden", FRAGE) as HTMLElement);

    const nachher = el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null;
    expect(nachher?.value).toBe("Meine mühsam getippte Antwort.");
    const satz = text(el("data-testid", "bib-diskussion-fehler"));
    expect(satz.length).toBeGreaterThan(20);
    expect(satz).not.toContain("ko.diskussion");
  });

  it("H4b · derselbe Schutz am Feld für einen neuen Beitrag", async () => {
    await mount(ko([]));

    const feld = container.querySelector<HTMLTextAreaElement>(
      '[data-bib-abschnitt="kommentare"] textarea',
    );
    expect(feld).not.toBeNull();
    await tippen(feld as HTMLTextAreaElement, "Ein neuer Beitrag.");

    box.aktFehler = new Error("Netz weg");
    const senden = el("data-bib-diskussion-senden");
    expect(senden).not.toBeNull();
    await ausloesen(senden as HTMLElement);

    expect(
      container.querySelector<HTMLTextAreaElement>('[data-bib-abschnitt="kommentare"] textarea')
        ?.value,
    ).toBe("Ein neuer Beitrag.");
    expect(text(el("data-testid", "bib-diskussion-fehler")).length).toBeGreaterThan(20);
  });

  it("H5 · der Leersatz gilt weiter — und er steht nur bei geladenem, leerem Bestand", async () => {
    await mount(ko([]));

    const abschnitt = container.querySelector('[data-bib-abschnitt="kommentare"]');
    expect(text(abschnitt)).toContain(i18n.t("ko.commentsEmpty"));
  });

  // ==============================================================================================
  // R5 · BEN-KORREKTURPFLICHT 2 — EIN ENTWURF GEHÖRT DEM MENSCHEN, NICHT DEM GEÖFFNETEN FELD
  // ==============================================================================================
  //
  // BEN hat in Runde 4 gemessen: `expected '' to be 'Mein erhaltenswerter Entwurf'`. Ein zweiter
  // Klick auf „Antworten" räumte das Feld leer — ohne dass je etwas gespeichert worden wäre. Das ist
  // dieselbe Zusage wie in H4, nur an der Bedienung statt am Fehlschlag: DER EINGEGEBENE TEXT GEHT
  // NIE VERLOREN, und „nie" schliesst das Aufräumen durch die eigene Fläche ein.
  it("H6 · erneut auf „Antworten“ klicken lässt den Entwurf stehen", async () => {
    await mount(ko([frage()]));

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Mein erhaltenswerter Entwurf",
    );

    // Derselbe Knopf noch einmal — ein Mensch klickt das, wenn er unsicher ist, ob der Klick ankam.
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);

    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("Mein erhaltenswerter Entwurf");
  });

  it("H6b · „Abbrechen“ schliesst nur das Feld — beim nächsten Öffnen steht der Entwurf noch da", async () => {
    await mount(ko([frage()]));

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Halb fertig gedacht",
    );

    const abbrechen = Array.from(container.querySelectorAll<HTMLElement>("button")).find(
      (b) => text(b) === i18n.t("ko.diskussion.antwortAbbrechen"),
    );
    expect(abbrechen).toBeDefined();
    await ausloesen(abbrechen as HTMLElement);
    expect(el("data-bib-diskussion-antwortfeld", FRAGE)).toBeNull();

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("Halb fertig gedacht");
  });

  it("H7 · der Fadenwechsel erhält beide Entwürfe — und vermischt sie nicht", async () => {
    await mount(ko([frage(), frage2()]));

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Entwurf zum ersten Faden",
    );

    // Hinüber in den zweiten Faden: sein Feld ist LEER — ein fremder Entwurf, der dort auftauchte,
    // wäre eine Antwort, die niemand für diesen Faden geschrieben hat.
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE2) as HTMLElement);
    const zweites = el("data-bib-diskussion-antwortfeld", FRAGE2) as HTMLTextAreaElement | null;
    expect(zweites).not.toBeNull();
    expect(zweites?.value).toBe("");
    await tippen(zweites as HTMLTextAreaElement, "Entwurf zum zweiten Faden");

    // Und zurück: der erste Entwurf steht noch, wortgleich.
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("Entwurf zum ersten Faden");

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE2) as HTMLElement);
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE2) as HTMLTextAreaElement | null)?.value,
    ).toBe("Entwurf zum zweiten Faden");
  });

  // ==============================================================================================
  // R5 · BEN-KORREKTURPFLICHT 3 — WAS DIE FLÄCHE NICHT WEISS, BEHAUPTET SIE NICHT
  // ==============================================================================================
  //
  // „Der Beitrag wurde nicht gespeichert" ist bei einer ABGEBROCHENEN ÜBERTRAGUNG unbelegt: der
  // Server kann geschrieben und nur die Antwort verloren haben (genau die Lage, die W1 am Bestand
  // misst). Wo eine Antwort DA ist und sie eine Ablehnung ist, darf der Satz bestimmt sein — 403 ist
  // eine belegte Nicht-Speicherung. Die Unterscheidung ist der ganze Punkt.
  it("H8 · abgebrochene Übertragung: der Satz nennt den Speicherstand als unklar", async () => {
    await mount(ko([]));
    const feld = container.querySelector<HTMLTextAreaElement>(
      '[data-bib-abschnitt="kommentare"] textarea',
    ) as HTMLTextAreaElement;
    await tippen(feld, "Ein neuer Beitrag.");

    // Kein `ApiError`: die Anfrage ist nie zu einer Antwort gekommen.
    box.aktFehler = new Error("Failed to fetch");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    const satz = text(el("data-testid", "bib-diskussion-fehler"));
    expect(satz).toBe(i18n.t("ko.diskussion.sendeFehlerUnklar"));
    // DER FANG: vor der Korrektur stand hier der bestimmte Satz.
    expect(satz).not.toBe(i18n.t("ko.diskussion.sendeFehler"));
    // Und der Text ist trotzdem noch da — die Zusage aus H4 gilt unverändert.
    expect(
      container.querySelector<HTMLTextAreaElement>('[data-bib-abschnitt="kommentare"] textarea')
        ?.value,
    ).toBe("Ein neuer Beitrag.");
  });

  it("H8b · eine beantwortete Ablehnung (403) darf bestimmt bleiben — sie ist belegt", async () => {
    await mount(ko([]));
    const feld = container.querySelector<HTMLTextAreaElement>(
      '[data-bib-abschnitt="kommentare"] textarea',
    ) as HTMLTextAreaElement;
    await tippen(feld, "Ein neuer Beitrag.");

    box.aktFehler = new ApiError(403, "FORBIDDEN", "Kein Zugriff auf dieses Wissensobjekt.");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    const satz = text(el("data-testid", "bib-diskussion-fehler"));
    expect(satz).toContain(i18n.t("ko.diskussion.sendeFehler"));
    expect(satz).not.toContain(i18n.t("ko.diskussion.sendeFehlerUnklar"));
  });

  // ==============================================================================================
  // R6 · BEN-KORREKTURPFLICHT 1 — DER ERFOLG RÄUMT NUR WEG, WAS ER MITGENOMMEN HAT
  // ==============================================================================================
  //
  // BEN hat in Runde 5 gemessen: `expected '' to be 'Erste Fassung mit wichtigem Zusatz'`. Abgesendet
  // war „Erste Fassung"; während die Antwort unterwegs war, schrieb der Mensch weiter; der
  // eintreffende Erfolg löschte den GANZEN Entwurf — auch den Teil, den der Server nie gesehen hat.
  // Das Feld bleibt während des Absendens absichtlich bearbeitbar; also muss die Bereinigung wissen,
  // WAS sie bestätigt bekommen hat, statt einfach alles wegzuwerfen.
  it("H9 · verzögerter Erfolg: was nach dem Absenden dazukam, bleibt stehen", async () => {
    await mount(ko([frage()]));
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    const feld = el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement;
    await tippen(feld, "Erste Fassung");

    const nachliefern = absendungAnhalten();
    await ausloesen(el("data-bib-diskussion-antwortsenden", FRAGE) as HTMLElement);
    // Die Antwort hängt — und der Mensch schreibt weiter. Genau das ist der Fall.
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Erste Fassung mit wichtigem Zusatz",
    );
    // Abgesendet wurde NUR die erste Fassung — das ist die Voraussetzung des ganzen Falls.
    expect(box.aktionen.at(-1)).toMatchObject({ text: "Erste Fassung", replyTo: FRAGE });
    await nachliefern();

    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("Erste Fassung mit wichtigem Zusatz");
  });

  it("H9b · derselbe Schutz am Feld für einen neuen Beitrag", async () => {
    await mount(ko([]));
    const feld = () =>
      container.querySelector<HTMLTextAreaElement>(
        '[data-bib-abschnitt="kommentare"] textarea',
      ) as HTMLTextAreaElement;
    await tippen(feld(), "Ein neuer Beitrag");

    const nachliefern = absendungAnhalten();
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    await tippen(feld(), "Ein neuer Beitrag mit Nachtrag");
    expect(box.aktionen.at(-1)).toMatchObject({ text: "Ein neuer Beitrag" });
    await nachliefern();

    expect(feld().value).toBe("Ein neuer Beitrag mit Nachtrag");
  });

  it("H10 · KALIBRIERUNG: ist nichts dazugekommen, räumt der Erfolg auch wirklich auf", async () => {
    await mount(ko([frage()]));
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Ja, so ist es.",
    );
    await ausloesen(el("data-bib-diskussion-antwortsenden", FRAGE) as HTMLElement);

    // Das Feld ist zu (der Faden wurde beantwortet) — und beim nächsten Öffnen ist es leer.
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("");
  });

  it("H10b · KALIBRIERUNG am Feld für neue Beiträge: der glatte Erfolg leert es", async () => {
    await mount(ko([]));
    const feld = () =>
      container.querySelector<HTMLTextAreaElement>(
        '[data-bib-abschnitt="kommentare"] textarea',
      ) as HTMLTextAreaElement;
    await tippen(feld(), "Kurz und fertig.");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    expect(feld().value).toBe("");
  });

  // ==============================================================================================
  // R6 · BEN-KORREKTURPFLICHT 2 — DER WIEDERHOLUNGSWEG DARF DEN ENTWURF NICHT KOSTEN
  // ==============================================================================================
  //
  // Der Fehlersatz forderte zum NEULADEN auf. Die Entwürfe liegen im Komponentenzustand — wer der
  // Anweisung folgt, verliert genau den Text, den derselbe Satz als erhalten bezeichnet. BEN hat das
  // durch Neuaufbau von Seite und Cache gemessen: `expected '' to be 'Mein noch nicht gespeicherter
  // Beitrag'`. Statt das Neuladen abzusichern, verschwindet die Aufforderung: der Weg zurück ist ein
  // Knopf NEBEN dem Satz, und er nimmt denselben Beitragsschlüssel mit.
  it("H11 · nach einem Fehlschlag steht ein Wiederholungsknopf neben dem Satz", async () => {
    await mount(ko([]));
    const feld = () =>
      container.querySelector<HTMLTextAreaElement>(
        '[data-bib-abschnitt="kommentare"] textarea',
      ) as HTMLTextAreaElement;
    await tippen(feld(), "Mein noch nicht gespeicherter Beitrag");

    box.aktFehler = new Error("Failed to fetch");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    const gescheitert = box.aktionen.at(-1);

    const erneut = el("data-bib-diskussion-erneut");
    expect(erneut).not.toBeNull();

    // Der Weg gelingt beim zweiten Mal — und er schickt DASSELBE noch einmal, Schlüssel inbegriffen.
    box.aktFehler = null;
    await ausloesen(erneut as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual(gescheitert);
    // Danach ist der Satz weg und das Feld geleert: der Beitrag ist durch.
    expect(el("data-testid", "bib-diskussion-fehler")).toBeNull();
    expect(feld().value).toBe("");
  });

  it("H11b · der Wiederholungsknopf gilt auch für die Antwort und behält ihren Bezug", async () => {
    await mount(ko([frage()]));
    await ausloesen(el("data-bib-diskussion-antworten", FRAGE) as HTMLElement);
    await tippen(
      el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement,
      "Meine Antwort.",
    );

    box.aktFehler = new Error("Failed to fetch");
    await ausloesen(el("data-bib-diskussion-antwortsenden", FRAGE) as HTMLElement);
    const gescheitert = box.aktionen.at(-1);
    // Der Entwurf steht noch — ohne ihn wäre der Knopf sinnlos.
    expect(
      (el("data-bib-diskussion-antwortfeld", FRAGE) as HTMLTextAreaElement | null)?.value,
    ).toBe("Meine Antwort.");

    box.aktFehler = null;
    await ausloesen(el("data-bib-diskussion-erneut") as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual(gescheitert);
    expect(box.aktionen.at(-1)).toMatchObject({ replyTo: FRAGE, text: "Meine Antwort." });
  });

  it("H11c · ohne Fehlschlag gibt es keinen Wiederholungsknopf", async () => {
    await mount(ko([frage()]));
    expect(el("data-bib-diskussion-erneut")).toBeNull();
  });

  it("H8c · der Versionskonflikt (409) behält seinen eigenen Satz", async () => {
    await mount(ko([]));
    const feld = container.querySelector<HTMLTextAreaElement>(
      '[data-bib-abschnitt="kommentare"] textarea',
    ) as HTMLTextAreaElement;
    await tippen(feld, "Ein neuer Beitrag.");

    box.aktFehler = new ApiError(409, "STALE_WRITE", "Nebenläufige Änderung.");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    expect(text(el("data-testid", "bib-diskussion-fehler"))).toContain(
      i18n.t("ko.diskussion.sendeFehlerVeraltet"),
    );
  });
});
