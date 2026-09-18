// @vitest-environment jsdom
// ================================================================================================
// JOB 4333 · ENTWURF-MOBIL-DESKTOP-R — NEULADEN OHNE NETZ WIRFT DIE EIGENE ARBEIT NICHT MEHR WEG.
// ================================================================================================
//
// GEMESSEN WIRD DER GANZE TORWEG DER ANWENDUNG, nicht ein nachgebautes Markup: echtes
// `localStorage` → echte Warteschlange (`useOfflineQueue`) → echte Sitzungsfrage (`AuthContext`,
// `/auth/status` + `/auth/me` über react-query) → echter Torwächter (`Gate` in `App.tsx`, hier über
// den unveränderten Vorgabe-Export `App` gemountet) → echte Route `/mobile` (nachgeladen wie im
// Betrieb) → echte Fläche (`Mobile`).
//
// EINZIGER ERSATZ IST DER TRANSPORT. `globalThis.fetch` liegt auf einer Brücke, die die Lagen
// herstellt, um die es geht (Liste und Begründung am Typ `Lage` unten). Der NETZZUSTAND ist kein
// Ersatz, sondern echt: `navigator.onLine` und der `onlineManager` von react-query werden zugleich
// gesetzt, damit die Abfrage im Funkloch wirklich ANGEHALTEN wird und nicht bloss scheitert.
//
// WARUM `App` UND NICHT `Gate`: `Gate` ist nicht exportiert, und das soll so bleiben — die Zusage
// dieses Auftrags ist eine Aussage über die Anwendung, nicht über ein Innenteil. Was hier gemessen
// wird, ist exakt das, was `main.tsx` montiert (`QueryClientProvider` → Router → `App`).
//
// WARUM DIESE DATEI HIER LIEGT UND NICHT IN `tests/offline-neuladen-sitzung/` (Auftrag §4): Der
// Wächter `tests/legal/mega61-rechtsseiten.test.tsx` verbietet ausdrücklich, dass ein Test unter
// `tests/**` `apps/web/src/App` importiert — er zöge über `routes.tsx` die GANZE Anwendung in den
// WURZEL-Typprüfer (`tsconfig.tests-tsx.json`), und der hat weder `vite/client` noch die
// Web-Einstellungen. Gemountete Torwächter-Tests wohnen deshalb hier, wo der Typprüfer der
// Anwendung sie sieht — dieselbe Lage wie `apps/web/src/legal/mega61-rechtsseiten.test.tsx`. Der
// reine, rahmenfreie Teil dieses Auftrags steht weiterhin unter `tests/offline-neuladen-sitzung/`.
//
// SICHTBARKEIT IN jsdom, EHRLICH BENANNT (REGELN §9): jsdom hat KEIN Layout — `innerText`,
// `getBoundingClientRect` und echte Überdeckung gibt es hier nicht. `sichtbar()` unten prüft
// deshalb die Kette, die jsdom wirklich führt: `display`, `visibility`, `opacity` und das
// `hidden`-Attribut über ALLE Vorfahren. Jede Sichtbarkeitszusicherung dieser Datei ist mit genau
// diesem Mittel kalibriert (s. `KALIBRIERUNG` unten): das gezielte Ausblenden genau des geprüften
// Knotens MUSS sie rot machen. Der Nachweis im echten Chromium ist Station (b) von JOB 4322 und
// gehört ausdrücklich nicht hierher.
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import i18n from "../i18n";
import { OFFLINE_WARTESCHLANGE_SCHLUESSEL } from "../lib/sessionState";
import { ABMELDESCHULD_SCHLUESSEL } from "./abmeldeschuld";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// DIE VORRICHTUNG
// ------------------------------------------------------------------------------------------------

/** Ein Vorgang, wie ihn `useOfflineQueue` offline anlegt und persistiert (JOB 4249: mit Eigentümer). */
const VORGANG = {
  id: "op-4333-a",
  kind: "draft.create",
  draftId: null,
  payload: { title: "Unterwegs an der Anlage erfasst", statement: "Ohne Netz getippt." },
  status: "queued",
  error: null,
  createdAt: "2026-09-17T06:00:00.000Z",
  title: "Unterwegs an der Anlage erfasst",
  eigentuemer: "konto-a",
};

/**
 * Ein Entwurf, der NUR im Zwischenspeicher liegt — er ist der Gegenstand von BENs Befund. Die Form
 * ist die ECHTE (`api/types.ts` `Draft`: Umschlag mit `payload`), nicht eine vereinfachte: ein
 * Fixture, das die Fläche gar nicht zeichnen kann, belegt weder das eine noch das andere. Gemessen:
 * mit einem flachen Objekt stürzte `draftTitle` ab und die Fehlergrenze verdeckte den Fall
 * (Cloud-Lauf 63403e32eb6392bd5499729f).
 */
const SERVER_ENTWURF_TITEL = "BEN VERTRAULICHER SERVERENTWURF";
/**
 * Ein Bibliothekstreffer, der NUR im Zwischenspeicher liegt. Er ist der automatisch geladene
 * Serverinhalt des Reiters „Suchen": `useLibrarySearch({})` läuft dort ohne jede Eingabe los.
 */
const SERVER_TREFFER_TITEL = "BEN VERTRAULICHER BIBLIOTHEKSTREFFER";
const SERVER_TREFFER = {
  id: "ko-server-1",
  title: SERVER_TREFFER_TITEL,
  type: "regel",
  status: "validiert",
  trust: 90,
  updatedAt: "2026-09-17T05:00:00.000Z",
};
const SERVER_ENTWURF = {
  id: "draft-server-1",
  payload: {
    title: SERVER_ENTWURF_TITEL,
    statement: "Aus einer früheren, bestätigten Sitzung geholt.",
  },
  originalAuthor: "konto-a",
  lastEditor: "konto-a",
  updatedAt: "2026-09-17T05:00:00.000Z",
  createdAt: "2026-09-17T05:00:00.000Z",
};

