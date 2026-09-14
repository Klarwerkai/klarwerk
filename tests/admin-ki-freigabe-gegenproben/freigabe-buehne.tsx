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
// FEHLT GEGENÜBER DEM VORBILD: `oeffneAeltesten` und `vertraulichEinschalten` — sie tragen nur
// Fälle, die hier nicht wiederholt werden.
//
// ------------------------------------------------------------------------------------------------
// JOB 3943 · WAS SICH GEGENÜBER JOB 3827 GEÄNDERT HAT — und warum
// ------------------------------------------------------------------------------------------------
// BENs Prüfpunkt 6 zu JOB 3827 (`archiv/3827/runde-1/ben.md:25`, wörtlich): „[Bühne:299] verwendet
// feste Wartefolgen. Folgeprüfung: verzögerte Fehlerantworten und beobachtbare Request-Abschlüsse.
// … überlappende Fehler durch kontrolliert gehaltene Antworten ergänzen."
//
//   1. DIE UHR IST RAUS. Die alte Wartefolge spulte 30 Nulltakte ab und wertete dabei NICHTS aus.
//      Ein Wächter, der so synchronisiert, wird nicht rot, wenn das Produkt kaputtgeht, sondern
//      wenn die Maschine langsam ist. An ihrer Stelle steht `warteBis(<Bedingung>)`: es wartet auf
//      eine BENANNTE, beobachtbare Bedingung und wirft bei Überschreitung MIT DEREN NAMEN. Dass sie
//      nicht zurückkommt, sichert `keine-uhr-in-diesem-ordner.test.ts` zu.
//   2. FEHLERANTWORTEN SIND HALTE-FÄHIG. Der 503 kehrte bisher VOR dem Haltetor zurück; damit war
//      der Fall „der Mensch klickt noch einmal, während der erste Fehler unterwegs ist" in dieser
//      Bühne nicht herstellbar. Jetzt geht auch die gestörte Antwort durch `haltPut`/`haltGet`.
//      Ihre WIRKUNG bleibt unverändert — nur ihr ZEITPUNKT ist steuerbar.
//   3. DER VORRAT DER KARTE (`vorrat`) ist erreichbar. `isFetching()`/`isMutating()` sind die
//      Abschlussmeldung der Karte selbst — die einzige Auskunft darüber, dass wirklich nichts mehr
//      offen ist. Sie trägt die Bedingung `karteRuht()`.
//   4. RUNDE 2 — DIE KARTE MELDET IHRE ZUSTÄNDE ERST EINEN MAKROTASK SPÄTER. Das ist der Befund,
//      an dem Runde 1 rot wurde, und er ist gemessen, nicht vermutet: React Query stellt JEDE
//      Benachrichtigung an seine Beobachter über `notifyManager` zu, und dessen Zeitgeber ist
//      `defaultScheduler = systemSetTimeoutZero`
//      (`apps/web/node_modules/@tanstack/query-core/build/modern/notifyManager.js:2-3`,
//      `timeoutManager.js:13` → der echte Zeitgeber mit Verzögerung 0). Ein `act`, das nur
//      Mikrotasks leert, sieht deshalb NIE, dass ein Schreiben BEGONNEN hat — `isPending` ist im
//      Vorrat gesetzt, aber noch nicht gerendert.
//      FOLGE FÜR DIESE BÜHNE, und sie hat zwei Hälften:
//        · `warteBis` schließt mit einem ECHTEN Takt ab (Übergabe an die Makrotask-Warteschlange),
//          nicht mit einem leeren `act`. Vorher hing jede Zusicherung über die FLÄCHE, die einer
//          rein transportseitigen Bedingung folgte, am Zufall — und wo die Bedingung schon beim
//          Eintritt galt, lief die Schleife null Mal und der Zufall ging verloren.
//        · Wichtiger noch: wer über die FLÄCHE urteilen will, wartet auf eine Bedingung DER FLÄCHE
//          (`karteSperrt`, `karteZeigt`, `ki-ungespeichert`), nicht auf einen Zähler der Brücke.
//          Ein Zähler der Brücke sagt, was der Transport getan hat, nicht, was die Karte davon
//          weiß. Genau diese Verwechslung war der rote Fall aus Runde 1.
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
        //
        // JOB 3943: diese Antwort durchläuft DASSELBE Haltetor wie die erfolgreiche
        // (`haltPut`, freigegeben über `oeffnePut()`). Die Semantik bleibt Zeile für Zeile
        // dieselbe — der Server sieht den Rumpf weiterhin nie, `angekommenePuts` steigt NICHT,
        // die Karte bekommt weiterhin 503. Steuerbar ist allein der ZEITPUNKT der Antwort. Vorher
        // kehrte sie sofort zurück, und ein überlappender Schreibfehler war nicht herstellbar.
        if (bruecke.haltPut) {
          await new Promise<void>((frei) => bruecke.wartendePut.push(frei));
        }
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => JSON.stringify({ error: "TOR", message: "Schreiben im Test gestört." }),
        };
      }
    }
    if (istKonfig && methode === "GET" && bruecke.gestoertesGet) {
      // JOB 3943: dasselbe für den Nachladeweg. Der Server liefert weiterhin nichts; die
      // Fehlerantwort lässt sich jetzt festhalten (`haltGet`, freigegeben über `oeffneTor()`).
      // `beantworteteGets` zählt seitdem erst NACH dem Tor — genau wie auf dem Erfolgsweg unten:
      // „beantwortet" heißt beantwortet, nicht „abgeschickt". Ohne diese Verschiebung wäre der
      // Zähler auf dem Fehlerweg keine Abschlussmeldung und als Wartebedingung wertlos.
      if (bruecke.haltGet) {
        await new Promise<void>((frei) => bruecke.wartende.push(frei));
      }
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

// ---- Warten auf ZUSTAND, nie auf die Uhr (JOB 3943, Lieferung 1) --------------------------------
/**
 * EINE BENANNTE, BEOBACHTBARE BEDINGUNG.
 *
 * Der Name ist kein Schmuck: er ist das, was die Fehlermeldung nennt, wenn die Bedingung ausbleibt.
 * Ein Warten, das still weiterläuft, ist schlimmer als gar keines — es verschiebt den Fehler auf
 * eine spätere Zusicherung, die dann über einen Zwischenstand urteilt.
 */
export interface Bedingung {
  /** Wofür gewartet wird — wörtlich in der Abbruchmeldung. */
  readonly name: string;
  /** Gilt die Bedingung JETZT? Wird bei jedem Durchgang neu gelesen. */
  readonly erfuellt: () => boolean;
  /** Der zuletzt gesehene Zustand — wird NUR im Fehlerfall gelesen. */
  readonly lage: () => string;
}

/**
 * Die Abbruchschwelle ist KEINE Messgröße. Kein Fall dieses Ordners behauptet, dass etwas schnell
 * geschieht — nur, dass es überhaupt geschieht. Dieselbe Bauform wie
 * `tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx:304-315` (JOB 3813 Runde 2).
 */
const ABBRUCH_MS = 15_000;

/**
 * WARTEN, BIS DIE BEDINGUNG GILT — der Ersatz für die 30 Nulltakte von JOB 3827.
 *
 * Der Unterschied ist nicht die Wartezeit, sondern die AUSWERTUNG: hier wird bei jedem Durchgang
 * die Bedingung selbst gelesen. Eine Antwort, die länger unterwegs ist, verlängert das Warten;
 * eine, die nie kommt, bricht MIT NAMEN ab.
 */
export async function warteBis(bis: Bedingung): Promise<void> {
  // DER EINZIGE TAKT DIESES ORDNERS — und er ist KEINE Wartezeit, sondern eine ÜBERGABE an die
  // Makrotask-Warteschlange. Ohne sie kommt die Karte gar nicht zu Wort: React Query stellt jede
  // Zustandsmeldung über einen Zeitgeber mit Verzögerung 0 zu (Dateikopf, Punkt 4). Die 5 ms sind
  // die Pause ZWISCHEN zwei Abfragen der Bedingung, nicht die Dauer, auf die gewartet wird —
  // ausgewertet wird bei JEDEM Durchgang die Bedingung selbst.
  const takt = async (): Promise<void> => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  };
  const start = Date.now();
  while (!bis.erfuellt()) {
    if (Date.now() - start > ABBRUCH_MS) {
      throw new Error(
        `Bedingung „${bis.name}" wurde nach ${ABBRUCH_MS} ms nicht erreicht — zuletzt gesehen: ${bis.lage()}`,
      );
    }
    await takt();
  }
  // Die Bedingung gilt. Ein ECHTER Abschlusstakt gibt der Karte die Gelegenheit, eine im selben
  // Augenblick angestoßene Meldung noch zuzustellen und zu zeichnen. Ein LEERES `act` leistete das
  // nicht — es leert nur Mikrotasks, und die Meldung der Karte liegt in der Makrotask-Warteschlange
  // (Dateikopf, Punkt 4). Genau daran wurde Runde 1 rot: die Bedingung („ein Rumpf ist draußen, seine
  // Antwort hängt am Tor") galt schon beim Eintritt, die Schleife lief null Mal, und die Zusicherung
  // über die Fläche urteilte über ein Bild, das die Karte noch gar nicht gezeichnet hatte.
  // Der Takt ist damit die UNTERE Absicherung, nicht die Zusage: eine Aussage über die Fläche hängt
  // an einer Bedingung DER FLÄCHE, nie an diesem einen Takt.
  await takt();
}

