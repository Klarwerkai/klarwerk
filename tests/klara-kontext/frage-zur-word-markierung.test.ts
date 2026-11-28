import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { klaraAusfuehrungRoutes } from "../../services/app/src/routes/ask-routes";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryKlaraSessionRepo, ModelProvider, Reasoner } from "../../services/reasoner";
import { ABSAGE_MARKE } from "../../services/reasoner/src/provider-model";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { panelQuelleAus } from "../support/panelquelle";

const PASSAGE = "Guest Wi-Fi must not provide access to the internal staff network";
const REGEL = `${PASSAGE}.`;
const BESTAND = `${REGEL} During handover, verify that a guest device can use the internet but cannot reach the internal staff service used for the test.`;
const panelQuelle = panelQuelleAus("apps/web/public/word-addin/taskpane.html");
function schnitt(von: string, bis: string) {
  const start = panelQuelle.indexOf(von);
  const ende = panelQuelle.indexOf(bis, start);
  expect(start).toBeGreaterThan(0);
  expect(ende).toBeGreaterThan(start);
  return panelQuelle.slice(start, ende);
}
const frageweg = [
  schnitt(
    "    function stripAskAnswerMarkdown(answer) {",
    "    // R-0310 (Spiegel von wordAddin.ts#askAbsaetzeLesen):",
  ),
  schnitt("    function askAbsaetzeLesen(body, cited) {", "    // AUFTRAG-JOB507-D4 — Retry-After"),
  schnitt("// KW-KLARA-AI-MARK-START", "// KW-KLARA-AI-MARK-END"),
  schnitt("// KW-KLARA-ASK-FETCH-START", "// KW-KLARA-ASK-FETCH-END"),
].join("\n");

// Echte Suchprojektion, Fragedienst und beide Auswahlstufen. Nur der externe Transport
// antwortet kontrolliert; die Tests behaupten damit keine Prüfung eines echten Modells.
async function aufbau(
  modellantwort = JSON.stringify({ urteil: "bestaetigt", belege: `${REGEL} [1]` }),
) {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  await ko.activateSearchProjectionV2();
  const quelle = await ko.create({
    title: "[Beispiel] Guest Wi-Fi separation",
    statement: BESTAND,
    type: "best_practice",
    category: "Technical",
    author: "peter",
    confidentiality: "intern",
  });
  await ko.setValidationState(quelle.id, { status: "validiert", trust: 90 });
  const aufrufe: { system: string; user: string; confidential: boolean }[] = [];
  const modell = new ModelProvider({
    name: "cloud:openai:test",
    complete: async (system, user, confidential) => {
      aufrufe.push({ system, user, confidential });
      return modellantwort;
    },
  });
  const reasoner = new Reasoner(modell);
  await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
  const ask = new AskService({ reasoner, koService: ko, gaps: new InMemoryGapRepo() });
  return { ask, ko, quelle, aufrufe };
}

const FREIGEGEBEN = {
  selection: PASSAGE,
  dokumenttextFreigegeben: true,
  validatedOnly: true,
} as const;

