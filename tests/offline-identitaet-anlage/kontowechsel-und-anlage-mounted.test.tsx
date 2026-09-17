// @vitest-environment jsdom
// ================================================================================================
// JOB 4249 · ENTWURF-MOBIL-DESKTOP-R — OFFLINE ERFASSEN, MIT DEM RICHTIGEN KONTO UND GENAU EINMAL.
// ================================================================================================
//
// GEMESSEN WIRD DIE GANZE KETTE, nicht zwei Unit-Reparaturen: echte Ablage
// (`InMemoryDraftRepo`/`BarrierenAblage`) → echter Dienst (`CaptureService.createDraftVorgang`) →
// echte Route (`POST /api/drafts` über `buildApp` und `app.inject`) → echter Client
// (`endpoints.drafts.create`) → echte Warteschlange (echtes `localStorage`, echte
// `online`/`offline`-Ereignisse) → echte Oberfläche (`Mobile`, gemountet).
//
// EINZIGER ERSATZ IST DER TRANSPORT: `globalThis.fetch` liegt auf einer Brücke, die jeden Aufruf
// über `app.inject` in DIESELBE App schickt — mit dem Token des Kontos, das gerade angemeldet ist.
// Der Kontowechsel ist damit ein ECHTER: `/api/auth/me` liefert danach eine andere Kennung, und die
// Entwurfsliste (`GET /api/drafts`) filtert serverseitig mit `visibleDraftsFor`.
//
// A und B sind zwei WIRKLICHE Konten (`POST /api/users` durch den Erstadministrator, Rolle
// `experte` — sie haben `ko.create` und sehen nur ihre eigenen Entwürfe).
//
// ABMELDEN UND ANMELDEN IST EIN NEUAUFBAU, und das ist keine Vereinfachung: `AuthContext.signOut`
// räumt den Cache und ruft `window.location.assign("/")` — die Seite wird also wirklich neu
// gebaut. Genau das tut `abbauen()` + `mount()` hier, mit UNVERÄNDERTEM `localStorage`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { VorgangMitStand } from "../../apps/web/src/app/useOfflineQueue";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import type { Draft } from "../../services/capture/src/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const STORAGE_KEY = "kw.offlineQueue.v1";
/** Derselbe Abfrageschlüssel, unter dem `AuthContext` die Sitzungsfrage führt. */
const KONTO_ABFRAGE = ["auth", "me"] as const;

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE MIT BARRIERE — Bauform aus `tests/capture/job2697-client-vorgangskennung-mounted.test.tsx`.
// Sie hält den Anlageweg zwischen Handler-Eintritt und Persistenz an, damit zwei Sendeläufe sich
// wirklich ÜBERLAPPEN können und nicht nur nacheinander laufen.
// ------------------------------------------------------------------------------------------------
class BarrierenAblage extends InMemoryDraftRepo {
  /** Wie oft ein Handler die Persistenz ERREICHT hat. */
  eintritte = 0;
  private freigabe: (() => void) | null = null;
  private tor: Promise<void> | null = null;

  sperren(): void {
    this.tor = new Promise<void>((aufloesen) => {
      this.freigabe = aufloesen;
    });
  }

  freigeben(): void {
    this.freigabe?.();
    this.tor = null;
    this.freigabe = null;
  }

  override async insertIfOperationAbsent(draft: Draft) {
    this.eintritte += 1;
    if (this.tor) {
      await this.tor;
    }
    return super.insertIfOperationAbsent(draft);
  }

  override async insert(draft: Draft) {
    this.eintritte += 1;
    if (this.tor) {
      await this.tor;
    }
    return super.insert(draft);
  }
}

let ablage: BarrierenAblage;
let app: ReturnType<typeof buildApp>;
let tokenA = "";
let tokenB = "";
let kontoA = "";
let kontoB = "";
/** Das Token, mit dem die Brücke gerade fährt — das ist „wer ist angemeldet". */
let angemeldet = "";
/** Jeder abgesendete Anlage-Rumpf, in Reihenfolge. */
let anlagen: Array<Record<string, unknown>> = [];
/** Wenn gesetzt: der Server bekommt den Aufruf, die ANTWORT geht auf dem Rückweg verloren. */
let antwortVerlieren = false;
/** Wie oft `/api/auth/me` beantwortet wurde — daran hängt das Ende des Aufbaus (s. `mount`). */
let meAntworten = 0;
/** Wenn gesetzt: `/api/auth/me` antwortet mit 401 — die Sitzung ist weg (Fall A12). */
let sitzungKaputt = false;
// ------------------------------------------------------------------------------------------------
// JOB 4249 R4 — DIE ANGEHALTENE SITZUNGSAUFFRISCHUNG (BENs Gegenprobe aus Runde 3).
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Bauform wie die Barriere in der Ablage, nur für `/api/auth/me`: der Aufruf ERREICHT den
// Server, die Antwort wird aber zurückgehalten. Genau dieses Zeitfenster ist der Befund — der
// Browser beglaubigt die nächsten Aufrufe schon als B, während die Oberfläche noch die zuletzt
// erfolgreich geholte Antwort (A) im Zwischenspeicher hält.
//
// WARUM `sitzungNeuLesen` DAS NICHT SEHEN KANN: es WARTET auf die Antwort (`meAntworten`). Danach
// ist die Lage eindeutig — der Fall spielt vor dieser Antwort.
let meTor: Promise<void> | null = null;
let meFreigabe: (() => void) | null = null;
/** Wie oft `/api/auth/me` den Halt erreicht hat — daran hängt „die Auffrischung läuft wirklich". */
let meEintritte = 0;

function meSperren(): void {
  meTor = new Promise<void>((aufloesen) => {
    meFreigabe = aufloesen;
  });
}

function meFreigeben(): void {
  meFreigabe?.();
  meTor = null;
  meFreigabe = null;
}
let vorherigerFetch: typeof globalThis.fetch;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Der Kopf des Erstadministrators — er vergibt und entzieht Rechte (Fall A7). */
let chefKopf: Record<string, string> = {};

/** Anmelden liefert Token UND Kennung — die Kennung ist das, woran der Eigentümer hängt. */
async function anmelden(mail: string): Promise<{ token: string; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: "passwort12" },
  });
  const koerper = res.json() as { token: string; user: { id: string } };
  return { token: String(koerper.token), id: String(koerper.user.id) };
}

async function rolleSetzen(konto: string, rolle: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/users/${konto}`,
    headers: chefKopf,
    payload: { role: rolle },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Rollenwechsel auf ${rolle} scheiterte: ${res.statusCode} ${res.body}`);
  }
}

async function konten(): Promise<void> {
  ablage = new BarrierenAblage();
  app = buildApp({ ...buildServices(), capture: new CaptureService({ repo: ablage }) });
  // Das erste Konto wird Erstadministrator (SCRUM-504). A und B entstehen DANACH und sind
  // gewöhnliche Schreibende — sonst sähe ein Administrator ohnehin jeden Entwurf, und der Fall
  // wäre aus dem falschen Grund grün.
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Chef", email: "chef@x.de", password: "secret123" },
  });
  const chef = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "chef@x.de", password: "secret123" },
  });
  chefKopf = { authorization: `Bearer ${String(chef.json().token)}` };
  for (const [name, mail] of [
    ["Anna", "anna@x.de"],
    ["Bert", "bert@x.de"],
  ]) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: chefKopf,
      payload: { name, email: mail, password: "passwort12", role: "experte" },
    });
  }
  const a = await anmelden("anna@x.de");
  const b = await anmelden("bert@x.de");
  tokenA = a.token;
  kontoA = a.id;
  tokenB = b.token;
  kontoB = b.id;
  angemeldet = tokenA;
}

