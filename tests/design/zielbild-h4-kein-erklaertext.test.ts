// ================================================================================================
// JOB 3063 · H4 — DER TEXTMESSER: WAS AUF DER BIBLIOTHEK STEHT, DAS KEIN INHALT IST.
// ================================================================================================
//
// PEDI, 04.09. 06:50, über die heutige Web-App: „Text über Text über Text. Die Anwendung selbst
// macht ungefähr 10 % des Ganzen aus." Maßstab ist Apple Pages: Knopf und Feld erklären sich selbst.
//
// GEMESSEN AM 04.09.2026 VOR DEM UMBAU, in Chromium an der gebauten Seite, mit EINEM Wissensobjekt
// im Bestand: `/bibliothek` 1.059 Zeichen sichtbarer Text im `<main>`, `/wissen/:id` 3.082 Zeichen
// bei 20 Karten. Darin: Kicker „Bibliothek", drei Hilfeknöpfe, der Bestandssatz, die Karte
// „Antwort statt nur Treffer?", die Reife-Erklärbox mit zwei Plaketten-Erklärungen, die
// Sortier- und Untergruppen-Reihen und die Facetten-Zählzeile.
//
// WIE HIER GEMESSEN WIRD, und warum genau so:
//   · Gemessen wird der `innerText` DER FLÄCHE (`[data-testid="bibliothek-flaeche"]`), nicht des
//     ganzen Dokuments. Die HÜLLE (Seitenleiste, Kopfzeile, Fußzeile) ist JOB H1 und ausdrücklich
//     nicht Gegenstand dieses Auftrags; sie mitzuzählen würde diesen Test an fremder Arbeit messen.
//   · Abgezogen wird, was INHALT oder BESCHRIFTUNG ist: jedes Element mit `data-bib-text` (Titel,
//     Texte, Meta-Zeilen, Chips, Zähler), jeder Knopf- und Menüpunkt-Text, jede `summary`. Was
//     danach übrig bleibt, ist Erklärtext — und davon dürfen höchstens 60 Zeichen dastehen.
//   · Zwei Lagen: in Ruhe (nichts angeklickt) und mit gewähltem Eintrag. Beide zählen dasselbe.
//
// WAS DIESER TEST NICHT LEISTET: er misst KEINE Qualität der Texte und keine Lesbarkeit. Er misst
// die MENGE dessen, was weder Inhalt noch Beschriftung ist.
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, MOCKUP, TITEL_FREI, TITEL_OFFEN, fn, h4Stand } from "./h4-harness";

// Nicht exportiert: der Wert gehört diesem Messer allein (Biome `suspicious/noExportsInTest`).
const GRENZE = 60;

// In der Seite: den sichtbaren Text der Fläche einsammeln und die erlaubten Anteile abziehen.
const MESSEN = `() => {
  const flaeche = document.querySelector('[data-testid="bibliothek-flaeche"]');
  if (!flaeche) return null;
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  let rest = norm(flaeche.innerText);
  const erlaubt = [];
  const sammle = (el) => { const t = norm(el.innerText !== undefined ? el.innerText : el.textContent); if (t) erlaubt.push(t); };
  for (const el of flaeche.querySelectorAll('[data-bib-text]')) sammle(el);
  for (const el of flaeche.querySelectorAll('button, a, summary, option, label, [role="menuitem"], [role="menuitemcheckbox"]')) sammle(el);
  // Längste zuerst: sonst schneidet ein kurzer Teiltext einen längeren mittendurch.
  erlaubt.sort((a, b) => b.length - a.length);
  for (const t of erlaubt) {
    while (rest.includes(t)) rest = rest.replace(t, ' ');
  }
  rest = rest.replace(/\\s+/g, ' ').trim();
  return { rest, laenge: rest.length, gesamt: norm(flaeche.innerText).length, erlaubtAnzahl: erlaubt.length };
}`;

