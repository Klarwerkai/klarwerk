// @vitest-environment jsdom
// ================================================================================================
// JOB 3783 · DER DURCHSTICH DER KI-FREIGABE — MIT ZURÜCKGEHALTENEM NACHLADEN.
// ================================================================================================
//
// DAS URTEIL, DAS DIESE DATEI BEANTWORTET (Prüfer an JOB 3501, Runde 3, wörtlich):
//
//   „TESTAUSSAGEKRAFT: ROT. Echte Dienste und Auditprüfungen sind eine wesentliche Verbesserung.
//    `durchstich-protokoll.test.tsx:232` prüft die Schaltfolge aber MIT SOFORT BEANTWORTETEN GETs.
//    Meine kontrollierte Verzögerung macht denselben Ablauf rot."
//
//   „Halte nach erfolgreichem PUT das folgende GET GEZIELT ZURÜCK. Versuche währenddessen die
//    nächste Freigabe beziehungsweise Rücknahme. Prüfe über einen UNABHÄNGIGEN GET und das ECHTE
//    AUDIT, dass kein bereits bestätigter Stand überschrieben wird."
//
// GENAU DAS läuft hier, und zwar in DIESER Kette — nichts davon ist eingespeist:
//
//   echte App (`buildApp`, echte Dienste, echtes Protokoll `services.audit`)
//     → echte Anmeldung (Bootstrap-Admin, `users.manage`) über die echte Route
//     → die ECHTE Karte (`KiDetail`), gemountet, ein echter Klick auf ein echtes Kästchen
//     → der ECHTE Client (`api.put` → `fetch`) ruft PUT /api/reasoner/config
//     → die ECHTE Route prüft Recht, protokolliert, schreibt, antwortet mit frischem configStatus
//     → die Karte rendert, was sie bekam.
//
// ERSETZT IST NUR DIE BROWSERSCHALE UM `fetch` (Basisadresse und Sitzung: `fetch → app.inject`) —
// und in dieser Schale sitzt das TOR: jedes GET auf /api/reasoner/config kann gezielt
// zurückgehalten oder mit 503 beantwortet werden. Keine Antwort wird eingespeist, kein Endpunkt
// gemockt, kein Dienst überschrieben.
//
// WAS AUF DEM STAND VOR DIESEM JOB PASSIERT: die Karte kennt die Freigabe gar nicht (`kiFreigabe`
// kommt in `apps/web/src` null mal vor) — F1 findet kein Kästchen und ist rot. Mit der Fläche, aber
// ohne die bestätigte Basis (3501: Basis aus der Abfrage) sind V1/V2/V3 rot: der zweite PUT trüge
// dann `oeffentlicheKi:false`, weil das zurückgehaltene GET den älteren Stand stehen lässt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

/** Der Rumpf, den die Karte schickt — so, wie die Route ihn liest (`reasoner-routes.ts:744-751`). */
interface PutRumpf {
  global?: string;
  perTask?: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

interface Freigabestand {
  oeffentlicheKi?: boolean;
  vertraulicheInhalte?: boolean;
}

// ---- Die Transportbrücke mit Tor ---------------------------------------------------------------
const bruecke = {
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
  /** Die Rümpfe aller PUTs auf /api/reasoner/config, in Reihenfolge. */
  putRuempfe: [] as PutRumpf[],
  // RUNDE 2 (BENs Promptverbesserung, wörtlich): „Halte neben GET-Antworten auch BEREITS ERZEUGTE
  // PUT-Antworten gezielt zurück und prüfe überlappende Bedienfolgen eines einzelnen
  // Administrators." Genau dafür sind die nächsten beiden Felder da — und „bereits erzeugt" ist
  // wörtlich zu nehmen: das Tor sitzt NACH `app.inject`, der Server hat also geschrieben und
  // protokolliert, nur die Antwort steht noch aus.
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
    if (istKonfig && methode === "GET") {
      if (bruecke.gestoertesGet) {
        bruecke.beantworteteGets += 1;
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => JSON.stringify({ error: "TOR", message: "Nachladen im Test gestört." }),
        };
      }
    }
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    if (istKonfig && methode === "GET" && bruecke.haltGet) {
      // GENAU HIER sitzt die kontrollierte Verzögerung des Prüfers — und sie sitzt NACH dem
      // Server, nicht davor: der Server hat geantwortet, die Antwort ist unterwegs und kommt erst,
      // wenn der Test sie freigibt. Das ist der Unterschied, der V5 überhaupt messbar macht: eine
      // vor dem Schreiben abgeschickte Antwort trägt den Stand von VOR dem Schreiben. Hielte das
      // Tor schon die ANFRAGE zurück, läse sie den Bestand erst bei der Freigabe und wäre nie alt.
      await new Promise<void>((frei) => bruecke.wartende.push(frei));
    }
    if (istKonfig && methode === "PUT" && bruecke.haltPut) {
      // Dasselbe Tor, andere Methode: der Server hat den Schreibvorgang ABGESCHLOSSEN (Bestand
      // geändert, Auditzeile geschrieben), seine Antwort hängt fest. Genau so entsteht BENs Lage —
      // eine Antwort, die den Stand von JETZT trägt und erst später bei der Karte ankommt.
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
function oeffneTor(): void {
  for (const frei of bruecke.wartende.splice(0)) {
    frei();
  }
}

/** Nur den ÄLTESTEN festgehaltenen GET freigeben — für V5, wo die Reihenfolge die Aussage ist. */
function oeffneAeltesten(): void {
  bruecke.wartende.shift()?.();
}

/** Alle festgehaltenen PUT-ANTWORTEN freigeben. */
function oeffnePut(): void {
  for (const frei of bruecke.wartendePut.splice(0)) {
    frei();
  }
}

// ---- Der echte Server --------------------------------------------------------------------------
async function serverStarten(envGlobal?: string): Promise<AppServices> {
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
  bruecke.haltPut = false;
  bruecke.wartendePut = [];
  bruecke.gestoertesPut = false;
  brueckeAufbauen();
  // Der erste Registrierte ist der Bootstrap-Admin (`users.manage`).
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3783.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3783.test", password: "geheim12345" },
  });
  bruecke.token = (login.json() as { token: string }).token;
  return services;
}

