// WP-BILD-1c: KI-Bildbeschreibung als VORSCHLAG (describe-Task). Ehrlichkeit vor Optik:
// ohne funktionierendes Vision-Modell gibt es text null + fallbackReason (no-model /
// model-timeout / model-error — dieselbe Dreiteilung wie beim structure-Task), NIE einen
// erfundenen Text. Der Vision-Pfad läuft durch denselben Chokepoint (Egress-Wächter + Cap).
import { describe, expect, it } from "vitest";
import type { ModelRunRecord } from "../../services/model-runs";
import {
  MAX_IMAGE_CONTEXT_LENGTH,
  MAX_IMAGE_DESCRIPTION_LENGTH,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner";
import { parseImageDataUrl } from "../../services/reasoner/src/model-client";

const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("WP-BILD-1c: describeImage — ehrlicher Vorschlag, ehrlicher Fallback", () => {
  it("ohne Modell: text null + fallbackReason no-model — KEIN erfundener Text", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.describeImage(PNG_URL, "de");
    expect(res.text).toBeNull();
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("mit Vision-Modell: der Modelltext kommt getrimmt zurück (demo false, kein fallbackReason)", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => "  Eine Kreiselpumpe mit blauem Gehäuse auf einem Prüfstand.  ",
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text).toBe("Eine Kreiselpumpe mit blauem Gehäuse auf einem Prüfstand.");
    expect(res.demo).toBe(false);
    expect(res.fallbackReason).toBeUndefined();
  });

  it("überlange Modell-Antworten werden hart gedeckelt (Server-Obergrenze, nicht verhandelt)", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => "x".repeat(2000),
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text?.length).toBe(MAX_IMAGE_DESCRIPTION_LENGTH);
  });

  it("leere Modell-Antwort: text null (kein Vorschlag ist besser als ein leerer)", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => "   ",
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text).toBeNull();
    expect(res.demo).toBe(false);
  });

  it("Client OHNE Bild-Eingang (z. B. lokaler LLM): ehrlicher Fallback model-error", async () => {
    const provider = new ModelProvider({
      name: "local:test",
      complete: async () => "nur Text",
      // KEIN completeVision — der Provider wirft ehrlich, die Kette fällt durch.
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text).toBeNull();
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("model-error");
  });

  it("Zeitüberschreitung wird als EIGENE Ursache gemeldet (model-timeout, WP-D10-Muster)", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => {
        throw new ModelTimeoutError("Modell-API überschritt das Zeitlimit von 30000 ms", 30000);
      },
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text).toBeNull();
    expect(res.fallbackReason).toBe("model-timeout");
  });

  it("Modellfehler (HTTP/Netz): fallbackReason model-error", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => {
        throw new Error("Modell-API antwortete mit 529");
      },
    });
    const res = await new Reasoner(provider).describeImage(PNG_URL, "de");
    expect(res.text).toBeNull();
    expect(res.fallbackReason).toBe("model-error");
  });

  it("ModelRun-Protokoll: describe-Läufe werden wie die anderen Tasks protokolliert (nur Metadaten)", async () => {
    const runs: ModelRunRecord[] = [];
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async () => "Eine Pumpe.",
    });
    const reasoner = new Reasoner(provider, undefined, {
      append: async (r) => {
        runs.push(r);
      },
      recent: async () => runs,
    });
    await reasoner.describeImage(PNG_URL, "de");
    expect(runs.length).toBe(1);
    expect(runs[0]?.task).toBe("describe");
    expect(runs[0]?.status).toBe("success");
    expect(runs[0]?.demo).toBe(false);
  });

  it("KI-Verwaltung: describe erscheint in der Konfigurationssicht wie die anderen Aufgaben", async () => {
    const reasoner = new Reasoner();
    const config = reasoner.configStatus();
    expect(config.tasks).toContain("describe");
    expect(config.effective.describe).toBe("deterministic");
    expect(config.effectiveProvider.describe).toBe("deterministic");
    // Per-Task-Zuordnung ist für describe genauso setz-/validierbar.
    const updated = await reasoner.setTaskConfig({
      global: "auto",
      perTask: { describe: "deterministic" },
    });
    expect(updated.perTask.describe).toBe("deterministic");
  });
});

