// ================================================================================================
// JOB 3488 · BIBLIOTHEK-VORSCHAU-AUFKLAPPER — DIE TASTATUR UND DIE LAGE, AM ECHTEN BROWSER.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (Runde 1, Lieferpunkt 6 stand als „teilweise" da). Der gemountete Test
// daneben misst, WAS im Baum steht, und dass ein ausgelöster Umschalter die Auswahl nicht bewegt.
// Zwei Zusagen des Auftrags kann er strukturell NICHT messen:
//
//   · „Tab erreicht je Treffer Zeilenknopf und Umschalter nacheinander, Enter/Space auf dem
//     Umschalter klappt auf und zu, Enter auf der Zeile wählt" (Lieferung 6). jsdom leitet aus
//     einem Tastendruck keinen Klick ab und hat keine Fokusreihenfolge — ein `dispatchEvent`-
//     Nachbau davon hätte nur die Attrappe geprüft, nicht das Produkt.
//   · „der Umschalter liegt in der 380-px-Spalte, an der Textspalte, und nichts läuft seitlich
//     heraus" (Lieferung 4/8). jsdom hat kein Layout; jede Zahl dazu wäre behauptet.
//
// Hier drückt deshalb ein ECHTER Chromium die Tasten auf der GEBAUTEN Seite, und die Lage wird an
// den realen Kästen gemessen.
//
// EINE Browserinstanz für alle Fälle (`h4-harness`, dieselbe Vorrichtung wie die Zielbild-Messung
// und wie `tests/ux21-tablet-lesemodus/tablet-chromium.test.ts`): mehr Instanzen kippen im
// Gesamttor fremde Browsertests. Keine eigene Startstelle — Playwright kommt über den Prüfstand.
//
// DIE TASTATUR KOMMT ÜBER EINE ENGE ERWEITERUNG DES SEITEN-TYPS, und das ist Absicht: `Seite` in
// `h4-harness.ts` ist eine schlanke Handtypisierung „nur was gebraucht wird", und diese Datei
// braucht als erste `page.keyboard`. Die Harness steht nicht in den Zielpfaden dieses Auftrags,
// also wird sie nicht angefasst; der Zugriff wird hier lokal und benannt aufgeweitet, nicht
// nachgebaut. Das ECHTE Playwright-Objekt trägt `keyboard` — es wird nichts erfunden.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, ORIGIN, TITEL_FREI, fn, h4Stand } from "../design/h4-harness";

/** Der Tastaturzugriff der echten Playwright-Seite — s. den Absatz im Kopf. */
interface MitTastatur {
  keyboard: { press(taste: string): Promise<void> };
}

interface Umschalter {
  expanded: string | null;
  text: string;
  /** Linke Kante, gemessen als Abstand zur linken Kante der Liste. */
  links: number;
  /** Linke Kante des Zeilentitels DESSELBEN Blocks — die Textspalte, an der er beginnen soll. */
  titelLinks: number;
  /** Rechte Kante, gemessen als Abstand zur rechten Kante der Liste (nie negativ = kein Überlauf). */
  rechtsFrei: number;
  /** Liegt der Knopf in seiner Mitte wirklich obenauf? Nur dann ist er mit der Maus zu treffen. */
  frei: boolean;
}

interface Befund {
  zeilen: number;
  bloecke: number;
  umschalter: (Umschalter | null)[];
  /** Die Regel aus `BibliothekListe.tsx`: kein `button` in einem `button`. */
  knopfImKnopf: number;
  /** Kalibrierung: ohne Knöpfe wäre die Zeile darüber immer grün. */
  knoepfe: number;
  /** Der offene Vorschautext je Block — `null`, solange zugeklappt. */
  vorschau: (string | null)[];
  blockHoehen: number[];
  listenBreite: number | null;
  /** Waagerechter Überlauf INNERHALB der Liste (scrollWidth − clientWidth). */
  ueberlauf: number | null;
  gewaehlt: string | null;
  adresse: string;
  seitenBreite: number;
  seitenUeberlauf: number;
}

