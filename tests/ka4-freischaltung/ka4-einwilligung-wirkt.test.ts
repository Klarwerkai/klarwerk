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
// DIE KONSTANTE BLIEB DESHALB IN JOB 3033 AUF `false`. Diese Datei ist der Vertrag, unter dem sie
// umgelegt werden darf. JOB 3079 (05.09.2026) hat die vier Sperrgründe behoben und sie auf `true`
// gelegt (`services/reasoner/src/klara-policy.ts`, dort steht je Sperrgrund, wo er behoben ist).
// Heute greift also jeweils die `true`-Hälfte der Fälle; die `false`-Hälfte bleibt für den Fall
// stehen, dass jemand den Schalter zurücklegt.
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
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { panelQuelleAus } from "../support/panelquelle";

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
  // NACHGEFÜHRT DURCH JOB 3767: die zentrale Adminfreigabe wird fail-closed gelesen
  // (`klara-policy.ts`, `zentralFreigegeben === true`) — ein weggelassenes Feld heisst gesperrt.
  // Diese Datei misst, dass die EINWILLIGUNG des Menschen wirkt (S1 bis S4). Ohne diese Zeile
  // stünde vor jedem Fall die Adminsperre, und „gesperrt" bewiese nichts mehr über die
  // Einwilligung. Die Adminfreigabe selbst misst `tests/admin-ki-klara/`.
  zentralFreigegeben: true,
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
    // D5 (KI aus): die Route prüft nach der Antwort erneut; bei eingeschalteter KI tut das nichts.
    kiStand: () => undefined,
    kiSperreVorFrage: () => undefined,
    kiSperreVorAuslieferung: () => undefined,
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
      // R-0639 Runde 3 (Bens Befund B1): das Fenster meldet eine getippte Frage als `manual`;
      // mit Klara-Bindung zählt „fehlt" als Dokumenttext.
      mode === ""
        ? { question: FRAGE, locale: "de", questionSource: "manual" }
        : { question: FRAGE, locale: "de", mode, questionSource: "manual" },
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

  it("KA4-F7 · DER KONSOLEN-ASK ohne `mode` und OHNE Bindung ist von KA4 gar nicht berührt", async () => {
    // Er kennt die Weiche nicht und darf sich durch eine Einwilligung nicht verändern.
    // R-0584 (Auftrag gesamt-datenschutz-voreinstellung): der Konsolenweg antwortet standardmäßig
    // nur aus geprüftem Wissen — und bleibt von der Einwilligung unberührt (beide Male derselbe Satz).
    const KONSOLE = {
      validatedOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      verschlossenSichtbarFuer: expect.any(Function),
    };
    const a = await aufbauen();
    await fragen(a.app, {}, "");
    expect(await einwilligen(a)).toBe("granted");
    await fragen(a.app, {}, "");
    expect(a.gesehen[0]).toEqual(KONSOLE);
    expect(a.gesehen[1]).toEqual(KONSOLE);
    await a.app.close();
  });

  it("KA4-F7b · eine GEBUNDENE Anfrage ohne `mode` nimmt dieselbe Weiche wie `retrieval-only`", async () => {
    // R-0639 Runde 3 (Bens Befund B2): bis hierher galt „ohne `mode` = Konsole, auch mit
    // Bindung". Damit lief eine gebundene Anfrage mit Dokumenttext an Einwilligung, Riegel und
    // Vertraulichkeit vorbei. Die Einwilligungs- und Dokumenttext-Prüfung hängt jetzt NICHT mehr
    // am optionalen Modusfeld: ohne Einwilligung die Enge, mit Einwilligung der freigegebene Weg.
    const a = await aufbauen();
    await fragen(a.app, a.bindung, "");
    expect(await einwilligen(a)).toBe("granted");
    await fragen(a.app, a.bindung, "");
    expect(a.gesehen[0]).toEqual(ENGE);
    expect(a.gesehen[1]).toEqual(MIT_EINWILLIGUNG);
    await a.app.close();
  });
});

