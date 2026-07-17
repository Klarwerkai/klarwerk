import { describe, expect, it } from "vitest";
import * as confluence from "../../confluence";

// SCRUM-510 R2a (Credential-Egress): Von „außen" (Paket-index) sind der Roh-Client, seine token-tragende
// Config und der env-Resolver NICHT erreichbar — nur die gecappte Adapter-Factory. Ein Aufrufer kann so
// weder den apiToken erlangen noch einen ungepinnten Client bauen (Roh-Import unmöglich).
describe("SCRUM-510 R2a: Confluence-Egress gekapselt (kein Roh-Client/Resolver von außen)", () => {
  it("Paket-index exportiert weder Roh-Client noch token-tragenden Resolver/Config-Pfad", () => {
    for (const forbidden of [
      "ConfluenceRestClient",
      "confluenceRestConfigFromEnv", // R2a entfernt/ersetzt — darf nicht wiederauftauchen
      "confluenceClientFromEnv",
      "adapterFromConfig",
      "assertAllowedConfluenceUrl",
    ]) {
      expect(forbidden in confluence).toBe(false);
    }
    // Der gecappte Weg IST erreichbar (und der einzige):
    expect(typeof confluence.createConfluenceAdapterFromEnv).toBe("function");
  });
});
