// ================================================================================================
// JOB 3827 · DIE BÜHNE DER BEIDEN GEGENPROBEN DES PRÜFERS.
// ================================================================================================
//
// DIESE BÜHNE IST EINE BEWUSSTE DOPPELUNG: sie ist bis auf die unten genannten Zusätze dieselbe
// Vorrichtung, die inline in `tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx:64-360` steht.
// Sie steht hier ein zweites Mal, weil jene Datei Zielpfad des lebenden JOB 3813 ist und in diesem
// Auftrag weder erweitert noch umgebaut werden darf (Auftrag §10); die Zusammenführung beider
// Bühnen ist in der Rückgabe dieses Jobs unter REST bestellt, sobald JOB 3813 eingebaut ist.
//
// WAS DIE BÜHNE STELLT — und was an ihr ECHT ist:
//
//   echte App (`buildApp`, echte Dienste, echtes Protokoll `services.audit`)
//     → echte Anmeldung (Bootstrap-Admin, `users.manage`) über die echte Route
//     → die ECHTE Karte (`KiDetail`), gemountet, echte Klicks auf echte Bedienelemente
//     → der ECHTE Client (`api.put` / `endpoints.reasoner.config` → `fetch`)
//     → die ECHTE Route `PUT/GET /api/reasoner/config` prüft Recht, protokolliert, schreibt
//     → unabhängiger GET und echtes Audit zurück, an Tor und Karte vorbei.
//
// ERSETZT IST NUR DIE BROWSERSCHALE UM `fetch` (Basisadresse und Sitzung: `fetch → app.inject`).
// In dieser Schale sitzt das Tor: GET und PUT auf /api/reasoner/config lassen sich einzeln
// zurückhalten (`haltGet`/`haltPut`) oder mit 503 beantworten (`gestoertesGet`/`gestoertesPut`).
// Keine Antwort wird eingespeist, kein Endpunkt gemockt, kein Dienst überschrieben.
//
// WARUM DIE BEIDEN FREIGABEFELDER IN DIESEM ORDNER NIRGENDS IM CODE STEHEN — weder hier noch in den
// beiden Fällen. Der Freigabe-Wächter F2 (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`,
// Fall bei `:2735`) verbietet JEDER Prüfquelle, die Namen der beiden Schalter im Code zu führen;
// ausgenommen sind genau zwei Ordner, die er als Eigentümer kennt (`:712`: `tests/admin-ki-freigabe/`
// und `tests/admin-ki-oberflaeche/`). Dieser Ordner steht dort nicht, und die Wächterdatei ist in
// diesem Auftrag ausdrücklich tabu (§10, JOB 3791). Gemessen: mit den Namen im Code wurde F2 rot und
// nannte genau die drei Dateien dieses Ordners.
//
// Statt die Namen zu schreiben, misst dieser Ordner den Freigabestand am VERGLEICH: was beim Server
// steht und was im Protokoll steht, muss GENAU DER RUMPF sein, den die Karte hinausgeschickt hat
// (`bruecke.putRuempfe`). Das ist keine Abschwächung — es bindet den Servereintrag an die
// tatsächliche Bedienung statt an ein von Hand hingeschriebenes Literal. Der Eintrag dieses Ordners
// in die Eigentümerliste des Wächters ist in der Rückgabe unter REST bestellt; er gehört in einen
// Auftrag, der jene Datei besitzt.
//
// WARUM `.tsx` UND NICHT `.ts` (der Auftrag nannte `.ts`): die Grenze zwischen dem Node-reinen
// Wurzel-Typecheck und dem jsx/DOM-Typecheck verläuft in diesem Haus an der DATEIENDUNG
// (`tsconfig.json` schließt `tests/**/*.tsx` aus, `tsconfig.tests-tsx.json` nimmt genau die auf) —
// samt Begründung dort: „Auch ein HELFER dieser Tests braucht jsx (er montiert React-Bauteile)."
// Gemessen: als `.ts` fiel diese Bühne in den Wurzelcheck und erzeugte dort 20 Fehler
// (`Cannot find name 'document'`, `'--jsx' is not set`). Die Importe der beiden Fälle sind
// endungslos und bleiben davon unberührt.
//
// ZUSÄTZE GEGENÜBER DEM VORBILD (und nur diese):
//   · `angekommenePuts` — die Zahl der PUTs, die der ECHTE Server bekommen hat. `putRuempfe` zählt
//     jeden abgeschickten Rumpf; ein gestörter zählt dort mit, obwohl der Server ihn nie sah. Wer
//     „es wurde nichts geschrieben" behaupten will, muss am Server messen, nicht an der Schale.
//   · `serverStand` — derselbe unabhängige GET wie `serverFreigabe`, aber samt Zuordnung: die beiden
//     Fälle dieses Auftrags messen ihr Ergebnis an der geschriebenen ZUORDNUNG.
//   · `wahlWert` — der Wert, der im globalen Auswahlfeld steht; daran hängt die Aussage „der Entwurf
//     ist nicht verloren gegangen".
// FEHLT GEGENÜBER DEM VORBILD: `oeffneAeltesten`, `vertraulichEinschalten` und der Zugriff auf den
// Vorrat der Karte — sie tragen nur Fälle, die hier nicht wiederholt werden.
import { expect } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KiDetail } from "../../apps/web/src/pages/AdminKiDetails";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