function brueckeSetzen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = { authorization: `Bearer ${angemeldet}` };
    new Headers(init?.headers as HeadersInit | undefined).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.authorization = `Bearer ${angemeldet}`;
    const istAnlage = methode === "POST" && url.endsWith("/api/drafts");
    if (istAnlage) {
      anlagen.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    }
    if (url.endsWith("/api/auth/me") && meTor) {
      // Der Aufruf ist RAUS (der Zähler beweist es), die Antwort steht aus. Ab hier gilt für jeden
      // weiteren Aufruf das Token in `angemeldet` — die Oberfläche weiss davon noch nichts.
      meEintritte += 1;
      await meTor;
    }
    if (sitzungKaputt && url.endsWith("/api/auth/me")) {
      // Die Sitzung ist weg. Der Server sagt das mit 401 — dieselbe Antwort, die ein abgelaufenes
      // oder zurückgezogenes Cookie bekommt (`AuthContext` behält dann KEINEN alten Nutzer).
      meAntworten += 1;
      return {
        ok: false,
        status: 401,
        statusText: "401",
        text: async () => JSON.stringify({ error: "UNAUTHORIZED", message: "Nicht angemeldet." }),
      };
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url: url.replace(/^https?:\/\/[^/]+/, ""),
      headers: kopf,
      ...(init?.body !== undefined && init?.body !== null ? { payload: String(init.body) } : {}),
    });
    if (url.endsWith("/api/auth/me")) {
      // Der Zähler ist der Taktgeber dieses Tests: `mount()` wartet auf ihn, statt eine Zahl von
      // Durchläufen zu raten. Ohne diesen Haltepunkt läge die Sitzung beim ersten Klick noch in der
      // Lage `laedt` — und dann misst der Fall den Ladezustand statt der Zusage.
      meAntworten += 1;
    }
    if (istAnlage && antwortVerlieren) {
      // DER SERVER HAT GESCHRIEBEN, der Client erfährt es nie. Genau der Fall, für den es die
      // Vorgangskennung gibt (`createOperation.ts`: unbekannter Ausgang).
      throw new TypeError("Failed to fetch");
    }
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Der QueryClient der gerade aufgebauten Fläche. Er liegt hier und nicht nur im Rumpf von `mount`,
 * weil ein Fall die Sitzung MITTEN IM LAUF neu lesen lassen muss (s. `sitzungNeuLesen`) — genau
 * das, was im Betrieb die periodische Auffrischung und der Fokuswechsel tun.
 *
 * GEBAUT WIRD ER ALS LOKALE, NICHT-NULLBARE KONSTANTE, und erst danach hier hinterlegt: der
 * Anbieter verlangt einen `QueryClient`, nicht `QueryClient | null`. Wer die nullbare Variable
 * direkt hineinreicht, ist in vitest grün (esbuild wirft Typen weg) und fällt erst im
 * .tsx-Typenlauf des Tors auf (`tsconfig.tests-tsx.json`, s. `package.json` „build").
 */
let qc: QueryClient | null = null;

/**
 * JOB 4249 R6: `staleTime` ist EINSETZBAR, und das ist kein Testkomfort — es ist die Bedingung
 * dafür, dass der Fall A20 überhaupt existiert. Die Fälle bis R5 fahren mit `staleTime: 0`; dann
 * frischt react-query bei zurückkehrender Verbindung IMMER auf, und der Zustand „`idle` mit altem
 * Bestand" kann gar nicht entstehen. Im Betrieb steht dort 30 000 ms (`main.tsx:44`) — und genau
 * dann entsteht er: eine Antwort, die jünger ist als die Frist, wird nach der Verbindungslücke
 * nicht neu geholt und gälte ungeprüft weiter. Der Wert ist also nicht erfunden, sondern der
 * Betriebswert (BEN Prüflücke 6, von der Steuerung in Runde 6 ausdrücklich verlangt).
 */
async function mount(optionen?: { staleTime?: number }): Promise<void> {
  const meVorher = meAntworten;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: optionen?.staleTime ?? 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  qc = client;
  await act(async () => {
    root?.render(
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [{ pathname: "/mobile", state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                    createElement(Route, {
                      path: "/start",
                      element: createElement("div", null, "START-SEITE"),
                    }),
                  ),
                ),
                // DIE MELDUNGEN GEHÖREN DAZU, sonst ist „erst nach bestätigter Anlage gemeldet"
                // nicht messbar. Es ist DIESELBE Vorrichtung wie im Betrieb: `shell/AppShell.tsx:76`
                // hängt sie auch auf der shell-losen Route `/mobile` ein. Ohne sie wäre jede
                // Verneinung über eine Erfolgsmeldung immer grün — und damit wertlos.
                createElement(ToastViewport),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // DER AUFBAU IST ERST FERTIG, WENN DIE SITZUNG STEHT. `/auth/status` und `/auth/me` laufen
  // nacheinander; bis die zweite Antwort da ist, ist die Kontolage `laedt` und die Fläche verhält
  // sich zu Recht zurückhaltend (nichts senden, nichts annehmen). Ein Test, der vorher klickt,
  // misst diesen Ladezustand — nicht die Zusage. Gewartet wird auf die ANTWORT, nicht auf eine
  // geratene Anzahl Durchläufe.
  for (let i = 0; i < 200 && meAntworten === meVorher; i++) {
    await act(flush);
  }
  await act(flush);
  await act(flush);
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
}

/**
 * DIE SITZUNG WIRD NEU GELESEN, OHNE DASS DIE SEITE NEU AUFGEBAUT WIRD.
 *
 * Das ist der Weg, den BEN in Runde 1 gefunden hat und den `kontoWechselnUndNeuLaden` NICHT
 * abdeckt: im Betrieb fragt `AuthContext` die Sitzung periodisch und bei Fokuswechsel nach
 * (`SESSION_REFRESH_MS`, `refetchOnWindowFocus`). Antwortet `/auth/me` dann mit einem ANDEREN
 * Konto, wechselt die Kontolage mitten in einem laufenden Sendelauf — die Fläche bleibt stehen,
 * der Lauf läuft weiter. Genau diese Naht wird hier bedient.
 */
async function sitzungNeuLesen(): Promise<void> {
  const vorher = meAntworten;
  await act(async () => {
    await qc?.invalidateQueries({ queryKey: ["auth"] });
    await flush();
  });
  for (let i = 0; i < 200 && meAntworten === vorher; i++) {
    await act(flush);
  }
  await act(flush);
}

/** Abmelden und mit einem anderen Konto anmelden — als das, was es ist: ein Neuaufbau. */
async function kontoWechselnUndNeuLaden(token: string): Promise<void> {
  abbauen();
  angemeldet = token;
  await mount();
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}" nicht gefunden. Sichtbar: ${seitentext().slice(0, 500)}`);
  }
  return btn;
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * Die Meldungen (Toasts) hängen NICHT im Seitencontainer, sondern am Dokument. Wer sie in
 * `seitentext()` sucht, prüft eine Zusicherung, die nie zutreffen kann — und eine Verneinung
 * darüber wäre immer grün.
 */
function meldungstext(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
  await act(flush);
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector("input");
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

function textfeld(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Textfeld nicht gefunden");
  }
  return el;
}

async function tippe(el: HTMLInputElement | HTMLTextAreaElement, wert: string): Promise<void> {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function warteschlange(): VorgangMitStand[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as VorgangMitStand[];
}

/**
 * Verbindung an oder aus — `navigator.onLine` UND das Ereignis, wie im echten Browser.
 *
 * DREI DINGE, UND ALLE DREI SIND NÖTIG:
 *   · `navigator.onLine` — daran hängt die Warteschlange selbst (`syncNow`, `useOfflineQueue`);
 *   · das Fensterereignis — daran hängen die Melder im Hook (`online`/`offline`);
 *   · `onlineManager` von react-query — daran hängen die Abfragen (`networkMode`).
 *
 * Der dritte Punkt ist der, der hier zweimal Zeit gekostet hat: react-query hört nur dann auf die
 * Fensterereignisse, wenn gerade jemand angemeldet ist. Ein `online` zwischen zwei Aufbauten — also
 * genau beim Kontowechsel und beim Neuladen, den Fällen dieses Auftrags — fällt ins Leere, und der
 * Merker bleibt für den Rest des Laufs auf „offline". Die Sitzung wird dann nie abgerufen, die
 * Kontolage bleibt `unbekannt`, und die Fälle scheitern an einer Lage, die der VORIGE Fall
 * hinterlassen hat. Deshalb wird er direkt gesetzt.
 */
function netzSchalter(an: boolean): void {
  Object.defineProperty(navigator, "onLine", { value: an, configurable: true });
  onlineManager.setOnline(an);
  window.dispatchEvent(new Event(an ? "online" : "offline"));
}

async function netz(an: boolean): Promise<void> {
  await act(async () => {
    netzSchalter(an);
    await flush();
  });
  await act(flush);
}

// ------------------------------------------------------------------------------------------------
// JOB 4249 R6 — DIE NETZRÜCKKEHR, BEI DER UNSER MELDER VOR REACT-QUERY DRAN IST.
// ------------------------------------------------------------------------------------------------
//
// WARUM DAS EIN EIGENER WEG IST UND NICHT `netz(true)`: `netzSchalter` sagt es react-query ZUERST
// (`onlineManager.setOnline`) und feuert das Fensterereignis DANACH. Im Browser hängen beide am
// SELBEN Ereignis `window.online`, und wer zuerst gerufen wird, entscheidet allein die Reihenfolge,
// in der die Hörer angemeldet wurden — react-query meldet sich an, wenn der `QueryClientProvider`
// seinen Effekt fährt, die Warteschlange, wenn `Mobile` den ihren fährt. React fährt Kind-Effekte
// VOR Eltern-Effekten: der Melder der Warteschlange ist also im Regelfall der ERSTE.
//
// Genau diese Reihenfolge hat BEN in Runde 5 gemessen (`bListe: 1, gesendet: 1, rest: 0`), und sie
// ist der Betriebsfall — `netz(true)` bildet die andere ab. Hier wird sie festgehalten, statt sie
// dem Zufall der Anmeldereihenfolge zu überlassen.
async function netzZurueckMelderZuerst(): Promise<void> {
  await act(async () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
    await flush();
  });
  // Und ERST JETZT erfährt es react-query — es setzt angehaltene Abfragen fort und frischt auf.
  await act(async () => {
    onlineManager.setOnline(true);
    await flush();
  });
  for (let i = 0; i < 60; i++) {
    await act(flush);
  }
}

/** Der Zustand der Sitzungsabfrage, wie ihn auch `useOfflineQueue` liest — keine zweite Quelle. */
function sitzungsabfrage(): { status: string; fetchStatus: string; dataUpdatedAt: number } {
  const zustand = qc?.getQueryState(KONTO_ABFRAGE);
  if (!zustand) {
    throw new Error("die Sitzungsabfrage ist nicht angelegt — dieser Fall misst dann nichts");
  }
  return {
    status: String(zustand.status),
    fetchStatus: String(zustand.fetchStatus),
    dataUpdatedAt: Number(zustand.dataUpdatedAt),
  };
}

/** Die Entwurfsliste, die DER SERVER diesem Konto zeigt — nicht der Cache der Oberfläche. */
async function listeVon(
  token: string,
): Promise<Array<{ id: string; payload: { title?: string } }>> {
  const res = await app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json() as Array<{ id: string; payload: { title?: string } }>;
}

/** Offline erfassen: Titel und Text tippen, speichern — der Vorgang landet in der Warteschlange. */
async function offlineErfassen(titel: string, text: string): Promise<void> {
  const vorher = warteschlange().length;
  await tippe(titelfeld(), titel);
  await tippe(textfeld(), text);
  await click(buttonByText(i18n.t("mob.save")));
  // Der Haltepunkt gehört HIERHER und nicht in jeden Fall einzeln: scheitert schon das Erfassen,
  // soll die Meldung das sagen — und nicht ein späterer Fall über eine leere Warteschlange stolpern
  // und wie ein Befund über den Kontowechsel aussehen.
  expect(
    warteschlange(),
    `„${titel}" wurde nicht in die Warteschlange genommen. Sichtbar: ${seitentext().slice(0, 400)}`,
  ).toHaveLength(vorher + 1);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  anlagen = [];
  antwortVerlieren = false;
  meAntworten = 0;
  sitzungKaputt = false;
  meEintritte = 0;
  meFreigeben();
  netzSchalter(true);
  await konten();
  brueckeSetzen();
});

afterEach(async () => {
  // ZUERST das Tor öffnen: ein zurückgehaltener `/auth/me`-Aufruf hinge sonst über das Ende des
  // Falls hinaus und liefe dem nächsten in die Quere.
  meFreigeben();
  abbauen();
  globalThis.fetch = vorherigerFetch;
  // Mit Ereignis, sonst bleibt der Verbindungsmerker von react-query beim Stand des letzten Falls
  // stehen und der nächste läuft in eine angehaltene Sitzung (s. `netzSchalter`).
  netzSchalter(true);
});

// ================================================================================================
// JOB 4249 R2 · A9 — DER KONTOWECHSEL MITTEN IM SENDELAUF (BENs Gegenprobe aus Runde 1).
// ================================================================================================
//
// DIE LÜCKE, DIE R1 OFFEN LIESS, wörtlich aus BENs Urteil: „In `useOfflineQueue.ts:339` wird das
// Konto einmal gelesen, in Zeile 355 einmal gefiltert. Die Schleife ab Zeile 369 prüft nach einer
// Antwort keinen Kontowechsel. Zeile 409 sendet dadurch den zweiten A-Vorgang als B."
// Seine Messung: `{ bListe: 1, gesendet: 2 }` statt `{ bListe: 0, gesendet: 1 }`.
//
// A1 nebenan konnte das nicht sehen, weil es die Fläche zwischen den Konten NEU AUFBAUT — dann
// gibt es keinen laufenden Sendelauf mehr, der weiterlaufen könnte. Hier bleibt die Fläche stehen
// und nur die SITZUNG wechselt (`sitzungNeuLesen`) — der Weg, den `AuthContext` im Betrieb von
// selbst geht (periodische Auffrischung, Fokuswechsel).
//
// WARUM DER ERSTE AUFRUF TROTZDEM HINAUSGEHT UND DAS RICHTIG IST: Er war zum Zeitpunkt des
// Wechsels bereits unterwegs und trägt die Anmeldedaten seines Absendezeitpunkts — in der Brücke
// hier wird der Kopf beim ABSENDEN gebildet, genau wie ein Browser das Cookie beim Absenden
// anhängt. Zurückholen kann ihn niemand. Die Zusage lautet deshalb nicht „keiner geht mehr raus",
// sondern „KEIN WEITERER geht raus" — und der übrige Vorgang bleibt A zugeordnet liegen.
describe("JOB 4249 R2 · A9 · Kontowechsel WÄHREND des Sendelaufs", () => {
  it("der zweite Vorgang geht nicht als B hinaus — und er bleibt A zugeordnet liegen", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");
    expect(warteschlange(), "es liegen nicht zwei Vorgänge").toHaveLength(2);

    // Der Sendelauf geht los und bleibt beim ERSTEN Aufruf in der Ablage stehen.
    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 50 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der erste Aufruf erreichte die Ablage nicht").toBe(1);
    expect(anlagen, "es ging nicht genau ein Aufruf hinaus").toHaveLength(1);

    // JETZT wechselt das Konto — die Fläche bleibt stehen, der Lauf hängt noch.
    angemeldet = tokenB;
    await sitzungNeuLesen();

    // Und jetzt kommt die Antwort auf den ersten Aufruf zurück.
    ablage.freigeben();
    await act(flush);
    await act(flush);

    // DIE ABNAHME, beide Zahlen in EINER Zusicherung — BENs Messgrössen.
    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
    }).toEqual({ bListe: 0, gesendet: 1 });

    // Der erste Vorgang gehört A — er wurde als A abgeschickt, bevor gewechselt wurde.
    const bestand = await ablage.list();
    expect(bestand, "es steht nicht genau ein Entwurf im Bestand").toHaveLength(1);
    expect(bestand[0]?.originalAuthor, "der Entwurf wurde dem falschen Konto zugeschrieben").toBe(
      kontoA,
    );
    expect((await listeVon(tokenA)).length).toBe(1);

    // KEIN VERLUST: der zweite Vorgang liegt unverändert da — mit A als Eigentümer, nicht gesendet,
    // nicht gelöscht, nicht umgehängt.
    const rest = warteschlange();
    expect(rest, "der zweite Vorgang ist verschwunden").toHaveLength(1);
    expect(rest[0]?.payload.title).toBe("Pumpe P-12 entlüften");
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der zweite Vorgang blieb als laufend stehen").toBe("queued");

    // Und B sieht davon auf seiner Fläche nur eine ZAHL, keinen Titel.
    expect(seitentext(), "B sieht den Entwurfstitel von A").not.toContain("Pumpe P-12 entlüften");
    expect(
      container.querySelector('[data-testid="mob-fremde-vorgaenge"]')?.textContent,
      "B erfährt nicht, dass hier etwas Fremdes liegt",
    ).toContain("(1)");
  });

  it("A10 · KALIBRIERUNG: ohne Kontowechsel läuft derselbe Lauf vollständig durch", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die nach dem ersten Aufruf IMMER abbricht —
    // dann bliebe bei jedem Menschen die halbe Warteschlange liegen, und niemand merkte es.
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");

    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 50 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte).toBe(1);

    // Dieselbe Naht wie oben — nur bleibt das Konto DASSELBE.
    await sitzungNeuLesen();
    ablage.freigeben();
    for (let i = 0; i < 50 && anlagen.length < 2; i++) {
      await act(flush);
    }

    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
    }).toEqual({ gesendet: 2, imBestand: 2, inAsListe: 2 });
    expect(warteschlange(), "nach vollständigem Lauf bleibt nichts liegen").toHaveLength(0);
  });

  it("A11 · die Fläche wird WÄHREND des Laufs verlassen: kein weiterer Aufruf, nichts verloren", async () => {
    // BENs Prüflücke 6, zweiter Teil. Ein Lauf, der das Aushängen überlebt, sendet Vorgänge
    // hinaus, für die niemand mehr zuständig ist — und schreibt sein Ergebnis in einen Zustand,
    // den kein `localStorage` mehr sieht. Der nächste Aufbau nimmt den Rest ohnehin selbst wieder
    // auf (`reviveInterrupted`, F-0027).
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");

    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 50 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte).toBe(1);

    abbauen();
    ablage.freigeben();
    for (let i = 0; i < 30; i++) {
      await act(flush);
    }

    expect(anlagen, "nach dem Aushängen ging ein weiterer Aufruf hinaus").toHaveLength(1);
    expect(await ablage.list(), "es steht nicht genau ein Entwurf im Bestand").toHaveLength(1);
    // Nichts verloren: beide Vorgänge liegen noch im Speicher (der erste als unterbrochener Rest,
    // den der nächste Aufbau wieder aufnimmt — seine Kennung macht die Wiederholung eindeutig).
    const rest = warteschlange();
    expect(rest, "ein Vorgang ist beim Aushängen verschwunden").toHaveLength(2);
    expect(rest.every((op) => op.eigentuemer === kontoA)).toBe(true);

    // UND DER BEWEIS, DASS „NICHTS VERLOREN" MEHR IST ALS EINE ZEILE IM SPEICHER: der nächste
    // Aufbau holt beides nach — und der unterbrochene Erste wird dabei NICHT ein zweites Mal
    // angelegt, weil er seine Vorgangskennung mitbringt.
    await mount();
    for (let i = 0; i < 50 && (await ablage.list()).length < 2; i++) {
      await act(flush);
    }
    expect({
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
      liegtNoch: warteschlange().length,
    }).toEqual({ imBestand: 2, inAsListe: 2, liegtNoch: 0 });
  });

  it("A12 · die Sitzung GEHT VERLOREN während des Laufs: kein weiterer Aufruf, nichts umgehängt", async () => {
    // BENs Prüflücke 6, dritter Teil. Ein Sitzungsverlust ist etwas anderes als ein Kontowechsel:
    // es ist nicht jemand ANDERES da, sondern NIEMAND mehr feststellbar. Die Regel ist dieselbe —
    // ohne bestätigte Bindung geht kein weiterer Vorgang hinaus, und geraten wird nicht.
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");

    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 50 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte).toBe(1);
    expect(anlagen).toHaveLength(1);

    // Die Sitzung ist weg — `/auth/me` antwortet ab jetzt mit 401.
    sitzungKaputt = true;
    await sitzungNeuLesen();
    ablage.freigeben();
    await act(flush);
    await act(flush);

    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
    }).toEqual({ gesendet: 1, imBestand: 1 });

    // Der zweite Vorgang liegt unverändert da — und die Fläche behauptet über ihn NICHTS, weil
    // ohne Sitzung gar nicht entscheidbar ist, wem er gehört.
    const rest = warteschlange();
    expect(rest, "der zweite Vorgang ist verschwunden").toHaveLength(1);
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status).toBe("queued");
    expect(
      container.querySelector('[data-testid="mob-konto-unbekannt"]')?.textContent,
      "ohne Sitzung wird nicht gesagt, woran es liegt",
    ).toContain(i18n.t("mob.konto.unbekannt"));
  });
});

