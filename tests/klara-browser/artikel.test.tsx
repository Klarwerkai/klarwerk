// ================================================================================================
// JOB 3279 · CHR-04/05/08 — DREI BEWUSSTE UMFÄNGE, EHRLICHE LÜCKEN, EINGEFRORENE HERKUNFT.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, und woran es scheitern soll:
//
//   A1  Der Artikel-Umfang trägt Überschrift, Tabelle UND Bild samt Bildunterschrift und Quelle.
//   A2  Was nicht mitkommt (Rahmen, nicht geladenes Bild, Bild fremder Herkunft), steht sichtbar
//       unter „Nicht übernommen" — mit Adresse, nicht als Schweigen.
//   A3  Gibt es eine Markierung, ist sie der Standard. Der Entwurf enthält dann NUR sie.
//   A4  Ein anderer Umfang ist eine bewusste Wahl: er entwertet die Bestätigung.
//   A5  Ein Tabwechsel meldet sich, überschreibt die Herkunft aber nicht.
//   A6  Chat-KI-Seiten werden gekennzeichnet; eine Seite, die nur so HEISST, nicht.
//   A7  Die Vorschau IST der gespeicherte Inhalt — verglichen gegen den vom Server zurückgelesenen
//       Entwurfskörper, Zeichen für Zeichen, samt Bild.
//   A8  DE↔EN wechselt live, ohne Auswahl, Vorschau, Eingaben oder Herkunft zu verlieren.
//   A9  Das Erweiterungspaket typprüft. `extensions/klara-browser/tsconfig.json` hatte bis hier
//       KEINEN Aufrufer im Tor — `checkJs` galt, wurde aber nie gefahren.
//   A10 Jede Lückenklasse hat in BEIDEN Sprachen eine eigene Beschriftung. Fehlte eine, zeigte die
//       Leiste dank des `t()`-Rückfalls einen FALSCHEN Satz statt einer Leerstelle.
//
// DIE VIER GEGENFÄLLE AUS BENS PRÜFUNG DER RUNDE 1 — jeder war rot, jeder ist jetzt eine Prüfung:
//
//   B1  Die OFFENE Seitenleiste zeigt eine neue Übernahme von selbst (Korrekturpflicht 1).
//   B2  Verwerfen und neu markieren ebenso — ohne „Status erneut prüfen" (Korrekturpflicht 1).
//   B3  Ein versteckter Artikel verdrängt den sichtbaren nicht, auch nicht über einen versteckten
//       Vorfahren (Korrekturpflicht 2).
//   B4  Ohne erkannten Artikel gibt es keinen Artikel; die ganze Seite kommt nur auf ausdrückliche
//       Wahl (Korrekturpflicht 3).
//   B5  Dasselbe Bild mehrfach sprengt den Bildvorrat nicht, und die übergangenen Bilder stehen
//       mit Adresse unter „Nicht übernommen" (Korrekturpflicht 4).
//
// DER GEGENFALL AUS BENS PRÜFUNG DER RUNDE 2 — die eine Stelle, die B1/B2 nicht erreichten:
//
//   B6  Die Erfassung wird fertig, WÄHREND die Leiste ihre erste Zustandsantwort abwartet. Die
//       Antwort auf den leeren Zustand darf nicht stehen bleiben; der Bedarf wird nachgeholt, und
//       zwar genau einmal (Korrekturpflicht 1 der Runde 2).
//
// Der Wiederöffnungsnachweis im echten Klarwerk-Client (Korrekturpflicht 6) steht in
// `tests/klara-browser/wiederoeffnen.test.tsx` — er braucht React und eine jsdom-Umgebung.
//
// DIE UMGEBUNG WIRD GESTELLT, NIE DER PRÜFLING. jsdom lädt keine Bilder und hat keine
// Zeichenfläche; beides ist BROWSER, nicht Klara. Deshalb bekommt das Dokument hier eine echte
// Zeichenflächen-Regel (fremde Herkunft färbt ein und wirft, genau wie in Chrome) und wahlweise
// geladene Bilder. `selection.js`, `worker.js` und `panel.js` laufen unverändert.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Variants } from "../../extensions/klara-browser/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { harness, read, verfahren } from "./harness";
import { mount, windows as panelWindows } from "./panel-dom";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options?: object,
  ) => { window: Window & typeof globalThis & { eval(code: string): unknown } };
};
const windows: (Window & typeof globalThis)[] = [];
afterEach(() => {
  for (const window of windows.splice(0)) window.close();
  for (const window of panelWindows.splice(0)) window.close();
});

