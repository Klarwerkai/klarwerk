// ================================================================================================
// JOB 3278 · CHR-01/02/03 — KLARA IM BROWSER IST EINE ECHTE SEITENLEISTE IN KLARWERK-GESTALTUNG.
// ================================================================================================
//
// DREI BEFUNDE, DREI ZUSICHERUNGSGRUPPEN:
//
//   CHR-02 · SEITENLEISTE. Die Erweiterung öffnete ihre Fläche als eigenen TAB
//     (`chrome.tabs.create({url: panel.html})`). Damit war die Quellseite weg, sobald man den
//     Entwurf ansah — genau das Gegenteil des Versprechens „neben der Seite". Geprüft wird jetzt:
//     Manifest führt `side_panel` und das Recht `sidePanel`; Symbolklick UND Kontextmenü öffnen die
//     Leiste; `sidePanel.open` läuft VOR dem ersten Speicherzugriff (sonst ist die Klickgeste
//     verwirkt und Chrome verweigert das Öffnen); ein Tabwechsel überschreibt die erfasste Quelle
//     nicht; die Leiste ist nirgends an einen Tab gebunden.
//
//   CHR-01 · GESTALTUNG. Die Fläche führte sieben handkopierte Farben ohne Herkunft. Geprüft wird
//     jetzt jede Variable in `panel.css` gegen ihre DEKLARIERTE Herkunft — Token aus
//     `apps/web/src/styles/themes.css` (der Datei, die `apps/web/src/index.css` importiert),
//     Formtoken aus `apps/web/tailwind.config.ts`, oder ein benannter Ausnahmewert, der dann
//     buchstäblich derselbe sein muss wie in Klara/Word. Eine Variable ohne Herkunft ist rot, und
//     ein Farbliteral außerhalb des `:root`-Blocks ebenso — so kann kein unverbundener Wert
//     nachwachsen. Zusätzlich: die Kopfzeile trägt die Maße der Kopfzeile von Klara in Word.
//
//   CHR-03 / Pflichtlieferung 3+4 · WEG UND ZUSTÄNDE. Der bewährte Übernahmeweg bleibt: was die
//     Vorschau zeigt, ist wörtlich das, was gesendet wird (Originaltext, Seite, Quelle,
//     Erfassungszeit). Und der Ruhezustand trägt in BEIDEN Sprachen genau eine Zeile ≤ 60 Zeichen —
//     gemessen an den tatsächlich sichtbaren Knoten, nicht am Quelltext.
//
// WAS DIESE DATEI NICHT LEISTET, ausdrücklich: sie startet kein Chrome. Ob Chrome die Leiste
// wirklich neben der Seite zeichnet, entscheidet die Abnahme in `tests/klara-browser/chrome-probe.cjs`
// bzw. Codex/Pedi von Hand (Auftrag §7). Hier wird der VERTRAG geprüft, den Chrome dafür braucht.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { harness, read } from "./harness";
import { type Knoten, mount, schliesseFenster } from "./panel-dom";

afterEach(schliesseFenster);

const PANEL_CSS = read("panel.css");
const WORKER = read("worker.js");
const MANIFEST = JSON.parse(read("manifest.json"));
const INDEX_CSS = readFileSync(resolve("apps/web/src/index.css"), "utf8");
const TAILWIND = readFileSync(resolve("apps/web/tailwind.config.ts"), "utf8");
const TASKPANE = readFileSync(resolve("apps/web/public/word-addin/taskpane.html"), "utf8");

/**
 * Quelltext ohne Kommentare. Ein Verbot („kein `setOptions`") gilt dem AUFRUF, nicht der Prosa:
 * der Worker erklärt in seinem Kommentar ausdrücklich, warum er `setOptions` NICHT ruft, und ein
 * roher Substring-Test hätte genau diese Erklärung als Verstoß gelesen. Das `(?<!:)` schützt dabei
 * „https://…" davor, als Zeilenkommentar zu gelten.
 */
const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(?<!:)\/\/.*$/gm, " ");
const WORKER_CODE = ohneKommentare(WORKER);

