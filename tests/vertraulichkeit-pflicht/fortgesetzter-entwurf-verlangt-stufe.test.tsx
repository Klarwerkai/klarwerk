// @vitest-environment jsdom
// ================================================================================================
// JOB 3082 · Q3 (a) — DER FORTGESETZTE ENTWURF ERBT KEINE WAHL, DIE ES NIE GAB.
// ================================================================================================
//
// CODEX HAT ES AM LEBENDEN SYSTEM GEMESSEN (`gespraech/abnahme/befunde/
// R-1560-20260905T124811975092.json:24-27`), woertlich:
//
//   soll: „Vor Einreichen Vertraulichkeit ausdruecklich waehlen.“
//   ist:  „Keine Auswahl im ganzen Ablauf. Gespeicherter Entwurf ohne confidentiality. Fortsetzen
//          und Einreichen fuehrt zu POST promote, Erfolgszeile, KO offen; GET KO confidentiality
//          null."
//
// DIE URSACHE WAR EINE ZEILE. Beim Laden eines Entwurfs setzte `Blatt.tsx` die Wahl BEDINGUNGSLOS
// auf „getroffen“ — auch fuer eine Nutzlast, die gar kein Feld `confidentiality` trug. Auf einem
// frischen Blatt griff die Pflicht (dort ist sie offen), beim FORTSETZEN nie. Und das Menue zeigte
// zugleich „Oeffentlich-intern“ an, obwohl niemand das gewaehlt hatte: eine Vorbelegung, die wie
// eine Entscheidung aussieht, ist eine erfundene Einstufung.
//
// WAS HIER ECHT IST (Bauform woertlich aus `tests/capture/job2656-d4-einreichen-knopf-mounted.
// test.tsx`, dort ausfuehrlich begruendet):
//   * die echte Seite `pages/CaptureFrontDoor.tsx` (= das Blatt), gemountet, mit ihren Providern,
//   * der echte Einreichen-Knopf und der echte Clientweg `submitFrontDoorDraft`,
//   * die echte Fastify-Anwendung mit Routen, Rechten und Persistenz.
// Der EINZIGE Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject` (die Bahn-
// Sandbox laesst keinen Horchsocket zu, `listen EPERM`).
//
// DER ENDZUSTAND WIRD BEIM SERVER ERFRAGT (`GET /api/kos`) — nicht aus Aufrufen abgelesen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Jeder Request, den die OBERFLAECHE erzeugt hat — hier steht das Promote, das nicht sein darf. */
  requests: [] as { method: string; url: string; body: string }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Splitterschutzverriegelung vor Schichtbeginn";
const KOERPER = `<h2>${TITEL}</h2><p>Der Hebel wird vor jeder Schicht auf freien Lauf geprueft.</p>`;

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({ method: init.method ?? "GET", url, body: init.body ?? "" });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function serverStarten(): Promise<void> {
  const services = buildServices();
  bruecke.app = buildApp(services) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.requests = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3082.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3082.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Ein Entwurf ueber die ECHTE Route — mit oder ohne Stufe, genau wie im Befund. */
async function entwurfAnlegen(mitStufe?: "intern" | "vertraulich"): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}`, "content-type": "application/json" },
    payload: {
      title: TITEL,
      bodyHtml: KOERPER,
      origin: "word_addin",
      ...(mitStufe ? { confidentiality: mitStufe } : {}),
    },
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  const id = (JSON.parse(res.body) as { id: string }).id;
  // KALIBRIERUNG: der Entwurf traegt WIRKLICH (k)eine Stufe — sonst pruefte der Fall etwas anderes.
  const geladen = await bruecke.app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  const payload = (JSON.parse(geladen.body) as { payload: Record<string, unknown> }).payload;
  expect(
    Object.hasOwn(payload, "confidentiality"),
    `der angelegte Entwurf entspricht nicht dem Prueffall: ${geladen.body.slice(0, 300)}`,
  ).toBe(mitStufe !== undefined);
  return id;
}

/** Der PERSISTIERTE Endzustand — beim Server erfragt. */
async function bestand(): Promise<{ id: string; title: string }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function blattOeffnen(adresse: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
                createElement(
                  MemoryRouter,
                  { initialEntries: [adresse] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopfMitText(beschriftung: string): HTMLButtonElement {
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(beschriftung),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(
      `Knopf „${beschriftung}“ nicht gefunden. Sichtbar: ${seitentext().slice(0, 700)}`,
    );
  }
  return knopf;
}

/** Das Werkzeug „Vertraulichkeit“ der Werkzeugzeile — sein Wort IST die Auskunft. */
function vertraulichkeitsWerkzeug(): HTMLButtonElement {
  const knopf = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Vertraulichkeits-Werkzeug fehlt. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  return knopf;
}

function werkzeugWort(): string {
  return (vertraulichkeitsWerkzeug().textContent ?? "").replace(/\s+/g, " ").trim();
}

async function klick(knopf: HTMLButtonElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

/** Eine Stufe im Menue waehlen — der Weg, den ein Mensch geht. */
async function stufeWaehlen(stufe: "intern" | "vertraulich"): Promise<void> {
  await klick(vertraulichkeitsWerkzeug());
  const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
  if (!flaeche) {
    throw new Error(`Das Vertraulichkeits-Menue oeffnet nicht. ${seitentext().slice(0, 500)}`);
  }
  const beschriftung = i18n.t(`conf.level.${stufe}`);
  const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(beschriftung),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Eintrag „${beschriftung}“ fehlt im Menue.`);
  }
  await klick(eintrag);
}

