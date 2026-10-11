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
        confidentiality: "intern",
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
    // avgTrust = round((99+99+0)/3) = 66 (validierte KOs bei needed=1 → trust 99, Deckel SCRUM-359/PI-K2).
    expect(snap.overview.avgTrust).toBe(66);

    // valuationFacts = reine Fakten (kein €-Wert; der entsteht erst im FE).
    expect(snap.valuationFacts).toMatchObject({ validatedKos: 2, totalKos: 3, avgTrust: 66 });

    // statement.assets = validierte Objekte (Aktiva-Basis), net ist abgeleiteter Index 0–100.
    expect(snap.statement.assets).toBe(2);
    expect(snap.statement.net).toBeGreaterThanOrEqual(0);
    expect(snap.statement.net).toBeLessThanOrEqual(100);

    // house (R-0768): ein Stockwerk je Fachgebiet; ohne gesetztes Fachgebiet `domain: null`.
    expect(snap.house).toHaveLength(1);
    expect(snap.house[0]).toMatchObject({ domain: null, koCount: 3, validated: 2 });
    expect(snap.houseFlow).toMatchObject({ inHouse: 3, secured: 2, outputReady: 2, imported: 0 });

    // Das Fachgebiet, über die echte Route gesetzt, macht aus einem Objekt ein eigenes Stockwerk.
    const dom = await app.inject({
      method: "PUT",
      url: `/api/kos/${ids[0]}`,
      headers,
      payload: { action: "domain", domain: "Montage" },
    });
    expect(dom.statusCode).toBe(200);
    const mitFach = (await snapshot(app, headers)).json();
    // Das Stockwerk ohne Fachgebiet steht zuletzt, obwohl es mehr Objekte hat.
    const fachgebiete = mitFach.house.map((f: { domain: string | null }) => f.domain);
    expect(fachgebiete).toEqual(["Montage", null]);
    expect(mitFach.house[0]).toMatchObject({ domain: "Montage", koCount: 1, validated: 1 });

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

// R-0751 (Nacharbeit 3, ben K4): die Konfliktdichte über den ECHT verdrahteten Managementweg —
// `buildServices` mit dem echten Konfliktdienst und dem in build-app gebauten `openConflictKoIds`,
// nichts davon ersetzt. Geprüft wird die Paar-Regel selbst: ein Konflikt zählt nur, wenn BEIDE
// Partner sichtbar sind. Das blosse Wegschneiden der unsichtbaren Kennung im ManagementService
// würde bei A–B das sichtbare A trotzdem als „im Konflikt" zählen (33 statt 0).
describe("R-0751: Konfliktdichte über buildServices (Paar-Regel im build-app-Datenweg)", () => {
  it("A–B mit unsichtbarem B zählt nicht (0); A–C mit zwei sichtbaren Partnern zählt (67)", async () => {
    const services = buildServices();
    const KATEGORIE = "Konfliktdichte NA3";
    const anlegen = (title: string) =>
      services.ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: KATEGORIE,
        author: "u-konfliktdichte",
      });
    const a = await anlegen("Objekt A");
    const b = await anlegen("Objekt B");
    const c = await anlegen("Objekt C");
    await anlegen("Objekt D");
    const sichtbar = (ko: { id: string }) => ko.id !== b.id;
    const dichte = async () => {
      const snap = await services.management.snapshot({ sichtbar });
      const zeile = snap.priorities.find((p) => p.category === KATEGORIE);
      return zeile?.factors.find((f) => f.key === "conflictDensity")?.value;
    };

    await services.conflicts.create({ koA: a.id, koB: b.id, type: "truth", description: "A–B" });
    expect(await dichte(), "Konflikt mit nur einem sichtbaren Partner").toBe(0);

    await services.conflicts.create({ koA: a.id, koB: c.id, type: "truth", description: "A–C" });
    expect(await dichte(), "A und C von A, C, D sichtbar im Konflikt").toBe(67);
  });
});

