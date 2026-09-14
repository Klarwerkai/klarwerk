// @vitest-environment jsdom
// ================================================================================================
// JOB 3918 · ANGEZEIGT IST GELIEFERT — AUCH WENN DIE ANTWORT MARKDOWN TRAEGT
// ================================================================================================
//
// DIE GEMESSENE LUECKE, in einem Satz: Der Waechter, der heute „was auf dem Bildschirm steht, ist
// der gelieferte Antworttext" misst (`tests/app/f0304-klara-assistenzflaeche.test.tsx:827-830`,
// GLIED 4), vergleicht mit `ohneLeerraum` — und das ist `text.replace(/\s+/g, "")` (`:561`), also
// NUR Leerraum. Sobald die Antwort eine Ueberschrift, einen Listenpunkt oder ein `**fett**` traegt,
// vergleicht er den ROHEN Text mit dem GERENDERTEN und faellt auseinander, obwohl nichts kaputt ist.
// Bens Bestellung dazu woertlich (`archiv/3891/runde-2/ben.md`, Pruefpunkt 6): „Fuer formatierte
// Quellen zusaetzlich Markdown und Absatzgrenzen pruefen; `ohneLeerraum` entfernt lediglich
// Leerraum (`:561`)."
//
// K1 unten BELEGT diese Luecke, statt sie zu behaupten: derselbe Vergleich, dieselbe Antwort, und
// er ist nachweislich ungleich. F1-F3 messen dieselbe Zusage mit einem Vergleich, der genau die
// Umformungen zulaesst, die der Renderer vornehmen DARF.
//
// ------------------------------------------------------------------------------------------------
// WAS DER RENDERER DIESER FLAECHE WIRKLICH TUT — GELESEN, NICHT ANGENOMMEN
// ------------------------------------------------------------------------------------------------
// Der Klara-Antwortblock ist `AnswerMarkdown` (`KlaraAssistant.tsx:562-565`), und der ruft GENAU
// EINE Zerlegung auf: `parseAnswerMarkdown(text)` (`AnswerMarkdown.tsx:34`). Damit sind vier
// Umformungen im Spiel, jede mit Zeile in `apps/web/src/lib/answerMarkdown.ts`:
//   1. `**fett**` / `*kursiv*` verlieren ihre Sternchen (`:21` `INLINE_RE`, `:31-35`).
//   2. `#`/`##` verschwinden mitsamt dem Leerzeichen (`:310` `HEADING_RE`, `:341-350`).
//   3. `- ` und `1. ` am Zeilenanfang verschwinden (`:311-312`, `:352-363`).
//   4. Mehrere Zeilen EINES Absatzes werden mit EINEM Leerzeichen verbunden (`:323`
//      `paragraph.join(" ")`) — die „Absatzgrenze" aus der Bestellung.
//
// DIE FUENFTE UMFORMUNG DES AUFTRAGS (§2c Punkt 5, die Fussnotenmarke) FINDET AUF DIESER FLAECHE
// NICHT STATT, und das ist gemessen, nicht vermutet: `markiereFussnoten` (`answerMarkdown.ts:220`)
// wird von `AnswerMarkdown.tsx` nirgends aufgerufen — nur `components/start/AntwortText.tsx:143`
// (die Fragenflaeche) ruft es. Der Kopf von `AntwortText.tsx:14-19` sagt genau das und nennt den
// Grund: die Marke ist eine Zusage des H5-Zielbilds fuer die FRAGENflaeche, Klara war Gegenstand
// eigener Auftraege. IM KLARA-PANEL BLEIBT `[1, 2]` ALSO WOERTLICH STEHEN. F1 misst das ausdruecklich
// (Zusicherung „die Klammer steht woertlich da") — damit haengt die Aussage dieser Datei nicht an
// einer Annahme ueber die Marke, sondern an ihrem gemessenen Ausbleiben. Bemerkt und in der
// RUECKGABE unter REST gemeldet, NICHT hier behoben: es ist kein Produktdiff dieses Auftrags.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST — UND WELCHER WEG WARUM GEWAEHLT WURDE (Lieferung 1)
// ------------------------------------------------------------------------------------------------
// Bauform woertlich aus `tests/app/f0304-klara-assistenzflaeche.test.tsx`: die echte Komponente
// `KlaraAssistant` mit ihren echten Providern, der echte Clientabruf `endpoints.help.explain`, die
// echte App (`buildApp`/`buildServices`) mit echter Route (`services/app/src/routes/help-routes.ts`)
// und echtem Reasoner, der echte Renderer. Der EINZIGE Ersatz ist der Transport: `globalThis.fetch`
// liegt auf `app.inject` — die Bahn-Sandkiste laesst keinen Horchsocket zu (`listen EPERM`).
//
// DER FORMATIERTE ANTWORTTEXT KOMMT UEBER DIE ECHTE APP, nicht an ihr vorbei. f0304 laesst die
// Modellkante unbrauchbar antworten (`{}`), und dann liefert der deterministische Rueckfall den
// WORTLAUT eines Schnipsels — der traegt nie Markdown (Messlauf 3b5425bd…, 404 Zeichen, ein
// Absatz). Hier antwortet dieselbe, bereits vorhandene Modellattrappe stattdessen mit einem
// FORMATIERTEN Text. Sie erfindet ihn nicht: sie baut ihn aus den Saetzen GENAU DER Quelle, die
// ihr der Server im Grounding unter `[n]` vorgelegt hat (`provider-model.ts:2137-2143`), und
// zerlegt sie mit der Produktfunktion `saetze` (`provider-model.ts:422`). Der Text laeuft danach
// unveraendert durch die ECHTE Zitatdeckung `pruefeDeckung` (`provider-model.ts:2206`, „EINE MARKE
// IST KEIN BELEG") — kaeme er dort nicht durch, ginge der Rueckfallwortlaut hinaus und die
// Kalibrierung K0 waere rot. Der Renderer wird NICHT ersetzt, der angezeigte Text NICHT ersetzt.
// Der zweitbeste Weg des Auftrags (den gelieferten Antworttext vor der Anzeige austauschen) wurde
// deshalb NICHT gebraucht.
//
// ------------------------------------------------------------------------------------------------
// WARUM ES ZWEI VERGLEICHE BRAUCHT UND NICHT EINEN — GEMESSEN AN DEN GEGENPROBEN
// ------------------------------------------------------------------------------------------------
// F1/F2 halten den angezeigten Text gegen `stripAnswerMarkdown` (den Maßstab aus dem Produkt).
// Dieser Maßstab teilt sich mit dem Renderer DIESELBE Zerlegung (`:377` ruft `parseAnswerMarkdown`
// auf) — das ist gewollt (kein zweiter, nachgebauter Parser), hat aber eine Kehrseite, und sie ist
// gemessen statt vermutet: verstellt man `:323` `paragraph.join(" ")` auf `join("")`, wandern BEIDE
// Seiten mit, und F1 bleibt GRUEN (Cloud-Lauf 6fe2cb2f…, „Tests 2 failed | 3 passed"). Rot wurden
// dort F2 (misst den Absatzumbruch gegen den ROHEN Antworttext) und F3 (Zeichenbilanz gegen den
// ROHEN Antworttext). Umgekehrt beim Verschlucken des fetten Teils (`:31-35`): dort wird F1 ueber
// seine Struktur-Kalibrierung rot (Cloud-Lauf 6eb04e15…), F2 nicht, F3 wieder.
// DIE ARBEITSTEILUNG IST ALSO: F1 misst die Gleichheit von Renderer und Maßstab (faengt jede
// Abweichung der ANZEIGE von der Zerlegung), F2 und F3 messen gegen den gelieferten Rohtext (fangen
// jede Aenderung der ZERLEGUNG selbst). Wer eine der beiden Seiten wegnimmt, macht eine dieser zwei
// Fehlerklassen unsichtbar.
//
// ------------------------------------------------------------------------------------------------
// WAS RUNDE 1 UEBERSAH — UND WAS G1 SEITDEM DAUERHAFT VERHINDERT
// ------------------------------------------------------------------------------------------------
// Die Ablesung `angezeigterText` lief in Runde 1 ueber die ELEMENT-Kinder (`block.children`). Ein
// Textknoten unmittelbar am Antwortblock oder zwischen zwei Listenpunkten fiel damit weg, BEVOR
// irgendein Vergleich lief: Ben setzte in `AnswerMarkdown.tsx:37` einen zusaetzlichen Textknoten
// unter das aeussere `<div>` — er stand im DOM, war nie geliefert, und F1-F3 blieben gruen. Der
// Waechter uebersah also genau die Erfindung, gegen die er gebaut ist. Seit dieser Runde liest
// `angezeigterText` `childNodes` (s. dort), und G1 misst diese Vollstaendigkeit an fuenf Stellen —
// erst der Nachweis, dass der Zusatz im DOM steht und nicht geliefert wurde, dann die Forderung,
// dass Vergleich und Zeichenbilanz rot werden.
//
// ------------------------------------------------------------------------------------------------
// ZUSTANDSMODELL DES GEMESSENEN ANTWORTBLOCKS (§9 des Auftrags)
// ------------------------------------------------------------------------------------------------
//   laden                 — es gibt noch keinen Antwortblock: die Faelle laufen NICHT still durch,
//                           `antwortBlock()` wird rot und nennt, was stattdessen dort steht.
//   erfolgreich leer      — `answered:false` oder leerer Antworttext: rot, denn ohne Text gibt es
//                           nichts zu vergleichen (Bauform f0304:780-787).
//   Fehler                — die Generierung scheitert: dann antwortet der deterministische
//                           Rueckfall mit unformatiertem Quellwortlaut. K0 macht genau das rot,
//                           weil der gelieferte Text dann nicht der gebaute ist.
//   Cache (laufend /
//   gescheitert auffrisch.)— nicht Gegenstand: jeder Fall erzeugt seine Antwort frisch.
//   offline               — nicht Gegenstand.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE MESSUNG NICHT SIEHT (ehrliche Grenze, Bauform f0304:553-568)
// ------------------------------------------------------------------------------------------------
//   · KEINE BROWSERSICHTBARKEIT. jsdom rechnet kein Layout und wendet keine Stylesheet-Regeln an:
//     eine Ausblendung ueber eine CSS-Datei, ueber Groesse oder ueber Ueberdeckung faende das hier
//     NICHT. Das ist ausdruecklich Gegenstand des Schwesterauftrags und wird hier NICHT behauptet.
//     Gemessen wird ausschliesslich der Textinhalt der gerenderten Knoten.
//   · KEINE ECHTE MODELLANTWORT. Die Modellkante ist eine Attrappe (s. o.); sie baut ihren Text aus
//     dem gelieferten Grounding. Ob ein echtes Modell diese Formen erzeugt, sagt das nichts.
//   · KEINE ANDERE SPRACHE ALS `de` (`allFaqEntries` gibt EN/NL nichts) und kein Browser.
//   · KEIN MARKDOWN JENSEITS DES SUBSETS aus `answerMarkdown.ts:19-20` (Links, Code, Bilder werden
//     bewusst nicht interpretiert und hier nicht gefordert). Eine spaetere Erweiterung des Subsets
//     schlaegt in F3 an und sagt, welches Zeichen wandert.
//   · KOMMENTARKNOTEN im Antwortblock werden von der Ablesung uebergangen (s. `angezeigterText`).
//     Das ist keine Textauslassung — ein Kommentar steht per Definition nie auf dem Bildschirm —,
//     aber es ist die EINZIGE Stelle, an der die Ablesung etwas weglaesst, und sie steht hier.
//   · DIE GEORDNETE LISTE (`1. `) kommt in den gemessenen Antworttexten NICHT vor. Der Zweig in
//     `angezeigterText` spiegelt `answerMarkdown.ts:381` und ist hier ungemessen; ein Antworttext
//     mit `1. ` kaeme durch die Zitatdeckung des Reasoners gar nicht hindurch, weil `zitatWoerter`
//     (`provider-model.ts:275-285`) die Ziffer „1" als Inhaltswort liest und sie in keiner Quelle
//     steht. Das ist eine benannte Luecke, keine stille.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Die Modellstufe gibt den KI-Knopf frei — ohne nutzbares Modell ist er HART ausgegraut
// (`useAiAvailable("answer")`), und die Nutzerhandlung waere gar nicht ausloesbar. Die Kennung ist
// eine RFC-2606-Adresse und wird nie aufgeloest; der Aufruf endet an der In-Process-Grenze unten.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-job3918.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job3918-in-process";
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
// DER MASSSTAB. `stripAnswerMarkdown` (`answerMarkdown.ts:375-388`) erzeugt aus demselben Rohtext
// genau den Klartext, den der Renderer anzeigt — ueber DIESELBE `parseAnswerMarkdown`-Zerlegung.
// Kein zweiter, nachgebauter Markdown-Parser in dieser Datei; das waere ein zweiter Weg.
import { stripAnswerMarkdown } from "../../apps/web/src/lib/answerMarkdown";
import { buildApp, buildServices } from "../../services/app/src/build-app";
// Die Satzzerlegung des Reasoners — dieselbe, an der seine Zitatdeckung misst. Die Modellattrappe
// baut ihren Text daraus, damit er die Deckung besteht, statt an einer eigenen Zerlegung zu raten.
import { saetze } from "../../services/reasoner/src/provider-model";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Dieselbe Duplikatfrage wie in f0304 (dort ausfuehrlich begruendet): Alltagssprache, zitiert keinen
// FAQ-Titel, traegt keinen Verbotsstamm. Sie hat nachweislich eine Antwortgrundlage (f0304 A1/A2).
const FRAGE = "Ich habe zwei fast gleiche Artikel gefunden — was mache ich damit?";

