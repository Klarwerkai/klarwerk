// ================================================================================================
// R-0891 / R-2074 / SOLL:NFR-UX-02 — DER AUTOMATISIERBARE TEIL DES WCAG-2.1-AA-AUDITS.
// ================================================================================================
//
// AUFTRAG: „WCAG 2.1 AA (Kontrast, Tastatur, Screenreader). AK: Accessibility-Audit." ben
// (nacharbeit-2) hat zu Recht beanstandet, dass Einzelprüfungen das Audit nicht ersetzen. Diese Datei
// fährt deshalb die Erfolgskriterien, die sich am ECHTEN Produkt maschinell entscheiden lassen, über
// die Kernflächen — Anmeldemaske, Start, Fragen, Bibliothek, Erfassen, Prüfen — im echten Chromium
// mit dem echten Server. Die Zuordnung ALLER 50 A/AA-Kriterien (gemessen hier, gemessen anderswo,
// nur menschlich entscheidbar, nicht anwendbar) steht in `docs/barrierefreiheit/WCAG-2.1-AA-AUDIT.md`.
//
// GEMESSEN WIRD, ausschliesslich aus der Rechnung des Browsers:
//   3.1.1  Sprache der Seite         — `html[lang]` ist de, en oder nl
//   2.4.2  Seitentitel               — `document.title` ist nicht leer
//   4.1.2  Name, Rolle, Wert         — jedes bedienbare Element im AX-Baum von Chromium (CDP) hat
//   1.1.1  Nicht-Text-Inhalt           einen nicht leeren zugänglichen Namen; ebenso jedes nicht
//   2.4.4  Linkzweck                   ignorierte Bild
//   3.3.2  Beschriftungen
//   4.1.1  Syntaxanalyse             — jede per aria-labelledby/-describedby/-controls oder `for`
//                                      referenzierte ID ist eindeutig; labelledby/for zeigen auf
//                                      eine vorhandene ID
//   1.4.3  Kontrast (Minimum)        — jeder sichtbare Textknoten: berechnete Textfarbe gegen die
//                                      zusammengesetzte Hintergrundfarbe der Vorfahrenkette, 4,5:1
//                                      bzw. 3:1 für großen Text (≥ 24 px oder ≥ 18,66 px fett)
//   2.1.1  Tastatur                  — der Tab-Weg erreicht bedienbare Elemente
//   2.1.2  Keine Tastaturfalle       — kein Element hält den Fokus über Tab UND Escape fest
//   2.4.7  Fokus sichtbar            — jedes per Tab erreichte Element zeigt einen Umriss oder Ring
//   1.4.10 Umbruch (Reflow)          — bei 320 CSS-px Breite kein waagerechtes Scrollen der Seite
//   2.4.1  Blöcke überspringen       — angemeldet: genau eine `main`-Landmarke (Technik ARIA11)
//
// AUSDRÜCKLICH NICHT GEMESSEN (und in der Auditdatei als offen geführt): ob ein Vorleseprogramm den
// Text hörbar ausgibt, ob Alternativtexte und Beschriftungen SINNVOLL sind, ob die Reihenfolge
// bedeutungstragend ist, Platzhaltertext (kein Textknoten), Nicht-Text-Kontrast (1.4.11), 200 %
// Textvergrößerung (1.4.4), Lesbarkeit mit Handschuhen und bei wechselndem Licht. Ein grüner Lauf
// dieser Datei ist kein vollständiges Audit — er ist dessen maschineller Teil.
//
// AUSNAHMEN NACH WCAG, nicht nach Bequemlichkeit: deaktivierte Bedienelemente (1.4.3 nimmt
// „inaktive Komponenten" aus) und unsichtbarer Text. Was der Browser nicht eindeutig rechnen kann
// (Hintergrundbild, durchscheinende Vorfahren, nicht lesbares Farbformat), wird GEZÄHLT und im
// Bericht ausgewiesen, nicht stillschweigend als bestanden gewertet.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn, workspaceMarker } from "./support/auth";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Der AX-Baum wird über das Chrome DevTools Protocol gelesen; Firefox und WebKit sprechen es nicht.",
);