describe("WP-BILD-1f: Dokument-Kontext beim Vorschlag (Egress folgt dem Bild)", () => {
  // Vision-Spy, der den USER-Prompt (inkl. Kontext) und die Aufrufzahl festhält.
  function visionSpy(): {
    client: ModelClient;
    userPrompts: string[];
    calls: () => number;
  } {
    const userPrompts: string[] = [];
    const client: ModelClient = {
      name: "anthropic:test",
      complete: async () => "",
      completeVision: async (_system, _img, user) => {
        userPrompts.push(user);
        return "Eine Kreiselpumpe.";
      },
    };
    return { client, userPrompts, calls: () => userPrompts.length };
  }

  it("öffentlicher Beitrag: der Kontext geht IM Vision-User-Prompt mit; withContext=true", async () => {
    const spy = visionSpy();
    const res = await new Reasoner(new ModelProvider(spy.client)).describeImage(
      PNG_URL,
      "de",
      false,
      "Titel: Pumpenwartung\nAbschnitt: Dichtungen\nDie Gleitringdichtung wird geprüft.",
    );
    expect(res.withContext).toBe(true);
    expect(spy.userPrompts[0]).toContain("Gleitringdichtung");
    expect(spy.userPrompts[0]).toContain("Pumpenwartung");
  });

  it("ohne Kontext bleibt der Prompt unverändert und withContext ist NICHT gesetzt", async () => {
    const spy = visionSpy();
    const res = await new Reasoner(new ModelProvider(spy.client)).describeImage(
      PNG_URL,
      "de",
      false,
    );
    expect(res.withContext).toBeUndefined();
    expect(spy.userPrompts[0]).toBe("Beschreibe dieses Bild für die Fußnote.");
  });

  it("überlanger Kontext wird HART auf das Budget gekürzt (Überschuss ehrlich abgeschnitten)", async () => {
    const spy = visionSpy();
    // Ziffer als Füllzeichen: kommt im Base-/Trenn-Prompt nicht vor, deshalb zählt sie NUR den Kontext.
    const huge = "9".repeat(MAX_IMAGE_CONTEXT_LENGTH + 500);
    await new Reasoner(new ModelProvider(spy.client)).describeImage(PNG_URL, "de", false, huge);
    const contextChars = (spy.userPrompts[0]?.match(/9/g) ?? []).length;
    expect(contextChars).toBe(MAX_IMAGE_CONTEXT_LENGTH);
  });

  it("vertraulicher Beitrag: KEIN Kontext-Egress — Cloud-Vision-Spy zählt 0 (Kontext geht NIE mit)", async () => {
    const spy = visionSpy();
    const capped = cappedModelClient(spy.client, { rejectsConfidential: true });
    const reasoner = new Reasoner(new ModelProvider(capped));
    const res = await reasoner.describeImage(
      PNG_URL,
      "de",
      true,
      "Titel: Geheimprojekt\nInterner, vertraulicher Absatz mit Bauteilnamen.",
    );
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("confidential");
    expect(res.text).toBeNull();
    expect(spy.calls()).toBe(0); // weder Bild NOCH Kontext haben den Vision-Client erreicht
  });
});

describe("WP-BILD-1c: Vision-Bausteine (Datenformat + Chokepoint)", () => {
  it("parseImageDataUrl akzeptiert NUR die vier sicheren Rasterformate", () => {
    expect(parseImageDataUrl(PNG_URL)).toEqual({
      mediaType: "image/png",
      base64: "iVBORw0KGgoAAAANSUhEUg==",
    });
    expect(parseImageDataUrl("data:image/webp;base64,AAAA")).not.toBeNull();
    expect(parseImageDataUrl("data:image/svg+xml;base64,AAAA")).toBeNull();
    expect(parseImageDataUrl("data:text/html;base64,AAAA")).toBeNull();
    expect(parseImageDataUrl("https://example.com/bild.png")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,nicht base64!!")).toBeNull();
  });

  it("Egress-Wächter gilt auch für Vision: vertraulich → ConfidentialEgressError vor dem Aufruf", async () => {
    let called = false;
    const capped = cappedModelClient(
      {
        name: "anthropic:test",
        complete: async () => "",
        completeVision: async () => {
          called = true;
          return "beschreibung";
        },
      },
      { rejectsConfidential: true },
    );
    await expect(capped.completeVision?.("s", PNG_URL, "u", true)).rejects.toThrow(
      "Vertrauliche Inhalte",
    );
    expect(called).toBe(false);
    // Nicht-vertraulich läuft durch (mit In-Flight-Cap).
    await expect(capped.completeVision?.("s", PNG_URL, "u", false)).resolves.toBe("beschreibung");
  });

  it("Clients ohne Vision bekommen auch im Wrapper KEIN completeVision (ehrlich abwesend)", () => {
    const capped = cappedModelClient(
      { name: "local:test", complete: async () => "" },
      { rejectsConfidential: false },
    );
    expect(capped.completeVision).toBeUndefined();
  });
});
