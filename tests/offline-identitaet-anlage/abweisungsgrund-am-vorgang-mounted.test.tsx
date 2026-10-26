// @vitest-environment jsdom
// ================================================================================================
// JOB 4354 · ENTWURF-MOBIL-DESKTOP-R — DER GRUND DER ABWEISUNG STEHT AM VORGANG.
// ================================================================================================
//
// DER BEFUND, den JOB 4249 R8 hinterlassen hat: Weist der Server einen nachgesendeten Vorgang ab,
// KOMMT der übersetzte Satz am Gerät an — `useOfflineQueue` legt ihn über `errMsg(e)` in
// `op.error` (`markFailed`, `lib/offlineQueue.ts`). Gesehen hat ihn niemand: die Fläche zeigte am
// Eintrag nur die Marke „Fehler" und darüber den Sammel-Toast „Sync fehlgeschlagen (1)". Wer nicht
// erfährt, dass der Vorgang einem ANDEREN KONTO gehört, drückt weiter auf „Synchronisieren".
//
// GEMESSEN WIRD DIE GANZE KETTE, und zwar mit dem VORHANDENEN Meldungskatalog: echte Ablage
// (`InMemoryDraftRepo`) → echter Dienst (`CaptureService`) → echte Route (`POST /api/drafts` über
// `buildApp`/`app.inject`) → echter Katalog (`services/auth/src/meldungen.ts`,
// `DRAFT_OWNER_MISMATCH`) → echter Client (`endpoints.drafts.create`, `ApiError`) → echte
// Warteschlange (echtes `localStorage`) → echte Oberfläche (`Mobile`, gemountet). Kein
// nachgebauter Satz, kein zweiter Katalog, kein Stub der Serverantwort.
//
// WIE DIE ABWEISUNG ENTSTEHT — der Fall, für den `expectedOwner` gebaut wurde (JOB 4249 R6):
// Welches Cookie der Browser an einen Schreibaufruf hängt, entscheidet sich ERST beim Absenden.
// Die Brücke hier bildet genau das ab: die SITZUNG wird durchweg als A beantwortet
// (`/api/auth/me` mit As Token), der SCHREIBAUFRUF geht mit Bs Token hinaus. Der Vorgang trägt
// `expectedOwner = A`, kommt als B an — der Server legt nichts an und antwortet 409
// `DRAFT_OWNER_MISMATCH` in der Sprache der Sitzung. Dass er das tut, ist unabhängig gemessen
// (`fremder-schluessel-gibt-nichts-heraus.test.ts`, S6/S6a/S6b/S6c); hier wird gemessen, was
// DANACH mit dem Satz geschieht.
//
// ZWEI HÄLFTEN, GETRENNT GEMESSEN (Vorschlag BEN, 4249 R8):
//   (a) ANKUNFT  — `op.error` im `localStorage` trägt wörtlich den Satz des Katalogs.
//   (b) SICHTBAR — derselbe Satz steht im gerenderten Dokument, an einer Stelle, die nicht
//                  ausgeblendet ist (Elternkette: `display`, `visibility`, `opacity`,
//                  `aria-hidden`, `hidden`), und er ist der GANZE Text dieser Stelle.
// Die Gegenproben unten blenden genau dieses Element aus bzw. rendern es nicht: (b) wird rot,
// (a) bleibt grün. Ohne diese Trennung wäre „der Satz kommt an" und „der Satz steht da" ein Satz —
// und genau dazwischen lag der Befund dieses Auftrags.
//
// EHRLICHE GRENZE DIESER DATEI: jsdom rechnet kein Layout, wendet keine Media Query an und lädt
// das Tailwind-CSS der App nicht. „Sichtbar" heisst hier deshalb: gerendert und in der Elternkette
// nicht ausgeblendet — NICHT „bei 390 px vollständig lesbar, nichts abgeschnitten". Diese Frage
// misst für diese Fläche der Schmalmesser nebenan
// (`tests/entwurf-mobil-desktop/rueckfrage-schmal-chromium.test.tsx`); sie ist für diesen Auftrag
// nicht beauftragt und wird hier auch nicht behauptet. Ebenso kennt jsdom keine Tabulator-Taste:
// die Fokusfolge wird mit dem Standardselektor berechnet und Station für Station angesprungen
// (dieselbe Bauform und dieselbe Begründung wie
// `tests/app/mobile-drawer-keyboard-reach-mounted.test.tsx`).
import { afterEach, describe, expect, it } from "vitest";

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
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const STORAGE_KEY = "kw.offlineQueue.v1";
const TITEL = "Ventil bei Überdruck schliessen";
const TEXT = "Unterwegs erfasst, ohne Netz.";