// ================================================================================================
// JOB 4249 R4 · A13/A14 — DAS ZEITFENSTER DER LAUFENDEN AUFFRISCHUNG (BENs Gegenprobe aus R3).
// ================================================================================================
//
// WAS A9 NEBENAN NICHT SIEHT, wörtlich aus BENs Urteil: „Ein Kontowechseltest darf nicht
// ausschliesslich auf die fertige `/auth/me`-Antwort warten. Halte die Auffrischung zurück, während
// Requests bereits als B authentifiziert werden, und gib eine laufende A-Sendeantwort frei. Kein
// weiterer A-Vorgang darf als B angelegt oder lokal entfernt werden."
//
// A9 benutzt `sitzungNeuLesen()` — und das WARTET auf die Antwort. Danach steht im Zwischenspeicher
// bereits B, und der Vergleich in `syncNow` schlägt aus dem einfachen Grund an. Der Befund liegt
// DAVOR: solange die Antwort aussteht, hält react-query die zuletzt geholte Antwort (A) stehen,
// während der Browser schon als B beglaubigt. Der Vergleich prüfte dann zweimal A.
//
// BENs Messgrössen, wörtlich: `{ bListe: 0, gesendet: 1, rest: 1 }`, und der verbleibende Vorgang
// gehört unverändert A.
describe("JOB 4249 R4 · A13 · die Sitzung wird GERADE GEPRÜFT", () => {
  it("kein weiterer Vorgang geht hinaus, und der übrige bleibt unverändert bei A", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");
    expect(warteschlange(), "es liegen nicht zwei Vorgänge").toHaveLength(2);

    // Der Sendelauf geht los und bleibt beim ERSTEN Aufruf in der Ablage stehen.
    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 80 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der erste Aufruf erreichte die Ablage nicht").toBe(1);
    expect(anlagen, "es ging nicht genau ein Aufruf hinaus").toHaveLength(1);

    // JETZT beglaubigt der Browser als B — und die Auffrischung, die das herausfinden würde, wird
    // ZURÜCKGEHALTEN. Die Oberfläche hält weiter A im Zwischenspeicher.
    angemeldet = tokenB;
    meSperren();
    const meVorher = meEintritte;
    await act(async () => {
      void qc?.invalidateQueries({ queryKey: ["auth"] });
      await flush();
    });
    for (let i = 0; i < 80 && meEintritte === meVorher; i++) {
      await act(flush);
    }
    expect(
      meEintritte,
      "die Sitzungsauffrischung lief gar nicht — der Fall misst dann nichts",
    ).toBe(meVorher + 1);

    // Und ERST JETZT kommt die Antwort auf den ersten Aufruf zurück. Die Auffrischung steht noch.
    ablage.freigeben();
    for (let i = 0; i < 40; i++) {
      await act(flush);
    }

    // DIE ABNAHME, BENs drei Messgrössen in EINER Zusicherung.
    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
      rest: warteschlange().length,
    }).toEqual({ bListe: 0, gesendet: 1, rest: 1 });

    // Der erste Vorgang gehört A — er war vor dem Wechsel unterwegs.
    const bestand = await ablage.list();
    expect(bestand, "es steht nicht genau ein Entwurf im Bestand").toHaveLength(1);
    expect(bestand[0]?.originalAuthor, "der Entwurf wurde dem falschen Konto zugeschrieben").toBe(
      kontoA,
    );
    expect((await listeVon(tokenA)).length).toBe(1);

    // „Unverändert A": nicht gesendet, nicht gelöscht, nicht umgehängt, nicht als laufend liegen
    // geblieben.
    const rest = warteschlange();
    expect(rest[0]?.payload.title).toBe("Pumpe P-12 entlüften");
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der zweite Vorgang blieb als laufend stehen").toBe("queued");

    // UND DIE FLÄCHE SAGT ES: der letzte bekannte Stand steht noch (Zustandsmodell §9), daneben
    // steht, dass er gerade bestätigt wird — und der Sendeknopf ist gesperrt, statt einen Lauf
    // anzubieten, den er nicht ausführt.
    expect(
      container.querySelector('[data-testid="mob-konto-auffrischung"]')?.textContent,
      "die Fläche verschweigt die laufende Auffrischung",
    ).toContain(i18n.t("mob.konto.auffrischung"));
    expect(
      buttonByText(i18n.t("mob.syncNow")).disabled,
      "der Sendeknopf bietet einen Lauf an, der nichts sendet",
    ).toBe(true);

    meFreigeben();
  });

  it("A14 · KALIBRIERUNG: wird die Auffrischung freigegeben und bleibt es DASSELBE Konto, läuft der Lauf zu Ende", async () => {
    // OHNE DIESEN FALL wäre auch eine Fassung grün, die bei JEDER laufenden Auffrischung für immer
    // schweigt — und eine Auffrischung ist der Normalfall (alle fünf Minuten, bei Fokuswechsel, bei
    // zurückkehrender Verbindung). Dann bliebe die Warteschlange im Betrieb einfach liegen, und
    // niemand merkte es. Gemessen wird deshalb nicht nur das Anhalten, sondern auch das Weitergehen.
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");

    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 80 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte).toBe(1);

    // Dieselbe Naht wie in A13 — nur bleibt das Konto DASSELBE.
    meSperren();
    const meVorher = meEintritte;
    await act(async () => {
      void qc?.invalidateQueries({ queryKey: ["auth"] });
      await flush();
    });
    for (let i = 0; i < 80 && meEintritte === meVorher; i++) {
      await act(flush);
    }
    expect(meEintritte).toBe(meVorher + 1);

    ablage.freigeben();
    for (let i = 0; i < 40; i++) {
      await act(flush);
    }
    // Angehalten, nicht abgebrochen: bis hierher ist genau EINER draussen.
    expect(anlagen, "während der Auffrischung ging doch ein zweiter Aufruf hinaus").toHaveLength(1);
    expect(warteschlange(), "der zweite Vorgang wurde entsorgt").toHaveLength(1);

    // Die Antwort kommt — und der angehaltene Rest wird von selbst nachgeholt.
    await act(async () => {
      meFreigeben();
      await flush();
    });
    // GEWARTET WIRD AUF DIE ANTWORT, NICHT AUF DAS ABSENDEN. `anlagen` wächst, sobald der Aufruf
    // hinausgeht — wer dort stehen bleibt, misst einen Vorgang mitten im Flug (`status: "pending"`)
    // und hält das für einen Befund. Der Haltepunkt ist deshalb der BESTAND.
    for (let i = 0; i < 120 && (await ablage.list()).length < 2; i++) {
      await act(flush);
    }

    expect(
      {
        gesendet: anlagen.length,
        imBestand: (await ablage.list()).length,
        inAsListe: (await listeVon(tokenA)).length,
        liegtNoch: warteschlange().length,
      },
      `Rest: ${JSON.stringify(warteschlange().map((o) => [o.title, o.status, o.error, o.id]))} · Kennungen: ${JSON.stringify(anlagen.map((a) => a.operationId))}`,
    ).toEqual({ gesendet: 2, imBestand: 2, inAsListe: 2, liegtNoch: 0 });
    expect(
      container.querySelector('[data-testid="mob-konto-auffrischung"]'),
      "der Auffrischungshinweis blieb stehen, obwohl die Antwort da ist",
    ).toBeNull();
  });
});

