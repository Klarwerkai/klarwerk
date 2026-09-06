// ================================================================================================
// JOB 3091 · M2 — DIE ROUTE `POST /api/klara/sessions/{id}/zuruf`: ohne Zustimmung 403, mit
// Zustimmung ein Entwurf mit Herkunft und Anbieter.
// ================================================================================================
//
// RED-FIRST (§6): vor diesem Auftrag gab es die Route nicht — `services/app/src/routes/
// klara-session-routes.ts` fehlte, jeder Fall hier scheiterte am Import. Gegenprobe (Rueckgabe):
// den `zuruf.schlageVor`-Aufruf in der Route durch eine feste Antwort ersetzen → R1 und R2b rot.
//
// WAS ECHT IST: `KlaraSessionService` mit echtem In-Memory-Repo (das Sitzungstor, das der Erzeuger
// FRAGT), `ZurufService` mit echtem `KoService`, die echte Route ueber Fastify `inject`. Ersetzt ist
// nur das Modell — an genau der Stelle, an der in Produktion die Cloud steht, schreibt hier eines
// mit und zaehlt (Bauform aus tests/output/ka6-zuruf.test.ts). Ein echter Cloud-Aufruf wird hier
// NICHT gefahren (§8.6).
//
// DER SCHALTER `KLARA_EXTERNAL_EXECUTION_MIGRATED` (JOB 3079): der Fall „mit Zustimmung → Entwurf"
// am ECHTEN Sitzungstor (R2) kann nur gruen sein, wenn er auf `true` steht — sonst blockiert die
// Aufloesung mit `external_not_migrated`, und das Tor sagt zu Recht nein. Auf einem Stand vor 3079
// wird R2 deshalb uebersprungen und E0 sagt das laut; die Abbildung der Route selbst (Freigabe →
// 200 mit Herkunft und Anbieter) misst R2b unabhaengig davon an einem bewilligenden Tor. Bauform:
// `services/app/src/routes/ka4-endzustand.test.ts` (`nurWennFreigegeben`).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import {
  type ZurufAntwort,
  type ZurufModell,
  formuliererAusModell,
  klaraZurufRoutes,
} from "../../services/app/src/routes/klara-session-routes";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { Ka6Einwilligungspruefer, ZurufAuftrag } from "../../services/output";
import {
  InMemoryKlaraSessionRepo,
  KLARA_EXTERNAL_EXECUTION_MIGRATED,
  type ReasonerPolicySource,
  type ReasonerTaskChoice,
} from "../../services/reasoner";

const AKTEUR = "nutzer-1";
const INSTANZ = "inst-1";
const T0 = Date.parse("2026-09-06T09:00:00.000Z");
const KO_ID = "ko-homeoffice";
const KO_TITEL = "Regelung Homeoffice";
const KO_AUSSAGE =
  "Homeoffice ist an bis zu zwei Tagen je Woche nach Absprache mit der Fuehrungskraft moeglich.";
const MEMO = "Memo: Homeoffice ist an bis zu zwei Tagen je Woche moeglich, nach Absprache.";
const AUFTRAG = "Formuliere ein kurzes Memo zu: Haben wir eine Regelung fuer Homeoffice?";

const CLOUD_ANBIETER = "anbieter-eins";
const CLOUD_MODELL = "modell-eins";

const CLOUD_LAGE: {
  choice: ReasonerTaskChoice;
  source: ReasonerPolicySource;
  effectiveAnswerProvider: "cloud" | "local" | "deterministic";
  cloudConfigured: boolean;
  localConfigured: boolean;
  providerLabel: string;
  modelLabel: string;
} = {
  choice: "cloud",
  source: "db",
  effectiveAnswerProvider: "cloud",
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: CLOUD_ANBIETER,
  modelLabel: CLOUD_MODELL,
};

const nurWennFreigegeben = KLARA_EXTERNAL_EXECUTION_MIGRATED ? it : it.skip;

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Personal",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  } as KnowledgeObject;
}

/** Das Modell, das mitschreibt und zaehlt — „nichts ging hinaus" ist hier eine Messung. */
function modellSpion(antwort = MEMO) {
  const aufrufe: { system: string; user: string; confidential: boolean; maxTokens?: number }[] = [];
  const modell: ZurufModell = {
    async complete(system, user, confidential, maxTokens) {
      aufrufe.push({
        system,
        user,
        confidential,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      });
      return antwort;
    },
  };
  return { modell, aufrufe };
}

