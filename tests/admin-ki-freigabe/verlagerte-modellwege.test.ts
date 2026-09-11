// ================================================================================================
// JOB 3549 · FÜNF VERLAGERTE FÄLLE — DIESELBE ZUSAGE, AM ERLAUBTEN ORT.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM ES HIER STEHT. Diese fünf Fälle messen einen ECHTEN Modellweg: sie
// verlangen, dass ein als Cloud verdrahteter Provider TATSÄCHLICH gerufen wird. Unter dem Kern von
// JOB 3549 setzt das die Adminfreigabe voraus. An ihrem Ursprungsort konnten sie die nicht bekommen,
// und zwar aus zwei unabhängigen, gemessenen Gründen:
//
//   1. MODULGRENZE. Alle Ursprungsdateien liegen INNERHALB eines Moduls (`services/app`,
//      `services/ask`). Der Testhelfer `services/reasoner/src/testhelfer-ki-freigabe.ts` ist von
//      dort ein Cross-Modul-Import an `index.ts` vorbei; `.dependency-cruiser.cjs:16-27` lässt das
//      nicht zu (JOB 3657 hat es mit allen vier zugleich gemessen: „x 4 dependency violations").
//   2. FREIGABE-WÄCHTER F2 (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:2611`). Keine
//      Testquelle darf `oeffentlicheKi` oder `vertraulicheInhalte` im CODE nennen — auch nicht in
//      der Nutzlast des echten Adminwegs, auch nicht als Zeichenkette.
//
// BEIDE SPERREN FALLEN HIER AUF EINMAL, und das ist der ganze Grund für den Umzug:
//   zu 1. `tests/` liegt in KEINEM Modul. Der gezielte white-box-Import des Helfers ist hier
//         vorgesehen; sechs Testdateien fahren dieses Muster bereits.
//   zu 2. `tests/admin-ki-freigabe/` ist die ausdrücklich ausgenommene Ausnahme beider Wächter
//         (`routing-zwei-attrappen.test.ts:695` `KERN`, angewandt in `testquellen()` `:1273`).
//         Diese Dateien gehören dem Kern — sie sind das Modul, nicht sein Benutzer.
//
// ENTSCHIEDEN VON CODEX (11.09. 21:55), wörtlich: „Weg (b). Die betroffenen Testzusicherungen nach
// `tests/` verlagern, wo der gezielte Testhelferimport vorgesehen ist. Keine öffentliche
// Testhelfer-API, keine allgemeine Architektur-Ausnahme und keine Aufweichung des Freigabewächters.
// Fälle/Erwartungen und Testentdeckung erhalten, damit nichts versehentlich aus dem Tor
// verschwindet." Der zuvor gemessene Umbau (eine Zeile Re-Export in `services/reasoner/index.ts`)
// ist damit vom Tisch; er widerspricht AUFTRAG-mega59 BLOCK I.
//
// WAS SICH AN DEN FÄLLEN GEÄNDERT HAT: der Ort und genau eine Zeile Aufbau (`erteileKiFreigabe`).
// Gegenstand, Aufbau und Erwartung sind WÖRTLICH die der Ursprungsdatei — jeder Fall trägt unten
// seine Herkunft mit Datei und Fallnamen. Was NICHT mitgekommen ist: die Sperrfälle der
// Ursprungsdateien („Cloud-complete NIE aufgerufen", „Stufe 1 (kein Modell) bleibt 200"). Sie
// bekommen keine Freigabe und bleiben deshalb dort, wo sie sind.
//
// DER FÜNFTE FALL (Block 4) KAM EINE RUNDE SPÄTER. „Positiv: bewusst intern deklarierter Upload →
// Cloud-complete läuft" stand namentlich in den FALLAKTEN des Freigabe-Wächters und konnte deshalb
// in Runde 5 nicht mit: F7 verlangt die Ausführung eines geführten Falls UNTER SEINEM NAMEN IN
// SEINER DATEI, und ein Umzug ohne gleichzeitiges Austragen der Fallakte machte den Wächter rot
// (gemessen, Arbeitsprüfung ae6a2f82). Die Wächterdatei stand damals nicht in den Zielpfaden. In
// Runde 6 steht sie es; die Fallakte ist ausgetragen, der Fall ist hier, und die drei Sperrfälle
// seiner Ursprungsdatei bleiben dort mitsamt ihrer Akte.
//
// NUR DIE GRUNDFREIGABE, NIRGENDS `vertraulicheInhalte`. Kein einziger dieser Fälle braucht die
// zweite Freigabe: alle fünf verlangen bloss, dass ÜBERHAUPT ein Modellaufruf stattfindet. Für
// KA4-V1 ist das der Kern der Sache — die Datei belegt, dass Vertrauliches den Modellkontext NICHT
// erreicht; die zweite Freigabe hätte genau die Sperre aufgehoben, die dort die Zusage trägt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  type KnowledgeRef,
  ModelCapacityError,
  ModelProvider,
  Reasoner,
  type ReasonerLocale,
  type ReasonerProvider,
  type StructureResult,
} from "../../services/reasoner";
// Der gezielte white-box-Import, den Codex' Weg (b) meint — von `tests/` aus erlaubt und von
// `testquellen()` für dieses Verzeichnis ohnehin nicht betrachtet.
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

