// ================================================================================================
// F-0295 / R-0639 — DER MARKIERTE DOKUMENTTEXT: EIGENE KLASSE, EIGENE DECKUNG, EIN RIEGEL AUF AUS.
// ================================================================================================
//
// Die Anforderung, wörtlich aus der Auftragsquelle (R-0639): „Der Dokumenttext darf an die externe
// KI gehen, aber nur mit ausdruecklicher Freigabe fuer genau dieses Dokument; als vertraulich
// Markiertes bleibt immer draussen. Der Dokumenttext ist dabei eine eigene, benannte Nutzlastklasse
// neben der Frage, mit eigener Deckungspruefung. Der Riegel steht bis heute auf AUS, und es soll
// belegt sein, dass wirklich er den externen Aufruf verhindert — nicht zufaellig ein Betriebsmodus,
// der ohnehin ohne Modell auskommt."
//
// WIE DIESE DATEI DAS BELEGT, und das ist ihr Kern: jeder Absagefall hat eine GEGENPROBE, in der
// genau EIN Umstand anders ist.
//   · Der externe Antwortweg ist in jedem Fall unten WIRKLICH offen: das echte Tor
//     (`pruefeExterneAusfuehrung`) sagt `erlaubt: true`, und der mitschreibende Modellclient wird
//     WIRKLICH gerufen. „Es ging nichts hinaus" ist damit keine Aussage über einen Weg ohne Modell.
//   · Der Unterschied zwischen „Dokumenttext bleibt draussen" und „Dokumenttext geht mit" ist
//     ausschliesslich der Riegel (`dokumenttextRiegelOffen`, nur in dieser Gegenprobe gesetzt —
//     im Produkt gilt die Konstante, gepinnt in R0).
//
// ECHT IST: `resolveKlaraPolicy`, der `KlaraSessionService` mit In-Memory-Ablage, die Route
// `POST /api/ask`, der `AskService` mit echtem Wissensbestand, der `Reasoner` und der
// `ModelProvider` mit seinem echten Prompt. Ersetzt ist allein der Netzaufruf (`ModelClient`) —
// er schreibt mit, was hinausginge. Kein Browser, keine Datenbank, kein Netz.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { askRoutes, klaraAusfuehrungRoutes } from "../../services/app/src/routes/ask-routes";
import {
  KlaraSessionService,
  pruefeDokumenttextDeckung,
} from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  InMemoryKlaraSessionRepo,
  KLARA_DOCUMENT_TEXT_EGRESS_ENABLED,
  KLARA_PAYLOAD_CLASS_DOCUMENT_TEXT,
  type KlaraConsent,
  type ModelClient,
  ModelProvider,
  Reasoner,
  resolveKlaraPolicy,
} from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { panelQuelleAus } from "../support/panelquelle";

const WURZEL = process.cwd();
const quelle = (pfad: string): string => readFileSync(resolve(WURZEL, pfad), "utf8");
/** Der Code ohne Kommentarzeilen — ein Name in einem Kommentar ist keine lesende Stelle. */
const code = (pfad: string): string =>
  quelle(pfad)
    .split("\n")
    .filter((z) => !z.trimStart().startsWith("*") && !z.trimStart().startsWith("//"))
    .join("\n");

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";
/** Ein Satz, der nur in der Markierung steht — wo er im Prompt auftaucht, kam er von dort. */
// R5d verlangt mehr: die Markierung muss ALS FRAGE den Kandidatenfilter tragen, sonst hiesse „nichts
// ging hinaus" in R5b/R5c nur „nichts war relevant". Deshalb nennt sie den Gegenstand des Eintrags.
const MARKIERUNG =
  "Zylinderkopfdichtung XQ42 wechseln: laut Entwurf nur mit Drehmoment 38 Nm anziehen.";
const MARKER = "Drehmoment 38 Nm";

/** Ein Betrieb mit verdrahteter Cloud, Adminwahl extern und zentraler Freigabe. */
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

