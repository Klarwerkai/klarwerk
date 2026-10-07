// ================================================================================================
// N-0020 · UX-02 — DER RÜCKWEG AUS DEM HERKUNFTSGRAPHEN, IM ECHTEN BROWSER.
// ================================================================================================
//
// DER BEFUND (N-0020, 05.09.2026, bestätigt 06.09.2026 01:42): Bibliothek → Bericht suchen → „Mehr"
// → Herkunftskette → „Im Wissensgraph ansehen" → Browser-Zurück. Danach: leeres Suchfeld,
// ungefilterte Liste, ein anderer Bericht. Soll: „Suchbegriff, Objekt und Leseposition beim Hin-
// und Zurückwechsel erhalten."
//
// Die jsdom-Datei daneben (`adresse-traegt-suche-und-eintrag.test.tsx`, R1–R3) misst „Mehr" und
// die Herkunftskette, kann aber nicht ROLLEN — jsdom hat kein Layout. HIER läuft der Weg gegen die
// GEBAUTE Anwendung in Chromium (`tests/design/h4-harness.ts`): echter Link, echtes
// `history.back()`, echter Rollbereich der Lesespalte. Der gelesene Bericht ist absichtlich lang,
// damit es eine Leseposition gibt, die sich verlieren lässt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

/** Die Parameternamen stehen hier unabhängig — eine Umbenennung im Produkt muss auffallen. */
const SUCH_PARAM = "q";
const EINTRAG_PARAM = "eintrag";

/** Ein eigener, langer Bericht. Der Begriff trifft nur ihn. */
const BEGRIFF = "Lesekontext";
const TITEL_LANG = "Lesekontext Langtext Herkunft N-0020";
const ABSATZ = "Die Dichtung wird nach Plan geprüft und der Befund je Schicht notiert.";
const ABSAETZE = Array.from({ length: 90 }, (_, i) => `<p>${i + 1}. ${ABSATZ}</p>`).join("");

/** Wohin gerollt wird — weit genug, dass „wieder oben" und „wo ich war" klar auseinanderfallen. */
const ZIEL_ROLLSTAND = 1200;

/** In der Seite: der Rollbereich der Lesespalte — der erste rollende Vorfahr von `bib-lesen`. */
const ROLL = `() => {
  let el = document.querySelector('[data-testid="bib-lesen"]');
  el = el ? el.parentElement : null;
  while (el) {
    const o = getComputedStyle(el).overflowY;
    if (o === 'auto' || o === 'scroll') return el;
    el = el.parentElement;
  }
  return null;
}`;
const ROLLSTAND = `() => { const r = (${ROLL})(); return r ? r.scrollTop : null; }`;
const LESETITEL = `() => { const el = document.querySelector('[data-testid="bib-titel"]'); return el ? (el.textContent || '').trim() : null; }`;
const SUCHFELD = `() => { const el = document.querySelector('[data-testid="bib-suche"]'); return el ? el.value : null; }`;
const MEHR = `() => { const b = document.querySelector('[data-testid="bib-mehr"]'); return b ? b.getAttribute('aria-expanded') : null; }`;
const HERKUNFT_OFFEN = `() => { const d = document.querySelector('[data-bib-abschnitt="herkunftskette"]'); return !!d && d.open; }`;

let stand: H4Stand | null = null;
let fehler: string | null = null;
let langId = "";

function s(): H4Stand {
  expect(fehler, "die Vorrichtung ist nicht hochgekommen").toBeNull();
  if (stand === null) {
    throw new Error("kein Stand");
  }
  return stand;
}

async function warte(quelle: string, arg: unknown, was: string): Promise<void> {
  try {
    await s().seite.waitForFunction(fn(quelle), arg, { timeout: 30_000 });
  } catch (ursache) {
    const letzterStand = await s().seite.evaluate(
      fn(
        `() => ({ url: location.href, lesetitel: (${LESETITEL})(), mehr: (${MEHR})(), herkunft: (${HERKUNFT_OFFEN})(), roll: (${ROLLSTAND})() })`,
      ),
    );
    throw new Error(`${was}; letzter sichtbarer Zustand: ${JSON.stringify(letzterStand)}`, {
      cause: ursache,
    });
  }
}

beforeAll(async () => {
  try {
    stand = await h4Stand("/bibliothek", "pedi@n0020.test", async (z) => {
      const lang = (await z.services.ko.create({
        title: TITEL_LANG,
        statement: "Ein langer Bericht, an dem die Leseposition gemessen wird.",
        bodyHtml: ABSAETZE,
        type: "best_practice",
        category: "Instandhaltung",
        author: z.autorId,
      } as never)) as { id: string };
      langId = lang.id;
    });
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 4).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await stand?.browser.close();
  await stand?.app.close();
}, 60_000);