// ------------------------------------------------------------------------------------------------
// 1 · aus `services/app/src/routes/check-text-routes.test.ts`
// ------------------------------------------------------------------------------------------------

describe("SCRUM-498 B2: Modell-Cap-Überlauf (deep) → kontrolliertes 503, kein 500/Crash", () => {
  // HERKUNFT: `services/app/src/routes/check-text-routes.test.ts`, Fall „want:'deep' + Cap-Überlauf
  // → 503 + Retry-After (MODEL_BUSY), nicht 500". Der Nachbarfall „Stufe 1 (kein Modell) bleibt
  // 200 — der Cap berührt den deterministischen Pfad nicht" ist dort geblieben: er braucht gerade
  // KEINEN Modellaufruf und wäre mit einer Freigabe nicht mehr derselbe Fall.
  const KEY = "s3cr3t-addon-key";
  const TEXT_IDENTISCH =
    "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften und prüfen.";
  const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

  // Wörtlich die Env-Verwaltung der Ursprungsdatei (`:37-59`): der Endpunkt existiert nur hinter
  // dem Flag, und der Prozesszustand wird danach exakt wiederhergestellt.
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = [
    "KLARWERK_ADDON_API",
    "KLARWERK_ADDON_API_KEY",
    "KLARWERK_ADDON_ORIGIN",
    "KLARWERK_ADDON_RATE_MAX",
    "KLARWERK_ADDON_RATE_WINDOW",
  ];
  beforeEach(() => {
    for (const k of KEYS) {
      SAVED[k] = process.env[k];
      delete process.env[k];
    }
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (SAVED[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = SAVED[k];
      }
    }
  });

  // Reasoner, dessen einziger Chokepoint (client.complete) den Backpressure-Fehler wirft.
  function busyReasonerServices() {
    const services = buildServices();
    const throwingClient = {
      name: "cap",
      complete: async () => {
        throw new ModelCapacityError("Modell ausgelastet.");
      },
    };
    const reasoner = new Reasoner(new ModelProvider(throwingClient));
    (services as unknown as { reasoner: Reasoner }).reasoner = reasoner;
    return { services, reasoner };
  }

  async function loginOn(app: ReturnType<typeof buildApp>) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { authorization: `Bearer ${login.json().token}` };
  }

  // Legt ein VALIDIERTES KO an (POST + rate up → status „validiert") — wörtlich aus der Ursprungsdatei.
  async function seedValidated(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    statement: string,
  ) {
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Pumpe entlüften",
        statement,
        type: "best_practice",
        category: "Wartung",
        neededValidations: 1,
      },
    });
    const id = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    return id;
  }

  it("want:'deep' + Cap-Überlauf → 503 + Retry-After (MODEL_BUSY), nicht 500", async () => {
    const { services, reasoner } = busyReasonerServices();
    // DIE EINE NEUE ZEILE: ohne sie liefe der Judge deterministisch durch und die Route antwortete
    // mit 200 — der Cap-Fall wäre still verschwunden. Die Herkunft unten ist ausdrücklich
    // nicht-vertraulich, also genügt die Grundfreigabe.
    await erteileKiFreigabe(reasoner);
    const app = buildApp(services);
    const headers = await loginOn(app);
    // Mittlere Deckung (identisch vs. Kurzfassung) → der deep-Pfad ruft wirklich den (werfenden) Judge.
    await seedValidated(app, headers, TEXT_MITTEL);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      // SCRUM-502 Schicht 2 (Round 3): nicht-vertrauliche Herkunft, damit der deep-Judge wirklich läuft.
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.json().error).toBe("MODEL_BUSY");
    expect(res.payload).not.toContain("ModelCapacityError"); // kein Stacktrace nach außen
  });
});

// ------------------------------------------------------------------------------------------------
// 2 · aus `services/ask/src/service.test.ts`
// ------------------------------------------------------------------------------------------------

