import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "../test/render";
import { KlaraPathTeaser } from "./KlaraPathTeaser";

afterEach(async () => {
  await setLanguage("de");
});

describe("KlaraPathTeaser", () => {
  it.each([
    ["start", "Klara begleitet Wissen von Anfang an."],
    ["capture", "Erzähl es Klara — sie macht daraus einen klaren Entwurf."],
    ["import", "Klara bereitet importiertes Wissen mit dir auf."],
  ] as const)("kündigt den Klara-Weg auf %s prägnant und ehrlich an", (surface, title) => {
    const html = renderToStaticMarkup(<KlaraPathTeaser surface={surface} />);

    expect(html).toContain(title);
    expect(html).toContain("Demnächst");
    expect(html).not.toMatch(/<a(?:\s|>)/);
    expect(html).not.toMatch(/<button(?:\s|>)/);
    expect(html).not.toMatch(/href=|role=|tabindex=|onclick=|ArrowRight/);
  });

  it("kennzeichnet die Vorschau in allen angebotenen Sprachen", async () => {
    await setLanguage("en");
    const english = renderToStaticMarkup(<KlaraPathTeaser surface="capture" />);
    expect(english).toContain("Tell Klara — she turns it into a clear draft.");
    expect(english).toContain("Coming soon");

    await setLanguage("nl");
    const dutch = renderToStaticMarkup(<KlaraPathTeaser surface="import" />);
    expect(dutch).toContain("Klara helpt geïmporteerde kennis voor te bereiden.");
    expect(dutch).toContain("Binnenkort");
  });

  it.each([
    ["../pages/Start.tsx", "start"],
    ["../pages/Capture.tsx", "capture"],
    ["../pages/Stufe2.tsx", "import"],
  ])("bleibt auf %s als Vorschau eingebunden", (path, surface) => {
    const page = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(page).toContain(`import { KlaraPathTeaser } from "../components/KlaraPathTeaser";`);
    expect(page).toContain(`<KlaraPathTeaser surface="${surface}" />`);
  });
});