// ------------------------------------------------------------------------------------------------
// Die Token-Quelle wird nicht geraten, sondern aus index.css AUFGELÖST: dort steht der Import, der
// die eine Farbwahrheit lädt. Zieht das Produkt sie eines Tages woandershin, wird das hier rot,
// statt dass dieser Wächter still eine verwaiste Datei weitermisst.
// ------------------------------------------------------------------------------------------------
const TOKEN_IMPORT = INDEX_CSS.match(/@import\s+"\.\/(styles\/[\w.-]+\.css)"/)?.[1];
const THEMES_CSS = readFileSync(
  resolve("apps/web/src", TOKEN_IMPORT ?? "styles/themes.css"),
  "utf8",
);

/** Der Rumpf eines Regelblocks — die hier gelesenen Blöcke enthalten keine geschachtelten Klammern. */
function blockVon(quelle: string, kopf: string): string {
  const start = quelle.indexOf(`${kopf} {`);
  expect(start, `${kopf} fehlt in der gelesenen Datei`).toBeGreaterThanOrEqual(0);
  const ende = quelle.indexOf("\n}", start);
  expect(ende, `${kopf} ist nicht geschlossen`).toBeGreaterThan(start);
  return quelle.slice(start, ende);
}

/** Alle Custom Properties eines Blocks. Kommentare fallen weg, mehrzeilige Werte bleiben ganz. */
function variablen(block: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const [, name, wert] of block
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    // Beide Gruppen sind im Muster PFLICHT; der Zweig ist für den Typprüfer da, nicht für den Lauf.
    if (name === undefined || wert === undefined) continue;
    raus.set(name, wert.replace(/\s+/g, " ").trim());
  }
  return raus;
}

/** Die deklarierte Herkunft je Variable: der Text hinter dem „←" im Kommentar derselben Zeile. */
function herkuenfte(block: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const [, name, kommentar] of block.matchAll(
    /(--[\w-]+)\s*:[^;]+;[ \t]*\/\*([\s\S]*?)\*\//g,
  )) {
    if (name === undefined || kommentar === undefined) continue;
    const pfeil = kommentar.indexOf("←");
    if (pfeil >= 0) raus.set(name, kommentar.slice(pfeil + 1).trim());
  }
  return raus;
}

const MODERN = variablen(blockVon(THEMES_CSS, '[data-theme="modern"]'));
const KLASSISCH = variablen(blockVon(THEMES_CSS, ":root"));
// Die WIRKLICHE Kaskade des Produkts: Vorgabe ist „modern" (apps/web/src/lib/designTheme.ts:22),
// und was der modern-Block nicht überschreibt, erbt er von :root (so etwa --kw-brand-text).
const token = (name: string) => MODERN.get(name) ?? KLASSISCH.get(name);

/** „14 22 38" → „#0E1626". Nicht-Tripel bleiben undefiniert. */
function hex(tripel: string | undefined): string | undefined {
  const teile = tripel?.match(/^(\d{1,3}) (\d{1,3}) (\d{1,3})$/);
  return teile
    ? `#${teile
        .slice(1)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`
    : undefined;
}

/** `rgb(var(--kw-night) / 0.05)` → `rgba(14, 22, 38, 0.05)` — das Alpha-Rezept der Werkbank. */
function aufgeloest(wert: string): string {
  return wert.replace(/rgb\(var\((--[\w-]+)\)\s*\/\s*([\d.]+)\)/g, (ganz, name, alpha) => {
    const tripel = token(String(name));
    return tripel ? `rgba(${tripel.split(" ").join(", ")}, ${alpha})` : ganz;
  });
}

// Werte, die die Werkbank-Palette NICHT führt. Jeder braucht einen Grund UND muss buchstäblich
// derselbe sein wie in Klara/Word — sonst entsteht in der Leiste ein dritter Wert.
const AUSNAHMEN: Record<string, string> = {
  "--lupe":
    "Mockup-Grau des Ruhesymbols (design/klara/Ruhe.dc.html Z.29). Die Werkbank-Palette führt " +
    "keinen Ersatz; Klara in Word trägt denselben Wert (taskpane.html:49). Der Nachzug nach " +
    "themes.css ist ein eigener Auftrag — apps/web/src ist nicht Zielpfad von JOB 3278.",
  "--font-sans":
    "Die Erweiterung bündelt IBM Plex Sans nicht und darf sie unter ihrer CSP (kein font-src) " +
    "auch nicht nachladen. Deshalb wörtlich derselbe System-Stapel wie Klara in Word " +
    "(taskpane.html:86) — dieselbe Entscheidung aus demselben Grund, kein dritter Wert.",
};

