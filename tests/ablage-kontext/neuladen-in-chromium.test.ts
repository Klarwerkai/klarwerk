// ================================================================================================
// JOB 3104 · UX-02 — DAS ECHTE NEULADEN, AN DER ECHTEN GEBAUTEN SEITE.
// ================================================================================================
//
// Die jsdom-Datei daneben (`adresse-traegt-suche-und-eintrag.test.tsx`) stellt ein Neuladen als
// `unmount()` + `mount()` nach. Das misst die Wiederherstellung AUS DER ADRESSE — aber NICHT den
// Browser: kein neues Dokument, kein frischer JS-Zustand, kein echtes `F5`. Wäre nur jene Datei
// grün, wäre der Nachbau repariert und der Befund N-0006 nicht (Auftrag §8.1).
//
// HIER wird deshalb wirklich neu geladen: `seite.goto(<dieselbe Adresse>, { waitUntil: "load" })`
// gegen die GEBAUTE Anwendung (`apps/web/dist`) in Chromium, mit der ECHTEN Fastify-App dahinter
// (`tests/design/h4-harness.ts` — echte Dienste, echter Bestand, echte Anmeldung). Ein neues
// Dokument, ein neuer JS-Kontext; was danach dasteht, kann nur aus der Adresse gekommen sein.
//
// DER BEFUND, den diese Datei nachstellt (`register/planung/UIUX-AUFTRAEGE-1.md` §UX-02, N-0006,
// 05.09.2026 19:08–19:09 CEST, v1.0.0-beta.1.101): „vor Reload eigener Bericht gewählt; danach
// Suche leer und erster anderer Bericht … angezeigt."
//
// Der Bestand der Vorrichtung besteht aus genau zwei Einträgen, und das ist hier der springende
// Punkt: `TITEL_FREI` steht als freigegebener Eintrag OBEN in der Liste, `TITEL_OFFEN` darunter.
// Gewählt wird der ZWEITE — sonst träfe der stille Ersatz durch den ersten Eintrag zufällig das
// Richtige und der Test bewiese nichts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, TITEL_FREI, TITEL_OFFEN, fn, h4Stand } from "../design/h4-harness";

/** Die Parameternamen stehen hier unabhängig — eine Umbenennung im Produkt muss auffallen. */
const SUCH_PARAM = "q";
const EINTRAG_PARAM = "eintrag";

/** Ein Begriff aus dem Titel des ZWEITEN Eintrags; der erste trägt ihn nirgends. */
const BEGRIFF = "Reinigung";

/** Die zwei VORHANDENEN Sätze der Lesefläche, unabhängig hingeschrieben (`i18n.ts:3265`/`:3260`). */
const LESEN_FEHLER = "Der Eintrag ließ sich nicht laden.";
const ERNEUT = "Erneut versuchen";

/** In der Seite: die Titel der Listenzeilen links. */
const ZEILEN = `() => [...document.querySelectorAll('[data-testid="bib-zeile"] [data-bib-text="zeile-titel"]')].map((e) => (e.textContent || '').trim())`;
/** In der Seite: der Titel auf der Lesefläche rechts. */
const LESETITEL = `() => { const el = document.querySelector('[data-testid="bib-titel"]'); return el ? (el.textContent || '').trim() : null; }`;
/** In der Seite: was im Suchfeld steht. */
const SUCHFELD = `() => { const el = document.querySelector('[data-testid="bib-suche"]'); return el ? el.value : null; }`;
/**
 * In der Seite: in das Suchfeld tippen. Der native value-Setter umgeht Reacts Value-Tracker —
 * dieselbe Bauform wie `tests/library/support/bib-flaeche.tsx:177`, sonst schluckt React die
 * Änderung und der Test misst den alten Zustand.
 */
const TIPPE = `(wert) => {
  const el = document.querySelector('[data-testid="bib-suche"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, wert);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`;
