// ================================================================================================
// JOB 3671 — DIE HILFE DER DUBLETTENFLÄCHE AM GEBAUTEN PRODUKT, SCHMAL, IN CHROMIUM.
// ================================================================================================
//
// WARUM ZUSÄTZLICH ZU DEN JSDOM-FÄLLEN: jsdom rechnet kein CSS. Zwei Zusagen dieses Auftrags hängen
// aber an echtem CSS — dass der Erklärtext NICHT im Sichtfeld steht (Pedi 04.09.) und dass die zwei
// Karten auf schmalen Fenstern UNTEREINANDER stehen (so steht es im Hilfetext). Die zwei
// Geschwisterjobs 3669/3741 sind genau an schmalen Zusagen gescheitert, die im jsdom grün aussahen.
//
// ARBEITSTEILUNG, damit nichts doppelt gemessen wird:
//   · BREIT (1280) hinter dem Zahnrad  → `seitenhilfe-dubletten.test.tsx` S1/S2 (jsdom), und dass
//     bei 1280 kein Erklärtext auf der Prüffläche steht, misst der vorhandene Chromium-Textmesser
//     `tests/design/zielbild-h2-pruefen.test.ts` („Textmesser Duplikate: 9 Zeichen").
//   · SCHMAL (390) im Drawer, echtes CSS → diese Datei.
//
// EINE Browserinstanz für die ganze Datei, Startbreite 390 px (Begründung für die Sparsamkeit:
// `h6-chromium.ts:wechsle`). Der Helfer gibt das Ändern der Sichtfeldbreite nicht her; einen
// zweiten Browser nur für die breite Wiederholung eines bereits gemessenen Wegs aufzumachen wäre
// Speicher für nichts.
//
// FRISCHE INSTANZ, KEIN BESTAND: `starte` bootet eine leere App, `/duplikate` zeigt also den
// Leerzustand. Genau der ist hier richtig — wer nicht weiterweiss, hat oft kein Paar vor sich, und
// die Hilfe muss auch dann im Zahnrad stehen. Die Zusagen, die ein PAAR brauchen
// (Kartenreihenfolge, Markierung), messen die jsdom-Fälle.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Stand, beende, fn, setzeSprache, starte } from "../design/h6-chromium";

const BRETT = "/duplikate";
const ANKER = '[data-testid="page-duplikate"]';

let stand: Stand;

