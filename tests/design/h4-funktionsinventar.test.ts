// ================================================================================================
// JOB 3063 · H4 — DAS FUNKTIONSINVENTAR: KEINE ZEILE DER TABELLE 5a OHNE IHREN NEUEN ORT.
// ================================================================================================
//
// PEDI, 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs."
//
// Dieser Test ist die Gegenprobe dazu, und er ist bewusst VERHALTENSBASIERT: für jede Zeile der
// Auftragstabelle wird in der GEBAUTEN Fläche (Chromium, echte App, echte Daten) der genannte Ort
// GEÖFFNET — Menü angeklickt, „Mehr" aufgeklappt — und das Element über seinen sichtbaren Text oder
// seine Rolle gefunden. Ein Quelltext-Grep bewiese nur, dass eine Zeichenkette existiert; hier muss
// ein Mensch sie erreichen können.
//
// EIN FALL JE FUNKTION. Fällt eine weg, trägt der rote Fall ihren Namen.
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORTSZEILE_WORTE } from "../support/ortszeileWorte";
import { type H4Stand, MOCKUP, ORIGIN, fn, h4Stand, spracheSetzen } from "./h4-harness";

// In der Seite: den Menüknopf drücken. Das ÖFFNEN ist ein React-Zustandswechsel — die Fläche
// entsteht deshalb erst im nächsten Zeichnen, nicht im selben `evaluate`. Darum drei Schritte:
// drücken, auf das Menü warten, lesen.
const MENUE_KLICK = `(testId) => {
  const knopf = document.querySelector('[data-testid="' + testId + '"]');
  if (knopf) knopf.click();
  return !!knopf;
}`;

const MENUE_LESEN = `(testId) => {
  const knopf = document.querySelector('[data-testid="' + testId + '"]');
  const menue = knopf && knopf.parentElement ? knopf.parentElement.querySelector('[role="menu"]') : null;
  if (!menue) return null;
  // Untermenüs aufklappen, damit ihre Einträge sichtbar werden (Pages-Regel: eine Ebene tiefer).
  for (const d of menue.querySelectorAll('details')) d.open = true;
  // Die BESCHRIFTUNG ohne ihre Zierzeichen: Haken und Pfeil tragen aria-hidden und sind für einen
  // Vorleser gar nicht da — sie dürfen deshalb auch hier nicht Teil des Namens sein.
  const name = (el) =>
    [...el.querySelectorAll('*')].length === 0
      ? (el.textContent || '').trim()
      : [...el.childNodes]
          .map((n) => (n.nodeType === 1 && n.getAttribute && n.getAttribute('aria-hidden') === 'true' ? '' : n.textContent))
          .join('')
          .trim();
  return {
    gruppen: [...menue.querySelectorAll('summary')].map(name),
    eintraege: [...menue.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], a')].map(name),
  };
}`;

// Der Status-Umschalter ist kein Menü, sondern eine Knopfreihe — er wird deshalb eigens gelesen.
// Er steht hier und nicht zweimal in der Datei: F02 hält seine deutschen Beschriftungen fest, F19
// liest dieselbe Reihe in Englisch.
const SEGMENT_LESEN = `() => [...document.querySelectorAll('[data-testid="bib-segment"] button')].map((b) => (b.textContent || '').trim())`;

// Der Leerzustand der Suche — er steht hier und nicht zweimal in der Datei: F18 hält ihn auf
// Deutsch fest, F21 liest dieselbe Stelle in Englisch (JOB 3602). Das Suchwort trifft mit Absicht
// nichts; `SUCHE_SETZEN` mit "" räumt das Feld wieder.
const LEERWORT = "zzz-nichts-findet-das-xyz";

const SUCHE_SETZEN = `(wort) => {
  const feld = document.querySelector('[data-testid="bib-suche"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(feld, wort);
  feld.dispatchEvent(new Event('input', { bubbles: true }));
}`;

const LEER_LESEN = `() => {
  const el = document.querySelector('[data-testid="bib-leer"]');
  const k = document.querySelector('[data-testid="bib-leer-erfassen"]');
  return { text: el.querySelector('p').textContent.trim(), knopf: k ? k.textContent.trim() : '' };
}`;

const MENUE_OFFEN = `(testId) => {
  const knopf = document.querySelector('[data-testid="' + testId + '"]');
  return !!knopf && knopf.getAttribute('aria-expanded') === 'true' && !!knopf.parentElement.querySelector('[role="menu"]');
}`;

interface MenueInhalt {
  gruppen: string[];
  eintraege: string[];
}

let stand: H4Stand | null = null;
let fehler: string | null = null;
let listenMenue: MenueInhalt | null = null;
let filterMenue: MenueInhalt | null = null;
let bereichMenue: MenueInhalt | null = null;
let eintragMenue: MenueInhalt | null = null;
let mehr: MehrLesung | null = null;
/**
 * Der Leerzustand in DEUTSCH, von F18 gelesen — der Massstab, gegen den F21 die englische Lesung
 * hält. Er wird HIER genommen und nicht ein zweites Mal abgeschrieben: F18 misst ihn ohnehin, und
 * eine zweite Abschrift wäre auch dann noch grün, wenn die deutsche Beschriftung sich ändert.
 */
let leerDe: { text: string; knopf: string } | null = null;

async function menueOeffnen(testId: string): Promise<void> {
  const s = (stand as H4Stand).seite;
  const da = await s.evaluate<boolean>(fn(MENUE_KLICK), testId);
  if (!da) {
    throw new Error(`Menüknopf ${testId} nicht gefunden`);
  }
  await s.waitForFunction(fn(MENUE_OFFEN), testId, { timeout: 20_000 });
}

async function menue(testId: string): Promise<MenueInhalt> {
  const s = (stand as H4Stand).seite;
  await menueOeffnen(testId);
  const inhalt = await s.evaluate<MenueInhalt | null>(fn(MENUE_LESEN), testId);
  await s.evaluate(fn(MENUE_KLICK), testId);
  if (!inhalt) {
    throw new Error(`Menü ${testId} nicht lesbar`);
  }
  return inhalt;
}

/**
 * „Mehr" aufklappen und jeden Abschnitt öffnen — der Stand, den `beforeAll` herstellt und den die
 * Fälle ab F16 an derselben lebenden Seite weiterlesen.
 *
 * Er steht als eigener Schritt hier, weil ihn ZWEI Stellen brauchen: `beforeAll` stellt ihn her,
 * F08b stellt ihn nach dem Breitenwechsel wieder her. Bis JOB 3576 stand derselbe Block zweimal in
 * dieser Datei; die dritte Abschrift wäre die gewesen, die beim nächsten Umbau vergessen wird.
 *
 * Jeder Abschnitt zeichnet seinen Inhalt ERST beim Aufklappen (`MehrAbschnitte`) — deshalb erst
 * öffnen, dann warten, dann lesen. In einem Zug gelesen stünde überall nur der Titel.
 *
 * WARUM HIER WEITER EINE FRIST STEHT UND KEIN ZUSTANDSWARTEN, obwohl Lehre JOB 3152 T1b das sonst
 * verlangt: die Abschnitte sind React-GESTEUERT (`MehrAbschnitte.tsx:151-153`,
 * `<details open={offen}>` mit `{offen ? children : null}`). Ein von aussen gesetztes `open`
 * überlebt nur, wenn die Fläche danach nicht noch einmal zeichnet. Ein Zustandswarten ändert daran
 * NICHTS — es kann nur feststellen, dass es im Augenblick des Blicks stimmte. Gemessen in zwei
 * Torläufen (Cloud-Läufe 2498545238f7b359ed5eadeb und 45d6a1b96bc35678a4d5fb82): nach einem
 * Neuladen kam der Schritt mit „alle Abschnitte offen, Knotenzahl in Ruhe" zurück, und F16 las
 * Sekunden später trotzdem alle acht Zahlen als 0. Die Antwort darauf ist die Hausregel dieser
 * Datei (s. den F13-Block am Ende): Fälle, die NEU LADEN, stehen am Ende. Seit JOB 3576 tun F08
 * und F08c das; dieser Schritt läuft damit wieder nur an einer stehenden Seite, wo er seit JOB
 * 3063 trägt.
 */
async function mehrAufklappen(): Promise<void> {
  const s = (stand as H4Stand).seite;
  await s.evaluate(
    fn(
      `() => { const b = document.querySelector('[data-testid="bib-mehr"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }`,
    ),
  );
  await s.waitForFunction(
    fn(`() => document.querySelectorAll('[data-bib-abschnitt]').length > 0`),
    undefined,
    { timeout: 20_000 },
  );
  await s.evaluate(
    fn(
      `() => { for (const d of document.querySelectorAll('[data-bib-abschnitt]')) d.open = true; }`,
    ),
  );
  await s.waitForTimeout(2500);
}

/**
 * In der Seite: jeder aufgeklappte Abschnitt unter „Mehr" mit seiner Kennung und seinem Text.
 *
 * JOB 3602: dieser Block stand bis heute AUSGESCHRIEBEN in `beforeAll`. F20 liest dieselbe Fläche
 * in Englisch — und zwar mit demselben Leser, nicht mit einer Abschrift davon. Eine zweite
 * Abschrift wäre genau die, die beim nächsten Umbau auseinanderläuft, und der Vergleich EN gegen
 * DE verglich dann zwei verschiedene Messungen statt zwei Sprachen.
 */
const MEHR_LESEN = `() => {
  const els = [...document.querySelectorAll('[data-bib-abschnitt]')];
  return {
    abschnitte: els.map((e) => e.getAttribute('data-bib-abschnitt')),
    texte: els.map((e) => (e.innerText || '').replace(/\\s+/g, ' ')),
  };
}`;

interface MehrLesung {
  abschnitte: string[];
  texte: string[];
}

/** Die EINE Lesung der „Mehr"-Fläche: `beforeAll` nimmt sie auf Deutsch, F20 auf Englisch. */
async function mehrLesen(): Promise<MehrLesung> {
  return await (stand as H4Stand).seite.evaluate<MehrLesung>(fn(MEHR_LESEN));
}

/**
 * Ein Aufräumschritt, der den eigentlichen Befund nicht überschreibt.
 *
 * Scheitert die Wiederherstellung selbst, wäre ihr Wurf das Letzte, was Vitest sieht — und der
 * wirkliche Grund (die Messung davor) verschwände. Er wird deshalb gemeldet und nicht geworfen;
 * sichtbar wird er dann ohnehin an den Fällen darunter, die auf denselben Stand schauen.
 */
