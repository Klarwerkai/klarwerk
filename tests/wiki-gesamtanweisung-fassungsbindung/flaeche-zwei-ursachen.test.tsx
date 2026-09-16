// @vitest-environment jsdom
// ================================================================================================
// JOB 4233 R2 · ZWEI URSACHEN AM FORMULAR — UND KEINE WIRD ALS DIE ANDERE AUSGEGEBEN.
// ================================================================================================
//
// BENs Korrekturpflicht 2, wörtlich: „Fehlerursachen bis zum Formular unterscheiden. Fehlende
// Anweisung darf nicht als fehlende Fassung ausgegeben werden. Beleg: Oberflächentests für beide
// Ursachen über den echten Dienst und die Route, einschließlich erhaltener Eingabe."
//
// SEIN BEFUND AN RUNDE 1 (`api.ts:69`): jeder 404 wurde zur Aussage „Diese Fassung gibt es nicht."
// Bei verschwundener Anweisung stand damit ein Satz über die EINGETIPPTE FASSUNG da, den der Server
// nie gesagt hatte — und die vorhandene Fassung 1 wurde als nicht existent bezeichnet.
//
// DESHALB IST DIE FLÄCHE HIER AN DIE ECHTE ROUTE GEBUNDEN und nicht an eine Attrappe: die Frage
// dieses Falls ist genau, ob das, was der SERVER sagt, unverfälscht beim Menschen ankommt. Aufbau
// wörtlich im Muster von `tests/wiki-gesamtanweisung/f9-oberflaeche.test.tsx` — `fetch` ist eine
// Brücke in eine frische Fastify-Instanz mit dem echten Plugin, dem echten Dienst und der echten
// Rechtematrix.
//
// GEGENPROBE: in `api.ts` die Unterscheidung wieder auf `status === 404` stellen → der zweite Fall
// unten wird rot und nennt den erfundenen Satz.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { GesamtanweisungSeite } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungSeite";
import "../../apps/web/src/i18n";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import type {
  Anweisung,
  AnweisungRepo,
  AnweisungStandAufnahme,
} from "../../services/knowledge-object/src/gesamtanweisung-types";
import { can } from "../../services/rbac";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

/**
 * Eine Ablage, die ihre Anweisung auf Kommando vergisst — der zweite Fall dieses Falls.
 *
 * Er lässt sich NICHT über eine unbekannte Kennung herstellen: dann hat die Fläche nie einen Stand
 * gesehen, das Formular ist gesperrt (`version === null`) und es wird gar nichts abgeschickt. Die
 * Lage, um die es geht, ist die gefährlichere: der Mensch SIEHT einen Stand und tippt darauf —
 * währenddessen ist die Anweisung weg. Genau so hat BEN sie gemessen („der Aufnahmeknopf bleibt
 * aktiv"). Der Riegel liegt deshalb in der Ablage und nicht im Produktweg.
 */
class VergesslicheAblage implements AnweisungRepo {
  weg = false;
  private readonly innen = new InMemoryAnweisungRepo();

  async get(id: string): Promise<Anweisung | undefined> {
    return this.weg ? undefined : this.innen.get(id);
  }
  async anlegen(anweisung: Anweisung, aufnahme: AnweisungStandAufnahme): Promise<void> {
    return this.innen.anlegen(anweisung, aufnahme);
  }
  async schreiben(
    anweisung: Anweisung,
    erwartet: number,
    aufnahme: AnweisungStandAufnahme,
  ): Promise<void> {
    return this.innen.schreiben(anweisung, erwartet, aufnahme);
  }
  async standLesen(
    anweisungId: string,
    version: number,
  ): Promise<AnweisungStandAufnahme | undefined> {
    return this.innen.standLesen(anweisungId, version);
  }
  async staende(anweisungId: string): Promise<readonly number[]> {
    return this.innen.staende(anweisungId);
  }
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FASSUNG_UNBEKANNT = "Diese Fassung gibt es nicht. Bitte prüfen Sie die Fassungsnummer.";
const ALLGEMEINER_FEHLER = "Die Anweisung konnte nicht geladen werden.";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 1, bodyHtml: "<p>Erst absperren.</p>" },
    { version: 2, bodyHtml: "<p>Zweite Fassung.</p>" },
  ]),
];

const NUTZER: SessionUser = { id: "anna", role: "controller" };