// ================================================================================================
// JOB 4249 R5 · A15–A17 — DIE ANDERE REIHENFOLGE: SITZUNGSANTWORT ZUERST, RENDERN SPÄTER.
// ================================================================================================
//
// WAS A13 NEBENAN NICHT SIEHT, wörtlich aus BENs Urteil zu Runde 4: „A13 prüft jedoch die
// Reihenfolge ‚Sendeantwort vor Sitzungsantwort'. Die umgekehrte Reihenfolge ohne zwischenzeitliches
// Rendern fehlt und ist reproduzierbar rot." Und seine Prüffrage: „Eine bereits im Query-Cache
// bestätigte neue Kontokennung muss vor dem nächsten Schreibaufruf wirksam sein."
//
// DIE NAHT, um die es geht, ist schmal und trotzdem ganz gewöhnlich: react-query trägt die neue
// Antwort SYNCHRON in den Zwischenspeicher ein und benachrichtigt die React-Beobachter erst danach
// über den `notifyManager` (ein eigener Takt). Zwischen diesen beiden Augenblicken gilt: der
// Speicher weiss schon B, jeder gerenderte Wert sagt noch A — und ein `await`, das genau dort
// zurückkommt, trifft einen Client, der sich für jemand anderen hält.
//
// GENAU DORT WIRD HIER GEMESSEN: `sitzungAntwortetVorDemRendern` hängt sich an den
// Zwischenspeicher und gibt die angehaltene Sendeantwort AUS DESSEN Benachrichtigung heraus frei.
// Kein Zeitgeber, kein geratener Takt — der Haltepunkt ist das Eintreffen der Sitzungsantwort
// selbst.
describe("JOB 4249 R5 · A15 · Sitzungsantwort VOR dem nächsten Rendern", () => {
  /**
   * Die Sitzungsauffrischung anstossen und die angehaltene SENDEANTWORT in dem Augenblick
   * freigeben, in dem die Sitzungsantwort im Zwischenspeicher landet — vor Reacts nächstem Bild.
   * Gibt zurück, ob der Haltepunkt wirklich erreicht wurde.
   */
  async function sitzungAntwortetVorDemRendern(): Promise<void> {
    const cache = qc?.getQueryCache();
    let ausgeloest = false;
    const abmelden = cache?.subscribe((ereignis) => {
      if (ausgeloest || ereignis.type !== "updated") {
        return;
      }
      const schluessel = ereignis.query.queryKey;
      if (!Array.isArray(schluessel) || schluessel[0] !== "auth" || schluessel[1] !== "me") {
        return;
      }
      const zustand = ereignis.query.state;
      // Erledigt heisst erledigt — beantwortet ODER mit Fehler abgeschlossen (Fall A17).
      if (zustand.fetchStatus !== "idle") {
        return;
      }
      if (zustand.status !== "success" && zustand.status !== "error") {
        return;
      }
      ausgeloest = true;
      ablage.freigeben();
    });
    const vorher = meAntworten;
    // AUSDRÜCKLICH NUR `["auth", "me"]` UND NICHT `["auth"]` — und das ist der Unterschied zwischen
    // einem Fall, der misst, und einem, der sich selbst belügt: `["auth", "status"]` mit
    // aufzufrischen stösst `me` ein ZWEITES Mal an (es hängt über `enabled` daran). Dann ist im
    // Augenblick der ersten Antwort schon wieder ein Abruf unterwegs, und jede Fassung hält an —
    // auch eine kaputte. Gemessen an der Rückmutation von Runde 4 war dieser Fall so GRÜN, obwohl
    // das Produkt den Fehler hatte. Ein einzelner `me`-Abruf ist zugleich der häufigere Fall im
    // Betrieb: die periodische Auffrischung (`SESSION_REFRESH_MS`) läuft genau so.
    void qc?.invalidateQueries({ queryKey: KONTO_ABFRAGE });
    for (let i = 0; i < 120 && (!ausgeloest || meAntworten === vorher); i++) {
      await act(flush);
    }
    abmelden?.();
    if (!ausgeloest) {
      throw new Error(
        "die Sitzungsantwort erreichte den Zwischenspeicher nicht — dieser Fall misst dann nichts",
      );
    }
  }

  /** Der gemeinsame Aufbau: zwei Vorgänge von A, der erste hängt in der Ablage. */
  async function zweiVorgaengeUndErsterHaengt(): Promise<void> {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");
    expect(warteschlange(), "es liegen nicht zwei Vorgänge").toHaveLength(2);
    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 80 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der erste Aufruf erreichte die Ablage nicht").toBe(1);
    expect(anlagen, "es ging nicht genau ein Aufruf hinaus").toHaveLength(1);
  }

  /** Die ECHTE `/auth/me`-Antwort des Servers für ein Token — kein erfundener Nutzer. */
  async function meVon(token: string): Promise<unknown> {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  it("die im Speicher bestätigte neue Kennung wirkt VOR dem nächsten Schreibaufruf", async () => {
    await zweiVorgaengeUndErsterHaengt();

    // ==========================================================================================
    // DER SCHNITT, DEN DIESER FALL MISST — und warum er hier OHNE Abruf gemacht wird.
    // ==========================================================================================
    //
    // Gemessen werden soll BENs Satz: „Eine bereits im Query-Cache bestätigte neue Kontokennung
    // muss vor dem nächsten Schreibaufruf wirksam sein." Der Augenblick, um den es geht, liegt
    // zwischen zwei Takten von react-query: der Zwischenspeicher hat die neue Antwort schon, die
    // React-Beobachter werden erst danach benachrichtigt (`notifyManager`, eigener Takt).
    //
    // Über einen echten Abruf ist dieser Augenblick NICHT zuverlässig zu treffen — gemessen: mit
    // der Rückmutation von Runde 4 blieb dieser Fall grün, obwohl das Produkt den Fehler hatte,
    // weil der Abruf mal vor und mal nach dem Rendern ankam. Ein Fall, der den Fehler nur manchmal
    // sieht, ist kein Nachweis.
    //
    // Deshalb steht hier ein SYNCHRONER Block: die Kennung wird in denselben Zwischenspeicher
    // geschrieben, den react-query bei Erfolg selbst beschreibt, und unmittelbar danach kommt die
    // angehaltene Sendeantwort zurück. React kann dazwischen nicht rendern. Die Kennung ist dabei
    // die ECHTE Serverantwort für B (`meVon`), nicht ein erfundener Nutzer.
    //
    // WAS DIESER FALL DAMIT NICHT ZEIGT: den Transportweg. Den decken A13 (angehaltener Abruf) und
    // A17 (echter, gescheiterter Abruf) ab.
    angemeldet = tokenB;
    const antwortFuerB = await meVon(tokenB);
    qc?.setQueryData(KONTO_ABFRAGE, antwortFuerB);
    ablage.freigeben();
    for (let i = 0; i < 40; i++) {
      await act(flush);
    }

    // DIE ABNAHME, BENs drei Messgrössen in EINER Zusicherung.
    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
      rest: warteschlange().length,
    }).toEqual({ bListe: 0, gesendet: 1, rest: 1 });

    const bestand = await ablage.list();
    expect(bestand, "es steht nicht genau ein Entwurf im Bestand").toHaveLength(1);
    expect(bestand[0]?.originalAuthor, "der Entwurf wurde dem falschen Konto zugeschrieben").toBe(
      kontoA,
    );
    expect((await listeVon(tokenA)).length).toBe(1);

    // „Unverändert A": nicht gesendet, nicht gelöscht, nicht umgehängt, nicht als laufend liegen
    // geblieben.
    const rest = warteschlange();
    expect(rest[0]?.payload.title).toBe("Pumpe P-12 entlüften");
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der zweite Vorgang blieb als laufend stehen").toBe("queued");

    // Und B sieht davon nur eine ZAHL, keinen Titel.
    expect(seitentext(), "B sieht den Entwurfstitel von A").not.toContain("Pumpe P-12 entlüften");
  });

  it("A16 · KALIBRIERUNG: dieselbe Reihenfolge mit DEMSELBEN Konto läuft vollständig durch", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die nach jeder Sitzungsantwort abbricht — dann
    // bliebe im Betrieb bei jedem Menschen die halbe Warteschlange liegen. Gemessen wird deshalb
    // nicht nur das Anhalten, sondern auch das Weitergehen.
    await zweiVorgaengeUndErsterHaengt();

    await sitzungAntwortetVorDemRendern();
    for (let i = 0; i < 120 && (await ablage.list()).length < 2; i++) {
      await act(flush);
    }

    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
      liegtNoch: warteschlange().length,
    }).toEqual({ gesendet: 2, imBestand: 2, inAsListe: 2, liegtNoch: 0 });
  });

  it("A17 · dieselbe Reihenfolge mit GESCHEITERTER Auffrischung: nichts geht hinaus, nichts wird umgehängt", async () => {
    // BENs Prüflücke 6, zweiter Teil. Eine gescheiterte Auffrischung ist etwas anderes als ein
    // Kontowechsel: es ist nicht jemand anderes da, sondern niemand mehr feststellbar. Die Regel
    // ist dieselbe — und sie darf nicht erst beim nächsten Rendern greifen.
    await zweiVorgaengeUndErsterHaengt();

    sitzungKaputt = true;
    await sitzungAntwortetVorDemRendern();
    for (let i = 0; i < 40; i++) {
      await act(flush);
    }

    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
      rest: warteschlange().length,
    }).toEqual({ gesendet: 1, imBestand: 1, rest: 1 });
    const rest = warteschlange();
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der zweite Vorgang blieb als laufend stehen").toBe("queued");
  });
});

