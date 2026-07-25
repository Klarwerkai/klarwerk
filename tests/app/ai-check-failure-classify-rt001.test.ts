// RT-001 (Pedi, Live-Befund): Karten mit Status „Prüfung fehlgeschlagen" zeigten pauschal
// „model-error", obwohl sich die Fehlerklasse eines gefangenen Providerfehlers ZUVERLÄSSIG aus
// Status/Meldung ableiten lässt. Diese Tests belegen:
//  (1) PRO Fehlerklasse leitet classifyAiCheckFailure aus einem REPRÄSENTATIVEN Providerfehler die
//      erwartete reason ab — und über den echten Worker-Pfad (runWithTimeout.catch → Klassifizierung
//      → resolveAiCheck) landet dieselbe reason wirklich am KO;
//  (2) über aiCheckFailureReasonKey + i18n ergibt jede reason einen echten sichtbaren Text (DE/EN/NL);
//  (3) KEINE Anbieter-Interna (Name/Key/Endpoint/roher Fehlertext) dringen in den sichtbaren Text.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { aiCheckFailureReasonKey } from "../../apps/web/src/lib/aiCheckStatusCard";
import {
  type AiCheckFailureReason,
  classifyAiCheckFailure,
  createAiCheckWorker,
} from "../../services/app/src/ai-check-worker";

// Repräsentative Providerfehler je Klasse — je einmal STATUS-getragen (typisierter Fehler mit
// `status`) und einmal NUR über die Meldung (fremde/injizierte Clients ohne Status-Feld). So ist
// belegt, dass die Klassifizierung robust auf beide Formen greift.
const CASES: { reason: AiCheckFailureReason; label: string; err: unknown }[] = [
  {
    reason: "auth",
    label: "401 (Status)",
    err: Object.assign(new Error("Modell-API antwortete mit 401"), { status: 401 }),
  },
  {
    reason: "auth",
    label: "invalid api key (Meldung)",
    err: new Error("request rejected: invalid api key"),
  },
  {
    reason: "auth",
    label: "403 forbidden (Status)",
    err: Object.assign(new Error("forbidden"), { status: 403 }),
  },
  {
    reason: "rate-limit",
    label: "429 (Status)",
    err: Object.assign(new Error("Modell-API antwortete mit 429"), { status: 429 }),
  },
  {
    reason: "rate-limit",
    label: "rate limit exceeded (Meldung)",
    err: new Error("rate limit exceeded, please slow down"),
  },
  {
    reason: "unreachable",
    label: "503 (Status)",
    err: Object.assign(new Error("Modell-API antwortete mit 503"), { status: 503 }),
  },
  {
    reason: "unreachable",
    label: "ECONNREFUSED (Meldung)",
    err: new Error("connect ECONNREFUSED 127.0.0.1:443"),
  },
  {
    reason: "unreachable",
    label: "getaddrinfo ENOTFOUND (DNS)",
    err: new Error("getaddrinfo ENOTFOUND api.example.com"),
  },
  {
    reason: "unreachable",
    label: "fetch failed",
    err: new TypeError("fetch failed"),
  },
  {
    reason: "bad-response",
    label: "SyntaxError (JSON.parse)",
    err: new SyntaxError("Unexpected token < in JSON at position 0"),
  },
  {
    reason: "bad-response",
    label: "Unexpected end of JSON input (Meldung)",
    err: new Error("Unexpected end of JSON input"),
  },
  {
    reason: "model-error",
    label: "unbekannt → Rückfall",
    err: new Error("etwas ging schief"),
  },
];

describe("RT-001: classifyAiCheckFailure (pure) je Fehlerklasse", () => {
  for (const { reason, label, err } of CASES) {
    it(`${label} → reason „${reason}“`, () => {
      expect(classifyAiCheckFailure(err)).toBe(reason);
    });
  }

  it("nichtssagende/leere Fehler fallen ehrlich auf model-error zurück (kein Fantasie-Grund)", () => {
    expect(classifyAiCheckFailure(null)).toBe("model-error");
    expect(classifyAiCheckFailure(undefined)).toBe("model-error");
    expect(classifyAiCheckFailure({})).toBe("model-error");
    expect(classifyAiCheckFailure("")).toBe("model-error");
  });
});

