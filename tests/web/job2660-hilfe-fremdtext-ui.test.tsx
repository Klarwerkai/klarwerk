// @vitest-environment jsdom
// ================================================================================================
// JOB 2660 · D2 — DER FREMDTEXT AN DER STELLE, WO DER MENSCH HANDELT
// ================================================================================================
//
// PEDIS FRAGE, die dieser Test beantwortet:
//
//   „Sehe ich in der Hilfe, dass mein eigener Text nicht geprueft ist?"
//
// BENs Prueflueke zu `2660 D1`, WOERTLICH — sie ist der Auftragstext:
//
//   „Ort: Komponenten-/Integrationstest der Hilfe-Interaktion um
//    `apps/web/src/components/KlaraAssistant.tsx` (z. B. `tests/web/job2660-hilfe-fremdtext-ui.
//    test.tsx`). Fall: Ein angemeldeter Nutzer loest mit einem client-gelieferten Fremdtext die
//    Erklaerung aus. Erwartet: Der gerenderte Zustand zeigt weder „validiert/gesichert" noch
//    Vertrauen 90, sondern die ungeprueffte beziehungsweise ehrliche Lueckenwirkung; der Test
//    muss den tatsaechlichen Clientabruf und Renderer durchlaufen."
//
// WARUM D1 NICHT REICHTE, und es ist keine Formalie: D1 hat den Serverweg geschlossen und dafuer
// W0-W3 vorgelegt — alle vier rufen `POST /api/help/explain`. BEN hat das als Scheinbeleg
// zurueckgewiesen und dabei sein eigenes Urteil aus `2614 D4` zitiert: „`answered=true` plus KO
// in `sources` am API-Endpunkt ist ein Scheinbeleg." Dieser Test misst deshalb am BILDSCHIRM.
//
// WAS HIER ECHT IST — und das ist der ganze Punkt:
//   * die echte Komponente `KlaraAssistant` mit ihren echten Providern,
//   * der echte Clientabruf `endpoints.help.explain` -> `api.post` -> `fetch("/api/help/explain")`,
//   * die echte App dahinter (`buildApp`/`buildServices`) mit der echten Route und dem echten
//     Reasoner,
//   * der echte Renderer.
// Der EINZIGE Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject`. Die Bauform
// stammt woertlich aus `tests/app/job2614-fundstelle-sichtbar.test.tsx` (dort ausfuehrlich
// begruendet). Sie ist hier zusaetzlich zwingend, weil die Bahn-Sandbox keinen Horchsocket
// zulaesst (`listen EPERM`) — ein echter Port waere in dieser Umgebung gar nicht zu bekommen.
//
// WO DER FREMDTEXT HEREINKOMMT — die Stelle ist bewusst gewaehlt und sie ist die realistische:
// Die Hilfe-Schnipsel kommen NICHT vom Server. `KlaraAssistant.askAi()` bildet sie aus der
// Registry, die im FRONTEND lebt (`apps/web/src/lib/klaraRegistry.ts`), und schickt sie im Rumpf
// mit — `help-routes.ts` sagt das in seinem Kopfkommentar selbst: „Der Client schickt die Frage
// PLUS die best-passenden Eintraege der Hilfe-Wissensdatenbank." Genau das meint BENs Wort
// „client-geliefert": Der Server kann nicht wissen, ob der Text, den er stempelt, wirklich aus
// der kuratierten Hilfe stammt. Ein veraenderter Client-Bestand (Erweiterung, manipuliertes
// Bundle, ein gefaelschter i18n-Katalog) liefert Fremdtext an derselben Stelle. Der Test bildet
// das an genau dieser Stelle nach: Er setzt den Text eines Registry-Eintrags per i18n-Ressource
// um. Ab da laeuft alles echt — Ranking, Abruf, Route, Reasoner, Renderer.
//
// ZUR DATEIENDUNG: `.test.tsx`, weil eine `.test.ts` kein JSX uebersetzt (`error TS6142`).
// Pfad und Name sind exakt die von BEN verlangten.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Beschriftung der Modellstufe (RFC-2606-Kennung, wird nie aufgeloest): Sie gibt den KI-Knopf im
// Panel frei — ohne nutzbares Modell ist er HART ausgegraut (`useAiAvailable("answer")`), und der
// Test koennte die Interaktion gar nicht ausloesen. Der Aufruf endet an der In-Process-Grenze
// unten; die Antwort entsteht ueber den dokumentierten deterministischen Rueckfall der
// Providerkette. Bauform und Begruendung: `job2614-fundstelle-sichtbar.test.tsx`.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job2660-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { authApi } from "../../apps/web/src/api/auth";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { allKlaraEntries, resolveKlaraEntries } from "../../apps/web/src/lib/klaraRegistry";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// DER FREMDTEXT
// ------------------------------------------------------------------------------------------------
// Ein Fantasiewort, das im echten Produktbestand NIRGENDS vorkommt. Es traegt drei Lasten:
//   1. Es macht den eingeschleusten Eintrag zum einzigen Treffer der Frage — jeder andere
//      Registry-Eintrag rankt auf 0, `best` im Reasoner ist damit zwingend der Fremdtext.
//   2. Es belegt spaeter, dass die sichtbare Antwort WIRKLICH aus dem Fremdtext stammt und nicht
//      aus echter Hilfe (K2). Ohne diesen Nachweis maesse der Ausschluss unten nichts.
//   3. Seine Abwesenheit im Bestand wird unten aktiv geprueft (K0) — ein Wort, das zufaellig doch
//      irgendwo steht, wuerde die Messung still verfaelschen.
const FANTASIEWORT = "Zwirbelfugenkalibrat";
// ZWEITES Fantasiewort, und es ist keine Zierde: Das Relevanzmass des Reasoners verlangt
// MINDESTENS ZWEI gemeinsame Inhaltstoken zwischen Frage und Quelle (`MIN_ANSWER_SUBSTANCE = 2`,
// `services/reasoner/src/provider.ts`) — mit nur einem gemeinsamen Wort faellt der Fall in die
// ehrliche Wissensluecke, und der Missbrauchsfall waere nie erreicht worden. Genau so lief der
// vierte Lauf dieses Tests: gesendet wurde der Fremdtext, geliefert
// `{"answered":false,"knowledgeClass":"unbekannt"}`.
const ZWEITWORT = "Plombierstufe";
const FREMDTITEL = `${FANTASIEWORT} auf ${ZWEITWORT} bringen`;
const FREMDTEXT =
  `Das ${FANTASIEWORT} wird vor jedem Schichtbeginn auf ${ZWEITWORT} gedreht und dann verplombt.`;