/** Der UNABHÄNGIGE Blick auf den Server — am Tor und an der Karte vorbei. */
async function serverFreigabe(): Promise<Freigabestand | undefined> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/reasoner/config",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  expect(res.statusCode, "unabhängiges GET scheiterte").toBe(200);
  return (res.json() as { taskConfig: { kiFreigabe?: Freigabestand } }).taskConfig.kiFreigabe;
}

/** Die ECHTEN Protokollzeilen der Freigabe — über die echte Route, nicht am Dienst vorbei. */
async function protokoll(): Promise<
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

/** Das `nachher` einer Protokollzeile als Paar — dieselbe Lesart wie Server und Karte. */
function nachher(zeile: { payload: Record<string, unknown> }): [boolean, boolean] {
  const n = (zeile.payload.nachher ?? {}) as Freigabestand;
  return [n.oeffentlicheKi === true, n.vertraulicheInhalte === true];
}

// ---- Die echte Karte ---------------------------------------------------------------------------
const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Der Vorrat der gemounteten Karte — V5 stößt darüber einen Abruf an, wie es der Browser täte. */
let vorrat: QueryClient | null = null;

async function karteMounten(): Promise<HTMLDivElement> {
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
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

function kaestchen(c: HTMLDivElement, id: string): HTMLInputElement {
  const el = c.querySelector<HTMLInputElement>(`[data-testid="${id}"]`);
  expect(el, `Schalter ${id} nicht gefunden`).toBeTruthy();
  return el as HTMLInputElement;
}

const sichtbar = (c: HTMLDivElement, id: string): boolean =>
  c.querySelector(`[data-testid="${id}"]`) !== null;

const text = (c: HTMLDivElement, id: string): string =>
  c.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

/**
 * Ein echter Klick — über `HTMLElement.click()` und NICHT über ein von Hand versandtes
 * `MouseEvent`. Der Unterschied ist der Prüfpunkt von S1 und S2: `click()` hält sich an `disabled`
 * (wie jeder Browser), ein von Hand versandtes Ereignis nicht. Ein gesperrter Schalter, der nur
 * deshalb nichts schreibt, weil niemand ihn drücken kann, wäre sonst ungemessen.
 */
async function klick(el: Element | null | undefined, was: string): Promise<void> {
  expect(el, `${was} nicht gefunden`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** Ein Kästchen umlegen — wie im Browser: Klick auf das Kästchen. */
async function umlegen(c: HTMLDivElement, id: string): Promise<void> {
  await klick(kaestchen(c, id), `Schalter ${id}`);
}

/** Das globale Auswahlfeld stellen — die ZUORDNUNG, der zweite Schreiber auf derselben Konfig. */
async function zuordnungWaehlen(c: HTMLDivElement, wert: string): Promise<void> {
  const wahl = c.querySelector<HTMLSelectElement>('[data-testid="ki-wahl-global"]');
  expect(wahl, "das globale Auswahlfeld fehlt").toBeTruthy();
  await act(async () => {
    (wahl as HTMLSelectElement).value = wert;
    (wahl as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
    await durchlaufen();
  });
}

/** Der Knopf „Übernehmen" der Zuordnung. */
function speichernKnopf(c: HTMLDivElement): HTMLButtonElement {
  const knopf = [...c.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t("adm.ai.save")),
  );
  expect(knopf, "der Knopf zum Übernehmen der Zuordnung fehlt").toBeTruthy();
  return knopf as HTMLButtonElement;
}

/** Den zweiten Schalter EINSCHALTEN: umlegen, Warnung lesen, ausdrücklich bestätigen. */
async function vertraulichEinschalten(c: HTMLDivElement): Promise<void> {
  await umlegen(c, "ki-freigabe-vertraulich");
  expect(sichtbar(c, "ki-freigabe-vertraulich-frage"), "der zweite Schalter fragt nicht nach").toBe(
    true,
  );
  await klick(
    c.querySelector('[data-testid="ki-freigabe-vertraulich-ja"]'),
    "Bestätigung des zweiten Schalters",
  );
}

beforeEach(() => {
  bruecke.wartende = [];
  bruecke.wartendePut = [];
});

afterEach(() => {
  oeffneTor();
  oeffnePut();
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("JOB 3783 · F — die Freigabe ist überhaupt bedienbar", () => {
  it("F1 · der Admin erteilt die Freigabe an der Karte; unabhängiges GET und echtes Audit tragen sie", async () => {
    await serverStarten();
    const c = await karteMounten();

    // Ausgangslage: nichts freigegeben — und die Karte behauptet auch nichts anderes.
    expect(await serverFreigabe(), "Vorher steht schon eine Freigabe").toBeUndefined();
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(false);
    expect(text(c, "ki-freigabe-stand")).toContain(i18n.t("adm.ai.freigabe.aus"));

    await umlegen(c, "ki-freigabe-oeffentlich");

    // (a) Sie GILT — am unabhängigen GET gemessen, nicht an der Karte.
    expect(await serverFreigabe()).toMatchObject({ oeffentlicheKi: true });
    // (b) Und sie steht im ECHTEN Protokoll, mit Administrator und Umfang.
    const zeilen = await protokoll();
    expect(zeilen.length, "keine Protokollzeile zur Freigabe").toBe(1);
    expect(zeilen[0]?.action).toBe("reasoner.ki-freigabe");
    expect(zeilen[0]?.actor.length).toBeGreaterThan(0);
    expect(nachher(zeilen[0] as { payload: Record<string, unknown> })).toEqual([true, false]);
    // (c) Die Karte sagt, was gilt.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
    expect(text(c, "ki-freigabe-stand")).toContain(i18n.t("adm.ai.freigabe.an"));
  }, 60_000);

  it("F2 · der zweite Schalter warnt und verlangt eine ausdrückliche Bestätigung — Abbrechen schickt nichts", async () => {
    await serverStarten();
    const c = await karteMounten();
    await umlegen(c, "ki-freigabe-oeffentlich");
    const nachErstfreigabe = bruecke.putRuempfe.length;

    await umlegen(c, "ki-freigabe-vertraulich");
    expect(sichtbar(c, "ki-freigabe-vertraulich-frage")).toBe(true);
    expect(text(c, "ki-freigabe-vertraulich-frage")).toContain(
      i18n.t("adm.ai.freigabe.vertraulichWarnung"),
    );
    // Noch ist NICHTS gesendet — das Umlegen allein ist keine Freigabe.
    expect(bruecke.putRuempfe.length).toBe(nachErstfreigabe);
    expect((await serverFreigabe())?.vertraulicheInhalte === true).toBe(false);

    await klick(
      c.querySelector('[data-testid="ki-freigabe-vertraulich-nein"]'),
      "Abbrechen der Bestätigung",
    );
    expect(sichtbar(c, "ki-freigabe-vertraulich-frage")).toBe(false);
    expect(bruecke.putRuempfe.length, "Abbrechen hat doch geschrieben").toBe(nachErstfreigabe);
    expect(kaestchen(c, "ki-freigabe-vertraulich").checked).toBe(false);
  }, 60_000);
});

describe("JOB 3783 · V — verzögertes Nachladen: kein bestätigter Stand wird überschrieben", () => {
  it("V1 · Reihenfolge öffentlich → vertraulich, mit zurückgehaltenem GET zwischen beiden Schaltungen", async () => {
    await serverStarten();
    const c = await karteMounten();
    const getsVorher = bruecke.beantworteteGets;

    // AB HIER antwortet kein GET mehr auf /api/reasoner/config.
    bruecke.haltGet = true;
    await umlegen(c, "ki-freigabe-oeffentlich");

    // KALIBRIERUNG: das Nachladen HÄNGT wirklich — sonst misst dieser Fall nichts.
    expect(
      bruecke.beantworteteGets,
      "das Nachladen wurde beantwortet — die Verzögerung greift nicht",
    ).toBe(getsVorher);
    expect(bruecke.wartende.length, "kein GET hängt am Tor").toBeGreaterThan(0);
    expect(sichtbar(c, "ki-freigabe-nachladen"), "die Karte sagt das Nachladen nicht an").toBe(
      true,
    );
    // Die bestätigte Erstfreigabe steht — nicht der Nachhall der Abfrage.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);

    // DIE ZWEITE SCHALTUNG IM OFFENEN FENSTER.
    await vertraulichEinschalten(c);

    // Der Rumpf des zweiten PUT trägt den BESTÄTIGTEN Stand, nicht den veralteten.
    expect(bruecke.putRuempfe.length).toBe(2);
    expect(bruecke.putRuempfe[1]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    // Unabhängiges GET: beides gilt.
    expect(await serverFreigabe()).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });
    // Echtes Audit: keine Zeile nimmt die bestätigte Grundfreigabe wieder zurück.
    const zeilen = await protokoll();
    expect(zeilen.map(nachher)).toEqual([
      [true, false],
      [true, true],
    ]);
  }, 60_000);

  it("V2 · dieselbe Lage in der ANDEREN Reihenfolge: vertraulich → öffentlich", async () => {
    await serverStarten();
    const c = await karteMounten();

    bruecke.haltGet = true;
    // Der zweite Schalter zuerst: erlaubt (er ist ohne den ersten wirkungslos, nicht verboten) —
    // und genau deshalb ist diese Reihenfolge überhaupt messbar.
    await vertraulichEinschalten(c);
    expect(bruecke.wartende.length, "kein GET hängt am Tor").toBeGreaterThan(0);
    expect(kaestchen(c, "ki-freigabe-vertraulich").checked).toBe(true);
    expect(
      sichtbar(c, "ki-freigabe-wirkungslos"),
      "die Karte behauptet Wirkung ohne Grundfreigabe",
    ).toBe(true);

    await umlegen(c, "ki-freigabe-oeffentlich");

    expect(bruecke.putRuempfe.length).toBe(2);
    expect(bruecke.putRuempfe[1]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    expect(await serverFreigabe()).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });
    const zeilen = await protokoll();
    expect(zeilen.map(nachher)).toEqual([
      [false, true],
      [true, true],
    ]);
  }, 60_000);

  it("V3 · RÜCKNAHME im selben Fenster: der zurückgenommene Schalter kommt nicht wieder", async () => {
    await serverStarten();
    const c = await karteMounten();
    // Ausgangslage über die Karte herstellen, mit offenem Tor.
    await umlegen(c, "ki-freigabe-oeffentlich");
    await vertraulichEinschalten(c);
    expect(await serverFreigabe()).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });

    bruecke.haltGet = true;
    // Erste Rücknahme: das Vertrauliche.
    await umlegen(c, "ki-freigabe-vertraulich");
    expect(bruecke.wartende.length, "kein GET hängt am Tor").toBeGreaterThan(0);
    expect(kaestchen(c, "ki-freigabe-vertraulich").checked).toBe(false);
    // Zweite Rücknahme im offenen Fenster: die Grundfreigabe.
    await umlegen(c, "ki-freigabe-oeffentlich");

    // Der zweite Rumpf darf `vertraulicheInhalte` NICHT wieder auf true setzen.
    expect(bruecke.putRuempfe[3]?.kiFreigabe).toEqual({
      oeffentlicheKi: false,
      vertraulicheInhalte: false,
    });
    const stand = await serverFreigabe();
    expect(stand?.oeffentlicheKi === true, "die Grundfreigabe gilt noch").toBe(false);
    expect(stand?.vertraulicheInhalte === true, "das Vertrauliche ist wieder freigegeben").toBe(
      false,
    );
    const zeilen = await protokoll();
    expect(zeilen.map(nachher)).toEqual([
      [true, false],
      [true, true],
      [true, false],
      [false, false],
    ]);
  }, 60_000);

  it("V5 · ein VOR dem PUT begonnener Abruf überholt die Bestätigung nicht", async () => {
    // DER ANDERE HALBE FALL, und der unauffälligere: nicht das Nachladen DANACH ist spät, sondern
    // ein Abruf, der schon VORHER lief, kommt erst NACHHER an. Er trägt den Stand von vor dem PUT.
    // Landete er ungebremst im Vorrat, wäre die Bestätigung überholt — vom eigenen Cache. Das
    // verhindert das `invalidateQueries` unmittelbar nach der Bestätigung: es bricht den laufenden
    // Abruf ab und startet ihn neu. GEGENPROBE (JOB 3783): mit `{ cancelRefetch: false }` als
    // ZWEITEM Argument fällt genau dieser Fall auf „Öffentliche KI: gesperrt" zurück.
    await serverStarten();
    const c = await karteMounten();

    // Ein Abruf, wie ihn der Browser von sich aus anstößt (Fensterfokus, Wiedersehen) — und er
    // hängt: sein Stand ist der von VOR der gleich folgenden Freigabe.
    bruecke.haltGet = true;
    await act(async () => {
      void (vorrat as QueryClient).refetchQueries({ queryKey: ["reasonerConfig"] });
      await durchlaufen();
    });
    expect(bruecke.wartende.length, "der vorgezogene Abruf hängt gar nicht").toBe(1);

    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);

    // Jetzt kommt GENAU DIESER alte Abruf an — und sonst keiner.
    await act(async () => {
      oeffneAeltesten();
      await durchlaufen();
    });
    await act(durchlaufen);

    expect(
      kaestchen(c, "ki-freigabe-oeffentlich").checked,
      "ein vor dem PUT begonnener Abruf hat die Bestätigung überschrieben",
    ).toBe(true);
    expect(await serverFreigabe()).toMatchObject({ oeffentlicheKi: true });
  }, 60_000);

  it("V4 · nach dem Öffnen des Tores holt die Abfrage auf: der Nachladehinweis verschwindet", async () => {
    await serverStarten();
    const c = await karteMounten();
    bruecke.haltGet = true;
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(sichtbar(c, "ki-freigabe-nachladen")).toBe(true);

    bruecke.haltGet = false;
    await act(async () => {
      oeffneTor();
      await durchlaufen();
    });
    await act(durchlaufen);

    expect(sichtbar(c, "ki-freigabe-nachladen"), "der Hinweis bleibt stehen").toBe(false);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
  }, 60_000);
});

