import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  deriveImpacts,
  notificationsRoutes,
} from "../../services/app/src/routes/notifications-routes";
import { demoKennwort } from "../support/demoZugang";

// ================================================================================================
// aufnahme:20260922:gesamt-hilfreich-signal — RECHERCHE:pmo-fea-0002, R-0747, R-0235/FR-ASK-04.
// ================================================================================================
//
// „Der ursprüngliche Autor erfährt, dass sein Wissen anderen geholfen hat, auch nach Übergabe der
// Verantwortung. Nur tatsächlich belegte Nutzung melden; keine Leistungsrangliste."
//
// VORHER: `markHelpful` schrieb nur `koAuthor = ko.author` in den Beleg. Die Autor-Übergabe
// (FR-LIF-02, `transfer-author`) ändert genau dieses Feld — danach ging die Meldung an die neue
// Person, der ursprüngliche Autor erfuhr nichts mehr. NACHHER trägt der Beleg zusätzlich
// `koOriginalAuthor`, und die Glocke meldet beiden (nie dem Klickenden selbst).
describe("Hat geholfen: Rückmeldung an den ursprünglichen Autor auch nach Übergabe", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    return { headers, id: me.json().id as string };
  }

  const feed = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Array<{ id: string; kind: string; koId?: string; title: string }>);

  interface KoStand {
    author: string;
    originalAuthor: string;
    status: string;
    trust: number;
    version: number;
  }

  async function ladeKo(app: App, headers: Record<string, string>, koId: string) {
    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    return res.json() as KoStand;
  }

  it("Klick nach Übergabe: ursprünglicher und neuer Autor erfahren es, Trust steigt leicht, keine Prüfstimme", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    const seed = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: admin.headers,
    });
    const erik = await login(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
    const carla = await login(
      app,
      "carla@demo.klarwerk",
      demoKennwort(seed, "carla@demo.klarwerk"),
    );

    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        confidentiality: "intern",
        title: "Kompressor K4 vor dem Filterwechsel drucklos machen",
        statement: "Restdruck im Filtergehäuse löst den Deckel schlagartig.",
        type: "best_practice",
        neededValidations: 1,
      },
    });
    expect(created.statusCode).toBe(201);
    const koId = created.json().id as string;
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(bewertet.statusCode).toBe(200);

    // Übergabe der Verantwortung: Admin (Urheber) → Carla.
    const uebergabe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "transfer-author", newAuthor: carla.id },
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    const vorher = await ladeKo(app, admin.headers, koId);
    expect(vorher.author).toBe(carla.id);
    expect(vorher.originalAuthor).toBe(admin.id);
    expect(vorher.status).toBe("validiert");

    // Erik fragt, bekommt das Objekt als tragende Quelle, und meldet „Hat geholfen".
    const frage = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: erik.headers,
      payload: { question: "Kompressor K4 vor dem Filterwechsel drucklos machen" },
    });
    // R-0313: gedankt werden darf nur eine TRAGENDE Quelle — dieses Objekt muss darunter sein.
    expect(frage.json().result.citedSources).toContain(koId);
    const hilfreich = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: erik.headers,
      payload: { koId, receipt: frage.json().receipt },
    });
    expect(hilfreich.statusCode, hilfreich.body).toBe(204);

    // R-0235 / FR-ASK-04: Trust steigt leicht (ein Schritt, gedeckelt). R-0749: keine Prüfstimme —
    // Status und Fassung bleiben, wie sie waren.
    const nachher = await ladeKo(app, admin.headers, koId);
    expect(nachher.trust).toBe(Math.min(99, vorher.trust + 2));
    expect(nachher.status).toBe(vorher.status);
    expect(nachher.version).toBe(vorher.version);

    // pmo-fea-0002: der URSPRÜNGLICHE Autor erfährt es — auch nach der Übergabe.
    const adminImpact = (await feed(app, admin.headers)).filter(
      (n) => n.kind === "impact" && n.koId === koId,
    );
    expect(adminImpact).toHaveLength(1);
    expect(adminImpact[0]?.title).toContain("Kompressor K4");
    // R-0747: die heutige Autorin erfährt es ebenso.
    const carlaImpact = (await feed(app, carla.headers)).filter(
      (n) => n.kind === "impact" && n.koId === koId,
    );
    expect(carlaImpact).toHaveLength(1);
    // Kein Selbst-Applaus: der Klickende bekommt nichts.
    expect((await feed(app, erik.headers)).some((n) => n.kind === "impact")).toBe(false);
    // Keine Punkte, keine Rangliste: die Meldung trägt keine Zahl über den Beitrag.
    expect(Object.keys(adminImpact[0] ?? {}).sort()).toEqual(
      ["at", "id", "kind", "koId", "seen", "title"].sort(),
    );
  });

  it("deriveImpacts: Urheber-Zweig markiert, Autor geht vor, Selbstklick und Altbelege ohne Urheber bleiben aussen", () => {
    const at = "2026-10-01T08:00:00.000Z";
    const impacts = deriveImpacts(
      [
        // nach Übergabe: Betrachter ist nur noch Urheber
        {
          actor: "leser",
          target: "ko-1",
          at,
          payload: { koTitle: "A", koAuthor: "neu", koOriginalAuthor: "urheber" },
        },
        // ohne Übergabe: Autor = Urheber → genau EINE Meldung, unmarkiert
        {
          actor: "leser",
          target: "ko-2",
          at,
          payload: { koTitle: "B", koAuthor: "urheber", koOriginalAuthor: "urheber" },
        },
        // Selbstklick des Urhebers
        {
          actor: "urheber",
          target: "ko-3",
          at,
          payload: { koTitle: "C", koAuthor: "neu", koOriginalAuthor: "urheber" },
        },
        // Altbeleg vor dieser Änderung: kein `koOriginalAuthor` → wie bisher nur für `koAuthor`
        { actor: "leser", target: "ko-4", at, payload: { koTitle: "D", koAuthor: "neu" } },
      ],
      "urheber",
    );
    expect(impacts).toEqual([
      { koId: "ko-1", title: "A", at, nurUrheber: true },
      { koId: "ko-2", title: "B", at },
    ]);
  });
});