const PANEL_ROOT = blockVon(PANEL_CSS, ":root");
const PANEL_VARS = variablen(PANEL_ROOT);
const PANEL_HERKUNFT = herkuenfte(PANEL_ROOT);

describe("JOB 3278 · CHR-02 — die Leiste steht neben der Seite, nicht an ihrer Stelle", () => {
  it("A · das Manifest führt die Seitenleiste, ihr Recht und die neue Fassung", () => {
    expect(MANIFEST.side_panel).toEqual({ default_path: "panel.html" });
    expect(MANIFEST.permissions).toContain("sidePanel");
    expect(MANIFEST.version).toBe("0.2.0");
    // Side Panel gibt es ab Chrome 114; das Paket verlangt ohnehin schon 120.
    expect(Number(MANIFEST.minimum_chrome_version)).toBeGreaterThanOrEqual(114);
    // Kein neuer Host, keine Dauerrechte — der Auftrag verbietet beides ausdrücklich.
    expect(MANIFEST.host_permissions).toEqual(["https://app.klarwerk.ai/*"]);
    expect(MANIFEST.permissions.sort()).toEqual(
      ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"].sort(),
    );
  });

  it("A2 · der alte Weg ist ERSETZT: der Worker öffnet keinen Tab mehr und bindet die Leiste an keinen Tab", () => {
    // Ablösung statt Nebeneinander: bliebe `tabs.create` stehen, hätten wir zwei Öffnungswege.
    expect(WORKER_CODE).not.toMatch(/tabs\.create\s*\(/);
    // `setOptions({tabId})` würde die Leiste tabgebunden machen — und damit beim Tabwechsel die
    // ursprüngliche Quelle verlieren. Genau das darf CHR-08 später nicht vorfinden.
    expect(WORKER_CODE).not.toMatch(/setOptions\s*\(/);
    // Und der Öffnungsweg, den es GIBT, steht wirklich da — sonst wäre dieser Test bloß ein Verbot.
    expect(WORKER_CODE).toMatch(/chrome\.sidePanel\.open\s*\(/);
  });

  it("B · Kontextmenü-Übernahme öffnet die Leiste und übergibt genau diese Auswahl", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.listeners.menu?.(
      { menuItemId: "capture", pageUrl: h.selected.url, selectionText: h.selected.text },
      { id: 7, url: h.selected.url, title: h.selected.title },
    );
    expect(h.panelOpens, "die Leiste wurde für den Quelltab nicht geöffnet").toEqual([7]);
    const sicht = await h.send({ type: "state" });
    expect(sicht.status).toBe("preview");
    expect(sicht.selection?.text).toBe(h.selected.text);
    expect(sicht.selection?.url).toBe(h.selected.url);
    expect(sicht.selection?.title).toBe(h.selected.title);
  });

  it("B2 · die Klickgeste bleibt erhalten: sidePanel.open läuft VOR dem ersten Speicherzugriff", async () => {
    // Chrome bindet `sidePanel.open()` an die Nutzergeste. Jedes `await` davor verwirkt sie, und
    // die Leiste erscheint dann gar nicht — ein Fehler, den kein Zustandstest sehen kann.
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.capture();
    expect(h.spuren[0], `Reihenfolge war: ${h.spuren.join(" → ")}`).toBe("sidePanel.open");
    expect(h.spuren).toContain("storage.get");
    expect(h.panelOpens).toEqual([7]);
  });

  it("B3 · das Symbol öffnet die Leiste selbst — Chrome darf es nicht an unserer Übernahme vorbei tun", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.listeners.installed?.();
    // Mit `openPanelOnActionClick: true` öffnete Chrome die Leiste und `action.onClicked` feuerte
    // NIE — das Symbol zeigte dann eine leere Leiste ohne Übernahme.
    expect(h.behaviors).toEqual([{ openPanelOnActionClick: false }]);
  });

  it("C · ein Tabwechsel überschreibt die erfasste Quelle nicht und schließt die Leiste nicht", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.capture();
    const vorher = await h.send({ type: "state" });
    expect(vorher.sourceChanged).toBe(false);
    await h.listeners.activated?.({ tabId: 99 });
    await h.listeners.updated?.(99, { url: "https://andere.example.test/seite" });
    const nachher = await h.send({ type: "state" });
    expect(nachher.selection, "die Quelle wurde beim Tabwechsel überschrieben").toEqual(
      vorher.selection,
    );
    expect(nachher.status).toBe("preview");
    // Der Unterschied zwischen ursprünglicher Quelle und aktivem Tab wird BENANNT, nicht verdeckt.
    expect(nachher.sourceChanged).toBe(true);
    expect(h.panelOpens, "die Leiste wurde beim Tabwechsel erneut geöffnet").toEqual([7]);
  });

  it("C2 · eine zweite Übernahme öffnet die Leiste erneut, ersetzt die offene Vorschau aber nicht", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.capture();
    const vorher = await h.send({ type: "state" });
    h.setSelected({
      text: "ANDERER TEXT",
      url: "https://technik.example.test/andere",
      title: "Andere Seite",
    });
    await h.capture();
    const nachher = await h.send({ type: "state" });
    expect(nachher.selection).toEqual(vorher.selection);
    expect(nachher.pendingCapture).toBe(true);
    expect(h.panelOpens).toEqual([7, 7]);
  });
});