describe("JOB 3783 · S — was die Karte NICHT tut, wenn sie den Stand nicht kennt", () => {
  it("S1 · gescheitertes Nachladen: die Karte sagt es und sperrt weitere Änderungen", async () => {
    await serverStarten();
    const c = await karteMounten();
    bruecke.gestoertesGet = true;
    await umlegen(c, "ki-freigabe-oeffentlich");
    const putsNachErstfreigabe = bruecke.putRuempfe.length;

    expect(
      sichtbar(c, "ki-freigabe-nachladen-fehler"),
      "die Karte verschweigt das gescheiterte Nachladen",
    ).toBe(true);
    expect(text(c, "ki-freigabe-nachladen-fehler")).toContain(
      i18n.t("adm.ai.freigabe.nachladenFehler"),
    );
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled).toBe(true);
    expect(kaestchen(c, "ki-freigabe-vertraulich").disabled).toBe(true);
    // Und die Sperre ist echt: ein Klick schreibt nichts.
    await umlegen(c, "ki-freigabe-vertraulich");
    expect(bruecke.putRuempfe.length, "trotz Sperre geschrieben").toBe(putsNachErstfreigabe);

    // Erholt sich die Quelle, ist die Karte wieder bedienbar — mit dem Stand des Servers.
    bruecke.gestoertesGet = false;
    await klick(c.querySelector('[data-testid="ki-freigabe-erneut"]'), "Erneut laden");
    expect(sichtbar(c, "ki-freigabe-nachladen-fehler")).toBe(false);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled).toBe(false);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
  }, 60_000);

  it("S2 · per Deploy-Variable festgelegt: ehrlich als gesperrt gezeigt, kein Knopf, der nicht wirkt", async () => {
    await serverStarten("deterministic");
    const c = await karteMounten();

    expect(sichtbar(c, "ki-env-gesperrt"), "die ENV-Sperre wird verschwiegen").toBe(true);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled).toBe(true);
    expect(kaestchen(c, "ki-freigabe-vertraulich").disabled).toBe(true);
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(bruecke.putRuempfe.length, "trotz ENV-Sperre geschrieben").toBe(0);
    expect(await serverFreigabe(), "die Freigabe hat sich doch geändert").toBeUndefined();
  }, 60_000);

  it("S3 · das Speichern der ZUORDNUNG lässt die Freigabe unverändert (Vertrag §3, JOB 3549)", async () => {
    await serverStarten();
    const c = await karteMounten();
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(await serverFreigabe()).toMatchObject({ oeffentlicheKi: true });

    await zuordnungWaehlen(c, "deterministic");
    await klick(speichernKnopf(c), "Zuordnung übernehmen");

    const letzter = bruecke.putRuempfe[bruecke.putRuempfe.length - 1];
    expect(letzter?.global, "die Zuordnung kam nicht an").toBe("deterministic");
    expect(letzter?.kiFreigabe, "das Speichern der Zuordnung nennt die Freigabe").toBeUndefined();
    expect(await serverFreigabe(), "die Freigabe ging beim Speichern verloren").toMatchObject({
      oeffentlicheKi: true,
    });
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
  }, 60_000);
});