const guards: Guards = {
  async requireUser() {
    return NUTZER;
  },
  async requirePermission(permission, _request, reply) {
    if (!can(NUTZER.role, permission)) {
      reply.code(403).send({ error: "FORBIDDEN", message: "Keine Berechtigung." });
      return undefined;
    }
    return NUTZER;
  },
};

let app: FastifyInstance;
let ablage: VergesslicheAblage;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let echtesFetch: typeof globalThis.fetch;

type Verfahren = "GET" | "POST" | "PUT" | "DELETE";

/** Die Brücke: jeder `/api`-Aufruf der Fläche landet in der echten Route. */
function bruecke(instanz: FastifyInstance): typeof globalThis.fetch {
  return (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof eingabe === "string" ? eingabe : String(eingabe);
    const antwort = await instanz.inject({
      method: (init?.method ?? "GET").toUpperCase() as Verfahren,
      url,
      ...(init?.body === undefined || init.body === null
        ? {}
        : { payload: JSON.parse(String(init.body)) as Record<string, unknown> }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.payload,
    } as unknown as Response;
  }) as typeof globalThis.fetch;
}

/**
 * Warten, bis die Fläche den erwarteten Zustand zeigt — statt eine feste Zahl Ticks zu raten.
 *
 * R3 · DAS ZEITFENSTER IST ABSICHTLICH GROSSZÜGIG (200 × 10 ms = 2 s statt 60 × 5 ms = 300 ms).
 * Dieser Fall läuft im Tor in der „rest"-Gruppe mit sechs Forks neben rund zweitausend anderen
 * Dateien; dort kostet eine Runde durch Abfrage, Route und Neuzeichnen ein Vielfaches dessen, was
 * sie allein kostet (hier gemessen: 231 ms für die ganze Datei, im Tor ebenfalls grün — aber genau
 * solche Fristen sind es, die später unter Last reissen und dann als „flaky" abgeschaltet werden).
 * Ein grosszügiges Fenster kostet im grünen Fall NICHTS: die Schleife endet, sobald die Bedingung
 * hält. Scheitert sie, meldet der Fall NAMENTLICH, worauf er gewartet hat.
 */
async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 200 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

/** Ein paar Takte ruhen lassen — NUR dort, wo danach nichts Bestimmtes erwartet wird. */
async function ruhen(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

function feld(name: string): HTMLInputElement {
  const treffer = container.querySelector<HTMLInputElement>(`[name="${name}"]`);
  expect(treffer, `Feld ${name} fehlt`).not.toBeNull();
  return treffer as HTMLInputElement;
}

function tippe(element: HTMLInputElement, wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, wert);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function sendeAufnahme(koId: string, fassung: string): Promise<void> {
  await act(async () => {
    tippe(feld("koId"), koId);
    tippe(feld("koVersion"), fassung);
  });
  await act(async () => {
    feld("koId")
      .closest("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(async () => {
  ablage = new VergesslicheAblage();
  const dienst = new GesamtanweisungDienst({
    repo: ablage,
    ko: koLeser(EINTRAEGE),
    jetzt: uhr(),
    kennung: kennungen("k"),
  });
  app = Fastify();
  await app.register(gesamtanweisungRoutes, { dienst, guards });
  await app.ready();
  echtesFetch = globalThis.fetch;
  globalThis.fetch = bruecke(app);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = echtesFetch;
  await app.close();
});

async function anweisungAnlegen(): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/gesamtanweisungen",
    payload: { titel: "Anfahren", zweck: "Sicher anfahren", geltungsbereich: "Werk 1" },
  });
  return (antwort.json() as { id: string }).id;
}

async function montiere(anweisungId: string): Promise<void> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(GesamtanweisungSeite, { anweisungId, darfEntscheiden: true }),
      ),
    );
  });
  await ruhen();
  // R3 · ERST WENN DER STAND WIRKLICH DA IST, ist das Formular bedienbar: solange die erste
  // Abfrage läuft, ist `version === null`, der Aufnahmeknopf gesperrt und ein abgeschicktes
  // Formular tut NICHTS (`GesamtanweisungSeite`, `absenden` kehrt früh zurück). Ein Fall, der
  // danach auf eine Absage wartet, würde dann ohne erkennbaren Grund in die Frist laufen. Beide
  // Bedingungen unten erscheinen ausschliesslich mit geholten Daten.
  await warteBis(() => {
    const flaeche = container.querySelector('[data-testid="ga-lesestand"]')?.textContent ?? "";
    return (
      flaeche.includes("Diese Anweisung hat noch keine Bausteine.") ||
      container.querySelectorAll("[data-baustein]").length > 0
    );
  }, "den ersten geholten Lesestand");
}

