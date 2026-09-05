// @vitest-environment jsdom
// ================================================================================================
// JOB 1044 / D4 — DIE WIRKUNGSKETTE, IN EINEM LAUF GEMESSEN, OHNE JEDEN NETZWEG.
// ================================================================================================
//
// BEN2 hat den D2-Wortlautvertrag PRODUKT-ROT gestellt, weil genau eine Zusage unbewiesen blieb:
//
//   Korrektur → Persistenz → Validation → Status/Trust → Provider-Auswahl → Wiretyp → Client
//   → sichtbare Folgeantwort
//
// D2 hat die Kette benannt und als `UNBEWIESENE HYPOTHESE` gekennzeichnet. Diese Datei ist der
// fehlende Beleg. Sie behauptet nichts über die Kette — sie FÄHRT sie.
//
// WAS HIER ECHT IST, und es ist bewusst alles bis auf den Draht:
//   · Persistenz/Validation/Ranking  echte Dienste aus `buildServices()`, echte Repos.
//   · HTTP                            echte Fastify-App aus `buildApp(services)`, echte Routen.
//   · Wiretyp                         die ROHEN Bytes, die über den Draht gehen, werden mitgeschnitten
//                                     und gegen den Clientvertrag `AskResponse` gehalten.
//   · Client                          das ECHTE Clientmodul (`endpoints`, `authApi` → `api` → `fetch`).
//   · Renderer                        die ECHTE Seite `pages/Ask.tsx` mit den ECHTEN Providern.
//
// DER EINZIGE ERSATZ IST DER TRANSPORT. `globalThis.fetch` wird auf `app.inject` gelegt — ein
// Draht plus Keksdose, mehr nicht. Er trifft keine fachliche Entscheidung, kennt weder Status noch
// Vertrauenswert und ersetzt kein Glied der Kette. Ein Test-Doppel der zu BEWEISENDEN Logik gibt es
// nirgends: weder Validation noch Ranking noch Reasoner noch Seite sind gemockt.
//
// WARUM EIN MODELL BESCHRIFTET IST, obwohl keines antwortet: Die Fragenfläche graut den
// Absendeknopf HART aus, solange für die Aufgabe „answer" kein Modell nutzbar ist (D-AISTATE
// PAKET 1). Ohne konfiguriertes Modell gäbe es also gar keine sichtbare Folgeantwort zu messen —
// die Kette risse an der Oberfläche, nicht an der Sache.
//
// D3 hat diese Stufe mit einem LOOPBACK-Endpunkt auf `127.0.0.1:1` beschaltet und sich darauf
// berufen, dass die Maschine dabei nicht verlassen wird. BEN2 hat das zu Recht zurückgewiesen:
// LOOPBACK IST EIN NETZWEG. Der Modellclient bindet seine Transportfunktion bereits bei der
// Erzeugung (`const fetchFn = config.fetchFn ?? fetch`), also noch bevor der Draht stand — und
// öffnete beim Antwortlauf einen echten Socket. Dass an Port 1 niemand horcht, machte den Aufruf
// nicht netzfrei; es machte ihn nur folgenlos.
//
// D4 nimmt den Netzweg heraus, ohne die Kette zu verkürzen: Die Modellstufe endet an einer
// IN-PROCESS-MODELLGRENZE (s. u.), die Antwort entsteht weiterhin über den DOKUMENTIERTEN
// deterministischen Rückfall der Providerkette (`Reasoner.runTask`). Kein Socket, kein Loopback,
// kein DNS, kein Modellinhalt wird erfunden. Belegt wird das nicht behauptet, sondern gemessen:
// eine Netzschranke protokolliert jeden Versuch auf beiden Achsen, Fall 0 kalibriert sie, und
// jeder Fall endet mit dem Nachweis, dass das Protokoll leer ist.
//
// DIE FÜNF FALLKLASSEN sind kausal getrennt: zwischen ihnen unterscheidet sich AUSSCHLIESSLICH die
// Bewertungslage. Frage, Wortlaut, Bestand und Code sind in allen Fällen identisch. Was sich am
// Bildschirm ändert, kann deshalb nur aus der Bewertung kommen.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Vor JEDEM Import der App: die Umgebung dieses Laufs. `buildServices()` liest sie beim Aufbau.
process.env.KLARWERK_SKIP_KEYCHAIN = "1"; // kein Keychain-Zugriff, kein Cloud-Modell
// Reservierte, nicht auflösbare Kennung (RFC 2606). Sie wird nie aufgelöst und nie gewählt: die
// Netzschranke fängt sie unterhalb ab. Sie ist eine BESCHRIFTUNG der Modellstufe, keine Adresse.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job1044-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

