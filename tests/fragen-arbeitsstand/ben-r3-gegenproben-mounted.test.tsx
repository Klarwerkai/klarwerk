// @vitest-environment jsdom
// ================================================================================================
// NACHARBEIT NACH BENS URTEIL (Runde 3) — DIE GRENZE DER STARTADRESSEN UND TABELLEN OHNE RAND.
// ================================================================================================
//
// Derselbe Aufbau wie `ben-r2-gegenproben-mounted.test.tsx` (echte `Ask`-Seite, echter
// Browserspeicher, echte Sitzungsabfrage).
//
//   F2  Nach MEHR ALS 50 anderen Startadressen holt die erste ihren verworfenen Entwurf nicht zurück.
//   F3  Dasselbe mit `?ask=1`: die erste Adresse fragt das Modell nicht noch einmal.
//   F4  Eine Tabelle ohne äußere Striche behält ihre Spaltenköpfe und verliert ihre `|`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  rolle: "experte" as string,
  kiAktiv: true,
  // Steht `true`, hält der Modellendpunkt seine Antwort zurück, bis `freigeben()` gerufen wird.
  zurueckhalten: false,
  freigeben: (() => {}) as () => void,
  antwort: null as unknown,
  // Konfliktabruf: gelingt, scheitert, oder wird bis `konflikteFreigeben()` offen gehalten.
  konflikte: "ok" as "ok" | "fehler" | "halten",
  konflikteFreigeben: (() => {}) as () => void,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: lage.rolle }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        {
          id: "ko-1",
          title: "Wartungsplan Ventil V4",
          statement: "Wartungsplan Ventil V4",
          conditions: [],
          measures: [],
          type: "regel",
          category: "Instandhaltung",
          tags: [],
          confidence: 80,
          trust: 90,
          status: "validiert",
          version: 1,
          originalAuthor: "u9",
          author: "u9",
          neededValidations: 2,
          assignments: [],
          asset: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          history: [],
        },
      ]),
    },
    conflicts: {
      list: vi.fn(async () => {
        if (lage.konflikte === "fehler") {
          throw new Error("conflicts unreachable");
        }
        if (lage.konflikte === "halten") {
          await new Promise<void>((r) => {
            lage.konflikteFreigeben = r;
          });
        }
        return [];
      }),
    },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () =>
        lage.kiAktiv
          ? { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } }
          : { active: false, mode: "deterministic", tasks: { answer: false } },
      ),
    },
    ask: {
      ask: vi.fn(async () => {
        if (lage.zurueckhalten) {
          await new Promise<void>((r) => {
            lage.freigeben = r;
          });
        }
        return lage.antwort;
      }),
      helpful: vi.fn(async () => ({})),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

function antwortMit(text: string): unknown {
  return {
    result: {
      answered: true,
      answer: text,
      knowledgeClass: "gesichert",
      trust: 90,
      sources: ["ko-1"],
      citedSources: ["ko-1"],
      steps: [],
      demo: false,
    },
    gap: null,
    receipt: "beleg-1",
  };
}
const STANDARDANTWORT = antwortMit("Ventil V4 wird jährlich geprüft [1].");

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function neuerCache(konto: string): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: konto, role: lage.rolle });
  return client;
}

type Eintrag = string | { pathname: string; search: string; key: string };

interface Flaeche {
  c: HTMLElement;
  abbauen: () => void;
}

async function oeffnen(client: QueryClient, eintrag: Eintrag = "/fragen"): Promise<Flaeche> {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const root = createRoot(c);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [eintrag] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    c,
    abbauen: () => {
      act(() => root.unmount());
      c.remove();
    },
  };
}

function feld(f: Flaeche): HTMLInputElement {
  const el = f.c.querySelector<HTMLInputElement>("input");
  expect(el, "Eingabefeld nicht gefunden").toBeTruthy();
  return el as HTMLInputElement;
}