const MESSEN = `() => {
  const q = (s) => document.querySelector(s);
  const liste = q('[data-testid="bib-liste"]');
  const rl = liste ? liste.getBoundingClientRect() : null;
  const bloecke = [...document.querySelectorAll('[data-testid="bib-zeilenblock"]')];
  const frei = (el) => {
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben !== null && (oben === el || el.contains(oben));
  };
  const g = q('[data-testid="bib-zeile"][aria-current="true"]');
  return {
    zeilen: document.querySelectorAll('[data-testid="bib-zeile"]').length,
    bloecke: bloecke.length,
    umschalter: bloecke.map((b) => {
      const t = b.querySelector('button[aria-expanded]');
      const titel = b.querySelector('[data-bib-text="zeile-titel"]');
      if (!t || !rl || !titel) { return null; }
      const r = t.getBoundingClientRect();
      return {
        expanded: t.getAttribute('aria-expanded'),
        text: (t.textContent || '').replace(/\\s+/g, ' ').trim(),
        links: Math.round(r.left - rl.left),
        titelLinks: Math.round(titel.getBoundingClientRect().left - rl.left),
        rechtsFrei: Math.round(rl.right - r.right),
        frei: frei(t),
      };
    }),
    knopfImKnopf: document.querySelectorAll('button button').length,
    knoepfe: document.querySelectorAll('button').length,
    vorschau: bloecke.map((b) => { const p = b.querySelector('p'); return p ? (p.textContent || '').replace(/\\s+/g, ' ').trim() : null; }),
    blockHoehen: bloecke.map((b) => Math.round(b.getBoundingClientRect().height)),
    listenBreite: rl ? Math.round(rl.width) : null,
    ueberlauf: liste ? Math.round(liste.scrollWidth - liste.clientWidth) : null,
    gewaehlt: g ? g.getAttribute('data-bib-id') : null,
    adresse: location.pathname + location.search,
    seitenBreite: window.innerWidth,
    seitenUeberlauf: Math.round(document.documentElement.scrollWidth - window.innerWidth),
  };
}`;

interface Aktiv {
  tag: string;
  marke: string | null;
  expanded: string | null;
  bibId: string | null;
  /** Zu WELCHEM Treffer gehört das fokussierte Element? So wird „nacheinander" prüfbar. */
  blockId: string | null;
}

const AKTIV = `() => {
  const a = document.activeElement;
  if (!a || a === document.body) { return null; }
  const block = a.closest ? a.closest('[data-testid="bib-zeilenblock"]') : null;
  return {
    tag: a.tagName,
    marke: a.getAttribute('data-testid'),
    expanded: a.getAttribute('aria-expanded'),
    bibId: a.getAttribute('data-bib-id'),
    blockId: block ? block.getAttribute('data-bib-id') : null,
  };
}`;

/** Den Fokus auf den Zeilenknopf des ERSTEN Treffers setzen — der Ausgangspunkt der Tastenfolge. */
const FOKUS_ERSTE_ZEILE = `() => {
  const z = document.querySelector('[data-testid="bib-zeile"]');
  if (!z) { return null; }
  z.focus();
  return z.getAttribute('data-bib-id');
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

function seite(): H4Stand["seite"] {
  return (stand as H4Stand).seite;
}

async function taste(name: string): Promise<void> {
  await (seite() as unknown as MitTastatur).keyboard.press(name);
  await seite().waitForTimeout(120);
}

async function messen(was: string): Promise<Befund> {
  const m = await seite().evaluate<Befund>(fn(MESSEN));
  console.info(`JOB 3488 · ${was}: ${JSON.stringify(m)}`);
  return m;
}

async function aktiv(): Promise<Aktiv | null> {
  return seite().evaluate<Aktiv | null>(fn(AKTIV));
}

/** Frisch laden: jeder Fall beginnt mit zugeklappten Aufklappern und ohne Wahl in der Adresse. */
async function frisch(): Promise<void> {
  await seite().goto(`${ORIGIN}/bibliothek`, { waitUntil: "load", timeout: 60_000 });
  await seite().waitForFunction(
    fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length >= 2`),
    undefined,
    { timeout: 30_000 },
  );
  await seite().waitForTimeout(300);
}