/**
 * DIE LAGEN, in denen die Sitzungsfrage steht. Vier davon sind Wissenslücken, zwei sind Antworten
 * — und genau diese Grenze ist die Zusage dieses Auftrags (§5.1: unbeantwortet ist „kein
 * HTTP-Status, bzw. kein 401/403"):
 *   · `ohneNetz`         — der OnlineManager von react-query steht auf offline. Die Abfrage wird
 *                          ANGEHALTEN (`fetchStatus: "paused"`), sie scheitert nie und kommt nie
 *                          los. Das ist der Fall nach einem Neuladen im Funkloch — und der, den
 *                          JOB 4322 im echten Chromium gemessen hat.
 *   · `transportfehler`  — der Browser meldet ein Netz, der Aufruf scheitert trotzdem
 *                          (`TypeError: Failed to fetch`). Am Telefon der häufigere Fall: WLAN
 *                          verbunden, aber nichts dahinter.
 *   · `fehler503`/`fehler502` — der Dienst antwortet, aber über die SITZUNG sagt er nichts. Ein
 *                          Ausfall ist keine Abmeldung (BENs Korrekturpflicht 2).
 *   · `timeout`          — `ApiError(408, "TIMEOUT")`, so wie `api/client.ts` `mitFrist` ihn
 *                          erzeugt: den Status hat sich der CLIENT gegeben.
 *   · `keineSitzung`     — `/auth/me` antwortet 401. Der Server HAT die Frage beantwortet.
 *   · `verboten403`      — `/auth/me` antwortet 403. Ebenfalls eine Antwort über die Sitzung.
 */
type Lage =
  | "ohneNetz"
  | "transportfehler"
  | "fehler503"
  | "fehler502"
  | "timeout"
  | "keineSitzung"
  | "verboten403"
  | "angemeldet"
  | "ersteinrichtung";
let lage: Lage = "ohneNetz";
let vorherigerFetch: typeof globalThis.fetch;
/** Jede URL, die die Brücke gesehen hat — für die Aussage „es wurde gar nicht erst gefragt". */
let rufe: string[] = [];

function antwort(status: number, koerper: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => JSON.stringify(koerper),
  };
}

function brueckeSetzen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    rufe.push(url);
    if (lage === "ohneNetz" || lage === "transportfehler") {
      // DER ECHTE OFFLINE-FEHLER DES BROWSERS: kein Status, keine Antwort, nur der Transport.
      // (In der Lage `ohneNetz` kommt dieser Aufruf gar nicht erst zustande — der OnlineManager
      // hält ihn an. Die Zeile ist trotzdem richtig: sie deckt den Fall ab, dass react-query es
      // doch versucht, und sie liefert unter keinen Umständen eine erfundene Antwort.)
      throw new TypeError("Failed to fetch");
    }
    if (lage === "fehler503") {
      return antwort(503, { error: "SERVICE_UNAVAILABLE", message: "Dienst nicht verfügbar." });
    }
    if (lage === "fehler502") {
      return antwort(502, { error: "BAD_GATEWAY", message: "Kein Durchgang." });
    }
    if (lage === "timeout") {
      // Zeichengleich zu dem, was `api/client.ts` `mitFrist` beim Client-Abbruch erzeugt:
      // Status 408, Code TIMEOUT. Der Server hat davon nichts gesagt.
      return antwort(408, { error: "TIMEOUT", message: "Clientseitig abgebrochen." });
    }
    if (url.endsWith("/api/auth/status")) {
      return antwort(200, {
        needsSetup: lage === "ersteinrichtung",
        oidcEnabled: false,
        selfRegistrationEnabled: false,
      });
    }
    if (url.endsWith("/api/auth/me")) {
      if (lage === "angemeldet") {
        return antwort(200, { id: "konto-a", name: "Anna", role: "experte" });
      }
      return lage === "verboten403"
        ? antwort(403, { error: "FORBIDDEN", message: "Nicht erlaubt." })
        : antwort(401, { error: "UNAUTHORIZED", message: "Nicht angemeldet." });
    }
    if (url.endsWith("/api/drafts")) {
      // Die Entwurfsliste antwortet nur bei bestätigter Sitzung; sonst steht sie nie zur Verfügung
      // und alles, was die Fläche zeigen könnte, käme aus dem Zwischenspeicher — genau der Punkt.
      return lage === "angemeldet"
        ? antwort(200, [SERVER_ENTWURF])
        : antwort(401, { error: "UNAUTHORIZED", message: "Nicht angemeldet." });
    }
    return antwort(401, { error: "UNAUTHORIZED", message: "Nicht angemeldet." });
  }) as unknown as typeof globalThis.fetch;
}

/**
 * Der Netzzustand — an BEIDEN Stellen, an denen ihn das Produkt liest, und das ist keine Doppelung:
 * `useOfflineQueue` liest `navigator.onLine`, react-query liest seinen eigenen `onlineManager`.
 * In Runde 1 wurde nur der erste gesetzt; react-query hielt sich deshalb für online, rief wirklich
 * ab und scheiterte am Transport. Das war eine gültige Lage — aber NICHT die aus dem Funkloch, in
 * der die Abfrage angehalten wird. Seit Runde 2 stellt diese Funktion beide zugleich.
 */
