// @vitest-environment jsdom
// ================================================================================================
// KENNTNISNAHME · DIE FLÄCHE AM EINTRAG, GEGEN DIE ECHTE ANWENDUNG.
// ================================================================================================
//
// Die Fläche (`KenntnisnahmeBereich`) wird in jsdom montiert; ihr `fetch` geht über `app.inject`
// an die echte App (In-Memory-Ablage). Jeder Aufruf wird mitgeschrieben — damit ist messbar, dass
// das bloße Anzeigen KEINEN schreibenden Aufruf auslöst.
//
//   F1  (K2) Anzeigen schreibt nichts; erst der Klick bestätigt — ein Doppelklick schickt EINEN
//       Request (der Knopf ist gesperrt, solange er läuft).
//   F2  (K4) Nach neuer Anmeldung und neuem Aufbau steht die Bestätigung wieder da.
//   F3  (K1) Anfordern über die Fläche: Empfänger wählen, absenden, Übersicht zeigt Fassung V2;
//       ein Entwurf bietet kein Anfordern an.
//   F4  (K7) Das Ergebnis heisst Kenntnisnahme; kein Text behauptet Verständnis, Ausführung oder
//       Signatur — die Signatur kommt nur in der ausdrücklichen Verneinung vor.
//   F5  (K5) Ohne eigene Anforderung und ohne Zuweisungsrecht erscheint nichts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { KenntnisnahmeBereich } from "../../apps/web/src/components/kenntnisnahme/KenntnisnahmeBereich";
import i18n from "../../apps/web/src/i18n";
import texte from "../../apps/web/src/texte/kenntnisnahme";
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
let adminId = "";
let flaechenToken = "";
/** Jeder Aufruf der Fläche: Methode und Pfad. */
let aufrufe: Array<{ methode: string; url: string }> = [];
/** Solange gesetzt, wartet ein Bestätigen-Aufruf auf diese Freigabe. */
let bestaetigenSperre: Promise<void> | null = null;

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ methode, url });
    if (methode === "POST" && url.endsWith("/bestaetigen") && bestaetigenSperre) {
      await bestaetigenSperre;
    }
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
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
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

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