import { createRequire } from "node:module";
import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { authApi } from "../../apps/web/src/api/auth";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { AskResponse, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ================================================================================================
// DIE NETZSCHRANKE — Messinstrument und Sperre in einem.
// ================================================================================================
//
// Sie ist SCHÄRFER als `fetch` allein und steht bewusst FRÜH: Der Modellclient bindet seine
// Transportfunktion schon bei der Erzeugung (`const fetchFn = config.fetchFn ?? fetch`,
// `services/reasoner/src/model-client.ts`). Wer die Schranke erst nach `buildServices()` aufstellt,
// hält dem Client die ungebremste Originalfunktion in die Hand — genau das war der D3-Fehler.
//
// Zwei Achsen, damit ein Umgehen nicht unbemerkt bleibt:
//   Achse 1  `globalThis.fetch`  — der Weg des Clientmoduls UND des Modellclients.
//   Achse 2  `node:net`, `node:tls`, `node:http`, `node:https` — die Kernprimitive darunter.
//
// Die Schranke gehört dem WORKER, nicht dieser Datei: Vitest fährt mehrere Testdateien im selben
// Prozess. Deshalb wird sie in `beforeAll` aufgebaut und in `afterAll` VOLLSTÄNDIG zurückgenommen.
const netzversuche: string[] = [];
let drahtHandler: ((url: string, init?: RequestInit) => Promise<unknown>) | null = null;

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

// ------------------------------------------------------------------------------------------------
// DIE MODELLGRENZE. Die nichtfachliche Stufe endet HIER — im Prozess, ohne Socket.
// ------------------------------------------------------------------------------------------------
//
// Das Modell ist NICHT Gegenstand der zu beweisenden Kette; es muss nur so weit vorhanden sein,
// dass die Fragenfläche den Absendeknopf freigibt (`apps/web/src/lib/aiAvailability.ts:29-49`).
// Genau diese eine Stufe wird hier abgeschnitten: Der Aufruf wird im Prozess mit einem Fehler
// beantwortet, die Antwort entsteht über den dokumentierten deterministischen Rückfall der
// Providerkette (`Reasoner.runTask`, `services/reasoner/src/service.ts:597-663`) — derselbe Weg
// wie in D3, nur ohne den Netzweg dorthin. Die Grenze ist deshalb KEIN Netzversuch und wird nicht
// protokolliert; Fall 0 prüft beides getrennt nach.
const MODELL_BASIS = process.env.KLARWERK_LOCAL_LLM_URL ?? "";

const modellGrenze = (url: string): Promise<never> =>
  Promise.reject(
    new Error(
      `IN-PROCESS-MODELLGRENZE: ${url} wird nicht gewählt. Kein Modell antwortet in diesem Lauf; die Antwort entsteht über den deterministischen Rückfall der Providerkette.`,
    ),
  );

const PRIMITIVE: readonly (readonly [string, readonly string[]])[] = [
  ["node:net", ["connect", "createConnection"]],
  ["node:tls", ["connect"]],
  ["node:http", ["request", "get"]],
  ["node:https", ["request", "get"]],
];

const verlangen = createRequire(import.meta.url);
const zuruecknehmen: (() => void)[] = [];

function schrankeAufbauen(): void {
  const vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      if (MODELL_BASIS !== "" && url.startsWith(MODELL_BASIS)) {
        return modellGrenze(url);
      }
      netzversuche.push(`fetch ${url}`);
      throw new Error(`NETZSCHRANKE: fetch("${url}") — in diesem Lauf gibt es kein Netz.`);
    }
    if (!drahtHandler) {
      netzversuche.push(`fetch ohne Draht ${url}`);
      throw new Error(`NETZSCHRANKE: fetch("${url}") ohne aufgesetzten Draht.`);
    }
    return drahtHandler(url, init);
  }) as unknown as typeof globalThis.fetch;
  zuruecknehmen.push(() => {
    globalThis.fetch = vorherigerFetch;
  });

  for (const [modulname, namen] of PRIMITIVE) {
    const modul = verlangen(modulname) as Record<string, unknown>;
    for (const name of namen) {
      const vorher = modul[name];
      modul[name] = (...args: unknown[]): never => {
        netzversuche.push(`${modulname}.${name} ${JSON.stringify(args[0] ?? null)}`);
        throw new Error(`NETZSCHRANKE: ${modulname}.${name}() — in diesem Lauf gibt es kein Netz.`);
      };
      zuruecknehmen.push(() => {
        modul[name] = vorher;
      });
    }
  }
}