// ================================================================================================
// DIE VIER SPERRGRÜNDE — jeder ein Riegel am Schalter, keiner eine Behauptung.
// ================================================================================================
//
// Sie sind die Antwort auf BENs Korrekturpflichten 1 bis 4 zu Runde 1. JOB 3033 konnte sie nicht
// beheben: drei von ihnen liegen in `services/app/src/services/klara-session-service.ts`
// beziehungsweise `apps/web/public/word-addin/taskpane.html`, und beide Pfade standen nicht in den
// damaligen ZIELPFADEN. Was dort möglich war — und was hier steht —, ist die BINDUNG: jeder
// Sperrgrund ist so gemessen, dass er rot wird, sobald `KLARA_EXTERNAL_EXECUTION_MIGRATED` auf
// `true` steht, ohne dass er behoben ist. JOB 3079 hat alle vier behoben und den Schalter
// umgelegt; seither messen S1 bis S4 die `true`-Hälfte.
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
    // dass die Sitzung noch lebt. Bei freigeschaltetem Weg trägt diese Zeile nur, weil
    // `pruefeConsentDeckung` die Frist durchsetzt (JOB 3079); ohne sie wird genau diese Zeile rot.
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
  // BEHOBEN IN JOB 3079: die fünf `aiLage*`-Texte sagen jetzt NUR NOCH, was im Haus arbeitet. Was
  // in diesem Fenster passiert, sagt ein zweiter Satz je Zustand (`klaraWegKey`, Schlüssel `weg*`),
  // gebildet aus derselben Auflösung, die auch ausführt.
  //
  // DER FALL IST DABEI SCHÄRFER GEWORDEN, und das ist nötig: die alte Fassung suchte die
  // Zeichenkette `entsteht … ohne KI-Modell`. Ein Umformulieren auf „Klaras Antwort ist immer
  // ohne KI-Modell" hätte ihn grün gelassen, ohne irgendetwas zu beheben — der Wächter hing am
  // VERB. Er hängt jetzt an der Eigenschaft: KEIN Lagetext des Hauses darf überhaupt eine Aussage
  // über den Weg dieses Fensters treffen, und der bedingte Satz muss für jeden Zustand in jeder
  // Sprache da sein.
  it("KA4-S4 · der Panelvertrag und der Schalter widersprechen sich nicht", () => {
    const html = panelQuelleAus(PANEL);
    // GEMESSEN WIRD AN DEN WÖRTERBUCHWERTEN, nicht am Quelltext: ein Kommentar, der den alten
    // Satz zitiert (und genau das tut die Begründung im Panel), ist keine Aussage an den Menschen.
    const texte = [...html.matchAll(/^\s*[A-Za-z0-9_]+:\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(texte.length, "kein einziger Wörterbuchwert gelesen").toBeGreaterThan(100);
    // Jede unbedingte Zusage über den Modellverzicht dieses Fensters, egal mit welchem Verb.
    const unbedingt = texte.filter((wert) =>
      /(immer|always|altijd|sowieso|in any case)[^.]{0,80}(ohne KI-Modell|without an AI model|zonder AI-model)/.test(
        wert,
      ),
    );
    // IN BEIDEN ZUSTÄNDEN: die sechs bedingten Sätze sind da, in drei Sprachen. Ohne diese
    // Gegenprobe wäre der Fall auch dann grün, wenn jemand die Zusage einfach GELÖSCHT hätte,
    // statt sie an ihre Bedingung zu binden — Schweigen ist hier kein besserer Zustand als eine
    // falsche Behauptung.
    for (const key of [
      "wegExternZustimmung",
      "wegExternOhneZustimmung",
      "wegExternZustimmungWeg",
      "wegIntern",
      "wegDeterministisch",
      "wegUnbekannt",
    ]) {
      expect(
        html.match(new RegExp(`\\b${key}:\\s*"`, "g"))?.length ?? 0,
        `${key} fehlt in mindestens einer der drei Sprachen`,
      ).toBe(3);
    }
    // Genau EIN Satz sagt, dass etwas hinausgeht — und er nennt den Anbieter.
    expect(html).toMatch(/wegExternZustimmung:\s*"[^"]*\{provider\}/);

    if (KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      expect(
        unbedingt,
        "SPERRGRUND 4: das Panel sagt weiter unbedingt „ohne KI-Modell“, obwohl der Weg freigeschaltet ist",
      ).toEqual([]);
    } else {
      // WIRD DER SCHALTER ZURÜCKGELEGT, kippt der Fall NICHT zurück auf „ein unbedingter Satz muss
      // her". Das wäre eine Forderung nach der schlechteren Fläche: bei gesperrtem Weg ist der
      // bedingte Satz genauso wahr wie der unbedingte, nur genauer. Was dann gelten MUSS, ist die
      // Umkehrung von oben — kein Zustand darf mehr sagen, dass Klaras Antwort hier mit einem
      // Modell entsteht, denn dann entsteht sie nie so. `klaraWegKey` liefert den einen Satz, der
      // das sagt, ausschliesslich bei `askAllowed === true`, und das kann bei gesperrtem Schalter
      // keine Auflösung mehr werden (`resolveKlaraPolicy`: `external_not_migrated`).
      expect(html).toMatch(/if\s*\(a\.askAllowed === true\)\s*\{\s*return "wegExternZustimmung"/);
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
    gesehen: { frage: string; kontext: readonly KnowledgeRef[] }[];
    geheim: string;
    offen: string;
  }

  async function echtAufbauen(): Promise<Echt> {
    const gesehen: { frage: string; kontext: readonly KnowledgeRef[] }[] = [];
    const provider = {
      name: "mitschreiber",
      isAvailable: () => true,
      answer: async (
        frage: string,
        kontext: readonly KnowledgeRef[],
        _locale?: ReasonerLocale,
      ): Promise<AnswerResult> => {
        // JOB 3079 · S3: die FRAGE wird mitgeschrieben, nicht nur der Kontext. Ohne sie könnte der
        // Fall die Klasse `question` nur glauben statt messen — und eine ausgewiesene Klasse ohne
        // gemessene Nutzlast wäre dieselbe Unehrlichkeit wie eine Nutzlast ohne Klasse.
        gesehen.push({ frage, kontext });
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

    const reasoner = new Reasoner(provider);
    // JOB 3588: NUR die GRUNDFREIGABE. KA4-S3 und KA4-F8a messen, dass der Anbieter über diesen Weg
    // WIRKLICH gerufen wird (`gesehen`/Aufrufzähler = 1) und dass das, was er sieht, von den
    // ausgewiesenen Nutzlastklassen gedeckt ist. Ohne die Adminfreigabe des Kerns von JOB 3549
    // bliebe der Zähler 0 und beide Aussagen wären Aussagen über eine Null.
    // KEIN `vertraulicheInhalte`: das vertrauliche Objekt oben soll den Modellweg NICHT erreichen —
    // das ist die Zusage dieser Datei, und der zweite Schalter würde sie aufheben.
    await erteileKiFreigabe(reasoner);
    const ask = new AskService({
      reasoner,
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
  // S3 · DER UMFANG — was die Zustimmung ausweist und was tatsächlich hinausgeht.
  // ----------------------------------------------------------------------------------------------
  //
  // DER SPERRGRUND, WIE JOB 3033 IHN FAND: die Zustimmung band genau eine Nutzlastklasse,
  // `question`. Der Antwortweg übergibt dem Modell aber nicht nur die Frage, sondern die Kandidaten
  // mit Titel, Aussage, Dokumenttext und Bild-Fußnoten (`services/ask/src/service.ts`, Aufruf
  // `this.reasoner.answer(question, candidates, …)`). JOB 3033 durfte die zweite Klasse nicht
  // anlegen (§10: „keine neue Nutzlastklasse") und hat den Widerspruch deshalb als Sperrgrund
  // gebunden statt ihn zu beheben.
  //
  // WIE JOB 3079 IHN BEHOBEN HAT: `KLARA_PAYLOAD_CLASSES` weist beide Klassen aus, und der
  // Zustimmungssatz des Panels nennt sie im Klartext. DIESER FALL PRÜFT DIE DECKUNG IN BEIDE
  // RICHTUNGEN, denn nur beides zusammen ist ehrlich:
  //   · KEIN FELD OHNE KLASSE — was beim Anbieter ankommt, muss von einer ausgewiesenen Klasse
  //     gedeckt sein. Diese Richtung war der Sperrgrund.
  //   · KEINE KLASSE OHNE FELD — was ausgewiesen ist, muss auch wirklich reisen. Ohne diese
  //     Richtung liesse sich der Fall mit einer Sammelklasse „alles" grün machen, und der
  //     Zustimmungssatz verlöre jede Aussage.
  //
  // DIE ZUORDNUNG STEHT HIER ALS DATEN und nicht als Regel im Produkt: sie ist die Auslegung, die
  // ein MENSCH dem Zustimmungssatz gibt. Käme dem Modell ein Feld hinzu, das keiner Klasse
  // zugeordnet ist, wird dieser Fall rot — und genau dann ist wieder eine Zustimmungsentscheidung
  // fällig.
  const KLASSE_JE_MODELLDATUM: Record<string, string> = {
    // Die Frage selbst — das erste Argument an den Anbieter.
    frage: "question",
    // Jedes Feld eines `KnowledgeRef`, das in den Modellkontext reist.
    id: "candidate_texts",
    title: "candidate_texts",
    statement: "candidate_texts",
    status: "candidate_texts",
    trust: "candidate_texts",
    captionTexts: "candidate_texts",
    bodyText: "candidate_texts",
  };

  it("KA4-S3 · was das Modell sieht, ist von den ausgewiesenen Nutzlastklassen gedeckt", async () => {
    const e = await echtAufbauen();
    const consent = await e.repo.findConsent(e.sitzung);
    // Die Zustimmung weist genau aus, was die Auflösung nennt — nicht mehr und nicht weniger.
    expect(consent?.allowedPayloadClasses).toEqual([...AUSGEWIESENE_KLASSEN]);

    await fragen(e.app, e.bindung);

    if (!KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      // Gesperrt: der Anbieter wird über diesen Weg gar nicht gerufen. Es geht nichts hinaus, und
      // die Klassenangabe beschreibt „was hinausginge", nicht „was hinausging".
      expect(e.gesehen.length).toBe(0);
      await e.app.close();
      return;
    }

    // Freigeschaltet: JETZT muss die Angabe decken, was wirklich reist.
    expect(e.gesehen.length).toBe(1);
    const lauf = e.gesehen[0];
    if (!lauf) {
      throw new Error("kein Modellaufruf mitgeschrieben");
    }
    // Die Frage kam wörtlich an — sonst wäre die Klasse `question` ausgewiesen, ohne zu reisen.
    expect(lauf.frage).toBe(FRAGE);
    expect(lauf.kontext.length).toBeGreaterThan(0);

    const felder = ["frage", ...lauf.kontext.flatMap((k) => Object.keys(k))];
    const ohneKlasse = [...new Set(felder)].filter((f) => !KLASSE_JE_MODELLDATUM[f]);
    expect(
      ohneKlasse,
      `SPERRGRUND 3: an das Modell ging ein Datum, das keine ausgewiesene Klasse deckt: ${ohneKlasse.join(", ")}`,
    ).toEqual([]);

    const gedeckt = new Set(felder.map((f) => KLASSE_JE_MODELLDATUM[f]));
    for (const klasse of AUSGEWIESENE_KLASSEN) {
      expect(
        gedeckt.has(klasse),
        `ausgewiesen ist \`${klasse}\`, gemessen reiste dafür nichts — eine Klasse ohne Nutzlast`,
      ).toBe(true);
    }
    expect([...gedeckt].sort()).toEqual([...AUSGEWIESENE_KLASSEN].sort());
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

// ================================================================================================
// OHNE EINWILLIGUNG BYTEGLEICH — am ausgelieferten Ergebnis, nicht am Optionssatz.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 1, K3/R-1777): F1, F6 und F7 vergleichen den Optionssatz, den die Route
// an den Dienst übergibt. Ein Vergleich mit `expect.any(Function)` belegt aber keine Bytegleichheit
// dessen, was der Server ausliefert und nebenbei schreibt.
//
// DESHALB ZWEI AUFBAUTEN, DIE SICH NUR IN EINEM PUNKT UNTERSCHEIDEN:
//   A · `askRoutes` OHNE `klaraSessions` — der Weg ohne KA4 (`ka4Freigabe` kehrt sofort um),
//   B · derselbe Aufbau MIT dem echten `KlaraSessionService`, echter Sitzung, KEINER Zustimmung.
// Echt sind `AskService`, `KoService`, `Reasoner` und `AuditService`. Damit die Bytes vergleichbar
// sind, ist alles Zufällige festgelegt: eine feste Uhr, je Dienst ein eigener Kennungszähler (so
// verschieben die Sitzungskennungen in B die Kennungen des Antwortwegs nicht) und ein festes
// Beleggeheimnis. Verglichen werden je Anfrage Status und `res.payload`, danach der vollständige
// Lücken- und Auditbestand. Die KA4-Protokollzeilen sind die EINZIGE erwartete Abweichung und
// werden getrennt geprüft.
//
// Die Grundfreigabe steht in BEIDEN Aufbauten. Ohne sie wäre „null Anbieteraufrufe" auch dann wahr,
// wenn die Enge fehlte. KA4-B2 zeigt am selben Aufbau, dass der Anbieter gerufen wird, sobald
// zugestimmt ist.
describe("KA4 · ohne Einwilligung antwortet der Server bytegleich wie ohne KA4-Prüfer", () => {
  const T0 = Date.parse("2026-10-03T08:00:00.000Z");
  const LUECKE = "Welcher Druck gilt für das Ventil QZ17 im Winterbetrieb?";
  /** Nur im Test: welcher Zweig der Route bedient wird (Add-on-Schlüssel oder Sitzung). */
  const ZUGANG = "x-test-zugang";

  // Zusätzlich zur injizierten Uhr: auch ein Zeitstempel, der nicht über `now` läuft, ist in beiden
  // Aufbauten derselbe. Nur `Date` wird angehalten — Zeitgeber laufen normal.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Deterministische Kennungen im UUID-Format — je Dienst ein eigener Block. */
  function kennungen(block: string): () => string {
    let n = 0;
    return () => {
      n += 1;
      return `${block}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
    };
  }

  interface Vergleich {
    app: FastifyInstance;
    reasoner: Reasoner;
    dienst: KlaraSessionService;
    gaps: InMemoryGapRepo;
    auditRepo: InMemoryAuditRepo;
    anbieterAufrufe: string[];
    zeilen: string[];
    sitzung: string;
    bindung: Record<string, string>;
    koId: string;
  }

  async function vergleichsaufbau(mitPruefer: boolean): Promise<Vergleich> {
    const jetzt = (): number => T0;
    const anbieterAufrufe: string[] = [];
    const provider = {
      name: "mitschreiber",
      isAvailable: () => true,
      answer: async (
        frage: string,
        kontext: readonly KnowledgeRef[],
        _locale?: ReasonerLocale,
      ): Promise<AnswerResult> => {
        anbieterAufrufe.push(frage);
        return {
          answered: true,
          answer: "Antwort des Anbieters. [1]",
          knowledgeClass: "gesichert",
          trust: 60,
          sources: kontext.map((k) => k.id),
          citedSources: kontext.map((k) => k.id),
          steps: [],
          demo: false,
        };
      },
    } as unknown as ReasonerProvider;

    const koService = new KoService({
      repo: new InMemoryKoRepo(),
      now: jetzt,
      genId: kennungen("a1000000"),
    });
    await koService.activateSearchProjectionV2();
    const ko = await koService.create({
      title: "Zylinderkopfdichtung XQ42 Grundlagen",
      statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
      type: "best_practice",
      category: "Betrieb",
      author: "anna",
    });
    // Validiert: nur dann ist die retrieval-only-Frage ein TREFFER (`validatedOnly` bleibt stehen).
    await koService.setValidationState(ko.id, { trust: 90, status: "validiert" });

    const reasoner = new Reasoner(provider);
    const gaps = new InMemoryGapRepo();
    const auditRepo = new InMemoryAuditRepo();
    const ask = new AskService({
      reasoner,
      koService,
      gaps,
      audit: new AuditService({ repo: auditRepo, now: jetzt }),
      now: jetzt,
      genId: kennungen("a2000000"),
      receiptSecret: Buffer.alloc(32, 7),
    });
    // In BEIDEN Aufbauten gebaut, damit beide dieselbe Sitzung und dieselben Kopfzeilen haben —
    // verdrahtet wird er nur in B.
    const dienst = new KlaraSessionService({
      repo: new InMemoryKlaraSessionRepo(),
      policy: () => CLOUD_LAGE,
      now: jetzt,
      newId: kennungen("a3000000"),
    });

    const zeilen: string[] = [];
    const app = Fastify({
      logger: { level: "info", stream: { write: (z: string) => void zeilen.push(z) } },
    });
    app.decorateRequest("authContext", null);
    app.addHook("onRequest", async (request) => {
      if (request.headers[ZUGANG] === "addon") {
        request.authContext = {
          authKind: "addon",
          principal: { kind: "addon", id: ADDON_ACTOR_ID, capabilities: [ASK_CAPABILITY] },
        };
      }
    });
    app.register(
      askRoutes(
        {
          ask,
          ko: koService,
          conflicts: { unresolved: async () => [] } as never,
          ...(mitPruefer ? { klaraSessions: dienst as never } : {}),
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
    return {
      app,
      reasoner,
      dienst,
      gaps,
      auditRepo,
      anbieterAufrufe,
      zeilen,
      sitzung: sicht.sessionId,
      bindung: {
        "x-klara-session": sicht.sessionId,
        "x-klara-instance": "inst-1",
        "x-klara-document": sicht.documentContextId,
      },
      koId: ko.id,
    };
  }

  const ANFRAGEN = [
    { name: "Sitzungszweig · Treffer", frage: FRAGE, addon: false },
    { name: "Sitzungszweig · Wissensluecke", frage: LUECKE, addon: false },
    { name: "Add-on-Zweig · Treffer", frage: FRAGE, addon: true },
    { name: "Add-on-Zweig · Wissensluecke", frage: LUECKE, addon: true },
  ] as const;

  const senden = (v: Vergleich, anfrage: (typeof ANFRAGEN)[number]) =>
    v.app.inject({
      method: "POST",
      url: "/api/ask",
      headers: {
        ...v.bindung,
        ...(anfrage.addon ? { [ZUGANG]: "addon" } : {}),
        "content-type": "application/json",
      },
      payload: {
        question: anfrage.frage,
        locale: "de",
        mode: "retrieval-only",
        questionSource: "manual",
      },
    });

  /** Die Entscheidungszeilen des KA4-Tors am Ask-Weg — Entscheidung und Grund, sonst nichts. */
  const ka4Entscheidungen = (zeilen: string[]): { entscheidung: string; grund?: string }[] =>
    zeilen
      .filter((z) => z.includes('"ask.ka4.dokument-consent"'))
      .map((z) => (JSON.parse(z) as { ka4: { entscheidung: string; grund?: string } }).ka4);

  it("KA4-B1 · Sitzungs- und Add-on-Zweig, Treffer und Wissenslücke: Status, Antwortbytes, Lücken und Audit gleich — null Anbieteraufrufe", async () => {
    const ohne = await vergleichsaufbau(false);
    const mit = await vergleichsaufbau(true);
    await erteileKiFreigabe(ohne.reasoner);
    await erteileKiFreigabe(mit.reasoner);

    // KALIBRIERUNG: beide Aufbauten fragen mit denselben Kopfzeilen über denselben Bestand.
    expect(mit.bindung).toEqual(ohne.bindung);
    expect(mit.koId).toBe(ohne.koId);
    expect(JSON.stringify(await mit.gaps.all())).toBe(JSON.stringify(await ohne.gaps.all()));
    expect(JSON.stringify(await mit.auditRepo.all())).toBe(
      JSON.stringify(await ohne.auditRepo.all()),
    );

    const ausgeliefert = new Map<string, Record<string, unknown>>();
    for (const anfrage of ANFRAGEN) {
      const a = await senden(ohne, anfrage);
      const b = await senden(mit, anfrage);
      expect([anfrage.name, a.statusCode]).toEqual([anfrage.name, 200]);
      expect([anfrage.name, b.statusCode]).toEqual([anfrage.name, a.statusCode]);
      // DIE AUSSAGE: das vollständige Ergebnis, Byte für Byte.
      expect([anfrage.name, b.payload]).toEqual([anfrage.name, a.payload]);
      ausgeliefert.set(anfrage.name, JSON.parse(a.payload) as Record<string, unknown>);
    }

    // NICHT VAKUOS: der Treffer trägt die validierte Quelle, die Lücke legt im Sitzungszweig eine
    // Wissenslücke an und im Add-on-Zweig (`count_only`) keine.
    const treffer = ausgeliefert.get("Sitzungszweig · Treffer") as {
      result: { answered: boolean; sources: string[] };
    };
    expect(treffer.result.answered).toBe(true);
    expect(treffer.result.sources).toContain(ohne.koId);
    const luecke = ausgeliefert.get("Sitzungszweig · Wissensluecke") as {
      result: { answered: boolean };
      gap: unknown;
    };
    expect(luecke.result.answered).toBe(false);
    expect(luecke.gap).not.toBeNull();
    const addonLuecke = ausgeliefert.get("Add-on-Zweig · Wissensluecke") as { gap: unknown };
    expect(addonLuecke.gap).toBeNull();

    // DIE NEBENWIRKUNGEN: Lücken- und Auditbestand nach allen vier Anfragen, vollständig.
    const lueckenOhne = await ohne.gaps.all();
    expect(lueckenOhne).toHaveLength(1);
    expect(JSON.stringify(await mit.gaps.all())).toBe(JSON.stringify(lueckenOhne));
    const auditOhne = await ohne.auditRepo.all();
    expect(auditOhne.length).toBeGreaterThanOrEqual(ANFRAGEN.length);
    expect(JSON.stringify(await mit.auditRepo.all())).toBe(JSON.stringify(auditOhne));

    // Kein Modellaufruf in keinem der beiden Aufbauten.
    expect(ohne.anbieterAufrufe).toEqual([]);
    expect(mit.anbieterAufrufe).toEqual([]);

    // GETRENNT: das Protokoll des Tors. A schreibt keine Zeile (kein Prüfer), B je Anfrage genau
    // eine Absage — und keine Dokumenttext-Entscheidung, weil keine Freigabe bestätigt wurde.
    expect(ka4Entscheidungen(ohne.zeilen)).toEqual([]);
    const entscheidungen = ka4Entscheidungen(mit.zeilen);
    expect(entscheidungen).toHaveLength(ANFRAGEN.length);
    for (const e of entscheidungen) {
      expect(e.entscheidung).toBe("blockiert");
    }
    expect(ohne.zeilen.some((z) => z.includes('"ask.ka4.dokumenttext"'))).toBe(false);
    expect(mit.zeilen.some((z) => z.includes('"ask.ka4.dokumenttext"'))).toBe(false);

    await ohne.app.close();
    await mit.app.close();
  });

  it("KA4-B2 · KALIBRIERUNG: derselbe Aufbau B ruft den Anbieter, sobald zugestimmt ist — die Null oben hängt an der Einwilligung", async () => {
    const ohne = await vergleichsaufbau(false);
    const mit = await vergleichsaufbau(true);
    await erteileKiFreigabe(ohne.reasoner);
    await erteileKiFreigabe(mit.reasoner);
    const zustimmung = await mit.dienst.grantConsent(mit.sitzung, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: mit.bindung["x-klara-document"] ?? "",
    });
    expect(zustimmung.consentState).toBe("granted");

    const anfrage = ANFRAGEN[0];
    const a = await senden(ohne, anfrage);
    const b = await senden(mit, anfrage);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(ohne.anbieterAufrufe).toEqual([]);
    expect(mit.anbieterAufrufe).toEqual([FRAGE]);
    // Mit Zustimmung ist das Ergebnis ein anderes — der Bytevergleich oben kann also unterscheiden.
    expect(b.payload).not.toBe(a.payload);
    expect(ka4Entscheidungen(mit.zeilen).at(-1)?.entscheidung).toBe("freigegeben");

    await ohne.app.close();
    await mit.app.close();
  });
});
