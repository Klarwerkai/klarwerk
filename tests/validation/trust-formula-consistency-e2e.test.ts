import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";
import { trustExplainer } from "../../apps/web/src/lib/trustExplainer";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-359 / AG-05 / EK-22 / Top Requirement #7: die zentrale Trust-Formel (warn −0.5, down −1, Deckel 99)
// wirkt serverseitig UND wird über die FE-Helfer (koOverview/useReadiness/libraryMaturity/trustExplainer)
// konsistent gespiegelt. Amber senkt Trust sichtbar ohne Vollfreigabe; eine rote Bewertung hält offen.
describe("SCRUM-359: Trust-Formel → Server/FE-Konsistenz (HTTP + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function createKo(
    app: App,
    headers: Record<string, string>,
    title: string,
    statement: string,
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement,
        type: "best_practice",
        category: "Anlage 2",
        neededValidations: 1,
      },
    });
    return res.json() as KnowledgeObject;
  }

  const getKo = async (app: App, headers: Record<string, string>, id: string) =>
    (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json() as KnowledgeObject;

  const rate = (
    app: App,
    headers: Record<string, string>,
    id: string,
    verdict: "up" | "warn" | "down",
  ) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict },
    });

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    // Demo-Seed legt Carla (controller, ko.validate) als zweiten, eigenständigen Prüfer an.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    return { app, admin, carla };
  }

  it("up deckelt Trust bei 99 statt 100 — validiert/ready, aber keine 100-Prozent-Wahrheit", async () => {
    const { app, admin } = await setup();
    const ko = await createKo(app, admin, "Presse P9 entlüften", "Vor Wartung Druck ablassen.");
    await rate(app, admin, ko.id, "up"); // needed=1 → ein Up genügt
    const validated = await getKo(app, admin, ko.id);

    expect(validated.status).toBe("validiert");
    expect(validated.trust).toBe(99); // Deckel PI-K2
    // FE-Konsistenz: nutzbar (ready), aber das Trust-Band bleibt unter „voll" (high), nie 100.
    const ov = koOverview(validated);
    expect(ov.usability).toBe("ready");
    expect(useReadiness(ov.usability).usability).toBe("ready");
    expect(libraryMaturity(validated).usability).toBe("ready");
  });

  it("warn (Amber) senkt den Trust sichtbar — validiert mit Vorbehalt, nicht wie Vollfreigabe", async () => {
    const { app, admin, carla } = await setup();
    const ko = await createKo(app, admin, "Ventil V3 prüfen", "Ventil V3 vor Anlauf sichten.");
    // up (Admin) + warn (Carla): up >= needed (1) und keine rote → validiert, aber Amber drückt Trust.
    await rate(app, admin, ko.id, "up");
    await rate(app, carla, ko.id, "warn");
    const withWarn = await getKo(app, admin, ko.id);

    expect(withWarn.status).toBe("validiert");
    expect(withWarn.trust).toBeGreaterThan(0);
    expect(withWarn.trust).toBeLessThan(99); // Amber ≠ volles OK → klar unter dem Deckel
    // FE-Transparenz: das Trust-Band ist nicht „high" und der Explainer markiert es als vorbehaltlich.
    const ov = koOverview(withWarn);
    expect(ov.trustBand).not.toBe("high");
    expect(trustExplainer({ trustBand: ov.trustBand, usability: ov.usability }).bandTone).toBe(
      "warn",
    );
  });

  it("down hält den Status offen und begrenzt den Trust — überall als Nacharbeit sichtbar", async () => {
    const { app, admin } = await setup();
    const ko = await createKo(app, admin, "Lager L2 schmieren", "Lager L2 monatlich fetten.");
    await rate(app, admin, ko.id, "down");
    const reviewed = await getKo(app, admin, ko.id);

    expect(reviewed.status).toBe("offen");
    expect(reviewed.trust).toBe(0);
    // FE-Konsistenz: nicht nutzbar (kein ready) + Explainer zeigt einen Review-/Nacharbeitshinweis.
    const ov = koOverview(reviewed);
    expect(ov.usability).not.toBe("ready");
    expect(useReadiness(ov.usability).usability).not.toBe("ready");
    expect(libraryMaturity(reviewed).usability).not.toBe("ready");
    expect(trustExplainer({ trustBand: ov.trustBand, usability: ov.usability }).reviewHintKey).toBe(
      "trust.explain.review",
    );
  });
});
