// @vitest-environment jsdom
// ================================================================================================
// JOB 3782 — DER ENTWURFSABRUF BEKOMMT EINE ZEITGRENZE.
// ================================================================================================
//
// DER BEFUND, von der Bahn des JOB 3633 selbst zu Protokoll gegeben
// (`archiv/3633/runde-2/RUECKGABE.md:34`, wörtlich): „Der Entwurfsabruf hat KEINE Zeitgrenze
// (`apps/web/src/api/client.ts`, `api.get` ohne Timeout; der Speicherweg hat eine:
// `withFrontDoorSaveTimeout`). Hängt die Antwort, bleibt das Blatt dauerhaft in ‚Der Entwurf wird
// geholt …' und nimmt nichts an."
//
// Neunzehn Zeilen unter `api.get` steht in DERSELBEN Datei das Gegenstück: `postWithTimeout`, mit
// dem Kopfkommentar „Pedis Spinner-Befund … kein endlos laufender Spinner mehr, egal was Netz/Server
// tun" (`client.ts:66-68`). Auf dem LADEweg war dieser Befund nie eingelöst.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST — und warum der naheliegende Aufbau nicht getragen hätte
// ------------------------------------------------------------------------------------------------
// Die gemounteten Entwurfs-Prüfstände dieses Hauses ersetzen üblicherweise das MODUL `api/endpoints`
// (so `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx`). Für diesen Auftrag wäre das der
// falsche Schnitt: die Frist SITZT in `endpoints.ts` und `client.ts`. Ein Prüfstand, der beide
// Dateien ersetzt, misst seine eigene Attrappe und bliebe auch dann grün, wenn die Frist im Produkt
// fehlte.
//
// Ersetzt wird deshalb nur der TRANSPORT: `globalThis.fetch` liegt auf `app.inject` der echten
// Fastify-App — dieselbe Brücke, die `tests/capture/job2705-drei-wege-textverlust.test.tsx:271`
// schon fährt. Damit läuft die ganze Kette: `Blatt.tsx` → `endpoints.drafts.get` →
// `api.getWithTimeout` → `apiFetch` → echte Route → echter Entwurfsdienst.
//
// DIE BRÜCKE BEACHTET DEN `signal` — und das ist keine Bequemlichkeit, sondern der Vertrag, an dem
// die ganze Zusage hängt: ein echtes `fetch` bricht bei `abort` mit einem `AbortError` ab. Eine
// Brücke, die das Signal ignoriert, liefe nach Fristablauf weiter und der Fall wäre ohne Aussage.
//
// DIE ZEIT WIRD GESTELLT (`vi.useFakeTimers`), und zwar SO ENG WIE MÖGLICH: gefälscht werden nur
// `setTimeout`/`clearTimeout` — genau die beiden, die die Frist aufspannen. Würde auch
// `setImmediate` gefälscht, stünde der Ereignisumlauf der echten Fastify-App still und der Aufbau
// mässe sich selbst. Aus demselben Grund wartet `flush()` über `setImmediate` und nicht über
// `setTimeout`.
//
// ------------------------------------------------------------------------------------------------
// DIE FÄLLE
// ------------------------------------------------------------------------------------------------
//   T1  Der Server antwortet NIE. Nach Ablauf der Frist endet der Ladezustand, der übersetzte
//       Rückfallsatz steht da, und das Blatt nimmt wieder an. (Vorher: rot — der Ladehinweis bleibt.)
//   T2  Derselbe Fall in EN und NL: der Mensch liest SEINE Sprache, nicht den deutschen Techniksatz
//       aus `client.ts:84`. (Vorher: rot.)
//   T3  DER GRÖSSTMÖGLICHE ENTWURF, der KNAPP innerhalb der Frist antwortet, kommt VOLLSTÄNDIG auf
//       der Fläche an: Titel, erste Zeile, letzte Zeile hinter der dreissigsten Abbildung, alle
//       dreissig Abbildungen im Text UND in der Galerie darunter, kein Verlusthinweis.
//       (Vorher UND nachher grün.)
//   T4  Eine fachliche Servermeldung gewinnt weiterhin gegen den Rückfalltext (Regel aus JOB 2705).
//       (Vorher UND nachher grün.)
//   T5  Ein VERWORFENER Ladelauf bleibt nach Fristablauf STILL — keine Störungsmeldung für einen
//       Entwurf, den niemand mehr sehen wollte (`Blatt.tsx:944-950`).
//   T6  Der RÜCKSPRUNG: wer aus einem offenen Entwurf einen zweiten öffnet, der hängt, bekommt nach
//       Fristablauf den übersetzten Satz als Meldung UND seinen ersten Entwurf zurück
//       (`Blatt.tsx:969-972`). Von ben als Prüflücke der Runde 1 benannt.
//
// ------------------------------------------------------------------------------------------------
// WAS SICH IN RUNDE 2 GEÄNDERT HAT — und warum T3 vorher nichts wert war
// ------------------------------------------------------------------------------------------------
// bens Befund, wörtlich: „T3 verwendet nur einen kurzen Absatz und prüft im Rumpf lediglich
// ‚Schmierstellen'. Meine Mutation zeigt: Selbst vollständiger Verlust grosser Rümpfe bleibt
// unentdeckt." Er hat im Blatt jeden Rumpf über einer Million Zeichen durch `""` ersetzt — die Datei
// blieb grün. Der Fall, der beweisen sollte, dass die Frist GROSSE Entwürfe nicht abschneidet, kannte
// keine grossen Entwürfe.
//
// T3 lädt seit dieser Runde DIESELBE Nutzlast, an der die Frist gemessen wurde
// (`./grosser-entwurf.ts`, rund 3,8 MiB, dreissig verankerte Abbildungen) — und prüft sie auf der
// FLÄCHE, nicht am Draht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
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
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { DRAFT_LOAD_TIMEOUT_MS } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { FRONT_DOOR_SAVE_TIMEOUT_MS } from "../../apps/web/src/lib/captureFrontDoor";
import { Capture } from "../../apps/web/src/pages/Capture";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  BILDER_IM_ENTWURF,
  GROSSER_TITEL,
  MARKE_ANFANG,
  MARKE_ENDE,
  grosserEntwurf,
} from "./grosser-entwurf";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ================================================================================================
// DIE FRIST STEHT HIER ABGESCHRIEBEN — UND ZWAR MIT ABSICHT.
// ================================================================================================
// Runde 1 hat die Zahl aus dem Produkt IMPORTIERT und ihre Uhr danach gestellt. Gemessen: Gegenprobe
// A („Frist auf einen sehr grossen Wert setzen") blieb GRÜN — mit der Frist wanderte auch die
// Vorstelldistanz des Prüfstands mit, und er konnte prinzipiell nicht mehr melden, dass die Frist
// verstellt wurde. Ein Prüfstand, der seinen Massstab vom Prüfling bezieht, misst nichts.
//
// Deshalb: eine EIGENE, absolute Zahl. Sie ist der zweite Halt der Zusage, und T0 bindet beide
// aneinander. Wer die Frist im Produkt bewusst ändert, ändert T0 mit — und liest dabei die
// Begründung an `DRAFT_LOAD_TIMEOUT_MS`, die genau dafür dasteht.
const FRIST_MS = 25_000;

