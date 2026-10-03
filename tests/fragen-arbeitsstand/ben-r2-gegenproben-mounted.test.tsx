// @vitest-environment jsdom
// ================================================================================================
// NACHARBEIT NACH BENS URTEIL (Runde 2) — DIE NACHBARFÄLLE, DIE RUNDE 2 NOCH DURCHLIESS.
// ================================================================================================
//
// Derselbe Aufbau wie `ben-r1-gegenproben-mounted.test.tsx` (echte `Ask`-Seite, echter
// Browserspeicher, echte Sitzungsabfrage), dazu ein steuerbarer Konfliktabruf.
//
//   F2  Zwischen zwei Besuchen einer Startadresse liegt eine ANDERE Startadresse — die ältere
//       holt ihren verworfenen Entwurf trotzdem nicht zurück.
//   F3  Dasselbe mit `?ask=1`: die ältere Adresse fragt das Modell nicht noch einmal.
//   F4  Codezäune und Tabellen stehen als lesbarer Text da, ohne Backticks, `|` und `---`.
//   F5  Eine gestörte Prüfung zeigt auch ohne Antwort die Störung (keine Wissenslücke), und ein
//       Wiederholversuch gibt die Antwort erst nach ERFOLGREICHER Prüfung frei.
//   F10 Die Erklärung gesperrter Quellen nennt nur die vorliegenden Gründe; der Prüfweg steht nur,
//       wenn Freigabe oder Stufe fehlen.
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

function luecke(verschlossen: unknown[]): unknown {
  return {
    result: {
      answered: false,
      answer: null,
      knowledgeClass: "unbekannt",
      trust: 0,
      sources: [],
      steps: [],
      demo: false,
    },
    gap: { id: "gap-1" },
    receipt: "beleg-1",
    verschlossen,
  };
}

function gesperrt(teil: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "ko-1",
    title: "Wartungsplan Ventil V4",
    status: "validiert",
    freigabeFehlt: false,
    stufeFehlt: false,
    volltextFehlt: false,
    ...teil,
  };
}

