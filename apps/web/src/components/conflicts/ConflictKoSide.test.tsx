import { afterEach, describe, expect, it } from "vitest";
import { makeKo, makeSource, renderMarkup, setLanguage } from "../../test/render";
import { ConflictKoSide } from "./ConflictKoSide";

// SCRUM-486 (WP4): der Beleg je Konfliktseite ist der Wow-Moment und muss SICHTBAR sein (nicht in
// einem zugeklappten <details>). Pinnt: kanonische Aussage + klickbare Quelle + Konfidenz sichtbar,
// ehrlicher Entfernt-Zustand, A/B nicht vertauscht, i18n.

afterEach(async () => {
  await setLanguage("de");
});

describe("ConflictKoSide", () => {
  it("zeigt Kernaussage + klickbare Quelle + Konfidenz (Beleg sichtbar)", () => {
    const ko = makeKo({
      title: "Ventil sofort schließen",
      statement: "Bei Überdruck sofort schließen.",
      confidence: 88,
      sources: [makeSource({ url: "https://a.example/quelle" })],
    });
    const html = renderMarkup(<ConflictKoSide ko={ko} fallbackId="ko-a" />);
    expect(html).toContain("Ventil sofort schließen");
    expect(html).toContain("Bei Überdruck sofort schließen.");
    expect(html).toContain('href="https://a.example/quelle"'); // klickbare Quelle
    expect(html).toContain("88 % sicher"); // Konfidenz als lesbare Sprache
  });

  it("ohne KO → ehrlicher Entfernt-Zustand mit Herkunfts-ID (kein Fake)", () => {
    const html = renderMarkup(<ConflictKoSide ko={null} fallbackId="ko-weg-123" />);
    expect(html).toContain("Objekt entfernt");
    expect(html).toContain("ko-weg-123");
    expect(html).not.toContain("href="); // kein toter/erfundener Link
  });

  it("A/B bleibt zugeordnet — jede Seite zeigt IHRE eigene Quelle (nicht vertauscht)", () => {
    const koA = makeKo({
      id: "A",
      sources: [makeSource({ id: "sa", url: "https://a.example/A" })],
    });
    const koB = makeKo({
      id: "B",
      sources: [makeSource({ id: "sb", url: "https://b.example/B" })],
    });
    const html = renderMarkup(
      <>
        <ConflictKoSide ko={koA} fallbackId="A" />
        <ConflictKoSide ko={koB} fallbackId="B" />
      </>,
    );
    const aIdx = html.indexOf("https://a.example/A");
    const bIdx = html.indexOf("https://b.example/B");
    expect(aIdx).toBeGreaterThanOrEqual(0);
    expect(bIdx).toBeGreaterThan(aIdx); // A-Quelle vor B-Quelle → Reihenfolge/Zuordnung erhalten
  });

  it("i18n: das Seiten-Beleg-Label folgt der Sprache (DE → EN → NL)", async () => {
    const ko = makeKo({ sources: [makeSource()] });
    expect(renderMarkup(<ConflictKoSide ko={ko} fallbackId="x" />)).toContain("Beleg dieser Seite");
    await setLanguage("en");
    expect(renderMarkup(<ConflictKoSide ko={ko} fallbackId="x" />)).toContain(
      "Evidence for this side",
    );
    await setLanguage("nl");
    expect(renderMarkup(<ConflictKoSide ko={ko} fallbackId="x" />)).toContain(
      "Bewijs van deze kant",
    );
  });
});