function schrankeAbbauen(): void {
  while (zuruecknehmen.length > 0) {
    zuruecknehmen.pop()?.();
  }
}

// ================================================================================================
// DER BESTAND. Zwei Quellen, die derselben Frage GLEICH NAHE stehen.
// ================================================================================================
//
// Beide tragen dieselben Fachwörter und damit dieselbe Keyword-Überschneidung; sie unterscheiden
// sich nur in der Zahl, die sie nennen. Damit ist die Relevanz zwischen den Fallklassen KONSTANT —
// wer von beiden die Antwort trägt, kann nur an Status und Vertrauenswert liegen. Genau das ist
// die Behauptung, die hier zur Prüfung steht.
const FRAGE = "Welcher Druck gilt bei der Ventilwartung vor der Pruefung?";
const BESTAND_AUSSAGE =
  "Bei der Ventilwartung gilt vor der Pruefung ein Druck von drei bar am Ventil.";
const KORREKTUR_AUSSAGE =
  "Bei der Ventilwartung gilt vor der Pruefung ein Druck von null bar am Ventil.";
// Zwei Titel, die sich NUR in einem Wort unterscheiden, das die Frage nicht enthält: die
// Überschneidung mit der Frage bleibt dadurch für beide Quellen gleich, aber die Oberfläche kann
// die beiden Objekte auseinanderhalten (die Beispiel-Chips schlüsseln nach Titel).
const BESTAND_TITEL = "Ventilwartung Druck vor der Pruefung Fassung Alt";
const KORREKTUR_TITEL = "Ventilwartung Druck vor der Pruefung Fassung Neu";
// Fachfremd, aber maximal bewertet — die Gegenprobe zu „Trust macht nicht sachlich passend".
const FREMDER_TITEL = "Kantinenplan Mittagessen";
const FREMDE_AUSSAGE = "Der Kantinenplan weist das Mittagessen und die Salatbar aus.";

const KENNWORT = "geheim12345";

interface Sitzung {
  readonly id: string;
  readonly token: string;
}

interface Aufbau {
  readonly app: FastifyInstance;
  readonly services: AppServices;
  readonly admin: Sitzung;
  readonly pruefer: readonly Sitzung[];
  readonly bestandId: string;
  readonly korrekturId: string;
  /** Setzt die Sitzung, in deren Namen der Browser-Client ab jetzt spricht. */
  anmeldenAls(s: Sitzung): void;
  /** Die ROHEN Bytes der letzten `/api/ask`-Antwort — der Wiretyp, ungefiltert. */
  letzterDraht(): { status: number; contentType: string; body: string } | null;
}