/** Ein bewilligendes Tor MIT Aufloesung — so antwortet `KlaraSessionService` bei deckender Zustimmung. */
function torErlaubt(resolution?: { provider: string; model: string }): Ka6Einwilligungspruefer {
  return {
    async pruefeExterneAusfuehrung() {
      return resolution ? { erlaubt: true, resolution } : { erlaubt: true };
    },
  };
}

const guards = {
  requireUser: async () => ({ id: AKTEUR, role: "admin" }),
  requirePermission: async () => ({ id: AKTEUR, role: "admin" }),
} as never;

async function aufbau(
  opts: {
    sessions?: Ka6Einwilligungspruefer;
    modell?: ZurufModell | null;
    koStatus?: KnowledgeObject["status"];
  } = {},
) {
  const jetzt = T0;
  const repo = new InMemoryKoRepo();
  await repo.insert(
    ko({
      id: KO_ID,
      title: KO_TITEL,
      statement: KO_AUSSAGE,
      version: 3,
      status: opts.koStatus ?? "validiert",
    }),
  );
  const koService = new KoService({ repo });
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
    policy: () => CLOUD_LAGE,
    now: () => jetzt,
  });
  const spion = modellSpion();
  const modell = opts.modell === null ? undefined : (opts.modell ?? spion.modell);
  const app: FastifyInstance = Fastify();
  app.register(
    klaraZurufRoutes(
      { sessions: opts.sessions ?? dienst, ko: koService, ...(modell ? { modell } : {}) },
      guards,
    ),
  );
  await app.ready();
  const sicht = await dienst.createSession(AKTEUR, INSTANZ, {
    kind: "saved",
    hostDocumentId: "doc-abc",
  });
  const bindung = {
    actorId: AKTEUR,
    addinInstanceId: INSTANZ,
    documentContextId: sicht.documentContextId,
  };
  const kopf = { "x-klara-instance": INSTANZ, "x-klara-document": sicht.documentContextId };
  return {
    app,
    dienst,
    sicht,
    kopf,
    spion,
    zustimmen: () => dienst.grantConsent(sicht.sessionId, bindung),
    zuruf: (body: unknown, sessionId = sicht.sessionId, headers: Record<string, string> = kopf) =>
      app.inject({
        method: "POST",
        url: `/api/klara/sessions/${encodeURIComponent(sessionId)}/zuruf`,
        headers: { ...headers, "content-type": "application/json" },
        payload: JSON.stringify(body),
      }),
  };
}

const KOERPER = { art: "erstellen", text: AUFTRAG, koIds: [KO_ID] };

describe("JOB 3091 · E0 · die Lage des Schalters — laut, nicht still", () => {
  it(`KLARA_EXTERNAL_EXECUTION_MIGRATED = ${KLARA_EXTERNAL_EXECUTION_MIGRATED} → R2 am echten Tor ist ${KLARA_EXTERNAL_EXECUTION_MIGRATED ? "WIRKSAM" : "UEBERSPRUNGEN (Stand vor JOB 3079)"}`, () => {
    expect(typeof KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe("boolean");
  });
});

describe("JOB 3091 · R1 · ohne Zustimmung: 403 mit Grund, nie ein Entwurf", () => {
  it("die registrierte Sitzung OHNE Zustimmung bekommt 403 CONSENT_MISSING — und das Modell wird nicht gerufen", async () => {
    const k = await aufbau();
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode).toBe(403);
    const body = res.json() as Record<string, unknown>;
    expect(body.error).toBe("CONSENT_MISSING");
    expect(String(body.message)).toContain("Einwilligung");
    // Kein Entwurf — nicht einmal ein leeres Feld. „nie mit einem Entwurf" ist strukturell.
    expect(body).not.toHaveProperty("entwurf");
    expect(body).not.toHaveProperty("herkunft");
    expect(k.spion.aufrufe, "Das Modell wurde ohne Zustimmung gerufen").toHaveLength(0);
    await k.app.close();
  });

  it("eine fremde/unbekannte Sitzung ist dieselbe Absage (fail-closed) — kein Serverfehler, kein Modellaufruf", async () => {
    const k = await aufbau();
    const res = await k.zuruf(KOERPER, "sess-gibt-es-nicht");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("CONSENT_MISSING");
    expect(k.spion.aufrufe).toHaveLength(0);
    await k.app.close();
  });

  it("ohne Bindungskopfzeilen wird das Tor gar nicht erst gefragt: 403, kein Modellaufruf", async () => {
    const k = await aufbau();
    const res = await k.zuruf(KOERPER, k.sicht.sessionId, {});
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("CONSENT_MISSING");
    expect(k.spion.aufrufe).toHaveLength(0);
    await k.app.close();
  });
});

