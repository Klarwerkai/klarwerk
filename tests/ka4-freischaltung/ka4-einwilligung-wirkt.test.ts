// ================================================================================================
// JOB 3033 · KA4 — DER VERTRAG DER FREISCHALTUNG, AN DEN SCHALTER GEBUNDEN
// ================================================================================================
//
// WAS DIESE DATEI IST. Der Auftrag hieß „die Einwilligung, die Pedi gibt, wirkt auch wirklich" und
// nahm an: der externe Antwortweg sei fertig gebaut und warte nur auf eine benannte
// Ownerentscheidung. Runde 1 hat die Entscheidung umgelegt und dabei VIER Stellen freigelegt, an
// denen der Bestand etwas anderes tut oder sagt, als die Einwilligung verspricht. Die Annahme des
// Auftrags trägt also nicht — und eine Freischaltung, die dem Menschen einen falschen Empfänger,
// einen zu schmalen Umfang, keine Frist und einen widersprechenden Panelsatz liefert, ist keine.
//
// DIE KONSTANTE STEHT DESHALB WEITER AUF `false` (`services/reasoner/src/klara-policy.ts`, dort
// sind die vier Sperrgründe einzeln benannt). Diese Datei ist der Vertrag, unter dem sie umgelegt
// werden darf.
//
// WIE SIE GESCHRIEBEN IST, und das ist der Kern: JEDER Fall sagt BEIDE Zustände. Er misst, was bei
// `KLARA_EXTERNAL_EXECUTION_MIGRATED === false` gelten muss, UND was bei `true` gelten muss. Kein
// Fall ruht (`it.skip`), keiner steht rot. Die Wirkung: wer den Schalter umlegt, ohne die vier
// Sperrgründe zu beheben, bekommt genau von den Fällen S1 bis S4 ein Rot mit Namen — der Schalter
// ist damit keine Meinung mehr, sondern eine Bedingung.
//
// ECHT IST ALLES DAZWISCHEN: der `KlaraSessionService` aus dem Produkt (Sitzung, Dokumentkontext,
// `grantConsent`, `pruefeExterneAusfuehrung` mit allen zehn Bindungen), `resolveKlaraPolicy`, die
// Route und ihre Flagentscheidung. In S3 und F8 steht dahinter der echte `AskService` mit echtem
// Wissensbestand und einem mitschreibenden Modellanbieter an genau der Stelle, an der in Produktion
// die Cloud steht.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { ADDON_ACTOR_ID, ASK_CAPABILITY } from "../../services/app/src/addon-principal";
import { askRoutes } from "../../services/app/src/routes/ask-routes";
import {
  KLARA_SESSION_INACTIVITY_MS,
  KlaraSessionService,
} from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  InMemoryKlaraSessionRepo,
  KLARA_DETERMINISTIC_MODEL,
  KLARA_DETERMINISTIC_PROVIDER,
  KLARA_EXTERNAL_EXECUTION_MIGRATED,
  KLARA_RESOLUTION_TTL_MS,
  type KnowledgeRef,
  Reasoner,
  type ReasonerLocale,
  type ReasonerProvider,
  resolveKlaraPolicy,
} from "../../services/reasoner";

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";

/** Der Anbieter, der bei erteilter Einwilligung WIRKLICH rechnen würde. */
const CLOUD_ANBIETER = "anthropic";
const CLOUD_MODELL = "claude";

/** Die Lage eines Betriebs MIT verdrahteter Cloud — die Wunschseite der Admin-Wahl. */
const CLOUD_LAGE = {
  choice: "cloud" as const,
  source: "db" as const,
  effectiveAnswerProvider: "cloud" as const,
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: CLOUD_ANBIETER,
  modelLabel: CLOUD_MODELL,
};