// ================================================================================================
// DIE VORRICHTUNG — Bauform aus f0304, mit EINER Erweiterung: die Modellkante generiert wirklich.
// ================================================================================================

interface Schnipsel {
  id: string;
  title: string;
  body: string;
}

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
let letzterModellstatus = "(nie abgerufen)";
let erreichbarkeitsPings = 0;
let generierungsAufrufe = 0;
/** Wie oft generiert wurde, OHNE dass ein Fall einen Antwortbauer gesetzt hatte — Fixture-Fehler. */
let generierungOhneBauer = 0;
/**
 * Woran der Antwortbauer scheiterte, falls er scharf wurde. Ohne dieses Feld ginge sein Grund im
 * Modellclient verloren (ein Wurf dort wird zum Anbieterfehler) und die Kalibrierung meldete nur
 * „Rueckfall" statt der Ursache.
 */
let bauerFehler: string | null = null;
/** Was die Modellkante zuletzt WIRKLICH ausgeliefert hat. Gegen ihn haelt K0 die Serverantwort. */
let gesendeteModellantwort: string | null = null;
/** Der Bauer des jeweiligen Falls: aus dem Grounding des Servers wird ein formatierter Text. */
let antwortBauer: ((nutzernachricht: string, schnipsel: Schnipsel[]) => string) | null = null;
const erklaerAbrufe: string[] = [];
/**
 * Die GESENDETEN Anfragekoerper — abgelegt VOR `app.inject`. In f0304 stehen sie danach
 * (`:192-195`); hier braucht die Modellattrappe sie waehrend des laufenden Aufrufs, weil sie ihre
 * Antwort aus genau diesen Schnipseln baut.
 */