const FRAGE = `Wie bringe ich das ${FANTASIEWORT} auf ${ZWEITWORT}?`;
// Dieselbe Quelle, aber nur EIN gemeinsames Inhaltstoken: Der Client rankt den Fremdtext und
// schickt ihn mit, der Reasoner verwirft ihn an seiner Mindestsubstanz. So entsteht die von BEN
// zugelassene „ehrliche Lueckenwirkung" auf dem ECHTEN Weg — ohne dass irgendetwas gestellt wird.
const FRAGE_OHNE_SUBSTANZ = `Was ist ein ${FANTASIEWORT}?`;

// Die Woerter, die laut Abnahme NICHT sichtbar werden duerfen — in allen drei Sprachen des
// Katalogs, damit der Ausschluss nicht an der eingestellten Sprache haengt.
const VERBOTENE_WOERTER = [
  "Gesichert",
  "Verified",
  "Gecontroleerd",
  "validiert",
  "Validiert",
] as const;

// Dieselbe Menge als EIN Muster — BEWUSST OHNE Wortgrenzen, und das ist gemessen, nicht erwogen:
// Der erste Entwurf dieses Durchgangs band die Treffer mit `\b` an ganze Woerter. Im DOM laufen
// die Textknoten jedoch ohne Trennzeichen zusammen; das Panel liefert woertlich
//
//   „…nicht zu 100 % geprüftGesichertDas Zwirbelfugenkalibrat…"
//
// Vor „Gesichert" steht ein „t", dahinter ein „D" — es gibt dort gar keine Wortgrenze. Der
// Ausschluss lief ins Leere und meldete `null` als Treffer, waehrend das Etikett sichtbar
// „Gesichert" trug. Ein Ausschlusstest, der genau im Ernstfall nicht anschlaegt, ist schlimmer
// als keiner. Deshalb: Teilstring-Suche wie in D2.
const VERBOTENE_WOERTER_MUSTER = new RegExp(`(${VERBOTENE_WOERTER.join("|")})`);

