import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryKoSearchProjectionRepo } from "../../knowledge-object";
import type { ConsoleMailer } from "../../notifications";
import {
  ERLAUBTE_FEHLERCODES,
  ERLAUBTE_FEHLERTYPEN,
  ERR_OHNE_CODE,
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  assembleServices,
  baueLoggerOptionen,
  buildApp,
  buildServices,
  erlaubterCode,
  erlaubterTyp,
  inMemoryRepos,
  loeseStufeAuf,
  senkeUeberWert,
} from "./build-app";

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

// ================================================================================================
// JOB 2661 D3 · DER err-SERIALIZER — EINE GESCHLOSSENE ERLAUBNISLISTE, KEIN FREIER WERT
// ================================================================================================
//
// BEN hat D2 beanstandet, und in beiden Punkten zu Recht:
//
//   > „Der vorgelegte Serializer uebernimmt `fehler.name` DIREKT, uebernimmt jedes stringfoermige
//   > `fehler.code` DIREKT und erzeugt `abdruck` DIREKT aus `fehler.message`. Fuer einen Fehler
//   > ohne stringfoermigen Code wird gerade KEIN stabiler Fehlercode erzeugt."
//
//   > „Ein Test gegen vertrauliche Werte in `name` und `code` ist nicht belegt."
//
// Diese Fälle schliessen beides. Sie prüfen den Serializer DIREKT aus der echten Logkonfiguration
// — ohne Route, ohne Server: hier geht es nicht um einen Vorgang, sondern um die Frage, was der
// Serializer überhaupt herausgeben KANN.