/** Die angemeldeten Kernflächen. Die Anmeldemaske kommt in einem frischen Kontext dazu. */
const ROUTEN = ["/start", "/fragen", "/bibliothek", "/erfassen", "/validierung"] as const;

/** Rollen, die bedienbar sind und deshalb einen Namen brauchen (Chromium-Rollennamen). */
const BEDIENBAR = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "spinbutton",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "listbox",
]);
const BILD = new Set(["image", "img"]);

const TAB_SCHRITTE = 30;

interface Kontrastbericht {
  verstoesse: string[];
  gemessen: number;
  unbestimmt: number;
}

// ------------------------------------------------------------------------------------------------
// 1.4.3 — im Browser gerechnet: berechnete Farben, zusammengesetzte Hintergründe.
// ------------------------------------------------------------------------------------------------
function kontrastImBrowser(): Kontrastbericht {
  type Rgba = [number, number, number, number];
  const lies = (wert: string): Rgba | null => {
    const m = wert.match(/^rgba?\(([^)]+)\)$/);
    if (!m?.[1]) {
      return null;
    }
    const teile = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((t) => (t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : Number(t)));
    if (teile.length < 3 || teile.some((t) => Number.isNaN(t))) {
      return null;
    }
    return [teile[0] ?? 0, teile[1] ?? 0, teile[2] ?? 0, teile.length > 3 ? (teile[3] ?? 1) : 1];
  };
  const ueber = (oben: Rgba, unten: Rgba): Rgba => {
    const a = oben[3];
    return [
      oben[0] * a + unten[0] * (1 - a),
      oben[1] * a + unten[1] * (1 - a),
      oben[2] * a + unten[2] * (1 - a),
      1,
    ];
  };
  const kanal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const leucht = (f: Rgba): number =>
    0.2126 * kanal(f[0]) + 0.7152 * kanal(f[1]) + 0.0722 * kanal(f[2]);
  const verhaeltnis = (a: Rgba, b: Rgba): number => {
    const x = leucht(a);
    const y = leucht(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /** Der wirklich gemalte Hintergrund — oder null, wenn er nicht eindeutig zu rechnen ist. */
  const hintergrund = (start: Element): Rgba | null => {
    const schichten: Rgba[] = [];
    for (let el: Element | null = start; el; el = el.parentElement) {
      const stil = getComputedStyle(el);
      if (stil.backgroundImage !== "none") {
        return null;
      }
      const farbe = lies(stil.backgroundColor);
      if (!farbe) {
        return null;
      }
      if (farbe[3] > 0) {
        schichten.push(farbe);
      }
      if (farbe[3] >= 1) {
        break;
      }
    }
    // Ohne deckende Fläche malt der Browser auf Weiß (Leinwand).
    let ergebnis: Rgba = [255, 255, 255, 1];
    for (const schicht of schichten.reverse()) {
      ergebnis = ueber(schicht, ergebnis);
    }
    return ergebnis;
  };

  const bericht: Kontrastbericht = { verstoesse: [], gemessen: 0, unbestimmt: 0 };
  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let knoten = gang.nextNode(); knoten; knoten = gang.nextNode()) {
    const inhalt = (knoten.textContent ?? "").trim();
    const el = knoten.parentElement;
    if (!inhalt || !el || el.closest("svg, script, style, noscript, template")) {
      continue;
    }
    // Unsichtbarer Text ist nicht gemeint; 1-px-Flächen sind Vorlesetext (sr-only).
    const rechteck = el.getBoundingClientRect();
    const pruefbar = el as unknown as { checkVisibility(o: Record<string, boolean>): boolean };
    if (
      rechteck.width <= 1 ||
      rechteck.height <= 1 ||
      !pruefbar.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    ) {
      continue;
    }
    // WCAG 1.4.3: inaktive Bedienelemente sind ausgenommen.
    if (el.closest("[disabled], [aria-disabled='true']")) {
      continue;
    }
    // Durchscheinende Vorfahren ändern die gemalte Farbe auf eine Weise, die hier nicht gerechnet
    // wird — gezählt statt geraten.
    let deckkraft = 1;
    for (let v: Element | null = el; v; v = v.parentElement) {
      deckkraft *= Number(getComputedStyle(v).opacity);
    }
    const grund = hintergrund(el);
    const stil = getComputedStyle(el);
    const vorne = lies(stil.color);
    if (deckkraft < 1 || !grund || !vorne) {
      bericht.unbestimmt += 1;
      continue;
    }
    const text = vorne[3] < 1 ? ueber(vorne, grund) : vorne;
    const groesse = Number.parseFloat(stil.fontSize);
    const fett = Number.parseInt(stil.fontWeight, 10) >= 700;
    const soll = groesse >= 24 || (groesse >= 18.66 && fett) ? 3 : 4.5;
    const wert = verhaeltnis(text, grund);
    bericht.gemessen += 1;
    if (wert < soll) {
      const fmt = (f: Rgba): string => `rgb(${f.slice(0, 3).map(Math.round).join(",")})`;
      bericht.verstoesse.push(
        `„${inhalt.slice(0, 50)}“ ${fmt(text)} auf ${fmt(grund)} = ${wert.toFixed(2)}:1 (Soll ${soll}:1, ${groesse}px)`,
      );
    }
  }
  return bericht;
}

