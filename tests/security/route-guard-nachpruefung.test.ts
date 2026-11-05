import { describe, expect, it } from "vitest";
import { scanRouteFile } from "./routeGuardAudit";

const schutz = (text: string) =>
  scanRouteFile(text, "services/app/src/routes/andere-fragen-routes.ts").map((r) => r.protection);
const quelle = (stil: "kurz" | "block", key = "erneut") => {
  const daten =
    stil === "kurz"
      ? `...(anfrage.addon ? {} : { ${key}: () => wachen.requirePermission("ko.read", anfrage, antwort) })`
      : `${key}: () => wachen.requirePermission("ko.read", anfrage, antwort)`;
  const lauf = `fertig(deps, anfrage, antwort, { ${daten} })`;
  const closure =
    stil === "kurz"
      ? `const abschliessen = (id: string) => ${lauf};`
      : `const abschliessen = async (id: string) => { await nebenarbeit(); await ${lauf}; };`;
  return `import type { Guards as Wachen } from "../http";
    async function fertig(deps, eingang, ausgang, daten) {
      await erzeuge();
      if (daten.${key}) {
        const neu = await daten.${key}();
        if (!neu) { return; }
      }
      ausgang.code(200).send({ ok: true });
    }
    function registriere(wachen: Wachen, andere: Wachen) {
      app.post("/vorgegebene-namen-sind-unwichtig", {
        preValidation: async (start, ende) => {
          const person = await wachen.requirePermission("ko.read", start, ende);
          if (!person) { return ende; }
        },
      }, async (anfrage, antwort) => {
        ${closure}
        await abschliessen("eins");
        await abschliessen("zwei");
      });
    }`;
};

describe("Route-Guard-Scanner · gebundene gleiche Nachpruefung", () => {
  it("erkennt beide wirklich aufgerufenen Closurestile mit optionaler oder direkter Nachpruefung auf beliebigem Pfad", () => {
    for (const stil of ["kurz", "block"] as const) {
      for (const key of ["erneut", "beliebigerNachweis"]) {
        expect(schutz(quelle(stil, key))).toEqual(["ko.read"]);
      }
    }
  });

  it("glaubt weder einem gleichnamigen Fakeverbraucher noch einem ungenutzten oder vorgezogenen Callback", () => {
    const text = quelle("kurz");
    for (const variante of [
      text.replace("if (!neu) { return; }", "if (!neu) { protokolliere(); }"),
      text.replace("const neu = await daten.erneut();", "const neu = true;"),
      text.replace("await erzeuge();", "erzeuge();"),
      text
        .replace('await abschliessen("eins");', "")
        .replace('await abschliessen("zwei");', "return;"),
      text.replace(
        'erneut: () => wachen.requirePermission("ko.read", anfrage, antwort)',
        'nurEinName: () => wachen.requirePermission("ko.read", anfrage, antwort)',
      ),
      text.replace(
        "const abschliessen =",
        "const fertig = async () => undefined; const abschliessen =",
      ),
    ]) {
      expect(schutz(variante)).toEqual(["action-dispatched"]);
    }
  });

  it("erhaelt verschiedene Rechte, direkte gleiche Doppelwachen und zusaetzliche Aktionen", () => {
    const text = quelle("block");
    for (const variante of [
      text.replace(
        'wachen.requirePermission("ko.read", anfrage, antwort)',
        'wachen.requirePermission("ko.create", anfrage, antwort)',
      ),
      text.replace(
        'wachen.requirePermission("ko.read", anfrage, antwort)',
        'andere.requirePermission("ko.read", anfrage, antwort)',
      ),
      text.replace(
        'await abschliessen("zwei");',
        'await wachen.requirePermission("ko.create", anfrage, antwort);',
      ),
      text
        .replace(
          "function registriere",
          'function schreiben(wachen, req, rep) { return wachen.requirePermission("ko.create", req, rep); } function registriere',
        )
        .replace('await abschliessen("zwei");', "await schreiben(wachen, anfrage, antwort);"),
      text.replace(
        "await erzeuge();",
        'await deps.guards.requirePermission("ko.create", eingang, ausgang);',
      ),
    ]) {
      expect(schutz(variante)).toEqual(["action-dispatched"]);
    }
    expect(
      schutz(`app.post("/zweimal", async (request, reply) => {
      await guards.requirePermission("ko.read", request, reply);
      await guards.requirePermission("ko.read", request, reply);
    });`),
    ).toEqual(["action-dispatched"]);
  });

  it("verwirft andere Request-/Reply-Bindungen, Schatten und Textkoeder und wahrt alte Prioritaeten", () => {
    const text = quelle("kurz");
    for (const variante of [
      text.replace(
        'wachen.requirePermission("ko.read", anfrage, antwort)',
        'wachen.requirePermission("ko.read", antwort, anfrage)',
      ),
      text.replace(
        'wachen.requirePermission("ko.read", anfrage, antwort)',
        'wachen.requirePermission("ko.read", fremd, antwort)',
      ),
      text.replace('"../http"', '"../falsche-Guards"'),
      text.replace(
        '() => wachen.requirePermission("ko.read", anfrage, antwort)',
        '() => { const wachen = andere; return wachen.requirePermission("ko.read", anfrage, antwort); }',
      ),
      text.replace(
        '() => wachen.requirePermission("ko.read", anfrage, antwort)',
        "() => 'wachen.requirePermission(\"ko.read\", anfrage, antwort)'",
      ),
      text.replace(
        '() => wachen.requirePermission("ko.read", anfrage, antwort)',
        '() => { /* wachen.requirePermission("ko.read", anfrage, antwort); */ return null; }',
      ),
    ]) {
      expect(schutz(variante)).toEqual(["action-dispatched"]);
    }
    for (const [wache, erwartet] of [
      ["guards.requireUser(request, reply);", "auth"],
      ["guards.requireAdmin(request, reply);", "admin"],
      ["guards.requireVerzeichnisSchluessel(request, reply);", "verzeichnis"],
      ['guards.requirePermission("ko.read", request, reply);', "ko.read"],
      [
        'const auth = request.authContext; if (auth?.authKind !== "addon" || !auth.principal.dienst) return;',
        "dienst-schluessel",
      ],
      ["return true;", "public"],
    ]) {
      expect(schutz(`app.get("/unveraendert", async (request, reply) => { ${wache} });`)).toEqual([
        erwartet,
      ]);
    }
  });
});
