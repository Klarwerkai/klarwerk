// @vitest-environment jsdom
// ================================================================================================
// JOB 3921 — DIE NAHT ZWISCHEN DEM SATZ DES SERVERS UND DEM SATZ AUF DEM BLATT.
// ================================================================================================
//
// WER ES BESTELLT HAT: BEN, JOB 3851 R2, Prüfpunkt 6 (GESAMTURTEIL GRÜN, nicht blockierend) —
// „Die Attrappe wirft bei Fremdkennungen, prüft aber keinen echten HTTP-404-Vertrag. Folgeprüfung:
// unbekannte Kennung über den echten Server abrufen und die angezeigte Fehlermeldung prüfen."
// Dazu seine PROMPTVERBESSERUNG: „fehlende sowie fremde Abrufe müssen ausdrücklich scheitern."
//
// WARUM DER SATZ ÜBERHAUPT VOM SERVER KOMMT — nachgelesen, nicht angenommen:
//   `apps/web/src/components/erfassen/Blatt.tsx:219-224` (`ladeFehlerMeldung`)
//       `return err.code === "TIMEOUT" && err.status === 408 ? rueckfall : err.message;`  (`:221`)
//   Ein `ApiError`, der KEIN Client-Zeitlimit ist, reicht also `err.message` UNVERÄNDERT durch, und
//   `err.message` ist wörtlich das, was der Server in `{error, message}` geschickt hat
//   (`apps/web/src/api/client.ts:37-43`). Was ein Mensch nach einem gescheiterten „Fortsetzen"
//   liest, steht damit in `services/app/src/routes/capture-routes.ts` — in zwei Zeilen:
//       `:117`  404 · `{ error: "NOT_FOUND",  message: "Entwurf nicht gefunden." }`
//       `:121`  403 · `{ error: "FORBIDDEN",  message: "Entwurf nicht verfuegbar." }`
//   beide aus `requireVisibleDraft` (`:109-125`), gerufen von `GET /api/drafts/:id` (`:1138-1143`).
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST — jede Stelle vor dem Schreiben geöffnet:
//   1. `tests/capture/frontdoor-draft-deeplink-mounted.test.tsx:142-148` misst den angezeigten Satz
//      — und tippt ihn selbst: `getMock.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Entwurf
//      nicht gefunden oder nicht sichtbar."))`, danach
//      `expect(container.textContent).toContain(<derselbe Satz>)`. Der Satz wird gegen sich selbst
//      geprüft; der Server hat ihn nie gesendet (`:117` sagt vier Wörter weniger). Der Bestandstest
//      ist in seiner Rolle NICHT falsch — er misst die Fläche gegen seine eigene Attrappe. Falsch
//      war nur, dass niemand seinen Satz gegen den Server hielt (Fall E1).
//   2. `tests/app/ka8-naechster-schritt-bestandsroute.test.ts:235-242` und `:202-212` messen die
//      andere Hälfte am echten Draht — aber nur `statusCode` und `error`. `message` liest dort
//      niemand.
//   3. `tests/seitenhilfe-luecken/erster-weg-hat-seitenhilfe.test.tsx:103-111` wirft für eine
//      falsche Kennung ein schlichtes `new Error(…)`. Das ist KEIN `ApiError` — die Fläche nimmt
//      damit `Blatt.tsx:223`, den übersetzten Rückfall. Gemessen war also ausgerechnet der Zweig,
//      den die Wirklichkeit nicht nimmt.
//
// WAS ES ENTGEGEN DER AUFTRAGSLAGE SCHON GAB — gemessen in der Gegenprobe V1 dieses Jobs, nicht
// angenommen: `tests/capture/job2690-entwurf-gestaltpruefung.test.tsx:381` (Fall F5) hält
// „Entwurf nicht gefunden." am ECHTEN Draht auf der Fläche fest; die Verstellung von
// `capture-routes.ts:117` macht ihn rot. Der Auftrag hat das nicht gesehen („zwischen `:117` und
// dem, was ein Mensch liest, steht keine einzige Messung" — das stimmt so nicht). WAS DIESE DATEI
// trotzdem und ausschliesslich hinzufügt, ist ebenfalls gemessen (V1/V3):
//   · F5 misst den SPEICHERN-Weg (`PUT /api/drafts/:id` nach dem Löschen), nicht das FORTSETZEN
//     (`GET /api/drafts/:id` → `ladeFehlerMeldung` → Lagezeile bzw. Toast). Das ist der Weg, den
//     die Seitenhilfe von `/entwuerfe` verspricht.
//   · F5 kennt den 403-Satz gar nicht: die Verstellung von `capture-routes.ts:121` lässt ihn grün
//     (V3) und rötet allein A2, C2 und D1 dieser Datei.
//   · F5 TIPPT seinen Satz (`const servermeldung = "Entwurf nicht gefunden."`) und liest die
//     `message` des Drahtes nirgends gegen ihn — die NAHT aus D1 gibt es dort nicht.
//
// WAS DIESE DATEI TUT, UND IN WELCHER TEILUNG:
//   A · der Satz am ECHTEN Draht (`buildApp(buildServices())`, `app.inject`) — Status, Kennung und
//       Wortlaut werden ALLE DREI gelesen.
//   B · derselbe Abruf auf Englisch und Niederländisch — die Sprachfrage wird gemessen, nicht
//       behauptet.
//   C · was ein Mensch liest, wenn genau diese Antwort ankommt — an der ECHTEN Kette: echte
//       Oberfläche, echter Client, echte Fastify-Anwendung (`fetch → app.inject`, dieselbe Brücke
//       wie `tests/capture/mega23-vordertuer-vorgang-mounted.test.tsx:98-129`).
//   D · DIE NAHT: der am Server gemessene Satz und der auf dem Blatt gemessene Satz, gegeneinander.
//   E · der zweite, hand getippte Satz — als Befund benannt, aus der Bestandsdatei GELESEN.
//
// WARUM DIE ECHTE BRÜCKE UND NICHT EINE ABGEWIESENE ATTRAPPE: Der Auftrag sah für C ein
// `endpoints.drafts.get`-Mock vor, das mit einem aus der Messung GEBAUTEN `ApiError` ablehnt. Das
// wäre um eine Station kürzer — und genau die Station, an der `client.ts:37-43` aus dem HTTP-Rumpf
// den `ApiError` macht, bliebe ungemessen. Diese Datei nimmt deshalb den Weg, den JOB 3876 R1
// ausdrücklich als den besseren abgenommen hat („am ECHTEN Client gemessen, nicht an der ersetzten
// Attrappe"): die Fläche spricht über den echten Client in dieselbe Anwendung, an der A gemessen
// hat. Getippt wird der Wortlaut damit an GENAU EINER Stelle im ganzen Ordner — in `ERWARTET`.
//
// UND DIE ARBEITSTEILUNG ZWISCHEN DEN BEIDEN ZUSICHERUNGEN IST ABSICHT (Fall D1):
//   · „Blatt == Server"  ist die NAHT: Messung gegen Messung, keine Zeichenkette. Sie fällt, wenn
//     die Fläche aufhört, den Serversatz durchzureichen (`Blatt.tsx:221`).
//   · „Server == ERWARTET" ist der WORTLAUT-PIN. Er fällt, wenn `capture-routes.ts:117`/`:121` den
//     Satz ändert — und nennt in der roten Meldung beide Sätze nebeneinander.
// Eine Naht ohne Pin wäre eine Tautologie (beide Enden zögen mit), ein Pin ohne Naht wäre der
// dritte getippte Satz, den BEN beanstandet hat. Es braucht beide.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ================================================================================================
// DIE BRÜCKE — dieselbe Bauform wie mega23, hier um ein HALTESIGNAL erweitert.
// ================================================================================================
// `halteFuer`/`freigabe` halten EINE Antwort an, bis der Fall sie ausdrücklich freigibt. Sie sind
// der Grund, warum der Ladezustand aus §9 („solange der Abruf läuft, steht KEINE Fehlermeldung da")
// ohne jede Wartefrist messbar ist: es wird nicht auf eine Uhr gewartet, sondern auf einen
// Handgriff des Falls (C3).
const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<InjectAntwort> },
  token: "",
  halteFuer: null as string | null,
  freigabe: null as (() => void) | null,
}));