/** Der Text der Sprachressource selbst — kein `t()`, damit kein Rückfall auf Deutsch mitläuft. */
function ressource(sprache: string, schluessel: string): string {
  const wert: unknown = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Schlüssel ${schluessel} fehlt in der Sprachressource ${sprache}`);
  }
  return wert;
}

function eingesetzt(
  sprache: string,
  schluessel: string,
  einsetzungen: Record<string, string>,
): string {
  let text = ressource(sprache, schluessel);
  for (const [name, wert] of Object.entries(einsetzungen)) {
    text = text.replaceAll(`{{${name}}}`, wert);
  }
  return text.replace(/\s+/g, " ").trim();
}

const brettTexte = (sprache: string): readonly string[] => [
  ressource(sprache, "dup.seitenhilfe.flaeche.titel"),
  eingesetzt(sprache, "dup.seitenhilfe.flaeche.text", {
    mehr: ressource(sprache, "pruefen.more"),
  }),
  ressource(sprache, "dup.seitenhilfe.entscheidung.titel"),
  eingesetzt(sprache, "dup.seitenhilfe.entscheidung.text", {
    bibliothek: ressource(sprache, "nav.library"),
  }),
];

const KLICK =
  "(sel) => { const el = document.querySelector(sel); if (!el) { return false; } el.click(); return true; }";
const TEXT = `(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null; }`;

function seiteVon(): NonNullable<Stand["seite"]> {
  const seite = stand.seite;
  if (!seite) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite;
}

async function klick(selektor: string): Promise<void> {
  const getroffen = await seiteVon().evaluate<boolean>(fn(KLICK), selektor);
  expect(getroffen, `Element ${selektor} fehlt in der gebauten Seite`).toBe(true);
  await seiteVon().waitForTimeout(120);
}

const text = (selektor: string): Promise<string | null> =>
  seiteVon().evaluate<string | null>(fn(TEXT), selektor);

async function neuAufbauen(): Promise<void> {
  const seite = seiteVon();
  await seite.goto(`${ORIGIN}${BRETT}`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(fn("(s) => document.querySelector(s) !== null"), ANKER, {
    timeout: 30_000,
  });
}

/** Schmal: Hamburger → Zahnrad-Eintrag „Seitenhilfe" im Drawer. */
async function seitenhilfeSchmal(): Promise<string> {
  await klick('[data-testid="kopfband-menue"]');
  await klick('[data-testid="zahnrad-seitenhilfe"]');
  const liste = await text('[data-testid="seitenhilfe-liste"]');
  expect(liste, "Die Seitenhilfe-Liste fehlt im Drawer").not.toBeNull();
  return liste ?? "";
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  // 390×844 — ein gewöhnliches Telefon: unter dem `sm`-Knick (640 px) UND unter 899 px (Drawer).
  stand = await starte(BRETT, ANKER, 390, 844);
  if (stand.fehler === null) {
    console.info(
      `JOB 3671 · Chromium ${stand.version} · Theme ${stand.theme} · 390×844 · ${BRETT}`,
    );
  }
}, 240_000);

afterAll(async () => {
  await beende(stand);
  await i18n.changeLanguage("de");
}, 60_000);

describe("JOB 3671 · C — die Seitenhilfe des Dublettenbretts am gebauten Produkt (390 px)", () => {
  it("C0 · die Buehne steht (ohne sie sagt keiner der Faelle etwas)", () => {
    expect(stand.fehler).toBeNull();
    expect(stand.seitenfehler).toEqual([]);
  });

  it("C1 · das Fenster ist wirklich schmal, und der Drawer zeigt beide Hilfen vollstaendig", async () => {
    expect(stand.fehler).toBeNull();
    expect(await seiteVon().evaluate<number>(fn("() => window.innerWidth"))).toBe(390);
    const liste = await seitenhilfeSchmal();
    for (const erwartet of brettTexte("de")) {
      expect(liste).toContain(erwartet);
    }
  });

  // Pedi 04.09.: „Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld." Gemessen am `<main>`
  // der echten Seite bei geschlossenem Menü — nicht an einer Quellzeile.
  it("C2 · kein Wort der Hilfe steht im Sichtfeld", async () => {
    expect(stand.fehler).toBeNull();
    await neuAufbauen();
    const inhalt = await text("main");
    expect(inhalt).not.toBeNull();
    for (const erwartet of brettTexte("de")) {
      expect(inhalt ?? "").not.toContain(erwartet);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // C3 — DIE SCHMAL-ZUSAGE, AM ECHTEN CSS GEMESSEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Hilfetext sagt: „auf schmalen Fenstern stehen die beiden Karten untereinander — dann meint
  // ‚Links behalten' die obere Karte". Dass das Kartenpaar `flex-col sm:flex-row` trägt, pinnt der
  // jsdom-Fall S7 samt Gegenprobe. Hier wird die ANDERE Hälfte der Kette gemessen: dass das
  // GEBAUTE Stylesheet `flex-col` als Spalte führt und `flex-row` erst ab 640 px setzt. Verschiebt
  // jemand den Knick, wird die Aussage falsch — und dieser Fall rot, ohne dass ein Kartenpaar im
  // Bestand liegen muss (eine Überschneidung lässt sich über die echten Routen nicht anlegen).
  it("C3 · das gebaute CSS stapelt unter 640 px und reiht erst darueber", async () => {
    expect(stand.fehler).toBeNull();
    // Gesammelt wird ALLES, was `flex-row` setzt, mit seiner Bedingung — die Auswahl der einen
    // Regel geschieht danach hier. (Ein Zugriff auf `sm:flex-row` im Selektorvergleich IM Browser
    // wäre ein Escape-Rätsel über drei Ebenen; `lg:flex-row` bei 1024 px gäbe sonst den Ton an.)
    const gesammelt = await seiteVon().evaluate<{
      spalte: string | null;
      reihen: { sel: string; cond: string }[];
    }>(
      fn(`() => {
        let spalte = null;
        const reihen = [];
        for (const blatt of Array.from(document.styleSheets)) {
          let regeln = [];
          try { regeln = Array.from(blatt.cssRules || []); } catch (e) { continue; }
          for (const regel of regeln) {
            if (regel.selectorText === '.flex-col' && regel.style) {
              spalte = regel.style.getPropertyValue('flex-direction') || spalte;
            }
            if (regel.media && regel.cssRules) {
              const cond = regel.conditionText || regel.media.mediaText || '';
              for (const innen of Array.from(regel.cssRules)) {
                if (innen.selectorText && innen.selectorText.indexOf('flex-row') !== -1) {
                  reihen.push({ sel: innen.selectorText, cond: cond });
                }
              }
            }
          }
        }
        return { spalte, reihen };
      }`),
    );
    expect(gesammelt.spalte, "`.flex-col` setzt keine Spalte mehr").toBe("column");
    const smRegel = gesammelt.reihen.find((r) => r.sel.replace(/\\/g, "") === ".sm:flex-row");
    expect(
      smRegel,
      `keine Regel für sm:flex-row gefunden — nur: ${gesammelt.reihen.map((r) => r.sel).join(", ")}`,
    ).toBeDefined();
    expect(smRegel?.cond ?? "").toContain("min-width");
    expect(smRegel?.cond ?? "").toContain("640px");
  });

  it("C4 · niederlaendisch: die Liste spricht Niederlaendisch, nicht Deutsch", async () => {
    expect(stand.fehler).toBeNull();
    const lage = await setzeSprache(stand, "nl", BRETT, ANKER);
    expect(lage.lang).toBe("nl");
    const liste = await seitenhilfeSchmal();
    for (const erwartet of brettTexte("nl")) {
      expect(liste).toContain(erwartet);
    }
    // Und kein deutscher Satz mischt sich dazwischen.
    expect(liste).not.toContain(ressource("de", "dup.seitenhilfe.flaeche.titel"));
    await setzeSprache(stand, "de", BRETT, ANKER);
  });
});