describe("JOB 4233 R2 · das Formular nennt die Ursache, die der Server gemeldet hat", () => {
  it("URSACHE 1 — die Fassung gibt es nicht: der Satz steht am Formular, die Eingabe bleibt", async () => {
    const id = await anweisungAnlegen();
    await montiere(id);

    await sendeAufnahme("ko-a", "999");
    await warteBis(
      () => (container.textContent ?? "").includes(FASSUNG_UNBEKANNT),
      "die Absage „Diese Fassung gibt es nicht“",
    );

    // Sie steht in einer LIVE-REGION am Aufnahmeformular, nicht irgendwo auf der Seite.
    const alarm = container.querySelector('[data-testid="ga-aufnahme-fehler"]');
    expect(alarm?.getAttribute("role")).toBe("alert");
    expect(alarm?.textContent).toBe(FASSUNG_UNBEKANNT);

    // Die Eingabe steht noch da — nichts gilt als gespeichert, und nichts wurde angelegt.
    expect(feld("koId").value).toBe("ko-a");
    expect(feld("koVersion").value).toBe("999");
    expect(container.querySelectorAll("[data-baustein]")).toHaveLength(0);
  });

  it("URSACHE 2 — die ANWEISUNG ist weg: die Fläche behauptet nichts über die Fassung", async () => {
    // Genau BENs Gegenprobe. Der Mensch sieht einen Stand, tippt eine Fassung, die es WIRKLICH
    // gibt (1), und schickt ab — inzwischen ist die Anweisung verschwunden. Der Server antwortet
    // 404 „Diese Anweisung gibt es nicht."; ein Satz über die Fassung wäre eine Erfindung über
    // einen Gegenstand, über den der Server gar nicht gesprochen hat.
    const id = await anweisungAnlegen();
    // MIT einem Baustein, damit die Fläche einen echten Stand zeigt — genau die Lage, in der ein
    // Mensch weitertippt: er sieht etwas, also hält er die Anweisung für vorhanden.
    await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/bausteine`,
      payload: { version: 1, koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
    });
    await montiere(id);
    // Auf den ERSTEN Stand wird gewartet, nicht geraten: unter Torlast kann die erste Abfrage
    // länger brauchen als die paar Takte in `montiere`, und dann prüfte der Fall unten eine Fläche,
    // die noch gar nichts geholt hat.
    await warteBis(
      () => container.querySelectorAll("[data-baustein]").length === 1,
      "den ersten Stand mit einem Baustein",
    );
    expect(container.textContent).toContain("Anfahren");

    ablage.weg = true;
    await sendeAufnahme("ko-a", "1");
    await warteBis(
      () => container.querySelector('[data-testid="ga-aufnahme-fehler"]') !== null,
      "die Absage am Formular",
    );

    // DER KERN DIESES FALLS: nicht der Satz über die Fassung, sondern der allgemeine.
    const alarm = container.querySelector('[data-testid="ga-aufnahme-fehler"]');
    expect(alarm?.textContent).toBe(ALLGEMEINER_FEHLER);
    expect(container.textContent).not.toContain(FASSUNG_UNBEKANNT);

    // Die Eingabe bleibt auch hier stehen, und es ist nichts dazugekommen.
    expect(feld("koId").value).toBe("ko-a");
    expect(feld("koVersion").value).toBe("1");
    expect(container.querySelectorAll("[data-baustein]")).toHaveLength(1);
  });

  it("KONTROLLFALL — eine belegte Fassung wird aufgenommen, und der Satz verschwindet", async () => {
    const id = await anweisungAnlegen();
    await montiere(id);

    await sendeAufnahme("ko-a", "999");
    await warteBis(
      () => (container.textContent ?? "").includes(FASSUNG_UNBEKANNT),
      "die Absage vor der geglückten Aufnahme",
    );

    await sendeAufnahme("ko-a", "1");
    await warteBis(
      () => container.querySelectorAll("[data-baustein]").length === 1,
      "den aufgenommenen Baustein",
    );

    // Nach dem bestätigten Erfolg ist das Formular leer UND die Absage weg.
    expect(feld("koId").value).toBe("");
    expect(container.textContent).not.toContain(FASSUNG_UNBEKANNT);
    // Und der Text der gebundenen Fassung steht wirklich da.
    expect(container.textContent).toContain("Erst absperren.");
  });
});
