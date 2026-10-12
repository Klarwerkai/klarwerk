// R-0170: Vorgang/Epic → ImportItem. Gemessen wird, dass die Felder aus der QUELLE stammen und nichts
// erfunden wird: Projektrollen → `sourceRestrictions`, Epic einer Story → `sourcePath`,
// Sicherheitsstufe → `confidentiality`, `updated` → Quellstand in Sekunden.
import { describe, expect, it } from "vitest";
import { istEpic, jiraQuellstand, jiraZeitpunkt, mapJiraIssueToImportItem } from "./mapper";
import type { JiraIssue } from "./rest-client";

const OPTS = { baseUrl: "https://jira.example.test/", projectKey: "WART" };
const ROLLEN = { users: ["acc-1", "jdoe"], groups: ["wartung"], rollen: ["Developers"] };

const STORY: JiraIssue = {
  key: "WART-12",
  fields: {
    summary: "Filter der Abfüllanlage tauschen",
    description:
      "Alle 500 Betriebsstunden tauschen. Vorher Druck ablassen.\n\nDetails <siehe Plan>.",
    labels: ["wartung", "abfuellung"],
    updated: "2026-09-01T10:00:00.000+0200",
    issuetype: { name: "Story", hierarchyLevel: 0 },
    parent: { key: "WART-1", fields: { summary: "Wartungsplan 2026" } },
    reporter: { displayName: "R. Schuster" },
    project: { key: "WART" },
  },
};

const EPIC: JiraIssue = {
  key: "WART-1",
  fields: {
    summary: "Wartungsplan 2026",
    issuetype: { name: "Epic", hierarchyLevel: 1 },
    project: { key: "WART" },
  },
};

describe("R-0170 · mapJiraIssueToImportItem", () => {
  it("ein Vorgang wird Kandidat mit Anker, Originaladresse, Epic als Pfad und Rollen als Leserechte", () => {
    const item = mapJiraIssueToImportItem(STORY, { ...OPTS, rollen: ROLLEN });
    expect(item).toMatchObject({
      title: "Filter der Abfüllanlage tauschen",
      provider: "Jira",
      externalId: "WART-12",
      sourceScope: "WART",
      category: "WART",
      url: "https://jira.example.test/browse/WART-12",
      sourcePath: ["Wartungsplan 2026"],
      author: "R. Schuster",
      tags: ["Story", "wartung", "abfuellung"],
      confidentiality: "intern",
      sourceRestrictions: { users: ["acc-1", "jdoe"], groups: ["wartung"] },
      sourceVersion: Math.floor(Date.parse("2026-09-01T08:00:00.000Z") / 60_000),
      updatedAt: "2026-09-01T08:00:00.000Z",
      textCodec: "decoded",
    });
    // Die Kernaussage stammt aus der Beschreibung, der Volltext bleibt maskiert und in Absätzen.
    expect(item?.statement).toContain("Alle 500 Betriebsstunden tauschen.");
    expect(item?.bodyHtml).toBe(
      "<p>Alle 500 Betriebsstunden tauschen. Vorher Druck ablassen.</p><p>Details &lt;siehe Plan&gt;.</p>",
    );
  });

  it("ein Epic wird ebenfalls Kandidat — ohne erfundenen Pfad und ohne erfundene Beschreibung", () => {
    expect(istEpic(EPIC)).toBe(true);
    expect(istEpic(STORY)).toBe(false);
    const item = mapJiraIssueToImportItem(EPIC, { ...OPTS, rollen: ROLLEN });
    expect(item?.statement).toBe("Wartungsplan 2026");
    expect(item?.tags).toEqual(["Epic"]);
    expect(item && "sourcePath" in item).toBe(false);
    expect(item && "bodyHtml" in item).toBe(false);
    // Ohne `updated` gibt es keinen Quellstand — keine Ersatzzahl.
    expect(item && "sourceVersion" in item).toBe(false);
  });

  it("eine Sicherheitsstufe macht den Vorgang vertraulich", () => {
    const geschuetzt: JiraIssue = {
      ...STORY,
      fields: { ...STORY.fields, security: { id: "10100", name: "Nur Leitung" } },
    };
    expect(mapJiraIssueToImportItem(geschuetzt, OPTS)?.confidentiality).toBe("vertraulich");
  });

  it("ohne gelesene Rollen (oder ohne eine einzige Kennung) entsteht KEIN sourceRestrictions", () => {
    expect(mapJiraIssueToImportItem(STORY, OPTS)?.sourceRestrictions).toBeUndefined();
    const leer = { users: [], groups: [], rollen: ["Developers"] };
    expect(
      mapJiraIssueToImportItem(STORY, { ...OPTS, rollen: leer })?.sourceRestrictions,
    ).toBeUndefined();
  });

  it("ein Vorgang ohne Schlüssel oder ohne Titel ist keine importierbare Quelle", () => {
    expect(mapJiraIssueToImportItem({ fields: { summary: "x" } }, OPTS)).toBeUndefined();
    expect(mapJiraIssueToImportItem({ key: "WART-9", fields: {} }, OPTS)).toBeUndefined();
  });

  it("der Zeitpunkt mit Versatz ohne Doppelpunkt wird gelesen, ein unlesbarer nicht geraten", () => {
    expect(jiraZeitpunkt("2026-09-01T10:00:00.000+0200")).toBe("2026-09-01T08:00:00.000Z");
    expect(jiraZeitpunkt("kein Datum")).toBeUndefined();
    expect(jiraQuellstand({ key: "WART-3", fields: { updated: "" } })).toBeUndefined();
  });

  it("der Quellstand passt in die Fassungsgrenze des Import-Kerns — sonst entstünde kein Kandidat", () => {
    // Nacharbeit 1: `pruefeAnkerEintrag` (library-analytics) weist Fassungen über
    // `MAX_SOURCE_VERSION` = 999_999_999 (`library-analytics/src/repo.ts`) ab. Sekunden seit 1970
    // lagen darüber; Minuten liegen weit darunter — auch für einen Zeitpunkt in ferner Zukunft.
    const grenze = 999_999_999;
    for (const updated of ["2026-09-01T10:00:00.000+0200", "2999-12-31T23:59:59.000+0000"]) {
      const stand = jiraQuellstand({ key: "WART-4", fields: { updated } });
      expect(Number.isInteger(stand), updated).toBe(true);
      expect(stand ?? Number.POSITIVE_INFINITY, updated).toBeLessThanOrEqual(grenze);
    }
    // Und er wächst weiterhin mit der Änderung — eine Minute später ist ein höherer Stand.
    const frueher = jiraQuellstand({ key: "WART-5", fields: { updated: "2026-09-01T10:00:00Z" } });
    const spaeter = jiraQuellstand({ key: "WART-5", fields: { updated: "2026-09-01T10:01:00Z" } });
    expect((spaeter ?? 0) > (frueher ?? 0)).toBe(true);
  });
});
