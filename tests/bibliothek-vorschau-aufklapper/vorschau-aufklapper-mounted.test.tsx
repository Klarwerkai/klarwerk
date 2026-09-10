// @vitest-environment jsdom
// ================================================================================================
// JOB 3488 · BIBLIOTHEK-VORSCHAU-AUFKLAPPER — EINEN TREFFER ÜBERFLIEGEN, OHNE IHN ZU ÖFFNEN.
// ================================================================================================
//
// DER BEFUND: eine Trefferzeile der Bibliothek trug Titel, Bereich, Zustand und Vertraulichkeit —
// und sonst nichts. Wer wissen wollte, worum es geht, musste den Eintrag ÖFFNEN und damit die Liste
// verlassen. Der einzige Bedienweg der Zeile war ihr Klick.
//
// WAS JETZT GILT: jeder Treffer trägt einen eigenen, unabhängig auf- und zuklappbaren Vorschautext
// aus der BEREITS VORHANDENEN Kernaussage. Kein zusätzlicher Abruf, kein Modelltext, kein neuer
// Wortlaut — der vorhandene Baustein `KoSummaryDisclosure` wird eingebunden, nicht nachgebaut.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN FLÄCHE (`BibliothekFlaeche`), NICHT AN DER LISTE ALLEIN: nur so
// ist auch die Verdrahtung mitgeprüft — dass `zeileAus` die Vorschauquelle aus dem ohnehin
// vorliegenden Suchobjekt bis in die Zeile reicht. Eine Probe, die `BibliothekListe` mit erfundenen
// `posten` fütterte, wüsste davon nichts.
//
//   F1  Umschalter an Treffer 2 → SEIN Text steht, die anderen nicht; Auswahl und Adresse ruhen
//   F2  alle drei aufgeklappt   → alle drei Texte stehen GLEICHZEITIG (die Unabhängigkeit)
//   F3  danach Klick auf Zeile 3 → genau `k3` ist gewählt (Adresse UND `beiWahl`)
//   F4  Treffer OHNE Kernaussage → kein Umschalter, kein leerer Kasten, kein erfundener Text
//   F5  Tastatur: Zeilenknopf und Umschalter sind zwei echte, nacheinander erreichbare `<button>`;
//       der Umschalter klappt auf und zu, ohne die Auswahl zu bewegen
//   F6  DOM-Gegenprobe: kein `button` liegt in einem anderen `button`
//   F7  Leseübersetzung → sie steht IM Aufklapper, gekennzeichnet; der Zeilentitel behält seine
//   F8  Gruppenköpfe bekommen keinen Aufklapper
//   F9  390 px (Telefon): derselbe Aufklapper, dieselbe Unabhängigkeit
//   F10 Lese-Tablet mit eingeklappter Liste: die Liste ist nicht im Baum — also auch kein Aufklapper
//   F11 der Zähler im Listenfuß zählt Treffer, nicht offene Vorschauen
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject, Lesevariante, LesevarianteKurz } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
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
    ...overrides,
  } as unknown as KnowledgeObject;
}

// ---- Der Bestand --------------------------------------------------------------------------------
//
// Drei Treffer mit Kernaussage und EINER ohne. Die drei Kernaussagen sind paarweise verschieden und
// stehen nirgends sonst auf der Fläche — nur so ist „steht der Text von Treffer 2 da?" eine Messung
// und keine Zufallsübereinstimmung. `k4` trägt eine LEERE Kernaussage (Altbestand): am Draht der
// Trefferliste gibt es kein `bodyHtml` (`repo.ts` `listForSearch`, Postgres `data - 'bodyHtml'`),
// also gibt es für diese Zeile schlicht keine Vorschau.
const AUSSAGE_1 = "Ventil X schliesst bei Überdruck selbsttätig.";
const AUSSAGE_2 = "Das Rührwerk Y wird vor jeder Reinigung entlüftet.";
const AUSSAGE_3 = "Die Pumpe Z wird nach dem Spülen leergefahren.";

const KOS = [
  ko({ id: "k1", title: "Ventil X bei Überdruck", statement: AUSSAGE_1, category: "Anlage 1" }),
  ko({ id: "k2", title: "Rührwerk Y entlüften", statement: AUSSAGE_2, category: "Anlage 1" }),
  ko({ id: "k3", title: "Pumpe Z leerfahren", statement: AUSSAGE_3, category: "Anlage 2" }),
  ko({ id: "k4", title: "Altbestand ohne Kernaussage", statement: "", category: "Anlage 2" }),
];