// ------------------------------------------------------------------------------------------------
// Die übrigen Messungen je Fläche.
// ------------------------------------------------------------------------------------------------
async function namenImAxBaum(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const ohneNamen: string[] = [];
  for (const knoten of nodes) {
    if (knoten.ignored) {
      continue;
    }
    const rolle = typeof knoten.role?.value === "string" ? knoten.role.value : "";
    if (!BEDIENBAR.has(rolle) && !BILD.has(rolle)) {
      continue;
    }
    const name = typeof knoten.name?.value === "string" ? knoten.name.value.trim() : "";
    if (!name) {
      ohneNamen.push(`${rolle} (backendDOMNodeId ${knoten.backendDOMNodeId ?? "?"})`);
    }
  }
  await cdp.detach();
  return ohneNamen;
}

async function idVerweise(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const befunde: string[] = [];
    const zaehle = (id: string): number =>
      document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length;
    const verweise: Array<{ attr: string; muss: boolean }> = [
      { attr: "aria-labelledby", muss: true },
      { attr: "aria-describedby", muss: false },
      { attr: "aria-controls", muss: false },
      { attr: "for", muss: true },
    ];
    for (const { attr, muss } of verweise) {
      for (const el of document.querySelectorAll(`[${attr}]`)) {
        for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
          const n = zaehle(id);
          if (n > 1) {
            befunde.push(`${attr}="${id}" ist ${n}-mal vergeben`);
          } else if (n === 0 && muss) {
            befunde.push(`${attr}="${id}" zeigt ins Leere`);
          }
        }
      }
    }
    return befunde;
  });
}

interface Fokusschritt {
  /** Eindeutige Kennung DIESES Elements — gleiche Beschriftungen sind nicht dasselbe Element. */
  id: string;
  wer: string;
  sichtbar: boolean;
}

