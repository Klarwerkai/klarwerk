// @vitest-environment jsdom
// ================================================================================================
// JOB 3362 · LESEVARIANTE-FLAECHEN — DIE ÜBERSETZUNG STEHT AUCH IN DER BIBLIOTHEK.
// ================================================================================================
//
// JOB 3326 hat die Leseübersetzung gebaut und an zwei Stellen gezeigt: `/wissen/:id` und die
// Kurzvorschau. Die BIBLIOTHEK — Liste links, Lesefläche rechts — blieb beim Originaltitel; das
// stand dort als benannte Restschuld (RUECKGABE 3326 R2, ABWEICHUNGEN 1). Diese Datei misst an der
// GEMOUNTETEN Fläche, dass beide Stellen jetzt in der Lesesprache lesen — und, genauso wichtig,
// dass das Original Wahrheit bleibt.
//
// ------------------------------------------------------------------------------------------------
// DER AUFBAU, und warum er so und nicht bequemer ist
// ------------------------------------------------------------------------------------------------
// · Gemountet wird die ECHTE Seite (`pages/Library` → `BibliothekFlaeche` → Liste + Lesefläche),
//   nicht ein Nachbau der zwei Bauteile. Eine Probe, die `BibliothekListe` mit erfundenen `posten`
//   fütterte, wüsste nichts davon, ob die Fläche den Titel überhaupt bis dorthin reicht.
// · Ersetzt sind nur die zwei Aussenkanten: die Datenhaken (`api/hooks`) und der Endpunkt
//   `endpoints.lesevarianten`. Der Vorrat, `anzuzeigendeVariante`, `useFrischeLesevariante` und der
//   Hinweis-Baustein laufen ECHT — sie sind der Gegenstand der Messung.
// · DIE KALIBRIERUNG: drei Einträge. Zwei mit Übersetzung, deren übersetzte Titel die alphabetische
//   Reihenfolge der Originale UMDREHEN (Alpha→Zeta, Beta→Alpha), und einer ganz ohne. Eine Fläche,
//   die die Übersetzung in Reihung oder Suche durchschlagen liesse, fällt daran durch; eine, die
//   pauschal übersetzte, fiele an `ko-gamma` durch.
// · Die Suchroute ist hier ABSICHTLICH ungefiltert (sie liefert immer alle drei). Gemessen wird
//   deshalb, was der Client daraus macht: die Reihung durch `searchLibrary`/`sortLibrary`. Genau die
//   ist die Stelle, an der eine übersetzte Anzeige durchschlagen KÖNNTE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject, Lesevariante, LesevarianteKurz } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
    bodyHtml: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    anzeigestatus: "validiert",
    ...overrides,
  } as KnowledgeObject;
}

// ---- Der Bestand ------------------------------------------------------------------------------
//
// `ko-alpha` und `ko-beta` tragen eine deutsche Lesefassung, `ko-gamma` keine. Die Originaltitel
// stehen alphabetisch Alpha < Beta < Gamma; die ÜBERSETZTEN Titel stünden Alpha(=beta) < Zeta(=alpha).
const KOS: readonly KnowledgeObject[] = [
  ko({
    id: "ko-alpha",
    title: "Alpha pressure limits",
    statement: "Keep six bar in the header.",
    bodyHtml: "<p>Original body of the pressure article.</p>",
  }),
  ko({
    id: "ko-beta",
    title: "Beta valve inspection",
    statement: "Inspect the valve yearly.",
    bodyHtml: "<p>Original body of the valve article.</p>",
  }),
  ko({
    id: "ko-gamma",
    title: "Gamma untranslated entry",
    statement: "This one has no reading translation.",
    bodyHtml: "<p>Original body of the gamma article.</p>",
  }),
];

