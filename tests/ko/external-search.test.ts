import { describe, expect, it } from "vitest";
import type { ExternalResult } from "../../apps/web/src/api/types";
import { toSourcePayload } from "../../apps/web/src/lib/externalSearch";
import { toAddSourceRequest } from "../../apps/web/src/lib/koSource";

const result = (over: Partial<ExternalResult> = {}): ExternalResult => ({
  title: "Druckbehälter",
  url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
  snippet: "Ein Behälter unter Druck.",
  provider: "Wikipedia",
  ...over,
});

describe("SCRUM-118 / FR-EXT-02: externalSearch-Mapping", () => {
  it("mappt ExternalResult auf das add-source-Payload (label/url/excerpt/provider)", () => {
    expect(toSourcePayload(result())).toEqual({
      label: "Druckbehälter",
      url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
      excerpt: "Ein Behälter unter Druck.",
      provider: "Wikipedia",
    });
  });

  it("trimmt und begrenzt den Excerpt auf 300 Zeichen", () => {
    const long = "x".repeat(500);
    expect(toSourcePayload(result({ snippet: `  ${long}  ` })).excerpt).toHaveLength(300);
  });

  // R-1349 (Aufnahme gesamt-aufruferwaechter): Der Fall zu `isAttachable` ist mit der Prüfung
  // entfallen — sie hatte keinen Produktleser; Treffer ohne Titel verwirft der Server.

  // REF-01 (Ben nacharbeit-7 K2): der Abrufbeleg des Servers reist unverändert bis zu add-source.
  it("reicht den Abrufbeleg des Servers unverändert an den add-source-Rumpf weiter", () => {
    const payload = toSourcePayload(result({ abrufbeleg: "beleg.signatur" }));
    expect(payload.abrufbeleg).toBe("beleg.signatur");
    expect(toAddSourceRequest(payload)).toEqual({
      label: "Druckbehälter",
      url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
      excerpt: "Ein Behälter unter Druck.",
      abrufbeleg: "beleg.signatur",
    });
    // Ohne Beleg fehlt das Feld ganz — kein leerer Wert, keine Behauptung.
    expect(toAddSourceRequest(toSourcePayload(result()))).not.toHaveProperty("abrufbeleg");
  });
});
