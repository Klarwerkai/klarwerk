import { describe, expect, it } from "vitest";
import { InMemoryKoSearchProjectionRepo } from "../../knowledge-object";
import type { ConsoleMailer } from "../../notifications";
import { assembleServices, buildApp, buildServices, inMemoryRepos } from "./build-app";

describe("buildApp (Composition Root)", () => {
  it("Health + Reasoner-Status (deterministisch)", async () => {
    const app = buildApp();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json().status).toBe("ok");

    const status = await app.inject({ method: "GET", url: "/api/reasoner/status" });
    expect(status.json().mode).toBe("deterministic");
    await app.close();
  });

  it("End-to-end: Registrierung → Login → geschützte KO-Liste über alle Module", async () => {
    const services = buildServices();
    const app = buildApp(services);

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    const token = login.json().token as string;

    // Ohne Token verweigert die Rechteprüfung (FR-RBAC-04).
    const unauth = await app.inject({ method: "GET", url: "/api/kos" });
    expect(unauth.statusCode).toBe(401);

    // Admin (erstes Konto) hat ko.read → 200.
    const kos = await app.inject({
      method: "GET",
      url: "/api/kos",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(kos.statusCode).toBe(200);
    expect(Array.isArray(kos.json())).toBe(true);
    await app.close();
  });
});

describe("KO-API (§2.3)", () => {
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

  it("CRUD + Action-Dispatcher: anlegen, lesen, kategorisieren, bewerten, löschen", async () => {
    const { app, headers } = await adminApp();

    const create = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().author).toBeTruthy(); // FR-CAP-07: Autor serverseitig gesetzt
    const id = create.json().id as string;

    expect((await app.inject({ method: "GET", url: "/api/kos", headers })).json()).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ method: "GET", url: "/api/kos/unbekannt", headers })).statusCode,
    ).toBe(404);

    const cat = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "category", category: "Anlage 2" },
    });
    expect(cat.statusCode).toBe(200);
    expect(cat.json().category).toBe("Anlage 2");

    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode).toBe(200);

    expect(
      (await app.inject({ method: "DELETE", url: `/api/kos/${id}`, headers })).statusCode,
    ).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/kos", headers })).json()).toHaveLength(0);
    await app.close();
  });

  it("verweigert ohne Anmeldung (401) und bei unbekannter Aktion (400)", async () => {
    const { app, headers } = await adminApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: "X", statement: "Y", type: "best_practice", category: "A" },
    });
    const id = create.json().id as string;

    const noauth = await app.inject({
      method: "POST",
      url: "/api/kos",
      payload: { title: "Z", statement: "W", type: "best_practice", category: "A" },
    });
    expect(noauth.statusCode).toBe(401);

    const bad = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "frobnicate" },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });
});

