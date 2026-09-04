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
import { type H4Stand, MOCKUP, ORIGIN, fn, h4Stand } from "./h4-harness";

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
let mehr: { abschnitte: string[]; texte: string[] } | null = null;

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

describe("JOB 3063 · H4 · Funktionsinventar — jede Funktion an ihrem neuen Ort, in Chromium geöffnet", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@job3063-c.test");
      listenMenue = await menue("bib-liste-menue");
      filterMenue = await menue("bib-menue-filter");
      bereichMenue = await menue("bib-menue-bereich");
      eintragMenue = await menue("bib-eintrag-menue");
      // „Mehr" aufklappen und die dreizehn Abschnitte samt ihrer Inhalte lesen.
      await stand.seite.evaluate(
        fn(
          `() => { const b = document.querySelector('[data-testid="bib-mehr"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }`,
        ),
      );
      await stand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-bib-abschnitt]').length > 0`),
        undefined,
        { timeout: 20_000 },
      );
      // Jeder Abschnitt zeichnet seinen Inhalt ERST beim Aufklappen (`MehrAbschnitte`) — deshalb
      // erst öffnen, dann warten, dann lesen. In einem Zug gelesen stünde überall nur der Titel.
      await stand.seite.evaluate(
        fn(
          `() => { for (const d of document.querySelectorAll('[data-bib-abschnitt]')) d.open = true; }`,
        ),
      );
      await stand.seite.waitForTimeout(2500);
      mehr = await stand.seite.evaluate<{ abschnitte: string[]; texte: string[] }>(
        fn(`() => {
          const els = [...document.querySelectorAll('[data-bib-abschnitt]')];
          return {
            abschnitte: els.map((e) => e.getAttribute('data-bib-abschnitt')),
            texte: els.map((e) => (e.innerText || '').replace(/\\s+/g, ' ')),
          };
        }`),
      );
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
    const texte = await (stand as H4Stand).seite.evaluate<string[]>(
      fn(
        `() => [...document.querySelectorAll('[data-testid="bib-segment"] button')].map((b) => b.textContent.trim())`,
      ),
    );
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

  it("F08 · Geltungsbereich (JOB 381: Meine Ablage · Alle Inhalte) — Ortszeile über dem Suchfeld", async () => {
    expect(fehler).toBeNull();
    // Der Geltungsbereich ist KEIN Filter, sondern der Bestand, auf den die Filter erst wirken —
    // deshalb steht er offen auf der Seite und nicht hinter einem Menü (`R-17`/`R-19` im
    // UI-Smoke). Ohne Klick, ohne Aufklappen: gemessen wird, was ein Mensch sofort sieht.
    const befund = await (stand as H4Stand).seite.evaluate<{
      da: boolean;
      knoepfe: string[];
      selects: number;
      vorDerSuche: boolean;
    } | null>(
      fn(`() => {
        const zeile = document.querySelector('[data-testid="library-scope-bar"]');
        if (!zeile) return null;
        const suche = document.querySelector('#bib-suche');
        const knoepfe = [...zeile.querySelectorAll('button[aria-pressed]')];
        return {
          da: zeile.getBoundingClientRect().height > 0,
          knoepfe: knoepfe.map((b) => (b.textContent || '').trim()),
          selects: zeile.querySelectorAll('select').length,
          vorDerSuche: !!suche && zeile.getBoundingClientRect().top < suche.getBoundingClientRect().top,
        };
      }`),
    );
    expect(befund, "die Ortszeile [data-testid=library-scope-bar] fehlt").not.toBeNull();
    expect(befund?.da).toBe(true);
    expect(befund?.knoepfe).toEqual(["Meine Ablage", "Alle Inhalte"]);
    expect(befund?.selects, "der Umschalter ist nie ein Auswahlmenü").toBe(0);
    expect(befund?.vorDerSuche, "die Ortszeile steht nicht über dem Suchfeld").toBe(true);
    // Und er steht nicht ZUSÄTZLICH im Filtermenü — ein zweiter Ort für dieselbe Sache.
    expect(filterMenue?.gruppen.some((g) => g.startsWith("Geltungsbereich"))).toBe(false);
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
          kollision: abschnitt('konflikt') ? abschnitt('konflikt').querySelectorAll('[data-testid="job3025-kollision"]').length : 0,
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
    // A27/JOB 3025: die Auskunft an die Verfasserin am EIGENEN Objekt (hier ist Pedi der Autor).
    expect(befund.kollision).toBe(1);
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
    await s.evaluate(
      fn(`() => {
        const feld = document.querySelector('[data-testid="bib-suche"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(feld, 'zzz-nichts-findet-das-xyz');
        feld.dispatchEvent(new Event('input', { bubbles: true }));
      }`),
    );
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-leer"]')`),
      undefined,
      { timeout: 20_000 },
    );
    const leer = await s.evaluate<{ text: string; knopf: string }>(
      fn(`() => {
        const el = document.querySelector('[data-testid="bib-leer"]');
        const k = document.querySelector('[data-testid="bib-leer-erfassen"]');
        return { text: el.querySelector('p').textContent.trim(), knopf: k ? k.textContent.trim() : '' };
      }`),
    );
    expect(leer.text).toBe("Nichts gefunden.");
    expect(leer.knopf).toBe("Erfassen");
  }, 60_000);

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