// ---- Die Leseübersetzung (nur für F7) ------------------------------------------------------------
//
// Sie liegt für `k1` vor, in DE, Original EN. Nach der einen Regel aus JOB 3326 zeigt die Fläche sie
// dann — mit sichtbarer Kennzeichnung, nie stillschweigend.
const UEBERSETZTE_AUSSAGE = "Ventil X schliesst bei Überdruck selbsttätig (Lesefassung).";
const VARIANTE_K1: Lesevariante = {
  koId: "k1",
  lang: "de",
  originalLanguage: "en",
  title: "Ventil X bei Überdruck (Lesefassung)",
  statement: UEBERSETZTE_AUSSAGE,
  herkunft: "lokale Lieferung test-v1",
  status: "geliefert",
  originalGeaendert: false,
  quellabgleich: "bestaetigt",
  updatedAt: "2026-09-01T00:00:00.000Z",
  bodyHtml: "<p>Lesefassung</p>",
  sourceBodySha256: null,
  originalSha256: "a".repeat(64),
  uebersetzungSha256: "b".repeat(64),
} as Lesevariante;

const stand = vi.hoisted(() => ({ mitUebersetzung: false }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: Date.parse("2026-09-08T09:30:00.000Z"),
    error: null,
    refetch: () => Promise.resolve({}),
  });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
    koQueryKey: (id: string) => ["ko", id],
  };
});

