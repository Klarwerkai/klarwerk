// @vitest-environment jsdom
// ================================================================================================
// JOB 4156 · A6 — DER ANSCHLUSS LEGT DEN LÜCKENVERMERK NICHT STILL.
// ================================================================================================
//
// Startvertrag, wörtlich: „Aktuelle Lücken der Prüfanbindung deutlich nennen." JOB 4154 hat den
// Vermerk gebaut und geprüft — am Bauteil (`f9-zustandsmodell.test.tsx`) und am Draht
// (`f8-plugin-registrierung.test.ts`).
//
// WARUM ER HIER NOCH EINMAL GEMESSEN WIRD, und das ist nicht dieselbe Messung: der Anschluss ist
// genau der Schritt, bei dem so ein Satz üblicherweise verschwindet. Die neue Hülle
// (`GesamtanweisungBereich`) hätte ihn weglassen, überschreiben oder in eine Fassung bringen
// können, die ihn nur bei bestimmten Zuständen zeigt. Gemessen wird deshalb durch den NEUEN
// Eingang — dieselbe Kette, die ein Mensch nach dem Anschluss geht — und nicht am Bauteil, das
// 4154 schon hält.
//
// ER WIRD AUCH NICHT UMFORMULIERT: der Fall liest den Text WÖRTLICH aus `i18n.ts`, in allen drei
// Sprachen, und hält ihn gegen das, was am DOM steht. Ein weichgespülter Satz („Prüfung folgt")
// wäre damit rot.
//
// DIE BRÜCKE IST DIE ECHTE ROUTE (Muster aus `tests/wiki-gesamtanweisung/f9-oberflaeche.test.tsx`):
// was diese Fläche holt, geht wirklich durch `gesamtanweisung-routes.ts` → `GesamtanweisungDienst`.
// Ein gemockter Hook würde hier nur die eigene Attrappe prüfen.
//
// GEGENPROBE (gefahren, siehe RUECKGABE): in `LesestandAnsicht.tsx` die Zeile mit
// `t("ga.pruefanbindung")` entfernen. Dann wird dieser Fall rot — und `f9-zustandsmodell.test.tsx`
// aus dem Paket 4154 ebenfalls.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "anna", name: "Anna", email: "a@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
// `GesamtanweisungBereich` fragt die Rolle (für `darfEntscheiden`) und den Onlinezustand. Beides
// kommt aus der Hülle; ohne `RoleProvider` wirft `useRole` bewusst, statt still eine Rolle zu
// raten. Die Anmeldung wird deshalb gemockt — sie ist nicht der Gegenstand dieses Falls.
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { GesamtanweisungBereich } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import i18n from "../../apps/web/src/i18n";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import { can } from "../../services/rbac";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 1 }, [
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

type Verfahren = "GET" | "POST" | "PUT" | "DELETE";

/** Jeder `/api`-Aufruf der Fläche landet in der echten Route. */
function bruecke(instanz: FastifyInstance): typeof globalThis.fetch {
  return (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const antwort = await instanz.inject({
      method: (init?.method ?? "GET").toUpperCase() as Verfahren,
      url: typeof eingabe === "string" ? eingabe : String(eingabe),
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

let app: FastifyInstance;
let container: HTMLDivElement;
let root: Root;
let echtesFetch: typeof globalThis.fetch;

/** Der Text, wie er WIRKLICH in `i18n.ts` steht — nicht hier abgeschrieben. */
function text(sprache: string, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

async function ruhen(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 0));
    });
  }
}

async function zeigeAnweisung(id: string): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/gesamtanweisungen/${id}`] },
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement(GesamtanweisungBereich),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhen();
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
  await i18n.changeLanguage("de");
});

async function anlegen(): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/gesamtanweisungen",
    payload: { titel: "Anfahren" },
  });
  return (antwort.json() as { id: string }).id;
}

/** Eine Anweisung mit einem wirklich vorhandenen, gebundenen Baustein. */
async function anweisungMitBaustein(): Promise<string> {
  const id = await anlegen();
  const mitBaustein = await app.inject({
    method: "POST",
    url: `/api/gesamtanweisungen/${id}/bausteine`,
    payload: { version: 1, koId: "ko-a", koVersion: 1, nachweisHash: "h1" },
  });
  expect(mitBaustein.statusCode).toBe(200);
  return id;
}

/** Den Prüfstand zurücksetzen, damit der nächste Durchlauf einer Schleife frisch zeichnet. */
async function neueFlaeche(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

describe("A6 · der Lückenvermerk zur Prüfanbindung nach dem Anschluss", () => {
  it("er steht am DOM der angeschlossenen Seite", async () => {
    const id = await anweisungMitBaustein();
    await zeigeAnweisung(id);
    const inhalt = container.textContent ?? "";
    expect(inhalt).toContain("Anlage entlüften");
    expect(inhalt).toContain(text("de", "ga.pruefanbindung"));
  });

  it("er kommt am Draht mit — der Server sagt die Lücke, nicht die Fläche", async () => {
    // Die zweite Hälfte desselben Nachweises: stünde der Satz nur in der Oberfläche, könnte ihn
    // jede künftige Ansicht weglassen, ohne dass es auffällt. Er ist ein DATUM.
    const id = await anweisungMitBaustein();
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${id}` });
    expect((gelesen.json() as { pruefanbindung: string }).pruefanbindung).toBe("nicht_angebunden");
  });

  it("er ist in de/en/nl unverändert — nicht weichgespült, nicht weggelassen", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      const wortlaut = text(sprache, "ga.pruefanbindung");
      // Der Satz muss die Lücke auch wirklich BENENNEN und nicht nur einen Titel tragen.
      expect(wortlaut.length, `Text fehlt in ${sprache}`).toBeGreaterThan(10);
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      const id = await anweisungMitBaustein();
      await zeigeAnweisung(id);
      expect(container.textContent ?? "", `Lückenvermerk in ${sprache}`).toContain(wortlaut);
      await neueFlaeche();
    }
  });

  // ------------------------------------------------------------------------------------------------
  // DIE GEMESSENE LÜCKE — SIE WIRD FESTGEHALTEN, NICHT ÜBERSPIELT.
  // ------------------------------------------------------------------------------------------------
  //
  // GEMESSEN IN DIESEM AUFTRAG, nicht vermutet: bei einer Anweisung OHNE Bausteine zeigt
  // `LesestandAnsicht` (`apps/web/src/components/gesamtanweisung/LesestandAnsicht.tsx:237-243`) den
  // Leerzweig und kehrt VOR dem Lückenvermerk zurück. Am Draht steht `pruefanbindung` trotzdem —
  // die Lücke ist also reine Anzeige.
  //
  // WARUM SIE HIER STEHT UND NICHT BEHOBEN IST: sie stammt aus JOB 4154 und ist KEINE Folge dieses
  // Anschlusses (der Draht liefert den Vermerk unverändert, der Fall darüber misst es). Abschnitt 10
  // des Auftrags verbietet die fachliche Änderung am Bestand von 4154 ausdrücklich. Ein stilles
  // Weglassen dieses Falls wäre die schlechtere Wahl gewesen: dann wüsste niemand, dass ausgerechnet
  // der leere Entwurf — der Zustand, in dem ein Mensch am ehesten „da ist ja noch nichts zu prüfen"
  // denkt — den Hinweis nicht trägt.
  //
  // WIRD DER LEERZWEIG REPARIERT, ist dieser Fall rot und gehört ERSETZT durch die Erwartung, dass
  // der Vermerk auch dort steht. Das ist beabsichtigt: er pinnt eine Schuld, keinen Sollzustand.
  it("BEKANNTE LÜCKE (JOB 4154): der LEERE Entwurf trägt ihn in der Anzeige noch nicht", async () => {
    const id = await anlegen();
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${id}` });
    // Der Server sagt die Lücke auch hier — sie geht erst in der Anzeige verloren.
    expect((gelesen.json() as { pruefanbindung: string }).pruefanbindung).toBe("nicht_angebunden");

    await zeigeAnweisung(id);
    const inhalt = container.textContent ?? "";
    // Der Leerzweig ist wirklich aktiv — sonst prüfte dieser Fall gar nichts.
    expect(inhalt).toContain(text("de", "ga.leer"));
    expect(
      inhalt,
      "Der Leerzweig zeigt den Lückenvermerk jetzt doch — dann ist die Schuld beglichen und dieser Fall gehört durch die positive Erwartung ersetzt.",
    ).not.toContain(text("de", "ga.pruefanbindung"));
  });
});
