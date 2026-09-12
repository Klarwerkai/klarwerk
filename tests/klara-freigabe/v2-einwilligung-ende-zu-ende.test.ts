// ================================================================================================
// JOB 3079 · V2 — DIE EINWILLIGUNG WIRKT, VON DER ZUSTIMMUNG BIS ZUM ANBIETER
// ================================================================================================
//
// WAS DIESE DATEI IST. `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts` ist der VERTRAG der
// Freischaltung: er misst je Sperrgrund BEIDE Zustände des Schalters. Diese Datei ist die
// GEGENPROBE am ganzen Weg — eine einzige Kette, vom `POST /api/klara/sessions/{id}/consent` über
// die echte Route bis zu dem Satz, den ein Mensch danach im Aufgabenfenster liest.
//
// ============================================================================================
// RUNDE 2 — WAS BEN AN RUNDE 1 ZU RECHT ZERLEGT HAT, UND WAS DARAUS FOLGT.
// ============================================================================================
//
// Runde 1 hat drei Abkürzungen genommen, und jede einzelne hat die Aussage dieser Datei entwertet:
//
//   · DIE ZUSTIMMUNG LIEF AM HTTP-WEG VORBEI (`dienst.grantConsent(...)` direkt). Damit war der
//     Endpunkt, den das Panel wirklich ruft, in dieser „Ende-zu-Ende"-Kette gar nicht enthalten.
//   · DER ANBIETER ANTWORTETE NICHT (`answered: false`, `answer: null`). Grün belegte damit einen
//     AUFRUF, keine Antwort — und schon gar keinen Beleg an einer Antwort.
//   · DER BELEG WURDE SERVERINTERN GEPRÜFT (`pruefeExterneAusfuehrung`), nie an dem, was der
//     Mensch sieht.
//
// DIESE FASSUNG NIMMT KEINE DAVON. Zugestimmt wird über HTTP. Der Anbieter liefert eine echte
// Antwort mit Quelle. Und geprüft wird die AUSGELIEFERTE Fläche: `performAsk`, `askAiNoticeVisible`,
// `klaraS4Anzeige` und `klaraWegKey` werden aus `taskpane.html` GESCHNITTEN und AUSGEFÜHRT — samt
// echtem Wörterbuch, damit die Sätze wörtlich gemessen werden und nicht nachgebaut.
//
// ECHT IST ALLES DAZWISCHEN: `KlaraSessionService` mit echtem Repo, `klaraAiRoutes`, `askRoutes`
// samt `ka4Freigabe`, `AskService` mit echtem `KoService` und echtem `Reasoner`. Der einzige Ersatz
// ist der Modellanbieter — an genau der Stelle, an der in Produktion die Cloud steht, schreibt hier
// einer mit. DAS IST DIE BEWUSSTE PRÜFLÜCKE dieses Auftrags (§8.6): ein echter Cloud-Aufruf wird
// hier NICHT gefahren; den fährt die Abnahmeinstanz nach Live gegen den Word-Host.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { askRoutes } from "../../services/app/src/routes/ask-routes";
import { klaraAiRoutes } from "../../services/app/src/routes/klara-ai-routes";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  InMemoryKlaraSessionRepo,
  KLARA_EXTERNAL_EXECUTION_MIGRATED,
  KLARA_RESOLUTION_TTL_MS,
  type KnowledgeRef,
  Reasoner,
  type ReasonerLocale,
  type ReasonerPolicySource,
  type ReasonerProvider,
  type ReasonerTaskChoice,
} from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";
const AKTEUR = "nutzer-1";
const INSTANZ = "inst-1";
const T0 = Date.parse("2026-09-05T09:00:00.000Z");
/** Die Antwort, die der Anbieter WIRKLICH liefert — sie muss bis in die Fläche durchkommen. */
const MODELLANTWORT = "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet. [1]";

/** Der Anbieter, der bei erteilter Einwilligung WIRKLICH rechnet. */
const CLOUD_ANBIETER = "anthropic";
const CLOUD_MODELL = "claude";

