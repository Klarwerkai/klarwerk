// @vitest-environment jsdom
// ================================================================================================
// NACHARBEIT NACH BENS URTEIL (Runde 1) — JEDER BEFUND ALS GEGENPROBE AUF DER ECHTEN FRAGENSEITE.
// ================================================================================================
//
// Die echte `Ask`-Seite, der echte Browserspeicher (jsdom), die echte Sitzungsabfrage
// `["auth", "me"]`. Gemockt sind die Endpunkte, die Rolle und — für F1 — die Zeit, zu der die
// Modellantwort eintrifft.
//
//   F1  Eine laufende Anfrage bleibt dem Konto, das sie gestellt hat — nach einem Kontowechsel
//       erscheint ihre Antwort weder beim neuen Konto noch in dessen Stand.
//   F2  Die Startfrage aus `?q=` gewinnt nur EINMAL: Neuladen derselben Adresse behält den
//       weitergeschriebenen und den bewusst geleerten Entwurf; ein NEUER Weg dorthin gilt wieder.
//   F3  `?ask=1` fragt beim Wiederöffnen nicht noch einmal — die Antwort kommt aus dem Stand.
//   F4  Im Antworttext stehen keine `__`, `~~`, Backticks und keine Linksyntax mehr.
//   F7  Der Administrator bekommt ohne Modell einen Weg zu den KI-Einstellungen; andere nicht.
//   F8  Eine wiederaufgenommene Antwort mit abgelaufenem Beleg bietet „Hat geholfen" nicht an,
//       sondern erklärt es; eine frische bietet es an.
//   F10 Gesperrte vorhandene Quellen: zuerst „Inhalt vorhanden, nicht freigegeben", dann der
//       Prüfweg, dann erst der Lückensatz und die Neuerfassung.
// F5 und F6 stehen an ihren Bestandstests (`tests/ask/mega34-konfliktstand-pflichtsignal.test.tsx`,
// `tests/ask/ask-check-caveat-mounted.test.tsx` A4), F9 in `start-enter-fragt.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  rolle: "experte" as string,
  kiAktiv: true,
  // Steht `true`, hält der Modellendpunkt seine Antwort zurück, bis `freigeben()` gerufen wird.
  zurueckhalten: false,
  freigeben: (() => {}) as () => void,
  antwort: null as unknown,
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
    conflicts: { list: vi.fn(async () => []) },
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
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("Ben R1 · Gegenproben auf der Fragenseite", () => {
  it("F1 · die verspätete Antwort von u1 erscheint nach dem Wechsel auf u2 nirgends bei u2", async () => {
    lage.zurueckhalten = true;
    const cache = neuerCache("u1");
    const f = await oeffnen(cache);
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);

    // Kontowechsel bei offener Seite, DANN kommt die Antwort.
    await act(async () => {
      cache.setQueryData(["auth", "me"], { id: "u2", role: "experte" });
      await flush();
    });
    await act(async () => {
      lage.freigeben();
      await flush();
    });

    expect(q(f, "ask-answer"), "fremde Antwort sichtbar").toBeNull();
    expect(f.c.textContent).not.toContain("Ventil V4 wird jährlich geprüft");
    expect(q(f, "ask-pending"), "kein Wartezustand des fremden Kontos").toBeNull();
    expect(gespeichert("u2")).not.toContain("Ventil V4 wird jährlich geprüft");
    // u1 behält seinen Arbeitsstand: die gestellte Frage steht in seinem Entwurf.
    expect(gespeichert("u1")).toContain("Wie oft wird Ventil V4 geprüft?");
    f.abbauen();
  });

  it("F2 · Neuladen derselben Startadresse behält den weitergeschriebenen Entwurf", async () => {
    const erst = await oeffnen(neuerCache("u1"), "/fragen?q=Startfrage");
    expect(feld(erst).value).toBe("Startfrage");
    await tippen(erst, "Mein fortgesetzter Entwurf");
    erst.abbauen();

    const neu = await oeffnen(neuerCache("u1"), "/fragen?q=Startfrage");
    expect(feld(neu).value).toBe("Mein fortgesetzter Entwurf");
    neu.abbauen();
  });

  it("F2 · ein bewusst geleerter Entwurf kommt über dieselbe Startadresse nicht zurück", async () => {
    const erst = await oeffnen(neuerCache("u1"), "/fragen?q=Startfrage");
    await tippen(erst, "");
    erst.abbauen();
    // Verworfen heisst auch: der Fragetext liegt nicht mehr im Speicher — die Marke trägt nur
    // einen Prüfwert.
    expect(gespeichert("u1")).not.toBe("");
    expect(gespeichert("u1")).not.toContain("Startfrage");

    const neu = await oeffnen(neuerCache("u1"), "/fragen?q=Startfrage");
    expect(feld(neu).value).toBe("");
    neu.abbauen();
  });

  it("F2 · ein NEUER Weg auf die Seite mit derselben Frage gilt wieder (neue Navigationskennung)", async () => {
    const erst = await oeffnen(neuerCache("u1"), "/fragen?q=Startfrage");
    await tippen(erst, "Etwas anderes");
    erst.abbauen();

    const neuerWeg = await oeffnen(neuerCache("u1"), {
      pathname: "/fragen",
      search: "?q=Startfrage",
      key: "zweiter-klick",
    });
    expect(feld(neuerWeg).value).toBe("Startfrage");
    neuerWeg.abbauen();
  });

  it("F3 · `?ask=1` fragt beim Wiederöffnen nicht erneut — die Antwort kommt aus dem Stand", async () => {
    const erst = await oeffnen(neuerCache("u1"), "/fragen?q=Ventil&ask=1");
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    expect(q(erst, "ask-answer")?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    erst.abbauen();

    const neu = await oeffnen(neuerCache("u1"), "/fragen?q=Ventil&ask=1");
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    expect(q(neu, "ask-answer")?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    expect(q(neu, "ask-wiederaufnahme")?.textContent).toContain("nicht neu erzeugt");
    neu.abbauen();
  });

  it("F4 · im gerenderten Antworttext stehen keine technischen Auszeichnungszeichen", async () => {
    lage.antwort = antwortMit(
      "__Wichtig__ und ~~veraltet~~. Siehe [Handbuch](https://example.test/handbuch) und `V4` [1].",
    );
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Was gilt für V4?");
    await absenden(f);
    const koerper = f.c.querySelector<HTMLElement>(".ask-answer-body");
    expect(koerper, "Antworttext nicht gefunden").not.toBeNull();
    const text = koerper?.textContent ?? "";
    for (const zeichen of ["__", "~~", "`", "](", "https://"]) {
      expect(text, `„${zeichen}“ steht noch im Antworttext`).not.toContain(zeichen);
    }
    expect(text).toContain("Wichtig");
    expect(text).toContain("Handbuch");
    expect(koerper?.querySelector("strong")?.textContent).toBe("Wichtig");
    expect(koerper?.querySelector("s")?.textContent).toBe("veraltet");
    // Die Adresse aus dem Modelltext wird kein Link.
    expect(koerper?.querySelector('a[href^="https://example.test"]')).toBeNull();
    f.abbauen();
  });

  it("F7 · ohne Modell: der Administrator bekommt den Weg zu den KI-Einstellungen, andere nicht", async () => {
    lage.kiAktiv = false;
    lage.rolle = "admin";
    const admin = await oeffnen(neuerCache("u1"));
    const weg = q(admin, "ask-ki-verbinden");
    expect(weg, "kein Verbindungsweg für den Administrator").not.toBeNull();
    expect(weg?.querySelector("a")?.getAttribute("href")).toBe("/admin?bereich=ki&detail=ki");
    expect(weg?.textContent).toContain("KI-Einstellungen öffnen");
    admin.abbauen();

    lage.rolle = "experte";
    const experte = await oeffnen(neuerCache("u2"));
    expect(q(experte, "ask-ki-verbinden")).toBeNull();
    // Der erklärende Zustand mit seinen Alternativen bleibt.
    expect(q(experte, "ask-ai-alternative")).not.toBeNull();
    experte.abbauen();
  });

  it("F8 · abgelaufener Beleg einer wiederaufgenommenen Antwort: kein „Hat geholfen“, sondern ein Satz", async () => {
    const frisch = await oeffnen(neuerCache("u1"));
    await tippen(frisch, "Wie oft wird Ventil V4 geprüft?");
    await absenden(frisch);
    const knopf = (f: Flaeche): HTMLButtonElement | undefined =>
      [...f.c.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) => b.textContent?.trim() === i18n.t("ask.helpful"),
      );
    expect(knopf(frisch)?.disabled, "frische Antwort: Rückmeldung möglich").toBe(false);
    expect(q(frisch, "ask-rueckmeldung-abgelaufen")).toBeNull();
    frisch.abbauen();

    // Die gespeicherte Antwort altert über die Belegfrist hinaus.
    const roh = JSON.parse(gespeichert("u1")) as { antwort: { angezeigtAm: string } };
    roh.antwort.angezeigtAm = new Date(Date.now() - 1_800_001).toISOString();
    localStorage.setItem("kw.fragen.arbeitsstand.v1:u1", JSON.stringify(roh));

    const spaeter = await oeffnen(neuerCache("u1"));
    expect(q(spaeter, "ask-answer")).not.toBeNull();
    expect(knopf(spaeter)?.disabled).toBe(true);
    expect(q(spaeter, "ask-rueckmeldung-abgelaufen")?.textContent).toContain("30 Minuten");
    await act(async () => {
      knopf(spaeter)?.click();
      await flush();
    });
    expect(endpoints.ask.helpful).not.toHaveBeenCalled();
    spaeter.abbauen();
  });

  it("F10 · gesperrte vorhandene Quelle: zuerst die Lage, dann der Prüfweg, dann Lücke und Erfassung", async () => {
    lage.rolle = "controller";
    lage.antwort = {
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
      verschlossen: [
        {
          id: "ko-1",
          title: "Wartungsplan Ventil V4",
          status: "offen",
          freigabeFehlt: true,
          stufeFehlt: true,
          volltextFehlt: false,
        },
      ],
    };
    const f = await oeffnen(neuerCache("u1"));
    await tippen(f, "Wie oft wird Ventil V4 geprüft?");
    await absenden(f);
    const karte = q(f, "ask-gap");
    expect(karte).not.toBeNull();
    const text = karte?.textContent ?? "";
    const lagePos = text.indexOf(i18n.t("ask.verschlossen.titel"));
    const lueckePos = text.indexOf(i18n.t("ask.noBasisTitle"));
    expect(lagePos, "die Lage „Inhalt vorhanden“ fehlt").toBeGreaterThanOrEqual(0);
    expect(lueckePos, "der Lückensatz bleibt erhalten").toBeGreaterThan(lagePos);
    // Lesen, prüfen, erfassen — drei Wege, in dieser Reihenfolge.
    const hrefs = [...(karte?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(hrefs[0]).toBe("/wissen/ko-1");
    expect(hrefs).toContain("/validierung");
    expect(hrefs.indexOf("/validierung")).toBeLessThan(
      hrefs.findIndex((h) => h?.startsWith("/erfassen")),
    );
    f.abbauen();
  });
});
