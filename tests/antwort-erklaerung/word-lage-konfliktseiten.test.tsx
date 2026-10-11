// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DAS WORD-FENSTER LIEST LAGE UND KONFLIKTSEITEN.
// ================================================================================================
//
// Bens Befunde (nacharbeit-2): R-0321 — das Fenster zeigte einen Konflikthinweis ohne beide Seiten;
// R-0335 — ein 200er-Körper ohne vollständige Antwortform fiel pauschal in `kind: "gap"`.
//
// Gemessen wird zweierlei, beides am WIRKLICH ausgelieferten Fenster:
//   1. `performAsk` aus dem Helferblock von `taskpane.js` (ausgeführt) und sein Zwilling
//      `apps/web/src/lib/wordAddin.ts` liefern auf denselben Körpern dasselbe — und das Richtige.
//   2. Das vollständige Fenster (über `tests/app/k1-panel-lauf.tsx`) zeichnet die Lage und BEIDE
//      Konfliktseiten unter „Mehr", nennt eine nicht einsehbare Seite, wählt keine Seite und zeigt
//      eine unbekannte Lage als technischen Fehler, nicht als Wissenslücke.
import { afterEach, describe, expect, it } from "vitest";
import { type AskFetchFn, performAsk } from "../../apps/web/src/lib/wordAddin";
import { HTML, el, panelAbraeumen, panelStarten, ruhe, sichtbar } from "../app/k1-panel-lauf";

const ANTWORT = "Ventil V4 wird jährlich geprüft.";

const KONFLIKT_KOERPER = {
  result: {
    answered: true,
    answer: ANTWORT,
    sources: ["ka"],
    citedSources: ["ka"],
    trust: 80,
    steps: [],
    evidence: { grade: "unverified", sourcesConflicted: true, conflictsUnproven: false },
    belastbarkeit: {
      lage: "belegt_mit_konflikt",
      konflikte: [
        {
          konfliktId: "c1",
          beschreibung: "jährlich gegen halbjährlich",
          seiten: [
            {
              einsehbar: true,
              koId: "ka",
              titel: "Design Guide",
              aussage: ANTWORT,
              version: 1,
              vertrauenswert: 80,
              validiert: true,
              traegtAntwort: true,
            },
            {
              einsehbar: true,
              koId: "kz",
              titel: "Halbjahresplan",
              aussage: "Ventil V4 wird halbjährlich geprüft.",
              version: 2,
              vertrauenswert: 40,
              validiert: false,
              traegtAntwort: false,
            },
          ],
        },
        {
          konfliktId: "c2",
          beschreibung: null,
          seiten: [
            { einsehbar: false, traegtAntwort: false },
            {
              einsehbar: true,
              koId: "ka",
              titel: "Design Guide",
              aussage: ANTWORT,
              version: 1,
              vertrauenswert: 80,
              validiert: true,
              traegtAntwort: true,
            },
          ],
        },
      ],
    },
  },
  gap: null,
  receipt: "r",
};

function mitLage(lage: string, answered: boolean): Record<string, unknown> {
  return {
    result: {
      answered,
      answer: answered ? ANTWORT : null,
      sources: answered ? ["ka"] : [],
      citedSources: answered ? ["ka"] : [],
      trust: 80,
      steps: [],
      belastbarkeit: { lage, konflikte: [] },
    },
    gap: null,
    receipt: "r",
  };
}

function fakeFetch(body: unknown): AskFetchFn {
  return async () =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    }) as unknown as Awaited<ReturnType<AskFetchFn>>;
}

/** `performAsk` aus dem AUSGELIEFERTEN Helferblock — ausgeführt, nicht gelesen. */
function spiegelPerformAsk(): typeof performAsk {
  const start = HTML.indexOf("// KW-WORDADDIN-HELPERS-START");
  const ende = HTML.indexOf("// KW-WORDADDIN-HELPERS-END");
  expect(start).toBeGreaterThan(0);
  expect(ende).toBeGreaterThan(start);
  return new Function(`${HTML.slice(start, ende)}; return performAsk;`)() as typeof performAsk;
}

/** Ein Wörterbuchwert (DE, erster Treffer) — die Lage-Schlüssel stehen je Sprache in EINER Zeile. */
function wort(key: string): string {
  const treffer = new RegExp(`\\b${key}: "([^"]+)"`).exec(HTML);
  expect(treffer, `${key} fehlt im Woerterbuch`).not.toBeNull();
  return treffer?.[1] ?? "";
}

