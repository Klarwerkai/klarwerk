// @vitest-environment jsdom
// ================================================================================================
// JOB 3061 · H2 · RUNDE 5 — „OBJEKT ENTFERNT" IST EINE TATSACHE, KEIN LADEZUSTAND.
// ================================================================================================
//
// DER BEFUND (BEN, Runde 4, Korrekturpflicht 2): „Konflikte, Duplikate und Lebenszyklus bestimmen
// den Flächenzustand nur aus dem Befundabruf. Solange `useKos` noch lädt, wird dessen leere
// Ersatzliste bereits als Entfernung interpretiert." Seine Gegenprobe: Konfliktbefund geladen,
// `useKos` weiter pending → die Oberfläche zeigte ZWEIMAL „Objekt entfernt" und darunter die
// aktiven Entscheidungswege.
//
// WARUM DAS SCHWER WIEGT und nicht nur unschön ist: Diese drei Flächen zeigen einen Befund, der
// nur aus IDs besteht — der Konflikt sagt „ko-a widerspricht ko-b", die Überschneidung sagt
// „ko-a deckt sich mit ko-b", die Fälligkeit sagt „ko-a ist dran". Titel, Aussage, Bereich und
// Datum stehen in einem ZWEITEN Abruf. Fehlt dessen Antwort, ist die Karte leer; sie sagte aber
// nicht „ich weiss es noch nicht", sondern „das Objekt gibt es nicht mehr" — und bot dazu
// „Links gilt" und „Kein Widerspruch" an. Ein Mensch hätte über zwei Aussagen entschieden, die er
// nie gesehen hat. Das ist Regelwerk §7, zweiter Spiegelstrich: eine Tatsachenaussage ohne ihre
// Voraussetzung.
//
// DIE GEGENRICHTUNG steht ausdrücklich mit hier drin (Fälle A3/D3/L3): nach einem ERFOLGREICHEN
// Objektabruf, in dem das Objekt wirklich fehlt, MUSS „Objekt entfernt" wieder dastehen. Sonst
// wäre die Regel ein Freibrief, der einen echten Befund verschweigt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({
  konflikte: [] as unknown[],
  duplikate: [] as unknown[],
  faellig: [] as unknown[],
  /** Was `ko.list` tut: antworten, hängen oder scheitern. */
  kos: "antwortet" as "antwortet" | "haengt" | "scheitert",
  koListe: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer =
    (wert: unknown = {}) =>
    () =>
      Promise.resolve(wert);
  return {
    endpoints: {
      conflicts: {
        list: () => Promise.resolve(daten.konflikte),
        escalate: leer(),
        secondOpinion: leer(),
        dismiss: leer(),
      },
      duplicates: {
        list: () => Promise.resolve(daten.duplikate),
        dismiss: leer(),
        keepSeparate: leer(),
        linkRelated: leer(),
      },
      ko: {
        // Der eine Abruf, um den es hier geht.
        list: () => {
          if (daten.kos === "haengt") {
            return new Promise(() => {});
          }
          if (daten.kos === "scheitert") {
            return Promise.reject(new Error("Netz weg"));
          }
          return Promise.resolve(daten.koListe);
        },
        act: leer(),
        aiCheckRetry: leer(),
      },
      validation: { board: leer([]), overview: leer([]) },
      lifecycle: {
        pending: () => Promise.resolve(daten.faellig),
        assetChanged: leer([]),
      },
      learningPaths: { get: leer(null), progress: leer([]), complete: leer({}) },
      directory: { list: leer([]) },
      aiCheck: {
        coverageSummary: leer({ total: 0, incomplete: 0, unchecked: 0, noCoverage: 0 }),
      },
      reasoner: {
        status: leer({ active: false, mode: "off", reachable: "unknown", tasks: {} }),
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
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";
import { Lifecycle } from "../../apps/web/src/pages/Lifecycle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

const KO = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `${titel} — Aussage.`,
  status: "validiert",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  category: "Konstruktion",
  asset: null,
  createdAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [KO("ko-a", "Design Guide"), KO("ko-b", "Nasszonen")];
/** Der ECHTE Befund „eine Seite ist weg": vollständige Antwort, in der ko-b nicht vorkommt. */
const KOS_OHNE_B = [KO("ko-a", "Design Guide")];

const KONFLIKT = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  type: "truth",
  description: "Widerspruch",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  detector: { trigger: "background", method: "model", confidence: 0.9, rationale: "Grund" },
  createdAt: "2026-08-01T06:00:00.000Z",
};

const DUPLIKAT = {
  id: "d-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "identisch",
  aspects: [],
  eigenanteilA: "A",
  eigenanteilB: "B",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "ko-a|ko-b",
  origin: "auto",
  detector: { trigger: "background", method: "model", lexicalScore: 0.9, confidence: 0.9 },
  createdAt: "2026-08-01T06:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(seite: () => JSX.Element, pfad: string): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(seite)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const da = (sel: string): boolean => container.querySelector(sel) !== null;

const ENTFERNT = () => de("board.koRemoved");
const PLATZHALTER = '[data-testid="pruefen-platzhalter"]';
const ERSTFEHLER = '[data-testid="pruefen-erstfehler"]';
const KARTE_A = '[data-testid="pruefen-paar-karte-a"]';

beforeEach(async () => {
  await i18n.changeLanguage("de");
  daten.konflikte = [KONFLIKT];
  daten.duplikate = [DUPLIKAT];
  daten.faellig = ["ko-a"];
  daten.kos = "antwortet";
  daten.koListe = KOS;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ================================================================================================
// A · KONFLIKTE
// ================================================================================================
describe("JOB 3061 · H2 · Konflikte: der Objektabruf gehört zur Lage der Fläche", () => {
  it("A0 · Kalibrierung: sind BEIDE Abrufe da, steht das Kartenpaar mit beiden Titeln", async () => {
    await mount(Conflicts, "/konflikte");
    expect(da(KARTE_A)).toBe(true);
    expect(text()).toContain("Design Guide");
    expect(text()).toContain("Nasszonen");
    expect(text()).toContain(de("con.side.left"));
  });

  it("A1 · Befund da, Objektabruf hängt: Platzhalter statt „Objekt entfernt“ — und keine Entscheidung", async () => {
    daten.kos = "haengt";
    await mount(Conflicts, "/konflikte");

    expect(text(), "„Objekt entfernt“ ohne abgeschlossenen Objektabruf").not.toContain(ENTFERNT());
    expect(da(KARTE_A), "Kartenpaar ohne die Objekte, über die es spricht").toBe(false);
    expect(text(), "Entscheidungsknopf über ungesehene Aussagen").not.toContain(
      de("con.side.left"),
    );
    expect(da(PLATZHALTER), "kein Ladezeichen, obwohl geladen wird").toBe(true);
  });

  it("A2 · Objektabruf gescheitert: ein Satz und „Erneut laden“ — keine Behauptung über den Bestand", async () => {
    daten.kos = "scheitert";
    await mount(Conflicts, "/konflikte");

    expect(text()).not.toContain(ENTFERNT());
    expect(da(ERSTFEHLER)).toBe(true);
    expect(text()).toContain(de("pruefen.reload"));
    expect(text()).not.toContain(de("con.side.left"));
  });

  it("A3 · Gegenrichtung: der Objektabruf war erfolgreich und ko-b fehlt WIRKLICH → „Objekt entfernt“ steht da", async () => {
    daten.koListe = KOS_OHNE_B;
    await mount(Conflicts, "/konflikte");

    expect(da(KARTE_A)).toBe(true);
    expect(text(), "der echte Befund wird verschwiegen").toContain(ENTFERNT());
  });
});

// ================================================================================================
// D · DUPLIKATE
// ================================================================================================
describe("JOB 3061 · H2 · Duplikate: derselbe Vertrag", () => {
  it("D0 · Kalibrierung: beide Abrufe da → Kartenpaar und die vier Knöpfe", async () => {
    await mount(Duplicates, "/duplikate");
    expect(da(KARTE_A)).toBe(true);
    expect(text()).toContain(de("dup.side.left"));
  });

  it("D1 · Objektabruf hängt: keine „Objekt entfernt“-Karte, kein „Links behalten“", async () => {
    daten.kos = "haengt";
    await mount(Duplicates, "/duplikate");

    expect(text()).not.toContain(ENTFERNT());
    expect(da(KARTE_A)).toBe(false);
    expect(text()).not.toContain(de("dup.side.left"));
    expect(da(PLATZHALTER)).toBe(true);
  });

  it("D2 · Objektabruf gescheitert: ein Satz und „Erneut laden“", async () => {
    daten.kos = "scheitert";
    await mount(Duplicates, "/duplikate");

    expect(text()).not.toContain(ENTFERNT());
    expect(da(ERSTFEHLER)).toBe(true);
    expect(text()).not.toContain(de("dup.side.left"));
  });

  it("D3 · Gegenrichtung: erfolgreicher Abruf ohne ko-b → „Objekt entfernt“ steht da", async () => {
    daten.koListe = KOS_OHNE_B;
    await mount(Duplicates, "/duplikate");

    expect(da(KARTE_A)).toBe(true);
    expect(text()).toContain(ENTFERNT());
  });
});

// ================================================================================================
// L · ERNEUT (LEBENSZYKLUS)
// ================================================================================================
describe("JOB 3061 · H2 · Erneut: die Liste ist erst eine Liste, wenn die Objekte da sind", () => {
  it("L0 · Kalibrierung: beide Abrufe da → der Titel steht in der Warteschlange", async () => {
    await mount(Lifecycle, "/lebenszyklus");
    expect(text()).toContain("Design Guide");
    expect(text()).toContain(de("lcy.stillValid"));
  });

  it("L1 · Objektabruf hängt: keine rohe Kennung, kein „Noch gültig“ auf einem ungesehenen Objekt", async () => {
    daten.kos = "haengt";
    await mount(Lifecycle, "/lebenszyklus");

    expect(text(), "die rohe Kennung stand als Titel da").not.toContain("ko-a");
    expect(text()).not.toContain(de("lcy.revalMissing"));
    expect(text()).not.toContain(de("lcy.stillValid"));
    expect(da(PLATZHALTER)).toBe(true);
    // Die Anlagenänderung hängt NICHT am Objektabruf — sie bleibt erreichbar.
    expect(text()).toContain(de("lcy.assetToggle"));
  });

  it("L2 · Objektabruf gescheitert: ein Satz und „Erneut laden“", async () => {
    daten.kos = "scheitert";
    await mount(Lifecycle, "/lebenszyklus");

    expect(da(ERSTFEHLER)).toBe(true);
    expect(text()).not.toContain(de("lcy.stillValid"));
  });

  it("L3 · Gegenrichtung: erfolgreicher Abruf, das fällige Objekt fehlt wirklich → der Vermerk steht im „Mehr“", async () => {
    daten.faellig = ["ko-weg"];
    await mount(Lifecycle, "/lebenszyklus");

    expect(text(), "der echte Befund wird verschwiegen").toContain(de("lcy.revalMissing"));
  });
});
