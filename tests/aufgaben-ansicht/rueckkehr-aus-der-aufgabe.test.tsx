// @vitest-environment jsdom
// ================================================================================================
// JOB 3101 · UX-04 — DER REVIEWER LANDET NACH DEM BEARBEITEN WIEDER AN SEINER ARBEITSSTELLE.
// ================================================================================================
//
// DAS VERSPRECHEN, in einem Ablauf: Filter „Konflikte" wählen → in der Liste nach unten arbeiten →
// eine Aufgabe öffnen → Browser-Zurück → derselbe Filter, dieselbe Stelle.
//
// WARUM ECHTER POP UND NICHT EIN ZWEITES RENDERN MIT ANDEREM ANFANGSORT: Ein Test, der die Seite
// erneut mit `/aufgaben?art=conflict` mountet, beweist nur, dass die Seite eine Adresse lesen kann —
// nicht, dass der Rückweg des Browsers dort ankommt. Codex hat genau diese Abkürzung schon zweimal
// zurückgewiesen (JOB 3084 R1: „den behaupteten Rückkehrnachweis tatsächlich als dauerhaften Test
// liefern"; JOB 3083 R1: Persistenz ohne echten Wiedereintritt bleibt unbewiesen). Hier laufen
// deshalb eine echte `<Link>`-Navigation und ein echtes `window.history.back()` durch die
// jsdom-History — dieselbe Bauart wie `tests/app/navguard-pop-mounted.test.tsx`.
//
// WARUM DER SCROLLZUSTAND GESTELLT WIRD: jsdom hat kein Layout — `scrollY` ist immer 0 und
// `scrollHeight` immer 0. Beides wird deshalb ausdrücklich gestellt und `scrollTo` mitgeschrieben;
// gemessen wird, WAS die Seite anfährt, nicht ob jsdom scrollen kann. Die Zusagen darüber stehen
// unten im Fähigkeitsnachweis und werden zuerst geprüft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Conflict, Gap } from "../../apps/web/src/api/types";

// `laedt`: die Quellen haben (noch) keine Daten — der Rückweg vor dem Eintreffen der Antworten.
// `stand` + `hoerer` machen die gestellten Hooks reaktiv: `liefere()` lässt die Seite neu zeichnen,
// genau wie eine eintreffende Antwort.
const lage = vi.hoisted(() => ({
  gaps: [] as unknown[],
  conflicts: [] as unknown[],
  laedt: false,
  stand: 0,
  hoerer: new Set<() => void>(),
}));

vi.mock("../../apps/web/src/api/hooks", async () => {
  const { useSyncExternalStore } = await import("../../apps/web/node_modules/react");
  const abonniere = (h: () => void): (() => void) => {
    lage.hoerer.add(h);
    return () => lage.hoerer.delete(h);
  };
  const quelle = <T,>(data: T) => {
    useSyncExternalStore(abonniere, () => lage.stand);
    return lage.laedt
      ? { data: undefined, isLoading: true, isError: false, error: null }
      : { data, isLoading: false, isError: false, error: null };
  };
  return {
    useGaps: () => quelle(lage.gaps),
    useKos: () => quelle([]),
    useAudit: () => quelle([]),
    useConflicts: () => quelle(lage.conflicts),
    useLifecyclePending: () => quelle([]),
    useValidationBoard: () => quelle([]),
    useDirectory: () => quelle([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { readHistoryIndex } from "../../apps/web/src/app/navHistory";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Der gestellte Scrollzustand ──────────────────────────────────────────────────────────────────
const SCROLLHOEHE = 2400;
let scrollPos = 0;
let angefahren: number[] = [];

function stelleScrollzustandEin(): void {
  scrollPos = 0;
  angefahren = [];
  lage.laedt = false;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollPos });
  // Ohne Daten gibt es keine Zeilen und damit nichts zu scrollen: die Höhe ist die des Fensters.
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => (lage.laedt ? window.innerHeight : SCROLLHOEHE),
  });
  window.scrollTo = ((...args: [number, number]): void => {
    const y = args[1];
    angefahren.push(y);
    scrollPos = y;
  }) as typeof window.scrollTo;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function konflikt(n: number): Conflict {
  return {
    id: `c-${n}`,
    koA: `ko-a-${n}`,
    koB: `ko-b-${n}`,
    type: "truth",
    description: `KONFLIKT-${n}`,
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-08-15T00:00:00.000Z",
  };
}

function luecke(n: number): Gap {
  return {
    id: `g-${n}`,
    question: `LUECKE-${n}`,
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-08-15T00:00:00.000Z",
  };
}

/** Echte Router-Navigation von außerhalb der Liste — für den ZWEITEN Besuch derselben Seite (R3). */
function Steuerpult(): JSX.Element {
  const navigate = useNavigate();
  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "zu-aufgaben",
        onClick: () => navigate("/aufgaben?art=conflict"),
      },
      "ZU-AUFGABEN",
    ),
    createElement(
      "button",
      { type: "button", "data-testid": "zu-konflikte", onClick: () => navigate("/konflikte") },
      "ZU-KONFLIKTE",
    ),
  );
}