/**
 * Die Lage eines Betriebs MIT verdrahteter Cloud. `choice` ist bewusst als ganze Union typisiert:
 * die Fälle E4/E5 stellen genau diesen Wert um, weil eine widersprüchliche Konfiguration ihr
 * Gegenstand ist — mit `as const` liesse sich das nicht formulieren, und ein `as never` an der
 * Aufrufstelle hätte den Widerspruch versteckt statt ihn zu benennen.
 */
const CLOUD_LAGE: {
  choice: ReasonerTaskChoice;
  source: ReasonerPolicySource;
  effectiveAnswerProvider: "cloud" | "local" | "deterministic";
  cloudConfigured: boolean;
  localConfigured: boolean;
  providerLabel: string;
  modelLabel: string;
  // NACHGEFÜHRT DURCH JOB 3767, s. Belegung unten.
  zentralFreigegeben: boolean;
} = {
  choice: "cloud",
  source: "db",
  effectiveAnswerProvider: "cloud",
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: CLOUD_ANBIETER,
  modelLabel: CLOUD_MODELL,
  // JOB 3767: die zentrale Adminfreigabe wird fail-closed gelesen (`klara-policy.ts`,
  // `zentralFreigegeben === true`) — ein weggelassenes Feld heisst gesperrt. Diese Datei misst die
  // EINWILLIGUNG bis zum Anbieter; ohne diese Zeile blockierte schon die Adminsperre, und kein
  // Fall käme mehr bis zum Modell.
  zentralFreigegeben: true,
};

// ================================================================================================
// DAS AUSGELIEFERTE AUFGABENFENSTER — geschnitten und ausgeführt, nicht nachgebaut.
// ================================================================================================
//
// Dieselbe Bauform wie `tests/app/klara-ai-header.test.ts` und
// `tests/app/mega79-klara-antwort-ohne-modell.test.ts`: `taskpane.html` ist buildlos und wird von
// keinem tsc erfasst; nur ein Schnitt misst die WIRKLICH ausgelieferte Entscheidung. Fail-closed —
// fehlt eine Schnittmarke, ist dieser Test rot statt still grün.
function schnitt(startMarke: string, endMarke: string): string {
  const start = HTML.indexOf(startMarke);
  const ende = HTML.indexOf(endMarke);
  expect(start, `${TASKPANE}: ${startMarke} fehlt`).toBeGreaterThan(0);
  expect(ende, `${TASKPANE}: ${endMarke} fehlt`).toBeGreaterThan(start);
  return HTML.slice(start, ende);
}

/**
 * Das echte Wörterbuch samt echtem `t` — vom `var STRINGS = {` bis vor `renderStatics`. Damit sind
 * die gemessenen Sätze die AUSGELIEFERTEN Sätze, in der ausgelieferten Ersetzungslogik.
 */
function woerterbuchQuelle(): string {
  const start = HTML.indexOf("    var STRINGS = {");
  const ende = HTML.indexOf("    function renderStatics()");
  expect(start, `${TASKPANE}: Wörterbuch nicht gefunden`).toBeGreaterThan(0);
  expect(ende, `${TASKPANE}: renderStatics nicht gefunden`).toBeGreaterThan(start);
  return HTML.slice(start, ende);
}

interface S4Anzeige {
  modeKey: string | null;
  provider: string | null;
  blockedKey: string | null;
  consentVisible: boolean;
  consentPossible: boolean;
  consentProvider: string | null;
  consentModel: string | null;
  payloadClasses: string[] | null;
  payloadResolved: boolean;
  askAllowed: boolean;
}

interface Panel {
  /** Der Satz des Zustimmungskastens, WÖRTLICH wie `renderKlaraS4` ihn zusammensetzt. */
  zustimmungssatz: (view: unknown, jetzt: number) => string;
  /** Der Satz über den Weg dieses Fensters, aus dem Vertrauenskopf. */
  wegsatz: (view: unknown, jetzt: number) => string;
  anzeige: (view: unknown, jetzt: number) => S4Anzeige;
  sprache: (l: string) => void;
}

