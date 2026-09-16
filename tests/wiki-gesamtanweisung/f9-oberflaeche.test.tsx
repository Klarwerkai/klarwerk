// @vitest-environment jsdom
// ================================================================================================
// JOB 4154 · DER GANZE WEG EINES MENSCHEN — IN DER OBERFLÄCHE, GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Prüfpunkt 1 des Auftrags, wörtlich: „Nicht ‚ein Typ existiert': ein Mensch geht den ganzen Weg —
// aufnehmen, ordnen, lesen, vergleichen, vorlegen — in der Oberfläche."
//
// ------------------------------------------------------------------------------------------------
// WARUM HIER KEIN ABFRAGE-ATTRAPPE STEHT, SONDERN DIE ECHTE ROUTE
// ------------------------------------------------------------------------------------------------
// Ein gemockter Hook prüft, ob die Fläche ihre eigenen Erwartungen erfüllt — nicht, ob sie mit dem
// Server zusammenpasst. Genau dort reisst die Nutzenkette in diesem Projekt üblicherweise: der
// Client schickt `koVersion`, der Server liest `version`, beide Testsuiten sind grün.
//
// Deshalb ist `fetch` hier eine BRÜCKE in eine echte Fastify-Instanz mit dem echten Routen-Plugin,
// dem echten Dienst und den echten Regeln. Was diese Fläche klickt, geht wirklich durch
// `gesamtanweisung-routes.ts` → `GesamtanweisungDienst` und zurück. Nur die Ablage ist ein Double,
// und die Rechteentscheidung ist die echte (`darfSehen`).
//
// ------------------------------------------------------------------------------------------------
// OHNE KI UND MIT DER TASTATUR
// ------------------------------------------------------------------------------------------------
// Das Formular wird per `submit` abgeschickt (der Enter-Weg), nicht per Zeigergerät-Klick. Der
// letzte Fall zählt nach, dass jede bedienbare Stelle ein natürlich fokussierbares Element ist —
// kein `div` mit Klickhörer, kein `tabindex="-1"`.
//
// GEGENPROBE: In `GesamtanweisungSeite.tsx` das Aufnehmen an einen KI-Aufruf hängen (etwa
// `await endpoints.assist.run(...)` vor `aufnehmen.mutateAsync`). Dann wird der Fall in
// `f6-ohne-ki.test.ts` („keine der neuen Dateien berührt eine KI-Fläche") rot und nennt die Datei;
// hier scheitert zusätzlich der Weg, weil kein Modell antwortet.
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
import { can } from "../../services/rbac";
import { InMemoryAnweisungRepo, eintrag, kennungen, koLeser, uhr } from "./pruefstand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 1 }, [
    { version: 1, bodyHtml: '<table><tr><th>Druck</th></tr></table><img alt="Schema" src="x">' },
  ]),
  eintrag({ id: "ko-b", title: "Ventil öffnen", version: 1 }, [
    { version: 1, bodyHtml: "<p>Ventil öffnen.</p>" },
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
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let echtesFetch: typeof globalThis.fetch;

/**
 * Die vier Verfahren, die diese Fläche wirklich benutzt.
 *
 * Absichtlich diese enge Menge statt Fastifys `HTTPMethods`: jene Aufzählung kennt auch `copy`,
 * `lock` und Ähnliches, die `inject` gar nicht annimmt — dann wählt TypeScript die falsche
 * Überladung und die Antwort hat kein `statusCode` mehr.
 */
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
    // Absichtlich KEIN `new Response(...)`: die jsdom-Umgebung bringt die Fetch-Klassen nicht
    // verlässlich mit, und `api/client.ts` liest von der Antwort genau drei Dinge —
    // `status`, `ok` und `text()` (`client.ts:28-46`). Mehr vorzutäuschen wäre Beiwerk.
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.payload,
    } as unknown as Response;
  }) as typeof globalThis.fetch;
}

async function ruhen(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

/**
 * Warten, bis die Fläche den erwarteten Zustand zeigt — statt eine feste Zahl Ticks zu raten.
 *
 * Jeder Schreibvorgang zieht eine Auffrischung nach sich, und erst deren neue `version` trägt den
 * nächsten Schritt. Eine feste Wartezeit wäre genau die Sorte Test, die auf einem schnellen
 * Rechner grün und auf einem langsamen rot ist — und dann abgeschaltet wird. Scheitert die
 * Bedingung, meldet der Fall NAMENTLICH, worauf er gewartet hat.
 */
async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 50 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 5));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

