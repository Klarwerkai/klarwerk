import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const code = readFileSync("apps/web/public/word-addin/dokumentvergleich.js", "utf8");
const pruefen = runInNewContext(`${code}\naskPruefpassageAmCursor`) as (
  context: unknown,
  auswahl: unknown,
  abgebrochen: () => boolean,
) => Promise<{ text?: string; bereich?: unknown; hinweis?: string }>;

function word(saetze: string[], position: number | "vorher", absatztext = saetze.join(" ")) {
  const bereiche = saetze.map((text) => ({ text }));
  const inhalt = {
    getTextRanges: vi.fn(() => ({ load: vi.fn(), items: bereiche })),
    getRange: () => ({
      expandTo: () => ({ load: vi.fn(), text: absatztext.slice(0, Number(position)) }),
    }),
  };
  const absatz = { text: absatztext, load: vi.fn(), getRange: () => inhalt };
  const leer = { text: "", getPreviousOrNullObject: () => absatz };
  const auswahl = { paragraphs: { load: vi.fn(), items: [position === "vorher" ? leer : absatz] } };
  const lesen = () => pruefen({ sync: async () => {} }, auswahl, () => false);
  return { bereiche, inhalt, lesen };
}

describe("Prüfpassage am Word-Cursor", () => {
  it.each(["Guest Wi-Fi must provide access", "Guest Wi-Fi must not provide access."])(
    "behält den vollständigen einzelnen Satz mit und ohne Satzzeichen",
    async (text) => {
      const host = word([text], 4);
      const fund = await host.lesen();
      expect(fund.text).toBe(text);
      expect(fund.bereich).toBe(host.inhalt);
    },
  );

  it("bindet beim wiederholten Satz den zweiten konkreten Word-Bereich", async () => {
    const host = word(["Check this.", "Check this.", "Another rule."], 13);
    const fund = await host.lesen();
    expect(fund.text).toBe("Check this.");
    expect(fund.bereich).toBe(host.bereiche[1]);
  });

  it("liest am Beginn eines leeren Absatzes nur den letzten Satz unmittelbar davor", async () => {
    const host = word(["Introduction.", "Guest Wi-Fi must not provide access."], "vorher");
    const fund = await host.lesen();
    expect(fund.text).toBe(host.bereiche[1]?.text);
    expect(fund.bereich).toBe(host.bereiche[1]);
  });

  it("verwirft unvollständige oder zwischenzeitlich geänderte Satzbereiche", async () => {
    const host = word(["First.", "Third."], 12, "First. Second. Third.");
    expect(await host.lesen()).toEqual({ hinweis: "askAbsatzFehlt" });
  });
});
