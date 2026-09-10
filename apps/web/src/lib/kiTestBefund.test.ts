// ================================================================================================
// JOB 3420 · UX-10b — DIE TABELLE: NEUN LAGEN, NEUN UNTERSCHEIDBARE AUSKÜNFTE.
// ================================================================================================
//
// Der Tabellentest hält drei Dinge fest, und das dritte ist das tragende:
//
//   1. WELCHE Auskunft aus welcher Lage entsteht (die neun Fälle des Auftrags, a–i).
//   2. Dass die Ableitung die ROHMELDUNG NICHT LIEST: gleiche Felder, verschiedenes `detail` →
//      identischer Befund. Damit kann sich keine Textheuristik zurückschleichen.
//   3. Dass die neun Auskünfte WIRKLICH verschieden sind (Codex-Lehre JOB 3379 R1, 09.09.): der
//      deutsche Satz eines Falls darf in keinem der acht anderen auftauchen. Ohne diese Zusage
//      wäre „fünf unterschiedliche Auskünfte" behauptet und nicht gemessen — neun Fälle, die alle
//      denselben Satz zeigen, bestünden jede Einzelprüfung.
import { describe, expect, it } from "vitest";
import type { ReasonerProbeResult } from "../api/types";
import i18n from "../i18n";
import { type KiTestBefund, kiTestBefund } from "./kiTestBefund";

const AT = "2026-09-09T10:00:00.000Z";

function probe(over: Partial<ReasonerProbeResult>): ReasonerProbeResult {
  return {
    ok: false,
    provider: "cloud:openai:gpt-6-astra",
    mode: "model",
    detail: "Modell-API antwortete mit irgendetwas",
    at: AT,
    ...over,
  };
}

interface Lage {
  readonly name: string;
  readonly befund: KiTestBefund;
}

const A = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "http", status: 401, anbieter: "openai" }),
  anfrageFehler: false,
  art: "cloud",
});
const B = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "http", status: 429, anbieter: "openai" }),
  anfrageFehler: false,
  art: "cloud",
});
const C = kiTestBefund({
  ergebnis: probe({
    fehlerklasse: "http",
    status: 400,
    anbieter: "openai",
    anbieterGrund: "unknown parameter: max_tokens",
  }),
  anfrageFehler: false,
  art: "cloud",
});
const D = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "http", status: 503, anbieter: "anthropic" }),
  anfrageFehler: false,
  art: "cloud",
});
const E = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "timeout", anbieter: "anthropic" }),
  anfrageFehler: false,
  art: "cloud",
});
const F = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "parse", anbieter: "anthropic" }),
  anfrageFehler: false,
  art: "cloud",
});
const G = kiTestBefund({
  ergebnis: probe({ anbieter: "anthropic" }),
  anfrageFehler: false,
  art: "cloud",
});
const H = kiTestBefund({ anfrageFehler: true, art: "cloud" });
const I = kiTestBefund({
  ergebnis: probe({ fehlerklasse: "network", provider: "local:Qwen3-32B-AWQ" }),
  anfrageFehler: false,
  art: "local",
});

const NEUN: readonly Lage[] = [
  { name: "a · 401 Cloud", befund: A },
  { name: "b · 429", befund: B },
  { name: "c · 400 mit Begründung", befund: C },
  { name: "d · 5xx", befund: D },
  { name: "e · Zeitlimit", befund: E },
  { name: "f · unbrauchbare Antwort", befund: F },
  { name: "g · nicht eingeordnet", befund: G },
  { name: "h · Anfrage gescheitert", befund: H },
  { name: "i · lokaler LLM nicht erreichbar", befund: I },
];

/** Die deutschen Sätze eines Befunds — genau das, was ein Mensch liest. */
function saetze(befund: KiTestBefund): string[] {
  const raus = [i18n.t(befund.ursacheKey, befund.ursacheWerte)];
  if (befund.ratKey !== null) {
    raus.push(i18n.t(befund.ratKey));
  }
  return raus.filter((s) => s.trim().length > 0);
}