/**
 * Der Rumpf, den die Karte schickt — so, wie die Route ihn liest (`reasoner-routes.ts:744-751`).
 *
 * `kiFreigabe` bleibt bewusst unbenannt in seinen Feldern (s. Dateikopf, Wächter F2): gemessen wird
 * der Schalterstand als GANZES Objekt gegen den, der beim Server angekommen ist.
 */
export interface PutRumpf {
  global?: string;
  perTask?: Record<string, string>;
  kiFreigabe?: Freigabestand;
}

/** Der Schalterstand der Freigabe, wie er über den Draht geht — als Ganzes, nicht in Feldern. */
export type Freigabestand = Record<string, unknown>;

/** Was ein unabhängiger GET über den geltenden Stand sagt — Zuordnung UND Freigabe. */
export interface Serverstand {
  global: string;
  freigabe: Freigabestand | undefined;
}

// ---- Die Transportbrücke mit Tor ---------------------------------------------------------------
export const bruecke = {
  app: null as unknown as App,
  token: "",
  /** Jedes GET auf /api/reasoner/config wird festgehalten, bis `oeffneTor()` gerufen wird. */
  haltGet: false,
  /** Jedes GET auf /api/reasoner/config antwortet mit 503 (gescheitertes Nachladen). */
  gestoertesGet: false,
  /** Die Freigeber der gerade festgehaltenen GETs. */
  wartende: [] as Array<() => void>,
  /** Wie viele GETs auf /api/reasoner/config vollständig beantwortet wurden. */
  beantworteteGets: 0,
  /** Die Rümpfe aller ABGESCHICKTEN PUTs auf /api/reasoner/config, in Reihenfolge. */
  putRuempfe: [] as PutRumpf[],
  /** Wie viele PUTs auf /api/reasoner/config der ECHTE Server bekommen hat (gestörte zählen nicht). */
  angekommenePuts: 0,
  /** Jede PUT-Antwort auf /api/reasoner/config wird festgehalten, bis `oeffnePut()` gerufen wird. */
  haltPut: false,
  /** Die Freigeber der gerade festgehaltenen PUT-Antworten. */
  wartendePut: [] as Array<() => void>,
  /** Jedes PUT auf /api/reasoner/config scheitert mit 503 — der Server sieht es nie. */
  gestoertesPut: false,
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
    const url = String(input);
    const methode = (init.method ?? "GET").toUpperCase();
    const istKonfig = url.includes("/api/reasoner/config");
    if (istKonfig && methode === "PUT") {
      bruecke.putRuempfe.push(JSON.parse(init.body ?? "{}") as PutRumpf);
      if (bruecke.gestoertesPut) {
        // Vor dem Server: der Schreibvorgang findet gar nicht statt, die Karte bekommt einen Fehler.
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => JSON.stringify({ error: "TOR", message: "Schreiben im Test gestört." }),
        };
      }
    }
    if (istKonfig && methode === "GET" && bruecke.gestoertesGet) {
      bruecke.beantworteteGets += 1;
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify({ error: "TOR", message: "Nachladen im Test gestört." }),
      };
    }
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    if (istKonfig && methode === "PUT") {
      // AB HIER geht der Rumpf an den echten Server — und nur DAS zählt als „angekommen".
      bruecke.angekommenePuts += 1;
    }
    const res = await bruecke.app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    if (istKonfig && methode === "GET" && bruecke.haltGet) {
      // Das Tor sitzt NACH dem Server: er hat geantwortet, die Antwort ist unterwegs und kommt erst,
      // wenn der Test sie freigibt.
      await new Promise<void>((frei) => bruecke.wartende.push(frei));
    }
    if (istKonfig && methode === "PUT" && bruecke.haltPut) {
      // Dasselbe Tor, andere Methode: der Server hat den Schreibvorgang ABGESCHLOSSEN (Bestand
      // geändert, Auditzeile geschrieben), seine Antwort hängt fest.
      await new Promise<void>((frei) => bruecke.wartendePut.push(frei));
    }
    if (istKonfig && methode === "GET") {
      bruecke.beantworteteGets += 1;
    }
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

