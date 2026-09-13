// @vitest-environment jsdom
// ================================================================================================
// JOB 2959 · D1 · F-0304 — DIE ANTWORT GEHOERT SICHTBAR ZU IHRER FRAGE
// ================================================================================================
//
// DIE GEMESSENE LUECKE, in einem Satz: Die KI-Antwort im Klara-Panel bleibt stehen, wenn der Nutzer
// im Suchfeld weitertippt — und sie sagt nirgends, auf welche Frage sie antwortet. Wer eine zweite
// Frage eingibt, liest die Antwort auf die erste als Antwort auf die zweite.
//
// BELEG AM CODE (Stand `6d574fce`, vor diesem Durchgang):
//   * `KlaraAssistant.tsx:98`   `const [askedFor, setAskedFor] = useState<string | null>(null)`
//   * `KlaraAssistant.tsx:299`  `setAskedFor(question)` — beim Ausloesen gesetzt
//   * `KlaraAssistant.tsx:493`  `{askedFor && !aiAsk.isPending ? (` — die EINZIGE weitere Stelle
//   Die Frage wird also gemerkt und ausschliesslich als Schalter benutzt. Sie erreicht den
//   Bildschirm nie. Gegenprobe im Bestand: `grep -n askedFor` liefert genau diese drei Zeilen.
//
// WARUM DAS MEHR IST ALS EIN SCHOENHEITSFEHLER. Klara ist ausdruecklich darauf gebaut, nichts zu
// behaupten, was sie nicht belegen kann (Dateikopf: „raet nie", „sagt offen, wenn ihr ein Eintrag
// fehlt"). Die Trefferliste darunter fuehrt ihre Frage sogar mit: `klara.resultsFor` = „Treffer
// fuer: {{q}}" (`:593`) — sie aktualisiert sich beim Tippen. Die KI-Antwort daneben tut beides
// nicht: sie aktualisiert sich nicht und nennt ihre Frage nicht. Nebeneinander entsteht dadurch das
// Bild, die stehengebliebene Antwort gehoere zur neu getippten Frage.
//
// WAS HIER ECHT IST — Bauform woertlich aus `tests/web/job2660-hilfe-fremdtext-ui.test.tsx`
// (dort ausfuehrlich begruendet): die echte Komponente `KlaraAssistant` mit ihren echten Providern,
// der echte Clientabruf `endpoints.help.explain`, die echte App (`buildApp`/`buildServices`) mit
// echter Route und echtem Reasoner, der echte Renderer. Der EINZIGE Ersatz ist der Transport:
// `globalThis.fetch` liegt auf `app.inject` — die Bahn-Sandbox laesst keinen Horchsocket zu
// (`listen EPERM`).
//
// ZUR DATEIENDUNG: `.test.tsx`, weil eine `.test.ts` kein JSX uebersetzt (TS6142). Pfad und Name
// sind exakt die aus dem Pfad-Gate.
//
// JOB 3830 (13.09.2026) hat die Vorrichtung um die ANFRAGE-Richtung erweitert: bisher wurde nur die
// Antwort abgelegt (`erklaerAbrufe`), der gesendete Anfragekoerper verworfen. Der zweite
// describe-Block am Dateiende misst daran, was Klara wirklich an die KI schickt — samt der fuenf
// gemessenen Zahlen im Kopf dieses Blocks.
//
// JOB 3891 (13.09.2026) hat die Modellkante dieser Vorrichtung getrennt gezaehlt (Erreichbarkeits-
// Ping gegen Generierung, je Fall zurueckgesetzt) und ihren Fehlerfall gemessen — Begruendung und
// Messwerte im Kopf des zweiten Blocks.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Die Modellstufe gibt den KI-Knopf frei — ohne nutzbares Modell ist er HART ausgegraut
// (`useAiAvailable("answer")`), und die Nutzerhandlung waere gar nicht ausloesbar. Die Kennung ist
// eine RFC-2606-Adresse und wird nie aufgeloest; der Aufruf endet an der In-Process-Grenze unten.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job2959-in-process";
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
// JOB 3830 liest die QUELLEN, gegen die der abgefangene Anfragekoerper gehalten wird — nur lesend,
// keine Zusicherung ueber den Inhalt dieser Module selbst.
import { FAQ_CONTENT } from "../../apps/web/src/lib/faqContent";
import {
  type ResolvedKlaraEntry,
  allFaqEntries,
  allKlaraEntries,
  resolveKlaraEntries,
} from "../../apps/web/src/lib/klaraRegistry";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Zwei Fragen, die sich in JEDEM Inhaltswort unterscheiden — sonst koennte ein Test gruen werden,
// weil die zweite Frage zufaellig in der ersten steckt.
const FRAGE_EINS = "Wie funktioniert die Validierung von Wissen?";
const FRAGE_ZWEI = "Wo finde ich meine gespeicherten Entwuerfe?";
// JOB 3830: die Duplikatfrage, wie ein Neuling sie wirklich tippt. Die Wortwahl ist begruendet:
//   · Sie zitiert den FAQ-Titel NICHT („Was ist ein Duplikat, und was tue ich mit zwei aehnlichen
//     Artikeln?") — sonst faende die Rangliste den Eintrag ueber seinen eigenen Titel, und der Test
//     maesse ein Echo statt eines Suchwegs.
//   · Sie enthaelt KEINEN der sechs Verbotsstaemme (verschmelz/…/merg). Traege die Frage sie selbst,
//     koennte A4 an der Frage haengenbleiben statt am uebertragenen Hilfetext.
//   · Das Wort „Artikel" ist Alltagssprache und laeuft ueber die Synonymkarte
//     (`klaraRegistry.ts`: artikel → wissensobjekt/objekt); „gleiche"/„gefunden" sind die Woerter,
//     mit denen jemand den Fund beschreibt, ohne den Fachbegriff zu kennen.
const FRAGE_DUPLIKAT = "Ich habe zwei fast gleiche Artikel gefunden — was mache ich damit?";

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
let letzterModellstatus = "(nie abgerufen)";
// JOB 3891: ZWEI Zaehler statt einem. Bis hierher stand hier EINE Zahl fuer JEDE absolute Anfrage
// — den Erreichbarkeits-Ping GENAUSO wie die Generierung — und sie wurde nie zurueckgesetzt.
// Eine daraus gebaute Zusicherung („die Modellkante wurde angefragt") war am Dateiende immer wahr,
// weil die Faelle davor schon Aufrufe hinterlassen hatten; sie mass nichts. Getrennt und je Fall
// zurueckgesetzt (`afterEach`) sagt jede Zahl etwas ueber GENAU DIESE Nutzerhandlung.
let erreichbarkeitsPings = 0;
let generierungsAufrufe = 0;
// Fallgebunden: solange dies nicht 200 ist, antwortet NUR die Generierungskante mit diesem Status.
// Der Erreichbarkeits-Ping bleibt gesund — sonst ist der KI-Knopf hart ausgegraut (`:41-43`), die
// Handlung liefe nie, und ein Fehlerfall waere still gruen, ohne etwas gemessen zu haben.
let generierungsStatus = 200;
// Wie oft die Generierungskante den eingestellten Fehlerstatus WIRKLICH ausgeliefert hat. Ohne
// diese Zahl koennte ein Fehlerfall gruen werden, weil sein Schadensfall gar nicht eintrat.
let generierungsfehlerGeliefert = 0;
// Die zuletzt generierende URL — Diagnose, damit ein Fehlschlag sagt, an welcher Kante gemessen wurde.
let letzteGenerierungsUrl = "(nie)";
const erklaerAbrufe: string[] = [];
// JOB 3830: was der Client GESENDET hat. `erklaerAbrufe` legt die ANTWORT ab — die Anfrage wurde
// bisher verworfen, und genau sie ist das letzte Glied, an dem der Hilfetext vor der KI noch
// nachweisbar ist. Bauform woertlich aus `tests/web/job2660-hilfe-fremdtext-ui.test.tsx:145`, `:211`.
const erklaerAnfragen: string[] = [];

