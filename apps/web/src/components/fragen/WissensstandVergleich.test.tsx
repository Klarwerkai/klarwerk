import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { AnswerResult, WissensstandVergleich } from "../../api/types";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { renderMarkup, setLanguage } from "../../test/render";
import { WissensstandVergleichAnzeige, tagVorEinemJahr } from "./WissensstandVergleich";

// R-1630 / R-2176: die Fläche zeigt „hier die alte Antwort, hier der Grund der Änderung" — so,
// wie der Server es schickt, in allen drei Sprachen ohne rohen Schlüssel.

function antwort(text: string | null, sources: string[]): AnswerResult {
  return {
    answered: text !== null,
    answer: text,
    knowledgeClass: "gesichert",
    trust: 99,
    sources,
    citedSources: sources,
    steps: [],
    demo: true,
  };
}

const VERGLEICH: WissensstandVergleich = {
  stichtag: "2025-10-08T10:00:00.000Z",
  damals: antwort("Bei Überdruck Ventil X manuell schließen.", ["ko-1"]),
  heute: antwort("Bei Überdruck Ventil Y automatisch schließen lassen.", ["ko-1"]),
  antwortGeaendert: true,
  quellen: [
    {
      id: "ko-1",
      title: "Ventil bei Überdruck schließen",
      titelDamals: null,
      versionHeute: 2,
      versionDamals: 1,
      inAntwortHeute: true,
      inAntwortDamals: true,
      gruende: ["ueberarbeitet"],
      aenderungen: [{ version: 2, at: "2026-02-01T09:00:00.000Z", note: "überarbeitet" }],
      aussageDamals: "Bei Überdruck Ventil X manuell schließen.",
      aussageHeute: "Bei Überdruck Ventil Y automatisch schließen lassen.",
    },
  ],
};

function zeige(vergleich: WissensstandVergleich): string {
  return renderMarkup(
    <MemoryRouter>
      <WissensstandVergleichAnzeige vergleich={vergleich} wissenHref={gespeicherteFassungHref} />
    </MemoryRouter>,
  );
}

afterEach(async () => {
  await setLanguage("de");
});

describe("R-1630 / R-2176 · Antwortvergleich in der Fragenfläche", () => {
  it("zeigt alte und neue Antwort, den Befund und den Grund je Quelle", async () => {
    await setLanguage("de");
    const html = zeige(VERGLEICH);
    expect(html).toContain("hätte diese Frage eine andere Antwort gehabt");
    expect(html).toContain("Ventil X manuell");
    expect(html).toContain("Ventil Y automatisch");
    expect(html).toContain("überarbeitet (Fassung 1 → 2)");
    expect(html).toContain('data-testid="ask-vergleich-aussage-damals"');
    expect(html).toContain('href="/wissen/ko-1?fassung=1&amp;ansicht=gespeichert"');
    expect(html).toContain('href="/wissen/ko-1?fassung=2&amp;ansicht=gespeichert"');
    expect(html).toContain('data-testid="ask-vergleich-grenzen"');
    expect(html).toContain('data-testid="ai-generated-notice"');
  });

  it("sagt ehrlich, wenn sich nichts geändert hat und damals keine Grundlage bestand", async () => {
    await setLanguage("de");
    const html = zeige({
      ...VERGLEICH,
      damals: antwort(null, []),
      heute: antwort(null, []),
      antwortGeaendert: false,
      quellen: [],
    });
    expect(html).toContain("und für heute fehlt eine belastbare Grundlage");
    expect(html).toContain("Keine belastbare Grundlage in diesem Wissensstand.");
  });

  it.each([
    ["de", "Die Formulierungen unterscheiden sich"],
    ["en", "The wording differs"],
    ["nl", "De formuleringen verschillen"],
  ] as const)(
    "beschreibt auf %s abweichenden Wortlaut bei identischen Quellen",
    async (sprache, befund) => {
      await setLanguage(sprache);
      const vergleich: WissensstandVergleich = {
        ...VERGLEICH,
        damals: antwort("Für die Übergabe braucht es einen Beleg.", ["ko-1"]),
        heute: antwort("Die Übergabe erfordert einen Beleg.", ["ko-1"]),
        quellen: VERGLEICH.quellen.map((q) => ({
          ...q,
          versionDamals: q.versionHeute,
          gruende: ["unveraendert"],
          aenderungen: [],
          aussageDamals: null,
          aussageHeute: null,
        })),
      };
      expect(zeige(vergleich)).toContain(befund);
      expect(zeige({ ...vergleich, heute: antwort("Ein anderer Stand.", ["ko-2"]) })).not.toContain(
        befund,
      );
    },
  );

  it.each(["de", "en", "nl"] as const)("%s: kein roher Schlüssel in der Fläche", async (lng) => {
    await setLanguage(lng);
    expect(zeige(VERGLEICH)).not.toContain("antwortvergleich.");
  });

  it("die Vorgabe des Stichtags ist genau ein Jahr zurück", () => {
    expect(tagVorEinemJahr(new Date("2026-10-08T10:00:00.000Z"))).toBe("2025-10-08");
  });
});