describe("N-0020 · Herkunftskette → Wissensgraph → Browser-Zurück im echten Chromium", () => {
  let rollstandVorher = 0;

  it("G1 · Ausgangslage: Bericht gesucht und gewählt, „Mehr“ und Herkunftskette offen, tief gerollt", async () => {
    const seite = s().seite;
    await seite.goto(`${ORIGIN}/bibliothek?${SUCH_PARAM}=${BEGRIFF}&${EINTRAG_PARAM}=${langId}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await warte(`(t) => (${LESETITEL})() === t`, TITEL_LANG, "der lange Bericht steht nicht da");

    await seite.evaluate(fn(`() => document.querySelector('[data-testid="bib-mehr"]').click()`));
    await warte(
      `() => !!document.querySelector('[data-bib-abschnitt="herkunftskette"] summary')`,
      undefined,
      "der Abschnitt Herkunftskette fehlt",
    );
    await seite.evaluate(
      fn(`() => document.querySelector('[data-bib-abschnitt="herkunftskette"] summary').click()`),
    );
    await warte(
      `() => !!document.querySelector('[data-testid="bib-herkunft-graph"]')`,
      undefined,
      "der Graph-Link der Herkunftskette fehlt",
    );

    const spielraum = await seite.evaluate<number | null>(
      fn(`() => { const r = (${ROLL})(); return r ? r.scrollHeight - r.clientHeight : null; }`),
    );
    expect(spielraum !== null, "die Lesespalte rollt nicht").toBe(true);
    expect(spielraum ?? 0, "zu wenig Text für eine Leseposition").toBeGreaterThan(
      ZIEL_ROLLSTAND + 200,
    );
    await seite.evaluate(
      fn(`(ziel) => { const r = (${ROLL})(); r.scrollTop = ziel; }`),
      ZIEL_ROLLSTAND,
    );
    rollstandVorher = (await seite.evaluate<number | null>(fn(ROLLSTAND))) ?? 0;
    expect(rollstandVorher).toBeGreaterThan(ZIEL_ROLLSTAND - 5);
  }, 120_000);

  it("G2 · der Link führt in den Graphen, Browser-Zurück zurück an DIESELBE Stelle", async () => {
    const seite = s().seite;
    await seite.evaluate(
      fn(`() => document.querySelector('[data-testid="bib-herkunft-graph"]').click()`),
    );
    // Ob der Graph selbst etwas zeigt (Stufe 2), ist hier ohne Belang — es zählt der Ortswechsel.
    await warte(
      `() => location.pathname !== '/bibliothek'`,
      undefined,
      "der Link führt nirgends hin",
    );

    await seite.evaluate(fn("() => history.back()"));
    await warte(
      `(t) => location.pathname === '/bibliothek' && (${LESETITEL})() === t`,
      TITEL_LANG,
      "Browser-Zurück führt nicht zum Bericht",
    );

    const suche = new URLSearchParams(await seite.evaluate<string>(fn("() => location.search")));
    expect(suche.get(SUCH_PARAM)).toBe(BEGRIFF);
    expect(suche.get(EINTRAG_PARAM)).toBe(langId);
    expect(await seite.evaluate<string | null>(fn(SUCHFELD)), "das Suchfeld ist leer").toBe(
      BEGRIFF,
    );
    expect(await seite.evaluate<string | null>(fn(MEHR)), "„Mehr“ ist wieder zu").toBe("true");
    expect(await seite.evaluate<boolean>(fn(HERKUNFT_OFFEN)), "Herkunft wieder zu").toBe(true);
    await warte(
      `(soll) => Math.abs(((${ROLLSTAND})() ?? -9999) - soll) <= 2`,
      rollstandVorher,
      `die Leseposition ${rollstandVorher} kam nicht zurück`,
    );
  }, 120_000);

  it("G3 · GEGENPROBE: ein neues Öffnen desselben Berichts beginnt oben, „Mehr“ zu", async () => {
    // Der Merker ist beim Zurückkehren verbraucht worden. Wer den Bericht danach neu aufruft, liest
    // von vorn — sonst wäre der Rollstand eine stille Dauerbehauptung statt eines Rückwegs.
    const seite = s().seite;
    await seite.goto(`${ORIGIN}/bibliothek?${SUCH_PARAM}=${BEGRIFF}&${EINTRAG_PARAM}=${langId}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await warte(`(t) => (${LESETITEL})() === t`, TITEL_LANG, "der lange Bericht steht nicht da");
    expect(await seite.evaluate<string | null>(fn(MEHR))).toBe("false");
    expect(await seite.evaluate<number | null>(fn(ROLLSTAND))).toBe(0);
  }, 120_000);

  it("G4 · Chromium hat auf keinem dieser Wege einen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