// ================================================================================================
// DER DRAHT. Ein Transport und eine Keksdose — sonst nichts.
// ================================================================================================
//
// Das Clientmodul ruft `fetch("/api/…", {credentials:"include"})`. Hier wird daraus ein
// `app.inject` gegen DIESELBE Fastify-Instanz. Das Sitzungs-Cookie wird gehalten und mitgeschickt,
// wie es ein Browser täte; `set-cookie` aus der Antwort wird übernommen. Der Adapter kennt keine
// Route, keinen Status und keinen Vertrauenswert.
function drahtAufsetzen(app: FastifyInstance): {
  anmeldenAls(s: Sitzung): void;
  letzterDraht(): { status: number; contentType: string; body: string } | null;
  abbauen(): void;
} {
  let cookie: string | null = null;
  let draht: { status: number; contentType: string; body: string } | null = null;

  // Der Draht ersetzt `globalThis.fetch` NICHT mehr selbst — er meldet sich bei der Netzschranke
  // an, die als einzige Instanz auf der Leitung sitzt. Sonst überschriebe der Draht die Schranke.
  drahtHandler = async (url: string, init?: RequestInit) => {
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    const gesetzt = antwort.headers["set-cookie"];
    const roh = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
    if (typeof roh === "string") {
      cookie = roh.split(";")[0] ?? cookie;
    }
    if (url.startsWith("/api/ask")) {
      draht = {
        status: antwort.statusCode,
        contentType: String(antwort.headers["content-type"] ?? ""),
        body: antwort.body,
      };
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  };

  return {
    anmeldenAls(s: Sitzung): void {
      cookie = `kw_session=${s.token}`;
    },
    letzterDraht: () => draht,
    abbauen(): void {
      drahtHandler = null;
    },
  };
}

let draht: ReturnType<typeof drahtAufsetzen> | null = null;

// Ein vollständiger, frischer Aufbau je Fallklasse — Bewertungen sammeln sich sonst über die
// Fälle hinweg an und die kausale Trennung ginge verloren.
async function aufbauen(): Promise<Aufbau> {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  draht = drahtAufsetzen(app);

  // Erstes Konto wird Admin (FR-AUTH-01) — echte Registrierung, echter Login über den Client.
  await authApi.register("Pedi", "pedi@klarwerk.test", KENNWORT);
  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: KENNWORT },
  });
  const adminBody = adminLogin.json() as { user: { id: string }; token: string };
  const admin: Sitzung = { id: adminBody.user.id, token: adminBody.token };
  draht.anmeldenAls(admin);

  // Fünf Prüferinnen mit `ko.validate` (Rolle controller), angelegt über die echte Adminroute.
  // Fünf, weil die Bestandsquelle zwei gelbe Stimmen bekommt (s. u.) und eine Bewertung je Person
  // genau einmal zählt — dieselbe Person zweimal zu fragen ändert nach `ratings.upsert` nichts.
  const pruefer: Sitzung[] = [];
  for (let i = 1; i <= 5; i++) {
    const email = `pruefer${i}@klarwerk.test`;
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie: `kw_session=${admin.token}` },
      payload: { name: `Pruefer ${i}`, email, password: KENNWORT, role: "controller" },
    });
    expect(angelegt.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    const body = login.json() as { user: { id: string }; token: string };
    pruefer.push({ id: body.user.id, token: body.token });
  }

  // --- Bestandsquelle: liegt bereits validiert im Haus (drei grüne, zwei gelbe Stimmen). --------
  const bestand = await endpoints.ko.create({
    title: BESTAND_TITEL,
    statement: BESTAND_AUSSAGE,
    type: "best_practice",
    category: "Wartung",
  } as never);
  const bestandId = bestand.id;

  // --- Die zu korrigierende Quelle: gleiche Fachwörter, zunächst derselbe alte Wortlaut. --------
  const korrektur = await endpoints.ko.create({
    title: KORREKTUR_TITEL,
    statement: BESTAND_AUSSAGE,
    type: "best_practice",
    category: "Wartung",
  } as never);
  const korrekturId = korrektur.id;

  // --- Fachfremde, maximal bewertete Quelle (Fallklasse 5). ------------------------------------
  const fremd = await endpoints.ko.create({
    title: FREMDER_TITEL,
    statement: FREMDE_AUSSAGE,
    type: "best_practice",
    category: "Verwaltung",
  } as never);
  await endpoints.ko.act(fremd.id, { action: "admin-validate" });

  // Hintergrund-Prüfjobs auslaufen lassen, bevor gemessen wird.
  await services.aiCheckWorker?.idle();

  const aufbau: Aufbau = {
    app,
    services,
    admin,
    pruefer,
    bestandId,
    korrekturId,
    anmeldenAls: (s) => draht?.anmeldenAls(s),
    letzterDraht: () => draht?.letzterDraht() ?? null,
  };

  // Die Bestandsquelle wird freigegeben: 3× grün (erreicht `neededValidations` = 3), 2× gelb
  // (senkt den Vertrauenswert, verhindert die Freigabe nicht) → validiert bei Vertrauenswert 67.
  // Das ist der feste Vergleichspunkt, an dem sich die Korrektur in jeder Fallklasse messen muss.
  await bewerten(aufbau, bestandId, ["up", "up", "up", "warn", "warn"]);
  draht.anmeldenAls(admin);
  // Der Vergleichspunkt wird nicht angenommen, sondern gemessen — sonst prüfte jede Fallklasse
  // gegen eine Zahl, die niemand belegt hat.
  const bestandStand = await endpoints.ko.get(bestandId);
  expect(bestandStand.status).toBe("validiert");
  expect(bestandStand.trust).toBe(67);
  return aufbau;
}