/** Ein 1×1-PNG. Echte Bytes, keine Zeichenkette, die so aussieht. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type CaptureResult = { text: string; title: string; url: string; variants: Variants };

/**
 * Ein Dokument mit BROWSER-Verhalten, das jsdom nicht mitbringt: geladene Bilder und eine
 * Zeichenfläche, die bei fremder Herkunft wirft. Beides ist die Regel echter Browser.
 */
function seite(
  markup: string,
  url: string,
  options: { title?: string; select?: string; laden?: boolean; gross?: boolean } = {},
) {
  const dom = new JSDOM(`<title></title>${markup}`, { url, runScripts: "outside-only" });
  const win = dom.window;
  windows.push(win);
  win.document.title = options.title ?? "Testseite";
  if (options.laden !== false) {
    for (const [name, value] of [
      ["complete", true],
      ["naturalWidth", 800],
      ["naturalHeight", 600],
    ] as const)
      Object.defineProperty(win.HTMLImageElement.prototype, name, {
        configurable: true,
        get: () => value,
      });
    Object.defineProperty(win.HTMLImageElement.prototype, "currentSrc", {
      configurable: true,
      get(this: HTMLImageElement) {
        return this.src;
      },
    });
  }
  let gezeichnet: HTMLImageElement | null = null;
  Object.defineProperty(win.HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({
      drawImage: (image: HTMLImageElement) => {
        gezeichnet = image;
      },
    }),
  });
  Object.defineProperty(win.HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: () => {
      const quelle = gezeichnet?.src ?? "";
      // Genau die Chrome-Regel: ein Bild fremder Herkunft färbt die Fläche ein.
      if (quelle.startsWith("http") && new URL(quelle).origin !== new URL(url).origin)
        throw new Error("SecurityError: tainted canvas");
      // `gross` liefert ein Bild von 500.000 Zeichen: zwei passen in den Vorrat von 1.200.000,
      // das dritte nicht mehr. Genau daran hängt B5.
      return options.gross ? `${PNG.slice(0, PNG.indexOf(",") + 1)}${"A".repeat(500000)}` : PNG;
    },
  });
  if (options.select) {
    const node = win.document.querySelector(options.select);
    if (!node) throw new Error(`Markierung fehlt: ${options.select}`);
    const range = win.document.createRange();
    range.selectNodeContents(node);
    win.getSelection()?.addRange(range);
  }
  return { win, result: win.eval(read("selection.js")) as CaptureResult };
}

const TECHNIK = `
  <nav><a href="/start">Start</a></nav>
  <article>
    <h1>Lokale Statusseite</h1>
    <h2>Netzwerkanschluss</h2>
    <p>Der Anschluss meldet den Verbindungszustand.</p>
    <table><tr><th>Anschluss</th><th>Zustand</th></tr><tr><td>WAN 1</td><td>aktiv</td></tr></table>
    <figure>
      <img src="/bilder/anschluss.png" alt="Anschlussbild" />
      <figcaption>Rückseite mit beschrifteten Anschlüssen</figcaption>
    </figure>
    <p>${"Weitere technische Erläuterung zur Warteschlange. ".repeat(6)}</p>
  </article>
  <aside>NICHT IM ARTIKEL</aside>`;

async function realApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Browser 3279", email: "b3279@example.test", password: "test-password-3279" },
  });
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    calls.push(url);
    const response = await app.inject({
      // JOB 3280: durchgereicht statt verengt — seit CHR-07 gibt es `PUT /api/drafts/:id`, und
      // eine Brücke, die ihn als GET absetzt, misst den Aktualisierungsweg nicht.
      method: verfahren(options),
      url: new URL(url).pathname,
      headers: options?.headers as Record<string, string>,
      ...(options?.body !== undefined ? { payload: String(options.body) } : {}),
    });
    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
    });
  };
  return { app, calls, fetcher };
}