// ================================================================================================
// JOB 4249 R6 · A18–A22 — DIE NETZRÜCKKEHR: DREI SITZUNGSZUSTÄNDE, EINE REGEL.
// ================================================================================================
//
// BENs Befund aus Runde 5 (Prüfstand e1172ae1ea84), wörtlich: „Bei Netzrückkehr wird As Entwurf
// trotz pausierter Sitzungsauffrischung als B angelegt und lokal entfernt." Gemessen
// `{bListe: 1, gesendet: 1, rest: 0}`, erwartet `{0, 0, 1}`.
//
// GEMESSEN WIRD HIER NICHT EIN FENSTER, SONDERN DIE REGEL, die es schliesst: **eine Bestätigung von
// VOR der Verbindungslücke bestätigt danach nichts mehr.** Deshalb stehen hier drei Zustände der
// Sitzungsabfrage nebeneinander, und jeder wird vor der Abnahme ausdrücklich nachgewiesen, statt
// angenommen:
//   · A18/A19 — `fetchStatus: "paused"` (die Auffrischung wurde OHNE Netz angestossen),
//   · A20/A21 — `fetchStatus: "idle"` mit ALTEM Bestand (react-query frischt gar nicht auf, weil
//     die Antwort jünger ist als `staleTime` — der Betriebsfall der kurzen Lücke),
//   · A22     — `fetchStatus: "paused"` OHNE Verbindungslücke: die Probe, in der allein die
//     Zustandsregel greifen kann, weil die Frischeregel nichts zu beanstanden hat.
// `fetchStatus: "fetching"` deckt A13/A14 ab, die erledigte Antwort vor dem Rendern A15–A17.
//
// UND JEDE SPERRE HAT IHRE KALIBRIERUNG DANEBEN (A19, A21): eine Fassung, die nach einer
// Verbindungslücke für immer schweigt, wäre ebenso falsch — dann bliebe im Betrieb jede
// Warteschlange liegen, und niemand merkte es.
describe("JOB 4249 R6 · A18 · Netzrückkehr nach ANGEHALTENER Sitzungsauffrischung", () => {
  it("paused → online mit Kontowechsel: nichts geht hinaus, der Rest gehört unverändert A", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");
    expect(warteschlange(), "es liegt kein Vorgang").toHaveLength(1);

    // Die Auffrischung wird OHNE NETZ angestossen — genau BENs Ablauf. react-query kann sie nicht
    // fahren und hält sie an. Nichts ist unterwegs, und trotzdem ist nichts bestätigt.
    await act(async () => {
      void qc?.invalidateQueries({ queryKey: KONTO_ABFRAGE });
      await flush();
    });
    expect(
      sitzungsabfrage().fetchStatus,
      "die Auffrischung ist nicht angehalten — dieser Fall misst dann nicht, was er behauptet",
    ).toBe("paused");

    // Am Server ist ab jetzt B angemeldet; die Oberfläche weiss davon nichts — die Antwort, die es
    // ihr sagen würde, ist genau die angehaltene.
    angemeldet = tokenB;

    await netzZurueckMelderZuerst();

    // DIE ABNAHME — BENs drei Messgrössen, wörtlich seine Erwartung.
    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
      rest: warteschlange().length,
    }).toEqual({ bListe: 0, gesendet: 0, rest: 1 });

    // Nichts angelegt — auch nicht unter A.
    expect(await ablage.list(), "es wurde doch ein Entwurf angelegt").toHaveLength(0);

    // „Der Rest gehört A": nicht gesendet, nicht gelöscht, nicht umgehängt, nicht als laufend
    // stehengeblieben.
    const rest = warteschlange();
    expect(rest[0]?.payload.title).toBe("Ventil bei Überdruck");
    expect(rest[0]?.eigentuemer, "der Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der Vorgang blieb als laufend stehen").toBe("queued");

    // Und B sieht davon keinen Titel — nur, dass hier etwas liegt.
    expect(seitentext(), "B sieht den Entwurfstitel von A").not.toContain("Ventil bei Überdruck");
  });

  it("A19 · KALIBRIERUNG: derselbe Übergang mit UNVERÄNDERTEM Konto — erst die Bestätigung, dann alles", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die nach jeder Verbindungslücke für immer
    // schweigt. Gemessen wird deshalb beides: das Anhalten UND das Weitergehen.
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");

    await act(async () => {
      void qc?.invalidateQueries({ queryKey: KONTO_ABFRAGE });
      await flush();
    });
    expect(sitzungsabfrage().fetchStatus).toBe("paused");
    const meVorDerRueckkehr = meAntworten;

    await netzZurueckMelderZuerst();
    for (let i = 0; i < 120 && (await ablage.list()).length < 1; i++) {
      await act(flush);
    }

    // ERST DIE BESTÄTIGUNG, DANN DAS SENDEN — und nicht umgekehrt: die angehaltene Auffrischung ist
    // beantwortet worden, bevor der erste Schreibaufruf hinausging.
    expect(
      meAntworten,
      "die angehaltene Auffrischung wurde nie beantwortet — dann sagt der Fall nichts über die Reihenfolge",
    ).toBeGreaterThan(meVorDerRueckkehr);
    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
      liegtNoch: warteschlange().length,
    }).toEqual({ gesendet: 1, imBestand: 1, inAsListe: 1, liegtNoch: 0 });
  });
});