function netz(an: boolean): void {
  Object.defineProperty(globalThis.navigator, "onLine", { value: an, configurable: true });
  onlineManager.setOnline(an);
}

function fensterbreite(schmal: boolean): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: schmal,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * JOB 4333 R2 (BENs Korrekturpflicht 1): Der Zwischenspeicher ist DIE Lücke, und ein Testaufbau mit
 * `gcTime: 0` sieht sie nie. Hier stehen deshalb die BETRIEBSWERTE: `staleTime` 30 000 ms wie
 * `main.tsx:44` (`ZAEHLER_FRISCHE_MS`) und `gcTime` die react-query-Vorgabe von fünf Minuten. Wer
 * `vorbefuellen` mitgibt, legt damit einen Entwurfsbestand an, wie ihn eine VORHERIGE, bestätigte
 * Sitzung hinterlässt — er überlebt den Netzausfall und wäre ohne den Riegel in `Mobile.tsx`
 * sichtbar. Genau das war BENs Befund.
 */
async function mount(pfad: string, optionen?: { vorbefuellen?: boolean }): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000 },
      mutations: { retry: false },
    },
  });
  if (optionen?.vorbefuellen) {
    client.setQueryData(["drafts"], [SERVER_ENTWURF]);
    // Derselbe Schlüssel, den `useLibrarySearch({})` auf dem Reiter „Suchen" führt.
    client.setQueryData(["library", "search", {}], [SERVER_TREFFER]);
  }
  qc = client;
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(App)),
      ),
    );
    await flush();
  });
  // ============================================================================================
  // DER AUFBAU BRAUCHT MEHRERE RUNDEN, UND DAS IST KEIN GEDULDSSPIEL, SONDERN DIE KETTE SELBST.
  // ============================================================================================
  //
  // Sie hat vier Glieder, und jedes braucht eine eigene Runde: `/auth/status` antwortet →
  // `/auth/me` wird dadurch überhaupt erst gestellt (`enabled`, `AuthContext.tsx`) → die
  // Torentscheidung rendert neu → und die Route `/mobile` wird wie im Betrieb NACHGELADEN
  // (`routes.tsx`, `lazy`), bis dahin steht die Ladefläche. Gemessen im Diagnoselauf
  // a88d7c1608ca14e87d9c3850: nach zwei Runden stand die Antwort im Zwischenspeicher, das Bild
  // aber noch auf „Lädt …".
  await beruhigen();
}

/**
 * Die Endflächen des Torwächters. Solange keine davon dasteht, ist die Anwendung noch unterwegs
 * (Ladefläche) — und eine Messung am Ladezustand misst nichts.
 */
const ENDFLAECHEN = [
  '[data-testid="mob-warteschlange"]',
  '[data-testid="mob-statement"]',
  '[data-testid="mob-body"]',
  '[data-testid="signout-blocked"]',
  "#auth-email",
  "#auth-name",
].join(", ");

/**
 * Warten, bis der Torwächter eine ENDFLÄCHE zeigt — nicht eine feste Zahl von Runden.
 *
 * Eine feste Zahl war der erste Versuch und ist gemessen zu wenig gewesen: der ERSTE Aufbau dieser
 * Datei lädt das Seitenmodul `pages/Mobile` wirklich nach (`routes.tsx`, `lazy`), die folgenden
 * finden es im Modulspeicher. Mit sechs Runden war genau F1 rot und jeder spätere Fall grün —
 * eine Zahl, die vom Cache abhängt, ist keine Bedingung (Lauf bc47209c2e29f85e283769f7).
 *
 * Verdeckt wird damit nichts: Kommt keine Endfläche, läuft die Schleife aus und die Zusicherung
 * des Falls scheitert mit ihrer eigenen Meldung.
 */
async function beruhigen(ziel: string = ENDFLAECHEN): Promise<void> {
  for (let runde = 0; runde < 40; runde += 1) {
    await act(async () => {
      await flush();
    });
    if (container.querySelector(ziel)) {
      // Eine Runde obendrauf: die Fläche steht, nachgelagerte Effekte (Warteschlange, Meldungen)
      // dürfen noch fertig werden.
      await act(async () => {
        await flush();
      });
      return;
    }
  }
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  qc = null;
}

// ------------------------------------------------------------------------------------------------
// SICHTBARKEIT — und nicht blosse Anwesenheit (REGELN §9)
// ------------------------------------------------------------------------------------------------

/** Warum ein Knoten NICHT sichtbar ist — im Klartext, damit die rote Meldung etwas sagt. */
function unsichtbarGrund(el: Element | null): string | null {
  if (!el) {
    return "Knoten nicht im DOM";
  }
  let lauf: Element | null = el;
  while (lauf) {
    if (lauf instanceof HTMLElement) {
      if (lauf.hidden) {
        return `Vorfahre <${lauf.tagName.toLowerCase()}> trägt hidden`;
      }
      const stil = globalThis.getComputedStyle(lauf);
      if (stil.display === "none") {
        return `<${lauf.tagName.toLowerCase()}> hat display:none`;
      }
      if (stil.visibility === "hidden" || stil.visibility === "collapse") {
        return `<${lauf.tagName.toLowerCase()}> hat visibility:${stil.visibility}`;
      }
      if (stil.opacity === "0") {
        return `<${lauf.tagName.toLowerCase()}> hat opacity:0`;
      }
      if (stil.color === "transparent") {
        return `<${lauf.tagName.toLowerCase()}> hat color:transparent`;
      }
    }
    lauf = lauf.parentElement;
  }
  return null;
}