const erklaerAnfragen: string[] = [];

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

/** Die Nutzernachricht eines OpenAI-Chatrumpfs (`model-client.ts:664-677`). */
function nutzernachricht(rumpf: string): string {
  try {
    const koerper = JSON.parse(rumpf) as { messages?: { role?: string; content?: unknown }[] };
    const nutzer = (koerper.messages ?? []).find((m) => m.role === "user");
    return typeof nutzer?.content === "string" ? nutzer.content : "";
  } catch {
    return "";
  }
}

/** Die zuletzt gesendeten Schnipsel — die Quellen, die der Server dem Modell vorlegt. */
function letzteSchnipsel(): Schnipsel[] {
  const roh = erklaerAnfragen.at(-1);
  if (typeof roh !== "string") {
    return [];
  }
  return (JSON.parse(roh) as { snippets?: Schnipsel[] }).snippets ?? [];
}

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      // Die In-Process-Modellgrenze. Sie ANTWORTET statt zu werfen, weil eine geworfene Anfrage die
      // Kante als `unreachable` fuehrt und den KI-Knopf ausgraut — dann liefe die Handlung nie.
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const nutzer = nutzernachricht(rumpf);
      // DIE TRENNUNG PING/GENERIERUNG, an der Anfrage selbst abgelesen und nicht geschaetzt: NUR
      // der Antwortaufruf traegt die nummerierte Quellenliste (`provider-model.ts:2137-2149`).
      // Sie ist eine Eigenschaft DIESER Vorrichtung; K0 kalibriert sie, statt sie zu behaupten.
      const istGenerierung = /\n\[1\] /.test(nutzer);
      let inhalt = "bereit";
      if (istGenerierung) {
        generierungsAufrufe += 1;
        if (antwortBauer === null) {
          generierungOhneBauer += 1;
          inhalt = "";
        } else {
          try {
            inhalt = antwortBauer(nutzer, letzteSchnipsel());
          } catch (fehler) {
            bauerFehler = fehler instanceof Error ? fehler.message : String(fehler);
            inhalt = "";
          }
        }
        gesendeteModellantwort = inhalt;
      } else {
        erreichbarkeitsPings += 1;
      }
      const nutzlast = { choices: [{ message: { content: inhalt } }] };
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
    if (url.startsWith("/api/help/explain") && init?.body !== undefined && init.body !== null) {
      erklaerAnfragen.push(String(init.body));
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

/** Tippen und „Mit KI-Unterstuetzung suchen" druecken — die echte Nutzerhandlung. */
async function fragen(frage: string): Promise<void> {
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
  await authApi.register("Pedi", "pedi@job3918.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3918.test", password: "geheim12345" },
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
  erreichbarkeitsPings = 0;
  generierungsAufrufe = 0;
  generierungOhneBauer = 0;
  gesendeteModellantwort = null;
  antwortBauer = null;
  bauerFehler = null;
});

// ================================================================================================
// DIE MODELLATTRAPPE — SIE ERFINDET KEINEN TEXT, SIE FORMATIERT DEN GELIEFERTEN
// ================================================================================================

/**
 * Die Quelle, die im Grounding unter `[nr]` steht — ueber die Zeile, die der Server WIRKLICH baut
 * (`provider-model.ts:2139`: `[${i + 1}] ${r.title}: ${r.statement}`), und ueber einen exakten
 * Zeichenvergleich statt ueber ein Muster. Ein Titel mit Doppelpunkt kann hier nichts verrutschen.
 */
function quelleUnter(
  nutzer: string,
  nr: number,
  schnipsel: readonly Schnipsel[],
): Schnipsel | null {
  return schnipsel.find((s) => nutzer.includes(`[${nr}] ${s.title}: ${s.body}`)) ?? null;
}

/** Die Woerter eines Satzes, so wie der Test ihn zerteilt — keine Aussage ueber das Produkt. */
const woerter = (satz: string): string[] => satz.split(/\s+/).filter((w) => w.length > 0);