/** Der Weg bis zur bereiten Vorschau: echte Seite → echtes Inhaltsskript → echter Worker. */
async function bis_vorschau(
  markup: string,
  url: string,
  options: { title?: string; select?: string; laden?: boolean; gross?: boolean } = {},
) {
  const { app, calls, fetcher } = await realApp();
  const { result } = seite(markup, url, options);
  const h = harness(fetcher);
  h.setSelected({
    text: result.text,
    url: result.url,
    title: result.title,
    variants: result.variants,
  });
  await h.capture();
  await h.send({
    type: "login",
    email: "b3279@example.test",
    password: "test-password-3279",
  });
  return { app, calls, h, result };
}

/** Dieselbe Zeichenkette durch dieselbe Serialisierung — sonst vergliche man Schreibweisen. */
function alsMarkup(html: string) {
  const dom = new JSDOM(`<div id="probe">${html.replace(/ data-image-id="[^"]*"/g, "")}</div>`);
  const probe = dom.window.document.getElementById("probe");
  const out = probe?.innerHTML ?? "";
  dom.window.close();
  return out;
}

const speichern = {
  type: "save",
  form: { title: "Statusseite", context: "Warum wichtig", confidentiality: "intern" },
};

describe("JOB 3279 · Umfang, Bilder und Herkunft in der Klara-Seitenleiste", () => {
  it("A1 · der Artikel trägt Überschrift, Tabelle und Bild mit Bildunterschrift und Quelle", () => {
    const { result } = seite(TECHNIK, "https://status.example.test/local");
    const artikel = result.variants.article;
    expect(artikel.available).toBe(true);
    const tags = JSON.stringify(artikel.nodes);
    expect(tags, "Überschrift fehlt").toContain('"tag":"h2"');
    expect(tags, "Tabelle fehlt").toContain('"tag":"table"');
    expect(tags, "Bildhülle fehlt").toContain('"tag":"figure"');
    expect(artikel.images).toBe(1);
    expect(tags).toContain(PNG);
    // Bildunterschrift UND Quelladresse stehen am Bild — beides, nicht eines von beiden.
    expect(tags).toContain("Rückseite mit beschrifteten Anschlüssen");
    expect(tags).toContain("https://status.example.test/bilder/anschluss.png");
    expect(artikel.text).toContain("Netzwerkanschluss");
    // Der Artikel ist der Hauptinhalt, nicht die ganze Seite.
    expect(artikel.text).not.toContain("NICHT IM ARTIKEL");
    expect(result.variants.page.text).toContain("NICHT IM ARTIKEL");
    // Ein Verweis überlebt als Text, seine Zieladresse nicht — und das steht als Lücke da.
    expect(result.variants.page.gaps.map((gap) => gap.kind)).toContain("links");
  });

  it("A2 · Rahmen, nicht geladenes und fremdes Bild stehen mit Adresse unter „Nicht übernommen“", () => {
    const markup = `<article><h2>Titel</h2><p>${"Text zur Erklärung. ".repeat(20)}</p>
      <iframe src="https://fremd.example.test/rahmen"></iframe>
      <img src="https://cdn.example.test/fern.png" alt="Fern" />
      <video src="/film.mp4"></video>
      <form><input name="q" /><button>Los</button></form></article>`;
    const { result } = seite(markup, "https://status.example.test/local");
    const gaps = result.variants.article.gaps;
    const kinds = gaps.map((gap) => gap.kind);
    expect(kinds).toContain("embedded");
    expect(kinds).toContain("media");
    expect(kinds).toContain("form");
    expect(kinds).toContain("image_blocked");
    expect(gaps.find((gap) => gap.kind === "embedded")?.detail).toBe(
      "https://fremd.example.test/rahmen",
    );
    expect(gaps.find((gap) => gap.kind === "image_blocked")?.detail).toBe(
      "https://cdn.example.test/fern.png",
    );
    expect(result.variants.article.images).toBe(0);
    expect(JSON.stringify(result.variants.article.nodes)).not.toContain("cdn.example.test");

    // Ein Bild, das noch gar nicht geladen ist, wird nicht als „übernommen" behauptet.
    const nochNicht = seite(
      `<article><h2>T</h2><p>${"Text. ".repeat(50)}</p><img src="/spaet.png" alt="Spät" /></article>`,
      "https://status.example.test/local",
      { laden: false },
    );
    expect(nochNicht.result.variants.article.gaps.map((gap) => gap.kind)).toContain(
      "image_pending",
    );
    expect(nochNicht.result.variants.article.images).toBe(0);
  });

  it("A3 · gibt es eine Markierung, ist sie der Standard — und der Entwurf enthält nur sie", async () => {
    const { app, h } = await bis_vorschau(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    try {
      const vorschau = await h.send({ type: "state" });
      expect(vorschau.status).toBe("preview");
      expect(vorschau.mode).toBe("selection");
      expect(vorschau.variants?.selection.text).toBe("Netzwerkanschluss");
      // Ausweitung ist möglich, geschieht aber nicht von selbst.
      expect(vorschau.variants?.article.available).toBe(true);
      expect(vorschau.variants?.page.available).toBe(true);
      const gespeichert = await h.send(speichern);
      expect(gespeichert.status).toBe("saved");
      const koerper = await koerperVon(app, h, gespeichert.link);
      expect(koerper).toContain("Netzwerkanschluss");
      expect(koerper).toContain("Umfang / Scope: Markierung / Selection");
      expect(koerper).not.toContain("WAN 1");
      expect(koerper).not.toContain("NICHT IM ARTIKEL");
    } finally {
      await app.close();
    }
  });

  it("A4 · der Wechsel auf den Artikel ist eine bewusste Wahl und entwertet die Bestätigung", async () => {
    const { app, h } = await bis_vorschau(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    const view = await mount({ an: h });
    try {
      await view.settle();
      expect(view.el("mode-selection").checked).toBe(true);
      expect(view.el("mode-article").disabled).toBe(false);
      view.el("confirm").checked = true;
      view.el("mode-article").checked = true;
      view.el("mode-article").dispatchEvent(new view.win.Event("change", { bubbles: true }));
      await view.settle();
      expect(view.el("confirm").checked, "Bestätigung überlebte den Umfangswechsel").toBe(false);
      expect(view.plain("content")).toContain("WAN 1");
      expect(view.el("content").querySelector("table")).not.toBeNull();
      expect(view.el("content").querySelector("img")?.getAttribute("src")).toBe(PNG);
      expect((await h.send({ type: "state" })).mode).toBe("article");
    } finally {
      await app.close();
    }
  });

  it("A5 · ein Tabwechsel meldet sich, überschreibt die Herkunft aber nicht", async () => {
    const { app, h } = await bis_vorschau(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    const view = await mount({ an: h });
    try {
      await view.settle();
      const vorher = ["page", "source", "captured", "scope-value"].map(
        (id) => view.el(id).textContent,
      );
      expect(view.el("source-changed").hidden).toBe(true);
      await h.listeners.activated?.({ tabId: 4711 });
      const danach = await h.send({ type: "state" });
      expect(danach.sourceChanged).toBe(true);
      expect(danach.selection?.url).toBe("https://status.example.test/local");
      await view.settle();
      view.el("refresh").click();
      await view.settle();
      expect(view.el("source-changed").hidden).toBe(false);
      expect(
        ["page", "source", "captured", "scope-value"].map((id) => view.el(id).textContent),
        "Der Tabwechsel hat die Herkunft überschrieben",
      ).toEqual(vorher);
    } finally {
      await app.close();
    }
  });

  it("A6 · Chat-KI wird gekennzeichnet, eine Seite die nur so heißt nicht", async () => {
    const markup = `<article><h2>Antwort</h2><p>${"Ein Vorschlag der Chat-KI. ".repeat(20)}</p></article>`;
    const ki = await bis_vorschau(markup, "https://chatgpt.com/c/1234");
    try {
      const view = await mount({ an: ki.h });
      await view.settle();
      expect((await ki.h.send({ type: "state" })).aiChat).toBe(true);
      expect(view.el("ai-chat").hidden).toBe(false);
      const gespeichert = await ki.h.send(speichern);
      expect(await koerperVon(ki.app, ki.h, gespeichert.link)).toContain(
        "KI-Chat, ungeprüft / AI chat, unverified",
      );
    } finally {
      await ki.app.close();
    }
    const fremd = await bis_vorschau(markup, "https://www.perplexity.ai.evil.test/guide");
    try {
      expect((await fremd.h.send({ type: "state" })).aiChat).toBe(false);
    } finally {
      await fremd.app.close();
    }
  });

  it("A7 · die Vorschau IST der gespeicherte Inhalt, Bild und Beschriftung inbegriffen", async () => {
    const { app, h } = await bis_vorschau(TECHNIK, "https://status.example.test/local");
    const view = await mount({ an: h });
    try {
      await view.settle();
      // Ohne Markierung ist der Artikel der Standard — nicht die ganze Seite.
      expect((await h.send({ type: "state" })).mode).toBe("article");
      view.input("title", speichern.form.title);
      view.input("context", speichern.form.context);
      view.el("confidentiality").value = speichern.form.confidentiality;
      view.el("confidentiality").dispatchEvent(new view.win.Event("input", { bubbles: true }));
      await view.settle();
      view.el("confirm").checked = true;
      view.el("confirm").dispatchEvent(new view.win.Event("change"));
      view.el("save").click();
      await view.settle();
      expect(view.el("status").textContent).toContain("ungeprüfter Entwurf gespeichert");
      const draft = await draftVon(app, h);
      // Der gespeicherte Körper und die gezeichnete Vorschau sind DASSELBE Markup.
      expect(view.el("content").innerHTML).toBe(alsMarkup(String(draft.payload.bodyHtml)));
      // Und das Bild ist nach dem Wiederöffnen wirklich da, mit Beschriftung und Quelle.
      const wieder = new JSDOM(`<div id="p">${draft.payload.bodyHtml}</div>`);
      const bild = wieder.window.document.querySelector("figure img");
      expect(bild?.getAttribute("src")).toBe(PNG);
      const unterschrift = wieder.window.document.querySelector("figure figcaption")?.textContent;
      expect(unterschrift).toContain("Rückseite mit beschrifteten Anschlüssen");
      expect(unterschrift).toContain("https://status.example.test/bilder/anschluss.png");
      wieder.window.close();
    } finally {
      await app.close();
    }
  });

  it("A8 · DE↔EN wechselt sofort, ohne Vorschau, Eingaben oder Herkunft zu verlieren", async () => {
    const { app, h } = await bis_vorschau(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    const gemerkt: { language?: string | null } = {};
    const view = await mount({ an: h, sprache: gemerkt });
    try {
      await view.settle();
      // Standard ist Deutsch, obwohl navigator.language in jsdom „en-US" meldet.
      expect(view.win.navigator.language.startsWith("de")).toBe(false);
      expect(view.el("language").value).toBe("de");
      view.input("title", "Eigener Titel");
      view.input("context", "Eigene Notiz");
      await view.settle();
      const vorschauVorher = view.el("content").innerHTML;
      const herkunftVorher = view.el("source").textContent;
      view.el("language").value = "en";
      view.el("language").dispatchEvent(new view.win.Event("change"));
      expect(view.el("save").textContent).toBe("Confirm and save draft");
      expect(view.win.document.body.textContent).toContain("Capture scope");
      expect(
        view.el("content").innerHTML,
        "Die Vorschau hat den Sprachwechsel nicht überlebt",
      ).toBe(vorschauVorher);
      expect(view.el("title").value).toBe("Eigener Titel");
      expect(view.el("context").value).toBe("Eigene Notiz");
      expect(view.el("source").textContent).toBe(herkunftVorher);
      expect(view.el("mode-selection").checked).toBe(true);
      expect(gemerkt.language).toBe("en");

      // Beim nächsten Öffnen führt die gemerkte Wahl.
      const zweite = await mount({ an: h, sprache: gemerkt });
      await zweite.settle();
      expect(zweite.el("language").value).toBe("en");
      expect(zweite.el("save").textContent).toBe("Confirm and save draft");
    } finally {
      await app.close();
    }
  });

  it("A10 · jede Lückenklasse des Workers hat in BEIDEN Sprachen eine eigene Beschriftung", () => {
    // `t()` in panel.js fällt bei einem unbekannten Schlüssel auf den Speicherfehler-Text zurück.
    // Eine fehlende Übersetzung wäre also kein leeres Feld, sondern eine FALSCHE Aussage in der
    // Lückenliste. Die Klassenliste wird deshalb aus dem Worker selbst gelesen, nicht abgeschrieben.
    const worker = read("worker.js");
    const block = worker.slice(
      worker.indexOf("const GAP_TEXT = {"),
      worker.indexOf("\n  };", worker.indexOf("const GAP_TEXT = {")),
    );
    const kinds = [...block.matchAll(/^\s{4}([a-z_]+):/gm)].map((treffer) => treffer[1]);
    expect(kinds.length, "keine einzige Lückenklasse gefunden — der Fall misst nichts").toBe(12);
    const dom = new JSDOM("<!doctype html>", { runScripts: "outside-only" });
    dom.window.eval(read("i18n.js"));
    const copy = dom.window.eval("globalThis.KLARA_TEXT") as Record<
      "de" | "en",
      Record<string, string>
    >;
    for (const kind of kinds)
      for (const language of ["de", "en"] as const)
        expect(copy[language][`gap_${kind}`], `gap_${kind} fehlt in ${language}`).toBeTruthy();
    dom.window.close();
  });

  // ==============================================================================================
  // JOB 3279 R2 — DIE VIER GEGENFÄLLE AUS BENS PRÜFUNG, ALS DAUERHAFTE PRÜFUNGEN.
  // ==============================================================================================
  //
  // Jeder dieser Fälle war in Runde 1 ROT und ist der Grund für genau eine Korrektur. Sie stehen
  // hier, damit die Klasse nicht ein zweites Mal unbemerkt zurückkommt.

  it("B1 · die OFFENE Leiste zeigt eine neue Übernahme von selbst — ohne „Status erneut prüfen“", async () => {
    // Die Leiste steht seit JOB 3278 neben der Seite. Sie wird hier VOR jeder Erfassung gemountet.
    const view = await mount({ auswahl: false });
    await view.settle();
    expect(view.el("preview").hidden, "die Leiste zeigt vor der Erfassung eine Vorschau").toBe(
      true,
    );
    const { result } = seite(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    view.setSelected({
      text: result.text,
      url: result.url,
      title: result.title,
      variants: result.variants,
    });
    const vorher = view.messages.length;
    await view.capture();
    await view.settle();
    // KEIN Klick auf „Status erneut prüfen" dazwischen — die Leiste hat sich selbst nachgeholt.
    expect(view.messages.slice(vorher), "die Leiste hat gar nicht nachgefragt").not.toEqual([]);
    expect(view.el("preview").hidden, "die neue Übernahme erschien nicht").toBe(false);
    expect(view.el("page").textContent).toBe("Testseite");
    expect(view.plain("content")).toContain("Netzwerkanschluss");
    expect(view.el("mode-selection").checked).toBe(true);
  });

  it("B2 · verwerfen und neu markieren erscheint ebenfalls ohne Zutun", async () => {
    const view = await mount();
    await view.settle();
    expect(view.el("preview").hidden).toBe(false);
    view.el("cancel").click();
    await view.settle();
    expect(view.el("preview").hidden, "das Verwerfen räumte die Vorschau nicht").toBe(true);
    const { result } = seite(TECHNIK, "https://status.example.test/zweite", {
      select: "article h2",
    });
    view.setSelected({
      text: result.text,
      url: result.url,
      title: result.title,
      variants: result.variants,
    });
    await view.capture();
    await view.settle();
    expect(view.el("preview").hidden, "die zweite Übernahme erschien nicht").toBe(false);
    expect(view.el("source").textContent).toBe("https://status.example.test/zweite");
  });

  it("B3 · ein versteckter Artikel verdrängt den sichtbaren nicht — auch nicht über einen versteckten Vorfahren", () => {
    const versteckt = `
      <article hidden><h2>Verborgen</h2><p>${"Verborgener Text der niemals sichtbar ist. ".repeat(20)}</p></article>
      <article><h2>Sichtbar</h2><p>${"Sichtbarer Text der Seite. ".repeat(12)}</p></article>`;
    const a = seite(versteckt, "https://status.example.test/local");
    expect(a.result.variants.article.text, "der versteckte Artikel gewann").not.toContain(
      "Verborgen",
    );
    expect(a.result.variants.article.text).toContain("Sichtbar");
    expect(a.result.variants.page.text, "die Seite nahm verborgenen Text mit").not.toContain(
      "Verborgener Text",
    );

    // Derselbe Fall eine Etage höher: der Artikel selbst trägt kein `hidden`, sein Vorfahre schon.
    const vorfahre = `
      <div style="display:none"><article><h2>Verborgen</h2><p>${"Verborgener Text der niemals sichtbar ist. ".repeat(20)}</p></article></div>
      <article><h2>Sichtbar</h2><p>${"Sichtbarer Text der Seite. ".repeat(12)}</p></article>`;
    const b = seite(vorfahre, "https://status.example.test/local");
    expect(b.result.variants.article.text, "der Vorfahre wurde nicht geprüft").not.toContain(
      "Verborgen",
    );
    expect(b.result.variants.article.text).toContain("Sichtbar");
  });

  it("B4 · ohne erkannten Artikel gibt es keinen Artikel — und die ganze Seite nur auf ausdrückliche Wahl", async () => {
    // Eine Seite ohne Artikelbereich: nur kurze Fetzen, keiner erreicht die Erkennungsschwelle.
    const fetzen = "<nav>Start</nav><span>Kurz</span><footer>Ende</footer>";
    const { result } = seite(fetzen, "https://status.example.test/local");
    expect(result.variants.article.available, "es wurde ein Artikel erfunden").toBe(false);
    expect(JSON.stringify(result.variants.article.nodes)).toBe("[]");
    expect(result.variants.page.available, "die Seite selbst ist übernehmbar").toBe(true);

    const view = await mount({ auswahl: false });
    view.setSelected({
      text: result.text,
      url: result.url,
      title: result.title,
      variants: result.variants,
    });
    await view.capture();
    await view.login();
    await view.settle();
    expect(view.el("preview").hidden).toBe(false);
    // KEIN Umfang ist vorbelegt — die ganze Seite kommt nicht von selbst.
    for (const modus of ["selection", "article", "page"])
      expect(view.el(`mode-${modus}`).checked, `${modus} war ungefragt gewählt`).toBe(false);
    expect(view.el("scope-none").hidden, "der Hinweis auf die fehlende Wahl fehlt").toBe(false);
    view.input("title", "Eigener Titel");
    await view.settle();
    view.el("confirm").checked = true;
    view.el("confirm").dispatchEvent(new view.win.Event("change"));
    expect(view.el("save").disabled, "ohne Umfang liess sich speichern").toBe(true);
    expect((await view.send({ type: "state" })).mode).toBe("");

    // Erst die ausdrückliche Wahl macht die Seite zum Umfang.
    view.el("mode-page").checked = true;
    view.el("mode-page").dispatchEvent(new view.win.Event("change", { bubbles: true }));
    await view.settle();
    expect((await view.send({ type: "state" })).mode).toBe("page");
    expect(view.el("scope-none").hidden).toBe(true);
    view.el("confirm").checked = true;
    view.el("confirm").dispatchEvent(new view.win.Event("change"));
    expect(view.el("save").disabled).toBe(false);
  });

  it("B5 · dasselbe Bild mehrfach sprengt den Vorrat nicht und die übergangenen Bilder werden benannt", () => {
    // Vier grosse Bilder derselben Adresse: der Zwischenspeicher liefert die Bytes ab dem zweiten
    // Mal sofort — genau dort ging in Runde 1 die Vorratsprüfung verloren.
    const gross = `<article><h2>Bilder</h2><p>${"Text zum Bild. ".repeat(30)}</p>
      ${'<figure><img src="/gross.png" alt="Gross" /><figcaption>Dasselbe Bild</figcaption></figure>'.repeat(4)}</article>`;
    const { result } = seite(gross, "https://status.example.test/local", { gross: true });
    const artikel = result.variants.article;
    const bytes = [
      ...JSON.stringify(artikel.nodes).matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g),
    ]
      .map((treffer) => treffer[0].length)
      .reduce((a, b) => a + b, 0);
    expect(artikel.images, "kein einziges Bild kam mit").toBeGreaterThan(0);
    expect(bytes, "der Bildvorrat wurde überschritten").toBeLessThanOrEqual(1200000);
    expect(
      artikel.gaps.map((gap) => gap.kind),
      "die übergangenen Bilder wurden verschwiegen",
    ).toContain("image_large");
    expect(artikel.gaps.find((gap) => gap.kind === "image_large")?.detail).toBe(
      "https://status.example.test/gross.png",
    );
    // Und der zweite Umfang beginnt mit vollem Vorrat: derselbe Zwischenspeicher darf ihn nicht
    // aus dem ersten Umfang heraus als „zu gross" verurteilen.
    expect(result.variants.page.images).toBe(artikel.images);
  });

  it("B6 · die Erfassung wird fertig, WÄHREND die Leiste aufbaut — die veraltete erste Antwort bleibt nicht stehen", async () => {
    // BENS GEGENFALL AUS RUNDE 2, WÖRTLICH. B1/B2 messen die Leiste NACH ihrem Aufbau; genau das
    // liess die gefährlichste Stelle offen. Die letzte Zeile von `panel.js` fragt den Zustand MIT
    // Sperre ab. Trifft das Erfassungsergebnis in diesem Fenster ein, sah `refresh()` `busy` und
    // gab auf — die veraltete, leere Antwort wurde gezeichnet und blieb stehen.
    const view = await mount({ auswahl: false, haltErsteAntwort: true });
    const { result } = seite(TECHNIK, "https://status.example.test/local", {
      select: "article h2",
    });
    view.setSelected({
      text: result.text,
      url: result.url,
      title: result.title,
      variants: result.variants,
    });
    // Der Worker beantwortet die Aufbaufrage zu Ende (er sperrt sich selbst, solange er an ihr
    // sitzt); nur die ZUSTELLUNG an die Leiste hängt weiter. Die Erfassung läuft danach vollständig
    // durch und stellt ihre Speichermeldungen zu — die Leiste wartet dabei noch auf die Antwort
    // auf den LEEREN Zustand.
    await view.tick();
    await view.capture();
    expect(
      view.data.work,
      "die Erfassung selbst kam nicht durch — der Fall misst etwas anderes",
    ).toBeTruthy();
    expect(
      view.el("preview").hidden,
      "die Vorschau war schon da — dann hält der Prüfstand die erste Antwort gar nicht",
    ).toBe(true);

    // Erst jetzt kommt sie an. Sie ist leer und veraltet; die Leiste muss selbst nachfassen.
    await view.freigeben();
    expect(view.el("preview").hidden, "die Leiste blieb auf der veralteten Antwort stehen").toBe(
      false,
    );
    expect(view.el("page").textContent).toBe("Testseite");
    expect(view.plain("content")).toContain("Netzwerkanschluss");
    expect(view.el("mode-selection").checked).toBe(true);

    // UND SIE FRAGT NICHT WEITER. Ein Nachholen, das sich selbst auslöst, wäre eine Abfrage-
    // schleife über das Netz — dieselbe Klasse, gegen die `andereUebernahme()` gebaut ist.
    const ruhe = view.messages.length;
    await view.settle();
    await view.settle();
    expect(view.messages.length, "die Leiste fragt in Ruhe weiter — Abfrageschleife").toBe(ruhe);
  });

  it("A9 · das Erweiterungspaket typprüft mit checkJs", () => {
    // `extensions/klara-browser/tsconfig.json` gab es seit JOB 3203; gefahren hat sie im Tor
    // niemand. Dieser Fall ist ihr Aufrufer.
    execFileSync("npx", ["tsc", "--noEmit", "-p", "extensions/klara-browser/tsconfig.json"], {
      cwd: join(__dirname, "..", ".."),
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  });
});

type Draft = { payload: { bodyHtml?: string } & Record<string, unknown> };
async function draftVon(
  app: Awaited<ReturnType<typeof realApp>>["app"],
  h: ReturnType<typeof harness>,
) {
  const zustand = await h.send({ type: "state" });
  return koerperDraft(app, h, zustand.link);
}
async function koerperDraft(
  app: Awaited<ReturnType<typeof realApp>>["app"],
  h: ReturnType<typeof harness>,
  link: string | undefined,
): Promise<Draft> {
  const id = new URL(String(link)).searchParams.get("draft");
  const response = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: { authorization: `Bearer ${(h.data.auth as { token: string }).token}` },
  });
  expect(response.statusCode).toBe(200);
  return response.json() as Draft;
}
async function koerperVon(
  app: Awaited<ReturnType<typeof realApp>>["app"],
  h: ReturnType<typeof harness>,
  link: string | undefined,
) {
  return String((await koerperDraft(app, h, link)).payload.bodyHtml);
}