const TITEL = "Presse P4 abschmieren";
const RUMPF = "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>";
/** Der Techniksatz aus `client.ts:84` — er gehört ins Protokoll, nicht auf die Fläche. */
const TECHNIKSATZ = "clientseitig abgebrochen";

let app: FastifyInstance;
let token = "";
let vorherigerFetch: typeof globalThis.fetch;

/**
 * Die Bremse für GENAU EINE Adresse: den Abruf dieses einen Entwurfs. Die Entwurfsliste, die
 * Rechte, die Einstellungen — alles andere läuft ungebremst, sonst mässe der Fall den Seitenaufbau
 * statt des Ladewegs.
 */
let gebremsteAdresse: string | null = null;
/** `null` heisst: diese Adresse antwortet NIE (T1/T2/T5). Sonst: nach so vielen Millisekunden. */
let antwortNach: number | null = null;

const kopf = (): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

/**
 * Warten, ohne die gestellte Zeit zu bewegen: `setImmediate` ist NICHT gefälscht (s. Kopf). Damit
 * laufen Zusagen, Ereignisumlauf und React weiter, während die Uhr steht — genau die Trennung, die
 * ein Fristfall braucht.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setImmediate(r));
  }
};

/** Die gestellte Uhr vorstellen und die Fläche danach zur Ruhe kommen lassen. */
async function zeitVorstellen(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await flush();
  });
  await act(flush);
}