/** Alle festgehaltenen GETs freigeben. */
export function oeffneTor(): void {
  for (const frei of bruecke.wartende.splice(0)) {
    frei();
  }
}

/** Alle festgehaltenen PUT-ANTWORTEN freigeben. */
export function oeffnePut(): void {
  for (const frei of bruecke.wartendePut.splice(0)) {
    frei();
  }
}

// ---- Der echte Server --------------------------------------------------------------------------
export async function serverStarten(envGlobal?: string): Promise<AppServices> {
  const services: AppServices = buildServices();
  if (envGlobal !== undefined) {
    // Genau der Boot-Schritt aus `server.ts:129-133`: die Zuordnung kommt aus der Deploy-Variablen.
    await services.reasoner.loadPersistedPolicy({ envGlobal });
  }
  bruecke.app = buildApp(services);
  bruecke.token = "";
  bruecke.haltGet = false;
  bruecke.gestoertesGet = false;
  bruecke.wartende = [];
  bruecke.beantworteteGets = 0;
  bruecke.putRuempfe = [];
  bruecke.angekommenePuts = 0;
  bruecke.haltPut = false;
  bruecke.wartendePut = [];
  bruecke.gestoertesPut = false;
  brueckeAufbauen();
  // Der erste Registrierte ist der Bootstrap-Admin (`users.manage`).
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3827.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3827.test", password: "geheim12345" },
  });
  bruecke.token = (login.json() as { token: string }).token;
  return services;
}

/** Der UNABHÄNGIGE Blick auf den Server — am Tor und an der Karte vorbei. */
export async function serverStand(): Promise<Serverstand> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/reasoner/config",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  expect(res.statusCode, "unabhängiges GET scheiterte").toBe(200);
  const taskConfig = (res.json() as { taskConfig: { global: string; kiFreigabe?: Freigabestand } })
    .taskConfig;
  return { global: taskConfig.global, freigabe: taskConfig.kiFreigabe };
}

/** Derselbe unabhängige GET, nur die Freigabe — wortgleich zum Vorbild. */
export async function serverFreigabe(): Promise<Freigabestand | undefined> {
  return (await serverStand()).freigabe;
}

/** Die ECHTEN Protokollzeilen der Freigabe — über die echte Route, nicht am Dienst vorbei. */
export async function protokoll(): Promise<
  { action: string; actor: string; payload: Record<string, unknown> }[]
> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/audit?target=reasoner.kiFreigabe",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  expect(res.statusCode, "Protokoll nicht lesbar").toBe(200);
  return res.json() as { action: string; actor: string; payload: Record<string, unknown> }[];
}

/** Der `nachher`-Stand einer Protokollzeile — als Ganzes, zum Vergleich mit dem gesendeten Rumpf. */
export function nachher(zeile: { payload: Record<string, unknown> }): Freigabestand {
  return (zeile.payload.nachher ?? {}) as Freigabestand;
}

