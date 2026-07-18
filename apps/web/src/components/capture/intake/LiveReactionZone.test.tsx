import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { LiveVerdict } from "../../../lib/intakeSimilarity";
import { setLanguage } from "../../../test/render";
import { LiveReactionZone } from "./LiveReactionZone";

// SCRUM-527 (WP2): die „denkt mit"-Zone in allen Zuständen. <Link> braucht einen Router → MemoryRouter.
function render(el: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
}

afterEach(async () => {
  await setLanguage("de");
});

describe("LiveReactionZone", () => {
  it("checking: ehrlicher Lauf-Zustand mit pulsierenden Punkten (kein toter Balken)", () => {
    const html = render(<LiveReactionZone verdict={{ status: "checking" }} />);
    expect(html).toContain("Prüfe gegen euren Wissensstand");
    expect(html).toContain("animate-pulse"); // lebendig
  });

  it("new: du bist die erste Person", () => {
    const html = render(<LiveReactionZone verdict={{ status: "new" }} />);
    expect(html).toContain("Das ist neu");
    expect(html).toContain("Du bist die erste Person");
  });

  it("similar: Titel + Link zum bestehenden KO + Ergänzen-oder-neu", () => {
    const verdict: LiveVerdict = {
      status: "similar",
      match: { koId: "k1", title: "Not-Aus vor Wartung", score: 0.6 },
    };
    const html = render(<LiveReactionZone verdict={verdict} />);
    expect(html).toContain("Ähnliches existiert schon");
    expect(html).toContain("Not-Aus vor Wartung");
    expect(html).toContain('href="/wissen/k1"');
    // SCRUM-527 (Iteration 1): neuer Tab → Entwurf bleibt erhalten, /wissen/:id rendert regulär.
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain("Ergänzen oder neu?");
  });

  it("conflict: Warnung + Link (andockbereit; vom Hook nicht erfunden)", () => {
    const verdict: LiveVerdict = {
      status: "conflict",
      match: { koId: "k9", title: "Alte Regel", score: 0.5 },
    };
    const html = render(<LiveReactionZone verdict={verdict} />);
    expect(html).toContain("könnte widersprechen");
    expect(html).toContain("Alte Regel");
    expect(html).toContain('href="/wissen/k9"');
  });

  it("G-2: pending = Widerspruch NICHT geprüft — sichtbar, NIE als 'neu'", () => {
    const html = render(<LiveReactionZone verdict={{ status: "pending" }} />);
    expect(html).toContain("noch nicht geprüft");
    // Darf NICHT die positive „neu, du bist die erste Person"-Behauptung zeigen.
    expect(html).not.toContain("Das ist neu");
    expect(html).not.toContain("Du bist die erste Person");
  });

  it("G-2: unavailable = Prüfung nicht verfügbar — sichtbar, NIE als 'neu'", () => {
    const html = render(<LiveReactionZone verdict={{ status: "unavailable" }} />);
    expect(html).toContain("nicht verfügbar");
    expect(html).not.toContain("Das ist neu");
  });

  it("idle: ruhiges 'hört zu' (Zone nie tot)", () => {
    const html = render(<LiveReactionZone verdict={{ status: "idle" }} />);
    expect(html).toContain("Ich höre zu");
  });

  it("i18n: Zustände folgen der Sprache (DE → EN → NL)", async () => {
    await setLanguage("en");
    // Apostroph wird im Markup escaped → auf den apostrophfreien Teil prüfen.
    expect(render(<LiveReactionZone verdict={{ status: "new" }} />)).toContain("nothing on it yet");
    await setLanguage("nl");
    expect(render(<LiveReactionZone verdict={{ status: "new" }} />)).toContain(
      "Jij bent de eerste",
    );
  });
});
