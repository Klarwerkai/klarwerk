// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · BEN NACHARBEIT 3 — DER VERTRAULICHE WORD-DOKUMENTTEXT, GANZER WEG.
// ================================================================================================
//
// BENS BEFUND: „V5 belegt keinen erfolgreichen Word-Dokumenttextweg … Den positiven Word-Weg mit
// gültiger Dokumentzustimmung, passender Bindung und geöffnetem Dokumenttext-Riegel bis zum
// gekapselten Anbieter belegen, einschließlich übertragener Einstufung."
//
// DER AUFBAU ist der von `tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts` (R4b —
// Markierung mit offenem Riegel über `POST /api/ask` mit Klara-Bindung), mit zwei Unterschieden:
//   · der Modellclient ist GEKAPSELT wie im Betrieb (`cappedModelClient(…, { rejectsConfidential:
//     true })`); mitgeschrieben wird HINTER dem Wächter, samt dem Vertraulichkeitsbit;
//   · die Policyquelle des Sitzungsdienstes liest die Freigaben aus DEMSELBEN Reasoner, wie die
//     Kompositionswurzel (`build-app.ts`) es tut.
// ECHT: Sitzungsdienst, Route, Fragedienst, Reasoner, ModelProvider, Wächter. Ersetzt: nur der
// Netzaufruf.
//
//   W1  beide Freigaben, Zustimmung, Bindung, Riegel offen, Markierung VERTRAULICH → die Markierung
//       steht im Prompt beim Anbieter, und das Bit `confidential` kommt dort als `true` an;
//   W2  nur die Grundfreigabe → das Modell wird für die Frage gerufen, die Markierung NICHT
//       (Grund `vertraulich`);
//   W3  beide Freigaben, Riegel ZU → die Markierung bleibt draussen (Grund `riegel_aus`);
//   W4  beide Freigaben, OHNE Dokumentzustimmung → kein Modellaufruf überhaupt.
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { askRoutes } from "../../services/app/src/routes/ask-routes";
import { KlaraSessionService } from "../../services/app/src/services/klara-session-service";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  InMemoryKlaraSessionRepo,
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";
const MARKIERUNG =
  "Zylinderkopfdichtung XQ42 wechseln: laut Entwurf nur mit Drehmoment 38 Nm anziehen.";
const MARKER = "Drehmoment 38 Nm";

interface Aufruf {
  user: string;
  confidential: boolean;
}

interface Weg {
  app: FastifyInstance;
  kopf: Record<string, string>;
  aufrufe: Aufruf[];
  entscheidungen: () => { entscheidung: string; grund?: string }[];
}

async function wegAufbauen(opt: {
  freigabe: "grund" | "beide";
  riegelOffen: boolean;
  ohneConsent?: boolean;
}): Promise<Weg> {
  const aufrufe: Aufruf[] = [];
  const roh: ModelClient = {
    name: "anthropic:mitschreiber",
    complete: async (_system: string, user: string, confidential: boolean) => {
      aufrufe.push({ user, confidential });
      return "Die Dichtung wird nach Verfahren gewechselt [1].";
    },
  };
  const reasoner = new Reasoner(
    new ModelProvider(cappedModelClient(roh, { rejectsConfidential: true })),
  );
  if (opt.freigabe === "beide") {
    await erteileKiFreigabe(reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
  } else {
    await erteileKiFreigabe(reasoner);
  }
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
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
    // Wie die Kompositionswurzel: beide Freigaben aus DEMSELBEN Reasoner, frisch je Zugriff.
    policy: () => ({
      choice: "cloud" as const,
      source: "db" as const,
      effectiveAnswerProvider: "cloud" as const,
      cloudConfigured: true,
      localConfigured: false,
      providerLabel: "anthropic",
      modelLabel: "claude",
      zentralFreigegeben: reasoner.configStatus().taskConfig.kiFreigabe?.oeffentlicheKi === true,
      vertraulichFreigegeben: reasoner.vertraulicheAusleitungFreigegeben(),
    }),
    ...(opt.riegelOffen ? { dokumenttextRiegelOffen: true } : {}),
  });
  const zeilen: string[] = [];
  const app = Fastify({
    logger: { level: "info", stream: { write: (z: string) => zeilen.push(z) } },
  });
  app.register(
    askRoutes(
      {
        ask,
        ko: koService,
        conflicts: { unresolved: async () => [] } as never,
        klaraSessions: dienst,
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
  if (!opt.ohneConsent) {
    await dienst.grantConsent(sicht.sessionId, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: sicht.documentContextId,
    });
  }
  return {
    app,
    kopf: {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": "inst-1",
      "x-klara-document": sicht.documentContextId,
    },
    aufrufe,
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

const fragen = (w: Weg) =>
  w.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { ...w.kopf, "content-type": "application/json" },
    payload: {
      question: FRAGE,
      locale: "de",
      mode: "retrieval-only",
      selection: MARKIERUNG,
      selectionConfidentiality: "vertraulich",
      questionSource: "manual",
    },
  });

describe("gesamt-ki-freigaberegeln · vertraulicher Word-Dokumenttext bis zum gekapselten Anbieter", () => {
  it("W1 · beide Freigaben, Zustimmung, Bindung, Riegel offen: die Markierung erreicht den Anbieter als vertraulich", async () => {
    const w = await wegAufbauen({ freigabe: "beide", riegelOffen: true });
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    expect(w.aufrufe.length).toBeGreaterThan(0);
    const mitMarkierung = w.aufrufe.filter((a) => a.user.includes(MARKER));
    expect(mitMarkierung.length).toBeGreaterThan(0);
    // Die Einstufung reist bis zum Wächter und am Wächter vorbei bis zum Transport.
    for (const a of mitMarkierung) {
      expect(a.confidential).toBe(true);
    }
    expect(w.entscheidungen().filter((e) => e.entscheidung === "blockiert")).toEqual([]);
    await w.app.close();
  });

  it("W2 · nur die Grundfreigabe: die Frage geht hinaus, die vertrauliche Markierung nicht", async () => {
    const w = await wegAufbauen({ freigabe: "grund", riegelOffen: true });
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    expect(w.aufrufe.length).toBeGreaterThan(0);
    expect(w.aufrufe.map((a) => a.user).join("\n")).toContain(FRAGE);
    expect(w.aufrufe.map((a) => a.user).join("\n")).not.toContain(MARKER);
    expect(w.entscheidungen()).toContainEqual({ entscheidung: "blockiert", grund: "vertraulich" });
    await w.app.close();
  });

  it("W3 · beide Freigaben, Riegel zu: die Markierung bleibt draussen", async () => {
    const w = await wegAufbauen({ freigabe: "beide", riegelOffen: false });
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    expect(w.aufrufe.map((a) => a.user).join("\n")).not.toContain(MARKER);
    expect(w.entscheidungen()).toContainEqual({ entscheidung: "blockiert", grund: "riegel_aus" });
    await w.app.close();
  });

  it("W4 · beide Freigaben, ohne Dokumentzustimmung: kein Modellaufruf", async () => {
    const w = await wegAufbauen({ freigabe: "beide", riegelOffen: true, ohneConsent: true });
    const res = await fragen(w);
    expect(res.statusCode).toBe(200);
    expect(w.aufrufe).toEqual([]);
    await w.app.close();
  });
});
