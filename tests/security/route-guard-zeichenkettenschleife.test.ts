import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { schutzartVon } from "./routeGuardAudit";
import { erhebeRegistrierungen } from "./schnittstellenErhebung";

const AUFRUF =
  "tor.post(`/frei/${weg}/ende`, async (req, reply) => { await guards.requireUser(req, reply); })";
function quelle(
  iterable: string,
  rumpf = AUFRUF,
  vorher = "",
  bindung = "const weg",
  nachher = "",
): string {
  return [
    vorher,
    "async function montiere(tor: FastifyInstance) {",
    `for (${bindung} of ${iterable}) {`,
    `${rumpf};`,
    "}",
    "}",
    nachher,
  ].join("\n");
}

describe("Feste skalare Zeichenkettenschleifen", () => {
  it("erhebt die zehn echten Wege und beliebige direkte feste Schleifen mit ganzen Metadaten und Wachen", () => {
    const faelle = [
      {
        datei: "services/app/src/routes/klara-besprechung-routes.ts",
        zeile: 27,
        kopf: "/api/me/klara/besprechungen/:id/",
        wege: ["lesen", "korrektur", "uebernehmen", "fristquelle", "teilschritt"],
        schutz: "auth",
        wache: "await guards.requireUser(",
      },
      {
        datei: "services/app/src/routes/klara-gespraech-routes.ts",
        zeile: 413,
        kopf: "/api/me/klara/gespraeche/:id/auftraege/:auftragId/",
        wege: ["unterbrechen", "fortsetzen"],
        schutz: "auth",
        wache: "await guards.requireUser(",
      },
      {
        datei: "services/app/src/routes/klara-wissen-routes.ts",
        zeile: 34,
        kopf: "/api/me/klara/notizen/:id/wissen/",
        wege: ["vorschau", "pruefen", "uebernehmen"],
        schutz: "ko.create",
        wache: 'await guards.requirePermission("ko.create",',
      },
    ] as const;
    let anzahl = 0;
    for (const fall of faelle) {
      const text = readFileSync(join(REPO_WURZEL, fall.datei), "utf8");
      const vorZeile = text
        .split("\n")
        .slice(0, fall.zeile - 1)
        .join("\n").length;
      const start = text.indexOf("app.post<", vorZeile);
      expect(start).toBeGreaterThan(vorZeile);
      expect(text.slice(0, start).split("\n").length).toBe(fall.zeile);
      const ende = text.indexOf("\n      );", start);
      expect(ende).toBeGreaterThan(start);
      const aufruf = text.slice(start, ende + "\n      )".length);
      const erwartet = fall.wege.map((weg) => ({
        methode: "POST",
        pfad: fall.kopf + weg,
        datei: fall.datei,
        zeile: fall.zeile,
        aufruf,
      }));
      const teil = erhebeRegistrierungen(fall.datei, text);
      expect(teil.unlesbar).toEqual([]);
      expect(teil.registrierungen.filter((r) => r.zeile === fall.zeile)).toEqual(erwartet);
      expect(schutzartVon(aufruf)).toBe(fall.schutz);
      expect(aufruf.indexOf(fall.wache)).toBeGreaterThan(0);
      expect(aufruf.indexOf(fall.wache)).toBe(aufruf.indexOf("await guards."));
      anzahl += erwartet.length;
    }
    expect(anzahl).toBe(10);
    for (const [name, empfaenger, methode, kopf, werte, rest, block] of [
      ["teil", "tor", "patch", "/beliebig/", ["rot", "blau"], "/fest", true],
      ["stufe", "api", "get", "", ["/eins", "/zwei"], "/ende", false],
    ] as const) {
      const pfad = `\`${kopf}\${${name}}${rest}\``;
      const aufruf = `${empfaenger}.${methode}(${pfad}, async (req, reply) => { await guards.requireUser(req, reply); })`;
      const text = [
        `function montiere(${empfaenger}: FastifyInstance) {`,
        `for (const ${name} of ((${JSON.stringify(werte)} as const) satisfies readonly string[]))${block ? " {" : ""}`,
        `${aufruf};`,
        ...(block ? ["}"] : []),
        "}",
      ].join("\n");
      const datei = `beliebig-${name}.ts`;
      expect(erhebeRegistrierungen(datei, text)).toEqual({
        registrierungen: werte.map((wert) => ({
          methode: methode.toUpperCase(),
          pfad: kopf + wert + rest,
          datei,
          zeile: 3,
          aufruf,
        })),
        unlesbar: [],
      });
      expect(schutzartVon(aufruf)).toBe("auth");
    }
    const nurTypen = quelle(
      '["typ"] as const',
      AUFRUF,
      "type weg = string; interface weg { wert: string }",
    );
    expect(erhebeRegistrierungen("typen.ts", nurTypen).registrierungen.map((r) => r.pfad)).toEqual([
      "/frei/typ/ende",
    ]);
  });

  it("verwirft dynamische oder unvollstaendige Schleifen sowie Schatten Schreibstellen und unbekannte Bindungsraeume atomar", () => {
    const fest = '["a", "b"] as const';
    const gegenformen = [
      quelle("dynamisch"),
      quelle("werte", AUFRUF, 'import { werte } from "./fremd";'),
      quelle("werte", AUFRUF, 'const werte = ["a", "b"] as const;'),
      quelle('["a", holeWert()]'),
      quelle('["a", 2]'),
      quelle('["a", ...rest]'),
      quelle('["a", , "b"]'),
      quelle("[]"),
      quelle(fest, AUFRUF, "", "let weg"),
      quelle(fest, AUFRUF, "", "var weg"),
      quelle(fest).replace("for (", "for await ("),
      quelle('[["a"], ["b"]]', AUFRUF, "", "const [weg]"),
      quelle(fest, `if (true) { ${AUFRUF} }`),
      quelle(fest, `{ ${AUFRUF} }`),
      quelle(fest, `const spaeter = () => { ${AUFRUF} }; spaeter();`),
      quelle(fest, `for (const anderer of [1]) { ${AUFRUF} }`),
      quelle(fest, AUFRUF.replace("`/frei/${weg}/ende`", "weg")),
      quelle(fest, AUFRUF.replace("${weg}", "${weg}${weiter}")),
      quelle(fest, AUFRUF.replace("${weg}", "${`${weg}`}")),
      quelle(fest, AUFRUF.replace("${weg}", "${objekt.weg}")),
      quelle(fest, AUFRUF.replace("${weg}", "${holeWert()}")),
      quelle('["/gut", "relativ"]', AUFRUF.replace("`/frei/${weg}/ende`", "`${weg}`")),
      quelle(fest, AUFRUF, 'const weg = "/koeder";'),
      quelle(fest, `const weg = "schatten"; ${AUFRUF}`),
      quelle(fest, `${AUFRUF}; var weg;`),
      quelle(fest, `const { wert: weg } = fremd; ${AUFRUF}`),
      quelle(fest, `function innen(weg: string) {} ${AUFRUF}`),
      quelle(fest, `function weg() {} ${AUFRUF}`),
      quelle(fest, `const innen = function weg() {}; ${AUFRUF}`),
      quelle(fest, `class weg {} ${AUFRUF}`),
      quelle(fest, `const innen = class weg {}; ${AUFRUF}`),
      quelle(fest, `enum weg { A } ${AUFRUF}`),
      quelle(fest, `namespace weg { export const wert = 1; } ${AUFRUF}`),
      quelle(fest, `import weg = Fremd.Pfad; ${AUFRUF}`),
      quelle(fest, `weg = "anders"; ${AUFRUF}`),
      quelle(fest, `weg += "anders"; ${AUFRUF}`),
      quelle(fest, `weg++; ${AUFRUF}`),
      quelle(fest, `--weg; ${AUFRUF}`),
      quelle(fest, `delete weg; ${AUFRUF}`),
      quelle(fest, `({ wert: weg } = fremd); ${AUFRUF}`),
      quelle(fest, `for (weg of fremd) {} ${AUFRUF}`),
      quelle(fest, `with (fremd) { ${AUFRUF} }`),
      quelle(fest, AUFRUF, "", "const weg", "with (fremd) {}"),
      quelle(fest, `class Andere { static { ${AUFRUF} } }`),
      quelle(fest, `namespace Andere { ${AUFRUF} }`),
      `${quelle(fest).replace("for (", "switch (wert) { case 1: for (")}}`,
      quelle(fest, AUFRUF, "", "const weg", "function unbenutzt() { var weg; }"),
      quelle(fest, AUFRUF, "", "const weg", "function unbenutzt(weg: string) {}"),
    ];
    for (const [index, text] of gegenformen.entries()) {
      const teil = erhebeRegistrierungen(`gegenform-${index}.ts`, text);
      expect(teil.registrierungen, `Gegenform ${index}`).toEqual([]);
      expect(teil.unlesbar.length, `Gegenform ${index}`).toBeGreaterThan(0);
    }
    const fremderEmpfaenger = quelle(fest, AUFRUF.replace("tor.post", "sammlung.post"));
    expect(erhebeRegistrierungen("kein-server.ts", fremderEmpfaenger).registrierungen).toEqual([]);
  });
});