describe("JOB 3488 · der Vorschau-Aufklapper in Chromium (gebaute Seite)", () => {
  beforeAll(async () => {
    try {
      // Der Bestand der Vorrichtung trägt ZWEI Einträge, beide mit Kernaussage — genau die zwei
      // Zeilen, an denen „nacheinander" und „gleichzeitig" überhaupt Sinn ergeben.
      stand = await h4Stand("/bibliothek", "pedi@job3488.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C1 · die Bühne steht: jede Zeile ein Block mit genau einem Umschalter, und kein Knopf liegt in einem Knopf", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const m = await messen("C1 Bühne");
    expect(m.zeilen).toBe(2);
    expect(m.bloecke).toBe(2);
    expect(m.umschalter.filter((u) => u !== null)).toHaveLength(2);
    for (const u of m.umschalter) {
      expect(u?.expanded).toBe("false");
      // Die vorhandene Beschriftung aus JOB 3326/E2 — kein neuer Wortlaut.
      expect(u?.text).toBe("Kurzvorschau");
    }
    // Zugeklappt steht kein Vorschautext da.
    expect(m.vorschau).toEqual([null, null]);
    // DIE REGEL, am gebauten Baum statt an der Attrappe.
    expect(m.knopfImKnopf).toBe(0);
    // Fail-closed: ohne Knöpfe wäre die Zeile darüber immer grün.
    expect(m.knoepfe).toBeGreaterThan(5);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 60_000);

  it("C2 · der Umschalter liegt frei, beginnt an der Textspalte und bleibt in der 380-px-Spalte", async () => {
    expect(fehler).toBeNull();
    const zu = await messen("C2 zugeklappt");
    expect(zu.listenBreite).toBe(380);
    for (const u of zu.umschalter) {
      // Nur ein freiliegender Knopf ist mit dem Finger und der Maus zu treffen.
      expect(u?.frei).toBe(true);
      // „an der Textspalte": nicht eine gesetzte Zahl, sondern dieselbe Kante wie der Zeilentitel.
      expect(u?.links).toBe(u?.titelLinks);
      // Nichts läuft seitlich aus der Spalte heraus.
      expect(u?.rechtsFrei ?? -1).toBeGreaterThan(0);
    }
    expect(zu.ueberlauf).toBeLessThanOrEqual(0);
    expect(zu.seitenUeberlauf).toBeLessThanOrEqual(0);

    // Und aufgeklappt bleibt es dabei — der Vorschaukasten ist der breiteste Teil des Blocks.
    await seite().evaluate(
      fn(
        `() => { for (const b of document.querySelectorAll('button[aria-expanded="false"]')) { if ((b.textContent || '').includes('Kurzvorschau')) { b.click(); } } }`,
      ),
    );
    await seite().waitForTimeout(300);
    const offen = await messen("C2 aufgeklappt");
    expect(offen.ueberlauf).toBeLessThanOrEqual(0);
    expect(offen.seitenUeberlauf).toBeLessThanOrEqual(0);
    expect(offen.listenBreite).toBe(380);
    // Die Höhe der Zeile wächst — das ist keine Zusicherung, sondern die ehrliche Messung des
    // Preises (Runde 1 hatte sie als offenen Punkt benannt). Sie steht im Protokoll.
    console.info(
      `JOB 3488 · Blockhöhe zugeklappt ${JSON.stringify(zu.blockHoehen)} → aufgeklappt ${JSON.stringify(offen.blockHoehen)}`,
    );
    expect(offen.blockHoehen[0] ?? 0).toBeGreaterThan(zu.blockHoehen[0] ?? 0);
  }, 60_000);

  it("C3 · beide Vorschauen stehen GLEICHZEITIG offen, und die Auswahl hat sich dabei nicht bewegt", async () => {
    expect(fehler).toBeNull();
    // Der vorige Fall hat beide geöffnet; hier wird das Ergebnis gemessen, nicht neu erzeugt.
    const m = await messen("C3 beide offen");
    expect(m.umschalter.map((u) => u?.expanded)).toEqual(["true", "true"]);
    const texte = m.vorschau;
    expect(texte[0]).not.toBeNull();
    expect(texte[1]).not.toBeNull();
    expect(texte[0]).not.toBe(texte[1]);
    // Der gewählte Eintrag ist unverändert der vorgewählte erste, und die Adresse trägt keine Wahl.
    expect(m.adresse).toBe("/bibliothek");
    expect(m.gewaehlt).toBe(stand?.koId);
  }, 60_000);

  it("C4 · Tastatur: Tab → Zeilenknopf, Tab → Umschalter, Enter auf und zu, Space auf — ohne einen Auswahlwechsel; Enter auf der Zeile wählt", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const ersteId = await seite().evaluate<string | null>(fn(FOKUS_ERSTE_ZEILE));
    expect(ersteId).toBe(stand?.koId);

    // 1. Der Fokus steht auf dem ZEILENKNOPF des ersten Treffers.
    const aufZeile = await aktiv();
    console.info(`JOB 3488 · C4 Fokus Start: ${JSON.stringify(aufZeile)}`);
    expect(aufZeile?.tag).toBe("BUTTON");
    expect(aufZeile?.marke).toBe("bib-zeile");
    expect(aufZeile?.bibId).toBe(ersteId);

    // 2. EIN Tab weiter steht der Umschalter DESSELBEN Treffers — nicht die nächste Zeile.
    await taste("Tab");
    const aufUmschalter = await aktiv();
    console.info(`JOB 3488 · C4 nach Tab: ${JSON.stringify(aufUmschalter)}`);
    expect(aufUmschalter?.tag).toBe("BUTTON");
    expect(aufUmschalter?.expanded).toBe("false");
    expect(aufUmschalter?.blockId).toBe(ersteId);

    // 3. Enter klappt auf. Der Vorschautext steht, die Auswahl und die Adresse rühren sich nicht.
    await taste("Enter");
    const offen = await messen("C4 nach Enter");
    expect(offen.umschalter[0]?.expanded).toBe("true");
    expect(offen.vorschau[0]).not.toBeNull();
    expect(offen.vorschau[1]).toBeNull();
    expect(offen.gewaehlt).toBe(ersteId);
    expect(offen.adresse).toBe("/bibliothek");

    // 4. Enter klappt wieder zu — und der Fokus bleibt, wo er war.
    await taste("Enter");
    const zu = await messen("C4 nach zweitem Enter");
    expect(zu.umschalter[0]?.expanded).toBe("false");
    expect(zu.vorschau[0]).toBeNull();
    expect((await aktiv())?.blockId).toBe(ersteId);

    // 5. Space tut dasselbe (die zweite Auslösetaste eines echten `<button>`).
    await taste("Space");
    const wiederOffen = await messen("C4 nach Space");
    expect(wiederOffen.umschalter[0]?.expanded).toBe("true");
    expect(wiederOffen.vorschau[0]).not.toBeNull();
    // Nach drei Auslösungen am Umschalter: KEIN Auswahlwechsel, kein Adresswechsel.
    expect(wiederOffen.gewaehlt).toBe(ersteId);
    expect(wiederOffen.adresse).toBe("/bibliothek");

    // 6. Der nächste Tab erreicht den Zeilenknopf des ZWEITEN Treffers — die Reihenfolge je
    //    Treffer ist also Zeilenknopf, dann Umschalter, dann der nächste Treffer.
    await taste("Tab");
    const zweite = await aktiv();
    console.info(`JOB 3488 · C4 Tab zum zweiten Treffer: ${JSON.stringify(zweite)}`);
    expect(zweite?.marke).toBe("bib-zeile");
    expect(zweite?.bibId).toBe(stand?.koOffenId);

    // 7. Und Enter auf der ZEILE wählt weiterhin — genau diesen Eintrag.
    await taste("Enter");
    await seite().waitForTimeout(400);
    const gewaehlt = await messen("C4 nach Enter auf der Zeile");
    expect(gewaehlt.gewaehlt).toBe(stand?.koOffenId);
    expect(gewaehlt.adresse).toContain(`eintrag=${stand?.koOffenId}`);
    // Die zuvor geöffnete Vorschau des ersten Treffers steht weiter offen: die Liste ist nicht
    // neu aufgebaut worden, nur die Wahl hat gewechselt.
    expect(gewaehlt.vorschau[0]).not.toBeNull();
    // Und die Lesefläche rechts zeigt jetzt den zweiten Eintrag, nicht mehr den ersten.
    const leseTitel = await seite().evaluate<string>(
      fn(
        `() => { const el = document.querySelector('[data-testid="bib-titel"]'); return el ? el.textContent.trim() : ''; }`,
      ),
    );
    expect(leseTitel).not.toBe(TITEL_FREI);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 90_000);
});