async function wordWeg(alt = false, modellantwort?: string) {
  const bestand = await aufbau(modellantwort);
  const repo = new InMemoryKlaraSessionRepo();
  const policy = () => ({
    choice: "cloud" as const,
    source: "db" as const,
    effectiveAnswerProvider: "cloud" as const,
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "openai",
    modelLabel: "test",
    zentralFreigegeben: true,
  });
  const sessions = new KlaraSessionService({ repo, policy, externeKiStandardAn: true });
  const anlage = alt
    ? new KlaraSessionService({ repo, policy, dokumenttextRiegelOffen: false })
    : sessions;
  const view = await anlage.createSession("peter", "word-test", {
    kind: "saved",
    hostDocumentId: "dokument-wlan",
  });
  const bindung = {
    actorId: "peter",
    addinInstanceId: "word-test",
    documentContextId: view.documentContextId,
  };
  const zustimmung = alt
    ? new KlaraSessionService({ repo, policy, dokumenttextRiegelOffen: false })
    : sessions;
  const app = Fastify();
  app.register(
    klaraAusfuehrungRoutes(
      {
        ask: bestand.ask,
        ko: bestand.ko,
        klaraSessions: sessions,
        conflicts: { unresolved: async () => [] } as never,
      },
      {
        requireUser: async () => ({ id: "peter", role: "admin" }),
        requirePermission: async () => ({ id: "peter", role: "admin" }),
      } as never,
    ),
  );
  await app.ready();
  const fragen = (selectionConfidentiality?: string) =>
    app.inject({
      method: "POST",
      url: `/api/klara/sessions/${view.sessionId}/execute`,
      headers: {
        "x-klara-session": view.sessionId,
        "x-klara-instance": bindung.addinInstanceId,
        "x-klara-document": bindung.documentContextId,
      },
      payload: {
        question: "is this correct",
        questionSource: "manual",
        selection: PASSAGE,
        locale: "en",
        mode: "retrieval-only",
        ...(selectionConfidentiality ? { selectionConfidentiality } : {}),
      },
    });
  return { ...bestand, app, repo, sessions, zustimmung, view, bindung, fragen };
}