describe("JOB 3091 · R2 · mit Zustimmung: Entwurf, Herkunft nicht leer, Anbieter gesetzt", () => {
  nurWennFreigegeben(
    "am ECHTEN Sitzungstor: Zustimmung erteilt → 200 mit Entwurf, Herkunft (koId, titel, stufe, version), Anbieter/Modell der Aufloesung",
    async () => {
      const k = await aufbau();
      await k.zustimmen();
      const res = await k.zuruf(KOERPER);
      expect(res.statusCode, JSON.stringify(res.json())).toBe(200);
      const body = res.json() as ZurufAntwort;
      expect(body.entwurf).toBe(MEMO);
      expect(body.herkunft).toEqual([
        { koId: KO_ID, titel: KO_TITEL, stufe: "validiert", version: 3 },
      ]);
      expect(body.anbieter).toBe(CLOUD_ANBIETER);
      expect(body.modell).toBe(CLOUD_MODELL);
      expect(body.aiGenerated).toBe(true);
      expect(body.art).toBe("erstellen");
      // GENAU EIN Modellaufruf, mit dem Beleg und dem Auftrag — und als nicht-vertraulich deklariert
      // (Vertrauliches ist im Erzeuger bereits abgestreift).
      expect(k.spion.aufrufe).toHaveLength(1);
      const aufruf = k.spion.aufrufe[0];
      expect(aufruf?.user).toContain(KO_AUSSAGE);
      expect(aufruf?.user).toContain(KO_TITEL);
      expect(aufruf?.user).toContain(AUFTRAG);
      expect(aufruf?.confidential).toBe(false);
      await k.app.close();
    },
  );

  it("R2b · an einem bewilligenden Tor MIT Aufloesung: die Route bildet Freigabe → Entwurf, Herkunft, Anbieter ab — und kein Feld drueckt eine Schreibung aus", async () => {
    const k = await aufbau({ sessions: torErlaubt({ provider: "anbieter-x", model: "modell-y" }) });
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode, JSON.stringify(res.json())).toBe(200);
    const body = res.json() as ZurufAntwort;
    expect(body.entwurf).toBe(MEMO);
    expect(body.herkunft).toHaveLength(1);
    expect(body.herkunft[0]).toEqual({
      koId: KO_ID,
      titel: KO_TITEL,
      stufe: "validiert",
      version: 3,
    });
    expect(body.anbieter).toBe("anbieter-x");
    expect(body.modell).toBe("modell-y");
    expect(Object.keys(body).sort()).toEqual(
      ["aiGenerated", "anbieter", "art", "entwurf", "generatedAt", "herkunft", "modell"].sort(),
    );
    for (const verboten of [
      "insert",
      "apply",
      "target",
      "range",
      "write",
      "document",
      "position",
    ]) {
      expect(body).not.toHaveProperty(verboten);
    }
    expect(k.spion.aufrufe).toHaveLength(1);
    await k.app.close();
  });

  it("R2c · nennt das Tor keine Aufloesung, bleiben Anbieter und Modell `null` — kein Ersatzname", async () => {
    const k = await aufbau({ sessions: torErlaubt() });
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode).toBe(200);
    const body = res.json() as ZurufAntwort;
    expect(body.anbieter).toBeNull();
    expect(body.modell).toBeNull();
    expect(body.entwurf).toBe(MEMO);
    await k.app.close();
  });
});

