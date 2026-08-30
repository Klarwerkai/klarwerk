// @vitest-environment jsdom
// ================================================================================================
// JOB 2626 · D2 — DER BETRACHTER KOMMT BIS ZUM DIENST: von der echten Route bis zur gemounteten Ask-Flaeche.
// ================================================================================================
//
// PEDIS FRAGE: „Sagt Klara mir jetzt alle Gruende, warum sie eine Frage nicht beantwortet?"
//
// BEN an D1: „Die Abnahme gilt erst als belegt, wenn ein Test den realen Routen-Response bis zur
// gemounteten Ask-Flaeche beobachtet; ein direkt eingespeister oder gemockter `verschlossen`-Payload
// belegt nur den Renderer." Der D1-Flaechentest hat `endpoints.ask.ask` gemockt — hier nicht:
//
//   echte App (`buildApp`, echte Dienste, echter Bestand aus `services.ko`)
//     → echte Anmeldung (Bearer der echten Sitzung an der Transportbruecke)
//     → die ECHTE Ask-Seite, gemountet, tippt die Frage und sendet das Formular ab
//     → der ECHTE Client (`endpoints.ask.ask` → `api.post` → `fetch`) ruft POST /api/ask
//     → die ECHTE Route entscheidet (mit oder ohne Betrachter) und antwortet
//     → die Flaeche rendert, was sie bekam — gemessen als `textContent`.
//
// WAS ERSETZT IST, einzeln benannt: nur die Browserschale um `fetch` (Basisadresse und Sitzung:
// `fetch → app.inject`). Keine Antwort wird eingespeist, kein Endpunkt gemockt.
//
// DIE FAELLE:
//   R1 · Pedis Fall — ein Dokument mit DREI zuen Toren (nicht validiert, keine Stufe, kein Volltext),
//        Frage trifft es, keine Antwort → an der Flaeche stehen Titel UND alle drei Torwoerter.
//   G-a · genau EIN Tor zu (validiert, Stufe „intern", kein Volltext) → genau ein Torwort, nicht drei.
//   G-b · fehlender Betrachter — dieselbe Frage ohne Sitzung: die Route weist ab (401), die Flaeche
//        zeigt keine Torlage und stuerzt nicht; und am Endpunkt selbst: ohne Betrachter fehlt das Feld.
//   G-c · answered=true — die Frage IST der Titel, der Bestand traegt: Antwort sichtbar, keine Torlage.
//
// AUF EINEM STAND OHNE D1 (Dienst kennt `verschlossenSichtbarFuer` nicht, Flaeche kennt die Torlage
// nicht) ist R1 rot und G-a rot — genau die Wahrheit, die BEN sehen will, nicht ein gruener Renderer.
import { afterEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

type Services = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

const TITEL = "Turbinenwartung Kesselhaus";
const STATEMENT = "Zustaendigkeit liegt beim Schichtleiter.";
// Genau EIN gemeinsames Token mit dem Titel: Vorauswahl ja, Antwort nein (der Pedi-Fall, wie im D1-Vertragstest).
const FRAGE =
  "Welche Schutzausruestung ist bei der Turbinenwartung im Druckbehaelter vorgeschrieben?";

// ---- Die Transportbruecke: der echte Client spricht mit der echten App -------------------------
const bruecke = {
  app: null as unknown as App,
  token: "",
  requests: [] as { method: string; url: string; status: number; body: string }[],
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: {
      method?: string;
      body?: string;
      headers?: ConstructorParameters<typeof Headers>[0];
    } = {},
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: (init.method ?? "GET") as "GET",
      url: String(input),
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({
      method: init.method ?? "GET",
      url: String(input),
      status: res.statusCode,
      body: res.body,
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<{ services: Services; autorId: string }> {
  const services = buildServices();
  // DAS ZWEITE ERSETZTE TEIL, benannt: die Modell-VERFUEGBARKEITSANZEIGE. Ohne aktives Modell
  // graut die Ask-Seite den Fragen-Knopf hart aus (`aiAvailability.ts`, AI-STATE) — bei Pedi laeuft
  // ein Modell, im Tor keines. Ersetzt wird deshalb nur `publicStatus()` des ECHTEN Reasoner-Dienstes
  // (was GET /api/reasoner/status meldet); die Frage selbst geht durch den echten Ask-Dienst, der
  // hier deterministisch antwortet (KLARWERK_SKIP_KEYCHAIN) — kein Modell, kein Netz, kein Payload.
  (services.reasoner as unknown as { publicStatus: () => unknown }).publicStatus = () => ({
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { answer: true },
  });
  bruecke.app = buildApp(services);
  bruecke.token = "";
  bruecke.requests = [];
  brueckeAufbauen();
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2626.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2626.test", password: "geheim12345" },
  });
  bruecke.token = (login.json() as { token: string }).token;
  const me = await bruecke.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return { services, autorId: (me.json() as { id: string }).id };
}

/** Ein Dokument im echten Bestand — Tore nach Bedarf offen oder zu. */
async function dokument(
  services: Services,
  autorId: string,
  tore: { validiert?: boolean; stufe?: "intern" | "vertraulich"; volltext?: boolean } = {},
): Promise<string> {
  const ko = await services.ko.create({
    title: TITEL,
    statement: STATEMENT,
    type: "best_practice",
    category: "Wartung",
    author: autorId,
    ...(tore.volltext
      ? { bodyHtml: "<p>Der Pruefplan des Kesselhauses wird jaehrlich fortgeschrieben.</p>" }
      : {}),
  } as never);
  const id = (ko as { id: string }).id;
  if (tore.stufe) {
    await services.ko.setConfidentiality(id, tore.stufe, autorId);
  }
  if (tore.validiert) {
    await services.validation.adminValidate(id, autorId);
  }
  return id;
}

// ---- Die echte Ask-Seite -----------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function askMounten(): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    (root as ReturnType<typeof createRoot>).render(
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
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return container;
}

async function warteAufZustand(zustand: () => boolean, obergrenzeMs = 10_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    await act(flush);
    if (zustand()) return;
    if (Date.now() - start > obergrenzeMs) {
      const anfragen = bruecke.requests
        .map((r) => `${r.method} ${r.url} → ${r.status}`)
        .join(" | ");
      throw new Error(
        `Zustand nicht innerhalb von ${obergrenzeMs} ms erreicht. Anfragen: ${anfragen || "keine"}`,
      );
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Die Frage tippen und absenden — der Weg, den auch Pedi geht. */
async function fragen(c: HTMLDivElement, frage: string): Promise<void> {
  await warteAufZustand(() => c.querySelector("form input") !== null);
  const feld = c.querySelector("form input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(
      feld,
      frage,
    );
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  const vorher = bruecke.requests.filter((r) => r.url === "/api/ask").length;
  await act(async () => {
    (c.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  // Der echte Request ist gestellt und beantwortet, die Flaeche hat gerendert.
  await warteAufZustand(() => bruecke.requests.filter((r) => r.url === "/api/ask").length > vorher);
  await act(flush);
  await act(flush);
}

const TOR = {
  freigabe: (): string => i18n.t("ask.verschlossen.freigabe"),
  stufe: (): string => i18n.t("ask.verschlossen.stufe"),
  volltext: (): string => i18n.t("ask.verschlossen.volltext"),
};
const torlage = (c: HTMLElement): HTMLElement | null =>
  c.querySelector<HTMLElement>('[data-testid="ask-verschlossen"]');
const letzteAskAntwort = (): { status: number; body: Record<string, unknown> } => {
  const r = bruecke.requests.filter((x) => x.url === "/api/ask").at(-1);
  if (!r) throw new Error("kein /api/ask-Request beobachtet");
  return { status: r.status, body: r.body ? (JSON.parse(r.body) as Record<string, unknown>) : {} };
};

afterEach(() => {
  if (root) {
    act(() => (root as ReturnType<typeof createRoot>).unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

describe("JOB 2626 D2 · von der echten Route bis zur gemounteten Ask-Flaeche — kein eingespeister Payload", () => {
  it("R1 · Pedis Fall: ein Dokument mit DREI zuen Toren → die Flaeche zeigt Titel und ALLE drei Gruende, aus dem realen Routen-Response", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId);
    const c = await askMounten();
    await fragen(c, FRAGE);

    // Der reale Response, den die Flaeche bekam — beobachtet an der Bruecke, nicht eingespeist.
    const antwort = letzteAskAntwort();
    expect(antwort.status).toBe(200);
    expect(
      (antwort.body.result as { answered: boolean }).answered,
      "der Prueffall traegt nur als Nicht-Antwort",
    ).toBe(false);
    expect(
      antwort.body.verschlossen,
      "die Route hat die Torlage nicht geliefert — der Betrachter kam nicht bis zum Dienst",
    ).toBeDefined();

    // Die Flaeche, dort wo der Mensch liest.
    expect(c.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    const lage = torlage(c);
    expect(lage, "die Torlage fehlt in der Antwortflaeche").not.toBeNull();
    expect(lage?.closest('[data-testid="ask-result-anchor"]')).not.toBeNull();
    const text = lage?.textContent ?? "";
    expect(text).toContain(TITEL);
    expect(text, "Tor „Freigabe“ fehlt").toContain(TOR.freigabe());
    expect(text, "Tor „Stufe“ fehlt").toContain(TOR.stufe());
    expect(text, "Tor „Volltext“ fehlt").toContain(TOR.volltext());
    await bruecke.app.close();
  });

  it("G-a · GEGENPROBE: genau EIN Tor zu (validiert, Stufe intern, kein Volltext) → genau ein Grund, nicht drei", async () => {
    const { services, autorId } = await serverStarten();
    const id = await dokument(services, autorId, { validiert: true, stufe: "intern" });
    // Kalibrierung: die zwei offenen Tore sind wirklich offen — gemessen, nicht angenommen.
    const ko = (await services.ko.get(id)) as
      | { status?: string; confidentiality?: string }
      | undefined;
    expect(ko?.status).toBe("validiert");
    expect(ko?.confidentiality).toBe("intern");
    const c = await askMounten();
    await fragen(c, FRAGE);
    expect((letzteAskAntwort().body.result as { answered: boolean }).answered).toBe(false);
    const text = torlage(c)?.textContent ?? "";
    expect(text).toContain(TITEL);
    expect(text).toContain(TOR.volltext());
    expect(text, "ein Tor wurde genannt, das nicht zu ist").not.toContain(TOR.freigabe());
    expect(text, "ein Tor wurde genannt, das nicht zu ist").not.toContain(TOR.stufe());
    await bruecke.app.close();
  });

  it("G-b · GEGENPROBE fehlender Betrachter: ohne Sitzung weist die Route ab, die Flaeche zeigt keine Torlage und faellt nicht — und am Endpunkt ohne Betrachter fehlt das Feld ganz", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId);
    // 1. Die Flaeche ohne Sitzung: kein Bearer an der Bruecke.
    bruecke.token = "";
    const c = await askMounten();
    await fragen(c, FRAGE);
    expect(letzteAskAntwort().status).toBe(401);
    expect(torlage(c), "eine Torlage ohne Betrachter — erfunden").toBeNull();
    expect(c.textContent ?? "").not.toContain(TOR.freigabe());
    // 2. Der Dienst direkt, wie ihn ein Weg OHNE Betrachterfilter ruft: das Feld fehlt vollstaendig
    //    (mega77: schon der Feldname waere ein Ansatzpunkt) — die Verdrahtung greift nicht ins Leere.
    const ohne = (await services.ask.ask(FRAGE, autorId, "de")) as unknown as Record<
      string,
      unknown
    >;
    expect((ohne.result as { answered: boolean }).answered).toBe(false);
    expect("verschlossen" in ohne).toBe(false);
    await bruecke.app.close();
  });

  it("G-c · GEGENPROBE answered=true: die Frage IST der Titel, der Bestand traegt → Antwort sichtbar, keine Torlage — ueber den realen Response", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId);
    const c = await askMounten();
    await fragen(c, `${TITEL} Zustaendigkeit`);
    const antwort = letzteAskAntwort();
    expect(antwort.status).toBe(200);
    expect(
      (antwort.body.result as { answered: boolean }).answered,
      "der Prueffall traegt nur als Antwort",
    ).toBe(true);
    expect("verschlossen" in antwort.body, "die Torlage gehoert zur Nicht-Antwort").toBe(false);
    expect(c.textContent ?? "").not.toContain(i18n.t("ask.noBasisTitle"));
    expect(c.textContent ?? "").toContain(STATEMENT);
    expect(torlage(c)).toBeNull();
    await bruecke.app.close();
  });
});
