import { describe, expect, it } from "vitest";
import * as jira from "../../jira";

// R-0170 (Kapselung, dieselbe Regel wie bei Confluence und SharePoint): von „aussen" (Paket-index)
// sind der Roh-Client, seine token-tragende Config, der env-Resolver und der Fehlertyp NICHT
// erreichbar — nur die Adapter-Factory und die zwei Auskünfte ohne Geheimnis.
describe("R-0170: Jira-Egress gekapselt (kein Roh-Client/Resolver von aussen)", () => {
  it("der Paket-index exportiert weder Roh-Client noch token-tragenden Resolver", () => {
    for (const verboten of [
      "JiraRestClient",
      "jiraClientFromEnv",
      "adapterFromConfig",
      "pruefeJiraUrl",
      "JiraRequestError",
    ]) {
      expect(verboten in jira, verboten).toBe(false);
    }
    expect(typeof jira.createJiraAdapterFromEnv).toBe("function");
    expect(typeof jira.jiraCredentialState).toBe("function");
    expect(typeof jira.jiraFehlerlage).toBe("function");
  });
});
