import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";

// ================================================================================================
// JOB 2693 D1 — SIEBEN WARNUNGEN GEHEN JETZT UEBER DEN LOGGER DER ANFRAGE (Befund R2-5)
// ================================================================================================
//
// Nachweis aus dem Befund: „Test-Logger faengt den Eintrag mit reqId." Hier ist der Logger ein
// Fastify-Logger mit eigenem Strom; jede Zeile ist JSON mit `reqId`, `level`, `msg`, `stelle`,
// `fehler`. Und weil `build-app.ts` selbst KEINEN Logger konfiguriert (Fastify-Voreinstellung =
// stumm), sagt Fall L4 das ausdruecklich — sonst saehe es aus, als waere das Produkt lauter geworden.

interface Zeile {
  level: number;
  reqId?: string;
  msg?: string;
  stelle?: string;
  fehler?: string;
}

async function appMitLogger(adapter: ConfluenceSourceAdapter | undefined) {
  const zeilen: Zeile[] = [];
  const app = Fastify({
    logger: {
      level: "warn",
      stream: {
        write: (s: string) => {
          zeilen.push(JSON.parse(s) as Zeile);
        },
      },
    },
  });
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
    }),
  );
  await services.auth.register({ name: "Admin", email: "a@x.de", password: "secret123" });
  const login = await services.auth.login({ email: "a@x.de", password: "secret123" });
  return { app, services, zeilen, headers: { authorization: `Bearer ${login.token}` } };
}

const kaputt = {
  source: "Confluence",
  collect: async () => [],
  collectAll: async () => {
    throw new Error(
      "Confluence-Request fehlgeschlagen: https://svc:GEHEIM@acme.atlassian.net kaputt",
    );
  },
} as unknown as ConfluenceSourceAdapter;

describe("JOB 2693 D1 · der Import warnt ueber den Logger der Anfrage", () => {
  it("L1 · Erkundung scheitert: 502 fuer den Client, EINE Warnzeile mit der reqId dieser Anfrage", async () => {
    const { app, zeilen, headers } = await appMitLogger(kaputt);
    const antwort = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
      payload: {},
    });
    expect(antwort.statusCode).toBe(502);
    const warnungen = zeilen.filter((z) => z.level >= 40 && z.stelle);
    expect(warnungen).toHaveLength(1);
    expect(warnungen[0]?.msg).toBe("confluence-import: Erkundung fehlgeschlagen");
    expect(warnungen[0]?.stelle).toBe("Erkundung");
    expect(typeof warnungen[0]?.reqId).toBe("string");
    expect(warnungen[0]?.reqId).not.toBe("");
    // Sanitisiert: das Geheimnis aus der Quell-URL steht nicht im Log.
    expect(warnungen[0]?.fehler).not.toContain("GEHEIM");
  });

  it("L2 · der Hintergrundlauf warnt mit der reqId des Starts — auch nach dem 202", async () => {
    const { app, services, zeilen, headers } = await appMitLogger(kaputt);
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(start.statusCode).toBe(202);
    await warteAufOffeneImportLaeufe(services.importRuns);
    const lauf = zeilen.find((z) => z.stelle?.startsWith("Lauf ("));
    expect(lauf, "die Warnung des Hintergrundlaufs").toBeTruthy();
    expect(lauf?.msg).toMatch(/^confluence-import: Lauf \(.+\) fehlgeschlagen$/);
    expect(typeof lauf?.reqId).toBe("string");
    expect(lauf?.fehler).not.toContain("GEHEIM");
  });

  it("L3 · Auswahl, Gruppierung, Uebernahme: dieselbe Form an jeder Stelle", async () => {
    const { app, zeilen, headers } = await appMitLogger(kaputt);
    for (const pfad of ["select", "group", "apply"]) {
      await app.inject({
        method: "POST",
        url: `/api/admin/import/confluence/${pfad}`,
        headers,
        payload: { criteria: {}, includeIds: [] },
      });
    }
    const stellen = zeilen.filter((z) => z.stelle).map((z) => z.stelle);
    expect(stellen).toEqual(["Auswahl", "Gruppierung", "Uebernahme"]);
    for (const z of zeilen.filter((z) => z.stelle)) {
      expect(typeof z.reqId).toBe("string");
    }
  });

  it("L4 · nichts geht mehr an die Konsole vorbei", async () => {
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync(
      new URL("../../services/app/src/routes/confluence-import-routes.ts", import.meta.url),
      "utf8",
    );
    expect(quelle.includes("console.warn(")).toBe(false);
    // JOB 2933 D1 — DIESE ZUSICHERUNG IST UMGEDREHT, UND ZWAR ABSICHTLICH.
    //
    // Hier stand `expect(buildApp.includes("logger:")).toBe(false)` mit der Begruendung:
    // „build-app.ts konfiguriert keinen Logger — ohne 2661 sind diese Zeilen im Produkt still.
    // Der Fall haelt den Ist-Stand fest, damit er auffaellt." Er ist aufgefallen: JOB 2661 ist
    // eingebaut, `build-app.ts` baut Fastify jetzt mit `logger: baueLoggerOptionen(...)`. Der
    // Fall war also rot, WEIL das Produkt die Bedingung erfuellt hat, auf die er gewartet hat.
    // Deshalb steht hier jetzt `true`: die Voraussetzung ist eingeloest, die sieben Warnungen
    // sind im Produkt nicht mehr still.
    const buildApp = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    expect(buildApp.includes("logger:")).toBe(true);
  });

  it("L5 · und die Zeilen kommen im Produkt wirklich an — nicht nur im Test-Logger", async () => {
    // JOB 2933 D1: L1–L4 messen an einem Fastify, das der TEST mit einem Logger baut. Damit steht
    // und faellt die Aussage von L4 („nichts geht mehr an die Konsole vorbei") am Quelltext allein.
    // Dieser Fall schliesst die Luecke am gebauten Produkt: `buildApp` mit der 2661-Logsenke, eine
    // scheiternde Erkundung — und die Warnung muss durch die Serializer-/Senken-Disziplin von 2661
    // hindurch in der Senke landen, mit `reqId` und ohne das Geheimnis aus der Quell-URL.
    const zeilen: string[] = [];
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const services = buildServices();
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const app = buildApp(services, {
      log: { senke: { write: (z: string) => void zeilen.push(z) }, stufe: "warn" },
    });
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards: makeGuards(services.auth),
        makeAdapter: () => kaputt,
        importRuns: services.importRuns,
      }),
    );
    await services.auth.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    const login = await services.auth.login({ email: "a@x.de", password: "secret123" });
    const antwort = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers: { authorization: `Bearer ${login.token}` },
      payload: {},
    });
    expect(antwort.statusCode).toBe(502);
    const geloggt = zeilen.join("\n");
    expect(geloggt).toContain("confluence-import: Erkundung fehlgeschlagen");
    expect(geloggt).toContain("reqId");
    expect(geloggt).not.toContain("GEHEIM");
    await app.close();
  });
});