function panel(): Panel {
  const factory = new Function(`
    ${woerterbuchQuelle()}
    ${schnitt("// KW-KLARA-S4-START", "// KW-KLARA-S4-END")}
    ${schnitt("// KW-KLARA-WEG-START", "// KW-KLARA-WEG-END")}
    // Die Zusammensetzung des Zustimmungssatzes ist DIESELBE Reihenfolge wie in renderKlaraS4;
    // sie steht dort inmitten von DOM-Zugriffen und ist nur so ohne Browser messbar. Dass beide
    // gleich bleiben, sichert der Fall "der Zustimmungssatz stammt aus renderKlaraS4" unten.
    function zustimmungssatz(a) {
      return a.payloadResolved && a.consentProvider
        ? t("s4ConsentSatz", {
            klassen: klaraS4KlassenListe(a.payloadClasses, t("s4KlassenUnd")),
            provider: a.consentProvider,
          }) + " " + t("s4ConsentUmfang", {
            provider: a.consentProvider,
            model: a.consentModel || t("s4Unbekannt"),
            session: "sess-1",
            klassen: a.payloadClasses.join(", "),
          })
        : t("s4ConsentKlassenFehlen");
    }
    return {
      anzeige: function (view, jetzt) { return klaraS4Anzeige("bereit", view, jetzt); },
      zustimmungssatz: function (view, jetzt) {
        return zustimmungssatz(klaraS4Anzeige("bereit", view, jetzt));
      },
      wegsatz: function (view, jetzt) {
        var a = klaraS4Anzeige("bereit", view, jetzt);
        return t(klaraWegKey(a), klaraWegParam(a));
      },
      sprache: function (l) { lang = l; },
    };
  `);
  return factory() as Panel;
}

interface AskAusgang {
  kind: string;
  answer?: string;
  sources?: string[];
  aiGenerated?: boolean;
}

/** `performAsk` des ausgelieferten Fensters, mit einem `fetch`, das an die ECHTE App geht. */
function panelAsk(app: FastifyInstance, kopf: Record<string, string>) {
  const umgebung = {
    stripAskAnswerMarkdown: (a: string) => a,
    askGradeOf: () => "unverified",
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    AbortController,
    fetch: async (url: string, init: { body: string }) => {
      const res = await app.inject({
        method: "POST",
        url,
        headers: { ...kopf, "content-type": "application/json" },
        payload: init.body,
      });
      return { ok: res.statusCode === 200, status: res.statusCode, json: async () => res.json() };
    },
  };
  const factory = new Function(
    "umgebung",
    `with (umgebung) {
       ${schnitt("// KW-KLARA-AI-MARK-START", "// KW-KLARA-AI-MARK-END")}
       ${schnitt("// KW-KLARA-AI-NOTICE-START", "// KW-KLARA-AI-NOTICE-END")}
       ${schnitt("// KW-KLARA-ASK-FETCH-START", "// KW-KLARA-ASK-FETCH-END")}
       return { performAsk: performAsk, askAiNoticeVisible: askAiNoticeVisible };
     }`,
  );
  const geschnitten = factory(umgebung) as {
    performAsk: (q: string, l: string, f: unknown, t: number) => Promise<AskAusgang>;
    askAiNoticeVisible: (o: AskAusgang) => boolean;
  };
  return {
    fragen: () => geschnitten.performAsk(FRAGE, "de", umgebung.fetch, 5000),
    notizSichtbar: geschnitten.askAiNoticeVisible,
  };
}

// ================================================================================================
// DIE KETTE
// ================================================================================================