/** Bewertet ein Objekt der Reihe nach durch die Prüferinnen 1..n — über den ECHTEN Client. */
async function bewerten(
  aufbau: Aufbau,
  koId: string,
  urteile: readonly ("up" | "warn" | "down")[],
): Promise<void> {
  for (let i = 0; i < urteile.length; i++) {
    const p = aufbau.pruefer[i];
    const urteil = urteile[i];
    if (!p || !urteil) {
      throw new Error(`Fehlende Prüferin oder Urteil an Position ${i}`);
    }
    await bewertenMit(aufbau, koId, p, urteil);
  }
  aufbau.anmeldenAls(aufbau.admin);
}

async function bewertenMit(
  aufbau: Aufbau,
  koId: string,
  p: Sitzung,
  urteil: "up" | "warn" | "down",
): Promise<void> {
  aufbau.anmeldenAls(p);
  await endpoints.ko.act(koId, { action: "rate", verdict: urteil });
  aufbau.anmeldenAls(aufbau.admin);
}

/** Die KORREKTUR: eine echte Überarbeitung über den echten Client (`PUT /api/kos/:id` revise). */
async function korrigieren(aufbau: Aufbau): Promise<KnowledgeObject> {
  return endpoints.ko.act(aufbau.korrekturId, {
    action: "revise",
    changes: { title: KORREKTUR_TITEL, statement: KORREKTUR_AUSSAGE } as never,
  });
}

// ================================================================================================
// DIE OBERFLÄCHE. Echte Seite, echte Provider, echter Absendeweg.
// ================================================================================================
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function seiteOeffnen(): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

function frageFeld(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("form input");
  if (!el) {
    throw new Error("Frage-Eingabe nicht gefunden");
  }
  return el;
}