const rumpfAlsText = (init?: RequestInit): string =>
  init?.body === undefined || init.body === null ? "" : String(init.body);

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      // Die In-Process-Modellgrenze. Sie ANTWORTET statt zu werfen, weil eine geworfene Anfrage die
      // Kante als `unreachable` fuehrt und den KI-Knopf ausgraut — dann liefe die Handlung nie.
      // Der Erreichbarkeits-Ping bekommt eine gueltige Mini-Antwort; die Generierung bekommt eine
      // unbrauchbare, und das Ergebnis entsteht ueber den deterministischen Rueckfall der
      // Providerkette. Dieser Test erfindet also keinen Antworttext.
      //
      // JOB 3891 — WAS `istGenerierung` IST UND WAS NICHT. Die Unterscheidung war schon da, wurde
      // aber nur fuer die Nutzlast benutzt und fuer die Zaehlung weggeworfen. Sie ist eine HEURISTIK
      // DIESER VORRICHTUNG (traegt der Rumpf das Wort `snippet` oder ist er laenger als 400 Zeichen)
      // und KEINE Aussage ueber das Produkt: das Produkt kennzeichnet seine Modellanfragen nicht so.
      // Aendert sich die Anfrageform, kann sie falsch trennen — deshalb ist jede Zusicherung, die auf
      // ihr steht, mit einer Kalibrierung gepaart, die rot wird statt zu schweigen (A1, A5).
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const istGenerierung = rumpf.includes("snippet") || rumpf.length > 400;
      if (istGenerierung) {
        generierungsAufrufe += 1;
        letzteGenerierungsUrl = url;
        if (generierungsStatus !== 200) {
          generierungsfehlerGeliefert += 1;
          const fehlerrumpf = JSON.stringify({
            error: { message: "kw-job3891: die Generierungskante ist gestoert" },
          });
          return {
            status: generierungsStatus,
            statusText: String(generierungsStatus),
            ok: false,
            text: async () => fehlerrumpf,
            json: async () => JSON.parse(fehlerrumpf),
          };
        }
      } else {
        erreichbarkeitsPings += 1;
      }
      const nutzlast = istGenerierung ? {} : { choices: [{ message: { content: "bereit" } }] };
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
      erklaerAbrufe.push(antwort.body);
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const panel = (): HTMLElement | null =>
  container.querySelector<HTMLElement>("section[data-klara='1']");

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
  // Klara draengt sich nie auf — das Panel oeffnet nur auf Klick.
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