// Nach der Übergabe trägt die Autor-Ausnahme der Sichtbarkeit den Urheber nicht mehr. Ein
// vertrauliches Objekt, das er nicht mehr öffnen darf, darf seinen Titel auch nicht über die Glocke
// preisgeben — dieselbe Prüfung wie bei Zuweisungen (sichtbareEintraege).
describe("Hat geholfen: die Urheber-Meldung respektiert die Sichtbarkeit", () => {
  const URHEBER: SessionUser = { id: "urheber", role: "viewer" };
  const guards: Guards = {
    requireUser: async () => URHEBER,
    requirePermission: async () => URHEBER,
  };
  let offen: FastifyInstance[] = [];
  afterEach(async () => {
    for (const instance of offen) {
      await instance.close();
    }
    offen = [];
  });

  it("intern übergeben: Meldung erscheint · vertraulich übergeben: kein Titel in der Glocke", async () => {
    const at = "2026-10-01T08:00:00.000Z";
    const instance = Fastify();
    instance.register(
      notificationsRoutes(
        {
          conflicts: { unresolved: async () => [] } as never,
          overlaps: { unresolved: async () => [] } as never,
          ask: { listGaps: async () => [] } as never,
          validation: { openAssignmentsFor: async () => [] } as never,
          audit: {
            list: async () => [
              {
                actor: "leser",
                target: "ko-intern",
                at,
                payload: {
                  koTitle: "Offenes Wissen",
                  koAuthor: "neu",
                  koOriginalAuthor: "urheber",
                },
              },
              {
                actor: "leser",
                target: "ko-vertraulich",
                at,
                payload: {
                  koTitle: "GEHEIMTITEL-URHEBER",
                  koAuthor: "neu",
                  koOriginalAuthor: "urheber",
                },
              },
            ],
          } as never,
          seen: { seenFor: async () => [] } as never,
          kos: {
            get: async (id: string) =>
              id === "ko-intern"
                ? { confidentiality: "intern" as const, author: "neu" }
                : id === "ko-vertraulich"
                  ? { confidentiality: "vertraulich" as const, author: "neu" }
                  : undefined,
          },
        },
        guards,
      ),
    );
    await instance.ready();
    offen.push(instance);

    const res = await instance.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(200);
    const items = res.json() as Array<{ kind: string; koId?: string; title: string }>;
    expect(items.filter((n) => n.kind === "impact").map((n) => n.koId)).toEqual(["ko-intern"]);
    expect(res.body).not.toContain("GEHEIMTITEL-URHEBER");
  });
});