async function tippen(f: Flaeche, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld(f), text);
    feld(f).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function absenden(f: Flaeche): Promise<void> {
  await act(async () => {
    f.c
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

const q = (f: Flaeche, id: string): HTMLElement | null =>
  f.c.querySelector<HTMLElement>(`[data-testid="${id}"]`);

function gespeichert(konto: string): string {
  return localStorage.getItem(`kw.fragen.arbeitsstand.v1:${konto}`) ?? "";
}

beforeEach(async () => {
  localStorage.clear();
  lage.rolle = "experte";
  lage.kiAktiv = true;
  lage.zurueckhalten = false;
  lage.antwort = STANDARDANTWORT;
  lage.konflikte = "ok";
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

const eintrag = (search: string, key: string): Eintrag => ({ pathname: "/fragen", search, key });
const fragenAnsModell = (): string[] =>
  vi.mocked(endpoints.ask.ask).mock.calls.map((aufruf) => String(aufruf[0]));

// Mehr als die frühere Grenze von 50 Marken.
const ANZAHL = 60;

describe("Ben R3 · Startadressen ohne Grenze, Tabellen ohne Rand", () => {
  it("F2 · nach 60 Startadressen holt die erste ihren verworfenen Entwurf nicht zurück", async () => {
    for (let i = 0; i < ANZAHL; i++) {
      const f = await oeffnen(neuerCache("u1"), eintrag(`?q=Frage${i}`, `weg-${i}`));
      expect(feld(f).value).toBe(`Frage${i}`);
      await tippen(f, "");
      f.abbauen();
    }
    const zurueck = await oeffnen(neuerCache("u1"), eintrag("?q=Frage0", "weg-0"));
    expect(feld(zurueck).value).toBe("");
    zurueck.abbauen();
    expect(gespeichert("u1")).not.toContain("Frage0");
  });

  it("F3 · nach 60 `?ask=1`-Adressen fragt die erste das Modell nicht noch einmal", async () => {
    for (let i = 0; i < ANZAHL; i++) {
      const f = await oeffnen(neuerCache("u1"), eintrag(`?q=Frage${i}&ask=1`, `weg-${i}`));
      f.abbauen();
    }
    expect(fragenAnsModell()).toHaveLength(ANZAHL);
    const zurueck = await oeffnen(neuerCache("u1"), eintrag("?q=Frage0&ask=1", "weg-0"));
    expect(fragenAnsModell()).toHaveLength(ANZAHL);
    expect(q(zurueck, "ask-answer")?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    expect(q(zurueck, "ask-wiederaufnahme")?.textContent).toContain("nicht neu erzeugt");
    zurueck.abbauen();
  });

  it("ein neuer Weg auf dieselbe Startfrage gilt weiterhin", async () => {
    const a = await oeffnen(neuerCache("u1"), eintrag("?q=Frage0", "weg-a"));
    await tippen(a, "");
    a.abbauen();
    const b = await oeffnen(neuerCache("u1"), eintrag("?q=Frage0", "weg-b"));
    expect(feld(b).value).toBe("Frage0");
    b.abbauen();
  });

  it("F4 · Tabelle ohne äußere Striche: Köpfe bleiben, `|` und `---` gehen", async () => {
    lage.antwort = antwortMit(
      ["Anlage | Frist", "--- | ---", "V4 | jährlich", "V5 | monatlich [1]"].join("\n"),
    );
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Welche Fristen gelten?");
    await absenden(f);
    const text = f.c.querySelector(".ask-answer-body")?.textContent ?? "";
    for (const zeichen of ["|", "---"]) {
      expect(text, `„${zeichen}“ steht noch im Antworttext`).not.toContain(zeichen);
    }
    expect(text).toContain("Anlage: V4");
    expect(text).toContain("Frist: jährlich");
    expect(text).toContain("Anlage: V5");
    expect(text).toContain("Frist: monatlich");
    f.abbauen();
  });
});