interface InjectAntwort {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt — wörtlich wie in
// `mega23-vordertuer-vorgang-mounted.test.tsx:47-67`. Alles am Entwurfsweg (`drafts.get`) bleibt das
// ECHTE Modul und läuft über den echten Client in den echten Server; ein Ersatz genau dort wäre das
// Gegenteil dessen, was diese Datei misst.
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({
          active: false,
          mode: "off",
          reachable: "unknown",
          tasks: { structure: false, extract: false },
        })),
        config: vi.fn(async () => null),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
// Der ECHTE Toast-Auslass der Hülle (`shell/ToastViewport.tsx`), nicht ein Ersatz: der Fremdkennungs-
// Zweig von `Blatt.tsx:969-972` meldet über einen Toast, und ohne diesen Auslass stünde sein Satz
// nirgends im DOM — C4 wäre dann grün, ohne irgendetwas gesehen zu haben.
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
// `ToastContext.tsx:36` zieht die Toast-Kennung aus `crypto.randomUUID`; jsdom bringt die Funktion
// nicht mit, und ohne sie stürbe der Fremdkennungs-Zweig genau in der Zeile, die C4 misst. Derselbe
// Behelf steht seit langem im Haus (`tests/m5c-ui-bildunterschriften/quittung-bilanz-mounted.test.tsx:118`).
if (typeof (globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID !== "function") {
  let n = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  });
}

