import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "../../../test/render";
import { IntakeCompletion } from "./IntakeCompletion";

// SCRUM-527 (WP4): der Abschluss zeigt die Konsequenz + Namensnennung, nicht „gespeichert".

function render(el: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
}

afterEach(async () => {
  await setLanguage("de");
});

describe("IntakeCompletion", () => {
  it("zeigt Aktualitätsprüfung, Namensnennung und Auffindbarkeit", () => {
    const html = render(<IntakeCompletion authorName="Anna Muster" koId="k1" />);
    expect(html).toContain("Auf Aktualität geprüft.");
    expect(html).toContain("Anna Muster"); // Name als Quelle hinterlegt
    expect(html).toContain("findet es — nicht dich");
  });

  it("mit koId → Link zum Wissensobjekt", () => {
    const html = render(<IntakeCompletion authorName="Anna" koId="k1" />);
    expect(html).toContain('href="/wissen/k1"');
    expect(html).toContain("Wissensobjekt ansehen");
  });

  it("ohne koId → kein Link", () => {
    const html = render(<IntakeCompletion authorName="Anna" />);
    expect(html).not.toContain('href="/wissen/');
  });

  it("Nachfrage-Bezug (499) erscheint NUR bei followUpAvailable (kein Fake-Haken)", () => {
    const off = render(<IntakeCompletion authorName="Anna" koId="k1" />);
    expect(off).not.toContain('type="checkbox"');
    const on = render(<IntakeCompletion authorName="Anna" koId="k1" followUpAvailable />);
    expect(on).toContain('type="checkbox"');
    expect(on).toContain("Mich bei Rückfragen dazu benachrichtigen");
  });

  it("i18n: Namensnennung interpoliert + Sprache (DE → EN → NL)", async () => {
    await setLanguage("en");
    let html = render(<IntakeCompletion authorName="Anna" koId="k1" />);
    expect(html).toContain("Your name (Anna) is on file as the source.");
    await setLanguage("nl");
    html = render(<IntakeCompletion authorName="Anna" koId="k1" />);
    expect(html).toContain("Je naam (Anna) staat als bron vermeld.");
  });
});