describe("JOB 4249 R6 · A20 · Netzrückkehr mit ALTEM Bestand im Zustand „idle“", () => {
  /**
   * Der Betriebsfall der kurzen Lücke: Die Sitzungsantwort ist jünger als `staleTime` (30 s), also
   * frischt react-query bei zurückkehrender Verbindung GAR NICHT auf — die Abfrage bleibt `idle`,
   * und die Kennung von vorhin stünde unangefochten da. Es ist nichts unterwegs und nichts
   * angehalten; wer nur auf `fetchStatus` sieht, hält diese Lage für bestätigt. BENs Prüflücke 6.
   */
  async function offlineErfassenMitBetriebsfrist(): Promise<void> {
    await mount({ staleTime: 30_000 });
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");
    expect(warteschlange(), "es liegt kein Vorgang").toHaveLength(1);
    const abfrage = sitzungsabfrage();
    expect(
      { status: abfrage.status, fetchStatus: abfrage.fetchStatus },
      "die Sitzungsabfrage ist nicht im gemessenen Zustand — dieser Fall misst dann etwas anderes",
    ).toEqual({ status: "success", fetchStatus: "idle" });
  }

  it("das Konto hat gewechselt: nichts geht hinaus, der Rest gehört unverändert A", async () => {
    await offlineErfassenMitBetriebsfrist();
    angemeldet = tokenB;

    await netzZurueckMelderZuerst();

    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
      rest: warteschlange().length,
    }).toEqual({ bListe: 0, gesendet: 0, rest: 1 });
    expect(await ablage.list(), "es wurde doch ein Entwurf angelegt").toHaveLength(0);

    const rest = warteschlange();
    expect(rest[0]?.eigentuemer, "der Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der Vorgang blieb als laufend stehen").toBe("queued");
  });

  it("A21 · KALIBRIERUNG: dasselbe Konto — die Bestätigung wird GEHOLT, dann geht alles hinaus", async () => {
    // DIESER FALL IST DIE PROBE AUF DEN STILLSTAND. Hier frischt react-query von sich aus nichts
    // auf (die Antwort ist jünger als `staleTime`, es läuft kein Zeitgeber). Wenn der Sendeweg die
    // fehlende Bestätigung nicht selbst anfordert, bleibt die Warteschlange für immer liegen — im
    // Betrieb bis zur nächsten periodischen Abfrage, fünf Minuten später. Genau der Weg, den F-0027
    // verspricht, wäre wieder zu.
    await offlineErfassenMitBetriebsfrist();
    const meVorDerRueckkehr = meAntworten;

    await netzZurueckMelderZuerst();
    for (let i = 0; i < 120 && (await ablage.list()).length < 1; i++) {
      await act(flush);
    }

    expect(
      meAntworten,
      "es wurde keine Bestätigung geholt — dann hängt die Warteschlange an einem Zufall",
    ).toBeGreaterThan(meVorDerRueckkehr);
    expect({
      gesendet: anlagen.length,
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
      liegtNoch: warteschlange().length,
    }).toEqual({ gesendet: 1, imBestand: 1, inAsListe: 1, liegtNoch: 0 });
  });
});