/** Nur tippen — genau die Handlung, die heute die Antwort veralten laesst, ohne es zu sagen. */
async function tippen(text: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
  if (!feld) {
    throw new Error("Suchfeld im Klara-Panel nicht gefunden.");
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

/** Tippen und „Mit KI-Unterstuetzung suchen" druecken — die echte Nutzerhandlung. */
async function fragen(frage: string): Promise<void> {
  await tippen(frage);
  const knopf = [
    ...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button"),
  ].find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
  if (!knopf) {
    throw new Error("KI-Knopf im Klara-Panel nicht gefunden.");
  }
  // Ohne freigegebenen Knopf gaebe es nichts zu messen — genau daran sind gemountete Tests dieser
  // Bahn frueher still gescheitert: die Handlung lief gar nicht.
  expect(
    knopf.disabled,
    `der KI-Knopf ist ausgegraut — die Frage wurde nie gestellt. Modellstatus: ${letzterModellstatus} · Erreichbarkeits-Pings: ${erreichbarkeitsPings} · Generierungsaufrufe: ${generierungsAufrufe}`,
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
  await authApi.register("Pedi", "pedi@job2959.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2959.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  await panelOeffnen();
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  drahtApp = null;
  cookie = null;
  erklaerAbrufe.length = 0;
  erklaerAnfragen.length = 0;
  // JOB 3891: die Zaehler der Modellkante gehoeren dem einzelnen Fall — genau wie die beiden Listen
  // darueber. Ohne diese Zeilen zaehlt die Handlung des Vorgaengerfalls mit, und A1/A5 messen nicht
  // mehr ihre eigene Handlung.
  erreichbarkeitsPings = 0;
  generierungsAufrufe = 0;
  generierungsfehlerGeliefert = 0;
  letzteGenerierungsUrl = "(nie)";
  // Die fallgebundene Stoerung wird IMMER zurueckgenommen, auch wenn der Fall vorzeitig abbrach.
  generierungsStatus = 200;
});

describe("JOB 2959 · D1 · F-0304 — die Assistenzflaeche sagt, zu welcher Frage ihre Antwort gehoert", () => {
  it("K0 · KALIBRIERUNG: die Handlung laeuft wirklich — die Antwortkarte steht nach dem Fragen auf der Flaeche", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    // Ohne diesen Nachweis maesse alles Weitere eine Flaeche, auf der nie etwas passiert ist.
    expect(
      erklaerAbrufe.length,
      "kein einziger Abruf von /api/help/explain — der Clientabruf lief nicht",
    ).toBeGreaterThan(0);
    const karte = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(
      karte,
      `keine KI-Antwortkarte auf der Flaeche. Geliefert: ${erklaerAbrufe.at(-1)?.slice(0, 300)}`,
    ).not.toBeNull();
  });

  it("F1 · DIE LUECKE: die Antwort nennt die Frage, auf die sie antwortet", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(
      zeile,
      "die KI-Antwort nennt ihre Frage nicht — `askedFor` wird gemerkt (KlaraAssistant.tsx:299), " +
        "aber nie angezeigt",
    ).not.toBeNull();
    expect(
      (zeile?.textContent ?? "").replace(/\s+/g, " "),
      "die genannte Frage ist nicht die gestellte",
    ).toContain(FRAGE_EINS);
  });

  it("F2 · DER SCHADENSFALL: tippt der Nutzer weiter, bleibt die Antwort bei IHRER Frage — sie wandert nicht auf die neue", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    // Nur tippen, NICHT erneut fragen — genau so entsteht der Fehler heute: die Trefferliste
    // darunter zieht mit (`klara.resultsFor`, KlaraAssistant.tsx:593), die KI-Antwort bleibt stehen.
    await tippen(FRAGE_ZWEI);

    // KALIBRIERUNG: die Eingabe ist wirklich angekommen. Gemessen wird sie am Feldwert und NICHT
    // am Paneltext — der erste Entwurf dieses Falls suchte die neue Frage im sichtbaren Text und
    // scheiterte daran, dass sie gar keine Treffer hat: statt „Treffer fuer: …" steht dann
    // `klara.noResults` da, und die Frage taucht nirgends auf. Der Feldwert ist die Stelle, an der
    // die Eingabe unbestreitbar liegt.
    const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
    expect(
      feld?.value,
      "die Eingabe ist gar nicht angekommen — der Fall waere ohne Gegenstand",
    ).toBe(FRAGE_ZWEI);

    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(zeile, "die Antwort nennt ihre Frage nicht — der Bezug bleibt unklar").not.toBeNull();
    const genannt = (zeile?.textContent ?? "").replace(/\s+/g, " ");
    // DER KERN: die stehengebliebene Antwort gehoert weiterhin sichtbar zur ERSTEN Frage.
    expect(
      genannt,
      "die Antwort schreibt sich der neuen Frage zu, obwohl sie zur alten gehoert",
    ).toContain(FRAGE_EINS);
    expect(genannt, "die Antwort behauptet, auf die neu getippte Frage zu antworten").not.toContain(
      FRAGE_ZWEI,
    );
  });

  it("F3 · die Frage steht IN der Antwortkarte, nicht irgendwo auf der Flaeche", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(zeile).not.toBeNull();
    // Sonst genuegte ein Text am Seitenrand, und der Bezug zur Antwort waere wieder Auslegung:
    // beide muessen denselben Traeger haben.
    const etikett = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(etikett).not.toBeNull();
    const karteDerFrage = zeile?.closest("div");
    expect(
      karteDerFrage?.contains(etikett as Node),
      "Frage und Antwort stehen nicht im selben Kasten",
    ).toBe(true);
  });
});