/**
 * Zwei brauchbare Saetze einer gelieferten Quelle, samt ihrer Nummer im Grounding.
 *
 * BRAUCHBAR heisst: mindestens sechs Woerter (damit sich der Satz in zwei tragende Haelften teilen
 * laesst) und KEINES der Zeichen `[ ] * #`. Letzteres ist kein Schoenheitswunsch: `[`/`]` wuerde die
 * Zitatdeckung als Fussnotengruppe lesen (`provider-model.ts:327`), und `*`/`#` wuerden die
 * Zeichenbilanz in F3 mit Markdown-Zeichen aus der QUELLE vermischen. Gesucht wird ab `[1]`
 * aufwaerts; welche Quelle es wird, pinnt dieser Test NICHT (die Rangliste verschiebt sich mit
 * jedem neuen Registry-Eintrag — Lehre JOB 3874 R1).
 */
function quellsaetze(
  nutzer: string,
  schnipsel: readonly Schnipsel[],
): { nr: number; andere: number; a: string[]; b: string[] } {
  const nummern: number[] = [];
  for (let nr = 1; nr <= 12; nr++) {
    if (quelleUnter(nutzer, nr, schnipsel) !== null) {
      nummern.push(nr);
    }
  }
  for (const nr of nummern) {
    const quelle = quelleUnter(nutzer, nr, schnipsel) as Schnipsel;
    const brauchbar = saetze(quelle.body).filter(
      (s) => woerter(s).length >= 6 && !/[[\]*#]/.test(s),
    );
    const andere = nummern.find((n) => n !== nr);
    if (brauchbar.length >= 2 && andere !== undefined) {
      return {
        nr,
        andere,
        a: woerter(brauchbar[0] as string),
        b: woerter(brauchbar[1] as string),
      };
    }
  }
  throw new Error(
    `JOB 3918: keine gelieferte Quelle mit zwei brauchbaren Saetzen und keiner zweiten Quellennummer. Quellen im Grounding: ${nummern.join(", ") || "(keine)"}`,
  );
}

/**
 * DER FORMATIERTE ANTWORTTEXT — alle vier Umformungen dieser Flaeche plus eine saubere
 * Fussnotengruppe, gebaut aus den Saetzen EINER gelieferten Quelle.
 *
 * WARUM ER DIE ZITATDECKUNG BESTEHT: `pruefeDeckung` (`provider-model.ts:362-398`) schneidet den
 * Text an der Markengruppe, zerlegt das Segment mit `saetze` (also auch an JEDEM Zeilenumbruch) und
 * verlangt, dass jedes Stueck ein ZUSAMMENHAENGENDER Wortausschnitt EINER Quelle ist. Genau so ist
 * dieser Text gebaut: jede Zeile ist ein Praefix oder ein Suffix von Satz A bzw. Satz B. Die
 * Markdown-Zeichen stoeren dabei nicht — `zitatWoerter` (`:275-285`) zerteilt an allem, was nicht
 * Buchstabe, Ziffer, Punkt oder Komma ist, und wirft `#`, `*`, `-` damit weg.
 */
function formatierteAntwort(nutzer: string, schnipsel: readonly Schnipsel[]): string {
  const { nr, andere, a, b } = quellsaetze(nutzer, schnipsel);
  return [
    `## ${a.slice(0, 3).join(" ")}`,
    "",
    a.slice(0, 3).join(" "),
    a.slice(3).join(" "),
    "",
    `- **${b.slice(0, 2).join(" ")}** ${b.slice(2, 4).join(" ")}`,
    `- ${b.slice(4).join(" ")} [${nr}, ${andere}]`,
  ].join("\n");
}

/**
 * DER ZWEIABSATZ-TEXT fuer F2: ein Absatz aus ZWEI Zeilen, dann eine Leerzeile, dann ein zweiter
 * Absatz. Der Zeilenumbruch INNERHALB des ersten Absatzes ist der Gegenstand (`:323`).
 */
function zweiAbsaetze(nutzer: string, schnipsel: readonly Schnipsel[]): string {
  const { nr, a, b } = quellsaetze(nutzer, schnipsel);
  return [
    a.slice(0, 3).join(" "),
    a.slice(3).join(" "),
    "",
    `**${b.slice(0, 2).join(" ")}** ${b.slice(2).join(" ")} [${nr}]`,
  ].join("\n");
}

/** Die erste Zeile von F2s erstem Absatz und die zweite — getrennt, wie sie hinausgingen. */
function zweiAbsaetzeZeilen(roh: string): { eins: string; zwei: string } {
  const zeilen = roh.split("\n");
  return { eins: zeilen[0] ?? "", zwei: zeilen[1] ?? "" };
}

// ================================================================================================
// DIE ABLESUNG UND DIE ZWEI VERGLEICHE
// ================================================================================================

/**
 * Der ANGEZEIGTE Antwortblock: das Element unmittelbar nach der Fragezeile (`AnswerMarkdown`,
 * `KlaraAssistant.tsx:561-565`). Fehlt es, ist der Fall ROT und sagt mit Tag, Klasse und Karteninhalt,
 * was stattdessen dort steht — kein stilles Durchlaufen im Zustand „laden".
 */
function antwortBlock(): HTMLElement {
  const flaeche = panel();
  const frageZeile = flaeche?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
  expect(
    frageZeile,
    `keine KI-Antwortkarte auf der Flaeche — es gibt nichts zu vergleichen. Geliefert: ${erklaerAbrufe.at(-1)?.slice(0, 300)}`,
  ).not.toBeNull();
  const block = (frageZeile as HTMLElement).nextElementSibling as HTMLElement | null;
  expect(
    block === null ? "(kein Element)" : `${block.tagName} · ${block.className}`,
    `unter der Frage steht kein Antwortblock. Karte: „${(frageZeile?.closest("div")?.textContent ?? "").replace(/\s+/g, " ").slice(0, 300)}"`,
  ).not.toBe("(kein Element)");
  return block as HTMLElement;
}

/**
 * DER TRAGENDE VERGLEICH (Lieferung 3), Haelfte 1: der angezeigte Text, gelesen in der FORM, in der
 * `stripAnswerMarkdown` seinen Klartext bildet.
 *
 * Zwei Unterschiede zwischen DOM und Klartext sind bekannt und hier benannt, statt weggerundet:
 *   · `stripAnswerMarkdown` setzt Listenpunkte MIT ihrem Marker („- " bzw. „1. ",
 *     `answerMarkdown.ts:379-382`); im DOM traegt das `<li>` seinen Punkt als CSS-Marker
 *     (`AnswerMarkdown.tsx:60`/`:65` `list-disc`/`list-decimal`), nicht als Text.
 *   · `stripAnswerMarkdown` trennt Bloecke mit „\n" (`:387`); `textContent` setzt sie ohne
 *     Trennzeichen zusammen.
 * Beides wird hier an der DOM-STRUKTUR abgelesen — nicht mit einer zweiten Markdown-Zerlegung.
 *
 * DIE ABLESUNG IST VOLLSTAENDIG, und das war sie in Runde 1 NICHT (Bens Korrekturpflicht 1): sie lief
 * ueber `block.children` und `kind.children`, also ueber die ELEMENT-Kinder. Ein Textknoten
 * unmittelbar am Antwortblock oder zwischen zwei Listenpunkten fiel damit VOR jedem Vergleich weg —
 * Bens Verstellung (`AnswerMarkdown.tsx:37`, ein zusaetzlicher Textknoten unter dem aeusseren
 * `<div>`) stand im DOM und liess F1-F3 trotzdem gruen. Gelesen wird deshalb `childNodes`, nicht
 * `children`, und JEDER Knoten steuert bei:
 *   · `<li>` einer Liste → Zeile mit dem Marker des Maßstabs.
 *   · jeder ANDERE Knoten in einer Liste (Textknoten zwischen den Punkten, fremdes Element) → eigene
 *     Zeile mit seinem Text; er kann nicht mehr entfallen.
 *   · jedes andere Element und JEDER Textknoten am Block → eigene Zeile, auch wenn er nur Leerraum
 *     traegt. Dieser Renderer erzeugt zwischen den Bloecken keinen Leerraumknoten (er rendert eine
 *     Kinderliste, `AnswerMarkdown.tsx:37-76`); taete er es eines Tages, waere das eine bewusste
 *     Aenderung und keine, die diese Messung stillschweigend schlucken darf.
 * DIE EINZIGE AUSLASSUNG ist der Kommentarknoten, und sie ist keine Textauslassung: sein Inhalt
 * steht per Definition nie auf dem Bildschirm, `textContent` gaebe ihn aber aus. G1 unten misst die
 * Vollstaendigkeit an fuenf Stellen, statt sie zu behaupten.
 */
const ELEMENTKNOTEN = 1;
const KOMMENTARKNOTEN = 8;

function angezeigterText(block: HTMLElement): string {
  const zeilen: string[] = [];
  const istElement = (knoten: Node, tag: string): boolean =>
    knoten.nodeType === ELEMENTKNOTEN && (knoten as Element).tagName === tag;
  for (const kind of [...block.childNodes]) {
    if (kind.nodeType === KOMMENTARKNOTEN) {
      continue;
    }
    if (istElement(kind, "UL") || istElement(kind, "OL")) {
      const geordnet = istElement(kind, "OL");
      let nummer = 0;
      for (const listenKind of [...kind.childNodes]) {
        if (listenKind.nodeType === KOMMENTARKNOTEN) {
          continue;
        }
        if (istElement(listenKind, "LI")) {
          nummer += 1;
          zeilen.push(`${geordnet ? `${nummer}. ` : "- "}${listenKind.textContent ?? ""}`);
          continue;
        }
        zeilen.push(listenKind.textContent ?? "");
      }
      continue;
    }
    zeilen.push(kind.textContent ?? "");
  }
  return zeilen.join("\n");
}

/**
 * Der heutige Vergleich aus `f0304:561`, Zeichen fuer Zeichen — NUR fuer K1, der ihn widerlegt.
 * Er steht hier als Messmittel, nicht als Maßstab.
 */
const ohneLeerraum = (text: string): string => text.replace(/\s+/g, "");

/**
 * Die Zeichen der Bilanz: jede Folge von Leerraum wird EIN Leerzeichen, aussen wird geschnitten.
 *
 * WARUM NICHT „ganz ohne Leerraum" (wie `ohneLeerraum` oben): dann waere die Bilanz blind fuer
 * genau die Umformung, um die es in F2 geht. Der Renderer DARF eine Folge von Leerraum zu einem
 * Leerzeichen machen (`answerMarkdown.ts:323` verbindet Absatzzeilen mit einem, `:334-336` trimmt
 * jede Zeile) — mehr nicht. Verschmelzen zwei Woerter, FEHLT hier ein Leerzeichen, und die Bilanz
 * sagt es. WARUM NICHT „Zeichen fuer Zeichen roh": eine Leerzeile ist im gelieferten Text eine
 * Blockgrenze und im Klartext ein einziges „\n" — jede Blockgrenze stuende sonst als Tilgung da und
 * die Bilanz erstickte an Rauschen, statt auf Textverlust zu zeigen.
 */
const kern = (text: string): string[] => [...text.replace(/\s+/g, " ").trim()];

/**
 * DIE ZEICHENBILANZ (Lieferung 6): was auf dem Weg vom gelieferten zum angezeigten Text VERSCHWAND
 * und was DAZUKAM — ueber die laengste gemeinsame Teilfolge, die Reihenfolge also achtend (ein
 * umgestelltes Wort waere Tilgung UND Erfindung, nicht stillschweigend gleich). Verglichen wird das
 * Ergebnis danach als Zeichenmenge, s. `geordnet`.
 *
 * Sie ist kein Markdown-Parser: sie kennt keine Regel, sie zaehlt Zeichen.
 */
function zeichenbilanz(
  geliefert: string,
  angezeigt: string,
): { getilgt: string; erfunden: string } {
  const a = kern(geliefert);
  const b = kern(angezeigt);
  const tabelle: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const zeile = tabelle[i] as number[];
      const naechste = tabelle[i + 1] as number[];
      zeile[j] =
        a[i] === b[j]
          ? (naechste[j + 1] as number) + 1
          : Math.max(naechste[j] as number, zeile[j + 1] as number);
    }
  }
  let i = 0;
  let j = 0;
  let getilgt = "";
  let erfunden = "";
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    const naechste = tabelle[i + 1] as number[];
    const zeile = tabelle[i] as number[];
    if ((naechste[j] as number) >= (zeile[j + 1] as number)) {
      getilgt += a[i] as string;
      i += 1;
    } else {
      erfunden += b[j] as string;
      j += 1;
    }
  }
  getilgt += a.slice(i).join("");
  erfunden += b.slice(j).join("");
  return { getilgt, erfunden };
}