// Nur die Aussenkante „Übersetzungs-Endpunkt" wird ersetzt; der Vorrat (`lib/lesevariante.ts`) und
// `KoSummaryDisclosure` laufen ECHT — sie sind hier der Gegenstand, nicht die Kulisse.
vi.mock("../../apps/web/src/api/endpoints", async () => {
  const echt = await vi.importActual<Record<string, unknown>>("../../apps/web/src/api/endpoints");
  const { ApiError } = await vi.importActual<{
    ApiError: new (s: number, c: string, m: string) => Error;
  }>("../../apps/web/src/api/client");
  return {
    ...echt,
    endpoints: {
      ...(echt.endpoints as Record<string, unknown>),
      lesevarianten: {
        uebersicht: async (lang: string) => ({
          lang,
          eintraege:
            stand.mitUebersetzung && lang === "de"
              ? ([VARIANTE_K1] as unknown as LesevarianteKurz[])
              : [],
        }),
        fuerKo: async (koId: string, lang: string) => {
          if (stand.mitUebersetzung && lang === "de" && koId === "k1") {
            return VARIANTE_K1;
          }
          throw new ApiError(404, "NO_LESEVARIANTE", "keine Lesevariante");
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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { lesevariantenVerwerfen } from "../../apps/web/src/lib/lesevariante";
import { listenZaehler, waehleImMenue } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ---- Die Attrappe für `matchMedia` (Bauform aus `tests/ux21-tablet-lesemodus`) --------------------
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
let fensterBreite = 1280;
function passt(abfrage: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(abfrage);
  const max = /max-width:\s*(\d+)px/.exec(abfrage);
  if (min === null && max === null) {
    throw new Error(`matchMedia-Attrappe: unbekannte Abfrage „${abfrage}"`);
  }
  return (
    (min === null || fensterBreite >= Number(min[1])) &&
    (max === null || fensterBreite <= Number(max[1]))
  );
}
function setzeBreite(px: number): void {
  hoerer = [];
  fensterBreite = px;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    get matches() {
      return passt(abfrage);
    },
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
/** Jeder Ruf von `onWaehle` — die Zählung, die F1/F5 auf 0 halten. */
let gewaehltRufe: string[] = [];

/** Schreibt die aktuelle Adresse in den Baum — so wird „Adresse unverändert" zur Messung. */
function Sonde(): ReturnType<typeof createElement> {
  const ort = useLocation();
  return createElement("span", { "data-testid": "sonde-adresse" }, `${ort.pathname}${ort.search}`);
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function flaeche(adresse = "/bibliothek"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [adresse] },
          createElement(BibliothekFlaeche, {
            beiWahl: (id: string) => {
              gewaehltRufe.push(id);
            },
          }),
          createElement(Sonde),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  setzeBreite(1280);
  stand.mitUebersetzung = false;
  gewaehltRufe = [];
  window.localStorage.clear();
  lesevariantenVerwerfen();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  }
  hoerer = [];
  lesevariantenVerwerfen();
});

// ---- Griffe --------------------------------------------------------------------------------------

function block(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="bib-zeilenblock"][data-bib-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zeilenblock „${id}" fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

/** Der Vorschau-Umschalter DIESES Treffers — `null`, wenn die Zeile keinen trägt. */
function umschalter(id: string): HTMLButtonElement | null {
  const el = block(id).querySelector("button[aria-expanded]");
  return el instanceof HTMLButtonElement ? el : null;
}

function mussUmschalter(id: string): HTMLButtonElement {
  const el = umschalter(id);
  if (el === null) {
    throw new Error(`Umschalter an „${id}" fehlt; Block: ${block(id).innerHTML}`);
  }
  return el;
}

/** Der offene Vorschautext DIESES Treffers — `null`, solange nichts aufgeklappt ist. */
function vorschau(id: string): string | null {
  const p = block(id).querySelector("p");
  return p === null ? null : (p.textContent ?? "").replace(/\s+/g, " ").trim();
}

function klicke(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

function adresse(): string {
  return (
    container.querySelector('[data-testid="sonde-adresse"]')?.textContent ?? "KEINE SONDE"
  ).trim();
}

function gewaehlteId(): string | null {
  return (
    container
      .querySelector('[data-testid="bib-zeile"][aria-current="true"]')
      ?.getAttribute("data-bib-id") ?? null
  );
}

function zeilen(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="bib-zeile"]')];
}

// ================================================================================================
// F1–F3 · DER KERN: MEHRERE TREFFER GLEICHZEITIG ÜBERFLIEGEN, OHNE DIE LISTE ZU VERLASSEN
// ================================================================================================
describe("F · der Aufklapper je Treffer", () => {
  it("F1 · der Umschalter an Treffer 2 zeigt SEINEN Text — Auswahl und Adresse rühren sich nicht", async () => {
    await flaeche();
    const vorher = { adresse: adresse(), gewaehlt: gewaehlteId() };
    // Vor dem Klick trägt keine Zeile einen Vorschautext.
    expect(vorschau("k1")).toBeNull();
    expect(vorschau("k2")).toBeNull();
    expect(vorschau("k3")).toBeNull();

    klicke(mussUmschalter("k2"));

    expect(vorschau("k2")).toBe(AUSSAGE_2);
    expect(vorschau("k1")).toBeNull();
    expect(vorschau("k3")).toBeNull();
    // Der Umschalter sagt selbst, was er tut — und nur er hat sich bewegt.
    expect(mussUmschalter("k2").getAttribute("aria-expanded")).toBe("true");
    expect(mussUmschalter("k1").getAttribute("aria-expanded")).toBe("false");
    // Weder Auswahl noch Adresse noch ein Ruf an den Aufrufer.
    expect(gewaehlteId()).toBe(vorher.gewaehlt);
    expect(adresse()).toBe(vorher.adresse);
    expect(gewaehltRufe).toEqual([]);
  });

  it("F2 · an allen dreien aufgeklappt stehen alle drei Texte GLEICHZEITIG (jeder Aufklapper für sich)", async () => {
    await flaeche();
    klicke(mussUmschalter("k1"));
    klicke(mussUmschalter("k2"));
    klicke(mussUmschalter("k3"));
    expect(vorschau("k1")).toBe(AUSSAGE_1);
    expect(vorschau("k2")).toBe(AUSSAGE_2);
    expect(vorschau("k3")).toBe(AUSSAGE_3);
    // Und der zweite Klick schliesst genau EINEN wieder, nicht alle.
    klicke(mussUmschalter("k2"));
    expect(vorschau("k2")).toBeNull();
    expect(vorschau("k1")).toBe(AUSSAGE_1);
    expect(vorschau("k3")).toBe(AUSSAGE_3);
    expect(gewaehltRufe).toEqual([]);
  });

  it("F3 · ein Klick auf die Zeile daneben wählt weiterhin genau diesen Eintrag", async () => {
    await flaeche();
    klicke(mussUmschalter("k1"));
    klicke(mussUmschalter("k2"));
    const zeile3 = block("k3").querySelector('[data-testid="bib-zeile"]');
    if (!(zeile3 instanceof HTMLElement)) {
      throw new Error("Zeilenknopf k3 fehlt");
    }
    klicke(zeile3);
    expect(gewaehlteId()).toBe("k3");
    expect(gewaehltRufe).toEqual(["k3"]);
    expect(adresse()).toContain("eintrag=k3");
    // Die offenen Vorschauen überleben die Wahl — die Liste bleibt, wo sie war.
    expect(vorschau("k1")).toBe(AUSSAGE_1);
    expect(vorschau("k2")).toBe(AUSSAGE_2);
  });

  it("F4 · ein Treffer ohne Kernaussage bekommt KEINEN Umschalter und keinen leeren Kasten", async () => {
    await flaeche();
    // Erst der Beleg, dass diese Fläche überhaupt Aufklapper zeichnet …
    expect(umschalter("k1")).not.toBeNull();
    // … dann das Schweigen an der Zeile ohne Kernaussage.
    expect(umschalter("k4")).toBeNull();
    expect(vorschau("k4")).toBeNull();
    // Kein Ersatztext, keine Behauptung „kein Inhalt vorhanden": der Block trägt genau das, was die
    // Zeile schon vorher trug — Titel, Meta-Zeile, Stufe, und keine Silbe der Vorschau.
    const text = (block("k4").textContent ?? "").replace(/\s+/g, " ").trim();
    expect(text).toContain("Altbestand ohne Kernaussage");
    expect(text).toContain("Anlage 2");
    expect(text).not.toContain(i18n.t("ko.preview.show"));
    expect(text).not.toContain(i18n.t("ko.preview.label"));
    // Zum Vergleich: an einer Zeile MIT Kernaussage steht die Beschriftung sehr wohl.
    expect(block("k1").textContent ?? "").toContain(i18n.t("ko.preview.show"));
  });

  it("F5 · zwei echte Knöpfe hintereinander: Zeilenknopf, dann Umschalter — der Umschalter wählt nichts", async () => {
    await flaeche();
    const knoepfe = [...block("k2").querySelectorAll("button")];
    // Genau zwei, in dieser Reihenfolge — das IST die Tabreihenfolge, weil beide echte `<button>`
    // in Dokumentordnung sind: kein `tabIndex`-Basteln, kein `role="button"` auf einem `div`.
    expect(knoepfe).toHaveLength(2);
    expect(knoepfe[0]?.getAttribute("data-testid")).toBe("bib-zeile");
    expect(knoepfe[1]?.getAttribute("aria-expanded")).toBe("false");
    for (const k of knoepfe) {
      expect(k.tagName).toBe("BUTTON");
      expect(k.getAttribute("type")).toBe("button");
      expect(k.hasAttribute("tabindex")).toBe(false);
      expect(k.getAttribute("role")).toBeNull();
      expect(k.hasAttribute("disabled")).toBe(false);
    }
    // Beide sind fokussierbar, und der Fokus bleibt beim Bedienen am Umschalter stehen.
    const schalter = knoepfe[1] as HTMLButtonElement;
    act(() => {
      schalter.focus();
    });
    expect(document.activeElement).toBe(schalter);
    // jsdom leitet aus einem Tastendruck KEINEN Klick ab (das tut der Browser für `<button>`); was
    // hier gemessen wird, ist deshalb die Auslösung selbst: auf und wieder zu, ohne Auswahlwechsel.
    klicke(schalter);
    expect(vorschau("k2")).toBe(AUSSAGE_2);
    klicke(mussUmschalter("k2"));
    expect(vorschau("k2")).toBeNull();
    expect(document.activeElement).toBe(mussUmschalter("k2"));
    expect(gewaehltRufe).toEqual([]);
  });

  it("F6 · kein `button` liegt innerhalb eines anderen `button`", async () => {
    await flaeche();
    klicke(mussUmschalter("k1"));
    klicke(mussUmschalter("k3"));
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    // Fail-closed: die Abfrage muss überhaupt an Knöpfen vorbeikommen, sonst wäre sie immer grün.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(5);
  });

  it("F7 · liegt eine Leseübersetzung vor, steht SIE im Aufklapper — gekennzeichnet", async () => {
    stand.mitUebersetzung = true;
    await flaeche();
    klicke(mussUmschalter("k1"));
    expect(vorschau("k1")).toBe(UEBERSETZTE_AUSSAGE);
    expect(block("k1").querySelector('[data-testid="ko-preview-uebersetzung"]')).not.toBeNull();
    // Der Zeilentitel behält seine EIGENE Kennzeichnung (JOB 3362) — kein zweiter Wortlaut, aber
    // auch keine, die durch den Aufklapper verschwindet.
    expect(block("k1").querySelector('[data-testid="bib-zeile-uebersetzung"]')).not.toBeNull();
    // Die Gegenrichtung in DEMSELBEN Fall: ohne Lieferung bleibt es beim Original, ohne Vermerk.
    klicke(mussUmschalter("k2"));
    expect(vorschau("k2")).toBe(AUSSAGE_2);
    expect(block("k2").querySelector('[data-testid="ko-preview-uebersetzung"]')).toBeNull();
  });

  it("F8 · Gruppenköpfe tragen keinen Aufklapper", async () => {
    await flaeche();
    waehleImMenue(container, "bib-menue-filter", "Abteilung/Kategorie");
    const koepfe = [...container.querySelectorAll('[data-testid="bib-gruppenkopf"]')];
    expect(koepfe.length).toBeGreaterThan(0);
    for (const k of koepfe) {
      expect(k.querySelectorAll("button")).toHaveLength(0);
      expect(k.querySelectorAll("[aria-expanded]")).toHaveLength(0);
    }
    // Die Zeilen DARIN tragen ihn weiter — sonst wäre der Fall oben nur ein Nebeneffekt davon,
    // dass gruppiert gar keine Aufklapper entstehen.
    expect(umschalter("k1")).not.toBeNull();
  });

  it("F11 · der Zähler im Listenfuß zählt Treffer, nicht offene Vorschauen", async () => {
    await flaeche();
    expect(listenZaehler(container)).toBe(4);
    klicke(mussUmschalter("k1"));
    klicke(mussUmschalter("k2"));
    klicke(mussUmschalter("k3"));
    expect(listenZaehler(container)).toBe(4);
    expect(zeilen()).toHaveLength(4);
  });
});

// ================================================================================================
// F9/F10 · DIE ZWEI BREITEN
// ================================================================================================
describe("F · zwei Breiten", () => {
  it("F9 · 390 px (Telefon): derselbe Aufklapper, dieselbe Unabhängigkeit, kein Flächenwechsel", async () => {
    setzeBreite(390);
    await flaeche();
    // Ohne Wahl trägt schmal die Liste die Fläche allein (JOB 3121) — der Bericht steht nicht da.
    expect(container.querySelector('[data-testid="bib-lesen"]')).toBeNull();
    klicke(mussUmschalter("k1"));
    klicke(mussUmschalter("k3"));
    expect(vorschau("k1")).toBe(AUSSAGE_1);
    expect(vorschau("k3")).toBe(AUSSAGE_3);
    expect(vorschau("k2")).toBeNull();
    // Der Aufklapper hat die Fläche NICHT gewechselt: die Liste steht weiter, der Bericht nicht.
    expect(zeilen()).toHaveLength(4);
    expect(container.querySelector('[data-testid="bib-lesen"]')).toBeNull();
    expect(gewaehltRufe).toEqual([]);
  });

  it("F10 · Lese-Tablet (768) mit eingeklappter Liste: keine Zeile im Baum, also auch kein Aufklapper", async () => {
    setzeBreite(768);
    await flaeche("/bibliothek?eintrag=k1");
    // Die Zusage ist „nicht gebaut", nicht „nicht sichtbar" — gesucht wird im GANZEN Baum.
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    expect(zeilen()).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="bib-zeilenblock"]')).toHaveLength(0);
    // Und die Gegenrichtung im selben Fall: mit ausgeklappter Liste ist er wieder da.
    const schalter = container.querySelector('[data-testid="bib-liste-schalter"]');
    if (!(schalter instanceof HTMLButtonElement)) {
      throw new Error("Listenschalter des Lese-Tablets fehlt");
    }
    klicke(schalter);
    expect(umschalter("k2")).not.toBeNull();
  });
});
