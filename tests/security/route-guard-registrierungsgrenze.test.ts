import { describe, expect, it } from "vitest";
import { scanRouteFile } from "./routeGuardAudit";

describe("Route-Guard-Scanner · tatsächliche Registrierungsgrenze", () => {
  it("ein nicht aufgerufener Nachbarhelfer beeinflusst weder Schutzart noch URL", () => {
    const quelle = (wache: string) => `
      const PFAD = "/api/grenze";
      app.post<{ Body: { text: string } }>(PFAD, async (request, reply) => {
        ${wache}
        return { text: request.body.text };
      });
      async function nachbar(request, reply) {
        return guards.requirePermission("ko.create", request, reply);
      }
      app.get("/api/naechster", async (request, reply) => {
        return guards.requireUser(request, reply);
      });
    `;
    const erwartet = (protection: string) => [
      { method: "POST", url: "/api/grenze", protection, file: "grenze-routes.ts" },
      { method: "GET", url: "/api/naechster", protection: "auth", file: "grenze-routes.ts" },
    ];
    expect(
      scanRouteFile(
        quelle('const user = await guards.requirePermission("ko.create", request, reply);'),
        "grenze-routes.ts",
      ),
    ).toEqual(erwartet("ko.create"));
    expect(scanRouteFile(quelle(""), "grenze-routes.ts")).toEqual(erwartet("public"));
    expect(
      scanRouteFile(
        quelle('const user = await guards.requirePermission("ko.read", request, reply);'),
        "grenze-routes.ts",
      ),
    ).toEqual(erwartet("ko.read"));
  });

  it("zwei wirkliche Guardaktionen innerhalb desselben Aufrufs bleiben action-dispatched", () => {
    const quelle = `
      app.post<{ Body: { aktion: string } }>("/api/aktionen", async (request, reply) => {
        if (request.body.aktion === "erstellen") {
          return guards.requirePermission("ko.create", request, reply);
        }
        return guards.requirePermission("ko.validate", request, reply);
      });
    `;
    expect(scanRouteFile(quelle, "aktionen-routes.ts")).toEqual([
      {
        method: "POST",
        url: "/api/aktionen",
        protection: "action-dispatched",
        file: "aktionen-routes.ts",
      },
    ]);
  });
});
