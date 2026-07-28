// RT-001 (bens Sammel-Review 3, GRÜN-Bedingung): der ECHTE Providerpfad wird durchlaufen —
//   Providerfehler → judge*Outcome (echter Reasoner) → createAiCheckRunner → aiCheck-Outcome.
// KEIN künstlicher `run`-Callback mehr: der Fehler nimmt genau den Weg, den ein echter Providerfehler
// nimmt. Der Reasoner-Ausgang trägt jetzt eine anbieterneutrale, strukturierte Fehlerklasse
// (providerFailure), aus der der Runner die FEINE Ursache bildet — nicht mehr pauschal „model-error".
// Geprüft: 401→auth, 429→rate-limit, Netzwerk/5xx→unreachable, Parsefehler→bad-response,
// unbekannter Rückfall→model-error. Plus: kein Anbietername/Key/Token/Endpunkt/Rohtext im Ausgang
// oder im sichtbaren Text (DE/EN/NL).
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { aiCheckFailureReasonKey } from "../../apps/web/src/lib/aiCheckStatusCard";
import {
  type AiCheckRunOutcome,
  createAiCheckRunner,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { type ModelClient, ModelHttpError, ModelProvider, Reasoner } from "../../services/reasoner";

// Ein Client, dessen complete() bei JEDEM Aufruf (Konflikt- UND Duplikat-Judge) denselben Fehler wirft
// — so nimmt der Fehler den echten judge*Outcome-Weg. Für den „unbekannten Rückfall" liefert er
// stattdessen unparsebaren Text (parse → null, KEIN Wurf) → ehrlich „model-error".
function throwingClient(make: () => never): ModelClient {
  return {
    name: "spy-throw",
    complete: async () => make(),
  } as unknown as ModelClient;
}

function garbageClient(): ModelClient {
  return {
    name: "spy-garbage",
    complete: async () => "kein gueltiges json {{{",
  } as unknown as ModelClient;
}

async function makeKo(services: AppServices, title: string, statement: string) {
  return services.ko.create({
    type: "best_practice",
    category: "K",
    author: "u1",
    title,
    statement,
  });
}

function runnerFor(services: AppServices) {
  return createAiCheckRunner({
    ko: services.ko,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
    overlapSettings: services.overlapSettings,
    reasoner: services.reasoner,
  });
}

// Ein Bestands-KO + ein zweites, INHALTLICH VERSCHIEDENES KO derselben Kategorie erzwingen ein
// Judge-Paar; der zweite Lauf befragt den (werfenden) Judge → die Ursache landet im Outcome.
async function runAgainstJudge(services: AppServices): Promise<AiCheckRunOutcome> {
  const a = await makeKo(services, "Bestand", "Eine erste voellig eigene Aussage ueber Pumpe P2.");
  await runnerFor(services)(a.id); // Pool leer: kein Judge
  const b = await makeKo(services, "Subjekt", "Eine zweite ganz andere Aussage ueber Ventil V9.");
  return runnerFor(services)(b.id); // b vs a → Judge wird befragt
}

const CASES: { label: string; client: ModelClient; reason: string }[] = [
  {
    label: "401 (ModelHttpError) → auth",
    client: throwingClient(() => {
      throw new ModelHttpError("Modell-API antwortete mit 401", 401);
    }),
    reason: "auth",
  },
  {
    label: "429 (ModelHttpError) → rate-limit",
    client: throwingClient(() => {
      throw new ModelHttpError("Modell-API antwortete mit 429", 429);
    }),
    reason: "rate-limit",
  },
  {
    label: "503 (ModelHttpError, 5xx) → unreachable",
    client: throwingClient(() => {
      throw new ModelHttpError("Modell-API antwortete mit 503", 503);
    }),
    reason: "unreachable",
  },
  {
    label: "Netzwerk (ECONNREFUSED) → unreachable",
    client: throwingClient(() => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:443");
    }),
    reason: "unreachable",
  },
  {
    label: "Parsefehler (SyntaxError) → bad-response",
    client: throwingClient(() => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    }),
    reason: "bad-response",
  },
  {
    label: "unparsebar/unbekannt → model-error (Rückfall)",
    client: garbageClient(),
    reason: "model-error",
  },
  {
    // AUFTRAG-mega4 Block D (bens Blocker): ein WIRKLICH geworfener, uneingeordneter Providerfehler.
    // Vorher fiel er über classifyModelFailure pauschal auf „network" → sichtbar „unreachable" (Anbieter
    // nicht erreichbar), obwohl kein Netzbeleg existiert. Jetzt: „unknown" → ehrlich generisch model-error.
    label: "geworfener unbekannter Providerfehler → model-error (kein erfundenes unreachable)",
    client: throwingClient(() => {
      throw new Error("interner Providerfehler");
    }),
    reason: "model-error",
  },
];