describe("R-0321/R-0335 · performAsk liest Lage und Konfliktseiten — Fenster und Zwilling gleich", () => {
  const faelle: [string, unknown, Record<string, unknown>][] = [
    [
      "Konflikt mit beiden Seiten",
      KONFLIKT_KOERPER,
      {
        kind: "answered",
        lage: "belegt_mit_konflikt",
        konflikte: [
          {
            beschreibung: "jährlich gegen halbjährlich",
            seiten: [
              { einsehbar: true, titel: "Design Guide", aussage: ANTWORT, traegtAntwort: true },
              {
                einsehbar: true,
                titel: "Halbjahresplan",
                aussage: "Ventil V4 wird halbjährlich geprüft.",
                traegtAntwort: false,
              },
            ],
          },
          {
            beschreibung: null,
            seiten: [
              { einsehbar: false, traegtAntwort: false },
              { einsehbar: true, titel: "Design Guide", aussage: ANTWORT, traegtAntwort: true },
            ],
          },
        ],
      },
    ],
    ["belegte Wissenslücke", mitLage("wissensluecke", false), { kind: "gap" }],
    ["Zuständiger fehlt", mitLage("belegt_zustaendig_fehlt", true), { kind: "answered" }],
    ["geschwärzt", mitLage("geschwaerzt", false), { kind: "redacted" }],
    ["unbekannte Lage", mitLage("irgendwas_neues", true), { kind: "error", detail: "lage" }],
    ["gestörte Lage", mitLage("technischer_fehler", true), { kind: "error", detail: "lage" }],
    ["Lücke trotz Antwort", mitLage("wissensluecke", true), { kind: "error", detail: "lage" }],
    ["Antwortlage ohne Antwort", mitLage("belegt", false), { kind: "error", detail: "lage" }],
    ["Körper ohne Ergebnis", {}, { kind: "error", detail: "lage" }],
  ];

  for (const [name, koerper, erwartet] of faelle) {
    it(name, async () => {
      const ausFenster = await spiegelPerformAsk()("Frage", "de", fakeFetch(koerper), 5000);
      const ausZwilling = await performAsk("Frage", "de", fakeFetch(koerper), 5000);
      expect(ausFenster, "Fenster und Zwilling laufen auseinander").toEqual(ausZwilling);
      expect(ausZwilling).toMatchObject(erwartet);
    });
  }

  it("Kalibrierung: ein Körper OHNE Lage (älterer Server) verhält sich wie bisher", async () => {
    const alt = {
      result: { answered: true, answer: ANTWORT, sources: ["ka"], trust: 10, steps: [] },
      gap: null,
    };
    const ergebnis = await performAsk("Frage", "de", fakeFetch(alt), 5000);
    expect(ergebnis).toMatchObject({ kind: "answered", lage: undefined, konflikte: undefined });
    const luecke = await performAsk(
      "Frage",
      "de",
      fakeFetch({ result: { answered: true, answer: "  ", sources: [] } }),
      5000,
    );
    expect(luecke).toEqual({ kind: "gap" });
  });
});

function starten(koerper: unknown) {
  return panelStarten((url, methode) => {
    if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (url === "/api/ask") return { status: 200, body: koerper };
    if (url.startsWith("/api/kos/")) {
      const id = decodeURIComponent(url.slice("/api/kos/".length));
      return { status: 200, body: { id, title: id, status: "validiert", trust: 80 } };
    }
    if (methode === "HEAD") return { status: 200 };
    return { status: 401 };
  });
}

async function fragen(): Promise<void> {
  el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprüft?";
  el("ask-btn").click();
  await ruhe();
}

describe("R-0321/R-0335 · das ausgelieferte Fenster zeichnet Lage und beide Seiten", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("Widerspruch: Lage-Zeile und BEIDE Seiten mit Beleg, die nicht einsehbare benannt, kein Gewinner", async () => {
    starten(KONFLIKT_KOERPER);
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-answer-block"))).toBe(true);
    expect(el("ask-lage-line").textContent).toBe(wort("askLageKonflikt"));
    expect(el("ask-lage-line").className).toContain("warn");
    const zeilen = [...el("ask-konflikt-seiten").querySelectorAll("li")].map(
      (li) => li.textContent ?? "",
    );
    expect(el("ask-konflikt-seiten").className).not.toContain("hidden");
    const traegt = wort("askKonfliktTragend");
    expect(zeilen).toEqual([
      `Seite 1 · ${traegt}: Design Guide — ${ANTWORT}`,
      "Seite 2: Halbjahresplan — Ventil V4 wird halbjährlich geprüft.",
      `Seite 1: ${wort("askKonfliktNichtEinsehbar")}`,
      `Seite 2 · ${traegt}: Design Guide — ${ANTWORT}`,
      wort("askKonfliktKeinGewinner"),
    ]);
  });

  it("die nächste Frage räumt Lage und Seiten der vorigen ab", async () => {
    starten(KONFLIKT_KOERPER);
    await ruhe();
    await fragen();
    el("kw-zurueck").click();
    await ruhe();
    expect(el("ask-lage-line").textContent).toBe("");
    expect(el("ask-konflikt-seiten").children).toHaveLength(0);
    expect(el("ask-konflikt-seiten").className).toContain("hidden");
  });

  it("unbekannte Lage: technischer Fehler im Status — die Lückenkarte bleibt zu", async () => {
    starten(mitLage("irgendwas_neues", true));
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-gap-block"))).toBe(false);
    expect(sichtbar(el("ask-answer-block"))).toBe(false);
    expect(el("ask-status").textContent).toBe(wort("askLageUnbekannt"));
  });

  it("geschwärzt: ein eigener Satz, weder Antwort noch Wissenslücke", async () => {
    starten(mitLage("geschwaerzt", false));
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-gap-block"))).toBe(false);
    expect(sichtbar(el("ask-answer-block"))).toBe(false);
    expect(el("ask-status").textContent).toBe(wort("askLageGesperrt"));
  });

  it("Zuständiger fehlt: die Lage benennt die Verantwortungslücke, die Antwort bleibt", async () => {
    starten(mitLage("belegt_zustaendig_fehlt", true));
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-answer-block"))).toBe(true);
    expect(el("ask-lage-line").textContent).toBe(wort("askLageVerantwortungFehlt"));
  });
});
