import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
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
  // AUFNAHME 20260922 · VORSCHAU-REICHWEITE — ANGEPASST, WEIL DIE ANFORDERUNG ES VERLANGT.
  // Hier stand „Prüfe gegen euren Wissensstand" und ein Fall „new: du bist die erste Person" mit der
  // Erwartung „Das ist neu". Die Anforderung (Kriterien 1 und 2 der Aufnahme) sagt: der Vorgang heisst
  // Vorschau, und bei begrenzter oder unbekannter Abdeckung erscheint keine bestandweite Aussage.
  // Beide Erwartungen widersprechen ihr wörtlich; sie sind deshalb ersetzt, nicht aus dem Code
  // abgeleitet. Gemessen wird jetzt, was die Anforderung zusagt — und dass die alten Sätze fehlen.
  const NEUHEIT = ["Das ist neu", "Du bist die erste Person", "dazu gibt es noch nichts"];

  it("checking: laufende Vorschau mit pulsierenden Punkten (kein toter Balken)", () => {
    const html = render(<LiveReactionZone verdict={{ status: "checking" }} />);
    expect(html).toContain("Vorschau läuft");
    expect(html).toContain("animate-pulse"); // lebendig
  });

  it("empty, Grenze erreicht: nennt Zahl und Grenze, keine Neuheitsaussage", () => {
    const html = render(
      <LiveReactionZone
        verdict={{
          status: "empty",
          coverage: { kind: "candidates", checked: 40, limit: 40, limitReached: true },
        }}
      />,
    );
    expect(html).toContain("Vorschau ohne Treffer");
    expect(html).toContain("verglichen wurden 40 vorausgewählte Einträge");
    expect(html).toContain("Die Auswahlgrenze von 40 war erreicht");
    // B1 (Ben, Runde 1): die erreichte Grenze belegt keine weiteren Einträge — sie ist eine Frage.
    expect(html).toContain("ob es darüber hinaus passende Einträge gibt");
    expect(html).not.toContain("nicht angesehen");
    for (const satz of NEUHEIT) expect(html).not.toContain(satz);
  });

  it("empty, Grenze nicht erreicht: nennt nur die Zahl — und ist trotzdem keine Vollprüfung", () => {
    const html = render(
      <LiveReactionZone
        verdict={{
          status: "empty",
          coverage: { kind: "candidates", checked: 1, limit: 40, limitReached: false },
        }}
      />,
    );
    expect(html).toContain("verglichen wurde 1 vorausgewählter Eintrag");
    expect(html).toContain("kein Abgleich mit dem gesamten Wissensbestand");
    expect(html).not.toContain("Grenze");
    for (const satz of NEUHEIT) expect(html).not.toContain(satz);
  });

  it("empty, Umfang unbekannt: keine Zahl, keine Neuheitsaussage", () => {
    const html = render(
      <LiveReactionZone verdict={{ status: "empty", coverage: { kind: "unknown" } }} />,
    );
    expect(html).toContain("Wie viele Einträge verglichen wurden, ist nicht bekannt");
    expect(html.replace(/<[^>]*>/g, "")).not.toMatch(/\d/); // Text ohne Markup: keine Zahl
    for (const satz of NEUHEIT) expect(html).not.toContain(satz);
  });

  it("similar: Titel + Link zum bestehenden KO + Ergänzen-oder-neu", () => {
    // JOB 3045: Fundort bewusst beidseitig `null` — dieser Fall prüft weiterhin genau den Titel-
    // und Linkvertrag. Dass bei `null` KEINE Fundortzeile entsteht, prüft Fall C in
    // tests/fundort-live-check/fundort-in-der-live-zone.test.tsx.
    const verdict: LiveVerdict = {
      status: "similar",
      match: {
        koId: "k1",
        title: "Not-Aus vor Wartung",
        score: 0.6,
        koStatus: null,
        koCategory: null,
      },
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
      match: { koId: "k9", title: "Alte Regel", score: 0.5, koStatus: null, koCategory: null },
    };
    const html = render(<LiveReactionZone verdict={verdict} />);
    expect(html).toContain("könnte widersprechen");
    expect(html).toContain("Alte Regel");
    expect(html).toContain('href="/wissen/k9"');
  });

  // JOB 3556: Die beiden Fälle „pending" und „unavailable" standen hier bis zu diesem Auftrag. Sie
  // sind mit ihren Zweigen entfernt, weil diese Zone über den PRÜFSTATUS nicht mehr spricht — das
  // tut seit JOB 3427 der Aufrufer (`Blatt.tsx`, `blatt-live-ausfall`), und zwar ohne die unbelegte
  // Zusatzbehauptung „Ähnliches gefunden? Nein". Die Aussage selbst ist nicht verloren, sondern
  // umgezogen: `tests/live-check-verdrahtung/editor-mounted.test.tsx` misst sie am gemounteten
  // Editor, also dort, wo ein Mensch sie liest. Der Typ der Zone lässt beide Lagen nicht mehr zu.

  it("idle: ruhiges 'hört zu' (Zone nie tot)", () => {
    const html = render(<LiveReactionZone verdict={{ status: "idle" }} />);
    expect(html).toContain("Ich höre zu");
  });

  it("i18n: Zustände folgen der Sprache (DE → EN → NL), ohne Neuheitsaussage", async () => {
    const leer: LiveVerdict = {
      status: "empty",
      coverage: { kind: "candidates", checked: 40, limit: 40, limitReached: true },
    };
    await setLanguage("en");
    const en = render(<LiveReactionZone verdict={leer} />);
    expect(en).toContain("Preview without a match: 40 preselected entries were compared.");
    expect(en).not.toContain(i18n.t("intake.live.new").slice(0, 11)); // „This is new"
    await setLanguage("nl");
    const nl = render(<LiveReactionZone verdict={leer} />);
    expect(nl).toContain("Voorbeeld zonder treffer: 40 voorgeselecteerde items zijn vergeleken.");
    expect(nl).not.toContain(i18n.t("intake.live.new").slice(0, 11)); // „Dit is nieu"
  });
});