describe("JOB 2661 D3: der err-Serializer gibt nur Werte aus geschlossenen Mengen aus", () => {
  type ErrSerializer = (fehler: Error & { code?: unknown }) => Record<string, unknown>;

  function errSerializer(): ErrSerializer {
    const optionen = baueLoggerOptionen({ stufe: "info" }) as unknown as {
      serializers?: { err?: ErrSerializer };
    };
    const err = optionen.serializers?.err;
    expect(typeof err, "kein err-Serializer in der Logkonfiguration").toBe("function");
    return err as ErrSerializer;
  }

  it("die Feldmenge ist abgeschlossen — genau diese fünf, kein sechstes", () => {
    const fehler = new Error("egal") as Error & { code?: string };
    fehler.code = "NOT_FOUND";
    const aus = errSerializer()(fehler);
    // `abdruck` ist seit D3 WEG — er stand hier und war der Befund.
    expect(Object.keys(aus).sort()).toEqual(["code", "herkunft", "message", "stack", "type"]);
    expect(aus).not.toHaveProperty("abdruck");
    expect(aus.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(aus.stack).toBe(ERR_TEXT_UNTERDRUECKT);
  });

  // ----------------------------------------------------------------------------------------------
  // BENS AUFLAGE 3 — vertrauliche Werte in `name` UND `code`, nicht nur in `message`.
  // ----------------------------------------------------------------------------------------------
  it("ein vertraulicher Wert im FEHLERNAMEN erscheint nicht", () => {
    class Boshaft extends Error {
      override name = "Fehler bei anna.meier@klinik-nord.de";
    }
    const aus = errSerializer()(new Boshaft("egal"));
    expect(aus.type).toBe(ERR_UNBEKANNT);
    expect(JSON.stringify(aus)).not.toContain("anna.meier");
    expect(JSON.stringify(aus)).not.toContain("Meier");
  });

  it("ein vertraulicher Wert im FEHLERCODE erscheint nicht — auch in Domänenform nicht", () => {
    // Der gemeine Fall: Der Wert sieht aus wie ein Hauscode (GROSSBUCHSTABEN_MIT_UNTERSTRICH) und
    // wäre durch jede blosse FORMprüfung gekommen. Nur eine Werteliste fängt ihn.
    const fehler = new Error("egal") as Error & { code?: string };
    fehler.code = "ANNA_MEIER_KRANKGEMELDET";
    const aus = errSerializer()(fehler);
    expect(aus.code).toBe(ERR_UNBEKANNT);
    expect(JSON.stringify(aus)).not.toContain("ANNA");
    expect(JSON.stringify(aus)).not.toContain("MEIER");
  });

  it("ein Fehler OHNE Code bekommt trotzdem einen stabilen Code", () => {
    // BEN: „Fuer einen Fehler ohne stringfoermigen Code wird gerade KEIN stabiler Fehlercode
    // erzeugt." Jetzt schon — das Feld ist immer da und immer aus der geschlossenen Menge.
    const aus = errSerializer()(new Error("egal"));
    expect(aus.code).toBe(ERR_OHNE_CODE);
    expect(Object.keys(aus)).toContain("code");
    // Auch ein nicht-stringförmiger Code fällt darauf.
    const mitZahl = new Error("egal") as Error & { code?: unknown };
    mitZahl.code = 42;
    expect(errSerializer()(mitZahl).code).toBe(ERR_OHNE_CODE);
  });

  it("bekannte Werte kommen unverändert durch — sonst wäre die Liste wertlos", () => {
    // Die Kalibrierung: Eine Liste, die alles verwirft, ist von einer kaputten nicht zu
    // unterscheiden.
    const fehler = new Error("egal") as Error & { code?: string };
    fehler.code = "SEARCH_PROJECTION_NOT_READY";
    const aus = errSerializer()(fehler);
    expect(aus.code).toBe("SEARCH_PROJECTION_NOT_READY");
    expect(aus.type).toBe("Error");
    expect(erlaubterCode("23505")).toBe("23505");
    expect(erlaubterTyp("KoError")).toBe("KoError");
  });

  it("der Meldungstext erscheint nirgends — auch nicht als Prüfsumme", () => {
    // DER KERN VON D3. In D2 stand hier ein `abdruck`: der SHA-256-Präfix genau dieser Meldung.
    // Wer den Text riet, konnte ihn am Log bestätigen. Jetzt gibt es nichts mehr, womit sich eine
    // Vermutung prüfen liesse — kein Wert und keine Prüfsumme.
    const geheim = "anna.meier@klinik-nord.de / Anna Meier / Verdacht auf Borreliose";
    const fehler = new Error(`Zustellung fehlgeschlagen: ${geheim}`);
    expect(fehler.stack ?? "").toContain(geheim);

    const aus = errSerializer()(fehler);
    const alsText = JSON.stringify(aus);
    expect(alsText).not.toContain(geheim);
    expect(alsText).not.toContain("Meier");
    expect(alsText).not.toContain("Borreliose");

    // Und die Gegenprobe zur Bestätigungslücke, ausdrücklich: Der SHA-256-Präfix DIESER Meldung
    // steht nirgends in der Ausgabe. In D2 stand er da.
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    const abdruckWieInD2 = createHash("sha256")
      .update(fehler.message, "utf8")
      .digest("hex")
      .slice(0, 12);
    expect(alsText).not.toContain(abdruckWieInD2);

    // Die Ersatzauskunft ist trotzdem da.
    expect(String(aus.herkunft)).toMatch(/^(tests|services|apps|node_modules)\/.+:\d+:\d+$/);
  });

  it("gleiche Ursache, verschiedene Werte im Text → GLEICHER Gruppierungsschlüssel", () => {
    // BENs zweiter Halbsatz: „Bei Meldungen mit eingesetzten Personenwerten gruppiert er ausserdem
    // NICHT die Fehlerursache, sondern verschiedene Meldungstexte." Genau das ist der Grund, warum
    // ein Salt nicht gereicht hätte — es hätte das Raten beendet und die falsche Gruppierung
    // behalten. Der Schlüssel ist jetzt `herkunft` + `code` + `type`.
    function baueFehler(adresse: string): Error & { code?: string } {
      const f = new Error(`SMTP-Zustellung an ${adresse} abgelehnt`) as Error & { code?: string };
      f.code = "NOT_FOUND";
      return f;
    }
    const s = errSerializer();
    const a = s(baueFehler("anna.meier@klinik-nord.de"));
    const b = s(baueFehler("bert.schulz@klinik-nord.de"));
    const schluessel = (x: Record<string, unknown>) => `${x.herkunft}|${x.code}|${x.type}`;
    expect(schluessel(a)).toBe(schluessel(b));
  });

  // ----------------------------------------------------------------------------------------------
  // DIE LISTEN DÜRFEN NICHT STILL VERALTEN — sonst wäre die Erlaubnisliste in einem Jahr eine Lüge.
  // ----------------------------------------------------------------------------------------------
  function quellDateien(): string[] {
    const wurzel = resolve(process.cwd(), "services");
    const treffer: string[] = [];
    const gehe = (ordner: string): void => {
      for (const eintrag of readdirSync(ordner)) {
        const pfad = join(ordner, eintrag);
        if (statSync(pfad).isDirectory()) {
          if (eintrag !== "node_modules") {
            gehe(pfad);
          }
        } else if (pfad.endsWith(".ts") && !pfad.includes(".test.")) {
          treffer.push(pfad);
        }
      }
    };
    gehe(wurzel);
    return treffer;
  }

  it("jede Fehlerklasse aus `services/**` steht auf der Typenliste", () => {
    const gefunden = new Set<string>();
    for (const datei of quellDateien()) {
      for (const m of readFileSync(datei, "utf8").matchAll(/class\s+(\w*Error)\s+extends\s/g)) {
        if (m[1]) {
          gefunden.add(m[1]);
        }
      }
    }
    expect(gefunden.size, "keine Fehlerklasse gefunden — der Sammler ist kaputt").toBeGreaterThan(
      10,
    );
    const fehlen = [...gefunden].filter((n) => !ERLAUBTE_FEHLERTYPEN.has(n)).sort();
    expect(
      fehlen,
      "Neue Fehlerklasse im Baum, aber nicht auf der Logliste — sie erschiene als UNBEKANNT. " +
        "Entscheide, ob ihr Name ins Protokoll darf, und trag sie in `ERLAUBTE_FEHLERTYPEN` ein.",
    ).toEqual([]);
  });

  it("jeder Domänen-Fehlercode aus `services/**` steht auf der Codeliste", () => {
    // DREI SETZFORMEN, und das ist gemessen, nicht geraten: Der Produktcode vergibt seine Codes
    // fast immer als ERSTES KONSTRUKTORARGUMENT (`new KoError("NOT_FOUND", …)`). Der erste Anlauf
    // dieses Wächters suchte nur nach `code: "…"` und fand NULL Treffer — diese Form steht
    // überwiegend in Testdateien. Ein Sammler, der nichts findet, ist ein grüner Wächter ohne
    // Aussage; deshalb steht die Untergrenze darunter.
    const gefunden = new Set<string>();
    const formen = [
      /new\s+[A-Za-z]*Error\(\s*"([A-Z_]{2,})"/g,
      /\bcode:\s*"([A-Z_]{2,})"/g,
      /\bcode\s*=\s*"([A-Z_]{2,})"/g,
    ];
    for (const datei of quellDateien()) {
      // KOMMENTARZEILEN RAUS — gemessen nötig: Der erste Anlauf sammelte `ANNA_MEIER_KRANK` ein,
      // und der Wert stammte aus einem KOMMENTAR in `build-app.ts`, der genau diesen Angriffsfall
      // beschreibt. Ein Sammler, der Beispiele aus Kommentaren für Code hält, pflegt Erfundenes in
      // die Erlaubnisliste — das Gegenteil dessen, wofür er da ist.
      const zeilen = readFileSync(datei, "utf8")
        .split("\n")
        .filter((z) => {
          const roh = z.trimStart();
          return !roh.startsWith("//") && !roh.startsWith("*") && !roh.startsWith("/*");
        });
      const inhalt = zeilen.join("\n");
      for (const form of formen) {
        for (const m of inhalt.matchAll(form)) {
          if (m[1]) {
            gefunden.add(m[1]);
          }
        }
      }
    }
    expect(gefunden.size, "kein Fehlercode gefunden — der Sammler ist kaputt").toBeGreaterThan(10);
    const fehlen = [...gefunden].filter((c) => !ERLAUBTE_FEHLERCODES.has(c)).sort();
    expect(
      fehlen,
      "Neuer Domänencode im Baum, aber nicht auf der Logliste — er erschiene als UNBEKANNT. " +
        "Entscheide und trag ihn in `ERLAUBTE_FEHLERCODES` ein.",
    ).toEqual([]);
  });

  // ----------------------------------------------------------------------------------------------
  // Aus D2 übernommen und unverändert gültig.
  // ----------------------------------------------------------------------------------------------
  it("eine unbekannte Logstufe kostet nicht den Start — sie fällt auf `info` zurück", () => {
    expect(loeseStufeAuf("infoo")).toBe("info");
    expect(loeseStufeAuf("  WARN ")).toBe("warn");
    expect(loeseStufeAuf(undefined)).toBe("info");
    expect((baueLoggerOptionen({ stufe: "infoo" }) as { level?: string }).level).toBe("info");
  });

  it("die Senke fängt Secret-Formen in Meldungstext und Feldern — und lässt Domänencodes stehen", () => {
    expect(senkeUeberWert("Authorization: Bearer abcdefgh12345678", {})).toContain("[redacted]");
    expect(senkeUeberWert("SEARCH_PROJECTION_NOT_READY", {})).toBe("SEARCH_PROJECTION_NOT_READY");
    const fehler = new Error("Anna Meier");
    expect(senkeUeberWert(fehler, {})).toBe(fehler);
  });
});
