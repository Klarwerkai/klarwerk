// ================================================================================================
// JOB 3014 · LIEFERUNG 3 + 4 — DER PROBESCHNITT: TRÄGT DER SCHNITT, ODER TRÄGT ER NICHT?
// ================================================================================================
//
// P11 verlangt eine Zerlegung „ohne Verhalten zu ändern". Dieser Test erzeugt die Zerlegung
// MECHANISCH (reine Textoperation, `schneideDrei` — kein Zeichen des Stils oder des Skripts wird
// angefasst) und misst danach zweierlei:
//
//   TEIL A/B/C — DIE AUSLIEFERUNG. Alle drei Dateien gehen über die ECHTE Produktionsverdrahtung
//   (`registerSecurityHeaders` + `registerWebStatic`, in der Reihenfolge aus `server.ts`) und
//   müssen mit den erwarteten Kopfzeilen ankommen. Was dabei über die Geschwisterdateien
//   herauskommt, ist BEFUND, nicht Wunsch — es steht als Vertrag hier fest.
//
//   TEIL D — DAS VERHALTEN. Jede Fassung wird als VOLLSTÄNDIGE, ausgelieferte HTML-Antwort in ein
//   EIGENES jsdom-Fenster gegeben; `taskpane.js` und `taskpane.css` holt sich das Dokument selbst
//   über den Ressourcenlader aus DERSELBEN Fastify-App, office.js kommt als kontrollierte
//   Attrappe. Mechanik in `panel-lauf.ts`.
//
// WAS RUNDE 1 HIER FALSCH GEMACHT HAT (BEN, Korrekturpflicht 1) und was daraus folgt: Damals setzte
// der Test beide Seiten von Hand aus denselben zwei Bausteinen zusammen und übergab dem Probeschnitt
// den extrahierten Skripttext direkt an `new Function`. Ein Unterschied, der AM SCHNITT entsteht,
// war so nicht messbar — BENs Gegenprobe über `document.currentScript.src` lief grün durch. Fall D5
// führt genau diese Gegenprobe jetzt selbst und verlangt von ihr ROT.
//
// WAS AUCH JETZT NICHT GEMESSEN IST, und das gehört zur Aussage:
//   · Kein Browser und kein Word-WebView. jsdom fordert Ressourcen an, führt Skripte aus und rechnet
//     wirksame Stilwerte; es malt nicht, hat kein Layout und keine echte Office-Runtime.
//   · Keine echte Socketverbindung. `app.inject` fährt den vollen Fastify-Lebenszyklus, aber kein
//     TCP und keine Browser-Ursprungsprüfung.
//   · Kein echtes office.js. Der Word-Zustand wird von einer Attrappe gestellt, die jeden
//     Office-Zugriff mitschreibt — sie ist in beiden Fassungen dieselbe.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import {
  WORD_ADDIN_CSP,
  WORD_ADDIN_CSP_PATHS,
  registerSecurityHeaders,
} from "../../services/app/src/security-headers";
import {
  KLARA_FASSUNG_KOPF,
  KLARA_FASSUNG_PLATZHALTER,
  KLARA_TASKPANE_PFAD,
  registerWebStatic,
} from "../../services/app/src/web-static";
import {
  type Fingerabdruck,
  type Lauf,
  OFFICE_FEHLT,
  officeAttrappe,
  panelLauf,
} from "./panel-lauf";
import {
  type Block,
  CSS_DATEI,
  JS_DATEI,
  type Probeschnitt,
  bloeckeVon,
  bytes,
  inline,
  schneideDrei,
  taskpaneQuelle,
  zeilen,
} from "./zerlegung";

const FASSUNG = "1.0.0.1";
const CSS_PFAD = `/word-addin/${CSS_DATEI}`;
const JS_PFAD = `/word-addin/${JS_DATEI}`;

const QUELLE = taskpaneQuelle();
const SCHNITT: Probeschnitt = schneideDrei(QUELLE);