// ================================================================================================
// JOB 3830 — WAS KLARA WIRKLICH AN DIE KI SCHICKT, AM ECHTEN ANFRAGEKOERPER GEMESSEN
// ================================================================================================
//
// WAS JOB 3787 FESTNAGELT. Die FAQ-Antwort `faq.konflikte.6` sagte frueher ein Zusammenfuehren
// zweier Eintraege zu, das es im Produkt nie gab. JOB 3787 hat die Zusage entfernt und mit
// `tests/faq-dubletten-wahrheit/faq-sagt-kein-verschmelzen.test.ts` festgenagelt.
//
// WAS ER NACHBAUT, STATT ES ZU MESSEN — die Luecke, die dieser Block schliesst:
//   * `:199-209` deklariert `KI_TITEL_SCHNITT = 160` und `KI_TEXT_SCHNITT = 700` als LITERALE im
//     Test und schneidet damit selbst. Verstellt jemand `KlaraAssistant.tsx:310` `slice(0, 700)`,
//     bleibt dieser Waechter gruen — er misst seine eigenen Konstanten.
//   * `:186-190` ruft `rankKlara(alle, "…")` OHNE Grenzwert; `klaraRegistry.ts:278` setzt dann die
//     Vorgabe `limit = 6`, und `alle` ist nur `allFaqEntries("de")`. Die Anwendung nimmt dagegen
//     `rankKlara(resolved, question, 12)` (`KlaraAssistant.tsx:298`) ueber den GANZEN aufgeloesten
//     Bestand (`:266-272`: Registry + FAQ). Zwei Zahlen laufen auseinander — 12 in der Anwendung,
//     6 als Vorgabe im Waechter —, und das gemessene Feld ist im Waechter das leichtere.
//
// DIE FUENF GEMESSENEN ZAHLEN (eigener Lauf, Cloud-Arbeitspruefung 0b0b28d3…, Stand 5bcad9a4,
// Frage = FRAGE_DUPLIKAT, unveraenderte Anwendung):
//   (a) 12 Schnipsel gehen ueber die Leitung — der Deckel aus `:298` ist voll ausgeschoepft.
//   (b) `faq:faq.konflikte.6` ist darunter, auf Platz 11 von 12. Er haelt sich also KNAPP im Feld;
//       das ist die eigentliche Frueherkennung dieses Blocks und steht als REST in der Rueckgabe.
//   (c) Der uebertragene `body` ist 580 Zeichen lang und zeichengleich mit dem Quelltext in
//       `FAQ_CONTENT` — 580 < 700, es wird heute nichts abgeschnitten.
//   (d) Die uebertragene `question` ist 66 Zeichen lang (Schnitt `:306` bei 300 greift nicht).
//   (e) Der laengste uebertragene `body` ueber alle 12 Schnipsel ist 580 Zeichen — es ist derselbe
//       Eintrag. Bis zum 700er-Schnitt bleiben 120 Zeichen Luft: waechst die Duplikat-Antwort um
//       mehr, faellt ihr ehrlicher Schluss („beide bleiben · Grund · Protokoll") als Erstes weg.
//
// WARUM DIE VERBOTSLISTE HIER EIN ZWEITES MAL STEHT (offengelegt, nicht versteckt): `verbotsfunde`
// und `VERBOTENE_STAEMME` in `faq-sagt-kein-verschmelzen.test.ts:50-57` sind NICHT exportiert, und
// diese Datei darf den fremden Zielpfad nicht anfassen. Die Doppelung ist bewusst und als REST zur
// Zusammenfuehrung bestellt (Weg von JOB 3811).
//
// ZUSTANDSMODELL: Der Anfragekoerper entsteht aus Konstanten (`FAQ_CONTENT`) und dem aufgeloesten
// Bestand — ohne Abruf, ohne Cache, ohne Netz (`klaraRegistry.ts:204`). Laden, erfolgreich leer,
// Fehler, Cache mit laufender oder gescheiterter Auffrischung, offline aendern ihn deshalb nicht.
// Belegt ist das an einem Punkt: die Modellkante dieser Vorrichtung GENERIERT nicht (`:79-94`),
// und der Koerper entsteht trotzdem — er wird VOR dem Modellaufruf gebildet (A1 misst beides).
//
// ------------------------------------------------------------------------------------------------
// JOB 3891 (13.09.2026) — DIE GENERIERUNGSKANTE WIRD PRO HANDLUNG GEZAEHLT, IHR FEHLERFALL GEMESSEN
// ------------------------------------------------------------------------------------------------
//
// WAS HIER NICHT TRUG. A1 verlangte, „die Modellkante wurde angefragt" — gemessen an EINER Zahl, die
// jeden Erreichbarkeits-Ping mitzaehlte und nie zurueckgesetzt wurde. Beim Eintritt in A1 stand sie
// wegen der vier Faelle im ersten Block ohnehin ueber 0: die Zusicherung war wahr, ohne etwas zu
// messen. BELEG, dass die Luecke bestand: zaehlt man in der Abfangstelle testweise NUR den Ping und
// die Generierung gar nicht, bleibt A1 am Stand vor diesem Durchgang GRUEN (Cloud-Lauf eb40b0a4…,
// „Tests 8 passed (8)"); mit der geschaerften Zusicherung ist dieselbe Verstellung ROT.
//
// WAS BEI EINEM FEHLER DER GENERIERUNGSKANTE WIRKLICH GESCHIEHT (gemessen, Cloud-Lauf 726fa66c…,
// A5 mit HTTP 500 NUR auf der Generierung, Ping gesund): Der Fehler bleibt an der Modellkante
// stehen. `Reasoner.runTask` (`services/reasoner/src/service.ts:1180-1245`) faengt ihn und geht ein
// Glied weiter; geantwortet hat der deterministische Rueckfall — `POST /api/help/explain` liefert
// weiter 200, der Koerper traegt `"demo":true`, `"knowledgeClass":"ungeprueft"`, `"trust":0`, und der
// Antworttext ist der ZITIERTE `body` eines uebertragenen Schnipsels. Auf der Flaeche steht deshalb
// KEINE Fehlermeldung und KEINE Wissensluecke, sondern die gewohnte Karte mit dem Etikett
// „Ungeprüft" (`KlaraAssistant.tsx:531-534`) und der Frage darueber. Der Zweig `aiAsk.isError`
// (`:498-501`, `state.error`) wird dabei NICHT erreicht — er gehoert einem Fehler der eigenen Route,
// nicht der Modellkante. Der Mensch erfaehrt also nicht, dass das Modell ausgefallen ist; er bekommt
// aber auch nichts Erfundenes.
//
// RUNDE 2 — WAS RUNDE 1 NICHT TRUG, UND WAS JETZT GEMESSEN IST. A5 pruefte den Antworttext
// ausschliesslich am SERVERKOERPER (`erklaerAbrufe`), nie am Bildschirm. BEN hat die Luecke
// vorgefuehrt: ersetzt man in `KlaraAssistant.tsx:563` den angezeigten Text durch „Der Mond besteht
// aus Käse.", bleiben alle neun Faelle gruen. Ein korrekter Serverkoerper belegt eben keinen
// korrekten sichtbaren Text. Zudem stand der Inhaltsnachweis hinter `if (answered && answer)` — fiel
// die Antwort weg, entfiel stillschweigend auch ihre Pruefung.
//
// GEMESSEN (Messlauf 3b5425bd…, A5 mit HTTP 500 auf der Generierung): Der Antwortblock ist das
// Element unmittelbar nach der Fragezeile — `div.text-[12px] leading-relaxed text-text`
// (`AnswerMarkdown`, `KlaraAssistant.tsx:561-565`). Sein Text ist ZEICHENGLEICH mit `answer` aus dem
// Serverkoerper (404 Zeichen), und `answer` ist wiederum zeichengleich mit dem `body` GENAU EINES
// uebertragenen Schnipsels (`sec:nb.title`, zugleich die einzige gemeldete `source`) — der
// deterministische Rueckfall gibt `best.statement` unveraendert zurueck (`provider.ts:1941-1944`).
// A5 pinnt daraus die Kette „sichtbarer Text == gelieferter Text == uebertragener `body`" plus
// `demo: true` und die Herkunft jeder tragenden Quelle. WELCHER Schnipsel zitiert wird und wie viele
// Quellen es sind, wird NICHT gepinnt (Lehre JOB 3874 R1).
//
// NICHT GEMESSEN (ehrliche Reichweite): keine echte Modellantwort (die Kante ist eine Attrappe —
// sie antwortet unbrauchbar oder mit einem Fehler, nie mit erzeugtem Text), keine andere Sprache als
// `de` (`allFaqEntries` gibt EN/NL nichts), kein Browser — und nicht der Zweig ohne jede Grundlage
// (`KlaraAssistant.tsx:300-303`, `setAiNoGrounding(true)`), in dem es ehrlich GAR KEINEN Aufruf und
// damit keinen Anfragekoerper gibt. Ebenfalls offen: ob die Heuristik `istGenerierung` (`:142`) auch
// bei kuenftigen Anfrageformen noch zwischen Ping und Generierung trennt — sie ist eine Eigenschaft
// DIESER Vorrichtung, keine des Produkts. Und die Sichtbarkeitspruefung (`ausblendung`) reicht nur so
// weit wie jsdom: `hidden`, `hidden`/`invisible` und Inline-Stil werden gesehen, eine Ausblendung
// ueber ein Stylesheet oder ueber Groesse/Ueberdeckung nicht — dafuer braeuchte es den Browser.