// ================================================================================================
// Z — ZWEI SCHREIBER, EINE KONFIGURATION (Runde 2, BENs Korrekturpflichten)
// ================================================================================================
//
// Was die V-Fälle messen, ist EIN Schreiber gegen ein spätes GET. BEN hat den zweiten Schreiber
// gefunden: das Speichern der ZUORDNUNG schreibt dieselbe Konfiguration, und seine verspätete
// Antwort trug in Runde 1 die Freigabe von vorher zurück in die Basis. Sein Urteil, wörtlich:
//
//   „Eine verspätete Zuordnungs-PUT-Antwort kann eine bestätigte Freigabe überschreiben; die
//    nächste Schaltung löscht sie tatsächlich." · Audit der Gegenprobe: `[[true,false],[false,true]]`.
//
// Gemessen wird hier deshalb mit ZWEI Toren gleichzeitig — eines vor den GETs, eines vor den bereits
// erzeugten PUT-Antworten — und immer gegen den unabhängigen GET und das echte Audit.
describe("JOB 3783 · Z — Zuordnung und Freigabe schreiben dieselbe Konfiguration", () => {
  /**
   * BENs Lage, bis zu dem Punkt, an dem sie sich entscheidet — und danach ist sie für alle drei
   * Bedienfolgen dieselbe:
   *
   *   1  Zuordnung speichern; der Server schreibt, seine fertige Antwort hängt am Tor.
   *   2  DER VERSUCH, der Runde 1 zerlegt hat: schalten, während diese Antwort unterwegs ist.
   *      Er muss ins Leere gehen — der geltende Stand ist bis zur Antwort offen.
   *   3  Die Antwort kommt an, das NACHLADEN hängt ab jetzt. Die Karte arbeitet also allein auf der
   *      bestätigten Antwort weiter — genau die Lage, in der 3501 und Runde 1 den Stand verloren.
   *
   * Danach ist die Karte wieder bedienbar, und der jeweilige Test schaltet.
   */
  async function haengendeZuordnungsantwort(c: HTMLDivElement): Promise<void> {
    await zuordnungWaehlen(c, "deterministic");
    const vorher = bruecke.putRuempfe.length;
    bruecke.haltPut = true;
    await klick(speichernKnopf(c), "Zuordnung übernehmen");

    // KALIBRIERUNG: der Server HAT geschrieben, nur die Antwort steht aus — sonst misst Z nichts.
    expect(bruecke.wartendePut.length, "keine PUT-Antwort hängt am Tor").toBe(1);
    expect(bruecke.putRuempfe.length).toBe(vorher + 1);
    expect(bruecke.putRuempfe[vorher]?.global).toBe("deterministic");

    expect(
      kaestchen(c, "ki-freigabe-oeffentlich").disabled,
      "der Freigabeschalter ist trotz laufendem Schreiben bedienbar",
    ).toBe(true);
    expect(kaestchen(c, "ki-freigabe-vertraulich").disabled).toBe(true);
    expect(speichernKnopf(c).disabled, "der Speichern-Knopf ist doppelt auslösbar").toBe(true);
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(bruecke.putRuempfe.length, "trotz laufendem Schreiben geschrieben").toBe(vorher + 1);

    bruecke.haltGet = true;
    bruecke.haltPut = false;
    await act(async () => {
      oeffnePut();
      await durchlaufen();
    });
    await act(durchlaufen);
    expect(bruecke.wartende.length, "kein Nachladen hängt am Tor").toBeGreaterThan(0);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled, "die Karte bleibt gesperrt").toBe(
      false,
    );
  }

  it("Z1 · BENs Ablauf, Reihenfolge öffentlich → vertraulich: am Ende gilt beides", async () => {
    await serverStarten();
    const c = await karteMounten();
    await haengendeZuordnungsantwort(c);
    expect(await serverFreigabe(), "im gesperrten Fenster wurde doch geschaltet").toBeUndefined();

    await umlegen(c, "ki-freigabe-oeffentlich");
    // Der Rumpf beweist, dass die BESTÄTIGTE Zuordnung die Basis ist: die Abfrage hängt noch und
    // kennt weiterhin „auto" — „deterministic" kann nur aus der PUT-Antwort stammen.
    expect(bruecke.putRuempfe[1]?.global, "die Basis kam aus der veralteten Abfrage").toBe(
      "deterministic",
    );
    expect(bruecke.putRuempfe[1]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: false,
    });
    await vertraulichEinschalten(c);
    expect(bruecke.putRuempfe[2]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });

    // DER BEFUND, an dem Runde 1 scheiterte — unabhängiger GET und echtes Audit.
    expect(
      await serverFreigabe(),
      "BENs Ablauf verliert weiterhin eine bestätigte Freigabe",
    ).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });
    expect(
      (await protokoll()).map(nachher),
      "eine Zeile nimmt die bestätigte Grundfreigabe zurück",
    ).toEqual([
      [true, false],
      [true, true],
    ]);
  }, 60_000);

  it("Z1b · derselbe Ablauf in der ANDEREN Startrichtung: vertraulich → öffentlich", async () => {
    // BENs Korrekturpflicht 2, wörtlich: „beide Startrichtungen einschließlich Rücknahmen prüfen."
    await serverStarten();
    const c = await karteMounten();
    await haengendeZuordnungsantwort(c);

    await vertraulichEinschalten(c);
    expect(bruecke.putRuempfe[1]?.global, "die Basis kam aus der veralteten Abfrage").toBe(
      "deterministic",
    );
    expect(bruecke.putRuempfe[1]?.kiFreigabe).toEqual({
      oeffentlicheKi: false,
      vertraulicheInhalte: true,
    });
    expect(sichtbar(c, "ki-freigabe-wirkungslos"), "die Karte behauptet Wirkung ohne Grund").toBe(
      true,
    );

    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(bruecke.putRuempfe[2]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    expect(await serverFreigabe()).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });
    expect((await protokoll()).map(nachher)).toEqual([
      [false, true],
      [true, true],
    ]);
  }, 60_000);

  it("Z1c · derselbe Ablauf mit RÜCKNAHMEN: der zurückgenommene Schalter kommt nicht wieder", async () => {
    await serverStarten();
    const c = await karteMounten();
    // Ausgangslage über die echte Fläche, mit offenen Toren: beides gilt.
    await umlegen(c, "ki-freigabe-oeffentlich");
    await vertraulichEinschalten(c);
    expect(await serverFreigabe()).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });

    await haengendeZuordnungsantwort(c);
    // Die hängende Zuordnungsantwort trug beides — sie darf die Rücknahmen nicht wieder anheben.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
    expect(kaestchen(c, "ki-freigabe-vertraulich").checked).toBe(true);

    await umlegen(c, "ki-freigabe-vertraulich");
    expect(bruecke.putRuempfe[3]?.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: false,
    });
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(bruecke.putRuempfe[4]?.kiFreigabe).toEqual({
      oeffentlicheKi: false,
      vertraulicheInhalte: false,
    });

    const stand = await serverFreigabe();
    expect(stand?.oeffentlicheKi === true, "die Grundfreigabe gilt noch").toBe(false);
    expect(stand?.vertraulicheInhalte === true, "das Vertrauliche ist wieder freigegeben").toBe(
      false,
    );
    expect((await protokoll()).map(nachher)).toEqual([
      [true, false],
      [true, true],
      [true, false],
      [false, false],
    ]);
  }, 60_000);

  it("Z2 · dieselbe Lage andersherum: während eine Freigabeantwort hängt, speichert die Zuordnung nicht", async () => {
    await serverStarten();
    const c = await karteMounten();
    // Ein Entwurf der Zuordnung steht BEREIT — sonst wäre der Knopf ohnehin aus und die Sperre
    // ungemessen.
    await zuordnungWaehlen(c, "deterministic");
    expect(speichernKnopf(c).disabled, "der Knopf ist mit Entwurf immer noch aus").toBe(false);

    bruecke.haltPut = true;
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(bruecke.wartendePut.length, "keine PUT-Antwort hängt am Tor").toBe(1);

    expect(speichernKnopf(c).disabled, "die Zuordnung schreibt während der Freigabe").toBe(true);
    await klick(speichernKnopf(c), "Zuordnung übernehmen");
    expect(bruecke.putRuempfe.length, "trotz laufender Freigabe geschrieben").toBe(1);

    // Antwort ankommen lassen, Nachladen weiterhin zurückhalten.
    bruecke.haltGet = true;
    bruecke.haltPut = false;
    await act(async () => {
      oeffnePut();
      await durchlaufen();
    });
    await act(durchlaufen);
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);

    // Jetzt speichert die Zuordnung — und rührt die bestätigte Freigabe nicht an.
    await klick(speichernKnopf(c), "Zuordnung übernehmen");
    expect(bruecke.putRuempfe[1]?.global).toBe("deterministic");
    expect(bruecke.putRuempfe[1]?.kiFreigabe, "das Speichern nennt die Freigabe").toBeUndefined();
    expect(await serverFreigabe(), "die Freigabe ging beim Speichern verloren").toMatchObject({
      oeffentlicheKi: true,
    });
    expect(kaestchen(c, "ki-freigabe-oeffentlich").checked).toBe(true);
    expect((await protokoll()).map(nachher)).toEqual([[true, false]]);
  }, 60_000);

  it("Z3 · zwei Bedienungen in DASSELBE Bild: nur eine schreibt", async () => {
    // Die Sperre darf nicht erst im nächsten Bild gelten. Fallen beide Klicks in denselben Zug —
    // ein hastiger Doppelgriff — dann steht am zweiten Knopf noch kein `disabled`, und ohne die
    // synchron gezogene Schreibnummer gingen ZWEI PUTs gleichzeitig hinaus. Der Ausgang ist
    // derselbe, egal welcher der beiden Riegel greift: es darf nur EIN Schreiben geben.
    await serverStarten();
    const c = await karteMounten();
    await zuordnungWaehlen(c, "deterministic");
    bruecke.haltPut = true;

    await act(async () => {
      speichernKnopf(c).click();
      kaestchen(c, "ki-freigabe-oeffentlich").click();
      await durchlaufen();
    });
    await act(durchlaufen);

    expect(bruecke.putRuempfe.length, "zwei Schreiben sind gleichzeitig hinausgegangen").toBe(1);
    expect(bruecke.putRuempfe[0]?.global).toBe("deterministic");
    expect(bruecke.putRuempfe[0]?.kiFreigabe).toBeUndefined();

    bruecke.haltPut = false;
    await act(async () => {
      oeffnePut();
      await durchlaufen();
    });
    await act(durchlaufen);
    expect(await serverFreigabe(), "aus dem verworfenen Klick wurde doch eine Freigabe").toBe(
      undefined,
    );
    expect((await protokoll()).length, "es steht eine Protokollzeile zu viel da").toBe(0);
    // Und die Karte ist danach wieder bedienbar — die Sperre hängt nicht fest.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled).toBe(false);
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(await serverFreigabe()).toMatchObject({ oeffentlicheKi: true });
  }, 60_000);

  it("Z4 · ein gescheitertes Schreiben gibt den Kanal wieder frei", async () => {
    // Die Gegenprobe zur Sperre: bliebe der Kanal nach einem Fehler belegt, wäre die Karte für
    // immer tot — eine Sperre, die nie wieder aufgeht, ist kein Schutz, sondern ein Ausfall.
    await serverStarten();
    const c = await karteMounten();
    await zuordnungWaehlen(c, "deterministic");
    bruecke.gestoertesPut = true;
    await klick(speichernKnopf(c), "Zuordnung übernehmen");
    expect(bruecke.putRuempfe.length).toBe(1);
    expect(await serverFreigabe(), "das gestörte Schreiben kam doch an").toBeUndefined();
    bruecke.gestoertesPut = false;

    // Das Schreiben ist gescheitert; die Karte ist wieder bedienbar und schreibt die Freigabe.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled, "die Karte bleibt gesperrt").toBe(
      false,
    );
    await umlegen(c, "ki-freigabe-oeffentlich");
    expect(await serverFreigabe()).toMatchObject({ oeffentlicheKi: true });
  }, 60_000);
});
