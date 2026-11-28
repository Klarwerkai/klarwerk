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
import i18n from "../../apps/web/src/i18n";
import { type H4Stand, MOCKUP, TITEL_FREI, TITEL_OFFEN, fn, h4Stand } from "./h4-harness";

// Nicht exportiert: der Wert gehört diesem Messer allein (Biome `suspicious/noExportsInTest`).
const GRENZE = 60;

// Die zwei Beispielobjekte sind in Fassung 1. Nur eines wurde von Pedi bestätigt.
// Die später eingeführten Nachweise und Pflichtangaben werden an ihrem jeweiligen Ort
// und mit ihrem vollständigen Wortlaut erkannt. Zusätzlicher Text bleibt messbar.
function fachangaben(): [string, string][] {
  const t = i18n.getFixedT("de");
  return [
    ['[data-testid="bib-fassungsstand"]', t("fassungsangabe.kopfFassung", { version: 1 })],
    [
      '[data-testid="ko-verifizierung-belegt"]',
      t("verifizierung.mensch.bewertung", { name: "Pedi", zeit: "{ZEIT}" }),
    ],
    [
      '[data-testid="ko-verifizierung-validiert_von"]',
      t("verifizierung.validiertVon", { namen: "Pedi" }),
    ],
    ['[data-testid="ko-verifizierung-nicht_belegt"]', t("verifizierung.mensch.nichtBelegt")],
    [
      '[data-testid="ko-verifizierung-ki"]',
      `${t("verifizierung.ki.titel")}: ${t("verifizierung.ki.keine")}`,
    ],
    [
      '[data-testid="bib-annahme-zeile"]',
      t("pruefablauf.annahme.zeile", { fassung: 1, person: "Pedi", zeit: "{ZEIT}" }),
    ],
    ['[data-testid="bib-annahme-regel"]', t("pruefablauf.annahme.regel.peerPruefung", { n: 1 })],
    ['[data-testid="veroeffentlichung-bereich"] > :first-child', t("veroeffentlichung.titel")],
    ['[data-testid="veroeffentlichung-bereich"] > p:first-of-type', t("veroeffentlichung.hinweis")],
    ['[data-testid="veroeffentlichung-stand"]', t("veroeffentlichung.stand.nie")],
    [
      '[data-testid="veroeffentlichung-aktuell"]',
      t("veroeffentlichung.stand.aktuellEntwurf", { aktuell: 1 }),
    ],
    [
      '[data-testid="veroeffentlichung-aktuell"]',
      t("veroeffentlichung.stand.aktuellGueltig", { aktuell: 1 }),
    ],
    [
      '[data-testid="veroeffentlichung-hindernis"]',
      t("veroeffentlichung.fehler.keine_gueltige_fassung"),
    ],
    ['[data-testid="veroeffentlichung-bereich"] legend', t("veroeffentlichung.wahl.titel")],
    ['[data-testid="verstaendnis-bereich"] > :first-child', t("verstaendnis.titel")],
    ['[data-testid="verstaendnis-abgrenzung"]', t("verstaendnis.abgrenzung")],
  ];
}

// In der Seite: den sichtbaren Text der Fläche einsammeln und die erlaubten Anteile abziehen.
const MESSEN = `(fachangaben) => {
  const flaeche = document.querySelector('[data-testid="bibliothek-flaeche"]');
  if (!flaeche) return null;
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const gesamt = norm(flaeche.innerText).length;
  const erlaubt = new Set();
  const sammle = (el) => { if (norm(el.innerText)) erlaubt.add(el); };
  for (const el of flaeche.querySelectorAll('[data-bib-text]')) sammle(el);
  for (const el of flaeche.querySelectorAll('button, a, summary, option, label, [role="menuitem"], [role="menuitemcheckbox"]')) sammle(el);
  for (const [selektor, soll] of fachangaben) {
    const el = flaeche.querySelector(selektor);
    if (!el) continue;
    const text = norm(el.innerText);
    if (text.replace(/\\b\\d{2}\\.\\d{2}\\.\\d{4},? \\d{2}:\\d{2}\\b/, '{ZEIT}') === soll) erlaubt.add(el);
  }
  // Nur die tatsächlich beschrifteten Elemente für diese synchrone Messung ausblenden.
  // Ein gleiches Wort in einem fremden Absatz muss im Rest stehen bleiben.
  const stile = [...erlaubt].map(el => [el, el.getAttribute('style')]);
  try {
    for (const [el] of stile) el.style.setProperty('visibility', 'hidden', 'important');
    const rest = norm(flaeche.innerText);
    return { rest, laenge: rest.length, gesamt, erlaubtAnzahl: erlaubt.size };
  } finally {
    for (const [el, vorher] of stile) {
      if (vorher === null) el.removeAttribute('style');
      else el.setAttribute('style', vorher);
    }
  }
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
    const m = await (stand as H4Stand).seite.evaluate<Messung | null>(fn(MESSEN), fachangaben());
    expect(m, "Fläche [data-testid=bibliothek-flaeche] nicht gefunden").not.toBeNull();
    expect((m as Messung).gesamt).toBeGreaterThan(100);
    expect((m as Messung).erlaubtAnzahl).toBeGreaterThan(5);
  }, 60_000);

  it(`T1 · in Ruhe: höchstens ${GRENZE} Zeichen, die weder Inhalt noch Beschriftung sind`, async () => {
    expect(fehler).toBeNull();
    const m = (await (stand as H4Stand).seite.evaluate<Messung>(
      fn(MESSEN),
      fachangaben(),
    )) as Messung;
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
    const m = (await s.evaluate<Messung>(fn(MESSEN), fachangaben())) as Messung;
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
    const m = (await s.evaluate<Messung>(fn(MESSEN), fachangaben())) as Messung;
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

  it("T5 · ein zusätzlicher Absatz bleibt auch innerhalb der Publikationsauskunft messbar", async () => {
    expect(fehler).toBeNull();
    const seite = (stand as H4Stand).seite;
    const zusatz =
      "Diese zusätzliche Erklärung gehört weder zur Auskunft über die Veröffentlichung noch zu den Belegen.";
    const id = "h4-kalibrierung";
    await seite.evaluate(
      fn(`([id, zusatz]) => {
      const hinweis = document.querySelector('[data-testid="veroeffentlichung-bereich"] > p:first-of-type');
      if (!hinweis) throw new Error('Publikationsauskunft fehlt');
      const span = document.createElement('span');
      span.id = id;
      span.textContent = ' ' + zusatz;
      hinweis.append(span);
    }`),
      [id, zusatz],
    );
    try {
      const messung = await seite.evaluate<Messung>(fn(MESSEN), fachangaben());
      expect(messung.rest).toContain(zusatz);
      expect(messung.laenge).toBeGreaterThan(GRENZE);
    } finally {
      await seite.evaluate(fn("(id) => document.getElementById(id)?.remove()"), id);
    }
  });
});

describe.runIf(!existsSync(MOCKUP))("JOB 3063 · Textmesser übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