async function aufraeumen(fall: string, schritt: () => Promise<void>): Promise<void> {
  try {
    await schritt();
  } catch (e) {
    console.warn(`JOB 3576 · ${fall}: Wiederherstellung gescheitert — ${String(e).split("\n")[0]}`);
  }
}

describe("JOB 3063 · H4 · Funktionsinventar — jede Funktion an ihrem neuen Ort, in Chromium geöffnet", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@job3063-c.test");
      // JOB 3585 · DIE SPRACHE WIRD HIER GESETZT, BEVOR IRGENDEIN FALL EINE BESCHRIFTUNG LIEST.
      //
      // CODEX ZU JOB 3489 (`archiv/3489/runde-1/ben.md:29`, Prüflücke b) hat das für F08 gesagt;
      // es galt für die ganze Datei. JOB 3576 hat es für F08 behoben und den Rest ausdrücklich
      // liegen gelassen (`archiv/3576/runde-1/RUECKGABE.md:65`).
      //
      // GEMESSEN AM BASISSTAND `9b70025` (Lieferung 1 dieses Auftrags): in der Seite stand
      // `{"lang":"de","gespeichert":null,"navigator":"en-US"}` — die Fläche sprach Deutsch, weil
      // `STANDARD_SPRACHE = "de"` (`apps/web/src/lib/sprachwahl.ts:26`) gilt, wenn niemand gewählt
      // hat; der Browser dieser Bühne spricht Englisch. Setzt man `kw.sprache="en"` von aussen
      // vor, werden 28 der 51 Fälle rot (`28 failed | 22 passed | 1 skipped`) — eine Datei, die
      // 28 rote Fälle bekommt, weil jemand die Sprache der UMGEBUNG ändert, misst die Umgebung
      // und nicht das Produkt. Mit dieser einen Zeile übersteht sie denselben Angriff.
      //
      // DIE DREI WARTESCHRITTE DANACH sind nicht Vorsicht, sondern Pflicht: `spracheSetzen` lädt
      // neu und kommt zurück, sobald `<html lang>` und die Ortszeile stehen — die Liste und die
      // Lesespalte holen ihre Daten in zwei weiteren Zügen (`h4-harness.ts:316-326`). Ohne sie
      // läse F17 in eine halb gezeichnete Fläche.
      await spracheSetzen(stand, "de");
      await stand.seite.waitForFunction(
        fn(
          `() => !!document.querySelector('[data-testid="bib-zeile"]') && !!document.querySelector('[data-testid="bib-titel"]')`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      listenMenue = await menue("bib-liste-menue");
      filterMenue = await menue("bib-menue-filter");
      bereichMenue = await menue("bib-menue-bereich");
      eintragMenue = await menue("bib-eintrag-menue");
      // „Mehr" aufklappen und die dreizehn Abschnitte samt ihrer Inhalte lesen.
      await mehrAufklappen();
      mehr = await mehrLesen();
      console.info(
        `JOB 3063 H4 · Inventar · Liste ${JSON.stringify(listenMenue)} · Filter ${JSON.stringify(filterMenue)} · Bereich ${JSON.stringify(bereichMenue)} · Eintrag ${JSON.stringify(eintragMenue)} · Mehr ${JSON.stringify(mehr?.abschnitte)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  const alles = (m: MenueInhalt | null): string[] => [
    ...(m?.gruppen ?? []),
    ...(m?.eintraege ?? []),
  ];

  it("F00 · die Fläche steht (sonst sagt jeder Fall unten nichts)", () => {
    expect(fehler).toBeNull();
    expect(alles(listenMenue).length).toBeGreaterThan(0);
    expect(alles(filterMenue).length).toBeGreaterThan(0);
    expect(mehr?.abschnitte.length).toBe(13);
  });

  it("F01 · Volltextsuche — Suchfeld oben links", async () => {
    expect(fehler).toBeNull();
    const da = await (stand as H4Stand).seite.evaluate<boolean>(
      fn(`() => !!document.querySelector('input[data-testid="bib-suche"][type="search"]')`),
    );
    expect(da).toBe(true);
  });

  it("F02 · Facette Status — Umschalter Alle · Validiert · Offen", async () => {
    expect(fehler).toBeNull();
    const texte = await (stand as H4Stand).seite.evaluate<string[]>(fn(SEGMENT_LESEN));
    expect(texte).toEqual(["Alle", "Validiert", "Offen"]);
  });

  it("F03 · Facette Abteilung/Bereich — Menü „Bereich“", () => {
    expect(fehler).toBeNull();
    expect(alles(bereichMenue).some((e) => e.startsWith("Konstruktion"))).toBe(true);
    expect(alles(bereichMenue).some((e) => e.startsWith("Produktion"))).toBe(true);
  });

  for (const [name, label] of [
    ["Reife", "Reife"],
    ["Schlagwort", "Schlagwort"],
    ["Vertraulichkeit", "Vertraulichkeit"],
    ["Autor", "Autor"],
    ["Herkunft", "Herkunft"],
    ["Wissensart", "Wissensart"],
    ["Sprache", "Sprache"],
    ["Alter", "Alter"],
    ["Vertrauen", "Vertrauen"],
  ] as const) {
    it(`F04 · Facette ${name} — Menü „Filter“ → Untermenü „${label}“`, () => {
      expect(fehler).toBeNull();
      expect(filterMenue?.gruppen.some((g) => g.startsWith(label))).toBe(true);
    });
  }

  it("F05 · Zeitraum „Zuletzt geändert“ — Menü „Filter“ → Untermenü mit zwei Datumsfeldern", async () => {
    expect(fehler).toBeNull();
    expect(filterMenue?.gruppen.some((g) => g.startsWith("Zuletzt geändert"))).toBe(true);
    await menueOeffnen("bib-menue-filter");
    const felder = await (stand as H4Stand).seite.evaluate<number>(
      fn(`() => {
        for (const d of document.querySelectorAll('[role="menu"] details')) d.open = true;
        return document.querySelectorAll('[role="menu"] input[type="date"]').length;
      }`),
    );
    await (stand as H4Stand).seite.evaluate(fn(MENUE_KLICK), "bib-menue-filter");
    expect(felder).toBe(2);
  });

  it("F06 · Sortierung (4 Ordnungen) — Menü „Filter“ → „Sortieren“", () => {
    expect(fehler).toBeNull();
    expect(filterMenue?.gruppen.some((g) => g.startsWith("Sortieren"))).toBe(true);
    for (const s of ["Relevanz", "Titel", "Vertrauen", "Zuletzt geändert"]) {
      expect(
        filterMenue?.eintraege.some((e) => e.includes(s)),
        `Sortierung fehlt: ${s}`,
      ).toBe(true);
    }
  });

  it("F07 · Untergruppen — Menü „Filter“ → „Untergruppen“", () => {
    expect(fehler).toBeNull();
    expect(filterMenue?.gruppen.some((g) => g.startsWith("Untergruppen"))).toBe(true);
    expect(filterMenue?.eintraege.some((e) => e === "keine")).toBe(true);
  });

  it("F08b · Geltungsbereich auch schmal auf der Seite — nie in ein Auswahlmenü gespart (R-19)", async () => {
    expect(fehler).toBeNull();
    // `NARROW_QUERY` = `(max-width: 899px)` (`shell/useMediaQuery.ts`) ist die Schwelle, an der die
    // Fläche im Haus umbaut. Genau dort muss die Angabe, WORIN gesucht wird, sichtbar bleiben —
    // sonst wäre sie auf kleinen Geräten die eine Auskunft, die man übersieht.
    const s = (stand as H4Stand).seite;
    await s.setViewportSize({ width: 640, height: 900 });
    await s.waitForTimeout(400);
    const schmal = await s.evaluate<{ sichtbar: boolean; knoepfe: number; selects: number }>(
      fn(`() => {
        const z = document.querySelector('[data-testid="library-scope-bar"]');
        const r = z ? z.getBoundingClientRect() : null;
        return {
          sichtbar: !!r && r.height > 0 && r.width > 0,
          knoepfe: z ? z.querySelectorAll('button[aria-pressed]').length : 0,
          selects: z ? z.querySelectorAll('select').length : 0,
        };
      }`),
    );
    await s.setViewportSize({ width: 1620, height: 900 });
    await s.waitForTimeout(400);
    // Das Zeichnen nach dem Breitenwechsel schliesst die aufgeklappten `details` wieder — die
    // Fälle darunter lesen dieselbe lebende Seite, also wird der Stand aus `beforeAll` hier
    // wiederhergestellt statt sie stillschweigend zugeklappt zurückzulassen.
    await mehrAufklappen();
    expect(schmal.sichtbar, "die Ortszeile verschwindet auf schmalen Geräten").toBe(true);
    expect(schmal.knoepfe).toBe(2);
    expect(schmal.selects).toBe(0);
  });

  it("F09 · Sichten speichern/laden/löschen — Menü „…“ der Liste", () => {
    expect(fehler).toBeNull();
    expect(alles(listenMenue).some((e) => e.startsWith("Sichten"))).toBe(true);
    // „Sicht speichern" erscheint nur, wenn es etwas zu merken gibt — genau wie bisher.
    expect(alles(listenMenue).some((e) => e.startsWith("Export"))).toBe(true);
  });

  for (const format of ["JSON", "Text (Markdown)", "MediaWiki", "HTML (Druck/PDF)"] as const) {
    it(`F10 · Export „${format}“ — Menü „…“ → „Export“`, () => {
      expect(fehler).toBeNull();
      expect(listenMenue?.eintraege.some((e) => e === format)).toBe(true);
    });
  }

  it("F11 · Re-Import (JSON) — Menü „…“ der Liste", () => {
    expect(fehler).toBeNull();
    expect(alles(listenMenue).some((e) => e.includes("Re-Import"))).toBe(true);
  });

  it("F12 · „Weitere N laden“ ist ersetzt: die Liste lädt beim Scrollen nach", async () => {
    expect(fehler).toBeNull();
    const befund = await (stand as H4Stand).seite.evaluate<{
      knopf: number;
      scrollbar: string;
    }>(
      fn(`() => {
        const liste = document.querySelector('[data-testid="bib-liste"]');
        const spur = [...liste.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto');
        return {
          knopf: [...document.querySelectorAll('button')].filter((b) => /Weitere \\d+ laden/.test(b.textContent || '')).length,
          scrollbar: spur ? 'ja' : 'nein',
        };
      }`),
    );
    expect(befund.knopf).toBe(0);
    expect(befund.scrollbar).toBe("ja");
  });

  for (const [name, treffer] of [
    ["Bearbeiten", "Bearbeiten"],
    ["Validieren", "Validieren"],
    ["Bedingt", "Bedingt"],
    ["Ablehnen", "Ablehnen"],
    ["Re-Validierung starten", "Re-Validierung starten"],
    ["Löschen", "Wissensobjekt löschen"],
  ] as const) {
    it(`F14 · ${name} — Menü „…“ am Eintrag`, () => {
      expect(fehler).toBeNull();
      expect(alles(eintragMenue).some((e) => e === treffer)).toBe(true);
    });
  }

  for (const abschnitt of [
    "konflikt",
    "quellen",
    "extern",
    "beitrag",
    "provenienz",
    "kopplung",
    "herkunftskette",
    "historie",
    "belege",
    "schnappschuesse",
    "kommentare",
    "anhaenge",
    "nachbarschaft",
  ] as const) {
    it(`F15 · Detailabschnitt „${abschnitt}“ — Zeile „Mehr“`, () => {
      expect(fehler).toBeNull();
      expect(mehr?.abschnitte).toContain(abschnitt);
    });
  }

  it("F16 · Funktionen IN den Abschnitten: Quelle anlegen, extern suchen, Beitrag melden, Stufe ändern, koppeln, kommentieren, Anhang hochladen, Konflikt melden", async () => {
    expect(fehler).toBeNull();
    const befund = await (stand as H4Stand).seite.evaluate<Record<string, number>>(
      fn(`() => {
        const abschnitt = (k) => document.querySelector('[data-bib-abschnitt="' + k + '"]');
        const knopf = (el, text) => el ? [...el.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === text).length : 0;
        return {
          quelleAnlegen: knopf(abschnitt('quellen'), 'Externe Quelle hinzufügen'),
          externSuchen: abschnitt('extern') ? abschnitt('extern').querySelectorAll('form input').length : 0,
          beitragMelden: abschnitt('beitrag') ? abschnitt('beitrag').querySelectorAll('textarea').length : 0,
          stufeAendern: abschnitt('provenienz') ? abschnitt('provenienz').querySelectorAll('select').length : 0,
          koppeln: abschnitt('kopplung') ? abschnitt('kopplung').querySelectorAll('input, button').length : 0,
          kommentieren: abschnitt('kommentare') ? abschnitt('kommentare').querySelectorAll('textarea').length : 0,
          anhang: abschnitt('anhaenge') ? abschnitt('anhaenge').querySelectorAll('input[type="file"]').length : 0,
          konfliktMelden: abschnitt('konflikt') ? abschnitt('konflikt').querySelectorAll('select, textarea').length : 0,
          kollisionImMehr: abschnitt('konflikt') ? abschnitt('konflikt').querySelectorAll('[data-testid="job3025-kollision"]').length : 0,
          kollisionInDerLesespalte: document.querySelectorAll('[data-testid="job3025-kollision"]').length,
        };
      }`),
    );
    console.info(`JOB 3063 H4 · Funktionen in den Abschnitten: ${JSON.stringify(befund)}`);
    expect(befund.quelleAnlegen).toBeGreaterThan(0);
    expect(befund.externSuchen).toBeGreaterThan(0);
    expect(befund.beitragMelden).toBeGreaterThan(0);
    expect(befund.stufeAendern).toBeGreaterThan(0);
    expect(befund.koppeln).toBeGreaterThan(0);
    expect(befund.kommentieren).toBeGreaterThan(0);
    expect(befund.anhang).toBeGreaterThan(0);
    expect(befund.konfliktMelden).toBeGreaterThan(0);
    // A27/JOB 3025/N5: die Auskunft an die Verfasserin am EIGENEN Objekt (hier ist Pedi der Autor).
    // JOB 3068 hat sie aus diesem Abschnitt in die LESESPALTE geholt — „dauerhaft" heißt ohne Klick.
    // Beide Zahlen zusammen sind der Beleg der Ablösung: hier keine, auf der Fläche genau eine.
    expect(befund.kollisionImMehr).toBe(0);
    expect(befund.kollisionInDerLesespalte).toBe(1);
  });

  it("F17 · Konfidenzbalken, Wissensart, Herkunftschip und Autorenzeile — in „Mehr“ (Belege bzw. Provenienz)", () => {
    expect(fehler).toBeNull();
    const belege = mehr?.texte[mehr.abschnitte.indexOf("belege")] ?? "";
    const provenienz = mehr?.texte[mehr.abschnitte.indexOf("provenienz")] ?? "";
    // Konfidenz: die %-Sprache der ConfidenceBar (mega34 C1) oder der nüchterne 0-Hinweis.
    expect(/%|Sicherheit/.test(belege), `Belege: ${belege}`).toBe(true);
    expect(provenienz.length, `Provenienz: ${provenienz}`).toBeGreaterThan(0);
    expect(/Best Practice|Praxis/i.test(provenienz), `Wissensart fehlt: ${provenienz}`).toBe(true);
    expect(/Pedi/.test(provenienz), `Autor fehlt: ${provenienz}`).toBe(true);
  });

  it("F18 · Leerzustand: EIN Satz plus Knopf „Erfassen“", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.evaluate(fn(SUCHE_SETZEN), LEERWORT);
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-leer"]')`),
      undefined,
      { timeout: 20_000 },
    );
    const leer = await s.evaluate<{ text: string; knopf: string }>(fn(LEER_LESEN));
    // JOB 3602, rein additiv: derselbe Leerzustand, den dieser Fall auf Deutsch festhält, ist der
    // Massstab für F21 in Englisch — aus DIESER Sitzung und DIESER Bühne, nicht aus einer zweiten
    // Abschrift. Keine der zwei Aussagen darunter ändert sich dadurch.
    leerDe = leer;
    expect(leer.text).toBe("Nichts gefunden.");
    expect(leer.knopf).toBe("Erfassen");
  }, 60_000);

  // ------------------------------------------------------------------------------------------
  // F08 · DER GELTUNGSBEREICH — UND ZWAR IN EINER SPRACHE, DIE DER FALL SELBST GESETZT HAT.
  // ------------------------------------------------------------------------------------------
  //
  // CODEX ZU JOB 3489 (`archiv/3489/runde-1/ben.md:29`, Prüflücke b): dieser Fall pinnte am
  // gebauten Produkt das deutsche Beschriftungspaar, „ohne je eine Sprache zu setzen — grün allein,
  // weil DE die Vorgabe ist; ein englischer Fall fehlt dort".
  //
  // DAS WAR NACHGEMESSEN RICHTIG (11.09., an dieser Bühne): `<html lang>` stand auf „de",
  // `localStorage["kw.sprache"]` war leer (null), und `navigator.language` sagte „en-US". Die Fläche
  // sprach Deutsch, weil das Produkt ohne gespeicherte Wahl Deutsch spricht (`lib/sprachwahl.ts:26`)
  // — der Fall mass also die Vorgabe der Umgebung, nicht die Übersetzung. Ein vorgesetztes
  // `kw.sprache="en"` machte ihn rot mit `expected [ 'My collection', 'All content' ] to deeply
  // equal [ 'Meine Ablage', 'Alle Inhalte' ]`.
  //
  // SEITDEM: F08 setzt DE selbst, F08c prüft dieselbe Zeile in EN, und die Sollwerte kommen aus
  // `tests/support/ortszeileWorte.ts` statt aus Literalen an drei Orten.
  //
  // WARUM DIESE BEIDEN FÄLLE AM ENDE DER DATEI STEHEN — dieselbe Hausregel wie für F13 unten: sie
  // LADEN DIE ANWENDUNG NEU (eine Sprachwahl gilt erst nach dem Neuladen, `lib/sprachwahl.ts:33`).
  // Alle Fälle davor messen an EINER stehenden Seite. Die erste Fassung stand noch hinter F08b und
  // stellte den Stand danach wieder her; das war MESSBAR nicht genug: die Abschnitte unter „Mehr"
  // sind React-gesteuert (`MehrAbschnitte.tsx:151-153`), und nach einem Neuladen zeichnet die
  // Fläche sekundenlang weiter und verwirft das von aussen gesetzte `open`. F16 las daraufhin in
  // ZWEI Torläufen alle acht Zahlen als 0 (Cloud-Läufe 2498545238f7b359ed5eadeb und
  // 45d6a1b96bc35678a4d5fb82), obwohl der Wiederherstellungsschritt „alle offen, Knotenzahl in
  // Ruhe" gemeldet hatte. Ein Wiederherstellen, das nur im Augenblick des Blicks stimmt, ist keine
  // Wiederherstellung — der Umzug ans Ende beseitigt die Frage, statt sie zu verwalten.
  interface OrtszeileBefund {
    da: boolean;
    label: string | null;
    knoepfe: string[];
    selects: number;
    vorDerSuche: boolean;
  }

  const ORTSZEILE_MESSEN = `() => {
    const zeile = document.querySelector('[data-testid="library-scope-bar"]');
    if (!zeile) return null;
    const suche = document.querySelector('#bib-suche');
    const gruppe = zeile.querySelector('fieldset');
    const knoepfe = [...zeile.querySelectorAll('button[aria-pressed]')];
    return {
      da: zeile.getBoundingClientRect().height > 0,
      label: gruppe ? gruppe.getAttribute('aria-label') : null,
      knoepfe: knoepfe.map((b) => (b.textContent || '').trim()),
      selects: zeile.querySelectorAll('select').length,
      vorDerSuche: !!suche && zeile.getBoundingClientRect().top < suche.getBoundingClientRect().top,
    };
  }`;

  it("F08 · Geltungsbereich (JOB 381) in ausdrücklich gesetztem DE — Ortszeile über dem Suchfeld", async () => {
    expect(fehler).toBeNull();
    // Der Geltungsbereich ist KEIN Filter, sondern der Bestand, auf den die Filter erst wirken —
    // deshalb steht er offen auf der Seite und nicht hinter einem Menü (`R-17`/`R-19` im
    // UI-Smoke). Ohne Klick, ohne Aufklappen: gemessen wird, was ein Mensch sofort sieht.
    await spracheSetzen(stand as H4Stand, "de");
    const befund = await (stand as H4Stand).seite.evaluate<OrtszeileBefund | null>(
      fn(ORTSZEILE_MESSEN),
    );
    expect(befund, "die Ortszeile [data-testid=library-scope-bar] fehlt").not.toBeNull();
    expect(befund?.da).toBe(true);
    expect(befund?.knoepfe).toEqual([ORTSZEILE_WORTE.de.meine, ORTSZEILE_WORTE.de.alle]);
    expect(befund?.selects, "der Umschalter ist nie ein Auswahlmenü").toBe(0);
    expect(befund?.vorDerSuche, "die Ortszeile steht nicht über dem Suchfeld").toBe(true);
    // Und er steht nicht ZUSÄTZLICH im Filtermenü — ein zweiter Ort für dieselbe Sache.
    expect(filterMenue?.gruppen.some((g) => g.startsWith(ORTSZEILE_WORTE.de.label))).toBe(false);
  }, 90_000);

  it("F08c · dieselbe Ortszeile in EN — die Fläche spricht die GESETZTE Sprache, nicht die Vorgabe", async () => {
    expect(fehler).toBeNull();
    // DER FALL, DEN CODEX VERLANGT HAT. Er misst dieselben Aussagen wie F08, nur in einer Sprache,
    // die hier ausdrücklich gewählt wird. Fällt eine der drei Übersetzungen wieder auf Deutsch
    // zurück — der Rückfall, den Codex am 09.09. LIVE gefunden hat —, trägt dieser rote Fall ihren
    // Namen, statt dass es erst bei einer Handprobe auffällt.
    const s = (stand as H4Stand).seite;
    let befund: OrtszeileBefund | null = null;
    let filterEn: MenueInhalt = { gruppen: [], eintraege: [] };
    let seitenfehler: string[] = [];
    try {
      await spracheSetzen(stand as H4Stand, "en");
      befund = await s.evaluate<OrtszeileBefund | null>(fn(ORTSZEILE_MESSEN));
      // „Nicht zusätzlich im Filtermenü" wird GEÖFFNET UND GELESEN, nicht aus einem leeren Selektor
      // geschlossen — und in EN gegen die englische Beschriftung, sonst prüfte der Satz nichts.
      filterEn = await menue("bib-menue-filter");
      seitenfehler = [...(stand as H4Stand).seitenfehler];
    } finally {
      // Die Sprache geht IMMER auf die Vorgabe zurück, auch wenn dieser Fall scheitert: der
      // F13-Block darunter liest deutsche Beschriftungen („Fragen", die Zustandspille). Die
      // aufgeklappten Abschnitte braucht hier niemand mehr — F16 und F17 sind längst gelaufen,
      // und F13 lädt ohnehin selbst neu.
      await aufraeumen("F08c", async () => {
        await spracheSetzen(stand as H4Stand, "de");
      });
    }
    expect(befund, "die Ortszeile [data-testid=library-scope-bar] fehlt in EN").not.toBeNull();
    expect(befund?.da).toBe(true);
    expect(befund?.knoepfe).toEqual([ORTSZEILE_WORTE.en.meine, ORTSZEILE_WORTE.en.alle]);
    expect(befund?.label, "der zugängliche Gruppenname ist nicht übersetzt").toBe(
      ORTSZEILE_WORTE.en.label,
    );
    expect(befund?.selects, "der Umschalter ist nie ein Auswahlmenü").toBe(0);
    expect(befund?.vorDerSuche, "die Ortszeile steht nicht über dem Suchfeld").toBe(true);
    expect(
      [...filterEn.gruppen, ...filterEn.eintraege].some((e) =>
        e.startsWith(ORTSZEILE_WORTE.en.label),
      ),
    ).toBe(false);
    expect(seitenfehler, "Chromium meldete beim Sprachwechsel einen Seitenfehler").toEqual([]);
  }, 120_000);

  // ------------------------------------------------------------------------------------------
  // F19 · DIE GEMESSENE LISTE: WELCHE BESCHRIFTUNG DER BIBLIOTHEK AUF ENGLISCH DEUTSCH BLEIBT.
  // ------------------------------------------------------------------------------------------
  //
  // WOZU ER DA IST. Seit dem `beforeAll` oben setzt diese Datei ihre Sprache selbst — sie misst
  // damit ehrlich, aber sie sähe immer noch nicht, ob die Fläche auf ENGLISCH auch wirklich
  // Englisch spricht. Genau das ist der Rückfall, den Codex am 09.09. für drei Beschriftungen des
  // Geltungsbereichs von Hand gefunden hat. F19 macht daraus eine Messung über die ganze Fläche:
  // dieselben Beschriftungen, die die Fälle oben auf Deutsch festhalten, dürfen in der englischen
  // Lesung NICHT mehr vorkommen — und wo sie es doch tun, steht es namentlich in der Liste unten.
  //
  // WARUM ER HIER STEHT UND NICHT WEITER OBEN: dieselbe Hausregel wie für F08/F08c und F13 — er
  // LÄDT DIE ANWENDUNG NEU (`spracheSetzen`). Alle Fälle davor messen an EINER stehenden Seite;
  // ein Neuladen mittendrin hat im Tor dreimal F16 zerstört (`archiv/3576/runde-1/RUECKGABE.md:64`).
  //
  // ER PRÜFT MIT DER REGEL DES URSPRUNGSFALLS. Jeder Sollwert trägt dieselbe Trefferart, mit der
  // ihn sein Fall oben prüft (`gleich`, `beginnt`, `enthaelt`). Die Frage, die F19 stellt, ist
  // dadurch scharf: „wäre die Behauptung dieses Falls in Englisch NOCH IMMER wahr?" — ist sie es,
  // ist die Beschriftung nicht übersetzt worden.

  /** Wie der Ursprungsfall vergleicht: `toBe`/`===`, `startsWith` oder `includes`. */
  type Trefferart = "gleich" | "beginnt" | "enthaelt";
  /**
   * Welcher Teil der Fläche gelesen wird.
   *
   * Die ersten fünf liest F19 (die vier Menüs und der Status-Umschalter). JOB 3602 nimmt die
   * Abschnitte unter „Mehr" (F20, je ein Teil `Mehr · <Kennung>`) und den Leerzustand (F21) dazu —
   * in DIESELBE Aufzählung und nicht in eine zweite daneben, damit Sollwerte, Ausnahmen, Kennung
   * und Meldung für alle Teile dieselben bleiben.
   */
  type Flaechenteil =
    | "Status-Umschalter"
    | "Liste"
    | "Filter"
    | "Bereich"
    | "Eintrag"
    | `Mehr · ${string}`
    | "Leerzustand";
  /** Ob der Fall die Untermenü-Titel liest, die Einträge, oder beides zusammen (`alles`). */
  type Lesestelle = "gruppen" | "eintraege" | "alles";

  interface Sollwert {
    /** Der Fall oben, der diese Beschriftung auf Deutsch festhält — für die Fehlermeldung. */
    fall: string;
    teil: Flaechenteil;
    wo: Lesestelle;
    wort: string;
    art: Trefferart;
  }

  /**
   * Die deutschen Beschriftungen, die die Fälle oben gegen die Fläche halten.
   *
   * ABGESCHRIEBEN AUS DEN FÄLLEN, und das ist Absicht: ein Sollwert, der zur Laufzeit aus `i18n`
   * käme, vergliche die Quelle mit sich selbst und wäre auch dann grün, wenn alles auf Deutsch
   * zurückfiele — dieselbe Begründung wie im Kopf von `tests/support/ortszeileWorte.ts`.
   * Dass die Abschrift nicht vergammeln kann, ist nicht gehofft, sondern geprüft: F19b hält jeden
   * Eintrag dieser Tabelle gegen die DEUTSCHE Lesung derselben Bühne.
   *
   * DIE MENGE IST GEMESSEN, nicht geschätzt: es sind genau die Fälle, die am Basisstand `9b70025`
   * mit von aussen vorgesetztem `kw.sprache="en"` rot wurden (Lieferung 1, `28 failed | 22 passed
   * | 1 skipped`), soweit ihre Beschriftungen in den vier Menüs oder im Status-Umschalter stehen.
   * NICHT hier stehen F16 (`Externe Quelle hinzufügen`), F17 und F18 (`Nichts gefunden.`,
   * `Erfassen`): sie lesen die Abschnitte unter „Mehr" bzw. den Leerzustand, nicht die Menüs.
   */
  const DEUTSCHE_SOLLWERTE: readonly Sollwert[] = [
    { fall: "F02", teil: "Status-Umschalter", wo: "eintraege", wort: "Alle", art: "gleich" },
    { fall: "F02", teil: "Status-Umschalter", wo: "eintraege", wort: "Validiert", art: "gleich" },
    { fall: "F02", teil: "Status-Umschalter", wo: "eintraege", wort: "Offen", art: "gleich" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Reife", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Schlagwort", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Vertraulichkeit", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Autor", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Herkunft", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Wissensart", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Sprache", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Alter", art: "beginnt" },
    { fall: "F04", teil: "Filter", wo: "gruppen", wort: "Vertrauen", art: "beginnt" },
    { fall: "F05", teil: "Filter", wo: "gruppen", wort: "Zuletzt geändert", art: "beginnt" },
    { fall: "F06", teil: "Filter", wo: "gruppen", wort: "Sortieren", art: "beginnt" },
    { fall: "F06", teil: "Filter", wo: "eintraege", wort: "Relevanz", art: "enthaelt" },
    { fall: "F06", teil: "Filter", wo: "eintraege", wort: "Titel", art: "enthaelt" },
    { fall: "F06", teil: "Filter", wo: "eintraege", wort: "Vertrauen", art: "enthaelt" },
    { fall: "F06", teil: "Filter", wo: "eintraege", wort: "Zuletzt geändert", art: "enthaelt" },
    { fall: "F07", teil: "Filter", wo: "gruppen", wort: "Untergruppen", art: "beginnt" },
    { fall: "F07", teil: "Filter", wo: "eintraege", wort: "keine", art: "gleich" },
    { fall: "F09", teil: "Liste", wo: "alles", wort: "Sichten", art: "beginnt" },
    { fall: "F09", teil: "Liste", wo: "alles", wort: "Export", art: "beginnt" },
    { fall: "F10", teil: "Liste", wo: "eintraege", wort: "JSON", art: "gleich" },
    { fall: "F10", teil: "Liste", wo: "eintraege", wort: "Text (Markdown)", art: "gleich" },
    { fall: "F10", teil: "Liste", wo: "eintraege", wort: "MediaWiki", art: "gleich" },
    { fall: "F10", teil: "Liste", wo: "eintraege", wort: "HTML (Druck/PDF)", art: "gleich" },
    { fall: "F11", teil: "Liste", wo: "alles", wort: "Re-Import", art: "enthaelt" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Bearbeiten", art: "gleich" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Validieren", art: "gleich" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Bedingt", art: "gleich" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Ablehnen", art: "gleich" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Re-Validierung starten", art: "gleich" },
    { fall: "F14", teil: "Eintrag", wo: "alles", wort: "Wissensobjekt löschen", art: "gleich" },

    // ----------------------------------------------------------------------------------------
    // JOB 3602 · DIE ABSCHNITTE UNTER „MEHR" UND DER LEERZUSTAND — die Stellen, die F19 NICHT
    // liest und die deshalb bis heute unbewacht waren (`archiv/3585/runde-1/RUECKGABE.md:94`).
    // ----------------------------------------------------------------------------------------
    //
    // WOHER DIE WÖRTER KOMMEN. Wo ein Fall oben die deutsche Beschriftung schon festhält, trägt
    // der Sollwert SEINEN Namen: F16 (`Externe Quelle hinzufügen`, `:399`), F17 (`Sicherheit`
    // bzw. `Best Practice`, `:433`/`:435`), F18 (`Nichts gefunden.`, `Erfassen`). Die übrigen
    // hält kein älterer Fall — sie tragen `F20`, weil DIESER Fall sie ab jetzt hält. Gegen das
    // Vergammeln schützt beide Arten derselbe Satz: F19b Satz 4 verlangt von JEDEM Sollwert, dass
    // er sich in der DEUTSCHEN Lesung derselben Bühne zeigt.
    //
    // ALLE SIND GEMESSEN, nicht aus dem Katalog geraten (Lieferung 1 dieses Auftrags, an der
    // laufenden Bühne): jedes Wort steht in der deutschen Lesung seines Abschnitts und fehlt in
    // der englischen. Beispiel `Mehr · belege`: DE „Belege › Sicherheit noch nicht bewertet …
    // Vertrauen 99 Reife Nutzbar … Output-Eignung ja IP-Sensitivität nicht bewertet", EN
    // „Evidence › Confidence not rated yet … Trust 99 Maturity Usable … Output eligibility yes
    // IP sensitivity not rated".
    //
    // WAS AUSDRÜCKLICH NICHT HIER STEHT — und warum. `Pedi` (F17 `:436`) und `Konstruktion`
    // (Provenienz, Herkunftskette) sind DATENWERTE: der Autor und die Abteilung des
    // Wissensobjekts, von einem Menschen eingegeben. Sie stehen in beiden Sprachen gleich da und
    // sollen es auch — sie zu übersetzen wäre der Fehler. Ein Sollwert daraus würde also einen
    // Rückfall melden, wo keiner ist. Dieselbe Begründung hat JOB 3585 für `Konstruktion · 1` und
    // `Produktion · 1` im Menü „Bereich" festgehalten (`archiv/3585/runde-1/RUECKGABE.md:66`).
    // Ebenso draussen bleibt der Fliesstext des Wissensobjekts selbst, der im Abschnitt
    // „Schnappschüsse" als Vorschau steht („Halterungen und Profile sind ohne waagerechte
    // Oberseiten …") — auch das ist Inhalt und keine Beschriftung.
    {
      fall: "F20",
      teil: "Mehr · quellen",
      wo: "eintraege",
      wort: "Quellen und Belege",
      art: "enthaelt",
    },
    {
      fall: "F16",
      teil: "Mehr · quellen",
      wo: "eintraege",
      wort: "Externe Quelle hinzufügen",
      art: "enthaelt",
    },
    { fall: "F17", teil: "Mehr · belege", wo: "eintraege", wort: "Sicherheit", art: "enthaelt" },
    { fall: "F20", teil: "Mehr · belege", wo: "eintraege", wort: "Vertrauen", art: "enthaelt" },
    { fall: "F20", teil: "Mehr · belege", wo: "eintraege", wort: "Reife", art: "enthaelt" },
    {
      fall: "F20",
      teil: "Mehr · belege",
      wo: "eintraege",
      wort: "Output-Eignung",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · belege",
      wo: "eintraege",
      wort: "IP-Sensitivität",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · provenienz",
      wo: "eintraege",
      wort: "Provenienz",
      art: "enthaelt",
    },
    {
      fall: "F17",
      teil: "Mehr · provenienz",
      wo: "eintraege",
      wort: "Best Practice",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · provenienz",
      wo: "eintraege",
      wort: "Vertraulichkeit",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · provenienz",
      wo: "eintraege",
      wort: "Streng vertraulich",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · provenienz",
      wo: "eintraege",
      wort: "Neuen Autor wählen",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · konflikt",
      wo: "eintraege",
      wort: "Konflikt eröffnen",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · kommentare",
      wo: "eintraege",
      wort: "Noch keine Kommentare.",
      art: "enthaelt",
    },
    {
      fall: "F20",
      teil: "Mehr · anhaenge",
      wo: "eintraege",
      wort: "Foto anhängen",
      art: "enthaelt",
    },
    { fall: "F20", teil: "Mehr · historie", wo: "eintraege", wort: "erstellt", art: "enthaelt" },
    {
      fall: "F20",
      teil: "Mehr · schnappschuesse",
      wo: "eintraege",
      wort: "erstellt",
      art: "enthaelt",
    },
    { fall: "F18", teil: "Leerzustand", wo: "eintraege", wort: "Nichts gefunden.", art: "gleich" },
    { fall: "F18", teil: "Leerzustand", wo: "eintraege", wort: "Erfassen", art: "gleich" },
  ];

  interface Ausnahme {
    teil: Flaechenteil;
    wort: string;
    /** Eine Zeile, warum dieser Eintrag hier steht — sonst ist die Liste eine Freistellung. */
    grund: string;
  }

  /**
   * AUSNAHMEART (i) — VON NATUR GLEICH. Eigennamen, Formatnamen und Lehnwörter, die in beiden
   * Sprachen dasselbe Wort sind. Hier ist NICHTS zu reparieren; wäre eines davon „übersetzt",
   * wäre das der Fehler.
   *
   * WAS DIE ZWEI ARTEN TRENNT, ist eine MESSUNG und kein Gefühl: führt der englische Katalog für
   * diese Beschriftung einen EIGENEN Eintrag, der zufällig gleich lautet, ist sie von Natur
   * gleich; fehlt der Eintrag und springt i18next auf Deutsch zurück, ist sie ein RÜCKFALL und
   * gehört in die Liste darunter. Jeder Eintrag hier nennt deshalb seine Fundstelle im Katalog.
   */
  const VON_NATUR_GLEICH: readonly Ausnahme[] = [
    {
      teil: "Liste",
      wort: "MediaWiki",
      grund:
        "Eigenname der Wiki-Software, in keiner Sprache übersetzt — eigener englischer Eintrag " +
        "`lib.format.mediawiki` (`apps/web/src/i18n.ts:8957`, de `:3673`).",
    },
    {
      teil: "Liste",
      wort: "JSON",
      grund:
        "Formatname, kein Wort einer Sprache — eigener englischer Eintrag `lib.format.json` " +
        "(`apps/web/src/i18n.ts:8955`, de `:3671`).",
    },
    {
      teil: "Liste",
      wort: "Text (Markdown)",
      grund:
        "„Text“ und „Markdown“ sind in DE und EN dasselbe Wort — eigener englischer Eintrag " +
        "`lib.format.markdown` (`apps/web/src/i18n.ts:8956`, de `:3672`).",
    },
    {
      teil: "Liste",
      wort: "Export",
      grund:
        "Lehnwort, in beiden Sprachen dasselbe — und NACHGEMESSEN kein Rückfall: der englische " +
        "Katalog führt `lib.export` mit einem EIGENEN Eintrag „Export“ (`apps/web/src/i18n.ts:8954`, " +
        "neben `:3670` de und `:13839` nl). Hier ist nichts durchgefallen, hier steht die " +
        "englische Übersetzung.",
    },
  ];

  /**
   * AUSNAHMEART (ii) — BEKANNTER RÜCKFALL. Eine Beschriftung, die auf Englisch GEMESSEN deutsch
   * bleibt. Jeder Eintrag hier ist ein Befund am Produkt, kein Freibrief: er wird gemeldet
   * (Rückgabe, Lieferung 6) und NICHT in dieser Runde repariert — der Auftrag fasst das Produkt
   * nicht an (§10). Verschwindet ein Rückfall, wird F19b rot und der Eintrag gehört gestrichen.
   */
  const BEKANNTER_RUECKFALL: readonly Ausnahme[] = [
    {
      teil: "Mehr · historie",
      wort: "erstellt",
      grund:
        "GEMESSENER RÜCKFALL (JOB 3602, Lieferung 1): die englische Historie liest " +
        "„v1 · 9/11/2026 erstellt“ — Datum englisch, der Vermerk deutsch. Er hat im Katalog " +
        "GAR KEINEN Eintrag: der Server schreibt ihn als deutsches Wort in den Datensatz " +
        '(`services/knowledge-object/src/service.ts:1816`, `history: [{ … note: "erstellt" }]`), ' +
        "die Fläche zeigt ihn wörtlich. Deshalb ist es kein Katalogfehler, den man in " +
        "`apps/web/src/i18n.ts` beheben könnte, und deshalb steht hier eine Fundstelle im Dienst " +
        "statt im Katalog. Gemeldet und NICHT repariert: das Produkt bleibt in dieser Runde " +
        "unberührt (§10), die Behebung ist eine eigene Zeile.",
    },
    {
      teil: "Mehr · schnappschuesse",
      wort: "erstellt",
      grund:
        "Derselbe Vermerk aus derselben Quelle, zweite Fundstelle: die Schnappschüsse tragen ihn " +
        "aus `services/knowledge-object/src/service.ts:1935` (`this.snapshot(ko, author, " +
        '"erstellt")`). Englisch gelesen: „Initial version — no previous diff. erstellt Open ' +
        "version“. Er steht als EIGENER Eintrag hier und nicht mit dem der Historie zusammen, " +
        "weil beide Abschnitte einzeln verschwinden können — wird einer übersetzt, soll F19b " +
        "genau diesen einen Eintrag als tot melden.",
    },
  ];

  const AUSNAHMEN: readonly Ausnahme[] = [...VON_NATUR_GLEICH, ...BEKANNTER_RUECKFALL];

  /** Der Schlüssel, unter dem Fund und Ausnahme dieselbe Beschriftung meinen. */
  const kennung = (teil: Flaechenteil, wort: string): string => `${teil} · „${wort}“`;

  const labelsVon = (inhalt: MenueInhalt, wo: Lesestelle): string[] =>
    wo === "gruppen" ? inhalt.gruppen : wo === "eintraege" ? inhalt.eintraege : alles(inhalt);

  const trifft = (label: string, s: Sollwert): boolean =>
    s.art === "gleich"
      ? label === s.wort
      : s.art === "beginnt"
        ? label.startsWith(s.wort)
        : label.includes(s.wort);

  /** Die Beschriftung, die den Sollwert trifft — oder `null`, wenn keine ihn trifft. */
  const treffer = (lesung: Map<Flaechenteil, MenueInhalt>, s: Sollwert): string | null =>
    labelsVon(lesung.get(s.teil) ?? { gruppen: [], eintraege: [] }, s.wo).find((l) =>
      trifft(l, s),
    ) ?? null;

  interface Fund {
    sollwert: Sollwert;
    gefunden: string;
  }

  /**
   * Ein Ausschnitt statt einer Textwand.
   *
   * Die Menüeinträge, die F19 liest, sind kurze Beschriftungen — sie stehen unverkürzt in der
   * Meldung, und zwar Zeichen für Zeichen so wie bisher. Ein Abschnitt unter „Mehr" ist dagegen
   * ein ganzer Absatz (gemessen: bis 640 Zeichen); dort wäre die ganze Lesung in der Meldung
   * keine Auskunft mehr, sondern eine Wand, in der der Fund untergeht. Gezeigt wird deshalb das
   * Fundstück mit seiner Umgebung — WELCHES Wort wo steht, bleibt lesbar (Lehre JOB 3573/3581).
   */
  const AUSSCHNITT = 120;
  const kurz = (label: string, wort: string): string => {
    if (label.length <= AUSSCHNITT) return label;
    const i = Math.max(0, label.indexOf(wort));
    const von = Math.max(0, i - 40);
    const bis = Math.min(label.length, i + wort.length + 40);
    return `${von > 0 ? "…" : ""}${label.slice(von, bis)}${bis < label.length ? "…" : ""}`;
  };

  /** Die EINE Meldung für einen deutschen Rückfall — F19, F20 und F21 melden gleich. */
  const meldung = (f: Fund): string =>
    `${f.sollwert.fall} · ${f.sollwert.teil}: erwartet eine ENGLISCHE Beschriftung, gefunden „${kurz(f.gefunden, f.sollwert.wort)}“ (die deutsche Beschriftung „${f.sollwert.wort}“ steht unübersetzt da)`;

  /** Eine „Mehr"-Lesung als Flächenteile — einmal für Deutsch (F18/`beforeAll`), einmal für F20. */
  const mehrAlsTeile = (lesung: MehrLesung): [Flaechenteil, MenueInhalt][] =>
    lesung.abschnitte.map((k, i): [Flaechenteil, MenueInhalt] => [
      `Mehr · ${k}`,
      { gruppen: [], eintraege: [lesung.texte[i] ?? ""] },
    ]);

  /** Der Leerzustand als Flächenteil — einmal aus F18 (Deutsch), einmal aus F21 (Englisch). */
  const leerAlsTeil = (leer: { text: string; knopf: string }): [Flaechenteil, MenueInhalt] => [
    "Leerzustand",
    { gruppen: [], eintraege: [leer.text, leer.knopf] },
  ];

  /** Die fünf Teile, die F19 selbst öffnet und liest. */
  const MENUE_TEILE: readonly Flaechenteil[] = [
    "Status-Umschalter",
    "Liste",
    "Filter",
    "Bereich",
    "Eintrag",
  ];

  /** Die Lesung der Fläche in Englisch — von F19/F20/F21 gefüllt, von F19b weiterbenutzt. */
  let lesungEn: Map<Flaechenteil, MenueInhalt> | null = null;
  /** Dieselbe Fläche in Deutsch, in DERSELBEN Sitzung gelesen — der Massstab für F19b. */
  let lesungDe: Map<Flaechenteil, MenueInhalt> | null = null;
  /** Was von den deutschen Sollwerten in der englischen Lesung stehen geblieben ist. */
  let deutschGeblieben: Fund[] | null = null;

  /**
   * Die Sollwerte GENANNTER Flächenteile gegen die englische Lesung halten.
   *
   * Der eine Weg, auf dem F19, F20 und F21 urteilen: die Funde wandern in `deutschGeblieben` —
   * die EINE Menge, aus der F19b danach seine Aussagen zieht —, zurück kommen die Meldungen, die
   * KEINE Ausnahme deckt. Ohne diesen gemeinsamen Schritt hätte jeder der drei Fälle seine eigene
   * Auswertung, und die Ausnahmeliste träfe je nach Fall eine andere Entscheidung.
   */
  const bewerten = (teile: readonly Flaechenteil[]): string[] => {
    const en = lesungEn as Map<Flaechenteil, MenueInhalt>;
    const bekannt = new Set(AUSNAHMEN.map((a) => kennung(a.teil, a.wort)));
    const funde = DEUTSCHE_SOLLWERTE.filter((s) => teile.includes(s.teil)).flatMap(
      (sollwert): Fund[] => {
        const gefunden = treffer(en, sollwert);
        return gefunden === null ? [] : [{ sollwert, gefunden }];
      },
    );
    deutschGeblieben = [...(deutschGeblieben ?? []), ...funde];
    return funde
      .filter((f) => !bekannt.has(kennung(f.sollwert.teil, f.sollwert.wort)))
      .map(meldung);
  };

  it("F19 · auf Englisch spricht die Bibliothek Englisch — ausser an den hier benannten Stellen", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    const bestand = async (): Promise<Map<Flaechenteil, MenueInhalt>> => {
      // Die Menüs werden WIRKLICH geöffnet und gelesen (die Regel aus F08c): ein Menü, das in
      // Englisch gar nicht aufgeht, darf nicht als „nichts Deutsches gefunden" durchgehen.
      const m = new Map<Flaechenteil, MenueInhalt>();
      m.set("Status-Umschalter", {
        gruppen: [],
        eintraege: await s.evaluate<string[]>(fn(SEGMENT_LESEN)),
      });
      m.set("Liste", await menue("bib-liste-menue"));
      m.set("Filter", await menue("bib-menue-filter"));
      m.set("Bereich", await menue("bib-menue-bereich"));
      m.set("Eintrag", await menue("bib-eintrag-menue"));
      return m;
    };
    let seitenfehler: string[] = [];
    try {
      // An dieser Stelle steht die Fläche auf Deutsch (F08c stellt sie in seinem `finally` her).
      // Der deutsche Massstab wird deshalb HIER genommen, aus derselben Sitzung und derselben
      // Bühne wie die englische Lesung gleich darauf — nicht aus einer zweiten Abschrift.
      lesungDe = await bestand();
      // JOB 3602 · DIE DEUTSCHE SEITE DER NEUEN TEILE, aus DERSELBEN Sitzung: die Abschnitte unter
      // „Mehr" hat `beforeAll` gelesen, den Leerzustand F18. Beide stehen hier und nicht erst in
      // F20/F21, damit F19b Satz 4 („jeder Sollwert zeigt sich in DEUTSCH") auch dann urteilen
      // kann, wenn F20 oder F21 scheitern — sonst sähe ein Ausfall dort wie eine veraltete
      // Prüfmenge aus.
      for (const [teil, inhalt] of mehrAlsTeile(mehr as MehrLesung)) {
        lesungDe.set(teil, inhalt);
      }
      if (leerDe !== null) {
        const [teil, inhalt] = leerAlsTeil(leerDe);
        lesungDe.set(teil, inhalt);
      }
      await spracheSetzen(stand as H4Stand, "en");
      await s.waitForFunction(
        fn(
          `() => !!document.querySelector('[data-testid="bib-zeile"]') && !!document.querySelector('[data-testid="bib-titel"]')`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      lesungEn = await bestand();
      seitenfehler = [...(stand as H4Stand).seitenfehler];
    } finally {
      // Die Sprache geht IMMER auf Deutsch zurück, auch wenn dieser Fall scheitert: der F13-Block
      // darunter liest deutsche Beschriftungen („Fragen", die Zustandspille).
      await aufraeumen("F19", async () => {
        await spracheSetzen(stand as H4Stand, "de");
      });
    }
    const en = lesungEn as Map<Flaechenteil, MenueInhalt>;
    const de = lesungDe as Map<Flaechenteil, MenueInhalt>;

    // ERFOLGREICH LEER IST NICHT ERFOLGREICH (§9). Eine leere englische Lesung würde jede
    // Aussage „nichts Deutsches mehr da" wertlos machen — sie ist deshalb ROT, und der
    // Vergleich mit der deutschen Lesung derselben Sitzung sagt, um wie viel sie danebenliegt.
    for (const [teil, inhalt] of en) {
      const soll = de.get(teil) as MenueInhalt;
      expect(
        `${teil}: ${inhalt.gruppen.length} Gruppen / ${inhalt.eintraege.length} Einträge`,
        `die englische Lesung von „${teil}“ deckt sich nicht mit der deutschen — EN ${JSON.stringify(alles(inhalt))} · DE ${JSON.stringify(alles(soll))}`,
      ).toBe(`${teil}: ${soll.gruppen.length} Gruppen / ${soll.eintraege.length} Einträge`);
      expect(alles(inhalt).length, `„${teil}“ ist in Englisch leer`).toBeGreaterThan(0);
    }

    // JEDE MELDUNG NENNT WELCHE Beschriftung in WELCHEM Menü — ein nackter Wahrheitswert oder
    // eine blosse Anzahl wäre keine Aussage (Lehre JOB 3573/3581). Seit JOB 3602 fällt das Urteil
    // im gemeinsamen `bewerten`, damit F20 und F21 nicht je eine eigene Auswertung bekommen.
    const offen = bewerten(MENUE_TEILE);
    console.info(
      `JOB 3585 F19 · englische Lesung: ${JSON.stringify(Object.fromEntries(en))} · auf Englisch deutsch geblieben: ${JSON.stringify(
        (deutschGeblieben as Fund[]).map((f) => kennung(f.sollwert.teil, f.sollwert.wort)),
      )}`,
    );
    expect(
      offen,
      "auf Englisch deutsch geblieben, ohne Eintrag in VON_NATUR_GLEICH oder BEKANNTER_RUECKFALL",
    ).toEqual([]);
    expect(seitenfehler, "Chromium meldete beim Sprachwechsel einen Seitenfehler").toEqual([]);
  }, 180_000);

  // ------------------------------------------------------------------------------------------
  // F20/F21 · DIESELBE FRAGE FÜR DIE STELLEN, DIE F19 NICHT SIEHT: „MEHR" UND DER LEERZUSTAND.
  // ------------------------------------------------------------------------------------------
  //
  // DER REST, DEN JOB 3585 SELBST BENANNT HAT (`archiv/3585/runde-1/RUECKGABE.md:94`): „F19 liest
  // die VIER MENÜS UND DEN STATUS-UMSCHALTER, nicht die ganze Fläche. Die Abschnitte unter ‚Mehr‘
  // (F16/F17) und der Leerzustand (F18) sind damit NICHT dauerhaft überwacht — sie sind in dieser
  // Runde einmal gemessen …, aber ein späterer Rückfall dort fiele F19 nicht auf."
  //
  // WARUM DAS EINE EIGENE RUNDE WERT WAR — die Gefahr ist echt und sie ist gemessen. Ein Fall, der
  // „Mehr" auf Englisch lesen will, muss die Abschnitte NACH dem Sprachwechsel wieder aufklappen;
  // genau daran ist JOB 3576 im Tor dreimal gescheitert (`archiv/3576/runde-1/RUECKGABE.md:64`).
  // Der Unterschied ist die Hausregel dieser Datei: dort stand der neu ladende Fall VOR F16, hier
  // steht er dahinter. Wenn F20 die Fläche anfasst, haben F16 und F17 ihren Schnappschuss aus
  // `beforeAll` längst gelesen — F20 kann ihnen nichts mehr nehmen.
  //
  // GEMESSEN AM BASISSTAND `4dfc4f0` (Lieferung 1 dieses Auftrags), damit hier nichts geglaubt
  // wird: unmittelbar nach `spracheSetzen(stand,"en")` stehen NULL `[data-bib-abschnitt]` in der
  // Seite und `bib-mehr` meldet `aria-expanded="false"` — der Sprachwechsel lädt neu, und die
  // Fläche kommt zugeklappt zurück. `mehrAufklappen()` geht danach ein zweites Mal und liefert
  // dieselben 13 Abschnitte wie auf Deutsch (2307 Zeichen EN gegen 2396 Zeichen DE). Nach der
  // Rückstellung auf Deutsch misst F16 unverändert `{"quelleAnlegen":1,"externSuchen":1,
  // "beitragMelden":1,"stufeAendern":2,"koppeln":2,"kommentieren":1,"anhang":1,
  // "konfliktMelden":2}` und der Leerzustand liest wieder „Nichts gefunden."/„Erfassen".
  //
  // WARUM F20 UND F21 IHRE SPRACHE JE SELBST SETZEN, statt die von F19 weiterzubenutzen: F19 geht
  // in seinem `finally` IMMER auf Deutsch zurück, auch wenn er scheitert — darauf verlassen sich
  // die deutschen Fälle darunter. Ein Fall, der auf die Sprache eines anderen Falls baut, wäre
  // grün oder rot je nachdem, ob der andere durchgelaufen ist; jeder setzt deshalb seine Lage
  // selbst her und gibt sie selbst zurück.

  it("F20 · auch die Abschnitte unter „Mehr“ sprechen auf Englisch Englisch", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    const de = mehr as MehrLesung;
    let en: MehrLesung | null = null;
    let seitenfehler: string[] = [];
    try {
      await spracheSetzen(stand as H4Stand, "en");
      await s.waitForFunction(
        fn(
          `() => !!document.querySelector('[data-testid="bib-zeile"]') && !!document.querySelector('[data-testid="bib-titel"]')`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      // DER SCHRITT, UM DEN ES GEHT. Ohne ihn liest der Fall eine zugeklappte Fläche — und die
      // Gegenprobe dazu ist Pflicht (Lieferung 5a): nimmt man diese Zeile heraus, ist F20 ROT,
      // nicht still grün.
      await mehrAufklappen();
      en = await mehrLesen();
      seitenfehler = [...(stand as H4Stand).seitenfehler];
    } finally {
      await aufraeumen("F20", async () => {
        await spracheSetzen(stand as H4Stand, "de");
      });
    }
    const gelesen = en as MehrLesung;
    lesungEn = lesungEn ?? new Map<Flaechenteil, MenueInhalt>();
    for (const [teil, inhalt] of mehrAlsTeile(gelesen)) {
      lesungEn.set(teil, inhalt);
    }

    // ERFOLGREICH LEER IST NICHT ERFOLGREICH (§9). Eine zugeklappte Fläche fände selbstverständlich
    // nichts Deutsches — sie hat ja gar nichts. Der Massstab ist die DEUTSCHE Lesung derselben
    // Sitzung und derselben Bühne (`beforeAll`, über denselben Leser `mehrLesen`), und die
    // Meldung sagt, um wie viel die englische danebenliegt.
    expect(
      `${gelesen.abschnitte.length} Abschnitte`,
      `die englische Lesung von „Mehr“ deckt sich nicht mit der deutschen — EN ${JSON.stringify(gelesen.abschnitte)} · DE ${JSON.stringify(de.abschnitte)}`,
    ).toBe(`${de.abschnitte.length} Abschnitte`);
    expect(
      gelesen.abschnitte,
      "in Englisch stehen andere Abschnitte unter „Mehr“ als in Deutsch",
    ).toEqual(de.abschnitte);
    expect(
      gelesen.abschnitte.filter((_, i) => (gelesen.texte[i] ?? "").length === 0),
      "Abschnitte, die in Englisch KEINEN Text haben — über sie ist nichts gesagt",
    ).toEqual([]);
    const zeichenEn = gelesen.texte.join(" ").length;
    const zeichenDe = de.texte.join(" ").length;
    console.info(
      `JOB 3602 F20 · „Mehr“ englisch: ${gelesen.abschnitte.length} Abschnitte / ${zeichenEn} Zeichen (deutsch: ${de.abschnitte.length} / ${zeichenDe}) · ${JSON.stringify(
        gelesen.abschnitte.map((k, i) => `${k}: ${gelesen.texte[i]}`),
      )}`,
    );
    // Eine englische Lesung, die auf einen Bruchteil der deutschen zusammenfällt, ist keine
    // Übersetzung, sondern eine halb gezeichnete Fläche. Die Hälfte ist die Grenze, unter der
    // Gemessenes nicht mehr trägt (gemessen: 2307 gegen 2396 Zeichen, also 96 %).
    expect(
      `${zeichenEn > zeichenDe / 2}`,
      `die englische Lesung von „Mehr“ ist verkümmert: ${zeichenEn} Zeichen gegen ${zeichenDe} in Deutsch`,
    ).toBe("true");

    expect(
      bewerten(mehrAlsTeile(gelesen).map(([teil]) => teil)),
      "in „Mehr“ auf Englisch deutsch geblieben, ohne Eintrag in VON_NATUR_GLEICH oder BEKANNTER_RUECKFALL",
    ).toEqual([]);
    expect(seitenfehler, "Chromium meldete beim Sprachwechsel einen Seitenfehler").toEqual([]);
  }, 180_000);

  it("F21 · auch der Leerzustand der Suche spricht auf Englisch Englisch", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    let leerEn: { text: string; knopf: string } | null = null;
    let seitenfehler: string[] = [];
    try {
      await spracheSetzen(stand as H4Stand, "en");
      await s.waitForFunction(
        fn(
          `() => !!document.querySelector('[data-testid="bib-zeile"]') && !!document.querySelector('[data-testid="bib-titel"]')`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      // DERSELBE WEG, DEN F18 FÄHRT (`:442-461`), nur in Englisch: ein Suchwort, das nichts
      // findet, und dann der Satz und der Knopf, die dastehen.
      await s.evaluate(fn(SUCHE_SETZEN), LEERWORT);
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="bib-leer"]')`),
        undefined,
        { timeout: 20_000 },
      );
      leerEn = await s.evaluate<{ text: string; knopf: string }>(fn(LEER_LESEN));
      seitenfehler = [...(stand as H4Stand).seitenfehler];
    } finally {
      // ZWEI DINGE GEHEN ZURÜCK, nicht eines: das Suchfeld und die Sprache. Bliebe das Suchwort
      // stehen, fänden die Fälle darunter eine leere Liste vor, die sie nie gesetzt haben.
      await aufraeumen("F21 · Suchfeld", async () => {
        await s.evaluate(fn(SUCHE_SETZEN), "");
        await s.waitForFunction(
          fn(`() => !document.querySelector('[data-testid="bib-leer"]')`),
          undefined,
          { timeout: 20_000 },
        );
      });
      await aufraeumen("F21", async () => {
        await spracheSetzen(stand as H4Stand, "de");
      });
    }
    const gelesen = leerEn as { text: string; knopf: string };
    lesungEn = lesungEn ?? new Map<Flaechenteil, MenueInhalt>();
    const [teil, inhalt] = leerAlsTeil(gelesen);
    lesungEn.set(teil, inhalt);
    console.info(`JOB 3602 F21 · Leerzustand englisch: ${JSON.stringify(gelesen)}`);

    // ERFOLGREICH LEER IST NICHT ERFOLGREICH (§9): ein Leerzustand ohne Satz oder ohne Knopf ist
    // keine Übersetzung, sondern eine nicht fertig gezeichnete Fläche.
    expect(gelesen.text.length, "der Leerzustand hat in Englisch keinen Satz").toBeGreaterThan(0);
    expect(gelesen.knopf.length, "der Leerzustand hat in Englisch keinen Knopf").toBeGreaterThan(0);
    expect(
      bewerten(["Leerzustand"]),
      "im Leerzustand auf Englisch deutsch geblieben, ohne Eintrag in VON_NATUR_GLEICH oder BEKANNTER_RUECKFALL",
    ).toEqual([]);
    expect(seitenfehler, "Chromium meldete beim Sprachwechsel einen Seitenfehler").toEqual([]);
  }, 180_000);

  it("F19b · die Ausnahmeliste kann nicht vergammeln — jeder Eintrag muss sich noch zeigen", () => {
    // KEIN SCHEINBELEG (Lehre JOB 3578 R1): geprüft wird gegen das, was F19, F20 und F21 WIRKLICH
    // aus der Fläche gelesen haben, nicht gegen eine zweite Abschrift der Liste. Ist einer von
    // ihnen nicht bis zur Lesung gekommen, sagt dieser Fall das — statt still grün zu sein.
    //
    // WARUM ER SEIT JOB 3602 HINTER F20/F21 STEHT statt unmittelbar hinter F19: er urteilt über
    // die Ausnahmeliste als GANZE, und die deckt seit dieser Runde auch „Mehr" und den
    // Leerzustand ab. Stünde er davor, wären die dortigen Einträge bei jedem Lauf „tot" — nicht
    // weil sie erledigt sind, sondern weil ihre Lesung noch gar nicht stattgefunden hat.
    expect(
      deutschGeblieben,
      "F19/F20/F21 haben nichts gelesen — dieser Fall sagt allein nichts",
    ).not.toBeNull();
    const en = lesungEn as Map<Flaechenteil, MenueInhalt> | null;
    expect(en, "die englische Lesung fehlt — dieser Fall sagt allein nichts").not.toBeNull();
    // UND ZWAR VOLLSTÄNDIG: fehlt ein Flächenteil in der englischen Lesung, sind seine Sollwerte
    // „nicht gefunden" und seine Ausnahmen sähen „tot" aus. Das wäre eine Aussage über einen
    // ausgefallenen Fall, nicht über das Produkt — deshalb steht hier der Teil beim Namen.
    expect(
      [...new Set(DEUTSCHE_SOLLWERTE.map((sollwert) => sollwert.teil))].filter(
        (t) => !(en as Map<Flaechenteil, MenueInhalt>).has(t),
      ),
      "Flächenteile, die in ENGLISCH gar nicht gelesen wurden",
    ).toEqual([]);
    const gefunden = new Set(
      (deutschGeblieben as Fund[]).map((f) => kennung(f.sollwert.teil, f.sollwert.wort)),
    );

    // (1) Ein Eintrag, der sich nicht mehr zeigt, ist erledigt — und gehört gestrichen, nicht
    // stehen gelassen. Sonst wüchse die Liste zu einer Sammlung von Behauptungen ohne Befund.
    expect(
      AUSNAHMEN.filter((a) => !gefunden.has(kennung(a.teil, a.wort))).map(
        (a) =>
          `${kennung(a.teil, a.wort)} steht in der Ausnahmeliste, kommt in der englischen Lesung aber NICHT mehr vor — übersetzt, Eintrag streichen (Grund war: ${a.grund})`,
      ),
      "tote Einträge in der Ausnahmeliste",
    ).toEqual([]);

    // (2) Und umgekehrt: ein neuer Rückfall darf sich nicht lautlos dazustellen.
    const bekannt = new Set(AUSNAHMEN.map((a) => kennung(a.teil, a.wort)));
    expect(
      [...gefunden].filter((k) => !bekannt.has(k)),
      "gemessener deutscher Rückfall ohne Eintrag in der Ausnahmeliste",
    ).toEqual([]);

    // (3) Die zwei Ausnahmearten werden getrennt geführt — dieselbe Beschriftung kann nicht
    // „von Natur gleich" UND „bekannter Rückfall" sein. Ohne diesen Satz verschwände ein
    // deutscher Rückfall, indem ihn jemand in die harmlose Liste schreibt.
    const naturgleich = new Set(VON_NATUR_GLEICH.map((a) => kennung(a.teil, a.wort)));
    expect(
      BEKANNTER_RUECKFALL.map((a) => kennung(a.teil, a.wort)).filter((k) => naturgleich.has(k)),
      "dieselbe Beschriftung steht in beiden Ausnahmearten",
    ).toEqual([]);
    for (const a of AUSNAHMEN) {
      expect(a.grund.length, `${kennung(a.teil, a.wort)} hat keine Begründung`).toBeGreaterThan(20);
    }

    // (4) DIE PRÜFMENGE SELBST TRÄGT (das Muster aus JOB 3576 Fall 11): jeder deutsche Sollwert
    // muss sich in der DEUTSCHEN Lesung derselben Bühne zeigen. Wird eine Beschriftung im Produkt
    // umbenannt und diese Tabelle nicht nachgezogen, prüfte F19 sonst ein Wort, das es nicht mehr
    // gibt — und wäre grün, ohne etwas zu decken.
    const de = lesungDe as Map<Flaechenteil, MenueInhalt> | null;
    expect(de, "F19 hat die deutsche Lesung nicht hergestellt").not.toBeNull();
    expect(
      [...new Set(DEUTSCHE_SOLLWERTE.map((sollwert) => sollwert.teil))].filter(
        (t) => !(de as Map<Flaechenteil, MenueInhalt>).has(t),
      ),
      "Flächenteile, die in DEUTSCH gar nicht gelesen wurden",
    ).toEqual([]);
    expect(
      DEUTSCHE_SOLLWERTE.filter(
        (sollwert) => treffer(de as Map<Flaechenteil, MenueInhalt>, sollwert) === null,
      ).map(
        (sollwert) =>
          `${sollwert.fall} · ${kennung(sollwert.teil, sollwert.wort)} steht in DEUTSCH nicht auf der Fläche — die Prüfmenge von F19 ist veraltet`,
      ),
      "veraltete Sollwerte",
    ).toEqual([]);
  });

  // ------------------------------------------------------------------------------------------
  // F13 · DIE VERBINDLICHE AKTION DER LESEFLÄCHE — FÜR JEDEN EINTRAG DIESELBE.
  // ------------------------------------------------------------------------------------------
  //
  // CODEX AN RUNDE 4: „Für jeden ausgewählten Eintrag muss die sichtbare Aktion ‚Fragen‘ heißen und
  // einen `/fragen`-Link mit `ko=<ausgewählte ID>` sowie dem aktuellen Suchtext als Vorbelegung
  // erzeugen." Bis dahin kam der Knopf aus `libraryUseCta` und schickte alles, was nicht validiert
  // war, unter der Beschriftung „Prüfen" nach `/validierung`.
  //
  // WARUM DIESER FALL AM ENDE DER DATEI STEHT: er fährt echte Deep-Links (`goto`) und lädt die
  // Anwendung dabei neu. Alle Fälle davor messen an EINER stehenden Seite und dürfen davon nichts
  // merken.
  //
  // WARUM ZWEI ZUSTÄNDE HIER UND DER DRITTE WOANDERS — gemessen, nicht angenommen: Über die echte
  // Schnittstelle sind auf dieser Fläche genau ZWEI Anzeigezustände erreichbar, „validiert" und
  // „offen". `KnowledgeObject.assignments` — das einzige Feld, aus dem `deriveStatus` „in Prüfung"
  // ableitet — wird bei der Anlage einmalig auf `[]` gesetzt und von KEINEM Schreibweg des Produkts
  // je geändert (`services/knowledge-object/src/service.ts:1644`, ausdrücklich festgehalten in
  // `services/app/src/routes/ko-routes.ts:581-584`); die echten Zuweisungen liegen im
  // `AssignmentRepo` und reisen nicht am Objekt mit. Ein „in Prüfung"-Eintrag im Bestand wäre hier
  // also ein Requisit, das die Schnittstelle nie liefert. Der dritte Zustand wird deshalb dort
  // gemessen, wo er entstehen KANN — an der gemounteten Fläche mit gesetztem `assignments`:
  // `tests/library/h4-fragen-vertrag-mounted.test.tsx`. Beide Fälle prüfen denselben Vertrag.
  const SUCHTEXT = "Spritzzone reinigen";

  interface FragenBefund {
    text: string;
    pfad: string;
    ko: string | null;
    q: string | null;
    pille: string;
  }

  /** Den Eintrag als Deep-Link mit Suchtext öffnen und den Knopf „Fragen" auslesen. */
  async function fragenKnopf(koIdent: string): Promise<FragenBefund> {
    const s = (stand as H4Stand).seite;
    await s.goto(`${ORIGIN}/wissen/${koIdent}?q=${encodeURIComponent(SUCHTEXT)}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await s.waitForFunction(
      fn(
        `(id) => location.pathname === '/wissen/' + id && !!document.querySelector('[data-testid="bib-fragen"]') && !!document.querySelector('[data-testid="bib-pille"]')`,
      ),
      koIdent,
      { timeout: 30_000 },
    );
    const befund = await s.evaluate<FragenBefund | null>(
      fn(`() => {
        const a = document.querySelector('[data-testid="bib-fragen"]');
        const href = a.getAttribute('href');
        if (href === null) return { text: a.textContent.trim(), pfad: '(kein Link)', ko: null, q: null, pille: '' };
        const u = new URL(href, location.origin);
        return {
          text: a.textContent.trim(),
          pfad: u.pathname,
          ko: u.searchParams.get('ko'),
          q: u.searchParams.get('q'),
          pille: document.querySelector('[data-testid="bib-pille"]').textContent.trim(),
        };
      }`),
    );
    if (befund === null) {
      throw new Error(`Knopf „Fragen" fehlt am Eintrag ${koIdent}`);
    }
    return befund;
  }

  it("F13 · „Fragen“ am FREIGEGEBENEN Eintrag: /fragen mit ko=<id> und dem Suchtext", async () => {
    expect(fehler).toBeNull();
    const b = await fragenKnopf((stand as H4Stand).koId);
    console.info(`JOB 3063 H4 · F13 validiert: ${JSON.stringify(b)}`);
    expect(b.text).toBe("Fragen");
    expect(b.pfad).toBe("/fragen");
    expect(b.ko).toBe((stand as H4Stand).koId);
    expect(b.q).toBe(SUCHTEXT);
  }, 90_000);

  it("F13 · „Fragen“ am OFFENEN Eintrag: derselbe Vertrag, kein Abzweig nach /validierung", async () => {
    expect(fehler).toBeNull();
    const frei = await fragenKnopf((stand as H4Stand).koId);
    const offen = await fragenKnopf((stand as H4Stand).koOffenId);
    console.info(`JOB 3063 H4 · F13 offen: ${JSON.stringify(offen)}`);
    expect(offen.text).toBe("Fragen");
    expect(offen.pfad).toBe("/fragen");
    expect(offen.ko).toBe((stand as H4Stand).koOffenId);
    expect(offen.q).toBe(SUCHTEXT);
    // Der Beleg, dass hier wirklich ZWEI verschiedene Zustände gemessen wurden: die Pille
    // unterscheidet sie. Ohne diese Zeile wäre der Fall auch dann grün, wenn beide Adressen
    // dasselbe validierte Objekt zeigten.
    expect(offen.pille).not.toBe(frei.pille);
  }, 120_000);
});

describe.runIf(!existsSync(MOCKUP))("JOB 3063 · Funktionsinventar übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
