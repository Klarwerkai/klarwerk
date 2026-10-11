// ================================================================================================
// R-0278 · ANTWORTEN NUR AUS GEPRUEFTEM WISSEN — DER WEGEUEBERGREIFENDE AUSSCHLUSSTEST
// ================================================================================================
//
// Der Auftragspunkt, woertlich: „Klara zieht für eine Antwort ausschließlich Wissen heran, das ein
// Mensch geprüft und freigegeben hat. Gibt es dazu nichts Geprüftes, antwortet sie nicht, sondern
// legt eine Wissenslücke an. Das soll für alle Wege gleich gelten: Web-Ansicht, Word-Panel,
// Schlüssel-Schnittstelle und Export."
//
// Der Quellenbeleg dazu (Landkarte v3, Zeile A1) lautet: „der wegeübergreifende Ausschlusstest
// fehlt". Einzelbelege je Weg gibt es inzwischen (Schlüssel: tests/security/f0688-…; Word-Panel:
// ask-routes-ka4-einwilligung.test.ts, tests/app/w5-…; Export: output-routes.test.ts). Was fehlte,
// ist EIN Bestand, an dem alle vier Wege nebeneinander gemessen werden — sonst kann niemand sehen,
// ob sie sich gleich verhalten. Diese Datei ist genau das, nicht mehr.
//
// DER BESTAND: zwei Objekte zum selben Gegenstand, die sich NUR im Prüfstand unterscheiden. Die
// Frage FRAGE_NUR_UNGEPRUEFT trifft ausschließlich das ungeprüfte (dieselbe, an F-0688 kalibrierte
// Trennschärfe: „NOTSTART-4" steht nur dort).
//
// NACHARBEIT 3 (ben): die Web-Ansicht und das Word-Panel MIT Modelleinwilligung zogen Ungeprüftes
// noch heran (ask-routes.ts, Session-Abschluss und KA4-Zweig ohne `validatedOnly`). Beide Wege
// tragen seitdem `validatedOnly`; W-WEB-1 und W-WORD-EINWILLIGUNG messen genau das.
//
// KEIN MODELLAUFRUF: `KLARWERK_SKIP_KEYCHAIN` schaltet die Schlüsselbund-Auflösung ab, damit auf
// einer Maschine mit hinterlegtem Schlüssel kein echter Aufruf über das Ergebnis entscheidet.
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { askRoutes, klaraAusfuehrungRoutes } from "../../services/app/src/routes/ask-routes";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  InMemoryKlaraSessionRepo,
  type KnowledgeRef,
  Reasoner,
  type ReasonerProvider,
} from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

/** Die Torlage einer Nicht-Antwort (`AskResult.verschlossen`), soweit hier gelesen. */
type Torlage = Array<{ id: string; freigabeFehlt: boolean }>;

/** Die Lage eines Betriebs MIT verdrahteter Cloud — wörtlich wie in `ka4-endzustand.test.ts`. */
const CLOUD_LAGE = {
  choice: "cloud" as const,
  source: "db" as const,
  effectiveAnswerProvider: "cloud" as const,
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: "anthropic",
  modelLabel: "claude",
  zentralFreigegeben: true,
};

const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "r0278-test-key";
const ORIGIN = "https://localhost:3000";
const INSTANZ = "r0278-instanz";

const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_AUTH_MAX",
  "KLARWERK_ADDON_AUTH_WINDOW",
  "KLARWERK_ADDON_RATE_MAX",
  "KLARWERK_ADDON_RATE_WINDOW",
  "KLARWERK_SKIP_KEYCHAIN",
];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = KEY;
  process.env.KLARWERK_ADDON_ORIGIN = ORIGIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
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

/** Trifft AUSSCHLIESSLICH das ungeprüfte Objekt — „NOTSTART-4" steht nur dort. */
const FRAGE_NUR_UNGEPRUEFT = "Wozu dient der Schnellstartknopf NOTSTART-4?";
/** Trifft beide; dient als Kalibrierung, dass ein Weg überhaupt etwas liefert. */
const FRAGE_BREIT = "Wie wird die Kesselspeisepumpe KSP-7 angefahren?";
const UNGEPRUEFTER_INHALT = "NOTSTART-4";