async function serverStarten(): Promise<void> {
  const services = buildServices();
  app = buildApp(services);
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3782.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3782.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

async function entwurfAnlegen(titel: string = TITEL): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: kopf(),
    payload: JSON.stringify({
      title: titel,
      statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
      bodyHtml: RUMPF,
      category: "Instandhaltung",
      confidentiality: "intern",
      origin: "frontdoor",
    }),
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

/**
 * DERSELBE ENTWURF, an dem die Frist gemessen wurde (`./grosser-entwurf.ts`, `frist-messung.test.ts`).
 * Er wird über die echte Route angelegt — schlägt das fehl (Parserlimit, Sanitizer), sagt es die
 * Meldung hier und nicht ein rätselhaft leeres Blatt zwanzig Zeilen später.
 */
async function grossenEntwurfAnlegen(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: kopf(),
    payload: JSON.stringify(grosserEntwurf()),
  });
  expect(res.statusCode, `grosser Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

/** Den Abruf dieses Entwurfs anhalten. `ms === null` heisst „für immer". */
function bremsen(kennung: string, ms: number | null): void {
  gebremsteAdresse = `/api/drafts/${kennung}`;
  antwortNach = ms;
}

// ------------------------------------------------------------------------------------------------
// FLÄCHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/** Wohin `nach-ziel` führt — vor dem Klick gesetzt (T6 wechselt damit den Entwurf). */
let zielAdresse = "/erfassen";

/**
 * Wege, die es im Produkt gibt: ein Verweis zurück auf `/erfassen` OHNE Entwurf (T5) und ein
 * Verweis auf EINEN ANDEREN Entwurf (T6 — im Produkt die Liste „Meine Entwürfe").
 */
function Wege(): JSX.Element {
  const gehe = useNavigate();
  return createElement(
    "div",
    null,
    createElement("button", {
      key: "raus",
      type: "button",
      "data-testid": "nach-erfassen",
      onClick: () => gehe("/erfassen"),
    }),
    createElement("button", {
      key: "ziel",
      type: "button",
      "data-testid": "nach-ziel",
      onClick: () => gehe(zielAdresse),
    }),
  );
}

/** Einen der beiden Wege oben gehen und die Fläche danach zur Ruhe kommen lassen. */
async function wegGehen(testid: string): Promise<void> {
  const knopf = container.querySelector(`[data-testid="${testid}"]`);
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Weg „${testid}" nicht gefunden`);
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
}