/**
 * Dieselben Zeichen, nach Codepunkt geordnet.
 *
 * WARUM DIE BILANZ ALS MENGE VERGLICHEN WIRD und nicht in Reihenfolge: die laengste gemeinsame
 * Teilfolge ist bei gleichen Zeichen nicht eindeutig. Traegt eine Quelle selbst einen Bindestrich
 * („KI-Antwort"), darf die Teilfolge JENEN behalten und MEINEN Listenmarker tilgen oder umgekehrt —
 * die ANZAHL der getilgten Zeichen bleibt dabei dieselbe, ihre Stellung nicht. Verglichen wird
 * deshalb, WAS und WIE OFT getilgt wurde. Ein getilgter Buchstabe faellt so genauso auf.
 */
const geordnet = (zeichen: string): string => [...zeichen].sort().join("");

/**
 * Die Zeichen, die der Renderer an `formatierteAntwort` TILGEN darf — und kein einziges mehr.
 * Hergeleitet aus §2c und aus dem Text selbst, nach Codepunkt geordnet (s. `geordnet`):
 *   · ` ` — das Leerzeichen HINTER `##`. `HEADING_RE` (`answerMarkdown.ts:310`) frisst
 *     `^(#{1,6})\s+`, die Raute NICHT allein.
 *   · `##` — die Ueberschriftenmarke selbst (`:341-350`).
 *   · `****` — die zwei Sternpaare des fetten Teils (`:21`, `:31-35`).
 * NICHT dabei, jedes aus einem gemessenen Grund:
 *   · die zwei Listenmarker `- ` (`:352-363`): `angezeigterText` stellt sie aus der DOM-STRUKTUR
 *     wieder her, genau so, wie der Maßstab `stripAnswerMarkdown` sie schreibt (`:379-382`).
 *     Faellt ein Listenpunkt WEG, steht sein `-` samt Woertern hier trotzdem als getilgt da.
 *   · die Fussnotenklammer: auf dieser Flaeche laeuft `markiereFussnoten` nicht (s. Dateikopf),
 *     sie bleibt Zeichen fuer Zeichen stehen. F1 misst das ausdruecklich.
 */