/** Tippt die Frage und drückt den ECHTEN Absendeknopf der Seite. */
async function fragen(text: string): Promise<void> {
  const input = frageFeld();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = container.querySelector<HTMLButtonElement>("form button[type=submit]");
  if (!knopf) {
    throw new Error("Absendeknopf nicht gefunden");
  }
  // Der Knopf DARF nicht gesperrt sein — sonst gäbe es keine sichtbare Folgeantwort zu messen.
  expect(knopf.disabled).toBe(false);
  await act(async () => {
    knopf.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** Was am Bildschirm steht: die Antwortkarte, oder null bei Wissenslücke. */
function sichtbareAntwort(): HTMLElement | null {
  return container.querySelector<HTMLElement>("[data-testid=ask-answer]");
}

/**
 * Der gerenderte Vertrauenswert (ConfidenceBar, aria-valuenow) — oder null.
 *
 * JOB 3064 · H5 NACHGEFÜHRT: der Balken steht seit dem Umbau der Fragenfläche nicht mehr dauerhaft
 * unter der Antwort, sondern hinter dem „…" DER ANTWORTKARTE im Info-Blatt „Mehr" (Auftrag §5,
 * Zeile „Antwortbasis-Vertrag + Zählzeile"). Die Zusage von JOB 1044 ist unberührt: gemessen wird
 * weiter der WIRKLICH GERENDERTE Wert am Ende der Kette, nicht ein Feld im Zustand — nur führt der
 * Weg dorthin über einen echten Klick auf ein echtes Menü. Fehlte der Menüpunkt oder öffnete er
 * nichts, käme hier `null` heraus und die Fälle unten würden rot.
 */
async function sichtbarerVertrauenswert(): Promise<number | null> {
  if (!document.querySelector('[data-testid="ask-mehr"]')) {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
      await durchlaufen();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
      await durchlaufen();
    });
  }
  // `document`, weil das Blatt nach `document.body` portaliert wird (s. `Seitenblatt.tsx`).
  const balken = document.querySelector('[data-testid="ask-mehr"] [role=progressbar]');
  const roh = balken?.getAttribute("aria-valuenow");
  return roh === null || roh === undefined ? null : Number(roh);
}

/** Der Wiretyp: die rohen Bytes des Drahts, gegen den Clientvertrag gelesen. */
function drahtAntwort(aufbau: Aufbau): AskResponse {
  const roh = aufbau.letzterDraht();
  if (!roh) {
    throw new Error("Es ging keine /api/ask-Antwort über den Draht.");
  }
  expect(roh.status).toBe(200);
  expect(roh.contentType).toContain("application/json");
  return JSON.parse(roh.body) as AskResponse;
}

/** Der PERSISTIERTE Stand eines Objekts — gelesen über den echten Client. */
async function gespeichert(koId: string): Promise<KnowledgeObject> {
  return endpoints.ko.get(koId);
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  // VOR dem ersten `buildServices()` — sonst bindet der Modellclient die Originalfunktion.
  schrankeAufbauen();
});

afterAll(() => {
  // Die Schranke gehört dem Worker. Bleibt sie stehen, fallen fremde Testdateien darüber.
  schrankeAbbauen();
});

beforeEach(() => {
  root = null;
  netzversuche.length = 0;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  draht?.abbauen();
  draht = null;
  expect(netzversuche, `Es wurde ein Netzweg beschritten: ${netzversuche.join(" · ")}`).toEqual([]);
});

