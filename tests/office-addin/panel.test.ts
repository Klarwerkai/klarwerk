// ================================================================================================
// aufnahme:20260922:excel-erster-weg · WAS FÜR ALLE ABLÄUFE DES FENSTERS GILT
// ================================================================================================
//
// Die Ablauftests (`excel-fenster`, `powerpoint-fenster`) zeigen, was ein Lauf tut. Hier steht, was
// über ALLE Läufe gilt, gemessen an den ausgelieferten Dateien:
//   F1  einzige fremde Quelle ist office.js; alles andere relativ und mit Fassungsstempel
//   F2  KO-06-05: jede Anleitungszeile und jede Verdrahtung zeigt auf ein vorhandenes Bedienelement
//   F3  nur vorhandene same-origin-Endpunkte — keine zweite Assistenz, kein zweites Login
//   F4  KO-04-05: das Fenster kennt keine Bild-, Form- oder Figurenerzeugung im Dokument
//   F5  jede Schreibstelle steht hinter ihrer Zielprüfung; Klara speichert nicht selbst
//   F6  PP-02 (`folien-herkunft.js`): nur lesend, nur über den Abrufweg des Fensters, nur die
//       vorhandenen PP-02-/Artikelwege
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { ORDNER, lies } from "./buehne";

const SEITE = lies("taskpane.html");
const SKRIPT = lies("taskpane.js");
const KERN = lies("hostkern.js");
const HERKUNFT = lies("folien-herkunft.js");

/** Nur die Zeilen, die etwas TUN — Kommentare dürfen einen Namen nennen, ohne ihn zu benutzen. */
function ausfuehrbar(text: string): string {
  return text
    .split("\n")
    .filter((zeile) => !/^\s*\/\//.test(zeile))
    .join("\n");
}

function alle(text: string, muster: RegExp): string[] {
  return [...text.matchAll(muster)].map((m) => m[1] ?? "");
}

function quelltext(pfad: string): string {
  return readFileSync(join(REPO_WURZEL, pfad), "utf8");
}

describe("F1 · die einzige fremde Quelle ist office.js", () => {
  it("Skripte und Stilblatt sind relativ und gestempelt; kein Inline-Skript", () => {
    expect(alle(SEITE, /<script\s+src="([^"]+)"/g)).toEqual([
      "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
      "hostkern.js?v=__KW_FASSUNG__",
      "taskpane.js?v=__KW_FASSUNG__",
      "folien-herkunft.js?v=__KW_FASSUNG__",
    ]);
    expect(alle(SEITE, /<link\s+rel="stylesheet"\s+href="([^"]+)"/g)).toEqual([
      "taskpane.css?v=__KW_FASSUNG__",
    ]);
    expect(SEITE).not.toContain("<script>");
    expect(SEITE).toContain('<meta name="kw-office-fassung" content="__KW_FASSUNG__" />');
  });
});

describe("F1b · Ben-Befund A · ausgeblendete Elemente bleiben ausgeblendet", () => {
  it("das Stilblatt lässt `hidden` vor jeder display-Regel gewinnen", () => {
    const stil = lies("taskpane.css");
    expect(stil).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
    // Genau die Knöpfe aus dem Hostbeleg starten ausgeblendet und tragen eine display-Regel.
    expect(stil).toMatch(/\bbutton\s*\{[^}]*display:\s*block/);
    expect(SEITE).toContain('<button id="anmelden-knopf" type="button" hidden>');
    expect(SEITE).toContain('<button id="ruecknahme" type="button" hidden>');
  });
});