const ERLAUBT_GETILGT = " ##****";

/** Der gelieferte Antworttext des Servers — mit allen Zusicherungen, ohne die er nichts belegt. */
function gelieferterAntworttext(): string {
  // Ein gescheiterter Antwortbauer wuerde sonst nur als „Rueckfall" sichtbar — hier steht sein Grund.
  expect(bauerFehler, "der Antwortbauer der Modellattrappe ist gescheitert").toBeNull();
  const roh = erklaerAbrufe.at(-1);
  expect(
    typeof roh,
    `kein Abruf von /api/help/explain — die Handlung lief nicht. Modellstatus: ${letzterModellstatus}`,
  ).toBe("string");
  const antwort = JSON.parse(String(roh)) as { answered: boolean; answer?: string; demo?: boolean };
  expect(
    antwort.answered,
    `der Server hat nicht geantwortet (${String(roh).slice(0, 300)}) — ohne Antwort gibt es nichts zu vergleichen`,
  ).toBe(true);
  expect(
    typeof antwort.answer === "string" && antwort.answer.length > 0,
    `die Antwort traegt keinen Text (answer=${JSON.stringify(antwort.answer)})`,
  ).toBe(true);
  // Der Modelltext, nicht der deterministische Rueckfall: nur der eine Ausgang liefert formatierten
  // Text aus (`provider-model.ts:2249-2268`), der Rueckfall gaebe unformatierten Quellwortlaut.
  expect(
    antwort.demo,
    "geantwortet hat der deterministische Rueckfall — dann traegt der Antworttext kein Markdown",
  ).not.toBe(true);
  return String(antwort.answer);
}