// ------------------------------------------------------------------------------------------------
// DER DRAHT — Transport-Ersatz, sonst nichts. Plus die Modellgrenze fuer absolute Adressen.
// ------------------------------------------------------------------------------------------------
let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
// Jede Antwort, die der CLIENT tatsaechlich verarbeitet hat — nicht die des Servers „irgendwo",
// sondern genau das, was durch den Draht in den Renderer ging. Damit laesst sich unten pruefen,
// ob die Flaeche zeigt, was sie bekommen hat (Kalibrierung K3), statt ein hartkodiertes Etikett.
const erklaerAntworten: { knowledgeClass?: string; trust?: number; answered?: boolean }[] = [];
// Der Modellstatus, den die Flaeche gezogen hat. Er entscheidet, ob der KI-Knopf ueberhaupt
// bedienbar ist — ohne ihn im Fehlerbild suchte man den Grund fuer einen grauen Knopf im Blinden.
let letzterModellstatus = "(nie abgerufen)";
// Wie oft die Modellkante angefragt wurde — Beleg, dass der Rueckfall aus einer ERREICHBAREN,
// aber nicht generierenden Kante entsteht und nicht aus einer stillschweigend uebersprungenen.
let modellkanteAngefragt = 0;
// Was der Client GESENDET hat, und was schiefging, falls die Route ablehnt. Beides gehoert ins
// Fehlerbild: Ohne den gesendeten Rumpf laesst sich nicht unterscheiden, ob der Fremdtext gar
// nicht mitging oder ob der Server ihn verworfen hat.
const erklaerAnfragen: string[] = [];
const erklaerFehler: string[] = [];