async function fokusSchritt(page: Page): Promise<Fokusschritt | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }
    const zaehler = window as unknown as { __kwAuditNr?: number };
    if (!el.hasAttribute("data-kw-audit-nr")) {
      zaehler.__kwAuditNr = (zaehler.__kwAuditNr ?? 0) + 1;
      el.setAttribute("data-kw-audit-nr", String(zaehler.__kwAuditNr));
    }
    const id = el.getAttribute("data-kw-audit-nr") ?? "";
    const hatUmriss = (e: Element): boolean => {
      const s = getComputedStyle(e);
      return s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
    };
    const s = getComputedStyle(el);
    let sichtbar = hatUmriss(el) || s.boxShadow !== "none";
    // `focus-within:outline` an einer nahen Hülle (z. B. das Suchfeld im Kopfband) zählt mit.
    let v = el.parentElement;
    for (let i = 0; !sichtbar && v && i < 3; i++, v = v.parentElement) {
      sichtbar = v.matches(":focus-within") && hatUmriss(v);
    }
    const name =
      el.getAttribute("aria-label") ?? el.getAttribute("data-testid") ?? el.textContent ?? "";
    return { id, wer: `${el.tagName.toLowerCase()} „${name.trim().slice(0, 40)}“`, sichtbar };
  });
}

async function tastaturweg(page: Page): Promise<string[]> {
  const befunde: string[] = [];
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const erreicht = new Set<string>();
  let vorher = "";
  let gleich = 0;
  for (let i = 0; i < TAB_SCHRITTE; i++) {
    await page.keyboard.press("Tab");
    const schritt = await fokusSchritt(page);
    if (!schritt) {
      continue;
    }
    erreicht.add(schritt.id);
    if (!schritt.sichtbar) {
      befunde.push(`2.4.7: kein sichtbarer Fokus an ${schritt.wer}`);
    }
    gleich = schritt.id === vorher ? gleich + 1 : 0;
    vorher = schritt.id;
    if (gleich >= 2) {
      // Ein Dialog mit nur einem Element darf den Fokus halten, solange Escape hinausführt.
      await page.keyboard.press("Escape");
      await page.keyboard.press("Tab");
      const danach = await fokusSchritt(page);
      if (danach?.id === vorher) {
        befunde.push(`2.1.2: Tastaturfalle an ${schritt.wer}`);
        break;
      }
      gleich = 0;
    }
  }
  if (erreicht.size < 3) {
    befunde.push(`2.1.1: der Tab-Weg erreicht nur ${erreicht.size} Elemente`);
  }
  return [...new Set(befunde)];
}

async function reflow320(page: Page): Promise<string[]> {
  const vorher = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({
    breite: document.documentElement.scrollWidth,
    sicht: document.documentElement.clientWidth,
  }));
  if (vorher) {
    await page.setViewportSize(vorher);
  }
  return m.breite > m.sicht + 1
    ? [`1.4.10: bei 320 px scrollt die Seite waagerecht (${m.breite} > ${m.sicht} px)`]
    : [];
}

