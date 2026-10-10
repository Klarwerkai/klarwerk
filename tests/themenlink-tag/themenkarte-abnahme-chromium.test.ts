// ================================================================================================
// UX-02b · DIE ORIGINALABNAHME IM ECHTEN BROWSER — THEMENKARTE → BIBLIOTHEK, BESTEHENDE SITZUNG.
// ================================================================================================
//
// DIE ABNAHME, wörtlich aus der Prioritätszeile UX-02b (`priority:UX-02b:659cd265321b`):
//   „bestehende Sitzung → zwei neue gleiche Tags + fachfremde Kontrolle → Themenwahl →
//    Bibliothekslink → Neuladen: Tag und 2 Treffer erhalten, DE/EN, Tastatur"
//
// Die jsdom-Datei daneben (`themenkarte-behaelt-das-schlagwort.test.tsx`, F1–F10, L1–L4) misst
// den Mechanismus an einem gesteuerten Zwischenspeicher. HIER läuft derselbe Weg gegen die GEBAUTE
// Anwendung in Chromium (`tests/design/h4-harness.ts`, echte Dienste dahinter):
//
//   BESTEHENDE SITZUNG — die Bibliothek ist schon offen, ihr Bestand (`GET /api/kos`) liegt im
//     Zwischenspeicher. ERST DANACH entstehen die Einträge, am Server, ohne die Oberfläche: genau
//     die Lage des Befunds (32 statt 2), in der der Client von ihnen nichts wissen kann.
//   DER STAND IST ÄLTER ALS DIE FRISCHEFRIST — der Befund trat beim Wiederkommen auf, mit einem
//     Stand vom letzten Besuch. Die Frist des Produkts (`ZAEHLER_FRISCHE_MS`, `lib/loadingState.ts`,
//     30 s) steht hier als eigener Sollwert; gewartet wird darüber hinaus. Innerhalb der Frist gilt
//     ein Stand als frisch und wird nicht nachgefragt — das ist F3, kein Teil dieses Befunds.
//   NAVIGATION INNERHALB DER ANWENDUNG — in das Wissensnetz über den Verlauf der App (kein Neuladen,
//     sonst wäre der Zwischenspeicher weg und es wäre der „direkte Link", der schon korrekt war).
//   TASTATUR — Themenknoten und Bibliothekslink werden fokussiert und mit Enter ausgelöst.
//   NEULADEN — danach ein echtes `reload()` derselben Adresse.
//   DE UND EN — derselbe Weg einmal je Sprache, je mit eigenem Schlagwort.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type H4Stand,
  type H4Vorbereitung,
  fn,
  h4Stand,
  spracheSetzen,
} from "../design/h4-harness";

/** (Sollwerte) unabhängig von der Produktquelle hingeschrieben. */
const TAG_PARAM = "tag";
const FRISCHE_MS = 30_000;
const KONTROLL_TAG = "Kontrolle3115";

const ZEILEN = `() => [...document.querySelectorAll('[data-testid="bib-zeile"] [data-bib-text="zeile-titel"]')].map((e) => (e.textContent || '').trim()).sort()`;
const FILTER_MENUE = `() => { const b = document.querySelector('[data-testid="bib-menue-filter"]'); return b ? (b.textContent || '').trim() : null; }`;
const LAGE = `() => ({ url: location.href, lang: document.documentElement.lang, zeilen: (${ZEILEN})(), filter: (${FILTER_MENUE})(), fokus: document.activeElement ? document.activeElement.getAttribute('data-testid') : null })`;

let stand: H4Stand | null = null;
let fehler: string | null = null;
let dienste: H4Vorbereitung["services"] | null = null;
let autorId = "";

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
    const letzterStand = await s().seite.evaluate(fn(LAGE));
    throw new Error(`${was}; letzter sichtbarer Zustand: ${JSON.stringify(letzterStand)}`, {
      cause: ursache,
    });
  }
}