/**
 * DIE ENGE — der Optionssatz des Session-Wegs OHNE wirksame Einwilligung (`ask-routes.ts:429-436`).
 *
 * `toEqual` und nicht `toMatchObject`: ein fünftes Feld muss auffallen. Die beiden Filter sind
 * Betrachterentscheidungen aus JOB 1591/2626; dass sie WIRKEN, prüft `ka4-endzustand.test.ts`
 * (KA4-E7). Hier zählt, dass die beiden Zwangsflags stehen.
 */
const ENGE = {
  validatedOnly: true,
  retrievalOnly: true,
  ungeprueftSichtbarFuer: expect.any(Function),
  verschlossenSichtbarFuer: expect.any(Function),
};

/** Die Enge des Add-on-Wegs — dort gibt es keinen Sitzungsnutzer und deshalb keine Filter. */
const ENGE_ADDON = { validatedOnly: true, gapPolicy: "count_only", retrievalOnly: true };

const PANEL = resolve(process.cwd(), "apps/web/public/word-addin/taskpane.html");

/**
 * Die Nutzlastklassen, die der Server für diese Lage AUSWEIST — aus dem Produkt, nicht abgeschrieben.
 *
 * `KLARA_PAYLOAD_CLASS_QUESTION` ist über die Modulfassade `services/reasoner/index.ts` nicht
 * exportiert, und einen Export dafür anzulegen wäre eine Produktänderung ausserhalb der Zielpfade.
 * Die Auflösung nennt ihre Klassen ohnehin selbst (BEN-35 Befund 1) — das ist dieselbe Quelle, aus
 * der `grantConsent` sie in die Zustimmung schreibt.
 */
const AUSGEWIESENE_KLASSEN = resolveKlaraPolicy({
  ...CLOUD_LAGE,
  externalConsentGranted: true,
  now: Date.parse("2026-09-03T09:00:00.000Z"),
  resolutionId: "res-klassen",
}).effectivePayloadClasses;

interface Aufbau {
  app: FastifyInstance;
  dienst: KlaraSessionService;
  repo: InMemoryKlaraSessionRepo;
  sitzung: string;
  bindung: Record<string, string>;
  /** Was die Route dem Ask-Dienst übergeben hat — der Messpunkt. */
  gesehen: (Record<string, unknown> | null)[];
  /** Die Uhr des Sitzungsdienstes — für den Fristfall S1. */
  vorstellen: (ms: number) => void;
}

interface AufbauOptionen {
  /** Add-on-Weg statt Sitzungsweg (`ask-routes.ts:359-379`). */
  addon?: boolean;
  /** Ohne Freigabeprüfer — der fail-closed-Fall aus `ask-routes.ts:175`. */
  ohnePruefer?: boolean;
}

async function aufbauen(opt: AufbauOptionen = {}): Promise<Aufbau> {
  const gesehen: (Record<string, unknown> | null)[] = [];
  let jetzt = Date.parse("2026-09-03T09:00:00.000Z");
  const repo = new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => CLOUD_LAGE,
    now: () => jetzt,
  });
  const akteur = opt.addon ? ADDON_ACTOR_ID : "nutzer-1";

  const ask = {
    ask: async (_q: string, _actor: string, _locale: string, opts?: Record<string, unknown>) => {
      gesehen.push(opts ?? null);
      return {
        result: {
          answered: false,
          knowledgeClass: "unbekannt",
          sources: [],
          citedSources: [],
          steps: [],
          answer: null,
          trust: 0,
        },
        gap: null,
      };
    },
  };

  const app = Fastify();
  if (opt.addon) {
    // Derselbe request-lokale Auth-Kontext, den der onRequest-Hook der echten App setzt
    // (`addon-principal.ts:112-116`) — der Add-on-Zweig der Route liest ihn, mehr braucht er nicht.
    app.decorateRequest("authContext", null);
    app.addHook("onRequest", async (request) => {
      request.authContext = {
        authKind: "addon",
        principal: { kind: "addon", id: ADDON_ACTOR_ID, capabilities: [ASK_CAPABILITY] },
      };
    });
  }
  app.register(
    askRoutes(
      {
        ask: ask as never,
        ko: { get: async () => undefined } as never,
        conflicts: { unresolved: async () => [] } as never,
        ...(opt.ohnePruefer ? {} : { klaraSessions: dienst as never }),
      },
      {
        requireUser: async () => ({ id: akteur, role: "admin" }),
        requirePermission: async () => ({ id: akteur, role: "admin" }),
      } as never,
    ),
  );
  await app.ready();

  const sicht = await dienst.createSession(akteur, "inst-1", {
    kind: "saved",
    hostDocumentId: "doc-abc",
  });
  return {
    app,
    dienst,
    repo,
    gesehen,
    sitzung: sicht.sessionId,
    vorstellen: (ms: number) => {
      jetzt += ms;
    },
    bindung: {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": "inst-1",
      "x-klara-document": sicht.documentContextId,
    },
  };
}