async function mount(): Promise<void> {
  // Genug Zeilen, dass eine Listenposition überhaupt eine Aussage ist: 14 Konflikte, 6 Lücken.
  lage.conflicts = Array.from({ length: 14 }, (_, i) => konflikt(i + 1));
  lage.gaps = Array.from({ length: 6 }, (_, i) => luecke(i + 1));
  window.history.pushState({}, "", "/aufgaben");
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
          BrowserRouter,
          null,
          createElement(Steuerpult),
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/aufgaben", element: createElement(MyTasks) }),
            createElement(Route, {
              path: "/konflikte",
              element: createElement("p", null, "SEITE-KONFLIKTE"),
            }),
            createElement(Route, { path: "*", element: createElement("p", null, "SEITE-REST") }),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function segment(key: string): HTMLButtonElement {
  const label = i18n.t(`task.filter.${key}`);
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").trim().startsWith(label),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Segment „${label}" nicht gefunden. Sichtbar: ${text()}`);
  }
  return knopf;
}

const zeilen = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-testid="task-zeile"]'),
];

async function klickSegment(key: string): Promise<void> {
  const knopf = segment(key);
  await act(async () => {
    knopf.click();
    await flush();
  });
}

/** Eine Aufgabenzeile ÖFFNEN — echte Router-Navigation über den Link der Zeile. */
async function oeffneZeile(index: number): Promise<void> {
  const zeile = zeilen()[index];
  const link = zeile?.querySelector<HTMLAnchorElement>("a");
  if (!link) {
    throw new Error(`Zeile ${index} hat keinen Link. Sichtbar: ${text()}`);
  }
  await act(async () => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await flush();
  });
}

async function pressen(testid: string): Promise<void> {
  const knopf = container.querySelector<HTMLElement>(`[data-testid=${testid}]`);
  if (!knopf) {
    throw new Error(`Knopf „${testid}" nicht gefunden. Sichtbar: ${text()}`);
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
}

/** Echter Browser-Zurück-Knopf; das popstate-Ereignis kommt asynchron — genau wie im Browser. */
async function zurueck(): Promise<void> {
  await act(async () => {
    window.history.back();
    await flush();
  });
  await act(flush);
}

/**
 * Der ganze Ablauf des Versprechens, EINMAL: filtern, an eine Stelle arbeiten, Aufgabe öffnen,
 * Browser-Zurück. Liefert die Stelle, an der der Reviewer stand.
 */
async function ablauf(stelle = 320): Promise<{ stelle: number; indexVorher: number | null }> {
  await mount();
  await klickSegment("conflict");
  const indexVorher = readHistoryIndex();
  // Der Reviewer arbeitet sich nach unten.
  scrollPos = stelle;
  angefahren = [];
  await oeffneZeile(11);
  // Die Aufgabe ist offen — die Liste ist ausgehängt.
  expect(text()).toContain("SEITE-KONFLIKTE");
  expect(zeilen()).toHaveLength(0);
  await zurueck();
  return { stelle, indexVorher };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  stelleScrollzustandEin();
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
      await flush();
    });
  }
  container?.remove();
  root = undefined as unknown as ReturnType<typeof createRoot>;
});

// ── FÄHIGKEITSNACHWEIS ───────────────────────────────────────────────────────────────────────────
// Die Fälle unten behaupten etwas über echtes Browser-Verhalten, laufen aber in jsdom. Bricht eine
// dieser Zusagen (jsdom-Update), wird HIER rot und nicht mitten im Rückkehrnachweis.
describe("Grundlage: was jsdom für diesen Beleg leistet", () => {
  it("G1 · der gestellte Scrollzustand ist lesbar und `scrollTo` wird mitgeschrieben", () => {
    scrollPos = 640;
    expect(window.scrollY).toBe(640);
    expect(document.documentElement.scrollHeight).toBe(SCROLLHOEHE);
    window.scrollTo(0, 120);
    expect(angefahren).toEqual([120]);
    expect(window.scrollY).toBe(120);
  });

  it("G2 · `history.back()` löst ein asynchrones popstate aus und der Router-Index wandert mit", async () => {
    window.history.pushState({ idx: 0 }, "", "/g2-a");
    window.history.pushState({ idx: 1 }, "", "/g2-b");
    expect(readHistoryIndex()).toBe(1);
    await act(async () => {
      window.history.back();
      await flush();
    });
    expect(window.location.pathname).toBe("/g2-a");
    expect(readHistoryIndex()).toBe(0);
  });
});