function kurz(overrides: Partial<LesevarianteKurz> & { koId: string }): LesevarianteKurz {
  return {
    lang: "de",
    originalLanguage: "en",
    title: "",
    statement: "",
    herkunft: "lokale Lieferung advisor-ict-en-v1",
    status: "geliefert",
    originalGeaendert: false,
    quellabgleich: "bestaetigt",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function voll(k: LesevarianteKurz, bodyHtml: string): Lesevariante {
  return {
    ...k,
    bodyHtml,
    sourceBodySha256: null,
    originalSha256: "a".repeat(64),
    uebersetzungSha256: "b".repeat(64),
  };
}

/** Die deutschen Lesefassungen — das, was der Server auf `lang=de` herausgibt. */
const DE: Record<string, Lesevariante> = {
  "ko-alpha": voll(
    kurz({
      koId: "ko-alpha",
      title: "Zeta Druckgrenzen",
      statement: "Sechs bar in der Sammelleitung halten.",
    }),
    "<p>Uebersetzter Fliesstext zum Druckartikel.</p>",
  ),
  "ko-beta": voll(
    kurz({
      koId: "ko-beta",
      title: "Alpha Ventilpruefung",
      statement: "Das Ventil jaehrlich pruefen.",
    }),
    "<p>Uebersetzter Fliesstext zum Ventilartikel.</p>",
  ),
};

// ================================================================================================
// DER FALL, DER DIE REGEL WIRKLICH PRÜFT: eine Fassung IN der Originalsprache.
// ================================================================================================
// Auf `lang=en` gibt der Server hier einen Datensatz heraus, dessen `originalLanguage` ebenfalls
// „en" ist. Nach der einen Regel aus JOB 3326 (`anzuzeigendeVariante`) darf er NICHT als Übersetzung
// erscheinen. Sein Text ist deshalb als „NICHT ZEIGEN" markiert: taucht er irgendwo auf der Fläche
// auf, ist die Regel gebrochen — und nicht bloss ein Datensatz gefehlt.
const EN: Record<string, Lesevariante> = {
  "ko-alpha": voll(
    kurz({
      koId: "ko-alpha",
      lang: "en",
      originalLanguage: "en",
      title: "NICHT ZEIGEN Titel",
      statement: "NICHT ZEIGEN Kernaussage",
    }),
    "<p>NICHT ZEIGEN Fliesstext</p>",
  ),
};

const box = vi.hoisted(() => ({
  /** Wird gesetzt, antwortet `fuerKo` für DIESE Kennung mit einem echten Serverfehler. */
  fehlerFuer: null as string | null,
  uebersichtRufe: [] as string[],
  fuerKoRufe: [] as string[],
}));

vi.mock("../../apps/web/src/api/hooks", async () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const echt = await vi.importActual<Record<string, unknown>>("../../apps/web/src/api/hooks");
  return {
    ...echt,
    useKos: () => ok(KOS),
    // ABSICHTLICH ungefiltert: die Filterung macht im Produkt der Server. Was der Client mit der
    // Menge tut (Reihung, Trefferbegründung), ist genau das, was hier gemessen wird.
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const echt = await vi.importActual<Record<string, unknown>>("../../apps/web/src/api/endpoints");
  const { ApiError } = await vi.importActual<{
    ApiError: new (s: number, c: string, m: string) => Error;
  }>("../../apps/web/src/api/client");
  const vorhanden = (lang: string): Record<string, Lesevariante> =>
    lang === "de" ? DE : lang === "en" ? EN : {};
  return {
    ...echt,
    endpoints: {
      ...(echt.endpoints as Record<string, unknown>),
      lesevarianten: {
        uebersicht: async (lang: string) => {
          box.uebersichtRufe.push(lang);
          return { lang, eintraege: Object.values(vorhanden(lang)) as LesevarianteKurz[] };
        },
        fuerKo: async (koId: string, lang: string) => {
          box.fuerKoRufe.push(`${koId}:${lang}`);
          if (box.fehlerFuer === koId) {
            throw new ApiError(500, "INTERNAL", "kaputt");
          }
          const treffer = vorhanden(lang)[koId];
          if (!treffer) {
            // Genau der Code, den `useFrischeLesevariante` als „es gibt keine" liest — alles
            // andere ist dort ein benannter Fehlzustand.
            throw new ApiError(404, "NO_LESEVARIANTE", "keine Lesevariante");
          }
          return treffer;
        },
      },
    },
  };
});

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde überall der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";
import { lesevariantenVerwerfen } from "../../apps/web/src/lib/lesevariante";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(element: JSX.Element, adresse = "/bibliothek"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, element),
      ),
    );
    await flush();
  });
  await act(flush);
}

/** Die Bibliothek auf `/bibliothek` — Liste links, Lesefläche rechts. */
async function bibliothek(): Promise<void> {
  await mount(createElement(Library));
}

