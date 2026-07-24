// D-AISTATE PAKET 1 (bens V1, aistate-fix3) — Sicherheitsblocker STRUKTURELL geschlossen:
//  (a) `confidential` reist als ECHTES Paar-Bit durch beide Judge-Schnittstellen bis zum zentralen
//      ModelClient.complete-Wächter (kein hartes false mehr in provider-model),
//  (b) „lokal" ist TECHNISCH begrenzt: eine fremde KLARWERK_LOCAL_LLM_URL wird bei vertraulichen
//      Paaren VOR jedem Fetch abgelehnt (Fetch-Spy 0), der Lauf schließt ehrlich "confidential";
//      eine Loopback-URL (bzw. explizit freigegebene private Origin) darf weiter lokal urteilen.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
  createCappedLocalClientFromEnv,
  isConfirmedLocalOrigin,
} from "../../services/reasoner";

const DUP_JSON =
  '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';

// OpenAI-kompatible Fake-Antwort für den lokalen Client (choices[0].message.content).
function okLocalResponse(content: string): { ok: boolean; json: () => Promise<unknown> } {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
}

// Reasoner NUR mit Secondary (der zu prüfende „lokale" Judge); primary bleibt unverdrahtet.
function reasonerWithSecondary(client: ModelClient): Reasoner {
  return new Reasoner(undefined, undefined, undefined, undefined, new ModelProvider(client));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('V1: isConfirmedLocalOrigin — technische On-Prem-Grenze der „lokalen" URL', () => {
  it("Loopback zählt (localhost/127.x/::1), fremde Hosts NICHT, kaputte URLs fail-safe NICHT", () => {
    expect(isConfirmedLocalOrigin("http://127.0.0.1:8000/v1")).toBe(true);
    expect(isConfirmedLocalOrigin("http://localhost:11434/v1")).toBe(true);
    expect(isConfirmedLocalOrigin("http://[::1]:8000/v1")).toBe(true);
    expect(isConfirmedLocalOrigin("https://fremder-host.example/v1")).toBe(false);
    expect(isConfirmedLocalOrigin("kein-url")).toBe(false);
    expect(isConfirmedLocalOrigin("")).toBe(false);
  });

  it("explizit freigegebene private Origin zählt (exakter Origin-Vergleich)", () => {
    expect(isConfirmedLocalOrigin("http://10.0.0.5:8000/v1", "http://10.0.0.5:8000")).toBe(true);
    // anderer Port/Host als freigegeben → NICHT lokal
    expect(isConfirmedLocalOrigin("http://10.0.0.5:9000/v1", "http://10.0.0.5:8000")).toBe(false);
    expect(isConfirmedLocalOrigin("https://fremder-host.example/v1", "http://10.0.0.5:8000")).toBe(
      false,
    );
  });
});

describe("V1: fremde LOCAL_LLM_URL — Abbruch VOR jedem Fetch, Ausgang ehrlich 'confidential'", () => {
  it("vertrauliches Paar + KLARWERK_LOCAL_LLM_URL=https://fremder-host.example/v1 ⇒ Fetch-Spy 0", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const capped = createCappedLocalClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: "https://fremder-host.example/v1",
      KLARWERK_LOCAL_LLM_MODEL: "qwen",
    });
    expect(capped).toBeDefined();
    // Der Wrapper trägt die Egress-Politik sichtbar: NICHT als lokal bestätigt.
    expect(capped?.rejectsConfidential).toBe(true);
    const reasoner = reasonerWithSecondary(capped as ModelClient);

    const dup = await reasoner.judgeDuplicateOutcome("A", "B", "de", true);
    const con = await reasoner.judgeConflictOutcome("A", "B", "de", true);

    // KEIN einziger Fetch — der Abbruch passiert VOR dem Netz (Kettenausschluss + Wächter).
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dup).toEqual({ verdict: null, failure: "confidential" });
    expect(con).toEqual({ verdict: null, failure: "confidential" });
  });

  it("Gegenprobe: dieselbe fremde URL darf NICHT-vertrauliche Paare weiter bedienen", async () => {
    const fetchSpy = vi.fn(async () => okLocalResponse(DUP_JSON));
    vi.stubGlobal("fetch", fetchSpy);
    const capped = createCappedLocalClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: "https://fremder-host.example/v1",
      KLARWERK_LOCAL_LLM_MODEL: "qwen",
    });
    const reasoner = reasonerWithSecondary(capped as ModelClient);
    const dup = await reasoner.judgeDuplicateOutcome("A", "B", "de", false);
    expect(dup.verdict).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("Fail-safe am Chokepoint: selbst ein direkt aufgerufener nicht-lokaler Client wirft VOR inner.complete", async () => {
    let innerCalls = 0;
    const raw: ModelClient = {
      name: "local:fake",
      complete: async () => {
        innerCalls += 1;
        return DUP_JSON;
      },
    };
    const capped = cappedModelClient(raw, { rejectsConfidential: true });
    await expect(capped.complete("s", "u", true)).rejects.toMatchObject({
      name: "ConfidentialEgressError",
    });
    expect(innerCalls).toBe(0);
  });
});

describe("V1: Loopback-Secondary + vertraulich — lokaler Judge läuft, Fetch NUR an Loopback", () => {
  it("KLARWERK_LOCAL_LLM_URL=http://127.0.0.1:8000/v1 ⇒ Urteil kommt, Fetch-Ziel ist 127.0.0.1", async () => {
    const fetchSpy = vi.fn(async (..._args: unknown[]) => okLocalResponse(DUP_JSON));
    vi.stubGlobal("fetch", fetchSpy);
    const capped = createCappedLocalClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
      KLARWERK_LOCAL_LLM_MODEL: "qwen",
    });
    expect(capped?.rejectsConfidential).toBe(false);
    const reasoner = reasonerWithSecondary(capped as ModelClient);

    const dup = await reasoner.judgeDuplicateOutcome("A", "B", "de", true);
    expect(dup.verdict).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const target = String(fetchSpy.mock.calls[0]?.[0]);
    expect(target.startsWith("http://127.0.0.1:8000/")).toBe(true);
  });
});

describe("V1: das ECHTE Paar-Bit reist bis ModelClient.complete (kein hartes false mehr)", () => {
  it("ModelProvider.judgeDuplicate/judgeConflict geben `confidential` an client.complete weiter", async () => {
    const seen: boolean[] = [];
    const client: ModelClient = {
      name: "spy",
      complete: async (_system, _user, confidential) => {
        seen.push(confidential);
        return DUP_JSON;
      },
    };
    const provider = new ModelProvider(client);
    await provider.judgeDuplicate("A", "B", "de", true);
    await provider.judgeConflict("A", "B", "de", false);
    expect(seen).toEqual([true, false]);
  });

  it("Cloud-Primary + vertraulich: Ausschluss VOR dem Aufruf, Ausgang 'confidential', complete 0", async () => {
    let completes = 0;
    const raw: ModelClient = {
      name: "anthropic:fake",
      complete: async () => {
        completes += 1;
        return DUP_JSON;
      },
    };
    const cloud = cappedModelClient(raw, { rejectsConfidential: true });
    const reasoner = new Reasoner(new ModelProvider(cloud));
    const out = await reasoner.judgeDuplicateOutcome("A", "B", "de", true);
    expect(completes).toBe(0);
    expect(out).toEqual({ verdict: null, failure: "confidential" });
  });
});