describe("JOB 3101 · UX-04 · R · Rückkehr aus der geöffneten Aufgabe", () => {
  it("R1 · DAS VERSPRECHEN: nach Browser-Zurück stehen Filter UND Listenposition wieder", async () => {
    const { stelle } = await ablauf();

    // Die Liste ist wieder da …
    expect(text()).toContain("KONFLIKT-1");
    // … derselbe Filter …
    expect(new URLSearchParams(window.location.search).get("art")).toBe("conflict");
    expect(segment("conflict").getAttribute("aria-pressed")).toBe("true");
    expect(zeilen()).toHaveLength(14);
    expect(text(), "die Wissenslücken bleiben ausgefiltert").not.toContain("LUECKE-1");
    // … und dieselbe Stelle der Liste.
    expect(angefahren.at(-1), "die gemerkte Listenposition wird wieder angefahren").toBe(stelle);
    expect(window.scrollY).toBe(stelle);
  });

  it("R2 · die Filterhälfte allein — sie hängt an der Adresszeile, nicht an der Positionsmerkung", async () => {
    await ablauf();
    expect(new URLSearchParams(window.location.search).get("art")).toBe("conflict");
    expect(segment("conflict").getAttribute("aria-pressed")).toBe("true");
    expect(zeilen()).toHaveLength(14);
  });

  it("R3 · die Position hängt am VERLAUFSEINTRAG: ein zweiter Besuch erbt die Stelle des ersten NICHT", async () => {
    // Erster Besuch: an Stelle 820 gearbeitet, Aufgabe geöffnet, zurück — die Stelle steht wieder.
    const { indexVorher } = await ablauf(820);
    expect(angefahren.at(-1)).toBe(820);

    // Jetzt ein ZWEITER, echter Besuch derselben Seite: weg und über einen neuen Verlaufseintrag
    // wieder her. Der Browser steht dabei ganz oben — wie bei jedem frischen Eintrag.
    await pressen("zu-konflikte");
    angefahren = [];
    scrollPos = 0;
    await pressen("zu-aufgaben");

    expect(zeilen().length, "die Liste steht wieder").toBe(14);
    expect(
      readHistoryIndex(),
      "der zweite Besuch ist wirklich ein anderer Verlaufseintrag",
    ).not.toBe(indexVorher);
    expect(angefahren, "kein Sprung auf die Stelle eines fremden Verlaufseintrags").toEqual([]);
    expect(window.scrollY).toBe(0);
  });

  // ── KORREKTURPFLICHT 1 (BEN, Runde 2) ──────────────────────────────────────────────────────────
  // Der Verlaufsindex ist KEINE dauerhafte Eintragsidentität: nach einem Zurück und einem neuen PUSH
  // wird derselbe Platz erneut vergeben, der alte Eintrag ist abgeschnitten. R3 traf diesen Fall
  // nicht, weil der zweite Besuch dort auf einem HÖHEREN Platz landete. Hier ist es GENAU derselbe
  // Platz — gemessen, nicht behauptet.
  it("R5 · derselbe Verlaufsplatz, neuer Eintrag: der frische Besuch erbt die Stelle NICHT", async () => {
    await mount();
    await pressen("zu-konflikte");

    // Erster Besuch der Liste über einen PUSH — hier wird bei 820 gearbeitet.
    await pressen("zu-aufgaben");
    const platzErsterBesuch = readHistoryIndex();
    const kennungErsterBesuch = (window.history.state as { key?: string } | null)?.key;
    expect(zeilen().length, "die Liste steht").toBe(14);
    scrollPos = 820;

    // Browser-Zurück: die Liste wird ausgehängt, ihre Stelle gemerkt.
    await zurueck();
    expect(text()).toContain("SEITE-KONFLIKTE");

    // Und jetzt ein NEUER PUSH auf die Liste. Er bekommt denselben Verlaufsplatz — der alte Eintrag
    // von oben liegt vorwärts und wird dabei abgeschnitten.
    angefahren = [];
    scrollPos = 0;
    await pressen("zu-aufgaben");

    expect(zeilen().length, "die Liste steht wieder").toBe(14);
    expect(
      readHistoryIndex(),
      "KALIBRIERUNG: der Verlaufsplatz ist WIRKLICH derselbe — sonst prüfte dieser Fall nichts",
    ).toBe(platzErsterBesuch);
    expect(
      (window.history.state as { key?: string } | null)?.key,
      "KALIBRIERUNG: die Eintragskennung ist eine andere",
    ).not.toBe(kennungErsterBesuch);
    expect(angefahren, "kein Sprung auf die Stelle eines abgeschnittenen Eintrags").toEqual([]);
    expect(window.scrollY).toBe(0);
  });

  it("R6 · GEGENSTÜCK zu R5: derselbe Eintrag über Browser-Zurück behält seine Stelle", async () => {
    // Ohne diesen Fall könnte R5 auch dadurch grün sein, dass gar nichts mehr wiederhergestellt
    // wird. Hier ist der Eintrag DERSELBE (POP statt PUSH) — und die Stelle steht wieder.
    await mount();
    await pressen("zu-konflikte");
    await pressen("zu-aufgaben");
    scrollPos = 820;
    await zurueck();
    expect(text()).toContain("SEITE-KONFLIKTE");

    angefahren = [];
    scrollPos = 0;
    await act(async () => {
      window.history.forward();
      await flush();
    });
    await act(flush);

    expect(zeilen().length, "die Liste steht wieder").toBe(14);
    expect(angefahren.at(-1), "derselbe Eintrag, dieselbe Stelle").toBe(820);
  });

  it("R4 · eine Stelle, zu der die Liste nicht mehr reicht, wird auf das Machbare begrenzt", async () => {
    // Weiter unten gemerkt, als überhaupt scrollbar ist (`SCROLLHOEHE - innerHeight`).
    const machbar = SCROLLHOEHE - window.innerHeight;
    await ablauf(machbar + 5000);
    expect(angefahren.at(-1), "kein Sprung ins Leere").toBe(machbar);
  });
});

