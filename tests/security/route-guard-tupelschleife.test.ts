import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { schutzartVon } from "./routeGuardAudit";
import { erhebeRegistrierungen } from "./schnittstellenErhebung";

const DATEI = "services/app/src/beliebige-tabelle.ts";
const AUFRUF = 'app.get(adresse, async (_request, reply) => reply.send("html"))';
const TABELLE =
  '[["/beliebig/eins", "eins.html", naechsteFassung()], [ZIEL, "zwei.html", fassung]]';
const quelle = (
  tabelle = `${TABELLE} as const`,
  bindung = "const [adresse, datei, version]",
  davor = "",
) =>
  [
    'const ZIEL = "/beliebig/zwei";',
    "function registriere(fassung) {",
    `  for (${bindung} of ${tabelle}) {`,
    `    ${davor}`,
    `    ${AUFRUF};`,
    "  }",
    "}",
  ].join("\n");
const erhebe = (text: string) => erhebeRegistrierungen(DATEI, text);

describe("Unabhaengige Erhebung · feste Tupelschleife", () => {
  it("liest beliebige feste Tabellenpfade samt Datei, Zeile und Aufruf sowie beide echten Word-Seiten", () => {
    for (const tabelle of [TABELLE, `${TABELLE} as const`]) {
      const fund = erhebe(quelle(tabelle));
      expect(fund.unlesbar).toEqual([]);
      expect(fund.registrierungen).toEqual(
        ["/beliebig/eins", "/beliebig/zwei"].map((pfad) => ({
          methode: "GET",
          pfad,
          datei: DATEI,
          zeile: 5,
          aufruf: AUFRUF,
        })),
      );
    }
    const datei = "services/app/src/web-static.ts";
    const echt = erhebeRegistrierungen(datei, readFileSync(join(REPO_WURZEL, datei), "utf8"));
    expect(echt.unlesbar).toEqual([]);
    const word = echt.registrierungen.filter((r) => r.pfad.startsWith("/word-addin/"));
    expect(word.map((r) => r.pfad)).toEqual([
      "/word-addin/taskpane.html",
      "/word-addin/begleitung.html",
    ]);
    expect(
      word.every(
        (r) =>
          r.methode === "GET" &&
          r.datei === datei &&
          r.zeile === 95 &&
          r.aufruf.startsWith("app.get(pfad,") &&
          schutzartVon(r.aufruf) === "public",
      ),
    ).toBe(true);
    expect(echt.registrierungen.map((r) => r.pfad)).toEqual([
      "/word-addin/taskpane.html",
      "/word-addin/begleitung.html",
      "/office-addin/taskpane.html",
    ]);
  });

  it("verwendet die sichtbare Konstante und verwirft Schatten, fremde oder ungenutzte Schleifenbindungen", () => {
    const text = quelle();
    const koeder = `const adresse = "/koeder";\n${text}`;
    expect(erhebe(koeder).registrierungen.map((r) => r.pfad)).toEqual([
      "/beliebig/eins",
      "/beliebig/zwei",
    ]);
    const lokal = text.replace(
      "function registriere(fassung) {",
      'function registriere(fassung) { const ZIEL = "/innen";',
    );
    expect(erhebe(lokal).registrierungen.map((r) => r.pfad)).toEqual(["/beliebig/eins", "/innen"]);
    // BEGINN: die beiden konkret gemeldeten uebersehenen Bindungsraeume.
    const gehobenesVar =
      "const ZIEL='/koeder'; function f(){ if(flag){var ZIEL=holePfad();} for(const [adresse,datei] of [[ZIEL,'a']] as const){app.get(adresse,handler);} }";
    const caseBindung =
      "const ZIEL='/koeder'; function f(){switch(x){case 1: const ZIEL=holePfad(); for(const [adresse,datei] of [[ZIEL,'a']] as const){app.get(adresse,handler);}}}";
    const gegenformen = [
      gehobenesVar,
      gehobenesVar.replace("if(flag)", "if(false)"),
      caseBindung,
      text.replace(
        "function registriere(fassung) {",
        "function registriere(fassung) { switch(fassung) { case 1: ZIEL = holePfad(); }",
      ),
    ];
    const fremdeFunktion = text.replace(
      "function registriere(fassung) {",
      "function registriere(fassung) { function nebenbei() { if(flag) { var ZIEL = holePfad(); } }",
    );
    expect(erhebe(fremdeFunktion).registrierungen.map((r) => r.pfad)).toEqual([
      "/beliebig/eins",
      "/beliebig/zwei",
    ]);
    // ENDE: die beiden konkret gemeldeten uebersehenen Bindungsraeume.
    for (const variante of [
      ...gegenformen,
      text.replace("function registriere(fassung)", "function registriere(fassung, ZIEL)"),
      quelle("fremdeTabelle"),
      text.replace(`${AUFRUF};`, `function spaeter(adresse) { ${AUFRUF}; }`),
      text.replace(`${AUFRUF};`, `() => { ${AUFRUF}; };`),
      `${text.replace(`${AUFRUF};`, "void adresse;")}\n${AUFRUF};`,
    ]) {
      const fund = erhebe(variante);
      expect(fund.registrierungen).toEqual([]);
      expect(fund.unlesbar).toHaveLength(1);
      expect(fund.unlesbar[0]).toContain(DATEI);
    }
  });

  it("uebernimmt keine Teilmenge bei dynamischen Pfaden, Spread, Rest, Defaults oder Mutationen", () => {
    for (const variante of [
      quelle('[["/eins", "a", fassung], [holePfad(), "b", fassung]]'),
      `const adresse = "/koeder";\n${quelle('[["/eins", "a", fassung], [holePfad(), "b", fassung]]')}`,
      quelle('[["/eins", "a", fassung], ["kein-pfad", "b", fassung]]'),
      quelle('[["/eins", ...rest]]'),
      quelle('[["/eins", "a", fassung], ...weitere]'),
      quelle("[]"),
      quelle(undefined, "let [adresse, datei, version]"),
      quelle(undefined, "const [adresse, ...rest]"),
      quelle(undefined, 'const [adresse = "/default", datei, version]'),
      quelle(undefined, undefined, 'adresse = "/anders";'),
      quelle(undefined, undefined, "adresse++;"),
      quelle(undefined, undefined, 'ZIEL = "/anders";'),
    ]) {
      const fund = erhebe(variante);
      expect(fund.registrierungen).toEqual([]);
      expect(fund.unlesbar).toHaveLength(1);
    }
  });

  it("erhaelt Literale, Konstanten, geschuetzte Aufrufe und den unabhaengigen Textlauf", () => {
    const alt = erhebe(`const FEST = "/api/fest";
      app.get("/offen", async () => true);
      app.post(FEST, async (request, reply) => { await guards.requirePermission("ko.read", request, reply); });`);
    expect(alt.unlesbar).toEqual([]);
    expect(alt.registrierungen.map((r) => [r.methode, r.pfad, schutzartVon(r.aufruf)])).toEqual([
      ["GET", "/offen", "public"],
      ["POST", "/api/fest", "ko.read"],
    ]);
    expect(erhebe('// app.get("/nur-kommentar", handler);')).toEqual({
      registrierungen: [],
      unlesbar: [],
    });
    const koeder = erhebe("const text = 'app.get(\"/nur-text\", handler)';");
    expect(koeder.registrierungen).toEqual([]);
    expect(koeder.unlesbar).toHaveLength(2);
    expect(koeder.unlesbar.every((s) => s.includes("der Textlauf sieht"))).toBe(true);
    expect(
      erhebe('app.route({ method: "GET", url: "/unbekannte-bauform" });').unlesbar[0],
    ).toContain(".route({…})");
  });
});