type Sprache = "de" | "en" | "nl";

/** Der Satz, den der Server in dieser Sprache schickt — aus dem VORHANDENEN Katalog, nicht getippt. */
function katalogsatz(sprache: Sprache): string {
  return MELDUNGEN.DRAFT_OWNER_MISMATCH[sprache];
}

// ------------------------------------------------------------------------------------------------
// Der Prüfstand: eine echte App, zwei echte Konten, eine Brücke von `fetch` nach `app.inject`.
// ------------------------------------------------------------------------------------------------
let ablage: InMemoryDraftRepo;
let app: ReturnType<typeof buildApp>;
let tokenA = "";
let tokenB = "";
let kontoA = "";
/** Das Token, mit dem die SITZUNG beantwortet wird — das ist „wer ist angemeldet". */
let angemeldet = "";
/**
 * Das Token, mit dem der SCHREIBAUFRUF hinausgeht. Im Normalfall dasselbe; für den Messfall ein
 * anderes — genau die Naht, an der `expectedOwner` hängt (JOB 4249 R6): der Client kann nicht
 * bestimmen, welche Anmeldedaten der Browser beim Absenden anhängt.
 */
let schreibToken = "";
/** Jeder abgesendete Anlage-Rumpf, in Reihenfolge — der Beleg, dass der echte Weg gefahren ist. */
let anlagen: Array<Record<string, unknown>> = [];
/** Wie oft `/api/auth/me` beantwortet wurde — daran hängt das Ende des Aufbaus (s. `mount`). */
let meAntworten = 0;
let vorherigerFetch: typeof globalThis.fetch;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function konten(): Promise<void> {
  ablage = new InMemoryDraftRepo();
  app = buildApp({ ...buildServices(), capture: new CaptureService({ repo: ablage }) });
  // Das erste Konto wird Erstadministrator (SCRUM-504). A und B entstehen DANACH als gewöhnliche
  // Schreibende — ein Administrator sähe ohnehin jeden Entwurf.
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
  const chefKopf = { authorization: `Bearer ${String(chef.json().token)}` };
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
  const anmelden = async (mail: string): Promise<{ token: string; id: string }> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: mail, password: "passwort12" },
    });
    const koerper = res.json() as { token: string; user: { id: string } };
    return { token: String(koerper.token), id: String(koerper.user.id) };
  };
  const a = await anmelden("anna@x.de");
  const b = await anmelden("bert@x.de");
  tokenA = a.token;
  kontoA = a.id;
  tokenB = b.token;
  angemeldet = tokenA;
  schreibToken = tokenA;
}