describe("JOB 1044 D4: Korrektur → Persistenz → Validation → Status/Trust → Auswahl → Wire → Client → sichtbare Antwort", () => {
  // ============================================================================================
  // FALL 0 — DIE SCHRANKE IST SCHARF.
  // ============================================================================================
  //
  // Ohne diesen Fall wäre ein leeres Netzprotokoll wertlos: Eine Schranke, die nichts sieht, sieht
  // auch einen echten Netzweg nicht. Hier wird das Instrument selbst kalibriert — auf beiden
  // Achsen, und zusätzlich die Trennung zwischen „Netzweg" und „in-process abgeschnitten".
  it("0 · die Netzschranke sieht und sperrt beide Achsen; die Modellgrenze ist kein Netzweg", async () => {
    // Achse 1 — eine fremde absolute Adresse.
    await expect(fetch("http://fremde-adresse.invalid/pfad")).rejects.toThrow(/NETZSCHRANKE/);
    // Achse 2 — das Kernprimitiv darunter, an `fetch` vorbei.
    expect(() => (verlangen("node:net") as { connect(p: number): unknown }).connect(9)).toThrow(
      /NETZSCHRANKE/,
    );

    expect(netzversuche).toEqual([
      "fetch http://fremde-adresse.invalid/pfad",
      "node:net.connect 9",
    ]);

    // Und die Modellgrenze wird ANDERS behandelt: sie endet im Prozess, zählt nicht als Netzweg.
    await expect(fetch(`${MODELL_BASIS}/chat/completions`)).rejects.toThrow(
      /IN-PROCESS-MODELLGRENZE/,
    );
    expect(netzversuche).toHaveLength(2);

    // Die Kalibrierung selbst darf den Lauf nicht röten.
    netzversuche.length = 0;
  });

  // ============================================================================================
  // FALLKLASSE 1 — EINE UNGEPRÜFTE KORREKTUR BLEIBT OHNE SICHTBARE WIRKUNG.
  // ============================================================================================
  it("1 · ungeprüfte Korrektur: persistiert, aber die sichtbare Antwort trägt weiter den Bestand", async () => {
    const aufbau = await aufbauen();
    await korrigieren(aufbau);

    // PERSISTENZ: die Korrektur steht wirklich im Objekt — und sie ist ungeprüft.
    const nachKorrektur = await gespeichert(aufbau.korrekturId);
    expect(nachKorrektur.statement).toBe(KORREKTUR_AUSSAGE);
    expect(nachKorrektur.status).toBe("offen");
    expect(nachKorrektur.trust).toBe(0);

    await seiteOeffnen();
    await fragen(FRAGE);

    // WIRE: der Draht trägt die Bestandsquelle, nicht die Korrektur.
    const wire = drahtAntwort(aufbau);
    expect(wire.result.answered).toBe(true);
    expect(wire.result.sources).toContain(aufbau.bestandId);
    expect(wire.result.sources).not.toContain(aufbau.korrekturId);

    // SICHTBAR: der korrigierte Satz steht NICHT auf dem Bildschirm.
    const karte = sichtbareAntwort();
    expect(karte).not.toBeNull();
    expect(karte?.textContent).toContain("drei bar");
    expect(karte?.textContent).not.toContain("null bar");
  });

  // ============================================================================================
  // FALLKLASSE 2 — EINE POSITIVE FREIGABE KANN EINE SACHLICH PASSENDE QUELLE TRAGEN.
  // ============================================================================================
  it("2 · positive Freigabe: dieselbe Korrektur trägt jetzt die sichtbare Folgeantwort", async () => {
    const aufbau = await aufbauen();
    await korrigieren(aufbau);
    await bewerten(aufbau, aufbau.korrekturId, ["up", "up", "up"]);

    // VALIDATION → STATUS/TRUST, persistiert.
    const nachFreigabe = await gespeichert(aufbau.korrekturId);
    expect(nachFreigabe.status).toBe("validiert");
    expect(nachFreigabe.trust).toBe(99);

    await seiteOeffnen();
    await fragen(FRAGE);

    // WIRE: dieselbe Frage, derselbe Bestand, dieselbe Relevanz — jetzt trägt die Korrektur.
    const wire = drahtAntwort(aufbau);
    expect(wire.result.sources).toContain(aufbau.korrekturId);
    expect(wire.result.sources).not.toContain(aufbau.bestandId);
    expect(wire.result.knowledgeClass).toBe("gesichert");

    // DIE EINE ZAHL AN DREI STATIONEN: persistiert = auf dem Draht = am Bildschirm.
    expect(wire.result.trust).toBe(nachFreigabe.trust);
    expect(await sichtbarerVertrauenswert()).toBe(nachFreigabe.trust);

    // SICHTBAR: der korrigierte Satz ist angekommen.
    const karte = sichtbareAntwort();
    expect(karte?.textContent).toContain("null bar");
    expect(karte?.textContent).not.toContain("drei bar");
  });

  // ============================================================================================
  // FALLKLASSE 3 — `warn` SENKT DEN VERTRAUENSWERT, OHNE DIE FREIGABE ALLEIN ZU VERHINDERN.
  // ============================================================================================
  it("3 · warn: Freigabe bleibt, der sichtbare Vertrauenswert sinkt (83 statt 99)", async () => {
    const aufbau = await aufbauen();
    await korrigieren(aufbau);
    await bewerten(aufbau, aufbau.korrekturId, ["up", "up", "up", "warn"]);

    // Die Freigabe steht — `warn` allein verhindert sie NICHT (trust.ts:44-46).
    const nachWarnung = await gespeichert(aufbau.korrekturId);
    expect(nachWarnung.status).toBe("validiert");
    // …aber der Vertrauenswert ist gesenkt: unter dem der ungewarnten Freigabe (99).
    expect(nachWarnung.trust).toBe(83);
    expect(nachWarnung.trust).toBeLessThan(99);

    await seiteOeffnen();
    await fragen(FRAGE);

    const wire = drahtAntwort(aufbau);
    // Die Freigabe wirkt weiter: die Quelle trägt die Antwort.
    expect(wire.result.sources).toContain(aufbau.korrekturId);
    expect(wire.result.trust).toBe(83);

    // Und die gesenkte Zahl steht wirklich am Bildschirm.
    expect(await sichtbarerVertrauenswert()).toBe(83);
    expect(sichtbareAntwort()?.textContent).toContain("null bar");
  });

  // ============================================================================================
  // FALLKLASSE 4 — `down` HÄLT DIE QUELLE OFFEN.
  // ============================================================================================
  it("4 · down: die Quelle bleibt offen und trägt die sichtbare Antwort nicht", async () => {
    const aufbau = await aufbauen();
    await korrigieren(aufbau);
    await bewerten(aufbau, aufbau.korrekturId, ["up", "up", "up", "down"]);

    // Trotz drei grüner Stimmen: EIN `down` hält den Status offen (trust.ts:46).
    const nachAblehnung = await gespeichert(aufbau.korrekturId);
    expect(nachAblehnung.status).toBe("offen");
    expect(nachAblehnung.trust).toBe(67);

    await seiteOeffnen();
    await fragen(FRAGE);

    const wire = drahtAntwort(aufbau);
    expect(wire.result.sources).toContain(aufbau.bestandId);
    expect(wire.result.sources).not.toContain(aufbau.korrekturId);

    const karte = sichtbareAntwort();
    expect(karte?.textContent).toContain("drei bar");
    expect(karte?.textContent).not.toContain("null bar");
  });

  // ============================================================================================
  // FALLKLASSE 5 — VERTRAUEN MACHT EINE QUELLE NIE SACHLICH PASSEND.
  // ============================================================================================
  it("5 · fachfremde Quelle mit Höchstvertrauen erscheint in keiner sichtbaren Antwort", async () => {
    const aufbau = await aufbauen();
    await korrigieren(aufbau);
    await bewerten(aufbau, aufbau.korrekturId, ["up", "up", "up"]);

    // Die fachfremde Quelle steht auf dem höchsten Wert, den das System vergibt.
    const alle = await endpoints.ko.list();
    const fremd = alle.find((k) => k.title === FREMDER_TITEL);
    expect(fremd?.status).toBe("validiert");
    expect(fremd?.trust).toBe(99);

    await seiteOeffnen();
    await fragen(FRAGE);

    const wire = drahtAntwort(aufbau);
    // Sie ist weder auf dem Draht noch am Bildschirm — der Sachbezug entscheidet, nicht der Wert.
    expect(wire.result.sources).not.toContain(fremd?.id);
    expect(sichtbareAntwort()?.textContent).not.toContain("Salatbar");
    // Gegenkontrolle: die Antwort ist nicht etwa leer geblieben.
    expect(sichtbareAntwort()?.textContent).toContain("null bar");

    // Und die Gegenprobe auf der anderen Seite: eine Frage NUR zur fachfremden Quelle findet sie
    // sehr wohl — die Auswahl ist scharf, nicht blind.
    await fragen("Was steht im Kantinenplan zum Mittagessen?");
    const zweiterDraht = drahtAntwort(aufbau);
    expect(zweiterDraht.result.sources).toContain(fremd?.id);
  });
});