describe("JOB 3918 · der angezeigte Antworttext ist der gelieferte — auch mit Markdown", () => {
  it("K0 · KALIBRIERUNG: die Handlung laeuft, und der FORMATIERTE Modelltext kommt unveraendert beim Server an", async () => {
    antwortBauer = formatierteAntwort;
    await vorrichtung();
    await fragen(FRAGE);
    expect(
      generierungOhneBauer,
      "die Generierung lief ohne Antwortbauer — Fehler der Vorrichtung, nicht des Produkts",
    ).toBe(0);
    expect(
      generierungsAufrufe,
      `die Generierungskante wurde nie angefragt. Erreichbarkeits-Pings: ${erreichbarkeitsPings} · Modellstatus: ${letzterModellstatus}`,
    ).toBeGreaterThan(0);
    const gesendet = String(gesendeteModellantwort);
    // Die Attrappe hat wirklich FORMATIERT — sonst maesse diese Datei denselben unformatierten Text
    // wie f0304 und waere gegenstandslos.
    expect(gesendet, "der gebaute Antworttext traegt keine Ueberschrift").toContain("## ");
    expect(gesendet, "der gebaute Antworttext traegt keinen Listenpunkt").toContain("\n- ");
    expect(gesendet, "der gebaute Antworttext traegt kein Fett").toContain("**");
    expect(gesendet, "der gebaute Antworttext traegt keine Fussnotengruppe").toMatch(
      /\[\d+, \d+\]/,
    );
    // UND DER SERVER HAT IHN UNVERAENDERT WEITERGEGEBEN: die Zitatdeckung (`:2206`) hat gehalten,
    // kein Rueckfall hat ihn ersetzt. Reisst diese Zeile, ist alles Weitere ohne Gegenstand.
    expect(
      gelieferterAntworttext(),
      "der gelieferte Antworttext ist nicht der generierte — die Zitatdeckung hat ihn verworfen, und der Rueckfall antwortet unformatiert",
    ).toBe(gesendet);
  });

  it("K1 · DIE LUECKE, BELEGT: der heutige Vergleich `ohneLeerraum` zerbricht an genau dieser Antwort", async () => {
    antwortBauer = formatierteAntwort;
    await vorrichtung();
    await fragen(FRAGE);
    const geliefert = gelieferterAntworttext();
    const angezeigt = antwortBlock().textContent ?? "";
    // Beide Zeichenketten stehen in der Meldung: wer diesen Fall liest, sieht die Differenz, statt
    // sie glauben zu muessen. GRUEN heisst hier: die Luecke ist echt. Wuerde dieser Fall eines Tages
    // rot, traegt der Antworttext keine Formatierung mehr — dann ist K0 zuerst rot.
    expect(
      ohneLeerraum(angezeigt),
      `der Vergleich aus f0304:827-830 traegt an dieser Antwort doch — dann ist die Luecke geschlossen oder der Antworttext unformatiert.\nangezeigt:  „${ohneLeerraum(angezeigt)}"\ngeliefert:  „${ohneLeerraum(geliefert)}"`,
    ).not.toBe(ohneLeerraum(geliefert));
  });

  it("F1 · DER POSITIVFALL: angezeigt == geliefert ueber alle Bloecke — Ueberschrift, Absatz, Liste, Fett", async () => {
    antwortBauer = formatierteAntwort;
    await vorrichtung();
    await fragen(FRAGE);
    const geliefert = gelieferterAntworttext();
    const block = antwortBlock();

    // KALIBRIERUNG DER BLOCKBILDUNG: ohne sie waere die Gleichheit darunter auch dann wahr, wenn der
    // Renderer gar keine Bloecke gebildet haette (ein einziger Absatz mit rohem Markdown darin).
    expect(
      block.querySelectorAll("h3").length,
      `keine Ueberschrift gerendert. Bloecke: ${[...block.children].map((k) => k.tagName).join(", ")}`,
    ).toBe(1);
    expect(block.querySelectorAll("ul li").length, "die Liste hat nicht zwei Punkte").toBe(2);
    expect(block.querySelectorAll("strong").length, "kein fetter Teil gerendert").toBe(1);
    expect(block.querySelectorAll("p").length, "kein Absatz gerendert").toBe(1);

    // DER TRAGENDE VERGLEICH: Zeichen fuer Zeichen gegen den Klartext der Produktfunktion.
    expect(
      angezeigterText(block),
      `der ANGEZEIGTE Antworttext ist nicht der gelieferte.\nangezeigt:  „${angezeigterText(block)}"\nerwartet:   „${stripAnswerMarkdown(geliefert)}"\ngeliefert:  „${geliefert}"`,
    ).toBe(stripAnswerMarkdown(geliefert));

    // DIE FUSSNOTENKLAMMER (§2c Punkt 5), gesondert und gemessen statt angenommen: `AnswerMarkdown`
    // ruft `markiereFussnoten` nicht auf (s. Dateikopf) — die Gruppe steht WOERTLICH auf dem
    // Bildschirm, und es gibt keine einzige Marke. Wer das aendert, aendert die Zusage dieser Datei.
    const gruppe = /\[\d+, \d+\]/.exec(geliefert);
    expect(gruppe?.[0], `der gelieferte Text traegt keine Fussnotengruppe: „${geliefert}"`).toMatch(
      /\[\d+, \d+\]/,
    );
    expect(
      block.textContent ?? "",
      `die Fussnotengruppe „${gruppe?.[0]}" steht nicht woertlich im Klara-Panel — der Renderer hat sie umgeformt`,
    ).toContain(String(gruppe?.[0]));
    expect(
      block.querySelectorAll("sup[data-fussnote]").length,
      "das Klara-Panel zeigt Fussnotenmarken — dann gilt der Maßstab dieser Datei nicht mehr",
    ).toBe(0);
  });

  it("F2 · ABSATZGRENZEN: beide Absaetze kommen ganz an, der Umbruch IM Absatz wird genau ein Leerzeichen", async () => {
    antwortBauer = zweiAbsaetze;
    await vorrichtung();
    await fragen(FRAGE);
    const geliefert = gelieferterAntworttext();
    const block = antwortBlock();

    const absaetze = [...block.querySelectorAll("p")];
    expect(
      absaetze.length,
      `der Text zerfaellt nicht in ZWEI Absaetze. Bloecke: ${[...block.children].map((k) => k.tagName).join(", ")}`,
    ).toBe(2);

    // DER KERN: die zwei Zeilen des ERSTEN Absatzes stehen mit GENAU EINEM Leerzeichen dazwischen
    // (`answerMarkdown.ts:323` `paragraph.join(" ")`) — nicht mit keinem (Woerter verschmelzen) und
    // nicht mit einem verlorenen Wort.
    const { eins, zwei } = zweiAbsaetzeZeilen(geliefert);
    expect(eins.length, "der erste Absatz hat keine erste Zeile").toBeGreaterThan(0);
    expect(zwei.length, "der erste Absatz hat keine zweite Zeile").toBeGreaterThan(0);
    expect(
      absaetze[0]?.textContent ?? "",
      `der Umbruch im Absatz ist nicht genau ein Leerzeichen geworden.\nangezeigt: „${absaetze[0]?.textContent ?? ""}"\nerwartet:  „${eins} ${zwei}"`,
    ).toBe(`${eins} ${zwei}`);

    // Und der ZWEITE Absatz ist vollstaendig da — sonst waere „beide Absaetze" eine halbe Aussage.
    expect(absaetze[1]?.textContent ?? "", "der zweite Absatz fehlt oder ist unvollstaendig").toBe(
      stripAnswerMarkdown(geliefert).split("\n")[1],
    );

    // DER TRAGENDE VERGLEICH ueber den ganzen Block.
    expect(
      angezeigterText(block),
      `der ANGEZEIGTE Antworttext ist nicht der gelieferte.\nangezeigt:  „${angezeigterText(block)}"\nerwartet:   „${stripAnswerMarkdown(geliefert)}"`,
    ).toBe(stripAnswerMarkdown(geliefert));
  });

  it("F3 · KEIN ZEICHEN GEHT VERLOREN, KEINES KOMMT HINZU: die Bilanz nennt die Differenz beim Namen", async () => {
    antwortBauer = formatierteAntwort;
    await vorrichtung();
    await fragen(FRAGE);
    const geliefert = gelieferterAntworttext();
    const block = antwortBlock();

    const bilanz = zeichenbilanz(geliefert, angezeigterText(block));

    // (a) NICHTS ERFUNDEN: kein angezeigtes Zeichen, das nicht auf den gelieferten Text zurueckgeht.
    expect(
      bilanz.erfunden,
      `im angezeigten Text stehen Zeichen, die der Server nie geliefert hat: „${bilanz.erfunden}"`,
    ).toBe("");

    // (b) NICHTS VERLOREN AUSSER DEM ERLAUBTEN MARKDOWN — kein Buchstabe, keine Ziffer, kein
    // Satzzeichen und auch kein Wortabstand daneben. Die Meldung nennt die konkrete Differenz.
    expect(
      geordnet(bilanz.getilgt),
      `der Renderer hat mehr (oder anderes) getilgt als die erlaubten Markdown-Zeichen: getilgt „${bilanz.getilgt}", erlaubt „${ERLAUBT_GETILGT}"`,
    ).toBe(ERLAUBT_GETILGT);

    // (c) KALIBRIERUNG DER BILANZ: sie kann ueberhaupt anschlagen. Ohne diese Zeilen waeren (a)/(b)
    // auch von einer Funktion erfuellt, die immer zwei leere Zeichenketten zurueckgibt. Der vierte
    // Fall ist der wichtigste: er ist der Wortverschmelzung von Gegenprobe 1 nachgebildet.
    expect(zeichenbilanz("Ventil pruefen", "Ventil pruefen")).toEqual({
      getilgt: "",
      erfunden: "",
    });
    expect(zeichenbilanz("**Ventil** pruefen", "Ventil pruefen")).toEqual({
      getilgt: "****",
      erfunden: "",
    });
    expect(zeichenbilanz("Ventil pruefen", "Ventil pruefen!")).toEqual({
      getilgt: "",
      erfunden: "!",
    });
    expect(zeichenbilanz("Ventil A\npruefen", "Ventil Apruefen")).toEqual({
      getilgt: " ",
      erfunden: "",
    });
  });

  it("G1 · KALIBRIERUNG DER ABLESUNG: erfundener Text wird an JEDER Stelle des Antwortblocks bemerkt", async () => {
    // WARUM ES DIESEN FALL GIBT (Bens Korrekturpflicht 2 aus Runde 1): F1-F3 sind nur so viel wert,
    // wie die Ablesung `angezeigterText` sieht. In Runde 1 sah sie nur ELEMENT-Kinder; ein
    // zusaetzlicher Textknoten im Antwortblock — genau die Erfindung, die dieser Waechter ausschliessen
    // soll — blieb unbemerkt, und F1-F3 waren trotzdem gruen. Dieser Fall haelt die Ablesung
    // dauerhaft ehrlich: er stellt den Zusatz selbst her, WEIST IHN ZUERST NACH (er steht im DOM, er
    // wurde nie geliefert) und verlangt ERST DANN, dass der tragende Vergleich und die Zeichenbilanz
    // rot werden. Verstellt wird ausschliesslich der gerenderte DOM dieses Falls, kein Produktcode.
    antwortBauer = formatierteAntwort;
    await vorrichtung();
    await fragen(FRAGE);
    const geliefert = gelieferterAntworttext();
    const block = antwortBlock();
    const erwartet = stripAnswerMarkdown(geliefert);

    // AUSGANGSLAGE: ohne Zusatz ist die Ablesung Zeichen fuer Zeichen der Maßstab. Ohne diese Zeile
    // koennte alles Weitere auch von einer Ablesung erfuellt werden, die IMMER ungleich ist.
    expect(
      angezeigterText(block),
      `schon ohne Zusatz weicht die Ablesung ab — dann kalibriert dieser Fall nichts.\nangezeigt: „${angezeigterText(block)}"\nerwartet:  „${erwartet}"`,
    ).toBe(erwartet);

    const liste = block.querySelector("ul");
    expect(
      liste === null ? "(keine Liste)" : liste.children.length,
      `keine Liste im Antwortblock — die zwei Listenstellen unten waeren ungemessen. Bloecke: ${[...block.children].map((k) => k.tagName).join(", ")}`,
    ).toBe(2);
    const ul = liste as HTMLUListElement;

    // Das Doppelkreuz U+2021 kommt in keiner Quelle vor; die Zeile darunter misst das, statt es
    // anzunehmen. Nur weil KEIN Zeichen des Zusatzes im gelieferten Text steht, kann die
    // Zeichenbilanz ihn ungeschmaelert als „erfunden" ausweisen (die laengste gemeinsame Teilfolge
    // koennte ein geteiltes Zeichen sonst der anderen Seite zuschlagen, s. `geordnet`).
    const ZUSATZ = "‡ZUSATZ OHNE LIEFERUNG‡";
    expect(
      geliefert.includes("‡"),
      `der gelieferte Text traegt selbst ein „‡" — dann taugt er nicht als Markierung: „${geliefert}"`,
    ).toBe(false);

    const stellen: { name: string; setzen: () => Text }[] = [
      {
        name: "vor allen Bloecken",
        setzen: () => block.insertBefore(document.createTextNode(ZUSATZ), block.firstChild),
      },
      {
        name: "zwischen zwei Bloecken",
        setzen: () =>
          block.insertBefore(document.createTextNode(ZUSATZ), block.children[1] ?? null),
      },
      {
        name: "nach allen Bloecken",
        setzen: () => block.appendChild(document.createTextNode(ZUSATZ)),
      },
      {
        name: "zwischen zwei Listenpunkten",
        setzen: () => ul.insertBefore(document.createTextNode(ZUSATZ), ul.children[1] ?? null),
      },
      {
        name: "am Ende der Liste",
        setzen: () => ul.appendChild(document.createTextNode(ZUSATZ)),
      },
    ];

    for (const stelle of stellen) {
      const knoten = stelle.setzen();

      // (a) DER NACHWEIS VOR DEM ERWARTETEN FEHLER, erste Haelfte: der Zusatz steht wirklich im DOM.
      expect(
        block.textContent ?? "",
        `Stelle „${stelle.name}": der Zusatz steht gar nicht im DOM — dann misst die Erwartung darunter nichts.`,
      ).toContain(ZUSATZ);
      // (b) zweite Haelfte: der Server hat ihn nie geliefert. Er ist also Erfindung, nicht Anzeige.
      expect(
        geliefert,
        `Stelle „${stelle.name}": der gelieferte Text traegt den Zusatz selbst — dann waere er keine Erfindung.`,
      ).not.toContain(ZUSATZ);

      // ERST JETZT die Erwartung: die Ablesung sieht ihn ...
      expect(
        angezeigterText(block),
        `Stelle „${stelle.name}": die Ablesung uebergeht den Zusatz — genau die Blindstelle aus Runde 1.\nabgelesen: „${angezeigterText(block)}"`,
      ).toContain(ZUSATZ);
      // ... der tragende Vergleich aus F1/F2 wird rot ...
      expect(
        angezeigterText(block),
        `Stelle „${stelle.name}": der tragende Vergleich bleibt trotz erfundenem Text gleich.`,
      ).not.toBe(erwartet);
      // ... und die Zeichenbilanz aus F3 (a) weist ihn als erfunden aus, mit beiden Markierungen.
      const bilanz = zeichenbilanz(geliefert, angezeigterText(block));
      expect(
        [...bilanz.erfunden].filter((z) => z === "‡").length,
        `Stelle „${stelle.name}": die Zeichenbilanz nennt den Zusatz nicht vollstaendig. erfunden: „${bilanz.erfunden}" · getilgt: „${bilanz.getilgt}"`,
      ).toBe(2);

      // ZURUECKGENOMMEN: ohne den Zusatz ist die Ablesung wieder Zeichen fuer Zeichen die alte —
      // sonst schleppte die naechste Stelle den Bruch der vorigen mit.
      knoten.remove();
      expect(
        angezeigterText(block),
        `Stelle „${stelle.name}": nach dem Entfernen des Zusatzes stimmt die Ablesung nicht wieder.`,
      ).toBe(erwartet);
    }
  });
});