// ================================================================================================
// DER ERWARTUNGSWERT — AUSGESCHRIEBEN, UND GENAU EINMAL IM GANZEN ORDNER.
// ================================================================================================
// Er steht hier, damit die rote Meldung bei einer Änderung an `capture-routes.ts` den Unterschied
// NENNT statt nur „erwartet true". Jede andere Stelle dieser Datei arbeitet mit dem GEMESSENEN Wert.
const ERWARTET = {
  unbekannt: "Entwurf nicht gefunden.",
  fremd: "Entwurf nicht verfuegbar.",
} as const;

const PASSWORT = "geheim12345";
/** Eine Kennung, die es nicht gibt — der Fall „der Link ist alt, der Entwurf gelöscht". */
const UNBEKANNT = "diese-entwurfskennung-gibt-es-nicht";

interface Antwort {
  status: number;
  code: string;
  message: string;
}

interface Messung {
  /** Der Entwurf der Eignerin — lebend, vollständig, und für die zweite Expertin fremd. */
  eigeneKennung: string;
  tokenEignerin: string;
  tokenFremde: string;
  unbekannt: Antwort;
  fremd: Antwort;
  /** Derselbe Abruf mit `accept-language` — je Sprache der WORTLAUT, den der Server schickt. */
  sprachen: { unbekannt: Record<string, string>; fremd: Record<string, string> };
}

/**
 * Ein Feld der Antwort, OHNE es zu beschönigen: fehlt es oder ist es kein String, steht das im Wert
 * und fällt in der Zusicherung auf. `String(undefined)` ergäbe „undefined" und sähe aus wie eine
 * Messung.
 */
function feld(rumpf: Record<string, unknown>, name: string): string {
  const wert = rumpf[name];
  return typeof wert === "string" ? wert : `KEIN STRING (${JSON.stringify(wert)})`;
}

async function anmelden(email: string): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return (JSON.parse(res.body) as { token: string }).token;
}

async function abrufen(token: string, id: string, sprache?: string): Promise<Antwort> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: {
      authorization: `Bearer ${token}`,
      ...(sprache === undefined ? {} : { "accept-language": sprache }),
    },
  });
  const rumpf = JSON.parse(res.body) as Record<string, unknown>;
  return { status: res.statusCode, code: feld(rumpf, "error"), message: feld(rumpf, "message") };
}

