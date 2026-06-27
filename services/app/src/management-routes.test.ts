import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-240: Management-/Wissenskapital-Snapshot über die ECHTE HTTP-Route absichern.
// GET /api/management/snapshot (ko.read) aggregiert Live-Daten aus KOs/Gaps/Conflicts/Lifecycle.
// Bewusst OHNE Demo-Seed, damit die Aggregate exakt aus dem über HTTP erzeugten Bestand stammen
// (kein Beispielwert aus dem Nichts). Validierung über echte HTTP-Aktion (rate "up", needed=1).
describe("SCRUM-240: Management-Snapshot (HTTP end-to-end)", () => {
  async function adminApp() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  async function createKo(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    title: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "Mgmt 240",
        neededValidations: 1,
      },
    });
    return res.json().id as string;
  }

  const snapshot = (app: ReturnType<typeof buildApp>, headers: Record<string, string>) =>
    app.inject({ method: "GET", url: "/api/management/snapshot", headers });

  it("leerer Bestand → Snapshot vollständig strukturiert, Aggregate sind echte Nullen", async () => {
    const { app, headers } = await adminApp();
    const res = await snapshot(app, headers);
    expect(res.statusCode).toBe(200);
    const snap = res.json();

    // Zentrale strukturierte Bereiche sind vorhanden.
    for (const key of [
      "generatedAt",
      "overview",
      "capital",
      "valuationFacts",
      "statement",
      "maturity",
      "priorities",
      "recommendations",
      "house",
      "pilot",
    ]) {
      expect(snap[key]).toBeDefined();
    }
    expect(Array.isArray(snap.pilot)).toBe(true);
    expect(snap.pilot).toHaveLength(3); // 30/60/90
    expect(Array.isArray(snap.capital.parts)).toBe(true);

    // Echte Live-Aggregate: leerer Bestand → echte Nullen (keine Demo-/Beispielzahlen).
    expect(snap.overview.totalKos).toBe(0);
    expect(snap.overview.validated).toBe(0);
    expect(snap.overview.avgTrust).toBe(0);
    expect(snap.overview.openGaps).toBe(0);
    expect(snap.overview.openConflicts).toBe(0);
    expect(snap.valuationFacts.totalKos).toBe(0);
  });

  it("realer Bestand → Aggregate spiegeln exakt den über HTTP erzeugten Live-Stand", async () => {
    const { app, headers } = await adminApp();
    // 3 KOs anlegen, 2 davon validieren (needed=1 → ein Admin-Up genügt).
    const ids = [
      await createKo(app, headers, "Mgmt KO 1"),
      await createKo(app, headers, "Mgmt KO 2"),
      await createKo(app, headers, "Mgmt KO 3"),
    ];
    for (const id of ids.slice(0, 2)) {
      const r = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "rate", verdict: "up" },
      });
      expect(r.statusCode).toBe(200);
    }

    const snap = (await snapshot(app, headers)).json();

    // Overview = echte Aggregate aus dem Live-Bestand.
    expect(snap.overview.totalKos).toBe(3);
    expect(snap.overview.validated).toBe(2);
    expect(snap.overview.open).toBe(1);
    // avgTrust = round((100+100+0)/3) = 67 (validierte KOs bei needed=1 → trust 100).
    expect(snap.overview.avgTrust).toBe(67);

    // valuationFacts = reine Fakten (kein €-Wert; der entsteht erst im FE).
    expect(snap.valuationFacts).toMatchObject({ validatedKos: 2, totalKos: 3, avgTrust: 67 });

    // statement.assets = validierte Objekte (Aktiva-Basis), net ist abgeleiteter Index 0–100.
    expect(snap.statement.assets).toBe(2);
    expect(snap.statement.net).toBeGreaterThanOrEqual(0);
    expect(snap.statement.net).toBeLessThanOrEqual(100);

    // house: Kategorie-„Etage" mit echtem koCount.
    const floor = snap.house.find((f: { category: string }) => f.category === "Mgmt 240");
    expect(floor.koCount).toBe(3);

    // pilot: alle 3 KOs eben erstellt → im 30-Tage-Fenster, 2 davon validiert.
    expect(snap.pilot[0].created).toBe(3);
    expect(snap.pilot[0].validated).toBe(2);

    // capital.score / maturity.stage bleiben in plausiblen, abgeleiteten Wertebereichen.
    expect(snap.capital.score).toBeGreaterThanOrEqual(0);
    expect(snap.capital.score).toBeLessThanOrEqual(100);
    expect(snap.maturity.stage).toBeGreaterThanOrEqual(1);
    expect(snap.maturity.stage).toBeLessThanOrEqual(5);
  });

  it("Guard: anonym wird abgewiesen", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/management/snapshot" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