describe("JOB 3278 · CHR-01 — jeder Wert der Leiste hat eine nachgerechnete Herkunft", () => {
  it("D · die Token-Quelle wird aus index.css aufgelöst und trägt die Werkbank-Palette", () => {
    expect(TOKEN_IMPORT, "index.css importiert die Token-Datei nicht mehr").toBe(
      "styles/themes.css",
    );
    expect(MODERN.size, "der modern-Block ist leer — dann misst D2 nichts").toBeGreaterThan(10);
    expect(KLASSISCH.size).toBeGreaterThan(10);
    expect(PANEL_VARS.size, "panel.css führt keine Variablen mehr").toBeGreaterThan(10);
  });

  it("D2 · JEDE Variable in panel.css löst sich auf ihre deklarierte Herkunft auf", () => {
    const abweichungen: string[] = [];
    for (const [name, ist] of PANEL_VARS) {
      const herkunft = PANEL_HERKUNFT.get(name);
      if (!herkunft) {
        abweichungen.push(`${name}: keine Herkunft im Kommentar (kein „← …")`);
        continue;
      }
      if (herkunft.startsWith("--kw-")) {
        const [, kwName, alpha] = herkunft.match(/^(--[\w-]+)(?:\s*\/\s*([\d.]+))?/) ?? [];
        const roh = token(String(kwName));
        if (roh === undefined) {
          abweichungen.push(`${name}: ${kwName} gibt es in themes.css nicht`);
          continue;
        }
        const soll = alpha
          ? `rgba(${roh.split(" ").join(", ")}, ${alpha})`
          : (hex(roh) ?? aufgeloest(roh));
        if (soll.toLowerCase() !== ist.toLowerCase()) {
          // Ein ZUSAMMENGESETZTER Wert (ein Schatten: Geometrie + Farbe) darf die Token-Farbe
          // tragen, statt sie zu sein. Dann muss die deklarierte Farbe wirklich darin stehen UND
          // die einzige im Wert sein — sonst könnte sich neben der belegten Farbe still eine
          // zweite, herkunftslose einnisten, und genau das soll D2 verhindern.
          const farben = ist.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [];
          const traegt =
            farben.length > 0 &&
            farben.every((farbe) => farbe.toLowerCase() === soll.toLowerCase());
          if (!traegt) abweichungen.push(`${name}: ist ${ist}, ${kwName} sagt ${soll}`);
        }
        continue;
      }
      if (herkunft.startsWith("tailwind:")) {
        const feld = herkunft.slice("tailwind:borderRadius.".length).trim();
        const soll = TAILWIND.match(new RegExp(`${feld}:\\s*"([^"]+)"`))?.[1];
        if (soll !== ist) abweichungen.push(`${name}: ist ${ist}, tailwind sagt ${soll}`);
        continue;
      }
      // Alles andere ist ein Ausnahmewert: er braucht einen Grund UND denselben Wert wie Klara/Word.
      if (!AUSNAHMEN[name]) {
        abweichungen.push(`${name}: Herkunft „${herkunft}" ist kein Token und keine Ausnahme`);
        continue;
      }
      // Ohne Rücksicht auf Gross-/Kleinschreibung: Biome normalisiert Hex-Werte in `panel.css` auf
      // klein, `taskpane.html` schreibt sie gross. Verglichen wird die FARBE, nicht die Schreibung —
      // sonst meldete dieser Wächter einen „dritten Wert", wo nur der Formatierer gelaufen ist.
      if (!TASKPANE.toLowerCase().includes(ist.toLowerCase())) {
        abweichungen.push(`${name}: ${ist} steht so nicht in Klara/Word — ein dritter Wert`);
      }
    }
    expect(abweichungen).toEqual([]);
  });

  it("D3 · kein Ausnahmeeintrag auf Vorrat, und kein Farbliteral außerhalb von :root", () => {
    for (const [name, grund] of Object.entries(AUSNAHMEN)) {
      expect(PANEL_VARS.has(name), `${name}: Ausnahme ohne Variable`).toBe(true);
      expect(grund.length, `${name}: Ausnahme ohne Begründung`).toBeGreaterThan(60);
    }
    const dahinter = PANEL_CSS.slice(PANEL_CSS.indexOf(PANEL_ROOT) + PANEL_ROOT.length).replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    // `(?!-)` trennt die FARBE `white` vom EIGENSCHAFTSNAMEN `white-space` — sonst meldet dieser
    // Wächter ein `white-space: pre-wrap` als herkunftslosen Farbwert.
    const literale = [
      ...dahinter.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|red)\b(?!-)/g),
    ].map((t) => t[0]);
    expect(literale, "Farbwert außerhalb des :root-Blocks — er hätte keine Herkunft").toEqual([]);
    // Und kein nachgeladener Webfont: die CSP der Erweiterung erlaubt keinen, s. Kopfkommentar.
    expect(PANEL_CSS).not.toMatch(/@font-face|@import/);
  });

  it("D4 · die Kopfzeile trägt die Maße der Kopfzeile von Klara in Word", () => {
    const wort = (quelle: string, regel: string) =>
      blockVon(quelle, regel)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\s+/g, " ")
        .trim();
    // Wortmarke: 15px, 650, 0.2px Laufweite, Tinte — buchstäblich taskpane.html:104.
    for (const merkmal of ["font-size: 15px", "font-weight: 650", "letter-spacing: 0.2px"]) {
      expect(wort(PANEL_CSS, ".brand"), `Wortmarke ohne ${merkmal}`).toContain(merkmal);
      expect(TASKPANE, `Klara/Word führt ${merkmal} nicht mehr`).toContain(merkmal);
    }
    // Kopfpolsterung und Fokusring ebenso — dieselbe Fläche, dieselben Werte.
    expect(wort(PANEL_CSS, "header")).toContain("padding: 14px 16px 10px");
    expect(TASKPANE).toContain("padding: 14px 16px 10px");
    expect(wort(PANEL_CSS, ":focus-visible")).toContain("outline: 2px solid var(--brand)");
    expect(TASKPANE).toContain("outline: 2px solid var(--brand)");
  });
});