/** Eine Bedingung von Hand — für alles, wofür es unten keinen fertigen Baustein gibt. */
export function bedingung(name: string, erfuellt: () => boolean, lage: () => string): Bedingung {
  return { name, erfuellt, lage };
}

/** Mehrere Bedingungen zugleich — die Lage nennt, welche davon offen ist. */
export function und(...teile: Bedingung[]): Bedingung {
  return {
    name: teile.map((t) => t.name).join(" UND "),
    erfuellt: () => teile.every((t) => t.erfuellt()),
    lage: () =>
      teile
        .map((t) => (t.erfuellt() ? `[erfüllt] ${t.name}` : `[OFFEN] ${t.name} (${t.lage()})`))
        .join(" · "),
  };
}

/** „So viele PUTs haben den ECHTEN Server erreicht" — der harte Abschluss des Schreibwegs. */
export const putsAngekommen = (n: number): Bedingung =>
  bedingung(
    `angekommenePuts hat ${n} erreicht`,
    () => bruecke.angekommenePuts >= n,
    () => `angekommenePuts=${bruecke.angekommenePuts}`,
  );

/** „So viele Rümpfe hat die Karte abgeschickt" — gilt auch, wenn der Server sie nie sieht. */
export const ruempfeAbgeschickt = (n: number): Bedingung =>
  bedingung(
    `putRuempfe hat ${n} erreicht`,
    () => bruecke.putRuempfe.length >= n,
    () => `putRuempfe=${bruecke.putRuempfe.length}`,
  );