describe("JOB 3420 · kiTestBefund — die neun Lagen", () => {
  it("a · 401/403: Zugangsdaten, und der Schlüsseltipp nennt das Konto des GEPRÜFTEN Anbieters", () => {
    expect(A.fall).toBe("zugang");
    expect(A.ursacheKey).toBe("adm.ai.befund.zugang");
    expect(A.ratKey).toBe("adm.ai.rat.zugangKonto.openai");
    // Derselbe Fall bei Anthropic nennt das andere Konto — EINE Zuordnung, keine feste Zeile.
    const anthropic = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "http", status: 403, anbieter: "anthropic" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(anthropic.fall).toBe("zugang");
    expect(anthropic.ratKey).toBe("adm.ai.rat.zugangKonto.anthropic");
    // Und die beiden Sätze nennen wirklich das jeweils EIGENE Konto — sonst wäre die Zuordnung
    // nur behauptet. Der Name steht im i18n-Text, nicht als Literal in `kiTestBefund.ts`
    // (Hausregel `tests/security/egress-chokepoint.test.ts:31-35`).
    expect(i18n.t(A.ratKey ?? "")).toContain("OPENAI_API_KEY");
    expect(i18n.t(A.ratKey ?? "")).not.toContain("ANTHROPIC_API_KEY");
    expect(i18n.t(anthropic.ratKey ?? "")).toContain("ANTHROPIC_API_KEY");
    expect(i18n.t(anthropic.ratKey ?? "")).not.toContain("OPENAI_API_KEY");
  });

  it("a2 · ohne `anbieter` steht KEIN Kontoname da — geraten wird nicht", () => {
    const ohne = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "http", status: 401 }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(ohne.fall).toBe("zugang");
    expect(ohne.ratKey).toBe("adm.ai.rat.zugang");
    expect(i18n.t(ohne.ratKey ?? "")).not.toContain("API_KEY");
  });

  it("b · 429: Kontingent, wiederholbar, kein Schlüsseltipp", () => {
    expect(B.fall).toBe("kontingent");
    expect(B.ratKey).toBe("adm.ai.rat.kontingent");
    expect(B.wiederholbar).toBe(true);
    expect(i18n.t(B.ratKey ?? "")).not.toContain("API_KEY");
  });

  it("c · 400: die Begründung des Anbieters wörtlich, KEIN Schlüsseltipp, kein Wiederholen", () => {
    expect(C.fall).toBe("abgelehnt");
    expect(C.anbieterGrund).toBe("unknown parameter: max_tokens");
    expect(C.ratKey).toBe("adm.ai.rat.abgelehnt");
    // Ein identischer zweiter Versuch ergäbe dasselbe 400 — der Knopf verspräche etwas Falsches.
    expect(C.wiederholbar).toBe(false);
  });

  it("c2 · 400 OHNE Begründung: `anbieterGrund` bleibt null — es wird keine erfunden", () => {
    const ohne = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "http", status: 400, anbieter: "openai" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(ohne.fall).toBe("abgelehnt");
    expect(ohne.anbieterGrund).toBeNull();
  });

  it("d · 5xx UND `network` führen auf denselben Fall: Anbieter nicht erreichbar", () => {
    expect(D.fall).toBe("nichtErreichbar");
    const netz = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "network", anbieter: "anthropic" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(netz.fall).toBe("nichtErreichbar");
    expect(netz.ursacheKey).toBe(D.ursacheKey);
    expect(D.wiederholbar).toBe(true);
  });

  it("e · Zeitlimit und f · unbrauchbare Antwort sind eigene Fälle", () => {
    expect(E.fall).toBe("zeitlimit");
    expect(F.fall).toBe("unbrauchbar");
    expect(E.wiederholbar).toBe(true);
    expect(F.wiederholbar).toBe(true);
  });

  it("g · ohne Klasse: unbestimmt, und KEIN Ratschlag, der eine Ursache behauptet", () => {
    expect(G.fall).toBe("unbestimmt");
    expect(G.ursacheKey).toBe("adm.ai.befund.unbestimmt");
    expect(G.ratKey).toBeNull();
    // `fehlerklasse: "unknown"` ist derselbe ehrliche Rückfall wie ein fehlendes Feld.
    const unbekannt = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "unknown", anbieter: "anthropic" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(unbekannt).toEqual(G);
  });

  it("g2 · ein unbenannter HTTP-Status wird NICHT zu nichtErreichbar umgedeutet", () => {
    const vierhundertvier = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "http", status: 404, anbieter: "openai" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(vierhundertvier.fall).toBe("unbestimmt");
    expect(vierhundertvier.ratKey).toBeNull();
  });

  it("h · gescheiterte Anfrage: eigener Fall, unabhängig von der Art", () => {
    expect(H.fall).toBe("anfrage");
    expect(H.ursacheKey).toBe("adm.ai.befund.anfrage");
    expect(H.wiederholbar).toBe(true);
    for (const art of ["local", "selftest"] as const) {
      expect(kiTestBefund({ anfrageFehler: true, art })).toEqual(H);
    }
  });

  it("i · lokaler LLM: in KEINEM Fall ein Cloud-Schlüsseltipp", () => {
    expect(I.fall).toBe("nichtErreichbar");
    expect(I.ursacheKey).toBe("adm.ai.befund.lokal.nichtErreichbar");
    // Auch der 401-Fall des lokalen Servers nennt kein Cloud-Konto — selbst wenn ein `anbieter`
    // im Ergebnis stünde.
    const lokal401 = kiTestBefund({
      ergebnis: probe({ fehlerklasse: "http", status: 401, anbieter: "openai" }),
      anfrageFehler: false,
      art: "local",
    });
    expect(lokal401.ratKey).toBe("adm.ai.rat.lokal.zugang");
    expect(i18n.t(lokal401.ratKey ?? "")).not.toContain("API_KEY");
  });
});