function brueckeSetzen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit | undefined).forEach((wert, name) => {
      kopf[name] = wert;
    });
    const istAnlage = methode === "POST" && url.endsWith("/api/drafts");
    // Der Kopf wird beim ABSENDEN gebildet, wie ein Browser das Cookie beim Absenden anhängt.
    kopf.authorization = `Bearer ${istAnlage ? schreibToken : angemeldet}`;
    if (istAnlage) {
      anlagen.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url: url.replace(/^https?:\/\/[^/]+/, ""),
      headers: kopf,
      ...(init?.body !== undefined && init?.body !== null ? { payload: String(init.body) } : {}),
    });
    if (url.endsWith("/api/auth/me")) {
      meAntworten += 1;
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

async function mount(): Promise<void> {
  const meVorher = meAntworten;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
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
                // Die Meldungen gehören dazu: ohne sie wäre „der Sammel-Toast bleibt" nicht messbar.
                createElement(ToastViewport),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Der Aufbau ist erst fertig, wenn die Sitzung steht — gewartet wird auf die ANTWORT, nicht auf
  // eine geratene Anzahl Durchläufe.
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

function warteschlange(): VorgangMitStand[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as VorgangMitStand[];
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Die Meldungen hängen am Dokument, nicht im Seitencontainer. */
function meldungstext(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}" nicht gefunden. Sichtbar: ${seitentext().slice(0, 400)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
  await act(flush);
}

async function tippe(el: HTMLInputElement | HTMLTextAreaElement, wert: string): Promise<void> {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function offlineErfassen(): Promise<void> {
  const titel = container.querySelector("input");
  const text = container.querySelector("textarea");
  if (!(titel instanceof HTMLInputElement) || !(text instanceof HTMLTextAreaElement)) {
    throw new Error(`Formular nicht gefunden. Sichtbar: ${seitentext().slice(0, 400)}`);
  }
  await tippe(titel, TITEL);
  await tippe(text, TEXT);
  await click(buttonByText(i18n.t("mob.save")));
  expect(
    warteschlange(),
    `„${TITEL}" wurde nicht in die Warteschlange genommen. Sichtbar: ${seitentext().slice(0, 400)}`,
  ).toHaveLength(1);
}

// ------------------------------------------------------------------------------------------------
// SICHTBARKEIT IM DOM — die Elternkette, nicht die blosse Anwesenheit.
// ------------------------------------------------------------------------------------------------
//
// `textContent` eines vorhandenen Knotens sagt NICHTS darüber, ob ein Mensch ihn sieht (Lehre §9,
// 4249 R7). Geprüft wird deshalb jede Stufe bis zum Dokument: `display`, `visibility`, `opacity`,
// `hidden` und `aria-hidden` — und am Textträger zusätzlich die Textfarbe.
function ausgeblendet(el: Element): string | null {
  let knoten: Element | null = el;
  while (knoten && knoten !== document.documentElement) {
    if (knoten.getAttribute("aria-hidden") === "true") {
      return `aria-hidden an <${knoten.tagName.toLowerCase()}>`;
    }
    if (knoten instanceof HTMLElement && knoten.hidden) {
      return `hidden an <${knoten.tagName.toLowerCase()}>`;
    }
    const stil = getComputedStyle(knoten);
    if (stil.display === "none") {
      return `display:none an <${knoten.tagName.toLowerCase()}>`;
    }
    if (stil.visibility === "hidden" || stil.visibility === "collapse") {
      return `visibility:${stil.visibility} an <${knoten.tagName.toLowerCase()}>`;
    }
    if (stil.opacity !== "" && Number(stil.opacity) === 0) {
      return `opacity:0 an <${knoten.tagName.toLowerCase()}>`;
    }
    knoten = knoten.parentElement;
  }
  const eigen = getComputedStyle(el);
  if (eigen.color === "transparent" || eigen.color === "rgba(0, 0, 0, 0)") {
    return "color:transparent am Textträger";
  }
  return null;
}

/** Was an dieser Stelle steht — und was ein Mensch davon sieht. */
interface Stelle {
  vorhanden: boolean;
  /** Der gesamte Textinhalt des Elements. */
  text: string;
  /** Derselbe Text, aber nur wenn die Stelle nicht ausgeblendet ist — sonst leer. */
  sichtbar: string;
  /** Wenn ausgeblendet: woran. Für die Fehlermeldung der Gegenprobe. */
  grundDerAusblendung: string | null;
  /** Die ARIA-Rolle — aus dem Attribut oder aus dem Element (s. `rolleVon`). */
  rolle: string | null;
  /** Der Elementname, damit im Bericht steht, WORAUS die Rolle kommt. */
  element: string | null;
  tabindex: string | null;
  ariaLabel: string | null;
  /** Trägt das Element ausser seinem eigenen Text noch Kindelemente? (§9: zusammengesetzter Text) */
  kindelemente: number;
}

const LEERE_STELLE: Stelle = {
  vorhanden: false,
  text: "",
  sichtbar: "",
  grundDerAusblendung: "nicht gerendert",
  rolle: null,
  element: null,
  tabindex: null,
  ariaLabel: null,
  kindelemente: 0,
};

function grundElement(): HTMLElement | null {
  const el = container.querySelector('[data-testid="mob-queue-grund"]');
  return el instanceof HTMLElement ? el : null;
}

// ------------------------------------------------------------------------------------------------
// DIE ROLLE — aus dem Attribut ODER aus dem Element, und beides ist dieselbe Rolle.
// ------------------------------------------------------------------------------------------------
//
// Die Abnahme verlangt `role="status"`. Auf der Fläche steht ein `<output>`, und zwar ohne das
// Attribut: `<output>` TRÄGT die Rolle `status` (HTML-AAM, „output → status role"), und beides
// zusammen ist am Tor verboten (`a11y/noRedundantRoles`, Biome; die Gegenrichtung `<p role="status">`
// ebenso, `a11y/useSemanticElements`). Diese Abbildung steht hier ausdrücklich, damit die Messung
// nicht heimlich etwas anderes prüft als die Abnahme verlangt.
const ELEMENTROLLEN: Record<string, string> = { OUTPUT: "status" };

function rolleVon(el: Element): string | null {
  return el.getAttribute("role") ?? ELEMENTROLLEN[el.tagName] ?? null;
}

function stelleLesen(el: HTMLElement | null): Stelle {
  if (!el) {
    return { ...LEERE_STELLE };
  }
  const verdeckt = ausgeblendet(el);
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    vorhanden: true,
    text,
    sichtbar: verdeckt === null ? text : "",
    grundDerAusblendung: verdeckt,
    rolle: rolleVon(el),
    element: el.tagName,
    tabindex: el.getAttribute("tabindex"),
    ariaLabel: el.getAttribute("aria-label"),
    kindelemente: el.children.length,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE FOKUSFOLGE — berechnet, Station für Station angesprungen. KEINE Tastenanschläge.
// ------------------------------------------------------------------------------------------------
//
// jsdom kennt keine Tabulator-Taste: ein `keydown` mit `key: "Tab"` bewegt dort nichts. Gemessen
// wird deshalb dasselbe, was ein Browser BERECHNET: der Standardselektor der Fokusfolge, in
// Dokumentreihenfolge, ab der Warteschlangenüberschrift. Das prüft die BAUART der Meldung — steht
// sie in der Folge, trägt sie `tabindex`, ist sie sichtbar, trägt sie den Satz.
//
// WAS DIESE MESSUNG AUSDRÜCKLICH NICHT KANN, und das ist GEMESSEN und nicht vermutet: Sie sieht
// eine verschluckte Tab-TASTE nicht. BEN hat in Runde 2 genau das getan — ein `onKeyDownCapture`
// mit `preventDefault()` am äusseren Container — und diese Datei blieb mit „16 passed" grün
// (ben.md der Runde 2, Cloud-Auftrag `4b7aebafd0df4006aa31391481215209`). Der Weg der HAND wird
// deshalb dort gemessen, wo es eine Taste gibt: `abweisungsgrund-tastatur-pg-im-browser.integration.test.ts`
// drückt im echten Chromium `Tab` und wird an genau dieser Sperre rot (Fall T2b).
const FOKUSSIERBAR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Fokuslage {
  /** Wie viele Stationen der BERECHNETEN Folge nötig waren — keine Tastenanschläge (s. oben). */
  schritte: number;
  text: string;
  rolle: string | null;
  stationen: string[];
}

function fokusfolgeBisZumSatz(satz: string, hoechstens = 25): Fokuslage {
  const start = container.querySelector('[data-testid="mob-queue-zaehler"]');
  if (!start) {
    throw new Error(
      `Die Warteschlangenüberschrift steht nicht — von dort aus wird getabbt. Sichtbar: ${seitentext().slice(0, 400)}`,
    );
  }
  const folge = [...container.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter(
    (el) =>
      (start.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
      ausgeblendet(el) === null,
  );
  const stationen: string[] = [];
  for (let i = 0; i < Math.min(folge.length, hoechstens); i++) {
    const station = folge[i];
    if (!station) {
      continue;
    }
    station.focus();
    const aktiv = document.activeElement;
    stationen.push(
      `${station.tagName.toLowerCase()}:${(station.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30)}`,
    );
    if (aktiv instanceof HTMLElement && (aktiv.textContent ?? "").trim() === satz) {
      return {
        schritte: i + 1,
        text: (aktiv.textContent ?? "").trim(),
        rolle: rolleVon(aktiv),
        stationen,
      };
    }
  }
  return { schritte: 0, text: "", rolle: null, stationen };
}

// ------------------------------------------------------------------------------------------------
// DER LAUF: offline erfassen → Verbindung zurück → der Server weist ab → messen.
// ------------------------------------------------------------------------------------------------
interface Optionen {
  sprache: Sprache;
  /** Verstellt die stehende Fläche VOR dem Messen — die Gegenproben. */
  stellschraube?: (el: HTMLElement | null) => void;
  /** Verstellt den gespeicherten Bestand VOR dem Neuladen — die Herkunftsprobe. */
  vorNeuladen?: (bestand: VorgangMitStand[]) => VorgangMitStand[];
}

interface Befund {
  satz: string;
  /** Der abgesendete Anlage-Rumpf — trägt er wirklich die Voraussetzung des Kontos? */
  anlage: Record<string, unknown> | undefined;
  /** Die Kennung des Kontos DIESES Laufs (die globalen Variablen gehören dem jeweils letzten). */
  konto: string;
  /** Wie viele Entwürfe nach der Abweisung in der Ablage stehen. */
  angelegt: number;
  gespeichert: VorgangMitStand[];
  toast: string;
  seite: string;
  grund: Stelle;
  fokus: Fokuslage;
  /** Nach dem Neuaufbau der Fläche, ohne dass etwas gesendet wurde. */
  neuladen: { grund: Stelle; status: string | undefined; anlagen: number; seite: string };
}

async function fahre(optionen: Optionen): Promise<Befund> {
  localStorage.clear();
  await i18n.changeLanguage(optionen.sprache);
  anlagen = [];
  meAntworten = 0;
  netzSchalter(true);
  await konten();
  brueckeSetzen();
  try {
    await mount();
    await netz(false);
    await offlineErfassen();

    // Ab hier geht der SCHREIBAUFRUF als B hinaus; die Sitzung bleibt A (s. Kopf der Datei).
    schreibToken = tokenB;
    await netz(true);
    for (let i = 0; i < 200 && warteschlange()[0]?.status !== "failed"; i++) {
      await act(flush);
    }

    const gespeichert = warteschlange();
    expect(
      gespeichert[0]?.status,
      `der Vorgang steht nicht auf „failed" — gemessen: ${JSON.stringify(gespeichert)} · abgesendet: ${JSON.stringify(anlagen)}`,
    ).toBe("failed");

    optionen.stellschraube?.(grundElement());
    const grund = stelleLesen(grundElement());
    const fokus = fokusfolgeBisZumSatz(katalogsatz(optionen.sprache));
    const toast = meldungstext();
    const seite = seitentext();

    // ------------------------------------------------------------------------------------------
    // NEULADEN: die Fläche wird abgebaut und neu aufgebaut, der Speicher bleibt.
    // ------------------------------------------------------------------------------------------
    // ZWEI SCHALTER, BEWUSST GETRENNT (Bauform aus `kontowechsel-und-anlage-mounted.test.tsx`,
    // Fall A20): `navigator.onLine = false` hält die Warteschlange davon ab zu senden — `syncNow`
    // bricht ohne Netz sofort ab. `onlineManager` bleibt verbunden, damit die SITZUNGSFRAGE
    // beantwortet wird; ohne Antwort ist die Kontolage `unbekannt`, und die Fläche zeigt dann zu
    // Recht gar keine Liste. So misst dieser Teil, was er messen soll: Was nach dem Neuaufbau
    // dasteht, kann NUR aus dem gespeicherten `op.error` stammen — es ist nichts gesendet und
    // nichts geantwortet worden. Der Zähler `anlagen` hält das fest.
    abbauen();
    if (optionen.vorNeuladen) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(optionen.vorNeuladen(warteschlange())));
    }
    const anlagenVorNeuladen = anlagen.length;
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    onlineManager.setOnline(true);
    await mount();

    return {
      satz: katalogsatz(optionen.sprache),
      anlage: anlagen[0],
      konto: kontoA,
      angelegt: (await ablage.list()).length,
      gespeichert,
      toast,
      seite,
      grund,
      fokus,
      neuladen: {
        grund: stelleLesen(grundElement()),
        status: warteschlange()[0]?.status,
        anlagen: anlagen.length - anlagenVorNeuladen,
        seite: seitentext(),
      },
    };
  } finally {
    abbauen();
    globalThis.fetch = vorherigerFetch;
    netzSchalter(true);
  }
}

/** Die unveränderten Läufe je Sprache — dreimal derselbe Aufbau wäre dreimal dieselbe Zeit. */
const laeufe = new Map<Sprache, Promise<Befund>>();
function lauf(sprache: Sprache): Promise<Befund> {
  const vorhanden = laeufe.get(sprache);
  if (vorhanden) {
    return vorhanden;
  }
  const frisch = fahre({ sprache });
  laeufe.set(sprache, frisch);
  return frisch;
}

afterEach(() => {
  netzSchalter(true);
});

// ================================================================================================
// (a) DIE ANKUNFT — der Satz des Servers liegt am Vorgang.
// ================================================================================================
//
// Diese Hälfte ist von der Sichtbarkeit GETRENNT und muss es sein: sie war schon vor diesem
// Auftrag erfüllt. Bliebe sie mit (b) in einer Zusicherung, sähe eine Fassung ohne jede Anzeige
// genauso grün aus wie die gebaute.
function abnahmeAnkunft(b: Befund): void {
  expect(b.gespeichert, "es liegt nicht genau ein Vorgang").toHaveLength(1);
  expect(b.gespeichert[0]?.status).toBe("failed");
  expect(
    b.gespeichert[0]?.error,
    `op.error trägt nicht den Satz des Katalogs · gemessen: ${String(b.gespeichert[0]?.error)}`,
  ).toBe(b.satz);
}

// ================================================================================================
// (b) DIE SICHTBARKEIT — derselbe Satz steht im gerenderten Dokument.
// ================================================================================================
function abnahmeSichtbar(b: Befund): void {
  expect(
    b.grund.vorhanden,
    `die Meldung am Vorgang ist nicht gerendert · Fläche: ${b.seite.slice(0, 400)}`,
  ).toBe(true);
  expect(
    b.grund.grundDerAusblendung,
    `die Meldung am Vorgang ist ausgeblendet (${String(b.grund.grundDerAusblendung)})`,
  ).toBe(null);
  expect(
    b.grund.sichtbar,
    `der sichtbare Text der Meldung am Vorgang ist nicht der Serversatz · gemessen: „${b.grund.sichtbar}"`,
  ).toBe(b.satz);
  // §9: ein sichtbarer Container belegt nicht, dass sein ganzer Text sichtbar ist. Hier trägt die
  // Stelle ihren Text SELBST — kein Kindelement, also auch kein Kind, das eigens auszublenden wäre.
  expect(
    b.grund.kindelemente,
    "die Meldung trägt Kindelemente — ihr Text wäre dann zusammengesetzt und je Kind zu prüfen",
  ).toBe(0);
}

describe("JOB 4354 · der Grund der Abweisung kommt an UND steht da", () => {
  it("(a) op.error trägt den übersetzten Satz des Servers — und der echte Weg ist gefahren", async () => {
    const b = await lauf("de");
    abnahmeAnkunft(b);
    // Der Beleg, dass hier nicht ein Satz gestellt, sondern einer geholt wurde: der Aufruf trug die
    // Voraussetzung des Kontos mit, und angelegt wurde nichts.
    expect(b.anlage?.expectedOwner, "der Anlageaufruf trug keine Kontovoraussetzung").toBe(b.konto);
    expect(b.anlage?.operationId, "der Anlageaufruf trug keine Vorgangskennung").toBe(
      b.gespeichert[0]?.id,
    );
    expect(b.angelegt, "trotz Abweisung wurde etwas angelegt").toBe(0);
  });

  it("(b) derselbe Satz steht sichtbar am Eintrag, nicht nur der Sammel-Toast", async () => {
    const b = await lauf("de");
    abnahmeSichtbar(b);
    // Der Sammel-Toast BLEIBT — er wird nicht ersetzt, sondern ergänzt (Auftrag, Umfang).
    expect(b.toast, "der Sammel-Toast steht nicht mehr da").toContain(
      `${i18n.t("mob.syncFail")} (1)`,
    );
    // Und die Marke am Eintrag bleibt ebenfalls: Zustand UND Grund, nicht Grund statt Zustand.
    expect(b.seite).toContain(i18n.t("mob.status.failed"));
    expect(b.seite).toContain(TITEL);
  });

  it("die Meldung ist eine gemeldete Stelle und keine stumme Zeile: role=status, eigener Name", async () => {
    const b = await lauf("de");
    expect(b.grund.rolle, `Rolle aus <${String(b.grund.element)}>`).toBe("status");
    expect(b.grund.element, "die Rolle käme aus einem anderen Element als gemessen").toBe("OUTPUT");
    expect(b.grund.tabindex).toBe("0");
    // Der Name trägt die Zuordnung UND den Satz — wer die Titelzeile darüber nicht sieht, hört
    // beides. Der Satz selbst bleibt der des Servers; übersetzt ist nur die Zuordnung.
    expect(b.grund.ariaLabel).toBe(`${i18n.t("mob.vorgang.grund", { titel: TITEL })}: ${b.satz}`);
    expect(b.grund.ariaLabel).toContain(TITEL);
  });
});

// ================================================================================================
// DREI SPRACHEN — je der Satz der jeweiligen Sprache, an beiden Stellen.
// ================================================================================================
//
// Die Sprache kommt aus der Sitzung: `api/client.ts` setzt `Accept-Language` aus `i18n.language`,
// die Route beantwortet damit aus dem Katalog. Dass die drei Sätze einander nicht gleichen, wird
// ausdrücklich geprüft — sonst wäre auch eine Fassung grün, die immer denselben liefert.
describe.each(["de", "en", "nl"] as const)("JOB 4354 · Sprache %s", (sprache) => {
  it("op.error UND die sichtbare Stelle tragen den Satz dieser Sprache", async () => {
    const b = await lauf(sprache);
    abnahmeAnkunft(b);
    abnahmeSichtbar(b);
    expect(b.satz).toBe(MELDUNGEN.DRAFT_OWNER_MISMATCH[sprache]);
  });
});

describe("JOB 4354 · die drei Sätze sind wirklich drei", () => {
  it("DE, EN und NL unterscheiden sich — an der Stelle, an der sie stehen", async () => {
    // NACHEINANDER, nicht `Promise.all`: die drei Läufe teilen sich Fläche, Speicher und Brücke.
    const de = await lauf("de");
    const en = await lauf("en");
    const nl = await lauf("nl");
    const sichtbar = [de.grund.sichtbar, en.grund.sichtbar, nl.grund.sichtbar];
    expect(new Set(sichtbar).size, `dieselbe Zeile in drei Sprachen: ${sichtbar.join(" | ")}`).toBe(
      3,
    );
    expect(de.grund.sichtbar).toContain("anderen Konto");
    expect(en.grund.sichtbar).toContain("different account");
    expect(nl.grund.sichtbar).toContain("ander account");
  });
});

// ================================================================================================
// FOKUSFOLGE — die Meldung STEHT in der Tastaturfolge (die Taste selbst misst der Browserfall).
// ================================================================================================
describe("JOB 4354 · die Meldung steht in der Fokusfolge", () => {
  it("die berechnete Folge ab der Warteschlangenüberschrift endet genau auf dem Serversatz", async () => {
    const b = await lauf("de");
    expect(
      b.fokus.schritte,
      `keine Station der Fokusfolge erreichte den Serversatz · Stationen: ${b.fokus.stationen.join(" → ")}`,
    ).toBeGreaterThan(0);
    expect(b.fokus.text, "der Fokus steht nicht auf dem Serversatz").toBe(b.satz);
    expect(b.fokus.rolle, "die fokussierte Stelle ist nicht die Meldung").toBe("status");
  });
});

// ================================================================================================
// NEULADEN — der Satz bleibt am Vorgang, solange er gescheitert ist.
// ================================================================================================
describe("JOB 4354 · nach dem Neuaufbau der Fläche", () => {
  it("der Satz steht weiter am Vorgang — ohne dass etwas gesendet oder geantwortet wurde", async () => {
    const b = await lauf("de");
    expect(b.neuladen.status, "der Vorgang steht nach dem Neuaufbau nicht mehr auf failed").toBe(
      "failed",
    );
    expect(
      b.neuladen.anlagen,
      "beim Neuaufbau ging ein Aufruf hinaus — der Satz könnte von dort stammen",
    ).toBe(0);
    expect(b.neuladen.grund.grundDerAusblendung).toBe(null);
    expect(
      b.neuladen.grund.sichtbar,
      `nach dem Neuaufbau steht nicht der Serversatz da · gemessen: „${b.neuladen.grund.sichtbar}"`,
    ).toBe(b.satz);
  });

  it("HERKUNFT: was im gespeicherten op.error steht, steht danach auf der Fläche — und sonst nichts", async () => {
    // Die Probe auf die Quelle. Würde die Fläche einen eigenen Satz bilden (zweiter Katalog) oder
    // den letzten Serverkontakt zeigen, bliebe hier der Katalogsatz stehen und diese Messung
    // fiele auf. Es wird ausschliesslich der SPEICHER verstellt, nicht das Produkt.
    const marke = "PRUEFMARKE 4354 — dieser Satz stammt aus dem gespeicherten Vorgang.";
    const b = await fahre({
      sprache: "de",
      vorNeuladen: (bestand) => bestand.map((op) => ({ ...op, error: marke })),
    });
    expect(b.neuladen.grund.sichtbar, "die Fläche zeigt nicht den gespeicherten Grund").toBe(marke);
    expect(
      b.neuladen.seite,
      "neben der Marke steht weiterhin der alte Serversatz — die Fläche hat zwei Quellen",
    ).not.toContain(b.satz);
  });
});

// ================================================================================================
// GEGENPROBEN — (b) wird rot, (a) bleibt grün.
// ================================================================================================
//
// Die beiden Fehlerklassen, getrennt kalibriert (Regel „GEGENPROBEN bei NEUEN Abnahmewegen"):
//   (1) die zugesagte Wirkung fehlt   → die Meldung ist nicht gerendert;
//   (2) sie ist da, aber unsichtbar   → ausgeblendet über `display`, `visibility`, `opacity`,
//                                       `aria-hidden` — jede Stufe der Elternkette.
// In JEDEM Fall muss `abnahmeSichtbar` mit dem konkreten Feld scheitern, `abnahmeAnkunft` aber
// weiter bestehen: der Satz IST ja angekommen. Eine Gegenprobe, die beide Hälften rot macht,
// bewiese nur, dass der Lauf kaputtgeht — nicht, dass die Sichtbarkeit gemessen wird.
describe("JOB 4354 · Gegenproben zur Sichtbarkeit", () => {
  it("nicht gerendert: (b) rot, (a) grün", async () => {
    const b = await fahre({ sprache: "de", stellschraube: (el) => el?.remove() });
    abnahmeAnkunft(b);
    expect(() => abnahmeSichtbar(b)).toThrow(/nicht gerendert/);
  });

  it("display:none an genau dieser Stelle: (b) rot, (a) grün", async () => {
    const b = await fahre({
      sprache: "de",
      stellschraube: (el) => {
        if (el) {
          el.style.display = "none";
        }
      },
    });
    abnahmeAnkunft(b);
    expect(() => abnahmeSichtbar(b)).toThrow(/display:none/);
    expect(
      b.grund.text,
      "der Text stand gar nicht im DOM — die Probe misst dann etwas anderes",
    ).toBe(b.satz);
  });

  it("visibility:hidden an genau dieser Stelle: (b) rot, (a) grün", async () => {
    const b = await fahre({
      sprache: "de",
      stellschraube: (el) => {
        if (el) {
          el.style.visibility = "hidden";
        }
      },
    });
    abnahmeAnkunft(b);
    expect(() => abnahmeSichtbar(b)).toThrow(/visibility:hidden/);
  });

  it("die ELTERNKETTE zählt mit: ausgeblendeter Listeneintrag macht (b) rot", async () => {
    const b = await fahre({
      sprache: "de",
      stellschraube: (el) => {
        const eintrag = el?.closest("li");
        if (eintrag instanceof HTMLElement) {
          eintrag.style.display = "none";
        }
      },
    });
    abnahmeAnkunft(b);
    expect(() => abnahmeSichtbar(b)).toThrow(/display:none an <li>/);
  });

  it("aria-hidden an der Stelle: (b) rot, (a) grün", async () => {
    const b = await fahre({
      sprache: "de",
      stellschraube: (el) => el?.setAttribute("aria-hidden", "true"),
    });
    abnahmeAnkunft(b);
    expect(() => abnahmeSichtbar(b)).toThrow(/aria-hidden/);
  });

  it("ohne tabIndex fällt die Meldung aus der Fokusfolge — die Messung wird rot", async () => {
    const b = await fahre({
      sprache: "de",
      stellschraube: (el) => el?.removeAttribute("tabindex"),
    });
    abnahmeAnkunft(b);
    // Sichtbar bleibt sie — genau deshalb ist die Fokusmessung eine EIGENE Zusicherung.
    abnahmeSichtbar(b);
    expect(
      b.fokus.schritte,
      `ohne tabindex wurde der Satz trotzdem erreicht · Stationen: ${b.fokus.stationen.join(" → ")}`,
    ).toBe(0);
  });
});
