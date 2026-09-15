import { describe, expect, it } from "vitest";
import * as sharepoint from "../../sharepoint";

// JOB 4086 (Kapselung, dieselbe Regel wie SCRUM-510 R2a bei Confluence): Von „aussen" (Paket-index)
// sind der Roh-Client, seine token-tragende Config und der env-Resolver NICHT erreichbar — nur die
// gecappte Adapter-Factory. Ein Aufrufer kann so weder das Zugangsmerkmal erlangen noch einen
// ungepinnten Client bauen.
describe("JOB 4086: SharePoint-Egress gekapselt (kein Roh-Client/Resolver von aussen)", () => {
  it("der Paket-index exportiert weder Roh-Client noch token-tragenden Resolver/Config-Pfad", () => {
    for (const verboten of [
      "SharePointGraphClient",
      "sharepointClientFromEnv",
      // Er existiert in diesem Modul gar nicht (Begründung in `adapter.ts`) — und darf auch
      // nicht durch die Hintertür entstehen.
      "adapterFromConfig",
      "pruefeGraphUrl",
      "SharePointRequestError",
    ]) {
      expect(verboten in sharepoint, verboten).toBe(false);
    }
    // Der gecappte Weg IST erreichbar (und der einzige):
    expect(typeof sharepoint.createSharePointAdapterFromEnv).toBe("function");
    // Und die zwei Auskünfte, die strukturell kein Geheimnis tragen können.
    expect(typeof sharepoint.sharepointCredentialState).toBe("function");
    expect(typeof sharepoint.sharepointFehlerlage).toBe("function");
  });
});