/**
 * DER ECHTE AUFBAU, EINMAL FÜR DIE GANZE DATEI — und zwar ausdrücklich derselbe für A und für C:
 * die Fläche in C spricht über die Brücke in GENAU DIE Anwendung, an der A gemessen hat. Zwei
 * Aufbauten wären zwei Server, und die Naht in D verglichen zwei Sätze, die nie zusammengehört
 * haben.
 *
 * Das Muster stammt aus `tests/app/ka8-naechster-schritt-bestandsroute.test.ts:56-88`: registrieren,
 * über die Verwaltung zwei Expertinnen anlegen (beide mit `ko.create`, nur eine legt den Entwurf
 * an — `canSeeDraft`, `capture-routes.ts:41-43`, trennt nach EIGENTUM, nicht nach Recht).
 */
let messungCache: Promise<Messung> | null = null;

async function messen(): Promise<Messung> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Verwaltung", email: "verwaltung@3921.test", password: PASSWORT },
  });
  const admin = await anmelden("verwaltung@3921.test");
  for (const email of ["eignerin@3921.test", "fremde@3921.test"]) {
    const res = await bruecke.app.inject({
      method: "POST",
      url: "/api/users",
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: email, email, password: PASSWORT, role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const tokenEignerin = await anmelden("eignerin@3921.test");
  const tokenFremde = await anmelden("fremde@3921.test");

  const angelegt = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${tokenEignerin}` },
    payload: {
      title: "Ventilwartung Nordstrang",
      statement: "Vor jedem Anlauf die Schmierstellen pruefen.",
      type: "best_practice",
      category: "Fertigung",
      // JOB 3082 (Q3 a): „vollstaendig" heisst seither AUCH: die Stufe ist ausdrücklich gewählt.
      confidentiality: "intern",
      bodyHtml: "<p>Kesselhaus Nordstrang Schmierstellenliste 3921</p>",
    },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Entwurf nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  const eigeneKennung = (JSON.parse(angelegt.body) as { id: string }).id;

  const sprachen = { unbekannt: {}, fremd: {} } as Messung["sprachen"];
  for (const sprache of ["en", "nl"]) {
    sprachen.unbekannt[sprache] = (await abrufen(tokenEignerin, UNBEKANNT, sprache)).message;
    sprachen.fremd[sprache] = (await abrufen(tokenFremde, eigeneKennung, sprache)).message;
  }

  return {
    eigeneKennung,
    tokenEignerin,
    tokenFremde,
    unbekannt: await abrufen(tokenEignerin, UNBEKANNT),
    fremd: await abrufen(tokenFremde, eigeneKennung),
    sprachen,
  };
}

function messung(): Promise<Messung> {
  messungCache ??= messen();
  return messungCache;
}

// ================================================================================================
// DIE MONTAGE — echte Hülle, echter Client, echter Server.
// ================================================================================================
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let adresse = "";
let gehe: ((ziel: string) => void) | null = null;

/**
 * Kein Wartezimmer, sondern ein Durchlauf der Aufgabenschlange: vierzig Makrotask-Übergaben ohne
 * jede Frist, wörtlich wie `mega23-vordertuer-vorgang-mounted.test.tsx:92-96`. Eine echte
 * Wartefrist steht nirgends in dieser Datei — der Ladezustand in C3 wird über das Haltesignal der
 * Brücke gemessen, nicht über eine Uhr.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Liest Ort und Abfrage aus dem Router selbst — C4 misst den Rücksprung der Adresse daran. */
function Adressfuehler(): null {
  const ort = useLocation();
  const navigate = useNavigate();
  adresse = `${ort.pathname}${ort.search}`;
  gehe = (ziel) => navigate(ziel);
  return null;
}

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    if (bruecke.halteFuer !== null && url.includes(bruecke.halteFuer)) {
      await new Promise<void>((r) => {
        bruecke.freigabe = r;
      });
    }
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
      ...(init.body === undefined ? {} : { payload: init.body }),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: [url] },
                    createElement(Adressfuehler),
                    createElement(ToastViewport),
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement("div", null),
                      }),
                    ),
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

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

/**
 * DER SATZ AUF DEM BLATT — die Lagezeile (`Blatt.tsx:3227-3255`, `data-testid="blatt-lage"`), und
 * zwar ihr ERSTER Textknoten. Der ganze `textContent` trüge auch die Beschriftung des
 * Wiederhol-Knopfes (`:3245-3254`); ein `toContain` darüber wäre milder, aber die Naht in D braucht
 * ZEICHENGLEICHHEIT, und die gibt es nur am Knoten selbst.
 */
function satzAufDemBlatt(): string {
  const lage = container.querySelector('[data-testid="blatt-lage"]');
  if (lage === null) {
    throw new Error(
      `Keine Lagezeile auf dem Blatt. Sichtbar: ${(container.textContent ?? "").replace(/\s+/g, " ").slice(0, 400)}`,
    );
  }
  const erster = lage.childNodes[0];
  if (erster === undefined || erster.nodeType !== 3) {
    throw new Error(
      `Die Lagezeile beginnt nicht mit Text, sondern mit ${erster?.nodeName ?? "nichts"}: ${lage.textContent ?? ""}`,
    );
  }
  return erster.textContent ?? "";
}

/** Der Weg eines Menschen, in einem Griff: anmelden als …, „Fortsetzen" auf … — was steht da? */
async function blattSatzFuer(token: string, kennung: string): Promise<string> {
  bruecke.token = token;
  await mount(`/capture/frontdoor?draft=${kennung}`);
  try {
    return satzAufDemBlatt();
  } finally {
    unmount();
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  await messung();
  brueckeAufbauen();
  bruecke.halteFuer = null;
  bruecke.freigabe = null;
  adresse = "";
  gehe = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ================================================================================================
// A · DER GEMESSENE SERVERSATZ — am echten Draht, nicht getippt.
// ================================================================================================
describe("JOB 3921 A · was der Server auf eine unbekannte und auf eine fremde Kennung wirklich sagt", () => {
  it("A1 · unbekannte Kennung: Status, Kennung UND Wortlaut — alle drei gelesen", async () => {
    const m = await messung();
    // Alle drei in EINER Zusicherung, damit die rote Meldung den ganzen Istwert nennt und nicht nur
    // das erste Feld, das kippt.
    expect(
      `${m.unbekannt.status} · ${m.unbekannt.code} · ${m.unbekannt.message}`,
      "Der Wortlaut steht in capture-routes.ts:117; weicht er ab, gilt die MESSUNG — dann wird dieser Fall auf den gemessenen Satz gesetzt und die Abweichung gemeldet.",
    ).toBe(`404 · NOT_FOUND · ${ERWARTET.unbekannt}`);
  });

  it("A2 · fremde Kennung, zweite Expertin mit demselben Recht: 403 mit EIGENEM Wortlaut", async () => {
    // `canSeeDraft` (`capture-routes.ts:41-43`) trennt nach EIGENTUM, nicht nach Recht: beide tragen
    // `ko.create`, nur eine hat den Entwurf angelegt.
    const m = await messung();
    expect(
      `${m.fremd.status} · ${m.fremd.code} · ${m.fremd.message}`,
      "Der Wortlaut steht in capture-routes.ts:121 — auch die ASCII-Schreibweise „verfuegbar“ ist Istwert und wird hier nur festgehalten, nicht bewertet.",
    ).toBe(`403 · FORBIDDEN · ${ERWARTET.fremd}`);
  });

  it("A3 · es sind ZWEI Sätze und nicht einer doppelt — und keiner von beiden ist leer", async () => {
    // Ohne diesen Fall wäre eine Route, die beide Lagen mit demselben Satz beantwortet, unbemerkt;
    // und ein leerer Satz (§9: „erfolgreich leer" gibt es hier nicht, ein 404 ist ein FEHLER) wäre
    // genau die stille Lüge, gegen die JOB 3851 gebaut wurde.
    const m = await messung();
    expect(m.unbekannt.message).not.toBe(m.fremd.message);
    expect(m.unbekannt.message.trim().length).toBeGreaterThan(0);
    expect(m.fremd.message.trim().length).toBeGreaterThan(0);
  });
});

// ================================================================================================
// B · DIE SPRACHFRAGE WIRD GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
// `apps/web/src/api/client.ts:23` setzt bei JEDEM Ruf einen `Accept-Language`-Kopf. Die Frage ist
// also nicht, ob der Server die Sprache ERFÄHRT, sondern ob er sie BENUTZT. Gemessen wird sie,
// nicht vermutet — und was dabei herauskommt, steht als Zusicherung fest.
describe("JOB 3921 B · derselbe Abruf auf Deutsch, Englisch und Niederländisch", () => {
  it("B1 · BEFUND: der Server antwortet in allen drei Sprachen mit DEMSELBEN deutschen Satz", async () => {
    // EIN BEFUND FÜR PEDI UND CODEX, KEIN AUFTRAG: Die Behebung gehört zur Q9-Kette
    // (`services/auth/src/meldungen.ts` und die Wächter darum) und ist hier ausdrücklich
    // ausgeschlossen. Was diese Datei leistet, ist, dass der Zustand ab jetzt DASTEHT: ein Server,
    // der eines Tages übersetzt, macht diesen Fall rot — und dann wird er auf die Übersetzung
    // gesetzt, statt dass die Fläche still einen deutschen Satz in eine englische Sitzung schreibt.
    const m = await messung();
    expect(
      `en=${m.sprachen.unbekannt.en} · nl=${m.sprachen.unbekannt.nl}`,
      "Wird dieser Fall rot, weil der Server jetzt übersetzt: gut — dann gehört er auf den neuen Wortlaut gesetzt (Q9-Kette, nicht dieser Auftrag).",
    ).toBe(`en=${m.unbekannt.message} · nl=${m.unbekannt.message}`);
    expect(`en=${m.sprachen.fremd.en} · nl=${m.sprachen.fremd.nl}`).toBe(
      `en=${m.fremd.message} · nl=${m.fremd.message}`,
    );
  });
});

// ================================================================================================
// C · WAS EIN MENSCH LIEST, WENN GENAU DIESE ANTWORT ANKOMMT.
// ================================================================================================
describe("JOB 3921 C · das Blatt zeigt den Satz des Servers", () => {
  it("C1 · unbekannte Kennung: auf dem Blatt steht der gemessene Serversatz, zeichengleich", async () => {
    const m = await messung();
    const satz = await blattSatzFuer(m.tokenEignerin, UNBEKANNT);
    // Die NAHT: gemessen gegen gemessen, keine Zeichenkette dazwischen.
    expect(satz).toBe(m.unbekannt.message);
    // DER WORTLAUT-PIN, derselbe Arbeitsteiler wie in D1 und aus derselben EINEN Konstante: die
    // Naht darüber zöge mit, wenn der Server morgen etwas anderes sagte — beide Enden bewegten sich
    // gemeinsam, und ein Mensch läse still einen anderen Satz. Erst diese Zeile macht das rot.
    expect(satz, "Der Satz auf dem Blatt hat sich geändert — s. capture-routes.ts:117.").toBe(
      ERWARTET.unbekannt,
    );
    // Und er ist nicht leer — ein leeres Blatt OHNE Satz wäre die stille Lüge aus §9.
    expect(satz.trim().length).toBeGreaterThan(0);
  });

  it("C2 · fremde Kennung: derselbe Weg, der ANDERE Satz — der 403 kommt durch, nicht der 404", async () => {
    const m = await messung();
    const satz = await blattSatzFuer(m.tokenFremde, m.eigeneKennung);
    expect(satz).toBe(m.fremd.message);
    expect(satz, "Der Satz auf dem Blatt hat sich geändert — s. capture-routes.ts:121.").toBe(
      ERWARTET.fremd,
    );
    // Ohne diese Zeile wäre ein Blatt, das jeden Ladefehler mit demselben Satz beantwortet, grün.
    expect(satz).not.toBe(m.unbekannt.message);
  });

  it("C3 · §9 laden: SOLANGE der Abruf läuft, steht keine Fehlermeldung da — erst danach", async () => {
    // Gemessen über das Haltesignal der Brücke, nicht über eine Frist: die Antwort steht still, bis
    // dieser Fall sie freigibt. `Blatt.tsx:892-893` setzt `letzteAktion: "laden"` und `setErr(null)`;
    // eine Meldung VOR der Antwort wäre eine Aussage ohne ihre Voraussetzung.
    const m = await messung();
    bruecke.token = m.tokenEignerin;
    bruecke.halteFuer = `/drafts/${UNBEKANNT}`;
    await mount(`/capture/frontdoor?draft=${UNBEKANNT}`);
    try {
      const freigabe = bruecke.freigabe;
      // Erst der Beleg, dass wirklich ein Abruf IN DER LUFT ist — sonst prüfte das Folgende einen
      // Zustand, der nur deshalb leer ist, weil nie jemand gefragt hat.
      expect(freigabe, "Der Entwurfsabruf ist gar nicht losgelaufen").not.toBeNull();
      expect(container.querySelector('[data-testid="blatt-lage"]')).toBeNull();
      expect(container.textContent ?? "").not.toContain(m.unbekannt.message);

      await act(async () => {
        freigabe?.();
        await flush();
      });
      expect(satzAufDemBlatt()).toBe(m.unbekannt.message);
    } finally {
      unmount();
    }
  });

  it("C4 · der ZWEITE Weg des Fehlers: eine abgewiesene Folgekennung reist als Toast, die Adresse springt zurück", async () => {
    // §9 unterscheidet zwei Wege, und sie dürfen nicht in EINEN `textContent`-Griff fallen:
    //   · eigene/erste Kennung  -> `setErr` (`Blatt.tsx:975`), Satz in der Lagezeile  (C1, C2)
    //   · eine Folgekennung, während schon ein Entwurf offen ist -> Toast + Rücksprung (`:969-972`)
    // Der zweite Weg trägt DENSELBEN gemessenen Serversatz — nur an einem anderen Ort.
    const m = await messung();
    bruecke.token = m.tokenEignerin;
    await mount(`/capture/frontdoor?draft=${m.eigeneKennung}`);
    try {
      const titelfeld = container.querySelector("input");
      expect(
        (titelfeld as HTMLInputElement | null)?.value,
        "Der eigene Entwurf ist gar nicht erst geladen — dann misst der Rest dieses Falls nichts",
      ).toBe("Ventilwartung Nordstrang");
      expect(container.querySelector('[data-testid="blatt-lage"]')).toBeNull();

      const navigieren = gehe;
      expect(navigieren).not.toBeNull();
      await act(async () => {
        navigieren?.(`/capture/frontdoor?draft=${UNBEKANNT}`);
        await flush();
      });

      // Der Satz steht im echten Toast-Auslass (`shell/ToastViewport.tsx:22-26`).
      const toast = container.querySelector("output span");
      expect(toast?.textContent, "Kein Toast mit dem Serversatz").toBe(m.unbekannt.message);
      // …und NICHT in der Lagezeile: `setErr` läuft in diesem Zweig ausdrücklich nicht.
      expect(container.querySelector('[data-testid="blatt-lage"]')).toBeNull();
      // Die Adresse ist beim eigenen Entwurf zurück (`Blatt.tsx:971`).
      expect(adresse).toBe(`/capture/frontdoor?draft=${m.eigeneKennung}`);
      // EHRLICH GEMESSEN, was §9 als „kein Rest des ersten Entwurfs" beschreibt: der eigene Entwurf
      // BLEIBT hier absichtlich stehen — das ist die Entscheidung aus JOB 2974 D3 („die eigene
      // bleibt aktiv, die Adresse wird zurückgesetzt"), festgehalten in `Blatt.tsx:966-972`.
      // Zurückgesetzt wird der BEFUND des vorigen Entwurfs (`:898`), nicht sein Inhalt.
      expect((container.querySelector("input") as HTMLInputElement | null)?.value).toBe(
        "Ventilwartung Nordstrang",
      );
    } finally {
      unmount();
    }
  });
});

// ================================================================================================
// D · DIE NAHT SELBST — als Zusicherung, nicht als Kommentar.
// ================================================================================================
describe("JOB 3921 D · der Satz des Servers und der Satz auf dem Blatt sind DIESELBE Zeichenkette", () => {
  it("D1 · beide Enden gemessen, beide Lagen zugleich — und der Wortlaut dazu gepinnt", async () => {
    const m = await messung();
    const aufDemBlatt404 = await blattSatzFuer(m.tokenEignerin, UNBEKANNT);
    const aufDemBlatt403 = await blattSatzFuer(m.tokenFremde, m.eigeneKennung);

    // ---- DIE NAHT: Messung gegen Messung. Rot, wenn die Fläche aufhört durchzureichen. ----------
    expect(
      `404→ ${aufDemBlatt404} | 403→ ${aufDemBlatt403}`,
      "Die Fläche reicht den Serversatz nicht mehr durch — s. `ladeFehlerMeldung`, Blatt.tsx:219-224.",
    ).toBe(`404→ ${m.unbekannt.message} | 403→ ${m.fremd.message}`);

    // ---- DER WORTLAUT-PIN: rot, wenn der Server etwas anderes sagt — mit beiden Sätzen. ---------
    expect(
      `der Server sagt: „${m.unbekannt.message}“ / „${m.fremd.message}“`,
      "capture-routes.ts:117 bzw. :121 hat den Satz geändert — das Blatt zeigt ihn seither ungeprüft.",
    ).toBe(`der Server sagt: „${ERWARTET.unbekannt}“ / „${ERWARTET.fremd}“`);
  });
});

// ================================================================================================
// E · DER ZWEITE, HAND GETIPPTE SATZ — als Befund benannt.
// ================================================================================================
const BESTANDSTEST = join(__dirname, "..", "capture", "frontdoor-draft-deeplink-mounted.test.tsx");

describe("JOB 3921 E · der Satz, den der Bestandstest tippt, ist nicht der Satz des Servers", () => {
  it("E1 · BEFUND: `frontdoor-draft-deeplink-mounted` prüft einen Satz, den der Server nie gesendet hat", async () => {
    // DER SATZ WIRD NICHT EIN ZWEITES MAL GETIPPT, sondern aus der Bestandsdatei GELESEN — sonst
    // stünde er zum dritten Mal im Haus, und genau das hat BEN beanstandet. Die Datei selbst bleibt
    // dabei zeichengleich (§10: nur lesen) und wird von diesem Fall NICHT rot gemacht: sie misst die
    // Fläche gegen ihre eigene Attrappe und ist in dieser Rolle richtig.
    const quelle = readFileSync(BESTANDSTEST, "utf8");
    const treffer = /new ApiError\(404, "NOT_FOUND", "([^"]+)"\)/.exec(quelle);
    expect(
      treffer,
      `In ${BESTANDSTEST} steht kein getippter 404-ApiError mehr — dieser Befundfall hat seinen Gegenstand verloren und gehört überprüft.`,
    ).not.toBeNull();
    const getippt = treffer?.[1] ?? "";

    const m = await messung();
    expect(
      `Bestandstest: „${getippt}“ ≠ Server: „${m.unbekannt.message}“`,
      "Ist dieser Fall rot, weil die beiden Sätze GLEICH geworden sind, ist der Befund behoben — dann gehört DIESER Fall gelöscht, nicht der Bestandstest geändert (Entscheidung für Pedi bzw. Codex, JOB 3921 §7).",
    ).not.toBe(`Bestandstest: „${getippt}“ ≠ Server: „${getippt}“`);
    // Und die Richtung des Befundes ausgeschrieben: der getippte Satz ist die LÄNGERE Behauptung.
    expect(getippt.length).toBeGreaterThan(m.unbekannt.message.length);
  });
});