function istSichtbar(el: Element | null): boolean {
  return unsichtbarGrund(el) === null;
}

/**
 * Der Text, den ein Mensch WIRKLICH sieht: je texttragendem Nachkommen geprüft, nicht der
 * `textContent` des Containers. Ein sichtbarer Kasten belegt nicht, dass sein ganzer Text sichtbar
 * ist (REGELN §9, JOB 4295 R3).
 */
function sichtbarerText(wurzel: Element | null): string {
  if (!wurzel || !istSichtbar(wurzel)) {
    return "";
  }
  const teile: string[] = [];
  const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  let knoten = lauf.nextNode();
  while (knoten) {
    const text = knoten.textContent ?? "";
    if (text.trim() && istSichtbar(knoten.parentElement)) {
      teile.push(text);
    }
    knoten = lauf.nextNode();
  }
  return teile.join(" ").replace(/\s+/g, " ").trim();
}

function suche(selektor: string): Element | null {
  return container.querySelector(selektor);
}

/** Die Erfassungsfläche — an ihrem Warteschlangenkasten und ihrem Speicherknopf erkannt. */
function erfassungFlaeche(): Element | null {
  return suche('[data-testid="mob-warteschlange"]');
}

function anmeldemaskeDa(): boolean {
  return istSichtbar(suche("#auth-email"));
}

function warteschlangeImSpeicher(): Array<Record<string, unknown>> {
  const roh = localStorage.getItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL);
  return roh === null ? [] : (JSON.parse(roh) as Array<Record<string, unknown>>);
}

// ------------------------------------------------------------------------------------------------
// KALIBRIERUNG — jede Sichtbarkeitszusicherung wird gezielt zum Scheitern gebracht.
// ------------------------------------------------------------------------------------------------
//
// Ohne sie ist der Nachweis nicht erbracht (REGELN §9). Ausgeblendet wird GENAU der geprüfte
// Knoten, bei sonst unveränderter Fläche; danach wird die Ausblendung zurückgenommen und das Grün
// erneut gemessen.
function ausblenden(el: HTMLElement): () => void {
  const vorher = el.style.display;
  el.style.display = "none";
  return () => {
    el.style.display = vorher;
  };
}

/** Der sichtbare Text der GANZEN Fläche — je texttragendem Knoten geprüft, nicht `textContent`. */
function flaechentext(): string {
  return sichtbarerText(container);
}

/** Einen Reiter über einen echten Klick öffnen — und dabei ein frisches Rendern erzwingen. */
async function reiterOeffnen(schluessel: string): Promise<void> {
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === i18n.t(schluessel),
  );
  expect(knopf, `der Reiter ${schluessel} fehlt`).toBeTruthy();
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await flush();
  });
}

beforeEach(() => {
  localStorage.clear();
  lage = "ohneNetz";
  rufe = [];
  netz(false);
  fensterbreite(true);
  brueckeSetzen();
  // ============================================================================================
  // GEMESSEN WIRD DIE AUSGELIEFERTE ANWENDUNG, NICHT DER ENTWICKLUNGSBAU.
  // ============================================================================================
  //
  // `App.tsx:45` kennt einen Ausweg für den Entwicklungsbau: `devPreview =
  // import.meta.env.DEV && s.error && !s.user` zeigt bei nicht erreichbarem Backend die Shell OHNE
  // Anmeldung. Unter vitest ist `import.meta.env.DEV` WAHR — ohne diese Zeile misst jeder Fall hier
  // genau diesen Ausweg und wäre von Anfang an grün, obwohl die ausgelieferte Anwendung die
  // Anmeldemaske zeigt (Auftrag §2.1: „in der ausgelieferten Anwendung gibt es diesen Ausweg
  // nicht"). Erst gemessen, dann gesetzt: der erste Lauf dieser Datei zeigte die Handy-Fläche im
  // Fall F4 am UNVERÄNDERTEN Produkt — das war der Entwicklungsausweg, nicht die Zusage.
  vi.stubEnv("DEV", false);
});

afterEach(() => {
  abbauen();
  globalThis.fetch = vorherigerFetch;
  localStorage.clear();
  vi.unstubAllEnvs();
  // Der OnlineManager ist ein MODULZUSTAND und überlebt die Datei — er wird ausdrücklich
  // zurückgestellt, damit kein folgender Fall auf einem Netz von vorhin steht.
  onlineManager.setOnline(true);
});