/** In der Seite: die Zeile mit diesem Titel anklicken. */
const KLICKE = `(titel) => {
  const z = [...document.querySelectorAll('[data-testid="bib-zeile"]')].find((e) => (e.textContent || '').includes(titel));
  if (!z) throw new Error('Zeile fehlt: ' + titel);
  z.click();
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

/** Die Vorrichtung, fail-closed abgefragt: ohne sie misst keiner der Fälle etwas. */
function s(): H4Stand {
  expect(fehler, "die Vorrichtung ist nicht hochgekommen").toBeNull();
  if (stand === null) {
    throw new Error("kein Stand");
  }
  return stand;
}

beforeAll(async () => {
  try {
    stand = await h4Stand("/bibliothek", "pedi@job3104.test");
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 4).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await stand?.browser.close();
  await stand?.app.close();
}, 60_000);

describe("JOB 3104 · UX-02 — Suchbegriff und gelesener Bericht überleben ein echtes Neuladen", () => {
  it("B0 · die Ausgangslage stimmt: TITEL_FREI steht OBEN und rechts, die Adresse ist leer", async () => {
    const seite = s().seite;
    const zeilen = await seite.evaluate<string[]>(fn(ZEILEN));
    expect(zeilen).toEqual([TITEL_FREI, TITEL_OFFEN]);
    // Ohne diese Zusicherung bewiese der Rest nichts: der stille Ersatz greift zum ERSTEN Eintrag.
    expect(await seite.evaluate<string | null>(fn(LESETITEL))).toBe(TITEL_FREI);
    const suche = await seite.evaluate<string>(fn("() => location.search"));
    expect(suche, "eine Vorwahl ist keine getroffene Wahl und wird nicht gestempelt").toBe("");
  }, 60_000);

  it("B1 · ein Klick auf die ZWEITE Zeile schreibt `eintrag` in die Adresse", async () => {
    const seite = s().seite;
    await seite.evaluate(fn(KLICKE), TITEL_OFFEN);
    await seite.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_OFFEN,
      { timeout: 20_000 },
    );
    const suche = await seite.evaluate<string>(fn("() => location.search"));
    expect(new URLSearchParams(suche).get(EINTRAG_PARAM)).toBe(s().koOffenId);
    // Auf `/bibliothek` wechselt nur die Fläche, nicht der Ort.
    expect(await seite.evaluate<string>(fn("() => location.pathname"))).toBe("/bibliothek");
  }, 60_000);

  it("B2 · der getippte Begriff steht nach der Entprellung als `q` daneben", async () => {
    const seite = s().seite;
    await seite.evaluate(fn(TIPPE), BEGRIFF);
    await seite.waitForFunction(
      fn(`(soll) => new URLSearchParams(location.search).get('q') === soll`),
      BEGRIFF,
      { timeout: 20_000 },
    );
    await seite.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length === 1`),
      undefined,
      { timeout: 20_000 },
    );
    const suche = new URLSearchParams(await seite.evaluate<string>(fn("() => location.search")));
    expect(suche.get(SUCH_PARAM)).toBe(BEGRIFF);
    expect(suche.get(EINTRAG_PARAM), "die Wahl ist beim Tippen verlorengegangen").toBe(
      s().koOffenId,
    );
  }, 60_000);

  it("B3 · ECHTES NEULADEN derselben Adresse: Suche, Trefferliste und Bericht sind dieselben", async () => {
    const seite = s().seite;
    const href = await seite.evaluate<string>(fn("() => location.href"));
    expect(href).toContain(`${SUCH_PARAM}=${BEGRIFF}`);

    // Ein NEUES Dokument. Kein React-Trick, kein erhaltener Zustand.
    await seite.goto(href, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
      undefined,
      { timeout: 30_000 },
    );

    expect(await seite.evaluate<string | null>(fn(SUCHFELD)), "das Suchfeld ist leer").toBe(
      BEGRIFF,
    );
    expect(await seite.evaluate<string[]>(fn(ZEILEN))).toEqual([TITEL_OFFEN]);
    const titel = await seite.evaluate<string | null>(fn(LESETITEL));
    expect(titel).toBe(TITEL_OFFEN);
    expect(titel, "genau der Befund N-0006: ein fremder Bericht steht da").not.toBe(TITEL_FREI);
  }, 90_000);

  it("B3b · `?eintrag=` allein trägt auch OHNE Suche — der fremde Bericht bleibt weg", async () => {
    // Der schärfere Fall: die Liste ist UNGEFILTERT, `TITEL_FREI` steht wieder oben. Käme der alte
    // Rückfall `sichtbareIds[0]` zurück, stünde er rechts.
    const seite = s().seite;
    await seite.goto(`${ORIGIN}/bibliothek?${EINTRAG_PARAM}=${s().koOffenId}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
      undefined,
      { timeout: 30_000 },
    );

    expect(await seite.evaluate<string[]>(fn(ZEILEN))).toEqual([TITEL_FREI, TITEL_OFFEN]);
    expect(await seite.evaluate<string | null>(fn(LESETITEL))).toBe(TITEL_OFFEN);
    // Und die gewählte Zeile ist auch links die markierte.
    const markiert = await seite.evaluate<string | null>(
      fn(
        `() => { const z = document.querySelector('[data-testid="bib-zeile"][aria-current="true"]'); return z ? z.getAttribute('data-bib-id') : null; }`,
      ),
    );
    expect(markiert).toBe(s().koOffenId);
  }, 90_000);

  it("B3c · eine TOTE Kennung wird benannt statt still durch einen fremden Bericht ersetzt", async () => {
    // Lieferung 5 an der echten Seite: der Server liefert diese Kennung nicht (404), die Wahl
    // bleibt trotzdem stehen, und `BibliothekLesen` läuft in seinen VORHANDENEN Fehlerzweig. Kein
    // neuer Text, kein neuer Schlüssel — und ausdrücklich keine Ursachenbehauptung.
    const seite = s().seite;
    await seite.goto(`${ORIGIN}/bibliothek?${EINTRAG_PARAM}=gibt-es-nicht`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-lesen"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await seite.waitForFunction(
      fn(
        `(satz) => (document.querySelector('[data-testid="bib-lesen"]').innerText || '').includes(satz)`,
      ),
      LESEN_FEHLER,
      { timeout: 30_000 },
    );

    const lesetext = await seite.evaluate<string>(
      fn(
        `() => (document.querySelector('[data-testid="bib-lesen"]').innerText || '').replace(/\\s+/g, ' ')`,
      ),
    );
    expect(lesetext).toContain(LESEN_FEHLER);
    expect(lesetext).toContain(ERNEUT);
    // Der Kern des Befunds: rechts steht KEIN anderer Bericht.
    expect(lesetext, "ein fremder Bericht wurde untergeschoben").not.toContain(TITEL_FREI);
    expect(lesetext).not.toContain(TITEL_OFFEN);
    expect(await seite.evaluate<string | null>(fn(LESETITEL))).toBeNull();
    // Die Liste links bleibt vollständig — die tote Wahl macht die Fläche nicht blind.
    expect(await seite.evaluate<string[]>(fn(ZEILEN))).toEqual([TITEL_FREI, TITEL_OFFEN]);
    // Und die Ursache wird nicht behauptet: 404, 403 und Netzfehler sehen von hier gleich aus.
    for (const wort of ["gelöscht", "kein Zugriff", "gesperrt"]) {
      expect(lesetext.toLowerCase()).not.toContain(wort.toLowerCase());
    }
  }, 90_000);

  it("B4 · der Zurück-Weg bleibt nachvollziehbar: kein Verlaufsschritt je Tastendruck oder Klick", async () => {
    const seite = s().seite;
    // Ein bekannter Ort VOR der Bibliothek — sonst wäre „verlässt die Bibliothek" nicht messbar.
    await seite.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
    await seite.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
      undefined,
      { timeout: 30_000 },
    );
    const vorher = await seite.evaluate<number>(fn("() => history.length"));

    // Drei Tastenstände und ein Klick — mit `push` wären das bis zu vier Verlaufseinträge.
    for (const teil of ["Rei", "Reini", BEGRIFF]) {
      await seite.evaluate(fn(TIPPE), teil);
      await seite.waitForTimeout(400);
    }
    await seite.waitForFunction(
      fn(`(soll) => new URLSearchParams(location.search).get('q') === soll`),
      BEGRIFF,
      { timeout: 20_000 },
    );
    await seite.evaluate(fn(KLICKE), TITEL_OFFEN);
    await seite.waitForFunction(
      fn(`(soll) => new URLSearchParams(location.search).get('eintrag') === soll`),
      s().koOffenId,
      { timeout: 20_000 },
    );

    expect(
      await seite.evaluate<number>(fn("() => history.length")),
      "jeder Schreibweg muss `replace` sein",
    ).toBe(vorher);

    // EIN Zurück-Klick verlässt die Bibliothek, statt durch Wortfragmente zu stolpern.
    await seite.evaluate(fn("() => history.back()"));
    await seite.waitForFunction(fn(`() => location.pathname === '/start'`), undefined, {
      timeout: 20_000,
    });
    expect(await seite.evaluate<string>(fn("() => location.pathname"))).toBe("/start");
  }, 120_000);

  it("B5 · Chromium hat auf keinem dieser Wege einen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