/** Ein Eintrag in Fassung V2 — gültig, oder als Entwurf. */
async function eintragV2(gueltig: boolean): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Absperrschieber vor Wartung schließen",
      statement: "Vor jeder Wartung den Absperrschieber schließen und sichern.",
      type: "best_practice",
      category: "Anlage Beispiel",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  await services.ko.revise(id, { statement: "Fassung 2: zusätzlich Schild anbringen." }, adminId);
  if (gueltig) {
    await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  }
  return id;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montieren(koId: string, darfAnfordern: boolean): Promise<HTMLDivElement> {
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
        createElement(KenntnisnahmeBereich, { koId, darfAnfordern }),
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

const knopf = (wo: HTMLElement, testId: string): HTMLButtonElement | null =>
  wo.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@kenntnisnahme-flaeche.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@kenntnisnahme-flaeche.test");
  adminId = (await services.auth.listUsers())[0]?.id ?? "";
  aufrufe = [];
  bestaetigenSperre = null;
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

describe("F1/F2 · anzeigen bestätigt nichts; der Klick bestätigt genau einmal und bleibt", () => {
  it("nur GET beim Anzeigen, ein POST trotz Doppelklick, Stand nach neuer Anmeldung", async () => {
    const clara = await konto("controller", "clara@kenntnisnahme-flaeche.test", "Clara Controller");
    const erik = await konto("experte", "erik@kenntnisnahme-flaeche.test", "Erik Experte");
    const id = await eintragV2(true);
    const anforderung = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/kenntnisnahmen`,
      headers: { authorization: `Bearer ${clara.token}` },
      payload: { fassung: 2, empfaenger: [erik.id] },
    });
    expect(anforderung.statusCode).toBe(201);

    flaechenToken = erik.token;
    const flaeche = await montieren(id, false);
    expect(flaeche.querySelector('[data-testid="kenntnisnahme-status"]')?.textContent).toBe(
      "Ausstehend",
    );
    const bestaetigen = knopf(flaeche, "kenntnisnahme-bestaetigen");
    expect(bestaetigen?.textContent).toBe("Ich habe Fassung V2 gelesen und nehme sie zur Kenntnis");
    expect(flaeche.textContent).toContain("Das Öffnen oder Lesen dieser Seite bestätigt nichts");
    // Anzeigen und Warten schreibt nichts.
    await act(flush);
    expect(aufrufe.filter((a) => a.methode !== "GET")).toEqual([]);
    const vorher = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/kenntnisnahmen`,
      headers: { authorization: `Bearer ${clara.token}` },
    });
    expect(JSON.stringify(vorher.json())).toContain('"status":"ausstehend"');

    // Doppelklick: zwei Klicks im selben Takt (ohne Neurendern dazwischen) schicken EINEN
    // Request; danach ist der Knopf gesperrt, und ein weiterer Klick trifft ins Leere.
    let freigeben: () => void = () => {};
    bestaetigenSperre = new Promise<void>((r) => {
      freigeben = r;
    });
    await act(async () => {
      bestaetigen?.click();
      bestaetigen?.click();
    });
    expect(knopf(flaeche, "kenntnisnahme-bestaetigen")?.disabled).toBe(true);
    await act(async () => {
      knopf(flaeche, "kenntnisnahme-bestaetigen")?.click();
    });
    await act(async () => {
      freigeben();
      await flush();
    });
    const schreibend = aufrufe.filter((a) => a.methode === "POST").map((a) => a.url);
    expect(schreibend).toHaveLength(1);
    expect(schreibend[0]).toMatch(/^\/api\/kenntnisnahmen\/[^/]+\/bestaetigen$/);
    expect(flaeche.querySelector('[data-testid="kenntnisnahme-bestaetigt"]')?.textContent).toMatch(
      /^Du hast Fassung V2 am .+ zur Kenntnis genommen\.$/,
    );
    expect(knopf(flaeche, "kenntnisnahme-bestaetigen")).toBeNull();

    // Neue Anmeldung, neuer Aufbau (leerer Zwischenspeicher): der Stand kommt vom Server.
    await abbauen();
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${erik.token}` },
    });
    flaechenToken = await anmelden("erik@kenntnisnahme-flaeche.test");
    const wieder = await montieren(id, false);
    expect(wieder.querySelector('[data-testid="kenntnisnahme-status"]')?.textContent).toBe(
      "Zur Kenntnis genommen",
    );
    expect(wieder.querySelector('[data-testid="kenntnisnahme-bestaetigt"]')).not.toBeNull();
    expect(knopf(wieder, "kenntnisnahme-bestaetigen")).toBeNull();
  });
});

describe("F3 · anfordern über die Fläche", () => {
  it("wählt Empfänger, fordert Fassung V2 an und zeigt die Übersicht", async () => {
    const clara = await konto("controller", "clara@kenntnisnahme-flaeche.test", "Clara Controller");
    await konto("experte", "erik@kenntnisnahme-flaeche.test", "Erik Experte");
    const id = await eintragV2(true);
    flaechenToken = clara.token;
    const flaeche = await montieren(id, true);
    expect(flaeche.textContent).toContain("Für diesen Eintrag wurde noch keine Kenntnisnahme");
    const auswahlfeld = '[data-testid="kenntnisnahme-empfaenger-wahl"]';
    const wahl = [...flaeche.querySelectorAll<HTMLInputElement>(auswahlfeld)];
    const erikWahl = wahl.find((w) => w.parentElement?.textContent?.includes("Erik Experte"));
    expect(erikWahl).toBeDefined();
    await act(async () => {
      erikWahl?.click();
    });
    const absenden = knopf(flaeche, "kenntnisnahme-anfordern-absenden");
    expect(absenden?.textContent).toBe("Kenntnisnahme von Fassung V2 anfordern");
    await act(async () => {
      absenden?.click();
      await flush();
    });
    await act(flush);
    const schreibend = aufrufe.filter((a) => a.methode === "POST").map((a) => a.url);
    expect(schreibend).toEqual([`/api/kos/${id}/kenntnisnahmen`]);
    expect(flaeche.querySelector('[data-testid="kenntnisnahme-angefordert"]')?.textContent).toBe(
      "Angefordert bei 1 Person(en).",
    );
    const zeile = flaeche.querySelector('[data-testid="kenntnisnahme-anforderung"]');
    expect(zeile?.textContent).toContain("Fassung V2 · angefordert von Clara Controller am");
    expect(zeile?.textContent).toContain("Ohne Frist");
    const empfaenger = flaeche.querySelector('[data-testid="kenntnisnahme-empfaenger"]');
    expect(empfaenger?.textContent).toContain("Erik Experte");
    expect(empfaenger?.textContent).toContain("Ausstehend");
  });

  it("an einem Entwurf gibt es kein Anfordern", async () => {
    const clara = await konto("controller", "clara@kenntnisnahme-flaeche.test", "Clara Controller");
    const id = await eintragV2(false);
    flaechenToken = clara.token;
    const flaeche = await montieren(id, true);
    expect(flaeche.querySelector('[data-testid="kenntnisnahme-entwurf"]')?.textContent).toContain(
      "Ein Entwurf wird nicht als Pflichtlektüre verschickt.",
    );
    expect(knopf(flaeche, "kenntnisnahme-anfordern-absenden")).toBeNull();
  });
});

describe("F4 · das Ergebnis heisst Kenntnisnahme — und behauptet nicht mehr", () => {
  const BEHAUPTUNG = new RegExp(
    [
      "unterschrieben",
      "unterzeichnet",
      "signiert",
      "\\bsigned\\b",
      "verstanden",
      "understood",
      "ausgeführt",
      "\\bexecuted\\b",
      "bestanden",
      "\\bpassed\\b",
    ].join("|"),
    "i",
  );

  it("kein Text der Kenntnisnahme behauptet Verständnis, Ausführung oder Unterschrift", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const [schluessel, wert] of Object.entries(texte[sprache])) {
        expect(BEHAUPTUNG.test(wert), `${sprache} ${schluessel}: ${wert}`).toBe(false);
        if (/signatur|signature|handtekening/i.test(wert)) {
          expect(schluessel, `${sprache}: Signatur nur in der Verneinung`).toBe(
            "kenntnisnahme.hinweis",
          );
        }
      }
    }
    expect(texte.de["kenntnisnahme.hinweis"]).toContain("keine elektronische Signatur");
    expect(texte.en["kenntnisnahme.hinweis"]).toContain("not an electronic signature");
    expect(texte.de["kenntnisnahme.status.bestaetigt"]).toBe("Zur Kenntnis genommen");
    expect(texte.en["kenntnisnahme.status.bestaetigt"]).toBe("Acknowledged");
  });

  it("die montierte Fläche nennt Kenntnisnahme und die Verneinung — in DE und EN", async () => {
    const clara = await konto("controller", "clara@kenntnisnahme-flaeche.test", "Clara Controller");
    const id = await eintragV2(true);
    flaechenToken = clara.token;
    const de = await montieren(id, true);
    expect(de.querySelector('[data-testid="kenntnisnahme-bereich"]')?.textContent).toContain(
      "Kenntnisnahme",
    );
    expect(de.textContent).toContain("Sie ist keine Freigabe des Inhalts");
    expect(de.textContent).toContain("kein Nachweis von Verständnis oder Ausführung");
    expect(de.textContent).toContain("keine elektronische Signatur.");
    expect(BEHAUPTUNG.test(de.textContent ?? "")).toBe(false);
    await abbauen();
    await i18n.changeLanguage("en");
    const en = await montieren(id, true);
    expect(en.textContent).toContain("Acknowledgement");
    expect(en.textContent).toContain("not an electronic signature");
    expect(BEHAUPTUNG.test(en.textContent ?? "")).toBe(false);
  });
});

describe("F5 · ohne eigene Anforderung und ohne Zuweisungsrecht erscheint nichts", () => {
  it("die Lesefläche bleibt für Unbeteiligte unverändert", async () => {
    const vera = await konto("viewer", "vera@kenntnisnahme-flaeche.test", "Vera Viewer");
    const id = await eintragV2(true);
    flaechenToken = vera.token;
    const flaeche = await montieren(id, false);
    expect(flaeche.querySelector('[data-testid="kenntnisnahme-bereich"]')).toBeNull();
    expect(aufrufe.map((a) => a.url)).toEqual(["/api/kenntnisnahmen/meine"]);
  });
});