interface Anfragekoerper {
  question: string;
  snippets: { id: string; title: string; body: string }[];
  locale?: string;
}

/**
 * Der zuletzt GESENDETE Anfragekoerper, geparst. Fehlt er, meldet die Zusicherung das mit dem
 * Modellstatus — ein Fall, der gruen wird, weil die Handlung gar nicht lief, ist an dieser Bahn
 * schon einmal passiert (siehe `fragen`, `:204-207`).
 */
function letzterAnfragekoerper(): Anfragekoerper {
  const roh = erklaerAnfragen.at(-1);
  expect(
    typeof roh,
    `kein Anfragekoerper von /api/help/explain — die Handlung lief nicht. Modellstatus: ${letzterModellstatus} · Erreichbarkeits-Pings: ${erreichbarkeitsPings} · Generierungsaufrufe: ${generierungsAufrufe} · Antworten: ${erklaerAbrufe.length}`,
  ).toBe("string");
  return JSON.parse(String(roh)) as Anfragekoerper;
}

/** Der aufgeloeste Bestand, genau wie `KlaraAssistant.tsx:266-272` ihn baut — die Quelle zum Vergleich. */
const aufgeloesterBestand = (): ResolvedKlaraEntry[] => [
  ...resolveKlaraEntries(allKlaraEntries(), (key) => i18n.t(key)),
  ...allFaqEntries("de"),
];

const DUPLIKAT_ID = "faq:faq.konflikte.6";
const DUPLIKAT_QUELLE = FAQ_CONTENT.find((f) => f.id === "faq.konflikte.6");

// Dieselben sechs Staemme wie `faq-sagt-kein-verschmelzen.test.ts:50-57`, Kopie offengelegt oben.
// Substring auf dem kleingeschriebenen Text: es gibt keinen Kontext, in dem einer dieser Staemme in
// einer ehrlichen Duplikat-Antwort stehen duerfte — auch nicht verneint.
const VERBOTENE_STAEMME = [
  "verschmelz",
  "verschmolz",
  "zusammenführ",
  "zusammenzuführ",
  "zusammengeführ",
  "merg",
] as const;

/** Alle Verbotsstaemme, die in `text` stecken — leer heisst sauber. */
function verbotsfunde(text: string): string[] {
  const klein = text.toLowerCase();
  return VERBOTENE_STAEMME.filter((stamm) => klein.includes(stamm));
}

/**
 * Derselbe Text ohne JEDEN Leerraum. Gebraucht fuer den Vergleich „angezeigt == geliefert":
 * `AnswerMarkdown` zerlegt den Antworttext in Bloecke (Absatz, Ueberschrift, Listenpunkt), und
 * `textContent` setzt Blockgrenzen OHNE Leerzeichen wieder zusammen — ein Vergleich mit bloss
 * normalisiertem Leerraum ginge daran kaputt, sobald ein Hilfetext zwei Absaetze hat.
 * WAS ER NICHT SIEHT (ehrlich benannt): Marken, die der Renderer entfernt (`**fett**` wird `fett`).
 * Der heute gemessene Antworttext traegt keine (Messlauf 3b5425bd…, 404 Zeichen, ein Absatz).
 */
const ohneLeerraum = (text: string): string => text.replace(/\s+/g, "");

/**
 * Die erste Ausblendung an `element` oder einem seiner Vorfahren bis einschliesslich `grenze` —
 * oder `null`, wenn nichts ausblendet. Gemessen werden die Mittel, mit denen DIESES Produkt
 * ausblendet: das `hidden`-Attribut, die Tailwind-Klassen `hidden`/`invisible` und der Inline-Stil.
 * jsdom rechnet kein Layout und wendet keine Stylesheet-Regeln an; eine Ausblendung ueber eine
 * CSS-Datei oder ueber Groesse/Ueberdeckung faende das hier NICHT (Grenze im Kopf des Blocks).
 */
function ausblendung(element: HTMLElement | null, grenze: HTMLElement | null): string | null {
  let lauf: HTMLElement | null = element;
  while (lauf) {
    if (lauf.hasAttribute("hidden")) {
      return `${lauf.tagName} traegt das Attribut hidden`;
    }
    if (lauf.classList.contains("hidden") || lauf.classList.contains("invisible")) {
      return `${lauf.tagName} traegt die Klasse „${lauf.className}"`;
    }
    if (lauf.style.display === "none" || lauf.style.visibility === "hidden") {
      return `${lauf.tagName} traegt den Inline-Stil „${lauf.style.cssText}"`;
    }
    if (lauf === grenze) {
      return null;
    }
    lauf = lauf.parentElement;
  }
  return null;
}

// Der Wortlaut VOR JOB 3787 (Basisstand be5c09b), Zeichen fuer Zeichen der Satz, der die abgeschaffte
// Zusage trug. Er ist hier NUR Messmittel: er belegt, dass `verbotsfunde` nicht konstant `[]` liefert.
const HISTORISCHE_ZUSAGE =
  "Zusammenführen ist dann meist sinnvoll: ein Eintrag statt zwei halber. Das Zusammenführen bleibt ein bewusster menschlicher Schritt — automatisch verschmolzen wird nichts.";

