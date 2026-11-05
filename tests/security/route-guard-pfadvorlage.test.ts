import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { schutzartVon } from "./routeGuardAudit";
import { erhebeRegistrierungen } from "./schnittstellenErhebung";

const GRUPPE = "Feste lokale Pfadvorlagen";
const POSITIV =
  "erhebt beliebige feste Vorlagen samt Metadaten und die echte Freigaberoute mit users.manage";
const NEGATIV =
  "laesst dynamische, verschattete, mutierte und nicht unterstuetzte Vorlagen unlesbar";
const AUFRUF =
  'tor.post(`${BASIS}/fest`, async (request, reply) => { await guards.requirePermission("users.manage", request, reply); })';
function quelle(kopf: string, rumpf = AUFRUF, zusatz = ""): string {
  return [kopf, "function verdrahte(tor: FastifyInstance) {", rumpf, "}", zusatz].join("\n");
}

describe(GRUPPE, () => {
  it(POSITIV, () => {
    for (const [name, wert, methode, suffix] of [
      ["START", "/irgendwo", "get", "/weiter"],
      ["WURZEL", "/anders", "patch", "/ende"],
      ["ORT", "/dritter/weg", "delete", "/fest"],
    ] as const) {
      const aufruf = `tor.${methode}(\`\${${name}}${suffix}\`, async (request, reply) => { await guards.requirePermission("users.manage", request, reply); })`;
      const text = quelle(`export const ${name} = (${JSON.stringify(wert)} as const);`, aufruf);
      const datei = `services/app/src/beliebig-${name}.ts`;
      expect(erhebeRegistrierungen(datei, text)).toEqual({
        registrierungen: [
          { methode: methode.toUpperCase(), pfad: wert + suffix, datei, zeile: 3, aufruf },
        ],
        unlesbar: [],
      });
      expect(schutzartVon(aufruf)).toBe("users.manage");
    }
    const typnamen = quelle(
      "const BASIS = `/typen`; type BASIS = { wert: string }; interface BASIS { id: string }",
    );
    expect(erhebeRegistrierungen("typen.ts", typnamen).registrierungen.map((r) => r.pfad)).toEqual([
      "/typen/fest",
    ]);
    const datei = "services/app/src/wiederanlauf.ts";
    const text = readFileSync(join(REPO_WURZEL, datei), "utf8");
    const teil = erhebeRegistrierungen(datei, text);
    const freigabe = teil.registrierungen.find(
      (r) => r.methode === "POST" && r.pfad === "/api/admin/wiederanlauf/freigabe",
    );
    const start = text.indexOf("app.post<{ Body: Record<string, unknown> | null }>(");
    const ende = text.indexOf("\n  );", start);
    expect(start).toBeGreaterThan(0);
    expect(ende).toBeGreaterThan(start);
    expect(teil.unlesbar).toEqual([]);
    expect(freigabe).toEqual({
      methode: "POST",
      pfad: "/api/admin/wiederanlauf/freigabe",
      datei,
      zeile: 299,
      aufruf: text.slice(start, ende + "\n  )".length),
    });
    expect(freigabe && schutzartVon(freigabe.aufruf)).toBe("users.manage");
    expect(freigabe?.aufruf).toContain(
      'const user = await guards.requirePermission("users.manage", request, reply);',
    );
  });

  it(NEGATIV, () => {
    const fest = 'const BASIS = "/koeder";';
    const gegenformen = [
      quelle("const BASIS = liesPfad();"),
      quelle('let BASIS = "/beweglich";'),
      quelle('var BASIS = "/beweglich";'),
      quelle('import { BASIS } from "./fremd";'),
      quelle('import BASIS from "./fremd";'),
      quelle('import * as BASIS from "./fremd";'),
      quelle('import BASIS = require("./fremd");'),
      quelle(""),
      quelle("", `const BASIS = "/lokal"; ${AUFRUF}`),
      quelle("declare const BASIS: string;"),
      quelle(fest, `const BASIS = "/schatten"; ${AUFRUF}`),
      quelle(fest, `{ let BASIS; ${AUFRUF} }`),
      quelle(fest, `${AUFRUF}; var BASIS;`),
      quelle(fest, `function innen(BASIS: string) { ${AUFRUF} }`),
      quelle(fest, `const { pfad: BASIS } = fremd; ${AUFRUF}`),
      quelle(fest, `const [BASIS] = fremd; ${AUFRUF}`),
      quelle(fest, `try {} catch (BASIS) { ${AUFRUF} }`),
      quelle(fest, `function BASIS() {} ${AUFRUF}`),
      quelle(fest, `const innen = function BASIS() { ${AUFRUF} };`),
      quelle(fest, `class BASIS {} ${AUFRUF}`),
      quelle(fest, `const innen = class BASIS { static { ${AUFRUF} } };`),
      quelle(fest, `enum BASIS { A } ${AUFRUF}`),
      quelle(fest, `namespace BASIS { export const wert = 1; } ${AUFRUF}`),
      quelle(fest, `import BASIS = Fremd.Pfad; ${AUFRUF}`),
      quelle(fest, AUFRUF, "function unbenutzt(BASIS: string) {}"),
      quelle(fest, `BASIS = "/anders"; ${AUFRUF}`),
      quelle(fest, `BASIS += "/anders"; ${AUFRUF}`),
      quelle(fest, `BASIS++; ${AUFRUF}`),
      quelle(fest, `--BASIS; ${AUFRUF}`),
      quelle(fest, `delete BASIS; ${AUFRUF}`),
      quelle(fest, `for (BASIS of fremd) {} ${AUFRUF}`),
      quelle(fest, `with (fremd) { ${AUFRUF} }`),
      quelle(fest, AUFRUF, "with (fremd) {}"),
      quelle(fest, AUFRUF.replace("${BASIS}", "${BASIS}${REST}")),
      quelle(fest, AUFRUF.replace("${BASIS}", "${`${BASIS}`}")),
      quelle(fest, AUFRUF.replace("${BASIS}", "${liesPfad()}")),
      quelle(fest, AUFRUF.replace("${BASIS}", "${objekt.BASIS}")),
      quelle(fest, AUFRUF.replace("${BASIS}", '${BASIS + "/mehr"}')),
      quelle(fest, AUFRUF.replace("`${BASIS}", "`/kopf${BASIS}")),
      quelle('const BASIS = "relativ";'),
      quelle(fest, `class Andere { static { ${AUFRUF} } }`),
      quelle(fest, `enum Andere { BASIS = (() => { ${AUFRUF} })() }`),
      quelle(fest, `namespace Andere { ${AUFRUF} }`),
      quelle(fest, `switch (wert) { case 1: ${AUFRUF}; break; }`),
      quelle(fest, `for (const BASIS of ["/eins", "/zwei"]) { ${AUFRUF} }`),
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