// R-0751 · R-1639 · R-2183 (Nacharbeit 3): die gepflegten Eingänge und der Bereichsblick über die
// ECHTEN HTTP-Türen — Pflege nur mit users.manage, „mein Bereich" nur für den eingetragenen
// Verantwortlichen, die vier gepflegten Stufen als Prioritätsfaktoren im Snapshot.
describe("Nacharbeit 3: Bereichsprofile, Ruhestandshorizonte und Bereichsblick (HTTP)", () => {
  type Kopf = Record<string, string>;
  const KATEGORIE = "Presse NA3";
  const PASSWORT = "geheim12345";
  const holen = async (app: ReturnType<typeof buildApp>, url: string, wer: Kopf) =>
    (await app.inject({ method: "GET", url, headers: wer })).json();
  type Zeile = {
    category: string;
    knownFactors: number;
    factors: { key: string; value: unknown }[];
  };
  const zeileVon = (snap: { priorities: Zeile[] }) =>
    snap.priorities.find((p) => p.category === KATEGORIE);

  async function buehne() {
    const app = buildApp(buildServices());
    const anmelden = async (email: string): Promise<Kopf> => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: PASSWORT },
      });
      return { authorization: `Bearer ${res.json().token}` };
    };
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@na3.test", password: PASSWORT },
    });
    const admin = await anmelden("admin@na3.test");
    for (const [name, role] of [
      ["Mara Manager", "controller"],
      ["Tom Kollege", "controller"],
      ["Rosa Traegerin", "experte"],
    ] as const) {
      const email = `${name.split(" ")[0]?.toLowerCase()}@na3.test`;
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: PASSWORT, role },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const verzeichnis: { id: string; name: string }[] = await holen(app, "/api/directory", admin);
    const id = (name: string) => verzeichnis.find((p) => p.name === name)?.id ?? "";
    const rosa = await anmelden("rosa@na3.test");
    for (const titel of ["Presse anfahren", "Presse einrichten"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: rosa,
        payload: {
          confidentiality: "intern",
          title: titel,
          statement: `Aussage zu ${titel}`,
          type: "best_practice",
          category: KATEGORIE,
        },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    return {
      app,
      admin,
      mara: await anmelden("mara@na3.test"),
      tom: await anmelden("tom@na3.test"),
      maraId: id("Mara Manager"),
      rosaId: id("Rosa Traegerin"),
    };
  }

  const profilSetzen = (app: ReturnType<typeof buildApp>, kopf: Kopf, payload: object) =>
    app.inject({ method: "PUT", url: "/api/management/profiles/category", headers: kopf, payload });

  it("Pflege nur mit users.manage; unbekannte Stufe 400, fremdes Konto 404, falscher Horizont 400", async () => {
    const { app, admin, mara, maraId, rosaId } = await buehne();
    const gueltig = { category: KATEGORIE, managerId: maraId, criticality: "hoch" };

    expect((await profilSetzen(app, mara, gueltig)).statusCode).toBe(403);
    const falsch = await profilSetzen(app, admin, { category: KATEGORIE, criticality: "extrem" });
    expect(falsch.statusCode).toBe(400);
    expect((await profilSetzen(app, admin, gueltig)).statusCode).toBe(200);

    const horizont = (wer: Kopf, userId: string, horizonMonths: unknown) =>
      app.inject({
        method: "PUT",
        url: `/api/management/profiles/retirement/${userId}`,
        headers: wer,
        payload: { horizonMonths },
      });
    expect((await horizont(mara, rosaId, 24)).statusCode).toBe(403);
    expect((await horizont(admin, "gibt-es-nicht", 24)).statusCode).toBe(404);
    expect((await horizont(admin, rosaId, 12)).statusCode).toBe(400);
    const gesetzt = await horizont(admin, rosaId, 24);
    expect(gesetzt.statusCode).toBe(200);
    expect(gesetzt.json().entry.horizonMonths).toBe(24);

    const lesen = (wer: Kopf) =>
      app.inject({ method: "GET", url: "/api/management/profiles", headers: wer });
    expect((await lesen(mara)).statusCode).toBe(403);
    const profile = (await lesen(admin)).json();
    expect(profile.categories[0].managerId).toBe(maraId);
    expect(profile.retirement[0].userId).toBe(rosaId);
  });

  it("„mein Bereich“: der Verantwortliche sieht Träger, Frist und Arbeitsvorrat — ein anderer Manager nicht", async () => {
    const { app, admin, mara, tom, maraId, rosaId } = await buehne();
    await profilSetzen(app, admin, { category: KATEGORIE, managerId: maraId, criticality: "hoch" });
    await app.inject({
      method: "PUT",
      url: `/api/management/profiles/retirement/${rosaId}`,
      headers: admin,
      payload: { horizonMonths: 36 },
    });
    const blick = (wer: Kopf) => holen(app, "/api/management/risk-horizon", wer);

    const fuerMara = await blick(mara);
    expect(fuerMara.areas).toHaveLength(1);
    const bereich = fuerMara.areas[0];
    expect(bereich.category).toBe(KATEGORIE);
    expect(bereich.singleSource).toBe(true);
    expect(bereich.criticality).toBe("hoch");
    expect(bereich.bearers).toHaveLength(1);
    expect(bereich.bearers[0]).toMatchObject({
      userId: rosaId,
      horizonMonths: 36,
      soleBearer: true,
      koCount: 2,
    });
    expect(bereich.bearers[0].openKoIds).toHaveLength(2);

    // Gegenprobe: Tom verantwortet keinen Bereich — er sieht weder Bereich noch Rosas Horizont.
    const fuerTom = await blick(tom);
    expect(fuerTom.areas).toEqual([]);
    expect(JSON.stringify(fuerTom)).not.toContain(rosaId);
    // Die Pflegerolle sieht alle Bereiche.
    expect((await blick(admin)).seesAll).toBe(true);
  });

  it("die vier gepflegten Stufen erscheinen im Snapshot als Prioritätsfaktoren — dann zählen alle neun", async () => {
    const { app, admin } = await buehne();
    const vorher = zeileVon(await holen(app, "/api/management/snapshot", admin));
    expect(vorher?.knownFactors, "ohne Profil: vier Faktoren ohne Daten").toBe(5);

    await profilSetzen(app, admin, {
      category: KATEGORIE,
      criticality: "hoch",
      processProximity: "mittel",
      repetition: "niedrig",
      damagePotential: "hoch",
    });
    const zeile = zeileVon(await holen(app, "/api/management/snapshot", admin));
    const wert = (k: string) => zeile?.factors.find((f) => f.key === k)?.value;
    expect(wert("criticality")).toBe(100);
    expect(wert("processProximity")).toBe(50);
    expect(wert("repetition")).toBe(0);
    expect(wert("damagePotential")).toBe(100);
    expect(zeile?.knownFactors).toBe(9);
  });
});