const rumpfAlsText = (init?: RequestInit): string =>
  init?.body === undefined || init.body === null ? "" : String(init.body);

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      // DIE IN-PROCESS-MODELLGRENZE, und warum sie hier ANTWORTET statt zu werfen:
      // Der KI-Knopf im Panel ist hart ausgegraut, solange der Server die Modellkante als
      // `reachable: "unreachable"` fuehrt (`aiAvailability.ts` -> `deriveAiAvailable`). Ein
      // geworfener Fehler setzt genau diesen Zustand — gemessen: der erste Lauf dieses Tests
      // scheiterte daran, mit `{"active":true,"mode":"local","reachable":"unreachable",
      // "tasks":{...,"answer":false,...}}`. Die Kante muss also ERREICHBAR sein, damit die
      // menschliche Handlung ueberhaupt ausloesbar ist.
      // Die Grenze trennt deshalb GENAU ZWEI Anfragearten, und zwar am Inhalt:
      //   * Der Erreichbarkeits-Ping (`probeLocal`, ein Mini-Aufruf ohne unseren Fall) bekommt
      //     eine knappe, gueltige Antwort — nur damit die Kante als erreichbar gilt.
      //   * Die HILFE-GENERIERUNG — erkennbar daran, dass der Fremdtext im Rumpf steht — bekommt
      //     eine unbrauchbare Antwort. Sie scheitert, und das Ergebnis entsteht ueber den
      //     dokumentierten deterministischen Rueckfall der Providerkette.
      // Damit erfindet diese Zeile KEINEN Antworttext fuer den Prueffall: Was gleich sichtbar
      // wird, stammt aus dem Bestand, nicht aus dem Draht. Genau das wird unten mit K3 gemessen.
      modellkanteAngefragt += 1;
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const istGenerierung = rumpf.includes(FANTASIEWORT);
      // Der Modellclient liest ueber `res.json()`, der Web-Client ueber `res.text()` — beide
      // Wege muessen bedient sein, sonst gilt eine beantwortete Kante still als tot (genau daran
      // scheiterte der zweite Lauf dieses Tests: Ping erreicht, `reachable` trotzdem
      // „unreachable", weil nur `text()` bereitstand).
      const nutzlast = istGenerierung
        ? {}
        : { choices: [{ message: { content: "bereit" } }] };
      return {
        status: 200,
        statusText: "200",
        ok: true,
        text: async () => JSON.stringify(nutzlast),
        json: async () => nutzlast,
      };
    }
    if (!drahtApp) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await drahtApp.inject({
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
    if (url.startsWith("/api/help/explain")) {
      erklaerAnfragen.push(rumpfAlsText(init));
      if (antwort.statusCode === 200) {
        erklaerAntworten.push(antwort.json() as { knowledgeClass?: string; trust?: number });
      } else {
        erklaerFehler.push(`${antwort.statusCode} ${antwort.body}`);
      }
    }
    if (url.startsWith("/api/reasoner/status") && antwort.statusCode === 200) {
      letzterModellstatus = antwort.body;
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

// ------------------------------------------------------------------------------------------------
// FLAECHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Der Fremdtext wird an der Stelle eingesetzt, an der der Client seine Schnipsel bildet: im
 * aufgeloesten Text eines Registry-Eintrags. Der Eintrag wird zur Laufzeit aus `allKlaraEntries()`
 * geholt statt hier abgeschrieben — so bleibt der Test gueltig, wenn die Registry umgebaut wird.
 */
function fremdtextEinschleusen(): { titleKey: string; bodyKey: string } {
  const eintrag = allKlaraEntries().find((e) => e.titleKey.length > 0 && e.bodyKey.length > 0);
  if (!eintrag) {
    throw new Error("Registry ohne aufloesbaren Eintrag — der Einschleusungsort fehlt.");
  }
  // `addResourceBundle` mit flachem Objekt, NICHT `addResource`: Der Katalog in `i18n.ts` ist flach
  // („ask.knowledgeClass.gesichert" ist EIN Schluessel, kein Pfad), waehrend `addResource` den
  // Punkt als Trennzeichen liest und verschachtelt ablegt. Der Wert landete dann an einer Stelle,
  // die `t()` fuer diesen Schluessel nie liest — im dritten Lauf dieses Tests genau so passiert:
  // die Einschleusung lief ins Leere, der Fall maß eine leere Hilfe statt eines Fremdtexts.
  i18n.addResourceBundle(
    "de",
    "translation",
    { [eintrag.titleKey]: FREMDTITEL, [eintrag.bodyKey]: FREMDTEXT },
    true,
    true,
  );
  // SELBSTPRUEFUNG DER EINSCHLEUSUNG — sie steht hier, weil ihr Fehlen den ganzen Fall lautlos
  // entwertet: Ein Test, dessen Fremdtext nie ankommt, prueft eine Hilfe ohne Fremdtext und ist
  // aus dem falschen Grund gruen.
  const aufgeloest = resolveKlaraEntries(allKlaraEntries(), (key) => i18n.t(key));
  const traeger = aufgeloest.find((e) => e.body === FREMDTEXT);
  if (!traeger) {
    throw new Error(
      "Der Fremdtext steht nach dem Einschleusen NICHT im aufgeloesten Client-Bestand — " +
        "der Prueffall waere ohne Gegenstand.",
    );
  }
  return { titleKey: eintrag.titleKey, bodyKey: eintrag.bodyKey };
}

async function panelOeffnen(): Promise<void> {
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
            createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(KlaraAssistant)),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  // Klara draengt sich nie auf — das Panel oeffnet nur auf Klick. Also klicken.
  const oeffner = container.querySelector<HTMLButtonElement>("button[data-klara='1']");
  if (!oeffner) {
    throw new Error("Klara-Knopf nicht gefunden — das Panel ist nicht erreichbar.");
  }
  await act(async () => {
    oeffner.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** Frage tippen und „Mit KI-Unterstuetzung suchen" druecken — die echte Nutzerhandlung. */
async function erklaerenAusloesen(frage: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
  if (!feld) {
    throw new Error("Suchfeld im Klara-Panel nicht gefunden.");
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, frage);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = [...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button")]
    .find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
  if (!knopf) {
    throw new Error("KI-Knopf im Klara-Panel nicht gefunden.");
  }
  // Ohne freigegebenen Knopf gaebe es nichts Sichtbares zu messen — genau daran ist ein frueherer
  // gemounteter Test dieser Bahn (2658 D2) still gescheitert: die Handlung lief gar nicht.
  expect(
    knopf.disabled,
    `der KI-Knopf ist ausgegraut — die Erklaerung wurde nie ausgeloest. Modellstatus: ${letzterModellstatus} · Modellkante ueber den Draht angefragt: ${modellkanteAngefragt}`,
  ).toBe(false);
  await act(async () => {
    knopf.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

async function vorrichtung(): Promise<void> {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  drahtApp = app;
  await authApi.register("Pedi", "pedi@job2660.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2660.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  fremdtextEinschleusen();
  await panelOeffnen();
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(() => {
  erklaerAntworten.length = 0;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  drahtApp = null;
  cookie = null;
});

describe("JOB 2660 — die Hilfe an der Stelle, wo sie jemand benutzt", () => {
  it("K0 — KALIBRIERUNG DES PRUEFFALLS: das Fantasiewort steht im echten Bestand nirgends", () => {
    // Ohne diese Zusicherung koennte der Fall unbemerkt echte Hilfe messen statt Fremdtext.
    const echterBestand = resolveKlaraEntries(allKlaraEntries(), (key) => i18n.t(key))
      .map((e) => `${e.title} ${e.body} ${e.route}`)
      .join(" ");
    for (const wort of [FANTASIEWORT, ZWEITWORT]) {
      expect(echterBestand, `„${wort}" steht im echten Hilfe-Bestand — der Fall waere unsauber`)
        .not.toContain(wort);
    }
  });

  it("F1 — DER TRAGENDE FREMDTEXTFALL: die Antwort steht auf selbst mitgebrachtem Text — und nirgends steht „gesichert\", „validiert\" oder Vertrauen 90", async () => {
    await vorrichtung();
    await erklaerenAusloesen(FRAGE);

    const panel = container.querySelector<HTMLElement>("section[data-klara='1']");
    expect(panel, "kein Klara-Panel im DOM — es gab nichts zu sehen").not.toBeNull();
    const sichtbar = panel?.textContent ?? "";

    // K1 — DER ABRUF LIEF WIRKLICH. Ohne diesen Nachweis waere jede Aussage unten wertlos:
    // ein Panel, das nie gefragt hat, zeigt selbstverstaendlich auch nichts Falsches.
    expect(
      erklaerAntworten.length,
      "kein einziger Abruf von /api/help/explain — der Clientabruf lief nicht",
    ).toBeGreaterThan(0);

    // K1b — DIE ANTWORT TRAEGT. Das ist der Pflichtfall der Abnahme und die Grenze zu F2:
    // Geprueft wird der Fall, in dem der Fremdtext die Antwort WIRKLICH stuetzt — nicht der, in
    // dem er an der Mindestsubstanz verworfen wird. Ohne diese Zusicherung koennte der Ausschluss
    // unten dadurch gruen werden, dass die Antwort in die Wissensluecke faellt: Dann stuende
    // ebenfalls nirgends „Gesichert", aber die Schutzwirkung waere nicht belegt, sondern umgangen.
    expect(
      erklaerAntworten.at(-1)?.answered,
      `die Antwort traegt nicht — dann prueft dieser Fall den verworfenen statt des tragenden Fremdtextfalls. Geliefert: ${JSON.stringify(erklaerAntworten.at(-1))?.slice(0, 300)}`,
    ).toBe(true);

    // K2 — DER FREMDTEXT IST DIE ANTWORTGRUNDLAGE. Sein Wortlaut steht sichtbar in der Antwort;
    // sie stammt also nicht aus echter, kuratierter Hilfe. Das ist der Missbrauchsfall, erreicht.
    expect(
      sichtbar,
      `der Fremdtext ist nicht die Antwortgrundlage — der Missbrauchsfall wurde gar nicht erreicht.\nGesendet: ${erklaerAnfragen.at(-1)?.slice(0, 900)}\nAbgelehnt: ${erklaerFehler.join(" | ")}\nGeliefert: ${JSON.stringify(erklaerAntworten.at(-1))?.slice(0, 400)}`,
    ).toContain(FANTASIEWORT);

    // Z1 — DIE EINSTUFUNG STEHT SICHTBAR AM PANEL. Das ist Pedis Frage, und erst diese Anzeige
    // macht sie beantwortbar: Wer die Hilfe benutzt, soll die Guete der Antwort SEHEN, nicht raten.
    // Vor diesem Durchgang gab es das Etikett nicht — im ersten Lauf gemessen, hier rot.
    const etikett = panel?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(
      etikett,
      "keine sichtbare Einstufung an der KI-Antwort — der Mensch sieht nicht, worauf er sich stuetzt",
    ).not.toBeNull();

    // ------------------------------------------------------------------------------------------
    // Z2 — DIE ZUSICHERUNG, und sie SCHLIESST AUS statt zu akzeptieren.
    // ------------------------------------------------------------------------------------------
    //
    // HIER STAND BIS D2 DER FEHLER, und BEN hat ihn benannt:
    //
    //   „F1 prueft nur, dass UI und Wirewert uebereinstimmen, und akzeptiert ausdruecklich
    //    `knowledgeClass: \"gesichert\"`."
    //
    // Der alte Fall verglich das Etikett mit dem gelieferten Wert — und war deshalb auch dann
    // gruen, wenn der gelieferte Wert falsch war. Er pinnte den Befund, statt ihn zu schliessen.
    // Geprueft wurde, dass die Anzeige dem Wire folgt; NICHT, dass der Wire das Richtige sagt.
    //
    // Ab hier gilt die Abnahme woertlich: Im TRAGENDEN Fremdtextfall darf auf dem Schirm nirgends
    // „gesichert", „validiert" oder Vertrauen 90 stehen.
    // (a) AM ETIKETT SELBST, exakt: Dort steht der Wortlaut allein und ohne Nachbartext — das ist
    //     die schaerfste Stelle, und sie ist die, die der Mensch als Guetesiegel liest.
    expect(
      VERBOTENE_WOERTER as readonly string[],
      `das Etikett behauptet „${(etikett?.textContent ?? "").trim()}" fuer einen client-gelieferten Fantasietext. Geliefert: ${JSON.stringify(erklaerAntworten.at(-1))?.slice(0, 300)}`,
    ).not.toContain((etikett?.textContent ?? "").trim());

    // (b) UND IM GANZEN PANEL: kein verbotenes Wort steht irgendwo sonst — eine zweite Stelle,
    //     die dasselbe behauptet, waere genauso falsch.
    expect(
      sichtbar,
      `die Flaeche behauptet Sicherheit fuer einen client-gelieferten Fantasietext. Geliefert: ${JSON.stringify(erklaerAntworten.at(-1))?.slice(0, 300)}`,
    ).not.toMatch(VERBOTENE_WOERTER_MUSTER);
    expect(sichtbar, "die Flaeche zeigt den Vertrauenswert 90 fuer einen Fremdtext").not.toMatch(
      /\b90\b/,
    );

    // Z3 — DER WIREWERT SELBST. Der Ausschluss oben waere auch dann gruen, wenn die Flaeche die
    // Einstufung schlicht nicht mehr anzeigte. Deshalb wird hier die Quelle gemessen: Was der
    // Server ueber einen client-gelieferten Schnipsel behauptet, darf keine Guetezusicherung sein.
    const gelieferteKlasse = erklaerAntworten.at(-1)?.knowledgeClass;
    expect(gelieferteKlasse, "die Antwort trug gar keine Einstufung").toBeDefined();
    expect(
      gelieferteKlasse,
      `der Server stuft einen client-gelieferten Fremdtext als gesichert ein. Etikett: „${(etikett?.textContent ?? "").trim()}" · Mustertreffer im Panel: ${JSON.stringify(sichtbar.match(VERBOTENE_WOERTER_MUSTER))}`,
    ).not.toBe("gesichert");
    expect(erklaerAntworten.at(-1)?.trust, "der Server vergibt Vertrauen 90 an Fremdtext").not.toBe(
      90,
    );

    // Z4 — DIE EHRLICHE WIRKUNG, positiv: Das Etikett nennt die ungeprueffte Einstufung, mit dem
    // Wort, das der Katalog dafuer schon fuehrt (`ask.knowledgeClass.ungeprueft` = „Ungeprüft").
    // Kein erfundener Begriff — die Wissenssuche sagt dasselbe Wort fuer denselben Zustand.
    const erlaubteEtiketten = [
      i18n.t("ask.knowledgeClass.ungeprueft"),
      i18n.t("ask.knowledgeClass.unbekannt"),
    ];
    expect(
      erlaubteEtiketten,
      `das Etikett lautet „${(etikett?.textContent ?? "").trim()}" statt einer ungeprueffften Einstufung`,
    ).toContain((etikett?.textContent ?? "").trim());

    // Z5 — UND DIE ANZEIGE BLEIBT WAHRHEITSGETREU. Diese Zusicherung aus D2 bleibt bestehen: Das
    // sichtbare Wort ist genau das Katalogwort zur gelieferten Klasse. Sie ist jetzt die ZWEITE
    // Aussage neben dem Ausschluss, nicht mehr die einzige — genau das war BENs Einwand.
    expect(
      (etikett?.textContent ?? "").trim(),
      "die Flaeche zeigt eine andere Einstufung als die, die sie bekommen hat",
    ).toBe(i18n.t(`ask.knowledgeClass.${gelieferteKlasse}`));

    // Z3 — KEIN VERTRAUENSWERT AN DIESER STELLE. Der Vertrauenswert ist ein quellenbezogener
    // Wert; das Panel nennt seine Quellen erst darunter. Insbesondere die 90 — der Wert, den der
    // Serverweg vor `2660 D1` jedem client-gelieferten Schnipsel aufpraegte — darf nirgends
    // sichtbar werden.
    expect(sichtbar, "die Flaeche zeigt den Vertrauenswert 90 fuer einen Fremdtext").not.toMatch(
      /\b90\b/,
    );
  });

  it("F2 — DIE ZUSICHERUNG (BENs Wortlaut): traegt die Antwort keine geprueffte Quelle, steht auf der Flaeche weder „validiert/gesichert\" noch Vertrauen 90, sondern die ehrliche Lueckenwirkung", async () => {
    await vorrichtung();
    // DIESELBE Einschleusung, ANDERE Frage: Sie teilt mit dem Fremdtext nur EIN Inhaltstoken.
    // Der Client rankt ihn und schickt ihn mit — der Reasoner verwirft ihn an seiner absoluten
    // Mindestsubstanz (`MIN_ANSWER_SUBSTANCE = 2`, provider.ts). Ergebnis ist genau die von BEN
    // ausdruecklich zugelassene zweite Form: „die ungeprueffte beziehungsweise ehrliche
    // Lueckenwirkung". Der Fremdtext geht also den ganzen Weg und traegt die Antwort trotzdem
    // nicht — das ist der Fall, an dem sich der Ausschluss ehrlich messen laesst.
    await erklaerenAusloesen(FRAGE_OHNE_SUBSTANZ);

    const panel = container.querySelector<HTMLElement>("section[data-klara='1']");
    const sichtbar = panel?.textContent ?? "";

    // K1 — auch hier: der Abruf lief wirklich, sonst misst der Ausschluss nichts.
    expect(
      erklaerAntworten.length,
      `kein Abruf von /api/help/explain — der Fall wurde nie gestellt. Gesendet: ${erklaerAnfragen.at(-1)?.slice(0, 400)}`,
    ).toBeGreaterThan(0);

    // K2 — DER FREMDTEXT WURDE MITGESCHICKT. Ohne diesen Nachweis pruefte der Fall eine leere
    // Hilfe statt einer, die einen Fremdtext angeboten bekam und ihn zurueckgewiesen hat.
    expect(
      erklaerAnfragen.at(-1) ?? "",
      "der Fremdtext ging gar nicht erst mit — der Fall haette keinen Gegenstand",
    ).toContain(FANTASIEWORT);

    // DIE ZUSICHERUNG, Teil 1 — KEIN SICHERHEITSWORT auf der Flaeche.
    for (const wort of VERBOTENE_WOERTER) {
      expect(sichtbar, `die Flaeche behauptet „${wort}" ohne geprueffte Quelle`).not.toContain(
        wort,
      );
    }

    // DIE ZUSICHERUNG, Teil 2 — KEIN VERTRAUENSWERT 90.
    expect(sichtbar, "die Flaeche zeigt den Vertrauenswert 90 ohne geprueffte Quelle").not.toMatch(
      /\b90\b/,
    );

    // DIE ZUSICHERUNG, Teil 3 — die ehrliche Wirkung steht POSITIV da, nicht bloss als Leerstelle:
    // das Etikett nennt die ungeprueffte beziehungsweise unbekannte Einstufung.
    const etikett = panel?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(etikett, "keine sichtbare Einstufung an der Lueckenantwort").not.toBeNull();
    const erlaubteEtiketten = [
      i18n.t("ask.knowledgeClass.ungeprueft"),
      i18n.t("ask.knowledgeClass.unbekannt"),
    ];
    expect(
      erlaubteEtiketten,
      `das Etikett lautet „${(etikett?.textContent ?? "").trim()}" statt einer ungeprueffften Einstufung`,
    ).toContain((etikett?.textContent ?? "").trim());

    // DIE ZUSICHERUNG, Teil 4 — die Hilfe benennt ihre Luecke im Klartext, statt zu schweigen.
    expect(sichtbar, "die ehrliche Hilfe-Luecke steht nicht auf der Flaeche").toContain(
      i18n.t("klara.aiEmpty"),
    );

    // KALIBRIERUNG DES ETIKETTS ueber beide Faelle: F1 und F2 fahren dieselbe Flaeche mit
    // unterschiedlichen Einstufungen. Waere das Etikett fest verdrahtet, koennten nicht beide
    // Faelle ihre je eigene Klasse zeigen — dieser Vergleich haelt das fest.
    const gelieferteKlasse = erklaerAntworten.at(-1)?.knowledgeClass;
    expect((etikett?.textContent ?? "").trim()).toBe(
      i18n.t(`ask.knowledgeClass.${gelieferteKlasse}`),
    );
  });
});