describe("JOB 3091 · R3 · ehrliche Absagen — je Lage ein Code, nie ein erfundener Text", () => {
  it("leerer Auftragstext → 400 NO_INPUT; fehlende koIds → 400 NO_INPUT; unbekannte Art → 400 UNKNOWN_ART; nichts geht hinaus", async () => {
    const k = await aufbau({ sessions: torErlaubt({ provider: "a", model: "m" }) });
    const leer = await k.zuruf({ ...KOERPER, text: "   " });
    expect(leer.statusCode).toBe(400);
    expect(leer.json().error).toBe("NO_INPUT");
    const ohneQuelle = await k.zuruf({ art: "erstellen", text: AUFTRAG });
    expect(ohneQuelle.statusCode).toBe(400);
    expect(ohneQuelle.json().error).toBe("NO_INPUT");
    const leereQuellen = await k.zuruf({ ...KOERPER, koIds: [] });
    expect(leereQuellen.statusCode).toBe(400);
    const art = await k.zuruf({ ...KOERPER, art: "loeschen" });
    expect(art.statusCode).toBe(400);
    expect(art.json().error).toBe("UNKNOWN_ART");
    expect(k.spion.aufrufe).toHaveLength(0);
    await k.app.close();
  });

  it("das Modell liefert nichts → 422 NO_BASIS („Erfunden wird nichts“), kein Entwurf", async () => {
    const leer = modellSpion("   ");
    const k = await aufbau({
      sessions: torErlaubt({ provider: "a", model: "m" }),
      modell: leer.modell,
    });
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("NO_BASIS");
    expect(res.json()).not.toHaveProperty("entwurf");
    expect(leer.aufrufe).toHaveLength(1);
    await k.app.close();
  });

  it("die gewaehlte Quelle ist NICHT validiert → sie faellt im Erzeuger heraus, das Modell wird ohne Beleg gar nicht gerufen → 422 NO_BASIS", async () => {
    const k = await aufbau({
      sessions: torErlaubt({ provider: "a", model: "m" }),
      koStatus: "offen",
    });
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("NO_BASIS");
    // `formuliererAusModell` ruft das Modell ohne Belege NICHT — eine freie Formulierung ist nicht,
    // was „Memo aus dieser Quelle" verspricht.
    expect(k.spion.aufrufe).toHaveLength(0);
    await k.app.close();
  });

  it("kein Modell verdrahtet → 503 NO_FORMULIERER, ehrlich statt erfunden", async () => {
    const k = await aufbau({ sessions: torErlaubt({ provider: "a", model: "m" }), modell: null });
    const res = await k.zuruf(KOERPER);
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("NO_FORMULIERER");
    await k.app.close();
  });
});

describe("JOB 3091 · R4 · der Formulierer ueber dem Modell", () => {
  it("baut GENAU EINEN Aufruf: Auflage im Systemtext, Belege und Auftrag im Nutzertext, nicht vertraulich, gedeckelt", async () => {
    const spion = modellSpion("Text");
    const f = formuliererAusModell(spion.modell);
    const auftrag: ZurufAuftrag = {
      art: "erstellen",
      text: AUFTRAG,
      belege: [{ koId: KO_ID, title: KO_TITEL, text: KO_AUSSAGE }],
    };
    expect(await f.formuliere(auftrag)).toBe("Text");
    expect(spion.aufrufe).toHaveLength(1);
    const a = spion.aufrufe[0];
    expect(a?.system).toContain("ausschließlich aus den mitgegebenen Belegen");
    expect(a?.system).toContain("leeren Zeile");
    expect(a?.user).toContain(`[1] ${KO_TITEL}`);
    expect(a?.user).toContain(KO_AUSSAGE);
    expect(a?.user).toContain(AUFTRAG);
    expect(a?.confidential).toBe(false);
    expect(a?.maxTokens).toBeGreaterThan(0);
  });

  it("ohne Belege wird das Modell NICHT gerufen und die Antwort ist leer (→ NO_BASIS im Erzeuger)", async () => {
    const spion = modellSpion("erfunden");
    const f = formuliererAusModell(spion.modell);
    expect(await f.formuliere({ art: "erstellen", text: AUFTRAG, belege: [] })).toBe("");
    expect(spion.aufrufe).toHaveLength(0);
  });
});

describe("JOB 3091 · R5 · keine zweite Wahrheit ueber die Bindungskopfzeilen", () => {
  it("klara-session-routes.ts fuehrt WOERTLICH dieselben Header-Namen wie klara-ai-routes.ts", () => {
    const lies = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
    const alt = lies("services/app/src/routes/klara-ai-routes.ts");
    const neu = lies("services/app/src/routes/klara-session-routes.ts");
    for (const name of ["INSTANCE_HEADER", "DOCUMENT_HEADER"]) {
      const re = new RegExp(`const ${name} = "([^"]+)";`);
      const a = re.exec(alt)?.[1];
      const n = re.exec(neu)?.[1];
      expect(a, `${name} fehlt in klara-ai-routes.ts`).toBeTruthy();
      expect(n, `${name} fehlt in klara-session-routes.ts`).toBe(a);
    }
    // Der Sitzungs-Header wird in der neuen Route bewusst NICHT gelesen — die Sitzung kommt aus dem Pfad.
    expect(neu).not.toMatch(/const SESSION_HEADER/);
  });
});
