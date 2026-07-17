import { describe, expect, it } from "vitest";
import { cappedTranscriber } from "../../services/media";
import * as mediaPkg from "../../services/media";
import type { Transcriber } from "../../services/media";
import { cappedModelClient } from "../../services/reasoner";
import * as reasonerPkg from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

// SCRUM-502 R8 (Encapsulation + Credential-Gating): Von „außen" (Paket-Index) sind die ROHEN Modell-/
// Transkriber-Clients und die Credential-Resolver NICHT erreichbar — nur der gecappte Weg. Damit ist ein
// Roh-Import unmöglich (Laufzeit-Beleg unten) und der Egress-Wächter kann nicht durch Weglassen umgangen
// werden (Compile-Beleg __egressCompileGuards__, das tsc prüft).

// Namen, die der Paket-Index NICHT mehr exportieren darf (roher Client / Credential-Zugriff).
const FORBIDDEN_REASONER = [
  "anthropicClient",
  "openAiCompatibleClient",
  "createModelClientFromEnv",
  "createLocalClientFromEnv",
  "resolveCloudApiKey",
  "findCloudKeyInKeychain",
  "CLOUD_API_KEY_ENV",
];
const FORBIDDEN_MEDIA = ["whisperClient", "createTranscriberFromEnv"];

describe("SCRUM-502 R8: Egress-Clients gekapselt (kein Roh-Import von außen)", () => {
  it("reasoner-Index exportiert keinen rohen Client / Credential-Resolver", () => {
    for (const name of FORBIDDEN_REASONER) {
      expect(name in reasonerPkg).toBe(false);
    }
    // Der GECAPPTE Weg IST erreichbar (und der einzige):
    expect(typeof reasonerPkg.createCappedCloudClientFromEnv).toBe("function");
    expect(typeof reasonerPkg.createCappedLocalClientFromEnv).toBe("function");
  });

  it("media-Index exportiert keinen rohen Transkriber / Credential-Zugriff", () => {
    for (const name of FORBIDDEN_MEDIA) {
      expect(name in mediaPkg).toBe(false);
    }
    expect(typeof mediaPkg.createCappedTranscriberFromEnv).toBe("function");
  });

  it("Compile-Guard existiert (tsc erzwingt: Wächter nicht weglassbar)", () => {
    expect(typeof __egressCompileGuards__).toBe("function");
  });
});

// Wird NIE zur Laufzeit aufgerufen (nur per `typeof` referenziert, damit noUnusedLocals zufrieden ist) —
// nur tsc prüft die @ts-expect-error-Zeilen: verschwindet der Fehler (weil jemand rejectsConfidential
// wieder optional macht), meldet tsc „unused @ts-expect-error" und der Build schlägt fehl. So ist
// „fehlender Guard" nicht kompilierbar. Kein Export (Biome: noExportsInTest).
function __egressCompileGuards__(): void {
  const model: ModelClient = { name: "x", complete: () => Promise.resolve("") };
  // @ts-expect-error R8: rejectsConfidential ist PFLICHT — cappedModelClient ohne opts kompiliert nicht.
  cappedModelClient(model);
  const trans: Transcriber = { name: "x", transcribe: () => Promise.resolve("") };
  // @ts-expect-error R8: rejectsConfidential ist PFLICHT — cappedTranscriber ohne opts kompiliert nicht.
  cappedTranscriber(trans);
}