function feld(name: string): HTMLInputElement {
  const treffer = container.querySelector<HTMLInputElement>(`[name="${name}"]`);
  expect(treffer, `Feld ${name} fehlt`).not.toBeNull();
  return treffer as HTMLInputElement;
}

/** Ein Wert so setzen, wie ein Mensch tippt — React hört auf den nativen Setter plus Ereignis. */
function tippe(element: HTMLInputElement | HTMLSelectElement, wert: string): void {
  const proto =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(element, wert);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function knopfMit(text: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
  expect(treffer, `Knopf „${text}" fehlt`).toBeTruthy();
  return treffer as HTMLButtonElement;
}

async function anweisungAnlegen(): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/gesamtanweisungen",
    payload: { titel: "Anfahren", zweck: "Sicher anfahren", geltungsbereich: "Werk 1" },
  });
  return (antwort.json() as { id: string }).id;
}

beforeEach(async () => {
  const dienst = new GesamtanweisungDienst({
    repo: new InMemoryAnweisungRepo(),
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
}

describe("JOB 4154 · der ganze Weg in der Oberfläche", () => {
  it("aufnehmen → ordnen → lesen → vergleichen → vorlegen, alles ohne KI", async () => {
    const id = await anweisungAnlegen();
    await montiere(id);

    // LEER — der Satz des Auftrags, und keine Vollständigkeitsbehauptung.
    expect(container.textContent).toContain("Diese Anweisung hat noch keine Bausteine.");
    expect(container.textContent).not.toContain("vollständig");

    // AUFNEHMEN — zwei Fassungen, über das Formular, per Enter-Weg (submit), nicht per Zeigegerät.
    const zeilen = () => [...container.querySelectorAll("[data-baustein]")];
    let erwartet = 0;
    for (const [koId, fassung] of [
      ["ko-a", "1"],
      ["ko-b", "1"],
    ]) {
      erwartet += 1;
      await act(async () => {
        tippe(feld("koId"), koId as string);
        tippe(feld("koVersion"), fassung as string);
      });
      await act(async () => {
        // Über das FELD zum Formular, nicht über `querySelector("form")`: sobald ein Baustein in
        // der Liste steht, trägt dessen Voraussetzungszeile ein eigenes Formular — und das steht
        // im DOM VOR der Aufnahme. (Genau daran ist dieser Fall beim ersten Lauf gescheitert.)
        feld("koId")
          .closest("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await warteBis(() => zeilen().length === erwartet, `${erwartet} Bausteine in der Liste`);
    }

    expect(zeilen()).toHaveLength(2);
    // Die Eingabefelder sind nach dem bestätigten Erfolg wieder leer.
    expect(feld("koId").value).toBe("");

    // LESEN — Herkunft je Baustein, aus der GEBUNDENEN Fassung.
    expect(container.textContent).toContain("Gebundene Fassung 1");
    expect(container.textContent).toContain("Anlage entlüften");
    expect(container.textContent).toContain("Tabellenüberschriften: Druck");
    expect(container.textContent).toContain("Abbildungen: Schema");
    // Und der Lückenvermerk steht sichtbar da.
    expect(container.textContent).toContain("Prüfanbindung: noch nicht angebunden");

    // ORDNEN — der erste Baustein wandert nach unten.
    const vorher = zeilen().map((z) => z.getAttribute("data-baustein"));
    await act(async () => {
      const runter = zeilen()[0]?.querySelector("button:nth-of-type(2)") as HTMLButtonElement;
      runter.click();
    });
    await warteBis(
      () => zeilen()[0]?.getAttribute("data-baustein") === vorher[1],
      "die getauschte Reihenfolge",
    );
    const nachher = zeilen().map((z) => z.getAttribute("data-baustein"));
    expect(nachher).toEqual([...vorher].reverse());

    // VORAUSSETZUNG — am ersten Baustein, über sein eigenes Formular (wieder der Enter-Weg).
    const ersterId = nachher[0] as string;
    await act(async () => {
      tippe(feld(`voraussetzung-${ersterId}`), "Anlage steht still");
    });
    await act(async () => {
      feld(`voraussetzung-${ersterId}`)
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await warteBis(
      () => (container.textContent ?? "").includes("Voraussetzung: Anlage steht still"),
      "die übernommene Voraussetzung",
    );

    // VERGLEICHEN — zwei wirklich festgehaltene Stände aus der Auswahl.
    const staende = await app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${id}/staende`,
    });
    const nummern = (staende.json() as { staende: number[] }).staende;
    expect(nummern.length).toBeGreaterThanOrEqual(2);
    const vorletzte = nummern[nummern.length - 2] as number;
    const letzte = nummern[nummern.length - 1] as number;

    await act(async () => {
      tippe(container.querySelector("#ga-vergleich-von") as HTMLSelectElement, String(vorletzte));
    });
    await act(async () => {
      tippe(container.querySelector("#ga-vergleich-bis") as HTMLSelectElement, String(letzte));
    });
    await warteBis(
      () => container.querySelector('[data-testid="ga-vergleich-gesamt"]') !== null,
      "das Vergleichsergebnis",
    );

    // Die Reihenfolge hat sich geändert — genau das muss der Vergleich melden (F1 am Draht).
    const ergebnis = container.querySelector('[data-testid="ga-vergleich-gesamt"]');
    expect(ergebnis?.textContent).toBe("Geändert.");
    expect(container.textContent).toContain("Nicht bestimmbare Befunde: 0");
    // Und nirgends steht ein Wort, das mehr behauptet als „unverändert".
    expect(container.textContent).not.toContain("geprüft");
    expect(container.textContent).not.toContain("freigegeben");

    // VORLEGEN — ein menschlicher Schritt, kein abgeleiteter.
    expect(container.querySelector('[data-testid="ga-entscheidung-stand"]')?.textContent).toBe(
      "Entwurf",
    );
    const standzeile = () =>
      container.querySelector('[data-testid="ga-entscheidung-stand"]')?.textContent;
    await act(async () => {
      knopfMit("Vorlegen").click();
    });
    await warteBis(() => standzeile() === "Vorgelegt", "den Stand „Vorgelegt“");

    // ENTSCHEIDEN — erst jetzt, und erst durch einen Menschen.
    await act(async () => {
      knopfMit("Annehmen").click();
    });
    await warteBis(() => standzeile() === "Entschieden", "den Stand „Entschieden“");
  });

  it("jede bedienbare Stelle ist mit der Tastatur erreichbar", async () => {
    const id = await anweisungAnlegen();
    await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/bausteine`,
      payload: { version: 1, koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
    });
    await montiere(id);

    // Kein Klickhörer auf einem nicht fokussierbaren Element — React setzt keine `onclick`-Attribute,
    // deshalb wird hier geprüft, dass ALLE Bedienstellen native Elemente sind.
    const bedienbar = [...container.querySelectorAll("button, input, select, textarea, a[href]")];
    expect(bedienbar.length).toBeGreaterThan(0);
    for (const element of bedienbar) {
      expect(element.getAttribute("tabindex"), element.outerHTML).not.toBe("-1");
    }
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);

    // Jedes Eingabefeld hat eine verbundene Beschriftung — sonst wäre es per Tastatur erreichbar,
    // aber nicht benennbar.
    for (const eingabe of container.querySelectorAll("input, select")) {
      const id2 = eingabe.getAttribute("id");
      expect(id2, eingabe.outerHTML).toBeTruthy();
      expect(container.querySelector(`label[for="${id2}"]`), id2 ?? "").not.toBeNull();
    }
  });

  it("ein abgelehnter Schreibvorgang lässt die Eingabe stehen und meldet ihn", async () => {
    const id = await anweisungAnlegen();
    await montiere(id);

    // Ein Eintrag, den es nicht gibt: der Server lehnt mit 403 ab (fail-closed an der Quelle).
    await act(async () => {
      tippe(feld("koId"), "ko-gibt-es-nicht");
      tippe(feld("koVersion"), "1");
    });
    await act(async () => {
      feld("koId")
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await warteBis(
      () =>
        (container.textContent ?? "").includes(
          "Teile dieser Anweisung sind für Sie nicht zugänglich.",
        ),
      "die Ablehnungsmeldung",
    );

    // Die Eingabe steht noch da — nichts gilt als gespeichert.
    expect(feld("koId").value).toBe("ko-gibt-es-nicht");
    expect(container.querySelectorAll("[data-baustein]")).toHaveLength(0);
    expect(container.textContent).toContain(
      "Teile dieser Anweisung sind für Sie nicht zugänglich.",
    );
  });
});