describe("Restliche API end-to-end (§2.4/§2.5)", () => {
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

  it("Entwurf → Promote → Bibliothek/Analytics; Ask, Audit, Reasoner, i18n", async () => {
    const { app, headers } = await adminApp();

    // Entwurf anlegen und zu einem KO befördern (FR-CAP-07).
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Ventil schließen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(draft.statusCode).toBe(201);
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.json().id}/promote`,
      headers,
    });
    expect(promote.statusCode).toBe(201);

    // Bibliothekssuche findet das beförderte KO.
    const search = await app.inject({
      method: "GET",
      url: "/api/library/search?q=überdruck",
      headers,
    });
    expect(search.json()).toHaveLength(1);

    // Analytics zählt es.
    const analytics = await app.inject({ method: "GET", url: "/api/analytics", headers });
    expect(analytics.json().total).toBe(1);

    // Validierungs-Board + Lücken + Audit erreichbar.
    expect(
      (await app.inject({ method: "GET", url: "/api/validation/board", headers })).statusCode,
    ).toBe(200);
    const ask = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was tun bei Überdruck?" },
    });
    expect(ask.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/gaps", headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/audit", headers })).statusCode).toBe(200);

    // Reasoner (deterministisch) strukturiert Rohtext.
    const structure = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "structure", text: "Pumpe alle 200h schmieren." },
    });
    expect(structure.statusCode).toBe(200);
    expect(typeof structure.json().title).toBe("string");

    // i18n-Locales sind öffentlich lesbar.
    const locales = await app.inject({ method: "GET", url: "/api/i18n/locales" });
    expect(locales.statusCode).toBe(200);
    expect(Array.isArray(locales.json().locales)).toBe(true);

    await app.close();
  });

  it("Draft-Liste zeigt Admin alle Entwuerfe und normalen Nutzern nur eigene", async () => {
    const { app, headers: adminHeaders } = await adminApp();

    const adminDraft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: adminHeaders,
      payload: {
        title: "Admin Entwurf",
        statement: "Nur Admin.",
        type: "best_practice",
        category: "A",
      },
    });
    expect(adminDraft.statusCode).toBe(201);

    const createUser = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name: "Erik", email: "erik@x.de", password: "secret123", role: "experte" },
    });
    expect(createUser.statusCode).toBe(201);

    const erikLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "erik@x.de", password: "secret123" },
    });
    const erikHeaders = { authorization: `Bearer ${erikLogin.json().token}` };

    const erikDraft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: erikHeaders,
      payload: {
        title: "Erik Entwurf",
        statement: "Nur Erik.",
        type: "best_practice",
        category: "B",
      },
    });
    expect(erikDraft.statusCode).toBe(201);

    const adminList = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: adminHeaders,
    });
    expect(adminList.statusCode).toBe(200);
    expect(adminList.json().map((draft: { id: string }) => draft.id)).toEqual([
      adminDraft.json().id,
      erikDraft.json().id,
    ]);

    const erikList = await app.inject({ method: "GET", url: "/api/drafts", headers: erikHeaders });
    expect(erikList.statusCode).toBe(200);
    expect(erikList.json().map((draft: { id: string }) => draft.id)).toEqual([erikDraft.json().id]);

    const erikReadsAdmin = await app.inject({
      method: "GET",
      url: `/api/drafts/${adminDraft.json().id}`,
      headers: erikHeaders,
    });
    expect(erikReadsAdmin.statusCode).toBe(403);

    await app.close();
  });

  it("FR-ANA-02: Wirkungs-Dashboard zählt Antwortquote ohne Lücke", async () => {
    const { app, headers } = await adminApp();
    await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil bei Überdruck",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });

    // Eine beantwortbare Frage und eine ohne belastbares Wissen (→ Lücke).
    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Überdruck Ventil" },
    });
    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie hoch ist der Aktienkurs?" },
    });

    const impact = await app.inject({ method: "GET", url: "/api/analytics/impact", headers });
    expect(impact.statusCode).toBe(200);
    expect(impact.json().askTotal).toBe(2);
    expect(impact.json().answeredWithoutGap).toBe(1);
    expect(impact.json().answerRate).toBeCloseTo(0.5);
    await app.close();
  });
});

describe("FR-VAL-07: Benachrichtigungen", () => {
  it("Zuweisung schickt dem Zugewiesenen eine E-Mail", async () => {
    const services = buildServices();
    const app = buildApp(services);
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
    const headers = { authorization: `Bearer ${login.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    const adminId = me.json().id as string;

    const create = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "A",
      },
    });
    await app.inject({
      method: "PUT",
      url: `/api/kos/${create.json().id}`,
      headers,
      payload: { action: "assign", userIds: [adminId] },
    });

    const mailer = services.mailer as ConsoleMailer;
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("a@x.de");
    await app.close();
  });
});

// ================================================================================================
// G27 R1 — DIE BETRIEBSORCHESTRIERUNG BEIM APP-START (KW-ARCH-G27-BETRIEBSORCHESTRIERUNG-06)
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD UND WARUM ES DER BLOCKER WAR. Bis zu dieser Welle rief in der ganzen
// Kompositionswurzel NIEMAND die Aktivierung der Suchprojektion. Eine echte App startete deshalb
// mit `UNINITIALIZED`, und weil die Suche seit R1 fail-closed ist, beantwortete sie überhaupt keine
// Suchanfrage mehr. BENs ROT-1, wörtlich: „Eine echte App startet mit nicht freigegebener Suche."
//
// Die Zusicherungen unten laufen über `app.inject()` — das löst `app.ready()` aus und damit den
// `onReady`-Hook. Sie messen also den ECHTEN Startweg und nicht einen nachgebauten.