async function aufbauen() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@r0278.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@r0278.de", password: "secret123" },
  });
  const kopf = { authorization: `Bearer ${login.json().token}` };

  async function anlegen(title: string, statement: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "R0278",
        neededValidations: 1,
      },
    });
    return res.json().id as string;
  }

  const validiertId = await anlegen(
    "Kesselspeisepumpe KSP-7 anfahren",
    "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
  );
  const ungeprueftId = await anlegen(
    "Kesselspeisepumpe KSP-7 Schnellstart",
    "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
  );
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validiertId}`,
    headers: kopf,
    payload: { action: "rate", verdict: "up" },
  });

  // Die echte Word-Sitzung — der Server vergibt Sitzungs- und Dokumentkennung. KEINE Einwilligung:
  // gemessen wird der Weg, den das Panel ohne Zustimmung zur externen KI fährt.
  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...kopf, "x-klara-instance": INSTANZ },
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "r0278-doc" },
    },
  });
  expect(sitzung.statusCode, `Sitzung: ${sitzung.body}`).toBe(201);
  const word = {
    ...kopf,
    "x-klara-instance": INSTANZ,
    "x-klara-session": String(sitzung.json().sessionId),
    "x-klara-document": String(sitzung.json().documentContextId),
  };

  const fragen = {
    web: (question: string) =>
      app.inject({ method: "POST", url: "/api/ask", headers: kopf, payload: { question } }),
    // R-0700 (Integration mit Auftrag ki-modus-wahrheit): das Word-Panel fragt über Klaras EIGENEN,
    // sitzungsgebundenen Zugang; der allgemeine Frageweg weist eine Klara-Bindung ab (400
    // `KLARA_EIGENER_WEG`). Kopfzeilen und Modus wie zuvor; das Fenster meldet eine getippte Frage
    // als `manual` (R-0639 Runde 3).
    word: (question: string) =>
      app.inject({
        method: "POST",
        url: `/api/klara/sessions/${word["x-klara-session"]}/execute`,
        headers: word,
        payload: { question, mode: "retrieval-only", questionSource: "manual" },
      }),
    schluessel: (question: string) =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
        payload: { question },
      }),
    export: (koIds: string[]) =>
      app.inject({
        method: "POST",
        url: "/api/output/generate",
        headers: kopf,
        payload: { kind: "instruction", koIds },
      }),
  };
  return { app, kopf, validiertId, ungeprueftId, fragen };
}

describe("R-0278 · alle Wege nebeneinander: Ungeprüftes wird nie Grundlage", () => {
  it("W0 · KALIBRIERUNG: der Bestand trennt, und die Frage findet das ungeprüfte Objekt wirklich", async () => {
    // Ohne diesen Fall wären W-WORD/W-SCHLUESSEL auch dann grün, wenn die Frage gar nichts träfe.
    const { app, kopf, validiertId, ungeprueftId, fragen } = await aufbauen();
    const a = await app.inject({ method: "GET", url: `/api/kos/${validiertId}`, headers: kopf });
    const b = await app.inject({ method: "GET", url: `/api/kos/${ungeprueftId}`, headers: kopf });
    expect(a.json().status).toBe("validiert");
    expect(b.json().status).not.toBe("validiert");

    // Die Suche FINDET das ungeprüfte Objekt — die Torlage der Web-Ansicht meldet es mit
    // „Freigabe fehlt". Wäre es nicht gefunden, prüften die Ausschlussfälle nichts.
    const web = await fragen.web(FRAGE_NUR_UNGEPRUEFT);
    expect(web.statusCode).toBe(200);
    const gefunden = (web.json().verschlossen ?? []) as Torlage;
    expect(gefunden.find((h) => h.id === ungeprueftId)?.freigabeFehlt).toBe(true);
    await app.close();
  });

  it("W-WORD · Word-Panel ohne Einwilligung: keine Antwort aus Ungeprüftem, Lücke angelegt, Ungeprüftes gemeldet", async () => {
    const { app, ungeprueftId, fragen } = await aufbauen();
    const res = await fragen.word(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper.result)).not.toContain(UNGEPRUEFTER_INHALT);
    // „antwortet sie nicht, sondern legt eine Wissenslücke an"
    expect(koerper.result.answered).toBe(false);
    expect(
      koerper.gap,
      "das Word-Panel legt ohne geprüfte Grundlage keine Wissenslücke an",
    ).not.toBeNull();
    // S6: „und sagt auch, wenn es etwas gibt, das noch nicht geprüft ist" — gemeldet, nie behauptet.
    expect((koerper.ungeprueft ?? []).map((h: { id: string }) => h.id)).toContain(ungeprueftId);
    await app.close();
  });

  it("W-SCHLUESSEL · Schlüssel-Schnittstelle: keine Antwort aus Ungeprüftem, keine Lücke (count_only)", async () => {
    const { app, ungeprueftId, fragen } = await aufbauen();
    const res = await fragen.schluessel(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper)).not.toContain(UNGEPRUEFTER_INHALT);
    expect(koerper.result.answered).toBe(false);
    // Bewusst KEIN Lückeneintrag mit Fragetext für einen Fremdaufrufer (SCRUM-490 D1, gapPolicy
    // `count_only`); gezählt wird über das metadata-only Audit. Die Quelle zu R-0278 nennt genau
    // diese Form als Zielskizze für den Add-on-Zweig.
    expect(koerper.gap ?? null).toBeNull();
    await app.close();
  });

  it("W-EXPORT · Export: ein ungeprüftes Objekt ist weder wählbar noch exportierbar", async () => {
    const { app, kopf, validiertId, ungeprueftId, fragen } = await aufbauen();
    const quellen = await app.inject({ method: "GET", url: "/api/output/sources", headers: kopf });
    expect(quellen.statusCode).toBe(200);
    const ids = (quellen.json() as Array<{ id: string }>).map((q) => q.id);
    expect(ids).toContain(validiertId);
    expect(ids).not.toContain(ungeprueftId);

    const abgelehnt = await fragen.export([ungeprueftId]);
    expect(abgelehnt.statusCode).toBe(400);
    expect(abgelehnt.json().error).toBe("NOT_VALIDATED");
    expect(abgelehnt.body).not.toContain(UNGEPRUEFTER_INHALT);
    await app.close();
  });

  it("W-KALIBRIERUNG · die engen Wege sind nicht blind: Geprüftes kommt überall an", async () => {
    // Ohne diesen Fall könnten W-WORD/W-SCHLUESSEL/W-EXPORT grün sein, weil die Wege nichts liefern.
    const { app, validiertId, fragen } = await aufbauen();
    const word = await fragen.word(FRAGE_BREIT);
    expect(word.statusCode).toBe(200);
    expect(word.json().result.sources ?? []).toContain(validiertId);
    const schluessel = await fragen.schluessel(FRAGE_BREIT);
    expect(schluessel.statusCode).toBe(200);
    expect(schluessel.json().result.sources ?? []).toContain(validiertId);
    const exportiert = await fragen.export([validiertId]);
    expect(exportiert.statusCode).toBe(200);
    await app.close();
  });

  it("W-WEB-1 · Web-Ansicht: keine Antwort aus Ungeprüftem, Lücke angelegt, nie „gesichert“", async () => {
    const { app, ungeprueftId, fragen } = await aufbauen();
    const res = await fragen.web(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper.result)).not.toContain(UNGEPRUEFTER_INHALT);
    expect(koerper.result.answered).toBe(false);
    expect(koerper.result.knowledgeClass).not.toBe("gesichert");
    expect(koerper.gap, "ohne geprüfte Grundlage keine Wissenslücke").not.toBeNull();
    await app.close();
  });

  it("W-WEB-2 · Web-Ansicht, Gegenprobe: Geprüftes trägt weiterhin die Antwort", async () => {
    const { app, validiertId, fragen } = await aufbauen();
    const res = await fragen.web(FRAGE_BREIT);
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(true);
    expect(res.json().result.sources ?? []).toContain(validiertId);
    await app.close();
  });

  it("W-WORD-EINWILLIGUNG · Word-Panel MIT Modelleinwilligung: Ungeprüftes bleibt ausgeschlossen", async () => {
    // Ohne konfigurierte Cloud lehnt der echte Aufbau die Einwilligung ab (409, KA4-I0). Deshalb
    // hier dieselbe Bauform wie `ka4-einwilligung-wirkt.test.ts` (`echtAufbauen`): die ECHTE Sitzung
    // mit der Lage eines Betriebs MIT Cloud, der ECHTE Ask-Dienst mit echtem Bestand — und an der
    // Stelle der Cloud ein Anbieter, der mitschreibt, was in den Modellkontext reist. Gemessen wird
    // damit genau das, worum es bei der Einwilligung geht: was das MODELL zu sehen bekommt.
    const modellkontext: string[][] = [];
    const anbieter = {
      name: "mitschreiber",
      isAvailable: () => true,
      answer: async (_frage: string, kontext: readonly KnowledgeRef[]): Promise<AnswerResult> => {
        modellkontext.push(kontext.map((k) => k.id));
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
    const anlegen = async (title: string, statement: string) =>
      (
        await koService.create({
          title,
          statement,
          type: "best_practice",
          category: "R0278",
          author: "anna",
        })
      ).id;
    const validiertId = await anlegen(
      "Kesselspeisepumpe KSP-7 anfahren",
      "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
    );
    const ungeprueftId = await anlegen(
      "Kesselspeisepumpe KSP-7 Schnellstart",
      "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
    );
    await koService.setValidationState(validiertId, { trust: 90, status: "validiert" });
    const reasoner = new Reasoner(anbieter);
    // Grundfreigabe, sonst würde der Anbieter nie gerufen und die Messung sagte nichts.
    await erteileKiFreigabe(reasoner);
    const echterDienst = new AskService({
      reasoner,
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });

    const dienst = new KlaraSessionService({
      repo: new InMemoryKlaraSessionRepo(),
      policy: () => CLOUD_LAGE,
    });
    const gesehen: unknown[] = [];
    const echt = echterDienst.ask.bind(echterDienst);
    echterDienst.ask = (async (q: string, a?: string, l?: string, o?: unknown) => {
      gesehen.push(o ?? null);
      return echt(q, a, l as never, o as never);
    }) as typeof echterDienst.ask;
    const app = Fastify();
    // R-0700: der Einwilligungszweig steht in Klaras EIGENEM Zugang; der allgemeine Weg ist
    // mitregistriert wie in der App.
    const basis = {
      ask: echterDienst,
      ko: koService,
      conflicts: { unresolved: async () => [] } as never,
    };
    const tor = {
      requireUser: async () => ({ id: "nutzer-1", role: "admin" }),
      requirePermission: async () => ({ id: "nutzer-1", role: "admin" }),
    } as never;
    app.register(askRoutes(basis, tor));
    app.register(klaraAusfuehrungRoutes({ ...basis, klaraSessions: dienst as never }, tor));
    await app.ready();
    const sicht = await dienst.createSession("nutzer-1", "inst-1", {
      kind: "saved",
      hostDocumentId: "r0278-doc",
    });
    const bindung = {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": "inst-1",
      "x-klara-document": sicht.documentContextId,
    };
    const zustimmung = await dienst.grantConsent(sicht.sessionId, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: sicht.documentContextId,
    });
    expect(zustimmung.consentState).toBe("granted");
    const frage = (question: string) =>
      app.inject({
        method: "POST",
        url: `/api/klara/sessions/${sicht.sessionId}/execute`,
        headers: { ...bindung, "content-type": "application/json" },
        payload: { question, locale: "de", mode: "retrieval-only", questionSource: "manual" },
      });

    const res = await frage(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    // Der Einwilligungszweig wurde WIRKLICH genommen: kein `retrievalOnly`, aber `validatedOnly`.
    expect(gesehen[0]).toEqual({ validatedOnly: true });
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper.result)).not.toContain(UNGEPRUEFTER_INHALT);
    expect(koerper.result.answered).toBe(false);
    expect(koerper.gap, "ohne geprüfte Grundlage keine Wissenslücke").not.toBeNull();
    // Und das Modell hat das ungeprüfte Objekt nie zu sehen bekommen.
    expect(modellkontext.flat()).not.toContain(ungeprueftId);

    // KALIBRIERUNG im selben Aufbau: über denselben Zweig erreicht Geprüftes WIRKLICH das Modell —
    // ohne diese Zeile wäre „nichts Ungeprüftes kam an" auch dann wahr, wenn gar nichts ankäme.
    const breit = await frage(FRAGE_BREIT);
    expect(breit.statusCode).toBe(200);
    expect(gesehen[1]).toEqual({ validatedOnly: true });
    expect(modellkontext.flat()).toContain(validiertId);
    expect(modellkontext.flat()).not.toContain(ungeprueftId);
    await app.close();
  });
});