/** Alle Messungen einer Fläche; der Bericht hängt als Anhang am Lauf. */
async function pruefeFlaeche(page: Page, wo: string, testInfo: TestInfo): Promise<string[]> {
  const befunde: string[] = [];
  const kopf = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    titel: document.title,
  }));
  if (!/^(de|en|nl)\b/.test(kopf.lang)) {
    befunde.push(`3.1.1: html[lang] ist „${kopf.lang}“`);
  }
  if (!kopf.titel.trim()) {
    befunde.push("2.4.2: der Seitentitel ist leer");
  }
  for (const n of await namenImAxBaum(page)) {
    befunde.push(`4.1.2/1.1.1: ohne zugänglichen Namen: ${n}`);
  }
  for (const v of await idVerweise(page)) {
    befunde.push(`4.1.1: ${v}`);
  }
  const kontrast = await page.evaluate(kontrastImBrowser);
  for (const v of kontrast.verstoesse) {
    befunde.push(`1.4.3: ${v}`);
  }
  befunde.push(...(await tastaturweg(page)));
  befunde.push(...(await reflow320(page)));

  await testInfo.attach(`wcag-audit-${wo.replace(/\W+/g, "_")}.json`, {
    body: JSON.stringify(
      {
        flaeche: wo,
        kontrastGemessen: kontrast.gemessen,
        kontrastUnbestimmt: kontrast.unbestimmt,
        befunde,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  // Selbstschutz: eine Fläche ohne gemessenen Text wäre grün, ohne etwas geprüft zu haben.
  expect(kontrast.gemessen, `${wo}: kein einziger Textknoten gemessen`).toBeGreaterThan(5);
  return befunde;
}

async function frischeSeite(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const baseURL = testInfo.project.use.baseURL;
  const kontext = await browser.newContext(baseURL ? { baseURL } : {});
  return kontext.newPage();
}

// ================================================================================================
// KALIBRIERUNG — die Messmittel erkennen einen Verstoss, bevor sie Grün behaupten.
// ================================================================================================
test("KALIBRIERUNG · Kontrast, Namen, Fokus und Reflow schlagen an einer fehlerhaften Fixture an", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <html lang="de"><head><title>Kalibrierung</title>
    <style>
      .grau { color: #999; background: #fff; }
      button.nackt:focus { outline: none; box-shadow: none; }
      .breit { width: 900px; }
    </style></head>
    <body>
      <p class="grau">Grau auf Weiß, ~2,8:1</p>
      <p style="color:#000;background:#fff">Schwarz auf Weiß</p>
      <p style="color:#000;background:#fff">Noch ein Absatz</p>
      <p style="color:#000;background:#fff">Und noch einer</p>
      <p style="color:#000;background:#fff">Und ein vierter</p>
      <p style="color:#000;background:#fff">Und ein fünfter</p>
      <button class="nackt"></button>
      <button class="nackt">Zwei</button>
      <a href="#x" style="outline:2px solid #000">Drei</a>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">
      <div class="breit">Breit</div>
    </body></html>`);
  const befunde = await pruefeFlaeche(page, "Kalibrierung", testInfo);
  const text = befunde.join("\n");
  expect(text, "der Kontrastverstoss wird nicht erkannt").toContain("1.4.3: „Grau auf Weiß");
  expect(text, "der namenlose Knopf wird nicht erkannt").toMatch(/4\.1\.2\/1\.1\.1: .*button/);
  expect(text, "das namenlose Bild wird nicht erkannt").toMatch(/4\.1\.2\/1\.1\.1: .*(image|img)/);
  expect(text, "der unsichtbare Fokus wird nicht erkannt").toContain(
    "2.4.7: kein sichtbarer Fokus",
  );
  expect(text, "der waagerechte Überlauf wird nicht erkannt").toContain("1.4.10:");
  // Und das Gute wird nicht beanstandet: Schwarz auf Weiß ist kein Befund.
  expect(text).not.toContain("Schwarz auf Weiß");
});

// ================================================================================================
// DIE FLÄCHEN DES PRODUKTS.
// ================================================================================================
test("AUDIT · Anmeldemaske (ohne Sitzung)", async ({ browser }, testInfo) => {
  const seite = await frischeSeite(browser, testInfo);
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  const befunde = await pruefeFlaeche(seite, "Anmeldemaske", testInfo);
  await seite.context().close();
  expect(befunde, "WCAG-2.1-AA-Befunde auf der Anmeldemaske").toEqual([]);
});

for (const route of ROUTEN) {
  test(`AUDIT · ${route}`, async ({ page }, testInfo) => {
    await ensureLoggedIn(page);
    await page.goto(route);
    await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
    // Nachladende Abfragen fertig werden lassen, ohne auf ein Netz-Ruhefenster zu warten, das
    // Abfragen mit Wiederholung nie erreichen.
    await page.waitForTimeout(1_000);
    const befunde = await pruefeFlaeche(page, route, testInfo);
    // 2.4.1 (Technik ARIA11): Kopfband und Navigation lassen sich über die Landmarke `main`
    // überspringen — genau eine, damit Vorlesewerkzeuge eindeutig dorthin springen.
    const hauptbereiche = await page.locator("main").count();
    if (hauptbereiche !== 1) {
      befunde.push(`2.4.1: ${hauptbereiche} main-Landmarken statt genau einer`);
    }
    expect(befunde, `WCAG-2.1-AA-Befunde auf ${route}`).toEqual([]);
  });
}