function promoteAufrufe(): { method: string; url: string; body: string }[] {
  return bruecke.requests.filter((r) => r.url.includes("/promote"));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
});

describe("JOB 3082 · ohne gewaehlte Stufe kein Einreichen", () => {
  it("F1 — FORTGESETZTER ENTWURF OHNE STUFE: der Knopf loest kein Promote aus, die Wahl steht offen", async () => {
    const draftId = await entwurfAnlegen();
    await blattOeffnen(`/capture/frontdoor?draft=${draftId}`);

    // Vorbedingung: Der Text ist wirklich da — sonst scheiterte das Einreichen am Inhalt statt an
    // der Stufe, und der Fall waere aus dem falschen Grund gruen.
    expect(seitentext(), "der fortgesetzte Entwurf ist nicht geladen").toContain(
      "freien Lauf geprueft",
    );

    await klick(knopfMitText(i18n.t("erfassen.einreichen")));

    expect(
      promoteAufrufe(),
      `das Einreichen ging trotz uebersprungener Vertraulichkeitsfrage hinaus: ${JSON.stringify(promoteAufrufe().map((r) => r.url))}`,
    ).toHaveLength(0);
    expect(await bestand(), "es ist ein Wissensobjekt ohne Einstufung entstanden").toHaveLength(0);

    // DIE WAHL IST ALS OFFEN MARKIERT: das Werkzeug traegt das neutrale Wort (keine Stufe) und den
    // Pflichtrand aus §5.4 — der Mensch sieht, WO es haengt, ohne Erklaersatz.
    expect(
      werkzeugWort(),
      `das Werkzeug behauptet eine Stufe, die niemand gewaehlt hat: „${werkzeugWort()}“`,
    ).toContain(i18n.t("erfassen.werkzeug.vertraulichkeit"));
    expect(
      vertraulichkeitsWerkzeug().className,
      "die offene Pflichtwahl ist nach dem Klick nicht markiert",
    ).toContain("border-trust-crit-fill");
  });

  it("F2 — FORTGESETZTER ENTWURF MIT ausdruecklichem „intern“: das Einreichen laeuft durch", async () => {
    const draftId = await entwurfAnlegen("intern");
    await blattOeffnen(`/capture/frontdoor?draft=${draftId}`);

    // Die gespeicherte Wahl steht am Werkzeug — sie IST eine Entscheidung und wird angezeigt.
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));

    await klick(knopfMitText(i18n.t("erfassen.einreichen")));

    const kos = await bestand();
    expect(
      kos,
      `kein Wissensobjekt entstanden. Promote: ${JSON.stringify(promoteAufrufe().map((r) => r.url))}`,
    ).toHaveLength(1);
    expect(kos[0]?.title).toBe(TITEL);
    // Und die Stufe reist auf dem Draht mit — sonst waere sie beim Server nicht von „nie gewaehlt“
    // zu unterscheiden (die Client-Haelfte des Befunds).
    expect(
      promoteAufrufe()[0]?.body ?? "",
      "der Promote-Rumpf traegt die ausdrueckliche Stufe nicht",
    ).toContain('"confidentiality":"intern"');
  });

  it("F3 — FRISCHES BLATT: das Menue zeigt KEINE Stufe als gewaehlt", async () => {
    await blattOeffnen("/capture/frontdoor");

    expect(
      werkzeugWort(),
      `das leere Blatt behauptet eine Einstufung: „${werkzeugWort()}“`,
    ).toContain(i18n.t("erfassen.werkzeug.vertraulichkeit"));
    expect(werkzeugWort()).not.toContain(i18n.t("conf.level.intern"));

    // Auch IM Menue ist nichts als gewaehlt hervorgehoben (MenueEintrag: `gewaehlt` ⇒ fett).
    await klick(vertraulichkeitsWerkzeug());
    const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
    const hervorgehoben = [...(flaeche?.querySelectorAll("button") ?? [])].filter((b) =>
      b.className.includes("font-semibold"),
    );
    expect(
      hervorgehoben.map((b) => b.textContent),
      "das Menue zeigt eine Stufe als gewaehlt an, obwohl niemand gewaehlt hat",
    ).toEqual([]);
  });

  it("F4 — ENTWURF OHNE STUFE, im Blatt gewaehlt: danach laeuft das Einreichen durch", async () => {
    const draftId = await entwurfAnlegen();
    await blattOeffnen(`/capture/frontdoor?draft=${draftId}`);

    await stufeWaehlen("vertraulich");
    expect(werkzeugWort()).toContain(i18n.t("conf.level.vertraulich"));

    await klick(knopfMitText(i18n.t("erfassen.einreichen")));

    const kos = await bestand();
    expect(
      kos,
      `nach der ausdruecklichen Wahl entsteht kein Objekt. Promote: ${JSON.stringify(promoteAufrufe().map((r) => r.url))}`,
    ).toHaveLength(1);
    expect(promoteAufrufe()[0]?.body ?? "").toContain('"confidentiality":"vertraulich"');
  });
});