describe("Ben R2 · Nachbarfälle auf der Fragenseite", () => {
  it("F2 · eine zwischendurch übernommene andere Startadresse holt den verworfenen Entwurf nicht zurück", async () => {
    const a = await oeffnen(neuerCache("u1"), eintrag("?q=VerworfeneFrage", "weg-a"));
    expect(feld(a).value).toBe("VerworfeneFrage");
    await tippen(a, "");
    a.abbauen();

    const b = await oeffnen(neuerCache("u1"), eintrag("?q=AndereFrage", "weg-b"));
    expect(feld(b).value).toBe("AndereFrage");
    await tippen(b, "");
    b.abbauen();

    const zurueck = await oeffnen(neuerCache("u1"), eintrag("?q=VerworfeneFrage", "weg-a"));
    expect(feld(zurueck).value).toBe("");
    zurueck.abbauen();
    expect(gespeichert("u1")).not.toContain("VerworfeneFrage");
  });

  it("F3 · eine ältere `?ask=1`-Adresse fragt nach einer zweiten nicht noch einmal", async () => {
    const a = await oeffnen(neuerCache("u1"), eintrag("?q=FrageA&ask=1", "weg-a"));
    a.abbauen();
    const b = await oeffnen(neuerCache("u1"), eintrag("?q=FrageB&ask=1", "weg-b"));
    b.abbauen();
    expect(fragenAnsModell()).toEqual(["FrageA", "FrageB"]);

    const zurueck = await oeffnen(neuerCache("u1"), eintrag("?q=FrageA&ask=1", "weg-a"));
    expect(fragenAnsModell()).toEqual(["FrageA", "FrageB"]);
    // Es steht die zuletzt angezeigte Antwort — mit Quelle, ausdrücklich nicht neu erzeugt.
    expect(q(zurueck, "ask-answer")?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    expect(q(zurueck, "ask-wiederaufnahme")?.textContent).toContain("nicht neu erzeugt");
    zurueck.abbauen();
  });

  it("F4 · Codezaun und Tabelle: lesbarer Text ohne technische Zeichen", async () => {
    lage.antwort = antwortMit(
      [
        "Prüffristen [1]:",
        "",
        "```text",
        "Ventil V4 jährlich",
        "```",
        "",
        "| Anlage | Frist |",
        "| --- | --- |",
        "| V4 | jährlich |",
      ].join("\n"),
    );
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Welche Fristen gelten?");
    await absenden(f);
    const text = f.c.querySelector(".ask-answer-body")?.textContent ?? "";
    for (const zeichen of ["```", "`", "|", "---"]) {
      expect(text, `„${zeichen}“ steht noch im Antworttext`).not.toContain(zeichen);
    }
    expect(text).toContain("Ventil V4 jährlich");
    expect(text).toContain("Anlage: V4");
    expect(text).toContain("Frist: jährlich");
    f.abbauen();
  });

  it("F5 · Konfliktabruf gescheitert und keine Antwort: Störung statt Wissenslücke", async () => {
    lage.konflikte = "fehler";
    lage.antwort = luecke([]);
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    expect(q(f, "ask-pruefung-gestoert")?.textContent).toContain(
      "Klara konnte das Firmenwissen gerade nicht verlässlich prüfen",
    );
    expect(q(f, "ask-gap"), "die Störung sieht aus wie eine Wissenslücke").toBeNull();
    f.abbauen();
  });

  it("F5 · „Erneut versuchen“ gibt die Antwort erst nach erfolgreicher Prüfung frei", async () => {
    lage.konflikte = "fehler";
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    const stoerung = q(f, "ask-pruefung-gestoert");
    expect(stoerung).not.toBeNull();
    expect(q(f, "ask-answer")).toBeNull();

    // Der neue Abruf bleibt offen — solange ist nichts geprüft.
    lage.konflikte = "halten";
    await act(async () => {
      stoerung?.querySelector("button")?.click();
      await flush();
    });
    expect(q(f, "ask-answer"), "Teilantwort während der Prüfung").toBeNull();
    expect(q(f, "ask-pruefung-gestoert")).not.toBeNull();

    // Die Prüfung gelingt — erst jetzt steht die Antwort.
    await act(async () => {
      lage.konflikteFreigeben();
      await flush();
    });
    expect(q(f, "ask-pruefung-gestoert")).toBeNull();
    expect(q(f, "ask-answer")?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    expect(fragenAnsModell()).toHaveLength(1);
    f.abbauen();
  });

  it("F10 · nur der Volltext fehlt: kein „nicht freigegeben“, kein Prüfweg — der Grund steht da", async () => {
    lage.rolle = "controller";
    lage.antwort = luecke([gesperrt({ volltextFehlt: true })]);
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    const karte = q(f, "ask-gap");
    const text = karte?.textContent ?? "";
    expect(text).toContain(i18n.t("ask.verschlossen.titel"));
    // Die Runde-2-Aussage „noch nicht freigegeben … erst nach Prüfung und Einstufung“ stimmte hier
    // nicht. (Der ältere Trennungssatz nennt „freigegeben“ als Begriff und bleibt — er trifft zu.)
    expect(text).not.toContain("noch nicht freigegeben");
    expect(text).not.toContain(i18n.t("ask.verschlossen.grund.freigabe"));
    expect(text).not.toContain(i18n.t("ask.verschlossen.grund.stufe"));
    expect(text).not.toContain("Einstufung");
    expect(q(f, "ask-verschlossen-grund-volltext")).not.toBeNull();
    expect(q(f, "ask-verschlossen-grund-freigabe")).toBeNull();
    expect(q(f, "ask-verschlossen-pruefen")).toBeNull();
    // Der passende Weg ist das Dokument selbst — der Leselink bleibt.
    expect(karte?.querySelector('a[href="/wissen/ko-1"]')).not.toBeNull();
    f.abbauen();
  });

  it("F10 · Freigabe fehlt: Grund und Prüfweg „Freigeben“ — ohne Einstufungssatz", async () => {
    lage.rolle = "controller";
    lage.antwort = luecke([gesperrt({ status: "offen", freigabeFehlt: true })]);
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    expect(q(f, "ask-verschlossen-grund-freigabe")).not.toBeNull();
    expect(q(f, "ask-verschlossen-grund-stufe")).toBeNull();
    expect(q(f, "ask-verschlossen-grund-volltext")).toBeNull();
    const weg = q(f, "ask-verschlossen-pruefen");
    expect(weg?.getAttribute("href")).toBe("/validierung");
    expect(weg?.parentElement?.textContent).toContain(
      i18n.t("ask.verschlossen.pruefPfad.freigabe"),
    );
    f.abbauen();
  });
});