/** „So viele GETs sind VOLLSTÄNDIG beantwortet" — Erfolg und 503 zählen gleich. */
export const getsBeantwortet = (n: number): Bedingung =>
  bedingung(
    `beantworteteGets hat ${n} erreicht`,
    () => bruecke.beantworteteGets >= n,
    () => `beantworteteGets=${bruecke.beantworteteGets}`,
  );

/** „So viele PUT-Antworten hängen gerade am Haltetor" — der Beleg, dass die Überlappung STEHT. */
export const putAntwortenFestgehalten = (n: number): Bedingung =>
  bedingung(
    `wartendePut hat ${n} erreicht`,
    () => bruecke.wartendePut.length >= n,
    () => `wartendePut=${bruecke.wartendePut.length}`,
  );

/** Dasselbe für den Nachladeweg. */
export const getAntwortenFestgehalten = (n: number): Bedingung =>
  bedingung(
    `wartende (GET) hat ${n} erreicht`,
    () => bruecke.wartende.length >= n,
    () => `wartende=${bruecke.wartende.length}`,
  );

/** Der Vorrat der gemounteten Karte — Grundlage von `karteRuht()`, gesetzt in `karteMounten`. */
let vorrat: QueryClient | null = null;

/**
 * DIE KARTE HAT NICHTS MEHR OFFEN — gelesen an ihrem EIGENEN Vorrat, nicht an einer Zeitspanne.
 *
 * Das ist zugleich der Grund, warum eine Bedienung, die nichts auslösen DARF, hier trotzdem sauber
 * gemessen werden kann: `mutate()` trägt die Mutation SYNCHRON in den Vorrat ein. Wäre eine Sperre
 * durchlässig, stünde `isMutating()` unmittelbar nach dem Klick auf 1, und diese Bedingung wartete
 * den Vorgang ab, statt ihn zu übersehen.
 */
export const karteRuht = (): Bedingung =>
  bedingung(
    "die Karte hat keinen Vorgang mehr offen (isFetching=0, isMutating=0)",
    () => vorrat !== null && vorrat.isFetching() === 0 && vorrat.isMutating() === 0,
    () => `isFetching=${vorrat?.isFetching() ?? "?"}, isMutating=${vorrat?.isMutating() ?? "?"}`,
  );

/** Die Karte zeigt ein bestimmtes Element. */
export const karteZeigt = (c: HTMLDivElement, id: string): Bedingung =>
  bedingung(
    `die Karte zeigt „${id}"`,
    () => sichtbar(c, id),
    () => `„${id}" ist nicht da`,
  );

/**
 * DIE KARTE HAT EIN BEDIENELEMENT ZUGEMACHT — ihre EIGENE Meldung, dass sie einen Vorgang
 * übernommen hat.
 *
 * Sie ist der Gegenpol zu den Zählern der Brücke (`ruempfeAbgeschickt`, `putAntwortenFestgehalten`):
 * die sagen, was der TRANSPORT getan hat, diese sagt, was die KARTE davon weiß. Wer über die Fläche
 * urteilt, wartet auf diese — und bekommt bei Ausbleiben den Namen der Bedingung statt eines
 * nackten „expected false to be true" (Dateikopf, Punkt 4).
 */
