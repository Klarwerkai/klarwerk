// @vitest-environment jsdom
// ================================================================================================
// JOB 1022 · D-047 — DIE ANTWORT STEHT VORN. GEMESSEN AM GERENDERTEN DOM, NICHT AM QUELLTEXT.
// ================================================================================================
//
// WARUM DIESE DATEI ÜBERHAUPT EXISTIERT. D1 belegte die Reihenfolge mit Textknoten-Positionen,
// mass aber nicht gegen den KI-Hinweis — genau das erste Abnahmekriterium blieb ungeprüft. D2
// belegte nur noch die QUELLTEXT-Reihenfolge und erklärte den Antwortzustand für nicht montierbar.
// Beides ist hier hinfällig: `tests/ask/ask-check-caveat-mounted.test.tsx` montiert diese Fläche
// seit mega32 erfolgreich, und dieselbe Vorrichtung trägt auch diesen Wächter. Gemessen wird, was
// die Leserin bekommt — die Reihenfolge der Inhaltselemente in der Antwortkarte.
//
// WAS DIESER WÄCHTER NICHT KANN, damit es niemand für mehr hält: jsdom rechnet kein Layout. Die
// D-047-Zusage „ohne Scrollen sichtbar" ist eine Bildschirmgrösse und hier grundsätzlich nicht
// beweisbar. Belegt wird die DOM-/Lesereihenfolge — dieselbe Reihenfolge, der auch Vorleseprogramme
// folgen. Die Umweltgrenze steht in der Rückgabe, nicht als grüner Fall in dieser Datei.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  // Der Antwortzustand ist umschaltbar: derselbe Wächter fährt den beantworteten UND den
  // Lückenfall. Ohne den zweiten wäre „jeder Pflichttext genau einmal" nur die halbe Zusage —
  // eine Streichung im Lückenfall bliebe unbemerkt (D1 hat genau diese Falle beschrieben).
  beantwortet: true,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () =>
        bestand.beantwortet
          ? {
              result: {
                answered: true,
                answer: "Ventil V4 wird jährlich geprüft.",
                knowledgeClass: "gesichert",
                trust: 90,
                sources: ["k1"],
                citedSources: ["k1"],
                steps: [],
                demo: false,
                captionSources: [],
              },
              gap: null,
              receipt: "r",
            }
          : {
              result: {
                answered: false,
                answer: null,
                knowledgeClass: "unbekannt",
                trust: 0,
                sources: [],
                citedSources: [],
                steps: [],
                demo: false,
                captionSources: [],
              },
              gap: { id: "g1" },
              receipt: "r",
            },
      ),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import {
  ANSWER_CONTRACT_TRUST_NOTE_KEY,
  answerContract,
} from "../../apps/web/src/lib/askAnswerContract";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// Vollständig belegter Prüf-Lauf → die Antwort darf „gesichert" heissen; der Vertrag ist
// `verified` und trägt damit ALLE sechs Pflichttexte inklusive Trust-Notiz. Ein Fixture mit
// Vorbehalt hätte die Trust-Notiz gar nicht erst gerendert und die Matrix stumm gemacht.
const BELEGT = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko() {
  return {
    id: "k1",
    title: "Ventilprüfung",
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: BELEGT },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Der beantwortete Zustand, montiert und mit vorhandener Antwortkarte belegt. */
async function beantwortet(): Promise<{
  container: HTMLElement;
  karte: HTMLElement;
  unmount: () => void;
}> {
  await i18n.changeLanguage("de");
  bestand.beantwortet = true;
  bestand.kos = [ko()];
  const { container, unmount } = await mountAsk();
  const karte = container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
  // Ohne diesen Anker prüfte alles Folgende ins Leere: eine nicht montierte Seite hätte
  // schlicht keine Karte, und jede Reihenfolgeaussage wäre stillschweigend erfüllt.
  expect(
    karte,
    "die Antwortkarte wurde nicht montiert — der Wächter misst sonst nichts",
  ).not.toBeNull();
  return { container, karte: karte as HTMLElement, unmount };
}

// ================================================================================================
// JOB 3064 · H5 NACHGEFÜHRT — DIE EINORDNUNG HAT EINEN ORT STATT EINER DAUERSTELLUNG.
// ================================================================================================
// D-047 hat den alten Antwortbasis-KASTEN abgelöst, der als zweite, konkurrierende Einordnung VOR
// der Antwortkarte sass. Diese Zusage ist das Herz der Datei und bleibt wörtlich in Kraft.
//
// H5 nimmt die Einordnung zusätzlich aus dem Sichtfeld (Auftrag §5): sie liegt hinter dem „…" DER
// ANTWORTKARTE, im Info-Blatt „Mehr". Das Blatt wird nach `document.body` portaliert (Geometrie,
// s. `Seitenblatt.tsx`) und ist damit kein DOM-Nachfahre der Karte mehr — bedient wird es aber
// ausschliesslich von ihr aus. Die Bindung „genau EINE Einordnung, und sie gehört zu DIESER
// Antwort" ist also unverändert; sie wird nur an einem zweiten Anker gemessen.
//
// Was das für die Fälle unten heisst:
//   · „genau einmal auf der Seite" wird über `document.body` gezählt (Fläche UND Blatt).
//   · „in der Antwortkarte" heisst jetzt „in der Karte ODER in dem Blatt, das ihr „…" öffnet".
//   · „nichts ausserhalb" heisst jetzt „weder neben der Karte noch neben dem Blatt".
// Eine zweite Vertragsfläche fiele in jeder dieser drei Messungen weiterhin auf.

/** Öffnet „…" → „Mehr" an der Antwortkarte und gibt das Blatt zurück. */
async function mehrBlatt(container: HTMLElement): Promise<HTMLElement> {
  const griff = container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
  expect(griff, "die Antwortkarte trägt kein „…“ — die Einordnung hätte keinen Ort").not.toBeNull();
  await act(async () => {
    (griff as HTMLButtonElement).click();
    await flush();
  });
  const punkt = container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]');
  expect(punkt, "das „…“-Menü der Karte trägt keinen Punkt „Mehr“").not.toBeNull();
  await act(async () => {
    (punkt as HTMLButtonElement).click();
    await flush();
  });
  const blatt = document.querySelector<HTMLElement>('[data-testid="ask-mehr"]');
  expect(blatt, "„Mehr“ öffnet kein Blatt — der Menüpunkt wäre eine Scheinfunktion").not.toBeNull();
  return blatt as HTMLElement;
}