// Echter Verhaltensweg (kein Quelltext-Pin): der Worker fängt einen geworfenen Providerfehler in
// runWithTimeout.catch, klassifiziert ihn und schreibt die reason via resolveAiCheck ans KO.
describe("RT-001: Worker-Pfad schreibt die ehrliche reason ans KO", () => {
  it.each(CASES.filter((c) => c.reason !== "model-error"))(
    "geworfener $label → aiCheck failed/$reason",
    async ({ reason, err }) => {
      const resolved: { ok: boolean; fallbackReason?: string }[] = [];
      const ko = {
        get: async () => ({ aiCheck: { koVersion: 1 } }),
        resolveAiCheck: async (_id: string, outcome: { ok: boolean; fallbackReason?: string }) => {
          resolved.push(outcome);
          return true;
        },
      } as unknown as Parameters<typeof createAiCheckWorker>[0]["ko"];
      const worker = createAiCheckWorker({
        ko,
        run: async () => {
          throw err;
        },
        log: () => {},
      });
      worker.enqueue("ko-1", 1);
      await worker.idle();
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toEqual({ ok: false, fallbackReason: reason });
    },
  );
});

// Sichtbare Textbildung: reason → Key → i18n-Text. Jede reason muss in DE/EN/NL zu echtem Text
// auflösen (kein roher Key, spürbar lang).
const REASONS: AiCheckFailureReason[] = [
  "auth",
  "rate-limit",
  "unreachable",
  "bad-response",
  "model-error",
];

async function visibleText(reason: AiCheckFailureReason, lng: "de" | "en" | "nl"): Promise<string> {
  await i18n.changeLanguage(lng);
  return i18n.t(aiCheckFailureReasonKey(reason));
}

describe("RT-001: jede reason ergibt echten sichtbaren Text in DE/EN/NL", () => {
  it("löst in allen drei Sprachen zu nicht-leerem Text auf (kein roher Key)", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      for (const reason of REASONS) {
        const key = aiCheckFailureReasonKey(reason);
        const text = await visibleText(reason, lng);
        expect(text, `${lng}:${reason}`).not.toBe(key);
        expect(text.length, `${lng}:${reason}`).toBeGreaterThan(10);
      }
    }
    await i18n.changeLanguage("de");
  });

  it("die neuen Ursachen tragen unterscheidbare DE-Texte (nicht der model-error-Sammeltext)", async () => {
    await i18n.changeLanguage("de");
    const modelError = i18n.t(aiCheckFailureReasonKey("model-error"));
    for (const reason of ["auth", "rate-limit", "unreachable", "bad-response"] as const) {
      expect(i18n.t(aiCheckFailureReasonKey(reason)), reason).not.toBe(modelError);
    }
  });
});

// HARTE GRENZE: kein Anbietername/Key/Endpoint/roher Fehlertext im sichtbaren Text.
describe("RT-001: keine Anbieter-Interna dringen nach außen", () => {
  it("ein Fehler mit Name/Key/Endpoint/rohem Text ergibt einen sichtbaren Text OHNE diese Zeichenketten", async () => {
    const leaky = Object.assign(
      new Error(
        "OpenAI request to https://api.openai.com/v1/chat/completions failed: invalid api key sk-ABC123XYZ (401 Unauthorized)",
      ),
      { status: 401 },
    );
    const reason = classifyAiCheckFailure(leaky);
    expect(reason).toBe("auth");

    const secrets = [
      "OpenAI",
      "api.openai.com",
      "https://api.openai.com/v1/chat/completions",
      "sk-ABC123XYZ",
      "invalid api key",
      "401",
      "Unauthorized",
    ];
    for (const lng of ["de", "en", "nl"] as const) {
      const text = await visibleText(reason, lng);
      for (const secret of secrets) {
        expect(text, `${lng} darf „${secret}“ nicht enthalten`).not.toContain(secret);
      }
    }
    await i18n.changeLanguage("de");
  });

  it("auch der rate-limit-/unreachable-Text bleibt frei von rohem Provider-Text", async () => {
    const cases = [
      {
        err: Object.assign(new Error("api.anthropic.com: 429 Too Many Requests token=secret-xyz"), {
          status: 429,
        }),
        secrets: ["api.anthropic.com", "429", "Too Many Requests", "secret-xyz"],
      },
      {
        err: new Error("getaddrinfo ENOTFOUND llm.internal.example.com"),
        secrets: ["llm.internal.example.com", "ENOTFOUND", "getaddrinfo"],
      },
    ];
    for (const { err, secrets } of cases) {
      const reason = classifyAiCheckFailure(err);
      for (const lng of ["de", "en", "nl"] as const) {
        const text = await visibleText(reason, lng);
        for (const secret of secrets) {
          expect(text, `${lng} darf „${secret}“ nicht enthalten`).not.toContain(secret);
        }
      }
    }
    await i18n.changeLanguage("de");
  });
});
