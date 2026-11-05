import { describe, expect, it } from "vitest";
import { scanRouteFile } from "./routeGuardAudit";

const schutz = (text: string) => scanRouteFile(text, "helfer-routes.ts").map((r) => r.protection);

describe("Route-Guard-Scanner · direkt aufgerufene lokale Rechtehelfer", () => {
  it("liest echte Permission-Aufrufe im aufgerufenen Helfer auch bei mehrfacher Anwendung", () => {
    for (const recht of ["ko.read", "ko.create"]) {
      expect(
        schutz(`
        const tor = async (request, reply) => guards.requirePermission('${recht}', request, reply);
        app.post<{ Body: { text: string } }>("/api/probe", {
          preValidation: async (request, reply) => tor(request, reply),
        }, async (request, reply) => tor(request, reply));
      `),
      ).toEqual([recht]);
    }
  });

  it("glaubt einem gleichnamigen Helfer ohne wirkliche Wache keine Rechte", () => {
    for (const name of ["tor", "bindung", "requirePermission"]) {
      expect(
        schutz(`
        function ${name}(request, reply) { return request.user; }
        app.get("/api/probe", async (request, reply) => ${name}(request, reply));
      `),
      ).toEqual(["public"]);
    }
  });

  it("ignoriert unaufgerufene Nachbarn sowie Kommentar- und Stringköder", () => {
    expect(
      schutz(`
      function nachbar(request, reply) {
        return guards.requirePermission("ko.create", request, reply);
      }
      function tor(request, reply) {
        // guards.requirePermission("ko.read", request, reply);
        const koeder = 'guards.requirePermission("ko.create", request, reply)';
        function unbenutzt() { return guards.requirePermission("ko.read", request, reply); }
        const reserve = () => guards.requirePermission("ko.create", request, reply);
        return { koeder };
      }
      app.get("/api/probe", async (request, reply) => {
        // nachbar(request, reply);
        const text = "nachbar(request, reply)";
        return tor(request, reply);
      });
    `),
    ).toEqual(["public"]);
  });

  it("erhält direkte Vorränge, Dienstschlüssel und echte Mehraktionsregeln ohne Rechtededuplikation", () => {
    const helfer = `function tor(request, reply) {
      return guards.requirePermission("ko.create", request, reply);
    }`;
    for (const [wache, erwartet] of [
      ['guards.requirePermission("ko.read", request, reply);', "ko.read"],
      ["guards.requireUser(request, reply);", "auth"],
      [
        'guards.requirePermission("ko.read", request, reply); guards.requirePermission("ko.create", request, reply);',
        "action-dispatched",
      ],
    ]) {
      expect(
        schutz(`${helfer}
        app.post("/api/probe", async (request, reply) => {
          ${wache}
          return tor(request, reply);
        });
      `),
      ).toEqual([erwartet]);
    }
    for (const zweites of ["ko.read", "ko.create"]) {
      expect(
        schutz(`
        async function tor(request, reply) {
          await guards.requirePermission("ko.read", request, reply);
          return guards.requirePermission("${zweites}", request, reply);
        }
        app.post("/api/probe", async (request, reply) => tor(request, reply));
      `),
      ).toEqual(["action-dispatched"]);
    }
    expect(
      schutz(`
      function eins(request, reply) { return guards.requirePermission("ko.read", request, reply); }
      function zwei(request, reply) { return guards.requirePermission("ko.read", request, reply); }
      app.post("/api/probe", async (request, reply) => {
        await eins(request, reply);
        return zwei(request, reply);
      });
    `),
    ).toEqual(["action-dispatched"]);
    expect(
      schutz(`
      function tor(request, reply) {
        const auth = request.authContext;
        if (auth?.authKind !== "addon" || !auth.principal.dienst) return null;
        return guards.requirePermission("ko.create", request, reply);
      }
      app.post("/api/probe", async (request, reply) => tor(request, reply));
    `),
    ).toEqual(["dienst-schluessel"]);
  });
});