describe("JOB 4249 R6 · A22 · angehaltene Auffrischung OHNE Verbindungslücke", () => {
  it("der laufende Sendelauf hält an — allein wegen des Zustands, nicht wegen der Frist", async () => {
    // ============================================================================================
    // DIE PROBE, DIE DEN ZUSTAND „paused" ISOLIERT — und warum es sie braucht.
    // ============================================================================================
    //
    // A18 wird von ZWEI Regeln gedeckt: der Zustand ist angehalten UND die Bestätigung stammt von
    // vor der Lücke. Eine Kalibrierung, die beide zugleich trifft, sagt über keine von beiden
    // etwas. Hier ist die Frischeregel deshalb erfüllt (die Bestätigung ist NACH der Lücke geholt
    // worden, das misst `dataUpdatedAt` unten) — bleibt allein der Zustand.
    //
    // WAS HIER GESTELLT WIRD UND WAS NICHT: `onlineManager.setOnline(false)` sagt react-query, dass
    // es nicht fahren kann; `navigator.onLine` bleibt `true`, es gibt also KEIN `offline`-Ereignis
    // und keine neue Lücke. Das ist die Lage, in der react-query eine Auffrischung anhält, während
    // die Warteschlange sich für sendefähig hält — im Betrieb der abgebrochene Abruf, dessen
    // Wiederholung react-query zurückstellt. Eine Aussage über den Browser ist damit NICHT
    // verbunden; gemessen wird der Zustand, nicht der Weg dorthin.
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Erster Vorgang, ohne Netz.");
    await offlineErfassen("Pumpe P-12 entlüften", "Zweiter Vorgang, ohne Netz.");

    // Die Verbindung kommt zurück, die Bestätigung wird geholt, der erste Aufruf hängt in der
    // Ablage. Ab hier ist die Bestätigung JÜNGER als die Lücke.
    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 120 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der erste Aufruf erreichte die Ablage nicht").toBe(1);
    expect(anlagen, "es ging nicht genau ein Aufruf hinaus").toHaveLength(1);
    const bestaetigtUm = sitzungsabfrage().dataUpdatedAt;

    // JETZT: das Konto wechselt, und die Auffrischung, die das herausfände, wird angehalten.
    angemeldet = tokenB;
    await act(async () => {
      onlineManager.setOnline(false);
      void qc?.invalidateQueries({ queryKey: KONTO_ABFRAGE });
      await flush();
    });
    const abfrage = sitzungsabfrage();
    expect(
      { fetchStatus: abfrage.fetchStatus, frischer: abfrage.dataUpdatedAt === bestaetigtUm },
      "die Lage ist nicht die gemessene — angehalten UND mit einer Bestätigung von NACH der Lücke",
    ).toEqual({ fetchStatus: "paused", frischer: true });

    // Und jetzt kommt die Antwort auf den ersten Aufruf zurück — der Lauf will weitermachen.
    ablage.freigeben();
    for (let i = 0; i < 60; i++) {
      await act(flush);
    }

    expect({
      bListe: (await listeVon(tokenB)).length,
      gesendet: anlagen.length,
      rest: warteschlange().length,
    }).toEqual({ bListe: 0, gesendet: 1, rest: 1 });
    const rest = warteschlange();
    expect(rest[0]?.payload.title).toBe("Pumpe P-12 entlüften");
    expect(rest[0]?.eigentuemer, "der zweite Vorgang wurde umgehängt").toBe(kontoA);
    expect(rest[0]?.status, "der zweite Vorgang blieb als laufend stehen").toBe("queued");
  });
});

describe("JOB 4249 · A1 · Kontowechsel am selben Gerät", () => {
  it("A erfasst offline, B meldet sich an: nichts geht als B hinaus — und nichts wird gelöscht", async () => {
    // ---------------------------------------------------------------------------------------- A
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");

    const liegend = warteschlange();
    expect(liegend, "der Vorgang liegt nicht in der Warteschlange").toHaveLength(1);
    expect(liegend[0]?.kind).toBe("draft.create");

    // ==========================================================================================
    // NEULADEN, NOCH IMMER OHNE NETZ — und hier steht eine GRENZE, die benannt gehört.
    // ==========================================================================================
    //
    // Der Vorgang ist da: `localStorage` hält ihn, vollzählig. Die FLÄCHE kann ihn in dieser Lage
    // aber niemandem zuordnen: react-query hält Abfragen ohne Verbindung an (`networkMode`), die
    // Sitzung ist nach einem Neuaufbau also nicht abrufbar — und ein Gerät, das sich an die
    // zuletzt bekannte Person ERINNERT, wäre eine zweite Wahrheit darüber, wer hier angemeldet
    // ist. Genau die soll es nicht geben.
    //
    // Was hier steht, ist deshalb der ehrliche Satz („es liegt etwas, wer du bist steht gerade
    // nicht fest, es wird nichts gesendet und nichts gelöscht") — und ausdrücklich KEINE
    // Zuordnung, KEINE Verneinung und kein fremder Titel. Sobald Verbindung besteht, steht die
    // Sitzung wieder, und die eigene Arbeit ist sichtbar (Fall A3).
    abbauen();
    await mount();
    expect(warteschlange(), "nach dem Neuladen ist der Vorgang weg").toHaveLength(1);
    expect(
      container.querySelector('[data-testid="mob-konto-unbekannt"]')?.textContent,
      "ohne feststellbares Konto wird nicht gesagt, woran es liegt",
    ).toContain(i18n.t("mob.konto.unbekannt"));
    expect(anlagen, "ohne feststellbares Konto ging etwas hinaus").toHaveLength(0);

    // -------------------------------------------------------------------------- Kontowechsel → B
    // DER WECHSEL GESCHIEHT NOCH OHNE NETZ, und das ist kein Kunstgriff, sondern der Fall: A kommt
    // mit einem vollen Gerät vom Einsatz zurück, gibt es aus der Hand, B meldet sich an — und ERST
    // DANN ist wieder Verbindung da. Käme sie vorher, hätte A seinen eigenen Vorgang längst selbst
    // gesendet, und der Fall wäre aus dem falschen Grund grün.
    await kontoWechselnUndNeuLaden(tokenB);
    // Jetzt kommt die Verbindung: der AUTOMATISCHE Sendelauf (`online`-Ereignis, F-0027) …
    await netz(true);
    // … und danach der MANUELLE. Beide müssen schweigen.
    await click(buttonByText(i18n.t("mob.syncNow")));

    // DIE ABNAHME, in einer Zusicherung: Bs Liste ist unberührt, und im Bestand steht nichts.
    expect({
      bListe: (await listeVon(tokenB)).length,
      imBestand: (await ablage.list()).length,
      alsBAngelegt: anlagen.length,
    }).toEqual({ bListe: 0, imBestand: 0, alsBAngelegt: 0 });

    // NICHTS WIRD STILL GELÖSCHT: As Vorgang liegt vollzählig weiter im Speicher.
    const nachB = warteschlange();
    expect(nachB, "As Vorgang wurde entsorgt oder umgehängt").toHaveLength(1);
    expect(nachB[0]?.payload.title).toBe("Ventil bei Überdruck");

    // UND B SIEHT NICHTS FREMDES: der Titel von A steht nicht auf Bs Fläche.
    expect(seitentext(), "B sieht den Entwurfstitel von A").not.toContain("Ventil bei Überdruck");
  });

  it("A3 · A kommt zurück: die eigenen Vorgänge sind vollzählig da und gehen hinaus", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");
    await kontoWechselnUndNeuLaden(tokenB);
    await netz(true);
    await click(buttonByText(i18n.t("mob.syncNow")));
    expect(await ablage.list(), "als B ging etwas hinaus").toHaveLength(0);

    // B sieht, WAS hier liegt und wie es weitergeht — eine Zahl, kein fremder Titel.
    const fremdzeile = container.querySelector('[data-testid="mob-fremde-vorgaenge"]');
    expect(fremdzeile, "B erfährt nicht, dass hier etwas Fremdes liegt").not.toBeNull();
    expect(fremdzeile?.textContent).toContain(i18n.t("mob.konto.fremdeWarten"));
    expect(fremdzeile?.textContent, "die Zahl fehlt").toContain("(1)");
    expect(fremdzeile?.textContent, "der fremde Titel steht doch da").not.toContain(
      "Ventil bei Überdruck",
    );
    expect(
      container.querySelector('[data-testid="mob-eigene-leer"]')?.textContent,
      "B erfährt nicht, dass von ihm selbst nichts wartet",
    ).toContain(i18n.t("mob.konto.eigeneLeer"));

    // A ist wieder da: der Aufbau-Anlauf sendet die eigenen Vorgänge (F-0027).
    await kontoWechselnUndNeuLaden(tokenA);

    const bestand = await ablage.list();
    expect(bestand, "As Vorgang ging nach der Rückkehr nicht hinaus").toHaveLength(1);
    expect(bestand[0]?.originalAuthor, "der Entwurf wurde dem falschen Konto zugeschrieben").toBe(
      kontoA,
    );
    expect((await listeVon(tokenA)).length).toBe(1);
    expect((await listeVon(tokenB)).length).toBe(0);
    expect(kontoA).not.toBe(kontoB);
  });
});

