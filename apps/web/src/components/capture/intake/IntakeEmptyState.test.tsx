import { afterEach, describe, expect, it } from "vitest";
import { pickExampleKo } from "../../../lib/intakeExample";
import { makeKo, makeSource, renderMarkup, setLanguage } from "../../../test/render";
import { IntakeEmptyState } from "./IntakeEmptyState";

// SCRUM-527 (WP1): der Leerzustand zeigt Frage + fertiges Beispiel + 4 Starter-Chips + Beruhigungssatz.

afterEach(async () => {
  await setLanguage("de");
});

describe("pickExampleKo", () => {
  it("bevorzugt ein validiertes KO mit Quelle", () => {
    const kos = [
      makeKo({ id: "a", status: "offen" }),
      makeKo({ id: "b", status: "validiert", sources: [] }),
      makeKo({ id: "c", status: "validiert", sources: [makeSource()] }),
    ];
    expect(pickExampleKo(kos)?.id).toBe("c");
  });

  it("leerer Bestand → null (Aufrufer zeigt Muster-KO)", () => {
    expect(pickExampleKo([])).toBeNull();
    expect(pickExampleKo(undefined)).toBeNull();
  });
});

describe("IntakeEmptyState", () => {
  it("zeigt die warme Frage, das Beispiel-Label und den Beruhigungssatz", () => {
    const html = renderMarkup(<IntakeEmptyState example={makeKo()} onStart={() => {}} />);
    expect(html).toContain("Was weißt du, das andere wissen sollten?");
    expect(html).toContain("So etwas — aber deins.");
    expect(html).toContain("Schreib einfach drauf los");
  });

  it("mit echtem KO → dessen Titel + Belegzeile (kein Beispiel-Badge)", () => {
    const ko = makeKo({
      title: "Pumpe entlüften",
      confidence: 84,
      sources: [makeSource({ url: "https://ex.com/q" })],
    });
    const html = renderMarkup(<IntakeEmptyState example={ko} onStart={() => {}} />);
    expect(html).toContain("Pumpe entlüften");
    expect(html).toContain('href="https://ex.com/q"'); // echte Belegzeile
    expect(html).toContain("84 % sicher");
    expect(html).not.toContain("Beispiel"); // kein Muster-Badge bei echtem KO
  });

  it("ohne KO → klar markierter Muster-KO (Beispiel-Badge, kein Fake-Bestand)", () => {
    const html = renderMarkup(<IntakeEmptyState example={null} onStart={() => {}} />);
    expect(html).toContain("Beispiel"); // Muster klar gekennzeichnet
    expect(html).toContain("Not-Aus"); // i18n-Muster-Inhalt
  });

  it("rendert genau vier Starter-Chips mit der ART Wissen", () => {
    const html = renderMarkup(<IntakeEmptyState example={makeKo()} onStart={() => {}} />);
    expect(html).toContain("Eine Entscheidung, die wir getroffen haben");
    expect(html).toContain("Ein Fehler, den man leicht macht");
    expect(html).toContain("Wie etwas bei uns wirklich läuft");
    expect(html).toContain("Etwas, das sich geändert hat");
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons).toHaveLength(4);
  });

  it("i18n: Frage + Chips folgen der Sprache (DE → EN → NL)", async () => {
    await setLanguage("en");
    let html = renderMarkup(<IntakeEmptyState example={makeKo()} onStart={() => {}} />);
    expect(html).toContain("What do you know that others should know?");
    expect(html).toContain("A decision we made");
    await setLanguage("nl");
    html = renderMarkup(<IntakeEmptyState example={makeKo()} onStart={() => {}} />);
    expect(html).toContain("Wat weet jij dat anderen zouden moeten weten?");
    expect(html).toContain("Een beslissing die we hebben genomen");
  });
});