describe("JOB 3830 · der KI-Ausschnitt wird am echten Anfragekoerper gemessen", () => {
  it("A1 · KALIBRIERUNG: die Duplikatfrage erzeugt genau EINEN lesbaren Anfragekoerper", async () => {
    await vorrichtung();
    await fragen(FRAGE_DUPLIKAT);
    expect(
      erklaerAnfragen.length,
      `nicht genau ein Anfragekoerper. Modellstatus: ${letzterModellstatus}`,
    ).toBe(1);
    const koerper = letzterAnfragekoerper();
    expect(typeof koerper.question, "die Anfrage traegt keine Frage").toBe("string");
    expect(Array.isArray(koerper.snippets), "die Anfrage traegt keine Schnipselliste").toBe(true);
    expect(
      koerper.snippets.length,
      "die Anfrage geht ohne jede Grundlage hinaus — dann waere jede folgende Messung gegenstandslos",
    ).toBeGreaterThan(0);
    expect(koerper.locale, "die Anfrage nennt ihre Sprache nicht").toBe("de");
    // ZUSTANDSMODELL, belegt: in DIESER Handlung hat die Generierungskante wirklich gearbeitet und
    // generiert NICHT brauchbar (die Attrappe liefert `{}`) — der Anfragekoerper entsteht trotzdem,
    // weil er VOR dem Modellaufruf gebildet wird.
    //
    // JOB 3891: gemessen wird der GENERIERUNGSzaehler, nicht mehr die Summe aus Ping und Generierung
    // (die stand beim Eintritt in diesen Fall wegen der Faelle darueber ohnehin schon ueber 0 und
    // konnte gar nicht fallen). Und er wird gegen die Zahl der Clientanfragen gehalten statt gegen
    // eine im Test gesetzte Konstante: JEDE Anfrage an /api/help/explain loest genau eine Generierung
    // aus. Zaehlt ein Vorgaengerfall mit (fehlende Ruecksetzung) oder bleibt die Generierung aus,
    // stimmt die Gleichung nicht mehr.
    expect(
      generierungsAufrufe,
      `in dieser Handlung wurde nie generiert — dann belegt dieser Fall nichts ueber die Reihenfolge. Erreichbarkeits-Pings: ${erreichbarkeitsPings} · Modellstatus: ${letzterModellstatus}`,
    ).toBeGreaterThan(0);
    expect(
      generierungsAufrufe,
      `die Zahl der Generierungen gehoert nicht dieser Handlung: ${generierungsAufrufe} Generierungen auf ${erklaerAnfragen.length} Clientanfrage(n)`,
    ).toBe(erklaerAnfragen.length);
  });

  it("A2 · DER KORRIGIERTE TEXT ERREICHT DAS MODELL: der Duplikateintrag ist unter den uebertragenen Schnipseln", async () => {
    await vorrichtung();
    await fragen(FRAGE_DUPLIKAT);
    const koerper = letzterAnfragekoerper();
    const kennungen = koerper.snippets.map((s) => s.id);
    // KEINE Platznummer und KEINE Schnipselzahl wird gepinnt: die Rangliste verschiebt sich mit
    // jedem neuen Registry-Eintrag. Gefragt ist nur: ist er ueberhaupt dabei.
    expect(
      kennungen,
      `der Duplikateintrag ist nicht in der Antwortgrundlage. ${kennungen.length} Schnipsel ` +
        `uebertragen: ${kennungen.join(", ")}`,
    ).toContain(DUPLIKAT_ID);
  });

  it("A3 · ER KOMMT UNGEKUERZT AN: Frage, Titel und Text sind zeichengleich mit ihrer Quelle", async () => {
    await vorrichtung();
    await fragen(FRAGE_DUPLIKAT);
    const koerper = letzterAnfragekoerper();
    // Dieser Fall ersetzt die Literale 160/700/300 aus `faq-sagt-kein-verschmelzen.test.ts:199-209`:
    // gemessen wird der Schnitt DER ANWENDUNG, nicht ein im Test nachgebauter.
    expect(
      koerper.question,
      `die gesendete Frage ist nicht die getippte (gesendet: ${koerper.question.length} Zeichen, ` +
        `getippt: ${FRAGE_DUPLIKAT.length})`,
    ).toBe(FRAGE_DUPLIKAT);
    const dublette = koerper.snippets.find((s) => s.id === DUPLIKAT_ID);
    expect(dublette, `${DUPLIKAT_ID} nicht in der Anfrage — siehe A2`).toBeDefined();
    expect(
      dublette?.body,
      `der Text ist auf dem Weg zur KI beschnitten worden: ${dublette?.body.length} von ` +
        `${DUPLIKAT_QUELLE?.answer.length} Zeichen. Angekommen: „${dublette?.body}"`,
    ).toBe(DUPLIKAT_QUELLE?.answer);
    expect(
      dublette?.title,
      `der Titel ist beschnitten: ${dublette?.title.length} von ${DUPLIKAT_QUELLE?.question.length} Zeichen`,
    ).toBe(DUPLIKAT_QUELLE?.question);
    // FRUEHWARNUNG ohne eigene Zahl im Test: waechst IRGENDEIN Hilfetext ueber den Schnitt der
    // Anwendung, faellt das hier auf, bevor eine KI-Antwort auf einem Rumpf steht.
    const bestand = aufgeloesterBestand();
    for (const s of koerper.snippets) {
      const quelle = bestand.find((e) => e.id === s.id);
      expect(quelle, `uebertragener Schnipsel ${s.id} hat keine Quelle im Bestand`).toBeDefined();
      expect(s.body, `${s.id}: Text beschnitten (${s.body.length}/${quelle?.body.length})`).toBe(
        quelle?.body,
      );
      expect(
        s.title,
        `${s.id}: Titel beschnitten (${s.title.length}/${quelle?.title.length})`,
      ).toBe(quelle?.title);
    }
  });

  it("A4 · OHNE DAS ABGESCHAFFTE VERSPRECHEN: der uebertragene Duplikattext stellt kein Zusammenfuehren in Aussicht", async () => {
    await vorrichtung();
    await fragen(FRAGE_DUPLIKAT);
    const dublette = letzterAnfragekoerper().snippets.find((s) => s.id === DUPLIKAT_ID);
    expect(dublette, `${DUPLIKAT_ID} nicht in der Anfrage — siehe A2`).toBeDefined();
    expect(
      verbotsfunde(String(dublette?.title)),
      `der uebertragene Titel stellt ein Zusammenfuehren in Aussicht: „${dublette?.title}"`,
    ).toEqual([]);
    expect(
      verbotsfunde(String(dublette?.body)),
      `der uebertragene Text stellt ein Zusammenfuehren in Aussicht: „${dublette?.body}"`,
    ).toEqual([]);
    // GEGENPROBE OHNE PRODUKTVERSTELLUNG: die Pruefung ist keine Konstante. Auf dem Wortlaut VOR
    // JOB 3787 meldet dieselbe Funktion beide Staemme.
    expect(verbotsfunde(HISTORISCHE_ZUSAGE)).toEqual(["verschmolz", "zusammenführ"]);
  });

  it("A5 · DIE GENERIERUNGSKANTE ANTWORTET MIT EINEM FEHLER: der Ausschnitt geht trotzdem vollstaendig hinaus", async () => {
    await vorrichtung();
    // NUR die Generierung wird gestoert, der Erreichbarkeits-Ping bleibt gesund. Zurueckgenommen
    // wird die Stoerung in `afterEach` — auch wenn dieser Fall vorzeitig abbricht.
    generierungsStatus = 500;
    await fragen(FRAGE_DUPLIKAT);

    // (a) KALIBRIERUNG — beides muss eingetreten sein, sonst ist dieser Fall ROT statt still gruen:
    // die Generierung wurde wirklich angefragt UND sie hat wirklich den Fehler geliefert.
    expect(
      generierungsAufrufe,
      `die Generierungskante wurde in dieser Handlung nie angefragt — der Schadensfall trat nicht ein. Erreichbarkeits-Pings: ${erreichbarkeitsPings} · Modellstatus: ${letzterModellstatus}`,
    ).toBeGreaterThan(0);
    expect(
      generierungsfehlerGeliefert,
      `die Generierungskante hat nie den Fehler ausgeliefert (eingestellt: ${generierungsStatus}, zuletzt generierende URL: ${letzteGenerierungsUrl}, Generierungsaufrufe: ${generierungsAufrufe}) — ein Fall, der gruen wird, weil sein Schadensfall ausblieb, belegt nichts`,
    ).toBeGreaterThan(0);
    expect(
      generierungsfehlerGeliefert,
      `nicht jeder Generierungsaufruf bekam den Fehler: ${generierungsfehlerGeliefert} von ${generierungsAufrufe}`,
    ).toBe(generierungsAufrufe);

    // (b) DER KERN: der VOR dem Modellaufruf gebildete Ausschnitt ist vom Fehler unberuehrt —
    // dieselben Zusicherungen wie in A1/A3.
    const koerper = letzterAnfragekoerper();
    expect(koerper.question, "die gesendete Frage ist nicht die getippte").toBe(FRAGE_DUPLIKAT);
    expect(
      koerper.snippets.map((s) => s.id),
      `der Duplikateintrag fehlt in der Antwortgrundlage, obwohl der Fehler erst SPAETER eintritt. ${koerper.snippets.length} Schnipsel uebertragen`,
    ).toContain(DUPLIKAT_ID);
    const dublette = koerper.snippets.find((s) => s.id === DUPLIKAT_ID);
    expect(
      dublette?.body,
      `der Text ist beschnitten: ${dublette?.body.length} von ${DUPLIKAT_QUELLE?.answer.length} Zeichen`,
    ).toBe(DUPLIKAT_QUELLE?.answer);
    expect(
      dublette?.title,
      `der Titel ist beschnitten: ${dublette?.title.length} von ${DUPLIKAT_QUELLE?.question.length} Zeichen`,
    ).toBe(DUPLIKAT_QUELLE?.question);

    // (c) WAS DER MENSCH DANACH SIEHT — erst gemessen, dann gepinnt (Messlauf 726fa66c… fuer das
    // Verhalten der Kette, 3b5425bd… fuer den gerenderten Antwortblock; Zahlen und Wortlaut im
    // Kopfkommentar dieses Blocks). Der Fehler bleibt an der Modellkante stehen: die
    // Route antwortet weiter mit 200, die Providerkette faellt auf ihren deterministischen Rueckfall.
    const flaeche = panel();
    const frageZeile = flaeche?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    // KALIBRIERUNG DER ABLESUNG: ohne sie waere „kein Verbotsstamm sichtbar" die Aussage ueber eine
    // leere Flaeche. Ihre Anwesenheit schliesst zugleich den nackten Fehlerzweig aus
    // (`KlaraAssistant.tsx:498-501`, `aiAsk.isError` → nur `state.error` statt einer Karte).
    expect(
      frageZeile,
      `keine KI-Antwortkarte auf der Flaeche — der Mensch sieht bei gestoerter Generierung nichts Ablesbares. Geliefert: ${erklaerAbrufe.at(-1)?.slice(0, 300)}`,
    ).not.toBeNull();
    const karte = frageZeile?.closest("div");
    const sichtbar = (karte?.textContent ?? "").replace(/\s+/g, " ");
    expect(sichtbar, "die Antwortkarte gehoert nicht zu dieser Frage").toContain(FRAGE_DUPLIKAT);
    // KEINE ERFUNDENE ANTWORT. Der Nachweis laeuft in EINER Kette vom Bildschirm zurueck zur
    // Quelle — und zwar in dieser Richtung, weil RUNDE 1 an der Gegenrichtung gescheitert ist:
    // dort endete die Pruefung am Serverkoerper, und BEN konnte den ANGEZEIGTEN Text in
    // `KlaraAssistant.tsx:563` durch „Der Mond besteht aus Käse." ersetzen, ohne dass ein einziger
    // Fall rot wurde (Urteil Runde 1, Korrekturpflicht 1). Ein korrekter Serverkoerper belegt
    // keinen korrekten sichtbaren Antworttext. Die Kette lautet jetzt:
    //   sichtbarer Text  ==  Antworttext des Servers  ==  `body` eines uebertragenen Schnipsels.
    // Reisst irgendein Glied, ist der Fall rot.
    const antwort = JSON.parse(String(erklaerAbrufe.at(-1))) as {
      answered: boolean;
      answer?: string;
      demo?: boolean;
      sources: string[];
    };
    // `demo: true` — geantwortet hat der deterministische Rueckfall, nicht das Modell. Das Modell
    // hat in diesem Fall KEIN Wort beigetragen (der Fehler ist oben gezaehlt).
    expect(
      antwort.demo,
      `die sichtbare Antwort kommt nicht vom deterministischen Rueckfall, obwohl die Generierung mit ${generierungsStatus} gescheitert ist`,
    ).toBe(true);
    // GLIED 1 — es gibt ueberhaupt eine Antwort. Runde 1 hatte den Inhaltsnachweis hinter
    // `if (antwort.answered && antwort.answer)` gestellt: faellt die Antwort weg, entfiel stillschweigend
    // auch ihre Pruefung. Das ist jetzt eine Zusicherung, keine Bedingung mehr.
    expect(
      antwort.answered,
      `der Server hat bei gestoerter Generierung gar nicht geantwortet (${String(erklaerAbrufe.at(-1)).slice(0, 300)}) — dann sagt dieser Fall nichts darueber, was der Mensch liest`,
    ).toBe(true);
    expect(
      typeof antwort.answer === "string" && antwort.answer.length > 0,
      `die Antwort traegt keinen Text (answer=${JSON.stringify(antwort.answer)}) — ohne Text gibt es nichts zu vergleichen`,
    ).toBe(true);
    const antworttext = String(antwort.answer);
    // GLIED 2 — jede tragende Quelle ging vorher wirklich hinaus. Eine Quelle, die nicht in der
    // Antwortgrundlage stand, waere genau die Erfindung, die Klara ausschliesst. Die Schleife
    // braucht ihre eigene Kalibrierung: ueber eine leere Liste laeuft sie stumm durch.
    const gesendeteKennungen = koerper.snippets.map((s) => s.id);
    expect(
      antwort.sources.length,
      "die Antwort nennt keine einzige tragende Quelle — dann prueft die Schleife darunter nichts",
    ).toBeGreaterThan(0);
    for (const quelle of antwort.sources) {
      expect(
        gesendeteKennungen,
        `die Antwort stuetzt sich auf „${quelle}" — diese Quelle ging nie hinaus`,
      ).toContain(quelle);
    }
    // GLIED 3 — der Antworttext ist ZITIERT, nicht erzeugt: er ist zeichengleich mit dem `body`
    // genau eines uebertragenen Schnipsels (`DeterministicProvider.answer` gibt `best.statement`
    // unveraendert zurueck, `services/reasoner/src/provider.ts:1941-1944`). Gemessen im Messlauf
    // 3b5425bd…: `sec:nb.title`, 404 Zeichen. WELCHER Schnipsel es ist, wird NICHT gepinnt — die
    // Rangliste verschiebt sich mit jedem neuen Registry-Eintrag (Lehre JOB 3874 R1).
    const woertlicheQuellen = koerper.snippets
      .filter((s) => s.body === antworttext)
      .map((s) => s.id);
    expect(
      woertlicheQuellen.length,
      `der Antworttext steht in KEINEM uebertragenen Schnipsel woertlich — bei gescheiterter Generierung waere das eine Erfindung. Antwort (${antworttext.length} Zeichen): „${antworttext.slice(0, 200)}"`,
    ).toBeGreaterThan(0);
    // GLIED 4, DER KORREKTURPUNKT AUS RUNDE 1 — was WIRKLICH auf dem Bildschirm steht. Der
    // Antwortblock ist das Element unmittelbar nach der Fragezeile (`AnswerMarkdown`,
    // `KlaraAssistant.tsx:561-565`); gemessen: ein `div.text-[12px] leading-relaxed text-text`,
    // dessen Text zeichengleich mit `antwort.answer` ist (Messlauf 3b5425bd…). Diese Zeile ist
    // bewusst ein struktureller Pin: wandert die Anzeige oder faellt sie weg, wird der Fall rot
    // und sagt mit Tag, Klasse und Text, was stattdessen dort steht.
    const antwortBlock = frageZeile?.nextElementSibling as HTMLElement | null;
    const sichtbarerAntworttext = antwortBlock?.textContent ?? "";
    expect(
      ohneLeerraum(sichtbarerAntworttext).length,
      `unter der Frage steht kein Antworttext (${antwortBlock?.tagName ?? "kein Element"} · „${antwortBlock?.className ?? ""}") — der Mensch liest bei gestoerter Generierung nichts. Karte: „${sichtbar.slice(0, 300)}"`,
    ).toBeGreaterThan(0);
    expect(
      ohneLeerraum(sichtbarerAntworttext),
      `der ANGEZEIGTE Antworttext ist nicht der gelieferte — genau hier war Runde 1 blind. Angezeigt (${antwortBlock?.tagName ?? "?"} · „${antwortBlock?.className ?? ""}"): „${sichtbarerAntworttext.replace(/\s+/g, " ").trim().slice(0, 300)}" · geliefert: „${antworttext.slice(0, 300)}"`,
    ).toBe(ohneLeerraum(antworttext));
    // Und er ist nicht bloss im Baum, sondern mit den Mitteln ausgestellt, mit denen dieses Produkt
    // ausblendet (Lehre: „Sichtbarkeit statt bloßer `textContent`-Anwesenheit messen", LEHREN.md
    // JOB 3007 R1; „`hidden`-Utility und unsichtbare Vorfahren", JOB 3007 R2). Was jsdom NICHT
    // kann, steht als Grenze im Kopf dieses Blocks.
    expect(
      ausblendung(antwortBlock, panel()),
      `der Antworttext steht zwar im Baum, ist aber ausgeblendet: ${ausblendung(antwortBlock, panel())}`,
    ).toBeNull();
    // Zahlen, die nur zufaellig gelten (welcher Schnipsel zitiert wird, wie viele Quellen), werden
    // NICHT gepinnt — die Rangliste verschiebt sich mit jedem neuen Registry-Eintrag.
    expect(
      verbotsfunde(sichtbar),
      `die sichtbare Antwortkarte stellt ein Zusammenfuehren in Aussicht: „${sichtbar.slice(0, 300)}"`,
    ).toEqual([]);
  });
});