describe("JOB 4249 · A2 · Antwortverlust nach erfolgter Anlage", () => {
  it("Neuladen und Wiederholung führen zu GENAU EINEM Entwurf", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");

    // Die Verbindung kommt zurück — der Server legt an, die Antwort geht verloren.
    antwortVerlieren = true;
    await netz(true);
    await act(flush);
    expect(anlagen, "es ging kein Anlageversuch hinaus").toHaveLength(1);
    expect(await ablage.list(), "der Server hat nicht angelegt").toHaveLength(1);
    expect(warteschlange(), "der Vorgang wurde trotz unbekanntem Ausgang entfernt").toHaveLength(1);
    // EHRLICHKEIT VOR OPTIK: gemeldet wird erst nach BESTÄTIGTER Anlage. Hier ist nichts bestätigt.
    expect(meldungstext(), "es wurde Erfolg gemeldet, obwohl keine Antwort kam").not.toContain(
      i18n.t("mob.syncOk"),
    );

    // Neuladen und Wiederholung — diesmal kommt die Antwort an. Die Wiederholung ist der
    // Aufbau-Anlauf (F-0027): genau der Weg, den ein Mensch geht, der die Seite neu lädt.
    antwortVerlieren = false;
    abbauen();
    await mount();

    expect(anlagen, "der zweite Versuch ging nicht hinaus").toHaveLength(2);

    // DIE ABNAHME ZUERST, und beide Zahlen in EINER Zusicherung: was der Mensch am Ende sieht, ist
    // die Anzahl der Entwürfe — im Bestand wie in seiner Liste. Stünde die Kennungsprüfung davor,
    // bräche ein roter Lauf dort ab, und genau diese Zahlen stünden nirgends (Lehre JOB 2697 D7,
    // wo eine Gegenmutation zuerst an der Kennungsprüfung abbrach).
    expect({
      imBestand: (await ablage.list()).length,
      inAsListe: (await listeVon(tokenA)).length,
    }).toEqual({ imBestand: 1, inAsListe: 1 });

    // Und danach der GRUND: beide Versuche trugen dieselbe, nicht leere Vorgangskennung.
    expect(anlagen[0]?.operationId, "der Client schickte gar keine Vorgangskennung").toBeTruthy();
    expect(anlagen[1]?.operationId, "die Wiederholung trug eine NEUE Kennung").toBe(
      anlagen[0]?.operationId,
    );
    // Jetzt — und erst jetzt — steht der Erfolg auf der Fläche, und die Warteschlange ist leer.
    await act(flush);
    expect(meldungstext(), "der bestätigte Erfolg wurde nicht gemeldet").toContain(
      i18n.t("mob.syncOk"),
    );
    expect(warteschlange(), "der bestätigte Vorgang blieb liegen").toHaveLength(0);
  });
});

describe("JOB 4249 · A4 · alter Bestand ohne Bindung", () => {
  it("bleibt vollzählig liegen — nicht zugeordnet, nicht gelöscht", async () => {
    // Ein Rest aus einer Sitzung VOR diesem Auftrag: kein Eigentümerfeld.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "alt-1",
          kind: "draft.create",
          draftId: null,
          payload: { title: "Altbestand ohne Bindung", statement: "aus einer früheren Sitzung" },
          status: "queued",
          error: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          title: "Altbestand ohne Bindung",
        },
      ]),
    );

    await mount();
    await click(buttonByText(i18n.t("mob.syncNow")));

    expect(
      await ablage.list(),
      "der ungebundene Rest wurde dem angemeldeten Konto zugeschlagen",
    ).toHaveLength(0);
    expect(anlagen, "der ungebundene Rest ging hinaus").toHaveLength(0);

    // Abmelden, neu laden — er ist immer noch vollzählig da.
    await kontoWechselnUndNeuLaden(tokenB);
    const nach = warteschlange();
    expect(nach, "der ungebundene Rest wurde gelöscht").toHaveLength(1);
    expect(nach[0]?.id).toBe("alt-1");
    expect(
      (nach[0] as unknown as { eigentuemer?: string }).eigentuemer,
      "der ungebundene Rest wurde still einem Konto zugeordnet",
    ).toBeUndefined();
  });
});

describe("JOB 4249 · A7 · Rechteentzug und normale Wiederanmeldung", () => {
  it("der Entzug verliert nichts und erfindet keine Sperre — nach der Rückgabe geht es hinaus", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");

    // Anna verliert das Schreibrecht, während ihr Vorgang wartet.
    await rolleSetzen(kontoA, "viewer");
    const ohneRecht = await anmelden("anna@x.de");
    abbauen();
    angemeldet = ohneRecht.token;
    await netz(true);
    await mount();
    await act(flush);

    // KEIN STILLER VERLUST: der Vorgang liegt weiter da — als gescheitert, nicht als verschwunden.
    const nachEntzug = warteschlange();
    expect(nachEntzug, "der Vorgang wurde beim Rechteentzug entsorgt").toHaveLength(1);
    expect(nachEntzug[0]?.status).toBe("failed");
    expect(await ablage.list(), "ohne Schreibrecht wurde trotzdem angelegt").toHaveLength(0);
    // UND KEINE ERFUNDENE SPERRE: es ist immer noch IHR Vorgang. Die Fläche darf ihn deshalb
    // nicht plötzlich als fremd oder ungebunden ausgeben — der Fehler kam vom Server, nicht von
    // der Identität.
    expect(nachEntzug[0]?.eigentuemer, "der Vorgang wurde umgehängt").toBe(kontoA);
    expect(seitentext(), "der eigene Vorgang ist von der Fläche verschwunden").toContain(
      "Ventil bei Überdruck",
    );
    expect(
      container.querySelector('[data-testid="mob-fremde-vorgaenge"]'),
      "der eigene Vorgang wird als fremd ausgegeben",
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mob-ungebundene-vorgaenge"]'),
      "der eigene Vorgang wird als ungebunden ausgegeben",
    ).toBeNull();

    // Das Recht kommt zurück, Anna meldet sich normal wieder an — dieselbe Kennung, neues Token.
    await rolleSetzen(kontoA, "experte");
    const wieder = await anmelden("anna@x.de");
    expect(wieder.id, "die Kennung hat sich beim Wiederanmelden geändert").toBe(kontoA);
    abbauen();
    angemeldet = wieder.token;
    await mount();
    await act(flush);

    const bestand = await ablage.list();
    expect(bestand, "nach der Rückgabe des Rechts ging der Vorgang nicht hinaus").toHaveLength(1);
    expect(bestand[0]?.originalAuthor).toBe(kontoA);
    expect(warteschlange(), "der erledigte Vorgang blieb liegen").toHaveLength(0);
  });
});

describe("JOB 4249 · A6 · Nebenlauf zweier Sendeläufe", () => {
  it("zwei verschränkte Läufe derselben Warteschlange erzeugen EINEN Entwurf", async () => {
    await mount();
    await netz(false);
    await offlineErfassen("Ventil bei Überdruck", "Unterwegs erfasst, ohne Netz.");
    expect(warteschlange(), "der Vorgang liegt nicht in der Warteschlange").toHaveLength(1);
    abbauen();

    // Neuaufbau, NOCH OHNE NETZ — so bleibt der Aufbau-Anlauf aussen vor, und Lauf 1 hat genau
    // einen Auslöser: die zurückkehrende Verbindung.
    await mount();
    const ersteFlaeche = container;
    const ersteWurzel = root;

    // Lauf 1 geht los und hängt zwischen Absenden und Antwort (Barriere in der Ablage).
    ablage.sperren();
    await netz(true);
    for (let i = 0; i < 50 && ablage.eintritte < 1; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der erste Lauf erreichte die Ablage nicht").toBe(1);
    expect(anlagen, "der erste Lauf schickte nichts ab").toHaveLength(1);
    expect(await ablage.list(), "es wurde bereits geschrieben").toHaveLength(0);

    // Lauf 2 startet, WÄHREND Lauf 1 steht: ein zweiter Aufbau derselben Warteschlange (zweiter
    // Tab / Neustart mitten im Flug). Sein `load()` nimmt den unterbrochenen Vorgang wieder auf
    // (`reviveInterrupted`, F-0027) und schickt ihn los — der erste Lauf hängt ja noch.
    root = null;
    await mount();
    for (let i = 0; i < 50 && ablage.eintritte < 2; i++) {
      await act(flush);
    }
    expect(ablage.eintritte, "der zweite Lauf überlappte den ersten nicht").toBe(2);

    ablage.freigeben();
    await act(flush);
    await act(flush);

    expect(anlagen, "es gingen nicht zwei Anlageaufrufe hinaus").toHaveLength(2);
    expect(anlagen[1]?.operationId, "der zweite Lauf war ein NEUER Vorgang").toBe(
      anlagen[0]?.operationId,
    );
    expect(await ablage.list(), "der Nebenlauf hat zwei Entwürfe hinterlassen").toHaveLength(1);

    act(() => ersteWurzel?.unmount());
    ersteFlaeche.remove();
  });
});