describe("F2 · KO-06-05 · Anleitung und Verdrahtung zeigen auf tatsächliche Bedienelemente", () => {
  const ids = new Set(alle(SEITE, /\sid="([^"]+)"/g));

  it("jede Anleitungszeile hat ein vorhandenes Ziel", () => {
    const ziele = alle(SEITE, /data-ziel="([^"]+)"/g);
    expect(ziele).toEqual([
      "anmelden-knopf",
      "kontext-lesen",
      "frage-text",
      "rueckgabe-block",
      "ruecknahme",
      "herkunft-block",
    ]);
    for (const ziel of ziele) {
      expect(ids.has(ziel), ziel).toBe(true);
    }
  });

  it("jedes Element, das das Skript anspricht, steht im Fenster", () => {
    const angesprochen = new Set(alle(ausfuehrbar(SKRIPT), /\bel\("([^"]+)"\)/g));
    for (const name of ["text", "zeigen", "meldung", "aktiv"]) {
      const muster = new RegExp(`\\b${name}\\("([^"]+)"`, "g");
      for (const id of alle(ausfuehrbar(SKRIPT), muster)) {
        angesprochen.add(id);
      }
    }
    expect(angesprochen.size).toBeGreaterThan(20);
    for (const id of angesprochen) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("jedes Element, das folien-herkunft.js anspricht, steht im Fenster", () => {
    const angesprochen = new Set(alle(ausfuehrbar(HERKUNFT), /\bel\("([^"]+)"\)/g));
    for (const name of ["text", "zeigen"]) {
      for (const id of alle(ausfuehrbar(HERKUNFT), new RegExp(`\\b${name}\\("([^"]+)"`, "g"))) {
        angesprochen.add(id);
      }
    }
    expect(angesprochen.size).toBeGreaterThan(12);
    for (const id of angesprochen) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("F3 · nur vorhandene Endpunkte — der Assistenzkern und die Anmeldung werden wiederverwendet", () => {
  const ERLAUBT = [
    "/api/auth/me",
    "/api/auth/office-handover/redeem",
    "/api/klara/sessions",
    "/api/klara/sessions/",
    "/api/klara/ai-status",
    "/api/drafts",
  ];

  it("das Fenster ruft genau diese same-origin-Pfade und keine fremde Herkunft", () => {
    const pfade = [...new Set(alle(ausfuehrbar(SKRIPT), /"(\/api\/[^"]*)"/g))].sort();
    expect(pfade).toEqual([...ERLAUBT].sort());
    expect(ausfuehrbar(SKRIPT)).not.toMatch(/https?:\/\//);
    expect(ausfuehrbar(KERN)).not.toMatch(/https?:\/\//);
    expect(ausfuehrbar(KERN)).not.toMatch(/\bfetch\(/);
    for (const anhang of ['"/execute"', '"/consent"', '"/close"']) {
      expect(SKRIPT, anhang).toContain(anhang);
    }
  });

  it("jeder dieser Wege besteht im Server bereits — nichts davon ist für Excel neu gebaut", () => {
    const klara = quelltext("services/app/src/routes/klara-ai-routes.ts");
    expect(klara).toContain('"/api/klara/ai-status"');
    expect(klara).toContain('"/api/klara/sessions"');
    expect(klara).toContain('"/api/klara/sessions/:sessionId/consent"');
    expect(klara).toContain('"/api/klara/sessions/:sessionId/close"');
    const ask = quelltext("services/app/src/routes/ask-routes.ts");
    expect(ask).toContain('"/api/klara/sessions/:sessionId/execute"');
    const auth = quelltext("services/auth/src/routes.ts");
    expect(auth).toContain('"/api/auth/office-handover/redeem"');
    expect(quelltext("services/app/src/routes/capture-routes.ts")).toContain('"/api/drafts"');
  });

  it("die Anmeldung nutzt die vorhandene Dialogseite; das Office-Fenster hat keine eigene", () => {
    expect(SKRIPT).toContain('"/word-addin/anmeldung.html"');
    expect(existsSync(join(REPO_WURZEL, "apps/web/public/word-addin/anmeldung.html"))).toBe(true);
    expect(existsSync(join(ORDNER, "anmeldung.html"))).toBe(false);
  });
});

describe("F4 · KO-04-05 · keine Bilder, Formen oder Figuren im Dokument", () => {
  it("das Fenster enthält keinen einzigen Erzeugungsweg dafür", () => {
    const code = ausfuehrbar(SKRIPT) + ausfuehrbar(KERN) + ausfuehrbar(HERKUNFT);
    for (const verbot of [
      "addImage",
      "addGeometricShape",
      "addTextBox",
      "addLine",
      "addTable",
      "insertSlidesFromBase64",
      "shapes.add",
      "setSelectedDataAsync",
      "CoercionType.Image",
      "insertPicture",
      "addPicture",
      "slides.add",
    ]) {
      expect(code, verbot).not.toContain(verbot);
    }
  });
});

describe("F5 · jede Schreibstelle steht hinter ihrer Zielprüfung", () => {
  const code = ausfuehrbar(SKRIPT);

  function funktion(name: string): string {
    const von = code.indexOf(`function ${name}(`);
    const bis = code.indexOf("\n  function ", von + 1);
    expect(von, name).toBeGreaterThan(0);
    return code.slice(von, bis > von ? bis : undefined);
  }

  it("Excel schreibt nur in excelSchreiben (nach Prüfung) und zuruecknehmen (nach Abgleich)", () => {
    expect(alle(code, /(\w+)\.formulas = /g)).toEqual(["ziel", "ziel"]);
    expect(alle(code, /(\w+)\.values = /g)).toEqual(["ziel"]);
    const schreiben = funktion("excelSchreiben");
    const pruefung = schreiben.indexOf("K.excelZielPruefen(plan, lage)");
    expect(pruefung).toBeGreaterThan(0);
    expect(schreiben.indexOf("ziel.formulas = [[plan.inhalt]]")).toBeGreaterThan(pruefung);
    const textStelle = schreiben.indexOf("ziel.values = [[K.zellTextSicher(plan.inhalt)]]");
    expect(textStelle).toBeGreaterThan(pruefung);
  });

  it("PowerPoint schreibt nur den Text der geprüften Form", () => {
    expect(alle(code, /(\w+(?:\.\w+)*)\.text = /g)).toEqual(["ziel.tr", "ziel.tr"]);
    const schreiben = funktion("pptSchreiben");
    const pruefung = schreiben.indexOf("K.pptZielPruefen(plan, lage)");
    expect(pruefung).toBeGreaterThan(0);
    expect(schreiben.indexOf("ziel.tr.text = plan.inhalt")).toBeGreaterThan(pruefung);
  });

  it("Klara speichert nicht selbst und sagt das im Fenster", () => {
    expect(code).not.toMatch(/\.save\(/);
    expect(SEITE).toContain("Klara speichert nicht selbst.");
  });
});

describe("F6 · PP-02 · die Herkunft im Fenster liest nur", () => {
  const code = ausfuehrbar(HERKUNFT);

  it("nur die vorhandenen Wege: Artikel lesen und den PP-02-Abgleich, über den Abrufweg des Fensters", () => {
    expect([...new Set(alle(code, /"(\/api\/[^"]*)"/g))].sort()).toEqual(["/api/kos/"]);
    expect(code).toContain('"/folien-abgleich"');
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/\bfetch\(/);
    // Prüfbefund B5 (18.10.2026): der Abgleich übergibt seine eigene, größenabhängige Frist.
    expect(code).toContain("f.abruf(pfad, init, fristMs)");
    expect(SKRIPT).toContain("abruf: abruf,");
    const route = quelltext("services/app/src/routes/praesentation-daten-routes.ts");
    expect(route).toContain('"/api/kos/:id/office/:anhangId/folien-abgleich"');
    expect(quelltext("services/app/src/routes/ko-routes.ts")).toContain('"/api/kos/:id"');
  });

  it("kein Schreiben ins Dokument: keine Textzuweisung, kein Speichern, keine Einstellungen", () => {
    expect(code).not.toMatch(/\.text = /);
    expect(code).not.toMatch(/\.(values|formulas) = /);
    expect(code).not.toMatch(/\.save\(|saveAsync|settings\.set|setSelectedShapes/);
    expect(code).not.toContain("innerHTML");
  });

  it("Hostlauf H01: hidden gilt für die Knöpfe des Abschnitts (button { display: block } überstimmt es sonst)", () => {
    const css = lies("taskpane.css");
    expect(css).toMatch(/button\s*\{\s*display:\s*block;/);
    expect(css).toContain("#herkunft-block button[hidden] { display: none; }");
  });
});