/** Die Einwilligung über den ECHTEN Dienst — kein Repo-Schreibzugriff von aussen. */
async function einwilligen(a: Aufbau, akteur = "nutzer-1"): Promise<string> {
  const sicht = await a.dienst.grantConsent(a.sitzung, {
    actorId: akteur,
    addinInstanceId: "inst-1",
    documentContextId: a.bindung["x-klara-document"] ?? "",
  });
  return sicht.consentState;
}

const fragen = (app: FastifyInstance, kopf: Record<string, string>, mode = "retrieval-only") =>
  app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { ...kopf, "content-type": "application/json" },
    payload:
      mode === "" ? { question: FRAGE, locale: "de" } : { question: FRAGE, locale: "de", mode },
  });

/**
 * Der Optionssatz, den der Session-Weg MIT deckender Einwilligung übergeben muss.
 *
 * Bei gesperrtem Schalter ist das die unveränderte Enge (die Einwilligung kann nicht tragen), bei
 * freigeschaltetem Schalter GAR KEINE Optionen — kein leeres Objekt (`ask-routes.ts:405`).
 */
const MIT_EINWILLIGUNG = KLARA_EXTERNAL_EXECUTION_MIGRATED ? null : ENGE;

describe("JOB 3033 · KA4 · die Einwilligung hebt die Enge — und nur sie", () => {
  it("KA4-F0 · DIE VORBEDINGUNG, protokolliert: welchen Zustand diese Datei misst", async () => {
    // Ohne diesen Fall wäre nicht sichtbar, welche Hälfte der Kopplungen gerade greift.
    expect(typeof KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe("boolean");
    const a = await aufbauen();
    expect((a.bindung["x-klara-session"] ?? "").length).toBeGreaterThan(0);
    expect((a.bindung["x-klara-document"] ?? "").length).toBeGreaterThan(0);
    // Die Einwilligung entsteht WIRKLICH — auch bei gesperrtem Schalter: `grantConsent` verlangt
    // den effektiven Modus `external`, und der liegt vor. Ohne diese Zeile wären alle folgenden
    // Fälle auch dann grün, wenn schon die Zustimmung scheiterte.
    expect(await einwilligen(a)).toBe("granted");
    const freigabe = await a.dienst.pruefeExterneAusfuehrung(a.sitzung, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: a.bindung["x-klara-document"] ?? "",
    });
    expect(freigabe.erlaubt).toBe(KLARA_EXTERNAL_EXECUTION_MIGRATED);
    const grund = freigabe.erlaubt ? "—" : `${"grund" in freigabe ? freigabe.grund : "unbenannt"}`;
    console.info(
      `JOB 3033 · KA4-F0 · KLARA_EXTERNAL_EXECUTION_MIGRATED = ${KLARA_EXTERNAL_EXECUTION_MIGRATED} → das Tor sagt bei deckender Einwilligung erlaubt=${freigabe.erlaubt} (Grund: ${grund})`,
    );
    await a.app.close();
  });

  it("KA4-F1 · OHNE Einwilligung: beide Zwangsflags stehen — in JEDEM Zustand des Schalters", async () => {
    const a = await aufbauen();
    const res = await fragen(a.app, a.bindung);
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-F2 · MIT Einwilligung: freigeschaltet fallen BEIDE Schlüssel, gesperrt bleibt die Enge", async () => {
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a.app, a.bindung);
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(MIT_EINWILLIGUNG);
    // Und ausdrücklich benannt, damit die Aussage auch dann trägt, wenn der Freigabezweig eines
    // Tages andere, unschädliche Optionen mitgäbe: DIESE beiden Schlüssel sind dann weg.
    const opts = (a.gesehen[0] ?? {}) as Record<string, unknown>;
    expect(Object.hasOwn(opts, "validatedOnly")).toBe(!KLARA_EXTERNAL_EXECUTION_MIGRATED);
    expect(Object.hasOwn(opts, "retrievalOnly")).toBe(!KLARA_EXTERNAL_EXECUTION_MIGRATED);
    await a.app.close();
  });

  it("KA4-F3 · GEGENFALL fremdes Dokument: die Enge bleibt, trotz erteilter Einwilligung", async () => {
    // NICHT VAKUOS: im selben Aufbau entscheidet F2 anders. Der Unterschied hängt wirklich an der
    // Dokumentbindung und nicht daran, dass ohnehin alles eng bliebe.
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a.app, { ...a.bindung, "x-klara-document": "doc-fremd" });
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-F5 · OHNE Freigabeprüfer: keine Freigabe, auch mit gültiger Einwilligung", async () => {
    // `ask-routes.ts:175` — fehlt der Dienst, kehrt `ka4Freigabe` um, bevor irgendetwas geprüft
    // wird. Die Einwilligung existiert hier wirklich; sie erreicht die Route nur nicht.
    const a = await aufbauen({ ohnePruefer: true });
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a.app, a.bindung);
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-F6 · DER ADD-ON-ZWEIG: dieselbe Weiche, ohne Sitzungsnutzer", async () => {
    // Er hat keinen `SessionUser` und bekommt deshalb die beiden Betrachterfilter NICHT — die
    // Asymmetrie ist die Zusicherung aus mega77, nicht der Fehler. `gapPolicy` bleibt in BEIDEN
    // Zweigen: die Wissenslücken-Nebenwirkung war nie Gegenstand der Einwilligung.
    const ohne = await aufbauen({ addon: true });
    await fragen(ohne.app, ohne.bindung);
    expect(ohne.gesehen[0]).toEqual(ENGE_ADDON);
    await ohne.app.close();

    const mit = await aufbauen({ addon: true });
    expect(await einwilligen(mit, ADDON_ACTOR_ID)).toBe("granted");
    await fragen(mit.app, mit.bindung);
    expect(mit.gesehen[0]).toEqual(
      KLARA_EXTERNAL_EXECUTION_MIGRATED ? { gapPolicy: "count_only" } : ENGE_ADDON,
    );
    await mit.app.close();
  });

  it("KA4-F7 · DER KONSOLEN-ASK ohne `mode` ist von KA4 gar nicht berührt", async () => {
    // Er kennt die Weiche nicht (`ask-routes.ts:443`) und darf sich durch eine Einwilligung nicht
    // verändern — weder gelockert noch verengt, in keinem Zustand des Schalters.
    const KONSOLE = { verschlossenSichtbarFuer: expect.any(Function) };
    const a = await aufbauen();
    await fragen(a.app, {}, "");
    expect(await einwilligen(a)).toBe("granted");
    await fragen(a.app, a.bindung, "");
    // Beide Läufe gegen DIESELBE Form: `toEqual` vergleicht Funktionen sonst über die Identität,
    // und zwei Aufrufe erzeugen zwangsläufig zwei Filterinstanzen.
    expect(a.gesehen[0]).toEqual(KONSOLE);
    expect(a.gesehen[1]).toEqual(KONSOLE);
    expect(Object.keys(a.gesehen[1] ?? {})).toEqual(Object.keys(a.gesehen[0] ?? {}));
    await a.app.close();
  });
});