describe("JOB 3420 · kiTestBefund — die Ableitung liest die Rohmeldung nicht", () => {
  it("gleiche Felder, VERSCHIEDENES `detail` → identischer Befund", () => {
    const felder = { fehlerklasse: "http", status: 401, anbieter: "openai" } as const;
    const einer = kiTestBefund({
      ergebnis: probe({ ...felder, detail: "Modell-API antwortete mit 401" }),
      anfrageFehler: false,
      art: "cloud",
    });
    const anderer = kiTestBefund({
      ergebnis: probe({ ...felder, detail: "timeout · network · 429 · unknown model · leer" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(anderer).toEqual(einer);
  });

  it("eine Rohmeldung voller Reizwörter bleibt unbestimmt", () => {
    // Jedes Wort, an dem eine Textheuristik ansetzen würde — und keines davon ist eine Messung.
    const reizwort = "Zeitlimit ECONNREFUSED antwortete mit 429 JSON leer ANTHROPIC_API_KEY";
    const befund = kiTestBefund({
      ergebnis: probe({ detail: reizwort, anbieter: "anthropic" }),
      anfrageFehler: false,
      art: "cloud",
    });
    expect(befund).toEqual(G);
  });
});

describe("JOB 3420 · kiTestBefund — die neun Auskünfte sind wirklich verschieden", () => {
  it("kein deutscher Satz eines Falls steht in einem der acht anderen", async () => {
    await i18n.changeLanguage("de");
    const texte = NEUN.map((l) => ({ name: l.name, saetze: saetze(l.befund) }));
    for (const eigen of texte) {
      expect(eigen.saetze.length, `${eigen.name} hat keinen Satz`).toBeGreaterThan(0);
      for (const fremd of texte) {
        if (fremd.name === eigen.name) {
          continue;
        }
        for (const satz of eigen.saetze) {
          expect(
            fremd.saetze.join(" ⏐ "),
            `„${eigen.name}" und „${fremd.name}" zeigen denselben Satz`,
          ).not.toContain(satz);
        }
      }
    }
  });

  it("jeder der neun Sätze existiert wirklich — kein fehlender i18n-Schlüssel", async () => {
    await i18n.changeLanguage("de");
    for (const lage of NEUN) {
      for (const satz of saetze(lage.befund)) {
        // i18next gibt bei fehlendem Schlüssel den Schlüssel selbst zurück.
        expect(satz, `${lage.name}: i18n-Schlüssel fehlt`).not.toMatch(/^adm\.ai\./);
      }
    }
  });
});