interface Messung {
  rest: string;
  laenge: number;
  gesamt: number;
  erlaubtAnzahl: number;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;

describe("JOB 3063 · H4 · Textmesser — auf der Bibliothek steht kein Erklärtext mehr", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@job3063-b.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("T0 · die Fläche steht und trägt überhaupt sichtbaren Text (sonst misst der Messer nichts)", async () => {
    expect(fehler).toBeNull();
    const m = await (stand as H4Stand).seite.evaluate<Messung | null>(fn(MESSEN));
    expect(m, "Fläche [data-testid=bibliothek-flaeche] nicht gefunden").not.toBeNull();
    expect((m as Messung).gesamt).toBeGreaterThan(100);
    expect((m as Messung).erlaubtAnzahl).toBeGreaterThan(5);
  }, 60_000);

  it(`T1 · in Ruhe: höchstens ${GRENZE} Zeichen, die weder Inhalt noch Beschriftung sind`, async () => {
    expect(fehler).toBeNull();
    const m = (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN))) as Messung;
    console.info(
      `JOB 3063 H4 · Textmesser /bibliothek: gesamt ${m.gesamt} Zeichen, Rest ${m.laenge} — „${m.rest}"`,
    );
    expect(m.laenge, `Rest: „${m.rest}"`).toBeLessThanOrEqual(GRENZE);
  }, 60_000);

  it(`T2 · mit gewähltem Eintrag (Wechsel der Fläche): höchstens ${GRENZE} Zeichen`, async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    // Einen ANDEREN Eintrag anklicken — die Lesefläche muss wechseln, die Liste stehen bleiben.
    await s.evaluate(
      fn(`(titel) => {
        const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
        const z = zeilen.find((e) => (e.textContent || '').includes(titel));
        if (z) z.click();
      }`),
      TITEL_OFFEN,
    );
    await s.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_OFFEN,
      { timeout: 20_000 },
    );
    const zeilenzahl = await s.evaluate<number>(
      fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length`),
    );
    expect(zeilenzahl, "die Liste bleibt beim Wechsel stehen").toBe(2);
    const m = (await s.evaluate<Messung>(fn(MESSEN))) as Messung;
    console.info(
      `JOB 3063 H4 · Textmesser nach Wechsel: gesamt ${m.gesamt} Zeichen, Rest ${m.laenge} — „${m.rest}"`,
    );
    expect(m.laenge, `Rest: „${m.rest}"`).toBeLessThanOrEqual(GRENZE);
  }, 60_000);

  it("T3 · zurück auf den freigegebenen Eintrag — nur die rechte Fläche hat gewechselt", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.evaluate(
      fn(`(titel) => {
        const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
        const z = zeilen.find((e) => (e.textContent || '').includes(titel));
        if (z) z.click();
      }`),
      TITEL_FREI,
    );
    await s.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_FREI,
      { timeout: 20_000 },
    );
    const adresse = await s.evaluate<string>(fn("() => location.pathname"));
    expect(adresse, "auf /bibliothek wechselt NUR die Fläche, nicht die Adresse").toBe(
      "/bibliothek",
    );
    const m = (await s.evaluate<Messung>(fn(MESSEN))) as Messung;
    expect(m.laenge, `Rest: „${m.rest}"`).toBeLessThanOrEqual(GRENZE);
  }, 60_000);

  it("T4 · die Sätze, die der Eigentümer gestrichen hat, stehen nicht mehr da", async () => {
    expect(fehler).toBeNull();
    const text = await (stand as H4Stand).seite.evaluate<string>(
      fn(
        `() => (document.querySelector('[data-testid="bibliothek-flaeche"]').innerText || '').replace(/\\s+/g, ' ')`,
      ),
    );
    for (const satz of [
      "Antwort statt nur Treffer",
      "Filter ändern nur die Sicht",
      "Durchsucht wird das Klarwerk-Wissen",
      "Die Reife-Plakette zeigt",
      "lokal in diesem Browser gespeichert",
    ]) {
      expect(text, `dieser Satz sollte weg sein: ${satz}`).not.toContain(satz);
    }
  }, 60_000);
});

describe.runIf(!existsSync(MOCKUP))("JOB 3063 · Textmesser übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
