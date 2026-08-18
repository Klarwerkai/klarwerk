import { describe, expect, it } from "vitest";
import {
  type ConfluenceMapOptions,
  confluenceGovernanceConfidentiality,
  confluenceSourcePath,
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

// ================================================================================================
// JOB 1131 · D1 — DIE AHNENKETTE: KEIN LEERES SEGMENT, KEIN ERFUNDENER ORDNER.
// ================================================================================================
//
// HERKUNFT. BEN4 hat zu JOB 931 als Prüflücke 2 wörtlich notiert: *„Spätere Umsetzung braucht
// Mapper-Test für leere/fehlende Ahnen: Ort `services/confluence/src/mapper`-Tests; Fall keine
// Ahnen, leere Titel, mehrstufige Ahnen; erwartet `sourcePath` fehlt bzw. leere Segmente werden
// gefiltert."* Die Zusage steht seit mega27 A2 im Code (`mapper.ts:42-53`) — geprüft hat sie
// bisher NICHTS: keiner der sieben Bestandsfälle dieser Datei berührt `sourcePath`.
//
// GEMESSEN AM ECHTEN MAPPER, nicht an einer Nachbildung: jeder Fall geht durch
// `confluenceSourcePath` bzw. `mapConfluencePageToImportItem` — dieselben Funktionen, die der
// Adapter im Importlauf ruft.
//
// WARUM DAS EIN SICHERHEITSNETZ IST und keine Formalie: `sourcePath` wird ohne weitere Prüfung zum
// Ordnerbaum der Importvorschau. Ein leeres Segment darin wäre ein namenloser Ordner, den niemand
// zuordnen kann; ein erfundener Wurzelpfad wäre eine Struktur, die es in der Quelle nicht gibt.
// Beide Fehler sind aus der Anzeige heraus nicht mehr von echter Hierarchie zu unterscheiden.
describe("JOB 1131 · confluenceSourcePath — Ahnenkette ohne leere Segmente", () => {
  const seite = (ancestors: ConfluencePage["ancestors"]): ConfluencePage =>
    ({ id: "9000", title: "Kindseite", ...(ancestors ? { ancestors } : {}) }) as ConfluencePage;

  it("A-1: KEINE Ahnen (Feld fehlt) ⇒ sourcePath fehlt — kein leeres Array, kein Platzhalter", () => {
    expect(confluenceSourcePath(seite(undefined))).toBeUndefined();
    // Und am ganzen Mapper: das Feld ist nicht bloss leer, es EXISTIERT nicht.
    const item = mapConfluencePageToImportItem(seite(undefined), OPTS);
    expect(item.sourcePath).toBeUndefined();
    expect(Object.hasOwn(item, "sourcePath")).toBe(false);
  });

  it("A-2: LEERES Ahnen-Array ⇒ sourcePath fehlt (eine Wurzelseite hat keinen Pfad)", () => {
    expect(confluenceSourcePath(seite([]))).toBeUndefined();
    expect(Object.hasOwn(mapConfluencePageToImportItem(seite([]), OPTS), "sourcePath")).toBe(false);
  });

  it("A-3: ALLE Ahnentitel leer ⇒ sourcePath fehlt — nie ein Pfad aus lauter Nichts", () => {
    const nurLeere = seite([
      { id: "1", title: "" },
      { id: "2", title: "   " },
    ] as ConfluencePage["ancestors"]);
    expect(confluenceSourcePath(nurLeere)).toBeUndefined();
    expect(Object.hasOwn(mapConfluencePageToImportItem(nurLeere, OPTS), "sourcePath")).toBe(false);
  });

  it("A-4: EIN leerer Titel zwischen gefüllten ⇒ er fällt weg, die anderen bleiben in Reihenfolge", () => {
    // DER KERNFALL der Prüflücke: leere Segmente werden GEFILTERT, nicht durchgereicht.
    const gemischt = seite([
      { id: "1", title: "Handbuch" },
      { id: "2", title: "   " },
      { id: "3", title: "Anlage 1" },
    ] as ConfluencePage["ancestors"]);
    const pfad = confluenceSourcePath(gemischt);
    expect(pfad).toEqual(["Handbuch", "Anlage 1"]);
    expect(pfad?.every((segment) => segment.length > 0)).toBe(true);
    expect(pfad).not.toContain("");
  });

  it("A-5: MEHRSTUFIG ⇒ Wurzel zuerst, ohne die Seite selbst, Reihenfolge unverändert", () => {
    const tief = seite([
      { id: "1", title: "Handbuch" },
      { id: "2", title: "Betrieb" },
      { id: "3", title: "Ventile" },
    ] as ConfluencePage["ancestors"]);
    expect(confluenceSourcePath(tief)).toEqual(["Handbuch", "Betrieb", "Ventile"]);
    // Die Seite selbst gehört NICHT in ihren eigenen Pfad — sonst stünde sie im Ordnerbaum
    // als Ordner UND als Zeile darin.
    expect(confluenceSourcePath(tief)).not.toContain("Kindseite");
  });

  it("A-6: Ahnentitel werden dekodiert und getrimmt — wie Titel, Autor und Labels", () => {
    const entities = seite([
      { id: "1", title: "  Betriebsanleitung  " },
      { id: "2", title: "T&auml;tigkeiten &amp; Rollen" },
    ] as ConfluencePage["ancestors"]);
    expect(confluenceSourcePath(entities)).toEqual(["Betriebsanleitung", "Tätigkeiten & Rollen"]);
  });

  it("A-7: KALIBRIERUNG — ein einzelner gefüllter Ahn ergibt genau ein Segment", () => {
    // Ohne diesen Fall wäre jedes „ist undefined" oben auch dann grün, wenn die Funktion
    // grundsätzlich nie einen Pfad liefert.
    const einer = seite([{ id: "1", title: "Handbuch" }] as ConfluencePage["ancestors"]);
    expect(confluenceSourcePath(einer)).toEqual(["Handbuch"]);
    expect(mapConfluencePageToImportItem(einer, OPTS).sourcePath).toEqual(["Handbuch"]);
  });
});