describe("RT-001 e2e: echter Providerpfad Providerfehler → judge*Outcome → Runner → ehrliche Ursache", () => {
  for (const { label, client, reason } of CASES) {
    it(label, async () => {
      const services = buildServices();
      services.reasoner = new Reasoner(new ModelProvider(client));
      const out = await runAgainstJudge(services);
      // AUFTRAG-mega28 A2: der Ausgang traegt zusaetzlich die Abdeckung des Laufs. Geprueft wird
      // hier weiterhin GENAU die Ursache — deshalb toMatchObject statt eines Form-Vergleichs.
      expect(out).toMatchObject({ ok: false, fallbackReason: reason });
    });
  }

  it("HARTE GRENZE: ein LECKENDER Providerfehler ergibt eine neutrale Ursache — kein Rohtext/Key/Endpunkt/Anbietername im Ausgang oder in der Anzeige (DE/EN/NL)", async () => {
    const leakyClient = throwingClient(() => {
      throw new ModelHttpError(
        "OpenAI request to https://api.openai.com/v1/chat/completions failed: invalid api key sk-ABC123XYZ",
        401,
      );
    });
    const services = buildServices();
    services.reasoner = new Reasoner(new ModelProvider(leakyClient));
    const out = await runAgainstJudge(services);
    // Der Ausgang trägt AUSSCHLIESSLICH die neutrale Klasse (mega28 A2: plus die reinen
    // Abdeckungs-ZAHLEN, die keinen Anbietertext tragen können — die Leck-Probe unten prüft das).
    expect(out).toMatchObject({ ok: false, fallbackReason: "auth" });
    // Die Abdeckung besteht AUSSCHLIESSLICH aus Zahlen/Booleans — sie kann konstruktionsbedingt
    // keinen Anbietertext transportieren (die Leck-Probe unten prüft die Anzeige zusätzlich).
    for (const value of Object.values(out.coverage ?? {})) {
      expect(["number", "boolean"]).toContain(typeof value);
    }

    const secrets = [
      "OpenAI",
      "api.openai.com",
      "https://api.openai.com/v1/chat/completions",
      "sk-ABC123XYZ",
      "invalid api key",
    ];
    // Persistenz-nahe Sicht: der gesamte serialisierte Ausgang darf kein Provider-Interna tragen.
    const serialized = JSON.stringify(out);
    for (const secret of secrets) {
      expect(serialized, `Ausgang darf „${secret}“ nicht enthalten`).not.toContain(secret);
    }
    // Anzeige (reason-Key → i18n) in allen drei Sprachen frei von Provider-Interna.
    const key = aiCheckFailureReasonKey(out.fallbackReason);
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      const text = i18n.t(key);
      expect(text.length, `${lng}:auth sichtbar`).toBeGreaterThan(10);
      for (const secret of [...secrets, "401", "Unauthorized"]) {
        expect(text, `${lng} darf „${secret}“ nicht enthalten`).not.toContain(secret);
      }
    }
    await i18n.changeLanguage("de");
  });
});
