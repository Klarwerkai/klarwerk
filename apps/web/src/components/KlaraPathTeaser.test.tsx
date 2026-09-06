import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "../test/render";
import { KlaraPathTeaser } from "./KlaraPathTeaser";

function renderTeaser(surface: "start" | "capture" | "import"): string {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <KlaraPathTeaser surface={surface} />
    </StaticRouter>,
  );
}

afterEach(async () => {
  await setLanguage("de");
});

describe("KlaraPathTeaser", () => {
  it.each([
    ["start", "Klara begleitet Wissen von Anfang an."],
    ["capture", "Erzähl es Klara — sie macht daraus einen klaren Entwurf."],
    ["import", "Klara bereitet importiertes Wissen mit dir auf."],
  ] as const)("kündigt den Klara-Weg auf %s prägnant und ehrlich an", (surface, title) => {
    const html = renderTeaser(surface);

    expect(html).toContain(title);
    expect(html).toContain("Demnächst");
    expect(html).toContain("Klara hilft dir schon heute in der Web-App — hier geht es zur Hilfe.");
    expect(html.match(/<a(?:\s|>)/g)).toHaveLength(1);
    expect(html).toMatch(/<a\s[^>]*href="\/hilfe"/);
    expect(html).not.toMatch(/<button(?:\s|>)/);
    expect(html).not.toContain("Mit Klara starten");
    expect(html).not.toContain("Mit Klara Wissen erfassen");
    expect(html).not.toContain("Import mit Klara begleiten");
  });

  it.each(["start", "capture", "import"] as const)(
    "erklaert auf %s den geplanten Microsoft-365-Weg im aufklappbaren Abschnitt",
    (surface) => {
      const html = renderTeaser(surface);

      expect(html).toMatch(/<details(?:\s|>)/);
      expect(html).toMatch(/<summary(?:\s|>)/);
      expect(html).toContain("Was Klara in Microsoft 365 tun wird");
      expect(html).toContain("Klara ist als bidirektionales Add-in für Microsoft 365 geplant.");
      expect(html).toContain(
        "geprüftes Unternehmenswissen aus Klarwerk direkt in Microsoft 365 bereitstellen",
      );
      expect(html).toContain("Verfügbar ist das noch nicht.");
      // UX-16/N-0042 ersetzt das BASIC-338-Linkverbot durch genau einen Hilfeweg; kein Button.
      expect(html.match(/<a(?:\s|>)/g)).toHaveLength(1);
      expect(html).toMatch(/<a\s[^>]*href="\/hilfe"/);
      expect(html).not.toMatch(/<button(?:\s|>)/);
    },
  );

  it("gibt allen drei Einbindungen denselben Erklaertext", () => {
    const auszug = (surface: "start" | "capture" | "import"): string => {
      const html = renderTeaser(surface);
      const treffer = html.match(/<details[\s\S]*<\/details>/);
      expect(treffer).not.toBeNull();
      return treffer?.[0] ?? "";
    };

    expect(auszug("capture")).toBe(auszug("start"));
    expect(auszug("import")).toBe(auszug("start"));
    const hilfeweg = (surface: "start" | "capture" | "import") =>
      renderTeaser(surface).match(/<a\s[\s\S]*?<\/a>/)?.[0];
    expect(hilfeweg("start")).toBeDefined();
    expect(hilfeweg("capture")).toBe(hilfeweg("start"));
    expect(hilfeweg("import")).toBe(hilfeweg("start"));
  });

  it("folgt der gewählten Sprache", async () => {
    await setLanguage("en");
    expect(renderTeaser("capture")).toContain("Tell Klara — she turns it into a clear draft.");

    await setLanguage("nl");
    expect(renderTeaser("import")).toContain("Klara helpt geïmporteerde kennis voor te bereiden.");
  });

  it("erklaert Microsoft 365 auch auf Englisch und Niederlaendisch", async () => {
    await setLanguage("en");
    const en = renderTeaser("start");
    expect(en).toContain("What Klara will do in Microsoft 365");
    expect(en).toContain("Klara is planned as a bidirectional add-in for Microsoft 365.");
    expect(en).toContain(
      "make reviewed company knowledge from Klarwerk available directly in Microsoft 365",
    );
    expect(en).toContain("This is not available yet.");
    expect(en).toContain("Klara already helps you in the web app — open the help page here.");

    await setLanguage("nl");
    const nl = renderTeaser("start");
    expect(nl).toContain("Wat Klara in Microsoft 365 gaat doen");
    expect(nl).toContain("Klara is gepland als bidirectionele add-in voor Microsoft 365.");
    expect(nl).toContain(
      "stelt gecontroleerde bedrijfskennis uit Klarwerk rechtstreeks in Microsoft 365 beschikbaar",
    );
    expect(nl).toContain("Beschikbaar is dit nog niet.");
    expect(nl).toContain("Klara helpt je nu al in de webapp — ga hier naar de hulppagina.");
  });
});