// ------------------------------------------------------------------------------------------------
// R0 · DER RIEGEL: EIN WERT, EINE LESENDE STELLE, IM PRODUKT NICHT ÜBERSTEUERT
// ------------------------------------------------------------------------------------------------
describe("R-0639 · R0 — der Riegel steht auf AUS und ist genau eine Entscheidung", () => {
  it("R0a · Wert und Klassenname", () => {
    expect(KLARA_DOCUMENT_TEXT_EGRESS_ENABLED).toBe(false);
    expect(KLARA_PAYLOAD_CLASS_DOCUMENT_TEXT).toBe("document_text");
  });

  it("R0b · deklariert in klara-policy.ts, gelesen NUR im Sitzungsdienst, nie über process.env", () => {
    const policy = code("services/reasoner/src/klara-policy.ts");
    expect(policy.match(/export const KLARA_DOCUMENT_TEXT_EGRESS_ENABLED\s*=/g) ?? []).toHaveLength(
      1,
    );
    // Der Resolver liest ihn nicht selbst — er bekommt das Ergebnis als Eingabe.
    expect(policy.match(/KLARA_DOCUMENT_TEXT_EGRESS_ENABLED/g) ?? []).toHaveLength(1);
    const dienst = code("services/app/src/services/klara-session-service.ts");
    // Import + genau eine lesende Stelle.
    expect(dienst.match(/KLARA_DOCUMENT_TEXT_EGRESS_ENABLED/g) ?? []).toHaveLength(2);
    expect(dienst).not.toMatch(/process\.env/);
    // Keine Route, kein Fragedienst und keine Kompositionswurzel liest oder übersteuert ihn.
    for (const pfad of [
      "services/app/src/routes/ask-routes.ts",
      "services/ask/src/service.ts",
      "services/app/src/build-app.ts",
    ]) {
      expect(code(pfad), pfad).not.toMatch(/KLARA_DOCUMENT_TEXT_EGRESS_ENABLED/);
      expect(code(pfad), pfad).not.toMatch(/dokumenttextRiegelOffen/);
    }
  });

  it("R0c · die Route nimmt die Freigabe nie aus dem Rumpf — es gibt kein Client-Feld dafür", () => {
    const route = code("services/app/src/routes/ask-routes.ts");
    expect(route).not.toMatch(/request\.body\.dokumenttextFreigegeben/);
    expect(route).not.toMatch(/dokumenttextFreigegeben:\s*\{\s*type/);
  });
});

// ------------------------------------------------------------------------------------------------
// R1 · DIE AUFLÖSUNG WEIST DEN DOKUMENTTEXT NUR BEI OFFENEM RIEGEL AUS
// ------------------------------------------------------------------------------------------------
describe("R-0639 · R1 — eine eigene, benannte Klasse neben der Frage", () => {
  const basis = {
    ...CLOUD_LAGE,
    externalConsentGranted: true,
    now: Date.parse("2026-10-01T09:00:00.000Z"),
    resolutionId: "res-1",
  };

  it("R1a · ohne Feld und mit `false`: Frage und Kandidatentexte, KEIN Dokumenttext", () => {
    for (const r of [
      resolveKlaraPolicy(basis),
      resolveKlaraPolicy({ ...basis, dokumenttextFreigeschaltet: false }),
    ]) {
      expect(r.executionAllowed).toBe(true);
      expect(r.effectivePayloadClasses).toEqual(["question", "candidate_texts"]);
    }
  });

  it("R1b · mit offenem Riegel steht die Klasse ZUSÄTZLICH da — nie statt der Frage", () => {
    const r = resolveKlaraPolicy({ ...basis, dokumenttextFreigeschaltet: true });
    expect(r.effectivePayloadClasses).toEqual(["question", "candidate_texts", "document_text"]);
    expect(Object.isFrozen(r.effectivePayloadClasses)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// R2 · DIE EIGENE DECKUNGSPRÜFUNG — REIN, IN IHRER REIHENFOLGE
// ------------------------------------------------------------------------------------------------
describe("R-0639 · R2 — pruefeDokumenttextDeckung", () => {
  const consent = (teil: Partial<KlaraConsent> = {}): KlaraConsent =>
    ({
      consentId: "c-1",
      status: "granted",
      documentContextId: "doc-1",
      allowedPayloadClasses: ["question", "candidate_texts", "document_text"],
      ...teil,
    }) as KlaraConsent;
  const lage = (teil: Partial<Parameters<typeof pruefeDokumenttextDeckung>[0]> = {}) => ({
    consent: consent(),
    gedeckteConsentId: "c-1" as string | null,
    documentContextId: "doc-1",
    vertraulich: false,
    riegelOffen: true,
    ...teil,
  });

  it("R2a · alles erfüllt und Riegel offen: gedeckt — die Kalibrierung aller Absagen darunter", () => {
    expect(pruefeDokumenttextDeckung(lage())).toEqual({ gedeckt: true });
  });

  it("R2b · VERTRAULICH schlägt alles, auch einen offenen Riegel mit voller Zustimmung", () => {
    expect(pruefeDokumenttextDeckung(lage({ vertraulich: true }))).toEqual({
      gedeckt: false,
      grund: "vertraulich",
    });
  });

  it("R2c · der Riegel allein: alles andere erfüllt, Riegel zu → `riegel_aus`", () => {
    expect(pruefeDokumenttextDeckung(lage({ riegelOffen: false }))).toEqual({
      gedeckt: false,
      grund: "riegel_aus",
    });
  });

  it("R2d · ohne Zustimmung oder mit einer FREMDEN Zustimmung fragt der Riegel gar nicht erst", () => {
    expect(pruefeDokumenttextDeckung(lage({ consent: undefined, riegelOffen: false }))).toEqual({
      gedeckt: false,
      grund: "kein_consent",
    });
    expect(
      pruefeDokumenttextDeckung(
        lage({ consent: consent({ status: "revoked" }), riegelOffen: false }),
      ),
    ).toEqual({ gedeckt: false, grund: "kein_consent" });
    expect(pruefeDokumenttextDeckung(lage({ gedeckteConsentId: null }))).toEqual({
      gedeckt: false,
      grund: "kein_consent",
    });
    expect(pruefeDokumenttextDeckung(lage({ gedeckteConsentId: "c-anders" }))).toEqual({
      gedeckt: false,
      grund: "consent_abweichend",
    });
  });

  it("R2e · bei offenem Riegel: die Klasse muss AUSDRÜCKLICH erteilt sein, für GENAU dieses Dokument", () => {
    expect(
      pruefeDokumenttextDeckung(
        lage({ consent: consent({ allowedPayloadClasses: ["question", "candidate_texts"] }) }),
      ),
    ).toEqual({ gedeckt: false, grund: "klasse_nicht_erteilt" });
    expect(pruefeDokumenttextDeckung(lage({ documentContextId: "doc-2" }))).toEqual({
      gedeckt: false,
      grund: "dokument_abweichend",
    });
  });
});

// ------------------------------------------------------------------------------------------------
// R3/R4 · DER GANZE WEG: SITZUNGSDIENST, ROUTE, FRAGEDIENST, REASONER, ECHTER PROMPT
// ------------------------------------------------------------------------------------------------
interface Weg {
  app: FastifyInstance;
  dienst: KlaraSessionService;
  repo: InMemoryKlaraSessionRepo;
  sitzung: string;
  bindung: { actorId: string; addinInstanceId: string; documentContextId: string };
  kopf: Record<string, string>;
  /** Jeder Nutzer-Prompt, der den Modellclient erreicht hat. */
  prompts: string[];
  /** Jede rohe Protokollzeile der App. */
  protokoll: string[];
  /** Die Protokollzeilen der Dokumenttext-Entscheidung. */
  entscheidungen: () => { entscheidung: string; grund?: string }[];
}

async function wegAufbauen(
  opt: { riegelOffen?: boolean; ohneConsent?: boolean } = {},
): Promise<Weg> {
  const prompts: string[] = [];
  const client: ModelClient = {
    name: "cloud:mitschreiber",
    complete: async (_system: string, user: string) => {
      prompts.push(user);
      return "Die Dichtung wird nach Verfahren gewechselt [1].";
    },
    completeVision: async () => "",
  };
  const reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(reasoner);
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  await koService.create({
    title: "Zylinderkopfdichtung XQ42 wechseln",
    statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet und gereinigt.",
    type: "best_practice",
    category: "Betrieb",
    author: "anna",
  });
  const ask = new AskService({
    reasoner,
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  const repo = new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => CLOUD_LAGE,
    ...(opt.riegelOffen ? { dokumenttextRiegelOffen: true } : {}),
  });

  const zeilen: string[] = [];
  const app = Fastify({
    logger: { level: "info", stream: { write: (z: string) => zeilen.push(z) } },
  });
  const guards = {
    requireUser: async () => ({ id: "nutzer-1", role: "admin" }),
    requirePermission: async () => ({ id: "nutzer-1", role: "admin" }),
  } as never;
  const basis = { ask, ko: koService, conflicts: { unresolved: async () => [] } as never };
  // R-0700: Klaras eigener Zugang trägt die Markierung und die Dokumenttext-Prüfung; der allgemeine
  // Frageweg steht daneben, damit R4d seine Abweisung am selben Aufbau misst.
  app.register(askRoutes(basis, guards));
  app.register(klaraAusfuehrungRoutes({ ...basis, klaraSessions: dienst }, guards));
  await app.ready();
  const sicht = await dienst.createSession("nutzer-1", "inst-1", {
    kind: "saved",
    hostDocumentId: "doc-abc",
  });
  const bindung = {
    actorId: "nutzer-1",
    addinInstanceId: "inst-1",
    documentContextId: sicht.documentContextId,
  };
  if (!opt.ohneConsent) {
    await dienst.grantConsent(sicht.sessionId, bindung);
  }
  return {
    app,
    dienst,
    repo,
    sitzung: sicht.sessionId,
    bindung,
    kopf: {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": "inst-1",
      "x-klara-document": sicht.documentContextId,
    },
    prompts,
    protokoll: zeilen,
    entscheidungen: () =>
      zeilen
        .map(
          (z) => JSON.parse(z) as { msg?: string; ka4?: { entscheidung: string; grund?: string } },
        )
        .filter((z) => z.msg === "ask.ka4.dokumenttext")
        .map((z) => ({
          entscheidung: z.ka4?.entscheidung ?? "",
          ...(z.ka4?.grund ? { grund: z.ka4.grund } : {}),
        })),
  };
}

const fragen = (w: Weg, rumpf: Record<string, unknown> = {}) =>
  w.app.inject({
    method: "POST",
    url: `/api/klara/sessions/${w.sitzung}/execute`,
    headers: { ...w.kopf, "content-type": "application/json" },
    payload: {
      question: FRAGE,
      locale: "de",
      mode: "retrieval-only",
      selection: MARKIERUNG,
      // Runde 3: mit Klara-Bindung ist eine Frage nur getippt, wenn sie es ausdrücklich sagt.
      questionSource: "manual",
      ...rumpf,
    },
  });

describe("R-0639 · R3 — der Sitzungsdienst: zwei Tore hintereinander", () => {
  it("R3a · PRODUKTSTAND: der Antwortweg ist frei, der Dokumenttext nicht — Grund `riegel_aus`", async () => {
    const w = await wegAufbauen();
    // Die Kalibrierung: es ist NICHT der Modus und NICHT die Zustimmung, die hier aufhalten.
    const antwortweg = await w.dienst.pruefeExterneAusfuehrung(w.sitzung, w.bindung);
    expect(antwortweg.erlaubt).toBe(true);
    if (antwortweg.erlaubt) {
      expect(antwortweg.resolution.effectiveMode).toBe("external");
      expect(antwortweg.resolution.effectivePayloadClasses).not.toContain("document_text");
    }
    expect(
      await w.dienst.pruefeDokumenttextFreigabe(w.sitzung, w.bindung, { vertraulich: false }),
    ).toEqual({ erlaubt: false, grund: "riegel_aus" });
    await w.app.close();
  });

  it("R3b · GEGENPROBE: derselbe Aufbau mit offenem Riegel — erteilt, die Zustimmung nennt die Klasse", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    const consent = await w.repo.findConsent(w.sitzung);
    expect(consent?.allowedPayloadClasses).toContain("document_text");
    expect(
      await w.dienst.pruefeDokumenttextFreigabe(w.sitzung, w.bindung, { vertraulich: false }),
    ).toEqual({ erlaubt: true });
    await w.app.close();
  });

  it("R3c · vertraulich bleibt draussen, auch bei offenem Riegel", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    expect(
      await w.dienst.pruefeDokumenttextFreigabe(w.sitzung, w.bindung, { vertraulich: true }),
    ).toEqual({ erlaubt: false, grund: "vertraulich" });
    await w.app.close();
  });

  it("R3d · ohne Zustimmung sagt der Grund, dass schon der Antwortweg zu ist — nicht der Riegel", async () => {
    const w = await wegAufbauen({ riegelOffen: true, ohneConsent: true });
    const ergebnis = await w.dienst.pruefeDokumenttextFreigabe(w.sitzung, w.bindung, {
      vertraulich: false,
    });
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toMatch(/^antwortweg:/);
    await w.app.close();
  });

  it("R3e · eine Zustimmung von VOR dem Öffnen des Riegels deckt den Dokumenttext nicht", async () => {
    // Erteilt unter geschlossenem Riegel (Klassen ohne document_text) …
    const vorher = await wegAufbauen();
    const alt = await vorher.repo.findConsent(vorher.sitzung);
    expect(alt?.allowedPayloadClasses).not.toContain("document_text");
    // … und danach von einem Dienst mit offenem Riegel geprüft: der Antwortweg verlangt eine neue
    // Bestätigung, weil die Auflösung jetzt mehr ausweist, als die Zustimmung nennt.
    const nachher = new KlaraSessionService({
      repo: vorher.repo,
      policy: () => CLOUD_LAGE,
      dokumenttextRiegelOffen: true,
    });
    const ergebnis = await nachher.pruefeDokumenttextFreigabe(vorher.sitzung, vorher.bindung, {
      vertraulich: false,
    });
    expect(ergebnis).toEqual({
      erlaubt: false,
      grund: "antwortweg:CONSENT_RECONFIRMATION_REQUIRED",
    });
    await vorher.app.close();
  });
});

describe("R-0639 · R4 — am Draht: was den Modellclient WIRKLICH erreicht", () => {
  it("R4a · PRODUKTSTAND: das Modell WIRD gerufen, die Markierung steht NICHT im Prompt", async () => {
    const w = await wegAufbauen();
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    // Kalibrierung gegen „ein Betriebsmodus ohne Modell": der externe Aufruf fand statt.
    expect(w.prompts.length).toBeGreaterThan(0);
    expect(w.prompts.join("\n")).toContain(FRAGE);
    expect(w.prompts.join("\n")).not.toContain(MARKER);
    // Und der Grund, aus dem sie fehlt, steht im Protokoll: der Riegel.
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "riegel_aus" }]);
    await w.app.close();
  });

  it("R4b · GEGENPROBE: einzig der Riegel geöffnet — die Markierung steht benannt im Prompt", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    const prompt = w.prompts.join("\n");
    expect(prompt).toContain(MARKER);
    // Benannt und VOR den Quellen, ohne Quellennummer — Kontext, keine zitierbare Quelle.
    expect(prompt).toContain("Markierte Passage im Dokument (Kontext der Frage, keine Quelle):");
    expect(prompt.indexOf(MARKER)).toBeLessThan(prompt.indexOf("Quellen:"));
    expect(prompt).not.toMatch(/\[\d+\][^\n]*Drehmoment 38 Nm/);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "freigegeben" }]);
    await w.app.close();
  });

  it("R4c · offener Riegel, Passage als vertraulich markiert: das Modell läuft, die Passage bleibt draussen", async () => {
    for (const stufe of ["vertraulich", "streng_vertraulich", "Vertraulich", "unbekannt"]) {
      const w = await wegAufbauen({ riegelOffen: true });
      await fragen(w, { selectionConfidentiality: stufe });
      expect(w.prompts.length, stufe).toBeGreaterThan(0);
      expect(w.prompts.join("\n"), stufe).not.toContain(MARKER);
      expect(w.entscheidungen(), stufe).toEqual([
        { entscheidung: "blockiert", grund: "vertraulich" },
      ]);
      await w.app.close();
    }
  });

  it("R4d · offener Riegel, ohne Klara-Bindung (Kopfzeilen fehlen): nichts geht hinaus, nichts wird gefragt", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    const res = await w.app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { "content-type": "application/json" },
      payload: { question: FRAGE, locale: "de", mode: "retrieval-only", selection: MARKIERUNG },
    });
    // R-0700: der allgemeine Frageweg nimmt die Markierung gar nicht mehr an (400) — schärfer als
    // die frühere Enge, und mit derselben Zusage: kein Modellaufruf, keine Dokumenttext-Frage.
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("KLARA_EIGENER_WEG");
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([]);
    await w.app.close();
  });

  it("R4e · keine Protokollzeile der App trägt die Passage — auch nicht bei Freigabe", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    await fragen(w);
    expect(w.entscheidungen()).toHaveLength(1);
    expect(w.protokoll.length).toBeGreaterThan(0);
    expect(w.protokoll.join("\n")).not.toContain(MARKER);
    await w.app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// R5 · BENS BEFUND B1 (Runde 1): DIE ECHTEN WORD-EINSTIEGE, UNVERÄNDERT AUSGEFÜHRT
// ------------------------------------------------------------------------------------------------
//
// R1 bis R4 bauten den Rumpf selbst — mit getrennter `question` und `selection`. Das Aufgabenfenster
// tut das auf zwei Wegen NICHT: „Klara fragen" bei leerem Eingabefeld macht die Markierung zur
// Frage (`prepareAskQuestion`, Lage `selection`), und ein Zuruf über einer Markierung schickt sie
// im Fragetext (`ka6Absenden`). Ben hat gezeigt, dass genau diese Wege am Riegel vorbeiliefen.
//
// HIER LAUFEN DIE AUSGELIEFERTEN FUNKTIONEN SELBST: `askKlara` und `ka6Absenden` werden aus
// `taskpane.html` geschnitten und mit dem echten Hilfsblock (`prepareAskQuestion`, `performAsk`)
// ausgeführt. Ersetzt sind nur Hostzugriffe (Word-Markierung, DOM, Wörterbuch, Anzeige) und der
// Transport: `fetch` geht über `app.inject` an die ECHTE Route aus `wegAufbauen`.
// R-1611: das Fenster liegt in drei Dateien; geschnitten wird aus dem zusammengefügten Dokument.
const TASKPANE = panelQuelleAus(resolve(WURZEL, "apps/web/public/word-addin/taskpane.html"));

/** Schneidet `function <name>(…) { … }` aus — mit Klammerzählung über Strings und Kommentare. */
function funktionsquelle(name: string): string {
  const start = TASKPANE.indexOf(`function ${name}(`);
  if (start < 0) {
    throw new Error(`function ${name} fehlt in taskpane.html`);
  }
  let tiefe = 0;
  let i = TASKPANE.indexOf("{", start);
  for (; i < TASKPANE.length; i += 1) {
    const z = TASKPANE[i];
    const weiter = TASKPANE.slice(i, i + 2);
    if (weiter === "//") {
      i = TASKPANE.indexOf("\n", i);
      continue;
    }
    if (weiter === "/*") {
      i = TASKPANE.indexOf("*/", i) + 1;
      continue;
    }
    if (z === '"' || z === "'") {
      let j = i + 1;
      while (TASKPANE[j] !== z) {
        j += TASKPANE[j] === "\\" ? 2 : 1;
      }
      i = j;
      continue;
    }
    if (z === "{") tiefe += 1;
    if (z === "}") {
      tiefe -= 1;
      if (tiefe === 0) return TASKPANE.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name}: Ende nicht gefunden`);
}

const HILFSBLOCK = TASKPANE.slice(
  TASKPANE.indexOf("// KW-WORDADDIN-HELPERS-START"),
  TASKPANE.indexOf("// KW-WORDADDIN-HELPERS-END"),
);

/** Ein `fetch`, der an die echte Route geht — der einzige ersetzte Transport. */
function fetchAn(app: FastifyInstance, laeufe: Promise<unknown>[]) {
  return (url: string, init: { headers: Record<string, string>; body: string }) => {
    const lauf = antworten(app, url, init);
    laeufe.push(lauf);
    return lauf;
  };
}

async function antworten(
  app: FastifyInstance,
  url: string,
  init: { headers: Record<string, string>; body: string },
) {
  {
    const res = await app.inject({
      method: "POST",
      url,
      headers: init.headers,
      payload: init.body,
    });
    return {
      status: res.statusCode,
      ok: res.statusCode >= 200 && res.statusCode < 300,
      headers: { get: (n: string) => res.headers[n.toLowerCase()] ?? null },
      json: async () => JSON.parse(res.body) as unknown,
    };
  }
}

/**
 * Führt einen Einstieg des Fensters aus. Die Hostattrappen stehen in EINEM Objekt, das per `with`
 * vor den Bereich der Funktionen gelegt wird — so laufen die geschnittenen Funktionen Zeichen für
 * Zeichen, wie sie ausgeliefert sind. `performAsk` ist der ECHTE aus dem Hilfsblock; gezählt und
 * abgewartet wird am Transport (`fetch`).
 */
async function einstiegAusfuehren(
  w: Weg,
  einstieg: "askKlara" | "ka6Absenden",
  eingabefeld: string,
  markierung: string,
): Promise<void> {
  const laeufe: Promise<unknown>[] = [];
  const feld = (wert = "") => ({ value: wert, className: "", disabled: false, textContent: "" });
  const felder: Record<string, ReturnType<typeof feld>> = {
    "ask-input": feld(eingabefeld),
  };
  const leer = () => undefined;
  const host: Record<string, unknown> = {
    document: {
      getElementById: (id: string) => {
        felder[id] = felder[id] ?? feld();
        return felder[id];
      },
    },
    window: { fetch: fetchAn(w.app, laeufe) },
    fetch: fetchAn(w.app, laeufe),
    readAskSelection: (rueckruf: (text: string) => void) => rueckruf(markierung),
    klaraS4Header: () => w.kopf,
    klaraS4FragenGesperrt: () => false,
    t: (schluessel: string) => schluessel,
    lang: "de",
    askLaeuft: false,
    currentAskQuestion: "",
    currentAskOutcome: null,
    resetAskResult: leer,
    showAskStatus: leer,
    updateAskState: leer,
    askWartezustand: leer,
    renderAskOutcome: leer,
    ka6Laeuft: false,
    ka6KiFormuliert: false,
    ka6VorschlagAktiv: false,
    ka6Lage: () => ({ erlaubt: true }),
    ka6Zeichnen: leer,
    ka6Meldung: leer,
    ka6KnopfzustandZurueck: leer,
    ka6KopierknopfOeffnen: leer,
    applyAnswerCompaction: leer,
  };
  const fabrik = new Function(
    "host",
    `with (host) {
       ${HILFSBLOCK}
       ${funktionsquelle("ka6Zurufgrundlage")}
       ${funktionsquelle("askKlara")}
       ${funktionsquelle("ka6Absenden")}
       return { askKlara: askKlara, ka6Absenden: ka6Absenden };
     }`,
  );
  const fenster = fabrik(host) as {
    askKlara: () => void;
    ka6Absenden: (art: { auftrag: string }) => void;
  };
  if (einstieg === "askKlara") {
    fenster.askKlara();
  } else {
    fenster.ka6Absenden({ auftrag: "ka6AuftragUmformulieren" });
  }
  expect(laeufe.length, `${einstieg}: kein Abruf ist abgegangen`).toBe(1);
  await Promise.all(laeufe);
  // Die `.then`-Zweige von `performAsk` und der Einstiege laufen danach — einige Takte abwarten.
  for (let takt = 0; takt < 5; takt += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("R-0639 · R5 — Bens Befund B1: die Markierung als Frage bleibt hinter dem Riegel", () => {
  it("R5a · KALIBRIERUNG: getippte Frage über `askKlara` — das Modell WIRD gerufen, ohne Markierung", async () => {
    const w = await wegAufbauen();
    await einstiegAusfuehren(w, "askKlara", FRAGE, MARKIERUNG);
    expect(w.prompts.length).toBe(1);
    expect(w.prompts[0]).toContain(FRAGE);
    expect(w.prompts[0]).not.toContain(MARKER);
    await w.app.close();
  });

  it("R5b · `askKlara` bei LEEREM Eingabefeld: die Markierung ist die Frage und erreicht das Modell NICHT", async () => {
    const w = await wegAufbauen();
    await einstiegAusfuehren(w, "askKlara", "", MARKIERUNG);
    expect(w.prompts.join("\n")).not.toContain(MARKER);
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "riegel_aus" }]);
    await w.app.close();
  });

  it("R5c · `ka6Absenden` über einer Markierung: der Zuruf erreicht das Modell NICHT", async () => {
    const w = await wegAufbauen();
    await einstiegAusfuehren(w, "ka6Absenden", "", MARKIERUNG);
    expect(w.prompts.join("\n")).not.toContain(MARKER);
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "riegel_aus" }]);
    await w.app.close();
  });

  it("R5d · GEGENPROBE: dieselben zwei Einstiege mit einzig geöffnetem Riegel — die Markierung geht hinaus", async () => {
    for (const einstieg of ["askKlara", "ka6Absenden"] as const) {
      const w = await wegAufbauen({ riegelOffen: true });
      await einstiegAusfuehren(w, einstieg, "", MARKIERUNG);
      expect(w.prompts.join("\n"), einstieg).toContain(MARKER);
      expect(w.entscheidungen(), einstieg).toEqual([{ entscheidung: "freigegeben" }]);
      await w.app.close();
    }
  });

  it("R5e · ein Zuruf OHNE Markierung (nur Eingabefeld) bleibt die zugestimmte Klasse `question`", async () => {
    const w = await wegAufbauen();
    await einstiegAusfuehren(w, "ka6Absenden", FRAGE, "");
    expect(w.prompts.length).toBe(1);
    expect(w.entscheidungen()).toEqual([]);
    await w.app.close();
  });
});

describe("R-0639 · R6 — die Herkunft der Frage an der Route, fail-closed", () => {
  it("R6a · jeder Wert ausser „fehlt“ und `manual` zählt als Dokumenttext", async () => {
    for (const herkunft of ["selection", "Selection", "dokument", ""]) {
      const w = await wegAufbauen();
      const res = await w.app.inject({
        method: "POST",
        url: `/api/klara/sessions/${w.sitzung}/execute`,
        headers: { ...w.kopf, "content-type": "application/json" },
        payload: {
          question: MARKIERUNG,
          locale: "de",
          mode: "retrieval-only",
          questionSource: herkunft,
        },
      });
      expect(res.statusCode, herkunft).toBe(200);
      expect(w.prompts, herkunft).toEqual([]);
      await w.app.close();
    }
    const getippt = await wegAufbauen();
    await getippt.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${getippt.sitzung}/execute`,
      headers: { ...getippt.kopf, "content-type": "application/json" },
      payload: { question: FRAGE, locale: "de", mode: "retrieval-only", questionSource: "manual" },
    });
    expect(getippt.prompts.length).toBe(1);
    await getippt.app.close();
  });

  it("R6b · offener Riegel, aber als vertraulich markiert: die Markierung als Frage bleibt draussen", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    await w.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${w.sitzung}/execute`,
      headers: { ...w.kopf, "content-type": "application/json" },
      payload: {
        question: MARKIERUNG,
        locale: "de",
        mode: "retrieval-only",
        questionSource: "selection",
        selectionConfidentiality: "vertraulich",
      },
    });
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "vertraulich" }]);
    await w.app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// R7 · BENS BEFUNDE AUS RUNDE 2 — DER ALTE RUMPF UND DER RUMPF OHNE `mode`
// ------------------------------------------------------------------------------------------------
//
// B1: ein noch geladenes älteres Fenster schickt die Markierung als Frage OHNE `questionSource`.
//     Bis Runde 2 hiess „fehlt" getippt — die Markierung ging zum Modell.
// B2: ohne `mode` lief eine gebundene Anfrage am ganzen Klara-Zweig vorbei in den Konsolenweg —
//     auch mit `questionSource: "selection"` und `selectionConfidentiality: "vertraulich"`.
// Jeder Absagefall hat eine Gegenprobe, in der genau EIN Umstand anders ist.
// R-0700: MIT Bindung ist das Klaras eigener Zugang; OHNE Bindung der allgemeine Frageweg.
const rumpfFrage = (w: Weg, payload: Record<string, unknown>, mitBindung = true) =>
  w.app.inject({
    method: "POST",
    url: mitBindung ? `/api/klara/sessions/${w.sitzung}/execute` : "/api/ask",
    headers: { ...(mitBindung ? w.kopf : {}), "content-type": "application/json" },
    payload,
  });

describe("R-0639 · R7 — Bens Befunde B1/B2 aus Runde 2", () => {
  it("R7a · B1: der ALTE Rumpf (Markierung als Frage, ohne Herkunft) erreicht das Modell NICHT", async () => {
    const w = await wegAufbauen();
    const res = await rumpfFrage(w, { question: MARKIERUNG, locale: "de", mode: "retrieval-only" });
    expect(res.statusCode).toBe(200);
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "riegel_aus" }]);
    await w.app.close();
  });

  it("R7b · B1-GEGENPROBE: derselbe alte Rumpf, einzig der Riegel offen — die Markierung geht hinaus", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    await rumpfFrage(w, { question: MARKIERUNG, locale: "de", mode: "retrieval-only" });
    expect(w.prompts.join("\n")).toContain(MARKER);
    await w.app.close();
  });

  it('R7c · B1-KALIBRIERUNG: dieselbe Lage mit `questionSource: "manual"` — das Modell WIRD gerufen', async () => {
    const w = await wegAufbauen();
    await rumpfFrage(w, {
      question: FRAGE,
      locale: "de",
      mode: "retrieval-only",
      questionSource: "manual",
    });
    expect(w.prompts.length).toBe(1);
    await w.app.close();
  });

  it("R7d · B2: OHNE `mode`, Herkunft `selection`, vertraulich — kein Modellaufruf, auch bei offenem Riegel", async () => {
    for (const riegelOffen of [false, true]) {
      const w = await wegAufbauen({ riegelOffen });
      const res = await rumpfFrage(w, {
        question: MARKIERUNG,
        locale: "de",
        questionSource: "selection",
        selectionConfidentiality: "vertraulich",
      });
      expect(res.statusCode, `riegelOffen=${riegelOffen}`).toBe(200);
      expect(w.prompts, `riegelOffen=${riegelOffen}`).toEqual([]);
      expect(w.entscheidungen(), `riegelOffen=${riegelOffen}`).toEqual([
        { entscheidung: "blockiert", grund: "vertraulich" },
      ]);
      await w.app.close();
    }
  });

  it("R7e · B2: OHNE `mode` und OHNE Herkunft — der alte Rumpf ohne Modus bleibt ebenso hinter dem Riegel", async () => {
    const w = await wegAufbauen();
    await rumpfFrage(w, { question: MARKIERUNG, locale: "de" });
    expect(w.prompts).toEqual([]);
    expect(w.entscheidungen()).toEqual([{ entscheidung: "blockiert", grund: "riegel_aus" }]);
    await w.app.close();
  });

  it("R7f · B2-GEGENPROBE: ohne `mode`, Herkunft `selection`, NICHT vertraulich, Riegel offen — geht hinaus", async () => {
    const w = await wegAufbauen({ riegelOffen: true });
    await rumpfFrage(w, { question: MARKIERUNG, locale: "de", questionSource: "selection" });
    expect(w.prompts.join("\n")).toContain(MARKER);
    await w.app.close();
  });

  it("R7g · KONSOLE unverändert: ohne Bindung, ohne `mode`, ohne Herkunft — Modellweg wie bisher", async () => {
    const w = await wegAufbauen();
    await rumpfFrage(w, { question: FRAGE, locale: "de" }, false);
    expect(w.prompts.length).toBe(1);
    expect(w.entscheidungen()).toEqual([]);
    await w.app.close();
  });

  // R-0700: `questionSource` ist ein Klara-Feld — der allgemeine Frageweg weist es ab (400) statt
  // einzuengen. Die Zusage bleibt dieselbe: kein Modell.
  it('R7h · ohne Bindung, aber ausdrücklich `questionSource: "selection"` — abgewiesen, kein Modell', async () => {
    const w = await wegAufbauen();
    const res = await rumpfFrage(
      w,
      { question: MARKIERUNG, locale: "de", questionSource: "selection" },
      false,
    );
    expect(res.statusCode).toBe(400);
    expect(w.prompts).toEqual([]);
    await w.app.close();
  });
});