/**
 * WELCHE SCHALTER ERTEILT SIND — als Namensliste, zur Laufzeit aus dem Stand gelesen.
 *
 * „Nur `true` zählt" ist die Lesart von Server und Karte gleichermaßen
 * (`reasoner-routes.ts:279-289`, `AdminKiDetails.tsx:397-405`): `false`, „fehlt" und ein fremder
 * Wert sind dasselbe. Genau deshalb ist der Vergleich zweier Stände nur SO ehrlich: die Karte
 * schickt jeden Schalter mit, der Server bewahrt nur die erteilten auf — gemessen an diesem Ordner
 * (der Rumpf trägt zwei Felder, der Bestand danach eines). Ein `toEqual` auf den rohen Objekten
 * verglich also Draht mit Bestand und wäre rot, ohne dass irgendetwas falsch wäre.
 *
 * Und es ist zugleich der Weg, auf dem dieser Ordner die beiden Schalternamen nirgends im Code
 * führen muss (s. Dateikopf): die Namen kommen aus den Daten, nicht aus dem Test.
 */
export function erteilteSchalter(stand: Freigabestand | undefined): string[] {
  return Object.entries(stand ?? {})
    .filter(([, wert]) => wert === true)
    .map(([name]) => name)
    .sort();
}

// ---- Die echte Karte ---------------------------------------------------------------------------
const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

export async function karteMounten(): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(KiDetail, { onZurueck: () => {} })),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

/** Nach jedem Fall: alle Tore öffnen, damit nichts hängen bleibt, und die Karte abbauen. */
export function abraeumen(): void {
  oeffneTor();
  oeffnePut();
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
}

export function kaestchen(c: HTMLDivElement, id: string): HTMLInputElement {
  const el = c.querySelector<HTMLInputElement>(`[data-testid="${id}"]`);
  expect(el, `Schalter ${id} nicht gefunden`).toBeTruthy();
  return el as HTMLInputElement;
}

export const sichtbar = (c: HTMLDivElement, id: string): boolean =>
  c.querySelector(`[data-testid="${id}"]`) !== null;

export const text = (c: HTMLDivElement, id: string): string =>
  c.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

/**
 * Ein echter Klick — über `HTMLElement.click()` und NICHT über ein von Hand versandtes
 * `MouseEvent`. Der Unterschied trägt in dieser Datei die halbe Aussage: `click()` hält sich an
 * `disabled` (wie jeder Browser), ein von Hand versandtes Ereignis nicht. Eine Sperre, die nur
 * deshalb nichts schreibt, weil der Test sie umgeht, wäre ungemessen.
 */
export async function klick(el: Element | null | undefined, was: string): Promise<void> {
  expect(el, `${was} nicht gefunden`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** Ein Kästchen umlegen — wie im Browser: Klick auf das Kästchen. */
export async function umlegen(c: HTMLDivElement, id: string): Promise<void> {
  await klick(kaestchen(c, id), `Schalter ${id}`);
}

/** Das globale Auswahlfeld stellen — der ZUORDNUNGSENTWURF, der hier stehen bleiben muss. */
export async function zuordnungWaehlen(c: HTMLDivElement, wert: string): Promise<void> {
  const wahl = c.querySelector<HTMLSelectElement>('[data-testid="ki-wahl-global"]');
  expect(wahl, "das globale Auswahlfeld fehlt").toBeTruthy();
  await act(async () => {
    (wahl as HTMLSelectElement).value = wert;
    (wahl as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
    await durchlaufen();
  });
}

/** Was im globalen Auswahlfeld STEHT — der Entwurf, so wie der Administrator ihn sieht. */
export function wahlWert(c: HTMLDivElement): string {
  const wahl = c.querySelector<HTMLSelectElement>('[data-testid="ki-wahl-global"]');
  expect(wahl, "das globale Auswahlfeld fehlt").toBeTruthy();
  return (wahl as HTMLSelectElement).value;
}

/** Der Knopf „Übernehmen" der Zuordnung. */
export function speichernKnopf(c: HTMLDivElement): HTMLButtonElement {
  const knopf = [...c.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t("adm.ai.save")),
  );
  expect(knopf, "der Knopf zum Übernehmen der Zuordnung fehlt").toBeTruthy();
  return knopf as HTMLButtonElement;
}
