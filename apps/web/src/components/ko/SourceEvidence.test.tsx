import { afterEach, describe, expect, it } from "vitest";
import { makeSource, renderMarkup, setLanguage } from "../../test/render";
import { SourceEvidence, SourceLink } from "./SourceEvidence";

// SCRUM-513/486 (WP2): Belegschicht-Baustein. Pinnt: klickbare Quelle vs. ehrlicher Nicht-Link,
// Konfidenz IMMER als lesbare %-Sprache, Quelldatum vorhanden/fehlend, beide Varianten, i18n.

afterEach(async () => {
  await setLanguage("de");
});

describe("SourceLink", () => {
  it("mit URL → echter Link (href, neuer Tab)", () => {
    const html = renderMarkup(
      <SourceLink source={makeSource({ label: "Handbuch", url: "https://ex.com/h" })} />,
    );
    expect(html).toContain('href="https://ex.com/h"');
    expect(html).toContain("Handbuch");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("ohne URL → KEIN toter Link, sondern Label plus interne-Quelle-Markierung", () => {
    const html = renderMarkup(<SourceLink source={makeSource({ label: "Mündlich", url: null })} />);
    expect(html).not.toContain("<a ");
    expect(html).toContain("Mündlich");
    expect(html).toContain("interne Quelle");
  });

  it("zeigt den Anbieter, wenn vorhanden", () => {
    const html = renderMarkup(<SourceLink source={makeSource({ provider: "Confluence" })} />);
    expect(html).toContain("Confluence");
  });
});

describe("SourceEvidence", () => {
  it("full: Quelle + Quelldatum + Konfidenz als lesbare %-Sprache (nicht nur Rohzahl)", () => {
    const html = renderMarkup(
      <SourceEvidence
        sources={[makeSource({ url: "https://ex.com/h" })]}
        confidence={84}
        date="2026-04-20T10:00:00.000Z"
        variant="full"
      />,
    );
    expect(html).toContain('href="https://ex.com/h"');
    expect(html).toContain("2026"); // Quelldatum sichtbar
    expect(html).toContain("84 % sicher"); // lesbare Konfidenz-Sprache
  });

  it("compact: einzeilige Belegzeile mit +N-weitere-Hinweis bei mehreren Quellen", () => {
    const html = renderMarkup(
      <SourceEvidence
        sources={[makeSource({ id: "s1" }), makeSource({ id: "s2" }), makeSource({ id: "s3" })]}
        confidence={90}
        date="2026-04-20T10:00:00.000Z"
        variant="compact"
      />,
    );
    expect(html).toContain("+2 weitere");
    expect(html).toContain("90 % sicher");
  });

  it("ohne Quelle → ehrlicher Leerzustand statt leerer Fläche", () => {
    const html = renderMarkup(<SourceEvidence sources={[]} confidence={70} variant="full" />);
    expect(html).toContain("keine Quelle hinterlegt");
  });

  it("ohne Datum → ehrlicher kein-Quelldatum-Hinweis (kein Fake-Datum)", () => {
    const html = renderMarkup(
      <SourceEvidence sources={[makeSource()]} confidence={70} date={null} variant="full" />,
    );
    expect(html).toContain("kein Quelldatum");
  });

  it("niedrige vs. hohe Konfidenz spiegeln sich in der %-Sprache", () => {
    const low = renderMarkup(<SourceEvidence sources={[makeSource()]} confidence={42} />);
    const high = renderMarkup(<SourceEvidence sources={[makeSource()]} confidence={95} />);
    expect(low).toContain("42 % sicher");
    expect(high).toContain("95 % sicher");
  });

  it("ohne Konfidenz-Prop → keine erfundene Zahl", () => {
    const html = renderMarkup(<SourceEvidence sources={[makeSource()]} date={null} />);
    expect(html).not.toContain("% sicher");
  });

  it("i18n: Belegschicht-Labels folgen der Sprache (DE → EN → NL)", async () => {
    const props = { sources: [], confidence: 80 as number, date: null };
    expect(renderMarkup(<SourceEvidence {...props} />)).toContain("keine Quelle hinterlegt");
    await setLanguage("en");
    const en = renderMarkup(<SourceEvidence {...props} />);
    expect(en).toContain("no source on file");
    expect(en).toContain("80 % confident");
    await setLanguage("nl");
    const nl = renderMarkup(<SourceEvidence {...props} />);
    expect(nl).toContain("geen bron vastgelegd");
    expect(nl).toContain("80 % zeker");
  });
});