describe("G27 R1 · App-Start · zustandsabhängige Betriebsfolge (06 §2)", () => {
  it("UNINITIALIZED: die App aktiviert V2 beim Start und ist danach fachlich suchbereit", async () => {
    const services = buildServices();
    // Vorzustand belegt, nicht angenommen.
    expect((await services.ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");

    const app = buildApp(services);
    await app.ready();

    const control = await services.ko.searchProjectionControl();
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.activeProjectionVersion).toBe(2);
    // Freigegeben ist eine GENERATION, und der Marker gilt für genau sie (09 §2/§3).
    expect(control.activeGeneration).toBe(control.buildGeneration);
    expect(control.integrityMarker).toBe(`V2-READY:${control.activeGeneration}`);
    await app.close();
  });

  it("V2_ACTIVE: ein zweiter Start baut NICHTS neu — keine neue Generation (06 §5/§6)", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.ready();
    const nachErstem = await services.ko.searchProjectionControl();

    // Zweite App-Instanz auf DENSELBEN Diensten = Neustart eines Prozesses auf demselben Bestand.
    const app2 = buildApp(services);
    await app2.ready();
    const nachZweitem = await services.ko.searchProjectionControl();

    // Byte-gleich: kein Rebuild, keine erneute Aktivierung, kein Generationswechsel. Ein Rebuild
    // bei jedem App-Start ist ein ausdrückliches No-Go (06 §6).
    expect(nachZweitem).toEqual(nachErstem);
    await app.close();
    await app2.close();
  });

  it("V2_BUILDING: der Neustart setzt DIESELBE Generation fort statt neu zu beginnen", async () => {
    const services = buildServices();
    // Ein abgestürzter Bau: begonnen, nie fertig geworden.
    await services.ko.beginSearchProjectionBuild();
    const imBau = await services.ko.searchProjectionControl();
    expect(imBau.projectionState).toBe("V2_BUILDING");

    const app = buildApp(services);
    await app.ready();

    const control = await services.ko.searchProjectionControl();
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.activeGeneration).toBe(imBau.buildGeneration);
    await app.close();
  });

  it("FAILED: der Neustart führt über die vollständige V2-Recovery zurück in den Betrieb", async () => {
    const services = buildServices();
    const vor = buildApp(services);
    await vor.ready();
    await vor.close();
    await services.ko.rollbackSearchProjectionVersion("Störung");
    expect((await services.ko.searchProjectionControl()).projectionState).toBe("FAILED");

    const app = buildApp(services);
    await app.ready();
    expect((await services.ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");
    await app.close();
  });

  it("V2_ACTIVE mit gefallenem Marker: der Start repariert über die Recovery, nicht durch Wegsehen", async () => {
    // Der Projektionsadapter wird über DIESELBE öffentliche Injektionsstelle verdrahtet, die auch
    // `buildPgServices` benutzt — so kommt die Gegenprobe an den beschädigenden Eingriff heran,
    // ohne in den Dienst hineinzugreifen.
    const repos = inMemoryRepos();
    const projections = new InMemoryKoSearchProjectionRepo(repos.koRepo);
    const services = assembleServices(repos, { searchProjections: projections });
    const vor = buildApp(services);
    await vor.ready();
    await vor.close();
    const gesund = await services.ko.searchProjectionControl();

    // Ein Objekt anlegen und danach seine bedienende Zeile entfernen — der Marker fällt.
    const angelegt = await services.ko.create({
      title: "Nach der Freigabe",
      statement: "s",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: "<p>Recoverywort</p>",
    });
    const projektion = await services.ko.searchProjectionOf(angelegt.id);
    await projections.remove(angelegt.id, projektion?.koVersion as number);
    expect((await services.ko.searchProjectionControl()).integrityMarker).toBeNull();

    const app = buildApp(services);
    await app.ready();
    const control = await services.ko.searchProjectionControl();
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.integrityMarker).not.toBeNull();
    // Eine NEUE Generation — der beschädigte Bestand wird nicht für geprüft erklärt.
    expect(control.activeGeneration).toBeGreaterThan(gesund.activeGeneration as number);
    await app.close();
  });
});