/** Zwei Einträge mit dem neuen Schlagwort und eine fachfremde Kontrolle — am Server, jetzt. */
async function legeAn(tag: string): Promise<string[]> {
  if (dienste === null) {
    throw new Error("keine Dienste");
  }
  const titel = [`${tag} Ventil V7 prüfen`, `${tag} Ventil V8 prüfen`];
  for (const t of titel) {
    await dienste.ko.create({
      title: t,
      statement: "Das Ventil wird je Schicht geprüft.",
      type: "best_practice",
      category: "Instandhaltung",
      tags: [tag],
      author: autorId,
    } as never);
  }
  await dienste.ko.create({
    title: `${tag} Kontrolle Kantine Speiseplan`,
    statement: "Fachfremd — darf unter dem Schlagwort nicht erscheinen.",
    type: "best_practice",
    category: "Verwaltung",
    tags: [KONTROLL_TAG],
    author: autorId,
  } as never);
  return titel.sort();
}

/** Der ganze Abnahmeweg für eine Sprache. */
async function abnahme(sprache: "de" | "en", tag: string): Promise<void> {
  const seite = s().seite;
  // Bestehende Sitzung: die Bibliothek ist offen, ihr Bestand ist geholt.
  await spracheSetzen(s(), sprache);
  await warte(
    `() => document.querySelectorAll('[data-testid="bib-zeile"]').length > 0`,
    undefined,
    "die Bibliothek ist leer",
  );
  expect(await seite.evaluate<string>(fn("() => document.documentElement.lang"))).toBe(sprache);

  const erwartet = await legeAn(tag);
  // Der Stand im Zwischenspeicher wird älter als die Frist — die Lage beim Wiederkommen.
  await seite.waitForTimeout(FRISCHE_MS + 2_000);

  // Innerhalb der Anwendung ins Wissensnetz: Verlaufseintrag + `popstate`, wie der Router es liest.
  await seite.evaluate(
    fn(
      `() => { history.pushState({}, '', '/wissensnetz'); dispatchEvent(new PopStateEvent('popstate')); }`,
    ),
  );
  const knoten = `[data-testid="themenknoten"][data-thema="${tag}"]`;
  await warte("(sel) => !!document.querySelector(sel)", knoten, `Themenknoten ${tag} fehlt`);

  // Tastatur: Knoten fokussieren, Enter wählt ihn; dann den Bibliothekslink fokussieren, Enter.
  await seite.evaluate(fn("(sel) => document.querySelector(sel).focus()"), knoten);
  await seite.keyboard.press("Enter");
  await warte(
    `(t) => (document.querySelector('[data-testid="leiste-titel"]') || {}).textContent === t`,
    tag,
    "die Themenwahl per Enter greift nicht",
  );
  await seite.evaluate(fn(`() => document.querySelector('[data-testid="leiste-alle"]').focus()`));
  await seite.keyboard.press("Enter");

  const bibliothekMitTag = `([tag, zeilen]) => location.pathname === '/bibliothek'
    && new URLSearchParams(location.search).get('${TAG_PARAM}') === tag
    && JSON.stringify((${ZEILEN})()) === JSON.stringify(zeilen)`;
  await warte(bibliothekMitTag, [tag, erwartet], "Themenlink: nicht genau die 2");
  expect(await seite.evaluate<string[]>(fn(ZEILEN))).toEqual(erwartet);
  expect(await seite.evaluate<string | null>(fn(FILTER_MENUE)), "kein Filter gesetzt").toMatch(
    /·\s*1$/,
  );

  // Neuladen: dieselbe Adresse, ein neues Dokument.
  await seite.reload({ waitUntil: "load", timeout: 60_000 });
  await warte(bibliothekMitTag, [tag, erwartet], "Neuladen: nicht genau die 2");
  expect(await seite.evaluate<string[]>(fn(ZEILEN))).toEqual(erwartet);
  expect(await seite.evaluate<string>(fn("() => document.documentElement.lang"))).toBe(sprache);
}

beforeAll(async () => {
  try {
    stand = await h4Stand("/bibliothek", "pedi@ux02b.test", async (z) => {
      dienste = z.services;
      autorId = z.autorId;
    });
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 4).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await stand?.browser.close();
  await stand?.app.close();
}, 60_000);

describe("UX-02b · Originalabnahme: Themenkarte → Bibliothek in bestehender Sitzung", () => {
  it("A-DE · zwei neue Einträge, Themenwahl per Tastatur, Link, Neuladen: Tag und genau 2 Treffer", async () => {
    await abnahme("de", "Abnahme3115de");
  }, 180_000);

  it("A-EN · derselbe Weg auf Englisch", async () => {
    await abnahme("en", "Abnahme3115en");
  }, 180_000);

  it("A-Z · Chromium hat auf keinem dieser Wege einen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