describe("AskService", () => {
  // HERKUNFT: `services/ask/src/service.test.ts`, Fall „FR-I18N-01: ask(..., 'en') übergibt locale
  // an den Reasoner" (SCRUM-88). Die übrigen siebzehn Fälle dieser Suite bauen `new Reasoner()`
  // ohne Provider und sind dort geblieben — ohne öffentlichen Anbieter gibt es nichts freizugeben.
  async function setup() {
    const koRepo = new InMemoryKoRepo();
    const koService = new KoService({ repo: koRepo });
    // G27 R1 / Entscheidung 06 §4: mechanische Initialisierung über den PRODUKTPFAD.
    await koService.activateSearchProjectionV2();
    await koService.create({
      title: "Ventil bei Überdruck schließen",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    return {
      koService,
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
      gaps: new InMemoryGapRepo(),
    };
  }

  // SCRUM-88 / FR-I18N-01: AskService reicht die UI-Sprache an den Reasoner durch.
  it("FR-I18N-01: ask(..., 'en') übergibt locale an den Reasoner", async () => {
    const ctx = await setup();
    const seen: (ReasonerLocale | undefined)[] = [];
    const capturing: ReasonerProvider = {
      name: "capture",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => {
        throw new Error("ungenutzt");
      },
      answer: async (
        _q: string,
        _ctx: readonly KnowledgeRef[],
        locale?: ReasonerLocale,
      ): Promise<AnswerResult> => {
        seen.push(locale);
        return {
          answered: true,
          answer: "ok",
          knowledgeClass: "gesichert",
          trust: 50,
          sources: ["x"],
          citedSources: ["x"],
          steps: [],
          demo: false,
        };
      },
      assistText: async () => ({ text: "", demo: false }),
      interview: async () => ({
        question: null,
        done: true,
        draft: {
          title: "",
          statement: "",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0,
          demo: false,
        },
        demo: false,
      }),
      extract: async () => ({ points: [], note: null, demo: false }),
      select: () => [],
    };
    const reasoner = new Reasoner(capturing);
    // DIE EINE NEUE ZEILE: `seen` bleibt nur gefüllt, wenn der verdrahtete Provider wirklich
    // gefragt wird. Die Frage ist nicht vertraulich — Grundfreigabe genügt.
    await erteileKiFreigabe(reasoner);
    const ask = new AskService({
      reasoner,
      koService: ctx.koService,
      gaps: ctx.gaps,
      audit: ctx.audit,
    });
    await ask.ask("Frage", "tester", "en");
    await ask.ask("Frage");
    expect(seen).toEqual(["en", "de"]);
  });
});

// ------------------------------------------------------------------------------------------------
// 3 · aus `services/ask/src/ka4-vertraulich-im-erlaubten-zweig.test.ts`
// ------------------------------------------------------------------------------------------------

describe("KA4 · D2 · der erlaubte Zweig laesst Vertrauliches NICHT durch", () => {
  // HERKUNFT: `services/ask/src/ka4-vertraulich-im-erlaubten-zweig.test.ts`, Fälle KA4-V0 und
  // KA4-V1. KA4-V2 und KA4-V3 sind dort geblieben: sie lesen `result.sources` und brauchen keinen
  // Modellaufruf.
  //
  // NUR `oeffentlicheKi`, NIEMALS `vertraulicheInhalte` — und das ist hier keine Sparsamkeit,
  // sondern der Gegenstand: die zweite Freigabe hätte die Sperre aufgehoben, die KA4-V1 belegt.
  // Mit der blossen Grundfreigabe findet der Aufruf statt UND das vertrauliche Objekt bleibt
  // draussen; genau das misst KA4-V1.
  const FRAGE = "Was gilt bei der Xylophon-Wartung?";

  function mitschreiber(): {
    provider: ReasonerProvider;
    gesehen: { kontext: readonly KnowledgeRef[]; confidential: boolean | undefined }[];
  } {
    const gesehen: { kontext: readonly KnowledgeRef[]; confidential: boolean | undefined }[] = [];
    const provider = {
      name: "mitschreiber",
      isAvailable: () => true,
      answer: async (
        _frage: string,
        kontext: readonly KnowledgeRef[],
        _locale?: ReasonerLocale,
        confidential?: boolean,
      ): Promise<AnswerResult> => {
        gesehen.push({ kontext, confidential });
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
    return { provider, gesehen };
  }

  async function aufbauen() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();

    // Ein VERTRAULICHES Objekt, das die Frage deckt — der Kandidat, der fallen muss.
    const geheim = await koService.create({
      title: "Xylophon Wartung Sonderverfahren",
      statement: "Die Xylophon-Wartung folgt dem Sonderverfahren des Mandanten Mueller.",
      type: "best_practice",
      category: "Geheim",
      author: "anna",
      confidentiality: "vertraulich" as const,
    });
    // Ein offenes Objekt zur selben Frage — die Kalibrierung.
    const offen = await koService.create({
      title: "Xylophon Wartung Grundlagen",
      statement: "Die Xylophon-Wartung beginnt mit der Sichtpruefung.",
      type: "best_practice",
      category: "Betrieb",
      author: "anna",
    });

    const { provider, gesehen } = mitschreiber();
    const reasoner = new Reasoner(provider);
    // DIE EINE NEUE ZEILE — ohne zweiten Schalter, s. Kopf dieses Blocks.
    await erteileKiFreigabe(reasoner);
    const ask = new AskService({
      reasoner,
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    return { ask, geheim, offen, gesehen };
  }

  it("KA4-V0 · KALIBRIERUNG: im erlaubten Zweig kommt ein OFFENES Objekt beim Modell an", async () => {
    const { ask, offen, gesehen } = await aufbauen();
    // Der erlaubte Zweig: KEINE Zwangsflags — genau der Aufruf aus ask-routes.ts:293/:330.
    await ask.ask(FRAGE, "anna");
    expect(gesehen.length).toBe(1);
    expect(gesehen[0]?.kontext.map((k) => k.id)).toContain(offen.id);
  });

  it("KA4-V1 · DER BELEG: das VERTRAULICHE Objekt erreicht den Modellkontext nicht", async () => {
    const { ask, geheim, gesehen } = await aufbauen();
    await ask.ask(FRAGE, "anna");
    expect(gesehen.length).toBe(1);
    const kontext = gesehen[0]?.kontext ?? [];
    expect(kontext.map((k) => k.id)).not.toContain(geheim.id);
    // Nicht nur die Kennung: auch kein Titel, keine Aussage, kein Mandantenname.
    const roh = JSON.stringify(kontext);
    expect(roh).not.toContain("Sonderverfahren");
    expect(roh).not.toContain("Mueller");
  });
});

// ------------------------------------------------------------------------------------------------
// 4 · aus `services/app/src/routes/reasoner-egress.test.ts`
// ------------------------------------------------------------------------------------------------

describe("SCRUM-502 R6: /api/reasoner egress (echter complete-Spy)", () => {
  // HERKUNFT: `services/app/src/routes/reasoner-egress.test.ts`, Fall „Positiv: bewusst intern
  // deklarierter Upload → Cloud-complete läuft". Die DREI Sperrfälle derselben Suite sind dort
  // geblieben — sie erwarten „Cloud-complete NIE aufgerufen" und dürfen keine Freigabe bekommen.
  //
  // ER IST DIE GEGENPROBE ZU JENEN DREI, und das war der Grund, warum die FALLAKTE des
  // Freigabe-Wächters ihn an ihre Datei band (`routing-zwei-attrappen.test.ts`, Eintrag zu
  // `reasoner-egress.test.ts`: „Der vierte ist ihre Gegenprobe: ohne ihn wäre die Null trivial").
  // Die Gegenprobe bleibt genau das — sie steht nur jetzt hier, weil sie die Freigabe braucht und
  // dort keine bekommen kann. Der Aufbau ist WÖRTLICH derselbe (`appWithSpy` mit genau einem
  // Cloud-Provider und ohne lokalen), deshalb misst sie weiterhin dasselbe Paar: dieselbe Route,
  // derselbe Spion, einmal gesperrt (dort) und einmal offen (hier).
  const DOC =
    "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften und den Druck prüfen. " +
    "Bei Überdruck sofort das Ventil schließen und den Vorgang dokumentieren.";

  function appWithSpy() {
    const complete = vi.fn(async () => '{"points": []}');
    const services = buildServices();
    // Nur ein Cloud-Provider (usingPrimary), KEIN lokaler — wörtlich der Aufbau der Ursprungsdatei.
    const reasoner = new Reasoner(new ModelProvider({ name: "cloud-spy", complete }));
    (services as unknown as { reasoner: Reasoner }).reasoner = reasoner;
    return { app: buildApp(services), complete, reasoner };
  }

  async function login(app: ReturnType<typeof buildApp>) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft", async () => {
    const { app, complete, reasoner } = appWithSpy();
    // DIE EINE NEUE ZEILE. Ein bewusst als INTERN deklarierter Upload ist NICHT vertraulich — die
    // Grundfreigabe genügt, und mehr wird nicht erteilt.
    await erteileKiFreigabe(reasoner);
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "extract",
        text: DOC,
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(complete).toHaveBeenCalled();
  });
});