interface Kette {
  app: FastifyInstance;
  sitzung: string;
  bindung: Record<string, string>;
  /** Was der MODELLANBIETER gesehen hat — der einzige Messpunkt, der den Egress belegt. */
  gesehen: { frage: string; kontext: readonly KnowledgeRef[] }[];
  vorstellen: (ms: number) => void;
  koId: string;
}

async function ketteAufbauen(
  lage: Partial<typeof CLOUD_LAGE> = {},
): Promise<Kette & { statusRoh: () => Promise<Record<string, unknown>> }> {
  let jetzt = T0;
  const gesehen: { frage: string; kontext: readonly KnowledgeRef[] }[] = [];
  const provider = {
    name: "mitschreiber",
    isAvailable: () => true,
    answer: async (
      frage: string,
      kontext: readonly KnowledgeRef[],
      _locale?: ReasonerLocale,
    ): Promise<AnswerResult> => {
      gesehen.push({ frage, kontext });
      // RUNDE 2 (BEN-Korrekturpflicht 2): der Anbieter ANTWORTET. Runde 1 lieferte hier
      // `answered: false` — grün belegte damit einen Aufruf und keine Antwort. `demo: false` ist
      // nicht Kosmetik: daraus bildet der ReasonerService die Kennzeichnung `aiGenerated`, und die
      // ist der Beleg, den das Panel dem Menschen zeigt.
      return {
        answered: true,
        answer: MODELLANTWORT,
        knowledgeClass: "gesichert",
        trust: 60,
        sources: kontext.map((k) => k.id),
        citedSources: kontext.map((k) => k.id),
        steps: [],
        demo: false,
      };
    },
  } as unknown as ReasonerProvider;

  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const ko = await koService.create({
    title: "Zylinderkopfdichtung XQ42 Grundlagen",
    statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
    type: "best_practice",
    category: "Betrieb",
    author: "anna",
  });

  const reasoner = new Reasoner(provider);
  // JOB 3588: die GRUNDFREIGABE im Aufbau. V2-E1 („die Antwort kommt vom Anbieter und trägt seinen
  // Beleg") und V2-E3 messen, ob die EINWILLIGUNG den Anbieterweg öffnet bzw. nach Ablauf wieder
  // schließt. Ohne die Adminfreigabe des Kerns von JOB 3549 wäre der Weg immer zu, und beide Fälle
  // prüften die falsche Sperre. Die Freigabe ersetzt die Einwilligung NICHT — sie ist die Bedingung
  // davor, und E3 belegt weiterhin, dass die Einwilligung allein die Tür öffnet und schließt.
  // Kein `vertraulicheInhalte`: das Objekt dieses Aufbaus ist offen eingestuft.
  await erteileKiFreigabe(reasoner);
  const ask = new AskService({
    reasoner,
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
    policy: () => ({ ...CLOUD_LAGE, ...lage }),
    now: () => jetzt,
  });

  const guards = {
    requireUser: async () => ({ id: AKTEUR, role: "admin" }),
    requirePermission: async () => ({ id: AKTEUR, role: "admin" }),
  } as never;

  const app = Fastify();
  // BEN-Korrekturpflicht 2: BEIDE Routen an EINER App — der Consent-Weg, den das Panel ruft, und
  // der Ask-Weg. Runde 1 hatte nur den zweiten und rief den ersten am HTTP vorbei.
  app.register(klaraAiRoutes({ sessions: dienst }, guards));
  app.register(
    askRoutes(
      {
        ask,
        ko: koService,
        conflicts: { unresolved: async () => [] } as never,
        klaraSessions: dienst as never,
      },
      guards,
    ),
  );
  await app.ready();

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "doc-abc" },
    },
  });
  expect(angelegt.statusCode, "Sitzung wurde nicht angelegt").toBe(201);
  const sicht = angelegt.json() as { sessionId: string; documentContextId: string };
  const bindung = {
    "x-klara-session": sicht.sessionId,
    "x-klara-instance": INSTANZ,
    "x-klara-document": sicht.documentContextId,
  };
  return {
    app,
    gesehen,
    koId: ko.id,
    sitzung: sicht.sessionId,
    bindung,
    vorstellen: (ms: number) => {
      jetzt += ms;
    },
    statusRoh: async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/klara/sessions/${sicht.sessionId}`,
        headers: bindung,
      });
      expect(res.statusCode, "Statusabruf gescheitert").toBe(200);
      return res.json() as Record<string, unknown>;
    },
  };
}

/** Die Zustimmung ÜBER HTTP — genau der Endpunkt, den `klaraS4Zustimmen` im Panel ruft. */
const zustimmen = (k: Kette) =>
  k.app.inject({
    method: "POST",
    url: `/api/klara/sessions/${k.sitzung}/consent`,
    headers: k.bindung,
  });

/** Genau der Weg, den das Word-Panel fährt (same-origin, `mode: "retrieval-only"`). */
const fragen = (k: Kette) =>
  k.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { ...k.bindung, "content-type": "application/json" },
    payload: { question: FRAGE, locale: "de", mode: "retrieval-only" },
  });

describe("JOB 3079 · V2 · die Einwilligung wirkt bis zum Anbieter", () => {
  it("V2-E0 · die Vorbedingung, protokolliert: dieser Lauf misst den freigeschalteten Zustand", () => {
    // Ohne diese Zeile wäre nicht sichtbar, welchen Zustand die Fälle darunter messen — und
    // E2/E3 wären auch bei gesperrtem Schalter grün, weil dann ohnehin nichts hinausgeht.
    expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(true);
  });

  // ----------------------------------------------------------------------------------------------
  // BEN-KORREKTURPFLICHT 1 — der Empfänger steht im Panel, BEVOR geklickt wird.
  // ----------------------------------------------------------------------------------------------
  it("V2-E1a · VOR der Zustimmung nennt der Zustimmungssatz den Cloud-Anbieter", async () => {
    const k = await ketteAufbauen();
    const p = panel();
    const status = await k.statusRoh();

    // BENs Messung, wörtlich nachgestellt: das ist der Satz, den ein Mensch im Kasten liest.
    const satz = p.zustimmungssatz({ ...status, resolution: status.resolution }, T0 + 1000);
    expect(satz).toContain(CLOUD_ANBIETER);
    expect(satz).toContain(CLOUD_MODELL);
    // Und der Ersatzwert, der in Runde 1 dort stand, kommt nicht mehr vor.
    expect(satz).not.toContain("deterministisch");
    // Der Kasten ist offen, der Knopf da — sonst prüfte der Satz eine Fläche, die niemand sieht.
    const a = p.anzeige(status, T0 + 1000);
    expect(a.consentVisible).toBe(true);
    expect(a.consentPossible).toBe(true);
    expect(a.consentProvider).toBe(CLOUD_ANBIETER);
    // Die KI-Zeile bleibt dabei ehrlich: es rechnet noch nichts extern.
    expect(a.askAllowed).toBe(false);
    expect(a.provider).not.toBe(CLOUD_ANBIETER);
    await k.app.close();
  });

  it("V2-E1b · der gemessene Zustimmungssatz ist der, den `renderKlaraS4` zusammensetzt", () => {
    // Der Fall oben baut den Satz aus zwei Wörterbuchschlüsseln zusammen, weil `renderKlaraS4`
    // inmitten von DOM-Zugriffen steht. Ohne diesen Abgleich könnte die Fläche etwas anderes
    // zusammensetzen als der Test — und der Test wäre eine Erzählung.
    const render = HTML.slice(HTML.indexOf("function renderKlaraS4()"));
    expect(render).toContain('t("s4ConsentSatz", {');
    expect(render).toContain("provider: a.consentProvider,");
    expect(render).toContain('model: a.consentModel || t("s4Unbekannt"),');
    expect(render).toContain("a.payloadResolved && a.consentProvider");
    // Und AUSDRÜCKLICH nicht mehr der Ausführungsanbieter — das war der Fehler. Gemessen wird
    // GENAU der Zustimmungskasten, von `klara-consent-scope` bis `klara-consent-blocked`: die
    // KI-Zeile darüber (`s4Anbieter`) nennt `a.provider` weiterhin, und das ist dort richtig — sie
    // beantwortet ja die andere Frage.
    const kasten = render.slice(
      render.indexOf('getElementById("klara-consent-scope")'),
      render.indexOf('getElementById("klara-consent-blocked")'),
    );
    expect(kasten.length, "der Zustimmungskasten wurde nicht gefunden").toBeGreaterThan(100);
    expect(kasten).not.toContain("a.provider");
    expect(kasten).not.toContain("a.model");
    // Und die REIHENFOLGE samt Klassenliste — die Nachbildung oben setzt genau so zusammen. Ohne
    // diese drei Zeilen könnte die Fläche etwas anderes bauen als der Test misst, und E1a wäre
    // eine Erzählung über eine Nachbildung statt eine Messung an der Auslieferung.
    expect(kasten.indexOf('t("s4ConsentSatz"')).toBeLessThan(kasten.indexOf('t("s4ConsentUmfang"'));
    expect(kasten).toContain('klaraS4KlassenListe(a.payloadClasses, t("s4KlassenUnd"))');
    expect(kasten).toContain('klassen: a.payloadClasses.join(", ")');
  });

  // ----------------------------------------------------------------------------------------------
  // BEN-KORREKTURPFLICHT 2 — Zustimmung über HTTP, echte Antwort, sichtbarer Beleg.
  // ----------------------------------------------------------------------------------------------
  it("V2-E1 · MIT Zustimmung über HTTP: die Antwort kommt vom Anbieter und trägt seinen Beleg", async () => {
    const k = await ketteAufbauen();
    const p = panel();

    const consent = await zustimmen(k);
    expect(consent.statusCode, "die Zustimmung kam über HTTP nicht zustande").toBe(200);
    const nachConsent = consent.json() as {
      consentState: string;
      resolution: { provider: string; model: string; executionAllowed: boolean };
    };
    expect(nachConsent.consentState).toBe("granted");
    // DIE URKUNDE NENNT DEN AUSFÜHRENDEN (Sperrgrund S2): nicht „Klarwerk (deterministisch)".
    expect(nachConsent.resolution.provider).toBe(CLOUD_ANBIETER);
    expect(nachConsent.resolution.model).toBe(CLOUD_MODELL);
    expect(nachConsent.resolution.executionAllowed).toBe(true);

    // Die Frage läuft durch den AUSGELIEFERTEN Panelcode in die echte Route.
    const ausgang = await panelAsk(k.app, k.bindung).fragen();
    expect(ausgang.kind, "das Panel hat keine Antwort erhalten").toBe("answered");
    // DIE ANTWORT IST DIE DES ANBIETERS — Runde 1 belegte hier nur einen Aufruf.
    expect(ausgang.answer).toBe(MODELLANTWORT);
    expect(ausgang.sources).toContain(k.koId);
    // UND SIE TRÄGT DEN BELEG, den das Panel dem Menschen zeigt: die KI-Kennzeichnung.
    expect(ausgang.aiGenerated, "die Antwort trägt keine KI-Kennzeichnung").toBe(true);
    expect(panelAsk(k.app, k.bindung).notizSichtbar(ausgang)).toBe(true);

    // Der Anbieter hat wirklich gerechnet, mit Frage UND Kandidatentexten.
    expect(k.gesehen.length).toBe(1);
    expect(k.gesehen[0]?.frage).toBe(FRAGE);
    expect((k.gesehen[0]?.kontext ?? []).map((r) => r.id)).toContain(k.koId);

    // UND DER SATZ IM VERTRAUENSKOPF NENNT IHN BEIM NAMEN — in allen drei Sprachen.
    const status = await k.statusRoh();
    for (const sprache of ["de", "en", "nl"]) {
      p.sprache(sprache);
      const weg = p.wegsatz(status, T0 + 1000);
      expect(weg, `${sprache}: der Anbieter fehlt im Wegsatz`).toContain(CLOUD_ANBIETER);
      expect(weg, `${sprache}: der Satz behauptet weiter „ohne Modell"`).not.toMatch(
        /ohne KI-Modell|without an AI model|zonder AI-model/,
      );
    }
    p.sprache("de");
    await k.app.close();
  });

  it("V2-E2 · OHNE Zustimmung: `external_consent_missing`, und das Modell sieht nichts", async () => {
    const k = await ketteAufbauen();
    const p = panel();
    const status = await k.statusRoh();
    const r = status.resolution as { blockedReason: string; executionAllowed: boolean };
    expect(r.blockedReason).toBe("external_consent_missing");
    expect(r.executionAllowed).toBe(false);

    const ausgang = await panelAsk(k.app, k.bindung).fragen();
    expect(k.gesehen.length, "ohne Zustimmung darf NICHTS das Modell erreichen").toBe(0);
    // Die Fläche sagt es auch: keine KI-Kennzeichnung, und der Wegsatz nennt die fehlende Zustimmung.
    expect(ausgang.aiGenerated ?? false).toBe(false);
    expect(p.wegsatz(status, T0 + 1000)).toContain("ohne KI-Modell");
    await k.app.close();
  });

  it("V2-E3 · nach Ablauf der Auflösungsfrist: gesperrt — bis erneut zugestimmt wird", async () => {
    const k = await ketteAufbauen();
    expect((await zustimmen(k)).statusCode).toBe(200);

    // Kalibrierung: INNERHALB der Frist trägt sie. Ohne diese Hälfte wäre der Fall auch dann grün,
    // wenn die Zustimmung nie getragen hätte.
    k.vorstellen(KLARA_RESOLUTION_TTL_MS - 1_000);
    await fragen(k);
    expect(k.gesehen.length).toBe(1);

    // Eine Sekunde nach Ablauf: gesperrt. Die SITZUNG lebt weiter (15 min) — es ist wirklich die
    // Auflösungsfrist, die greift, und nicht die Sitzungsfrist.
    k.vorstellen(2_000);
    await fragen(k);
    expect(k.gesehen.length, "nach Fristablauf darf nichts mehr hinausgehen").toBe(1);
    const status = await k.statusRoh();
    expect((status.resolution as { executionAllowed: boolean }).executionAllowed).toBe(false);

    // UND DER WEG IST NICHT TOT: eine frische Zustimmung öffnet ihn wieder. Ohne diese Zeile wäre
    // „gesperrt" auch dann grün, wenn der Ablauf die Sitzung dauerhaft unbrauchbar machte.
    expect((await zustimmen(k)).statusCode).toBe(200);
    await fragen(k);
    expect(k.gesehen.length).toBe(2);
    await k.app.close();
  });

  // ----------------------------------------------------------------------------------------------
  // BEN-KORREKTURPFLICHT 3 — widersprüchliche Policy gibt auch am ganzen Weg nichts frei.
  // ----------------------------------------------------------------------------------------------
  it("V2-E4 · Admin will NICHT extern, die Bindung zeigt auf Cloud: keine Zustimmung, kein Egress", async () => {
    // Dieselbe Lage, die BEN am Resolver gemessen hat — hier an der ganzen Kette.
    const k = await ketteAufbauen({ choice: "deterministic" });
    const p = panel();
    const status = await k.statusRoh();
    const r = status.resolution as { blockedReason: string; executionAllowed: boolean };
    expect(r.blockedReason).toBe("policy_incomplete");
    expect(r.executionAllowed).toBe(false);

    // Es gibt keinen Empfänger — also auch keinen Zustimmungsknopf und keinen Satz mit Ersatzwert.
    const a = p.anzeige(status, T0 + 1000);
    expect(a.consentProvider).toBeNull();
    expect(a.consentPossible).toBe(false);
    expect(p.zustimmungssatz(status, T0 + 1000)).not.toContain(CLOUD_ANBIETER);

    // Selbst wenn jemand den Endpunkt direkt ruft: die Zustimmung entsteht, weil der Modus extern
    // IST — aber sie schaltet nichts frei. Das ist der Kern: der Egress bleibt zu.
    await zustimmen(k);
    await fragen(k);
    expect(k.gesehen.length, "widersprüchliche Policy hat einen Egress erlaubt").toBe(0);
    await k.app.close();
  });

  it("V2-E5 · effektive Cloud-Bindung OHNE verdrahtete Cloud: kein Egress", async () => {
    const k = await ketteAufbauen({ cloudConfigured: false });
    const status = await k.statusRoh();
    expect((status.resolution as { blockedReason: string }).blockedReason).toBe(
      "policy_incomplete",
    );
    await zustimmen(k);
    await fragen(k);
    expect(k.gesehen.length).toBe(0);
    await k.app.close();
  });

  // ----------------------------------------------------------------------------------------------
  // DER ANBIETERNAME KOMMT AUS DER KONFIGURATION — nirgends steht einer im Produktcode.
  // ----------------------------------------------------------------------------------------------
  //
  // WARUM DAS HIER GEMESSEN WIRD: die externe KI dieses Hauses ist eine Betriebsentscheidung und
  // wechselt (Coolify/Admin). Stünde irgendwo ein Name — als Vorgabe, als Rückfall, als Beispiel im
  // Code —, dann nennte das Panel eines Tages einen Empfänger, an den gar nichts geht. Genau diese
  // Falle hat JOB 3079 gerade erst zugeschüttet: der Zustimmungssatz nannte einen Anbieter, der
  // nicht ausführt.
  //
  // ZWEI HÄLFTEN, und beide sind nötig: der Quelltext trägt keinen Namen (die Grep-Hälfte fängt den
  // hart verdrahteten Rückfall), UND derselbe Weg nennt bei ZWEI verschiedenen Konfigurationen
  // zwei verschiedene Anbieter (die Verhaltenshälfte fängt eine Ableitung, die den Namen ignoriert
  // und trotzdem zufällig richtig aussieht). Für das Aufgabenfenster leistet dasselbe seit
  // AUFTRAG-06 `tests/app/klara-ai-header.test.ts` Block E über den Schnitt
  // `KW-KLARA-S4-START` … `KW-KLARA-S4-FETCH-END` — der `KW-KLARA-WEG`-Block liegt darin.
  it("V2-E6 · im Resolver steht kein Anbieter-/Modellname — und der Kasten folgt der Konfiguration", async () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "services/reasoner/src/klara-policy.ts"),
      "utf8",
    );
    for (const verdaechtig of ["openai", "anthropic", "gpt-", "claude", "llama", "mistral"]) {
      expect(
        quelle.toLowerCase(),
        `„${verdaechtig}" im Resolver wäre ein verdrahteter Empfänger`,
      ).not.toContain(verdaechtig);
    }

    // Und die Verhaltenshälfte: zwei Konfigurationen, zwei Namen, derselbe Weg. Die Werte sind
    // erkennbare Platzhalter — welcher Anbieter im Betrieb steht, entscheidet die Verdrahtung.
    const konfigurationen: ReadonlyArray<readonly [string, string]> = [
      ["anbieter-eins", "modell-eins"],
      ["anbieter-zwei", "modell-zwei"],
    ];
    for (const [anbieter, modell] of konfigurationen) {
      const k = await ketteAufbauen({ providerLabel: anbieter, modelLabel: modell });
      const satz = panel().zustimmungssatz(await k.statusRoh(), T0 + 1000);
      expect(satz, `der Kasten nennt ${anbieter} nicht`).toContain(anbieter);
      expect(satz, `der Kasten nennt ${modell} nicht`).toContain(modell);
      await k.app.close();
    }
  });
});