/** Dieselbe Fläche über die Detailroute `/wissen/:id` (dort steht die Karte aus JOB 3326 davor). */
async function detail(id: string): Promise<void> {
  await mount(
    createElement(
      Routes,
      null,
      createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
    ),
    `/wissen/${id}`,
  );
}

async function spracheAuf(lang: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lang);
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  box.fehlerFuer = null;
  box.uebersichtRufe = [];
  box.fuerKoRufe = [];
  window.localStorage.clear();
  lesevariantenVerwerfen();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  lesevariantenVerwerfen();
  await i18n.changeLanguage("de");
});

// ---- Auslesen ----------------------------------------------------------------------------------

function zeilen(): HTMLElement[] {
  return [...container.querySelectorAll('[data-testid="bib-zeile"]')] as HTMLElement[];
}

function zeile(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zeile „${id}" fehlt; vorhanden: ${reihenfolge().join(", ")}`);
  }
  return el;
}

function reihenfolge(): string[] {
  return zeilen().map((el) => el.getAttribute("data-bib-id") ?? "?");
}

function zeilenTitel(id: string): string {
  const el = zeile(id).querySelector('[data-bib-text="zeile-titel"]');
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function zeilenTitelAttribut(id: string): string {
  const el = zeile(id).querySelector('[data-bib-text="zeile-titel"]');
  return el?.getAttribute("title") ?? "";
}

function zeilenKennzeichnung(id: string): string | null {
  const el = zeile(id).querySelector('[data-testid="bib-zeile-uebersetzung"]');
  return el === null ? null : (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function leseTitel(): string {
  const el = container.querySelector('[data-testid="bib-titel"]');
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function leseText(): string {
  const el = container.querySelector('[data-testid="bib-text"]');
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function hinweise(): HTMLElement[] {
  return [...container.querySelectorAll('[data-testid="lesevariante-hinweis"]')] as HTMLElement[];
}

function hinweisText(): string {
  return (hinweise()[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function alles(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function waehle(id: string): Promise<void> {
  await act(async () => {
    zeile(id).click();
    await flush();
  });
  await act(flush);
}

async function tippe(text: string): Promise<void> {
  const feld = container.querySelector('[data-testid="bib-suche"]');
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

// ================================================================================================
// L — DIE LISTE LINKS
// ================================================================================================
describe("L · Bibliotheksliste", () => {
  it("L-a · mit Variante und Sprache DE steht der übersetzte Titel samt Kennzeichnung in der Zeile", async () => {
    await bibliothek();
    expect(zeilenTitel("ko-alpha")).toBe("Zeta Druckgrenzen");
    expect(zeilenTitel("ko-beta")).toBe("Alpha Ventilpruefung");
    const kennzeichnung = zeilenKennzeichnung("ko-alpha");
    expect(kennzeichnung).not.toBeNull();
    // Wortlaut aus JOB 3326, kein zweiter: „Übersetzung · Original: Englisch".
    expect(kennzeichnung).toContain("Übersetzung");
    expect(kennzeichnung).toContain("Englisch");
  });

  it("L-b · in der Originalsprache (EN) steht das Original OHNE Kennzeichnung", async () => {
    await spracheAuf("en");
    await bibliothek();
    expect(zeilenTitel("ko-alpha")).toBe("Alpha pressure limits");
    expect(zeilenKennzeichnung("ko-alpha")).toBeNull();
    // Der Datensatz war da — die Regel hat ihn zurückgewiesen, nicht das Fehlen der Daten.
    expect(box.uebersichtRufe).toContain("en");
    expect(alles()).not.toContain("NICHT ZEIGEN");
  });

  it("L-c · ohne Variante steht das Original ohne Kennzeichnung — auf DERSELBEN Fläche", async () => {
    await bibliothek();
    // Die Gegenrichtung gehört in DENSELBEN Fall: eine Fläche, die gar nicht übersetzt, wäre sonst
    // grün. Erst die übersetzte Nachbarzeile macht das Schweigen an `ko-gamma` zur Aussage.
    expect(zeilenKennzeichnung("ko-alpha")).not.toBeNull();
    expect(zeilenTitel("ko-gamma")).toBe("Gamma untranslated entry");
    expect(zeilenKennzeichnung("ko-gamma")).toBeNull();
  });

  it("L-d · der Sprachwechsel wirkt live: EN → DE tauscht den Zeilentitel", async () => {
    await spracheAuf("en");
    await bibliothek();
    expect(zeilenTitel("ko-alpha")).toBe("Alpha pressure limits");
    await spracheAuf("de");
    expect(zeilenTitel("ko-alpha")).toBe("Zeta Druckgrenzen");
    expect(zeilenKennzeichnung("ko-alpha")).not.toBeNull();
    await spracheAuf("en");
    expect(zeilenTitel("ko-alpha")).toBe("Alpha pressure limits");
    expect(zeilenKennzeichnung("ko-alpha")).toBeNull();
  });

  it("L-e · das `title`-Attribut der Zeile bleibt der ORIGINALtitel", async () => {
    await bibliothek();
    expect(zeilenTitel("ko-alpha")).toBe("Zeta Druckgrenzen");
    expect(zeilenTitelAttribut("ko-alpha")).toBe("Alpha pressure limits");
    expect(zeilenTitelAttribut("ko-beta")).toBe("Beta valve inspection");
  });

  it("L-f · die REIHUNG folgt den Originaltiteln, nicht den übersetzten", async () => {
    await bibliothek();
    // Übersetzt stünde „Alpha Ventilpruefung" (ko-beta) vor „Zeta Druckgrenzen" (ko-alpha).
    expect(reihenfolge()).toEqual(["ko-alpha", "ko-beta", "ko-gamma"]);
    expect(zeilenTitel("ko-alpha")).toBe("Zeta Druckgrenzen");
  });

  it("L-g · die SUCHE greift auf das Original: ein Wort des Originals rankt, eines der Übersetzung nicht", async () => {
    await bibliothek();
    // „valve" steht NUR im Originaltitel von ko-beta → ko-beta rankt nach oben.
    await tippe("valve");
    expect(reihenfolge()[0]).toBe("ko-beta");
    // „Ventilpruefung" steht NUR in der Übersetzung von ko-beta → kein Treffer, keine Umreihung.
    await tippe("Ventilpruefung");
    expect(reihenfolge()).toEqual(["ko-alpha", "ko-beta", "ko-gamma"]);
    // Und die Anzeige bleibt derweil die übersetzte — Suche und Anzeige sind zwei Dinge.
    expect(zeilenTitel("ko-beta")).toBe("Alpha Ventilpruefung");
  });
});

// ================================================================================================
// R — DIE LESEFLÄCHE RECHTS
// ================================================================================================
describe("R · Bibliotheks-Lesefläche", () => {
  it("R-a · mit Variante und Sprache DE stehen Titel, Fließtext und der Hinweis-Baustein da", async () => {
    await bibliothek();
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
    expect(leseText()).toContain("Uebersetzter Fliesstext zum Druckartikel.");
    expect(leseText()).not.toContain("Original body of the pressure article.");
    expect(hinweise()).toHaveLength(1);
    expect(hinweisText()).toContain("Übersetzung");
    expect(hinweisText()).toContain("Englisch");
    // Der ehrliche Zusatz aus JOB 3326 — eine Übersetzung ist nie Freigabegegenstand.
    expect(hinweisText()).toContain("keine Freigabe");
  });

  it("R-b · in der Originalsprache (EN) steht das Original OHNE Hinweis", async () => {
    await spracheAuf("en");
    await bibliothek();
    expect(leseTitel()).toBe("Alpha pressure limits");
    expect(leseText()).toContain("Original body of the pressure article.");
    expect(hinweise()).toHaveLength(0);
    expect(alles()).not.toContain("NICHT ZEIGEN");
    // Die Gegenrichtung IM SELBEN Fall: dieselbe Fläche, eine Sprache weiter, übersetzt sehr wohl.
    // Ohne sie wäre auch eine Fläche grün, die gar keine Übersetzung kennt.
    await spracheAuf("de");
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
    expect(hinweise()).toHaveLength(1);
  });

  it("R-c · ohne Variante steht das Original ohne Hinweis", async () => {
    await bibliothek();
    // Erst der Beleg, dass diese Fläche übersetzt (`ko-alpha` ist vorgewählt) …
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
    // … dann der Eintrag ohne Lieferung: Original, kein Hinweis.
    await waehle("ko-gamma");
    expect(leseTitel()).toBe("Gamma untranslated entry");
    expect(leseText()).toContain("Original body of the gamma article.");
    expect(hinweise()).toHaveLength(0);
    // 404 „NO_LESEVARIANTE" ist kein Fehler — es steht kein Fehlersatz da.
    expect(container.querySelector('[data-testid="bib-lesevariante-fehler"]')).toBeNull();
  });

  it("R-d · der Sprachwechsel wirkt live: EN → DE tauscht Titel und Fließtext", async () => {
    await spracheAuf("en");
    await bibliothek();
    expect(leseTitel()).toBe("Alpha pressure limits");
    await spracheAuf("de");
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
    expect(leseText()).toContain("Uebersetzter Fliesstext zum Druckartikel.");
    await spracheAuf("en");
    expect(leseTitel()).toBe("Alpha pressure limits");
    expect(hinweise()).toHaveLength(0);
  });

  it("R-e · der Umschalter führt zurück zum Original und wieder zurück", async () => {
    await bibliothek();
    const umschalter = container.querySelector('[data-testid="lesevariante-umschalter"]');
    if (!(umschalter instanceof HTMLButtonElement)) {
      throw new Error("Umschalter fehlt");
    }
    await act(async () => {
      umschalter.click();
      await flush();
    });
    expect(leseTitel()).toBe("Alpha pressure limits");
    expect(leseText()).toContain("Original body of the pressure article.");
    // Der Hinweis bleibt stehen — er sagt jetzt „Original (Englisch)" und bietet den Rückweg.
    expect(hinweise()).toHaveLength(1);
    const zurueck = container.querySelector('[data-testid="lesevariante-umschalter"]');
    await act(async () => {
      (zurueck as HTMLButtonElement).click();
      await flush();
    });
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
  });

  it("R-f · das Original bleibt Wahrheit: Bereich und der Weg zur Fragen-Seite hängen am Original", async () => {
    await bibliothek();
    expect(leseTitel()).toBe("Zeta Druckgrenzen");
    // Die Meta-Zeile nennt den Bereich des Objekts — unübersetzt, wie jede andere Tatsache.
    expect(alles()).toContain("Anlage 1");
    // `fragenHref` belegt die Frage mit dem ORIGINALtitel vor (`BibliothekLesen.tsx`, `fragen`).
    const link = [...container.querySelectorAll("a")].find((a) =>
      (a.getAttribute("href") ?? "").includes("/fragen"),
    );
    expect(link).toBeDefined();
    expect(decodeURIComponent(link?.getAttribute("href") ?? "")).toContain("Alpha pressure limits");
  });

  it("R-g · scheitert der Abruf, steht das ORIGINAL da — und der Fehlzustand wird benannt", async () => {
    box.fehlerFuer = "ko-alpha";
    await bibliothek();
    expect(leseTitel()).toBe("Alpha pressure limits");
    expect(leseText()).toContain("Original body of the pressure article.");
    expect(hinweise()).toHaveLength(0);
    expect(container.querySelector('[data-testid="bib-lesevariante-fehler"]')).not.toBeNull();
  });
});

// ================================================================================================
// V — VERTRÄGLICHKEIT MIT JOB 3326: DIE AUSSAGE STEHT GENAU EINMAL
// ================================================================================================
describe("V · /wissen/:id sagt es nicht zweimal", () => {
  it("V-1 · auf der Detailroute steht genau EIN Hinweis-Baustein und die Lesefläche fragt nicht nach", async () => {
    await detail("ko-alpha");
    // Dass diese Fläche die Übersetzung überhaupt kennt, steht IM SELBEN Fall — sonst wäre eine
    // Fläche ohne jede Übersetzung ebenfalls „genau einmal".
    expect(zeilenKennzeichnung("ko-alpha")).not.toBeNull();
    expect(hinweise()).toHaveLength(1);
    // Die Karte aus JOB 3326 trägt ihn (`lesevariante-leseansicht`), die Lesefläche schweigt.
    expect(container.querySelector('[data-testid="lesevariante-leseansicht"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-titel"]')?.textContent).toBe(
      "Alpha pressure limits",
    );
    // Und sie fragt den Server auch nicht ein zweites Mal für dasselbe Objekt.
    expect(box.fuerKoRufe.filter((r) => r === "ko-alpha:de")).toHaveLength(1);
  });

  it("V-2 · die LISTE übersetzt auch auf der Detailroute — dort gibt es keine zweite Aussage", async () => {
    await detail("ko-alpha");
    expect(zeilenTitel("ko-alpha")).toBe("Zeta Druckgrenzen");
    expect(zeilenKennzeichnung("ko-alpha")).not.toBeNull();
  });
});