async function seiteOeffnen(pfad: string): Promise<void> {
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
                MemoryRouter,
                { initialEntries: [pfad] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                    ),
                    createElement(Wege),
                    // Der ECHTE Auslass der Shell (`shell/ToastViewport.tsx`), nicht eine
                    // Nachbildung: der Rücksprung in T6 meldet über `push()`, und eine Meldung, die
                    // nirgends gezeichnet wird, ist keine. Dieselbe Bauform wie in
                    // `tests/entwuerfe-verwalten/blatt-entwuerfe-verwalten.test.tsx`.
                    createElement(ToastViewport),
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

/** Der Satz an der Stelle der Schreibfläche: „Der Entwurf wird geholt …". `null` = er steht nicht da. */
function ladehinweis(): HTMLElement | null {
  const el = container.querySelector('[data-testid="blatt-nicht-bereit"]');
  return el instanceof HTMLElement ? el : null;
}

/** Die Schreibfläche, WENN es sie gibt — `null` heisst: das Blatt nimmt gerade nichts an. */
function schreibfeld(): HTMLElement | null {
  const el = container.querySelector('[data-testid="blatt-text"] [role="textbox"]');
  return el instanceof HTMLElement ? el : null;
}

function schreibfeldPflicht(): HTMLElement {
  const el = schreibfeld();
  if (!el) {
    throw new Error(`Schreibfeld nicht gefunden. Sichtbar: ${seitentext().slice(0, 300)}`);
  }
  return el;
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

async function tippeRumpf(html: string): Promise<void> {
  const feld = schreibfeldPflicht();
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  // NUR diese beiden Uhren: `setImmediate` und alles andere bleiben echt (Begründung im Kopf).
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await i18n.changeLanguage("de");
  gebremsteAdresse = null;
  antwortNach = null;
  zielAdresse = "/erfassen";
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (methode === "GET" && gebremsteAdresse !== null && url === gebremsteAdresse) {
      // Der Abbruch kommt vom CLIENT. Ein echtes `fetch` wirft dann einen `AbortError`; genau das
      // tut die Brücke hier, sonst wäre der Abbruch im Prüfstand folgenlos.
      await new Promise<void>((aufloesen, ablehnen) => {
        init?.signal?.addEventListener("abort", () => {
          ablehnen(new DOMException("The operation was aborted.", "AbortError"));
        });
        if (antwortNach !== null) {
          setTimeout(aufloesen, antwortNach);
        }
      });
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
  await serverStarten();
  // LEHRE aus JOB 3564/3584 (LEHREN.md): ein Haken, der eine Fastify-App auf- oder abbaut, bekommt
  // seinen EIGENEN Zeitrahmen. Vitest gibt Haken sonst 10 s, unabhängig von `testTimeout` — auf
  // einem geteilten Rechner macht das die Datei rot, obwohl jede Prüfung grün ist.
}, 60_000);

afterEach(async () => {
  globalThis.fetch = vorherigerFetch;
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  vi.useRealTimers();
  await app.close();
}, 60_000);

describe("JOB 3782: der Entwurfsabruf hat eine Zeitgrenze", () => {
  it("T0: der Entwurfsabruf trägt GENAU die Frist, gegen die die Fälle unten messen", () => {
    // Ohne diese Zeile wäre `FRIST_MS` eine zweite Wahrheit neben dem Produkt. Mit ihr ist es ein
    // Halt: eine verstellte Frist meldet sich HIER mit beiden Zahlen, und die Fälle darunter messen
    // weiter gegen die Uhr, gegen die sie geschrieben wurden.
    expect(
      DRAFT_LOAD_TIMEOUT_MS,
      "die Frist des Entwurfsabrufs wurde verstellt — Begründung in endpoints.ts nachführen und diese Zahl mit",
    ).toBe(FRIST_MS);
    // DIE GEGENPROBE AM HAUS: der Speicherweg fährt dieselbe Datenmenge in der SCHWEREREN Richtung
    // (hoch statt runter) mit 30 s. Eine LADEfrist über der bewährten SPEICHERfrist wäre nicht
    // vorsichtig, sondern unbegründet. Die Rechnung selbst klammert `frist-messung.test.ts` (M2)
    // von beiden Seiten ein; hier steht nur der Vergleich mit dem Bestand.
    expect(
      DRAFT_LOAD_TIMEOUT_MS,
      "die Ladefrist liegt über der Speicherfrist des Hauses — dafür steht keine Zahl",
    ).toBeLessThan(FRONT_DOOR_SAVE_TIMEOUT_MS);
  });

  it("T1: antwortet der Server nie, endet der Ladezustand nach der Frist — mit dem ehrlichen Satz", async () => {
    const kennung = await entwurfAnlegen();
    bremsen(kennung, null);
    await seiteOeffnen(`/erfassen?draft=${kennung}`);

    // Das Ladefenster steht wirklich offen — sonst misst dieser Fall den Zustand danach.
    expect(ladehinweis(), "kein Ladehinweis — der Abruf hängt gar nicht").not.toBeNull();
    expect(schreibfeld(), "Schreibfläche im Ladefenster vorhanden").toBeNull();

    // KURZ VOR DER FRIST ist alles unverändert: die Frist bricht nicht früher ab, als sie zusagt.
    await zeitVorstellen(FRIST_MS - 1_000);
    expect(ladehinweis(), "der Ladezustand endete VOR der Frist").not.toBeNull();

    // ============================================================================================
    // DER BEFUND, UMGEDREHT: hier stand das Blatt bis zu diesem Auftrag DAUERHAFT.
    // ============================================================================================
    await zeitVorstellen(2_000);

    expect(ladehinweis(), "der Ladehinweis steht nach Ablauf der Frist immer noch").toBeNull();
    expect(seitentext()).toContain(i18n.t("fd.errLoadFailed"));
    // Und zwar der ÜBERSETZTE Satz, nicht die technische Meldung aus `client.ts`.
    expect(seitentext()).not.toContain(TECHNIKSATZ);

    // Die Fläche nimmt WIRKLICH wieder an — gemessen am Tippen, nicht an einem Attribut.
    expect(titelfeld().disabled).toBe(false);
    await tippeRumpf("<p>Dann schreibe ich es eben neu.</p>");
    expect(schreibfeldPflicht().textContent).toContain("Dann schreibe ich es eben neu.");
  });

  it("T2: der Mensch liest seine Sprache — EN und NL, nicht den deutschen Techniksatz", async () => {
    for (const sprache of ["en", "nl"] as const) {
      const kennung = await entwurfAnlegen();
      await act(async () => {
        await i18n.changeLanguage(sprache);
        await flush();
      });
      bremsen(kennung, null);
      await seiteOeffnen(`/erfassen?draft=${kennung}`);
      expect(ladehinweis(), `${sprache}: der Abruf hängt gar nicht`).not.toBeNull();

      await zeitVorstellen(FRIST_MS + 1_000);

      const satz = i18n.getResource(sprache, "translation", "fd.errLoadFailed") as string;
      expect(satz.length, `${sprache}: kein Satz im Katalog`).toBeGreaterThan(0);
      expect(seitentext(), `${sprache}: der übersetzte Satz fehlt`).toContain(satz);
      expect(
        seitentext(),
        `${sprache}: der deutsche Techniksatz steht auf der Fläche`,
      ).not.toContain(TECHNIKSATZ);
      // Und der DEUTSCHE Rückfallsatz steht dort ebenso wenig — sonst wäre „übersetzt" Zufall.
      expect(seitentext()).not.toContain(
        i18n.getResource("de", "translation", "fd.errLoadFailed") as string,
      );

      act(() => root?.unmount());
      container.remove();
      root = null;
    }
  });

  it("T3: der GRÖSSTMÖGLICHE Entwurf, knapp innerhalb der Frist, kommt VOLLSTÄNDIG auf der Fläche an", async () => {
    const kennung = await grossenEntwurfAnlegen();
    // Eine Sekunde vor Schluss — der Fall, den die Bahn von 3633 als Grund gegen jede Frist
    // genannt hat („eine Frist bricht auch das Laden grosser Entwürfe ab").
    bremsen(kennung, FRIST_MS - 1_000);
    await seiteOeffnen(`/erfassen?draft=${kennung}`);
    expect(ladehinweis()).not.toBeNull();

    await zeitVorstellen(FRIST_MS - 1_000);
    // Die Galerie unter dem Blatt liest den Rumpf über eine Pause von 300 ms
    // (`LIBRARY_SEARCH_DEBOUNCE_MS`) — ohne diesen Schritt prüfte der Fall sie, bevor sie gelesen
    // hat, und ihr Befund wäre „unbekannt" statt „vollständig".
    await zeitVorstellen(1_000);

    expect(ladehinweis(), "der Ladehinweis steht, obwohl die Antwort rechtzeitig kam").toBeNull();
    expect(seitentext()).not.toContain(i18n.t("fd.errLoadFailed"));
    expect(titelfeld().value).toBe(GROSSER_TITEL);

    // ============================================================================================
    // VOLLSTÄNDIG HEISST: ANFANG, ENDE, UND ALLES DAZWISCHEN.
    // ============================================================================================
    // Ein Rumpf aus viertausend gleichen Absätzen lässt sich kappen, ohne dass ein Stichwort fehlt.
    // Deshalb wird gegen die beiden EIGENEN Marken geprüft — und die Schlussmarke steht hinter der
    // dreissigsten Abbildung, also am Ende der Bytes, die eine gekappte Übertragung zuerst verliert.
    const feld = schreibfeldPflicht();
    expect(feld.textContent, "die erste Zeile des Gesamtdokuments fehlt").toContain(MARKE_ANFANG);
    expect(feld.textContent, "die LETZTE Zeile fehlt — der Rumpf kam gekappt an").toContain(
      MARKE_ENDE,
    );
    expect(feld.querySelectorAll("img").length, "nicht alle Abbildungen stehen im Text").toBe(
      BILDER_IM_ENTWURF,
    );
    expect(
      feld.querySelectorAll("figcaption").length,
      "nicht alle Bildunterschriften stehen im Text",
    ).toBe(BILDER_IM_ENTWURF);
    // Und die MENGE: die Bilddaten selbst sind der Grossteil dieses Entwurfs. Ein Rumpf, aus dem nur
    // die `src`-Werte gefallen wären, hätte oben noch dreissig `<img>` — hier nicht mehr.
    expect(
      feld.innerHTML.length,
      `der Rumpf auf der Fläche ist zu klein (${feld.innerHTML.length} Zeichen)`,
    ).toBeGreaterThan(3_000_000);

    // ============================================================================================
    // DIE ANHÄNGE SAGEN ES SELBST — und zwar die Fläche, nicht der Prüfstand.
    // ============================================================================================
    // Die Galerie unter dem Blatt zieht ihre Kacheln aus demselben Rumpf (`extractBodyImages`) und
    // vergleicht ihre Zahl mit der Quellbildzahl des Entwurfs (`sourceImageCount`, gesetzt in
    // `grosser-entwurf.ts`). Fehlte auch nur EINE Abbildung, stünde hier der Verlusthinweis.
    expect(
      container.querySelectorAll("button > img").length,
      "die Galerie unter dem Blatt zeigt nicht alle Abbildungen",
    ).toBe(BILDER_IM_ENTWURF);
    expect(
      container.querySelector('[data-testid="draft-gallery-loss"]'),
      "die Fläche meldet selbst einen Bildverlust",
    ).toBeNull();
    // Und kein zurückgehaltener Rumpf: dieser Entwurf beruft sich auf keine fehlenden Originale, es
    // ist also wirklich die Frist, die hier geprüft wird, und nicht die Ankerprüfung.
    expect(
      container.querySelector("[data-anker-fehlt]"),
      "der Rumpf wurde wegen fehlender Anker zurückgehalten",
    ).toBeNull();

    // UND DIE UHR LÄUFT WEITER: die Frist wurde beim Erfolg abgeräumt (`clearTimeout` im `finally`).
    // Ohne das schlüge sie dem fertig geladenen Entwurf eine Sekunde später ins Gesicht.
    await zeitVorstellen(60_000);
    expect(seitentext(), "die abgeräumte Frist meldet sich nachträglich").not.toContain(
      i18n.t("fd.errLoadFailed"),
    );
    expect(titelfeld().value).toBe(GROSSER_TITEL);
    expect(schreibfeldPflicht().textContent).toContain(MARKE_ENDE);
  }, 120_000);

  it("T4: eine fachliche Servermeldung gewinnt weiterhin gegen den Rückfalltext (JOB 2705)", async () => {
    // Eine Kennung, die es auf diesem Server nie gab — die echte 404 der echten Route
    // (`capture-routes.ts:85`: „Entwurf nicht gefunden.").
    await seiteOeffnen("/erfassen?draft=1ec48b98-0320-445e-a7de-25c8ecd21b98");

    expect(ladehinweis()).toBeNull();
    expect(seitentext()).toContain("Entwurf nicht gefunden.");
    expect(seitentext(), "der Rückfalltext verdeckt die Auskunft des Servers").not.toContain(
      i18n.t("fd.errLoadFailed"),
    );
  });

  it("T5: ein verworfener Ladelauf bleibt nach Fristablauf STILL", async () => {
    const kennung = await entwurfAnlegen();
    bremsen(kennung, null);
    await seiteOeffnen(`/erfassen?draft=${kennung}`);
    expect(ladehinweis()).not.toBeNull();

    // Die Adresse verliert den Entwurf MITTEN im Laden: der Ladelauf ist damit überholt.
    await wegGehen("nach-erfassen");
    expect(ladehinweis(), "die Sperre überlebt das Verlassen des Entwurfs").toBeNull();

    await zeitVorstellen(FRIST_MS + 1_000);

    // „Der Entwurf konnte nicht geladen werden" wäre hier eine Störungsmeldung für einen Vorgang,
    // den der Mensch selbst verlassen hat (`Blatt.tsx:944-950`).
    expect(seitentext(), "der verworfene Lauf meldet sich nach Fristablauf").not.toContain(
      i18n.t("fd.errLoadFailed"),
    );
    expect(seitentext()).not.toContain(TECHNIKSATZ);
    await tippeRumpf("<p>Ein neues Blatt, sofort beschreibbar.</p>");
    expect(schreibfeldPflicht().textContent).toContain("Ein neues Blatt");
  });

  it("T6: hängt der ZWEITE Entwurf, kommt der erste zurück — mit der übersetzten Meldung", async () => {
    // ============================================================================================
    // bens Prüflücke 6 der Runde 1, wörtlich: „fehlt ein gezielter Timeout-Test für den Rücksprung
    // zu einer vorherigen Entwurfskennung (`Blatt.tsx:969`); Vorschlag: A laden, B hängen lassen,
    // nach dessen Timeout A und die übersetzte Meldung prüfen."
    // ============================================================================================
    // Dieser Zweig ist der einzige, der die Meldung NICHT als Fehlerzeile am Blatt setzt, sondern
    // als Toast schickt (`push`) — und er reicht sie durch dieselbe `ladeFehlerMeldung`. Ohne
    // diesen Fall wäre die TIMEOUT-Abbildung nur auf EINEM der beiden Fehlerwege belegt.
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    // Zwei UNTERSCHEIDBARE Entwürfe — sonst sagte „der Titel steht noch da" nichts darüber, WELCHER
    // Entwurf im Blatt liegt.
    const ERSTER = "Presse P4 abschmieren";
    const ZWEITER = "Foerderband F7 spannen";
    const ersterEntwurf = await entwurfAnlegen(ERSTER);
    const zweiterEntwurf = await entwurfAnlegen(ZWEITER);

    await seiteOeffnen(`/erfassen?draft=${ersterEntwurf}`);
    expect(ladehinweis(), "der erste Entwurf lädt gar nicht erst").toBeNull();
    expect(titelfeld().value, "der erste Entwurf steht nicht im Blatt").toBe(ERSTER);

    // Jetzt den ZWEITEN öffnen — und der antwortet nie.
    bremsen(zweiterEntwurf, null);
    zielAdresse = `/erfassen?draft=${zweiterEntwurf}`;
    await wegGehen("nach-ziel");
    expect(ladehinweis(), "der zweite Abruf hängt gar nicht").not.toBeNull();

    await zeitVorstellen(FRIST_MS + 1_000);

    // DIE MELDUNG: übersetzt, nicht der deutsche Techniksatz aus `client.ts`.
    const satz = i18n.getResource("en", "translation", "fd.errLoadFailed") as string;
    expect(seitentext(), "die Meldung des Rücksprungs fehlt oder ist nicht übersetzt").toContain(
      satz,
    );
    expect(seitentext(), "der deutsche Techniksatz steht auf der Fläche").not.toContain(
      TECHNIKSATZ,
    );

    // UND DER ERSTE ENTWURF IST WIEDER DA — er wurde nicht vom gescheiterten zweiten mitgerissen
    // (JOB 2974 D3, F-0040). Die Fläche nimmt auf ihm wieder an.
    expect(ladehinweis(), "das Blatt hängt weiter im Ladezustand").toBeNull();
    expect(titelfeld().value, "der eigene Entwurf wurde vom fremden mitgenommen").toBe(ERSTER);
    expect(titelfeld().value, "der hängende Entwurf steht im Blatt").not.toBe(ZWEITER);
    await tippeRumpf("<p>Und weiter geht es im ersten Entwurf.</p>");
    expect(schreibfeldPflicht().textContent).toContain("Und weiter geht es");
  });
});