const aufraeumenDirs: string[] = [];
afterAll(() => {
  for (const dir of aufraeumenDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Ein `dist`-Abbild wie aus `vite build` — genau die Dateien, die der Fall stellen will. */
function dist(dateien: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kw-probeschnitt-"));
  aufraeumenDirs.push(dir);
  mkdirSync(join(dir, "word-addin"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
  for (const [name, inhalt] of Object.entries(dateien)) {
    writeFileSync(join(dir, "word-addin", name), inhalt);
  }
  return dir;
}

/** Die vollständige Drei-Datei-Fassung. */
function distMitSchnitt(schnitt: Probeschnitt = SCHNITT): string {
  return dist({
    "taskpane.html": schnitt.html,
    [CSS_DATEI]: schnitt.css,
    [JS_DATEI]: schnitt.js,
  });
}

/** Die Produktionsverdrahtung in der Reihenfolge aus `server.ts:44/63` — kein Nachbau. */
async function auslieferung(distPfad: string): Promise<FastifyInstance> {
  const app = Fastify();
  await registerSecurityHeaders(app);
  await registerWebStatic(app, distPfad, FASSUNG);
  return app;
}

// ================================================================================================
// A — DER SCHNITT SELBST: mechanisch, verlustfrei, an derselben Stelle.
// ================================================================================================

describe("JOB 3014 · A — der Probeschnitt ist eine reine Textoperation", () => {
  it("A1 · Stil und Skript wandern ZEICHENGLEICH in die zwei Dateien", () => {
    // Kalibrierung: ein leerer Schnitt wäre unten überall grün und misste nichts.
    expect(bytes(SCHNITT.js)).toBeGreaterThan(100_000);
    expect(bytes(SCHNITT.css)).toBeGreaterThan(5_000);
    // Verlustfrei: beide Inhalte stehen unverändert in der Quelle.
    expect(QUELLE).toContain(SCHNITT.js);
    expect(QUELLE).toContain(SCHNITT.css);
    // Und die drei Teile ergeben zusammen wieder die Quelle — bis auf die zwei Verweise.
    // Die Ersatztexte kommen als FUNKTION: als Zeichenkette würde `String.replace` darin `$&`
    // auswerten, und genau diese Folge steht im Panelskript (`replace(/…/g, "\\$&")`). Gemessen,
    // nicht vermutet — die erste Fassung dieses Falls ist daran rot geworden.
    const wiederEingesetzt = SCHNITT.html
      .replace(
        `<link rel="stylesheet" href="${CSS_DATEI}" />`,
        () => `<style>${SCHNITT.css}</style>`,
      )
      .replace(`<script src="${JS_DATEI}"></script>`, () => `<script>${SCHNITT.js}</script>`);
    expect(wiederEingesetzt).toBe(QUELLE);
  });

  it("A2 · die Rest-Seite ist um Größenordnungen kleiner und trägt genau zwei Verweise", () => {
    expect(zeilen(SCHNITT.html)).toBeLessThan(500);
    expect(bytes(SCHNITT.html)).toBeLessThan(bytes(QUELLE) / 5);
    expect(SCHNITT.html).toContain(`<link rel="stylesheet" href="${CSS_DATEI}" />`);
    expect(SCHNITT.html).toContain(`<script src="${JS_DATEI}"></script>`);
    // Kein Inline-Code mehr in der Seite — und office.js steht unverändert davor.
    expect(SCHNITT.html).not.toContain("<style>");
    expect(SCHNITT.html.indexOf("appsforoffice.microsoft.com")).toBeGreaterThan(0);
    expect(SCHNITT.html.indexOf("appsforoffice.microsoft.com")).toBeLessThan(
      SCHNITT.html.indexOf(`<script src="${JS_DATEI}">`),
    );
  });

  it("A3 · der Fassungsplatzhalter bleibt in der HTML-Datei und wandert NICHT mit", () => {
    expect(SCHNITT.html.split(KLARA_FASSUNG_PLATZHALTER)).toHaveLength(2);
    expect(SCHNITT.js).not.toContain(KLARA_FASSUNG_PLATZHALTER);
    expect(SCHNITT.css).not.toContain(KLARA_FASSUNG_PLATZHALTER);
  });
});

// ================================================================================================
// B — DIE AUSLIEFERUNG DER DREI DATEIEN (Lieferung 3a und 3b).
// ================================================================================================

describe("JOB 3014 · B — alle drei Dateien kommen an", () => {
  it("B1 · 200 mit erwartetem content-type für HTML, CSS und JS", async () => {
    const app = await auslieferung(distMitSchnitt());
    const faelle: Array<[string, string]> = [
      [KLARA_TASKPANE_PFAD, "text/html"],
      [CSS_PFAD, "text/css"],
      [JS_PFAD, "javascript"],
    ];
    for (const [pfad, typ] of faelle) {
      const res = await app.inject({ method: "GET", url: pfad });
      expect(res.statusCode, pfad).toBe(200);
      expect(String(res.headers["content-type"] ?? ""), pfad).toContain(typ);
      expect(res.body.length, pfad).toBeGreaterThan(0);
    }
  });

  it("B2 · die Geschwisterdateien tragen wirklich den geschnittenen Inhalt", async () => {
    const app = await auslieferung(distMitSchnitt());
    const js = await app.inject({ method: "GET", url: JS_PFAD });
    const css = await app.inject({ method: "GET", url: CSS_PFAD });
    expect(js.body).toBe(SCHNITT.js);
    expect(css.body).toBe(SCHNITT.css);
  });

  it("B3 · der Fassungsstempel greift weiter — im gesendeten Körper und im Kopf", async () => {
    const app = await auslieferung(distMitSchnitt());
    const res = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(res.body).not.toContain(KLARA_FASSUNG_PLATZHALTER);
    expect(res.body).toContain(`content="${FASSUNG}"`);
    expect(String(res.headers[KLARA_FASSUNG_KOPF])).toBe(FASSUNG);
    // Gegenprobe: die ungestempelte Quelldatei im dist trägt den Platzhalter noch.
    expect(SCHNITT.html).toContain(KLARA_FASSUNG_PLATZHALTER);
  });

  it("B4 · BEFUND: die Fassungskette deckt nach dem Schnitt nur noch die HTML-Datei", async () => {
    // Das ist keine Beanstandung des Schnitts, sondern seine wichtigste Folge — und sie muss vor
    // dem echten Umbau auf dem Tisch liegen. `stempleFassung` und `KLARA_FASSUNG_KOPF` hängen an
    // der EINEN Route (`web-static.ts`, `KLARA_TASKPANE_PFAD`). Die Geschwisterdateien laufen über
    // `@fastify/static` und tragen den Kopf NICHT. Ein Client kann nach dem Schnitt also eine
    // aktuelle HTML-Seite mit einem älteren `taskpane.js` kombinieren, ohne dass die Fassungskette
    // (JOB 1077) das bemerkt. Der `no-cache`-Hook auf `/word-addin/*` begrenzt das Fenster, hebt
    // es aber nicht auf.
    const app = await auslieferung(distMitSchnitt());
    for (const pfad of [JS_PFAD, CSS_PFAD]) {
      const res = await app.inject({ method: "GET", url: pfad });
      expect(res.headers[KLARA_FASSUNG_KOPF], pfad).toBeUndefined();
      // Was der Hook aus `registerWebStatic` sehr wohl durchsetzt: Revalidierung je Abruf.
      expect(res.headers["cache-control"], pfad).toBe("no-cache");
    }
  });
});

// ================================================================================================
// C — DIE KOPFZEILEN DER GESCHWISTERDATEIEN (Lieferung 3c). BEFUND, NICHT WUNSCH.
// ================================================================================================

describe("JOB 3014 · C — was HTML, JS und CSS an Kopfzeilen tragen", () => {
  it("C1 · die HTML-Antwort trägt die Ersatz-CSP, die Geschwister die strikte globale", async () => {
    const app = await auslieferung(distMitSchnitt());
    const html = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(html.headers["content-security-policy"]).toBe(WORD_ADDIN_CSP);
    expect(html.headers["x-frame-options"]).toBeUndefined();

    // Der gemessene Befund: `WORD_ADDIN_CSP_PATHS` enthält AUSSCHLIESSLICH die HTML-Adresse.
    expect(WORD_ADDIN_CSP_PATHS).toEqual([KLARA_TASKPANE_PFAD]);
    for (const pfad of [JS_PFAD, CSS_PFAD]) {
      const res = await app.inject({ method: "GET", url: pfad });
      const csp = String(res.headers["content-security-policy"] ?? "");
      expect(csp, pfad).toContain("frame-ancestors 'none'");
      expect(csp, pfad).not.toContain("office.com");
      expect(res.headers["x-frame-options"], pfad).toBeDefined();
    }
  });

  it("C2 · und deshalb scheitert das Laden daran NICHT — die entscheidende Erlaubnis steht im Dokument", async () => {
    // DIE AUSSAGE, sauber getrennt von dem, was hier nicht gemessen werden kann:
    //   · Was eine Seite an Unterressourcen laden darf, entscheidet die CSP DES DOKUMENTS. Genau
    //     sie trägt bereits `script-src 'self'` und `style-src 'self'` — same-origin
    //     Geschwisterdateien sind darin enthalten, ohne dass `WORD_ADDIN_CSP_PATHS` erweitert
    //     werden müsste. Das ist gemessen: die Direktiven stehen unten im echten Antwortkopf.
    //   · Die strikte CSP AUF der JS-/CSS-Antwort (C1) verbietet dieser Antwort nichts, was sie
    //     täte: `frame-ancestors` gilt nur für Dokumente, und ein Skript lädt keine Unterressourcen
    //     über seinen eigenen Antwortkopf.
    //   · NICHT GEMESSEN, und deshalb hier auch nicht behauptet: das Verhalten eines echten
    //     Browsers oder des Word-WebViews. Belegt ist die Erlaubnislage, nicht ihr Vollzug.
    const app = await auslieferung(distMitSchnitt());
    const html = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const csp = String(html.headers["content-security-policy"] ?? "");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("default-src 'self'");
    // Beide Geschwister sind same-origin und RELATIV verlinkt — 'self' deckt sie. Gemessen an den
    // wirklichen Verweisen der geschnittenen Seite, nicht an einer Textprobe: die einzige absolute
    // Skriptquelle bleibt office.js, und sie steht bereits in der CSP oben.
    const skriptquellen = [...SCHNITT.html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
    expect(skriptquellen).toEqual([
      "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
      JS_DATEI,
    ]);
    const stilquellen = [
      ...SCHNITT.html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(stilquellen).toEqual([CSS_DATEI]);
    for (const ref of [JS_DATEI, CSS_DATEI]) {
      expect(ref, `${ref} ist nicht relativ`).not.toMatch(/^[a-z]+:|^\/\//);
    }
  });

  it("C3 · fehlt eine der Geschwisterdateien, scheitert der Abruf LAUT — nie still als SPA-HTML", async () => {
    // Wichtig für den echten Umbau: ein vergessenes `taskpane.js` im Build darf keine weiße Seite
    // erzeugen, sondern muss als 404 auffallen (`isAssetRequest` in `web-static.ts`).
    const app = await auslieferung(dist({ "taskpane.html": SCHNITT.html }));
    const res = await app.inject({ method: "GET", url: JS_PFAD });
    expect(res.statusCode).toBe(404);
    expect(String(res.headers["content-type"] ?? "")).not.toContain("text/html");
    expect(res.body).not.toContain("SPA");
  });
});

// ================================================================================================
// D — DER VERHALTENSABGLEICH (Lieferung 4, neu gebaut nach BENs Korrekturpflichten 1 und 2).
// ================================================================================================

/**
 * Ein Lauf: die Seite über die ECHTE Auslieferung holen und sie als vollständiges Dokument in ein
 * eigenes jsdom-Fenster geben. Alles Weitere — `taskpane.js`, `taskpane.css`, office.js — fordert
 * das Dokument selbst an; der Lader in `panel-lauf.ts` beantwortet es aus derselben App.
 */
async function laufAus(distPfad: string, officeQuelle = officeAttrappe()): Promise<Lauf> {
  const app = await auslieferung(distPfad);
  const seite = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
  expect(seite.statusCode).toBe(200);
  return panelLauf({
    html: seite.body,
    officeQuelle,
    hole: async (pfad) => {
      const res = await app.inject({ method: "GET", url: pfad });
      return { status: res.statusCode, koerper: res.body };
    },
  });
}

const DIST_ORIGINAL = (): string => dist({ "taskpane.html": QUELLE });

/**
 * Die Sonde aus BENs Gegenprobe, MECHANISCH ans Ende des Inline-Skripts gesetzt: sie schreibt in
 * den Titel, ob der laufende Code inline oder als eigene Datei kam. Beide Fassungen entstehen
 * anschließend aus DERSELBEN gesondeten Quelle — dieselbe Textoperation wie beim echten Schnitt.
 */
const SONDE =
  '\n;document.title = document.title + "|" + ' +
  '(document.currentScript && document.currentScript.src ? "EXTERN" : "INLINE");\n';

function mitSonde(html: string): string {
  const skript = inline(bloeckeVon(html), "script")[0] as Block;
  return html.slice(0, skript.inhaltBis) + SONDE + html.slice(skript.inhaltBis);
}

function anders(a: Fingerabdruck, b: Fingerabdruck): string[] {
  const schluessel = Object.keys(a) as Array<keyof Fingerabdruck>;
  return schluessel.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

describe("JOB 3014 · D — derselbe Startzustand, geschnitten wie ungeschnitten", () => {
  it("D1 · Kalibrierung: der Lauf lädt wirklich, misst wirklich und ist wiederholbar", async () => {
    const eins = await laufAus(DIST_ORIGINAL());

    // (a) Das Dokument hat die Office-Attrappe WIRKLICH angefordert — sonst liefe alles ohne Word.
    expect(eins.geholt).toContain("https://appsforoffice.microsoft.com/lib/1/hosted/office.js");
    // (b) Das Panel ist im WORD-Zustand: es hat Office benutzt und ein Ereignis angemeldet.
    expect(eins.abdruck.officeAufrufe.length).toBeGreaterThan(0);
    expect(eins.abdruck.officeBindungen.length).toBeGreaterThan(0);
    // (c) Der Abdruck ist nicht leer — ein Vergleich zweier leerer Abdrücke wäre grün und misste
    //     nichts (Auftrag §6).
    expect(eins.abdruck.titel.length).toBeGreaterThan(0);
    expect(eins.abdruck.ueberschriften.length).toBeGreaterThan(3);
    expect(eins.abdruck.knoepfe.length).toBeGreaterThan(5);
    expect(eins.abdruck.karten.filter((k) => !k.includes("hidden")).length).toBeGreaterThan(0);
    expect(eins.abdruck.bindungen.length).toBeGreaterThan(5);
    expect(eins.abdruck.netzaufrufe.length).toBeGreaterThan(0);
    // (d) Die Stilhälfte trägt: die gemessenen Werte kommen aus dem Stilblatt, nicht aus dem
    //     jsdom-Nullzustand. Ohne diese Zeile wäre `stile` eine Spalte aus lauter Leerwerten.
    //     GRENZE, gemessen und deshalb hier benannt: jsdom löst KEINE benutzerdefinierten
    //     Eigenschaften auf — `color` kommt als `var(--text)` heraus, nicht als Farbe. Für den
    //     Vergleich genügt das (beide Fassungen bekommen denselben Wert); als Aussage über die
    //     WIRKLICHE Farbe taugt es nicht, und sie wird hier auch nicht getroffen. Die Werte, die
    //     jsdom wirklich rechnet, sind die direkten — Längen und Schriftfamilie.
    const stilwerte = eins.abdruck.stile.join(" ");
    expect(stilwerte, "eine Stilprobe hat ihr Element nicht gefunden").not.toContain(": fehlt");
    expect(stilwerte, "kein Stilblatt wirksam").toMatch(/border-radius=\d+px/);
    expect(stilwerte).toMatch(/padding=\d+px/);
    expect(stilwerte).toMatch(/font-family=\S/);
    // (e) Kein Skriptfehler und keine gescheiterte Ressource.
    expect(eins.abdruck.fehler).toEqual([]);

    // (f) Derselbe Lauf zweimal ergibt denselben Abdruck: erst damit ist ein Unterschied in D2 ein
    //     Befund und kein Rauschen.
    const zwei = await laufAus(DIST_ORIGINAL());
    expect(anders(eins.abdruck, zwei.abdruck)).toEqual([]);
  });

  it("D2 · Original und Probeschnitt: gleicher Startzustand, verschiedene Ladewege", async () => {
    const original = await laufAus(DIST_ORIGINAL());
    const geschnitten = await laufAus(distMitSchnitt());

    // DER UNTERSCHIED, DEN ES GEBEN MUSS: der Probeschnitt lädt zwei Dateien nach, das Original
    // nicht. Ohne diesen Fall wäre nicht belegt, dass hier überhaupt zwei verschiedene Seiten
    // laufen — genau BENs Befund an Runde 1.
    expect(original.geholt).toEqual(["https://appsforoffice.microsoft.com/lib/1/hosted/office.js"]);
    expect(geschnitten.geholt).toEqual([
      `http://localhost${CSS_PFAD}`,
      `http://localhost${JS_PFAD}`,
      "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
    ]);

    // DER UNTERSCHIED, DEN ES NICHT GEBEN DARF: alles, was ein Mensch am Panel sieht und tut.
    expect(anders(original.abdruck, geschnitten.abdruck)).toEqual([]);
    expect(geschnitten.abdruck).toEqual(original.abdruck);

    console.log(
      [
        "",
        "JOB 3014 · Verhaltensabgleich Original ↔ Probeschnitt",
        "(je ein eigenes jsdom-Fenster, vollständige Serverantwort, Geschwisterdateien über dieselbe",
        " Fastify-App nachgeladen, dieselbe bereite Office-Attrappe, dieselbe fetch-Attrappe)",
        `  Titel:              ${original.abdruck.titel}`,
        `  Sprache:            ${original.abdruck.sprache}`,
        `  Überschriften:      ${original.abdruck.ueberschriften.length}`,
        `  Knöpfe:             ${original.abdruck.knoepfe.length} (#ask-btn disabled=${original.abdruck.askBtnDisabled})`,
        `  Karten:             ${original.abdruck.karten.length}, davon verborgen ${original.abdruck.karten.filter((k) => k.includes("hidden")).length}`,
        `  Wirksame Stilwerte: ${original.abdruck.stile.length} Proben, z. B. ${original.abdruck.stile[2] ?? "—"}`,
        `  DOM-Bindungen:      ${original.abdruck.bindungen.length}`,
        `  Office-Zugriffe:    ${original.abdruck.officeAufrufe.join(", ")}`,
        `  Netzaufrufe:        ${original.abdruck.netzaufrufe.join(", ")}`,
        `  Skriptfehler:       ${original.abdruck.fehler.length}`,
        `  Nachgeladen:        Original ${original.geholt.length} Ressource(n), Probeschnitt ${geschnitten.geholt.length}`,
        "  ERGEBNIS: Probeschnitt verhält sich gleich.",
        "",
      ].join("\n"),
    );
  });

  it("D3 · Gegenprobe: fehlt `taskpane.js`, wird der Vergleich ROT", async () => {
    // BENs Korrekturpflicht 1, erster erwarteter Beleg. Ohne diesen Fall wäre nicht belegt, dass
    // der Lauf das externe Skript überhaupt braucht.
    const original = await laufAus(DIST_ORIGINAL());
    const ohneJs = await laufAus(dist({ "taskpane.html": SCHNITT.html, [CSS_DATEI]: SCHNITT.css }));
    expect(ohneJs.abdruck).not.toEqual(original.abdruck);
    // Und es scheitert LAUT: der Lader hat die Datei angefordert und einen Fehler bekommen.
    expect(ohneJs.geholt).toContain(`http://localhost${JS_PFAD}`);
    expect(ohneJs.abdruck.fehler.join(" ")).toContain("taskpane.js");
    // Das Panel ist ohne sein Skript stumm: keine Netzaufrufe, keine Office-Zugriffe.
    expect(ohneJs.abdruck.netzaufrufe).toEqual([]);
    expect(ohneJs.abdruck.officeBindungen).toEqual([]);
  });

  it("D4 · Gegenprobe: fehlt `taskpane.css`, wird der Vergleich ROT", async () => {
    // Die Stilhälfte trägt wirklich — in Runde 1 war CSS ausdrücklich nicht geladen (BEN, Punkt 3).
    const original = await laufAus(DIST_ORIGINAL());
    const ohneCss = await laufAus(dist({ "taskpane.html": SCHNITT.html, [JS_DATEI]: SCHNITT.js }));
    const unterschied = anders(original.abdruck, ohneCss.abdruck);
    expect(unterschied).toContain("stile");
    expect(ohneCss.abdruck.fehler.join(" ")).toContain("taskpane.css");
  });

  it("D5 · Gegenprobe: ein Inline/Extern-Unterschied im Skript wird ROT", async () => {
    // BENs Gegenprobe aus der Prüfung von Runde 1, wörtlich nachgestellt: eine Sonde, die
    // `document.currentScript.src` liest, unterscheidet die beiden Fassungen WIRKLICH. In Runde 1
    // lief sie grün durch — das war der Beweis, dass dort kein echter Schnitt verglichen wurde.
    const quelleMitSonde = mitSonde(QUELLE);
    const schnittMitSonde = schneideDrei(quelleMitSonde);
    const originalSonde = await laufAus(dist({ "taskpane.html": quelleMitSonde }));
    const geschnittenSonde = await laufAus(distMitSchnitt(schnittMitSonde));

    expect(originalSonde.abdruck.titel).toContain("|INLINE");
    expect(geschnittenSonde.abdruck.titel).toContain("|EXTERN");
    expect(geschnittenSonde.abdruck).not.toEqual(originalSonde.abdruck);
    expect(anders(originalSonde.abdruck, geschnittenSonde.abdruck)).toEqual(["titel"]);

    // UND DER BEFUND DAZU, damit die Gegenprobe nicht als Mangel des Schnitts missverstanden wird:
    // die Semantik von `document.currentScript` unterscheidet die Fassungen tatsächlich — das
    // ausgelieferte Panel benutzt sie an keiner Stelle. Gemessen, nicht angenommen.
    expect(QUELLE).not.toContain("currentScript");
  });

  it("D6 · Gegenprobe: eine veränderte Office-Bindung wird ROT", async () => {
    // BENs Korrekturpflicht 2, zweiter erwarteter Beleg. Dieselbe Seite, nur ein anderer Host:
    // ohne `EventType.DocumentSelectionChanged` meldet das Panel kein Ereignis mehr an, und ohne
    // Office überhaupt steht es im ehrlichen „nicht in Word"-Zustand.
    const wort = await laufAus(DIST_ORIGINAL());
    const ohneEreignis = await laufAus(DIST_ORIGINAL(), officeAttrappe({ ereignisTyp: null }));
    const ohneOffice = await laufAus(DIST_ORIGINAL(), OFFICE_FEHLT);

    expect(anders(wort.abdruck, ohneEreignis.abdruck)).toContain("officeBindungen");
    expect(ohneEreignis.abdruck.officeBindungen).toEqual([]);

    expect(ohneOffice.abdruck).not.toEqual(wort.abdruck);
    expect(ohneOffice.abdruck.officeBindungen).toEqual([]);
    // Der Unterschied ist sichtbar, nicht nur intern: der Nicht-Word-Zustand zeigt eine andere
    // Oberfläche.
    expect(anders(wort.abdruck, ohneOffice.abdruck)).toContain("verborgen");
  });
});
