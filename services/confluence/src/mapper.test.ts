import { describe, expect, it } from "vitest";
import {
  type ConfluenceMapOptions,
  confluenceGovernanceConfidentiality,
  isPageRestricted,
  mapConfluencePageToImportItem,
} from "./mapper";
import type { ConfluencePage } from "./rest-client";

// SCRUM-510: Confluence-Seite → normalisiertes ImportItem. Deterministische Fixtures (aufgezeichnete
// Confluence-Antwortform), DOM-frei.

const OPTS: ConfluenceMapOptions = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

const restrictedPage: ConfluencePage = {
  id: "1001",
  title: "Notfallplan Pumpe",
  body: { storage: { value: "<p>Bei Überdruck Ventil <strong>X</strong> schließen.</p>" } },
  version: { number: 4, by: { displayName: "Anna Admin" } },
  _links: { webui: "/spaces/K/pages/1001/Notfallplan" },
  metadata: { labels: { results: [{ name: "wartung" }, { name: "sicherheit" }] } },
  restrictions: {
    read: { restrictions: { user: { results: [{ x: 1 }] }, group: { results: [] } } },
  },
};

const openPage: ConfluencePage = {
  id: "1002",
  title: "Allgemeine Hinweise",
  body: { storage: { value: "<p>Hinweis zur Anlage.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/1002/Hinweise" },
  metadata: { labels: { results: [] } },
  restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
};

describe("SCRUM-510: mapConfluencePageToImportItem", () => {
  it("mappt Inhalt, Provenienz (Space+pageId+URL), Tags und Ursprung", () => {
    const item = mapConfluencePageToImportItem(restrictedPage, OPTS);
    expect(item.title).toBe("Notfallplan Pumpe");
    expect(item.statement).toContain("Ventil X"); // Plaintext-Kernaussage aus dem Body
    expect(item.bodyHtml).toContain("<strong>X</strong>"); // Rich-Body reist mit
    expect(item.tags).toEqual(["wartung", "sicherheit"]); // Labels → Tags
    expect(item.externalId).toBe("1001"); // quellneutraler Ursprung/Idempotenz-Anker (R2b)
    expect(item.sourceScope).toBe("K");
    expect(item.category).toBe("K");
    expect(item.sourceVersion).toBe(4);
    expect(item.url).toBe("https://acme.atlassian.net/wiki/spaces/K/pages/1001/Notfallplan");
    expect(item.provider).toBe("Confluence");
    expect(item.author).toBe("Anna Admin");
  });

  it("IC-1: version.when → updatedAt (ISO); fehlt es, bleibt updatedAt unbesetzt", () => {
    const withWhen = {
      ...openPage,
      version: { number: 2, when: "2026-04-01T10:30:00.000Z" },
    };
    expect(mapConfluencePageToImportItem(withWhen, OPTS).updatedAt).toBe(
      "2026-04-01T10:30:00.000Z",
    );
    // openPage ohne version.when → updatedAt fehlt (rein additiv, kein Pflichtfeld).
    expect(mapConfluencePageToImportItem(openPage, OPTS).updatedAt).toBeUndefined();
  });

  it("SCRUM-511: restringierte Seite ergibt Governance-Signal vertraulich (mind.)", () => {
    expect(isPageRestricted(restrictedPage)).toBe(true);
    expect(confluenceGovernanceConfidentiality(restrictedPage)).toBe("vertraulich");
    expect(mapConfluencePageToImportItem(restrictedPage, OPTS).confidentiality).toBe("vertraulich");
  });

  it("SCRUM-511: nicht restringierte Seite → KEIN Signal (undefined; Import-Kern stuft fail-safe)", () => {
    expect(isPageRestricted(openPage)).toBe(false);
    expect(confluenceGovernanceConfidentiality(openPage)).toBeUndefined();
    // NIE „intern" aus dem Mapper — das Feld bleibt schlicht unbesetzt (downstream fail-safe vertraulich).
    expect(mapConfluencePageToImportItem(openPage, OPTS).confidentiality).toBeUndefined();
  });

  it("statement fällt auf den Titel zurück, wenn der Body leer ist (nie leer)", () => {
    const empty: ConfluencePage = { id: "9", title: "Nur Titel", body: { storage: { value: "" } } };
    expect(mapConfluencePageToImportItem(empty, OPTS).statement).toBe("Nur Titel");
  });

  // WP-IC-PAKET-1 (Teil 1, Pedis Screenshot): Storage-Format-Entities (&uuml; &middot; &#228;) landen
  // als ECHTE Zeichen im importierten statement — der Fix sitzt an der Quelle (htmlToPlainText).
  it("HTML-Entities des Storage-Formats werden beim Import dekodiert (benannt + numerisch)", () => {
    const page: ConfluencePage = {
      id: "10",
      title: "Onboarding",
      body: {
        storage: {
          value: "<p>Guide f&uuml;r neue Mitarbeiter &middot; T&#228;tigkeiten &amp; Rollen</p>",
        },
      },
    };
    const item = mapConfluencePageToImportItem(page, OPTS);
    expect(item.statement).toBe("Guide für neue Mitarbeiter · Tätigkeiten & Rollen");
    expect(item.statement).not.toContain("&uuml;");
    expect(item.statement).not.toContain("&#228;");
  });
});