// ================================================================================================
// DIE VIER SPERRGRÜNDE — jeder ein Riegel am Schalter, keiner eine Behauptung.
// ================================================================================================
//
// Sie sind die Antwort auf BENs Korrekturpflichten 1 bis 4 zu Runde 1. Behoben werden können sie
// in diesem Auftrag nicht: drei von ihnen liegen in `services/app/src/services/klara-session-
// service.ts` beziehungsweise `apps/web/public/word-addin/taskpane.html`, und beide Pfade stehen
// nicht in den abschliessenden ZIELPFADEN (`taskpane.html` ist in §10 sogar ausdrücklich
// ausgeschlossen). Was in diesem Auftrag möglich ist — und was hier steht —, ist die BINDUNG:
// jeder Sperrgrund ist so gemessen, dass er heute grün ist und in dem Augenblick rot wird, in dem
// jemand `KLARA_EXTERNAL_EXECUTION_MIGRATED` auf `true` legt, ohne ihn zu beheben.
describe("JOB 3033 · KA4 · die vier Sperrgründe der Freischaltung", () => {
  // ----------------------------------------------------------------------------------------------
  // S1 · DIE FRIST — gemessen, nicht geglaubt.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Auftrag verlangt die Einwilligung „innerhalb `KLARA_RESOLUTION_TTL_MS`" (§5 Lieferung 2,
  // §9). Der Bestand erzwingt das serverseitig NICHT: `pruefeExterneAusfuehrung` prüft die
  // Sitzungsfrist (`KLARA_SESSION_INACTIVITY_MS`, 15 min), nie die Auflösungsfrist (5 min).
  //
  // UND DIE FRIST IST KEINE ERFINDUNG DES AUFTRAGS: das Add-in behandelt sie als echte
  // Gültigkeitsgrenze — nach `resolution.expiresAt` gilt der Stand als VERALTET und wird neu geholt
  // (`taskpane.html:1876-1878` und `:3222-3232`). Anzeige und Ausführung laufen also genau um diese
  // Frist auseinander; das ist das No-Go aus KW-S4-04 §54-57.
  //
  // KORREKTUR IN RUNDE 1, benannt: Dort stand ein Fall, der das Weitergelten nach Fristablauf als
  // Ist-Stand GRÜN geschrieben hat. Das war ein Anti-Beleg. Hier steht die Forderung.
  it("KA4-S1 · nach `KLARA_RESOLUTION_TTL_MS` trägt die Einwilligung nicht mehr", async () => {
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");

    // Innerhalb der Frist gilt, was F2 misst — die Kalibrierung, ohne die der Fall auch dann grün
    // wäre, wenn die Einwilligung nie getragen hätte.
    a.vorstellen(KLARA_RESOLUTION_TTL_MS - 1_000);
    await fragen(a.app, a.bindung);
    expect(a.gesehen[0]).toEqual(MIT_EINWILLIGUNG);

    // Eine Millisekunde nach Ablauf der Auflösungsfrist MUSS die Enge stehen — unabhängig davon,
    // dass die Sitzung noch lebt. Heute ist das grün, weil ohnehin alles eng ist; nach einer
    // Freischaltung ohne durchgesetzte Frist wird genau diese Zeile rot.
    a.vorstellen(2_000);
    await fragen(a.app, a.bindung);
    expect(
      a.gesehen[1],
      "SPERRGRUND 1: die Auflösungsfrist wird serverseitig nicht erzwungen",
    ).toEqual(ENGE);

    // Und die Sitzungsfrist bleibt die äussere Grenze — sie war nie das Problem.
    a.vorstellen(KLARA_SESSION_INACTIVITY_MS + 1);
    await fragen(a.app, a.bindung);
    expect(a.gesehen[2]).toEqual(ENGE);
    await a.app.close();
  });

  // ----------------------------------------------------------------------------------------------
  // S2 · DER EMPFÄNGER — wem der Mensch zustimmt, und wer wirklich rechnet.
  // ----------------------------------------------------------------------------------------------
  //
  // `grantConsent` bildet die Zustimmung aus der Auflösung OHNE Zustimmung
  // (`klara-session-service.ts:797`). Die ist blockiert, und eine blockierte Auflösung meldet
  // absichtlich die deterministischen Ersatzwerte („angezeigt wird, was rechnet",
  // `klara-policy.ts:278-288`). In `providerReference`/`modelReference` steht deshalb
  // „Klarwerk (deterministisch)" — obwohl bei erteilter Zustimmung der Cloud-Anbieter ausführt.
  //
  // Solange der Weg gesperrt ist, ist das folgenlos: es rechnet ja wirklich niemand extern. Mit der
  // Freischaltung wird daraus eine Einwilligungsurkunde, die den Empfänger falsch benennt.
  it("KA4-S2 · die Zustimmung nennt den Anbieter, der auch ausführt", async () => {
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const consent = await a.repo.findConsent(a.sitzung);
    expect(consent?.status).toBe("granted");

    if (KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      // Die Forderung: Urkunde und Ausführung nennen denselben Empfänger.
      expect(
        consent?.providerReference,
        "SPERRGRUND 2: die Zustimmung nennt einen anderen Empfänger als den ausführenden",
      ).toBe(CLOUD_ANBIETER);
      expect(consent?.modelReference).toBe(CLOUD_MODELL);
    } else {
      // Der Ist-Stand, als Sperrgrund festgehalten — nicht als gewünschtes Verhalten.
      expect(consent?.providerReference).toBe(KLARA_DETERMINISTIC_PROVIDER);
      expect(consent?.modelReference).toBe(KLARA_DETERMINISTIC_MODEL);
      // Und die Gegenprobe, die zeigt, dass das WIRKLICH die falsche Angabe wäre: dieselbe Lage
      // liefert bei getragener Zustimmung den Cloud-Anbieter.
      const mitZustimmung = await a.dienst.statusFor(a.sitzung, {
        actorId: "nutzer-1",
        addinInstanceId: "inst-1",
        documentContextId: a.bindung["x-klara-document"] ?? "",
      });
      expect(mitZustimmung.externalConsentGranted).toBe(true);
    }
    await a.app.close();
  });

  // ----------------------------------------------------------------------------------------------
  // S4 · DIE FLÄCHE — was das Add-in dem Menschen über denselben Weg sagt.
  // ----------------------------------------------------------------------------------------------
  //
  // Alle vier Lagetexte des Aufgabenfensters behaupten, Klaras Antwort entstehe „immer ohne
  // KI-Modell" — auch der für den Fall, dass in KLARWERK bereits eine externe KI arbeitet
  // (`aiLageExtern`). Der einzige Antwortweg dieser Fläche sendet `mode: "retrieval-only"`, und
  // genau dieser Weg lockert sich mit der Einwilligung. Nach einer Freischaltung stünde der Satz
  // „immer ohne KI-Modell" also über einer Antwort, die ein Modell erzeugt hat — dieselbe Bauart
  // wie der Widerspruch, den AUFTRAG-mega81 schon einmal beseitigen musste.
  //
  // GELESEN, NICHT GEÄNDERT: `apps/web/public/word-addin/taskpane.html` steht nicht in den
  // ZIELPFADEN dieses Auftrags und ist in §10 ausdrücklich ausgeschlossen.
  it("KA4-S4 · der Panelvertrag und der Schalter widersprechen sich nicht", () => {
    const html = readFileSync(PANEL, "utf8");
    const behauptungen = html.match(/entsteht[^"]*?ohne KI-Modell/g) ?? [];
    if (KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      expect(
        behauptungen,
        "SPERRGRUND 4: das Panel behauptet weiter „ohne KI-Modell“, obwohl der Weg freigeschaltet ist",
      ).toEqual([]);
    } else {
      // Der Ist-Stand: der Satz ist da und ist heute WAHR — der Weg ist gesperrt.
      expect(behauptungen.length).toBeGreaterThan(0);
    }
  });
});

// ================================================================================================
// S3 UND F8 · WAS WIRKLICH HINAUSGINGE — am echten Ask-Dienst gemessen.
// ================================================================================================
//
// Hier steht kein Spion mehr am Messpunkt: echter `AskService`, echter `KoService`, echter
// `Reasoner`. Der mitschreibende Anbieter ist PRIMÄR in der Kette — an genau der Stelle, an der in
// Produktion die Cloud steht. Was hier ankommt, ist das, was ein Cloud-Modell zu sehen bekäme.
describe("JOB 3033 · KA4 · Umfang und Vertraulichkeit des Egress", () => {
  interface Echt {
    app: FastifyInstance;
    dienst: KlaraSessionService;
    repo: InMemoryKlaraSessionRepo;
    sitzung: string;
    bindung: Record<string, string>;
    gesehen: { kontext: readonly KnowledgeRef[] }[];
    geheim: string;
    offen: string;
  }

  async function echtAufbauen(): Promise<Echt> {
    const gesehen: { kontext: readonly KnowledgeRef[] }[] = [];
    const provider = {
      name: "mitschreiber",
      isAvailable: () => true,
      answer: async (
        _frage: string,
        kontext: readonly KnowledgeRef[],
        _locale?: ReasonerLocale,
      ): Promise<AnswerResult> => {
        gesehen.push({ kontext });
        return {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          citedSources: [],
          steps: [],
          demo: false,
        };
      },
    } as unknown as ReasonerProvider;

    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const geheim = await koService.create({
      title: "Zylinderkopfdichtung XQ42 Sonderverfahren",
      statement: "Die Zylinderkopfdichtung XQ42 folgt dem Sonderverfahren des Mandanten Mueller.",
      type: "best_practice",
      category: "Geheim",
      author: "anna",
      confidentiality: "vertraulich" as const,
    });
    const offen = await koService.create({
      title: "Zylinderkopfdichtung XQ42 Grundlagen",
      statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
      type: "best_practice",
      category: "Betrieb",
      author: "anna",
    });

    const ask = new AskService({
      reasoner: new Reasoner(provider),
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    const repo = new InMemoryKlaraSessionRepo();
    const dienst = new KlaraSessionService({ repo, policy: () => CLOUD_LAGE });

    const app = Fastify();
    app.register(
      askRoutes(
        {
          ask,
          ko: koService,
          conflicts: { unresolved: async () => [] } as never,
          klaraSessions: dienst as never,
        },
        {
          requireUser: async () => ({ id: "nutzer-1", role: "admin" }),
          requirePermission: async () => ({ id: "nutzer-1", role: "admin" }),
        } as never,
      ),
    );
    await app.ready();
    const sicht = await dienst.createSession("nutzer-1", "inst-1", {
      kind: "saved",
      hostDocumentId: "doc-abc",
    });
    await dienst.grantConsent(sicht.sessionId, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: sicht.documentContextId,
    });
    return {
      app,
      dienst,
      repo,
      gesehen,
      geheim: geheim.id,
      offen: offen.id,
      sitzung: sicht.sessionId,
      bindung: {
        "x-klara-session": sicht.sessionId,
        "x-klara-instance": "inst-1",
        "x-klara-document": sicht.documentContextId,
      },
    };
  }

  // ----------------------------------------------------------------------------------------------
  // S3 · DER UMFANG — was die Zustimmung ausweist und was tatsächlich hinausginge.
  // ----------------------------------------------------------------------------------------------
  //
  // Die Zustimmung bindet genau eine Nutzlastklasse, `question` (`klara-policy.ts`,
  // `KLARA_PAYLOAD_CLASS_QUESTION`). Der normale Antwortweg übergibt dem Modell aber nicht nur die
  // Frage, sondern die Kandidaten mit Titel, Aussage und Dokumenttext
  // (`services/ask/src/service.ts:549-566`). Eine Zustimmung, die nur „die Frage" ausweist, deckt
  // das nicht — und der Auftrag verbietet ausdrücklich, hier einfach eine Klasse zu erfinden
  // (§10: „keine neue Nutzlastklasse"). Also ist es ein Sperrgrund, kein Bauauftrag dieser Runde.
  it("KA4-S3 · was das Modell sieht, ist von den ausgewiesenen Nutzlastklassen gedeckt", async () => {
    const e = await echtAufbauen();
    const consent = await e.repo.findConsent(e.sitzung);
    // Die Zustimmung weist genau aus, was die Auflösung nennt — und das ist eine einzige Klasse.
    expect(consent?.allowedPayloadClasses).toEqual([...AUSGEWIESENE_KLASSEN]);
    expect(AUSGEWIESENE_KLASSEN).toHaveLength(1);

    await fragen(e.app, e.bindung);

    if (!KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      // Gesperrt: der Anbieter wird über diesen Weg gar nicht gerufen. Es geht nichts hinaus, und
      // die schmale Klassenangabe beschreibt korrekt „nichts".
      expect(e.gesehen.length).toBe(0);
      await e.app.close();
      return;
    }

    // Freigeschaltet: JETZT muss die Angabe decken, was wirklich reist. Der Kontext trägt Titel,
    // Aussage und Dokumenttext fremden Wissens — das ist mehr als „die Frage".
    const kontext = e.gesehen[0]?.kontext ?? [];
    const felder = new Set(kontext.flatMap((k) => Object.keys(k)));
    const nurFrage =
      felder.size === 0 ||
      [...felder].every((f) => f === "id" || f === "question" || f === "frage");
    expect(
      nurFrage,
      `SPERRGRUND 3: ausgewiesen ist nur \`${AUSGEWIESENE_KLASSEN.join(", ")}\`, hinaus gingen ${[...felder].join(", ")}`,
    ).toBe(true);
    await e.app.close();
  });

  it("KA4-F8a · der Anbieter wird über diesen Weg nur gerufen, wenn freigeschaltet ist", async () => {
    const e = await echtAufbauen();
    const res = await fragen(e.app, e.bindung);
    expect(res.statusCode).toBe(200);
    // Mit `retrievalOnly` ist ein Modellaufruf strukturell unmöglich; ohne die Flags findet er
    // statt. Das ist die Kalibrierung für F8b — ohne sie wäre „nichts Vertrauliches kam an" auch
    // dann grün, wenn überhaupt nichts ankam.
    expect(e.gesehen.length).toBe(KLARA_EXTERNAL_EXECUTION_MIGRATED ? 1 : 0);
    if (KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      expect(e.gesehen[0]?.kontext.map((k) => k.id)).toContain(e.offen);
    }
    await e.app.close();
  });

  it("KA4-F8b · das VERTRAULICHE Objekt erreicht den Modellkontext in KEINEM Zustand", async () => {
    const e = await echtAufbauen();
    await fragen(e.app, e.bindung);
    const kontext = e.gesehen[0]?.kontext ?? [];
    expect(kontext.map((k) => k.id)).not.toContain(e.geheim);
    // Nicht nur die Kennung: kein Titel, keine Aussage, kein Mandantenname.
    const roh = JSON.stringify(kontext);
    expect(roh).not.toContain("Sonderverfahren");
    expect(roh).not.toContain("Mueller");
    await e.app.close();
  });
});