// ── N-0015 · BEN, Lauf 3 R1 (B1): DIE DATEN KOMMEN ERST NACH DEM WIEDEREINTRITT ──────────────────
// R1–R6 liefern die Daten sofort. Im Browser kommt die Liste nach dem Rückweg aber oft erst mit der
// Antwort: der Eintritt sieht eine leere, nicht scrollbare Seite. Bens Gegenbeleg: Soll 820, Ist 0.
describe("N-0015 · Rückweg mit verzögerten Listendaten", () => {
  async function liefere(): Promise<void> {
    await act(async () => {
      lage.laedt = false;
      lage.stand += 1;
      for (const h of lage.hoerer) {
        h();
      }
      await flush();
    });
  }

  async function oeffneUndKehreOhneDatenZurueck(stelle: number): Promise<void> {
    await mount();
    await klickSegment("conflict");
    scrollPos = stelle;
    await oeffneZeile(11);
    expect(text()).toContain("SEITE-KONFLIKTE");
    // Der Rückweg trifft auf Quellen ohne Antwort.
    lage.laedt = true;
    angefahren = [];
    scrollPos = 0;
    await zurueck();
    expect(zeilen(), "KALIBRIERUNG: beim Wiedereintritt stehen noch keine Zeilen").toHaveLength(0);
  }

  it("V1 · Filter UND Stelle stehen wieder, sobald die Daten eintreffen", async () => {
    await oeffneUndKehreOhneDatenZurueck(820);
    expect(
      angefahren.filter((y) => y !== 820),
      "kein vorzeitiger Sprung gegen die leere Seite",
    ).toEqual([]);

    await liefere();

    expect(zeilen()).toHaveLength(14);
    expect(new URLSearchParams(window.location.search).get("art")).toBe("conflict");
    expect(segment("conflict").getAttribute("aria-pressed")).toBe("true");
    expect(angefahren, "genau ein Sprung, erst mit den Daten").toEqual([820]);
    expect(window.scrollY).toBe(820);
  });

  it("V2 · weitere Antworten danach springen NICHT erneut", async () => {
    await oeffneUndKehreOhneDatenZurueck(820);
    await liefere();
    // Der Reviewer arbeitet weiter; ein späterer Neuabruf darf ihn nicht zurückwerfen.
    scrollPos = 1200;
    await liefere();
    expect(angefahren).toEqual([820]);
    expect(window.scrollY).toBe(1200);
  });

  it("V3 · wer vor dem Eintreffen wieder geht, behält die gemerkte Stelle", async () => {
    await oeffneUndKehreOhneDatenZurueck(820);
    // Noch ohne Daten erneut zur Aufgabe (Vorwärts) und wieder zurück.
    await act(async () => {
      window.history.forward();
      await flush();
    });
    await act(flush);
    expect(text()).toContain("SEITE-KONFLIKTE");
    angefahren = [];
    scrollPos = 0;
    await zurueck();
    await liefere();
    expect(angefahren, "die 0 des Ladezustands hat die Stelle nicht überschrieben").toEqual([820]);
  });
});