/**
 * Das INHALTSELEMENT der Karte, in dem `el` steckt — also der direkte Kindknoten der Karte.
 * Genau diese Ebene meint D-047 mit „erstes Inhaltselement"; ein tiefer verschachtelter Treffer
 * sagt nichts über die Reihenfolge auf der Karte.
 */
function inhaltsIndex(karte: HTMLElement, el: Element | null): number {
  if (!el) {
    return -1;
  }
  let knoten: Element | null = el;
  while (knoten && knoten.parentElement !== karte) {
    knoten = knoten.parentElement;
  }
  return knoten ? [...karte.children].indexOf(knoten) : -1;
}

/** Wie oft steht dieser Text da? Die Frage der Textmatrix ist „genau einmal", nicht „überhaupt". */
function anzahl(heuhaufen: string, nadel: string): number {
  if (nadel.length === 0) {
    throw new Error("leerer Suchtext — die Zählung wäre bedeutungslos");
  }
  return heuhaufen.split(nadel).length - 1;
}

// Die Pflichttexte werden beim echten Modul erfragt, nicht abgeschrieben. Wer den Vertrag
// umbenennt, ändert damit auch diesen Wächter — und wer einen Text streicht, wird rot.
function pflichttexte(art: "verified" | "gap"): Array<{ name: string; text: string }> {
  const vertrag = answerContract(art);
  const texte = [
    { name: "Etikett", text: i18n.t("ask.contract.label") },
    { name: "Kernsatz", text: i18n.t(vertrag.titleKey) },
    { name: "Erläuterung", text: i18n.t(vertrag.bodyKey) },
    { name: "nächster Schritt", text: i18n.t(vertrag.nextStepKey) },
  ];
  if (vertrag.sourceBound) {
    texte.push({ name: "Trust-Notiz", text: i18n.t(ANSWER_CONTRACT_TRUST_NOTE_KEY) });
    texte.push({ name: "Quellenbilanz", text: i18n.t("ask.contract.sumTotal", { count: 1 }) });
  }
  return texte;
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("D-047 (1) · die Antwort ist das erste Inhaltselement der Antwortkarte", () => {
  it("das erste Inhaltselement der Karte IST der Antworttext", async () => {
    const { karte, unmount } = await beantwortet();

    const erstes = karte.children[0];
    expect(erstes, "die Antwortkarte ist leer").toBeTruthy();
    expect(
      erstes?.className ?? "",
      `erstes Inhaltselement ist nicht die Antwort, sondern: ${(erstes?.textContent ?? "").slice(0, 80)}`,
    ).toContain("ask-answer-body");
    expect(erstes?.textContent ?? "").toContain("Ventil V4 wird jährlich geprüft.");
    unmount();
  });

  it("die Antwort steht vor JEDEM anderen Inhaltselement der Karte", async () => {
    const { karte, unmount } = await beantwortet();

    const antwort = inhaltsIndex(karte, karte.querySelector(".ask-answer-body"));
    expect(antwort, "der Antworttext liegt gar nicht auf der Karte").toBe(0);
    // Kalibrierung: die Karte trägt wirklich mehr als nur die Antwort — sonst wäre „vor allem
    // anderen" eine Aussage über eine leere Menge.
    expect(karte.children.length).toBeGreaterThan(3);
    unmount();
  });
});

describe("D-047 (2) · der KI-Hinweis folgt unmittelbar dahinter und bleibt druckbar", () => {
  it("der Hinweis ist das ZWEITE Inhaltselement — nichts steht dazwischen", async () => {
    const { karte, unmount } = await beantwortet();

    const notiz = karte.querySelector('[data-testid="ai-generated-notice"]');
    expect(notiz, "die Antwortkarte trägt den KI-Hinweis gar nicht").not.toBeNull();
    expect(inhaltsIndex(karte, notiz), "zwischen Antwort und KI-Hinweis steht etwas anderes").toBe(
      1,
    );
    unmount();
  });

  it("er steht innerhalb der Druckfläche — mega62 Block E bleibt eingelöst", async () => {
    const { karte, unmount } = await beantwortet();

    const notiz = karte.querySelector('[data-testid="ai-generated-notice"]');
    expect(notiz?.closest(".print-area"), "der KI-Satz fiele aus dem Druck").not.toBeNull();
    expect(karte.classList.contains("print-area")).toBe(true);
    unmount();
  });
});

describe("D-047 (3) · der alte Antwortbasis-Kasten ist im beantworteten Zustand abgelöst", () => {
  it("KEIN Vertragstext steht mehr ausserhalb der Antwortkarte und ihres Blattes", async () => {
    const { container, karte, unmount } = await beantwortet();
    const blatt = await mehrBlatt(container);

    // Der Kasten sass VOR der Antwortkarte und war damit die zweite, konkurrierende
    // Einordnungsstruktur. Gemessen wird nicht seine Bauform, sondern sein Inhalt: steht ein
    // Vertragstext irgendwo ausserhalb von Karte UND Blatt, gibt es die Parallelstruktur noch.
    const draussen = (document.body.textContent ?? "")
      .replace(karte.textContent ?? "", "")
      .replace(blatt.textContent ?? "", "");
    const verstoesse = pflichttexte("verified")
      .filter((p) => draussen.includes(p.text))
      .map((p) => p.name);
    expect(verstoesse, "Vertragstexte stehen noch ausserhalb der Antwortkarte").toEqual([]);
    unmount();
  });

  it("genau EINE aktive Einordnungskette — keine zweite Vertragsfläche", async () => {
    const { container, unmount } = await beantwortet();
    const blatt = await mehrBlatt(container);

    // Das Etikett ist der Kopf jeder Vertragsfläche. Zwei Etiketten heissen zwei Flächen.
    expect(anzahl(document.body.textContent ?? "", i18n.t("ask.contract.label"))).toBe(1);
    expect(anzahl(blatt.textContent ?? "", i18n.t("ask.contract.label"))).toBe(1);
    unmount();
  });

  it("VOR dem Griff steht das Etikett nirgends — die Einordnung drängt sich nicht auf", async () => {
    // Die H5-Zusage, und zugleich die Gegenprobe zu den zwei Fällen oben: „genau einmal" ist erst
    // dann eine Aussage über EINEN Ort, wenn es ohne den Griff KEINEN gibt. Bliebe die alte
    // Dauerstellung zusätzlich stehen, stünde das Etikett hier schon und oben zweimal.
    const { container, unmount } = await beantwortet();

    expect(
      anzahl(document.body.textContent ?? "", i18n.t("ask.contract.label")),
      "das Vertrags-Etikett steht ungefragt auf der Fragenfläche",
    ).toBe(0);
    await mehrBlatt(container);
    expect(anzahl(document.body.textContent ?? "", i18n.t("ask.contract.label"))).toBe(1);
    unmount();
  });
});

describe("D-047 (4) · Textmatrix — jeder Pflichttext erscheint GENAU EINMAL", () => {
  it("beantworteter Zustand: alle sechs Pflichttexte, keiner fehlt, keiner doppelt", async () => {
    const { container, unmount } = await beantwortet();
    const blatt = await mehrBlatt(container);

    // `aufDerSeite` zählt über Fläche UND Blatt; `imBlattDerKarte` ist der Nachfolger von
    // „in der Antwortkarte": derselbe Anspruch, dass jeder Pflichttext AN DIESER Antwort hängt und
    // nicht irgendwo sonst auf der Seite steht.
    const gesamt = document.body.textContent ?? "";
    const imBlatt = blatt.textContent ?? "";
    const befund = pflichttexte("verified").map((p) => ({
      text: p.name,
      aufDerSeite: anzahl(gesamt, p.text),
      imBlattDerKarte: anzahl(imBlatt, p.text),
    }));
    expect(befund).toEqual(
      pflichttexte("verified").map((p) => ({
        text: p.name,
        aufDerSeite: 1,
        imBlattDerKarte: 1,
      })),
    );
    unmount();
  });

  it("KALIBRIERUNG: die Zählung schlägt bei einem erfundenen Text NICHT an", async () => {
    // Ohne diesen Fall wäre die Matrix auch von einer Seite erfüllt, auf der die Zählung
    // grundsätzlich nicht funktioniert.
    const { container, unmount } = await beantwortet();
    await mehrBlatt(container);
    expect(anzahl(document.body.textContent ?? "", "Diesen Satz gibt es hier nicht")).toBe(0);
    unmount();
  });
});

describe("D-047 (5) · der unbeantwortete Zustand bleibt ehrlich und vollständig", () => {
  it("Lückenfall: die Einordnung steht vollständig da — genau einmal je Text", async () => {
    await i18n.changeLanguage("de");
    bestand.beantwortet = false;
    bestand.kos = [ko()];
    const { container, unmount } = await mountAsk();

    // Erst der Nachweis, dass wirklich der Lückenfall läuft — sonst prüfte alles Folgende den
    // beantworteten Zustand ein zweites Mal.
    expect(container.querySelector('[data-testid="ask-gap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ask-answer"]')).toBeNull();

    // JOB 3064 H5 / KORREKTURPFLICHT 1 (Ben, Runde 5) NACHGEFÜHRT, nicht gelockert: im Lückenfall
    // stand die Einordnung bis Runde 5 als ZWEITE Karte neben der Lückenkarte — Ben hat zwei
    // Ergebniskarten gemessen, Auftrag §6 lässt EINE übrig. Die Texte sind nicht gestrichen,
    // sondern liegen hinter „…" → „Mehr"; die Zusage von D-047(5) — jeder Pflichttext GENAU
    // EINMAL, keiner fehlt, keiner doppelt — wird deshalb hier gemessen, nachdem der Griff
    // betätigt wurde. Bliebe die alte Karte zusätzlich stehen, stünde jeder Text zweimal.
    await mehrBlatt(container);
    const text = document.body.textContent ?? "";
    const befund = pflichttexte("gap").map((p) => ({ text: p.name, anzahl: anzahl(text, p.text) }));
    expect(befund).toEqual(pflichttexte("gap").map((p) => ({ text: p.name, anzahl: 1 })));
    unmount();
  });

  it("Lückenfall: der Rettungsweg bleibt erreichbar", async () => {
    await i18n.changeLanguage("de");
    bestand.beantwortet = false;
    bestand.kos = [ko()];
    const { container, unmount } = await mountAsk();

    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("ask.noBasisTitle"));
    expect(text).toContain(i18n.t("ask.gapBadge"));
    unmount();
  });
});