describe("JOB 4333: Neuladen ohne Netz — die eigene Arbeit bleibt sichtbar", () => {
  // ==============================================================================================
  // DER ROT-VORHER-FALL DIESES AUFTRAGS (§6).
  // ==============================================================================================
  it("F1 · nach dem Neuladen OHNE Netz steht die Erfassung mit ihrem Zähler", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));

    await mount("/mobile");

    // 0. Die Lage ist wirklich die ANGEHALTENE: react-query hält die Sitzungsabfragen zurück,
    //    es geht KEINE von ihnen hinaus. Ohne diese Zeile könnte der Fall auch einen
    //    Transportfehler messen — eine andere Lage mit demselben Ergebnis, und die deckt F1c
    //    gesondert ab. Gefiltert wird auf die Sitzungsabfragen: Der Versionswächter fragt
    //    `/health` an react-query vorbei und ist für diese Aussage ohne Belang.
    expect(
      rufe.filter((u) => u.includes("/api/auth/")),
      "eine Sitzungsabfrage ging hinaus, obwohl der Browser offline ist",
    ).toEqual([]);

    // 1. Die Anmeldemaske ist NICHT da.
    expect(anmeldemaskeDa(), "die Anmeldemaske verdrängt die Erfassung weiterhin").toBe(false);

    // 2. Die Erfassungsfläche steht sichtbar da.
    const kasten = erfassungFlaeche();
    expect(unsichtbarGrund(kasten), "der Warteschlangenkasten ist nicht sichtbar").toBeNull();

    // 3. Der Zähler trägt die Zahl der liegenden Vorgänge — sichtbar, feldweise gemessen.
    expect(
      sichtbarerText(kasten),
      "der Zähler der Warteschlange ist nach dem Neuladen ohne Netz nicht sichtbar",
    ).toContain(`${i18n.t("mob.queue")} · 1`);

    // 4. Der ehrliche Satz steht da: ohne Netz, Anmeldung nicht geprüft.
    const satz = suche('[data-testid="mob-sitzung-unbeantwortet"]');
    expect(unsichtbarGrund(satz), "der Offline-Satz zur Sitzung ist nicht sichtbar").toBeNull();
    expect(sichtbarerText(satz)).toBe(i18n.t("mob.sitzung.unbeantwortet"));

    // 5. Die Zusage aus JOB 4249 steht unverändert DANEBEN und wurde nicht verdrängt: es wird
    //    nichts gesendet, nichts zugeordnet, nichts gelöscht.
    expect(
      sichtbarerText(suche('[data-testid="mob-konto-unbekannt"]')),
      "der Satz aus JOB 4249 über die nicht feststellbare Sitzung fehlt",
    ).toBe(i18n.t("mob.konto.unbekannt"));

    // 6. Der Vorgang selbst ist unverändert — Kennung, Eigentümer, Titel.
    expect(
      warteschlangeImSpeicher().map((v) => ({
        id: v.id,
        eigentuemer: v.eigentuemer,
        titel: (v.payload as { title?: string }).title,
      })),
      "der Vorgang hat das Neuladen nicht unverändert überlebt",
    ).toEqual([{ id: VORGANG.id, eigentuemer: "konto-a", titel: VORGANG.payload.title }]);
  });

  it("F1-KALIBRIERUNG · genau dieser Zähler ausgeblendet → die Zusicherung aus F1 scheitert", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    await mount("/mobile");

    const zaehler = suche('[data-testid="mob-queue-zaehler"]');
    expect(zaehler, "der Zähler trägt keine eigene Marke").not.toBeNull();
    const zurueck = ausblenden(zaehler as HTMLElement);
    expect(
      sichtbarerText(erfassungFlaeche()),
      "ausgeblendet und trotzdem als sichtbar gemessen — die Messung taugt nichts",
    ).not.toContain(`${i18n.t("mob.queue")} · 1`);
    zurueck();
    expect(sichtbarerText(erfassungFlaeche())).toContain(`${i18n.t("mob.queue")} · 1`);
  });

  // ==============================================================================================
  // RUNDE 2 · BENs KORREKTURPFLICHT 1 — DER ZWISCHENSPEICHER GIBT NICHTS HERAUS.
  // ==============================================================================================
  //
  // DER BEFUND (BEN R1, eigene Messung): „Ein vorbereiteter React-Query-Entwurf erscheint bei
  // unbeantworteter Sitzung im sichtbaren Text: `Meine Entwürfe BEN VERTRAULICHER SERVERENTWURF`."
  // Der Aufbau hier stellt genau das her — Betriebswerte für `staleTime`/`gcTime`, ein Bestand aus
  // einer FRÜHEREN bestätigten Sitzung im Zwischenspeicher — und misst am SICHTBAREN Text der
  // ganzen Fläche, nicht an einem einzelnen Knoten.
  it("F8 · gefüllter Zwischenspeicher: der Serverentwurf bleibt unsichtbar, der Zähler bleibt da", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));

    await mount("/mobile", { vorbefuellen: true });

    // Die Vorbedingung selbst wird geprüft, nicht angenommen: der Bestand LIEGT im Zwischenspeicher.
    // Ohne diese Zeile wäre der Fall auch dann grün, wenn die Vorbereitung gar nicht gegriffen hat.
    expect(
      (qc?.getQueryData(["drafts"]) as Array<{ payload: { title: string } }> | undefined)?.map(
        (d) => d.payload.title,
      ),
      "die Vorbedingung fehlt: im Zwischenspeicher liegt gar kein Serverentwurf",
    ).toEqual([SERVER_ENTWURF_TITEL]);

    expect(flaechentext(), "Serverentwurf sichtbar trotz unbeantworteter Sitzung").not.toContain(
      SERVER_ENTWURF_TITEL,
    );
    // Und an seiner Stelle steht der ehrliche Satz — keine Leerbehauptung („keine Entwürfe").
    expect(
      sichtbarerText(suche('[data-testid="mob-server-gesperrt-entwuerfe"]')),
      "an der Stelle der Serverliste steht kein Satz, der sagt warum",
    ).toBe(i18n.t("mob.sitzung.nurLokal"));
    expect(flaechentext(), "die Fläche behauptet, es gebe keine Entwürfe").not.toContain(
      i18n.t("mob.draftsEmpty"),
    );
    // Die eigene, lokale Arbeit bleibt sichtbar — darum geht es.
    expect(sichtbarerText(erfassungFlaeche())).toContain(`${i18n.t("mob.queue")} · 1`);
    expect(sichtbarerText(suche('[data-testid="mob-sitzung-unbeantwortet"]'))).toBe(
      i18n.t("mob.sitzung.unbeantwortet"),
    );
  });

  // ==============================================================================================
  // RUNDE 3 (BENs Prüflücke 6) — DER REITER „SUCHEN" WIRD AN ECHTEM SERVERINHALT GEMESSEN.
  // ==============================================================================================
  //
  // In Runde 2 prüfte dieser Fall nur den Sperrsatz und einen ENTWURFSTITEL, der auf diesen Reitern
  // ohnehin nie steht — er hätte also auch dann bestanden, wenn der Riegel dort gar nichts tut.
  // Jetzt liegt ein echter Bibliothekstreffer im Zwischenspeicher, unter genau dem Schlüssel, den
  // `useLibrarySearch({})` führt: Diese Abfrage läuft auf dem Reiter „Suchen" von SELBST los, ohne
  // dass jemand etwas tippt (`Mobile.tsx`: leerer Filter statt `enabled: false`) — sie ist damit
  // der automatisch geladene Serverinhalt dieses Reiters.
  //
  // FÜR DEN REITER „FRAGEN" gibt es keinen solchen: dort entsteht die Antwort erst aus einer
  // Mutation, die ein Mensch auslöst, und `useKos`/`useConflicts` werden nur ZUSAMMEN mit einer
  // Antwort gezeigt. Dort wird deshalb geprüft, was dort zu prüfen ist — dass die Frage gar nicht
  // erst gestellt werden kann (kein Eingabefeld) und der Satz dasteht. Das ist ehrlich benannt und
  // nicht als Inhaltsnachweis ausgegeben.
  it('F8b · Reiter „Suchen": der gecachte Bibliothekstreffer bleibt unsichtbar', async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    await mount("/mobile", { vorbefuellen: true });

    // Vorbedingung: der Treffer LIEGT wirklich im Zwischenspeicher.
    expect(
      (qc?.getQueryData(["library", "search", {}]) as Array<{ title: string }> | undefined)?.map(
        (k) => k.title,
      ),
      "die Vorbedingung fehlt: im Zwischenspeicher liegt kein Bibliothekstreffer",
    ).toEqual([SERVER_TREFFER_TITEL]);

    await reiterOeffnen("mob.tabLookup");
    expect(
      flaechentext(),
      "Bibliothekstreffer sichtbar trotz unbeantworteter Sitzung",
    ).not.toContain(SERVER_TREFFER_TITEL);
    expect(
      sichtbarerText(suche('[data-testid="mob-server-gesperrt-suche"]')),
      "an der Stelle der Trefferliste steht kein Satz, der sagt warum",
    ).toBe(i18n.t("mob.sitzung.nurLokal"));
    // Und keine Leerbehauptung: „kein Treffer" wäre hier genauso falsch wie eine Liste.
    expect(flaechentext(), "die Fläche behauptet, es gebe keinen Treffer").not.toContain(
      i18n.t("mob.searchEmpty"),
    );

    await reiterOeffnen("mob.tabAsk");
    expect(
      sichtbarerText(suche('[data-testid="mob-server-gesperrt-fragen"]')),
      "auf dem Reiter Fragen fehlt der Satz über den gesperrten Serverinhalt",
    ).toBe(i18n.t("mob.sitzung.nurLokal"));
    expect(
      container.querySelector(`input[placeholder="${i18n.t("ask.placeholder")}"]`),
      "die Frage kann trotz unbeantworteter Sitzung gestellt werden",
    ).toBeNull();
  });

  it("F8b-GEGENRICHTUNG · mit bestätigter Sitzung steht der Bibliothekstreffer da", async () => {
    lage = "angemeldet";
    netz(true);
    await mount("/mobile", { vorbefuellen: true });

    await reiterOeffnen("mob.tabLookup");
    expect(
      flaechentext(),
      "mit bestätigter Sitzung fehlt der Treffer — der Riegel greift zu weit",
    ).toContain(SERVER_TREFFER_TITEL);
    expect(suche('[data-testid="mob-server-gesperrt-suche"]')).toBeNull();
  });

  // ==============================================================================================
  // RUNDE 3 · BENs KORREKTURPFLICHT 1 — DIE BEDINGUNG GILT FÜR DIE GANZE LEBENSDAUER DER FLÄCHE.
  // ==============================================================================================
  //
  // DER BEFUND (BEN R2, an der echten Anwendung gemessen): Der Riegel hing in Runde 2 zusätzlich am
  // BESTAND (`vorgaengeAmGeraet > 0`). Leert ein zweiter Tab die Warteschlange, WÄHREND diese
  // Fläche steht, fällt er weg — und der geschützte Serverentwurf stand wieder da
  // (`Warteschlange · 0 … Meine Entwürfe BEN VERTRAULICHER SERVERENTWURF`). Die Rückgabe aus Runde 2
  // hatte diesen Zustand für unerreichbar erklärt; das war falsch.
  //
  // DIESER FALL HÄLT DEN ÜBERGANG FEST, und zwar genau so, wie BEN ihn gefahren hat: nach dem
  // Aufbau der Speicher auf `[]` und ein `storage`-Ereignis, danach ein Reiterwechsel, der ein
  // frisches Rendern erzwingt.
  it("F8d · leert ein zweiter Tab die Warteschlange, bleibt der Serverinhalt trotzdem draussen", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    await mount("/mobile", { vorbefuellen: true });
    expect(
      flaechentext(),
      "der Ausgangszustand stimmt nicht: der Entwurf ist schon sichtbar",
    ).not.toContain(SERVER_ENTWURF_TITEL);

    // DER ZWEITE TAB: er schreibt den Speicher und meldet es über `storage` — genau das, was ein
    // Browser tut. Diese Fläche hat den Vorgang nicht angefasst.
    await act(async () => {
      localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, "[]");
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: OFFLINE_WARTESCHLANGE_SCHLUESSEL,
          newValue: "[]",
          oldValue: JSON.stringify([VORGANG]),
        }),
      );
      await flush();
    });
    await reiterOeffnen("mob.tabAsk");
    await reiterOeffnen("mob.tabCapture");

    expect(
      flaechentext(),
      "Serverentwurf sichtbar nach Leerung bei unbestätigter Sitzung",
    ).not.toContain(SERVER_ENTWURF_TITEL);
    // Der lokale Zähler und der Sitzungshinweis bleiben — „0" ist eine Aussage über DIESES Gerät
    // und darf dastehen.
    expect(
      sichtbarerText(erfassungFlaeche()),
      "der Zähler ist nach der Leerung verschwunden",
    ).toContain(`${i18n.t("mob.queue")} · 0`);
    expect(sichtbarerText(suche('[data-testid="mob-sitzung-unbeantwortet"]'))).toBe(
      i18n.t("mob.sitzung.unbeantwortet"),
    );

    // UND DIE GEGENRICHTUNG IM SELBEN FALL: sobald der Server antwortet, steht der Entwurf wieder
    // da. Der Riegel hat also nicht die Funktion zerstört, sondern nur die Auskunft zurückgehalten.
    lage = "angemeldet";
    netz(true);
    await act(async () => {
      globalThis.dispatchEvent(new Event("online"));
      await flush();
    });
    await beruhigen(`[data-testid="mob-warteschlange"], [data-testid="mob-statement"]`);
    await act(async () => {
      await flush();
    });
    expect(
      flaechentext(),
      "nach bestätigter Sitzung fehlt der Entwurf — der Riegel löst sich nicht",
    ).toContain(SERVER_ENTWURF_TITEL);
  });

  it("F8c · KALIBRIERUNG der Gegenrichtung: mit bestätigter Sitzung steht der Entwurf wieder da", async () => {
    // Ohne diesen Fall wäre F8 auch dann grün, wenn die Liste GAR NICHT MEHR erscheint — dann hätte
    // der Riegel nicht den Zwischenspeicher gesperrt, sondern die Funktion zerstört.
    lage = "angemeldet";
    netz(true);

    await mount("/mobile", { vorbefuellen: true });

    expect(anmeldemaskeDa(), "mit bestätigter Sitzung steht die Anmeldemaske da").toBe(false);
    expect(
      flaechentext(),
      "mit bestätigter Sitzung fehlt der Entwurf — der Riegel greift zu weit",
    ).toContain(SERVER_ENTWURF_TITEL);
    expect(
      suche('[data-testid="mob-server-gesperrt-entwuerfe"]'),
      "der Sperrsatz steht da, obwohl die Sitzung bestätigt ist",
    ).toBeNull();
  });

  // ==============================================================================================
  // RUNDE 2 · BENs KORREKTURPFLICHT 2 — EIN DIENSTAUSFALL IST KEINE ABMELDUNG.
  // ==============================================================================================
  //
  // Vier Lagen ohne Auskunft über die Sitzung (503, 502, TIMEOUT, Transportfehler) gegen zwei mit
  // Auskunft (401, 403). Gemessen wird in EINEM Fall, damit die Grenze als Grenze sichtbar ist und
  // nicht als sechs unabhängige Zusicherungen.
  it("F9 · 503/502/TIMEOUT erhalten den Zähler — 401/403 führen zur Anmeldemaske", async () => {
    const befund: Record<string, { maske: boolean; zaehler: boolean; bestand: string[] }> = {};
    for (const fall of [
      "fehler503",
      "fehler502",
      "timeout",
      "keineSitzung",
      "verboten403",
    ] as const) {
      localStorage.clear();
      localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
      lage = fall;
      netz(true);
      await mount("/mobile");
      befund[fall] = {
        maske: anmeldemaskeDa(),
        zaehler: sichtbarerText(erfassungFlaeche()).includes(`${i18n.t("mob.queue")} · 1`),
        // Die Warteschlange wird in JEDEM Fall nachgesehen: keine Lage darf sie anfassen.
        bestand: warteschlangeImSpeicher().map(
          (v) => `${String(v.id)}/${String(v.eigentuemer)}/${String(v.status)}`,
        ),
      };
      abbauen();
    }

    expect(befund, "die Grenze zwischen Dienstausfall und Abmeldung stimmt nicht").toEqual({
      fehler503: { maske: false, zaehler: true, bestand: ["op-4333-a/konto-a/queued"] },
      fehler502: { maske: false, zaehler: true, bestand: ["op-4333-a/konto-a/queued"] },
      timeout: { maske: false, zaehler: true, bestand: ["op-4333-a/konto-a/queued"] },
      keineSitzung: { maske: true, zaehler: false, bestand: ["op-4333-a/konto-a/queued"] },
      verboten403: { maske: true, zaehler: false, bestand: ["op-4333-a/konto-a/queued"] },
    });
  });

  it("F1c · derselbe Schutz beim reinen Transportfehler (Netz gemeldet, nichts dahinter)", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    lage = "transportfehler";
    netz(true);

    await mount("/mobile");

    expect(anmeldemaskeDa(), 'ein Transportfehler wird als „keine Sitzung" gelesen').toBe(false);
    expect(
      sichtbarerText(erfassungFlaeche()),
      "der Zähler fehlt, obwohl der Server nicht geantwortet hat",
    ).toContain(`${i18n.t("mob.queue")} · 1`);
  });

  it("F1b-KALIBRIERUNG · genau der Offline-Satz ausgeblendet → seine Zusicherung scheitert", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    await mount("/mobile");

    const satz = suche('[data-testid="mob-sitzung-unbeantwortet"]') as HTMLElement;
    const zurueck = ausblenden(satz);
    expect(unsichtbarGrund(satz), "ausgeblendet und trotzdem sichtbar gemessen").not.toBeNull();
    zurueck();
    expect(unsichtbarGrund(satz)).toBeNull();
  });

  // ==============================================================================================
  // GEGENPROBE (b) — EIN BEANTWORTETER FEHLER IST KEINE WISSENSLÜCKE.
  // ==============================================================================================
  it("F2 · der Server sagt 401 → Anmeldemaske, der neue Zweig greift NICHT", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    lage = "keineSitzung";
    netz(true);

    await mount("/mobile");

    expect(anmeldemaskeDa(), "die Anmeldemaske fehlt, obwohl der Server geantwortet hat").toBe(
      true,
    );
    expect(erfassungFlaeche(), "die Erfassungsfläche steht trotz beantwortetem 401 da").toBeNull();
    // Und die Arbeit ist trotzdem nicht weg (Lieferung 5).
    expect(warteschlangeImSpeicher()).toHaveLength(1);
  });

  // ==============================================================================================
  // GEGENPROBE (c) — DIE SPERRE NACH GESCHEITERTEM STRENGEM ABMELDEN STEHT WEITERHIN VORNE.
  // ==============================================================================================
  it("F3 · signOutFailed → Sperrfläche, nicht die Erfassung", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    localStorage.setItem(ABMELDESCHULD_SCHLUESSEL, "1");

    await mount("/mobile");

    const sperre = suche('[data-testid="signout-blocked"]');
    expect(unsichtbarGrund(sperre), "die Sperrfläche fehlt oder ist nicht sichtbar").toBeNull();
    expect(
      erfassungFlaeche(),
      "die Erfassungsfläche steht trotz offener Abmeldeschuld da",
    ).toBeNull();
  });

  // ==============================================================================================
  // GEGENPROBE (d) — OHNE LIEGENDE ARBEIT GIBT ES KEINEN GRUND, DAS TOR ZU ÖFFNEN.
  // ==============================================================================================
  it("F4 · Warteschlange leer → Anmeldemaske wie bisher", async () => {
    await mount("/mobile");

    expect(anmeldemaskeDa(), "ohne liegende Arbeit fehlt die Anmeldemaske").toBe(true);
    expect(erfassungFlaeche(), "die Erfassung steht ohne liegende Arbeit da").toBeNull();
  });

  it("F5 · jede andere Route bleibt zu, auch ohne Netz und mit liegender Arbeit", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));

    await mount("/start");

    expect(anmeldemaskeDa(), "die Anmeldemaske fehlt auf einer anderen Route").toBe(true);
    expect(erfassungFlaeche(), "die Erfassung steht auf einer fremden Route da").toBeNull();
  });

  it("F6 · die Ersteinrichtung bleibt vor dem neuen Zweig", async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    lage = "ersteinrichtung";
    netz(true);

    await mount("/mobile");

    expect(istSichtbar(suche("#auth-name")), "die Ersteinrichtungsmaske fehlt").toBe(true);
    expect(erfassungFlaeche(), "die Erfassung verdrängt die Ersteinrichtung").toBeNull();
  });

  // ==============================================================================================
  // LIEFERUNG 5 — KOMMT DAS NETZ ZURÜCK, ENTSCHEIDET WIEDER DER SERVER.
  // ==============================================================================================
  it('F7 · Netz zurück und „keine Sitzung" → Anmeldemaske, die Warteschlange bleibt liegen', async () => {
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify([VORGANG]));
    await mount("/mobile");
    expect(
      erfassungFlaeche(),
      "der Ausgangszustand stimmt nicht: keine Erfassungsfläche",
    ).not.toBeNull();

    // ============================================================================================
    // RUNDE 2 (BENs Korrekturpflicht 3) — DIE NETZRÜCKKEHR IST DER EINZIGE HANDGRIFF.
    // ============================================================================================
    //
    // Hier stand in Runde 1 zusätzlich `qc.invalidateQueries({ queryKey: ["auth"] })`. Das ist ein
    // Griff, den der Nutzerweg NICHT tut — der Test half dem Produkt über die Stelle, die er
    // beweisen soll. Er ist ersatzlos weg. Was bleibt, ist genau das, was der Browser tut: der
    // Netzzustand kippt (`navigator.onLine` UND der OnlineManager von react-query), und das
    // `online`-Ereignis geht an das Fenster. Die angehaltenen Abfragen nimmt react-query dann von
    // selbst wieder auf.
    lage = "keineSitzung";
    netz(true);
    await act(async () => {
      globalThis.dispatchEvent(new Event("online"));
      await flush();
    });
    // Gewartet wird hier auf die ANMELDEMASKE und nicht auf „irgendeine Endfläche": die
    // Erfassungsfläche von eben steht ja noch da, und eine Schleife, die das als Ziel nähme, wäre
    // vor der Serverantwort fertig.
    await beruhigen("#auth-email");

    expect(anmeldemaskeDa(), "nach der Serverantwort fehlt die Anmeldemaske").toBe(true);
    expect(erfassungFlaeche(), "die Erfassung bleibt trotz Serverantwort stehen").toBeNull();
    expect(
      warteschlangeImSpeicher().map((v) => v.id),
      "die Warteschlange wurde beim Wechsel angefasst",
    ).toEqual([VORGANG.id]);
  });
});
