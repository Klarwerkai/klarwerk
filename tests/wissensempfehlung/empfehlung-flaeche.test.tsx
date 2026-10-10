// @vitest-environment jsdom
// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — DIE FLÄCHE IN DER LESESPALTE, GEGEN DIE ECHTE ANWENDUNG.
// ================================================================================================
//
// Die Fläche (`Wissensempfehlung`) wird in jsdom montiert; ihr `fetch` geht über `app.inject` an
// die echte App (In-Memory-Ablage). Jeder Aufruf wird mitgeschrieben.
//
//   F1  Wer einen Eintrag liest, sieht die verwandten Einträge mit ihrem Grund — Konflikt,
//       zusammen gelesen, gemeinsame Schlagwörter — und einen Weg zum Öffnen.
//   F2  Ohne Empfehlung zeichnet die Fläche nichts (kein Leerkasten, kein Fehlersatz).
//   F3  Lesen meldet das Paar: A gelesen, dann B gelesen → genau ein POST mit `zuvor: A`; das bloße
//       Anzeigen vor Ablauf der Mindestlesezeit meldet nichts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { Wissensempfehlung } from "../../apps/web/src/components/bibliothek/Wissensempfehlung";
import i18n from "../../apps/web/src/i18n";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let adminToken = "";
let flaechenToken = "";
let aufrufe: Array<{ methode: string; url: string; body: string }> = [];

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const body = init?.body === undefined || init?.body === null ? "" : String(init.body);
    aufrufe.push({ methode, url, body });
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(body === "" ? {} : { payload: body }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: email, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return anmelden(email);
}

async function eintrag(title: string, tags: string[]): Promise<string> {
  const ko = await services.ko.create({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    tags,
    confidentiality: "intern",
  });
  return ko.id;
}

async function mitgelesenVon(token: string, id: string, zuvor: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: `/api/kos/${id}/mitgelesen`,
    headers: { authorization: `Bearer ${token}` },
    payload: { zuvor },
  });
  expect(res.statusCode).toBe(200);
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montieren(koId: string, mindestlesezeitMs?: number): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wurzel = root;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          null,
          createElement(Wissensempfehlung, {
            koId,
            ...(mindestlesezeitMs === undefined ? {} : { mindestlesezeitMs }),
          }),
        ),
      ),
    );
  });
  await act(flush);
  return container;
}

async function abbauen(): Promise<void> {
  if (root) {
    const wurzel = root;
    await act(async () => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.sessionStorage.clear();
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@empfehlung.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@empfehlung.test");
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

describe("F1 · die verwandten Einträge stehen mit ihrem Grund da", () => {
  it("Konflikt, zusammen gelesen und gemeinsame Schlagwörter — je Eintrag sichtbar und öffnenbar", async () => {
    const expertin = await konto("experte", "erika@empfehlung.test");
    const controllerin = await konto("controller", "clara@empfehlung.test");
    const a = await eintrag("Kaltstart mit Vorwärmung", ["kaltstart"]);
    await eintrag("Kaltstart ohne Vorwärmung", ["kaltstart"]);
    const konflikt = await eintrag("Vorwärmung ist überflüssig", ["heizung"]);
    const gelesen = await eintrag("Ölwechsel im Winter", ["oel"]);
    await services.conflicts.create(
      { koA: a, koB: konflikt, type: "truth", description: "Widerspruch" },
      "admin",
    );
    for (const token of [adminToken, expertin, controllerin]) {
      await mitgelesenVon(token, gelesen, a);
    }

    flaechenToken = expertin;
    const wo = await montieren(a);
    const t = i18n.getFixedT("de");
    const flaeche = wo.querySelector('[data-testid="wissensempfehlung"]');
    expect(flaeche, "die Empfehlung steht in der Fläche").not.toBeNull();
    expect(flaeche?.textContent).toContain("Du solltest auch wissen…");
    const zeilen = [...wo.querySelectorAll('[data-testid="wissensempfehlung-eintrag"]')];
    expect(zeilen.map((z) => z.querySelector("span")?.textContent)).toEqual([
      "Vorwärmung ist überflüssig",
      "Ölwechsel im Winter",
      "Kaltstart ohne Vorwärmung",
    ]);
    expect(zeilen[0]?.textContent).toContain(t("wissensempfehlung.grund.konfliktOffen"));
    expect(zeilen[1]?.textContent).toContain("3-mal zusammen mit diesem Eintrag gelesen");
    expect(zeilen[2]?.textContent).toContain("Gemeinsame Schlagwörter: kaltstart");
    expect(zeilen[0]?.querySelector("a")?.getAttribute("href")).toBe(`/wissen/${konflikt}`);
    // Weil „zusammen gelesen" vorkommt, sagt die Fläche, dass nur das Paar gezählt wird.
    expect(wo.querySelector('[data-testid="wissensempfehlung-datenschutz"]')?.textContent).toBe(
      t("wissensempfehlung.datenschutz"),
    );
  });
});

describe("F2 · ohne Empfehlung keine Fläche", () => {
  it("ein Eintrag ohne Bezug zeichnet nichts — und sagt auch keinen Fehlersatz", async () => {
    flaechenToken = await konto("experte", "erika@empfehlung.test");
    const allein = await eintrag("Einzelstück", ["einzel"]);
    const wo = await montieren(allein);
    expect(aufrufe.some((a) => a.url === `/api/kos/${allein}/empfehlungen`)).toBe(true);
    expect(wo.querySelector('[data-testid="wissensempfehlung"]')).toBeNull();
    expect(wo.textContent).toBe("");
  });

  it("ein unbekannter Eintrag (404) zeichnet ebenfalls nichts", async () => {
    flaechenToken = await konto("experte", "erika@empfehlung.test");
    const wo = await montieren("gibt-es-nicht");
    expect(wo.textContent).toBe("");
  });
});

describe("F3 · lesen meldet das Paar, anzeigen allein nicht", () => {
  it("A gelesen, dann B gelesen → ein POST mit zuvor A; vor der Mindestlesezeit kein POST", async () => {
    flaechenToken = await konto("experte", "erika@empfehlung.test");
    const a = await eintrag("Anlage A", ["a"]);
    const b = await eintrag("Anlage B", ["b"]);

    // Mit der echten Vorgabe (8 s) meldet das kurze Anzeigen nichts.
    await montieren(a);
    await abbauen();
    await montieren(b);
    await abbauen();
    expect(aufrufe.filter((x) => x.methode === "POST")).toEqual([]);

    // Gelesen (Mindestlesezeit im Prüfstand 0): A, dann B.
    await montieren(a, 0);
    await act(flush);
    await abbauen();
    await montieren(b, 0);
    await act(flush);
    await abbauen();
    const posts = aufrufe.filter((x) => x.methode === "POST");
    expect(posts.map((p) => p.url)).toEqual([`/api/kos/${b}/mitgelesen`]);
    expect(JSON.parse(posts[0]?.body ?? "{}")).toEqual({ zuvor: a });
  });
});