describe("JOB 3278 · CHR-03 — Vorschau, Zustände und beide Sprachen", () => {
  it("E · was die Vorschau zeigt, ist wörtlich das, was gesendet wird", async () => {
    const h = await mount();
    await h.login();
    h.input("title", "Übernahme aus dem Browser");
    await h.settle();
    h.el("confirm").checked = true;
    h.el("confirm").dispatchEvent(new h.win.Event("change"));
    h.el("save").click();
    await h.settle();
    expect(h.el("status").textContent).toContain("Saved as an unreviewed draft");
    const gesendet = h.koerper.find((k) => k.url.endsWith("/api/drafts"))?.body;
    expect(gesendet, "es wurde nichts gesendet").toBeTruthy();
    // Der Originaltext der Vorschau IST die gesendete Kernaussage — kein gekürzter Zwilling.
    expect(h.el("text").textContent).toBe(String(gesendet?.statement));
    const koerper = String(gesendet?.bodyHtml);
    for (const feld of ["page", "source", "captured"]) {
      const angezeigt = h.el(feld).textContent ?? "";
      expect(angezeigt.length, `${feld} ist in der Vorschau leer`).toBeGreaterThan(0);
      expect(koerper, `${feld}: angezeigt „${angezeigt}", aber nicht im Entwurf`).toContain(
        angezeigt,
      );
    }
    expect(h.el("title").value).toBe(String(gesendet?.title));
  });

  it("F · der Ruhezustand trägt in DE und EN genau eine Zeile, höchstens 60 Zeichen", async () => {
    const h = await mount({ auswahl: false });
    const sichtbar = (knoten: Knoten) => {
      for (let n: Knoten | null = knoten; n; n = n.parentElement) {
        if (n.hasAttribute("hidden")) return false;
      }
      return true;
    };
    expect(h.el("rest").hasAttribute("hidden"), "das Ruhesymbol fehlt").toBe(false);
    expect(h.el("preview").hasAttribute("hidden")).toBe(true);
    expect(h.el("done").hasAttribute("hidden")).toBe(true);
    for (const sprache of ["de", "en"]) {
      h.sprache(sprache);
      const eigene = [
        ...h.win.document.querySelectorAll("[data-i18n]"),
        h.win.document.getElementById("status") as Knoten,
      ].filter(sichtbar);
      const saetze = eigene
        .map((k) => (k.textContent ?? "").trim())
        .filter((text) => text.length > 0);
      expect(saetze.length, `${sprache}: gar kein Text im Ruhezustand`).toBeGreaterThan(0);
      const zulang = saetze.filter((text) => text.length > 60);
      expect(zulang, `${sprache}: Satz im Ruhezustand über 60 Zeichen`).toEqual([]);
      // Und die eine Zeile sagt wirklich, was zu tun ist.
      expect(h.el("status").textContent).toBe(
        sprache === "de"
          ? "Keine Auswahl. Text markieren, dann Rechtsklick."
          : "No selection. Select text, then right-click.",
      );
    }
  });

  it("F2 · jeder Zustandstext hat genau einen Ton — grün, gelb oder rot mit Grund", async () => {
    const h = await mount({ auswahl: false });
    const texte = h.win.eval("globalThis.KLARA_TEXT") as Record<string, Record<string, string>>;
    const beschriftungen = new Set(
      [...h.win.document.querySelectorAll("[data-i18n]")].map(
        (k) => k.getAttribute("data-i18n") ?? "",
      ),
    );
    // Zustandstexte sind genau die Schlüssel, die KEIN Beschriftungsknoten trägt. `signedOut` steht
    // im Kontofeld und ist ebenfalls keine Zustandszeile.
    // Fehlte `de` ganz, bliebe die Menge leer — die Zusicherung „mehr als 20" darunter macht genau
    // das rot, statt dass F2 still über einem leeren Wortschatz grün liefe.
    const zustaende = Object.keys(texte.de ?? {}).filter(
      (schluessel) => !beschriftungen.has(schluessel) && schluessel !== "signedOut",
    );
    expect(zustaende.length, "keine Zustandstexte gefunden — F2 misst dann nichts").toBeGreaterThan(
      20,
    );
    const panelJs = read("panel.js");
    const tabelle = panelJs.slice(panelJs.indexOf("const TON = {"), panelJs.indexOf("const ton ="));
    const eingeordnet = [...tabelle.matchAll(/"([\w]+)"/g)].flatMap((t) => t[1] ?? []);
    const doppelt = eingeordnet.filter((s, i) => eingeordnet.indexOf(s) !== i);
    expect(doppelt, "Zustand mit zwei Tönen").toEqual([]);
    expect(
      zustaende.filter((s) => !eingeordnet.includes(s)),
      "Zustandstext ohne Ton — er stünde ohne Fläche da, obwohl er ein Ereignis meldet",
    ).toEqual([]);
    expect(
      eingeordnet.filter((s) => !zustaende.includes(s) && s !== "preview"),
      "Ton für einen Zustand, den es nicht gibt",
    ).toEqual([]);
  });

  it("F3 · gespeichert ist grün, ein gescheitertes Speichern rot mit Grund", async () => {
    const h = await mount();
    expect(h.el("status").className, "Vorschau ist kein Ereignis").toBe("");
    await h.login();
    h.input("title", "Titel");
    await h.settle();
    h.el("confirm").checked = true;
    h.el("confirm").dispatchEvent(new h.win.Event("change"));
    h.el("save").click();
    await h.settle();
    expect(h.el("status").className).toBe("ok");
    expect(h.el("done").hasAttribute("hidden")).toBe(false);
    expect(h.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=draft-test",
    );
  });
});
