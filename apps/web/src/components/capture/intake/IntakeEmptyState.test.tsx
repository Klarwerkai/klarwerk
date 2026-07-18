import { afterEach, describe, expect, it } from "vitest";
import { dominantCategory, pickExampleKo } from "../../../lib/intakeExample";
import { makeKo, makeSource, renderMarkup, setLanguage } from "../../../test/render";
import { IntakeEmptyState } from "./IntakeEmptyState";

// SCRUM-527 (Iteration 1): Leerzustand — Frage + (nur bei Signal) domänennahes Beispiel + 4 Starter +
// Beruhigungssatz. Nie ein fachfremdes Muster aufdrängen.

afterEach(async () => {
  await setLanguage("de");
});

describe("dominantCategory", () => {
  it("liefert die häufigste Kategorie", () => {
    const kos = [
      makeKo({ id: "a", category: "Wartung" }),
      makeKo({ id: "b", category: "Wartung" }),
      makeKo({ id: "c", category: "Sicherheit" }),
    ];
    expect(dominantCategory(kos)).toBe("Wartung");
  });
  it("leer → undefined (kein Signal)", () => {
    expect(dominantCategory([])).toBeUndefined();
    expect(dominantCategory(undefined)).toBeUndefined();
  });
});

describe("pickExampleKo", () => {
  it("bevorzugt validiertes KO mit Quelle in der Domäne (preferCategory)", () => {
    const kos = [
      makeKo({ id: "a", status: "validiert", category: "Sicherheit", sources: [makeSource()] }),
      makeKo({ id: "b", status: "validiert", category: "Wartung", sources: [makeSource()] }),
    ];
    expect(pickExampleKo(kos, "Wartung")?.id).toBe("b"); // Domäne gewinnt
  });

  it("ohne Domänen-Treffer → irgendein validiertes KO mit Quelle", () => {
    const kos = [
      makeKo({ id: "a", status: "offen" }),
      makeKo({ id: "b", status: "validiert", sources: [makeSource()] }),
    ];
    expect(pickExampleKo(kos, "GibtsNicht")?.id).toBe("b");
  });

  it("leerer Bestand → null (kein aufgedrängtes Beispiel)", () => {
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

  it("mit echtem KO → dessen Titel + Belegzeile", () => {
    const ko = makeKo({
      title: "Pumpe entlüften",
      confidence: 84,
      sources: [makeSource({ url: "https://ex.com/q" })],
    });
    const html = renderMarkup(<IntakeEmptyState example={ko} onStart={() => {}} />);
    expect(html).toContain("Pumpe entlüften");
    expect(html).toContain('href="https://ex.com/q"');
    expect(html).toContain("84 % sicher");
  });

  it("ohne Beispiel (null) → KEIN aufgedrängtes Muster, nur Frage + Chips", () => {
    const html = renderMarkup(<IntakeEmptyState example={null} onStart={() => {}} />);
    expect(html).not.toContain("So etwas — aber deins."); // keine Beispiel-Karte
    expect(html).not.toContain("Not-Aus"); // kein fachfremdes Muster
    expect(html).toContain("Was weißt du"); // Frage bleibt
    expect(html).toContain("Eine Entscheidung, die wir getroffen haben"); // Chips bleiben
  });

  it("rendert genau vier Starter-Chips mit der ART Wissen", () => {
    const html = renderMarkup(<IntakeEmptyState example={makeKo()} onStart={() => {}} />);
    expect(html).toContain("Eine Entscheidung, die wir getroffen haben");
    expect(html).toContain("Ein Fehler, den man leicht macht");
    expect(html).toContain("Wie etwas bei uns wirklich läuft");
    expect(html).toContain("Etwas, das sich geändert hat");
    expect((html.match(/<button/g) ?? []).length).toBe(4);
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