describe("Klara: natürliche Frage zur freigegebenen Word-Markierung", () => {
  it("zeigt den offenen Vergleich nur bei einer Wissenslücke zur geprüften Passage", async () => {
    const abrufen = new Function(`${frageweg}; return performAsk;`)();
    const gap = { result: { answered: false, sources: [] } };
    async function pruefen(frage: string, body: unknown, status = 200, dokument = PASSAGE) {
      return abrufen(
        frage,
        "en",
        async () => ({ ok: status === 200, status, json: async () => body }),
        5000,
        { "x-klara-session": "s" },
        dokument,
        "manual",
      );
    }
    for (const frage of [
      "Is this correct according to company policy?",
      "Stimmt das?",
      "Klopt dit?",
    ]) {
      const ergebnis = await pruefen(frage, gap);
      expect(ergebnis.direktvergleich).toEqual({
        art: "offen",
        dokument: PASSAGE,
        belege: [],
        dokumentMarke: null,
        belegMarke: null,
      });
    }
    for (const frage of [
      "What does this paragraph mean?",
      "Is it correct that we open on Sundays?",
    ]) {
      expect((await pruefen(frage, gap)).direktvergleich).toBeUndefined();
    }
    expect((await pruefen("Is this correct?", gap, 200, "")).direktvergleich).toBeUndefined();
    expect(await pruefen("Is this correct?", {})).toEqual({ kind: "error", detail: "lage" });
    expect(await pruefen("Is this correct?", { result: {} })).toEqual({
      kind: "error",
      detail: "lage",
    });
    expect(await pruefen("Is this correct?", gap, 403)).toEqual({ kind: "forbidden" });
  });

  it("bindet Wortmarken an eine einzige wörtliche Quelle und eine enge Abweichung", () => {
    const vergleichen = new Function(`${frageweg}; return askDirektvergleich;`)();
    const dokument = "🗎 Guest Wi-Fi must provide access to the internal staff network.";
    const beleg = dokument.replace("must provide", "must not provide");
    const absaetze = [{ text: beleg, quellen: ["wifi"] }];
    const schritte = [{ sourceId: "wifi", snippet: beleg }];
    const exakt = vergleichen("widersprochen", dokument, absaetze, schritte, true);
    expect(exakt.quellfassungen).toBeUndefined();
    const zweiStaende = { wifi: 2, nichtZitiert: 9 };
    expect(
      vergleichen("widersprochen", dokument, absaetze, schritte, true, zweiStaende).quellfassungen,
    ).toEqual([{ id: "wifi", fassung: 2 }]);
    expect(
      vergleichen("widersprochen", dokument, absaetze, schritte, true, { wifi: 0 }).quellfassungen,
    ).toBeUndefined();
    expect(dokument.slice(exakt.dokumentMarke.start, exakt.dokumentMarke.end)).toBe("must provide");
    expect(beleg.slice(exakt.belegMarke.start, exakt.belegMarke.end)).toBe("not");
    for (const ergebnis of [
      vergleichen(
        "widersprochen",
        "Employees can share the guest network.",
        absaetze,
        schritte,
        true,
      ),
      vergleichen("widersprochen", dokument, absaetze, schritte, false),
      vergleichen("widersprochen", dokument, [absaetze[0], absaetze[0]], schritte, true),
    ]) {
      expect(ergebnis).toMatchObject({ dokumentMarke: null, belegMarke: null });
    }
    const fremd = vergleichen(
      "widersprochen",
      dokument,
      absaetze,
      [{ sourceId: "andere", snippet: beleg }],
      true,
    );
    expect(fremd.belege[0].woertlich).toBe(false);
    expect(fremd.dokumentMarke).toBeNull();
    const umformuliert = vergleichen(
      "widersprochen",
      dokument,
      absaetze,
      [{ sourceId: "wifi", snippet: beleg.replace("provide", "grant") }],
      true,
    );
    expect(umformuliert.belege[0].woertlich).toBe(false);
    expect(umformuliert.belegMarke).toBeNull();
  });

  it.each([
    { art: "bestaetigt", selection: PASSAGE, heading: "agrees with" },
    {
      art: "widersprochen",
      selection: "Guest Wi-Fi must provide access to the internal staff network",
      heading: "contradicts",
    },
  ])(
    "übersetzt das belegte Word-Urteil $art auch nach dem Abruf",
    async ({ art, selection, heading }) => {
      const w = await wordWeg(false, JSON.stringify({ urteil: art, belege: `${REGEL} [1]` }));
      try {
        const feld = { value: "" };
        const umgebung = {
          dokumentSprache: "de",
          selection,
          kopf: {
            "x-klara-session": w.view.sessionId,
            "x-klara-instance": w.bindung.addinInstanceId,
            "x-klara-document": w.bindung.documentContextId,
          },
          document: { getElementById: () => feld },
          passeAntwortfeldAn: () => {},
          askGradeOf: () => "unverified",
          setTimeout: () => 1,
          clearTimeout: () => undefined,
          AbortController,
          fetch: async (url: string, init: { headers: Record<string, string>; body: string }) => {
            const response = await w.app.inject({
              method: "POST",
              url,
              headers: init.headers,
              payload: init.body,
            });
            return {
              ok: response.statusCode === 200,
              status: response.statusCode,
              json: async () => response.json(),
            };
          },
        };
        const lesen = new Function(
          "umgebung",
          `with (umgebung) {
        ${frageweg}
        ${schnitt("    function askUrteilUebersetzen(", "    // Aufnahme 20260922 · antwort-quellenanzeige (R-0329): das hinterlegte Original")}
        let currentAskOutcome;
        let lang = dokumentSprache;
        return {
          frage: async () => currentAskOutcome = await performAsk("is this correct", lang, fetch, 5000, kopf, selection, "manual"),
          wechseln: (sprache) => { lang = sprache; askUebersetzeAktuellesUrteil(); }
        };
      }`,
        );
        const panel = lesen(umgebung);
        const sicht = await panel.frage();
        expect(sicht.kind).toBe("answered");
        const vergleich = sicht.direktvergleich;
        expect(vergleich).toMatchObject({
          art,
          dokument: selection,
          belege: [{ text: REGEL, quellen: [w.quelle.id], woertlich: true }],
          quellfassungen: [{ id: w.quelle.id, fassung: w.quelle.version }],
        });
        expect(selection.slice(vergleich.dokumentMarke.start, vergleich.dokumentMarke.end)).toBe(
          art === "widersprochen" ? "must provide" : selection,
        );
        expect(REGEL.slice(vergleich.belegMarke.start, vergleich.belegMarke.end)).toBe(
          art === "widersprochen" ? "not" : selection,
        );
        expect(sicht.answer).toContain("KI-Abgleich:");
        feld.value = sicht.answer;
        panel.wechseln("en");
        expect(feld.value).toBe(
          `AI comparison: the statement ${heading} the company sources consulted.\n\n${REGEL}`,
        );
        expect(sicht.absaetze.map((a: { quellen: string[] }) => a.quellen)).toEqual([
          [w.quelle.id],
          [w.quelle.id],
        ]);
        feld.value += "\nEigenes Ergebnis";
        panel.wechseln("nl");
        expect(feld.value).toBe(`${sicht.dokumentUrteil.texte.nl}\n\n${REGEL}\nEigenes Ergebnis`);
        feld.value = "Mein eigener erster Absatz.";
        panel.wechseln("de");
        expect(feld.value).toBe("Mein eigener erster Absatz.");
        expect(w.aufrufe).toHaveLength(1);
      } finally {
        await w.app.close();
      }
    },
  );
  it.each(["is this correct", "Ist das richtig?", "Klopt dit?"])(
    "%s erreicht das Modell mit Frage, Passage und bestätigter Quelle",
    async (frage) => {
      const { ask, quelle, aufrufe } = await aufbau();
      const { result } = await ask.ask(frage, "peter", "de", FREIGEGEBEN);
      expect(result.answered).toBe(true);
      expect(result.citedSources).toEqual([quelle.id]);
      expect(result.answer).toContain(REGEL);
      expect(result.answer).toContain("KI-Abgleich:");
      expect(aufrufe).toHaveLength(1);
      expect(aufrufe[0]?.user).toContain(`Frage: ${frage}\n`);
      expect(aufrufe[0]?.user).toContain(PASSAGE);
      expect(aufrufe[0]?.user).toContain(`[1] ${quelle.title}: ${BESTAND}`);
      expect(aufrufe[0]?.confidential).toBe(false);
    },
  );

  it("erhält ein negatives KI-Urteil statt es in dasselbe Quellenzitat umzudeuten", async () => {
    const { ask, quelle } = await aufbau(
      JSON.stringify({ urteil: "widersprochen", belege: `${REGEL} [1]` }),
    );
    const { result } = await ask.ask("is this correct", "peter", "en", {
      ...FREIGEGEBEN,
      selection: "Guest Wi-Fi must provide access to the internal staff network",
    });
    expect(result.answered).toBe(true);
    expect(result.answer).toContain("contradicts the company sources");
    expect(result.answer).not.toContain("agrees with");
    expect(result.citedSources).toEqual([quelle.id]);
  });

  it.each([
    JSON.stringify({
      urteil: "bestaetigt",
      belege: "Guest Wi-Fi must provide access to the internal staff network. [1]",
    }),
    JSON.stringify({ urteil: "bestaetigt", belege: "" }),
    JSON.stringify({ urteil: "bestaetigt", belege: "[1]" }),
    JSON.stringify({ urteil: "bestaetigt", belege: "[1]." }),
    JSON.stringify({ urteil: "bestaetigt", belege: "... [1]" }),
    JSON.stringify({ urteil: "offen", belege: `${REGEL} [1]` }),
    "Yes, this is correct.",
  ])("liefert ohne gültige, wörtlich gedeckte Belege kein Prüfungsurteil: %s", async (roh) => {
    const { ask } = await aufbau(roh);
    const { result } = await ask.ask("is this correct", "peter", "en", FREIGEGEBEN);
    expect(result.answered).toBe(false);
    expect(result.citedSources).toEqual([]);
  });

  it("erhält konkrete Einschränkungen der Frage unverändert für die KI", async () => {
    const frage = "Does this also allow access to the payroll database?";
    const { ask, aufrufe } = await aufbau(ABSAGE_MARKE);
    const { result } = await ask.ask(frage, "peter", "en", FREIGEGEBEN);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.user).toContain(`Question: ${frage}\n`);
    expect(result.answered).toBe(false);
    expect(result.citedSources).toEqual([]);
  });

  it("findet die Passage auch bei einer langen, frei formulierten Frage", async () => {
    const frage =
      "Please examine whether this wording accurately reflects our approved company policy and explain the applicable requirement.";
    const { ask, quelle, aufrufe } = await aufbau();
    const { result } = await ask.ask(frage, "peter", "en", FREIGEGEBEN);
    expect(result.citedSources).toEqual([quelle.id]);
    expect(aufrufe[0]?.user).toContain(`Question: ${frage}\n`);
  });

  it.each([
    { selection: PASSAGE, validatedOnly: true },
    { ...FREIGEGEBEN, retrievalOnly: true },
    { ...FREIGEGEBEN, selection: "" },
  ])("öffnet ohne freigegebenen Modellkontext keinen neuen Antwortweg: %j", async (opts) => {
    const { ask, aufrufe } = await aufbau();
    const { result } = await ask.ask("is this correct", "peter", "en", opts);
    expect(result.answered).toBe(false);
    expect(aufrufe).toEqual([]);
  });

  it("benutzt die Markierung nie als Firmenquelle", async () => {
    const { ask, aufrufe } = await aufbau();
    const { result } = await ask.ask("is this correct", "peter", "en", {
      ...FREIGEGEBEN,
      selection: "The payroll database is deleted every Friday.",
    });
    expect(result.answered).toBe(false);
    expect(aufrufe).toEqual([]);
  });

  it("behält Validierung und aktuelle Leserechte als Voraussetzungen", async () => {
    const { ask, ko, quelle, aufrufe } = await aufbau();
    const gesperrt = await ask.ask("is this correct", "peter", "en", FREIGEGEBEN, () => false);
    expect(gesperrt.result.answered).toBe(false);
    await ko.setValidationState(quelle.id, { status: "offen", trust: 30 });
    const offen = await ask.ask("is this correct", "peter", "en", FREIGEGEBEN);
    expect(offen.result.answered).toBe(false);
    expect(aufrufe).toEqual([]);
  });

  it("beantwortet am echten Word-Zugang standardmäßig ohne Zustimmungsabfrage", async () => {
    const w = await wordWeg();
    try {
      expect((await w.repo.findConsent(w.view.sessionId))?.allowedPayloadClasses).toContain(
        "document_text",
      );
      const mit = await w.fragen();
      expect(mit.statusCode).toBe(200);
      expect(mit.json().result.answered).toBe(true);
      expect(mit.json().result.sources).toEqual([w.quelle.id]);
      expect(w.view.resolution.externeKiStandardAn).toBe(true);
      expect(w.aufrufe).toHaveLength(1);
      expect(w.aufrufe[0]?.user).toContain(PASSAGE);
    } finally {
      await w.app.close();
    }
  });

  it("überführt alte Frage-Erlaubnisse in die neue Demo-Vorgabe", async () => {
    const w = await wordWeg(true);
    try {
      await w.zustimmung.grantConsent(w.view.sessionId, w.bindung);
      expect((await w.repo.findConsent(w.view.sessionId))?.allowedPayloadClasses).not.toContain(
        "document_text",
      );
      await w.fragen();
      expect(w.aufrufe).toHaveLength(1);
      const deckung = await w.sessions.pruefeDokumenttextFreigabe(w.view.sessionId, w.bindung, {
        vertraulich: false,
      });
      expect(deckung.erlaubt).toBe(true);
      expect((await w.repo.findConsent(w.view.sessionId))?.allowedPayloadClasses).toContain(
        "document_text",
      );
    } finally {
      await w.app.close();
    }
  });

  it("hält aktives Ausschalten auch über Statusabrufe wirksam", async () => {
    const w = await wordWeg();
    try {
      await w.sessions.revokeConsent(w.view.sessionId, w.bindung);
      await w.sessions.getSession(w.view.sessionId, w.bindung);
      const aus = await w.fragen();
      expect(aus.json().result.answered).toBe(false);
      expect(w.aufrufe).toEqual([]);
      expect((await w.repo.findSession(w.view.sessionId))?.consentState).toBe("revoked");
      await w.sessions.grantConsent(w.view.sessionId, w.bindung);
      expect((await w.fragen()).json().result.answered).toBe(true);
      expect(w.aufrufe).toHaveLength(1);
    } finally {
      await w.app.close();
    }
  });

  it("verliert Ausschalten bei mehrfachem Speichern und identischen Zeitstempeln nicht", async () => {
    let next = 1000;
    const sessions = new KlaraSessionService({
      repo: new InMemoryKlaraSessionRepo(),
      externeKiStandardAn: true,
      now: () => Date.parse("2026-11-24T10:00:00Z"),
      newId: () => String(--next).padStart(6, "0"),
      policy: () => ({
        choice: "cloud",
        source: "db",
        effectiveAnswerProvider: "cloud",
        cloudConfigured: true,
        localConfigured: false,
        providerLabel: "openai",
        modelLabel: "test",
        zentralFreigegeben: true,
      }),
    });
    const descriptor = { kind: "saved", hostDocumentId: "doc" } as const;
    const view = await sessions.createSession("peter", "word", descriptor);
    const bindung = {
      actorId: "peter",
      addinInstanceId: "word",
      documentContextId: view.documentContextId,
    };
    const gebunden = await sessions.rebindDocumentContext(view.sessionId, bindung, descriptor);
    expect(gebunden.resolution.executionAllowed).toBe(true);
    expect(gebunden.resolution.externeKiStandardAn).toBe(true);
    await sessions.revokeConsent(view.sessionId, bindung);
    const danach = await sessions.rebindDocumentContext(view.sessionId, bindung, descriptor);
    expect(danach.consentState).toBe("revoked");
    expect(danach.resolution.executionAllowed).toBe(false);
    expect((await sessions.pruefeExterneAusfuehrung(view.sessionId, bindung)).erlaubt).toBe(false);
  });

  it("überschreibt einen beim Aktivitätstouch gewonnenen Widerruf nicht", async () => {
    const repo = new InMemoryKlaraSessionRepo();
    let jetzt = Date.parse("2026-11-24T10:00:00Z");
    const deps = {
      repo,
      now: () => jetzt,
      policy: () => ({
        choice: "cloud" as const,
        source: "db" as const,
        effectiveAnswerProvider: "cloud" as const,
        cloudConfigured: true,
        localConfigured: false,
        providerLabel: "openai",
        modelLabel: "test",
        zentralFreigegeben: true,
      }),
    };
    const alt = new KlaraSessionService(deps);
    const view = await alt.createSession("peter", "word", { kind: "saved", hostDocumentId: "doc" });
    const bindung = {
      actorId: "peter",
      addinInstanceId: "word",
      documentContextId: view.documentContextId,
    };
    const neu = new KlaraSessionService({ ...deps, externeKiStandardAn: true });
    jetzt += 120_000;
    const touch = repo.touchSession.bind(repo);
    let widerrufen = false;
    repo.touchSession = async (...args) => {
      if (!widerrufen) {
        widerrufen = true;
        await neu.revokeConsent(view.sessionId, bindung);
      }
      return touch(...args);
    };
    const stand = await neu.getSession(view.sessionId, bindung);
    expect(widerrufen).toBe(true);
    expect(stand.consentState).toBe("revoked");
    expect(stand.resolution.executionAllowed).toBe(false);
  });

  it("gibt vertraulich markierte Passagen ohne zweite Adminfreigabe nicht weiter", async () => {
    const w = await wordWeg();
    try {
      await w.zustimmung.grantConsent(w.view.sessionId, w.bindung);
      await w.fragen("vertraulich");
      expect(w.aufrufe).toEqual([]);
    } finally {
      await w.app.close();
    }
  });
});
