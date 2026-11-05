import { describe, expect, it } from "vitest";
import { scanRouteFile } from "./routeGuardAudit";

const schutz = (text: string) =>
  scanRouteFile(text, "services/app/src/routes/andere-tuer-routes.ts").map((r) => r.protection);
const port = 'import { pruefeZugangsmarke as kontrolliere } from "../office-wopi";';
const pruefung = `const ergebnis = kontrolliere(marke, request.params.id, schluessel, jetzt());
  if (!ergebnis.gueltig) { reply.code(401).send(); return reply; }`;
const waechter = (rumpf: string = pruefung) =>
  `const tor = async (request, reply) => { ${rumpf} };`;
const route = (optionen = "optionen", handler = "return {};") =>
  `app.get("/beliebiger-tokenweg", ${optionen}, async (request, reply) => { ${handler} });`;

describe("Route-Guard-Scanner · WOPI-Zugangsmarke im onRequest", () => {
  it("erkennt den echten importierten Tokenport mit gebundenem 401-Callback auf beliebigem Pfad", () => {
    for (const importiert of [
      port,
      'import { pruefeZugangsmarke as kontrolliere } from "../office-wopi.js";',
    ]) {
      for (const optionen of [
        `const optionen = { onRequest: tor }; ${route()}`,
        route("{ onRequest: tor }"),
        route(`{ onRequest: async (request, reply) => { ${pruefung} } }`),
      ]) {
        expect(schutz(`${importiert} ${waechter()} ${optionen}`)).toEqual(["wopi-zugangsmarke"]);
      }
    }
    expect(
      schutz(
        `${port} ${waechter(
          pruefung.replace(
            "reply.code(401).send(); return reply;",
            "return reply.code(401).send();",
          ),
        )} const optionen = { onRequest: tor } as const; ${route()}`,
      ),
    ).toEqual(["wopi-zugangsmarke"]);
  });

  it("laesst fehlende, falsch importierte, verdeckte und ungebundene Wachen oeffentlich", () => {
    for (const text of [
      `${port} ${waechter()} ${route("{}")}`,
      `${port.replace("../office-wopi", "../anderer-port")} ${waechter()} ${route("{ onRequest: tor }")}`,
      `function kontrolliere() { return { gueltig: true }; } ${waechter()} ${route("{ onRequest: tor }")}`,
      `${port} ${waechter(`const kontrolliere = () => ({ gueltig: true }); ${pruefung}`)} ${route("{ onRequest: tor }")}`,
      `${port} ${waechter()} const offen = async () => undefined; ${route("{ onRequest: offen }")}`,
      `${port} ${waechter("kontrolliere(marke, request.params.id, schluessel, jetzt());")} ${route("{ onRequest: tor }")}`,
      `${port} ${waechter()} ${route("{ preValidation: tor }")}`,
    ]) {
      expect(schutz(text)).toEqual(["public"]);
    }
  });

  it("ignoriert Kommentar-/String-/Nachbar-Koeder und nicht verwerfende oder ueberschriebene Bindungen", () => {
    for (const rumpf of [
      `// ${pruefung.split("\n")[0]}
       const text = 'if (!ergebnis.gueltig) { reply.code(401).send(); return reply; }';`,
      `function unbenutzt() { ${pruefung} } return undefined;`,
      pruefung.replace("!ergebnis.gueltig", "ergebnis.gueltig"),
      pruefung.replace(
        "reply.code(401).send(); return reply;",
        "reply.code(200).send(); return reply;",
      ),
      pruefung.replace("reply.code(401).send(); return reply;", "reply.code(401).send();"),
      `const ergebnis = kontrolliere(marke, request.params.id, schluessel, jetzt());
       const andere = { gueltig: false };
       if (!andere.gueltig) { reply.code(401).send(); return reply; }`,
    ]) {
      expect(schutz(`${port} ${waechter(rumpf)} ${route("{ onRequest: tor }")}`)).toEqual([
        "public",
      ]);
    }
    for (const bindung of [
      "const optionen = { onRequest: tor }; optionen.onRequest = async () => undefined;",
      "const optionen = { onRequest: tor, ...unbekannt };",
    ]) {
      expect(schutz(`${port} ${waechter()} ${bindung} ${route()}`)).toEqual(["public"]);
    }
  });

  it("erhaelt bestehende direkte, Helfer- und Dienstvorrangregeln sowie echte Mehrfachwachen", () => {
    for (const [rumpf, erwartet] of [
      ['guards.requirePermission("ko.read", request, reply);', "ko.read"],
      ["guards.requireUser(request, reply);", "auth"],
      ["guards.requireAdmin(request, reply);", "admin"],
      ["guards.requireVerzeichnisSchluessel(request, reply);", "verzeichnis"],
      [
        'guards.requirePermission("ko.read", request, reply); guards.requirePermission("ko.read", request, reply);',
        "action-dispatched",
      ],
      [
        'guards.requirePermission("ko.read", request, reply); guards.requirePermission("ko.create", request, reply);',
        "action-dispatched",
      ],
      [
        'const auth = request.authContext; if (auth?.authKind !== "addon" || !auth.principal.dienst) return;',
        "dienst-schluessel",
      ],
    ]) {
      expect(
        schutz(
          `${port} ${waechter()} const optionen = { onRequest: tor }; ${route("optionen", rumpf)}`,
        ),
      ).toEqual([erwartet]);
    }
    expect(
      schutz(`${port} ${waechter()}
      function rechte(request, reply) { return guards.requirePermission("ko.create", request, reply); }
      const optionen = { onRequest: tor }; ${route("optionen", "return rechte(request, reply);")}
    `),
    ).toEqual(["ko.create"]);
  });
});