export const karteSperrt = (c: HTMLDivElement, id: string): Bedingung =>
  bedingung(
    `die Karte hat „${id}" gesperrt`,
    () => c.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)?.disabled === true,
    () => (sichtbar(c, id) ? `„${id}" steht offen` : `„${id}" ist gar nicht da`),
  );

/** Die Karte zeigt ein bestimmtes Element NICHT mehr. */
export const karteZeigtNicht = (c: HTMLDivElement, id: string): Bedingung =>
  bedingung(
    `die Karte zeigt „${id}" nicht mehr`,
    () => !sichtbar(c, id),
    () => `„${id}" steht noch da`,
  );

// ---- Die echte Karte ---------------------------------------------------------------------------
const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

export async function karteMounten(): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vorrat = qc;
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(KiDetail, { onZurueck: () => {} })),
      ),
    );
  });
  // Der Aufbau ist fertig, wenn der erste Abruf beantwortet IST, die Karte ihr Auswahlfeld zeigt
  // und nichts mehr läuft — drei beobachtbare Größen statt einer Anzahl Durchläufe.
  await warteBis(
    und(
      getsBeantwortet(1),
      bedingung(
        "die Karte zeigt das globale Auswahlfeld",
        () => container.querySelector('[data-testid="ki-wahl-global"]') !== null,
        () => `Karteninhalt: „${(container.textContent ?? "").slice(0, 120)}"`,
      ),
      karteRuht(),
    ),
  );
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
  vorrat = null;
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
export async function klick(
  el: Element | null | undefined,
  was: string,
  bis: Bedingung,
): Promise<void> {
  expect(el, `${was} nicht gefunden`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await warteBis(bis);
}

/**
 * EINE BEDIENUNG, DIE NICHTS AUSLÖSEN DARF — und deshalb keine eigene Wartebedingung hat.
 *
 * Das ist die einzige Stelle dieser Bühne ohne beobachtbaren Abschluss, und der Grund ist kein
 * Versäumnis: ein Vorgang, der gar nicht entsteht, hat keinen. Statt hier eine Frist abzusitzen,
 * wird der Griff ABGERECHNET, wenn der nächste WIRKLICHE Abschluss beobachtet ist — bis dahin
 * stünde ein doch entstandener Rumpf längst in `putRuempfe`, denn die Brücke schreibt ihn beim
 * EINTRITT in `fetch` fort, und `karteRuht()` sähe die Mutation im Vorrat.
 *
 * Wo die Karte NICHT festgehalten ist, braucht es diesen Griff nicht: dort trägt `karteRuht()`
 * dieselbe Aussage und ist eine echte Bedingung. Er ist ausschließlich für den Fall da, dass eine
 * Antwort absichtlich am Haltetor hängt und `karteRuht()` deshalb nie gelten kann.
 */
export async function griffOhneWirkung(el: Element | null | undefined, was: string): Promise<void> {
  expect(el, `${was} nicht gefunden`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
}

/** Ein Kästchen umlegen — wie im Browser: Klick auf das Kästchen. */
export async function umlegen(c: HTMLDivElement, id: string, bis: Bedingung): Promise<void> {
  await klick(kaestchen(c, id), `Schalter ${id}`, bis);
}

/** Das globale Auswahlfeld stellen — der ZUORDNUNGSENTWURF, der hier stehen bleiben muss. */
export async function zuordnungWaehlen(c: HTMLDivElement, wert: string): Promise<void> {
  const wahl = c.querySelector<HTMLSelectElement>('[data-testid="ki-wahl-global"]');
  expect(wahl, "das globale Auswahlfeld fehlt").toBeTruthy();
  await act(async () => {
    (wahl as HTMLSelectElement).value = wert;
    (wahl as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
  });
  // Der Entwurf ist gestellt, wenn die KARTE ihn übernommen hat — und das sagt sie selbst: der
  // Hinweis „noch nicht übernommen" (`ki-ungespeichert`) hängt an ihrem eigenen Entwurfszustand
  // (`AdminKiDetails.tsx:1092`, `aiGlobal !== null`). RUNDE 2: der Feldwert allein trug diese
  // Aussage NICHT — wir haben ihn eine Zeile zuvor selbst hineingeschrieben, die Bedingung wäre
  // also auch dann erfüllt, wenn die Karte den Wechsel nie bemerkt hätte.
  await warteBis(
    und(
      bedingung(
        `das globale Auswahlfeld steht auf „${wert}"`,
        () => wahlWert(c) === wert,
        () => `Auswahlfeld=„${wahlWert(c)}"`,
      ),
      karteZeigt(c, "ki-ungespeichert"),
    ),
  );
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
